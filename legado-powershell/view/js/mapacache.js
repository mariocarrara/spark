/* =========================================================================
   SPARK — cache das camadas do Mapa de Manutenção + pré-carga em segundo plano
   (v2.12.0)

   Pedido do Mario: "roda a carga dos mapas em background se possível, aí
   libera a combobox no mapa de manutenção quando acabar a carga, tem que
   arrumar uma forma de isso ficar carregado enquanto a sessão estiver
   valendo, para não ficar recarregando toda hora."

   Como funciona:
   - Depois do login, mapaCacheIniciar() busca (1 pedido por vez, nunca em
     paralelo — o Controller atende um pedido por vez) o GeoJSON de CADA
     alimentador de cada camada (MT primeiro, que é a que aparece por padrão;
     depois Reserva Legal, APP, AT e BT) e, por último, os pontos da VERA.
   - O que chega fica na MEMÓRIA da página (mapaCache), como texto JSON — não
     como objetos já desserializados, que ocupariam várias vezes mais
     memória. Só vira objeto quando um alimentador é de fato selecionado.
   - Enquanto uma camada ainda está carregando, o combo dela no mapa mostra
     "carregando X/Y" e fica travado; assim que termina, o combo é liberado e
     escolher alimentadores passa a ser instantâneo (sem ir ao Controller).
   - Dura enquanto a sessão valer: trocar de tela NÃO perde nada (a memória é
     da página, não da tela); sair/sessão expirada/F5 limpam. Importar rede,
     KMZ, VERA ou apagar alimentador invalida o que mudou e recarrega sozinho.
   - Limite de memória (MAPA_CACHE_LIMITE_CHARS): passou disso, o resto da
     camada deixa de ser guardado e é buscado sob demanda, como antes — o
     combo é liberado mesmo assim.
   ========================================================================= */

const MAPA_CACHE_CAMADAS = [
  { prefixo: "mt",      queryParam: "ctmt", chaveResposta: "rede_mt",       listaChave: "rede_mt_disponiveis" },
  { prefixo: "reserva", queryParam: "rl",   chaveResposta: "reserva_legal", listaChave: "reserva_legal_disponiveis" },
  { prefixo: "app",     queryParam: "app",  chaveResposta: "app",           listaChave: "app_disponiveis" },
  { prefixo: "at",      queryParam: "at",   chaveResposta: "rede_at",       listaChave: "rede_at_disponiveis" },
  { prefixo: "bt",      queryParam: "bt",   chaveResposta: "rede_bt",       listaChave: "rede_bt_disponiveis" },
];
const MAPA_CACHE_LIMITE_CHARS = 450000000;   // ~450 MB de texto guardado
const MAPA_CACHE_PAUSA_MS = 12;               // respiro entre pedidos (deixa o Controller atender outras telas)
const MAPA_CACHE_ATRASO_INICIAL_MS = 900;     // deixa a primeira tela renderizar antes de começar

function mapaCacheNovo() {
  return {
    geracao: 0,            // sobe a cada limpeza/invalidação — pré-cargas antigas se encerram sozinhas
    iniciada: false,       // já disparou a pré-carga nesta geração?
    listas: null,          // resposta de GET /manutencao/camadas (listas de alimentadores)
    camadas: {},           // prefixo -> { estado, feitos, total, falhas, textos: Map(ctmt -> texto) }
    vera: { estado: "aguardando", pontos: null, carregadas: 0, total: 0 },
    chars: 0,
    ouvintes: new Set(),
    timerReinicio: null,
    timerNotificar: null,
  };
}
let mapaCache = mapaCacheNovo();

/* ---- consulta de estado ---- */
function mapaCacheCamada(prefixo) { return mapaCache.camadas[prefixo] || null; }

/* Combo da camada deve ficar travado? Só enquanto uma pré-carga REAL está em
   andamento pra ela (iniciada e ainda não terminou) — sem pré-carga (offline,
   sem permissão, ainda não começou) o combo funciona normal, buscando sob
   demanda. */
function mapaCacheOcupada(prefixo) {
  if (!mapaCache.iniciada) return false;
  const c = mapaCache.camadas[prefixo];
  if (!c) return true;   // lista ainda nem chegou
  return c.estado === "aguardando" || c.estado === "carregando";
}
function mapaCacheProgressoTexto(prefixo) {
  const c = mapaCache.camadas[prefixo];
  if (!c || !c.total) return "carregando…";
  return `carregando ${c.feitos.toLocaleString("pt-BR")}/${c.total.toLocaleString("pt-BR")}…`;
}
function mapaCacheMegabytes() { return Math.round(mapaCache.chars / 1048576); }

/* ---- assinaturas (a tela do mapa se inscreve pra reagir ao progresso) ---- */
function mapaCacheOuvir(fn) {
  mapaCache.ouvintes.add(fn);
  return () => mapaCache.ouvintes.delete(fn);
}
function mapaCacheNotificar(imediato) {
  const disparar = () => {
    mapaCache.timerNotificar = null;
    mapaCache.ouvintes.forEach(fn => { try { fn(); } catch (e) { console.warn("[SPARK] ouvinte do cache do mapa falhou:", e); } });
  };
  if (imediato) { clearTimeout(mapaCache.timerNotificar); disparar(); return; }
  if (mapaCache.timerNotificar) return;           // já tem uma notificação agendada
  mapaCache.timerNotificar = setTimeout(disparar, 250);   // no máximo 4x por segundo
}
function mapaCacheAguardar(predicado) {
  return new Promise(resolve => {
    if (predicado()) { resolve(); return; }
    const cancelar = mapaCacheOuvir(() => { if (predicado()) { cancelar(); resolve(); } });
  });
}

/* ---- ciclo de vida ---- */
function mapaCachePodeCarregar() {
  if (typeof API_ONLINE === "undefined" || !API_ONLINE) return false;
  if (typeof currentUser === "undefined" || !currentUser) return false;
  try { return !!minhaPermissao("manutencao", "visualizar"); } catch (e) { return false; }
}
function mapaCacheIniciar() {
  if (mapaCache.iniciada || !mapaCachePodeCarregar()) return;
  mapaCache.iniciada = true;
  const ger = mapaCache.geracao;
  mapaCachePrecarregar(ger).catch(err => console.warn("[SPARK] pré-carga do mapa interrompida:", err));
}
/* Sessão acabou (logout/401): joga tudo fora e NÃO recomeça. */
function mapaCacheLimpar() {
  const ouvintes = mapaCache.ouvintes;
  clearTimeout(mapaCache.timerReinicio);
  clearTimeout(mapaCache.timerNotificar);
  const geracao = mapaCache.geracao + 1;
  mapaCache = mapaCacheNovo();
  mapaCache.geracao = geracao;
  mapaCache.ouvintes = ouvintes;
  mapaCacheNotificar(true);
}
/* Dado mudou (import de rede/KMZ/VERA, alimentador apagado): descarta o
   cache e recarrega sozinho. Com atraso e "debounce": um upload de KMZ em
   vários lotes chama isto a cada lote — só recomeça quando as chamadas
   param de chegar (não vale disputar o Controller com o próprio upload). */
/* v2.13.0 - suspensão: enquanto há upload em andamento (api.js), a pré-carga
   não faz pedido nenhum e o reinício pós-invalidação espera. */
let mapaCacheSuspensoes = 0;
let mapaCacheReinicioPendente = false;
function mapaCacheSuspender() { mapaCacheSuspensoes++; }
function mapaCacheRetomarSuspensao() {
  mapaCacheSuspensoes = Math.max(0, mapaCacheSuspensoes - 1);
  if (mapaCacheSuspensoes === 0 && mapaCacheReinicioPendente) {
    mapaCacheReinicioPendente = false;
    clearTimeout(mapaCache.timerReinicio);
    mapaCache.timerReinicio = setTimeout(() => { mapaCache.timerReinicio = null; mapaCacheIniciar(); }, 4000);
  }
}
async function mapaCacheAguardarLivre(ativo) {
  while (mapaCacheSuspensoes > 0 && ativo()) await new Promise(r => setTimeout(r, 400));
}
function mapaCacheInvalidar(motivo) {
  const ouvintes = mapaCache.ouvintes;
  clearTimeout(mapaCache.timerReinicio);
  clearTimeout(mapaCache.timerNotificar);
  const geracao = mapaCache.geracao + 1;
  mapaCache = mapaCacheNovo();
  mapaCache.geracao = geracao;
  mapaCache.ouvintes = ouvintes;
  mapaCacheNotificar(true);
  if (mapaCacheSuspensoes > 0) { mapaCacheReinicioPendente = true; return; }
  mapaCache.timerReinicio = setTimeout(() => { mapaCache.timerReinicio = null; mapaCacheIniciar(); }, 4000);
}
/* Chamado por api.js depois de qualquer escrita bem-sucedida no Controller. */
function onMutacaoApi(path) {
  if (typeof path !== "string") return;
  if (/^\/importacao\/(shapefile|camadas|resetar-tudo|vera)/.test(path) || /^\/cadastros\/vera/.test(path)) {
    mapaCacheInvalidar(path);
  }
}

/* ---- a pré-carga em si ---- */
const mapaCachePausa = (ms) => new Promise(r => setTimeout(r, ms));

async function mapaCacheObterListas() {
  if (mapaCache.listas) return mapaCache.listas;
  const listas = await apiGet("/manutencao/camadas", 60000);
  if (!mapaCache.listas) mapaCache.listas = listas;
  return mapaCache.listas;
}

async function mapaCachePrecarregar(ger) {
  const ativo = () => ger === mapaCache.geracao;
  let listas;
  try {
    listas = await mapaCacheObterListas();
  } catch (err) {
    if (!ativo()) return;
    // sem as listas não dá pra pré-carregar — destrava os combos (carregam
    // sob demanda, como antes da v2.12.0).
    mapaCache.iniciada = false;
    mapaCacheNotificar(true);
    return;
  }
  if (!ativo()) return;

  MAPA_CACHE_CAMADAS.forEach(c => {
    const lista = listas[c.listaChave] || [];
    mapaCache.camadas[c.prefixo] = { estado: lista.length ? "aguardando" : "pronta", feitos: 0, total: lista.length, falhas: 0, textos: new Map() };
  });
  mapaCacheNotificar(true);

  // Ordem: MT (a que aparece por padrão), Reserva Legal, APP, AT, VERA e por
  // último a BT (a maior, e a menos usada no dia a dia).
  const ordem = ["mt", "reserva", "app", "at", "vera", "bt"];
  for (const prefixo of ordem) {
    await mapaCacheAguardarLivre(ativo);
    if (!ativo()) return;
    if (prefixo === "vera") { await mapaCachePrecarregarVera(ativo); continue; }
    await mapaCachePrecarregarCamada(mapaCacheConfigDe(prefixo), listas, ativo);
  }
}

async function mapaCachePrecarregarCamada(c, listas, ativo) {
  const cam = mapaCache.camadas[c.prefixo];
  const lista = listas[c.listaChave] || [];
  if (!cam || !lista.length) return;
  cam.estado = "carregando";
  mapaCacheNotificar(true);
  for (const item of lista) {
    await mapaCacheAguardarLivre(ativo);
    if (!ativo()) return;
    if (mapaCache.chars >= MAPA_CACHE_LIMITE_CHARS) { cam.estado = "parcial"; break; }   // o resto vem sob demanda
    try {
      const texto = await apiGetTexto(`/manutencao/camadas?${c.queryParam}=${encodeURIComponent(item.ctmt)}`, 60000);
      if (!ativo()) return;
      cam.textos.set(item.ctmt, texto);
      mapaCache.chars += texto.length;
    } catch (err) {
      if (!ativo()) return;
      cam.falhas++;
    }
    cam.feitos++;
    mapaCacheNotificar(false);
    await mapaCachePausa(MAPA_CACHE_PAUSA_MS);
  }
  if (!ativo()) return;
  if (cam.estado === "carregando") cam.estado = cam.falhas > 0 ? "parcial" : "pronta";
  mapaCacheNotificar(true);
}

/* VERA (árvores): um pedido só, em streaming — o Controller fica ocupado com
   ele enquanto durar, por isso vai depois das camadas leves. */
async function mapaCachePrecarregarVera(ativo) {
  const vera = mapaCache.vera;
  vera.estado = "carregando";
  mapaCacheNotificar(true);
  try {
    const pontos = [];
    const resp = await apiGetStream("/manutencao/vera-mapa", (p) => {
      if (!ativo()) return;
      if (p.tipo === "lote" && p.pontos) {
        for (const pt of p.pontos) pontos.push(pt);
        vera.carregadas = pontos.length;
        if (typeof p.total === "number") vera.total = p.total;
        mapaCacheNotificar(false);
      }
    });
    if (!ativo()) return;
    vera.pontos = pontos;
    vera.total = resp.total || pontos.length;
    vera.estado = "pronta";
  } catch (err) {
    if (!ativo()) return;
    vera.estado = "erro";
  }
  mapaCacheNotificar(true);
}

/* ---- leitura (usada pelo desenho das camadas no mapa) ---- */
function mapaCacheConfigDe(prefixo) {
  return MAPA_CACHE_CAMADAS.find(c => c.prefixo === prefixo);
}
/* Devolve as features de UM alimentador: da memória se já estiver lá, senão
   busca no Controller (e guarda, se ainda houver espaço). */
async function mapaCacheObterFeatures(prefixo, ctmt) {
  const cfg = mapaCacheConfigDe(prefixo);
  if (!cfg) return [];
  const cam = mapaCache.camadas[prefixo];
  let texto = cam ? cam.textos.get(ctmt) : undefined;
  if (texto === undefined) {
    const ger = mapaCache.geracao;
    texto = await apiGetTexto(`/manutencao/camadas?${cfg.queryParam}=${encodeURIComponent(ctmt)}`, 60000);
    if (cam && ger === mapaCache.geracao && mapaCache.chars < MAPA_CACHE_LIMITE_CHARS) {
      cam.textos.set(ctmt, texto);
      mapaCache.chars += texto.length;
    }
  }
  let obj;
  try { obj = JSON.parse(texto); } catch (e) { return []; }
  const geo = obj && obj[cfg.chaveResposta];
  return (geo && geo.features) || [];
}
