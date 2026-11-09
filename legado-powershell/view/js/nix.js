/* =========================================================================
   v3.10.0 - PONTOS NIX
   NIX = ponto estimado (por cálculo) onde a rede parou. A planilha traz o elemento/proteção, o PPF (possível ponto de falha) e até 2
   coordenadas "lat,long". Aqui:
     - a base fica no Controller (GET/POST/PUT/DELETE /api/nix) e cada envio SUBSTITUI o anterior (sem histórico);
     - no Mapa de Manutenção entra a camada "Pontos Nix" (ligada por padrão): bolinha pulsando + círculo com o raio de alerta;
       ao clicar, o popup lista as OS NÃO executadas dentro do raio;
     - a aba "Nix" do menu Configuração envia a planilha, mostra a base atual e ajusta o raio.
   Este arquivo carrega ANTES do app.js; só usa funções/variáveis do app.js na hora de rodar.
   ========================================================================= */
const NIX_RAIO_PADRAO = 500;
let nixBase = { meta:null, itens:[] };
let nixCarregada = false;
let nixPromessa = null;
let nixPreview = null;          // planilha lida, esperando confirmação de envio
let nixFocoPendente = null;     // [lat,lng] para centralizar ao abrir o mapa
let nixBusca = "", nixPag = 1;
const NIX_POR_PAGINA = 15;

function nixRaioM(){ const r = nixBase.meta && Number(nixBase.meta.raioM); return r >= 10 ? r : NIX_RAIO_PADRAO; }

function nixCarregar(forcar){
  if(nixPromessa && !forcar) return nixPromessa;
  nixPromessa = (async()=>{
    if(typeof API_ONLINE !== "undefined" && API_ONLINE && minhaPermissao("nix","visualizar")){
      try{
        const r = await apiGet("/nix");
        nixBase = { meta:(r && r.meta) || null, itens:Array.isArray(r && r.itens) ? r.itens : [] };
      }catch(e){ nixBase = { meta:null, itens:[] }; }
    }
    nixCarregada = true;
    return nixBase;
  })();
  return nixPromessa;
}

/* ---------- leitura da planilha ---------- */
function nixNorm(t){ return String(t==null?"":t).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]/g,""); }
const NIX_COLUNAS = { elemento:"e", ranque:"rk", trecho:"trecho", alimentador:"alim", regional:"reg", conjunto:"conj", tensao:"tensao", datahora:"dh", ppf:"ppf", latlong1:"ll1", latlong2:"ll2" };
function nixParsePonto(t){
  const m = String(t||"").match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if(!m) return null;
  const la = parseFloat(m[1].replace(",",".")), lo = parseFloat(m[2].replace(",","."));
  if(!isFinite(la) || !isFinite(lo) || Math.abs(la)>90 || Math.abs(lo)>180 || (la===0 && lo===0)) return null;
  return { lat:la, lng:lo };
}
async function nixLerArquivo(file){
  if(typeof XLSX === "undefined") throw new Error("Biblioteca de planilha não carregou. Atualize a página.");
  const wb = XLSX.read(await file.arrayBuffer(), { type:"array" });
  for(const nomeAba of wb.SheetNames){
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header:1, raw:false, defval:"" });
    // acha a linha de cabeçalho (a que tem "Elemento") nas primeiras 8 linhas
    let hi = -1;
    for(let i=0; i<Math.min(8, linhas.length); i++){ if(linhas[i].some(c=>nixNorm(c)==="elemento")) { hi = i; break; } }
    if(hi < 0) continue;
    const mapa = {};
    linhas[hi].forEach((c,idx)=>{ const k = NIX_COLUNAS[nixNorm(c)]; if(k && mapa[k]===undefined) mapa[k] = idx; });
    const faltam = ["e","ppf","ll1"].filter(k=>mapa[k]===undefined);
    if(faltam.length) continue;
    const itens = [];
    for(let i=hi+1; i<linhas.length; i++){
      const l = linhas[i];
      const o = {}; Object.values(NIX_COLUNAS).forEach(k=>{ o[k] = mapa[k]===undefined ? "" : String(l[mapa[k]]==null?"":l[mapa[k]]).trim(); });
      if(!o.e && !o.ll1 && !o.ll2) continue;       // linha totalmente vazia
      itens.push(o);
    }
    return { arquivo:file.name, aba:nomeAba, itens };
  }
  throw new Error("Não encontrei a linha de cabeçalho com 'Elemento', 'PPF' e 'Lat,Long 1' em nenhuma aba.");
}
async function nixArquivoSelecionado(input){
  const f = input.files && input.files[0];
  if(!f) return;
  try{
    const r = await nixLerArquivo(f);
    const validas = r.itens.filter(o=>o.e && (nixParsePonto(o.ll1) || nixParsePonto(o.ll2)));
    nixPreview = { ...r, validas:validas.length, semCoord:r.itens.length - validas.length };
  }catch(err){ nixPreview = { erro:err.message }; }
  input.value = "";
  nixRedesenhar();
}
async function nixEnviar(){
  if(!nixPreview || nixPreview.erro) return;
  if(!window.confirm(`Substituir a base de Nix atual por esta planilha (${nixPreview.validas} linha(s) com coordenada)?`)) return;
  try{
    if(API_ONLINE){
      const r = await apiSend("POST", "/nix", { arquivo:nixPreview.arquivo, aba:nixPreview.aba, itens:nixPreview.itens });
      nixPromessa = null; await nixCarregar(true);
      toast(`Base de Nix atualizada: ${r.validas} linha(s)${r.rejeitadas?`, ${r.rejeitadas} sem coordenada ignorada(s)`:""}.`);
    } else {
      nixBase = { meta:{ arquivo:nixPreview.arquivo, aba:nixPreview.aba, linhas:nixPreview.validas, enviadoEm:new Date().toISOString(), enviadoPorNome:"(demonstração)", raioM:nixRaioM() },
        itens:nixPreview.itens.filter(o=>o.e).map(o=>({ ...o, pontos:[nixParsePonto(o.ll1), nixParsePonto(o.ll2)].filter(Boolean) })).filter(o=>o.pontos.length) };
      toast("Base de Nix carregada (modo demonstração).");
    }
    nixPreview = null; nixPag = 1; nixRedesenhar();
  }catch(err){ toast(`Erro ao enviar: ${err.message}`); }
}
async function nixApagar(){
  if(!window.confirm("Apagar a base de Nix atual? Os pontos somem do mapa.")) return;
  try{
    if(API_ONLINE){ await apiDelete("/nix"); nixPromessa = null; await nixCarregar(true); } else nixBase = { meta:null, itens:[] };
    toast("Base de Nix apagada."); nixRedesenhar();
  }catch(err){ toast(`Erro: ${err.message}`); }
}
async function nixSalvarRaio(){
  const v = parseInt((document.getElementById("nixRaioInput")||{}).value, 10);
  if(!(v>=10 && v<=5000)){ toast("Use um raio de 10 a 5000 metros."); return; }
  try{
    if(API_ONLINE){ await apiSend("PUT", "/nix", { raioM:v }); nixPromessa = null; await nixCarregar(true); }
    else nixBase.meta = { ...(nixBase.meta||{}), raioM:v };
    toast(`Raio do alerta Nix: ${v} m.`); nixRedesenhar();
  }catch(err){ toast(`Erro ao salvar: ${err.message}`); }
}

/* ---------- aba "Nix" da Configuração ---------- */
function nixRedesenhar(){ const w = document.getElementById("nixConfigWrap"); if(w) w.innerHTML = nixConfigHtml(); }
function nixAbrirPeloMenu(){ return nixCarregar().then(nixRedesenhar); }
function nixBuscar(v){ nixBusca = v; nixPag = 1; nixRedesenharTabela(); }
function nixIrPagina(n){ nixPag = n; nixRedesenharTabela(); }
function nixRedesenharTabela(){ const w = document.getElementById("nixTabelaWrap"); if(w) w.innerHTML = nixTabelaHtml(); }
function nixFmtData(iso){ try{ return new Date(iso).toLocaleString("pt-BR"); }catch(e){ return iso||""; } }
function nixTabelaHtml(){
  const q = nixBusca.trim().toUpperCase();
  const comIdx = nixBase.itens.map((o,i)=>({o,i}));
  const lista = q ? comIdx.filter(({o})=>[o.e,o.alim,o.reg,o.conj,o.ppf,o.trecho,o.dh].some(v=>String(v||"").toUpperCase().includes(q))) : comIdx;
  const totalPag = Math.max(1, Math.ceil(lista.length/NIX_POR_PAGINA));
  if(nixPag > totalPag) nixPag = totalPag;
  const pag = lista.slice((nixPag-1)*NIX_POR_PAGINA, nixPag*NIX_POR_PAGINA);
  const linhas = pag.map(({o,i})=>`<tr>
      <td class="mono"><b>${escapeHtml(o.e)}</b></td><td>${escapeHtml(o.trecho||"")}</td><td>${escapeHtml(o.alim||"")}</td><td>${escapeHtml(o.reg||"")}</td><td>${escapeHtml(o.conj||"")}</td>
      <td style="white-space:nowrap;">${escapeHtml(o.dh||"")}</td><td style="min-width:260px; font-size:12px;">${escapeHtml(o.ppf||"")}</td>
      <td style="text-align:center;">${(o.pontos||[]).length}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="nixVerNoMapa(${i})">${ic("map")||""} Ver no mapa</button></td></tr>`).join("");
  return `<div class="table-wrap"><table data-sort-manual>
      <thead><tr><th>Elemento</th><th>Trecho</th><th>Alimentador</th><th>Regional</th><th>Conjunto</th><th>Data-Hora</th><th>PPF</th><th>Pontos</th><th></th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="9" style="text-align:center; color:var(--muted); padding:16px;">${q ? "Nenhum Nix encontrado para essa busca." : "Nenhuma base de Nix enviada ainda."}</td></tr>`}</tbody></table></div>
    ${lista.length > NIX_POR_PAGINA ? `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${nixPag<=1?"disabled":""} onclick="nixIrPagina(${nixPag-1})">‹ Anterior</button><span>Página ${nixPag} de ${totalPag} · ${lista.length.toLocaleString("pt-BR")} Nix</span><button type="button" class="btn btn-ghost btn-sm" ${nixPag>=totalPag?"disabled":""} onclick="nixIrPagina(${nixPag+1})">Próxima ›</button></div>` : ""}`;
}
function nixConfigHtml(){
  const pode = minhaPermissao("manutencao","importar"), dis = pode ? "" : "disabled";
  const m = nixBase.meta;
  const status = (m && m.enviadoEm)
    ? `<p style="margin:0 0 4px;"><strong>${escapeHtml(m.arquivo||"planilha")}</strong>${m.aba?` · aba ${escapeHtml(m.aba)}`:""}</p>
       <p style="margin:0; color:var(--muted); font-size:12.5px;">Enviada em ${escapeHtml(nixFmtData(m.enviadoEm))} por ${escapeHtml(m.enviadoPorNome||"—")} · ${(m.linhas||nixBase.itens.length).toLocaleString("pt-BR")} Nix · ${(m.pontos||0).toLocaleString("pt-BR")} ponto(s)${m.rejeitadas?` · ${m.rejeitadas} linha(s) sem coordenada ignorada(s)`:""}</p>`
    : `<p style="margin:0; color:var(--muted);">Nenhuma base de Nix enviada ainda.</p>`;
  const prev = !nixPreview ? "" : nixPreview.erro
    ? `<p style="color:var(--bad-fg); margin:10px 0 0;">${escapeHtml(nixPreview.erro)}</p>`
    : `<div class="card" style="margin-top:10px; background:var(--surface-2);">
        <p style="margin:0 0 6px;"><strong>${escapeHtml(nixPreview.arquivo)}</strong> · aba ${escapeHtml(nixPreview.aba)}</p>
        <p style="margin:0 0 8px; font-size:12.5px;">${nixPreview.itens.length.toLocaleString("pt-BR")} linha(s) lidas · <b style="color:var(--ok-fg);">${nixPreview.validas.toLocaleString("pt-BR")} com coordenada</b>${nixPreview.semCoord?` · <span style="color:var(--warn-fg);">${nixPreview.semCoord.toLocaleString("pt-BR")} sem coordenada (serão ignoradas)</span>`:""}</p>
        <div style="display:flex; gap:8px;"><button class="btn btn-primary btn-sm" ${nixPreview.validas?"":"disabled"} onclick="nixEnviar()">Enviar e substituir a base atual</button><button class="btn btn-ghost btn-sm" onclick="nixPreview=null; nixRedesenhar()">Cancelar</button></div>
      </div>`;
  return `
    <div class="card" style="margin-bottom:14px;">
      <h3>Pontos Nix</h3>
      <p style="color:var(--muted); font-size:12.5px; margin:0 0 10px;">Ponto estimado onde a rede parou. Aparece no Mapa de Manutenção como uma bolinha pulsando, com um círculo em volta; ao clicar, mostra as OS (não executadas) dentro do raio. Cada planilha enviada <b>substitui</b> a anterior.</p>
      <div style="margin-bottom:12px;">${status}</div>
      ${pode ? `<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <label class="btn btn-primary btn-sm" style="cursor:pointer;">${ic("upload")||""} Escolher planilha de Nix (.xlsx)<input type="file" accept=".xlsx,.xls" style="display:none;" onchange="nixArquivoSelecionado(this)"></label>
        ${(m && m.enviadoEm) ? `<button class="btn btn-ghost btn-sm" onclick="nixApagar()">Apagar base</button>` : ""}
      </div>${prev}` : `<p style="color:var(--muted); font-size:12.5px;">Seu perfil só pode visualizar.</p>`}
      <div class="field" style="margin-top:14px;"><label>Raio de alerta em volta de cada ponto (metros)</label>
        <div style="display:flex; gap:8px; align-items:center;"><input type="number" id="nixRaioInput" min="10" max="5000" step="10" value="${nixRaioM()}" ${dis} style="max-width:140px;">
        ${pode ? `<button class="btn btn-ghost btn-sm" onclick="nixSalvarRaio()">Salvar raio</button>` : ""}</div>
        <p style="color:var(--muted); font-size:11.5px; margin:4px 0 0;">Padrão: ${NIX_RAIO_PADRAO} m. Vale para o círculo no mapa e para a lista de OS no popup.</p></div>
    </div>
    <div class="card"><h3 style="margin-top:0;">Base atual</h3>
      <div class="usr-busca"><input type="search" placeholder="Buscar Nix: elemento, alimentador, regional, conjunto, PPF…" value="${escapeHtml(nixBusca)}" oninput="nixBuscar(this.value)"></div>
      <div id="nixTabelaWrap">${nixTabelaHtml()}</div></div>`;
}
function nixConfigConteudoHtml(){
  return `<div id="nixConfigWrap">${nixConfigHtml()}</div>`;
}
function nixVerNoMapa(i){
  const o = nixBase.itens[i]; if(!o || !(o.pontos||[]).length) return;
  nixFocoPendente = o.pontos.map(p=>[p.lat,p.lng]);
  location.hash = "#manutencao";
}

/* ---------- camada no mapa ---------- */
function nixDistM(lat1,lng1,lat2,lng2){
  const R = 6371000, r = Math.PI/180, dLa = (lat2-lat1)*r, dLo = (lng2-lng1)*r;
  const a = Math.sin(dLa/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
/* OS NÃO executadas (e com coordenada) dentro do raio de qualquer ponto deste Nix; devolve as mais próximas primeiro */
function nixOSProximas(item, raio, todas){
  const out = new Map();
  const grau = raio/111000 + 0.0005;
  (state.manutencaoOS||[]).forEach(o=>{
    if(typeof o.lat !== "number" || typeof o.lng !== "number") return;
    if(!todas && String(o.statusOS||"").toLowerCase().indexOf("executad") === 0) return;
    for(const p of item.pontos||[]){
      if(Math.abs(o.lat-p.lat) > grau || Math.abs(o.lng-p.lng)/Math.max(.2,Math.cos(p.lat*Math.PI/180)) > grau) continue;
      const d = nixDistM(p.lat,p.lng,o.lat,o.lng);
      if(d <= raio){ const a = out.get(o.id); if(!a || d < a.d) out.set(o.id, { o, d }); }
    }
  });
  return [...out.values()].sort((a,b)=>a.d-b.d);
}
function nixPopupHtml(item){
  const raio = nixRaioM(), lista = nixOSProximas(item, raio), MAX = 12;
  const linhas = lista.slice(0,MAX).map(x=>`<tr><td class="mono">${escapeHtml(String(x.o.id).trim())}</td><td>${escapeHtml(x.o.statusOS||"")}</td><td>${escapeHtml(x.o.tipoServico||"")}</td><td style="text-align:right;">${Math.round(x.d)} m</td></tr>`).join("");
  return `<div style="min-width:280px; max-width:360px;">
    <h4 style="margin:0 0 4px; color:#B42318;">NIX · ${escapeHtml(item.e)}</h4>
    <dl style="margin:0 0 6px; font-size:12px;">
      ${item.dh?`<dt>Data-Hora</dt><dd>${escapeHtml(item.dh)}</dd>`:""}
      ${item.alim?`<dt>Alimentador</dt><dd>${escapeHtml(item.alim)}${item.trecho?` · ${escapeHtml(item.trecho)}`:""}</dd>`:""}
      ${item.reg||item.conj?`<dt>Regional / Conjunto</dt><dd>${escapeHtml(item.reg||"—")} · ${escapeHtml(item.conj||"—")}</dd>`:""}
      ${item.ppf?`<dt>PPF</dt><dd>${escapeHtml(item.ppf)}</dd>`:""}
    </dl>
    <p style="margin:0 0 4px; font-size:12px;"><b>${lista.length}</b> OS não executada(s) em ${raio} m:</p>
    ${lista.length ? `<table style="width:100%; font-size:11.5px;"><tbody>${linhas}</tbody></table>${lista.length>MAX?`<p style="margin:4px 0 0; font-size:11.5px; color:#667085;">+ ${lista.length-MAX} mais</p>`:""}` : `<p style="margin:0; font-size:11.5px; color:#667085;">Nenhuma OS pendente por perto.</p>`}
  </div>`;
}
function nixIcone(){
  return L.divIcon({ className:"nix-pulso-wrap", iconSize:[22,22], iconAnchor:[11,11], html:`<span class="nix-pulso"><i></i><b></b></span>` });
}
/* preenche o layerGroup "nix" (mesmo objeto que o painel de camadas liga/desliga) */
async function nixDesenhar(grupo, map){
  await nixCarregar();
  grupo.clearLayers();
  const raio = nixRaioM(), todos = [];
  nixBase.itens.forEach(item=>{
    (item.pontos||[]).forEach(p=>{
      todos.push([p.lat,p.lng]);
      L.circle([p.lat,p.lng], { radius:raio, color:"#D92D20", weight:1.5, opacity:.8, fillColor:"#D92D20", fillOpacity:.08, interactive:false }).addTo(grupo);
      const m = L.marker([p.lat,p.lng], { icon:nixIcone(), zIndexOffset:900, riseOnHover:true }).addTo(grupo);
      m.bindPopup(()=>nixPopupHtml(item), { maxWidth:380 });
      m.bindTooltip(`NIX · ${escapeHtml(item.e)}${item.ppf?` — ${escapeHtml(String(item.ppf).slice(0,90))}`:""}`, { direction:"top", offset:[0,-10] });
    });
  });
  if(nixFocoPendente && map){
    const pts = nixFocoPendente; nixFocoPendente = null;
    if(pts.length===1) map.setView(pts[0], 16); else map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom:16 });
  }
}


/* =========================================================================
   Menu "Pontos Nix" (permissão própria: nix/visualizar; subir base = nix/importar)
   Grid dos Nix com as OS em volta (executadas, programadas, pendentes), lista
   de OS relacionadas e download em Excel do que está na tela.
   ========================================================================= */
let nixPgAba = "nix";            // "nix" | "os"
let nixPgBusca = "", nixPgStatus = "todos", nixPgDias = 0;
let nixPgPag = 1, nixPgPagOS = 1;
const nixPgAbertos = new Set();
const NIX_PG_POR_PAGINA = 15, NIX_PG_POR_PAGINA_OS = 25;
let nixRelCache = { chave:"", lista:[] };

function nixStatusGrupo(o){
  const t = String(o.statusOS||"").toLowerCase();
  if(t.indexOf("executad")===0) return "exec";
  if(t.indexOf("programad")===0) return "prog";
  return "pend";   // pendente, despachada, cancelada e demais
}
const NIX_GRUPO_ROTULO = { exec:"Executada", prog:"Programada", pend:"Pendente/outras" };
function nixDataRef(o){ return String(((nixStatusGrupo(o)==="exec" ? o.dataExecucao : o.dataAbertura) || o.dataAbertura || o.dataExecucao || "")).slice(0,10); }

/* todos os pares Nix x OS (OS com coordenada dentro do raio de algum ponto do Nix) */
function nixRelacoes(){
  const raio = nixRaioM();
  const chave = [nixBase.meta && nixBase.meta.enviadoEm, nixBase.itens.length, (state.manutencaoOS||[]).length, raio].join("|");
  if(nixRelCache.chave === chave) return nixRelCache.lista;
  const lista = [];
  nixBase.itens.forEach((item,idx)=>{
    nixOSProximas(item, raio, true).forEach(x=>lista.push({ idx, item, o:x.o, d:x.d, g:nixStatusGrupo(x.o) }));
  });
  nixRelCache = { chave, lista };
  return lista;
}
function nixRelFiltradas(){
  let lista = nixRelacoes();
  if(nixPgStatus === "exec" || nixPgStatus === "prog" || nixPgStatus === "pend") lista = lista.filter(r=>r.g===nixPgStatus);
  else if(nixPgStatus === "naoexec") lista = lista.filter(r=>r.g!=="exec");
  if(nixPgDias > 0){
    const lim = new Date(Date.now() - nixPgDias*86400000).toISOString().slice(0,10);
    lista = lista.filter(r=>nixDataRef(r.o) >= lim);
  }
  return lista;
}
function nixBateBusca(r, q){
  return [r.item.e, r.item.alim, r.item.reg, r.item.conj, r.item.ppf, r.item.trecho, r.o.id, r.o.alimentador, r.o.localidade].some(v=>String(v||"").toUpperCase().includes(q));
}

function viewNixPagina(){ return `<div id="nixPgWrap">${nixPgHtml()}</div>`; }
async function nixPaginaInit(){ await nixCarregar(); nixRelCache.chave = ""; nixPgRedesenhar(); }
function nixPgRedesenhar(){ const w = document.getElementById("nixPgWrap"); if(w) w.innerHTML = nixPgHtml(); }
function nixPgTrocarAba(a){ nixPgAba = a; nixPgRedesenhar(); }
function nixPgFiltro(campo, v){
  if(campo==="status") nixPgStatus = v; else if(campo==="dias") nixPgDias = Number(v)||0; else nixPgBusca = v;
  nixPgPag = 1; nixPgPagOS = 1;
  if(campo==="busca"){ // mantém o foco na caixa de busca
    nixPgRedesenhar(); const i = document.getElementById("nixPgBusca"); if(i){ i.focus(); i.setSelectionRange(v.length, v.length); }
  } else nixPgRedesenhar();
}
function nixPgPagina(n){ if(nixPgAba==="nix") nixPgPag = n; else nixPgPagOS = n; nixPgRedesenhar(); }
function nixPgAbrir(i){ if(nixPgAbertos.has(i)) nixPgAbertos.delete(i); else nixPgAbertos.add(i); nixPgRedesenhar(); }

function nixPgPaginacao(pag, total, porPag, rotulo){
  if(total <= porPag) return "";
  const tp = Math.ceil(total/porPag);
  return `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${pag<=1?"disabled":""} onclick="nixPgPagina(${pag-1})">‹ Anterior</button><span>Página ${pag} de ${tp} · ${total.toLocaleString("pt-BR")} ${rotulo}</span><button type="button" class="btn btn-ghost btn-sm" ${pag>=tp?"disabled":""} onclick="nixPgPagina(${pag+1})">Próxima ›</button></div>`;
}
function nixPgPill(g, txt){
  const cls = g==="exec" ? "ok" : g==="prog" ? "info" : "warn";
  return `<span class="pill ${cls}">${escapeHtml(txt||NIX_GRUPO_ROTULO[g])}</span>`;
}
function nixPgOsTabela(rels){
  return `<table style="width:100%; font-size:12px;"><thead><tr><th>OS</th><th>Status</th><th>Serviço</th><th>Abertura</th><th>Execução</th><th>Alimentador</th><th>Localidade</th><th style="text-align:right;">Distância</th></tr></thead><tbody>${
    rels.map(r=>`<tr><td class="mono">${escapeHtml(String(r.o.id).trim())}</td><td>${nixPgPill(r.g, r.o.statusOS)}</td><td>${escapeHtml(r.o.tipoServico||"")}</td><td>${fmtDate(r.o.dataAbertura)}</td><td>${r.o.dataExecucao?fmtDate(r.o.dataExecucao):"—"}</td><td>${escapeHtml(r.o.alimentador||"")}</td><td>${escapeHtml(r.o.localidade||"")}</td><td style="text-align:right;">${Math.round(r.d)} m</td></tr>`).join("")
  }</tbody></table>`;
}

function nixPgHtml(){
  const podeConfig = minhaPermissao("nix","importar"), podeCriar = minhaPermissao("nix","criar"), podeExcluir = minhaPermissao("nix","excluirStatus");
  if(!nixCarregada) return `<div class="card"><p style="color:var(--muted); margin:0;">Carregando pontos Nix…</p></div>`;
  if(!nixBase.itens.length){
    return `<div class="card"><h3>Pontos Nix</h3><p style="color:var(--muted);">Nenhuma base de Nix enviada ainda.${podeConfig ? " Envie a planilha em <b>Configuração › Pontos Nix</b>." : " Peça a quem administra para enviar a planilha."}</p>${podeConfig?`<a class="btn btn-primary btn-sm" href="#configuracao" onclick="cfgAba='nix'">Ir para Configuração</a> `:""}${podeCriar?`<button class="btn btn-ghost btn-sm" onclick="nixIncluirAbrir()">+ Incluir ponto Nix</button>`:""}</div>`;
  }
  const raio = nixRaioM(), rels = nixRelFiltradas(), q = nixPgBusca.trim().toUpperCase();
  const m = nixBase.meta || {};
  /* resumo (OS únicas) */
  const uniq = { exec:new Set(), prog:new Set(), pend:new Set() };
  rels.forEach(r=>uniq[r.g].add(r.o.id));
  const kpi = (n,t,cls)=>`<div class="pill ${cls}" style="font-size:12.5px; padding:6px 13px;"><b>${n.toLocaleString("pt-BR")}</b>&nbsp;${t}</div>`;
  const filtros = `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:12px 0;">
      <div class="field" style="margin:0; flex:1; min-width:260px;"><input id="nixPgBusca" type="search" value="${escapeHtml(nixPgBusca)}" placeholder="Buscar Nix ou OS: elemento, alimentador, regional, PPF, nº da OS…" oninput="nixPgFiltro('busca', this.value)"></div>
      <div class="field" style="margin:0;"><select onchange="nixPgFiltro('status', this.value)">
        ${[["todos","Todas as OS"],["exec","Executadas"],["prog","Programadas"],["pend","Pendentes / outras"],["naoexec","Não executadas"]].map(([v,t])=>`<option value="${v}" ${nixPgStatus===v?"selected":""}>${t}</option>`).join("")}
      </select></div>
      <div class="field" style="margin:0;"><select onchange="nixPgFiltro('dias', this.value)">
        ${[[0,"Todo o período"],[30,"Últimos 30 dias"],[60,"Últimos 60 dias"],[90,"Últimos 90 dias"],[180,"Últimos 180 dias"]].map(([v,t])=>`<option value="${v}" ${nixPgDias===v?"selected":""}>${t}</option>`).join("")}
      </select></div>
      ${podeCriar ? `<button class="btn btn-ghost btn-sm" onclick="nixIncluirAbrir()">+ Incluir ponto Nix</button>` : ""}
      <button class="btn btn-primary btn-sm" onclick="nixBaixarExcel()">Baixar Excel</button>
    </div>`;
  let corpo = "";
  if(nixPgAba === "nix"){
    const porNix = new Map();
    rels.forEach(r=>{ if(!porNix.has(r.idx)) porNix.set(r.idx, []); porNix.get(r.idx).push(r); });
    let itens = nixBase.itens.map((item,idx)=>({ item, idx, rs:(porNix.get(idx)||[]) }));
    if(q) itens = itens.filter(({item,rs})=>[item.e,item.alim,item.reg,item.conj,item.ppf,item.trecho,item.dh].some(v=>String(v||"").toUpperCase().includes(q)) || rs.some(r=>String(r.o.id).toUpperCase().includes(q)));
    itens.sort((a,b)=>b.rs.filter(r=>r.g!=="exec").length - a.rs.filter(r=>r.g!=="exec").length);   // quem tem OS em aberto aparece primeiro
    const tp = Math.max(1, Math.ceil(itens.length/NIX_PG_POR_PAGINA)); if(nixPgPag > tp) nixPgPag = tp;
    const pag = itens.slice((nixPgPag-1)*NIX_PG_POR_PAGINA, nixPgPag*NIX_PG_POR_PAGINA);
    const linhas = pag.map(({item,idx,rs})=>{
      const n = g=>rs.filter(r=>r.g===g).length, aberto = nixPgAbertos.has(idx);
      return `<tr>
        <td class="mono"><b>${escapeHtml(item.e)}</b>${item.manual ? ` <span class="pill info" style="font-size:10.5px;" title="Incluído à mão${item.criadoPor?" por "+escapeHtml(item.criadoPor):""}">manual</span>` : ""}</td><td>${escapeHtml(item.alim||"")}</td><td>${escapeHtml(item.reg||"")}</td><td>${escapeHtml(item.conj||"")}</td>
        <td style="white-space:nowrap;">${escapeHtml(item.dh||"")}</td><td style="min-width:240px; font-size:12px;">${escapeHtml(item.ppf||"")}</td>
        <td style="text-align:center;"><b>${rs.length}</b></td><td style="text-align:center;">${n("exec")}</td><td style="text-align:center;">${n("prog")}</td><td style="text-align:center;">${n("pend")}</td>
        <td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" ${rs.length?"":"disabled"} onclick="nixPgAbrir(${idx})">${aberto?"Ocultar OS":"Ver OS"}</button> <button class="btn btn-ghost btn-sm" onclick="nixVerNoMapa(${idx})">${ic("map")||""} Mapa</button>${item.manual && podeExcluir ? ` <button class="btn btn-ghost btn-sm" title="Apagar este ponto incluído à mão" onclick="nixApagarManual(${idx})">Apagar</button>` : ""}</td></tr>
        ${aberto && rs.length ? `<tr><td colspan="11" style="background:var(--surface-2); padding:8px 14px;">${nixPgOsTabela(rs.slice().sort((a,b)=>a.d-b.d))}</td></tr>` : ""}`;
    }).join("");
    corpo = `<div class="table-wrap"><table data-sort-manual>
        <thead><tr><th>Elemento</th><th>Alimentador</th><th>Regional</th><th>Conjunto</th><th>Data-Hora</th><th>PPF</th><th title="OS dentro do raio">OS</th><th>Exec.</th><th>Prog.</th><th>Pend.</th><th></th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="11" style="text-align:center; color:var(--muted); padding:16px;">Nenhum Nix encontrado para esse filtro.</td></tr>`}</tbody></table></div>${nixPgPaginacao(nixPgPag, itens.length, NIX_PG_POR_PAGINA, "Nix")}`;
  } else {
    const lista = (q ? rels.filter(r=>nixBateBusca(r,q)) : rels).slice().sort((a,b)=>a.item.e.localeCompare(b.item.e) || a.d-b.d);
    const tp = Math.max(1, Math.ceil(lista.length/NIX_PG_POR_PAGINA_OS)); if(nixPgPagOS > tp) nixPgPagOS = tp;
    const pag = lista.slice((nixPgPagOS-1)*NIX_PG_POR_PAGINA_OS, nixPgPagOS*NIX_PG_POR_PAGINA_OS);
    const linhas = pag.map(r=>`<tr><td class="mono"><b>${escapeHtml(r.item.e)}</b></td><td>${escapeHtml(r.item.alim||"")}</td><td class="mono">${escapeHtml(String(r.o.id).trim())}</td><td>${nixPgPill(r.g, r.o.statusOS)}</td><td>${escapeHtml(r.o.tipoServico||"")}</td><td>${fmtDate(r.o.dataAbertura)}</td><td>${r.o.dataExecucao?fmtDate(r.o.dataExecucao):"—"}</td><td>${escapeHtml(r.o.alimentador||"")}</td><td>${escapeHtml(r.o.localidade||"")}</td><td style="text-align:right;">${Math.round(r.d)} m</td></tr>`).join("");
    corpo = `<div class="table-wrap"><table data-sort-manual>
        <thead><tr><th>Nix</th><th>Alim. Nix</th><th>OS</th><th>Status</th><th>Serviço</th><th>Abertura</th><th>Execução</th><th>Alim. OS</th><th>Localidade</th><th style="text-align:right;">Distância</th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="10" style="text-align:center; color:var(--muted); padding:16px;">Nenhuma OS encontrada para esse filtro.</td></tr>`}</tbody></table></div>${nixPgPaginacao(nixPgPagOS, lista.length, NIX_PG_POR_PAGINA_OS, "OS")}`;
  }
  return `<div class="card">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:6px;">
        ${kpi(nixBase.itens.length,"Nix","muted")}${kpi(uniq.exec.size+uniq.prog.size+uniq.pend.size,"OS em volta","info")}${kpi(uniq.exec.size,"executadas","ok")}${kpi(uniq.prog.size,"programadas","info")}${kpi(uniq.pend.size,"pendentes/outras","warn")}
      </div>
      <p style="margin:6px 0 0; color:var(--muted); font-size:12px;">Raio de ${raio} m${podeConfig?" (ajuste em Configuração › Pontos Nix)":""}${m.enviadoEm?` · base enviada em ${escapeHtml(nixFmtData(m.enviadoEm))} por ${escapeHtml(m.enviadoPorNome||"—")}`:""}${m.arquivo?` · ${escapeHtml(m.arquivo)}`:""}. Só entram OS que têm coordenada.</p>
      <div class="tabs" style="margin-top:12px;">
        <button class="tab ${nixPgAba==="nix"?"active":""}" onclick="nixPgTrocarAba('nix')">Por Nix</button>
        <button class="tab ${nixPgAba==="os"?"active":""}" onclick="nixPgTrocarAba('os')">OS relacionadas (${rels.length.toLocaleString("pt-BR")})</button>
      </div>
      ${filtros}${corpo}
    </div>`;
}

/* Excel: o que está filtrado na tela (aba "Nix x OS" = uma linha por par; aba "Resumo por Nix") */
function nixBaixarExcel(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de Excel não carregada.", "bad"); return; }
  const q = nixPgBusca.trim().toUpperCase(), raio = nixRaioM();
  const rels = nixRelFiltradas().filter(r=>!q || nixBateBusca(r,q)).sort((a,b)=>a.item.e.localeCompare(b.item.e) || a.d-b.d);
  const grupoTxt = { exec:"Executada", prog:"Programada", pend:"Pendente/outras" };
  const linhas = rels.map(r=>({
    "Elemento Nix": r.item.e, "Trecho": r.item.trecho||"", "Alimentador Nix": r.item.alim||"", "Regional": r.item.reg||"", "Conjunto": r.item.conj||"",
    "Data-Hora Nix": r.item.dh||"", "PPF": r.item.ppf||"", "Raio (m)": raio,
    "OS": String(r.o.id).trim(), "Status OS": r.o.statusOS||"", "Grupo": grupoTxt[r.g], "Serviço": r.o.tipoServico||"", "Equipe necessária": r.o.tipoEquipeNecessaria||"",
    "Abertura": r.o.dataAbertura ? fmtDate(r.o.dataAbertura) : "", "Execução": r.o.dataExecucao ? fmtDate(r.o.dataExecucao) : "",
    "Alimentador OS": r.o.alimentador||"", "Localidade": r.o.localidade||"", "Proteção": r.o.protecaoId||"",
    "Distância (m)": Math.round(r.d), "Lat OS": r.o.lat, "Long OS": r.o.lng,
  }));
  const resumo = nixBase.itens.filter(item=>!q || [item.e,item.alim,item.reg,item.conj,item.ppf,item.trecho].some(v=>String(v||"").toUpperCase().includes(q)) || rels.some(r=>r.item===item)).map(item=>{
    const rs = rels.filter(r=>r.item===item), n = g=>rs.filter(r=>r.g===g).length;
    return { "Elemento Nix": item.e, "Trecho": item.trecho||"", "Alimentador": item.alim||"", "Regional": item.reg||"", "Conjunto": item.conj||"", "Tensão": item.tensao||"",
      "Data-Hora": item.dh||"", "PPF": item.ppf||"", "Lat,Long": (item.pontos||[]).map(p=>`${p.lat},${p.lng}`).join(" | "),
      "OS em volta": rs.length, "Executadas": n("exec"), "Programadas": n("prog"), "Pendentes/outras": n("pend") };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ "Aviso":"Nenhuma OS para o filtro atual." }]), "Nix x OS");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo por Nix");
  XLSX.writeFile(wb, `SPARK_Pontos_Nix_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Excel gerado: ${linhas.length.toLocaleString("pt-BR")} linha(s).`);
}


/* =========================================================================
   v3.16.0 - INCLUIR 1 PONTO NIX à mão (permissão nix/criar)
   Botão na tela do menu Pontos Nix. O ponto entra na base atual (marcado "manual") e sobrevive a uma
   nova planilha; quem tem "criar" inclui; quem tem "excluir" apaga os manuais. Latitude/longitude em graus decimais.
   ========================================================================= */
function nixIncluirAbrir(){
  if(!minhaPermissao("nix","criar")){ toast("Seu perfil não pode incluir ponto Nix."); return; }
  const agora = new Date().toLocaleString("pt-BR");
  openModal(`
    <h2>Incluir ponto Nix</h2>
    <p class="modal-sub">O ponto entra na base atual e aparece no mapa com o raio de alerta. Latitude e longitude em graus decimais (ex.: -21.9445973 e -50.6890000).</p>
    <div class="field"><label>Elemento (proteção/equipamento) *</label><input id="nxE" type="text" maxlength="60" autocomplete="off"></div>
    <div class="field-row">
      <div class="field"><label>Latitude *</label><input id="nxLat" type="text" inputmode="decimal" placeholder="-21.9445973" autocomplete="off"></div>
      <div class="field"><label>Longitude *</label><input id="nxLng" type="text" inputmode="decimal" placeholder="-50.6890000" autocomplete="off"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Alimentador</label><input id="nxAlim" type="text" maxlength="60" autocomplete="off"></div>
      <div class="field"><label>Regional</label><input id="nxReg" type="text" maxlength="40" autocomplete="off"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Conjunto</label><input id="nxConj" type="text" maxlength="80" autocomplete="off"></div>
      <div class="field"><label>Data-Hora</label><input id="nxDh" type="text" maxlength="40" value="${escapeHtml(agora)}" autocomplete="off"></div>
    </div>
    <div class="field"><label>PPF / observação (possível ponto de falha)</label><textarea id="nxPpf" rows="3" maxlength="600"></textarea></div>
    <p id="nxErro" style="color:var(--danger, #B42318); font-size:12.5px; min-height:16px; margin:0;"></p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="nxSalvarBtn" onclick="nixIncluirSalvar()">Incluir ponto</button>
    </div>`);
}
async function nixIncluirSalvar(){
  const v = id=>{ const e = document.getElementById(id); return e ? e.value.trim() : ""; };
  const erro = m=>{ const e = document.getElementById("nxErro"); if(e) e.textContent = m; };
  const dados = { e:v("nxE"), lat:v("nxLat"), lng:v("nxLng"), alim:v("nxAlim"), reg:v("nxReg"), conj:v("nxConj"), dh:v("nxDh"), ppf:v("nxPpf") };
  if(!dados.e){ erro("Informe o elemento."); return; }
  const p = nixParsePonto(dados.lng ? `${dados.lat},${dados.lng}` : dados.lat);
  if(!p){ erro("Coordenada inválida: use latitude e longitude em graus decimais."); return; }
  const btn = document.getElementById("nxSalvarBtn"); if(btn){ btn.disabled = true; btn.textContent = "Incluindo…"; }
  try{
    if(API_ONLINE){
      await apiSend("POST", "/nix", { incluir: dados });
      nixPromessa = null; await nixCarregar(true);
    } else {
      nixBase.itens.push({ id:"nx-"+Date.now(), manual:true, e:dados.e, alim:dados.alim, reg:dados.reg, conj:dados.conj, dh:dados.dh, ppf:dados.ppf, pontos:[p], criadoPor:"(demonstração)" });
      if(!nixBase.meta) nixBase.meta = { raioM:NIX_RAIO_PADRAO, arquivo:"(inclusão manual)", enviadoEm:new Date().toISOString(), enviadoPorNome:"(demonstração)" };
      nixCarregada = true;
    }
    closeModal(); toast("Ponto Nix incluído."); nixRelCache.chave = ""; render();
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Incluir ponto"; }
    erro(String(err.message||err).replace(/^POST \/nix -> \d+ \(?/, "").replace(/\)$/, ""));
  }
}
async function nixApagarManual(idx){
  const item = nixBase.itens[idx]; if(!item || !item.manual) return;
  if(!minhaPermissao("nix","excluirStatus")){ toast("Seu perfil não pode excluir ponto Nix."); return; }
  if(!window.confirm(`Apagar o ponto Nix "${item.e}" incluído à mão?`)) return;
  try{
    if(API_ONLINE){ await apiSend("DELETE", `/nix?id=${encodeURIComponent(item.id)}`); nixPromessa = null; await nixCarregar(true); }
    else nixBase.itens.splice(idx, 1);
    nixRelCache.chave = ""; toast("Ponto Nix apagado."); render();
  }catch(err){ toast(`Erro ao apagar: ${err.message}`); }
}
