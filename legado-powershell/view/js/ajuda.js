/* =========================================================================
   v3.1.1 - AJUDA DO SPARK (chat no cantinho da tela)
   Botão redondo no canto inferior direito. O usuário escolhe uma pergunta ou
   escreve a dúvida; o SPARK responde com a pergunta cadastrada que mais combina
   (palavras da pergunta, da resposta e as "palavras-chave" cadastradas).
   As perguntas ficam no Controller (model/ajuda_faq.json) e são editadas em
   Gestão de Bases > Ajuda.
   ========================================================================= */
let ajudaItens = [];            // todas as perguntas (inclusive inativas - a Gestão de Bases usa)
let ajudaCarregada = false;
let ajudaAberta = false;
let ajudaConversa = [];         // { de:"eu"|"spark", html }

function ajudaEsc(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function ajudaNorm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim(); }
const AJUDA_IGNORAR = new Set(["a","o","as","os","de","da","do","das","dos","e","em","no","na","nos","nas","um","uma","para","pra","por","com","que","como","qual","quais","eu","me","meu","minha","se","ao","aos","faz","fazer","posso","tem","ser","sao","esta","estao","quando","onde"]);
function ajudaTokens(s){ return ajudaNorm(s).split(" ").filter(t=>t.length>1 && !AJUDA_IGNORAR.has(t)); }

async function ajudaCarregar(forcar){
  if(ajudaCarregada && !forcar) return;
  try{
    if(typeof API_ONLINE!=="undefined" && API_ONLINE){
      const r = await apiGet("/ajuda");
      ajudaItens = Array.isArray(r) ? r : [];
    }
  }catch(e){ /* mantém o que já tem */ }
  ajudaCarregada = true;
}
function ajudaAtivas(){ return ajudaItens.filter(i=>i.ativo!==false && !i.excluido).sort((a,b)=>(a.ordem||0)-(b.ordem||0)); }

function ajudaBuscar(texto){
  const toks = ajudaTokens(texto);
  if(!toks.length) return [];
  const pontos = ajudaAtivas().map(i=>{
    const perg = ajudaTokens(i.pergunta), chave = ajudaTokens(i.palavras), resp = ajudaTokens(i.resposta), cat = ajudaTokens(i.categoria);
    let p = 0;
    toks.forEach(t=>{
      const raiz = t.length>4 ? t.slice(0,t.length-1) : t;          // "programacoes" ~ "programacao"
      const casa = (lista, peso)=>{ if(lista.some(x=>x===t || (raiz.length>3 && (x.startsWith(raiz)||raiz.startsWith(x))))) p += peso; };
      casa(perg,4); casa(chave,3); casa(cat,1.5); casa(resp,1);
    });
    return { i, p };
  }).filter(x=>x.p>0).sort((a,b)=>b.p-a.p);
  return pontos.slice(0,4).map(x=>x.i);
}

function ajudaMsg(de, html){ ajudaConversa.push({ de, html }); ajudaDesenhar(); }
function ajudaRespostaHtml(i){
  return `<strong>${ajudaEsc(i.pergunta)}</strong><div class="ajuda-resp">${ajudaEsc(i.resposta).replace(/\n/g,"<br>")}</div>`;
}
function ajudaEscolher(id){
  const i = ajudaItens.find(x=>x.id===id); if(!i) return;
  ajudaConversa.push({ de:"eu", html: ajudaEsc(i.pergunta) });
  ajudaConversa.push({ de:"spark", html: ajudaRespostaHtml(i), sugestoes: ajudaMesmaCategoria(i) });
  ajudaDesenhar();
}
function ajudaMesmaCategoria(i){ return ajudaAtivas().filter(x=>x.categoria===i.categoria && x.id!==i.id).slice(0,3); }
function ajudaEnviar(){
  const el = document.getElementById("ajudaEntrada"); if(!el) return;
  const t = el.value.trim(); if(!t) return;
  el.value = "";
  ajudaConversa.push({ de:"eu", html: ajudaEsc(t) });
  const achou = ajudaBuscar(t);
  if(achou.length){
    ajudaConversa.push({ de:"spark", html: ajudaRespostaHtml(achou[0]), sugestoes: achou.slice(1) });
  } else {
    ajudaConversa.push({ de:"spark", html:"Não achei uma resposta pra isso. Tente outras palavras (por exemplo: <em>programação, importar, meta, senha</em>) ou escolha um assunto abaixo.", categorias:true });
  }
  ajudaDesenhar();
}
function ajudaVerTodas(){
  ajudaConversa.push({ de:"spark", html:"Estes são os assuntos da ajuda. Escolha um:", categorias:true });
  ajudaDesenhar();
}
function ajudaEscolherCategoria(cat){
  const lista = ajudaAtivas().filter(i=>i.categoria===cat);
  ajudaConversa.push({ de:"eu", html: ajudaEsc(cat) });
  ajudaConversa.push({ de:"spark", html:`Perguntas sobre <strong>${ajudaEsc(cat)}</strong>:`, sugestoes: lista });
  ajudaDesenhar();
}
function ajudaChips(lista){
  return `<div class="ajuda-chips">${lista.map(i=>`<button type="button" class="ajuda-chip" onclick="ajudaEscolher('${i.id}')">${ajudaEsc(i.pergunta)}</button>`).join("")}</div>`;
}
function ajudaCategoriasHtml(){
  const cats = [...new Set(ajudaAtivas().map(i=>i.categoria||"Geral"))];
  return `<div class="ajuda-chips">${cats.map(c=>`<button type="button" class="ajuda-chip ajuda-chip-cat" onclick="ajudaEscolherCategoria(this.dataset.c)" data-c="${ajudaEsc(c)}">${ajudaEsc(c)}</button>`).join("")}</div>`;
}
function ajudaInicio(){
  ajudaConversa = [{ de:"spark", html:"Oi! Eu sou o SPARK. Escolha uma pergunta ou escreva a sua dúvida que eu procuro a resposta.", sugestoes: ajudaAtivas().slice(0,5), todas:true }];
}
function ajudaDesenhar(){
  const box = document.getElementById("ajudaMensagens"); if(!box) return;
  if(!ajudaAtivas().length && API_ONLINE){
    box.innerHTML = `<div class="ajuda-msg spark"><div class="ajuda-bolha">Ainda não há perguntas cadastradas na Ajuda.</div></div>`;
    return;
  }
  if(typeof API_ONLINE!=="undefined" && !API_ONLINE){
    box.innerHTML = `<div class="ajuda-msg spark"><div class="ajuda-bolha">A Ajuda só funciona com o Controller ligado (abra o sistema pelo iniciar.bat).</div></div>`;
    return;
  }
  box.innerHTML = ajudaConversa.map(m=>`
    <div class="ajuda-msg ${m.de}">
      <div class="ajuda-bolha">${m.html}</div>
      ${m.sugestoes && m.sugestoes.length ? ajudaChips(m.sugestoes) : ""}
      ${m.categorias ? ajudaCategoriasHtml() : ""}
      ${m.todas ? `<div class="ajuda-chips"><button type="button" class="ajuda-chip ajuda-chip-cat" onclick="ajudaVerTodas()">Ver todos os assuntos</button></div>` : ""}
    </div>`).join("");
  box.scrollTop = box.scrollHeight;
}
async function ajudaAlternar(abrir){
  ajudaAberta = (abrir===undefined) ? !ajudaAberta : !!abrir;
  const p = document.getElementById("ajudaPainel"), f = document.getElementById("ajudaFab");
  if(!p) return;
  p.classList.toggle("aberto", ajudaAberta);
  if(f) f.classList.toggle("aberto", ajudaAberta);
  if(ajudaAberta){
    await ajudaCarregar(true);
    if(!ajudaConversa.length) ajudaInicio();
    ajudaDesenhar();
    const e = document.getElementById("ajudaEntrada"); if(e) setTimeout(()=>e.focus(), 60);
  }
}
function ajudaMontar(){
  if(document.getElementById("ajudaFab")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button type="button" id="ajudaFab" class="ajuda-fab" onclick="ajudaAlternar()" aria-label="Abrir a ajuda do SPARK" title="Ajuda">
      <img src="assets/spark/spark_cabeca.png" alt=""><span class="ajuda-fab-q">?</span>
    </button>
    <section id="ajudaPainel" class="ajuda-painel" role="dialog" aria-label="Ajuda do SPARK">
      <header class="ajuda-topo">
        <img src="assets/spark/spark_cabeca.png" alt="">
        <div><strong>Ajuda do SPARK</strong><span>Tire suas dúvidas</span></div>
        <button type="button" class="ajuda-fechar" onclick="ajudaAlternar(false)" aria-label="Fechar">×</button>
      </header>
      <div id="ajudaMensagens" class="ajuda-mensagens"></div>
      <form class="ajuda-form" onsubmit="ajudaEnviar(); return false;">
        <input id="ajudaEntrada" type="text" autocomplete="off" placeholder="Escreva sua dúvida…">
        <button type="submit" class="btn btn-primary btn-sm">Enviar</button>
      </form>
    </section>`;
  while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && ajudaAberta) ajudaAlternar(false); });
}
ajudaMontar();
