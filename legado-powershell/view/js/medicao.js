/* =========================================================================
   v3.24.0 - MEDIÇÃO DE TERCEIROS (só administrador)
   Tudo o que as equipes TERCEIRAS executaram, linha a linha (uma linha por recurso aplicado numa OS), com as
   colunas da planilha de medição que o SPARK tem. NÃO existem aqui: preços/valores, código do recurso (SIAGO),
   contrato/CC/subconta, auditoria/glosa (vêm de outro sistema e ficam fora por LGPD).
   Fontes: OS executadas (base viva + planos) x equipe com "Própria/Terceira = Terceira" x GET /api/medicao/mo
   (model/mo_linhas_executada.json, guardado pela importação do SGM a partir da v3.23.0).
   Qtd Previsto: o previsto é da OS (não do recurso), então aparece só na 1ª linha de cada OS.
   Depende de: osMapaBase, propTercDaOS, equipeInfo, audPrestador, regionalDaOS, municipioDaOS, qtdOS, multiComboHtml,
   msRestaurarRolagem, apiGet, escapeHtml, fmtDate, toast, souAdministrador.
   ========================================================================= */

const MED_POR_PAG = 100;
const medEstado = {
  mo: null, carregando: false, erro: "", moGeradoEm: null,
  de: "", ate: "",
  prestadores: new Set(), equipes: new Set(), recursos: new Set(), regionais: new Set(),
  busca: "", pag: 1, aba: "linhas",
};
let medCache = { chave: "", linhas: [] };

function medHoje(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function medNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function medFmt(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR", { maximumFractionDigits:2 }); }

async function medicaoInit(){
  if(!medEstado.de && !medEstado.ate){ const h = medHoje(); medEstado.de = h.slice(0,8) + "01"; medEstado.ate = h; }
  medEstado.carregando = true; medEstado.erro = ""; medRedesenhar();
  try {
    const d = await apiGet("/medicao/mo", 120000);
    medEstado.mo = d || { linhas: [] };
    medEstado.moGeradoEm = (d && d.geradoEm) || null;
  } catch(e){ medEstado.erro = String((e && e.message) || e); }
  medEstado.carregando = false; medCache.chave = ""; medRedesenhar();
}

/* índice OS -> linhas de MO (a chave é a OS sem espaços nas pontas) */
let _medIdx = { fonte: null, mapa: new Map() };
function medMoPorOS(){
  const mo = medEstado.mo;
  if(!mo) return new Map();
  if(_medIdx.fonte === mo) return _medIdx.mapa;
  const cols = mo.colunas || [];
  const iOs = cols.indexOf("os"), iG = cols.indexOf("grupo"), iT = cols.indexOf("tipo"), iP = cols.indexOf("qtdPoda"), iL = cols.indexOf("qtdLimpeza"), iE = cols.indexOf("qtdEstrutura");
  const mapa = new Map();
  (mo.linhas || []).forEach(l => {
    const k = String(l[iOs] == null ? "" : l[iOs]).trim();
    if(!k) return;
    const reg = { grupo: l[iG] || "", tipo: l[iT] || "", poda: medNum(l[iP]), limpeza: medNum(l[iL]), estrutura: medNum(l[iE]) };
    if(!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(reg);
  });
  _medIdx = { fonte: mo, mapa };
  return mapa;
}

/* todas as linhas dos terceiros (sem filtro) - cache enquanto base/MO não mudarem */
function medLinhasBase(){
  const base = osMapaBase();
  const chave = (base ? base.length : 0) + "|" + (state.equipes ? state.equipes.length : 0) + "|" + (medEstado.moGeradoEm || "") + "|" + (medEstado.mo ? 1 : 0);
  if(medCache.chave === chave && medCache.base === base) return medCache.linhas;
  const mapa = medMoPorOS();
  const out = [];
  (base || []).forEach(o => {
    if(String(o.statusOS) !== "Executada") return;
    if(propTercDaOS(o) !== "Terceira") return;
    const e = o.equipeId ? equipeInfo(o.equipeId) : null;
    const osId = String(o.id).trim();
    const reg = medEstado.mo ? (mapa.get(osId) || []) : [];
    const comum = {
      equipe: o.equipeId || "", prestador: audPrestador(o, e), departamento: (e && e.departamento) || "",
      os: osId, osPrimaria: o.osPrimaria ? String(o.osPrimaria).trim() : "",
      execucao: o.dataExecucao ? String(o.dataExecucao).slice(0,10) : "", abertura: o.dataAbertura ? String(o.dataAbertura).slice(0,10) : "",
      localidade: o.localidade || o.conjunto || "", polo: municipioDaOS(o) || "", regional: regionalDaOS(o) || "",
      alimentador: o.alimentador || "", lat: o.lat, lng: o.lng, numObra: o.numObra || "",
      criticidade: o.prioridade || "", servico: servicoTextoOS(o), origem: o.origem || "",
    };
    const prev = qtdOS(o, "prev");
    if(!reg.length){
      out.push({ ...comum, grupo: "", recurso: "", semMo: true, qtdPrev: prev, qtdReal: qtdOS(o, "real"), tipoQtd: "" });
      return;
    }
    reg.forEach((r, i) => {
      const q = r.poda + r.limpeza + r.estrutura;
      const tq = [r.poda ? "Poda" : "", r.limpeza ? "Limpeza (m²)" : "", r.estrutura ? "Estrutura" : ""].filter(Boolean).join(" + ");
      out.push({ ...comum, grupo: r.grupo, recurso: r.tipo, semMo: false, qtdPrev: i === 0 ? prev : "", qtdReal: q, tipoQtd: tq });
    });
  });
  out.sort((a, b) => a.execucao.localeCompare(b.execucao) || a.equipe.localeCompare(b.equipe) || a.os.localeCompare(b.os));
  medCache = { chave, base, linhas: out };
  return out;
}
function medLinhasFiltradas(){
  const e = medEstado, b = e.busca.trim().toLowerCase();
  return medLinhasBase().filter(l => {
    if(e.de && (!l.execucao || l.execucao < e.de)) return false;
    if(e.ate && (!l.execucao || l.execucao > e.ate)) return false;
    if(e.prestadores.size && !e.prestadores.has(l.prestador)) return false;
    if(e.equipes.size && !e.equipes.has(l.equipe)) return false;
    if(e.regionais.size && !e.regionais.has(l.regional)) return false;
    if(e.recursos.size && !e.recursos.has(l.recurso || "(sem linha de MO)")) return false;
    if(b && !(`${l.os} ${l.osPrimaria} ${l.equipe} ${l.numObra} ${l.localidade} ${l.recurso} ${l.grupo}`.toLowerCase().includes(b))) return false;
    return true;
  });
}
function medUnicos(campo, extra){
  const s = new Set(); medLinhasBase().forEach(l => { const v = extra ? extra(l) : l[campo]; if(v) s.add(v); });
  return [...s].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function medResumoPor(lista, chaveFn){
  const m = new Map();
  lista.forEach(l => {
    const k = chaveFn(l);
    if(!m.has(k)) m.set(k, { k, os: new Set(), linhas: 0, prev: 0, real: 0 });
    const r = m.get(k); r.os.add(l.os); r.linhas++; r.prev += medNum(l.qtdPrev); r.real += medNum(l.qtdReal);
  });
  return [...m.values()].sort((a, b) => b.real - a.real);
}

function medRedesenhar(){
  const w = document.getElementById("medWrap");
  if(w){ w.innerHTML = medHtml(); if(typeof msRestaurarRolagem === "function") msRestaurarRolagem(); }
}
function medSetCampo(c, v){ medEstado[c] = v; medEstado.pag = 1; medRedesenhar(); }
function medBusca(v){
  medEstado.busca = v; medEstado.pag = 1; medRedesenhar();
  const i = document.getElementById("medBusca"); if(i){ i.focus(); i.setSelectionRange(v.length, v.length); }
}
function medToggle(campo, v, marcado){ if(marcado) medEstado[campo].add(v); else medEstado[campo].delete(v); medEstado.pag = 1; medRedesenhar(); }
function medLimpar(campo){ medEstado[campo] = new Set(); medEstado.pag = 1; medRedesenhar(); }
function medAba(a){ medEstado.aba = a; medRedesenhar(); }
function medPagina(n){ medEstado.pag = n; medRedesenhar(); }
function medMesAtual(){ const h = medHoje(); medEstado.de = h.slice(0,8) + "01"; medEstado.ate = h; medEstado.pag = 1; medRedesenhar(); }
function medMesAnterior(){
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const a = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), ult = new Date(a, d.getMonth()+1, 0).getDate();
  medEstado.de = `${a}-${m}-01`; medEstado.ate = `${a}-${m}-${String(ult).padStart(2,"0")}`; medEstado.pag = 1; medRedesenhar();
}

function medHtml(){
  if(!souAdministrador()) return `<div class="card"><p style="margin:0;">Somente administradores acessam a Medição de terceiros.</p></div>`;
  const e = medEstado;
  if(e.carregando && !e.mo) return `<div class="card"><p style="margin:0; color:var(--muted);">Carregando as linhas de MO…</p></div>`;
  if(e.erro) return `<div class="card"><p style="margin:0; color:#B42318;">Não foi possível carregar as linhas de MO: ${escapeHtml(e.erro)}</p></div>`;
  const semMoArquivo = !e.mo || !(e.mo.linhas || []).length;
  const lista = medLinhasFiltradas();
  const osDist = new Set(lista.map(l => l.os)).size;
  const semMo = new Set(lista.filter(l => l.semMo).map(l => l.os)).size;
  const totReal = lista.reduce((s, l) => s + medNum(l.qtdReal), 0);
  const totPrev = lista.reduce((s, l) => s + medNum(l.qtdPrev), 0);
  const nEq = new Set(lista.map(l => l.equipe)).size;
  const tp = Math.max(1, Math.ceil(lista.length / MED_POR_PAG));
  if(e.pag > tp) e.pag = tp;
  const fatia = lista.slice((e.pag - 1) * MED_POR_PAG, e.pag * MED_POR_PAG);

  const aviso = semMoArquivo
    ? `<div class="card" style="margin-bottom:12px; border-left:4px solid #F79009;"><b>Ainda não há linhas de MO guardadas.</b> Reimporte o SGM (grid + MO executada) depois da v3.23.0 para o SPARK guardar uma linha por recurso. Enquanto isso, a tela mostra uma linha por OS, sem o recurso.</div>`
    : (semMo ? `<div class="card" style="margin-bottom:12px; border-left:4px solid #F79009;">${semMo.toLocaleString("pt-BR")} OS do filtro não têm linha de MO (aparecem sem recurso, com o realizado da própria OS).</div>` : "");

  const campos = `<div class="card" style="margin-bottom:12px;">
    <div class="filters" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; align-items:end;">
      <div class="field"><label>Execução de</label><input type="date" value="${e.de}" onchange="medSetCampo('de', this.value)"></div>
      <div class="field"><label>Execução até</label><input type="date" value="${e.ate}" onchange="medSetCampo('ate', this.value)"></div>
      ${multiComboHtml("medPrest", "Terceiro (prestador)", medUnicos("prestador"), e.prestadores, "medTogglePrest", "medLimparPrest", "Todos", "Buscar terceiro…")}
      ${multiComboHtml("medEq", "Equipe", medUnicos("equipe"), e.equipes, "medToggleEq", "medLimparEq", "Todas", "Buscar equipe…")}
      ${multiComboHtml("medReg", "Regional", medUnicos("regional"), e.regionais, "medToggleReg", "medLimparReg", "Todas", "Buscar regional…")}
      ${multiComboHtml("medRec", "Recurso", medUnicos("recurso", l => l.recurso || "(sem linha de MO)"), e.recursos, "medToggleRec", "medLimparRec", "Todos", "Buscar recurso…")}
      <div class="field"><label>Buscar</label><input type="text" id="medBusca" placeholder="OS, equipe, nº da obra, localidade…" value="${escapeHtml(e.busca)}" oninput="medBusca(this.value)"></div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
      <button type="button" class="btn btn-ghost btn-sm" onclick="medMesAtual()">Mês atual</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="medMesAnterior()">Mês anterior</button>
      <button type="button" class="btn btn-primary btn-sm" onclick="medExportar()">Baixar relatório completo (Excel)</button>
    </div></div>`;

  const kpi = (r, v) => `<div class="kpi-box"><div class="label" style="font-size:12px; color:var(--muted);">${r}</div><div style="font-size:22px; font-weight:700;">${v}</div></div>`;
  const kpis = `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:12px;">
    ${kpi("OS executadas", osDist.toLocaleString("pt-BR"))}${kpi("Linhas (recursos)", lista.length.toLocaleString("pt-BR"))}${kpi("Equipes", nEq.toLocaleString("pt-BR"))}
    ${kpi("Qtd. prevista", medFmt(totPrev))}${kpi("Qtd. realizada", medFmt(totReal))}</div>`;

  const abas = [["linhas", "Linhas da medição"], ["equipe", "Resumo por equipe"], ["recurso", "Resumo por recurso"], ["prestador", "Resumo por terceiro"]]
    .map(([k, t]) => `<button type="button" class="btn ${e.aba === k ? "btn-primary" : "btn-ghost"} btn-sm" onclick="medAba('${k}')">${t}</button>`).join(" ");

  let corpo = "";
  if(!lista.length){
    corpo = `<div class="card"><p style="margin:0; color:var(--muted);">Nenhuma execução de equipe terceira no filtro. Confira o período e se a equipe está cadastrada como “Terceira” em Gestão de Bases › Equipes.</p></div>`;
  } else if(e.aba === "linhas"){
    corpo = `<div class="card"><div class="table-wrap"><table data-sort-manual style="font-size:12px; width:100%;"><thead><tr>
      <th>Equipe</th><th>Terceiro</th><th>OS</th><th>OS primária</th><th>Execução</th><th>Localidade</th><th>Regional</th><th>Nº obra</th><th>Recurso (MO 1)</th><th>Recurso específico</th><th style="text-align:right;">Qtd previsto</th><th style="text-align:right;">Qtd realizado</th><th>Tipo da qtd.</th></tr></thead><tbody>
      ${fatia.map(l => `<tr><td>${escapeHtml(l.equipe)}</td><td>${escapeHtml(l.prestador)}</td><td class="mono">${escapeHtml(l.os)}</td><td class="mono">${escapeHtml(l.osPrimaria)}</td><td>${l.execucao ? fmtDate(l.execucao) : ""}</td><td>${escapeHtml(l.localidade)}</td><td>${escapeHtml(l.regional)}</td><td>${escapeHtml(String(l.numObra))}</td><td>${escapeHtml(l.grupo)}</td><td>${l.semMo ? '<span style="color:#B54708;">(sem linha de MO)</span>' : escapeHtml(l.recurso)}</td><td style="text-align:right;">${l.qtdPrev === "" ? "" : medFmt(l.qtdPrev)}</td><td style="text-align:right;">${medFmt(l.qtdReal)}</td><td>${escapeHtml(l.tipoQtd)}</td></tr>`).join("")}
      </tbody></table></div>
      ${lista.length > MED_POR_PAG ? `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${e.pag<=1?"disabled":""} onclick="medPagina(${e.pag-1})">‹ Anterior</button><span>Página ${e.pag} de ${tp} · ${lista.length.toLocaleString("pt-BR")} linhas</span><button type="button" class="btn btn-ghost btn-sm" ${e.pag>=tp?"disabled":""} onclick="medPagina(${e.pag+1})">Próxima ›</button></div>` : ""}</div>`;
  } else {
    const [rot, fn] = e.aba === "equipe" ? ["Equipe", l => l.equipe] : e.aba === "recurso" ? ["Recurso", l => l.recurso || "(sem linha de MO)"] : ["Terceiro", l => l.prestador];
    const res = medResumoPor(lista, fn);
    corpo = `<div class="card"><div class="table-wrap"><table data-sort-manual style="font-size:12.5px; width:100%;"><thead><tr><th>${rot}</th><th style="text-align:right;">OS</th><th style="text-align:right;">Linhas</th><th style="text-align:right;">Qtd previsto</th><th style="text-align:right;">Qtd realizado</th></tr></thead><tbody>
      ${res.map(r => `<tr><td>${escapeHtml(r.k)}</td><td style="text-align:right;">${r.os.size.toLocaleString("pt-BR")}</td><td style="text-align:right;">${r.linhas.toLocaleString("pt-BR")}</td><td style="text-align:right;">${medFmt(r.prev)}</td><td style="text-align:right;">${medFmt(r.real)}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  return `${aviso}${campos}${kpis}<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">${abas}</div>${corpo}`;
}
function medTogglePrest(v, m){ medToggle("prestadores", v, m); }
function medLimparPrest(){ medLimpar("prestadores"); }
function medToggleEq(v, m){ medToggle("equipes", v, m); }
function medLimparEq(){ medLimpar("equipes"); }
function medToggleReg(v, m){ medToggle("regionais", v, m); }
function medLimparReg(){ medLimpar("regionais"); }
function medToggleRec(v, m){ medToggle("recursos", v, m); }
function medLimparRec(){ medLimpar("recursos"); }

function viewMedicao(){ return `<div id="medWrap">${medHtml()}</div>`; }

/* Relatório cheio: todas as linhas do filtro (sem paginação) + resumos. Sem preço, sem código SIAGO, sem auditoria. */
function medExportar(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const lista = medLinhasFiltradas();
  if(!lista.length){ toast("Nenhuma linha no filtro atual pra exportar."); return; }
  const linhas = lista.map(l => ({
    "Equipe": l.equipe, "Terceiro (prestador)": l.prestador, "Departamento da equipe": l.departamento,
    "OS": l.os, "OS Primária": l.osPrimaria, "Origem": l.origem, "Serviço": l.servico,
    "Dt Abertura": l.abertura ? fmtDate(l.abertura) : "", "Dt Execução": l.execucao ? fmtDate(l.execucao) : "",
    "Localidade OS": l.localidade, "Polo": l.polo, "Regional": l.regional, "Alimentador": l.alimentador,
    "Latitude": l.lat, "Longitude": l.lng, "Nº da obra": l.numObra, "Criticidade (SGM)": l.criticidade,
    "Recurso (MO 1)": l.grupo, "Recurso específico (MO 2)": l.semMo ? "(sem linha de MO)" : l.recurso,
    "Qtd Previsto": l.qtdPrev === "" ? "" : medNum(l.qtdPrev), "Qtd Medido": medNum(l.qtdReal), "Tipo da quantidade": l.tipoQtd,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Medição");
  const resumo = (nome, rot, fn) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(medResumoPor(lista, fn).map(r => ({
    [rot]: r.k, "OS": r.os.size, "Linhas": r.linhas, "Qtd Previsto": Math.round(r.prev*100)/100, "Qtd Medido": Math.round(r.real*100)/100 }))), nome);
  resumo("Por terceiro", "Terceiro", l => l.prestador);
  resumo("Por equipe", "Equipe", l => l.equipe);
  resumo("Por recurso", "Recurso", l => l.recurso || "(sem linha de MO)");
  const e = medEstado;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Medição de terceiros — SPARK"], ["Período de execução", `${e.de ? fmtDate(e.de) : "início"} a ${e.ate ? fmtDate(e.ate) : "hoje"}`],
    ["Gerado em", new Date().toLocaleString("pt-BR")], ["Linhas", lista.length], ["OS distintas", new Set(lista.map(l => l.os)).size],
    ["Observação", "Sem preços, código de recurso (SIAGO) nem auditoria: esses dados vêm de outro sistema."],
  ]), "Sobre");
  const c = new Date();
  XLSX.writeFile(wb, `SPARK_Medicao_terceiros_${c.getFullYear()}${String(c.getMonth()+1).padStart(2,"0")}${String(c.getDate()).padStart(2,"0")}.xlsx`);
  toast(`${lista.length.toLocaleString("pt-BR")} linha(s) exportada(s) para Excel.`);
}
