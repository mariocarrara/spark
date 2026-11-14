<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Programacoes: leitura no formato do front legado (objeto unico com equipesIds, osIds, osSnap, execSnap)
 * e as regras que o legado tinha em routes/programacao.ps1 + lib/PodasImporter.ps1 (Get-OsSnapMesclado).
 */
class Programacoes
{
    public const STATUS = ['Programada', 'Concluída', 'Cancelada'];

    /** Campos que o log compara (ProgLogCampos do legado). */
    public const CAMPOS_LOG = ['protecaoId', 'alimentador', 'dataInicio', 'dataFim', 'equipesIds', 'numeroSIS', 'plano', 'equipeNecessaria',
        'desligamento', 'observacao', 'localidade', 'polo', 'regional', 'previstoConcluir', 'status'];

    /** Campos da copia da OS aceitos do navegador (Get-OsSnapMesclado). */
    private const CAMPOS_SNAP = ['id', 'origem', 'statusOS', 'tipoServico', 'tipoEquipeNecessaria', 'tipoEquipeExec', 'trecho', 'osPrimaria', 'alimentador',
        'conjunto', 'protecaoId', 'localidade', 'dataAbertura', 'dataExecucao', 'previsto', 'realizado', 'previstoPoda', 'previstoLimpeza', 'previstoEstrutura',
        'realizadoPoda', 'realizadoLimpeza', 'realizadoEstrutura', 'observacao', 'descEsquema', 'prioridade', 'numObra', 'recursoMo', 'statusBase'];

    /** campo do front => coluna (texto simples) */
    public const TEXTO = ['protecaoId' => 'protecao_id', 'alimentador' => 'alimentador', 'localidade' => 'localidade', 'regional' => 'regional', 'polo' => 'polo',
        'plano' => 'plano', 'tipoPlano' => 'tipo_plano', 'equipeNecessaria' => 'equipe_necessaria', 'desligamento' => 'desligamento',
        'numeroSIS' => 'numero_sis', 'observacao' => 'observacao', 'tipoProgramacao' => 'tipo_programacao'];

    /**
     * @param  array  $filtros  status, alimentador, equipe, dataInicio, dataFim, ids (lista)
     * @return array<int,array>
     */
    public static function listar(array $filtros = []): array
    {
        $q = DB::table('programacoes');
        if (! empty($filtros['ids'])) {
            $q->whereIn('id', $filtros['ids']);
        }
        if (! empty($filtros['status'])) {
            $q->where('status', $filtros['status']);
        }
        if (! empty($filtros['alimentador'])) {
            $q->where('alimentador', $filtros['alimentador']);
        }
        if (! empty($filtros['equipe'])) {
            $q->whereExists(fn ($s) => $s->from('programacao_equipes')->whereColumn('programacao_id', 'programacoes.id')->where('equipe_id', $filtros['equipe']));
        }
        if (! empty($filtros['dataInicio'])) {
            $q->where('data_inicio', '>=', substr($filtros['dataInicio'], 0, 10));
        }
        if (! empty($filtros['dataFim'])) {
            $q->where('data_fim', '<=', substr($filtros['dataFim'], 0, 10));
        }
        if (! empty($filtros['periodo'])) {   // [inicio, fim]: so as ativas que se sobrepoem
            $q->where('status', '<>', 'Cancelada')->where('data_inicio', '<=', $filtros['periodo'][1])->where('data_fim', '>=', $filtros['periodo'][0]);
        }
        if (! empty($filtros['dia'])) {
            $q->where('status', '<>', 'Cancelada')->where('data_inicio', '<=', $filtros['dia'])->where('data_fim', '>=', $filtros['dia']);
        }
        $progs = $q->orderBy('criado_em')->get();
        if ($progs->isEmpty()) {
            return [];
        }
        $ids = $progs->pluck('id')->all();

        $equipes = [];
        foreach (DB::table('programacao_equipes')->whereIn('programacao_id', $ids)->orderBy('equipe_id')->get() as $e) {
            $equipes[$e->programacao_id][] = $e->equipe_id;
        }
        $os = [];
        $snaps = [];
        foreach (DB::table('programacao_os')->whereIn('programacao_id', $ids)->orderBy('ordem')->get() as $o) {
            $os[$o->programacao_id][] = $o->os_id;
            if ($o->snapshot !== null) {
                $snaps[$o->programacao_id][] = json_decode($o->snapshot);
            }
        }

        return $progs->map(fn ($p) => self::paraFront($p, $equipes[$p->id] ?? [], $os[$p->id] ?? [], $snaps[$p->id] ?? []))->all();
    }

    public static function uma(string $id): ?array
    {
        if (! self::uuidValido($id)) {
            return null;
        }

        return self::listar(['ids' => [$id]])[0] ?? null;
    }

    private static function paraFront(object $p, array $equipes, array $osIds, array $snaps): array
    {
        return [
            'id' => $p->id,
            'protecaoId' => $p->protecao_id, 'alimentador' => $p->alimentador,
            'dataInicio' => substr((string) $p->data_inicio, 0, 10), 'dataFim' => substr((string) $p->data_fim, 0, 10),
            'equipesIds' => $equipes, 'numeroSIS' => $p->numero_sis, 'tipoPlano' => $p->tipo_plano, 'plano' => $p->plano,
            'tipoProgramacao' => $p->tipo_programacao, 'equipeNecessaria' => $p->equipe_necessaria, 'desligamento' => $p->desligamento,
            'previstoConcluir' => (bool) $p->previsto_concluir, 'status' => $p->status, 'programadorId' => $p->programador_id,
            'observacao' => $p->observacao, 'osIds' => $osIds, 'osSnap' => $snaps,
            'execSnap' => $p->exec_snap ? json_decode($p->exec_snap) : [],
            'localidade' => $p->localidade, 'polo' => $p->polo, 'regional' => $p->regional, 'origemTela' => (string) $p->origem_tela,
            'criadoEm' => Carbon::parse($p->criado_em)->setTimezone(config('app.timezone'))->toIso8601String(), 'atualizadoEm' => Carbon::parse($p->atualizado_em)->setTimezone(config('app.timezone'))->toIso8601String(),
        ];
    }

    /**
     * Grava equipes, OS e copias de uma programacao (substitui as listas). Copia que o servidor ja tem
     * NUNCA e sobrescrita pelo navegador; copias de OS que sairam da programacao sao descartadas.
     */
    public static function gravarListas(string $id, array $equipesIds, array $osIds, $enviadosSnap): void
    {
        $antigas = [];
        foreach (DB::table('programacao_os')->where('programacao_id', $id)->whereNotNull('snapshot')->get() as $o) {
            $antigas[$o->os_id] = $o->snapshot;
        }
        $enviados = [];
        foreach ((array) ($enviadosSnap ?? []) as $e) {
            $e = (array) $e;
            if (! isset($e['id'])) {
                continue;
            }
            $k = trim((string) $e['id']);
            if ($k === '' || isset($enviados[$k])) {
                continue;
            }
            $r = [];
            foreach (self::CAMPOS_SNAP as $c) {
                if (array_key_exists($c, $e)) {
                    $r[$c] = $e[$c];
                }
            }
            if (isset($e['lat'], $e['lng'])) {
                $r['localizacao'] = ['lat' => $e['lat'], 'lng' => $e['lng'], 'fonte' => $e['fonte'] ?? null];
            }
            $enviados[$k] = json_encode($r, JSON_UNESCAPED_UNICODE);
        }

        DB::table('programacao_equipes')->where('programacao_id', $id)->delete();
        $linhas = [];
        foreach (array_unique($equipesIds) as $e) {
            $linhas[] = ['programacao_id' => $id, 'equipe_id' => $e];
        }
        if ($linhas) {
            DB::table('programacao_equipes')->insert($linhas);
        }

        DB::table('programacao_os')->where('programacao_id', $id)->delete();
        $linhas = [];
        foreach (array_values(array_unique($osIds)) as $i => $osId) {
            $linhas[] = ['programacao_id' => $id, 'os_id' => $osId, 'ordem' => $i, 'snapshot' => $antigas[$osId] ?? $enviados[$osId] ?? null];
        }
        foreach (array_chunk($linhas, 500) as $lote) {
            DB::table('programacao_os')->insert($lote);
        }

        // execSnap: so as executadas que ainda apontam para uma OS da programacao
        $exec = json_decode((string) DB::table('programacoes')->where('id', $id)->value('exec_snap'), true) ?: [];
        $exec = array_values(array_filter($exec, fn ($x) => isset($x['osPrimaria']) && in_array(trim((string) $x['osPrimaria']), $osIds, true)));
        DB::table('programacoes')->where('id', $id)->update(['exec_snap' => $exec ? json_encode($exec, JSON_UNESCAPED_UNICODE) : null]);
    }

    /** Lista de textos/ids limpa (tira vazios e repetidos). */
    public static function lista($v): array
    {
        $saida = [];
        foreach ((array) ($v ?? []) as $x) {
            $t = trim((string) $x);
            if ($t !== '' && ! in_array($t, $saida, true)) {
                $saida[] = mb_substr($t, 0, 80);
            }
        }

        return $saida;
    }

    /** Equipes INATIVAS dentre $ids (ignorando as que ja estavam em $ja). Equipe fora do cadastro nao e barrada. */
    public static function equipesInativas(array $ids, array $ja = []): array
    {
        $novas = array_values(array_diff($ids, $ja));
        if (! $novas) {
            return [];
        }

        return DB::table('equipes')->whereIn('id', $novas)->where('ativo', false)->pluck('id')->all();
    }

    /** Avisos (nunca bloqueiam): mesma equipe no periodo; dois desligamentos (DS) no mesmo alimentador. */
    public static function conflitos(array $nova): array
    {
        $avisos = [];
        $outras = self::listar(['periodo' => [$nova['dataInicio'], $nova['dataFim']]]);
        foreach ($outras as $o) {
            if ($o['id'] === $nova['id'] || $o['status'] === 'Cancelada') {
                continue;
            }
            if ($nova['dataFim'] < $o['dataInicio'] || $nova['dataInicio'] > $o['dataFim']) {
                continue;
            }
            $comum = array_values(array_intersect($nova['equipesIds'], $o['equipesIds']));
            if ($comum) {
                $avisos[] = 'Equipe(s) '.implode(', ', $comum).' já alocada(s) em outro atendimento no período ('.$o['numeroSIS'].').';
            }
            if ($o['alimentador'] === $nova['alimentador'] && $o['desligamento'] === 'DS' && $nova['desligamento'] === 'DS') {
                $avisos[] = 'Outro desligamento já programado no alimentador '.$nova['alimentador'].' no mesmo período ('.$o['numeroSIS'].').';
            }
        }

        return $avisos;
    }

    /**
     * Tira de outras programacoes as OS que o usuario escolheu MOVER para $novoId.
     * $pedidos = [{osId, de}]. So move OS que estao na nova e na antiga. Devolve [{de, osIds, ficouVazia}].
     */
    public static function moverOs(string $novoId, $pedidos, array $osDaNova): array
    {
        $porDe = [];
        foreach ((array) ($pedidos ?? []) as $pd) {
            $pd = (array) $pd;
            $os = trim((string) ($pd['osId'] ?? ''));
            $de = strtolower(trim((string) ($pd['de'] ?? '')));
            if ($os === '' || ! self::uuidValido($de) || $de === $novoId || ! in_array($os, $osDaNova, true)) {
                continue;
            }
            $porDe[$de][] = $os;
        }
        $res = [];
        foreach ($porDe as $de => $osLista) {
            $antiga = DB::table('programacoes')->where('id', $de)->lockForUpdate()->first();
            if (! $antiga) {
                continue;
            }
            $atuais = DB::table('programacao_os')->where('programacao_id', $de)->orderBy('ordem')->pluck('os_id')->all();
            $tirar = array_values(array_intersect(array_unique($osLista), $atuais));
            if (! $tirar) {
                continue;
            }
            DB::table('programacao_os')->where('programacao_id', $de)->whereIn('os_id', $tirar)->delete();
            $restantes = array_values(array_diff($atuais, $tirar));
            $exec = json_decode((string) $antiga->exec_snap, true) ?: [];
            $exec = array_values(array_filter($exec, fn ($x) => isset($x['osPrimaria']) && in_array(trim((string) $x['osPrimaria']), $restantes, true)));
            DB::table('programacoes')->where('id', $de)->update(['exec_snap' => $exec ? json_encode($exec, JSON_UNESCAPED_UNICODE) : null, 'atualizado_em' => now()]);
            $res[] = ['de' => $de, 'osIds' => $tirar, 'ficouVazia' => count($restantes) === 0];
        }

        return $res;
    }

    /** Texto de um campo para o log (listas viram "a, b"; corta em 300). */
    public static function valorTexto(array $p, string $c): string
    {
        $v = $p[$c] ?? null;
        if ($v === null) {
            return '';
        }
        if (is_array($v)) {
            $v = implode(', ', array_map('strval', $v));
        } elseif (is_bool($v)) {
            $v = $v ? 'True' : 'False';
        }

        return mb_substr((string) $v, 0, 300);
    }

    /** Grava 1 linha no log. Erro aqui NUNCA desfaz o salvamento (igual ao legado). */
    public static function log(string $progId, ?string $usuarioId, string $acao, array $mudancas = [], array $add = [], array $rem = [], string $resumo = '', string $ref = ''): void
    {
        try {
            DB::table('programacao_log')->insert([
                'programacao_id' => $progId, 'momento' => now(), 'usuario_id' => $usuarioId, 'acao' => $acao, 'resumo' => $resumo,
                'ref' => $ref !== '' ? $ref : null,
                'mudancas' => $mudancas ? json_encode(array_values($mudancas), JSON_UNESCAPED_UNICODE) : null,
                'os_add' => $add ? json_encode(array_values($add), JSON_UNESCAPED_UNICODE) : null,
                'os_rem' => $rem ? json_encode(array_values($rem), JSON_UNESCAPED_UNICODE) : null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public static function logMovidas(array $movidas, string $novoId, ?string $usuarioId): void
    {
        foreach ($movidas as $mv) {
            self::log($mv['de'], $usuarioId, 'mover-saida', [], [], $mv['osIds'], 'OS movida(s) para outra programação', $novoId);
            self::log($novoId, $usuarioId, 'mover-entrada', [], $mv['osIds'], [], 'OS movida(s) de outra programação', $mv['de']);
        }
    }

    public static function uuidValido(string $id): bool
    {
        return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id);
    }

    public static function dataValida($d): ?string
    {
        $d = substr(trim((string) $d), 0, 10);
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return null;
        }

        return $d;
    }
}
