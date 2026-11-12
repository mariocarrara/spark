<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppRl;
use App\Services\Auditoria;
use App\Services\Importacao\ImportadorGrids;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * POST /api/importacao/podas-{executado|pendente|historico|sigod|sigod-pendente} — contrato de
 * Invoke-PodasStreamingUpload (routes/importacao.ps1): resposta NDJSON, uma linha por progresso
 * ({"tipo":"progresso",...}), terminando com {"tipo":"final","resumo":{...},"log":{...}} ou {"tipo":"erro","mensagem":"..."}.
 * Campos do formulario: gridExecutado, moExecutada, moPendente, gridPendente, basePoda, sigodPendente, plano, modo.
 */
class ImportacaoGridController extends Controller
{
    public function podas(Request $r, string $segmento): StreamedResponse
    {
        $eu = $r->user();

        return new StreamedResponse(function () use ($r, $segmento, $eu) {
            @set_time_limit(0);
            @ini_set('memory_limit', '2048M');
            ignore_user_abort(true);   // se o navegador fechar no meio, a importacao termina do mesmo jeito (consistente)
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');   // compressao seguraria as linhas de progresso
            }
            // tira o buffer do PHP (senao o progresso so chega no fim); nos testes o buffer e o que captura a resposta
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
                    $linha(['tipo' => 'erro', 'mensagem' => 'Sem permissão para importar a base de podas.']);

                    return;
                }
                $arq = fn (string $campo) => ($f = $r->file($campo)) && $f->isValid() ? $f->getRealPath() : null;
                $nomes = implode(', ', array_map(fn ($f) => $f->getClientOriginalName(), array_filter(array_values($r->allFiles()), fn ($f) => ! is_array($f))));
                $imp = new ImportadorGrids(fn (array $p) => $linha(['tipo' => 'progresso'] + $p));

                switch ($segmento) {
                    case 'podas-sigod':
                        if (! $base = $arq('basePoda')) {
                            $linha(['tipo' => 'erro', 'mensagem' => "Faltou o arquivo da base SIGOD (basePoda...xlsx). Envie a planilha com a aba 'Base Poda'."]);

                            return;
                        }
                        $res = $this->rodar($linha, 'Erro ao processar a planilha SIGOD: ', fn () => $imp->sigod($base));
                        $baseLog = 'Podas — SIGOD (OS)';
                        $erros = fn ($x) => $x['sigodSemCoordenada'] + $x['sigodSemNumeroOS'];
                        break;
                    case 'podas-sigod-pendente':
                        if (! $base = $arq('sigodPendente')) {
                            $linha(['tipo' => 'erro', 'mensagem' => 'Faltou o arquivo dos pendentes do SIGOD (pendentes_sigod...xlsx).']);

                            return;
                        }
                        $res = $this->rodar($linha, 'Erro ao processar a planilha de pendentes do SIGOD: ', fn () => $imp->sigodPendente($base));
                        $baseLog = 'Podas — SIGOD pendentes';
                        $erros = fn ($x) => $x['sigodPendSemNumeroOS'] + $x['sigodPendSemPosicao'];
                        break;
                    case 'podas-historico':
                    case 'podas-executado':
                        $plano = 0;
                        $modo = 'substituir';
                        if ($segmento === 'podas-historico') {
                            $plano = (int) trim((string) $r->input('plano', ''));
                            if ($plano < 2000 || $plano > 2100) {
                                $linha(['tipo' => 'erro', 'mensagem' => 'Informe o plano (ex.: 2026 = 01/11/2025 a 31/10/2026).']);

                                return;
                            }
                            $modo = mb_strtolower(trim((string) $r->input('modo', ''))) === 'acrescentar' ? 'acrescentar' : 'substituir';
                        }
                        $grid = $arq('gridExecutado');
                        $mo = $arq('moExecutada');
                        $falta = array_filter(['SGM_EXECUTADO' => ! $grid, 'MO_EXECUTADA' => ! $mo]);
                        if ($falta) {
                            $linha(['tipo' => 'erro', 'mensagem' => 'Faltou o arquivo: '.implode(', ', array_keys($falta)).'. Envie os 2 juntos (e, se puder, a MO_PENDENTE também — sem ela o Previsto não é calculado).']);

                            return;
                        }
                        $res = $this->rodar($linha, 'Erro ao processar as planilhas: ', fn () => $imp->executado($grid, $mo, $arq('moPendente'), $plano, $modo, $eu->id, $nomes));
                        $baseLog = $plano > 0 ? "Podas — Histórico (plano $plano, $modo)" : 'Podas — Executado (OS)';
                        $erros = fn ($x) => ($x['historicoSemData'] ?? 0) + ($x['historicoForaDoPlano'] ?? 0) + $x['executadoSemMO'] + $x['executadoSemCoordenada'];
                        break;
                    case 'podas-pendente':
                        $grid = $arq('gridPendente');
                        $mo = $arq('moPendente');
                        $falta = array_filter(['SGM_PENDENTE' => ! $grid, 'MO_PENDENTE' => ! $mo]);
                        if ($falta) {
                            $linha(['tipo' => 'erro', 'mensagem' => 'Faltou o arquivo: '.implode(', ', array_keys($falta)).'. Envie os 2 juntos.']);

                            return;
                        }
                        $res = $this->rodar($linha, 'Erro ao processar as planilhas: ', fn () => $imp->pendente($grid, $mo, $arq('moExecutada')));
                        $baseLog = 'Podas — Pendente (OS)';
                        $erros = fn ($x) => $x['pendenteSemMO'] + $x['pendenteSemCoordenada'];
                        break;
                    default:
                        $linha(['tipo' => 'erro', 'mensagem' => 'Importação desconhecida.']);

                        return;
                }
                if ($res === null) {
                    return;   // erro ja enviado
                }
                $log = ['id' => (string) Str::uuid(), 'base' => $baseLog, 'usuarioId' => $eu->id, 'dataHora' => Carbon::now()->toIso8601String(),
                    'registrosProcessados' => $res['totalPlotadas'], 'registrosComErro' => $erros($res), 'arquivoOrigem' => $nomes];
                DB::table('importacoes_log')->insert(['id' => $log['id'], 'data_hora' => now(), 'usuario_id' => $eu->id, 'base' => $baseLog,
                    'arquivo_origem' => $nomes, 'registros_processados' => $log['registrosProcessados'], 'registros_com_erro' => $log['registrosComErro']]);
                Auditoria::registrar('importar', 'os', $segmento, $eu->id, ['arquivos' => $nomes, 'total' => $res['totalPlotadas']], $r->ip());
                // como o legado: toda carga da base atual de OS refaz o OS x APP/RL (o historico nao entra no indice)
                if ($segmento !== 'podas-historico' && DB::table('rede_feicoes')->whereIn('camada', ['app', 'rl'])->exists()) {
                    $linha(['tipo' => 'progresso', 'fase' => 'gravando', 'arquivo' => 'medindo a distancia das OS ate APP e RL', 'percentual' => 99]);
                    $res['appRl'] = AppRl::recalcular();
                }
                $linha(['tipo' => 'final', 'resumo' => $res, 'log' => $log]);
            } catch (\Throwable $e) {
                report($e);
                $linha(['tipo' => 'erro', 'mensagem' => $e->getMessage()]);
            }
        }, 200, ['Content-Type' => 'application/x-ndjson; charset=utf-8', 'Cache-Control' => 'no-store', 'X-Accel-Buffering' => 'no']);
    }

    private function rodar(callable $linha, string $prefixo, callable $fn): ?array
    {
        try {
            return $fn();
        } catch (\Throwable $e) {
            report($e);
            $linha(['tipo' => 'erro', 'mensagem' => $prefixo.$e->getMessage()]);

            return null;
        }
    }
}
