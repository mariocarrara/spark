/* =========================================================================
   ux.js (v3.2.0) - melhorias de uso que valem para o sistema inteiro
   1) Combobox: todo <select> comum vira o mesmo modelo do filtro de alimentador
      (botao com seta laranja + painel com busca + lista). O <select> original
      continua na pagina (escondido) e recebe o valor/evento "change", entao o
      resto do sistema funciona como antes. Para manter um select nativo,
      coloque o atributo data-nativo.
   2) Tela cheia: cartoes da Visao Geral e da Produtividade ganham o botao ⛶
      (Esc ou o mesmo botao voltam).
   ========================================================================= */
(function(){
  "use strict";
  const LIMITE_BUSCA = 7;        // acima disso o painel mostra o campo de busca
  let aberto = null;             // { sel, trigger, panel }

  const semAcento = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

  function rotulo(sel){
    const o = sel.options[sel.selectedIndex];
    return o ? o.textContent.trim() : "";
  }
  function sincronizar(wrap){
    const sel = wrap._sel, tr = wrap._trigger;
    if(!sel || !tr) return;
    const txt = rotulo(sel) || "—";
    if(tr.textContent !== txt){ tr.textContent = txt; }
    tr.disabled = !!sel.disabled;
    tr.title = txt;
  }

  function fechar(){
    if(!aberto) return;
    try{ aberto.panel.remove(); }catch(e){}
    if(aberto.trigger) aberto.trigger.classList.remove("aberto");
    document.removeEventListener("mousedown", aoClicarFora, true);
    document.removeEventListener("keydown", aoTeclar, true);
    window.removeEventListener("resize", fechar);
    window.removeEventListener("scroll", aoRolar, true);
    aberto = null;
  }
  function aoClicarFora(e){
    if(!aberto) return;
    if(aberto.panel.contains(e.target) || aberto.trigger.contains(e.target)) return;
    fechar();
  }
  function aoRolar(e){ if(aberto && !aberto.panel.contains(e.target)) fechar(); }
  function aoTeclar(e){
    if(!aberto) return;
    if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); const t = aberto.trigger; fechar(); try{ t.focus(); }catch(_){} }
  }

  function escolher(sel, indice){
    if(sel.selectedIndex !== indice){
      sel.selectedIndex = indice;
      sel.dispatchEvent(new Event("input", { bubbles:true }));
      sel.dispatchEvent(new Event("change", { bubbles:true }));
    }
    const w = sel._wrap; if(w) sincronizar(w);
    fechar();
  }

  function abrir(wrap){
    const sel = wrap._sel, trigger = wrap._trigger;
    if(sel.disabled) return;
    if(aberto && aberto.sel === sel){ fechar(); return; }
    fechar();
    const opcoes = Array.from(sel.options);
    const panel = document.createElement("div");
    panel.className = "cbx-panel";
    const comBusca = opcoes.length > LIMITE_BUSCA;
    panel.innerHTML = (comBusca ? `<input type="text" class="cbx-busca" placeholder="Buscar…" autocomplete="off" aria-label="Buscar na lista">` : "") + `<div class="cbx-lista" role="listbox"></div>`;
    const lista = panel.querySelector(".cbx-lista");
    let grupoAtual = null;
    opcoes.forEach((o, i)=>{
      const g = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : null;
      if(g && g !== grupoAtual){ const h = document.createElement("div"); h.className = "cbx-grupo"; h.textContent = g; lista.appendChild(h); }
      grupoAtual = g;
      const b = document.createElement("button");
      b.type = "button"; b.className = "cbx-item" + (i === sel.selectedIndex ? " sel" : "");
      b.setAttribute("role", "option"); b.dataset.i = String(i);
      b.dataset.t = semAcento(o.textContent);
      b.textContent = o.textContent.trim() || "—";
      if(o.disabled){ b.disabled = true; }
      b.addEventListener("click", ()=> escolher(sel, i));
      lista.appendChild(b);
    });
    document.body.appendChild(panel);
    // posicao: logo abaixo do botao (ou acima, se nao couber)
    const r = trigger.getBoundingClientRect();
    panel.style.minWidth = Math.max(r.width, 180) + "px";
    panel.style.maxWidth = Math.min(420, window.innerWidth - 16) + "px";
    const alturaPainel = Math.min(panel.offsetHeight, 330);
    let left = Math.min(r.left, window.innerWidth - panel.offsetWidth - 8); if(left < 8) left = 8;
    const embaixo = window.innerHeight - r.bottom, emcima = r.top;
    if(embaixo < alturaPainel + 12 && emcima > embaixo){ panel.style.bottom = (window.innerHeight - r.top + 4) + "px"; panel.style.top = "auto"; lista.style.maxHeight = Math.max(120, Math.min(260, emcima - 70)) + "px"; }
    else { panel.style.top = (r.bottom + 4) + "px"; lista.style.maxHeight = Math.max(120, Math.min(260, embaixo - 70)) + "px"; }
    panel.style.left = left + "px";
    trigger.classList.add("aberto");
    aberto = { sel, trigger, panel };
    document.addEventListener("mousedown", aoClicarFora, true);
    document.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", aoRolar, true);

    const itens = () => Array.from(lista.querySelectorAll(".cbx-item")).filter(b=>!b.hidden && !b.disabled);
    let ativo = null;
    const marcar = b => { if(ativo) ativo.classList.remove("ativo"); ativo = b; if(b){ b.classList.add("ativo"); b.scrollIntoView({ block:"nearest" }); } };
    const selecionado = lista.querySelector(".cbx-item.sel");
    if(selecionado){ marcar(selecionado); }
    const busca = panel.querySelector(".cbx-busca");
    const navegar = e => {
      const v = itens(); if(!v.length) return;
      if(e.key === "ArrowDown" || e.key === "ArrowUp"){
        e.preventDefault();
        let k = v.indexOf(ativo); k = e.key === "ArrowDown" ? Math.min(v.length-1, k+1) : Math.max(0, k-1);
        marcar(v[k < 0 ? 0 : k]);
      } else if(e.key === "Enter"){
        e.preventDefault(); const alvo = ativo && !ativo.hidden ? ativo : v[0]; if(alvo) escolher(sel, Number(alvo.dataset.i));
      }
    };
    if(busca){
      busca.addEventListener("input", ()=>{
        const t = semAcento(busca.value.trim());
        lista.querySelectorAll(".cbx-item").forEach(b=>{ b.hidden = !!t && !b.dataset.t.includes(t); });
        lista.querySelectorAll(".cbx-grupo").forEach(h=>{ h.hidden = false; });
        marcar(itens()[0] || null);
      });
      busca.addEventListener("keydown", navegar);
      setTimeout(()=>{ try{ busca.focus(); }catch(e){} }, 0);
    } else {
      panel.tabIndex = -1; panel.addEventListener("keydown", navegar); setTimeout(()=>{ try{ panel.focus(); }catch(e){} }, 0);
    }
  }

  function melhorar(sel){
    if(sel.dataset.cbx) return;
    sel.dataset.cbx = "1";
    const pai = sel.parentElement;
    const larguraPai = pai ? pai.clientWidth : 0;
    const ocupaTudo = larguraPai > 0 && sel.offsetWidth >= larguraPai - 4;
    const wrap = document.createElement("div");
    wrap.className = "cbx" + (ocupaTudo ? " cbx-cheio" : "");
    const st = sel.style;
    ["width","minWidth","maxWidth","flex","margin","marginTop","marginBottom","marginLeft","marginRight","fontSize"].forEach(k=>{ if(st[k]) wrap.style[k] = st[k]; });
    if(!ocupaTudo && !st.width){ const w = sel.offsetWidth; if(w > 40) wrap.style.minWidth = w + "px"; }
    const tr = document.createElement("button");
    tr.type = "button"; tr.className = "cbx-trigger";
    tr.setAttribute("aria-haspopup", "listbox");
    try{   // o botao herda o tamanho/aparencia do select que ele substitui
      const cs = getComputedStyle(sel);
      ["fontSize","fontWeight","borderRadius","paddingTop","paddingBottom","paddingLeft","backgroundColor","color","borderTopColor"].forEach(k=>{ if(cs[k]) tr.style[k === "borderTopColor" ? "borderColor" : k] = cs[k]; });
      if(parseFloat(cs.height) > 0) tr.style.minHeight = cs.height;
    }catch(e){}
    wrap.appendChild(tr);
    wrap._sel = sel; wrap._trigger = tr; sel._wrap = wrap;
    tr.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); abrir(wrap); });
    tr.addEventListener("keydown", e=>{ if(e.key === "ArrowDown" && !(aberto && aberto.sel === sel)){ e.preventDefault(); abrir(wrap); } });
    sel.classList.add("cbx-nativo");
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    sel.insertAdjacentElement("afterend", wrap);
    // rotulo <label for="id"> clica no botao
    if(sel.id){ const lb = document.querySelector(`label[for="${CSS.escape(sel.id)}"]`); if(lb) lb.addEventListener("click", e=>{ e.preventDefault(); tr.focus(); }); }
    sincronizar(wrap);
  }

  function varrer(){
    document.querySelectorAll("select:not([data-cbx]):not([multiple]):not([data-nativo])").forEach(melhorar);
    document.querySelectorAll(".cbx").forEach(w=>{
      if(!w._sel || !w._sel.isConnected){ w.remove(); return; }
      sincronizar(w);
    });
    cartoesTelaCheia();
  }

  /* ---------- tela cheia dos cartoes (Visao Geral / Produtividade) ---------- */
  const ICONE_EXPANDIR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const ICONE_RECOLHER = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  function paginaComTelaCheia(){ const h = location.hash.replace(/^#\/?/, ""); return h === "" || h.indexOf("geral") === 0 || h.indexOf("produtividade") === 0; }
  function cartoesTelaCheia(){
    if(!paginaComTelaCheia()) return;
    document.querySelectorAll(".card > .card-head").forEach(head=>{
      const card = head.parentElement;
      if(!card || card.closest(".modal") || head.querySelector(".tc-btn")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "tc-btn"; b.title = "Tela cheia"; b.setAttribute("aria-label", "Tela cheia"); b.innerHTML = ICONE_EXPANDIR;
      b.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); alternarTelaCheia(card, b); });
      head.appendChild(b);
    });
  }
  function alternarTelaCheia(card, btn){
    const ligar = !card.classList.contains("cartao-tela-cheia");
    document.querySelectorAll(".cartao-tela-cheia").forEach(c=>{ c.classList.remove("cartao-tela-cheia"); const x = c.querySelector(".tc-btn"); if(x){ x.innerHTML = ICONE_EXPANDIR; x.title = "Tela cheia"; } });
    document.body.classList.toggle("tem-tela-cheia", false);
    if(ligar){
      card.classList.add("cartao-tela-cheia"); btn.innerHTML = ICONE_RECOLHER; btn.title = "Voltar (Esc)";
      document.body.classList.add("tem-tela-cheia");
    }
  }
  document.addEventListener("keydown", e=>{
    if(e.key !== "Escape" || aberto) return;
    const c = document.querySelector(".cartao-tela-cheia");
    if(c){ const b = c.querySelector(".tc-btn"); if(b) alternarTelaCheia(c, b); }
  });
  window.addEventListener("hashchange", ()=>{ document.body.classList.remove("tem-tela-cheia"); fechar(); });

  let agendado = false;
  function agendar(){ if(agendado) return; agendado = true; queueMicrotask(()=>{ agendado = false; try{ varrer(); }catch(e){ console.warn("ux.js:", e); } }); }
  new MutationObserver(agendar).observe(document.documentElement, { childList:true, subtree:true });
  setInterval(()=>{ try{ document.querySelectorAll(".cbx").forEach(sincronizar); }catch(e){} }, 900);
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", agendar); else agendar();
  window.sparkCombobox = { varrer, fechar };
})();


/* v3.9.2 - botão "Atualizar" (faz o mesmo que Ctrl+F5): baixa de novo, sem usar o cache do navegador, a própria página e todos os
   scripts/estilos dela e então recarrega. Não mexe no login nem nos dados (mapa em cache continua). */
async function recarregarSpark(){
  const b = document.getElementById("btnRecarregar");
  if(b){ if(b.classList.contains("girando")) return; b.classList.add("girando"); }
  try{
    const urls = new Set([location.href.split("#")[0]]);
    document.querySelectorAll("script[src], link[rel~='stylesheet'][href]").forEach(el=>{
      const u = el.src || el.href;
      if(u && u.indexOf(location.origin)===0) urls.add(u);
    });
    await Promise.all([...urls].map(u=>fetch(u, { cache:"reload" }).catch(()=>null)));
  }catch(e){}
  location.reload();
}

/* v3.33.3 - celular: os filtros de cada tela ficam recolhidos atras de um botao "Filtros" que mostra quantos
   estao ativos (a equipe de campo via uma tela inteira de combos antes dos dados). So em tela estreita;
   no computador o botao nem aparece. O aberto/fechado vale por tela enquanto a pagina estiver aberta. */
(function(){
  const mq = window.matchMedia("(max-width:760px)");
  const abertos = {};
  const SEL = "#view .filters, #view .ent-grid, #view .rk-filtros";
  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
  const SETA = '<svg class="filtros-seta" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  function ativos(box){
    let n = 0;
    box.querySelectorAll(".alimentador-multiselect-todos input[type=checkbox]").forEach(c=>{ if(!c.checked) n++; });
    box.querySelectorAll('input[type=text], input[type=date], input[type=search], input:not([type])').forEach(i=>{
      if(!i.closest(".alimentador-multiselect-panel") && String(i.value||"").trim()) n++;
    });
    return n;
  }
  function aplicar(box, bt, chave){
    const aberto = !!abertos[chave];
    box.classList.add("filtros-recolhivel");
    box.classList.toggle("filtros-abertos", aberto);
    const n = ativos(box);
    const html = ICONE + '<span>Filtros</span>' + (n ? '<b class="filtros-n">'+n+(n===1?' ativo':' ativos')+'</b>' : '<small>nenhum ativo</small>') + SETA;
    if(bt.innerHTML !== html) bt.innerHTML = html;
    if(bt.getAttribute("aria-expanded") !== String(aberto)) bt.setAttribute("aria-expanded", String(aberto));
  }
  function varrer(){
    if(!mq.matches) return;
    document.querySelectorAll(SEL).forEach((box, i)=>{
      if(box.querySelectorAll(".field").length < 4) return;   // poucos campos: deixa aberto
      const chave = (location.hash || "#geral") + "|" + i;
      let bt = box.previousElementSibling;
      if(!bt || !bt.classList.contains("filtros-toggle")){
        bt = document.createElement("button");
        bt.type = "button"; bt.className = "filtros-toggle";
        bt.addEventListener("click", ()=>{ abertos[chave] = !abertos[chave]; aplicar(box, bt, chave); });
        box.before(bt);
      }
      aplicar(box, bt, chave);
    });
  }
  let agendado = false;
  function agendar(){ if(agendado) return; agendado = true; requestAnimationFrame(()=>{ agendado = false; try{ varrer(); }catch(e){ console.warn("ux.js filtros:", e); } }); }
  new MutationObserver(agendar).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener("change", agendar, true);
  if(mq.addEventListener) mq.addEventListener("change", agendar);
  agendar();
})();
