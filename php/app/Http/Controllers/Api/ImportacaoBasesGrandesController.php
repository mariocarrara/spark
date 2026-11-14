<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Importacao\ImportadorBasesGrandes;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * POST /api/importacao/vao | protecao | vera (multipart: arquivo = o .xlsx cru) — NDJSON ao vivo como o legado:
 * {"tipo":"progresso",...} ... {"tipo":"final", totalLinhas, processados, totalErros, resumo, erros, log} ou {"tipo":"erro", mensagem}.
 */
class ImportacaoBasesGrandesController extends Controller
{
    private const ROTULO = ['vao' => 'Vão', 'protecao' => 'Proteção', 'vera' => 'VERA'];

    public function importar(Request $r, string $base): StreamedResponse
    {
        $eu = $r->user();

        return new StreamedResponse(function () use ($r, $base, $eu) {
            @set_time_limit(0);
            @ini_set('memory_limit', '2048M');
            ignore_user_abort(true);
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            if (! app()->runningUnitTests()) {
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
            }
            $linha = function (array $d) {
                echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n";
                flush();
            };
            try {
                if (! $eu->pode('manutencao', 'importar')) {
                    $linha(['tipo' => 'erro', 'mensagem' => 'Sem permissão para importar a base '.self::ROTULO[$base].'.']);

                    return;
                }
                $f = $r->file('arquivo');
                if (is_array($f)) {
                    $f = $f[0] ?? null;
                }
                if (! $f || ! $f->isValid()) {
                    $linha(['tipo' => 'erro', 'mensagem' => 'Nenhum arquivo recebido. Envie o .xlsx da base '.self::ROTULO[$base].'.']);

                    return;
                }
                $nome = $f->getClientOriginalName();
                $linha(['tipo' => 'progresso', 'fase' => 'recebido', 'percentual' => 1]);
                $imp = new ImportadorBasesGrandes(fn (array $p) => $linha(['tipo' => 'progresso'] + $p));
                try {
                    $res = $imp->{$base}($f->getRealPath(), $nome);
                } catch (\Throwable $e) {
                    report($e);
                    $linha(['tipo' => 'erro', 'mensagem' => $e->getMessage()]);

                    return;
                }
                $log = ['id' => (string) Str::uuid(), 'base' => self::ROTULO[$base], 'usuarioId' => $eu->id, 'dataHora' => Carbon::now()->toIso8601String(),
                    'registrosProcessados' => $res['processados'], 'registrosComErro' => $res['totalErros'], 'arquivoOrigem' => $nome];
                DB::table('importacoes_log')->insert(['id' => $log['id'], 'data_hora' => now(), 'usuario_id' => $eu->id, 'base' => $log['base'], 'arquivo_origem' => $nome,
                    'registros_processados' => $res['processados'], 'registros_com_erro' => $res['totalErros']]);
                Auditoria::registrar('importar', "bases/{$base}", null, $eu->id, ['arquivo' => $nome, 'processados' => $res['processados']], $r->ip());
                $linha(['tipo' => 'final'] + $res + ['erros' => $res['erros'] ?? [], 'log' => $log]);
            } catch (\Throwable $e) {
                report($e);
                $linha(['tipo' => 'erro', 'mensagem' => $e->getMessage()]);
            }
        }, 200, ['Content-Type' => 'application/x-ndjson; charset=utf-8', 'Cache-Control' => 'no-store', 'X-Accel-Buffering' => 'no']);
    }
}
