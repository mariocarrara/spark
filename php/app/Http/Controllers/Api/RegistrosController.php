<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Programacoes as P;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Gestao de Bases > abas Programacoes e Ajustes de OS: exportar/importar (o que antes so entrava pelo "Importar sistema antigo").
 *   GET  /registros/{base}/exportar                     -> lista JSON no formato do legado (programacao.json, ajustes_os.json, *_log.jsonl)
 *   POST /registros/{base}/importar {modo, registros}   -> {novos, atualizados, removidos, erros:[{linha, chave, erro}]}
 * Bases: programacoes, programacao_log, ajustes, ajustes_log. Linha ruim volta na lista e nao derruba as outras;
 * o que passou e gravado numa transacao. Ids antigos que nao sao UUID viram o MESMO UUID fixo do migrar.php (uuidDe).
 */
class RegistrosController extends Controller
{
    private const BASES = [
        'programacoes' => ['modulo' => 'programacao', 'rotulo' => 'Programações'],
        'programacao_log' => ['modulo' => 'programacao', 'rotulo' => 'Log das programações'],
        'ajustes' => ['modulo' => 'manutencao', 'rotulo' => 'Ajustes de OS'],
        'ajustes_log' => ['modulo' => 'manutencao', 'rotulo' => 'Log dos ajustes de OS'],
    ];

    private const MAX = 50000;

    public function exportar(Request $r, string $base): JsonResponse
    {
        if (! $cfg = self::BASES[$base] ?? null) {
            return response()->json(['erro' => "Base desconhecida: {$base}"], 400);
        }
        if (! $r->user()->pode($cfg['modulo'], 'visualizar')) {
            return response()->json(['erro' => "Sem permissão para ver {$cfg['rotulo']}."], 403);
        }
        Auditoria::registrar('exportar', "registros/{$base}", null, $r->user()->id, [], $r->ip());
        $iso = fn ($v) => $v ? Carbon::parse($v)->setTimezone(config('app.timezone'))->toIso8601String() : null;

        $dados = match ($base) {
            'programacoes' => P::listar(),
            'programacao_log' => DB::table('programacao_log')->orderBy('momento')->orderBy('id')->get()->map(fn ($l) => [
                't' => $iso($l->momento), 'u' => $l->usuario_id, 'p' => $l->programacao_id, 'a' => $l->acao, 'r' => (string) $l->resumo, 'ref' => (string) $l->ref,
                'm' => json_decode($l->mudancas ?? '[]'), 'add' => json_decode($l->os_add ?? '[]'), 'rem' => json_decode($l->os_rem ?? '[]')])->all(),
            'ajustes' => DB::table('ajustes_os')->orderBy('os_id')->get()->map(fn ($a) => AjusteController::paraFront($a))->all(),
            'ajustes_log' => DB::table('ajustes_os_log')->orderBy('momento')->orderBy('id')->get()->map(fn ($l) => [
                't' => $iso($l->momento), 'u' => $l->usuario_id, 'os' => $l->os_id, 'a' => $l->acao, 'de' => json_decode($l->de ?? 'null'), 'para' => json_decode($l->para ?? 'null')])->all(),
        };

        return response()->json($dados);
    }

    public function importar(Request $r, string $base): JsonResponse
    {
        if (! $cfg = self::BASES[$base] ?? null) {
            return response()->json(['erro' => "Base desconhecida: {$base}"], 400);
        }
        $eu = $r->user();
        if (! ($eu->pode($cfg['modulo'], 'importar') && $eu->pode($cfg['modulo'], 'editar'))) {
            return response()->json(['erro' => "Sem permissão para importar {$cfg['rotulo']} (precisa poder importar e editar)."], 403);
        }
        // corpo cru: o Laravel troca "" por null em toda a entrada, e aqui o conteudo (copias de OS, logs) tem que chegar intacto
        $corpo = json_decode($r->getContent(), true);
        $regs = is_array($corpo) ? ($corpo['registros'] ?? null) : null;
        if (! is_array($regs) || ! $regs || count($regs) > self::MAX) {
            return response()->json(['erro' => 'Envie de 1 a '.self::MAX.' registros.'], 400);
        }
        $modo = $r->input('modo') === 'substituir' ? 'substituir' : 'atualizar';
        @set_time_limit(600);
        $res = DB::transaction(fn () => $this->{'importar'.Str::studly($base)}(array_values($regs), $modo, $eu));
        DB::table('importacoes_log')->insert(['id' => (string) Str::uuid(), 'data_hora' => now(), 'usuario_id' => $eu->id,
            'base' => "Gestão de Bases: {$cfg['rotulo']}", 'arquivo_origem' => mb_substr((string) $r->input('arquivo', ''), 0, 200) ?: null,
            'registros_processados' => $res['novos'] + $res['atualizados'], 'registros_com_erro' => count($res['erros'])]);
        Auditoria::registrar('importar', "registros/{$base}", null, $eu->id, ['modo' => $modo, 'novos' => $res['novos'], 'atualizados' => $res['atualizados'],
            'removidos' => $res['removidos'], 'erros' => count($res['erros']), 'arquivo' => $r->input('arquivo')], $r->ip());
        $res['erros'] = array_slice($res['erros'], 0, 1000);

        return response()->json($res + ['base' => $base, 'modo' => $modo]);
    }

    // ------------------------------------------------------------------ Programacoes

    private function importarProgramacoes(array $regs, string $modo, $eu): array
    {
        $erros = [];
        $boas = [];
        foreach ($regs as $i => $p) {
            $linha = $i + 1;
            if (! is_array($p)) {
                $erros[] = ['linha' => $linha, 'erro' => 'Registro inválido.'];

                continue;
            }
            $idBruto = trim((string) ($p['id'] ?? ''));
            $id = $idBruto === '' ? (string) Str::uuid() : self::uuidDe($idBruto);
            $ini = P::dataValida($p['dataInicio'] ?? '');
            $fim = P::dataValida($p['dataFim'] ?? '');
            $status = trim((string) ($p['status'] ?? '')) ?: 'Programada';
            $erro = match (true) {
                ! $ini || ! $fim => 'Data de início/fim inválida (use AAAA-MM-DD).',
                $fim < $ini => 'Data fim antes da data início.',
                ! in_array($status, P::STATUS, true) => 'Status inválido (Programada, Concluída ou Cancelada).',
                default => null,
            };
            if ($erro) {
                $erros[] = ['linha' => $linha, 'chave' => $idBruto, 'erro' => $erro];

                continue;
            }
            $boas[$id] = [$p, $ini, $fim, $status];   // id repetido: vale o ultimo
        }

        $existentes = DB::table('programacoes')->pluck('id')->flip();
        $removidos = 0;
        if ($modo === 'substituir') {
            $removidos = DB::table('programacoes')->whereNotIn('id', array_keys($boas))->delete();
        }
        $novos = 0;
        $atualizados = 0;
        foreach ($boas as $id => [$p, $ini, $fim, $status]) {
            $linha = ['data_inicio' => $ini, 'data_fim' => $fim, 'status' => $status,
                'tipo_programacao' => trim((string) ($p['tipoProgramacao'] ?? '')) ?: 'Poda',
                'previsto_concluir' => filter_var($p['previstoConcluir'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'programador_id' => self::txt($p['programadorId'] ?? null), 'origem_tela' => self::txt($p['origemTela'] ?? null),
                'atualizado_em' => self::momento($p['atualizadoEm'] ?? null) ?? now()];
            foreach (P::TEXTO as $campo => $col) {
                if (array_key_exists($campo, $p) && $col !== 'tipo_programacao') {
                    $linha[$col] = self::txt($p[$campo]);
                }
            }
            if (array_key_exists('execSnap', $p) && is_array($p['execSnap'])) {
                $linha['exec_snap'] = $p['execSnap'] ? json_encode(array_values($p['execSnap']), JSON_UNESCAPED_UNICODE) : null;
            }
            if (isset($existentes[$id])) {
                DB::table('programacoes')->where('id', $id)->update($linha);
                $atualizados++;
            } else {
                DB::table('programacoes')->insert($linha + ['id' => $id, 'criado_em' => self::momento($p['criadoEm'] ?? null) ?? now()]);
                $novos++;
            }
            // equipes e OS: listas (JSON) ou texto separado por ";" (Excel). Copia da OS: a do arquivo; sem ela, a que ja estava.
            if (array_key_exists('equipesIds', $p)) {
                DB::table('programacao_equipes')->where('programacao_id', $id)->delete();
                $eq = array_map(fn ($e) => ['programacao_id' => $id, 'equipe_id' => $e], self::listaDe($p['equipesIds']));
                $eq && DB::table('programacao_equipes')->insert($eq);
            }
            if (array_key_exists('osIds', $p)) {
                $antigas = DB::table('programacao_os')->where('programacao_id', $id)->whereNotNull('snapshot')->pluck('snapshot', 'os_id')->all();
                $snaps = [];
                foreach ((array) ($p['osSnap'] ?? []) as $s) {
                    if (is_array($s) && isset($s['id'])) {
                        $snaps[(string) $s['id']] ??= json_encode($s, JSON_UNESCAPED_UNICODE);
                    }
                }
                DB::table('programacao_os')->where('programacao_id', $id)->delete();
                $os = [];
                foreach (self::listaDe($p['osIds']) as $k => $o) {
                    $os[] = ['programacao_id' => $id, 'os_id' => $o, 'ordem' => $k, 'snapshot' => $snaps[$o] ?? $antigas[$o] ?? null];
                }
                foreach (array_chunk($os, 500) as $lote) {
                    DB::table('programacao_os')->insert($lote);
                }
            }
        }

        return ['novos' => $novos, 'atualizados' => $atualizados, 'removidos' => $removidos, 'erros' => $erros];
    }

    /** Log das programacoes (programacao_log.jsonl). Reimportar nao duplica: o log das programacoes do arquivo e trocado. */
    private function importarProgramacaoLog(array $regs, string $modo, $eu): array
    {
        $existe = DB::table('programacoes')->pluck('id')->flip();
        $erros = [];
        $linhas = [];
        foreach ($regs as $i => $l) {
            $p = is_array($l) ? trim((string) ($l['p'] ?? '')) : '';
            $t = is_array($l) ? self::momento($l['t'] ?? null) : null;
            if ($p === '' || ! $t || empty($l['a'])) {
                $erros[] = ['linha' => $i + 1, 'erro' => 'Falta programação (p), momento (t) ou ação (a).'];

                continue;
            }
            $pid = self::uuidDe($p);
            if (! isset($existe[$pid])) {
                $erros[] = ['linha' => $i + 1, 'chave' => $p, 'erro' => 'Programação não existe no sistema novo (importe as programações antes).'];

                continue;
            }
            $js = fn ($v) => empty($v) ? null : json_encode(array_values((array) $v), JSON_UNESCAPED_UNICODE);
            $linhas[] = ['programacao_id' => $pid, 'momento' => $t, 'usuario_id' => self::txt($l['u'] ?? null), 'acao' => mb_substr((string) $l['a'], 0, 60),
                'resumo' => self::txt($l['r'] ?? null), 'ref' => self::txt($l['ref'] ?? null),
                'mudancas' => isset($l['m']) ? json_encode($l['m'], JSON_UNESCAPED_UNICODE) : null, 'os_add' => $js($l['add'] ?? null), 'os_rem' => $js($l['rem'] ?? null)];
        }
        $q = DB::table('programacao_log');
        $removidos = $modo === 'substituir' ? $q->delete() : $q->whereIn('programacao_id', array_unique(array_column($linhas, 'programacao_id')))->delete();
        foreach (array_chunk($linhas, 1000) as $lote) {
            DB::table('programacao_log')->insert($lote);
        }

        return ['novos' => count($linhas), 'atualizados' => 0, 'removidos' => $removidos, 'erros' => $erros];
    }

    // ------------------------------------------------------------------ Ajustes de OS

    private function importarAjustes(array $regs, string $modo, $eu): array
    {
        $erros = [];
        $boas = [];
        foreach ($regs as $i => $a) {
            $os = is_array($a) ? mb_strtoupper(trim((string) ($a['id'] ?? $a['os'] ?? ''))) : '';
            if ($os === '' || mb_strlen($os) > 80) {
                $erros[] = ['linha' => $i + 1, 'erro' => 'Falta o número da OS (id).'];

                continue;
            }
            $boas[$os] = ['os_id' => $os, 'alimentador' => self::txt($a['alimentador'] ?? null), 'tipo_equipe' => self::txt($a['tipoEquipe'] ?? null),
                'protecao_id' => self::txt($a['protecaoId'] ?? null), 'equipe_id' => self::txt($a['equipeId'] ?? null),
                'criado_por' => self::txt($a['criadoPor'] ?? null) ?? $eu->id, 'criado_em' => self::momento($a['criadoEm'] ?? null) ?? now(),
                'atualizado_por' => self::txt($a['atualizadoPor'] ?? null) ?? $eu->id, 'atualizado_em' => self::momento($a['atualizadoEm'] ?? null) ?? now()];
        }
        $existentes = DB::table('ajustes_os')->pluck('os_id')->flip();
        $removidos = $modo === 'substituir' ? DB::table('ajustes_os')->whereNotIn('os_id', array_keys($boas))->delete() : 0;
        $atualizados = count(array_filter(array_keys($boas), fn ($k) => isset($existentes[$k])));
        foreach (array_chunk(array_values($boas), 500) as $lote) {
            DB::table('ajustes_os')->upsert($lote, ['os_id'], ['alimentador', 'tipo_equipe', 'protecao_id', 'equipe_id', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em']);
        }

        return ['novos' => count($boas) - $atualizados, 'atualizados' => $atualizados, 'removidos' => $removidos, 'erros' => $erros];
    }

    private function importarAjustesLog(array $regs, string $modo, $eu): array
    {
        $erros = [];
        $linhas = [];
        foreach ($regs as $i => $l) {
            $os = is_array($l) ? trim((string) ($l['os'] ?? '')) : '';
            $t = is_array($l) ? self::momento($l['t'] ?? null) : null;
            if ($os === '' || ! $t || empty($l['a'])) {
                $erros[] = ['linha' => $i + 1, 'erro' => 'Falta OS (os), momento (t) ou ação (a).'];

                continue;
            }
            $linhas[] = ['momento' => $t, 'usuario_id' => self::txt($l['u'] ?? null), 'os_id' => $os, 'acao' => mb_substr((string) $l['a'], 0, 60),
                'de' => isset($l['de']) ? json_encode($l['de'], JSON_UNESCAPED_UNICODE) : null, 'para' => isset($l['para']) ? json_encode($l['para'], JSON_UNESCAPED_UNICODE) : null];
        }
        $q = DB::table('ajustes_os_log');
        $removidos = $modo === 'substituir' ? $q->delete() : $q->whereIn('os_id', array_unique(array_column($linhas, 'os_id')))->delete();
        foreach (array_chunk($linhas, 1000) as $lote) {
            DB::table('ajustes_os_log')->insert($lote);
        }

        return ['novos' => count($linhas), 'atualizados' => 0, 'removidos' => $removidos, 'erros' => $erros];
    }

    // ------------------------------------------------------------------ apoio

    /** Mesmo UUID fixo do migrar.php para id antigo que nao e UUID (as referencias continuam batendo). */
    public static function uuidDe(string $id): string
    {
        $id = strtolower(trim($id));
        if (P::uuidValido($id)) {
            return $id;
        }
        $h = md5('spark-legado:'.$id);

        return substr($h, 0, 8).'-'.substr($h, 8, 4).'-5'.substr($h, 13, 3).'-a'.substr($h, 17, 3).'-'.substr($h, 20, 12);
    }

    private static function listaDe($v): array
    {
        if (is_string($v)) {
            $v = preg_split('/\s*[;\n]\s*/', $v);
        }

        return array_values(array_unique(array_filter(array_map(fn ($x) => trim((string) $x), (array) $v), fn ($x) => $x !== '')));
    }

    private static function txt($v): ?string
    {
        if ($v === null || is_array($v)) {
            return null;
        }
        $t = trim((string) $v);

        return $t === '' ? null : mb_substr($t, 0, 2000);
    }

    private static function momento($v): ?string
    {
        if (! is_string($v) || trim($v) === '') {
            return null;
        }
        try {
            return Carbon::parse($v)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }
}
