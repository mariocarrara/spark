<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use App\Services\Auditoria;
use App\Services\Matriz;
use App\Services\SessaoToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * /api/usuarios/* — contrato do legado (routes/usuarios.ps1), com estas travas a mais:
 *  - quem nao e administrador nao mexe em conta de administrador nem cria administrador;
 *  - respostas nunca levam senha; bloquear/excluir/redefinir senha derruba as sessoes do alvo;
 *  - senha minima config('spark.senha_min').
 */
class UsuarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Usuario::orderBy('nome')->get()->map(fn (Usuario $u) => self::resumo($u))->values());
    }

    /** Publica (tela de login). Resposta sempre igual para nao revelar quem ja tem cadastro. */
    public function solicitarCadastro(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim((string) $request->input('email', '')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 200) {
            return response()->json(['erro' => 'Informe um e-mail válido.'], 400);
        }
        $senha = (string) $request->input('senha', '');
        $min = config('spark.senha_min');
        if (mb_strlen($senha) < $min || strlen($senha) > 72) { // bcrypt ignora o que passa de 72 bytes
            return response()->json(['erro' => "Escolha uma senha de {$min} a 72 caracteres."], 400);
        }
        if ($motivo = self::forcaSenha($senha, $email)) {
            return response()->json(['erro' => $motivo], 400);
        }
        $nome = mb_substr(trim(strip_tags((string) $request->input('nome', ''))), 0, 120);
        // hash calculado SEMPRE (antes de saber se o e-mail existe), para o tempo de resposta nao entregar isso
        $hash = Hash::make($senha);

        DB::transaction(function () use ($email, $nome, $hash, $request) {
            $jaUsuario = Usuario::whereRaw('lower(email) = ?', [$email])->exists();
            $jaPedido = DB::table('solicitacoes_cadastro')->whereRaw('lower(email) = ?', [$email])->where('status', 'Pendente')->exists();
            if ($jaUsuario || $jaPedido) {
                return;
            }
            $sid = 's-'.Str::uuid();
            DB::table('solicitacoes_cadastro')->insert(['id' => $sid, 'email' => $email, 'status' => 'Pendente', 'criado_em' => now()]);
            // Aparece na lista como pendente, ja com a senha que a pessoa escolheu;
            // o login so funciona depois que um administrador aprovar (status Ativo).
            $u = new Usuario(['id' => 'u-'.Str::uuid(), 'nome' => $nome !== '' ? $nome : Str::before($email, '@'), 'email' => $email, 'status_conta' => 'PendenteAprovacao', 'perfil_base' => 'Consulta']);
            $u->senha_hash = $hash;
            $u->save();
            Auditoria::registrar('solicitar_cadastro', 'usuarios', $u->id, null, ['email' => $email, 'solicitacao' => $sid], $request->ip());
        });

        return response()->json(['ok' => true, 'mensagem' => 'Pedido recebido. Um administrador vai analisar e liberar seu acesso.']);
    }

    public function solicitacoes(Request $request): JsonResponse
    {
        if (! $request->user()->pode('usuarios', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para ver solicitações de cadastro.'], 403);
        }
        $lista = DB::table('solicitacoes_cadastro')->where('status', 'Pendente')->orderBy('criado_em')->get()
            ->map(function ($s) {
                $u = Usuario::whereRaw('lower(email) = ?', [mb_strtolower(trim($s->email))])->where('status_conta', 'PendenteAprovacao')->first();

                // temSenha: a pessoa ja escolheu a propria senha no pedido (o admin nao precisa definir)
                return ['id' => $s->id, 'email' => $s->email, 'status' => $s->status, 'criadoEm' => self::iso($s->criado_em),
                    'nome' => $u?->nome, 'temSenha' => (bool) ($u && (! empty($u->senha_hash) || ! empty($u->senha_legada)))];
            });

        return response()->json($lista->values());
    }

    public function aprovar(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para aprovar cadastros.'], 403);
        }
        $solic = DB::table('solicitacoes_cadastro')->where('id', $id)->first();
        if (! $solic) {
            return response()->json(['erro' => 'Solicitação não encontrada.'], 404);
        }
        if ($solic->status !== 'Pendente') {
            return response()->json(['erro' => 'Essa solicitação já foi decidida.'], 409);
        }
        // Senha: opcional se a pessoa ja escolheu a dela no pedido; se o admin informar, substitui.
        $senha = (string) $request->input('senha', '');
        $min = config('spark.senha_min');
        $pendente = Usuario::whereRaw('lower(email) = ?', [mb_strtolower(trim($solic->email))])->where('status_conta', 'PendenteAprovacao')->first();
        $jaTemSenha = $pendente && (! empty($pendente->senha_hash) || ! empty($pendente->senha_legada));
        if ($senha === '' && ! $jaTemSenha) {
            return response()->json(['erro' => "Defina uma senha inicial (mínimo {$min} caracteres)."], 400);
        }
        if ($senha !== '' && mb_strlen($senha) < $min) {
            return response()->json(['erro' => "Defina uma senha inicial (mínimo {$min} caracteres)."], 400);
        }
        $perfil = $request->input('perfilBase') ?: 'Consulta';
        if (! Matriz::perfilValido($perfil)) {
            return response()->json(['erro' => 'Perfil inválido.'], 400);
        }
        if ($perfil === Usuario::ADMIN && ! $eu->isAdmin()) {
            return response()->json(['erro' => 'Só um administrador pode criar outro administrador.'], 403);
        }

        $email = mb_strtolower(trim($solic->email));
        $nomeInformado = trim((string) $request->input('nome', ''));

        $u = DB::transaction(function () use ($id, $email, $nomeInformado, $senha, $perfil, $eu) {
            $u = Usuario::whereRaw('lower(email) = ?', [$email])->first();
            if (! $u || ! $u->ativo()) {
                $u ??= new Usuario(['id' => 'u-'.Str::uuid(), 'email' => $email]);
                $u->nome = $nomeInformado !== '' ? $nomeInformado : ($u->nome ?: Str::before($email, '@'));
                if ($senha !== '') {
                    $u->senha_hash = Hash::make($senha);
                    $u->senha_legada = null;
                }
                $u->status_conta = 'Ativo';
                $u->perfil_base = $perfil;
                $u->save();
            }
            if (! DB::table('permissoes')->where('usuario_id', $u->id)->exists()) {
                Matriz::gravar($u->id, Matriz::doPerfil($u->perfil_base));
            }
            DB::table('solicitacoes_cadastro')->where('id', $id)->update(['status' => 'Aprovada', 'decidido_em' => now(), 'decidido_por' => $eu->nome]);

            return $u;
        });
        Auditoria::registrar('aprovar_cadastro', 'usuarios', $u->id, $eu->id, ['solicitacao' => $id, 'perfil' => $u->perfil_base], $request->ip());

        return response()->json(self::resumo($u));
    }

    public function recusar(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para recusar cadastros.'], 403);
        }
        $solic = DB::table('solicitacoes_cadastro')->where('id', $id)->first();
        if (! $solic) {
            return response()->json(['erro' => 'Solicitação não encontrada.'], 404);
        }
        DB::transaction(function () use ($id, $solic, $eu) {
            DB::table('solicitacoes_cadastro')->where('id', $id)->update(['status' => 'Recusada', 'decidido_em' => now(), 'decidido_por' => $eu->nome]);
            // remove o usuario pendente criado pelo pedido (nunca um que ja entrou alguma vez)
            Usuario::whereRaw('lower(email) = ?', [mb_strtolower(trim($solic->email))])
                ->where('status_conta', 'PendenteAprovacao')->whereNull('ultimo_login')
                ->get()->each(fn (Usuario $u) => self::apagar($u));
        });
        Auditoria::registrar('recusar_cadastro', 'usuarios', null, $eu->id, ['solicitacao' => $id], $request->ip());

        return response()->json(['id' => $id, 'status' => 'Recusada']);
    }

    public function liberar(Request $request, string $id): JsonResponse
    {
        return $this->mudarStatus($request, $id, 'editar', 'Ativo', 'liberar', 'Sem permissão para liberar Usuários.');
    }

    public function bloquear(Request $request, string $id): JsonResponse
    {
        if ($id === $request->user()->id) {
            return response()->json(['erro' => 'Você não pode bloquear a própria conta.'], 400);
        }

        return $this->mudarStatus($request, $id, 'excluirStatus', 'Bloqueado', 'bloquear', 'Sem permissão para bloquear Usuários.');
    }

    public function desbloquear(Request $request, string $id): JsonResponse
    {
        return $this->mudarStatus($request, $id, 'excluirStatus', 'Ativo', 'desbloquear', 'Sem permissão para desbloquear Usuários.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'excluirStatus')) {
            return response()->json(['erro' => 'Sem permissão para excluir Usuários.'], 403);
        }
        if ($id === $eu->id) {
            return response()->json(['erro' => 'Você não pode excluir a própria conta.'], 400);
        }
        $alvo = Usuario::find($id);
        if (! $alvo) {
            return response()->json(['erro' => 'Usuário não encontrado.'], 404);
        }
        if ($r = self::protegerAdmin($eu, $alvo)) {
            return $r;
        }
        if ($alvo->status_conta !== 'Bloqueado') {
            return response()->json(['erro' => 'Só é possível excluir usuários bloqueados. Bloqueie o acesso primeiro.'], 409);
        }
        DB::transaction(fn () => self::apagar($alvo));
        Auditoria::registrar('excluir', 'usuarios', $id, $eu->id, ['email' => $alvo->email], $request->ip());

        return response()->json(['ok' => true, 'id' => $id]);
    }

    public function redefinirSenha(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para redefinir senha de outro usuário.'], 403);
        }
        $min = config('spark.senha_min');
        $nova = (string) $request->input('senhaNova', '');
        if (mb_strlen($nova) < $min) {
            return response()->json(['erro' => "A senha precisa ter pelo menos {$min} caracteres."], 400);
        }
        $alvo = Usuario::find($id);
        if (! $alvo) {
            return response()->json(['erro' => 'Usuário não encontrado.'], 404);
        }
        if ($r = self::protegerAdmin($eu, $alvo)) {
            return $r;
        }
        $alvo->senha_hash = Hash::make($nova);
        $alvo->senha_legada = null;
        $alvo->save();
        SessaoToken::revogarTodas($alvo->id, $alvo->id === $eu->id ? $request->bearerToken() : null);
        Auditoria::registrar('redefinir_senha', 'usuarios', $alvo->id, $eu->id, [], $request->ip());

        return response()->json(['ok' => true]);
    }

    private function mudarStatus(Request $request, string $id, string $acao, string $status, string $nomeAcao, string $erro): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', $acao)) {
            return response()->json(['erro' => $erro], 403);
        }
        $alvo = Usuario::find($id);
        if (! $alvo) {
            return response()->json(['erro' => 'Usuário não encontrado.'], 404);
        }
        if ($r = self::protegerAdmin($eu, $alvo)) {
            return $r;
        }
        $antes = $alvo->status_conta;

        DB::transaction(function () use ($alvo, $status, $nomeAcao, $eu) {
            $alvo->status_conta = $status;
            $alvo->save();
            if ($status === 'Bloqueado') {
                SessaoToken::revogarTodas($alvo->id);
            }
            if ($nomeAcao === 'liberar') {
                DB::table('solicitacoes_cadastro')->whereRaw('lower(email) = ?', [mb_strtolower(trim($alvo->email))])->where('status', 'Pendente')
                    ->update(['status' => 'Aprovada', 'decidido_em' => now(), 'decidido_por' => $eu->nome]);
                if (! DB::table('permissoes')->where('usuario_id', $alvo->id)->exists()) {
                    Matriz::gravar($alvo->id, Matriz::doPerfil($alvo->perfil_base));
                }
            }
        });
        Auditoria::registrar($nomeAcao, 'usuarios', $alvo->id, $eu->id, ['status' => ['de' => $antes, 'para' => $status]], $request->ip());

        return response()->json(self::resumo($alvo));
    }

    /**
     * v3.18 (Test-ForcaSenha): senha escolhida no pedido de cadastro precisa de letra e numero, nao pode ser comum,
     * nem um caractere repetido, nem conter o e-mail. -> motivo, ou null se estiver ok.
     */
    public static function forcaSenha(string $senha, string $email): ?string
    {
        if (! preg_match('/[A-Za-z]/', $senha)) {
            return 'Use pelo menos uma letra na senha.';
        }
        if (! preg_match('/[0-9]/', $senha)) {
            return 'Use pelo menos um número na senha.';
        }
        $min = mb_strtolower($senha);
        $comuns = ['12345678', '123456789', '1234567890', 'abc12345', 'senha123', 'senha1234', 'password1', 'password123', 'qwerty123', 'energisa1', 'energisa123',
            'spark1234', 'spark123', 'admin123', 'mudar123'];
        if (in_array($min, $comuns, true)) {
            return 'Essa senha é muito comum. Escolha outra.';
        }
        if (preg_match('/^(.)\1+$/u', $senha)) {
            return 'A senha não pode repetir o mesmo caractere.';
        }
        $local = mb_strtolower(trim(explode('@', $email)[0]));
        if (mb_strlen($local) >= 4 && str_contains($min, $local)) {
            return 'A senha não pode conter o seu e-mail.';
        }

        return null;
    }

    /** Conta de administrador so e mexida por administrador. */
    public static function protegerAdmin(Usuario $eu, Usuario $alvo): ?JsonResponse
    {
        if ($alvo->perfil_base === Usuario::ADMIN && ! $eu->isAdmin()) {
            return response()->json(['erro' => 'Só um administrador pode alterar a conta de outro administrador.'], 403);
        }

        return null;
    }

    private static function apagar(Usuario $u): void
    {
        // no Postgres o ON DELETE CASCADE ja faria isso; explicito para nao depender do banco
        DB::table('permissoes')->where('usuario_id', $u->id)->delete();
        DB::table('sessoes')->where('usuario_id', $u->id)->delete();
        $u->delete();
    }

    public static function resumo(Usuario $u): array
    {
        return ['id' => $u->id, 'nome' => $u->nome, 'email' => $u->email, 'statusConta' => $u->status_conta, 'perfilBase' => $u->perfil_base];
    }

    private static function iso($valor): ?string
    {
        return $valor ? \Illuminate\Support\Carbon::parse($valor)->toIso8601String() : null;
    }
}
