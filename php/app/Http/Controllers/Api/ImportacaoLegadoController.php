<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Process\Process;

/**
 * Gestao de Bases > "Importar sistema antigo" (SO ADMINISTRADOR).
 * Recebe os arquivos ESCOLHIDOS da pasta model/ do PowerShell (JSON/TSV) em pedacos e roda o
 * migracao/migrar.php, que substitui SO as partes cujos arquivos vieram (numa transacao: se falhar, nada muda).
 *
 *   POST /api/importacao/legado/iniciar            -> { lote }
 *   POST /api/importacao/legado/{lote}/parte       multipart: nome, offset, parte (pedaco do arquivo)
 *   POST /api/importacao/legado/{lote}/executar    -> { ok, log, arquivos }
 *   DELETE /api/importacao/legado/{lote}           descarta o lote
 *
 * Os arquivos ficam em storage/app/legado/<lote>/ (fora da pasta publica) e sao apagados no fim.
 */
class ImportacaoLegadoController extends Controller
{
    private const NOME_OK = '/^[A-Za-z0-9_\-]{1,120}\.(json|jsonl|tsv)$/';
    private const LOTE_OK = '/^[0-9a-f\-]{36}$/';

    public function iniciar(Request $request): JsonResponse
    {
        $lote = (string) Str::uuid();
        File::ensureDirectoryExists(self::pasta($lote));
        self::limparLotesVelhos();

        return response()->json(['lote' => $lote, 'tamanhoMaximoMb' => (int) config('spark.legado_max_mb')]);
    }

    public function parte(Request $request, string $lote): JsonResponse
    {
        if (! preg_match(self::LOTE_OK, $lote) || ! is_dir(self::pasta($lote))) {
            return response()->json(['erro' => 'Lote de importação não encontrado. Comece de novo.'], 404);
        }
        $nome = (string) $request->input('nome', '');
        if (! preg_match(self::NOME_OK, $nome)) {
            return response()->json(['erro' => "Arquivo ignorado: {$nome} (só .json, .jsonl e .tsv da pasta model)."], 400);
        }
        $parte = $request->file('parte');
        if (! $parte || ! $parte->isValid()) {
            return response()->json(['erro' => 'Pedaço do arquivo não chegou (limite de upload do PHP?).'], 400);
        }
        $destino = self::pasta($lote).DIRECTORY_SEPARATOR.$nome;
        clearstatcache(); // filesize() tem cache por processo
        $atual = is_file($destino) ? filesize($destino) : 0;
        $offset = (int) $request->input('offset', 0);
        if ($offset !== $atual) {
            return response()->json(['erro' => "Pedaço fora de ordem em {$nome} (esperava a posição {$atual})."], 409);
        }
        $total = self::tamanhoLote($lote) + $parte->getSize();
        if ($total > config('spark.legado_max_mb') * 1024 * 1024) {
            return response()->json(['erro' => 'Passou do tamanho máximo da importação ('.config('spark.legado_max_mb').' MB).'], 413);
        }
        $in = fopen($parte->getRealPath(), 'rb');
        $out = fopen($destino, 'ab');
        stream_copy_to_stream($in, $out);
        fclose($in);
        fclose($out);
        clearstatcache(true, $destino);

        return response()->json(['ok' => true, 'nome' => $nome, 'tamanho' => filesize($destino)]);
    }

    public function executar(Request $request, string $lote): JsonResponse
    {
        $eu = $request->user();
        if (! preg_match(self::LOTE_OK, $lote) || ! is_dir(self::pasta($lote))) {
            return response()->json(['erro' => 'Lote de importação não encontrado. Comece de novo.'], 404);
        }
        if ($request->input('confirmacao') !== 'SUBSTITUIR') {
            return response()->json(['erro' => 'Falta a confirmação (digite SUBSTITUIR).'], 400);
        }
        $pasta = self::pasta($lote);
        $arquivos = array_map('basename', glob($pasta.DIRECTORY_SEPARATOR.'*') ?: []);
        if (! $arquivos) {
            return response()->json(['erro' => 'Nenhum arquivo chegou. Escolha a pasta "model" e marque o que quer importar.'], 400);
        }

        // guarda quem esta importando: se o e-mail dele nao vier nos dados antigos, ele e recolocado (nao fica trancado fora)
        $eu->refresh();
        $minhaLinha = (array) DB::table('usuarios')->where('id', $eu->id)->first();
        $minhasPerms = DB::table('permissoes')->where('usuario_id', $eu->id)->get()->map(fn ($p) => (array) $p)->all();

        // configuracao JA interpretada pelo Laravel (no Render o banco vem de DB_URL; os campos soltos ficam no padrao)
        $c = DB::connection()->getConfig();
        $dsn = "pgsql:host={$c['host']};port=".($c['port'] ?: 5432).";dbname={$c['database']}".(! empty($c['sslmode']) ? ";sslmode={$c['sslmode']}" : '');
        $script = config('spark.migrar_script');
        $env = ['SPARK_DB_PASS' => (string) $c['password']];
        if (PHP_OS_FAMILY === 'Windows') {
            // o "artisan serve" repassa um ambiente reduzido; sem SystemRoot o Windows nao abre socket (erro 10106)
            $env['SystemRoot'] = getenv('SystemRoot') ?: (getenv('SYSTEMROOT') ?: 'C:\\Windows');
        }
        // PHP_BINARY so vale no PHP de linha de comando; no Apache (Render) ele aponta para o proprio Apache
        $php = (new PhpExecutableFinder)->find(false);
        if (! $php) {
            File::deleteDirectory($pasta);

            return response()->json(['erro' => 'Não encontrei o executável do PHP no servidor para rodar a importação.'], 500);
        }

        @set_time_limit(0);
        try {
            $proc = new Process([$php, '-d', 'memory_limit=-1', $script, $pasta, $dsn, (string) $c['username']], dirname($script),
                $env, null, (float) config('spark.legado_timeout_s'));
            $proc->run();
            $log = trim($proc->getOutput()."\n".$proc->getErrorOutput());
        } catch (\Throwable $e) {
            report($e);
            File::deleteDirectory($pasta);

            return response()->json(['erro' => 'A importação não conseguiu começar e nada foi alterado. Motivo: '.$e->getMessage()], 500);
        }
        File::deleteDirectory($pasta);

        if (! $proc->isSuccessful()) {
            Auditoria::registrar('importar_legado_falhou', 'importacao', $lote, $eu->id, ['arquivos' => count($arquivos), 'saida' => mb_substr($log, -2000)], $request->ip());

            $linhas = array_values(array_filter(array_map('trim', explode("\n", $log))));
            $util = array_values(array_filter($linhas, fn ($l) => preg_match('/ERRO|Exception|SQLSTATE|Fatal/i', $l)));
            $motivo = mb_substr(($util[0] ?? end($linhas)) ?: 'sem detalhe', 0, 300);

            return response()->json(['erro' => "A importação falhou e nada foi alterado. Motivo: {$motivo}", 'log' => $log], 500);
        }

        $recolocado = false;
        if ($minhaLinha && ! DB::table('usuarios')->whereRaw('lower(email) = ?', [mb_strtolower($minhaLinha['email'])])->exists()) {
            DB::transaction(function () use ($minhaLinha, $minhasPerms) {
                DB::table('usuarios')->insert($minhaLinha);
                if ($minhasPerms) {
                    DB::table('permissoes')->insert($minhasPerms);
                }
            });
            $recolocado = true;
        }
        Auditoria::registrar('importar_legado', 'importacao', $lote, $eu->id, ['arquivos' => $arquivos, 'adminRecolocado' => $recolocado], $request->ip());

        return response()->json(['ok' => true, 'arquivos' => count($arquivos), 'adminRecolocado' => $recolocado, 'log' => $log]);
    }

    public function descartar(string $lote): JsonResponse
    {
        if (preg_match(self::LOTE_OK, $lote)) {
            File::deleteDirectory(self::pasta($lote));
        }

        return response()->json(['ok' => true]);
    }

    private static function pasta(string $lote): string
    {
        return storage_path('app'.DIRECTORY_SEPARATOR.'legado'.DIRECTORY_SEPARATOR.$lote);
    }

    private static function tamanhoLote(string $lote): int
    {
        $t = 0;
        foreach (glob(self::pasta($lote).DIRECTORY_SEPARATOR.'*') ?: [] as $f) {
            $t += filesize($f);
        }

        return $t;
    }

    /** Lotes abandonados ha mais de 1 dia. */
    private static function limparLotesVelhos(): void
    {
        foreach (glob(storage_path('app'.DIRECTORY_SEPARATOR.'legado'.DIRECTORY_SEPARATOR.'*'), GLOB_ONLYDIR) ?: [] as $d) {
            if (filemtime($d) < time() - 86400) {
                File::deleteDirectory($d);
            }
        }
    }
}
