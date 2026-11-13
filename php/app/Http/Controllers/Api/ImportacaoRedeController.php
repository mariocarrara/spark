<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppRl;
use App\Services\Auditoria;
use App\Services\Importacao\ImportadorRede;
use App\Services\RedeGeo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * POST /api/importacao/shapefile (multipart: camada, base, arquivo[]) — NDJSON ao vivo, como o legado
 * ({"tipo":"progresso"...} ... {"tipo":"final", camada, alimentadores, trechos, rejeitados, errosDetalhe, avisoProjecao, log}).
 *   rede_media_tensao | rede_baixa_tensao | rede_alta_tensao: .shp + .dbf (+ .prj), soltos ou num .zip
 *   reserva_legal | app: um ou mais .kmz (um por alimentador); depois recalcula o OS x APP/RL
 * Ainda NAO portado: camada "postes" (PONNOT) e "equipamentos" (DBF da BDGD) — a base que veio do sistema antigo continua valendo.
 */
class ImportacaoRedeController extends Controller
{
    public function importar(Request $r): StreamedResponse
    {
        $eu = $r->user();

        return new StreamedResponse(function () use ($r, $eu) {
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
                    $linha(['tipo' => 'erro', 'mensagem' => 'Sem permissão para importar camadas de rede.']);

                    return;
                }
                $camada = (string) $r->input('camada', '');
                $arquivos = [];
                foreach ((array) ($r->file('arquivo') ?? []) as $f) {
                    if ($f && $f->isValid()) {
                        $arquivos[$f->getClientOriginalName()] = $f->getRealPath();
                    }
                }
                if ($camada === '') {
                    $linha(['tipo' => 'erro', 'mensagem' => 'Faltou informar a camada (rede_media_tensao, rede_baixa_tensao, rede_alta_tensao, reserva_legal ou app).']);

                    return;
                }
                if (in_array($camada, ['postes', 'equipamentos'], true)) {
                    $linha(['tipo' => 'erro', 'mensagem' => 'A importação de '.($camada === 'postes' ? 'Ativos (PONNOT)' : 'Equipamentos (BDGD)')
                        .' ainda não foi migrada para o sistema novo. A base que veio do sistema antigo continua valendo.']);

                    return;
                }
                if (! isset(RedeGeo::CAMADAS[$camada])) {
                    $linha(['tipo' => 'erro', 'mensagem' => "Camada de rede desconhecida: {$camada}"]);

                    return;
                }
                if (! $arquivos) {
                    $linha(['tipo' => 'erro', 'mensagem' => 'Nenhum arquivo recebido. Envie o .shp + .dbf (e .prj) — ou, para Reserva Legal/APP, um ou mais .kmz.']);

                    return;
                }
                $linha(['tipo' => 'progresso', 'fase' => 'recebido', 'percentual' => 1]);
                $imp = new ImportadorRede(fn (array $p) => $linha(['tipo' => 'progresso'] + $p));
                $poligono = in_array($camada, ['reserva_legal', 'app'], true);
                try {
                    $res = $poligono ? $imp->kmz($camada, $arquivos) : $imp->shapefile($camada, $arquivos);
                } catch (\Throwable $e) {
                    report($e);
                    $linha(['tipo' => 'erro', 'mensagem' => $e->getMessage()]);

                    return;
                }
                $nomes = implode(', ', array_keys($arquivos));
                $base = (string) $r->input('base', '') ?: $camada;
                $log = ['id' => (string) Str::uuid(), 'base' => $base, 'usuarioId' => $eu->id, 'dataHora' => Carbon::now()->toIso8601String(),
                    'registrosProcessados' => $res['trechos'], 'registrosComErro' => $res['rejeitados'], 'arquivoOrigem' => $nomes];
                DB::table('importacoes_log')->insert(['id' => $log['id'], 'data_hora' => now(), 'usuario_id' => $eu->id, 'base' => $base, 'arquivo_origem' => mb_substr($nomes, 0, 2000),
                    'registros_processados' => $res['trechos'], 'registros_com_erro' => $res['rejeitados']]);
                Auditoria::registrar('importar', "camadas/{$camada}", null, $eu->id, ['arquivos' => $nomes, 'alimentadores' => $res['alimentadores'], 'trechos' => $res['trechos']], $r->ip());
                if ($poligono && $res['alimentadores'] > 0) {
                    $linha(['tipo' => 'progresso', 'fase' => 'gravando', 'arquivo' => 'medindo a distancia das OS ate APP e RL', 'percentual' => 99]);
                    AppRl::recalcular();
                }
                $linha(['tipo' => 'final', 'camada' => $camada] + $res + ['postes' => null, 'equipamentos' => null, 'aplicadoNasOS' => null, 'log' => $log]);
            } catch (\Throwable $e) {
                report($e);
                $linha(['tipo' => 'erro', 'mensagem' => $e->getMessage()]);
            }
        }, 200, ['Content-Type' => 'application/x-ndjson; charset=utf-8', 'Cache-Control' => 'no-store', 'X-Accel-Buffering' => 'no']);
    }
}
