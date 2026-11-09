/* =============================================================================
   v3.12.0 - OS dentro de APP (Área de Preservação Permanente) / RL (Reserva Legal)
   O Controller (lib/AppRl.ps1) mede, para cada OS com coordenada, a distância até o
   polígono de APP e de RL mais próximos (em metros: NEGATIVO = dentro, quanto fundo;
   POSITIVO = fora, a quantos metros da borda) e grava um índice enxuto. Aqui o
   navegador só CLASSIFICA com a tolerância configurada - por isso mudar a tolerância
   é instantâneo e não exige recalcular nada no servidor.

   Regra (T = tolerância em metros):
     dentro  = d <= -T            (entrou mais fundo que a margem de erro do GPS)
     borda   = -T < d <= +T       (dentro raso ou fora bem perto: confira em campo)
     fora    = d > +T             (não aparece)
   ============================================================================= */

const APRL_COR = { app:"#0891B2", rl:"#1E7A34", ambas:"#C026D3" };
const APRL_TOL_PADRAO = 15;
const APRL_TOLS_TABELA = [0, 5, 10, 15, 20, 30, 50, 100];

const aprl = {
  indice: null,          // { geradoEm, maxM, avaliadas, semPosicao, alimentadoresApp, alimentadoresRl, os:{id:[dApp,dRl]} }
  config: { toleranciaM: APRL_TOL_PADRAO, indiceGeradoEm: null },
  carregando: false, promessa: null, erro: "",
  escopo: "pendentes",   // pendentes | executadas | todas
  situacao: "todas",     // todas | dentro | borda
  memo: null,            // Map id -> classificação (zerado quando muda tolerância/índice)
  cacheLinhas: null,
  marcados: new Set(),   // ids de marcadores com anel desenhado no mapa
  mapaLigado: true,
  osPorId: null, osPorIdRef: null,
};

function aprlTol(){
  const t = Number(aprl.config && aprl.config.toleranciaM);
  return isFinite(t) && t >= 0 ? t : APRL_TOL_PADRAO;
}
function aprlMaxM(){ return (aprl.indice && Number(aprl.indice.maxM)) || 100; }
function aprlZerarCaches(){ aprl.memo = null; aprl.cacheLinhas = null; }

async function aprlGarantir(forcar){
  if(typeof API_ONLINE !== "undefined" && !API_ONLINE) return false;
  if(aprl.indice && !forcar) return true;
  if(aprl.carregando && aprl.promessa) return aprl.promessa;
  aprl.carregando = true;
  aprl.promessa = (async ()=>{
    try{
      const [ind, cfg] = await Promise.all([apiGet("/apprl/indice", 120000), apiGet("/apprl/config")]);
      aprl.indice = ind && typeof ind === "object" ? ind : null;
      if(aprl.indice && !aprl.indice.os) aprl.indice.os = {};
      if(cfg && typeof cfg === "object") aprl.config = cfg;
      aprl.erro = "";
      aprlZerarCaches();
      return true;
    }catch(e){
      aprl.erro = (e && e.message) || String(e);
      return false;
    }finally{
      aprl.carregando = false;
    }
  })();
  return aprl.promessa;
}

/* ---------- classificação ---------- */
function aprlSituacao(d, tol){
  if(d == null) return null;
  if(d <= -tol) return "dentro";
  if(d <= tol) return "borda";
  return null;
}
function aprlClassifComTol(id, tol){
  const ind = aprl.indice; if(!ind || !ind.os) return null;
  const e = ind.os[id]; if(!e) return null;
  const sa = aprlSituacao(e[0], tol), sr = aprlSituacao(e[1], tol);
  if(!sa && !sr) return null;
  return { app:sa, rl:sr, dApp:e[0], dRl:e[1], nivel:(sa==="dentro"||sr==="dentro") ? 2 : 1, camada:(sa&&sr) ? "ambas" : (sa ? "app" : "rl") };
}
function aprlClassif(id){
  if(!aprl.indice) return null;
  if(!aprl.memo) aprl.memo = new Map();
  let c = aprl.memo.get(id);
  if(c === undefined){ c = aprlClassifComTol(id, aprlTol()); aprl.memo.set(id, c); }
  return c;
}
function aprlClassifOS(o){ return o ? aprlClassif(String(o.id).trim()) : null; }

function aprlRotulo(c){
  if(!c) return "";
  const p = [];
  if(c.app) p.push(`APP (${c.app})`);
  if(c.rl) p.push(`RL (${c.rl})`);
  return p.join(" + ");
}
function aprlDistTxt(d){
  if(d == null) return "—";
  const v = Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 });
  return d <= 0 ? `${v} m dentro` : `${v} m fora`;
}
function aprlSituacaoHtml(c){
  if(!c) return "—";
  const pedaco = (nome, sit, cor)=> sit === "dentro"
    ? `<span style="display:inline-block; padding:1px 7px; border-radius:10px; background:${cor}; color:#fff; font-size:11.5px; font-weight:600; margin:1px 3px 1px 0; white-space:nowrap;">${nome} · dentro</span>`
    : `<span style="display:inline-block; padding:0 6px; border-radius:10px; border:1.5px dashed ${cor}; color:${cor}; font-size:11.5px; font-weight:600; margin:1px 3px 1px 0; white-space:nowrap;">${nome} · borda</span>`;
  return (c.app ? pedaco("APP", c.app, APRL_COR.app) : "") + (c.rl ? pedaco("RL", c.rl, APRL_COR.rl) : "");
}

/* ---------- lista da aba "APP / RL" (Alertas) ---------- */
function aprlComparar(a, b){
  if(b.cl.nivel !== a.cl.nivel) return b.cl.nivel - a.cl.nivel;
  const m = r => Math.min(r.cl.dApp == null ? 1e9 : r.cl.dApp, r.cl.dRl == null ? 1e9 : r.cl.dRl);
  return m(a) - m(b);
}
function aprlLinhas(){
  const ind = aprl.indice;
  if(!ind) return [];
  const sig = [state.manutencaoOS, ind, aprlTol(), aprl.escopo, aprl.situacao];
  const c = aprl.cacheLinhas;
  if(c && c.sig.every((x,i)=>x === sig[i])) return c.linhas;
  const linhas = [];
  state.manutencaoOS.forEach(o=>{
    if(o.statusOS === "Cancelada") return;
    const exec = o.statusOS === "Executada";
    if(aprl.escopo === "pendentes" && exec) return;
    if(aprl.escopo === "executadas" && !exec) return;
    const cl = aprlClassifOS(o);
    if(!cl) return;
    if(aprl.situacao === "dentro" && cl.nivel !== 2) return;
    if(aprl.situacao === "borda" && cl.nivel !== 1) return;
    linhas.push({ chave:o.id, os:o, cl, esquema:"" });
  });
  aprl.cacheLinhas = { sig, linhas };
  return linhas;
}
function aprlColunasAlerta(){
  const dt = r => r.os.statusOS === "Executada" ? (r.os.dataExecucao ? fmtDate(r.os.dataExecucao) : "") : (r.os.dataAbertura ? fmtDate(r.os.dataAbertura) : "");
  return [
    ["os","OS",r=>r.os.id], ["status","Status",r=>r.os.statusOS], ["origem","Origem",r=>r.os.origem], ["servico","Serviço",r=>r.os.tipoServico],
    ["situacao","APP / RL",r=>aprlRotulo(r.cl)], ["dapp","Distância da APP",r=>aprlDistTxt(r.cl.dApp)], ["drl","Distância da RL",r=>aprlDistTxt(r.cl.dRl)],
    ["alim","Alimentador",r=>r.os.alimentador], ["loc","Localidade",r=>cidadeDaOS(r.os)],
    ["data",`Execução / Abertura`,dt]
  ];
}
function aprlSetFiltro(campo, valor){
  aprl[campo] = valor;
  aprl.cacheLinhas = null;
  alertasPagina = {};
  alertasRedesenhar();
}
function aprlFiltrosHtml(){
  const sel = (campo, opcoes)=>`<select onchange="aprlSetFiltro('${campo}', this.value)">${opcoes.map(([v,r])=>`<option value="${v}" ${aprl[campo]===v?"selected":""}>${r}</option>`).join("")}</select>`;
  return `
    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:10px; font-size:12.5px;">
      <label style="display:flex; align-items:center; gap:6px;">OS ${sel("escopo", [["pendentes","pendentes (ainda dá tempo de evitar)"],["executadas","executadas (conferência)"],["todas","todas (menos canceladas)"]])}</label>
      <label style="display:flex; align-items:center; gap:6px;">Situação ${sel("situacao", [["todas","dentro + borda"],["dentro","só dentro"],["borda","só na borda"]])}</label>
    </div>`;
}
function aprlAvisoIndiceHtml(){
  if(typeof API_ONLINE !== "undefined" && !API_ONLINE)
    return `<div class="empty">${ic("empty")}<div>A checagem de APP/RL só funciona com o servidor conectado.</div></div>`;
  if(aprl.erro)
    return `<div class="empty">${ic("empty")}<div>Não consegui carregar o índice de APP/RL: ${escapeHtml(aprl.erro)}</div></div>`;
  if(!aprl.indice)
    return `<p style="color:var(--muted); font-size:12.5px;">Carregando o índice de APP/RL…</p>`;
  if(!aprl.indice.geradoEm)
    return `<div class="empty">${ic("empty")}<div>O cálculo de APP/RL ainda não foi feito. Ele roda sozinho na próxima importação de podas ou de KMZ — ou clique em <strong>Recalcular agora</strong> em Configuração › APP / RL.</div></div>`;
  return "";
}
function aprlResumoAlertaHtml(){
  const ind = aprl.indice;
  if(!ind || !ind.geradoEm) return "";
  const quando = fmtDataHoraIso(ind.geradoEm);
  return `<p style="color:var(--muted); font-size:11.5px; margin:0 0 8px;">Índice gerado em ${escapeHtml(quando)} · tolerância de <strong>${aprlTol().toLocaleString("pt-BR")} m</strong> (ajuste em Configuração › APP / RL) · ${Number(ind.avaliadas||0).toLocaleString("pt-BR")} OS medidas${ind.semPosicao ? `, ${Number(ind.semPosicao).toLocaleString("pt-BR")} sem posição confiável (ignoradas)` : ""}.</p>`;
}
function fmtDataHoraIso(s){
  try{
    const d = new Date(s);
    if(isNaN(d.getTime())) return String(s||"");
    return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }catch(e){ return String(s||""); }
}
function aprlDescricaoAlerta(){
  return `OS cujo ponto cai <strong>dentro</strong> de uma Área de Preservação Permanente (APP) ou Reserva Legal (RL), ou <strong>na borda</strong> (a até <strong>${aprlTol().toLocaleString("pt-BR")} m</strong> — margem de erro do GPS). Use nas pendentes para avisar quem programa antes de mandar a equipe, e nas executadas para conferência.`;
}

/* ---------- mapa de manutenção: anel nos pontos + aviso no popup e no agrupamento ---------- */
function aprlPopupLinha(o){
  if(!aprl.mapaLigado) return "";
  const c = aprlClassifOS(o);
  if(!c) return "";
  const cor = APRL_COR[c.camada];
  const det = [c.app ? `APP: ${aprlDistTxt(c.dApp)}` : "", c.rl ? `RL: ${aprlDistTxt(c.dRl)}` : ""].filter(Boolean).join(" · ");
  return `<p style="margin:0 0 6px; padding:4px 7px; border-radius:4px; background:${cor}; color:#fff; font-size:11.5px; line-height:1.4;"><strong>Atenção:</strong> ${c.nivel===2 ? "OS dentro de" : "OS na borda de"} ${c.app && c.rl ? "APP e RL" : (c.app ? "APP" : "RL")}.<br>${escapeHtml(det)}</p>`;
}
function aprlTemFilhos(cluster){
  try{ return cluster.getAllChildMarkers().some(m=>m._aprl); }catch(e){ return false; }
}
function aprlAplicarMapa(){
  if(typeof mapaMarkersPorId === "undefined" || !mapaMarkersPorId || typeof mapManutencao === "undefined" || !mapManutencao) return;
  // tira o anel de quem tinha
  aprl.marcados.forEach(id=>{
    const m = mapaMarkersPorId[id];
    if(m){ m._aprl = null; m.setStyle({ color:"#fff", weight:1.5, dashArray:null }); }
  });
  aprl.marcados = new Set();
  if(aprl.mapaLigado && aprl.indice && aprl.indice.os){
    Object.keys(aprl.indice.os).forEach(id=>{
      const m = mapaMarkersPorId[id];
      if(!m || !m._os || m._os.statusOS === "Cancelada") return;
      const c = aprlClassif(id);
      if(!c) return;
      m._aprl = c;
      m.setStyle({ color:APRL_COR[c.camada], weight:c.nivel === 2 ? 4 : 3.5, dashArray:c.nivel === 2 ? null : "3 3" });
      aprl.marcados.add(id);
    });
  }
  try{ if(typeof mapaClusterGroup !== "undefined" && mapaClusterGroup && mapaModoPontosAtual === "cluster") mapaClusterGroup.refreshClusters(); }catch(e){}
  const n = document.getElementById("aprlMapaNota");
  if(n){
    n.style.display = aprl.mapaLigado ? "" : "none";
    n.textContent = aprl.marcados.size
      ? `${aprl.marcados.size.toLocaleString("pt-BR")} OS em APP/RL (anel colorido): ciano = APP · verde = RL · magenta = ambas · tracejado = borda.`
      : (aprl.indice && aprl.indice.geradoEm ? "Nenhuma OS em APP/RL com a tolerância atual." : "Índice de APP/RL ainda não calculado.");
  }
}
function aprlPosMapa(){
  if(aprl.indice){ aprlAplicarMapa(); return; }
  aprlGarantir().then(ok=>{ if(ok) aprlAplicarMapa(); });
}
function aprlLigarMapa(ligado){
  aprl.mapaLigado = !!ligado;
  aprlAplicarMapa();
}

/* ---------- Configuração › APP / RL ---------- */
function aprlOsPorId(){
  if(aprl.osPorId && aprl.osPorIdRef === state.manutencaoOS) return aprl.osPorId;
  const m = new Map();
  state.manutencaoOS.forEach(o=>m.set(String(o.id).trim(), o));
  aprl.osPorId = m; aprl.osPorIdRef = state.manutencaoOS;
  return m;
}
function aprlContar(tol){
  const r = { pDentro:0, pBorda:0, eDentro:0, eBorda:0 };
  const ind = aprl.indice; if(!ind || !ind.os) return r;
  const mapa = aprlOsPorId();
  Object.keys(ind.os).forEach(id=>{
    const o = mapa.get(id); if(!o || o.statusOS === "Cancelada") return;
    const c = aprlClassifComTol(id, tol); if(!c) return;
    const exec = o.statusOS === "Executada";
    if(c.nivel === 2){ if(exec) r.eDentro++; else r.pDentro++; }
    else { if(exec) r.eBorda++; else r.pBorda++; }
  });
  return r;
}
function aprlLinhaTabela(tol, destaque, rotulo){
  const r = aprlContar(tol);
  const n = v => v.toLocaleString("pt-BR");
  return `<tr ${destaque ? 'style="background:var(--accent-soft, rgba(8,145,178,.12)); font-weight:600;"' : ""}>
    <td>${rotulo || (tol.toLocaleString("pt-BR") + " m")}</td>
    <td class="num">${n(r.pDentro)}</td><td class="num">${n(r.pBorda)}</td>
    <td class="num">${n(r.eDentro)}</td><td class="num">${n(r.eBorda)}</td></tr>`;
}
function aprlTabelaImpactoHtml(){
  const salva = aprlTol();
  const tols = APRL_TOLS_TABELA.filter(t=>t <= aprlMaxM());
  if(tols.indexOf(salva) < 0) tols.push(salva);
  tols.sort((a,b)=>a-b);
  return `
    <div class="table-wrap"><table style="font-size:12.5px;">
      <thead><tr><th>Tolerância</th><th>Pendentes · dentro</th><th>Pendentes · borda</th><th>Executadas · dentro</th><th>Executadas · borda</th></tr></thead>
      <tbody id="aprlTabelaCorpo">${tols.map(t=>aprlLinhaTabela(t, t === salva)).join("")}</tbody>
    </table></div>`;
}
function aprlConfigHtml(){
  const pode = minhaPermissao("manutencao","editar"), podeRec = minhaPermissao("manutencao","importar");
  const aviso = aprlAvisoIndiceHtml();
  const ind = aprl.indice;
  const nIndice = ind && ind.os ? Object.keys(ind.os).length : 0;
  const info = ind && ind.geradoEm ? `
    <ul style="margin:6px 0 0; padding-left:18px; font-size:12px; color:var(--muted); line-height:1.7;">
      <li>Índice gerado em <strong>${escapeHtml(fmtDataHoraIso(ind.geradoEm))}</strong></li>
      <li>${Number(ind.avaliadas||0).toLocaleString("pt-BR")} OS medidas${ind.semPosicao ? ` · ${Number(ind.semPosicao).toLocaleString("pt-BR")} ignoradas (sem coordenada ou posição aproximada)` : ""}</li>
      <li>${nIndice.toLocaleString("pt-BR")} OS dentro ou a até ${aprlMaxM()} m de alguma APP/RL</li>
      <li>KMZ carregados: ${(ind.alimentadoresApp||[]).length.toLocaleString("pt-BR")} alimentador(es) com APP · ${(ind.alimentadoresRl||[]).length.toLocaleString("pt-BR")} com RL</li>
    </ul>` : "";
  return `
    <div class="card" style="margin-bottom:14px;">
      <h3>APP / Reserva Legal — tolerância de borda</h3>
      <p style="color:var(--muted); font-size:12.5px; margin:0 0 10px; max-width:760px;">
        O GPS do celular erra alguns metros. A tolerância define a faixa em volta da divisa do polígono em que a OS é tratada como
        <strong>borda</strong> (confira em campo): de <strong>−T</strong> (dentro raso) até <strong>+T</strong> (fora, mas perto).
        Mais fundo que isso é <strong>dentro</strong>; mais longe que isso não gera alerta. Trocar o valor vale na hora — não precisa recalcular.
      </p>
      ${aviso}
      <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin:8px 0;">
        <div class="field" style="margin:0;"><label>Tolerância (metros, 0 a ${aprlMaxM()})</label>
          <input type="number" id="aprlTolInput" min="0" max="${aprlMaxM()}" step="1" value="${aprlTol()}" ${pode ? "" : "disabled"} oninput="aprlPrevia(this.value)" style="max-width:140px;"></div>
        <button class="btn btn-primary" onclick="aprlSalvarTol()" ${pode ? "" : "disabled"}>Salvar</button>
        <button class="btn btn-ghost" id="aprlBtnRecalcular" onclick="aprlRecalcular()" ${podeRec ? "" : "disabled"} title="Refaz a medição das OS contra os polígonos de APP/RL carregados">Recalcular agora</button>
      </div>
      <p id="aprlPrevia" style="font-size:12px; color:var(--muted); margin:4px 0 0;"></p>
      ${info}
    </div>
    ${ind && ind.geradoEm ? `<div class="card"><h3>Quantas OS cada tolerância pegaria</h3>
      <p style="color:var(--muted); font-size:12px; margin:0 0 8px;">Linha destacada = valor salvo agora. Use para escolher: tolerância maior pega mais OS na borda (mais alertas, mais falsos positivos).</p>
      ${aprlTabelaImpactoHtml()}</div>` : ""}`;
}
function aprlPrevia(v){
  const el = document.getElementById("aprlPrevia"); if(!el) return;
  const t = Number(String(v).replace(",", "."));
  if(v === "" || !isFinite(t) || t < 0 || t > aprlMaxM()){ el.textContent = `Informe um valor entre 0 e ${aprlMaxM()} m.`; return; }
  const r = aprlContar(t), n = x => x.toLocaleString("pt-BR");
  el.innerHTML = `Com <strong>${t.toLocaleString("pt-BR")} m</strong>: pendentes — <strong>${n(r.pDentro)}</strong> dentro, <strong>${n(r.pBorda)}</strong> na borda · executadas — ${n(r.eDentro)} dentro, ${n(r.eBorda)} na borda. (Ainda não salvo.)`;
}
async function aprlSalvarTol(){
  const inp = document.getElementById("aprlTolInput"); if(!inp) return;
  const t = Number(String(inp.value).replace(",", "."));
  if(inp.value === "" || !isFinite(t) || t < 0 || t > aprlMaxM()){ toast(`A tolerância precisa estar entre 0 e ${aprlMaxM()} metros.`); return; }
  try{
    const cfg = await apiSend("PUT", "/apprl/config", { toleranciaM:t });
    if(cfg) aprl.config = Object.assign({}, aprl.config, cfg);
    else aprl.config.toleranciaM = t;
    aprlZerarCaches();
    aprlAplicarMapa();
    toast(`Tolerância de APP/RL salva: ${aprlTol().toLocaleString("pt-BR")} m.`);
    const w = document.getElementById("cfgAprlWrap"); if(w) w.innerHTML = aprlConfigHtml();
  }catch(err){ toast(`Erro ao salvar: ${err.message}`); }
}
async function aprlRecalcular(){
  const b = document.getElementById("aprlBtnRecalcular");
  if(b){ b.disabled = true; b.textContent = "Calculando…"; }
  try{
    const r = await apiSend("POST", "/apprl/recalcular", {}, 600000);
    await aprlGarantir(true);
    aprlAplicarMapa();
    toast(`APP/RL recalculado: ${Number((r && r.avaliadas) || 0).toLocaleString("pt-BR")} OS medidas, ${Number((r && r.noIndice) || 0).toLocaleString("pt-BR")} perto de APP/RL.`);
  }catch(err){
    toast(`Não consegui recalcular APP/RL: ${err.message}`);
  }
  const w = document.getElementById("cfgAprlWrap"); if(w) w.innerHTML = aprlConfigHtml();
}
/* chamado quando um KMZ de APP/RL acaba de subir inteiro - o Controller refaz a medição */
async function aprlRecalcularSilencioso(){
  try{
    if(typeof API_ONLINE !== "undefined" && !API_ONLINE) return;
    await apiSend("POST", "/apprl/recalcular", {}, 600000);
    await aprlGarantir(true);
    aprlAplicarMapa();
  }catch(e){ /* sem permissão ou sem índice: o botão em Configuração continua valendo */ }
}
async function aprlConfigDepoisDeRenderizar(){
  await aprlGarantir();
  const w = document.getElementById("cfgAprlWrap");
  if(w){ w.innerHTML = aprlConfigHtml(); aprlPrevia(aprlTol()); }
}
