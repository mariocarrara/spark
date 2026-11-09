/* =========================================================================
   v3.6.0 - RANK DE PRIORIDADE DA PROGRAMAÇÃO
   A engenharia manda listas de elementos (proteções) em ordem de prioridade.
   Cada lista enviada fica GUARDADA (não sobrescreve a anterior), com data/hora do
   upload, quem enviou, arquivo/aba, origem e dados do Excel. Este arquivo cuida de:
     1) o upload (opção "Rank de prioridade" da Importação de Bases)
     2) a gestão das listas guardadas (aba da Gestão de Bases)
     3) o botão "Rank" e o painel flutuante do Mapa de Manutenção
   As regras de gravação ficam no Controller (routes/rank.ps1); aqui só se lê o
   Excel, se mostra e se filtra. Depende de app.js/api.js (state, ic, escapeHtml,
   toast, apiGet/apiPost/apiDelete, minhaPermissao, openModal/closeModal, XLSX).
   ========================================================================= */

/* ---------------- dados em memória ---------------- */
/* state.rankListas / state.rankAtual são criados sob demanda (este arquivo carrega ANTES do app.js,
   porque o app.js usa RANK_SCHEMA na tabela SCHEMAS). */
let rankPromessaListas = null;

/* Uma única busca por vez (promessa compartilhada). Sempre termina com state.rankListas
   preenchido (vazio se der erro) — a tela da Gestão depende disso para não ficar em laço. */
function rankCarregarListas(forcar){
  if(!API_ONLINE){ state.rankListas = state.rankListas || []; return Promise.resolve(state.rankListas); }
  if(state.rankListas && !forcar) return Promise.resolve(state.rankListas);
  if(rankPromessaListas) return rankPromessaListas;
  rankPromessaListas = apiGet("/rank").then(r=>{
    state.rankListas = Array.isArray(r) ? r : [];
    return state.rankListas;
  }).catch(e=>{
    state.rankListas = state.rankListas || [];
    throw e;
  }).finally(()=>{ rankPromessaListas = null; });
  return rankPromessaListas;
}
async function rankCarregarAtual(){
  if(!API_ONLINE) return null;
  const r = await apiGet("/rank/atual", 60000);
  state.rankAtual = (r && r.lista) ? { lista:r.lista, itens:r.itens||[] } : { lista:null, itens:[] };
  return state.rankAtual;
}
function rankDataHora(iso){
  if(!iso) return "—";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return escapeHtml(String(iso));
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}

/* =========================================================================
   1) UPLOAD (Importação de Bases > "Rank de prioridade")
   ========================================================================= */
const RANK_SCHEMA = {
  tipo:"rank", apiBase:"Rank",
  origem:"Excel da engenharia com a lista de elementos em ordem de prioridade (uma aba = uma lista). Cada envio é GUARDADO com data e hora; nada é sobrescrito. O mapa passa a mostrar a lista mais recente.",
  campos:[
    ["ELEMENTO","Texto (ou número, é lido sempre como texto)","Sim — a proteção"],
    ["Prio.Progração / Prioridade programação","Número inteiro (1 = mais prioritário)","Sim — a posição no rank"],
    ["DEC","Número","Não — impacto do elemento"],
    ["Trecho, Alimentador, REGIONAL, Polo, Conjunto, PLANO","Texto","Não — contexto da linha"],
    ["Data início, Data fim","Data (dd/mm/aaaa)","Não — o que a engenharia tinha como programado"],
  ],
};
let rankImp = null;   // { arquivo, props, abas:[{nome, itens, reconhecida, motivo, hash, marcada, referencia}], origem }

function rankNorm(s){ return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,""); }
function rankTextoCelula(v){
  if(v==null) return "";
  if(typeof v==="number") return Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : String(v)) : "";
  if(v instanceof Date) return "";
  return String(v).trim();
}
function rankDataIso(v){
  if(v==null || v==="") return "";
  if(v instanceof Date && !isNaN(v.getTime())){
    const d = new Date(v.getTime() + 12*3600*1000);   // folga p/ não escorregar de dia por fuso
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+"-"+m[2]+"-"+m[3];
  return "";
}
/* impressão digital do CONTEÚDO da lista (elemento|posição) — acusa lista repetida
   mesmo que o arquivo seja outro. Hash simples (cyrb53), sem depender de crypto.subtle. */
function rankHash(texto){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i=0;i<texto.length;i++){ const ch = texto.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1>>>0)).toString(16);
}
function rankLerAba(nome, ws){
  const linhas = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"", blankrows:false });
  const out = { nome, itens:[], reconhecida:false, motivo:"", hash:"", marcada:false, referencia:nome };
  if(!linhas.length){ out.motivo = "aba vazia"; return out; }
  // procura o cabeçalho nas primeiras 10 linhas
  let hi = -1, col = {};
  for(let i=0;i<Math.min(10, linhas.length) && hi<0;i++){
    const c = {};
    linhas[i].forEach((h,j)=>{
      const n = rankNorm(h);
      if(!n) return;
      if(n==="elemento") c.e = j;
      else if(n.startsWith("prio") && c.r===undefined) c.r = j;
      else if(n==="dec") c.dec = j;
      else if(n==="trecho") c.trecho = j;
      else if(n==="alimentador") c.alim = j;
      else if(n==="regional") c.reg = j;
      else if(n==="polo") c.polo = j;
      else if(n==="conjunto") c.conj = j;
      else if(n==="plano") c.plano = j;
      else if(n==="datainicio") c.di = j;
      else if(n==="datafim") c.df = j;
    });
    if(c.e!==undefined && c.r!==undefined){ hi = i; col = c; }
  }
  if(hi<0){ out.motivo = "não achei as colunas ELEMENTO e Prioridade"; return out; }
  for(let i=hi+1;i<linhas.length;i++){
    const l = linhas[i];
    const e = rankTextoCelula(l[col.e]);
    if(!e) continue;
    const g = k => col[k]===undefined ? "" : l[col[k]];
    const dec = col.dec===undefined ? "" : l[col.dec];
    out.itens.push({
      e, r: rankTextoCelula(l[col.r]),
      dec: (typeof dec==="number" && Number.isFinite(dec)) ? dec : "",
      trecho: rankTextoCelula(g("trecho")), alim: rankTextoCelula(g("alim")), reg: rankTextoCelula(g("reg")),
      polo: rankTextoCelula(g("polo")), conj: rankTextoCelula(g("conj")), plano: rankTextoCelula(g("plano")),
      di: rankDataIso(g("di")), df: rankDataIso(g("df")),
    });
  }
  if(!out.itens.length){ out.motivo = "nenhuma linha com ELEMENTO"; return out; }
  out.reconhecida = true;
  out.marcada = true;
  out.hash = rankHash(out.itens.map(x=>String(x.e).toUpperCase()+"|"+x.r).join("\n"));
  return out;
}

async function rankArquivoSelecionado(files){
  const f = files && files[0];
  if(!f) return;
  const res = document.getElementById("importResult");
  if(res) res.innerHTML = barraIndeterminadaHtml ? barraIndeterminadaHtml(`Lendo ${escapeHtml(f.name)}…`) : "Lendo…";
  try{
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type:"array", cellDates:true });
    const abas = wb.SheetNames.map(n=>rankLerAba(n, wb.Sheets[n]));
    const props = wb.Props || {};
    const dt = v => (v instanceof Date && !isNaN(v.getTime())) ? v.toISOString() : (v ? String(v) : "");
    rankImp = {
      arquivo: f.name,
      props: { autor: props.Author || "", ultimoAutor: props.LastAuthor || "", criado: dt(props.CreatedDate), modificado: dt(props.ModifiedDate), arquivoModificado: f.lastModified ? new Date(f.lastModified).toISOString() : "" },
      abas, origem: (rankImp && rankImp.origem) || "",
    };
    document.getElementById("importFileName").textContent = f.name;
    try{ await rankCarregarListas(); }catch(e){ /* sem a lista não dá pra avisar de repetida, mas o envio segue */ }
    rankRenderImp();
  }catch(err){
    rankImp = null;
    if(res) res.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Não consegui ler esse Excel: ${escapeHtml(err.message||String(err))}</div></div>`;
  }
}
function rankDuplicadaDe(hash){
  return (state.rankListas||[]).find(l=>l.hash && l.hash===hash) || null;
}
function rankRenderImp(){
  const res = document.getElementById("importResult");
  if(!res || !rankImp) return;
  const p = rankImp.props;
  const meta = [
    ["Arquivo", rankImp.arquivo],
    ["Autor (no Excel)", p.autor || p.ultimoAutor || "—"],
    ["Criado (no Excel)", p.criado ? rankDataHora(p.criado) : "—"],
    ["Gravado por último (no Excel)", p.modificado ? rankDataHora(p.modificado) : (p.arquivoModificado ? rankDataHora(p.arquivoModificado) : "—")],
  ].map(([k,v])=>`<tr><td style="color:var(--muted); white-space:nowrap;">${k}</td><td>${escapeHtml(v)}</td></tr>`).join("");
  const linhasAbas = rankImp.abas.map((a,i)=>{
    const dup = a.reconhecida ? rankDuplicadaDe(a.hash) : null;
    return `<tr>
      <td class="checkbox-cell"><input type="checkbox" ${a.marcada?"checked":""} ${a.reconhecida?"":"disabled"} onchange="rankImp.abas[${i}].marcada=this.checked; rankAtualizarBotao()"></td>
      <td><b>${escapeHtml(a.nome)}</b>${a.reconhecida ? "" : `<div style="font-size:11px; color:var(--bad-fg);">${escapeHtml(a.motivo)}</div>`}${dup ? `<div style="font-size:11px; color:var(--warn-fg);">${ic("warn")} idêntica à lista enviada em ${rankDataHora(dup.enviadoEm)}</div>` : ""}</td>
      <td class="num">${a.reconhecida ? a.itens.length : "—"}</td>
      <td><input type="text" value="${escapeHtml(a.referencia)}" ${a.reconhecida?"":"disabled"} maxlength="120" style="width:100%; min-width:90px;" oninput="rankImp.abas[${i}].referencia=this.value" placeholder="ex.: 29/10 tarde"></td>
    </tr>`;
  }).join("");
  res.innerHTML = `
    <div class="table-wrap" style="margin-top:12px;"><table><tbody>${meta}</tbody></table></div>
    <div class="field" style="margin-top:12px;">
      <label>Origem (opcional)</label>
      <input type="text" id="rankOrigemInput" maxlength="300" value="${escapeHtml(rankImp.origem)}" oninput="rankImp.origem=this.value" placeholder="ex.: e-mail da engenharia, pasta compartilhada…">
    </div>
    <h3 style="margin-top:14px;">Quais abas viram lista?</h3>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Aba</th><th>Linhas</th><th>Referência da lista</th></tr></thead>
      <tbody>${linhasAbas}</tbody>
    </table></div>
    <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">Cada aba marcada vira uma lista guardada, com a data e a hora deste envio. A mais recente é a que aparece no mapa.</p>`;
  rankAtualizarBotao();
}
function rankAtualizarBotao(){
  const btn = document.getElementById("importActionBtn");
  if(!btn || !rankImp) return;
  const n = rankImp.abas.filter(a=>a.marcada).length;
  btn.disabled = n===0;
  btn.innerHTML = `${ic("check")} ${n>1 ? `Enviar ${n} listas` : "Enviar lista"}`;
}
let rankEnviando = false;
async function rankExecutarImportacao(){
  if(rankEnviando) return;
  if(!rankImp){ toast("Selecione o arquivo Excel antes."); return; }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat para enviar de verdade."); return; }
  const escolhidas = rankImp.abas.filter(a=>a.marcada && a.reconhecida);
  if(!escolhidas.length){ toast("Marque pelo menos uma aba."); return; }
  rankEnviando = true;
  const btn = document.getElementById("importActionBtn"); if(btn) btn.disabled = true;
  const res = document.getElementById("importResult");
  const saidas = [];
  let ok = 0;
  try{
    for(let i=0;i<escolhidas.length;i++){
      const a = escolhidas[i];
      if(res) res.innerHTML = barraIndeterminadaHtml(`Enviando lista ${i+1} de ${escolhidas.length}: ${escapeHtml(a.nome)}…`);
      try{
        const r = await apiPost("/rank", {
          arquivo: rankImp.arquivo, aba: a.nome, referencia: (a.referencia||"").trim(), origem: (rankImp.origem||"").trim(),
          autor: rankImp.props.autor || rankImp.props.ultimoAutor || "",
          criadoArquivoEm: rankImp.props.criado, modificadoArquivoEm: rankImp.props.modificado || rankImp.props.arquivoModificado,
          hash: a.hash, itens: a.itens,
        }, 120000);
        ok++;
        saidas.push(`<tr><td><b>${escapeHtml(a.nome)}</b></td><td><span class="pill ok">guardada</span></td><td class="num">${r.validas}</td><td class="num">${r.rejeitadas}</td><td style="font-size:11.5px;">${(r.motivos||[]).map(escapeHtml).join("<br>")}</td></tr>`);
      }catch(err){
        saidas.push(`<tr><td><b>${escapeHtml(a.nome)}</b></td><td><span class="pill bad">erro</span></td><td></td><td></td><td style="font-size:11.5px;">${escapeHtml(err.message||String(err))}</td></tr>`);
      }
    }
    state.rankListas = null; state.rankAtual = null; if(typeof rankAn!=="undefined") rankAn.pronto = false;
    try{ await rankCarregarListas(true); }catch(e){}
    if(res) res.innerHTML = `
      <div class="note" style="margin-top:12px; ${ok===escolhidas.length ? "" : "background:var(--warn-bg); color:var(--warn-fg);"}">${ic(ok===escolhidas.length?"check":"info")}<div>${ok} de ${escolhidas.length} lista(s) guardada(s) em ${rankDataHora(new Date().toISOString())}. O mapa já mostra a mais recente.</div></div>
      <div class="table-wrap" style="margin-top:8px;"><table>
        <thead><tr><th>Aba</th><th>Resultado</th><th>Válidas</th><th>Rejeitadas</th><th>Motivos</th></tr></thead>
        <tbody>${saidas.join("")}</tbody></table></div>`;
    if(ok) toast(ok===1 ? "Lista guardada." : `${ok} listas guardadas.`);
    rankImp = null;
    const inp = document.getElementById("importFileInput"); if(inp) inp.value = "";
  }finally{
    rankEnviando = false;
    if(btn){ btn.disabled = false; btn.innerHTML = `${ic("check")} Enviar lista`; }
  }
}

/* =========================================================================
   2) GESTÃO (Gestão de Bases > "Rank de prioridade")
   ========================================================================= */
function rankGestaoHtml(){
  if(state.rankListas == null){
    // dispara a busca UMA vez; quando termina state.rankListas já é um array, então redesenhar não volta aqui
    rankCarregarListas().then(()=>rankRefazerGestao()).catch(()=>rankRefazerGestao());
    return `<div class="note">${ic("info")}<div>Carregando as listas…</div></div>`;
  }
  const podeApagar = minhaPermissao("prioridade","excluirStatus");
  const listas = state.rankListas.slice().sort((a,b)=>String(b.enviadoEm).localeCompare(String(a.enviadoEm)));
  if(!listas.length){
    return `<div class="empty">${ic("empty")}<div>Nenhuma lista de prioridade guardada ainda. Envie em Importação de Bases, opção "Rank de prioridade".</div></div>`;
  }
  const linhas = listas.map((l,i)=>`<tr>
      <td>${rankDataHora(l.enviadoEm)}${i===0 ? ` <span class="pill ok">mais atual</span>` : ""}</td>
      <td>${escapeHtml(l.referencia||"—")}</td>
      <td class="mono" style="font-size:12px;">${escapeHtml(l.arquivo||"—")}${l.aba ? `<div style="color:var(--muted);">aba: ${escapeHtml(l.aba)}</div>` : ""}</td>
      <td>${escapeHtml(l.origem||"—")}</td>
      <td>${escapeHtml(l.autorArquivo||"—")}${l.criadoArquivoEm ? `<div style="font-size:11px; color:var(--muted);">criado ${rankDataHora(l.criadoArquivoEm)}</div>` : ""}</td>
      <td>${escapeHtml(l.enviadoPorNome||l.enviadoPor||"—")}</td>
      <td class="num">${l.linhas}</td>
      <td class="num">${l.comData==null ? "—" : l.comData}</td>
      <td>${podeApagar ? `<button class="btn btn-danger btn-sm" onclick="rankConfirmarApagar('${escapeHtml(l.id)}')">Excluir</button>` : ""}</td>
    </tr>`).join("");
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Listas de prioridade enviadas pela engenharia. Todas ficam guardadas (o mapa usa a mais recente e o menu "Prioridade da programação" compara uma com a outra). Excluir uma lista é definitivo.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Enviada em</th><th>Referência</th><th>Arquivo</th><th>Origem</th><th>Autor no Excel</th><th>Enviada por</th><th>Elementos</th><th>Com data</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>`;
}
function rankRefazerGestao(){
  const wrap = document.getElementById("cadastroGridWrap");
  if(wrap && typeof cadastroBaseAtiva!=="undefined" && cadastroBaseAtiva==="rankListas") wrap.innerHTML = cadastroGridHtml();
}
function rankConfirmarApagar(id){
  const l = (state.rankListas||[]).find(x=>x.id===id);
  if(!l) return;
  const eMaisAtual = state.rankListas.slice().sort((a,b)=>String(b.enviadoEm).localeCompare(String(a.enviadoEm)))[0].id === id;
  openModal(`
    <h2>Excluir esta lista?</h2>
    <p class="modal-sub">${rankDataHora(l.enviadoEm)} · ${escapeHtml(l.referencia||l.arquivo||"")} · ${l.linhas} elemento(s)</p>
    <p style="font-size:13px;">A lista é apagada de vez e some das comparações do menu "Prioridade da programação".${eMaisAtual ? ` <strong>Ela é a mais atual: o mapa passa a mostrar a lista anterior.</strong>` : ""}</p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="rankApagar('${escapeHtml(id)}')">Excluir</button>
    </div>`);
}
async function rankApagar(id){
  try{
    await apiDelete(`/rank/${encodeURIComponent(id)}`);
    state.rankListas = (state.rankListas||[]).filter(l=>l.id!==id);
    state.rankAtual = null; if(typeof rankAn!=="undefined") rankAn.pronto = false;
    closeModal();
    toast("Lista excluída.");
    rankRefazerGestao();
  }catch(err){
    toast("Não consegui excluir: " + (err.message||err));
  }
}

/* =========================================================================
   3) BOTÃO "RANK" E PAINEL NO MAPA
   ========================================================================= */
let rankMapaAberto = false;
let rankMapaBusca = "";
let rankIdxProg = null, rankIdxPend = null;
const RANK_MAPA_LIMITE = 150;

function rankPodeVer(){ return minhaPermissao("prioridade","visualizar"); }
function rankMapaBotaoHtml(){
  rankMapaAberto = false;   // a tela do mapa foi redesenhada: o painel antigo não existe mais
  if(!rankPodeVer()) return "";
  return `<button type="button" class="btn ${rankMapaAberto?"btn-primary":"btn-ghost"}" id="btnRankMapa" style="padding:6px 12px; font-size:12px;" onclick="rankMapaAlternar()" title="Rank de prioridade da programação (lista mais atual da engenharia)">${ic("chart")} Rank</button>`;
}
function rankIndexarProgramacoes(){
  const hoje = new Date().toISOString().slice(0,10);
  rankIdxProg = new Map();
  (state.programacoes||[]).forEach(p=>{
    if(!p || p.status==="Cancelada" || !p.protecaoId) return;
    const k = String(p.protecaoId).trim().toUpperCase();
    if(!rankIdxProg.has(k)) rankIdxProg.set(k, []);
    rankIdxProg.get(k).push(p);
  });
  rankIdxPend = new Map();
  (state.manutencaoOS||[]).forEach(o=>{
    if(!o || !o.protecaoId || o.statusOS==="Executada" || o.statusOS==="Cancelada") return;
    const k = String(o.protecaoId).trim().toUpperCase();
    rankIdxPend.set(k, (rankIdxPend.get(k)||0) + 1);
  });
  rankIdxProg._hoje = hoje;
}
function rankProgramadaHtml(elemento){
  const lista = rankIdxProg && rankIdxProg.get(String(elemento).trim().toUpperCase());
  if(!lista || !lista.length) return `<span style="color:var(--muted);">não programada</span>`;
  const hoje = rankIdxProg._hoje;
  // a mais próxima daqui pra frente; se não houver, a mais recente
  const futuras = lista.filter(p=>(p.dataFim||p.dataInicio||"") >= hoje).sort((a,b)=>String(a.dataInicio).localeCompare(String(b.dataInicio)));
  const p = futuras.length ? futuras[0] : lista.slice().sort((a,b)=>String(b.dataInicio).localeCompare(String(a.dataInicio)))[0];
  const ini = p.dataInicio ? fmtDate(p.dataInicio).slice(0,5) : "—";
  const fim = p.dataFim && p.dataFim!==p.dataInicio ? " a " + fmtDate(p.dataFim).slice(0,5) : "";
  let sit = "";
  try{ sit = progSituacaoDe(p); }catch(e){}
  const cls = sit==="entregue" ? "ok" : sit==="atrasada" ? "bad" : "info";
  const extra = lista.length>1 ? ` <span style="color:var(--muted);" title="${lista.length} programações para este elemento">+${lista.length-1}</span>` : "";
  return `<span class="pill ${cls}" title="${escapeHtml(sit||"programada")}">${ini}${fim}</span>${extra}`;
}
async function rankMapaAlternar(){
  if(rankMapaAberto){ rankMapaFechar(); return; }
  const area = document.querySelector("#mapaGridWrap .mapa-area");
  if(!area) return;
  rankMapaAberto = true;
  if(typeof coordMultiAberto!=="undefined" && coordMultiAberto && typeof coordMultiAlternar==="function") coordMultiAlternar();
  const btn = document.getElementById("btnRankMapa");
  if(btn){ btn.classList.add("btn-primary"); btn.classList.remove("btn-ghost"); }
  let painel = document.getElementById("mapaRankPainel");
  if(!painel){
    painel = document.createElement("div");
    painel.id = "mapaRankPainel";
    painel.className = "rank-painel";
    area.appendChild(painel);
  }
  painel.style.display = "";
  painel.innerHTML = `<div class="mapa-painel-topo"><strong>Rank de prioridade</strong><button type="button" class="mapa-painel-fechar" onclick="rankMapaFechar()" title="Fechar" aria-label="Fechar">×</button></div><p style="color:var(--muted); font-size:12px;">Carregando a lista mais atual…</p>`;
  try{
    await rankCarregarAtual();
  }catch(err){
    painel.innerHTML = `<div class="mapa-painel-topo"><strong>Rank de prioridade</strong><button type="button" class="mapa-painel-fechar" onclick="rankMapaFechar()" aria-label="Fechar">×</button></div><p style="color:var(--bad-fg); font-size:12px;">Não consegui carregar: ${escapeHtml(err.message||String(err))}</p>`;
    return;
  }
  rankIndexarProgramacoes();
  try{ await rankCarregarAnterior(); }catch(e){ rankMapaAnt = null; }   // as setas são um extra: se falhar, o rank aparece sem elas
  rankMapaDesenhar();
}
/* v3.10.3 - seta de subiu/caiu ao lado do rank: compara com a lista ANTERIOR (a de mesma referência, se houver; senão a imediatamente anterior) */
let rankMapaAnt = null;   // { lista, mapa: Map(ELEMENTO -> rank anterior) }
async function rankCarregarAnterior(){
  rankMapaAnt = null;
  const atual = state.rankAtual && state.rankAtual.lista;
  if(!atual) return;
  await rankCarregarListas();
  const asc = (state.rankListas||[]).slice().sort((a,b)=>String(a.enviadoEm).localeCompare(String(b.enviadoEm)) || String(a.id).localeCompare(String(b.id)));
  const i = asc.findIndex(l=>l.id===atual.id);
  if(i <= 0) return;
  const antes = asc.slice(0,i).reverse(), ref = String(atual.referencia||"").trim().toUpperCase();
  const prev = antes.find(l=>String(l.referencia||"").trim().toUpperCase()===ref) || antes[0];
  if(!prev) return;
  let itens = (typeof rankAn !== "undefined" && rankAn.itens && rankAn.itens[prev.id]) || null;
  if(!itens){ const r = await apiGet("/rank/" + encodeURIComponent(prev.id), 60000); itens = (r && r.itens) || []; }
  const mapa = new Map();
  itens.forEach(x=>mapa.set(String(x.e).trim().toUpperCase(), x.r));
  rankMapaAnt = { lista:prev, mapa };
}
function rankSetaHtml(x){
  if(!rankMapaAnt) return "";
  const a = rankMapaAnt.mapa.get(String(x.e).trim().toUpperCase());
  if(a == null) return `<span class="rank-seta novo" title="Não estava na lista anterior">novo</span>`;
  const d = a - x.r;   // positivo = subiu (rank menor = mais prioritário)
  if(d === 0) return `<span class="rank-seta igual" title="Mesma posição da lista anterior (${a}º)">= 0</span>`;
  return d > 0 ? `<span class="rank-seta sobe" title="Era o ${a}º na lista anterior">▲${d}</span>` : `<span class="rank-seta cai" title="Era o ${a}º na lista anterior">▼${-d}</span>`;
}
function rankMapaFechar(){
  rankMapaAberto = false;
  const p = document.getElementById("mapaRankPainel"); if(p) p.style.display = "none";
  const btn = document.getElementById("btnRankMapa");
  if(btn){ btn.classList.remove("btn-primary"); btn.classList.add("btn-ghost"); }
}
function rankMapaDesenhar(){
  const painel = document.getElementById("mapaRankPainel");
  if(!painel) return;
  const r = state.rankAtual;
  const topo = `<div class="mapa-painel-topo"><strong>Rank de prioridade</strong><button type="button" class="mapa-painel-fechar" onclick="rankMapaFechar()" title="Fechar" aria-label="Fechar">×</button></div>`;
  if(!r || !r.lista){
    painel.innerHTML = topo + `<p style="color:var(--muted); font-size:12.5px;">Nenhuma lista de prioridade foi enviada ainda. Envie em Importação de Bases, opção "Rank de prioridade".</p>`;
    return;
  }
  const l = r.lista;
  painel.innerHTML = topo + `
    <div class="rank-cab">
      <div><span>Lista enviada em</span> <b>${rankDataHora(l.enviadoEm)}</b></div>
      ${l.referencia ? `<div><span>Referência</span> <b>${escapeHtml(l.referencia)}</b></div>` : ""}
      <div style="color:var(--muted); font-size:11.5px;">${r.itens.length} elementos${l.arquivo ? " · " + escapeHtml(l.arquivo) : ""}</div>
      ${rankMapaAnt ? `<div style="color:var(--muted); font-size:11.5px;"><span class="rank-seta sobe">▲</span> subiu · <span class="rank-seta cai">▼</span> caiu · <span class="rank-seta igual">= 0</span> igual · <span class="rank-seta novo">novo</span> — comparado com a lista de ${rankDataHora(rankMapaAnt.lista.enviadoEm)}</div>` : ""}
    </div>
    <input type="text" id="rankBuscaInput" placeholder="Buscar elemento, alimentador, polo…" value="${escapeHtml(rankMapaBusca)}" oninput="rankMapaBuscar(this.value)" autocomplete="off">
    <div id="rankTabelaWrap">${rankTabelaHtml()}</div>`;
}
function rankMapaBuscar(v){
  rankMapaBusca = v;
  clearTimeout(rankMapaBuscar._t);
  rankMapaBuscar._t = setTimeout(()=>{ const w = document.getElementById("rankTabelaWrap"); if(w) w.innerHTML = rankTabelaHtml(); }, 120);
}
function rankTabelaHtml(){
  const r = state.rankAtual;
  if(!r || !r.lista) return "";
  const termos = buscaOSTermos(rankMapaBusca);
  let itens = r.itens;
  if(termos.length){
    itens = itens.filter(x=>{
      const txt = (x.e+" "+x.alim+" "+x.polo+" "+x.conj+" "+x.reg).toLowerCase();
      return termos.some(t=>txt.includes(t));
    });
  }
  const barraSel = rankMapaSel ? `<div class="rank-sel"><span>Filtrando por <b class="mono">${escapeHtml(rankMapaSel)}</b></span><button type="button" class="btn btn-ghost btn-sm" onclick="rankLimparSelecao()">× Limpar seleção</button></div>` : "";
  if(!itens.length) return barraSel + `<p style="color:var(--muted); font-size:12.5px; margin-top:10px;">Nenhum elemento encontrado.</p>`;
  const mostrar = itens.slice(0, RANK_MAPA_LIMITE);
  const linhas = mostrar.map(x=>{
    const pend = rankIdxPend ? (rankIdxPend.get(String(x.e).trim().toUpperCase())||0) : 0;
    return `<tr class="rank-linha ${rankMapaSel===x.e?"sel":""}" onclick="rankFiltrarMapa(${JSON.stringify(x.e).replace(/"/g,"&quot;")})" title="Clique para filtrar o mapa e a tabela de OS por este elemento">
      <td class="num"><b>${x.r}</b>${rankSetaHtml(x)}</td>
      <td class="mono">${escapeHtml(x.e)}${x.alim ? `<div style="font-size:10.5px; color:var(--muted);">${escapeHtml(x.alim)}</div>` : ""}</td>
      <td class="num">${pend || `<span style="color:var(--muted);">0</span>`}</td>
      <td>${rankProgramadaHtml(x.e)}</td>
    </tr>`;
  }).join("");
  return barraSel + `<div class="rank-tabela"><table>
      <thead><tr><th>Rank</th><th>Elemento</th><th title="OS pendentes deste elemento no SPARK">OS pend.</th><th title="Data da programação no SPARK">Programada</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>
    ${itens.length>mostrar.length ? `<p style="color:var(--muted); font-size:11.5px; margin:6px 0 0;">Mostrando ${mostrar.length} de ${itens.length}. Use a busca para achar um elemento.</p>` : ""}`;
}
let rankMapaSel = null;
function rankFiltrarMapa(elemento){
  rankMapaSel = elemento;
  // usa a própria busca do mapa (OS por número, alimentador ou proteção): mapa e tabela de baixo filtram juntos
  if(typeof mapaBuscaModo!=="undefined" && mapaBuscaModo==="endereco" && typeof alternarModoBusca==="function") alternarModoBusca();
  const inp = document.getElementById("osBuscaInput");
  if(inp) inp.value = elemento;
  buscarOS(elemento);
  const w = document.getElementById("rankTabelaWrap"); if(w) w.innerHTML = rankTabelaHtml();
  setTimeout(()=>{
    try{
      const pts = osFiltradas().filter(o=>Number.isFinite(o.lat) && Number.isFinite(o.lng)).map(o=>[o.lat,o.lng]);
      if(!pts.length){ toast(`Nenhuma OS do SPARK para ${elemento}.`); return; }
      if(pts.length===1) mapManutencao.setView(pts[0], 16);
      else mapManutencao.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom:17 });
    }catch(e){ /* mapa ainda não pronto: o filtro já valeu */ }
  }, 350);
}

/* v3.6.1 - tira a seleção do rank: limpa a busca de OS do mapa (e a tabela de baixo volta ao normal) */
function rankLimparSelecao(){
  rankMapaSel = null;
  const inp = document.getElementById("osBuscaInput");
  if(inp) inp.value = "";
  buscarOS("");
  const w = document.getElementById("rankTabelaWrap"); if(w) w.innerHTML = rankTabelaHtml();
}
