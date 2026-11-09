/* =========================================================================
   v3.7.0 - MENU "PRIORIDADE DA PROGRAMAÇÃO"
   Três visões sobre as listas de prioridade que a engenharia mandou (guardadas na v3.6.0):
     1) Pendência por prioridade  - a lista mais atual cruzada com as OS pendentes do SPARK
     2) Mudanças entre listas     - quem subiu, caiu, entrou ou saiu de uma lista para outra
     3) Aderência                 - cada programação criada, conferida contra a lista que valia na hora
   Tudo é calculado aqui no navegador, só leitura (usa GET /api/rank e /api/rank/{id}); não grava nada
   e não precisa mexer no Controller. Carrega ANTES do app.js (o app.js aponta VIEWS para viewPrioridade).
   Depende de: state, rankCarregarListas (rank.js), apiGet, escapeHtml, fmtDate, rankDataHora, toast.
   ========================================================================= */

const rankAn = {
  aba: "pend",          // pend | mud | ader
  itens: {},            // id da lista -> itens (cache)
  carregando: false, pronto: false, erro: "",
  topN: 50,             // recorte da aba Pendência
  soPend: false,        // só elementos com OS pendente
  ordem: "rank",        // rank | pend | dec
  mudA: "", mudB: "",   // listas comparadas (ids)
  mudFiltro: "top",     // top (entrou no Top 50 de alguma) | todos
  folga: 0,             // aderência: quantos "furos" ainda contam como na ordem
  aderFiltro: "furou",  // furou | todas
  busca: "",           // texto da barra de busca (vale nas três abas)
};
const RANK_TOP = 50;        // "Top 50" usado nas comparações
const RANK_SALTO = 100;     // mudança de posição considerada grande

function rankAnListasAsc(){
  return (state.rankListas || []).slice().sort((a,b)=>String(a.enviadoEm).localeCompare(String(b.enviadoEm)) || String(a.id).localeCompare(String(b.id)));
}
function rankAnNomeLista(l){
  if(!l) return "—";
  return rankDataHora(l.enviadoEm) + (l.referencia ? " · " + l.referencia : "");
}
function rankAnMapa(id){
  const arr = rankAn.itens[id] || [];
  const m = new Map();
  arr.forEach(x=>m.set(String(x.e).trim().toUpperCase(), x));
  return m;
}

/* ---------- carga ---------- */
async function rankAnCarregar(forcar){
  if(rankAn.carregando) return;
  if(rankAn.pronto && !forcar) return;
  rankAn.carregando = true; rankAn.erro = "";
  try{
    await rankCarregarListas(true);
    const listas = state.rankListas || [];
    // busca as listas que ainda não estão em memória, 3 por vez (cada uma tem ~1.300 linhas)
    const faltam = listas.filter(l=>!rankAn.itens[l.id]);
    for(let i=0;i<faltam.length;i+=3){
      await Promise.all(faltam.slice(i,i+3).map(async l=>{
        const r = await apiGet("/rank/" + encodeURIComponent(l.id), 60000);
        rankAn.itens[l.id] = (r && r.itens) || [];
      }));
    }
    const ids = new Set(listas.map(l=>l.id));
    Object.keys(rankAn.itens).forEach(k=>{ if(!ids.has(k)) delete rankAn.itens[k]; });
    rankAn.pronto = true;
    rankAnMemo.chave = "";
  }catch(e){
    rankAn.erro = e.message || String(e);
  }finally{
    rankAn.carregando = false;
    if(typeof currentRoute==="function" && currentRoute().key==="prioridade") render();
  }
}

/* ---------- índices do SPARK (OS por proteção, programações por proteção) ---------- */
let rankAnIdx = null;
function rankAnIndices(){
  const porProt = new Map();
  (state.manutencaoOS || []).forEach(o=>{
    if(!o || !o.protecaoId || o.statusOS==="Cancelada") return;
    const k = String(o.protecaoId).trim().toUpperCase();
    if(!porProt.has(k)) porProt.set(k, []);
    porProt.get(k).push(o);
  });
  const progPorProt = new Map();
  (state.programacoes || []).forEach(p=>{
    if(!p || p.status==="Cancelada" || !p.protecaoId) return;
    const k = String(p.protecaoId).trim().toUpperCase();
    if(!progPorProt.has(k)) progPorProt.set(k, []);
    progPorProt.get(k).push(p);
  });
  rankAnIdx = { porProt, progPorProt };
  return rankAnIdx;
}
/* OS pendentes do elemento separadas pelo "Tipo de equipe" da OS (o mesmo campo da grid do mapa) */
function rankAnPendPorTipo(k){
  const out = {};
  for(const o of (rankAnIdx.porProt.get(k) || [])){
    if(o.statusOS==="Executada") continue;
    const t = String(o.tipoEquipeExec || "").trim() || "(sem tipo)";
    out[t] = (out[t]||0) + 1;
  }
  return out;
}
function rankAnPendHoje(k){
  const l = rankAnIdx.porProt.get(k) || [];
  let n = 0; for(const o of l) if(o.statusOS!=="Executada") n++;
  return n;
}
/* a OS estava pendente no instante T (dia yyyy-mm-dd)? criada até T e ainda não executada em T */
function rankAnOsPendenteEm(o, dia){
  const cri = String(o.dataCriacao || "").slice(0,10);
  if(cri && cri > dia) return false;
  if(o.statusOS==="Executada"){
    const ex = String(o.dataExecucao || "").slice(0,10);
    return !ex || ex > dia;      // executada depois de T: em T ainda estava pendente
  }
  return true;
}
function rankAnTemPendenciaEm(k, dia){
  const l = rankAnIdx.porProt.get(k) || [];
  for(const o of l) if(rankAnOsPendenteEm(o, dia)) return true;
  return false;
}
function rankAnProgramadaAte(k, tMs){
  const l = rankAnIdx.progPorProt.get(k) || [];
  for(const p of l){ const c = Date.parse(p.criadoEm || ""); if(!isNaN(c) && c <= tMs) return true; }
  return false;
}
function rankAnDiaLocal(ms){
  const d = new Date(ms);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* ---------- busca (elemento, alimentador, polo...) ---------- */
function rankAnTermos(){ return rankAn.busca ? buscaOSTermos(rankAn.busca) : []; }
function rankAnBate(termos, ...campos){
  if(!termos.length) return true;
  const txt = campos.map(c=>String(c==null?"":c)).join(" ").toLowerCase();
  return termos.some(t=>txt.includes(t));
}
function rankAnBuscaHtml(){
  return `<div class="rk-busca"><input type="text" id="rkBusca" value="${escapeHtml(rankAn.busca)}" placeholder="Buscar elemento, alimentador, polo, regional… (várias separadas por vírgula)" oninput="rankAnBuscar(this.value)" autocomplete="off">${rankAn.busca ? `<button type="button" class="btn btn-ghost btn-sm" onclick="rankAnBuscar('')">× Limpar</button>` : ""}</div>`;
}
function rankAnBuscar(v){
  rankAn.busca = v;
  clearTimeout(rankAnBuscar._t);
  rankAnBuscar._t = setTimeout(()=>{
    render();
    const i = document.getElementById("rkBusca");
    if(i){ i.focus(); const n = i.value.length; try{ i.setSelectionRange(n,n); }catch(e){} }
  }, 220);
}

/* ---------- peças de tela ---------- */
function rankAnCaixa(titulo, valor, nota, cls){
  return `<div class="rk-caixa ${cls||""}"><div class="rk-caixa-t">${titulo}</div><div class="rk-caixa-v">${valor}</div>${nota ? `<div class="rk-caixa-n">${nota}</div>` : ""}</div>`;
}
function rankAnSeletorLista(id, atual, fn){
  const asc = rankAnListasAsc().reverse();
  return `<select id="${id}" onchange="${fn}(this.value)">${asc.map(l=>`<option value="${escapeHtml(l.id)}" ${l.id===atual?"selected":""}>${escapeHtml(rankAnNomeLista(l))}</option>`).join("")}</select>`;
}
function rankAnDeltaHtml(d){
  if(d==null) return `<span style="color:var(--muted);">—</span>`;
  if(d===0) return `<span style="color:var(--muted);">=</span>`;
  return d>0 ? `<span class="pill ok">▲ ${d}</span>` : `<span class="pill bad">▼ ${-d}</span>`;
}
function rankAnProgHtml(k){
  const l = rankAnIdx.progPorProt.get(k) || [];
  if(!l.length) return `<span style="color:var(--muted);">não programada</span>`;
  const hoje = new Date().toISOString().slice(0,10);
  const fut = l.filter(p=>(p.dataFim||p.dataInicio||"")>=hoje).sort((a,b)=>String(a.dataInicio).localeCompare(String(b.dataInicio)));
  const p = fut.length ? fut[0] : l.slice().sort((a,b)=>String(b.dataInicio).localeCompare(String(a.dataInicio)))[0];
  return `<span class="pill info">${p.dataInicio ? fmtDate(p.dataInicio).slice(0,5) : "—"}</span>`;
}

/* =========================================================================
   VIEW
   ========================================================================= */
function viewPrioridade(){
  if(!API_ONLINE){
    return `<div class="card"><div class="empty">${ic("empty")}<div>Esta tela precisa do Controller no ar (as listas ficam guardadas lá). Abra o sistema pelo iniciar.bat.</div></div></div>`;
  }
  if(rankAn.erro){
    return `<div class="card"><div class="note" style="background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Não consegui carregar as listas: ${escapeHtml(rankAn.erro)} <button class="btn btn-ghost btn-sm" onclick="rankAn.erro=''; rankAn.pronto=false; rankAnCarregar(true); render();">Tentar de novo</button></div></div></div>`;
  }
  if(!rankAn.pronto){
    return `<div class="card">${barraIndeterminadaHtml("Carregando as listas de prioridade…")}</div>`;
  }
  const listas = rankAnListasAsc();
  if(!listas.length){
    return `<div class="card"><div class="empty">${ic("empty")}<div>Nenhuma lista de prioridade guardada ainda. Envie em Importação de Bases, opção "Rank de prioridade".</div></div></div>`;
  }
  rankAnIndices();
  if(!rankAn.mudB || !listas.some(l=>l.id===rankAn.mudB)) rankAn.mudB = listas[listas.length-1].id;
  if(!rankAn.mudA || !listas.some(l=>l.id===rankAn.mudA) || rankAn.mudA===rankAn.mudB){
    const ant = listas.filter(l=>l.id!==rankAn.mudB);
    rankAn.mudA = ant.length ? ant[ant.length-1].id : "";
  }
  const abas = [["pend","Pendência por prioridade"],["mud","Mudanças entre listas"],["ader","Aderência da programação"]];
  const corpo = rankAn.aba==="pend" ? rankAnPendHtml(listas) : rankAn.aba==="mud" ? rankAnMudHtml(listas) : rankAnAderHtml(listas);
  return `
    <div class="card">
      <div class="card-head" style="flex-wrap:wrap; gap:10px;">
        <div class="tabs">${abas.map(([k,r])=>`<button class="tab ${k===rankAn.aba?"active":""}" onclick="rankAnAba('${k}')">${r}</button>`).join("")}</div>
        <div style="color:var(--muted); font-size:12px;">${listas.length} lista(s) guardada(s) · mais atual: <b>${escapeHtml(rankAnNomeLista(listas[listas.length-1]))}</b></div>
      </div>
      ${rankAnBuscaHtml()}
      ${corpo}
    </div>`;
}
function rankAnAba(k){ rankAn.aba = k; render(); }
function rankAnInit(){ rankAnCarregar(false); }

/* ---------- 1) Pendência por prioridade ---------- */
function rankAnPendHtml(listas){
  const L = listas[listas.length-1];
  const mapa = rankAn.itens[L.id] || [];
  const linhas = mapa.map(x=>{
    const k = String(x.e).trim().toUpperCase();
    return { x, k, pend: rankAnPendHoje(k), tipos: rankAnPendPorTipo(k), conj: (typeof conjuntoDaOS==="function" ? conjuntoDaOS({ alimentador:x.alim }) : "") || "", temOS: rankAnIdx.porProt.has(k), prog: (rankAnIdx.progPorProt.get(k)||[]).length>0 };
  });
  const top = linhas.filter(l=>l.x.r <= RANK_TOP);
  const topPend = top.filter(l=>l.pend>0);
  const topPendSemProg = topPend.filter(l=>!l.prog);
  const totalPend = linhas.reduce((s,l)=>s+l.pend,0);
  const semOS = linhas.filter(l=>!l.temOS).length;
  let vis = linhas.slice();
  const termos = rankAnTermos();
  if(termos.length) vis = vis.filter(l=>rankAnBate(termos, l.x.e, l.x.alim, l.x.polo, l.x.reg, l.conj, l.x.conj, l.x.trecho));
  else if(rankAn.topN) vis = vis.filter(l=>l.x.r <= rankAn.topN);   // com busca, procura na lista inteira
  if(rankAn.soPend) vis = vis.filter(l=>l.pend>0);
  if(rankAn.ordem==="pend") vis.sort((a,b)=>b.pend-a.pend || a.x.r-b.x.r);
  else if(rankAn.ordem==="dec") vis.sort((a,b)=>(b.x.dec||0)-(a.x.dec||0) || a.x.r-b.x.r);
  else vis.sort((a,b)=>a.x.r-b.x.r);
  const LIM = 300;
  const mostra = vis.slice(0, LIM);
  // colunas por tipo de equipe: os tipos que aparecem nas OS pendentes da lista (mais frequentes primeiro; "(sem tipo)" por último)
  const totTipo = {};
  linhas.forEach(l=>Object.keys(l.tipos).forEach(t=>{ totTipo[t] = (totTipo[t]||0) + l.tipos[t]; }));
  let tiposCol = Object.keys(totTipo).filter(t=>t!=="(sem tipo)").sort((a,b)=>totTipo[b]-totTipo[a]);
  const MAXT = 6;
  const temOutros = tiposCol.length > MAXT;
  const outrosSet = new Set(tiposCol.slice(MAXT));
  tiposCol = tiposCol.slice(0, MAXT);
  const colSemTipo = !!totTipo["(sem tipo)"];
  const celTipo = (l,t)=>{ const n = l.tipos[t]||0; return n ? `<b>${n}</b>` : `<span style="color:var(--muted);">·</span>`; };
  const celOutros = l=>{ let n=0; outrosSet.forEach(t=>{ n += l.tipos[t]||0; }); return n ? `<b>${n}</b>` : `<span style="color:var(--muted);">·</span>`; };
  const sel = (id,fn,opts,atual)=>`<select id="${id}" onchange="${fn}(this.value)">${opts.map(([v,r])=>`<option value="${v}" ${String(v)===String(atual)?"selected":""}>${r}</option>`).join("")}</select>`;
  return `
    <p style="color:var(--muted); font-size:12.5px; margin:4px 0 12px;">A lista mais atual da engenharia cruzada com as OS pendentes do SPARK. "OS pend." conta as OS do elemento que ainda não foram executadas (cancelada não conta).</p>
    <div class="rk-cards">
      ${rankAnCaixa("Elementos na lista", linhas.length, `enviada em ${rankDataHora(L.enviadoEm)}`)}
      ${rankAnCaixa(`Top ${RANK_TOP} com OS pendente`, `${topPend.length} <span class="rk-de">de ${top.length}</span>`, "elementos prioritários que têm trabalho a fazer")}
      ${rankAnCaixa(`Top ${RANK_TOP} pendentes e sem programação`, topPendSemProg.length, "têm OS pendente e nenhuma programação aberta", topPendSemProg.length ? "rk-alerta" : "")}
      ${rankAnCaixa("OS pendentes na lista", totalPend, `${semOS} elemento(s) da lista sem nenhuma OS no SPARK`)}
    </div>
    <div class="rk-filtros">
      <label>Mostrar ${sel("rkTopN","rankAnSetTopN",[[50,"Top 50"],[100,"Top 100"],[300,"Top 300"],[0,"Todos"]],rankAn.topN)}</label>
      <label>Ordenar por ${sel("rkOrdem","rankAnSetOrdem",[["rank","Prioridade (rank)"],["pend","Mais OS pendentes"],["dec","Maior DEC"]],rankAn.ordem)}</label>
      <label class="rk-check"><input type="checkbox" ${rankAn.soPend?"checked":""} onchange="rankAnSetSoPend(this.checked)"> só com OS pendente</label>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Rank</th><th>Elemento</th><th>Alimentador</th><th>Conjunto</th><th>Polo</th><th>DEC</th><th>OS pend.</th>${tiposCol.map(t=>`<th title="OS pendentes de tipo de equipe ${escapeHtml(t)}">${escapeHtml(t)}</th>`).join("")}${temOutros?`<th>Outros tipos</th>`:""}${colSemTipo?`<th title="OS pendentes sem tipo de equipe definido">Sem tipo</th>`:""}<th>Programada</th></tr></thead>
      <tbody>${mostra.map(l=>`<tr>
        <td class="num"><b>${l.x.r}</b></td>
        <td class="mono">${escapeHtml(l.x.e)}</td>
        <td>${escapeHtml(l.x.alim||"—")}</td>
        <td>${l.conj ? escapeHtml(l.conj) : `<span style="color:var(--muted);">—</span>`}</td>
        <td>${escapeHtml(l.x.polo||"—")}</td>
        <td class="num">${l.x.dec!=null && l.x.dec!=="" ? Number(l.x.dec).toLocaleString("pt-BR",{maximumFractionDigits:2}) : "—"}</td>
        <td class="num">${l.pend ? `<b>${l.pend}</b>` : `<span style="color:var(--muted);">0</span>`}</td>
        ${tiposCol.map(t=>`<td class="num">${celTipo(l,t)}</td>`).join("")}${temOutros?`<td class="num">${celOutros(l)}</td>`:""}${colSemTipo?`<td class="num">${celTipo(l,"(sem tipo)")}</td>`:""}
        <td>${rankAnProgHtml(l.k)}</td></tr>`).join("") || `<tr><td colspan="${8+tiposCol.length+(temOutros?1:0)+(colSemTipo?1:0)}"><div class="empty">${ic("empty")}<div>Nada para mostrar com esse filtro.</div></div></td></tr>`}</tbody>
    </table></div>
    ${vis.length>LIM ? `<p style="color:var(--muted); font-size:11.5px; margin-top:6px;">Mostrando ${LIM} de ${vis.length}. Use um recorte menor.</p>` : ""}`;
}
function rankAnSetTopN(v){ rankAn.topN = Number(v)||0; render(); }
function rankAnSetOrdem(v){ rankAn.ordem = v; render(); }
function rankAnSetSoPend(v){ rankAn.soPend = !!v; render(); }

/* ---------- 2) Mudanças entre listas ---------- */
function rankAnComparar(idA, idB){
  const A = rankAnMapa(idA), B = rankAnMapa(idB);
  const linhas = [];
  let entrou = 0, saiu = 0, sobeGrande = 0, caiGrande = 0, topNovo = 0, comum = 0;
  const abs = [];
  B.forEach((b,k)=>{
    const a = A.get(k);
    if(!a){ entrou++; linhas.push({ k, e:b.e, ra:null, rb:b.r, d:null, dec:b.dec, alim:b.alim, tipo:"entrou" }); if(b.r<=RANK_TOP) topNovo++; return; }
    comum++;
    const d = a.r - b.r;                      // positivo = subiu (rank menor é mais prioritário)
    abs.push(Math.abs(d));
    if(d>=RANK_SALTO) sobeGrande++;
    if(d<=-RANK_SALTO) caiGrande++;
    if(b.r<=RANK_TOP && a.r>RANK_TOP) topNovo++;
    linhas.push({ k, e:b.e, ra:a.r, rb:b.r, d, dec:b.dec, alim:b.alim, tipo: d>0?"subiu":d<0?"caiu":"igual" });
  });
  A.forEach((a,k)=>{ if(!B.has(k)){ saiu++; linhas.push({ k, e:a.e, ra:a.r, rb:null, d:null, dec:a.dec, alim:a.alim, tipo:"saiu" }); } });
  abs.sort((x,y)=>x-y);
  const mediana = abs.length ? abs[Math.floor(abs.length/2)] : 0;
  const mudouTop = [...B.values()].filter(b=>b.r<=RANK_TOP && (!A.has(String(b.e).trim().toUpperCase()) || A.get(String(b.e).trim().toUpperCase()).r>RANK_TOP)).length;
  const igualMesmaPos = linhas.filter(l=>l.d===0).length;
  return { linhas, entrou, saiu, sobeGrande, caiGrande, comum, mediana, mudouTop, igualMesmaPos, totA:A.size, totB:B.size };
}
function rankAnMudHtml(listas){
  const A = listas.find(l=>l.id===rankAn.mudA), B = listas.find(l=>l.id===rankAn.mudB);
  if(listas.length<2 || !A || !B){
    return `<div class="empty">${ic("empty")}<div>Para comparar é preciso ter pelo menos duas listas guardadas.</div></div>`;
  }
  const c = rankAnComparar(A.id, B.id);
  let vis = c.linhas.filter(l=>l.tipo!=="igual");
  const termos = rankAnTermos();
  if(termos.length) vis = c.linhas.filter(l=>rankAnBate(termos, l.e, l.alim));   // com busca, olha todos (inclusive os que não mudaram)
  else if(rankAn.mudFiltro==="top") vis = vis.filter(l=>(l.ra!=null && l.ra<=RANK_TOP) || (l.rb!=null && l.rb<=RANK_TOP));
  vis.sort((x,y)=>{
    const mx = (x.d==null) ? 9999 : Math.abs(x.d), my = (y.d==null) ? 9999 : Math.abs(y.d);
    return my-mx || (x.rb||x.ra) - (y.rb||y.ra);
  });
  const LIM = 250, mostra = vis.slice(0, LIM);
  const pctTop = Math.round(100*c.mudouTop/RANK_TOP);
  // volatilidade de todas as listas consecutivas
  const asc = listas;
  const pares = [];
  for(let i=1;i<asc.length;i++){ const r = rankAnComparar(asc[i-1].id, asc[i].id); pares.push({ de:asc[i-1], para:asc[i], r }); }
  const tipoPill = t => t==="subiu" ? `<span class="pill ok">subiu</span>` : t==="caiu" ? `<span class="pill bad">caiu</span>` : t==="entrou" ? `<span class="pill info">entrou na lista</span>` : t==="igual" ? `<span class="pill muted">mesma posição</span>` : `<span class="pill muted">saiu da lista</span>`;
  return `
    <p style="color:var(--muted); font-size:12.5px; margin:4px 0 12px;">Quanto a lista da engenharia mudou de uma versão para a outra. ▲ subiu = ficou mais prioritário (rank menor).</p>
    <div class="rk-filtros">
      <label>Lista anterior ${rankAnSeletorLista("rkMudA", rankAn.mudA, "rankAnSetMudA")}</label>
      <label>Lista nova ${rankAnSeletorLista("rkMudB", rankAn.mudB, "rankAnSetMudB")}</label>
    </div>
    <div class="rk-cards">
      ${rankAnCaixa(`Mudaram no Top ${RANK_TOP}`, `${c.mudouTop} <span class="rk-de">de ${RANK_TOP}</span>`, `${pctTop}% do Top ${RANK_TOP} da lista nova não estava no Top ${RANK_TOP} da anterior`, pctTop>=30 ? "rk-alerta" : "")}
      ${rankAnCaixa("Entraram na lista", c.entrou, "elementos novos")}
      ${rankAnCaixa("Saíram da lista", c.saiu, "elementos que deixaram de constar")}
      ${rankAnCaixa(`Subiram ${RANK_SALTO}+ posições`, c.sobeGrande, "")}
      ${rankAnCaixa(`Caíram ${RANK_SALTO}+ posições`, c.caiGrande, `mediana de mudança: ${c.mediana} posições`)}
    </div>
    <div class="rk-filtros">
      <label>Mostrar ${`<select onchange="rankAnSetMudFiltro(this.value)"><option value="top" ${rankAn.mudFiltro==="top"?"selected":""}>só quem tocou o Top ${RANK_TOP}</option><option value="todos" ${rankAn.mudFiltro==="todos"?"selected":""}>todas as mudanças</option></select>`}</label>
      <span style="color:var(--muted); font-size:12px;">${vis.length} elemento(s) · maiores mudanças primeiro</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Elemento</th><th>Alimentador</th><th>Rank anterior</th><th>Rank novo</th><th>Mudança</th><th>O que houve</th><th>OS pend.</th></tr></thead>
      <tbody>${mostra.map(l=>`<tr>
        <td class="mono">${escapeHtml(l.e)}</td><td>${escapeHtml(l.alim||"—")}</td>
        <td class="num">${l.ra!=null ? l.ra : "—"}</td><td class="num">${l.rb!=null ? l.rb : "—"}</td>
        <td>${rankAnDeltaHtml(l.d)}</td><td>${tipoPill(l.tipo)}</td>
        <td class="num">${rankAnPendHoje(l.k) || `<span style="color:var(--muted);">0</span>`}</td></tr>`).join("") || `<tr><td colspan="7"><div class="empty">${ic("empty")}<div>Nenhuma mudança com esse filtro.</div></div></td></tr>`}</tbody>
    </table></div>
    ${vis.length>LIM ? `<p style="color:var(--muted); font-size:11.5px; margin-top:6px;">Mostrando as ${LIM} maiores de ${vis.length}.</p>` : ""}
    ${pares.length>1 ? `
    <h3 style="margin:18px 0 8px;">Volatilidade entre listas seguidas</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>De</th><th>Para</th><th>Mudaram no Top ${RANK_TOP}</th><th>Entraram</th><th>Saíram</th><th>Subiram ${RANK_SALTO}+</th><th>Caíram ${RANK_SALTO}+</th></tr></thead>
      <tbody>${pares.slice().reverse().map(p=>`<tr><td>${escapeHtml(rankAnNomeLista(p.de))}</td><td>${escapeHtml(rankAnNomeLista(p.para))}</td>
        <td class="num"><b>${p.r.mudouTop}</b> / ${RANK_TOP}</td><td class="num">${p.r.entrou}</td><td class="num">${p.r.saiu}</td><td class="num">${p.r.sobeGrande}</td><td class="num">${p.r.caiGrande}</td></tr>`).join("")}</tbody>
    </table></div>` : ""}`;
}
function rankAnSetMudA(v){ rankAn.mudA = v; if(rankAn.mudA===rankAn.mudB){ const o = rankAnListasAsc().find(l=>l.id!==v); if(o) rankAn.mudB = o.id; } render(); }
function rankAnSetMudB(v){ rankAn.mudB = v; if(rankAn.mudA===rankAn.mudB){ const o = rankAnListasAsc().find(l=>l.id!==v); if(o) rankAn.mudA = o.id; } render(); }
function rankAnSetMudFiltro(v){ rankAn.mudFiltro = v; render(); }

/* ---------- 3) Aderência da programação ---------- */
/* Para cada programação (cancelada fora) com data de criação:
   - lista vigente = a última lista enviada ANTES de a programação ser criada;
   - "fila à frente" = elementos mais bem colocados nessa lista que, naquele dia, tinham OS pendente
     e ainda não tinham nenhuma programação;
   - fila à frente <= folga  => na ordem;  senão => furou a fila.
   O mesmo cálculo é refeito com a lista MAIS ATUAL: se pela lista de hoje ela estaria na ordem, a
   engenharia mudou a prioridade depois (o outro lado da história). */
const rankAnMemo = { chave:"", res:null };
function rankAnFilaAFrente(mapaLista, rAlvo, tMs, dia, limite){
  // percorre a lista em ordem de rank; para no primeiro excedente de "limite" (não precisa contar tudo)
  let n = 0; const nomes = [];
  for(const x of mapaLista){
    if(x.r >= rAlvo) break;
    const k = String(x.e).trim().toUpperCase();
    if(!rankAnTemPendenciaEm(k, dia)) continue;
    if(rankAnProgramadaAte(k, tMs)) continue;
    n++; if(nomes.length<3) nomes.push(x.e);
  }
  return { n, nomes };
}
function rankAnAderCalcular(listas){
  const chave = [rankAn.folga, listas.map(l=>l.id).join(","), (state.programacoes||[]).length, (state.manutencaoOS||[]).length].join("|");
  if(rankAnMemo.chave===chave) return rankAnMemo.res;
  const ultima = listas[listas.length-1];
  const arrUlt = (rankAn.itens[ultima.id] || []).slice().sort((a,b)=>a.r-b.r);
  const mapaUlt = rankAnMapa(ultima.id);
  const ordenadas = listas.map(l=>({ l, ms: Date.parse(l.enviadoEm), arr:(rankAn.itens[l.id]||[]).slice().sort((a,b)=>a.r-b.r), mapa: rankAnMapa(l.id) }));
  const res = { avaliadas:[], semLista:0, foraLista:0, semData:0, porLista:new Map() };
  (state.programacoes||[]).forEach(p=>{
    if(!p || p.status==="Cancelada" || !p.protecaoId) return;
    const t = Date.parse(p.criadoEm || "");
    if(isNaN(t)){ res.semData++; return; }
    let vig = null;
    for(const o of ordenadas){ if(!isNaN(o.ms) && o.ms<=t) vig = o; else break; }
    if(!vig){ res.semLista++; return; }
    const k = String(p.protecaoId).trim().toUpperCase();
    const it = vig.mapa.get(k);
    if(!it){ res.foraLista++; return; }
    const dia = rankAnDiaLocal(t);
    const f = rankAnFilaAFrente(vig.arr, it.r, t, dia);
    const itUlt = mapaUlt.get(k);
    const f2 = itUlt ? rankAnFilaAFrente(arrUlt, itUlt.r, t, dia) : null;
    const naOrdem = f.n <= rankAn.folga;
    const naOrdemHoje = f2 ? f2.n <= rankAn.folga : null;
    res.avaliadas.push({ p, k, vig:vig.l, r:it.r, fila:f, rHoje: itUlt ? itUlt.r : null, filaHoje:f2, naOrdem, naOrdemHoje });
    const pl = res.porLista.get(vig.l.id) || { l:vig.l, n:0, ok:0 };
    pl.n++; if(naOrdem) pl.ok++;
    res.porLista.set(vig.l.id, pl);
  });
  rankAnMemo.chave = chave; rankAnMemo.res = res;
  return res;
}
function rankAnAderHtml(listas){
  const r = rankAnAderCalcular(listas);
  const av = r.avaliadas;
  const ok = av.filter(x=>x.naOrdem), furou = av.filter(x=>!x.naOrdem);
  const furouMasHojeOk = furou.filter(x=>x.naOrdemHoje===true);
  const furouContinua = furou.filter(x=>x.naOrdemHoje===false);
  const furouNaoSeSabe = furou.filter(x=>x.naOrdemHoje===null);
  const pct = n => av.length ? Math.round(100*n/av.length) : 0;
  const termos = rankAnTermos();
  let vis = rankAn.aderFiltro==="furou" ? furou : av;
  if(termos.length){ vis = av.filter(x=>rankAnBate(termos, x.p.protecaoId, x.p.alimentador, x.p.polo, x.p.regional, x.p.localidade, x.p.numeroSIS)); }
  vis = vis.slice().sort((a,b)=>b.fila.n - a.fila.n || String(b.p.criadoEm).localeCompare(String(a.p.criadoEm)));
  const LIM = 250, mostra = vis.slice(0, LIM);
  const pill = x => x.naOrdem ? `<span class="pill ok">na ordem</span>`
    : x.naOrdemHoje===true ? `<span class="pill warn">furou · mas na lista de hoje estaria na ordem</span>`
    : `<span class="pill bad">furou a fila</span>`;
  const porLista = [...r.porLista.values()].sort((a,b)=>String(b.l.enviadoEm).localeCompare(String(a.l.enviadoEm)));
  return `
    <p style="color:var(--muted); font-size:12.5px; margin:4px 0 8px;">Cada programação criada é conferida contra a lista que <b>valia no momento em que ela foi criada</b>. Ela "fura a fila" quando, naquele dia, havia elementos mais bem colocados com OS pendente e ainda sem programação. A seguir se refaz a conta com a lista mais atual, para separar o que foi escolha da equipe do que foi troca de prioridade da engenharia.</p>
    <div class="rk-filtros">
      <label>Folga <select onchange="rankAnSetFolga(this.value)">${[0,3,5,10,20].map(n=>`<option value="${n}" ${n===rankAn.folga?"selected":""}>${n===0?"nenhuma (ordem estrita)":"até "+n+" elementos à frente"}</option>`).join("")}</select></label>
      <span style="color:var(--muted); font-size:12px;">A folga evita contar como erro a diferença de capacidade das equipes: quantos elementos mais prioritários ainda podem ficar sem programação.</span>
    </div>
    <div class="rk-cards">
      ${rankAnCaixa("Programações avaliadas", av.length, `${r.semLista} criadas antes da 1ª lista · ${r.foraLista} de elementos fora da lista${r.semData?` · ${r.semData} sem data`:""}`)}
      ${rankAnCaixa("Na ordem da lista vigente", `${ok.length} <span class="rk-de">${pct(ok.length)}%</span>`, "seguiram a prioridade que existia na hora", "rk-ok")}
      ${rankAnCaixa("Furaram a fila", `${furou.length} <span class="rk-de">${pct(furou.length)}%</span>`, "havia elementos mais prioritários pendentes e sem programação", furou.length ? "rk-alerta" : "")}
      ${rankAnCaixa("Mas pela lista de hoje estariam na ordem", furouMasHojeOk.length, "a prioridade mudou depois de programarem", "rk-info")}
      ${rankAnCaixa("Continuam fora da ordem", furouContinua.length, `${furouNaoSeSabe.length ? furouNaoSeSabe.length+" saíram da lista atual · " : ""}fora da ordem também pela lista de hoje`)}
    </div>
    ${porLista.length ? `
    <h3 style="margin:14px 0 8px;">Por lista vigente</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Lista que valia</th><th>Programações criadas sob ela</th><th>Na ordem</th><th>%</th></tr></thead>
      <tbody>${porLista.map(x=>`<tr><td>${escapeHtml(rankAnNomeLista(x.l))}</td><td class="num">${x.n}</td><td class="num">${x.ok}</td><td class="num"><b>${Math.round(100*x.ok/x.n)}%</b></td></tr>`).join("")}</tbody>
    </table></div>` : ""}
    <h3 style="margin:18px 0 8px;">Programações</h3>
    <div class="rk-filtros">
      <label>Mostrar <select onchange="rankAnSetAderFiltro(this.value)"><option value="furou" ${rankAn.aderFiltro==="furou"?"selected":""}>só as que furaram a fila</option><option value="todas" ${rankAn.aderFiltro==="todas"?"selected":""}>todas</option></select></label>
      <span style="color:var(--muted); font-size:12px;">${vis.length} programação(ões) · maior fila à frente primeiro</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Proteção</th><th>Programação</th><th>Criada em</th><th>Lista vigente</th><th>Rank na época</th><th>Fila à frente</th><th>Rank hoje</th><th>Fila hoje</th><th>Resultado</th></tr></thead>
      <tbody>${mostra.map(x=>`<tr>
        <td class="mono">${escapeHtml(x.p.protecaoId)}</td>
        <td>${x.p.dataInicio ? fmtDate(x.p.dataInicio) : "—"}</td>
        <td>${rankDataHora(x.p.criadoEm)}</td>
        <td>${rankDataHora(x.vig.enviadoEm)}</td>
        <td class="num">${x.r}</td>
        <td class="num" title="${escapeHtml(x.fila.nomes.length ? "À frente, sem programação: "+x.fila.nomes.join(", ")+(x.fila.n>x.fila.nomes.length?" …":"") : "")}">${x.fila.n ? `<b>${x.fila.n}</b>${x.fila.nomes.length ? `<div style="font-size:10.5px; color:var(--muted);">${escapeHtml(x.fila.nomes.join(", "))}${x.fila.n>x.fila.nomes.length?"…":""}</div>` : ""}` : "0"}</td>
        <td class="num">${x.rHoje!=null ? x.rHoje : "—"}</td>
        <td class="num">${x.filaHoje ? x.filaHoje.n : "—"}</td>
        <td>${pill(x)}</td></tr>`).join("") || `<tr><td colspan="9"><div class="empty">${ic("empty")}<div>Nenhuma programação com esse filtro.</div></div></td></tr>`}</tbody>
    </table></div>
    ${vis.length>LIM ? `<p style="color:var(--muted); font-size:11.5px; margin-top:6px;">Mostrando ${LIM} de ${vis.length}.</p>` : ""}
    <p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Como ler: "Fila à frente" são os elementos mais prioritários que naquele dia tinham OS pendente e nenhuma programação. É uma aproximação: o SPARK só sabe das OS e programações que estão nele; ocorrências fora do sistema (emergência, desligamento negado, falta de equipe no local) não aparecem.</p>`;
}
function rankAnSetFolga(v){ rankAn.folga = Number(v)||0; render(); }
function rankAnSetAderFiltro(v){ rankAn.aderFiltro = v; render(); }
