<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use App\Services\Auditoria;
use App\Services\Matriz;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** /api/permissoes/{usuarioId} — contrato do legado (Invoke-PermissoesRoute). */
class PermissaoController extends Controller
{
    /**
     * Qualquer usuario logado le (o front carrega a matriz de todos no boot para montar
     * a tela de Usuarios; mudar isso exige mexer no front).
     */
    public function show(string $usuarioId): JsonResponse
    {
        if (! Usuario::whereKey($usuarioId)->exists()) {
            return response()->json(['erro' => 'Usuário não encontrado.'], 404);
        }

        return response()->json(['usuarioId' => $usuarioId, 'matriz' => (object) Matriz::ler($usuarioId)]);
    }

    public function update(Request $request, string $usuarioId): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para alterar matriz de permissões.'], 403);
        }
        $alvo = Usuario::find($usuarioId);
        if (! $alvo) {
            return response()->json(['erro' => 'Usuário não encontrado.'], 404);
        }
        if ($r = UsuarioController::protegerAdmin($eu, $alvo)) {
            return $r;
        }
        if ($alvo->id === $eu->id && ! $eu->isAdmin()) {
            return response()->json(['erro' => 'Você não pode alterar as próprias permissões.'], 403);
        }
        $matriz = $request->input('matriz');
        if (! is_array($matriz)) {
            return response()->json(['erro' => 'Informe a matriz de permissões.'], 400);
        }
        $perfil = $request->input('perfilBase');
        if ($perfil !== null && $perfil !== '') {
            if (! Matriz::perfilValido($perfil)) {
                return response()->json(['erro' => 'Perfil inválido.'], 400);
            }
            if ($perfil === Usuario::ADMIN && ! $eu->isAdmin()) {
                return response()->json(['erro' => 'Só um administrador pode dar perfil de administrador.'], 403);
            }
            if ($alvo->id === $eu->id && $perfil !== Usuario::ADMIN) {
                return response()->json(['erro' => 'Você não pode tirar o próprio perfil de administrador.'], 400);
            }
        } else {
            $perfil = null;
        }

        $antes = Matriz::ler($alvo->id);
        $perfilAntes = $alvo->perfil_base;
        $nova = DB::transaction(function () use ($alvo, $matriz, $perfil) {
            if ($perfil !== null) {
                $alvo->perfil_base = $perfil;
                $alvo->save();
            }

            return Matriz::gravar($alvo->id, $matriz);
        });
        Auditoria::registrar('alterar_permissoes', 'usuarios', $alvo->id, $eu->id, [
            'perfil' => ['de' => $perfilAntes, 'para' => $alvo->perfil_base],
            'matriz' => ['de' => $antes, 'para' => $nova],
        ], $request->ip());

        return response()->json(['usuarioId' => $alvo->id, 'matriz' => (object) $nova]);
    }
}
