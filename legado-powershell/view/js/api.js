/* =========================================================================
   SPARK — camada de integração com o Controller (PowerShell)

   O front-end (app.js) foi construído como um protótipo navegável, com todos
   os dados em memória (const state) — exatamente a mesma estrutura definida
   no Detalhamento Técnico. Este arquivo faz a ponte com o Controller real:

   1. No carregamento da página, tenta um health-check no Controller
      (http://localhost:8787/api/health, ajustável — ver API_BASE).
   2. Se o Controller estiver no ar, busca os dados reais de cada módulo e
      substitui o conteúdo de `state` por eles antes do primeiro render().
   3. Se o Controller NÃO estiver no ar (arquivo aberto direto via file://,
      ou iniciar.bat não executado), o sistema continua funcionando com os
      dados de exemplo já embutidos em app.js — exatamente como no
      protótipo original. Nada quebra por causa deste arquivo.
   4. As ações de escrita (salvar meta, programação, justificativa, liberar
      usuário, etc.) continuam atualizando `state` localmente na hora (UI
      responsiva, sem esperar rede) e, em paralelo, tentam gravar no
      Controller quando ele está disponível — ver as chamadas
      "syncApi(...)" espalhadas pelo app.js, logo após cada mutação local.
      Se a chamada falhar (Controller fora do ar), a mudança fica só local
      e um aviso discreto aparece — sem travar a tela.
   ========================================================================= */

const API_BASE = (window.SPARK_API_BASE || (location.origin.startsWith("http") ? location.origin : "http://localhost:8787")) + "/api";
/* 30s: era 2s, o suficiente enquanto o Mapa de Manutenção só tinha os 8
   registros de exemplo — mas com a base real de Podas importada (a
   Pendente sozinha já tem ~21 mil OS), listar /manutencao/os inteiro não
   cabia em 2s, e o front-end desistia e caía pro modo de exemplo mesmo com
   o Controller respondendo normalmente (só mais devagar). Corrigimos
   também a lentidão em si no Controller (JsonStore.ps1 tinha um gargalo
   O(n²) sério), mas o número aqui ficou generoso de propósito: o teste foi
   feito em PowerShell 7, e o Windows PowerShell 5.1 real (produção) pode
   ler/serializar JSON grande num ritmo diferente — 30s é uma folga segura
   sem deixar a tela esperando de verdade num uso normal. O health-check
   usa um timeout próprio, bem mais curto (ver checkApiHealth), porque essa
   chamada continua precisando ser rápida pra detectar "Controller offline"
   sem prender a tela. */
const API_TIMEOUT_MS = 30000;
const API_TIMEOUT_HEALTH_MS = 3000;

let API_ONLINE = false;
let API_BACKEND = "powershell";   // v3.16.1 - "laravel" quando o front e servido pelo sistema novo

/* ---------------- sessão / login ----------------
   Token opaco guardado no localStorage (sobrevive a um F5, mas não a um
   reinício do Controller — a sessão em si só existe na memória do processo
   PowerShell, ver Auth.ps1). currentUser guarda o {id,nome,email,
   perfilBase} de quem está logado, devolvido por /auth/login ou /auth/me. */
const AUTH_TOKEN_KEY = "spark_auth_token";
let currentUser = null;

function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch (e) { return null; }
}
function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) { /* localStorage indisponível (ex.: modo privado) — segue só em memória */ }
}

function apiFetch(path, options = {}) {
  const ctrl = new AbortController();
  const timeoutMs = options.timeoutMs || API_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const token = getAuthToken();
  return fetch(API_BASE + path, {
    ...options,
    signal: ctrl.signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": "Bearer " + token } : {}),
      ...(options.headers || {}),
    },
  }).finally(() => clearTimeout(timer));
}

/* Uma resposta 401 em QUALQUER chamada (fora do login em si) significa que
   a sessão caducou ou o Controller foi reiniciado — a linha abaixo devolve
   pra tela de login de forma central, sem cada chamador precisar tratar
   isso na mão. onSessaoExpirada() é definida em app.js. */
function tratar401SeForCaso(res, path) {
  if (res.status === 401 && path !== "/auth/login") {
    setAuthToken(null);
    currentUser = null;
    if (typeof onSessaoExpirada === "function") onSessaoExpirada();
  }
}

async function apiGet(path, timeoutMs) {
  const res = await apiFetch(path, timeoutMs ? { timeoutMs } : {});
  tratar401SeForCaso(res, path);
  if (!res.ok) {
    // v3.16.9 - mostra o motivo que o servidor mandou (ex.: "ainda nao foi migrada para o sistema novo") em vez de so o codigo
    let detalhe = "";
    try { detalhe = (await res.json()).erro || ""; } catch (e) { /* corpo nao era JSON */ }
    const erro = new Error(detalhe ? detalhe : `GET ${path} -> ${res.status}`);
    erro.status = res.status;
    throw erro;
  }
  return res.json();
}

/* Igual a apiGet, mas devolve o TEXTO da resposta sem desserializar (v2.12.0 —
   usado pelo cache de camadas do mapa, mapacache.js: guardar o texto ocupa
   bem menos memória que centenas de milhares de objetos de trecho, e só é
   desserializado quando o alimentador é de fato desenhado). */
async function apiGetTexto(path, timeoutMs) {
  const res = await apiFetch(path, timeoutMs ? { timeoutMs } : {});
  tratar401SeForCaso(res, path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.text();
}

/* Avisa o cache do mapa (mapacache.js) que algo foi gravado no Controller —
   ele decide se precisa descartar e recarregar alguma camada. */
function avisarMutacaoApi(path) {
  if (typeof onMutacaoApi === "function") { try { onMutacaoApi(path); } catch (e) { /* nunca quebra a chamada original */ } }
}

async function apiSend(method, path, body, timeoutMs) {
  const res = await apiFetch(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined, ...(timeoutMs ? { timeoutMs } : {}) });
  tratar401SeForCaso(res, path);
  if (!res.ok) {
    let detalhe = "";
    try { detalhe = (await res.json()).erro || ""; } catch (e) { /* corpo não era JSON */ }
    throw new Error(`${method} ${path} -> ${res.status}${detalhe ? " (" + detalhe + ")" : ""}`);
  }
  const text = await res.text();
  if (method !== "GET") avisarMutacaoApi(path);
  return text ? JSON.parse(text) : null;
}

const apiPost = (path, body, timeoutMs) => apiSend("POST", path, body, timeoutMs);
const apiPut = (path, body, timeoutMs) => apiSend("PUT", path, body, timeoutMs);
const apiPatch = (path, body, timeoutMs) => apiSend("PATCH", path, body, timeoutMs);
const apiDelete = (path, timeoutMs) => apiSend("DELETE", path, undefined, timeoutMs);

/* Upload de arquivo (multipart/form-data) — usado pela importação de
   shapefile de rede. Sem Content-Type explícito: o navegador define
   "multipart/form-data; boundary=..." sozinho ao montar o FormData; setar
   na mão quebra o boundary. Timeout bem maior que o das chamadas normais
   porque um shapefile grande pode levar bastante tempo pra ler e gravar. */
const API_UPLOAD_TIMEOUT_MS = 180000;
async function apiUploadFormData(path, formData, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || API_UPLOAD_TIMEOUT_MS);
  try {
    const token = getAuthToken();
    const res = await fetch(API_BASE + path, {
      method: "POST", body: formData, signal: ctrl.signal,
      headers: token ? { "Authorization": "Bearer " + token } : {},
    });
    tratar401SeForCaso(res, path);
    if (!res.ok) {
      let detalhe = "";
      try { detalhe = (await res.json()).erro || ""; } catch (e) { /* corpo não era JSON */ }
      throw new Error(`POST ${path} -> ${res.status}${detalhe ? " (" + detalhe + ")" : ""}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

/* Upload em streaming (usado pela importação de Podas — Executado/
   Pendente). Em vez de esperar uma resposta JSON única no final, o
   Controller vai escrevendo uma linha JSON por atualização (NDJSON) na
   MESMA resposta HTTP conforme o arquivo é lido — necessário porque o
   Controller atende um pedido por vez (não daria pra "perguntar" o
   progresso numa rota separada enquanto esta chamada estivesse em
   andamento, a pergunta ficaria na fila). Cada linha intermediária vira
   uma chamada a onProgresso(); a última linha ({tipo:"final"}) é o valor
   de retorno da Promise.

   Timeout "de trava" (não de duração total): reinicia a cada linha
   recebida, então um arquivo de 60MB que demora minutos não estoura nada
   — só aborta se o Controller ficar mais de stallTimeoutMs em silêncio
   (sinal real de que travou, não só "é grande"). */
async function apiUploadFormDataStream(path, formData, onProgresso, stallTimeoutMs) {
  const stallMs = stallTimeoutMs || 120000;
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), stallMs);
  const resetTimer = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), stallMs); };
  // v2.13.0 - enquanto um upload roda, a pré-carga do mapa (mapacache.js) fica
  // em pausa: o Controller atende um pedido por vez, e a pré-carga disputando
  // com os lotes de KMZ/importações grandes estourava o prazo do upload
  // ("a reserva legal parou no meio").
  if (typeof mapaCacheSuspender === "function") mapaCacheSuspender();
  try {
    const token = getAuthToken();
    const res = await fetch(API_BASE + path, {
      method: "POST", body: formData, signal: ctrl.signal,
      headers: token ? { "Authorization": "Bearer " + token } : {},
    });
    tratar401SeForCaso(res, path);
    if (!res.ok) {
      let detalhe = "";
      try { detalhe = (await res.json()).erro || ""; } catch (e) { /* corpo não era JSON */ }
      throw new Error(`POST ${path} -> ${res.status}${detalhe ? " (" + detalhe + ")" : ""}`);
    }

    const processarLinha = (linha, resultadoFinalRef) => {
      if (!linha.trim()) return;
      const dados = JSON.parse(linha);
      if (dados.tipo === "final") { resultadoFinalRef.valor = dados; }
      else if (dados.tipo === "erro") { throw new Error(dados.mensagem || "Erro ao processar as planilhas."); }
      else if (typeof onProgresso === "function") { onProgresso(dados); }
    };

    if (!res.body || !res.body.getReader) {
      // navegador sem suporte a leitura em stream do corpo da resposta —
      // volta pro comportamento antigo (espera tudo, sem barra em tempo
      // real, mas continua funcionando).
      const texto = await res.text();
      const resultadoFinalRef = { valor: null };
      for (const linha of texto.split("\n")) { processarLinha(linha, resultadoFinalRef); }
      if (!resultadoFinalRef.valor) throw new Error("Resposta incompleta do Controller.");
      return resultadoFinalRef.valor;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const resultadoFinalRef = { valor: null };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        processarLinha(linha, resultadoFinalRef);
      }
    }
    if (buffer.trim()) { processarLinha(buffer, resultadoFinalRef); }
    if (!resultadoFinalRef.valor) throw new Error("A conexão foi encerrada antes do Controller terminar — tente de novo.");
    avisarMutacaoApi(path);
    return resultadoFinalRef.valor;
  } finally {
    clearTimeout(timer);
    if (typeof mapaCacheRetomarSuspensao === "function") mapaCacheRetomarSuspensao();
  }
}

/* GET em streaming (NDJSON) — usado por "Todos os alimentadores" no Mapa de
   Manutenção (ver Invoke-RedeMtTodosStream no Controller). Mesma lógica de
   apiUploadFormDataStream acima (timeout "de trava", reinicia a cada linha
   recebida), só que sem FormData no corpo — existe porque antes disso o
   front-end fazia um GET por alimentador em PARALELO (até 335 de uma vez
   num caso real), o que sozinho já sobrecarregava o Controller
   single-threaded e derrubava a conexão de quem ficasse esperando demais
   na fila ("Failed to fetch"/"network name no longer available"). Uma
   conexão só, indo aos poucos, evita esse fan-out inteiro. */
async function apiGetStream(path, onProgresso, stallTimeoutMs) {
  const stallMs = stallTimeoutMs || 120000;
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), stallMs);
  const resetTimer = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), stallMs); };
  try {
    const token = getAuthToken();
    const res = await fetch(API_BASE + path, {
      method: "GET", signal: ctrl.signal,
      headers: token ? { "Authorization": "Bearer " + token } : {},
    });
    tratar401SeForCaso(res, path);
    if (!res.ok) {
      let detalhe = "";
      try { detalhe = (await res.json()).erro || ""; } catch (e) { /* corpo não era JSON */ }
      throw new Error(`GET ${path} -> ${res.status}${detalhe ? " (" + detalhe + ")" : ""}`);
    }

    const processarLinha = (linha, resultadoFinalRef) => {
      if (!linha.trim()) return;
      const dados = JSON.parse(linha);
      if (dados.tipo === "final") { resultadoFinalRef.valor = dados; }
      else if (dados.tipo === "erro") { throw new Error(dados.mensagem || "Erro ao carregar."); }
      else if (typeof onProgresso === "function") { onProgresso(dados); }
    };

    if (!res.body || !res.body.getReader) {
      const texto = await res.text();
      const resultadoFinalRef = { valor: null };
      for (const linha of texto.split("\n")) { processarLinha(linha, resultadoFinalRef); }
      if (!resultadoFinalRef.valor) throw new Error("Resposta incompleta do Controller.");
      return resultadoFinalRef.valor;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const resultadoFinalRef = { valor: null };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        processarLinha(linha, resultadoFinalRef);
      }
    }
    if (buffer.trim()) { processarLinha(buffer, resultadoFinalRef); }
    if (!resultadoFinalRef.valor) throw new Error("A conexão foi encerrada antes do Controller terminar — tente de novo.");
    return resultadoFinalRef.valor;
  } finally {
    clearTimeout(timer);
  }
}

/* Chamada "dispare e esqueça": tenta sincronizar com o Controller, mas
   nunca trava nem quebra a interação do usuário — a mudança já está
   visível localmente antes desta chamada ser feita. Usada logo após cada
   mutação de state.* nas funções salvarX/cancelarX/liberarX do app.js. */
function syncApi(method, path, body) {
  if (!API_ONLINE) return;
  apiSend(method, path, body).catch(err => {
    console.warn("[SPARK] Falha ao sincronizar com o Controller:", err.message);
    toast("Alterado localmente — não foi possível salvar no Controller agora.");
  });
}

async function checkApiHealth() {
  try {
    const h = await apiGet("/health", API_TIMEOUT_HEALTH_MS);
    API_ONLINE = true;
    // v3.16.1 - "laravel" no sistema novo; o PowerShell nao manda o campo
    API_BACKEND = (h && h.backend) || "powershell";
  } catch (e) {
    API_ONLINE = false;
  }
  return API_ONLINE;
}

/* Vários módulos (Manutenção, Metas, Justificativas, Programação,
   Prefeituras) só respondem 200 pra quem tem "visualizar" liberado nesse
   módulo — por perfil-padrão (Get-PerfilModelo) ou por matriz individual
   ajustada pelo administrador (Usuários & Permissões). Isso é intencional
   e correto no Controller: um Supervisor de Equipe, por exemplo, não tem
   "visualizar" em Prefeituras por padrão, e a rota devolve 403.

   O problema era que loadStateFromApi() (abaixo) buscava TODOS os módulos
   de uma vez, pro `state` inteiro, sem checar permissão antes — um 403 em
   QUALQUER um deles rejeitava o Promise.all inteiro. Como isso acontece
   LOGO DEPOIS do login (que já tinha dado certo), a tela de login mostrava
   "Não consegui entrar — tente de novo" mesmo com a senha certa: o erro de
   verdade era 403 num módulo restrito, não uma credencial inválida — mas
   pra quem tá testando login, os dois pareciam a mesma coisa ("não
   consegui entrar"). Isso derrubava o login de QUALQUER perfil que não
   tivesse "visualizar" em pelo menos um desses módulos (ex.: Supervisor de
   Equipe sem Prefeituras).

   Fix: um 403 num módulo opcional vira lista vazia aqui, em vez de derrubar
   o boot inteiro — o usuário consegue entrar e usar o que tem permissão de
   ver; só a tela do módulo negado fica sem dado (que é o comportamento
   esperado pra quem não tem acesso àquilo mesmo). Qualquer outro erro
   (rede, 500, etc.) continua sendo relançado normalmente. */
function apiGetOuVazio(path, valorPadrao, timeoutMs) {
  return apiGet(path, timeoutMs).catch(err => {
    if (err.status === 403 || /->\s*403\b/.test(err.message)) {
      console.warn(`[SPARK] Sem permissão para ${path} (403) — seguindo com valor vazio.`, err.message);
      return valorPadrao;
    }
    throw err;
  });
}

/* Busca os dados reais do Controller e substitui o conteúdo de `state`,
   preservando exatamente os nomes de campo já usados pelas telas
   (mantém compatibilidade com todo o app.js sem precisar reescrevê-lo). */
/* v3.0.7 - converte o registro do Controller (manutencao_os.json) no objeto usado pela tela; também usado nas cópias (osSnap) guardadas nas programações */
function mapOsRaw(o){
  return aplicarAjusteOS({
    id: o.id, origem: (o.origem === "GRID" ? "SGM" : o.origem) || "", statusOS: o.statusOS || "Pendente", tipoServico: o.tipoServico || "—",
    tipoEquipeNecessaria: o.tipoEquipeNecessaria || "", tipoEquipeExec: o.tipoEquipeExec || "", trecho: o.trecho || "", osPrimaria: o.osPrimaria || null, posteId: o.posteId || "", idVera: o.idVera || "", posteTipo: o.posteTipo || "", posteAreaLocal: o.posteAreaLocal || "", posteConjunto: o.posteConjunto || "", posteLat: (o.posteLat != null ? o.posteLat : null), posteLng: (o.posteLng != null ? o.posteLng : null), equipeId: o.equipeId || null, prioridadeEW: !!o.prioridadeEW,
    dataAbertura: (o.dataAbertura || "").slice(0, 10), dataExecucao: o.dataExecucao ? o.dataExecucao.slice(0, 10) : null,
    alimentador: o.alimentador || "", conjunto: o.conjunto || "", protecaoId: o.protecaoId || "",
    localidade: o.localidade || o.conjunto || "",
    lat: o.localizacao ? o.localizacao.lat : null, lng: o.localizacao ? o.localizacao.lng : null,
    fonte: o.localizacao ? o.localizacao.fonte : null,
    // v2.13.19 - OS sem coordenada no SGM: posição aproximada (centro da cidade/setor)
    aprox: !!(o.localizacao && o.localizacao.aproximada),
    // v2.14.3 - de onde veio a posicao: VERA > XY > POSTE > CIDADE
    origemPos: (o.localizacao && o.localizacao.origem) || "",
    // previsto/realizado vieram no lugar do antigo "upe" (ver PodasImporter.ps1 —
    // Previsto/Realizado calculados de verdade a partir da MO_PENDENTE/MO_EXECUTADA);
    // essa linha estava parada no campo velho, então o Controller real nunca
    // mandava esses dois números pro mapa/tabela/Programação — só o protótipo
    // offline (com dados de exemplo já no formato novo) mostrava certo.
    previsto: (typeof o.previsto === "number") ? o.previsto : 0,
    realizado: (typeof o.realizado === "number") ? o.realizado : 0,
    // v2.13.5 - quantidades por tipo (soma da MO, como o BI); null = base antiga
    previstoPoda: (typeof o.previstoPoda === "number") ? o.previstoPoda : null,
    previstoLimpeza: (typeof o.previstoLimpeza === "number") ? o.previstoLimpeza : null,
    previstoEstrutura: (typeof o.previstoEstrutura === "number") ? o.previstoEstrutura : null,
    realizadoPoda: (typeof o.realizadoPoda === "number") ? o.realizadoPoda : null,
    realizadoLimpeza: (typeof o.realizadoLimpeza === "number") ? o.realizadoLimpeza : null,
    realizadoEstrutura: (typeof o.realizadoEstrutura === "number") ? o.realizadoEstrutura : null,
    observacao: o.observacao || "",
    numObra: o.numObra || "", recursoMo: o.recursoMo || "",   // v3.22.0 - Num. Obra (grids) e DE-PARA RECURSOS.MO 1 (MO)
    prioridade: o.prioridade || "",     // v3.21.0 - criticidade no SGM (ALTA, URGENTE, EMERGENCIAL...)
    descEsquema: o.descEsquema || "",   // v3.10.5 - descrição do esquema (SGM); antes ia em "observacao"
    previstoPorEsquema: !!o.previstoPorEsquema,
    statusBase: o.statusBase || null,
  });
}

/* v3.5.0 - "Ajuste de OS" (Gestão de Bases): tipo de equipe, equipe executora, alimentador e proteção informados à mão
   valem MAIS que o original do SGM/SIGOD (e sobrevivem a novas cargas). Aplicado aqui, no ponto único que monta a OS —
   tanto as OS da base quanto as cópias guardadas nas programações. _orig guarda o valor original (para remover o ajuste). */
function ajusteDaOS(id){
  const m = state.ajustesMap;
  return (m && id != null) ? (m.get(String(id).trim().toUpperCase()) || null) : null;
}
function aplicarAjusteOS(x){
  const a = ajusteDaOS(x.id);
  if (!a) return x;
  x._ajuste = true;
  x._orig = { tipoEquipeExec: x.tipoEquipeExec, tipoEquipeNecessaria: x.tipoEquipeNecessaria, equipeId: x.equipeId, alimentador: x.alimentador, protecaoId: x.protecaoId };
  if (a.tipoEquipe) { x.tipoEquipeExec = a.tipoEquipe; x.tipoEquipeNecessaria = a.tipoEquipe; }
  if (a.equipeId) x.equipeId = a.equipeId;
  if (a.alimentador) x.alimentador = a.alimentador;
  if (a.protecaoId) x.protecaoId = a.protecaoId;
  return x;
}
function reconstruirAjustesMap(lista){
  state.ajustesOS = lista || [];
  state.ajustesMap = new Map();
  state.ajustesOS.forEach(a => { if (a && a.id != null) state.ajustesMap.set(String(a.id).trim().toUpperCase(), a); });
}
/* depois de salvar/remover um ajuste na tela: refaz só as OS afetadas (sem recarregar as ~100 mil) */
function reaplicarAjusteNaOS(id){
  const k = String(id).trim().toUpperCase();
  const refaz = x => {
    if (!x || String(x.id).trim().toUpperCase() !== k) return;
    if (x._orig) { Object.assign(x, x._orig); delete x._orig; delete x._ajuste; }
    aplicarAjusteOS(x);
  };
  (state.manutencaoOS || []).forEach(refaz);
  if (state.osSnapMap) { const x = state.osSnapMap.get(String(id)); if (x) refaz(x); state.osSnapMap.forEach(refaz); }
  if (state.execSnapMap) state.execSnapMap.forEach(l => (l || []).forEach(refaz));
}

/* v3.0.7 - cópias das OS guardadas DENTRO de cada programação (osSnap = OS programadas; execSnap = executadas filhas).
   A tela as usa quando a OS não está mais na base (a grid foi reimportada). */
function reconstruirSnapMaps(){
  state.osSnapMap = new Map();
  state.execSnapMap = new Map();
  (state.programacoes || []).forEach(p => {
    (p.osSnap || []).forEach(r => { if (r && r.id != null && !state.osSnapMap.has(String(r.id))) { const x = mapOsRaw(r); x._snap = true; state.osSnapMap.set(String(r.id), x); } });
    (p.execSnap || []).forEach(r => {
      if (!r || r.id == null || !r.osPrimaria) return;
      const k = String(r.osPrimaria).trim();
      let l = state.execSnapMap.get(k); if (!l) { l = []; state.execSnapMap.set(k, l); }
      if (!l.some(y => String(y.id) === String(r.id))) { const x = mapOsRaw(r); x._snap = true; l.push(x); }
    });
  });
}

async function loadStateFromApi() {
  const usuariosResp = await apiGet("/usuarios");
  const [equipes, _osAdiado, metas, justificativas, programacoes, usuarios, permissoesResp, feriados, prefeituras, importLog, logEquipes, logProgramacoes, logOS, logVinculos, localidadesMapa, listas, solicitacoes, indisponibilidades] = await Promise.all([
    apiGet("/equipes"),
    Promise.resolve(null),   // OS: pedida logo abaixo, sozinha e com timeout longo
    apiGetOuVazio("/metas", []),
    apiGetOuVazio("/justificativas", []),
    apiGetOuVazio("/programacao", []),
    Promise.resolve(usuariosResp),
    Promise.all(usuariosResp.map(u => apiGet(`/permissoes/${u.id}`))),
    apiGet("/feriados"),
    apiGetOuVazio("/prefeituras", []),
    apiGet("/importacao/log"),
    apiGetOuVazio("/logistica/equipes", []),
    apiGetOuVazio("/logistica/programacoes", []),
    apiGetOuVazio("/logistica/os", []),
    apiGetOuVazio("/logistica/vinculos", { vinculos: {}, estatisticas: {} }),
    // alimentador -> município -> polo/regional (D_Localidade), pro filtro
    // Polo/Regional do Mapa de Manutenção (ver Get-MapaAlimentadorMunicipio/
    // Get-MapaMunicipioLocalidade, Geografia.ps1).
    apiGetOuVazio("/manutencao/localidades-mapa", { porAlimentador: {}, porMunicipio: {} }),
    // v2.13.0 - listas cadastráveis (Plano, Equipe necessária, tipos de justificativa)
    apiGetOuVazio("/listas", null),
    // v2.13.0 - pedidos de cadastro (só quem edita Usuários recebe; senão vem vazio)
    apiGetOuVazio("/usuarios/solicitacoes", []),
    // v2.14.1 - indisponibilidade de equipes (aviso na programacao + meta)
    apiGetOuVazio("/indisponibilidades", []),
  ]);
  // v2.13.15: as ~50 mil OS vao POR ULTIMO e com timeout de 5 min. O Controller
  // atende um pedido por vez; pedidas junto com as outras listas, elas deixavam
  // os demais pedidos na fila ate estourar os 30 s ("Login ok, mas nao consegui
  // carregar o sistema").
  reconstruirAjustesMap(await apiGetOuVazio("/ajustes", []));   // v3.5.0 - antes de montar as OS
  const os = await apiGetOuVazio("/manutencao/os", [], 300000);
  state.conjuntos = await apiGetOuVazio("/cadastros/conjuntos/mapa", []);   // v3.2.1 - alimentador -> conjunto
  state.solicitacoes = solicitacoes || [];
  if (listas && typeof listas === "object") state.listas = listas;

  state.equipes = equipes;
  state.manutencaoOS = os.map(mapOsRaw);
  state.metas = metas;
  state.indisponibilidades = (indisponibilidades || []).map(i => ({ ...i, dataInicio: (i.dataInicio || "").slice(0, 10), dataFim: (i.dataFim || "").slice(0, 10), autor: nomeDoUsuario(usuarios, i.autorId) }));
  state.justificativas = justificativas.map(j => ({ ...j, autor: nomeDoUsuario(usuarios, j.autorId), data: (j.data || "").slice(0, 10) }));
  state.programacoes = programacoes.map(p => ({
    ...p, programador: nomeDoUsuario(usuarios, p.programadorId),
    dataInicio: (p.dataInicio || "").slice(0, 10), dataFim: (p.dataFim || "").slice(0, 10),
  }));
  reconstruirSnapMaps();   // v3.0.7 - copias das OS guardadas nas programações
  state.usuarios = usuarios.map(u => ({ ...u, statusConta: u.statusConta === "PendenteAprovacao" ? "Pendente" : u.statusConta }));
  state.permissoes = {};
  usuarios.forEach((u, i) => {
    const mz = permissoesResp[i].matriz || {};
    // v2.13.13: matrizes salvas antes do modulo "Gestao de Bases" existir herdam
    // o acesso de visualizar que a pessoa ja tinha em Manutencao (a Gestao de
    // Bases era liberada por la). Excluir so existe pra quem receber a caixa.
    if (!mz.gestaoBases) mz.gestaoBases = (mz.manutencao && mz.manutencao.visualizar) ? { visualizar: true } : {};
    state.permissoes[u.id] = mz;
  });
  state.feriados = feriados;
  state.municipios = prefeituras.map((p, i) => ({ id: `mu${i + 1}`, nome: p.municipio, contatoNome: p.contatoNome, email: p.email, telefone: p.telefone }));
  state.importLog = importLog.map(l => ({ id: l.id, base: l.base, usuario: nomeDoUsuario(usuarios, l.usuarioId), dataHora: l.dataHora, processados: l.registrosProcessados, erros: l.registrosComErro, arquivo: l.arquivoOrigem }));
  state.logEquipes = logEquipes;
  state.logProgramacoes = logProgramacoes;
  state.logOS = logOS;
  state.logVinculos = logVinculos.vinculos || {};
  state.logEstatisticas = logVinculos.estatisticas || {};
  state.mapaLocalidades = localidadesMapa || { porAlimentador: {}, porMunicipio: {} };
  if (typeof recalcularStatusOS === "function") recalcularStatusOS();

  if (state.usuarios.length && !state.usuarios.find(u => u.id === currentUserPermViewId)) {
    currentUserPermViewId = state.usuarios[0].id;
  }
}

function nomeDoUsuario(usuarios, id) {
  const u = usuarios.find(x => x.id === id);
  return u ? u.nome : "—";
}

/* ---------------- login ----------------
   Só existe login de verdade quando há um Controller real pra validar a
   senha. Sem Controller (protótipo aberto direto, sem iniciar.bat), o
   sistema continua entrando direto com os dados de exemplo, como sempre —
   não faria sentido pedir senha pra um demo sem back-end nenhum. */
async function fazerLogin(email, senha) {
  const resp = await apiPost("/auth/login", { email, senha });
  setAuthToken(resp.token);
  currentUser = resp.usuario;
  return resp.usuario;
}

async function fazerLogout() {
  try { await apiPost("/auth/logout"); } catch (e) { /* mesmo se falhar, desloga localmente */ }
  setAuthToken(null);
  currentUser = null;
  location.reload();
}

function onSessaoExpirada() {
  if (typeof mapaCacheLimpar === "function") mapaCacheLimpar();   // sessão acabou: joga fora as camadas em memória
  if (typeof mostrarTelaLogin === "function") {
    toast("Sua sessão caducou — faça login de novo.");
    mostrarTelaLogin();
  }
}

/* ---------------- boot ---------------- */
async function bootApp() {
  const online = await checkApiHealth();
  if (!online) {
    console.info("[SPARK] Controller não encontrado em", API_BASE, "— exibindo dados de exemplo (protótipo offline).");
    if (typeof mostrarApp === "function") mostrarApp();
    else { renderNav(); render(); }
    return;
  }

  const token = getAuthToken();
  if (token) {
    try {
      currentUser = await apiGet("/auth/me");
      await loadStateFromApi();
      console.info("[SPARK] Conectado ao Controller — exibindo dados reais de", API_BASE);
      if (typeof mostrarApp === "function") mostrarApp();
      else { renderNav(); render(); }
      return;
    } catch (err) {
      console.warn("[SPARK] Sessão salva não é mais válida — pedindo login de novo:", err.message);
      setAuthToken(null);
      currentUser = null;
    }
  }
  if (typeof mostrarTelaLogin === "function") mostrarTelaLogin();
  else { renderNav(); render(); }
}
