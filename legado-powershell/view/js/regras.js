/* =========================================================================
   v3.33.0 - REGRAS DE IMPORTAÇÃO (Configuração > Regras de importação)
   Lista + editor (QUANDO / ENTÃO com fórmula / SIMULAÇÃO / histórico). As regras valem na PRÓXIMA importação
   da grid executada ou pendente (OS já gravadas não mudam). Backend: /api/regras (controller/lib/Regras.ps1).
   Depende de: apiGet/apiPost/apiPut/apiDelete, escapeHtml, toast, minhaPermissao.
   ========================================================================= */
const regrasEst = { lista:[], campos:[], funcoes:[], vao:false, historico:[], editando:null, novo:false, sim:null, simErro:"", msgs:{}, carregado:false, erro:"", focoId:null, mostraHist:false };
const REGRAS_OPS_TXT = [["contem","contém"],["naoContem","não contém"],["igual","é igual a"],["diferente","é diferente de"],["vazio","está vazio"],["naoVazio","não está vazio"]];
const REGRAS_OPS_NUM = [["igual","é igual a"],["diferente","é diferente de"],["maior","é maior que"],["menor","é menor que"],["maiorIgual","é maior ou igual a"],["menorIgual","é menor ou igual a"]];
const REGRAS_BASES = [["executada","Grid executada"],["pendente","Grid pendente"]];
let regrasValidaTimer = null;

function regrasCampo(ch){ return regrasEst.campos.find(c=>c.chave===ch) || { chave:ch, rotulo:ch, tipo:"num", leitura:false }; }
function regrasPodeEditar(){ return minhaPermissao("regras","visualizar"); }

async function regrasCarregar(){
  try {
    const d = await apiGet("/regras", 30000);
    regrasEst.lista = (d.regras||[]).slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    regrasEst.campos = d.campos||[]; regrasEst.funcoes = d.funcoes||[]; regrasEst.vao = !!d.vaoImportado;
    regrasEst.historico = await apiGet("/regras/historico", 30000);
    regrasEst.erro = ""; regrasEst.carregado = true;
  } catch(e){ regrasEst.erro = String(e.message||e); }
  regrasRender();
}
function regrasRender(){
  const w = document.getElementById("cfgRegrasWrap"); if(!w) return;
  w.innerHTML = regrasEst.editando ? regrasEditorHtml() : regrasListaHtml();
  if(regrasEst.editando) regrasValidarTodas();
}
function regrasAbaHtml(){ return `<div id="cfgRegrasWrap">${regrasEst.carregado ? (regrasEst.editando ? regrasEditorHtml() : regrasListaHtml()) : `<div class="card"><p style="color:var(--muted); margin:0;">${regrasEst.erro ? "Não consegui carregar as regras: "+escapeHtml(regrasEst.erro) : "Carregando regras…"}</p></div>`}</div>`; }

/* ---------------- resumo legível ---------------- */
function regrasOpRot(op){ return ([...REGRAS_OPS_TXT,...REGRAS_OPS_NUM].find(x=>x[0]===op)||[op,op])[1]; }
function regrasQuandoTxt(r){
  if(!(r.condicoes||[]).length) return `<span style="color:var(--muted)">Toda OS</span>`;
  return r.condicoes.map(c=>{ const cp = regrasCampo(c.campo); const sv = ["vazio","naoVazio"].includes(c.op) ? "" : ` <code>${escapeHtml(c.valor)}</code>`; return `${escapeHtml(cp.rotulo)} ${escapeHtml(regrasOpRot(c.op))}${sv}`; }).join(" <b>e</b> ");
}
function regrasEntaoTxt(r){
  const a = r.acoes||[]; if(!a.length) return `<span style="color:var(--muted)">—</span>`;
  return a.map(x=>{ const cp = regrasCampo(x.campo); return `${escapeHtml(cp.rotulo)} = <code>${escapeHtml(x.valor)}</code>`; }).join("; ");
}
function regrasListaHtml(){
  const pode = regrasPodeEditar();
  const linhas = regrasEst.lista.map((r,i)=>`
    <tr>
      <td style="font-variant-numeric:tabular-nums;">${r.ordem}</td>
      <td><b>${escapeHtml(r.nome)}</b>${r.descricao?`<div style="font-size:12.5px; color:var(--muted); margin-top:2px;">${escapeHtml(r.descricao)}</div>`:""}</td>
      <td style="font-size:13px;">${regrasQuandoTxt(r)}</td>
      <td style="font-size:13px; max-width:360px;">${regrasEntaoTxt(r)}</td>
      <td style="font-size:13px;">${(r.aplicaEm||[]).map(b=>(REGRAS_BASES.find(x=>x[0]===b)||[b,b])[1]).join(" e ")}</td>
      <td><label class="check-row" style="margin:0;"><input type="checkbox" ${r.ativa?"checked":""} ${pode?"":"disabled"} onchange="regrasAlternar(${i})"> ${r.ativa?"Ativa":"Desativada"}</label></td>
      <td style="text-align:right; white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="regrasEditar(${i})">Editar</button></td>
    </tr>`).join("");
  const avisoVao = regrasEst.vao ? "" : `<div class="card" style="margin-bottom:14px; border-left:3px solid #d97706;"><b>O Vão ainda não foi importado.</b> Regras que usam <code>[Vão (km)]</code> (como a Poda linear) são ignoradas até importar o Vão em Importação de Bases.</div>`;
  const hist = regrasEst.historico||[];
  return `
    ${avisoVao}
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div><h3 style="margin:0 0 4px;">Regras de importação</h3>
          <p style="margin:0; font-size:13px; color:var(--muted); max-width:720px;">Regras mudam o que entra no sistema quando você importa a grid executada ou pendente. Rodam de cima para baixo (pela ordem) e valem a partir da <b>próxima importação</b>.</p></div>
        ${pode?`<button class="btn btn-primary" onclick="regrasNova()">+ Nova regra</button>`:""}
      </div>
      <div class="table-wrap" style="margin-top:12px;"><table data-sort-manual>
        <thead><tr><th style="width:56px;">Ordem</th><th>Regra</th><th>Quando</th><th>Então</th><th>Aplica em</th><th>Status</th><th></th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="7" style="color:var(--muted); padding:18px;">Nenhuma regra. Clique em “+ Nova regra”.</td></tr>`}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="regrasEst.mostraHist=!regrasEst.mostraHist; regrasRender();">
        <h3 style="margin:0;">Histórico de alterações <span style="font-weight:400; color:var(--muted); font-size:13px;">(${hist.length})</span></h3><span>${regrasEst.mostraHist?"▲":"▼"}</span></div>
      ${regrasEst.mostraHist ? regrasHistTabela(hist) : ""}
    </div>`;
}
function regrasHistTabela(h){
  if(!h.length) return `<p style="color:var(--muted); font-size:13px;">Ainda sem alterações.</p>`;
  return `<div class="table-wrap" style="margin-top:10px;"><table data-sort-manual><thead><tr><th>Quando</th><th>Quem</th><th>Regra</th><th>O que foi feito</th></tr></thead><tbody>${h.map(x=>`<tr><td style="white-space:nowrap;">${escapeHtml(String(x.em||"").replace("T"," "))}</td><td>${escapeHtml(x.usuario||"")}</td><td>${escapeHtml(x.nome||"")}</td><td>${escapeHtml(x.acao||"")}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------------- ações da lista ---------------- */
async function regrasAlternar(i){
  const r = JSON.parse(JSON.stringify(regrasEst.lista[i])); r.ativa = !r.ativa;
  try { await apiPut("/regras/"+encodeURIComponent(r.id), r, 30000); toast(r.ativa?"Regra ativada":"Regra desativada"); }
  catch(e){ toast("Não salvou: "+String(e.message||e).replace(/^.*\(/,"").replace(/\)$/,"")); }
  await regrasCarregar();
}
function regrasNova(){
  regrasEst.novo = true; regrasEst.sim = null; regrasEst.simErro = "";
  regrasEst.editando = { id:null, nome:"", descricao:"", ativa:true, ordem:regrasEst.lista.length+1, aplicaEm:["executada","pendente"], condicoes:[], acoes:[{campo:"realizadoPoda", valor:"0"}] };
  regrasEst.amostra = regrasAmostraPadrao(); regrasRender();
}
function regrasEditar(i){
  regrasEst.novo = false; regrasEst.sim = null; regrasEst.simErro = "";
  regrasEst.editando = JSON.parse(JSON.stringify(regrasEst.lista[i]));
  regrasEst.amostra = regrasAmostraPadrao(); regrasRender();
}
function regrasAmostraPadrao(){ return { esquema:"PODA LINEAR", tipoServico:"Poda", previstoPoda:"1", previstoLimpeza:"0", previstoEstrutura:"0", realizadoPoda:"1", realizadoLimpeza:"0", realizadoEstrutura:"0", vaoKm:"0,8", soPrevisto:"0" }; }
function regrasVoltar(){ regrasEst.editando = null; regrasRender(); }

/* ---------------- editor ---------------- */
function regrasOpcoesOps(tipo, sel){ return (tipo==="texto"?REGRAS_OPS_TXT:REGRAS_OPS_NUM).map(([v,t])=>`<option value="${v}" ${v===sel?"selected":""}>${t}</option>`).join(""); }
function regrasEditorHtml(){
  const r = regrasEst.editando, pode = regrasPodeEditar();
  const campos = regrasEst.campos;
  const condHtml = r.condicoes.map((c,i)=>{
    const cp = regrasCampo(c.campo); const semValor = ["vazio","naoVazio"].includes(c.op);
    return `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
      <select onchange="regrasCondCampo(${i}, this.value)" style="min-width:210px;">${campos.map(x=>`<option value="${x.chave}" ${x.chave===c.campo?"selected":""}>${escapeHtml(x.rotulo)}</option>`).join("")}</select>
      <select onchange="regrasEst.editando.condicoes[${i}].op=this.value; regrasRender();" style="min-width:150px;">${regrasOpcoesOps(cp.tipo, c.op)}</select>
      ${semValor?"":`<input type="text" value="${escapeHtml(c.valor)}" oninput="regrasEst.editando.condicoes[${i}].valor=this.value" style="min-width:160px;" placeholder="valor">`}
      <button class="btn btn-ghost btn-sm" onclick="regrasEst.editando.condicoes.splice(${i},1); regrasRender();" title="Remover condição">Remover</button>
    </div>`; }).join("");
  const acoesHtml = r.acoes.map((a,i)=>{
    const cp = regrasCampo(a.campo);
    const gravaveis = campos.filter(x=>!x.leitura);
    return `<div style="margin-bottom:12px;">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select onchange="regrasAcaoCampo(${i}, this.value)" style="min-width:210px;">${gravaveis.map(x=>`<option value="${x.chave}" ${x.chave===a.campo?"selected":""}>${escapeHtml(x.rotulo)}</option>`).join("")}</select>
        <span>=</span>
        <input type="text" id="regraAc${i}" value="${escapeHtml(a.valor)}" ${cp.tipo==="num"?`style="flex:1; min-width:260px; font-family:ui-monospace,Consolas,monospace;"`:`style="flex:1; min-width:260px;"`}
          onfocus="regrasEst.focoId='regraAc${i}'" oninput="regrasEst.editando.acoes[${i}].valor=this.value; regrasValidarUma(${i})" placeholder="${cp.tipo==="num"?"fórmula, ex.: [Vão (km)] * 15000":"texto"}">
        <button class="btn btn-ghost btn-sm" onclick="regrasEst.editando.acoes.splice(${i},1); regrasRender();" title="Remover ação">Remover</button>
      </div>
      <div id="regraMsg${i}" style="font-size:12.5px; margin:4px 0 0 2px; min-height:16px;"></div>
    </div>`; }).join("");
  const A = regrasEst.amostra;
  const campoAm = (k,rot,larg)=>`<div class="field" style="margin:0;"><label style="font-size:12px;">${rot}</label><input type="text" value="${escapeHtml(A[k])}" oninput="regrasEst.amostra['${k}']=this.value" style="width:${larg||110}px;"></div>`;
  const hist = (regrasEst.historico||[]).filter(h=>h.regraId===r.id);
  return `
    <div style="margin-bottom:12px;"><button class="btn btn-ghost btn-sm" onclick="regrasVoltar()">← Voltar às regras</button></div>
    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 10px;">${regrasEst.novo?"Nova regra":"Editar regra"}</h3>
      <div style="display:flex; gap:14px; flex-wrap:wrap;">
        <div class="field" style="flex:2; min-width:260px;"><label>Nome</label><input type="text" value="${escapeHtml(r.nome)}" oninput="regrasEst.editando.nome=this.value"></div>
        <div class="field" style="width:90px;"><label>Ordem</label><input type="number" min="1" value="${r.ordem}" oninput="regrasEst.editando.ordem=Number(this.value)||1"></div>
        <div class="field"><label>Aplica em</label><div style="display:flex; gap:14px; padding-top:6px;">${REGRAS_BASES.map(([v,t])=>`<label class="check-row" style="margin:0;"><input type="checkbox" ${r.aplicaEm.includes(v)?"checked":""} onchange="regrasBase('${v}', this.checked)"> ${t}</label>`).join("")}</div></div>
        <div class="field"><label>Situação</label><label class="check-row" style="margin:6px 0 0;"><input type="checkbox" ${r.ativa?"checked":""} onchange="regrasEst.editando.ativa=this.checked"> Ativa</label></div>
      </div>
      <div class="field"><label>Descrição</label><input type="text" value="${escapeHtml(r.descricao||"")}" oninput="regrasEst.editando.descricao=this.value" placeholder="Para que serve esta regra"></div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 4px;">QUANDO</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 10px;">${r.condicoes.length?"Todas as condições abaixo precisam ser verdadeiras.":"Sem condições: a regra vale para toda OS."}</p>
      ${condHtml}
      <button class="btn btn-ghost btn-sm" onclick="regrasAddCond()">+ Adicionar condição</button>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 4px;">ENTÃO</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 10px;">Cada ação define o valor de um campo. A fórmula enxerga os valores de <b>antes</b> da regra. Separe argumentos com <code>;</code> e use vírgula nos decimais.</p>
      ${acoesHtml}
      <button class="btn btn-ghost btn-sm" onclick="regrasAddAcao()">+ Adicionar ação</button>
      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
        <div style="font-size:12.5px; font-weight:600; margin-bottom:6px;">Campos (clique para inserir na fórmula)</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">${campos.filter(x=>x.tipo==="num").map(x=>`<button class="btn btn-ghost btn-sm" onclick="regrasInserir('[${escapeHtml(x.rotulo)}]')">${escapeHtml(x.rotulo)}</button>`).join("")}</div>
        <div style="font-size:12.5px; font-weight:600; margin-bottom:6px;">Funções</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">${regrasEst.funcoes.map(f=>`<button class="btn btn-ghost btn-sm" title="${escapeHtml(f.ajuda)}" onclick="regrasInserir('${f.nome}(')">${f.nome}</button>`).join("")}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 4px;">SIMULAÇÃO</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 10px;">Preencha uma OS de exemplo e veja o que a regra faria. Não grava nada.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        ${campoAm("esquema","Esquema",190)}${campoAm("tipoServico","Tipo de serviço",130)}
        ${campoAm("previstoPoda","Prev. poda")}${campoAm("previstoLimpeza","Prev. limpeza")}${campoAm("previstoEstrutura","Prev. estrutura")}
        ${campoAm("realizadoPoda","Real. poda")}${campoAm("realizadoLimpeza","Real. limpeza")}${campoAm("realizadoEstrutura","Real. estrutura")}
        ${campoAm("vaoKm","Vão (km)",90)}${campoAm("soPrevisto","Só previsto (0/1)",100)}
        <button class="btn btn-primary btn-sm" onclick="regrasSimular()">Simular</button>
      </div>
      ${regrasSimHtml()}
    </div>

    ${hist.length?`<div class="card" style="margin-bottom:14px;"><h3 style="margin:0;">Histórico desta regra</h3>${regrasHistTabela(hist)}</div>`:""}

    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:24px;">
      ${pode?`<button class="btn btn-primary" onclick="regrasSalvar()">Salvar regra</button>`:""}
      <button class="btn btn-ghost" onclick="regrasVoltar()">Cancelar</button>
      ${pode && !regrasEst.novo?`<button class="btn btn-ghost" style="margin-left:auto; color:#b91c1c;" onclick="regrasApagar()">Apagar regra</button>`:""}
    </div>`;
}
function regrasSimHtml(){
  if(regrasEst.simErro) return `<p style="color:#b91c1c; margin:12px 0 0; font-size:13px;">${escapeHtml(regrasEst.simErro)}</p>`;
  const s = regrasEst.sim; if(!s) return "";
  const nomes = { esquema:"Esquema", tipoServico:"Tipo de serviço", previstoPoda:"Previsto poda", previstoLimpeza:"Previsto limpeza", previstoEstrutura:"Previsto estrutura", realizadoPoda:"Realizado poda", realizadoLimpeza:"Realizado limpeza", realizadoEstrutura:"Realizado estrutura", previstoTotal:"Previsto total", realizadoTotal:"Realizado total" };
  const fmt = v => typeof v === "number" ? v.toLocaleString("pt-BR",{maximumFractionDigits:2}) : escapeHtml(v==null?"":String(v));
  const aviso = s.erro ? `<p style="color:#b91c1c; margin:12px 0 4px; font-size:13px;">A regra foi ignorada: ${escapeHtml(s.erro)}</p>` : (!s.aplicou ? `<p style="color:#b45309; margin:12px 0 4px; font-size:13px;">As condições (QUANDO) não batem com esta OS — a regra não faria nada.</p>` : `<p style="color:#15803d; margin:12px 0 4px; font-size:13px;">A regra se aplica a esta OS.</p>`);
  return aviso + `<div class="table-wrap"><table data-sort-manual style="max-width:520px;"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>${Object.keys(nomes).map(k=>{ const mudou = String(s.antes[k])!==String(s.depois[k]); return `<tr${mudou?` style="background:rgba(243,112,32,.10); font-weight:600;"`:""}><td>${nomes[k]}</td><td>${fmt(s.antes[k])}</td><td>${fmt(s.depois[k])}</td></tr>`; }).join("")}</tbody></table></div>`;
}

/* ---------------- edição ---------------- */
function regrasBase(v, on){ const a = regrasEst.editando.aplicaEm; const i = a.indexOf(v); if(on && i<0) a.push(v); if(!on && i>=0) a.splice(i,1); }
function regrasAddCond(){ regrasEst.editando.condicoes.push({ campo:"esquema", op:"contem", valor:"" }); regrasRender(); }
function regrasCondCampo(i, ch){ const c = regrasEst.editando.condicoes[i], tp = regrasCampo(ch).tipo; c.campo = ch; c.op = tp==="texto"?"contem":"maior"; c.valor = ""; regrasRender(); }
function regrasAddAcao(){ regrasEst.editando.acoes.push({ campo:"realizadoPoda", valor:"0" }); regrasRender(); }
function regrasAcaoCampo(i, ch){ const a = regrasEst.editando.acoes[i]; a.campo = ch; a.valor = regrasCampo(ch).tipo==="texto" ? "" : "0"; regrasRender(); }
function regrasInserir(txt){
  const id = regrasEst.focoId && document.getElementById(regrasEst.focoId) ? regrasEst.focoId : null;
  const el = id ? document.getElementById(id) : document.querySelector('[id^="regraAc"]'); if(!el){ toast("Adicione uma ação primeiro"); return; }
  const i = Number(el.id.replace("regraAc","")), a = regrasEst.editando.acoes[i];
  if(regrasCampo(a.campo).tipo!=="num"){ toast("Esta ação é um texto, não uma fórmula"); return; }
  const ini = el.selectionStart==null ? el.value.length : el.selectionStart, fim = el.selectionEnd==null ? ini : el.selectionEnd;
  el.value = el.value.slice(0,ini) + txt + el.value.slice(fim); a.valor = el.value;
  el.focus(); el.setSelectionRange(ini+txt.length, ini+txt.length); regrasEst.focoId = el.id; regrasValidarUma(i);
}
function regrasValidarTodas(){ (regrasEst.editando.acoes||[]).forEach((_,i)=>regrasValidarUma(i, true)); }
function regrasValidarUma(i, agora){
  const a = regrasEst.editando && regrasEst.editando.acoes[i]; const box = document.getElementById("regraMsg"+i); if(!a||!box) return;
  if(regrasCampo(a.campo).tipo!=="num"){ box.innerHTML = ""; return; }
  clearTimeout(regrasValidaTimer);
  const rodar = async ()=>{
    try {
      const v = await apiPost("/regras/validar", { formula:a.valor }, 15000);
      const b2 = document.getElementById("regraMsg"+i); if(!b2) return;
      b2.innerHTML = v.ok ? `<span style="color:#15803d;">✓ Fórmula válida</span>` : `<span style="color:#b91c1c;">✗ ${escapeHtml(v.erro)}</span>`;
    } catch(e){ /* sem rede: a validação final acontece ao salvar */ }
  };
  if(agora) rodar(); else regrasValidaTimer = setTimeout(rodar, 350);
}
async function regrasSimular(){
  regrasEst.sim = null; regrasEst.simErro = "";
  try { regrasEst.sim = await apiPost("/regras/simular", { regra:regrasEst.editando, amostra:regrasEst.amostra }, 20000); }
  catch(e){ regrasEst.simErro = String(e.message||e).replace(/^.*\(/,"").replace(/\)$/,""); }
  const keep = regrasEst.focoId; regrasRender(); const el = keep && document.getElementById(keep); if(el) el.blur();
}
async function regrasSalvar(){
  const r = regrasEst.editando;
  try {
    if(regrasEst.novo) await apiPost("/regras", r, 30000); else await apiPut("/regras/"+encodeURIComponent(r.id), r, 30000);
    toast("Regra salva — vale a partir da próxima importação"); regrasEst.editando = null; await regrasCarregar();
  } catch(e){ toast("Não salvou: "+String(e.message||e).replace(/^.*\(/,"").replace(/\)$/,"")); }
}
async function regrasApagar(){
  const r = regrasEst.editando; if(!confirm(`Apagar a regra “${r.nome}”? Isso não afeta as OS já importadas.`)) return;
  try { await apiDelete("/regras/"+encodeURIComponent(r.id), 30000); toast("Regra apagada"); regrasEst.editando = null; await regrasCarregar(); }
  catch(e){ toast("Não apagou: "+String(e.message||e)); }
}
