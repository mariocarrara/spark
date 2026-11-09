/* =========================================================================
   Histórico de podas por PLANO (v3.11.0)
   PLANO = 01/nov do ano anterior a 31/out do ano do plano (plano 2027 = 01/11/2026 a
   31/10/2027). O plano de cada OS vem da data de execução. O plano em aberto fica na base
   de hoje (Mapa de Manutenção); os planos fechados sobem aqui, um por vez, em
   Importação de Bases › "Podas — Executado histórico (SGM + MO)".
   Dados no Controller (/api/historico): a consulta é paginada NO SERVIDOR — o navegador
   nunca carrega as ~100 mil OS do plano, só a página que está na tela.
   Este arquivo tem 2 partes: (1) campos Plano/Modo da tela de importação; (2) a tela
   "Histórico de Podas" (menu), com busca, filtros, totais e download em CSV (abre no Excel).
   ========================================================================= */

function histPlanoDe(hoje){ const d = hoje || new Date(); return d.getMonth() >= 10 ? d.getFullYear()+1 : d.getFullYear(); }
function histPeriodoTxt(p){ return `01/11/${p-1} a 31/10/${p}`; }
function histNum(n, dec){ return Number(n||0).toLocaleString("pt-BR", { maximumFractionDigits: dec===undefined ? 2 : dec }); }

let histPlanos = [];           // planos guardados (índice leve: total, período, quando/quem enviou)
let histPlanosCarregados = false;

async function histCarregarPlanos(){
  if(!API_ONLINE){ histPlanos = []; histPlanosCarregados = true; return; }
  try{ histPlanos = await apiGet("/historico/planos", 30000) || []; }
  catch(e){ histPlanos = []; }
  histPlanosCarregados = true;
}

/* ---------------- parte 1: campos da tela de importação ---------------- */
let histImportPlano = histPlanoDe() - 1;   // sugestão: o plano que acabou de fechar
let histImportModo = "substituir";

function histImportCamposHtml(){
  const s = SCHEMAS[importSelecionada];
  if(!s || s.subtipo !== "historico") return "";
  return `<div id="histImportCampos" style="margin-bottom:14px; padding:12px 14px; border:1px solid var(--border,#e4e7ec); border-radius:10px;">
    <div class="field" style="margin:0 0 10px;">
      <label style="font-weight:600; font-size:12.5px; display:block; margin-bottom:4px;">Plano que está sendo enviado</label>
      <input type="number" min="2000" max="2100" step="1" value="${histImportPlano}" style="max-width:140px;" oninput="histImportSetPlano(this.value)">
    </div>
    <div id="histImportInfo" style="font-size:12px; color:var(--muted); margin-bottom:12px;">${histImportInfoHtml()}</div>
    <div style="font-weight:600; font-size:12.5px; margin-bottom:6px;">E se o plano já tiver OS?</div>
    <label style="display:flex; gap:8px; align-items:flex-start; font-size:12.5px; margin-bottom:6px; cursor:pointer;">
      <input type="radio" name="histModo" value="substituir" ${histImportModo==="substituir"?"checked":""} onchange="histImportSetModo('substituir')" style="margin-top:3px;">
      <span><b>Substituir</b> — apaga tudo que esse plano já tinha e grava só o que está nas planilhas.</span>
    </label>
    <label style="display:flex; gap:8px; align-items:flex-start; font-size:12.5px; cursor:pointer;">
      <input type="radio" name="histModo" value="acrescentar" ${histImportModo==="acrescentar"?"checked":""} onchange="histImportSetModo('acrescentar')" style="margin-top:3px;">
      <span><b>Acrescentar</b> — junta pelo número da OS: OS nova entra, OS que já existe é atualizada, nada duplica.</span>
    </label>
  </div>`;
}
function histImportInfoHtml(){
  const p = histImportPlano;
  if(!(p >= 2000 && p <= 2100)) return `<span style="color:var(--bad-fg);">Informe um plano válido (ex.: 2026).</span>`;
  const ja = histPlanos.find(x=>Number(x.plano)===p);
  return `Plano ${p} = <b>${histPeriodoTxt(p)}</b>. A OS entra pela <b>data de execução</b>; as que caírem fora desse período são rejeitadas e listadas no resumo.`
    + (ja ? `<br><span style="color:var(--warn-fg);">Esse plano já tem <b>${histNum(ja.total,0)}</b> OS no histórico (enviado em ${fmtDateTime(ja.atualizadoEm)}).</span>` : `<br>Esse plano ainda não está no histórico.`)
    + (p >= histPlanoDe() ? `<br><span style="color:var(--muted);">Obs.: o plano em aberto continua na base de hoje; este histórico é separado e não mexe nela.</span>` : "");
}
function histImportSetPlano(v){
  histImportPlano = parseInt(v, 10) || 0;
  const el = document.getElementById("histImportInfo"); if(el) el.innerHTML = histImportInfoHtml();
}
function histImportSetModo(m){ histImportModo = m; }
/* chamado ao escolher a base: monta os campos e busca os planos já guardados (pra avisar) */
async function histImportPrepararCampos(){
  const wrap = document.getElementById("histImportSlot"); if(!wrap) return;
  wrap.innerHTML = histImportCamposHtml();
  const s = SCHEMAS[importSelecionada];
  if(s && s.subtipo === "historico"){
    await histCarregarPlanos();
    const el = document.getElementById("histImportInfo"); if(el) el.innerHTML = histImportInfoHtml();
  }
}
/* antes de enviar: valida o plano e, se for substituir um plano que já existe, confirma */
function histImportConfirmar(){
  const p = histImportPlano;
  if(!(p >= 2000 && p <= 2100)){ toast("Informe o plano (ex.: 2026)."); return false; }
  const ja = histPlanos.find(x=>Number(x.plano)===p);
  if(ja && histImportModo === "substituir"){
    return confirm(`O plano ${p} já tem ${histNum(ja.total,0)} OS no histórico.\n\nSubstituir apaga tudo desse plano e grava só o que está nas planilhas que você enviou.\n\nContinuar?`);
  }
  return true;
}
function histImportResultadoHtml(r){
  const rej = Number(r.historicoForaDoPlano||0) + Number(r.historicoSemData||0);
  const fora = r.historicoForaPorPlano ? Object.keys(r.historicoForaPorPlano).sort().map(k=>`plano ${escapeHtml(k)}: ${histNum(r.historicoForaPorPlano[k],0)}`).join(" · ") : "";
  const amostra = (r.historicoAmostraRejeitadas||[]);
  return `
    <div class="note" style="margin-top:12px;">${ic("check")}<div>Plano <b>${r.historicoPlano}</b> (${histPeriodoTxt(r.historicoPlano)}) — ${histNum(r.totalPlotadas,0)} OS gravadas${r.historicoModo==="acrescentar" ? `: <b>${histNum(r.historicoNovas,0)}</b> novas e <b>${histNum(r.historicoAtualizadas,0)}</b> atualizadas` : ""}. O plano passou a ter <b>${histNum(r.historicoTotalNoPlano,0)}</b> OS.</div></div>
    <div class="table-wrap" style="margin-top:10px;"><table data-sort-manual>
      <thead><tr><th>Total na planilha</th><th>Fora do período do plano</th><th>Sem data de execução</th><th>Sem MO correspondente</th><th>Sem coordenada no SGM</th><th>Com posição aproximada*</th><th>Gravadas</th></tr></thead>
      <tbody><tr><td class="num">${histNum(r.executadoTotal,0)}</td><td class="num">${histNum(r.historicoForaDoPlano,0)}</td><td class="num">${histNum(r.historicoSemData,0)}</td><td class="num">${histNum(r.executadoSemMO,0)}</td><td class="num">${histNum(r.executadoSemCoordenada,0)}</td><td class="num">${histNum(r.executadoAproximadas,0)}</td><td class="num">${histNum(r.totalPlotadas,0)}</td></tr></tbody>
    </table></div>
    ${rej ? `<div class="note" style="margin-top:8px; background:var(--warn-bg); color:var(--warn-fg);">${ic("info")}<div><b>${histNum(rej,0)}</b> OS rejeitadas por data${fora ? ` (${fora})` : ""}. Se são de outro plano, envie-as em "Plano" certo.${amostra.length ? `<div style="font-size:11.5px; margin-top:6px;">Exemplos: ${amostra.map(escapeHtml).join(" · ")}</div>` : ""}</div></div>` : ""}
    <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">*OS sem coordenada no SGM ficam com posição aproximada (cidade/setor). Este histórico é separado: não entra nos alertas, no rank, nas programações nem no Mapa de Manutenção de hoje. Consulte em <b>Histórico de Podas</b> no menu.</p>`;
}

/* ---------------- parte 2: tela "Histórico de Podas" ---------------- */
let histPlano = 0;
let histFiltro = { q:"", status:"", tipo:"", alim:"", de:"", ate:"" };
let histPag = 1, histPorPag = 50;
let histDados = null, histCarregando = false, histErro = "", histSeq = 0, histBuscaTimer = null, histFacetasPlano = 0;

function viewHistoricoPagina(){
  return `<div id="histWrap"><div class="card"><p style="color:var(--muted); margin:0;">Carregando o histórico…</p></div></div>`;
}
async function historicoPaginaInit(){
  if(!API_ONLINE){ const w = document.getElementById("histWrap"); if(w) w.innerHTML = `<div class="card"><p style="color:var(--muted); margin:0;">Controller offline — abra o sistema pelo iniciar.bat para consultar o histórico.</p></div>`; return; }
  await histCarregarPlanos();
  if(!histPlanos.length){ histDados = null; histRedesenhar(); return; }
  if(!histPlanos.some(x=>Number(x.plano)===histPlano)) histPlano = Number(histPlanos[0].plano);
  histRedesenhar();
  histConsultar();
}
function histRedesenhar(){ const w = document.getElementById("histWrap"); if(w) w.innerHTML = histHtml(); }
function histQuery(extra){
  const p = new URLSearchParams({ plano: String(histPlano) });
  Object.keys(histFiltro).forEach(k=>{ const v = String(histFiltro[k]||"").trim(); if(v) p.set(k, v); });
  if(extra) Object.keys(extra).forEach(k=>p.set(k, String(extra[k])));
  return p.toString();
}
async function histConsultar(){
  const seq = ++histSeq;
  histCarregando = true; histErro = "";
  histResultadoRedesenhar();
  try{
    const d = await apiGet("/historico/os?" + histQuery({ pagina: histPag, porPagina: histPorPag }), 120000);
    if(seq !== histSeq) return;
    histDados = d;
    if(histFacetasPlano !== histPlano){ histFacetasPlano = histPlano; histCarregando = false; histRedesenhar(); return; } // 1ª vez do plano: monta os filtros com status/serviços reais
  }catch(e){
    if(seq !== histSeq) return;
    histErro = e.message || "Erro ao consultar.";
  }
  histCarregando = false;
  histResultadoRedesenhar();
}
function histResultadoRedesenhar(){ const r = document.getElementById("histResultado"); if(r) r.innerHTML = histResultadoHtml(); }
function histTrocarPlano(v){ histPlano = Number(v)||0; histPag = 1; histDados = null; histFacetasPlano = 0; histFiltro = { q:"", status:"", tipo:"", alim:"", de:"", ate:"" }; histRedesenhar(); histConsultar(); }
function histFiltrar(campo, v){
  histFiltro[campo] = v; histPag = 1;
  if(campo === "q" || campo === "alim"){ clearTimeout(histBuscaTimer); histBuscaTimer = setTimeout(histConsultar, 450); }
  else histConsultar();
}
function histPagina(n){ histPag = n; histConsultar(); }
function histPorPagina(v){ histPorPag = Number(v)||50; histPag = 1; histConsultar(); }
function histLimpar(){ histFiltro = { q:"", status:"", tipo:"", alim:"", de:"", ate:"" }; histPag = 1; histRedesenhar(); histConsultar(); }

async function histBaixar(){
  if(!histDados){ return; }
  const btn = document.getElementById("histBtnBaixar"); if(btn) btn.disabled = true;
  toast("Gerando o arquivo… pode levar alguns segundos num plano grande.");
  try{
    const txt = await apiGetTexto("/historico/exportar?" + histQuery(), 300000);
    const blob = new Blob([txt], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historico_podas_plano_${histPlano}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    toast(`Arquivo gerado — ${histNum(histDados.total,0)} OS. Abra no Excel.`);
  }catch(e){ toast("Não consegui gerar o arquivo: " + (e.message||e)); }
  finally{ if(btn) btn.disabled = false; }
}
async function histApagarPlano(){
  const m = histPlanos.find(x=>Number(x.plano)===histPlano); if(!m) return;
  if(!confirm(`Apagar o plano ${histPlano} do histórico (${histNum(m.total,0)} OS)?\n\nIsso não mexe na base de hoje. Para recuperar, é preciso subir as planilhas de novo.`)) return;
  try{
    await apiDelete("/historico/planos/" + histPlano, 60000);
    toast(`Plano ${histPlano} apagado do histórico.`);
    histDados = null; histFacetasPlano = 0;
    await historicoPaginaInit();
  }catch(e){ toast("Não consegui apagar: " + (e.message||e)); }
}

function histPill(st){
  const t = String(st||"");
  return `<span class="pill ${/^executad/i.test(t) ? "ok" : "warn"}">${escapeHtml(t||"—")}</span>`;
}
function histHtml(){
  if(!histPlanos.length){
    const pode = minhaPermissao("manutencao","importar");
    return `<div class="card"><h3>Histórico de Podas</h3><p style="color:var(--muted);">Nenhum plano foi enviado ainda.${pode ? " Envie em <b>Importação de Bases › Podas — Executado histórico (SGM + MO)</b>." : " Peça a quem administra para enviar."}</p>${pode?`<a class="btn btn-primary btn-sm" href="#importacao" onclick="importSelecionada='Podas — Executado histórico (SGM + MO)'">Ir para Importação</a>`:""}</div>`;
  }
  const m = histPlanos.find(x=>Number(x.plano)===histPlano) || histPlanos[0];
  const f = (histDados && histDados.filtros) || { status:[], tipos:[] };
  const opt = (lista, atual, rot)=>`<option value="">${rot}</option>` + lista.map(x=>`<option value="${escapeHtml(x)}" ${x===atual?"selected":""}>${escapeHtml(x)}</option>`).join("");
  const podeApagar = minhaPermissao("manutencao","importar") && minhaPermissao("manutencao","editar");
  return `<div class="card">
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
      <div class="field" style="margin:0;"><label style="font-size:11.5px; color:var(--muted); display:block;">Plano</label>
        <select onchange="histTrocarPlano(this.value)">${histPlanos.map(x=>`<option value="${x.plano}" ${Number(x.plano)===histPlano?"selected":""}>Plano ${x.plano} · ${histNum(x.total,0)} OS</option>`).join("")}</select></div>
      <div style="font-size:12px; color:var(--muted); flex:1; min-width:240px;">${histPeriodoTxt(m.plano)} · enviado em ${fmtDateTime(m.atualizadoEm)}</div>
      <button type="button" class="btn btn-primary btn-sm" id="histBtnBaixar" onclick="histBaixar()">Baixar Excel (CSV)</button>
      ${podeApagar ? `<button type="button" class="btn btn-ghost btn-sm" onclick="histApagarPlano()">Apagar plano</button>` : ""}
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-top:12px;">
      <div class="field" style="margin:0; flex:1; min-width:240px;"><input type="search" value="${escapeHtml(histFiltro.q)}" placeholder="Buscar: nº da OS, alimentador, localidade, trecho, poste, esquema…" oninput="histFiltrar('q', this.value)"></div>
      <div class="field" style="margin:0;"><select onchange="histFiltrar('status', this.value)">${opt(f.status, histFiltro.status, "Todos os status")}</select></div>
      <div class="field" style="margin:0;"><select onchange="histFiltrar('tipo', this.value)">${opt(f.tipos, histFiltro.tipo, "Todos os serviços")}</select></div>
      <div class="field" style="margin:0; max-width:150px;"><input type="search" value="${escapeHtml(histFiltro.alim)}" placeholder="Alimentador" oninput="histFiltrar('alim', this.value)"></div>
      <div class="field" style="margin:0;"><label style="font-size:11px; color:var(--muted); display:block;">Execução de</label><input type="date" value="${escapeHtml(histFiltro.de)}" min="${m.plano-1}-11-01" max="${m.plano}-10-31" onchange="histFiltrar('de', this.value)"></div>
      <div class="field" style="margin:0;"><label style="font-size:11px; color:var(--muted); display:block;">até</label><input type="date" value="${escapeHtml(histFiltro.ate)}" min="${m.plano-1}-11-01" max="${m.plano}-10-31" onchange="histFiltrar('ate', this.value)"></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="histLimpar()">Limpar</button>
    </div>
    <div id="histResultado">${histResultadoHtml()}</div>
  </div>`;
}
function histResultadoHtml(){
  if(histErro) return `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>${escapeHtml(histErro)}</div></div>`;
  if(!histDados) return `<p style="color:var(--muted); margin:14px 0 0;">Carregando…</p>`;
  const d = histDados, r = d.resumo || {};
  const kpi = (n,t)=>`<div class="pill info" style="font-size:12.5px; padding:6px 13px;"><b>${n}</b>&nbsp;${t}</div>`;
  const porStatus = Object.keys(r.porStatus||{}).sort().map(k=>kpi(histNum(r.porStatus[k],0), escapeHtml(k||"sem status"))).join("");
  const linhas = d.itens.map(o=>{
    const mapa = (o.lat!=null && o.lng!=null) ? ` <a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener" title="Abrir no Google Maps${o.aproximada?" (posição aproximada)":""}">${o.aproximada?"~":""}mapa</a>` : "";
    const pr = (p,rl)=> (Number(p)||Number(rl)) ? `${histNum(p)} / ${histNum(rl)}` : "—";
    return `<tr><td class="mono">${escapeHtml(String(o.id).trim())}</td><td>${histPill(o.statusOS)}</td><td>${escapeHtml(o.tipoServico||"")}</td><td>${fmtDate(o.dataExecucao)}</td><td>${escapeHtml(o.alimentador||"")}</td><td>${escapeHtml(o.localidade||"")}</td><td class="num">${pr(o.previstoPoda,o.realizadoPoda)}</td><td class="num">${pr(o.previstoLimpeza,o.realizadoLimpeza)}</td><td class="num">${pr(o.previstoEstrutura,o.realizadoEstrutura)}</td><td>${escapeHtml(o.equipeId||"")}</td><td>${escapeHtml(o.descEsquema||"")}${mapa}</td></tr>`;
  }).join("");
  const pag = d.paginas > 1
    ? `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${d.pagina<=1?"disabled":""} onclick="histPagina(${d.pagina-1})">‹ Anterior</button><span>Página ${d.pagina} de ${d.paginas}</span><button type="button" class="btn btn-ghost btn-sm" ${d.pagina>=d.paginas?"disabled":""} onclick="histPagina(${d.pagina+1})">Próxima ›</button></div>` : "";
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:14px 0 8px; ${histCarregando?"opacity:.55;":""}">
      ${kpi(histNum(d.total,0), d.total===d.totalPlano ? "OS no plano" : `OS no filtro (de ${histNum(d.totalPlano,0)})`)}${porStatus}
      ${kpi(histNum(r.realizadoPoda), "poda realizada")}${kpi(histNum(r.realizadoLimpeza), "m² de limpeza realizados")}${kpi(histNum(r.realizadoEstrutura), "estrutura realizada")}
      <span style="margin-left:auto; font-size:12px; color:var(--muted);">Por página: <select onchange="histPorPagina(this.value)">${[25,50,100,200].map(n=>`<option ${n===histPorPag?"selected":""}>${n}</option>`).join("")}</select></span>
    </div>
    ${d.itens.length ? `<div class="table-wrap" style="${histCarregando?"opacity:.55;":""}"><table data-sort-manual style="width:100%; font-size:12px;">
      <thead><tr><th>OS</th><th>Status</th><th>Serviço</th><th>Execução</th><th>Alimentador</th><th>Localidade</th><th style="text-align:right;">Poda prev/real</th><th style="text-align:right;">Limpeza m² prev/real</th><th style="text-align:right;">Estrutura prev/real</th><th>Equipe</th><th>Esquema</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>${pag}` : `<div class="empty" style="margin-top:12px;">${ic("empty")}<div>Nenhuma OS com esses filtros.</div></div>`}`;
}


/* =============================================================================
   v3.14.0 - OS de planos anteriores (histórico) no MAPA DE MANUTENÇÃO
   Padrão: nada muda (só a base atual). No filtro "Plano" (grupo Datas) o usuário marca um ou mais
   planos do histórico; o plano vem inteiro do Controller (GET /historico/mapa) e entra SÓ na lista
   do mapa (osMapaBase) - Alertas, Produtividade, Programação etc. continuam só com a base atual.
   OS que já existe na base atual não duplica. Não tem anel de APP/RL (o índice cobre só a base atual).
   ============================================================================= */
const histMapa = { atual:true, planos:null, carregandoPlanos:false, sel:new Set(), dados:{}, carregando:new Set(), base:null, baseRef:null, baseSig:"" };

function osMapaBase(){
  const live = state.manutencaoOS;
  if(!histMapa.sel.size) return live;
  const planos = Array.from(histMapa.sel).filter(p=>histMapa.dados[p]).sort();
  if(!planos.length) return live;
  const sig = planos.join(",") + (histMapa.atual ? "" : "|sem-atual");
  if(histMapa.base && histMapa.baseRef === live && histMapa.baseSig === sig) return histMapa.base;
  const ids = new Set(); if(histMapa.atual) live.forEach(o=>ids.add(String(o.id).trim()));
  const saida = histMapa.atual ? live.slice() : [];
  planos.forEach(p=>{ histMapa.dados[p].forEach(o=>{ const k = String(o.id).trim(); if(!ids.has(k)){ ids.add(k); saida.push(o); } }); });
  histMapa.base = saida; histMapa.baseRef = live; histMapa.baseSig = sig;
  return saida;
}
function histMapaPopupLinha(o){
  if(!o || !o._hist) return "";
  return `<p style="margin:0 0 6px; padding:3px 7px; border-radius:4px; background:#475467; color:#fff; font-size:11.5px;">Histórico · plano ${escapeHtml(String(o._plano))}</p>`;
}
function histMapaPlanoHtml(){
  if(typeof API_ONLINE !== "undefined" && !API_ONLINE) return "";
  if(histMapa.planos === null && !histMapa.carregandoPlanos){
    histMapa.carregandoPlanos = true;
    apiGet("/historico/planos").then(l=>{ histMapa.planos = Array.isArray(l) ? l : []; }).catch(()=>{ histMapa.planos = []; })
      .then(()=>{ histMapa.carregandoPlanos = false; if(histMapa.planos.length) render(); });
  }
  const lista = (histMapa.planos || []).slice().sort((a,b)=>b.plano - a.plano);
  if(!lista.length) return "";
  const opcoes = [{ v:"atual", t:"Atual (vigente)" }].concat(lista.map(p=>({ v:String(p.plano), t:`Plano ${p.plano} · ${Number(p.total||0).toLocaleString("pt-BR")} OS` })));
  const marcados = new Set(histMapa.sel); if(histMapa.atual) marcados.add("atual");
  const nHist = histMapa.sel.size;
  const resumo = !nHist ? "Só o atual (vigente)" : (nHist===1 ? (histMapa.atual ? "Atual + plano " : "Só plano ") + Array.from(histMapa.sel)[0] : (histMapa.atual ? "Atual + " : "") + nHist + " planos anteriores");
  const carregando = Array.from(histMapa.carregando);
  return multiComboHtml("f_plano_hist", "Plano (histórico no mapa)", opcoes, marcados, "toggleFiltroPlanoHist", "limparFiltroPlanoHist", "", "", { semTodos:true, resumo, limparTxt:"Voltar ao padrão" })
    + (carregando.length
      ? `<p style="color:var(--accent); font-size:11.5px; line-height:1.4; margin:2px 0 16px;">Carregando plano ${carregando.join(", ")}… (pode levar alguns segundos)</p>`
      : `<p style="color:var(--muted); font-size:11.5px; line-height:1.4; margin:2px 0 16px;">Padrão: só o plano atual. Marque um plano anterior para ver e buscar as OS dele no mapa${histMapa.sel.size>2 ? " — muitos planos juntos deixam o mapa pesado" : ""}.</p>`);
}
async function toggleFiltroPlanoHist(v, marcado){
  const k = String(v);
  if(k === "atual"){
    if(!marcado && !histMapa.sel.size){ render(); return; }   /* o mapa nunca fica sem nenhum plano */
    histMapa.atual = !!marcado; histMapa.base = null; tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); return;
  }
  if(!marcado){ histMapa.sel.delete(k); if(!histMapa.sel.size) histMapa.atual = true; tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); return; }
  histMapa.sel.add(k);
  tabelaOsPagina = 1; mapaPainelAba = "filtros";
  if(histMapa.dados[k]){ render(); return; }
  const ok = await histCarregarPlano(k);
  if(!ok){ histMapa.sel.delete(k); if(!histMapa.sel.size) histMapa.atual = true; }
  else if(histMapa.sel.size > 2) toast("Vários planos no mapa ao mesmo tempo podem deixar a tela pesada.");
  render();
}
/* carrega um plano para histMapa.dados (uma vez só); devolve true/false */
async function histCarregarPlano(k){
  k = String(k);
  if(histMapa.dados[k]) return true;
  if(histMapa.carregando.has(k)) return false;
  histMapa.carregando.add(k); render();
  try{
    const raw = await apiGet(`/historico/mapa?plano=${encodeURIComponent(k)}`, 900000);
    histMapa.dados[k] = (Array.isArray(raw) ? raw : []).map(r=>{ const x = mapOsRaw(r); x._hist = true; x._plano = Number(k); return x; });
    histMapa.base = null; histProd.ref = null;
    histMapa.carregando.delete(k);
    return true;
  }catch(err){
    histMapa.carregando.delete(k);
    toast(`Não consegui carregar o plano ${k}: ${err.message}`);
    return false;
  }
}
function limparFiltroPlanoHist(){
  histMapa.sel.clear(); histMapa.atual = true; histMapa.base = null; tabelaOsPagina = 1; mapaPainelAba = "filtros"; render();
}


/* =============================================================================
   v3.15.0 - Visão Geral / Produtividade enxergam os planos antigos
   Plano N = 01/11/(N-1) a 31/10/N. Ao escolher um ano/mês da Visão Geral, os planos que cobrem aquele
   período são carregados sozinhos (uma vez) e entram SÓ na produção executada (osProducaoBase).
   Pendências, atrasos e programação continuam só com a base atual.
   ============================================================================= */
const histProd = { ref:null, sig:"", arr:null, falhou:new Set() };
function osProducaoBase(){
  const live = state.manutencaoOS;
  const ks = Object.keys(histMapa.dados).sort();
  if(!ks.length) return live;
  const sig = ks.join(",");
  if(histProd.arr && histProd.ref === live && histProd.sig === sig) return histProd.arr;
  const ids = new Set(); live.forEach(o=>ids.add(String(o.id).trim()));
  const saida = live.slice();
  ks.forEach(k=>histMapa.dados[k].forEach(o=>{ if(o.statusOS !== "Executada") return; const i = String(o.id).trim(); if(!ids.has(i)){ ids.add(i); saida.push(o); } }));
  histProd.ref = live; histProd.sig = sig; histProd.arr = saida;
  return saida;
}
function histGarantirListaPlanos(){
  if(typeof API_ONLINE !== "undefined" && !API_ONLINE) return;
  if(histMapa.planos === null && !histMapa.carregandoPlanos){
    histMapa.carregandoPlanos = true;
    apiGet("/historico/planos").then(l=>{ histMapa.planos = Array.isArray(l) ? l : []; }).catch(()=>{ histMapa.planos = []; })
      .then(()=>{ histMapa.carregandoPlanos = false; render(); });
  }
}
/* meses (AAAA-MM) cobertos pelos planos anteriores já listados */
function histMesesDosPlanos(){
  histGarantirListaPlanos();
  const r = [];
  (histMapa.planos || []).forEach(p=>{ const n = Number(p.plano); if(!n) return;
    for(let i=0;i<12;i++){ const m = 11 + i, ano = n - 1 + Math.floor((m-1)/12), mes = ((m-1)%12)+1; r.push(`${ano}-${String(mes).padStart(2,"0")}`); } });
  return r;
}
/* planos necessários para um período (ano "2025" ou mês "2025-03") */
function histPlanosDoPeriodo(per){
  per = String(per);
  if(per.length === 4){ const a = Number(per); return [a, a+1]; }
  const a = Number(per.slice(0,4)), m = Number(per.slice(5,7));
  return [m >= 11 ? a+1 : a];
}
function histGarantirPeriodo(per){
  histGarantirListaPlanos();
  if(!histMapa.planos || !histMapa.planos.length) return;
  histPlanosDoPeriodo(per).forEach(n=>{
    const k = String(n);
    if(!histMapa.planos.some(p=>String(p.plano) === k)) return;   // não é plano antigo: está na base atual
    if(histMapa.dados[k] || histMapa.carregando.has(k) || histProd.falhou.has(k)) return;
    histCarregarPlano(k).then(ok=>{ if(!ok) histProd.falhou.add(k); render(); });
  });
}
function histGeralAviso(){
  const c = Array.from(histMapa.carregando);
  return c.length ? `<span class="pill warn" title="Buscando as OS executadas do plano antigo">carregando plano ${c.join(", ")}…</span>` : "";
}
