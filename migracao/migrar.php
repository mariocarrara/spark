<?php
/**
 * SPARK - migracao model/ (JSON/TSV do PowerShell) -> PostgreSQL + PostGIS
 * Uso:  php -d memory_limit=-1 migrar.php <pasta_model> [dsn] [usuario] [senha]
 * Exemplo: php -d memory_limit=-1 migrar.php amostra/model "pgsql:host=/tmp;port=5433;dbname=spark" postgres ""
 * POR PARTES: so substitui as tabelas cujo arquivo veio na pasta (ex.: so programacao.json -> so as programacoes mudam;
 * sem usuarios.json os usuarios ficam como estao). Usa COPY (rapido) e nao grava senhas em texto aberto.
 * Tudo numa transacao: se der erro no meio, NADA muda (os dados antigos ficam como estavam).
 * A senha do banco pode vir da variavel de ambiente SPARK_DB_PASS (melhor que na linha de comando).
 * Tambem e chamado pela tela "Gestao de Bases > Importar sistema antigo" (Laravel, ImportacaoLegadoController).
 */
declare(strict_types=1);
ini_set('memory_limit', '-1');
$model = rtrim($argv[1] ?? 'model', '/\\');
$dsn   = $argv[2] ?? 'pgsql:host=127.0.0.1;port=5433;dbname=spark';
$user  = $argv[3] ?? 'postgres';
$pass  = $argv[4] ?? (getenv('SPARK_DB_PASS') ?: '');
$pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('SET search_path = spark, public');
if (!glob("$model/*.{json,jsonl,tsv}", GLOB_BRACE)) { fwrite(STDERR, "ERRO: nenhum arquivo .json/.jsonl/.tsv em $model\n"); exit(2); }
$pdo->beginTransaction();

function lerJson(string $arq) {
    if (!is_file($arq)) return null;
    $t = file_get_contents($arq);
    if (strncmp($t, "\xEF\xBB\xBF", 3) === 0) $t = substr($t, 3);
    return json_decode($t, true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
}
function esc($v): string {                       // formato texto do COPY
    if ($v === null) return '@@NULO@@';
    if (is_bool($v)) return $v ? 't' : 'f';
    if (is_array($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
    if (is_float($v)) return json_encode($v);   // (string) corta em 14 digitos; json_encode da o menor texto que volta ao MESMO numero
    $s = (string)$v;
    return strtr($s, ["\\" => "\\\\", "\t" => "\\t", "\n" => "\\n", "\r" => "\\r"]);
}
function pt($lat, $lng): ?string {               // EWKT aceito direto pelo COPY em colunas geometry
    if (!is_numeric($lat) || !is_numeric($lng)) return null;
    $la = (float)$lat; $lo = (float)$lng;
    if (abs($la) > 90 || abs($lo) > 180 || ($la == 0.0 && $lo == 0.0)) return null;
    return sprintf('SRID=4326;POINT(%.7F %.7F)', $lo, $la);
}
// id que nao e UUID (dado muito antigo) -> UUID fixo derivado dele; mesmas referencias continuam batendo
function uuidDe($id): string { $id = strtolower(trim((string)$id)); if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) return $id; $h = md5('spark-legado:' . $id); return substr($h,0,8).'-'.substr($h,8,4).'-5'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20,12); }
function nn($v) { return ($v === '' || $v === null) ? null : $v; }
function num($v) { return is_numeric($v) ? $v : 0; }
function dt($v): ?string { $v = nn($v); return $v === null ? null : substr((string)$v, 0, 10); }

$resumo = [];
function copiar(PDO $pdo, string $tabela, array $cols, iterable $linhas, string $nome = ''): int {
    global $resumo;
    $t0 = microtime(true); $n = 0; $buf = [];
    $flush = function () use ($pdo, $tabela, $cols, &$buf) {
        if ($buf) { $pdo->pgsqlCopyFromArray($tabela, $buf, "\t", '@@NULO@@', implode(',', $cols)); $buf = []; }
    };
    foreach ($linhas as $l) {
        $buf[] = implode("\t", array_map('esc', $l)) . "\n";
        $n++;
        if (count($buf) >= 20000) $flush();
    }
    $flush();
    $resumo[] = [$nome ?: $tabela, $n, round(microtime(true) - $t0, 1)];
    printf("  %-28s %9d linhas  %6.1fs\n", $nome ?: $tabela, $n, microtime(true) - $t0);
    return $n;
}
// metas repetidas (equipe+tipo+mes): vale a PRIMEIRA, que e a que a tela do legado usa (prodMetaDe: ms.find)
function primeiroPorChave(array $itens, callable $chave): array {
    $m = [];
    foreach ($itens as $i) { $k = $chave($i); if (!array_key_exists($k, $m)) $m[$k] = $i; }
    return array_values($m);
}
function unico(array $itens, callable $chave): array {   // ultimo registro por chave vence
    $m = [];
    foreach ($itens as $i) $m[$chave($i)] = $i;
    return array_values($m);
}

/**
 * Le um arquivo JSON que e uma LISTA ([{...},{...}]) item a item, sem carregar o arquivo nem a lista inteira na memoria
 * (o manutencao_os.json tem ~100 MB; inteiro, o PHP passava de 600 MB e o servidor pequeno do Render caia).
 * Percorre em pedacos de 1 MB e pula direto para os caracteres que importam ({ } [ ] " \).
 */
function lerJsonItens(string $arq): Generator {
    if (!is_file($arq)) return;
    $h = fopen($arq, 'rb');
    $buf = fread($h, 3);
    if ($buf !== "\xEF\xBB\xBF") { $resto = $buf; } else { $resto = ''; }
    $buf = $resto;
    $prof = 0; $emTexto = false; $escapa = false; $ini = -1; $pos = 0; $comecou = false;
    while (true) {
        $len = strlen($buf);
        while ($pos < $len) {
            if ($emTexto) {
                $p = strcspn($buf, "\"\\", $pos);          // pula o miolo do texto
                $pos += $p;
                if ($pos >= $len) break;
                if ($buf[$pos] === '\\') { $pos += 2; continue; }   // caractere escapado
                $emTexto = false; $pos++; continue;
            }
            $p = strcspn($buf, "{}[]\"", $pos);
            $pos += $p;
            if ($pos >= $len) break;
            $c = $buf[$pos];
            if ($c === '"') { $emTexto = true; $pos++; continue; }
            if ($c === '[' || $c === '{') {
                if (!$comecou) { $comecou = true; if ($c === '[') { $pos++; continue; } }   // abre a lista de fora
                $prof++;
                if ($prof === 1) $ini = $pos;
            } else {
                $prof--;
                if ($prof === 0 && $ini >= 0) {
                    $item = json_decode(substr($buf, $ini, $pos - $ini + 1), true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
                    if ($item !== null) yield $item;
                    $ini = -1;
                }
                if ($prof < 0) { fclose($h); return; }   // fechou a lista de fora
            }
            $pos++;
        }
        if (feof($h)) break;
        // guarda so o pedaco ainda em aberto (o item atual) e le mais
        $corte = $ini >= 0 ? $ini : min($pos, strlen($buf));
        $buf = substr($buf, $corte) . fread($h, 1048576);
        $pos -= $corte;
        if ($ini >= 0) $ini = 0;
    }
    fclose($h);
}

/** Versao em fluxo do unico(): 1a passada conta as chaves; 2a entrega so a ULTIMA ocorrencia de cada uma. */
function unicoArquivo(string $arq, callable $chave): Generator {
    $vezes = [];
    foreach (lerJsonItens($arq) as $i) { $k = (string)$chave($i); $vezes[$k] = ($vezes[$k] ?? 0) + 1; }
    foreach (lerJsonItens($arq) as $i) {
        $k = (string)$chave($i);
        if (--$vezes[$k] === 0) yield $i;
    }
}

/** O arquivo veio? Entao a(s) tabela(s) dele sao esvaziadas e recarregadas; senao ficam como estao. */
function tem(string $arq): bool { global $model; return is_file("$model/$arq"); }
$pulados = [];
function parte(PDO $pdo, string $arq, string $tabelas): bool {
    global $pulados;
    if (!tem($arq)) { $pulados[] = $arq; return false; }
    $pdo->exec("TRUNCATE $tabelas CASCADE");
    return true;
}
echo "Substitui so as partes cujo arquivo veio na pasta.\n";

// ---------------- usuarios / permissoes ----------------
echo "Usuarios e permissoes\n";
$us = [];
if (parte($pdo, 'usuarios.json', 'usuarios, sessoes, auditoria')) {   // permissoes caem junto (FK); ids mudam, entao sessoes e auditoria tambem
$us = lerJson("$model/usuarios.json") ?? [];
copiar($pdo, 'usuarios', ['id','nome','email','senha_hash','senha_legada','status_conta','perfil_base'],
  (function () use ($us) { foreach ($us as $u) {
      // pedido de cadastro anterior a v3.16.1: a senha era um GUID aleatorio que ninguem conhece -> sem senha (admin define ao aprovar)
      $senhaInutil = ($u['origem'] ?? '') === 'solicitacao' && ($u['statusConta'] ?? '') === 'PendenteAprovacao' && empty($u['senhaDefinida']);
      yield [$u['id'], $u['nome'] ?? '', $u['email'] ?? '', null, $senhaInutil ? null : nn($u['senha'] ?? null), $u['statusConta'] ?? 'Ativo', $u['perfilBase'] ?? 'Consulta'];
  } })());
}
$ids = array_flip($pdo->query('SELECT id FROM usuarios')->fetchAll(PDO::FETCH_COLUMN));
if (parte($pdo, 'permissoes.json', 'permissoes'))
copiar($pdo, 'permissoes', ['usuario_id','modulo','acao','valor'],
  (function () use ($model, $ids) {
    foreach (lerJson("$model/permissoes.json") ?? [] as $p) {
        if (!isset($ids[$p['usuarioId']])) continue;
        $mz = $p['matriz'] ?? [];
        // front legado (alertasVisivel): sem alertas.visualizar booleano, segue manutencao.visualizar
        if (!isset($mz['alertas']['visualizar']) || !is_bool($mz['alertas']['visualizar'])) $mz['alertas']['visualizar'] = !empty($mz['manutencao']['visualizar']);
        // v3.26: nas caixas "(menu)" desmarcada (false) e diferente de nunca mexida (sem linha)
        $menu = ['geral', 'historico', 'medicao', 'regras', 'importacao'];
        foreach ($mz as $mod => $acoes) foreach ((array)$acoes as $acao => $ok) {
            if ($ok) yield [$p['usuarioId'], $mod, $acao, true];
            elseif ($ok === false && $acao === 'visualizar' && in_array($mod, $menu, true)) yield [$p['usuarioId'], $mod, $acao, false];
        }
    } })());
if (parte($pdo, 'solicitacoes_cadastro.json', 'solicitacoes_cadastro'))
copiar($pdo, 'solicitacoes_cadastro', ['id','email','status','criado_em','decidido_em','decidido_por'],
  (function () use ($model) { foreach (lerJson("$model/solicitacoes_cadastro.json") ?? [] as $s) yield [$s['id'], $s['email'], $s['status'] ?? 'Pendente', $s['criadoEm'], nn($s['decididoEm'] ?? null), nn($s['decididoPor'] ?? null)]; })());
if (parte($pdo, 'importacoes_log.json', 'importacoes_log'))
copiar($pdo, 'importacoes_log', ['id','data_hora','usuario_id','base','arquivo_origem','registros_processados','registros_com_erro'],
  (function () use ($model) { foreach (unico(lerJson("$model/importacoes_log.json") ?? [], fn($x) => $x['id']) as $i) yield [$i['id'], $i['dataHora'], nn($i['usuarioId'] ?? null), $i['base'] ?? '', nn($i['arquivoOrigem'] ?? null), (int)($i['registrosProcessados'] ?? 0), (int)($i['registrosComErro'] ?? 0)]; })());

// ---------------- cadastros ----------------
echo "Cadastros\n";
if (parte($pdo, 'equipes.json', 'equipes'))
copiar($pdo, 'equipes', ['id','nome','tipo_equipe','polo','regional','departamento','proprio_terceiro','equipe_poda','base','ativo'],
  (function () use ($model) { foreach (unico(lerJson("$model/equipes.json") ?? [], fn($x) => $x['id']) as $e) yield [$e['id'], $e['nome'] ?? $e['id'], nn($e['tipoEquipe'] ?? null), nn($e['polo'] ?? null), nn($e['regional'] ?? null), nn($e['departamento'] ?? null), nn($e['proprioTerceiro'] ?? null), (bool)($e['equipePoda'] ?? false), pt($e['baseLat'] ?? null, $e['baseLng'] ?? null), (bool)($e['ativo'] ?? true)]; })());
if (parte($pdo, 'metas.json', 'metas'))
copiar($pdo, 'metas', ['id','equipe_id','tipo','ano_mes','meta_mensal','dias_uteis','meta_diaria','origem','atualizado_por','atualizado_em'],
  (function () use ($model) { foreach (primeiroPorChave(lerJson("$model/metas.json") ?? [], fn($x) => $x['equipeId'] . '|' . ($x['tipo'] ?? 'poda') . '|' . $x['anoMes']) as $m) yield [$m['id'], $m['equipeId'], $m['tipo'] ?? 'poda', $m['anoMes'], $m['metaMensal'], (int)($m['diasUteis'] ?? 21), $m['metaDiaria'] ?? null, nn($m['origem'] ?? null), nn($m['atualizadoPor'] ?? null), nn($m['atualizadoEm'] ?? null)]; })());
if (parte($pdo, 'feriados.json', 'feriados'))
copiar($pdo, 'feriados', ['data','descricao','abrangencia'],
  (function () use ($model) { foreach (unico(lerJson("$model/feriados.json") ?? [], fn($x) => $x['data']) as $f) yield [$f['data'], $f['descricao'] ?? '', $f['abrangencia'] ?? 'Nacional']; })());
if (parte($pdo, 'indisponibilidades.json', 'indisponibilidades'))
copiar($pdo, 'indisponibilidades', ['id','equipe_id','data_inicio','data_fim','tipo','texto','autor_id','criado_em','excluido','excluido_por','excluido_em'],
  (function () use ($model) { foreach (lerJson("$model/indisponibilidades.json") ?? [] as $i) yield [$i['id'], $i['equipeId'], $i['dataInicio'], $i['dataFim'], nn($i['tipo'] ?? null), nn($i['texto'] ?? null), nn($i['autorId'] ?? null), nn($i['criadoEm'] ?? null), (bool)($i['excluido'] ?? false), nn($i['excluidoPor'] ?? null), nn($i['excluidoEm'] ?? null)]; })());
if (parte($pdo, 'justificativas.json', 'justificativas'))
copiar($pdo, 'justificativas', ['id','data','equipe_id','tipo','texto','autor_id','criado_em','excluido','excluido_por','excluido_em'],
  (function () use ($model) { foreach (lerJson("$model/justificativas.json") ?? [] as $i) yield [$i['id'], $i['data'], $i['equipeId'], nn($i['tipo'] ?? null), nn($i['texto'] ?? null), nn($i['autorId'] ?? null), nn($i['criadoEm'] ?? null), (bool)($i['excluido'] ?? false), nn($i['excluidoPor'] ?? null), nn($i['excluidoEm'] ?? null)]; })());
if (parte($pdo, 'listas_cadastro.json', 'listas_cadastro'))
copiar($pdo, 'listas_cadastro', ['id','lista','nome','ordem','ativo','excluido'],
  (function () use ($model) { foreach (lerJson("$model/listas_cadastro.json") ?? [] as $l) yield [$l['id'], $l['lista'], $l['nome'], (int)($l['ordem'] ?? 0), (bool)($l['ativo'] ?? true), (bool)($l['excluido'] ?? false)]; })());
if (parte($pdo, 'esquemas.json', 'esquemas'))
copiar($pdo, 'esquemas', ['codigo','descricao','tipo'],
  (function () use ($model) { foreach (unico(lerJson("$model/esquemas.json") ?? [], fn($x) => $x['codigo']) as $e) yield [$e['codigo'], $e['descricao'] ?? '', nn($e['tipo'] ?? null)]; })());
if (parte($pdo, 'conjuntos.json', 'conjuntos') && $pdo->exec('ALTER SEQUENCE conjuntos_id_seq RESTART') !== false)
copiar($pdo, 'conjuntos', ['regional','sigla','tensao_nominal','cod_conjunto','nome_conjunto','alimentador','tensao'],
  (function () use ($model) { foreach (lerJson("$model/conjuntos.json") ?? [] as $c) yield [nn($c['regional'] ?? null), nn($c['sigla'] ?? null), nn($c['tensaoNominal'] ?? null), nn($c['codConjunto'] ?? null), nn($c['nomeConjunto'] ?? null), nn($c['alimentador'] ?? null), nn($c['tensao'] ?? null)]; })());
if (parte($pdo, 'alimentador_polo.json', 'alimentador_polo'))
copiar($pdo, 'alimentador_polo', ['alimentador','polo','regional'],
  (function () use ($model) { foreach (unico(lerJson("$model/alimentador_polo.json") ?? [], fn($x) => $x['alimentador']) as $a) yield [$a['alimentador'], nn($a['polo'] ?? null), nn($a['regional'] ?? null)]; })());
if (parte($pdo, 'prioridade_ew.json', 'prioridade_ew'))
copiar($pdo, 'prioridade_ew', ['chave','grupo_recurso','prioridade_ew','prioridade','regional','tensao'],
  (function () use ($model) { foreach (unico(lerJson("$model/prioridade_ew.json") ?? [], fn($x) => $x['chave']) as $p) yield [$p['chave'], nn($p['grupoRecurso'] ?? null), nn($p['prioridadeEW'] ?? null), nn($p['prioridade'] ?? null), nn($p['regional'] ?? null), nn($p['tensao'] ?? null)]; })());
if (parte($pdo, 'ajuda_faq.json', 'ajuda_faq'))
copiar($pdo, 'ajuda_faq', ['id','categoria','pergunta','resposta','palavras','ordem','ativo','excluido'],
  (function () use ($model) { foreach (lerJson("$model/ajuda_faq.json") ?? [] as $a) yield [$a['id'], nn($a['categoria'] ?? null), $a['pergunta'], $a['resposta'], nn($a['palavras'] ?? null), (int)($a['ordem'] ?? 0), (bool)($a['ativo'] ?? true), (bool)($a['excluido'] ?? false)]; })());
$cfg = [];
$ac = lerJson("$model/alertas_config.json"); if ($ac) $cfg[] = ['alertas', $ac[0]['valores'] ?? $ac[0], $ac[0]['atualizadoEm'] ?? null, $ac[0]['atualizadoPor'] ?? null];
$nm = lerJson("$model/nix_meta.json"); if ($nm) $cfg[] = ['nix_meta', $nm[0], $nm[0]['enviadoEm'] ?? null, $nm[0]['enviadoPorNome'] ?? null];
// v3.16.2 - configuracoes feitas pelos usuarios que antes ficavam de fora
$ar = lerJson("$model/app_rl_config.json"); if ($ar) $cfg[] = ['app_rl', $ar[0] ?? $ar, $ar[0]['atualizadoEm'] ?? null, $ar[0]['atualizadoPor'] ?? null];
$pc = lerJson("$model/prefeituras_config.json"); if ($pc) $cfg[] = ['prefeituras_config', $pc, null, null];
if ($cfg) { $del = $pdo->prepare('DELETE FROM configuracoes WHERE chave = ?'); foreach ($cfg as $c) $del->execute([$c[0]]); }   // so as chaves cujos arquivos vieram
copiar($pdo, 'configuracoes', ['chave','valor','atualizado_em','atualizado_por'], (function () use ($cfg) { foreach ($cfg as $c) yield [$c[0], $c[1], $c[2] ?? date('c'), $c[3]]; })());

// ---------------- OS (base atual e historico) ----------------
$colsOs = ['id','origem','os_primaria','id_vera','status_os','tipo_servico','tipo_equipe_necessaria','tipo_equipe_exec','prioridade_ew','equipe_id','data_abertura','data_execucao','data_prevista','alimentador','conjunto','protecao_id','trecho','localidade','desc_esquema','observacao','loc','loc_fonte','loc_origem','loc_aproximada','previsto','realizado','previsto_poda','previsto_limpeza','previsto_estrutura','realizado_poda','realizado_limpeza','realizado_estrutura','poste_id','poste_tipo','poste_area_local','poste_conjunto','poste_mun','poste_loc','previsto_por_esquema','localidade_por_poste'];
function linhaOs(array $o): array {
    $l = $o['localizacao'] ?? [];
    return [$o['id'], $o['origem'] ?? '', nn($o['osPrimaria'] ?? null), nn($o['idVera'] ?? null), $o['statusOS'] ?? 'Pendente', $o['tipoServico'] ?? '', nn($o['tipoEquipeNecessaria'] ?? null), nn($o['tipoEquipeExec'] ?? null),
        (bool)($o['prioridadeEW'] ?? false), nn($o['equipeId'] ?? null), dt($o['dataAbertura'] ?? null), dt($o['dataExecucao'] ?? null), dt($o['dataPrevista'] ?? null),
        nn($o['alimentador'] ?? null), nn($o['conjunto'] ?? null), nn($o['protecaoId'] ?? null), nn($o['trecho'] ?? null), nn($o['localidade'] ?? null), nn($o['descEsquema'] ?? null), nn($o['observacao'] ?? null),
        pt($l['lat'] ?? null, $l['lng'] ?? null), nn($l['fonte'] ?? null), nn($l['origem'] ?? null), (bool)($l['aproximada'] ?? false),
        num($o['previsto'] ?? 0), num($o['realizado'] ?? 0), num($o['previstoPoda'] ?? 0), num($o['previstoLimpeza'] ?? 0), num($o['previstoEstrutura'] ?? 0), num($o['realizadoPoda'] ?? 0), num($o['realizadoLimpeza'] ?? 0), num($o['realizadoEstrutura'] ?? 0),
        nn($o['posteId'] ?? null), nn($o['posteTipo'] ?? null), nn($o['posteAreaLocal'] ?? null), nn($o['posteConjunto'] ?? null), nn($o['posteMun'] ?? null), pt($o['posteLat'] ?? null, $o['posteLng'] ?? null),
        isset($o['previstoPorEsquema']) ? (bool)$o['previstoPorEsquema'] : null, isset($o['localidadePorPoste']) ? (bool)$o['localidadePorPoste'] : null];
}
echo "OS (base atual)\n";
// em fluxo: o arquivo tem ~100 MB (ver lerJsonItens)
if (parte($pdo, 'manutencao_os.json', 'os'))
copiar($pdo, 'os', $colsOs, (function () use ($model) { foreach (unicoArquivo("$model/manutencao_os.json", fn($x) => $x['id']) as $o) yield linhaOs($o); })(), 'os (base atual)');
echo "OS (historico por plano)\n";
foreach (glob("$model/historico_podas_20*.json") as $arq) {
    if (!preg_match('/historico_podas_(\d{4})\.json$/', $arq, $m)) continue;
    $plano = (int)$m[1];
    $pdo->prepare('DELETE FROM os_historico WHERE plano = ?')->execute([$plano]);   // so o plano que veio
    copiar($pdo, 'os_historico', array_merge($colsOs, ['plano']), (function () use ($arq, $plano) { foreach (unicoArquivo($arq, fn($x) => $x['id']) as $o) yield array_merge(linhaOs($o), [$plano]); })(), "os_historico plano $plano");
}
if (parte($pdo, 'historico_podas_meta.json', 'historico_planos'))
copiar($pdo, 'historico_planos', ['plano','total','inicio','fim','atualizado_em','usuario_id','modo','novas','atualizadas','arquivos'],
  (function () use ($model) { foreach (lerJson("$model/historico_podas_meta.json") ?? [] as $p) yield [$p['plano'], $p['total'], $p['inicio'], $p['fim'], nn($p['atualizadoEm'] ?? null), nn($p['usuarioId'] ?? null), nn($p['modo'] ?? null), $p['novas'] ?? null, $p['atualizadas'] ?? null, nn($p['arquivos'] ?? null)]; })());
if (parte($pdo, 'ajustes_os.json', 'ajustes_os'))
copiar($pdo, 'ajustes_os', ['os_id','alimentador','tipo_equipe','protecao_id','equipe_id','criado_por','criado_em','atualizado_por','atualizado_em'],
  (function () use ($model) { foreach (unico(lerJson("$model/ajustes_os.json") ?? [], fn($x) => $x['id']) as $a) yield [$a['id'], nn($a['alimentador'] ?? null), nn($a['tipoEquipe'] ?? null), nn($a['protecaoId'] ?? null), nn($a['equipeId'] ?? null), nn($a['criadoPor'] ?? null), nn($a['criadoEm'] ?? null), nn($a['atualizadoPor'] ?? null), nn($a['atualizadoEm'] ?? null)]; })());
if (parte($pdo, 'ajustes_os_log.jsonl', 'ajustes_os_log')) copiar($pdo, 'ajustes_os_log', ['momento','usuario_id','os_id','acao','de','para'],
  (function () use ($model) { foreach (file("$model/ajustes_os_log.jsonl", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) { $j = json_decode($ln, true); if ($j) yield [$j['t'], nn($j['u'] ?? null), $j['os'] ?? '', $j['a'] ?? '', $j['de'] ?? null, $j['para'] ?? null]; } })());

// ---------------- programacao ----------------
echo "Programacao\n";
$pg = parte($pdo, 'programacao.json', 'programacoes') ? (lerJson("$model/programacao.json") ?? []) : [];   // equipes/OS/log da programacao caem junto
if ($pg) {
copiar($pdo, 'programacoes', ['id','tipo_programacao','status','data_inicio','data_fim','protecao_id','alimentador','localidade','regional','polo','plano','tipo_plano','equipe_necessaria','desligamento','numero_sis','observacao','origem_tela','previsto_concluir','programador_id','exec_snap','criado_em','atualizado_em'],
  (function () use ($pg) { foreach (unico($pg, fn($x) => uuidDe($x['id'])) as $p) yield [uuidDe($p['id']), $p['tipoProgramacao'] ?? 'Poda', $p['status'], $p['dataInicio'], $p['dataFim'], nn($p['protecaoId'] ?? null), nn($p['alimentador'] ?? null), nn($p['localidade'] ?? null), nn($p['regional'] ?? null), nn($p['polo'] ?? null), nn($p['plano'] ?? null), nn($p['tipoPlano'] ?? null), nn($p['equipeNecessaria'] ?? null), nn($p['desligamento'] ?? null), nn($p['numeroSIS'] ?? null), nn($p['observacao'] ?? null), nn($p['origemTela'] ?? null), (bool)($p['previstoConcluir'] ?? false), nn($p['programadorId'] ?? null), (empty($p['execSnap']) ? null : array_values((array)$p['execSnap'])), $p['criadoEm'], $p['atualizadoEm'] ?? $p['criadoEm']]; })());
copiar($pdo, 'programacao_equipes', ['programacao_id','equipe_id'],
  (function () use ($pg) { $v = []; foreach ($pg as $p) foreach (array_unique($p['equipesIds'] ?? []) as $e) { $k = uuidDe($p['id']) . '|' . $e; if (!isset($v[$k])) { $v[$k] = 1; yield [uuidDe($p['id']), $e]; } } })());
copiar($pdo, 'programacao_os', ['programacao_id','os_id','ordem','snapshot'],
  (function () use ($pg) { $v = []; foreach ($pg as $p) { $snap = []; foreach ($p['osSnap'] ?? [] as $s) $snap[$s['id']] = $s; foreach (array_values($p['osIds'] ?? []) as $i => $oid) { $k = uuidDe($p['id']) . '|' . $oid; if (isset($v[$k])) continue; $v[$k] = 1; yield [uuidDe($p['id']), $oid, $i, $snap[$oid] ?? null]; } } })());
}
unset($pg);
$progIds = array_flip($pdo->query('SELECT id::text FROM programacoes')->fetchAll(PDO::FETCH_COLUMN));
if (parte($pdo, 'programacao_log.jsonl', 'programacao_log')) copiar($pdo, 'programacao_log', ['programacao_id','momento','usuario_id','acao','resumo','ref','mudancas','os_add','os_rem'],
  (function () use ($model, $progIds) { foreach (file("$model/programacao_log.jsonl", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) { $j = json_decode($ln, true); if ($j && !empty($j['p']) && isset($progIds[uuidDe($j['p'])])) yield [uuidDe($j['p']), $j['t'], nn($j['u'] ?? null), $j['a'] ?? '', nn($j['r'] ?? null), nn($j['ref'] ?? null), $j['m'] ?? null, empty($j['add']) ? null : array_values((array)$j['add']), empty($j['rem']) ? null : array_values((array)$j['rem'])]; } })());

// ---------------- rede / protecoes / postes / equipamentos ----------------
echo "Protecoes, vao, VERA\n";
if (parte($pdo, 'protecao.json', 'protecoes') && $pdo->exec('ALTER SEQUENCE protecoes_id_seq RESTART') !== false)
copiar($pdo, 'protecoes', ['protecao_id','prot_elemento','protecao2','alimentador','trecho','trecho_t4','zona','plano_easywork','loc'],
  (function () use ($model) { foreach (lerJsonItens("$model/protecao.json") as $p) yield [$p['protecaoId'], nn($p['protElemento'] ?? null), nn($p['protecao2'] ?? null), nn($p['alimentador'] ?? null), nn($p['trecho'] ?? null), nn($p['trechoT4'] ?? null), nn($p['zona'] ?? null), nn($p['planoEasyWork'] ?? null), pt($p['lat'] ?? null, $p['lng'] ?? null)]; })());
if (parte($pdo, 'protecao_alim.json', 'protecao_alimentador'))
copiar($pdo, 'protecao_alimentador', ['alimentador','protecao_id'],
  (function () use ($model) { $v = []; foreach (lerJson("$model/protecao_alim.json") ?? [] as $x) { $k = $x['a'] . '|' . $x['p']; if (!isset($v[$k])) { $v[$k] = 1; yield [$x['a'], $x['p']]; } } })());
if (parte($pdo, 'vao.json', 'vao'))
copiar($pdo, 'vao', ['protecao_id','polo','regional','postes','rota_km'],
  (function () use ($model) { foreach (unicoArquivo("$model/vao.json", fn($x) => $x['protecaoId']) as $x) yield [$x['protecaoId'], nn($x['polo'] ?? null), nn($x['regional'] ?? null), (int)($x['postes'] ?? 0), $x['rotaKm'] ?? 0]; })());
if (parte($pdo, 'vera.json', 'vera'))
copiar($pdo, 'vera', ['id_vera','especie','cidade','alimentador','loc'],
  (function () use ($model) { foreach (unicoArquivo("$model/vera.json", fn($x) => $x['idVera']) as $x) yield [$x['idVera'], nn($x['especie'] ?? null), nn($x['cidade'] ?? null), nn($x['alimentador'] ?? null), pt($x['lat'] ?? null, $x['lng'] ?? null)]; })());

function tsv(string $arq): Generator { if (!is_file($arq)) return; $h = fopen($arq, 'r'); while (($l = fgets($h)) !== false) { $l = rtrim($l, "\r\n"); if ($l !== '') yield explode("\t", $l); } fclose($h); }
echo "Postes, vao_postes e equipamentos\n";
if (parte($pdo, 'vao_postes.tsv', 'vao_postes')) copiar($pdo, 'vao_postes', ['poste_id','rota_km'], (function () use ($model) { $v = []; foreach (tsv("$model/vao_postes.tsv") as $c) { if (isset($v[$c[0]])) continue; $v[$c[0]] = 1; yield [$c[0], $c[1]]; } })());
if (parte($pdo, 'postes.tsv', 'postes'))
copiar($pdo, 'postes', ['cod_id','tipo','area_local','conjunto','loc','municipio'],
  (function () use ($model) { $v = []; foreach (tsv("$model/postes.tsv") as $c) { if (isset($v[$c[0]])) continue; $p = pt($c[4] ?? null, $c[5] ?? null); if ($p === null) continue; $v[$c[0]] = 1; yield [$c[0], nn($c[1]), nn($c[2]), nn($c[3]), $p, nn($c[6] ?? null)]; } })());
foreach (['trafos', 'protecoes', 'capacitores', 'reguladores'] as $camada) {
    if (!tem("equip_$camada.tsv")) { $pulados[] = "equip_$camada.tsv"; continue; }
    $pdo->prepare('DELETE FROM equipamentos WHERE camada = ?')->execute([$camada]);
    $nomes = [];
    foreach (tsv("$model/equip_nomes_$camada.tsv") as $c) $nomes[$c[0]] = [nn($c[1] ?? null), nn($c[2] ?? null)];   // Name, Alias
    if (tem("equip_nomes_$camada.tsv")) {
        $pdo->prepare('DELETE FROM equip_nomes WHERE camada = ?')->execute([$camada]);
        copiar($pdo, 'equip_nomes', ['camada','cod_id','nome','alias'], (function () use ($nomes, $camada) { foreach ($nomes as $id => [$n, $a]) yield [$camada, (string)$id, $n, $a]; })(), "equip_nomes $camada");
    }
    copiar($pdo, 'equipamentos', ['camada','cod_id','poste','loc','ctmt','conj','v0','v1','v2','v3','v4','nome_operativo'],
      (function () use ($model, $camada, $nomes) { $v = []; foreach (tsv("$model/equip_$camada.tsv") as $c) { if (isset($v[$c[0]])) continue; $v[$c[0]] = 1; yield [$camada, $c[0], nn($c[1]), pt($c[2] ?? null, $c[3] ?? null), nn($c[4] ?? null), nn($c[5] ?? null), nn($c[6] ?? null), nn($c[7] ?? null), nn($c[8] ?? null), nn($c[9] ?? null), nn($c[10] ?? null), isset($nomes[$c[0]]) ? ($nomes[$c[0]][0] ?? $nomes[$c[0]][1]) : null]; } })(), "equipamentos $camada");
}

// ---------------- rank e nix ----------------
echo "Rank e Nix\n";
$rl = parte($pdo, 'rank_listas.json', 'rank_listas') ? (lerJson("$model/rank_listas.json") ?? []) : [];   // itens caem junto
if (tem('rank_listas.json')) copiar($pdo, 'rank_listas', ['id','enviado_em','enviado_por','enviado_por_nome','arquivo','aba','referencia','origem','autor_arquivo','criado_arquivo_em','modificado_arquivo_em','hash','linhas','com_data','rejeitadas'],
  (function () use ($rl) { foreach ($rl as $r) yield [$r['id'], nn($r['enviadoEm'] ?? null), nn($r['enviadoPor'] ?? null), nn($r['enviadoPorNome'] ?? null), nn($r['arquivo'] ?? null), nn($r['aba'] ?? null), nn($r['referencia'] ?? null), nn($r['origem'] ?? null), nn($r['autorArquivo'] ?? null), nn($r['criadoArquivoEm'] ?? null), nn($r['modificadoArquivoEm'] ?? null), nn($r['hash'] ?? null), $r['linhas'] ?? null, $r['comData'] ?? null, $r['rejeitadas'] ?? null]; })());
foreach ($rl as $r) {
    $it = lerJson("$model/rank_itens_{$r['id']}.json") ?? [];
    copiar($pdo, 'rank_itens', ['lista_id','posicao','elemento','dec','trecho','alim','reg','polo','conj','plano','di','df'],
      (function () use ($it, $r) { $v = []; foreach ($it as $x) { if (isset($v[$x['r']])) continue; $v[$x['r']] = 1; yield [$r['id'], $x['r'], $x['e'], $x['dec'] ?? null, nn($x['trecho'] ?? null), nn($x['alim'] ?? null), nn($x['reg'] ?? null), nn($x['polo'] ?? null), nn($x['conj'] ?? null), nn($x['plano'] ?? null), dt($x['di'] ?? null), dt($x['df'] ?? null)]; } })(), "rank_itens {$r['id']}");
}
$nx = parte($pdo, 'nix.json', 'nix') ? (lerJson("$model/nix.json") ?? []) : [];   // pontos caem junto
if (tem('nix.json')) {
copiar($pdo, 'nix', ['id','elemento','ranque','trecho','alim','reg','conj','tensao','dh','ppf','manual','criado_por','criado_em'],
  (function () use ($nx) { foreach ($nx as $i => $n) yield [$n['id'] ?? ('nx-i' . $i), $n['e'], nn($n['ranque'] ?? null), nn($n['trecho'] ?? null), nn($n['alim'] ?? null), nn($n['reg'] ?? null), nn($n['conj'] ?? null), nn($n['tensao'] ?? null), nn($n['dh'] ?? null), nn($n['ppf'] ?? null), (bool)($n['manual'] ?? false), nn($n['criadoPor'] ?? null), nn($n['criadoEm'] ?? null)]; })());
copiar($pdo, 'nix_pontos', ['nix_id','ordem','loc'],
  (function () use ($nx) { foreach ($nx as $i => $n) foreach (array_values($n['pontos'] ?? []) as $k => $p) { $g = pt($p['lat'] ?? null, $p['lng'] ?? null); if ($g) yield [$n['id'] ?? ('nx-i' . $i), $k, $g]; } })());
}

// ---------------- v3.16.2 - trabalho dos usuarios que antes ficava de fora ----------------
echo "Alertas tratados, exclusoes e arquivos sem tabela propria\n";
$idPorNome = [];
foreach ($pdo->query('SELECT id, nome FROM usuarios') as $u) if (!empty($u['nome'])) $idPorNome[mb_strtolower(trim($u['nome']))] = $u['id'];   // usuarios do banco (podem nao ter vindo agora)
if (parte($pdo, 'alertas_tratados.json', 'alertas_tratados'))
copiar($pdo, 'alertas_tratados', ['tipo','chave','status','usuario_id','atualizado_em'],
  (function () use ($model, $idPorNome) { foreach (unico(lerJson("$model/alertas_tratados.json") ?? [], fn($x) => ($x['tipo'] ?? '') . '|' . ($x['chave'] ?? '')) as $a) {
      if (empty($a['tipo']) || !isset($a['chave']) || empty($a['status'])) continue;
      yield [$a['tipo'], (string)$a['chave'], $a['status'], $idPorNome[mb_strtolower(trim((string)($a['por'] ?? '')))] ?? null, nn($a['em'] ?? null) ?? date('c')];
  } })());
if (parte($pdo, 'exclusoes.json', 'exclusoes'))
copiar($pdo, 'exclusoes', ['base','chave','em','por'],
  (function () use ($model) { foreach (unico(lerJson("$model/exclusoes.json") ?? [], fn($x) => ($x['base'] ?? '') . '|' . ($x['chave'] ?? '')) as $e) {
      if (empty($e['base']) || !isset($e['chave'])) continue;
      yield [$e['base'], (string)$e['chave'], nn($e['em'] ?? null), nn($e['por'] ?? null)];
  } })());
// v3.33 - regras de importacao editaveis (e o historico delas)
if (parte($pdo, 'regras.json', 'regras')) {
    copiar($pdo, 'regras', ['id','ordem','dados'], (function () use ($model) { $v = []; foreach (lerJson("$model/regras.json") ?? [] as $r) { if (empty($r['id']) || isset($v[$r['id']])) continue; $v[$r['id']] = 1; yield [$r['id'], (int)($r['ordem'] ?? 0), $r]; } })());
    $pdo->exec("INSERT INTO configuracoes (chave, valor) VALUES ('regras_semeadas', 'true') ON CONFLICT (chave) DO NOTHING");
}
if (parte($pdo, 'regras_historico.json', 'regras_historico'))
copiar($pdo, 'regras_historico', ['em','usuario','regra_id','nome','acao','antes','depois'],
  (function () use ($model) { foreach (lerJson("$model/regras_historico.json") ?? [] as $h) yield [nn($h['em'] ?? null) ?? date('c'), nn($h['usuario'] ?? null), nn($h['regraId'] ?? null), nn($h['nome'] ?? null), nn($h['acao'] ?? null), $h['antes'] ?? null, $h['depois'] ?? null]; })());
// Rede de seguranca: todo .json que este script NAO leu acima vai inteiro para legado_bruto (nada se perde).
$lidos = ['ajuda_faq','ajustes_os','ajustes_os_log','alertas_config','alertas_tratados','alimentador_polo','app_rl_config','conjuntos','equipes','esquemas',
  'exclusoes','feriados','historico_podas_meta','importacoes_log','indisponibilidades','justificativas','listas_cadastro','manutencao_os','metas','nix','nix_meta',
  'permissoes','prefeituras_config','prioridade_ew','programacao','programacao_log','protecao','protecao_alim','rank_listas','solicitacoes_cadastro','usuarios','vao','vera','regras','regras_historico'];
$brutoSt = $pdo->prepare('INSERT INTO legado_bruto (entidade, dados) VALUES (?, ?::jsonb) ON CONFLICT (entidade) DO UPDATE SET dados = EXCLUDED.dados, importado_em = now()');   // so a entidade que veio
$nBruto = 0;
foreach (glob("$model/*.json") ?: [] as $arq) {
    $ent = basename($arq, '.json');
    if (in_array($ent, $lidos, true) || preg_match('/^(rank_itens_|historico_podas_|equip_)/', $ent)) continue;
    if ($ent === 'app_rl_indice') continue;   // indice calculado (POST /apprl/recalcular refaz)
    $dados = lerJson($arq);
    if ($dados === null) { echo "  AVISO: $ent.json nao e um JSON valido; ignorado\n"; continue; }
    $brutoSt->execute([$ent, json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
    printf("  %-28s guardado em legado_bruto (%d registros)\n", $ent, is_array($dados) ? count($dados) : 1);
    $nBruto++;
}
// logs .jsonl que nao tem tabela propria (nix_log, rank_log...): guardados como lista
foreach (glob("$model/*.jsonl") ?: [] as $arq) {
    $ent = basename($arq, '.jsonl');
    if (in_array($ent, ['programacao_log', 'ajustes_os_log'], true)) continue;   // ja migrados acima
    $linhas = [];
    foreach (file($arq, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) { $j = json_decode($ln, true); if ($j !== null) $linhas[] = $j; }
    $brutoSt->execute([$ent, json_encode($linhas, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
    printf("  %-28s guardado em legado_bruto (%d linhas de log)
", $ent, count($linhas));
    $nBruto++;
}
echo "  $nBruto arquivo(s) sem tabela propria guardados intactos em legado_bruto\n";

if ($pulados) echo "\nMantidos como estavam (arquivo nao veio): " . implode(', ', $pulados) . "\n";
$pdo->commit();
echo "\nVACUUM ANALYZE...\n";
$pdo->exec('VACUUM ANALYZE');   // fora da transacao (o Postgres nao deixa dentro)
echo "Concluido.\n";
