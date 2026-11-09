/* =========================================================================
   v3.9.0 - BOLETIM DE PRODUTIVIDADE (Excel e PDF)
   Uma tabela por semana: Equipe x dia, com "Prev." (meta do dia da equipe) e "Real." (executado no dia).
   Real verde = bateu a meta do dia; vermelho = ficou abaixo. Período livre (de/até): vira uma folha/página por semana.
   Usa os mesmos dados e filtros da Produtividade (departamento, regional, polo, própria/terceira, equipe poda, equipe).
   Carrega depois do app.js; só roda quando o usuário clica em "Boletim".
   ========================================================================= */
let bolCfg = { de:"", ate:"", serv:"poda", formato:"xlsx" };
const BOL_DIAS_NOME = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const BOL_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function bolSemanaPadrao(offsetSemanas){
  const seg = isoMais(isoSegundaDe(prodHojeIso()), 7*(offsetSemanas||0));
  return { de:seg, ate:isoMais(seg,4) };   // segunda a sexta
}
function bolAbrir(){
  if(!bolCfg.de || !bolCfg.ate){ const s = bolSemanaPadrao(0); bolCfg.de = s.de; bolCfg.ate = s.ate; }
  openModal(`
    <h2>Boletim de produtividade</h2>
    <p class="modal-sub">Equipe por dia: <strong>Prev.</strong> = meta do dia · <strong>Real.</strong> = executado. Usa os filtros da tela (departamento, regional, polo, etc.). Cada semana do período vira uma folha (Excel) ou uma página (PDF).</p>
    <div class="field-row" style="margin-bottom:10px;">
      <div class="field"><label>De</label><input type="date" id="bolDe" value="${bolCfg.de}" onchange="bolCfg.de=this.value"></div>
      <div class="field"><label>Até</label><input type="date" id="bolAte" value="${bolCfg.ate}" onchange="bolCfg.ate=this.value"></div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
      <button type="button" class="btn btn-ghost btn-sm" onclick="bolPreset(0)">Semana atual</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="bolPreset(-1)">Semana anterior</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="bolPreset(-3)">Últimas 4 semanas</button>
    </div>
    <div class="field" style="margin-bottom:12px;"><label>Serviço</label>
      <select id="bolServ" onchange="bolCfg.serv=this.value">
        <option value="poda" ${bolCfg.serv==="poda"?"selected":""}>Poda (un.)</option>
        <option value="faixa" ${bolCfg.serv==="faixa"?"selected":""}>Limpeza de faixa (km)</option>
        <option value="ambos" ${bolCfg.serv==="ambos"?"selected":""}>Os dois (uma folha/página de cada)</option>
      </select>
    </div>
    <div id="bolAviso" style="font-size:12px; color:var(--muted); min-height:16px;"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
      <button class="btn btn-ghost" onclick="bolGerar('pdf')">Baixar PDF</button>
      <button class="btn btn-primary" onclick="bolGerar('xlsx')">Baixar Excel</button>
    </div>`);
}
function bolPreset(n){
  if(n===-3){ const seg = isoMais(isoSegundaDe(prodHojeIso()), -21); bolCfg.de = seg; bolCfg.ate = isoMais(isoSegundaDe(prodHojeIso()), 4); }
  else { const s = bolSemanaPadrao(n); bolCfg.de = s.de; bolCfg.ate = s.ate; }
  const a = document.getElementById("bolDe"), b = document.getElementById("bolAte");
  if(a) a.value = bolCfg.de; if(b) b.value = bolCfg.ate;
}

/* ---------- dados ---------- */
function bolSemanas(de, ate){
  const semanas = [];
  for(let seg = isoSegundaDe(de); seg <= ate && semanas.length < 60; seg = isoMais(seg, 7)){
    let dias = [0,1,2,3,4,5,6].map(i=>isoMais(seg,i)).filter(d=>d>=de && d<=ate);
    semanas.push({ seg, dias });
  }
  return semanas;
}
function bolEquipesBase(){
  const f = prodFiltro, ok = (set, v)=> !set.size || set.has(String(v||""));
  return (state.equipes||[]).filter(e=>
    ok(f.polo, e.polo) && ok(f.regional, e.regional) && ok(f.departamento, e.departamento) &&
    ok(f.proprioTerceiro, e.proprioTerceiro) && ok(f.equipe, e.id) &&
    (!f.equipePoda.size || (f.equipePoda.has("sim") && !!e.equipePoda) || (f.equipePoda.has("nao") && !e.equipePoda)));
}
function bolFmt(n, tipo){ const k = tipo==="faixa" ? 100 : 10; return Math.round((n||0)*k)/k; }
function bolSemanaRotulo(seg){
  const d = new Date(seg+"T12:00:00");
  return `${Math.ceil(d.getDate()/7)}ª Semana ${BOL_MESES[d.getMonth()]}`;
}
function bolTipoRot(e){
  const l = prodLinhaDaEquipe(e);
  return l==="LV" ? "Linha Viva - LV" : l==="LM" ? "Linha Morta - LM" : (e.tipoEquipe || "");
}
/* monta os dados de uma semana para um serviço. Equipe entra se tem meta em algum dia da semana ou produziu. */
function bolDadosSemana(sem, tipo, base){
  const exec = prodExecucao(tipo);
  let dias = sem.dias.filter(d=>{ const dow = new Date(d+"T12:00:00").getDay(); return dow!==0 && dow!==6; });
  // fim de semana só aparece se alguém produziu nele
  sem.dias.filter(d=>!dias.includes(d)).forEach(d=>{ if(base.some(e=>(exec[e.id]||{})[d]>0)) dias.push(d); });
  dias.sort();
  const linhas = [];
  base.forEach(e=>{
    const ex = exec[e.id] || {};
    const cel = dias.map(d=>({ prev: prodMetaDia(e.id, d, tipo), real: ex[d]||0 }));
    if(!cel.some(c=>c.prev>0 || c.real>0)) return;
    linhas.push({ e, cel, prev:cel.reduce((s,c)=>s+c.prev,0), real:cel.reduce((s,c)=>s+c.real,0) });
  });
  const c = (a,b)=>String(a||"").localeCompare(String(b||""),"pt-BR",{sensitivity:"base",numeric:true});
  linhas.sort((x,y)=>c(x.e.departamento,y.e.departamento) || c(x.e.proprioTerceiro,y.e.proprioTerceiro) || c(bolTipoRot(x.e),bolTipoRot(y.e)) || c(x.e.regional,y.e.regional) || c(x.e.id,y.e.id));
  const totais = dias.map((d,i)=>({ prev:linhas.reduce((s,l)=>s+l.cel[i].prev,0), real:linhas.reduce((s,l)=>s+l.cel[i].real,0) }));
  return { dias, linhas, totais, tipo, semana:sem };
}
function bolColetar(){
  const de = bolCfg.de, ate = bolCfg.ate;
  if(!de || !ate || de>ate){ toast("Escolha um período válido (De antes de Até)."); return null; }
  const semanas = bolSemanas(de, ate);
  if(!semanas.length){ toast("Nenhuma semana no período."); return null; }
  const tipos = bolCfg.serv==="ambos" ? ["poda","faixa"] : [bolCfg.serv];
  const base = bolEquipesBase();
  const blocos = [];
  semanas.forEach(s=>tipos.forEach(t=>{ const d = bolDadosSemana(s, t, base); if(d.linhas.length && d.dias.length) blocos.push(d); }));
  if(!blocos.length){ toast("Nenhuma equipe com meta ou produção nesse período (com os filtros atuais)."); return null; }
  return blocos;
}
function bolNomeArquivo(ext){ return `SPARK_Boletim_Produtividade_${bolCfg.de}_a_${bolCfg.ate}.${ext}`; }
function bolGerar(formato){
  const a = document.getElementById("bolDe"), b = document.getElementById("bolAte"), s = document.getElementById("bolServ");
  if(a) bolCfg.de = a.value; if(b) bolCfg.ate = b.value; if(s) bolCfg.serv = s.value;
  const blocos = bolColetar(); if(!blocos) return;
  if(formato==="pdf") bolPdf(blocos); else bolXlsx(blocos);
}

/* resumo por Dep. x Origem (própria/terceira) x Tipo (LV/LM), somando as equipes do boletim */
function bolResumo(B){
  const mapa = new Map();
  B.linhas.forEach(l=>{
    const dep = l.e.departamento||"", orig = String(l.e.proprioTerceiro||"").toUpperCase(), tipo = bolTipoRot(l.e);
    const k = dep+"\u0000"+orig+"\u0000"+tipo;
    let g = mapa.get(k); if(!g){ g = { dep, orig, tipo, cel:B.dias.map(()=>({prev:0,real:0})), prev:0, real:0 }; mapa.set(k,g); }
    l.cel.forEach((c,i)=>{ g.cel[i].prev += c.prev; g.cel[i].real += c.real; });
    g.prev += l.prev; g.real += l.real;
  });
  const c = (a,b)=>String(a||"").localeCompare(String(b||""),"pt-BR",{sensitivity:"base"});
  return [...mapa.values()].sort((x,y)=>c(x.dep,y.dep)||c(x.orig,y.orig)||c(x.tipo,y.tipo));
}
function bolPct(c){ return c.prev>0 ? c.real/c.prev : null; }
function bolPctTxt(c){ const p = bolPct(c); return p===null ? "" : Math.round(p*100).toLocaleString("pt-BR")+"%"; }

/* ---------- PDF (impressão do navegador) ---------- */
function bolClasse(c){
  if(c.prev>0) return c.real >= c.prev - 1e-9 ? "bol-ok" : "bol-ruim";
  return c.real>0 ? "bol-ok" : "bol-neutro";
}
function bolPdf(blocos){
  let el = document.getElementById("printProg");
  if(!el){ el = document.createElement("div"); el.id = "printProg"; document.body.appendChild(el); }
  const nf = (n,t)=>bolFmt(n,t).toLocaleString("pt-BR");
  const tri = (c,t,neg)=>`<td class="n">${nf(c.prev,t)}</td><td class="n ${bolClasse(c)}">${nf(c.real,t)}</td><td class="n ${bolClasse(c)}">${bolPctTxt(c)}</td>`;
  el.innerHTML = blocos.map((B,bi)=>{
    const un = B.tipo==="faixa" ? "km" : "un.", t = B.tipo, res = bolResumo(B);
    const cab3 = `${B.dias.map(()=>`<th class="bol-prev">Prev.</th><th class="bol-real">Real.</th><th class="bol-pct">%</th>`).join("")}<th class="bol-prev">Prev.</th><th class="bol-real">Real.</th><th class="bol-pct">%</th>`;
    const totDia = B.totais.map(x=>tri(x,t)).join("");
    const totSem = { prev:B.totais.reduce((s,x)=>s+x.prev,0), real:B.totais.reduce((s,x)=>s+x.real,0) };
    return `<section class="bol-pagina" ${bi>0?'style="break-before:page; page-break-before:always;"':""}>
      <h1>Boletim de produtividade — ${B.tipo==="faixa"?"Limpeza de faixa (km)":"Poda (un.)"}</h1>
      <p class="pp-sub">${escapeHtml(bolSemanaRotulo(B.semana.seg))} · ${fmtDate(B.dias[0])} a ${fmtDate(B.dias[B.dias.length-1])} · Prev. = meta do dia · Real. = executado (${un}) · gerado pelo SPARK em ${new Date().toLocaleString("pt-BR")}</p>
      <table class="bol-pdf"><thead>
        <tr><th rowspan="3" colspan="5" class="bol-t">EQUIPES</th>
          <th colspan="${B.dias.length*3}" class="bol-band">${escapeHtml(bolSemanaRotulo(B.semana.seg))}</th><th colspan="3" rowspan="2" class="bol-band">Total da semana</th></tr>
        <tr>${B.dias.map(d=>`<th colspan="3" class="bol-dia">${BOL_DIAS_NOME[new Date(d+"T12:00:00").getDay()]}<br><span>${d.slice(8,10)}/${d.slice(5,7)}</span></th>`).join("")}</tr>
        <tr>${cab3}</tr>
      </thead><tbody>
        <tr class="bol-sub"><td>DEP.</td><td>ORIGEM</td><td colspan="3">Tipo</td><td colspan="${B.dias.length*3+3}">Resumo</td></tr>
        ${res.map(g=>`<tr><td>${escapeHtml(g.dep)}</td><td>${escapeHtml(g.orig)}</td><td colspan="3">${escapeHtml(g.tipo)}</td>${g.cel.map(c=>tri(c,t)).join("")}${tri({prev:g.prev,real:g.real},t)}</tr>`).join("")}
        <tr class="bol-total"><td colspan="5">Total geral</td>${totDia}${tri(totSem,t)}</tr>
        <tr class="bol-sub"><td>DEP.</td><td>PROP./TERC.</td><td>TIPO</td><td>REGIONAL</td><td>EQUIPE</td><td colspan="${B.dias.length*3+3}">Detalhe por equipe</td></tr>
        ${B.linhas.map(l=>`<tr><td>${escapeHtml(l.e.departamento||"")}</td><td>${escapeHtml(String(l.e.proprioTerceiro||"").toUpperCase())}</td><td>${escapeHtml(bolTipoRot(l.e))}</td><td>${escapeHtml(l.e.regional||"")}</td><td class="bol-eqn">${escapeHtml(l.e.id)}</td>
          ${l.cel.map(c=>tri(c,t)).join("")}${tri({prev:l.prev,real:l.real},t)}</tr>`).join("")}
        <tr class="bol-total"><td colspan="5">Total</td>${totDia}${tri(totSem,t)}</tr>
      </tbody></table>
    </section>`;
  }).join("");
  const pg = document.createElement("style");
  pg.id = "paginaBoletimPdf";
  pg.textContent = "@page{ size:A4 landscape; margin:7mm; }";
  document.head.appendChild(pg);
  const antes = document.title;
  document.title = bolNomeArquivo("pdf").replace(/\.pdf$/, "");
  document.body.classList.add("imprimindo-prog");
  const fim = ()=>{ document.body.classList.remove("imprimindo-prog"); document.title = antes; el.innerHTML = ""; const x = document.getElementById("paginaBoletimPdf"); if(x) x.remove(); window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  closeModal();
  setTimeout(()=>window.print(), 80);
}

/* ---------- Excel com cores (escritor próprio: a biblioteca de planilha da tela não grava estilo) ---------- */
const BOL_COL = n=>{ let s = ""; n++; while(n>0){ const m = (n-1)%26; s = String.fromCharCode(65+m)+s; n = Math.floor((n-1)/26); } return s; };
/* índices dos estilos (cellXfs) definidos em bolStylesXml */
const BS = { normal:0, titulo:1, banda:2, dia:3, data:4, prev:5, real:6, cab:7, equipe:8, txt:9, txtC:10, nOk:11, nRuim:12, nNeutro:13, nPlano:14, tot:15, totTxt:16, equipeCab:17, pOk:18, pRuim:19, pNeutro:20, totP:21, sub:22 };
function bolStylesXml(){
  const fill = rgb=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',
    fill("7030A0"),fill("DDEBF7"),fill("C6E0B4"),fill("F4B183"),fill("FFC7CE"),fill("E2EFDA"),fill("F2F2F2"),fill("D9D9D9"),fill("BDD7EE")];
  // fills: 2 roxo, 3 azul claro (prev), 4 verde (real cab), 5 laranja, 6 vermelho claro, 7 verde claro, 8 cinza claro, 9 cinza, 10 azul
  const fonts = [
    '<font><sz val="10"/><name val="Calibri"/></font>',
    '<font><b/><sz val="10"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    '<font><b/><sz val="10"/><color rgb="FF9C0006"/><name val="Calibri"/></font>',
    '<font><b/><sz val="10"/><color rgb="FF375623"/><name val="Calibri"/></font>',
    '<font><b/><sz val="12"/><name val="Calibri"/></font>'];
  const borda = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>';
  const xf = (font,fillId,border,h,wrap,numFmt)=>`<xf numFmtId="${numFmt||0}" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmt?' applyNumberFormat="1"':""}><alignment horizontal="${h||"center"}" vertical="center"${wrap?' wrapText="1"':""}/></xf>`;
  const xfs = [
    xf(0,0,0,"left"),             // 0 normal
    xf(5,0,1,"center",true),      // 1 título EQUIPES
    xf(2,2,1,"center"),           // 2 banda roxa
    xf(2,2,1,"center",true),      // 3 dia da semana (roxo)
    xf(0,0,1,"center"),           // 4 data
    xf(1,3,1,"center"),           // 5 Prev. cab
    xf(1,4,1,"center"),           // 6 Real. cab
    xf(1,0,1,"center",true),      // 7 cabeçalho de texto
    xf(1,5,1,"center"),           // 8 cabeçalho Equipes (laranja)
    xf(0,0,1,"left"),             // 9 texto
    xf(0,0,1,"center"),           // 10 texto centro
    xf(4,7,1,"center",false,0),   // 11 real ok
    xf(3,6,1,"center",false,0),   // 12 real ruim
    xf(1,0,1,"center",false,0),   // 13 real neutro
    xf(1,0,1,"center",false,0),   // 14 número simples (prev)
    xf(1,9,1,"center",false,0),   // 15 total
    xf(1,9,1,"left"),             // 16 total texto
    xf(1,5,1,"left"),             // 17 cabeçalho Equipes (esq.)
    xf(4,7,1,"center",false,9),   // 18 % ok
    xf(3,6,1,"center",false,9),   // 19 % ruim
    xf(1,0,1,"center",false,9),   // 20 % neutro
    xf(1,9,1,"center",false,9),   // 21 total %
    xf(1,8,1,"left")];            // 22 sub-cabeçalho (cinza claro)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    +`<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills>`
    +`<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${borda}</borders>`
    +`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`
    +`<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function bolSheetXml(B){
  const nd = B.dias.length, res = bolResumo(B), fmt = n=>bolFmt(n,B.tipo);
  const cIni = 5, cTot = cIni + nd*3, nCols = cTot + 3;          // A..E = identificação; depois 3 colunas (Prev., Real., %) por dia
  const celulas = {}, merges = [];
  const put = (r,c,v,s)=>{ celulas[r+","+c] = { v, s }; };
  const fillMerge = (r1,c1,r2,c2,v,s)=>{ for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++) put(r,c,(r===r1&&c===c1)?v:"",s); if(r1!==r2||c1!==c2) merges.push(`${BOL_COL(c1)}${r1}:${BOL_COL(c2)}${r2}`); };
  const est = c=> c.prev>0 ? (c.real >= c.prev-1e-9 ? 0 : 1) : (c.real>0 ? 0 : 2);   // 0 ok, 1 ruim, 2 neutro
  const sNum = [BS.nOk,BS.nRuim,BS.nNeutro], sPct = [BS.pOk,BS.pRuim,BS.pNeutro];
  const trio = (r,c0,c,plano)=>{                                    // Prev. + Real. + %
    const e = est(c);
    put(r,c0,fmt(c.prev),plano?BS.tot:BS.nPlano); put(r,c0+1,fmt(c.real),plano?BS.tot:sNum[e]);
    const p = bolPct(c); put(r,c0+2, p===null ? "" : Math.round(p*1000)/1000, plano?BS.totP:sPct[e]);
  };
  // cabeçalho (como no modelo)
  fillMerge(2,0,4,4,`EQUIPES — ${B.tipo==="faixa"?"Limpeza de faixa (km)":"Poda (un.)"}`,BS.titulo);
  fillMerge(2,cIni,2,cTot+2,bolSemanaRotulo(B.semana.seg),BS.banda);
  const cab3 = c0=>{ put(5,c0,"Prev.",BS.prev); put(5,c0+1,"Real.",BS.real); put(5,c0+2,"%",BS.cab); };
  B.dias.forEach((d,i)=>{
    const c = cIni+i*3;
    fillMerge(3,c,3,c+2,BOL_DIAS_NOME[new Date(d+"T12:00:00").getDay()],BS.dia);
    fillMerge(4,c,4,c+2,`${d.slice(8,10)} de ${BOL_MESES[parseInt(d.slice(5,7),10)-1]}`,BS.data);
    cab3(c);
  });
  fillMerge(3,cTot,4,cTot+2,"Total da semana",BS.dia); cab3(cTot);
  put(5,0,"DEP.",BS.cab); put(5,1,"ORIGEM",BS.cab); fillMerge(5,2,5,4,"Tipo",BS.cab);
  // resumo
  let r = 6;
  res.forEach(g=>{
    put(r,0,g.dep,BS.txtC); put(r,1,g.orig,BS.txtC); fillMerge(r,2,r,4,g.tipo,BS.txt);
    g.cel.forEach((c,i)=>trio(r,cIni+i*3,c,false)); trio(r,cTot,{prev:g.prev,real:g.real},false); r++;
  });
  const totDia = B.totais, totSem = { prev:totDia.reduce((s,x)=>s+x.prev,0), real:totDia.reduce((s,x)=>s+x.real,0) };
  const linhaTotal = (rr,rot)=>{ fillMerge(rr,0,rr,4,rot,BS.totTxt); totDia.forEach((t,i)=>trio(rr,cIni+i*3,t,true)); trio(rr,cTot,totSem,true); };
  linhaTotal(r,"Total geral"); r += 2;
  // detalhe por equipe
  ["Dep.","Prop./Terc.","Tipo","Regional"].forEach((t,i)=>put(r,i,t,BS.cab)); put(r,4,"Equipes",BS.equipe);
  B.dias.forEach((d,i)=>cab3b(r,cIni+i*3)); cab3b(r,cTot);
  function cab3b(rr,c0){ put(rr,c0,"Prev.",BS.prev); put(rr,c0+1,"Real.",BS.real); put(rr,c0+2,"%",BS.cab); }
  r++;
  B.linhas.forEach(l=>{
    const e = l.e;
    put(r,0,e.departamento||"",BS.txtC); put(r,1,String(e.proprioTerceiro||"").toUpperCase(),BS.txtC); put(r,2,bolTipoRot(e),BS.txt); put(r,3,e.regional||"",BS.txtC); put(r,4,e.id,BS.txt);
    l.cel.forEach((c,i)=>trio(r,cIni+i*3,c,false)); trio(r,cTot,{prev:l.prev,real:l.real},false); r++;
  });
  linhaTotal(r,"Total");
  const rt = r;
  // xml
  const linhasXml = [];
  for(let rr=1; rr<=rt; rr++){
    let cs = "";
    for(let c=0; c<nCols; c++){
      const x = celulas[rr+","+c]; if(!x) continue;
      const ref = BOL_COL(c)+rr;
      if(typeof x.v === "number") cs += `<c r="${ref}" s="${x.s}"><v>${x.v}</v></c>`;
      else cs += `<c r="${ref}" s="${x.s}" t="inlineStr"><is><t xml:space="preserve">${prefXml(x.v)}</t></is></c>`;
    }
    const alt = rr===5 ? ' ht="20" customHeight="1"' : (rr===3 ? ' ht="18" customHeight="1"' : "");
    linhasXml.push(`<row r="${rr}"${alt}>${cs}</row>`);
  }
  const larg = [6,11,17,10,15, ...Array(nd).fill(0).flatMap(()=>[6.5,6.5,6.5]), 7.5,7.5,7.5];
  const cols = larg.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    +`<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="5" ySplit="5" topLeftCell="F6" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    +`<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${linhasXml.join("")}</sheetData>`
    +`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    +`<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function bolXlsxBytes(blocos){
  const enc = new TextEncoder();
  const nomes = [], usados = new Set();
  blocos.forEach(B=>{
    let n = `${B.tipo==="faixa"?"Faixa":"Poda"} ${B.semana.seg.slice(8,10)}-${B.semana.seg.slice(5,7)}`;
    let k = n, i = 2; while(usados.has(k.toLowerCase())) k = `${n} (${i++})`;
    usados.add(k.toLowerCase()); nomes.push(k.slice(0,31));
  });
  const arq = [
    { nome:"[Content_Types].xml", dados:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${blocos.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { nome:"_rels/.rels", dados:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { nome:"xl/workbook.xml", dados:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n,i)=>`<sheet name="${prefXml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`) },
    { nome:"xl/_rels/workbook.xml.rels", dados:enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${blocos.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${blocos.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { nome:"xl/styles.xml", dados:enc.encode(bolStylesXml()) },
    ...blocos.map((B,i)=>({ nome:`xl/worksheets/sheet${i+1}.xml`, dados:enc.encode(bolSheetXml(B)) }))
  ];
  return zipStore(arq);
}
function bolXlsx(blocos){
  const blob = bolXlsxBytes(blocos);
  prefBaixarBlob(new Blob([blob], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), bolNomeArquivo("xlsx"));
  closeModal();
  toast(`Boletim gerado: ${blocos.length} folha(s).`);
}
