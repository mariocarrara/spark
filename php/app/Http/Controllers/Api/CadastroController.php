<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestao de Bases: /api/cadastros/{base} — contrato de routes/cadastros.ps1 (Invoke-CadastrosRoute).
 *
 *   GET    /cadastros/{base}?pagina&tamanhoPagina&busca&ordenar&dir&excluidos=1  -> {base,total,pagina,tamanhoPagina,registros}
 *   POST   /cadastros/{base}                     novo registro (importar+editar)
 *   DELETE /cadastros/{base}?confirmar=sim       apaga a base inteira (importar+editar)
 *   PUT    /cadastros/{base}/{chave}             edita (manutencao.editar)
 *   DELETE /cadastros/{base}/{chave}             exclusao LOGICA em "exclusoes" (manutencao.editar)
 *   POST   /cadastros/{base}/{chave}/restaurar   so administrador
 *
 * Exclusao fica numa tabela separada para uma reimportacao nao "ressuscitar" o que foi excluido.
 * Diferencas do legado (regra no backend): so campos conhecidos sao gravados; numero/coordenada invalidos dao 400;
 * metas nao sao editadas por aqui (a tela de Metas recalcula a meta diaria).
 */
class CadastroController extends Controller
{
    /**
     * campos: nome no front => [coluna, tipo]. tipo: texto | int | num | bool. geo: [campoLat, campoLng, coluna].
     * serial: tabela com id SERIAL (a chave pode repetir; vale a linha mais antiga, como o "primeiro" do legado).
     */
    private const BASES = [
        'vao' => ['tabela' => 'vao', 'chave' => 'protecaoId', 'busca' => ['protecaoId', 'polo', 'regional'],
            'campos' => ['protecaoId' => ['protecao_id', 'texto'], 'polo' => ['polo', 'texto'], 'regional' => ['regional', 'texto'],
                'postes' => ['postes', 'int'], 'rotaKm' => ['rota_km', 'num']]],
        'protecao' => ['tabela' => 'protecoes', 'chave' => 'protecaoId', 'serial' => true, 'busca' => ['protecaoId', 'protecao2', 'alimentador', 'trecho'],
            'campos' => ['protecaoId' => ['protecao_id', 'texto'], 'protElemento' => ['prot_elemento', 'texto'], 'protecao2' => ['protecao2', 'texto'],
                'alimentador' => ['alimentador', 'texto'], 'zona' => ['zona', 'texto'], 'trecho' => ['trecho', 'texto'],
                'trechoT4' => ['trecho_t4', 'texto'], 'planoEasyWork' => ['plano_easywork', 'texto']],
            'geo' => ['lat', 'lng', 'loc']],
        'vera' => ['tabela' => 'vera', 'chave' => 'idVera', 'busca' => ['idVera', 'especie', 'alimentador', 'cidade'],
            'campos' => ['idVera' => ['id_vera', 'texto'], 'alimentador' => ['alimentador', 'texto'], 'especie' => ['especie', 'texto'], 'cidade' => ['cidade', 'texto']],
            'geo' => ['lat', 'lng', 'loc']],
        'esquemas' => ['tabela' => 'esquemas', 'chave' => 'codigo', 'busca' => ['codigo', 'descricao', 'tipo'],
            'campos' => ['codigo' => ['codigo', 'texto'], 'descricao' => ['descricao', 'texto'], 'tipo' => ['tipo', 'texto']],
            'padrao' => ['descricao' => '']],
        'conjuntos' => ['tabela' => 'conjuntos', 'chave' => 'alimentador', 'serial' => true, 'busca' => ['alimentador', 'nomeConjunto', 'codConjunto', 'regional', 'sigla'],
            'campos' => ['alimentador' => ['alimentador', 'texto'], 'nomeConjunto' => ['nome_conjunto', 'texto'], 'codConjunto' => ['cod_conjunto', 'texto'],
                'regional' => ['regional', 'texto'], 'sigla' => ['sigla', 'texto'], 'tensaoNominal' => ['tensao_nominal', 'texto'], 'tensao' => ['tensao', 'texto']]],
        'prioridade_ew' => ['tabela' => 'prioridade_ew', 'chave' => 'chave', 'busca' => ['chave', 'prioridade', 'grupoRecurso', 'prioridadeEW', 'regional', 'tensao'],
            'campos' => ['chave' => ['chave', 'texto'], 'tensao' => ['tensao', 'texto'], 'prioridade' => ['prioridade', 'texto'],
                'grupoRecurso' => ['grupo_recurso', 'texto'], 'prioridadeEW' => ['prioridade_ew', 'texto'], 'regional' => ['regional', 'texto']]],
        'equipes' => ['tabela' => 'equipes', 'chave' => 'id', 'busca' => ['id', 'polo', 'regional', 'departamento'],
            'campos' => ['id' => ['id', 'texto'], 'nome' => ['nome', 'texto'], 'tipoEquipe' => ['tipo_equipe', 'texto'], 'polo' => ['polo', 'texto'],
                'regional' => ['regional', 'texto'], 'departamento' => ['departamento', 'texto'], 'proprioTerceiro' => ['proprio_terceiro', 'texto'],
                'equipePoda' => ['equipe_poda', 'bool'], 'ativo' => ['ativo', 'bool']],
            'geo' => ['baseLat', 'baseLng', 'base']],
        'metas' => ['tabela' => 'metas', 'chave' => 'id', 'busca' => ['equipeId', 'anoMes'], 'modulo' => 'metas',
            'campos' => ['id' => ['id', 'texto'], 'equipeId' => ['equipe_id', 'texto'], 'anoMes' => ['ano_mes', 'texto'], 'tipo' => ['tipo', 'texto'],
                'metaMensal' => ['meta_mensal', 'num'], 'diasUteis' => ['dias_uteis', 'int'], 'metaDiaria' => ['meta_diaria', 'num'],
                'origem' => ['origem', 'texto'], 'atualizadoPor' => ['atualizado_por', 'texto'], 'atualizadoEm' => ['atualizado_em', 'texto']]],
        // sem tabela propria: lista do sistema antigo no legado_bruto (pequena, tratada em memoria)
        'municipios' => ['bruto' => 'municipios', 'chave' => 'codigo', 'busca' => ['codigo', 'nome'],
            'campos' => ['codigo' => ['codigo', 'texto'], 'nome' => ['nome', 'texto']]],
    ];

    // ------------------------------------------------------------------ leitura

    public function index(Request $r, string $base): JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => "Sem permissão para visualizar {$base}."], 403);
        }
        $verExcluidos = $r->query('excluidos') === '1';
        if ($verExcluidos && ! $r->user()->isAdmin()) {
            return response()->json(['erro' => 'Somente administrador vê os registros excluídos.'], 403);
        }
        $pagina = max(1, (int) $r->query('pagina', 1));
        $tamanho = max(1, min(200, (int) ($r->query('tamanhoPagina') ?: 50)));
        $busca = mb_strtolower(trim((string) $r->query('busca', '')));
        $ordenar = (string) $r->query('ordenar', '');
        $campoOrd = isset($cfg['campos'][$ordenar]) || (isset($cfg['geo']) && in_array($ordenar, [$cfg['geo'][0], $cfg['geo'][1]], true)) ? $ordenar : $cfg['chave'];
        $desc = $r->query('dir') === 'desc';

        if (isset($cfg['bruto'])) {
            [$total, $registros] = $this->listarBruto($base, $cfg, $verExcluidos, $busca, $campoOrd, $desc, $pagina, $tamanho);
        } else {
            [$total, $registros] = $this->listarTabela($base, $cfg, $verExcluidos, $busca, $campoOrd, $desc, $pagina, $tamanho);
        }

        return response()->json(['base' => $base, 'total' => $total, 'pagina' => $pagina, 'tamanhoPagina' => $tamanho, 'registros' => $registros]);
    }

    private function listarTabela(string $base, array $cfg, bool $verExcluidos, string $busca, string $campoOrd, bool $desc, int $pagina, int $tamanho): array
    {
        $chaveCol = self::col($cfg, $cfg['chave']);
        $q = DB::table($cfg['tabela'].' AS t');
        $excl = fn ($s) => $s->select(DB::raw(1))->from('exclusoes AS x')->where('x.base', $base)->whereColumn('x.chave', DB::raw("t.{$chaveCol}::text"));
        $verExcluidos ? $q->whereExists($excl) : $q->whereNotExists($excl);
        if ($busca !== '') {
            $q->where(function ($w) use ($cfg, $busca) {
                foreach ($cfg['busca'] as $campo) {
                    $w->orWhereRaw('strpos(lower(coalesce(t.'.self::col($cfg, $campo).'::text, \'\')), ?) > 0', [$busca]);
                }
            });
        }
        $total = (clone $q)->count();

        $ordExpr = self::expr($cfg, $campoOrd);
        $q->orderByRaw($ordExpr.($desc ? ' DESC NULLS LAST' : ' ASC NULLS FIRST'))->orderBy('t.'.$chaveCol);
        if (! empty($cfg['serial'])) {
            $q->orderBy('t.id');
        }
        $q->select('t.*');
        if (isset($cfg['geo'])) {
            $g = $cfg['geo'][2];
            $q->addSelect(DB::raw("ST_Y(t.{$g}) AS geo_lat"), DB::raw("ST_X(t.{$g}) AS geo_lng"));
        }
        $linhas = $q->offset(($pagina - 1) * $tamanho)->limit($tamanho)->get();

        return [$total, $linhas->map(fn ($l) => self::paraFront($base, $cfg, $l))->values()->all()];
    }

    private function listarBruto(string $base, array $cfg, bool $verExcluidos, string $busca, string $campoOrd, bool $desc, int $pagina, int $tamanho): array
    {
        $excl = DB::table('exclusoes')->where('base', $base)->pluck('chave')->flip();
        $lista = array_values(array_filter(self::bruto($cfg['bruto']), function ($reg) use ($cfg, $excl, $verExcluidos, $busca) {
            if (isset($excl[(string) ($reg[$cfg['chave']] ?? '')]) !== $verExcluidos) {
                return false;
            }
            if ($busca === '') {
                return true;
            }
            foreach ($cfg['busca'] as $campo) {
                if (str_contains(mb_strtolower((string) ($reg[$campo] ?? '')), $busca)) {
                    return true;
                }
            }

            return false;
        }));
        usort($lista, fn ($a, $b) => strnatcasecmp((string) ($a[$campoOrd] ?? ''), (string) ($b[$campoOrd] ?? '')) * ($desc ? -1 : 1));

        return [count($lista), array_slice($lista, ($pagina - 1) * $tamanho, $tamanho)];
    }

    // ------------------------------------------------------------------ escrita

    public function store(Request $r, string $base): JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        $eu = $r->user();
        if (! self::podeEscreverBase($eu, $cfg)) {
            return response()->json(['erro' => "Sem permissão para incluir registros em {$base} (precisa poder importar e editar)."], 403);
        }
        if ($base === 'metas') {
            return response()->json(['erro' => 'Metas são criadas pela tela de Metas.'], 400);
        }
        $kf = $cfg['chave'];
        $chave = mb_substr(trim((string) $r->input($kf, '')), 0, 200);
        if ($chave === '' && $base === 'prioridade_ew') {
            $chave = implode('-', array_map(fn ($c) => trim((string) $r->input($c, '')), ['tensao', 'prioridade', 'grupoRecurso', 'regional']));
        }
        if ($chave === '') {
            return response()->json(['erro' => "Informe o campo-chave ({$kf})."], 400);
        }
        if ($this->existe($cfg, $chave)) {
            return response()->json(['erro' => "Já existe um registro com {$kf} = {$chave} em {$base}."], 409);
        }
        [$dados, $erro] = self::dadosDoCorpo($cfg, $r->all());
        if ($erro) {
            return response()->json(['erro' => $erro], 400);
        }

        DB::transaction(function () use ($base, $cfg, $kf, $chave, $dados) {
            if (isset($cfg['bruto'])) {
                $lista = self::bruto($cfg['bruto'], true);
                $lista[] = [$kf => $chave] + $dados['valores'];
                self::gravarBruto($cfg['bruto'], $lista);
            } else {
                $linha = $dados['colunas'] + ($cfg['padrao'] ?? []);
                if ($base === 'equipes') {
                    $linha += ['nome' => $chave, 'ativo' => true];
                }
                $linha[self::col($cfg, $kf)] = $chave;
                $id = DB::table($cfg['tabela'])->insertGetId($linha, ! empty($cfg['serial']) ? 'id' : self::col($cfg, $kf));
                $this->gravarGeo($cfg, $dados, ! empty($cfg['serial']) ? ['id', $id] : [self::col($cfg, $kf), $chave]);
            }
            DB::table('exclusoes')->where('base', $base)->where('chave', $chave)->delete();
        });
        self::aposMudar($base);
        Auditoria::registrar('criar', "cadastros/{$base}", $chave, $eu->id, ['campos' => array_keys($dados['valores'])], $r->ip());

        return response()->json($this->buscar($base, $cfg, $chave), 201);
    }

    public function update(Request $r, string $base, string $chave): JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        $eu = $r->user();
        if (! $eu->pode('manutencao', 'editar')) {
            return response()->json(['erro' => "Sem permissão para editar {$base}."], 403);
        }
        if ($base === 'metas') {
            return response()->json(['erro' => 'Metas são editadas pela tela de Metas.'], 400);
        }
        if (! $this->existe($cfg, $chave)) {
            return response()->json(['erro' => "Registro não encontrado em {$base}."], 404);
        }
        $corpo = $r->all();
        unset($corpo[$cfg['chave']]);
        [$dados, $erro] = self::dadosDoCorpo($cfg, $corpo);
        if ($erro) {
            return response()->json(['erro' => $erro], 400);
        }

        DB::transaction(function () use ($cfg, $chave, $dados) {
            if (isset($cfg['bruto'])) {
                $lista = self::bruto($cfg['bruto'], true);
                foreach ($lista as $i => $reg) {
                    if ((string) ($reg[$cfg['chave']] ?? '') === $chave) {
                        $lista[$i] = array_merge($reg, $dados['valores']);
                        break;
                    }
                }
                self::gravarBruto($cfg['bruto'], $lista);

                return;
            }
            $onde = $this->ondeLinha($cfg, $chave);
            if ($dados['colunas']) {
                DB::table($cfg['tabela'])->where($onde[0], $onde[1])->update($dados['colunas']);
            }
            $this->gravarGeo($cfg, $dados, $onde);
        });
        self::aposMudar($base);
        Auditoria::registrar('editar', "cadastros/{$base}", $chave, $eu->id, ['campos' => array_keys($dados['valores'])], $r->ip());

        return response()->json($this->buscar($base, $cfg, $chave));
    }

    public function destroy(Request $r, string $base, string $chave): JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        $eu = $r->user();
        if (! $eu->pode('manutencao', 'editar')) {
            return response()->json(['erro' => "Sem permissão para excluir em {$base}."], 403);
        }
        if (! $this->existe($cfg, $chave)) {
            return response()->json(['erro' => "Registro não encontrado em {$base}."], 404);
        }
        DB::table('exclusoes')->insertOrIgnore(['base' => $base, 'chave' => $chave, 'em' => now(), 'por' => $eu->nome]);
        self::aposMudar($base);
        Auditoria::registrar('excluir', "cadastros/{$base}", $chave, $eu->id, [], $r->ip());

        return response()->json(['base' => $base, 'chave' => $chave, 'excluido' => true]);
    }

    public function restaurar(Request $r, string $base, string $chave): JsonResponse
    {
        if (! self::cfg($base)) {
            return self::desconhecida($base);
        }
        if (! $r->user()->isAdmin()) {
            return response()->json(['erro' => 'Somente administrador pode restaurar registros excluídos.'], 403);
        }
        DB::table('exclusoes')->where('base', $base)->where('chave', $chave)->delete();
        self::aposMudar($base);
        Auditoria::registrar('restaurar', "cadastros/{$base}", $chave, $r->user()->id, [], $r->ip());

        return response()->json(['base' => $base, 'chave' => $chave, 'excluido' => false]);
    }

    public function destroyTodos(Request $r, string $base): JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        $eu = $r->user();
        if (! self::podeEscreverBase($eu, $cfg)) {
            return response()->json(['erro' => "Sem permissão para apagar {$base} (precisa poder importar e editar)."], 403);
        }
        if ($r->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        $qtd = 0;
        DB::transaction(function () use ($base, $cfg, &$qtd) {
            if (isset($cfg['bruto'])) {
                $qtd = count(self::bruto($cfg['bruto'], true));
                self::gravarBruto($cfg['bruto'], []);
            } else {
                $qtd = DB::table($cfg['tabela'])->delete();
            }
            DB::table('exclusoes')->where('base', $base)->delete();
        });
        self::aposMudar($base);
        Auditoria::registrar('apagar_tudo', "cadastros/{$base}", null, $eu->id, ['apagados' => $qtd], $r->ip());

        return response()->json(['base' => $base, 'apagados' => $qtd]);
    }

    // ------------------------------------------------------------------ exportar / importar (por aba)

    /** Coluna NOT NULL -> valor usado quando a linha nova nao traz (expressao SQL sobre a linha importada "i"). */
    private const OBRIGATORIAS = [
        'equipes' => ['nome' => 'i.id', 'equipe_poda' => 'false', 'ativo' => 'true'],
        'esquemas' => ['descricao' => "''"],
    ];

    private const MAX_LINHAS_PARTE = 10000;

    /** GET /cadastros/{base}/exportar — a base inteira (sem os excluidos), no formato da listagem. Excel e montado no navegador. */
    public function exportar(Request $r, string $base)
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => "Sem permissão para visualizar {$base}."], 403);
        }
        Auditoria::registrar('exportar', "cadastros/{$base}", null, $r->user()->id, [], $r->ip());
        if (isset($cfg['bruto'])) {
            $excl = DB::table('exclusoes')->where('base', $base)->pluck('chave')->flip();

            return response()->json(array_values(array_filter(self::bruto($cfg['bruto']), fn ($reg) => ! isset($excl[(string) ($reg[$cfg['chave']] ?? '')]))));
        }
        $kc = self::col($cfg, $cfg['chave']);
        $q = DB::table($cfg['tabela'].' AS t')->select('t.*')
            ->whereNotExists(fn ($s) => $s->select(DB::raw(1))->from('exclusoes AS x')->where('x.base', $base)->whereColumn('x.chave', DB::raw("t.{$kc}::text")));
        if (isset($cfg['geo'])) {
            $g = $cfg['geo'][2];
            $q->addSelect(DB::raw("ST_Y(t.{$g}) AS geo_lat"), DB::raw("ST_X(t.{$g}) AS geo_lng"));
        }
        $ordem = ! empty($cfg['serial']) ? 'id' : $kc;

        // em fluxo: a VERA tem 140 mil+ linhas
        return response()->stream(function () use ($q, $ordem, $base, $cfg) {
            echo '[';
            $primeiro = true;
            foreach ($q->orderBy('t.'.$ordem)->lazy(5000) as $l) {
                echo ($primeiro ? '' : ','), json_encode(self::paraFront($base, $cfg, $l), JSON_UNESCAPED_UNICODE);
                $primeiro = false;
            }
            echo ']';
        }, 200, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /** POST /cadastros/{base}/importar/iniciar -> {lote}. Mesma permissao do "Novo registro": importar + editar. */
    public function importarIniciar(Request $r, string $base): JsonResponse
    {
        if ($x = $this->podeImportar($r, $base)) {
            return $x;
        }
        DB::table('cadastro_import')->where('criado_em', '<', now()->subDay())->delete();

        return response()->json(['lote' => (string) \Illuminate\Support\Str::uuid(), 'maxLinhas' => self::MAX_LINHAS_PARTE]);
    }

    /**
     * POST /cadastros/{base}/importar/{lote}/parte  {inicio, registros:[{campo do front: valor}]}
     * Confere linha a linha: as boas ficam guardadas, as ruins voltam na lista de erros (nao derrubam o arquivo).
     */
    public function importarParte(Request $r, string $base, string $lote): JsonResponse
    {
        if ($x = $this->podeImportar($r, $base)) {
            return $x;
        }
        if (! preg_match('/^[0-9a-f\-]{36}$/', $lote)) {
            return response()->json(['erro' => 'Lote inválido.'], 400);
        }
        $cfg = self::cfg($base);
        $registros = $r->input('registros');
        if (! is_array($registros) || count($registros) > self::MAX_LINHAS_PARTE) {
            return response()->json(['erro' => 'Envie de 1 a '.self::MAX_LINHAS_PARTE.' linhas por pedaço.'], 400);
        }
        $inicio = max(0, (int) $r->input('inicio', 0));
        $kf = $cfg['chave'];
        $linhas = [];
        $erros = [];
        foreach (array_values($registros) as $i => $reg) {
            $num = $inicio + $i + 1;
            if (! is_array($reg)) {
                $erros[] = ['linha' => $num, 'erro' => 'Linha vazia ou inválida.'];

                continue;
            }
            $chave = mb_substr(trim((string) (is_array($reg[$kf] ?? null) ? '' : ($reg[$kf] ?? ''))), 0, 200);
            if ($chave === '' && $base === 'prioridade_ew') {
                $chave = implode('-', array_map(fn ($c) => trim((string) (is_scalar($reg[$c] ?? null) ? $reg[$c] : '')), ['tensao', 'prioridade', 'grupoRecurso', 'regional']));
            }
            if ($chave === '') {
                $erros[] = ['linha' => $num, 'erro' => "Sem o campo-chave ({$kf})."];

                continue;
            }
            [$d, $erro] = self::dadosDoCorpo($cfg, $reg);
            if ($erro) {
                $erros[] = ['linha' => $num, 'chave' => $chave, 'erro' => $erro];

                continue;
            }
            $dados = $d['colunas'] + [self::col($cfg, $kf) => $chave];
            if ($d['temGeo']) {
                $dados[$cfg['geo'][2]] = ($d['lat'] !== null && $d['lng'] !== null) ? sprintf('SRID=4326;POINT(%.7F %.7F)', $d['lng'], $d['lat']) : null;
            }
            $linhas[] = ['lote' => $lote, 'base' => $base, 'usuario_id' => $r->user()->id, 'n' => $num,
                'dados' => json_encode($dados, JSON_UNESCAPED_UNICODE)];
        }
        foreach (array_chunk($linhas, 1000) as $bloco) {
            DB::table('cadastro_import')->upsert($bloco, ['lote', 'n'], ['dados']);
        }

        return response()->json(['aceitas' => count($linhas), 'erros' => $erros]);
    }

    /**
     * POST /cadastros/{base}/importar/{lote}/aplicar  {modo: atualizar|substituir}
     *  atualizar: chave que ja existe e atualizada (so as colunas que vieram no arquivo), chave nova entra.
     *  substituir: a base fica igual ao arquivo (o que nao veio sai). Exclusoes (flag) continuam valendo.
     * Tudo numa transacao; chave repetida no arquivo: vale a ultima linha.
     */
    public function importarAplicar(Request $r, string $base, string $lote): JsonResponse
    {
        if ($x = $this->podeImportar($r, $base)) {
            return $x;
        }
        $cfg = self::cfg($base);
        $modo = $r->input('modo') === 'substituir' ? 'substituir' : 'atualizar';
        $eu = $r->user();
        $q = fn () => DB::table('cadastro_import')->where('lote', $lote)->where('base', $base)->where('usuario_id', $eu->id);
        $total = $q()->count();
        if (! $total) {
            return response()->json(['erro' => 'Nenhuma linha válida chegou para gravar.'], 400);
        }
        @set_time_limit(600);
        $res = DB::transaction(fn () => isset($cfg['bruto'])
            ? $this->aplicarBruto($cfg, $q, $modo)
            : $this->aplicarTabela($base, $cfg, $lote, $modo));
        $q()->delete();
        self::aposMudar($base);
        DB::table('importacoes_log')->insert(['id' => (string) \Illuminate\Support\Str::uuid(), 'data_hora' => now(), 'usuario_id' => $eu->id,
            'base' => "Gestão de Bases: {$base}", 'arquivo_origem' => mb_substr((string) $r->input('arquivo', ''), 0, 200) ?: null,
            'registros_processados' => $res['novos'] + $res['atualizados'], 'registros_com_erro' => (int) $r->input('rejeitadas', 0)]);
        Auditoria::registrar('importar', "cadastros/{$base}", null, $eu->id, $res + ['modo' => $modo, 'arquivo' => $r->input('arquivo')], $r->ip());

        return response()->json($res + ['base' => $base, 'modo' => $modo]);
    }

    private function aplicarTabela(string $base, array $cfg, string $lote, string $modo): array
    {
        $t = $cfg['tabela'];
        $kc = self::col($cfg, $cfg['chave']);
        $permitidas = array_map(fn ($c) => $c[0], $cfg['campos']);
        if (isset($cfg['geo'])) {
            $permitidas[] = $cfg['geo'][2];
        }
        // colunas que vieram no arquivo (so as conhecidas: nada de nome de coluna vindo de fora)
        $cols = array_values(array_intersect($permitidas, DB::table('cadastro_import')->where('lote', $lote)
            ->selectRaw('DISTINCT jsonb_object_keys(dados) AS c')->pluck('c')->all()));
        $outras = array_values(array_diff($cols, [$kc]));

        DB::statement('DROP TABLE IF EXISTS imp');
        DB::statement("CREATE TEMP TABLE imp ON COMMIT DROP AS SELECT DISTINCT ON (r.{$kc}) r.* FROM cadastro_import c, jsonb_populate_record(NULL::{$t}, c.dados) r
            WHERE c.lote = ? ORDER BY r.{$kc}, c.n DESC", [$lote]);
        $unicas = (int) DB::selectOne('SELECT count(*) AS n FROM imp')->n;

        $removidos = 0;
        if ($modo === 'substituir') {
            $removidos = DB::delete("DELETE FROM {$t} t WHERE NOT EXISTS (SELECT 1 FROM imp i WHERE i.{$kc} = t.{$kc})");
        }
        $obrig = self::OBRIGATORIAS[$base] ?? [];
        $atualizados = 0;
        if ($outras) {
            $set = implode(', ', array_map(fn ($c) => isset($obrig[$c]) ? "{$c} = COALESCE(i.{$c}, t.{$c})" : "{$c} = i.{$c}", $outras));
            $atualizados = DB::update("UPDATE {$t} t SET {$set} FROM imp i WHERE t.{$kc} = i.{$kc}");
        }
        $insCols = array_values(array_unique(array_merge([$kc], $outras, array_keys($obrig))));
        $insVals = array_map(fn ($c) => isset($obrig[$c]) ? (in_array($c, $outras, true) ? "COALESCE(i.{$c}, {$obrig[$c]})" : $obrig[$c]) : "i.{$c}", $insCols);
        $novos = DB::affectingStatement('INSERT INTO '.$t.' ('.implode(', ', $insCols).') SELECT '.implode(', ', $insVals)
            ." FROM imp i WHERE NOT EXISTS (SELECT 1 FROM {$t} t WHERE t.{$kc} = i.{$kc})");

        // atualizados conta linhas da tabela; em base com chave repetida (protecao/conjuntos) pode passar das unicas
        return ['novos' => $novos, 'atualizados' => min($atualizados, $unicas), 'removidos' => $removidos, 'repetidasNoArquivo' => $this->repetidas($lote, $unicas),
            'colunas' => array_values(array_map(fn ($c) => self::campoDaColuna($cfg, $c), $cols))];
    }

    private function aplicarBruto(array $cfg, callable $q, string $modo): array
    {
        $kf = $cfg['chave'];
        $novasPorChave = [];
        foreach ($q()->orderBy('n')->pluck('dados') as $d) {
            $d = json_decode($d, true);
            $novasPorChave[(string) $d[$kf]] = $d;   // a ultima repetida vale
        }
        $atual = self::bruto($cfg['bruto'], true);
        $saida = [];
        $atualizados = 0;
        $removidos = 0;
        foreach ($atual as $reg) {
            $k = (string) ($reg[$kf] ?? '');
            if (isset($novasPorChave[$k])) {
                $saida[] = array_merge($reg, $novasPorChave[$k]);
                unset($novasPorChave[$k]);
                $atualizados++;
            } elseif ($modo === 'substituir') {
                $removidos++;
            } else {
                $saida[] = $reg;
            }
        }
        $novos = count($novasPorChave);
        self::gravarBruto($cfg['bruto'], array_merge($saida, array_values($novasPorChave)));

        return ['novos' => $novos, 'atualizados' => $atualizados, 'removidos' => $removidos, 'repetidasNoArquivo' => 0, 'colunas' => array_keys($cfg['campos'])];
    }

    private function repetidas(string $lote, int $unicas): int
    {
        return max(0, DB::table('cadastro_import')->where('lote', $lote)->count() - $unicas);
    }

    private static function campoDaColuna(array $cfg, string $coluna): string
    {
        foreach ($cfg['campos'] as $campo => [$c]) {
            if ($c === $coluna) {
                return $campo;
            }
        }

        return isset($cfg['geo']) && $coluna === $cfg['geo'][2] ? $cfg['geo'][0].'/'.$cfg['geo'][1] : $coluna;
    }

    private function podeImportar(Request $r, string $base): ?JsonResponse
    {
        if (! $cfg = self::cfg($base)) {
            return self::desconhecida($base);
        }
        if ($base === 'metas') {
            return response()->json(['erro' => 'Metas são importadas pela Importação de Bases (planilha de Metas), que calcula a meta diária.'], 400);
        }
        if (! self::podeEscreverBase($r->user(), $cfg)) {
            return response()->json(['erro' => "Sem permissão para importar {$base} (precisa poder importar e editar)."], 403);
        }

        return null;
    }

    // ------------------------------------------------------------------ apoio

    private static function cfg(string $base): ?array
    {
        return self::BASES[$base] ?? null;
    }

    private static function desconhecida(string $base): JsonResponse
    {
        return response()->json(['erro' => "Base de cadastro desconhecida: {$base}"], 400);
    }

    /** "Novo registro" e "Apagar tudo": quem pode SUBIR (importar) E EDITAR a base (metas usa o modulo metas). */
    private static function podeEscreverBase($eu, array $cfg): bool
    {
        $m = $cfg['modulo'] ?? 'manutencao';

        return $eu->pode($m, 'importar') && $eu->pode($m, 'editar');
    }

    private static function col(array $cfg, string $campo): string
    {
        return $cfg['campos'][$campo][0];
    }

    private static function expr(array $cfg, string $campo): string
    {
        if (isset($cfg['geo']) && $campo === $cfg['geo'][0]) {
            return "ST_Y(t.{$cfg['geo'][2]})";
        }
        if (isset($cfg['geo']) && $campo === $cfg['geo'][1]) {
            return "ST_X(t.{$cfg['geo'][2]})";
        }

        return 't.'.self::col($cfg, $campo);
    }

    /** Linha que a chave aponta: em tabela SERIAL a chave pode repetir -> a mais antiga. */
    private function ondeLinha(array $cfg, string $chave): array
    {
        $kc = self::col($cfg, $cfg['chave']);
        if (! empty($cfg['serial'])) {
            return ['id', DB::table($cfg['tabela'])->where($kc, $chave)->min('id')];
        }

        return [$kc, $chave];
    }

    private function existe(array $cfg, string $chave): bool
    {
        if (isset($cfg['bruto'])) {
            foreach (self::bruto($cfg['bruto']) as $reg) {
                if ((string) ($reg[$cfg['chave']] ?? '') === $chave) {
                    return true;
                }
            }

            return false;
        }

        return DB::table($cfg['tabela'])->where(self::col($cfg, $cfg['chave']), $chave)->exists();
    }

    private function buscar(string $base, array $cfg, string $chave): ?array
    {
        if (isset($cfg['bruto'])) {
            foreach (self::bruto($cfg['bruto']) as $reg) {
                if ((string) ($reg[$cfg['chave']] ?? '') === $chave) {
                    return $reg;
                }
            }

            return null;
        }
        $onde = $this->ondeLinha($cfg, $chave);
        $q = DB::table($cfg['tabela'].' AS t')->where('t.'.$onde[0], $onde[1])->select('t.*');
        if (isset($cfg['geo'])) {
            $g = $cfg['geo'][2];
            $q->addSelect(DB::raw("ST_Y(t.{$g}) AS geo_lat"), DB::raw("ST_X(t.{$g}) AS geo_lng"));
        }
        $l = $q->first();

        return $l ? self::paraFront($base, $cfg, $l) : null;
    }

    /**
     * Corpo do front -> colunas. So campos conhecidos; texto aparado (ate 500), numero validado.
     * Retorna [['colunas'=>..., 'valores'=>... (nome do front), 'lat'=>?, 'lng'=>?, 'temGeo'=>bool], erro|null].
     */
    private static function dadosDoCorpo(array $cfg, array $corpo): array
    {
        $colunas = [];
        $valores = [];
        foreach ($cfg['campos'] as $campo => [$coluna, $tipo]) {
            if ($campo === $cfg['chave'] || ! array_key_exists($campo, $corpo)) {
                continue;
            }
            $v = $corpo[$campo];
            if (is_array($v)) {
                return [null, "Valor inválido em {$campo}."];
            }
            if ($tipo === 'bool') {
                $v = self::booleano($v);
                if ($v === null) {
                    continue; // vazio = nao informado (celula em branco nao desativa a equipe)
                }
            } elseif ($tipo === 'int' || $tipo === 'num') {
                $v = self::numero($v);
                if ($v === false) {
                    return [null, "{$campo} precisa ser um número."];
                }
                if ($tipo === 'int' && $v !== null) {
                    $v = (int) round($v);
                }
            } else {
                $v = $v === null ? null : mb_substr(trim((string) $v), 0, 500);
                if ($v === '' && $coluna !== 'descricao') {
                    $v = null;
                }
                if ($coluna === 'nome' && $v === null) {
                    continue; // nome da equipe e obrigatorio: vazio mantem o atual
                }
                if ($coluna === 'descricao' && $v === null) {
                    $v = '';
                }
            }
            $colunas[$coluna] = $v;
            $valores[$campo] = $v;
        }
        $geo = ['temGeo' => false, 'lat' => null, 'lng' => null];
        if (isset($cfg['geo'])) {
            [$fLat, $fLng] = $cfg['geo'];
            if (array_key_exists($fLat, $corpo) || array_key_exists($fLng, $corpo)) {
                $lat = self::numero($corpo[$fLat] ?? null);
                $lng = self::numero($corpo[$fLng] ?? null);
                if ($lat === false || $lng === false || ($lat !== null && abs($lat) > 90) || ($lng !== null && abs($lng) > 180)) {
                    return [null, 'Coordenada inválida (latitude -90 a 90, longitude -180 a 180).'];
                }
                $geo = ['temGeo' => true, 'lat' => $lat, 'lng' => $lng];
                $valores[$fLat] = $lat;
                $valores[$fLng] = $lng;
            }
        }

        return [['colunas' => $colunas, 'valores' => $valores] + $geo, null];
    }

    /** Sim/Nao, true/false, 1/0, x; vazio -> null. */
    private static function booleano($v): ?bool
    {
        if (is_bool($v)) {
            return $v;
        }
        if ($v === null || trim((string) $v) === '') {
            return null;
        }
        $t = strtolower(trim(strtr((string) $v, ['ã' => 'a', 'Ã' => 'a'])));

        return in_array($t, ['sim', 's', 'x', 'yes', 'y', 'true', '1', 'on', 'verdadeiro'], true);
    }

    /** null = vazio; false = invalido. Aceita virgula decimal. */
    private static function numero($v)
    {
        if ($v === null || (is_string($v) && trim($v) === '')) {
            return null;
        }
        if (is_bool($v)) {
            return false;
        }
        $t = str_replace(',', '.', trim((string) $v));

        return is_numeric($t) ? (float) $t : false;
    }

    /** Coordenada: precisa das duas; uma so (ou nenhuma) zera a posicao. */
    private function gravarGeo(array $cfg, array $dados, array $onde): void
    {
        if (! isset($cfg['geo']) || ! $dados['temGeo']) {
            return;
        }
        $g = $cfg['geo'][2];
        if ($dados['lat'] !== null && $dados['lng'] !== null) {
            DB::update("UPDATE {$cfg['tabela']} SET {$g} = ST_SetSRID(ST_MakePoint(?, ?), 4326) WHERE {$onde[0]} = ?", [$dados['lng'], $dados['lat'], $onde[1]]);
        } else {
            DB::update("UPDATE {$cfg['tabela']} SET {$g} = NULL WHERE {$onde[0]} = ?", [$onde[1]]);
        }
    }

    private static function paraFront(string $base, array $cfg, object $l): array
    {
        if ($base === 'equipes') {
            $l->base_lat = $l->geo_lat;
            $l->base_lng = $l->geo_lng;

            return EquipeController::paraFront($l);
        }
        if ($base === 'metas') {
            return MetaController::paraFront($l);
        }
        $saida = [];
        foreach ($cfg['campos'] as $campo => [$coluna, $tipo]) {
            $v = $l->{$coluna} ?? null;
            if ($v !== null && $tipo === 'int') {
                $v = (int) $v;
            } elseif ($v !== null && $tipo === 'num') {
                $v = fmod((float) $v, 1.0) == 0.0 ? (int) $v : (float) $v;
            }
            $saida[$campo] = $v;
        }
        if (isset($cfg['geo'])) {
            $saida[$cfg['geo'][0]] = $l->geo_lat !== null ? (float) $l->geo_lat : null;
            $saida[$cfg['geo'][1]] = $l->geo_lng !== null ? (float) $l->geo_lng : null;
        }

        return $saida;
    }

    private static function bruto(string $entidade, bool $travar = false): array
    {
        $q = DB::table('legado_bruto')->where('entidade', $entidade);
        if ($travar) {
            $q->lockForUpdate();
        }
        $d = json_decode((string) $q->value('dados'), true);

        return is_array($d) ? array_values(array_filter($d, 'is_array')) : [];
    }

    private static function gravarBruto(string $entidade, array $lista): void
    {
        DB::table('legado_bruto')->updateOrInsert(['entidade' => $entidade],
            ['dados' => json_encode(array_values($lista), JSON_UNESCAPED_UNICODE), 'importado_em' => now()]);
    }

    /** A VERA do mapa fica num arquivo pronto (cache): mudou a base, monta de novo na proxima abertura. */
    private static function aposMudar(string $base): void
    {
        if ($base === 'vera') {
            foreach (glob(storage_path('app'.DIRECTORY_SEPARATOR.'cache'.DIRECTORY_SEPARATOR.'vera_*.ndjson.gz')) ?: [] as $f) {
                @unlink($f);
            }
        }
    }
}
