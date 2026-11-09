/* =========================================================================
   SPARK — Sistema Integrado de Gestão de Vegetação, Proteção e Programação
   Grupo Energisa

   Este arquivo mantém a mesma lógica/UI testada no protótipo navegável.
   O estado local (const state) funciona como cache em memória: no boot,
   api.js tenta carregar os dados reais do Controller (PowerShell) definido
   no Detalhamento Técnico; se o Controller não estiver acessível (arquivo
   aberto via file://, ou iniciar.bat não executado), o sistema continua
   funcionando com os dados de exemplo abaixo, exatamente como no protótipo
   original — ver view/js/api.js.
   ========================================================================= */

/* ---------------- ícones (inline, sem libs externas) ---------------- */
const ICONS = {
  gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/></svg>',
  map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/></svg>',
  prio: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5"/></svg>',
  chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  target: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg>',
  note: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
  bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 6.5 8 6 8-6"/></svg>',
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="18" cy="9" r="2.4"/><path d="M15.5 20c.2-2.7 1.9-4.6 4.5-5"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 8v.01"/></svg>',
  warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v4.2M12 17v.01"/></svg>',
  truck: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h3.8l3.2 3.2v3.3h-7z"/><circle cx="6.5" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>',
  empty: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M9 15c1-1.2 5-1.2 6 0"/></svg>',
  filterX: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 4.5h14l-5.5 6.8V17l-3 1.6v-7.3z"/><path d="M16.5 14.5l5 5M21.5 14.5l-5 5"/></svg>',
  filter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/></svg>',
};
function ic(name, cls){ return ICONS[name] || ''; }
/* Nome de quem está logado, pra atribuir ações feitas na hora (justificativa,
   meta, programação, import...) — currentUser vem do login real (api.js);
   sem Controller (protótipo offline) cai no nome de exemplo de sempre. */
function nomeAtual(){ return currentUser ? currentUser.nome : "Admin Exemplo"; }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (c)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

/* ---------------- estado / dados de exemplo ---------------- */

const state = {
  // Sem Controller (protótipo offline), não tem como cruzar alimentador ->
  // município de verdade — o filtro Polo/Regional simplesmente não acha
  // nada pra listar (ver filtrosPoloRegionalDisponiveis em viewManutencao),
  // igual já acontece hoje com "Nenhuma equipe identificada ainda".
  mapaLocalidades: { porAlimentador:{}, porMunicipio:{} },
  equipes: [
    { id:"CENLM01", tipoEquipe:"LM", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Propria", equipePoda:true, baseLat:-22.9021, baseLng:-46.5289, ativo:true },
    { id:"CENLM02", tipoEquipe:"LM", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Propria", equipePoda:true, baseLat:-22.9510, baseLng:-46.5601, ativo:true },
    { id:"CENLM03", tipoEquipe:"LM", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Propria", equipePoda:true, baseLat:-22.9333, baseLng:-46.4890, ativo:true },
    { id:"ESS-LVRC01", tipoEquipe:"LV", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Propria", equipePoda:true, baseLat:-22.8890, baseLng:-46.5720, ativo:true },
    { id:"REN-LMC04", tipoEquipe:"LM", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Terceira", equipePoda:true, baseLat:-22.9700, baseLng:-46.6100, ativo:true },
    { id:"REN-LMC06", tipoEquipe:"LM", polo:"Centro", regional:"Centro", departamento:"DCMD", proprioTerceiro:"Terceira", equipePoda:true, baseLat:-22.9800, baseLng:-46.5000, ativo:true },
    { id:"REN-RDRC03", tipoEquipe:"LM", polo:"Leste", regional:"Leste", departamento:"DCMD", proprioTerceiro:"Terceira", equipePoda:true, baseLat:-23.0100, baseLng:-46.3400, ativo:true },
    { id:"TOBLM05", tipoEquipe:"LM", polo:"Leste", regional:"Leste", departamento:"DCMD", proprioTerceiro:"Terceira", equipePoda:true, baseLat:-22.8600, baseLng:-46.2800, ativo:true },
    { id:"TOBLV04", tipoEquipe:"LV", polo:"Leste", regional:"Leste", departamento:"DCMD", proprioTerceiro:"Terceira", equipePoda:true, baseLat:-22.8400, baseLng:-46.3100, ativo:true },
    { id:"BETEL EMP.", tipoEquipe:"LM", polo:"Oeste", regional:"Oeste", departamento:"DEOP", proprioTerceiro:"Terceira", equipePoda:false, baseLat:-22.7900, baseLng:-46.9500, ativo:true },
    { id:"RENASCER EMP.", tipoEquipe:"LM", polo:"Oeste", regional:"Oeste", departamento:"DEOP", proprioTerceiro:"Terceira", equipePoda:false, baseLat:-22.6900, baseLng:-50.4100, ativo:true },
  ],

  // previsto/realizado: confirmado com os arquivos reais (GRID_EXECUTADO +
  // MO_PENDENTE/MO_EXECUTADA) — previsto vem da OS-mãe (OSPrimária) batida
  // na MO_PENDENTE, realizado vem da própria OS batida na MO_EXECUTADA.
  // localidade: cidade/conjunto onde fica o elemento, pra aparecer na
  // Programação junto com equipe e previsto (pedido do Mario).
  manutencaoOS: [
    { id:"SGM-066073-2026", origem:"SGM", statusOS:"Programada", tipoServico:"Poda", tipoEquipeNecessaria:"Linha Viva", prioridadeEW:false, dataAbertura:"2026-09-10", dataExecucao:null, alimentador:"V-A2", conjunto:"PRESIDENTE VENCESLAU", localidade:"Presidente Venceslau", protecaoId:"C5887-5", lat:-21.99, lng:-51.86, fonte:"VERA", previsto:1, realizado:0, observacao:"Árvore na rede" },
    { id:"SGM-066072-2026", origem:"SGM", statusOS:"Executada", tipoServico:"Poda", tipoEquipeNecessaria:"LM - Livre", prioridadeEW:false, dataAbertura:"2026-09-08", dataExecucao:"2026-09-15", alimentador:"V-A2", conjunto:"PRESIDENTE VENCESLAU", localidade:"Presidente Venceslau", protecaoId:"C5887-5", lat:-22.02, lng:-51.83, fonte:"VERA", previsto:1, realizado:1, observacao:"Árvore na rede" },
    { id:"SGM-066068-2026", origem:"SGM", statusOS:"Pendente", tipoServico:"LimpezaFaixa", tipoEquipeNecessaria:"LM - Livre", prioridadeEW:false, dataAbertura:"2026-09-11", dataExecucao:null, alimentador:"IMIGRANT", conjunto:"SANTA TEREZINHA", localidade:"Santa Terezinha", protecaoId:"52-2345", lat:-22.35, lng:-46.71, fonte:"VAO", previsto:850, realizado:0, observacao:"Faixa de servidão" },
    { id:"SIGOD-238013301", origem:"SIGOD", statusOS:"Despachada", tipoServico:"Estrutura", tipoEquipeNecessaria:null, prioridadeEW:true, dataAbertura:"2026-09-22", dataExecucao:null, alimentador:"AL1C03", conjunto:"CENTRO", localidade:"Assis", protecaoId:"52-1003", lat:-22.95, lng:-46.55, fonte:"PROTECAO", previsto:1, realizado:0, observacao:"Reclamação de cliente (plantão)" },
    { id:"SGM-066067-2026", origem:"SGM", statusOS:"Programada", tipoServico:"Poda", tipoEquipeNecessaria:"Linha Viva", prioridadeEW:false, dataAbertura:"2026-08-20", dataExecucao:null, alimentador:"BARONEZA", conjunto:"BRAGANCA PAULISTA I", localidade:"Bragança Paulista", protecaoId:"52-1003", lat:-22.95, lng:-46.54, fonte:"VAO", previsto:1, realizado:0, observacao:"Árvore na rede" },
    { id:"SIGOD-238012248", origem:"SIGOD", statusOS:"Executada", tipoServico:"Poda", tipoEquipeNecessaria:null, prioridadeEW:true, dataAbertura:"2026-09-02", dataExecucao:"2026-09-03", alimentador:"PP1C05", conjunto:"CENTRO", localidade:"Presidente Prudente", protecaoId:"52-1314", lat:-22.90, lng:-46.57, fonte:"PROTECAO", previsto:1, realizado:1, observacao:"Emergencial (plantão)" },
    { id:"SGM-066071-2026", origem:"SGM", statusOS:"Pendente", tipoServico:"Poda", tipoEquipeNecessaria:"Linha Viva", prioridadeEW:false, dataAbertura:"2026-09-09", dataExecucao:null, alimentador:"V-A2", conjunto:"PRESIDENTE VENCESLAU", localidade:"Presidente Venceslau", protecaoId:"C5887-5", lat:-21.97, lng:-51.89, fonte:"VERA", previsto:1, realizado:0, observacao:"Árvore na rede" },
    { id:"SGM-052-2310", origem:"SGM", statusOS:"Executada", tipoServico:"Estrutura", tipoEquipeNecessaria:"Desligado", prioridadeEW:false, dataAbertura:"2026-08-28", dataExecucao:"2026-09-05", alimentador:"AS1C07", conjunto:"CAMBUI", localidade:"Cambuí", protecaoId:"052-2310", lat:-22.61, lng:-46.05, fonte:"VAO", previsto:1, realizado:1, observacao:"Troca de estrutura" },
    { id:"ESS-RD-BP  001453/2026", origem:"SGM", statusOS:"Pendente", tipoServico:"Poda", tipoEquipeNecessaria:"LM - Livre", prioridadeEW:false, dataAbertura:"2026-09-24", dataExecucao:null, alimentador:"AS1C01", conjunto:"ASSIS", localidade:"Assis", protecaoId:"57-0603", lat:-22.644, lng:-50.4146, fonte:"VERA", previsto:3, realizado:0, observacao:"Poda de emergência, galhos na fiação" },
    { id:"ESS-RD-CB  005273/2026", origem:"SGM", statusOS:"Pendente", tipoServico:"Poda", tipoEquipeNecessaria:"LM - Livre", prioridadeEW:false, dataAbertura:"2026-09-25", dataExecucao:null, alimentador:"CB2A05", conjunto:"CAMBUI", localidade:"Cambuí", protecaoId:"N0029-9", lat:-22.612, lng:-46.058, fonte:"VERA", previsto:2, realizado:0, observacao:"Árvore próxima à rede MT" },
  ],

  metas: [
    { id:"m1", equipeId:"CENLM01", anoMes:"2026-09", metaMensal:357, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m2", equipeId:"CENLM02", anoMes:"2026-09", metaMensal:357, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m3", equipeId:"CENLM03", anoMes:"2026-09", metaMensal:357, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m4", equipeId:"ESS-LVRC01", anoMes:"2026-09", metaMensal:105, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m5", equipeId:"REN-LMC04", anoMes:"2026-09", metaMensal:441, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m6", equipeId:"REN-LMC06", anoMes:"2026-09", metaMensal:441, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m7", equipeId:"REN-RDRC03", anoMes:"2026-09", metaMensal:651, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m8", equipeId:"TOBLM05", anoMes:"2026-09", metaMensal:441, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
    { id:"m9", equipeId:"TOBLV04", anoMes:"2026-09", metaMensal:105, diasUteis:21, atualizadoPor:"Admin Exemplo", atualizadoEm:"2026-08-29" },
  ],

  // produção diária de exemplo (executado por equipe, últimos 4 dias da semana 36)
  producao: {
    "CENLM01": [0,0,0,38],
    "CENLM02": [0,3,35,0],
    "CENLM03": [0,0,35,45],
    "ESS-LVRC01": [0,0,0,0],
    "REN-LMC04": [21,4,53,18],
    "REN-LMC06": [32,0,101,0],
    "REN-RDRC03": [0,6,1,0],
    "TOBLM05": [1,0,26,45],
    "TOBLV04": [5,7,0,0],
  },
  diasSemana: ["Seg 21","Ter 22","Qua 23","Qui 24"],

  indisponibilidades: [],
  justificativas: [
    { id:"j1", equipeId:"REN-RDRC03", data:"2026-09-22", texto:"Chuva forte na região impediu deslocamento até o meio-dia.", autor:"Bruno Exemplo", criadoEm:"2026-09-22T17:40:00-03:00" },
    { id:"j2", equipeId:"ESS-LVRC01", data:"2026-09-21", texto:"Equipe deslocada para atendimento emergencial (SIGOD) fora do plano.", autor:"Ana Exemplo", criadoEm:"2026-09-21T18:05:00-03:00" },
  ],

  programacoes: [
    { id:"p1", protecaoId:"V0488-7", alimentador:"AS1C03", dataInicio:"2026-09-26", dataFim:"2026-09-26", equipesIds:["CENLM01","ESS-LVRC01"], numeroSIS:"WR 238025237", tipoPlano:"Conjunto ESS", tipoProgramacao:"Poda + Estrutura", desligamento:"LV", previstoConcluir:true, status:"Programada", programador:"Ana Exemplo", observacao:"" },
    { id:"p2", protecaoId:"MRP-49", alimentador:"ELS-A2", dataInicio:"2026-09-28", dataFim:"2026-09-28", equipesIds:["BETEL EMP.","RENASCER EMP."], numeroSIS:"WR 238025224", tipoPlano:"Repetibilidade", tipoProgramacao:"Poda", desligamento:"DS", previstoConcluir:false, status:"Programada", programador:"Bruno Exemplo", observacao:"" },
    { id:"p3", protecaoId:"V3326-7", alimentador:"FL1C01", dataInicio:"2026-09-30", dataFim:"2026-09-30", equipesIds:["CENLM02"], numeroSIS:"WR 237027680", tipoPlano:"Repasse", tipoProgramacao:"Poda", desligamento:"LV", previstoConcluir:true, status:"Programada", programador:"Ana Exemplo", observacao:"" },
    { id:"p4", protecaoId:"C5887-5", alimentador:"V-A2", dataInicio:"2026-09-26", dataFim:"2026-09-26", equipesIds:["ESS-LVRC01"], numeroSIS:"WR 238025300", tipoPlano:"Conjunto ESS", tipoProgramacao:"Poda", desligamento:"LV", previstoConcluir:false, status:"Programada", programador:"Ana Exemplo", observacao:"", osIds:["SGM-066073-2026"] },
    { id:"p5", protecaoId:"52-1003", alimentador:"BARONEZA", dataInicio:"2026-09-29", dataFim:"2026-09-29", equipesIds:["CENLM03"], numeroSIS:"WR 238025512", tipoPlano:"Conjunto ESS", tipoProgramacao:"Poda + Estrutura", desligamento:"DS", previstoConcluir:true, status:"Cancelada", programador:"Bruno Exemplo", observacao:"Equipe remanejada", osIds:["SGM-066067-2026"] },
  ],

  // amostra ilustrativa da Programação por Equipe (absorvida do sistema
  // "Acompanhamento da Programação"), semana de 21/09 a 26/09 — no
  // protótipo sem Controller isso é só pra mostrar a tela; com o
  // Controller rodando, vem de /api/logistica/* com a base real importada
  // (245 equipes, 651 programações, 2.260 OS).
  logProgramacoes: [
    { id:"lp1", data:"2026-09-21", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"V10941-4", alimentador:"BA2C04", localidade:"IACRI", tipoProgramacao:"Poda DS", siswr:"WR 238022169", status:"Concluído", observacoes:"Existe um desligamento no período da tarde impactando a produtividade.", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:3, poda:6, faixa:1200, estrutura:0} },
    { id:"lp2", data:"2026-09-22", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"V3056-4", alimentador:"BA2C02", localidade:"BASTOS", tipoProgramacao:"Poda", siswr:"WR 238022201", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:8, poda:15, faixa:470, estrutura:0} },
    { id:"lp3", data:"2026-09-23", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"V6682-0", alimentador:"BA2C03", localidade:"IACRI", tipoProgramacao:"Poda", siswr:"WR 238022255", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:2, poda:20, faixa:0, estrutura:0} },
    { id:"lp4", data:"2026-09-24", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"V1332-3", alimentador:"EN1C01", localidade:"RANCHARIA", tipoProgramacao:"Faixa DS", siswr:"WR 238022310", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:3, poda:1, faixa:3075, estrutura:0} },
    { id:"lp5", data:"2026-09-25", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"V790068", alimentador:"AM1C02", localidade:"CANDIDO MOTA", tipoProgramacao:"Poda", siswr:"WR 238022388", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:3, poda:19, faixa:0, estrutura:0} },
    { id:"lp6", data:"2026-09-26", equipeId:"CENLM01", regionalArquivo:"CENTRO", elemento:"", alimentador:"", localidade:"", tipoProgramacao:"", siswr:"", status:"", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:0, poda:0, faixa:0, estrutura:0} },
    { id:"lp7", data:"2026-09-21", equipeId:"CENLM02", regionalArquivo:"CENTRO", elemento:"V6148-2", alimentador:"AS1C07", localidade:"ASSIS", tipoProgramacao:"Poda", siswr:"WR 238022170", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:7, poda:36, faixa:0, estrutura:0} },
    { id:"lp8", data:"2026-09-22", equipeId:"CENLM02", regionalArquivo:"CENTRO", elemento:"V790034", alimentador:"BA2C05", localidade:"BASTOS", tipoProgramacao:"Poda + Faixa", siswr:"WR 238022202", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:11, poda:2312, faixa:1260, estrutura:0} },
    { id:"lp9", data:"2026-09-23", equipeId:"CENLM02", regionalArquivo:"CENTRO", elemento:"V6682-0", alimentador:"BA2C03", localidade:"IACRI", tipoProgramacao:"Poda", siswr:"WR 238022256", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:1, poda:25, faixa:0, estrutura:0} },
    { id:"lp10", data:"2026-09-25", equipeId:"CENLM02", regionalArquivo:"CENTRO", elemento:"V790068", alimentador:"AM1C02", localidade:"CANDIDO MOTA", tipoProgramacao:"Poda", siswr:"WR 238022389", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:2, poda:16, faixa:0, estrutura:0} },
    { id:"lp11", data:"2026-09-21", equipeId:"ESS-LVRC01", regionalArquivo:"CENTRO", elemento:"V10941-4", alimentador:"BA2C04", localidade:"IACRI", tipoProgramacao:"Poda DS", siswr:"WR 238022171", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:2, poda:11, faixa:0, estrutura:0} },
    { id:"lp12", data:"2026-09-22", equipeId:"ESS-LVRC01", regionalArquivo:"CENTRO", elemento:"V790075", alimentador:"BA2C03", localidade:"BASTOS", tipoProgramacao:"Poda", siswr:"WR 238022203", status:"Concluído", observacoes:"", fonte:"Programação_aplicativo.csv", layout:"PADRAO", vinculoResumo:{qtdOS:5, poda:9, faixa:0, estrutura:0} },
  ],
  logOS: [
    { id:"lo1", data:"2026-09-21", equipeId:"CENLM01", alimentador:"BA2C04", protecao:"V10941-4", trecho:"T1", tipoEquipamento:"LM - LIVRE", numeroOS:"AUDTUP1  000593/2026", localidade:"IACRI", poda:2, faixa:400, estrutura:0, lat:-22.05, lng:-50.68, observacao:"", fonte:"Programação_aplicativo_OS.csv" },
    { id:"lo2", data:"2026-09-21", equipeId:"CENLM01", alimentador:"BA2C04", protecao:"V10941-4", trecho:"T2", tipoEquipamento:"LM - LIVRE", numeroOS:"AUDTUP1  000597/2026", localidade:"IACRI", poda:2, faixa:400, estrutura:0, lat:-22.06, lng:-50.67, observacao:"Galho baixo sobre a rede", fonte:"Programação_aplicativo_OS.csv" },
    { id:"lo3", data:"2026-09-21", equipeId:"CENLM01", alimentador:"BA2C04", protecao:"V10941-4", trecho:"T3", tipoEquipamento:"LM - LIVRE", numeroOS:"AUDTUP1  000619/2026", localidade:"IACRI", poda:2, faixa:400, estrutura:0, lat:-22.04, lng:-50.69, observacao:"", fonte:"Programação_aplicativo_OS.csv" },
  ],
  logVinculos: { lp1:["lo1","lo2","lo3"] },
  logEstatisticas: { osVinculadas:1903, osSemVinculo:357, programacoesComOS:473, programacoesSemOS:178, processadoEm:"2026-09-25T18:39:22-03:00" },

  municipios: [
    { id:"mu1", nome:"Bragança Paulista", contatoNome:"Contato Exemplo 1", email:"contato.braganca@exemplo.com.br", telefone:"(11) 4032-XXXX" },
    { id:"mu2", nome:"Assis", contatoNome:"Contato Exemplo 2", email:"contato.assis@exemplo.com.br", telefone:"(18) 3302-XXXX" },
    { id:"mu3", nome:"Cambuí", contatoNome:"Contato Exemplo 3", email:"contato.cambui@exemplo.com.br", telefone:"(35) 3437-XXXX" },
    { id:"mu4", nome:"Cândido Mota", contatoNome:"Contato Exemplo 4", email:"contato.candidomota@exemplo.com.br", telefone:"(18) 3341-XXXX" },
  ],
  // mapeamento simplificado alimentador -> municipio (viria da Base de Vão no sistema real)
  alimentadorMunicipio: { "AS1C03":"Bragança Paulista", "ELS-A2":"Cambuí", "FL1C01":"Assis", "V-A2":"Cândido Mota", "BARONEZA":"Bragança Paulista" },

  usuarios: [
    { id:"u1", nome:"Admin Exemplo", email:"admin@exemplo.com.br", perfilBase:"Administrador", statusConta:"Ativo" },
    { id:"u2", nome:"Ana Exemplo", email:"ana.exemplo@exemplo.com.br", perfilBase:"Programador", statusConta:"Ativo" },
    { id:"u3", nome:"Bruno Exemplo", email:"bruno.exemplo@exemplo.com.br", perfilBase:"Programador", statusConta:"Ativo" },
    { id:"u4", nome:"Carla Exemplo", email:"carla.exemplo@exemplo.com.br", perfilBase:"Supervisor de Equipe", statusConta:"Ativo" },
    { id:"u5", nome:"Davi Exemplo", email:"davi.exemplo@exemplo.com.br", perfilBase:"Consulta", statusConta:"Pendente" },
  ],

  MODULOS: ["manutencao","produtividade","metas","programacao","prefeituras","gestaoBases","alertas","prioridade","nix","usuarios"],
  ACOES: ["visualizar","criar","editar","excluirStatus","importar"],

  perfisModelo: {
    "Administrador": { manutencao:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, produtividade:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, metas:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, programacao:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, prefeituras:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, gestaoBases:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1}, prioridade:{visualizar:1,importar:1,excluirStatus:1}, nix:{visualizar:1,criar:1,excluirStatus:1,importar:1}, usuarios:{visualizar:1,criar:1,editar:1,excluirStatus:1,importar:1} },
    "Programador": { manutencao:{visualizar:1}, produtividade:{visualizar:1}, metas:{visualizar:1}, programacao:{visualizar:1,criar:1,editar:1,excluirStatus:1}, prefeituras:{visualizar:1}, gestaoBases:{visualizar:1}, usuarios:{} },
    "Supervisor de Equipe": { manutencao:{visualizar:1}, produtividade:{visualizar:1,criar:1}, metas:{visualizar:1}, programacao:{visualizar:1}, prefeituras:{}, gestaoBases:{visualizar:1}, usuarios:{} },
    "Gestor/Coordenador": { manutencao:{visualizar:1}, produtividade:{visualizar:1}, metas:{visualizar:1,criar:1,editar:1,importar:1}, programacao:{visualizar:1}, prefeituras:{visualizar:1}, gestaoBases:{visualizar:1}, usuarios:{} },
    "Consulta": { manutencao:{visualizar:1}, produtividade:{visualizar:1}, metas:{visualizar:1}, programacao:{visualizar:1}, prefeituras:{visualizar:1}, gestaoBases:{visualizar:1}, usuarios:{} },
  },
  permissoes: {}, // usuarioId -> matriz (populado no init)

  feriados: [
    {data:"2026-01-01", descricao:"Confraternização Universal", abrangencia:"Nacional"},
    {data:"2026-04-21", descricao:"Tiradentes", abrangencia:"Nacional"},
    {data:"2026-07-09", descricao:"Revolução Constitucionalista", abrangencia:"SP"},
    {data:"2026-09-07", descricao:"Independência do Brasil", abrangencia:"Nacional"},
    {data:"2026-10-12", descricao:"Nossa Senhora Aparecida", abrangencia:"Nacional"},
  ],

  importLog: [
    { id:"i1", base:"Metas", usuario:"Admin Exemplo", dataHora:"2026-08-29T09:12:00-03:00", processados:9, erros:0, arquivo:"metas_setembro_2026.xlsx" },
    { id:"i2", base:"Equipes", usuario:"Admin Exemplo", dataHora:"2026-08-02T11:03:00-03:00", processados:64, erros:2, arquivo:"base_equipes.xlsx" },
  ],
};

// inicializa matriz de permissões a partir do perfil-modelo de cada usuário
state.usuarios.forEach(u=>{
  state.permissoes[u.id] = JSON.parse(JSON.stringify(state.perfisModelo[u.perfilBase] || {}));
});

let currentUserPermViewId = state.usuarios[1].id; // usado na tela de permissões

/* ---------------- utilidades ---------------- */
function fmtDate(iso){
  if(!iso) return "—";
  // v2.13.28 - caminho rapido: "YYYY-MM-DD..." vira "DD/MM/YYYY" sem Date/toLocaleDateString
  // (com ~25 mil OS isso custava ~2 s ao abrir o mapa)
  if(typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4);
  const d = new Date(iso+(iso.length<=10?"T00:00:00-03:00":""));
  return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function fmtDateTime(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR")+" às "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function pct(a,b){ return b>0 ? Math.round((a/b)*1000)/10 : 0; }
function pctColor(p){
  if(p>=100) return {bg:"var(--ok-bg)", fg:"var(--ok-fg)"};
  if(p>=60) return {bg:"var(--warn-bg)", fg:"var(--warn-fg)"};
  return {bg:"var(--bad-bg)", fg:"var(--bad-fg)"};
}
function statusPill(status){
  const map = {
    "Pendente":"warn","A reprogramar":"warn","Programada":"info","Despachada":"info","Executada":"ok","Concluída":"ok","Cancelada":"bad","Ativo":"ok","Pendente Aprovação":"warn","Pendente":"warn"
  };
  const cls = map[status] || "muted";
  return `<span class="pill ${cls}"><span class="dot" style="background:currentColor"></span>${status}</span>`;
}
/* v2.15.28 - botão "copiar lat/long" no canto de baixo de TODO popup de mapa (trafo, proteção, OS, ativos, bases…).
   Leaflet: um gancho em todo mapa criado; a posição é a do próprio popup (ponto do marcador ou do clique). */
function copiarTextoSpark(txt){
  if(navigator.clipboard && window.isSecureContext){ return navigator.clipboard.writeText(txt); }
  return new Promise((ok, erro)=>{
    try{
      const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); const bom = document.execCommand("copy"); ta.remove();
      bom ? ok() : erro(new Error("copy"));
    }catch(e){ erro(e); }
  });
}
function popupCoordBotao(popup){
  try{
    const el = popup.getElement && popup.getElement(); if(!el) return;
    const caixa = el.querySelector(".leaflet-popup-content"); if(!caixa || caixa.querySelector(".coord-copy")) return;
    const ll = popup.getLatLng(); if(!ll) return;
    const txt = ll.lat.toFixed(6) + ", " + ll.lng.toFixed(6);
    const d = document.createElement("div"); d.className = "coord-copy";
    const b = document.createElement("button"); b.type = "button"; b.title = "Copiar latitude e longitude (" + txt + ")";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg><span>Copiar lat/long</span>';
    b.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      copiarTextoSpark(txt).then(()=>{ b.classList.add("ok"); b.lastChild.textContent = "Copiado"; toast("Coordenadas copiadas: " + txt); setTimeout(()=>{ b.classList.remove("ok"); b.lastChild.textContent = "Copiar lat/long"; }, 1600); })
        .catch(()=>{ toast("Não consegui copiar. Coordenadas: " + txt); });
    });
    d.appendChild(b); caixa.appendChild(d);
  }catch(e){}
}
if(window.L && L.Map && L.Map.addInitHook){
  L.Map.addInitHook(function(){
    this.on("popupopen", (e)=>{
      const p = e.popup; popupCoordBotao(p);
      if(!p._coordHook){ p._coordHook = true; p.on("contentupdate", ()=>popupCoordBotao(p)); }
    });
  });
}
/* v2.15.39 - SPARK (assistente): liga/desliga por usuário (localStorage); desligado = visual antigo */
function sparkAtivo(){ try{ return localStorage.getItem("spark_assistente") !== "off"; }catch(e){ return true; } }
/* v3.1.1 - modo escuro (guardado neste navegador) */
function temaEscuro(){ try{ return localStorage.getItem("spark_tema")==="dark"; }catch(e){ return false; } }
function aplicarTema(){
  if(temaEscuro()) document.documentElement.setAttribute("data-tema","dark"); else document.documentElement.removeAttribute("data-tema");
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", temaEscuro() ? "#0E131F" : "#12244A");
}
function setTemaEscuro(v){ try{ localStorage.setItem("spark_tema", v ? "dark" : "light"); }catch(e){} aplicarTema(); }
function aplicarSparkAssistente(){ document.documentElement.classList.toggle("spark-off", !sparkAtivo()); }
function setSparkAtivo(v){ try{ localStorage.setItem("spark_assistente", v ? "on" : "off"); }catch(e){} aplicarSparkAssistente(); }
aplicarSparkAssistente();
function toast(msg){
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  const texto = String(msg||"");
  const erro = /^(erro|falha|não consegui|não foi|sem permiss|escolha|preencha|escreva|alterado localmente|essa equipe já|biblioteca)/i.test(texto);
  const ok = !erro && /(registrad|salv|gerad|atualizad|exclu[ií]d|exportad|import|criad|copiad|apagad|conclu)/i.test(texto);
  el.className = "toast" + (sparkAtivo() ? (erro ? " spark-erro" : (ok ? " spark-ok" : "")) : "");
  el.innerHTML = sparkAtivo()
    ? `<img class="spark-cao" src="assets/spark/spark_cabeca.png" alt="SPARK"><div class="spark-balao"><span>${msg}</span></div>`
    : ic("check")+`<span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(()=>{
    el.style.transition="opacity .22s ease-in, transform .22s ease-in";
    el.style.opacity="0";
    el.style.transform="translateY(10px)";
    setTimeout(()=>el.remove(),220);
  }, Math.max(2600, 1800 + texto.length*45));
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function uid(prefix){ return prefix+"-"+Math.random().toString(36).slice(2,8); }

/* ---------------- navegação ---------------- */
/* "permissao" decide se o item do menu aparece pra quem está logado —
   pedido do Mario: "os níveis de usuário, eu quero que para os menus e
   abas que a pessoa não tem permissão ela nem consiga ver que existe, pra
   não gerar nem curiosidade". null = sempre visível (Visão Geral, um
   resumo que não expõe nada sensível por si só); {modulo,acao} = precisa
   de minhaPermissao(modulo,acao); {modulos:[...],acao} = basta ter a ação
   em QUALQUER um dos módulos listados (usado por Importação de Bases, que
   mistura bases de módulos diferentes numa tela só). Administrador sempre
   vê tudo (minhaPermissao já tem esse bypass, espelhando Test-Permissao
   no Controller). */
const ROUTES = [
  { key:"geral", label:"Visão Geral", icon:"home", title:"Visão Geral", sub:"Resumo do dia em todos os módulos", permissao:null },
  { key:"manutencao", label:"Mapa de Manutenção", icon:"map", title:"Mapa de Manutenção", sub:"OSs de poda, estrutura e limpeza de faixa", permissao:{modulo:"manutencao", acao:"visualizar"} },
  { key:"produtividade", label:"Produtividade", icon:"chart", title:"Produtividade das Equipes", sub:"Executado x meta, por dia", permissao:{modulo:"produtividade", acao:"visualizar"} },
  { key:"alertas", label:"Alertas", icon:"warn", title:"Alertas", sub:"OS próximas, outliers, recurso zero e OS em APP/RL", permissao:{modulo:"alertas", acao:"visualizar"} },
  { key:"programacao", label:"Programação", icon:"bolt", title:"Programação de Proteções", sub:"CRUD, calendário e visão logística", permissao:{modulo:"programacao", acao:"visualizar"} },
  { key:"prioridade", label:"Prioridade da programação", icon:"prio", title:"Prioridade da programação", sub:"Lista da engenharia x pendência, mudanças entre listas e aderência", permissao:{modulo:"prioridade", acao:"visualizar"} },
  { key:"nix", label:"Pontos Nix", icon:"warn", title:"Pontos Nix", sub:"Onde a rede parou (Nix) e as OS em volta: executadas, programadas e pendentes", permissao:{modulo:"nix", acao:"visualizar"} },
  // v3.11.0 - consulta dos planos fechados (podas executadas de anos anteriores)
  { key:"historico", label:"Histórico de Podas", icon:"calendar", title:"Histórico de Podas", sub:"Podas executadas dos planos anteriores (01/nov a 31/out), por plano", permissao:{modulo:"manutencao", acao:"visualizar"} },
  { key:"prefeituras", label:"Envio às Prefeituras", icon:"mail", title:"Envio às Prefeituras", sub:"Conformidade ANEEL — relatório semanal", permissao:{modulo:"prefeituras", acao:"visualizar"} },
  { key:"importacao", label:"Importação de Bases", icon:"upload", title:"Importação de Bases", sub:"Validação de cabeçalho antes da carga", permissao:{modulos:["manutencao","metas","prefeituras","prioridade"], acao:"importar"} },
  { key:"cadastros", label:"Gestão de Bases", icon:"filter", title:"Gestão de Bases", sub:"Equipes, Metas, Vão, Proteção, VERA, listas (Plano, Equipe necessária, Justificativas) e Camadas de rede", permissao:{modulo:"gestaoBases", acao:"visualizar"} },
  // v3.10.0 - menu Configuração: Alertas (parâmetros), Pontos Nix e Usuários & Permissões numa tela só (abas)
  { key:"configuracao", label:"Configuração", icon:"gear", title:"Configuração", sub:"Parâmetros dos alertas, pontos Nix, APP/RL e usuários & permissões", permissao:{qualquer:[{modulo:"alertas",acao:"visualizar"},{modulo:"nix",acao:"importar"},{modulo:"usuarios",acao:"editar"}]} },
];

function rotaVisivel(r){
  if(!r.permissao) return true;
  if(r.permissao.qualquer) return r.permissao.qualquer.some(p=>minhaPermissao(p.modulo, p.acao));
  if(r.permissao.modulos) return r.permissao.modulos.some(m=>minhaPermissao(m, r.permissao.acao));
  return minhaPermissao(r.permissao.modulo, r.permissao.acao);
}
function rotasVisiveis(){
  return ROUTES.filter(rotaVisivel);
}

function renderNav(){
  const nav = document.getElementById("navList");
  nav.innerHTML = rotasVisiveis().map(r=>`
    <button class="nav-item" data-route="${r.key}" onclick="goTo('${r.key}')">
      ${ic(r.icon)}<span>${r.label}</span>
    </button>`).join("");
}

function goTo(key){
  location.hash = "#"+key;
}
/* v2.15.2 - botão de 3 risquinhos: no celular abre/fecha a gaveta; no computador
   esconde/mostra o menu azul (lembra a escolha). */
let menuOculto = false;
try{ menuOculto = localStorage.getItem("spark_menu_oculto") === "1"; }catch(e){ /* sem localStorage */ }
function aplicarMenuOculto(){ document.body.classList.toggle("menu-oculto", menuOculto); }
function alternarMenuLateral(){
  if(window.innerWidth <= 760){
    const aberto = document.getElementById("sidebar").classList.contains("open");
    if(aberto) closeSidebar(); else openSidebar();
    return;
  }
  menuOculto = !menuOculto;
  try{ localStorage.setItem("spark_menu_oculto", menuOculto ? "1" : "0"); }catch(e){ /* ok */ }
  aplicarMenuOculto();
  if(typeof mapManutencao!=="undefined" && mapManutencao) setTimeout(()=>{ try{ mapManutencao.invalidateSize(); }catch(e){} }, 60);
}
aplicarMenuOculto();
function openSidebar(){ document.getElementById("sidebar").classList.add("open"); document.getElementById("sidebarOverlay").classList.add("show"); }
function closeSidebar(){ document.getElementById("sidebar").classList.remove("open"); document.getElementById("sidebarOverlay").classList.remove("show"); }

/* v2.13.31 - spinner circular na troca de tela: a tela nova é montada de
   forma síncrona (o mapa de manutenção demora), então primeiro mostra o
   círculo (gira no compositor, não trava), deixa o navegador pintar e só
   depois monta a tela. */
function navSpinner(on){ const el = document.getElementById("navSpinner"); if(el) el.classList.toggle("show", !!on); }
window.addEventListener("hashchange", ()=>{
  navSpinner(true);
  setTimeout(()=>{
    try{ render(); }finally{ requestAnimationFrame(()=>requestAnimationFrame(()=>navSpinner(false))); }
  }, 50);
});

function currentRoute(){
  let key = (location.hash||"#geral").slice(1);
  // v2.13.12 - a lista de Justificativas agora e uma pagina da Gestao de Bases
  // (o botao saiu da Produtividade). Link/favorito antigo (#justificativas)
  // cai direto la.
  if(key === "justificativas"){ key = "cadastros"; cadastroBaseAtiva = "justificativas"; }
  // v3.10.0 - "Usuários & Permissões" virou uma aba do menu Configuração (link/favorito antigo cai lá)
  if(key === "usuarios"){ key = "configuracao"; cfgAba = "usuarios"; }
  const visiveis = rotasVisiveis();
  // Defesa em profundidade: além de esconder o item do menu, uma pessoa
  // sem permissão que force a #hash na mão (ou que tenha um link/favorito
  // antigo de quando tinha acesso) cai de volta pra uma rota que ela PODE
  // ver, em vez de renderizar a tela proibida.
  return visiveis.find(r=>r.key===key) || visiveis[0] || ROUTES[0];
}

function render(){
  closeSidebar();
  const r = currentRoute();
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active", el.dataset.route===r.key));
  document.getElementById("pageTitle").textContent = r.title;
  document.getElementById("pageSub").textContent = r.sub;
  const view = document.getElementById("view");
  view.classList.add("view-ampla");   // v2.15.46: todas as páginas usam a largura toda (como o Mapa)   // v2.15.2: mapa usa a largura toda
  view.innerHTML = VIEWS[r.key] ? VIEWS[r.key]() : "";
  AFTER_RENDER[r.key] && AFTER_RENDER[r.key]();
  msRestaurarRolagem();
}


/* =========================================================================
   v2.13.33 - ORDENAR TABELAS CLICANDO NO CABEÇALHO
   - Tabelas "simples" (todas as linhas já estão na tela): um único tratador
     de clique (delegado em document) ordena as linhas do <tbody> pelo texto
     da coluna; reconhece data (dd/mm/aaaa ou aaaa-mm-dd), número (1.234,5,
     %, "2 / 0") e texto. 1º clique = crescente, 2º = decrescente, 3º = tira
     a ordenação. Vazio/"—" sempre vai pro fim. A ordem escolhida é
     reaplicada quando a tela redesenha a tabela.
   - Tabelas paginadas (OS do mapa, Metas, Gestão de Bases) ordenam o
     conjunto INTEIRO (não só a página) — ver ordenarOS/ordenarMetas/
     ordenarCadastro; essas ficam marcadas com data-sort-manual.
   ========================================================================= */
function ordParse(txt){
  let t = String(txt==null ? "" : txt).trim();
  if(t==="" || t==="—" || t==="-" || t==="–") return null;
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/);
  if(m) return Number(m[3]+m[2]+m[1]) * 10000 + Number((m[4]||"00")+(m[5]||"00"));
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if(m) return Number(m[1]+m[2]+m[3]) * 10000 + Number((m[4]||"00")+(m[5]||"00"));
  m = t.match(/^(-?\d[\d.]*(?:,\d+)?)\s*%?$/) || t.match(/^(-?\d[\d.]*(?:,\d+)?)\s+\/\s+-?\d/);
  if(m){
    let n = m[1];
    if(n.indexOf(",")>=0) n = n.replace(/\./g,"").replace(",",".");
    else if(/^-?\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g,"");
    const v = Number(n);
    if(!isNaN(v)) return v;
  }
  return t;
}
function ordenarPorTexto(itens, getTexto, dir){
  const dados = itens.map((it,i)=>{ const txt = String(getTexto(it)==null ? "" : getTexto(it)); return { it, i, txt, p: ordParse(txt) }; });
  const todosNum = dados.every(d=>d.p===null || typeof d.p==="number");
  const col = new Intl.Collator("pt-BR", { numeric:true, sensitivity:"base" });
  dados.sort((a,b)=>{
    const va = a.p===null, vb = b.p===null;
    if(va || vb) return va && vb ? a.i-b.i : (va ? 1 : -1);   // vazio sempre no fim
    const c = todosNum ? (a.p-b.p) : col.compare(a.txt, b.txt);
    return c!==0 ? c*dir : a.i-b.i;
  });
  return dados.map(d=>d.it);
}
function ordenarHeadHtml(cond, rotulo, campo, ordem, fn){
  const ativo = ordem && ordem.campo===campo;
  return `<th class="th-sort ${ativo ? (ordem.dir>0?"sort-asc":"sort-desc") : ""}" onclick="${fn}('${campo}')" title="Clique para ordenar">${rotulo}</th>`;
}
const _ordTabelas = {};   // chave do cabeçalho -> { idx, dir }
function _ordChaveTabela(table){
  return Array.from(table.tHead.rows[0].cells).map(c=>c.textContent.trim()).join("|");
}
function _ordElegivel(table){
  if(!table || !table.tHead || table.tHead.rows.length!==1) return false;
  if(table.hasAttribute("data-sort-manual")) return false;
  if(/\b(prod-matrix|log-matrix|perm-grid|schema-table|no-sort)\b/.test(table.className)) return false;
  return !!table.tBodies[0];
}
function _ordAplicar(table, idx, dir){
  const tb = table.tBodies[0];
  const linhas = Array.from(tb.rows);
  if(linhas.length<2 || linhas.some(r=>r.cells.length<=idx || Array.from(r.cells).some(c=>c.colSpan>1))) return false;
  const ord = ordenarPorTexto(linhas, r=>r.cells[idx].textContent, dir);
  const frag = document.createDocumentFragment();
  ord.forEach(r=>frag.appendChild(r));
  tb.appendChild(frag);
  return true;
}
function _ordMarcarSeta(table, idx, dir){
  Array.from(table.tHead.rows[0].cells).forEach((c,i)=>{
    c.classList.remove("sort-asc","sort-desc");
    if(i===idx && dir) c.classList.add(dir>0 ? "sort-asc" : "sort-desc");
  });
}
/* v2.15.10 - comboboxes de seleção múltipla (Rede MT/BT/AT: <details class="alimentador-multiselect">)
   fecham ao clicar/tocar FORA delas ou apertar Esc, sem precisar clicar na setinha.
   Usa a fase de captura porque o próprio <details> barra a propagação dos cliques. */
function fecharComboboxesAbertas(fora){
  document.querySelectorAll("details.alimentador-multiselect[open]").forEach(d=>{
    if(!fora || !d.contains(fora)) d.removeAttribute("open");
  });
}
document.addEventListener("pointerdown", (ev)=>{ fecharComboboxesAbertas(ev.target); }, true);
document.addEventListener("keydown", (ev)=>{ if(ev.key==="Escape") fecharComboboxesAbertas(null); }, true);
document.addEventListener("click", (ev)=>{
  const th = ev.target.closest && ev.target.closest("thead th");
  if(!th || ev.target.closest("input,button,a,select")) return;
  if(th.classList.contains("th-sort")) return;                 // tabela com ordenação própria
  const table = th.closest("table");
  if(!_ordElegivel(table) || th.colSpan>1 || th.classList.contains("checkbox-cell") || !th.textContent.trim()) return;
  const idx = th.cellIndex, chave = _ordChaveTabela(table);
  const atual = _ordTabelas[chave];
  let dir = 1;
  if(atual && atual.idx===idx) dir = atual.dir===1 ? -1 : 0;
  if(dir===0){
    delete _ordTabelas[chave];
    _ordMarcarSeta(table, idx, 0);
    // volta pra ordem original: redesenha a tela
    if(typeof render==="function" && document.getElementById("view") && document.getElementById("view").contains(table)){
      const wrap = document.getElementById("cadastroGridWrap");
      if(wrap && wrap.contains(table)) wrap.innerHTML = cadastroGridHtml(); else render();
    }
    return;
  }
  if(_ordAplicar(table, idx, dir)){ _ordTabelas[chave] = { idx, dir }; _ordMarcarSeta(table, idx, dir); }
});
/* reaplica a ordem escolhida quando a tela redesenha a tabela */
(function(){
  let timer = null, aplicando = false;
  function reaplicar(){
    aplicando = true;
    try{
      document.querySelectorAll("#view table, #modalBody table").forEach(table=>{
        if(table.dataset.ordOk==="1" || !_ordElegivel(table)) return;
        const st = _ordTabelas[_ordChaveTabela(table)];
        table.dataset.ordOk = "1";
        if(st && _ordAplicar(table, st.idx, st.dir)) _ordMarcarSeta(table, st.idx, st.dir);
      });
    }finally{ aplicando = false; }
  }
  const alvo = document.getElementById("view");
  if(!alvo) return;
  new MutationObserver(()=>{ if(aplicando) return; clearTimeout(timer); timer = setTimeout(reaplicar, 60); })
    .observe(alvo, { childList:true, subtree:true });
})();

/* ---------------- modal helpers ---------------- */
function openModal(html){
  const mm = document.querySelector("#modalOverlay .modal"); if(mm) mm.classList.remove("modal-largo");
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalOverlay").classList.add("open");
}
function closeModal(){
  document.getElementById("modalOverlay").classList.remove("open");
}
document.getElementById("modalOverlay").addEventListener("click", (e)=>{ if(e.target.id==="modalOverlay") closeModal(); });

/* =========================================================================
   VIEW: Visão Geral
   ========================================================================= */
/* =========================================================================
   VIEW: Visão Geral — nível gerência (v2.13.0)
   KPIs do mês, produção diária x meta, previsto x realizado por regional,
   semanas e ranking de equipes. Executado = realizado das OS executadas
   (mesma base da Produtividade); meta = metas por equipe / dias úteis.
   "% meta do mês" agora compara o executado do mês com a meta proporcional
   aos dias úteis já decorridos (antes comparava a produção de exemplo com a
   soma das metas de TODOS os meses, por isso mostrava 0,2%).
   ========================================================================= */
let geralMes = "";   // "" = mês mais recente com execução
let geralModo = "mes";   // v3.3.2: "mes" (Ano/Mês) | "ano"
let geralAnoSel = "";
function setGeralMes(v){ geralMes = v; render(); }
function setGeralAno(v){ geralAnoSel = v; render(); }
function setGeralModo(m){
  if(m==="ano"){ geralModo = "ano"; geralAnoSel = geralMesReferencia().slice(0,4); }
  else {
    geralModo = "mes";
    if(geralAnoSel && geralMesReferencia().slice(0,4)!==geralAnoSel){
      const ms = geralMesesDisponiveis().filter(x=>x.startsWith(geralAnoSel)); if(ms.length) geralMes = ms[0];
    }
  }
  render();
}
/* drill down: clicar num mês do ano abre aquele mês */
function geralDescer(ym){ geralModo = "mes"; geralMes = ym; geralAnoSel = ym.slice(0,4); render(); }
function geralAnosDisponiveis(){ return [...new Set(geralMesesDisponiveis().map(m=>m.slice(0,4)))].sort().reverse(); }
function geralPeriodoRef(){ return geralModo==="ano" ? (geralAnoSel || geralMesReferencia().slice(0,4)) : geralMesReferencia(); }
const GERAL_MESES_CURTO = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
let _kmRedeCache = null;
function geralMesesDisponiveis(){
  const set = new Set();
  Object.values(prodExecucao("poda")).forEach(porDia=>Object.keys(porDia).forEach(d=>set.add(d.slice(0,7))));
  (state.metas||[]).forEach(m=>{ if(m.anoMes) set.add(m.anoMes); });
  histMesesDosPlanos().forEach(m=>set.add(m));
  return Array.from(set).sort().reverse();
}
function geralMesReferencia(){
  if(geralMes) return geralMes;
  let ultimo = "";
  Object.values(prodExecucao("poda")).forEach(porDia=>Object.keys(porDia).forEach(d=>{ if(d>ultimo && d<=prodHojeIso()) ultimo = d; }));
  return ultimo ? ultimo.slice(0,7) : prodHojeIso().slice(0,7);
}
function geralDados(per){ return String(per).length===4 ? geralDadosAno(per) : geralDadosMes(per); }
/* ano = soma dos meses já decorridos (cada mês com a sua própria meta) */
function geralDadosAno(ano){
  const hoje = prodHojeIso(), aHoje = hoje.slice(0,4);
  const ate = aHoje===ano ? parseInt(hoje.slice(5,7),10) : (ano<aHoje ? 12 : 0);
  const meses = []; for(let m=1;m<=ate;m++) meses.push(geralDadosMes(`${ano}-${String(m).padStart(2,"0")}`));
  /* v3.15.0 - meta CHEIA do ano: soma os 12 meses (inclusive os que ainda não chegaram) */
  let metaPeriodo = 0; for(let m=1;m<=12;m++) metaPeriodo += (m<=ate ? meses[m-1].totMetaMes : geralDadosMes(`${ano}-${String(m).padStart(2,"0")}`).totMetaMes);
  const mapa = new Map();
  meses.forEach(x=>x.porEquipe.forEach(e=>{ const k = e.equipe.id, t = mapa.get(k) || { equipe:e.equipe, exec:0, meta:0, metaMes:0 }; t.exec+=e.exec; t.meta+=e.meta; t.metaMes+=e.metaMes; mapa.set(k,t); }));
  const soma = f=>meses.reduce((a,x)=>a+f(x),0);
  return { ano:true, anoMes:ano, meses, fim: meses.length ? meses[meses.length-1].fim : `${ano}-01-01`,
    diasMes: meses.flatMap(x=>x.diasMes), diasAte: meses.flatMap(x=>x.diasAte), porDia: meses.flatMap(x=>x.porDia), porEquipe:[...mapa.values()],
    totExec:soma(x=>x.totExec), totMeta:soma(x=>x.totMeta), totMetaMes:soma(x=>x.totMetaMes), metaPeriodo, uteisAte:soma(x=>x.uteisAte), uteisMes:soma(x=>x.uteisMes), projecao:soma(x=>x.projecao) };
}
function geralPorMes(dados){
  const m = new Map();
  dados.porDia.filter(x=>x.dia<=dados.fim).forEach(x=>{ const k = x.dia.slice(0,7), t = m.get(k) || { ym:k, exec:0, meta:0 }; t.exec+=x.exec; t.meta+=x.meta; m.set(k,t); });
  return [...m.values()].sort((a,b)=>a.ym.localeCompare(b.ym));
}
/* colunas mensais clicáveis (drill down); itens [{ym, valor, meta?, cor, texto}] */
function geralColunasMensais(itens, cor, rotuloAria){
  if(!itens.length) return `<p class="chart-loading">Sem dados no ano.</p>`;
  const W=720, H=220, pl=46, pr=8, pt=22, pb=28;
  const max = Math.max(1, ...itens.map(i=>Math.max(i.valor,i.meta||0)))*1.1, bw=(W-pl-pr)/itens.length, y=v=>pt+(H-pt-pb)*(1-v/max);
  const barras = itens.map((i,k)=>{ const x=pl+k*bw+bw*.18, w=bw*.64, c = i.cor||cor;
    return `<g style="cursor:pointer" onclick="geralDescer('${i.ym}')"><title>${escapeHtml(i.texto)} — clique para ver os dias</title>
      <rect x="${(pl+k*bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${H-pt-pb}" fill="transparent"/>
      <rect x="${x.toFixed(1)}" y="${y(i.valor).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0,(H-pb)-y(i.valor)).toFixed(1)}" fill="${c}" rx="3"/>
      ${i.valor>0 ? ((H-pb)-y(i.valor) >= 18
        ? `<text x="${(x+w/2).toFixed(1)}" y="${H-pb-6}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${i.corTxt||"#0F1B0F"}">${geralNum(i.valor)}</text>`
        : `<text x="${(x+w/2).toFixed(1)}" y="${(y(i.valor)-4).toFixed(1)}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#374151">${geralNum(i.valor)}</text>`) : ""}
      <text x="${(x+w/2).toFixed(1)}" y="${H-10}" font-size="11" text-anchor="middle" fill="#6B7280">${GERAL_MESES_CURTO[parseInt(i.ym.slice(5,7),10)-1]}</text></g>`; }).join("");
  const linha = itens.some(i=>i.meta>0) ? `<path d="${itens.map((i,k)=>`${k?"L":"M"} ${(pl+k*bw+bw/2).toFixed(1)} ${y(i.meta||0).toFixed(1)}`).join(" ")}" fill="none" stroke="#1F1F4C" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>${itens.map((i,k)=>i.meta>0?`<text x="${(pl+k*bw+bw/2).toFixed(1)}" y="${(y(i.meta)-6).toFixed(1)}" font-size="10" text-anchor="middle" fill="#1F1F4C" pointer-events="none" style="paint-order:stroke; stroke:#fff; stroke-width:3px; stroke-linejoin:round;">${geralNum(i.meta)}</text>`:"").join("")}` : "";
  const ticks = [0,.5,1].map(f=>`<g><line x1="${pl}" x2="${W-pr}" y1="${y(max*f/1.1).toFixed(1)}" y2="${y(max*f/1.1).toFixed(1)}" stroke="#E5E7EB"/><text x="${pl-6}" y="${(y(max*f/1.1)+3).toFixed(1)}" font-size="10" text-anchor="end" fill="#6B7280">${geralNum(max*f/1.1)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;" role="img" aria-label="${escapeHtml(rotuloAria||"Por mês")}">${ticks}${barras}${linha}</svg>`;
}
function geralDadosMes(anoMes){
  const hoje = prodHojeIso();
  const [a,m] = anoMes.split("-").map(Number);
  const ultimoDia = new Date(a, m, 0).getDate();
  const diasMes = Array.from({length:ultimoDia}, (_,i)=>`${anoMes}-${String(i+1).padStart(2,"0")}`);
  const fim = hoje < diasMes[diasMes.length-1] ? (hoje < diasMes[0] ? diasMes[0] : hoje) : diasMes[diasMes.length-1];
  const diasAte = diasMes.filter(d=>d<=fim);
  const exec = prodExecucao("poda");
  const equipes = (state.equipes||[]).filter(e=>prodMetaDe(e.id, anoMes, "poda") && prodMetaDe(e.id, anoMes, "poda").anoMes===anoMes);
  const porDia = diasMes.map(d=>({ dia:d, exec:0, meta:0 }));
  const porEquipe = equipes.map(e=>{
    let ex=0, mt=0, mtMes=0;
    diasMes.forEach((d,i)=>{
      const v = (exec[e.id]||{})[d]||0, mm = prodMetaDia(e.id, d, "poda");
      porDia[i].exec += v; porDia[i].meta += mm; mtMes += mm;
      if(d<=fim){ ex += v; mt += mm; }
    });
    return { equipe:e, exec:ex, meta:mt, metaMes:mtMes };
  });
  const totExec = porEquipe.reduce((s,x)=>s+x.exec,0), totMeta = porEquipe.reduce((s,x)=>s+x.meta,0), totMetaMes = porEquipe.reduce((s,x)=>s+x.metaMes,0);
  const uteisAte = diasAte.filter(prodEhDiaUtil).length, uteisMes = diasMes.filter(prodEhDiaUtil).length;
  const projecao = uteisAte>0 ? totExec/uteisAte*uteisMes : 0;
  return { anoMes, fim, diasMes, diasAte, porDia, porEquipe, totExec, totMeta, totMetaMes, metaPeriodo: totMetaMes, uteisAte, uteisMes, projecao };
}
function geralGraficoDiario(dados){
  const NM = dados.nomeMeta || "meta";
  if(dados.ano){
    const itens = geralPorMes(dados).map(x=>{ const p = x.meta>0 ? x.exec/x.meta*100 : null;
      return { ym:x.ym, valor:x.exec, meta:x.meta, cor: p===null ? "#9CA3AF" : `hsl(${Math.max(0,Math.min(100,p))*1.2} 60% 45%)`, texto:`${GERAL_MESES_CURTO[parseInt(x.ym.slice(5,7),10)-1]}/${x.ym.slice(0,4)}: executado ${prodFmt(x.exec)} · ${NM} ${prodFmt(x.meta)}${p!==null?` · ${Math.round(p)}%`:""}` }; });
    return geralColunasMensais(itens, "#1E7A34", "Produção mensal contra a meta")
      + `<p style="font-size:11.5px; color:var(--muted); margin:4px 0 0;">Barras = executado no mês (cor pelo % do ${NM}). Linha tracejada = ${NM} do mês. <b>Clique num mês</b> para ver os dias.</p>`;
  }
  const dias = dados.porDia.filter(x=>x.dia<=dados.fim);
  if(!dias.length) return `<p class="chart-loading">Sem dados no mês.</p>`;
  const W=720, H=240, pl=40, pr=10, pt=24, pb=30;
  const max = Math.max(1, ...dias.map(d=>Math.max(d.exec,d.meta)))*1.1;
  const bw = (W-pl-pr)/dias.length;
  const y = v => pt + (H-pt-pb)*(1 - v/max);
  const barras = dias.map((d,i)=>{
    const x = pl + i*bw + bw*0.15, w = bw*0.7, p = d.meta>0 ? d.exec/d.meta*100 : null;
    const cor = p===null ? "#9CA3AF" : `hsl(${Math.max(0,Math.min(100,p))*1.2} 60% 45%)`;
    return `<rect x="${x.toFixed(1)}" y="${y(d.exec).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0,(H-pb)-y(d.exec)).toFixed(1)}" fill="${cor}" rx="2"><title>${fmtDate(d.dia)} — executado ${prodFmt(d.exec)} · ${NM} ${prodFmt(d.meta)}${p!==null?` · ${Math.round(p)}%`:""}</title></rect>
      ${d.exec>0 ? (((H-pb)-y(d.exec)) >= 26
        ? `<text transform="translate(${(x+w/2+3).toFixed(1)} ${H-pb-4}) rotate(-90)" font-size="9" font-weight="700" fill="#0F1B0F">${geralNum(d.exec)}</text>`
        : `<text transform="translate(${(x+w/2+3).toFixed(1)} ${(y(d.exec)-3).toFixed(1)}) rotate(-90)" font-size="9" font-weight="700" fill="#374151">${geralNum(d.exec)}</text>`) : ""}
      ${(i%Math.ceil(dias.length/12)===0)?`<text x="${(x+w/2).toFixed(1)}" y="${H-10}" font-size="10" text-anchor="middle" fill="#6B7280">${d.dia.slice(8,10)}</text>`:""}`;
  }).join("");
  const passoMeta = dias.length>20 ? 3 : (dias.length>12 ? 2 : 1);
  const rotMeta = dias.map((d,i)=>(d.meta>0 && i%passoMeta===0) ? `<text x="${(pl+i*bw+bw/2).toFixed(1)}" y="${(y(d.meta)-5).toFixed(1)}" font-size="9" text-anchor="middle" fill="#1F1F4C" style="paint-order:stroke; stroke:#fff; stroke-width:3px; stroke-linejoin:round;">${geralNum(d.meta)}</text>` : "").join("");
  const linha = dias.map((d,i)=>`${i?"L":"M"} ${(pl+i*bw+bw/2).toFixed(1)} ${y(d.meta).toFixed(1)}`).join(" ");
  const ticks = [0,.25,.5,.75,1].map(f=>`<g><line x1="${pl}" x2="${W-pr}" y1="${y(max*f/1.1).toFixed(1)}" y2="${y(max*f/1.1).toFixed(1)}" stroke="#E5E7EB"/><text x="${pl-6}" y="${(y(max*f/1.1)+3).toFixed(1)}" font-size="10" text-anchor="end" fill="#6B7280">${Math.round(max*f/1.1)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;" role="img" aria-label="Produção diária contra a meta">${ticks}${barras}<path d="${linha}" fill="none" stroke="#1F1F4C" stroke-width="2" stroke-dasharray="5 4"/>${rotMeta}</svg>
    <p style="font-size:11.5px; color:var(--muted); margin:4px 0 0;">Barras = executado no dia (verde ≥ ${NM}, vermelho bem abaixo). Linha tracejada = ${NM} do dia${dados.nomeMeta?" (soma do previsto das OS executadas naquele dia)":" (soma das equipes); fim de semana/feriado = sem meta"}.</p>`;
}
function geralPorRegional(dados){
  const mapa = {};
  dados.porEquipe.forEach(x=>{
    const r = x.equipe.regional || "Sem regional";
    (mapa[r] = mapa[r] || { exec:0, meta:0, metaMes:0 });
    mapa[r].exec += x.exec; mapa[r].meta += x.meta; mapa[r].metaMes += x.metaMes;
  });
  const itens = Object.entries(mapa).sort((a,b)=>b[1].meta-a[1].meta);
  if(!itens.length) return `<p class="chart-loading">Sem metas cadastradas para o mês.</p>`;
  const max = Math.max(1, ...itens.map(([,v])=>Math.max(v.exec,v.meta)));
  return itens.map(([r,v])=>{
    const p = v.meta>0 ? Math.round(v.exec/v.meta*100) : null;
    return `<div style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;"><strong>${escapeHtml(r)}</strong><span>${prodFmt(v.exec)} de ${prodFmt(v.meta)} previsto${p!==null?` · <strong style="${prodCorPct(p)} padding:1px 6px; border-radius:6px;">${p}%</strong>`:""}</span></div>
      <div class="bar-track" title="Previsto (meta até hoje)"><div class="bar-fill" style="width:${Math.max(2,v.meta/max*100)}%; background:#CBD5E1;"></div></div>
      <div class="bar-track" style="margin-top:3px;" title="Realizado"><div class="bar-fill" style="width:${Math.max(2,v.exec/max*100)}%; background:${p===null?'#9CA3AF':`hsl(${Math.max(0,Math.min(100,p))*1.2} 60% 45%)`};"></div></div>
    </div>`;
  }).join("") + `<p style="font-size:11.5px; color:var(--muted); margin:0;">Cinza = previsto (meta proporcional aos dias úteis até ${fmtDate(dados.fim)}); colorida = realizado.</p>`;
}
function geralPorSemana(dados){
  if(dados.ano){
    const itens = geralPorMes(dados);
    if(!itens.length) return `<p class="chart-loading">Sem dados.</p>`;
    return `<table><thead><tr><th>Mês</th><th>Realizado</th><th>${dados.nomeMeta?"Previsto (OS executadas)":"Previsto"}</th><th>%</th></tr></thead><tbody>
      ${itens.map(v=>{ const p = v.meta>0 ? Math.round(v.exec/v.meta*100) : null;
        return `<tr><td><a href="#" onclick="geralDescer('${v.ym}'); return false;">${GERAL_MESES_CURTO[parseInt(v.ym.slice(5,7),10)-1]}/${v.ym.slice(0,4)}</a></td><td class="num">${prodFmt(v.exec)}</td><td class="num">${prodFmt(v.meta)}</td><td class="num" style="${p!==null?prodCorPct(p):''}">${p!==null?p+"%":"—"}</td></tr>`; }).join("")}
    </tbody></table>`;
  }
  const sem = {};
  dados.porDia.filter(x=>x.dia<=dados.fim).forEach(x=>{
    const k = isoSegundaDe(x.dia);
    (sem[k] = sem[k] || { exec:0, meta:0 });
    sem[k].exec += x.exec; sem[k].meta += x.meta;
  });
  const itens = Object.entries(sem).sort();
  if(!itens.length) return `<p class="chart-loading">Sem dados.</p>`;
  return `<table><thead><tr><th>Semana</th><th>Realizado</th><th>${dados.nomeMeta?"Previsto (OS executadas)":"Previsto"}</th><th>%</th></tr></thead><tbody>
    ${itens.map(([k,v])=>{ const p = v.meta>0 ? Math.round(v.exec/v.meta*100) : null;
      return `<tr><td>Sem ${prodSemanaIso(k)} · ${fmtDate(k).slice(0,5)}</td><td class="num">${prodFmt(v.exec)}</td><td class="num">${prodFmt(v.meta)}</td><td class="num" style="${p!==null?prodCorPct(p):''}">${p!==null?p+"%":"—"}</td></tr>`; }).join("")}
  </tbody></table>`;
}
function geralRanking(dados){
  const com = dados.porEquipe.filter(x=>x.meta>0).map(x=>({ ...x, p:x.exec/x.meta*100 })).sort((a,b)=>a.p-b.p);
  if(!com.length) return `<p class="chart-loading">Sem equipes com meta no mês.</p>`;
  const linha = x=>`<tr><td class="mono">${escapeHtml(x.equipe.id)}</td><td>${escapeHtml(x.equipe.polo||"")}</td><td class="num">${prodFmt(x.exec)}</td><td class="num">${prodFmt(x.meta)}</td><td class="num" style="${prodCorPct(x.p)}">${Math.round(x.p)}%</td></tr>`;
  const head = `<thead><tr><th>Equipe</th><th>Polo</th><th>Exec.</th><th>Meta</th><th>%</th></tr></thead>`;
  return `<div class="rank-grid">
    <div><h4 style="margin:0 0 6px; font-size:12.5px; color:var(--bad-fg);">Mais abaixo da meta</h4><table>${head}<tbody>${com.slice(0,5).map(linha).join("")}</tbody></table></div>
    <div><h4 style="margin:0 0 6px; font-size:12.5px; color:var(--ok-fg);">Melhores do ${dados.ano?"ano":"mês"}</h4><table>${head}<tbody>${com.slice(-5).reverse().map(linha).join("")}</tbody></table></div>
  </div>`;
}

/* v2.13.5 - Visão Geral separada por tipo de serviço. Executadas = as do mês
   de referência (pela data de execução); Pendente = tudo que ainda não foi
   executado. A meta das equipes é só de poda, então só a Poda é comparada com
   a meta (cards ao lado); Limpeza de faixa (m²) e Estruturas aparecem sem meta. */
function geralPorTipoHtml(mes){
  const noMes = osProducaoBase().filter(o=> o.statusOS==="Executada"
    ? String(o.dataExecucao||"").startsWith(mes) : true);
  const r = resumoPorTipo(noMes);
  /* v2.13.20 - os cards somam SGM + SIGOD; as executadas aparecem separadas por
     origem logo abaixo (o BI só tem o SGM/Plano 2026, então dá pra comparar). */
  const rSgm = resumoPorTipo(noMes.filter(o=>o.origem!=="SIGOD"));
  const rSig = resumoPorTipo(noMes.filter(o=>o.origem==="SIGOD"));
  const fmt = n=>Number(n||0).toLocaleString("pt-BR");
  const unidade = { poda:"un.", faixa:"m²", estrutura:"un." };
  return `<div class="grid cols-3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-top:14px;">
    ${TIPOS_SERVICO.map(([t,rot])=>`
    <div class="card">
      <div class="card-head"><h3>${rot}</h3><span class="pill info">${unidade[t]}${t==="poda"?" · com meta":" · sem meta"}</span></div>
      <div class="kpi-tres">
        <div><strong>${fmt(r[t].prev)}</strong><span>Previsto</span></div>
        <div><strong>${fmt(r[t].real)}</strong><span>Realizado</span></div>
        <div><strong>${fmt(r[t].pend)}</strong><span>Pendente</span></div>
      </div>
      ${(rSig[t].prev||rSig[t].real) ? `<div style="margin-top:8px; font-size:11.5px; color:var(--muted); line-height:1.5;">
        <div>Previsto (executadas): SGM <strong>${fmt(rSgm[t].prev)}</strong> · SIGOD <strong>${fmt(rSig[t].prev)}</strong></div>
        <div>Realizado: SGM <strong>${fmt(rSgm[t].real)}</strong> · SIGOD <strong>${fmt(rSig[t].real)}</strong></div>
      </div>` : ""}
    </div>`).join("")}
  </div>
  <p class="kpi-legenda" style="margin-top:6px;">Previsto e Realizado: OS executadas no mês · Pendente: serviços previstos nas OS ainda não executadas · soma das quantidades de todas as linhas da OS na MO. Os cards somam SGM + SIGOD (plantão); a separação das executadas aparece em cada card. O BI só considera o SGM (Plano 2026).</p>`;
}

/* v2.13.22 - tabela Limpeza de faixa x Poda do mês por regional e polo.
   Previsto/Realizado = OS executadas no mês; Pendente = OS ainda não executadas
   (todas, não só do mês). Regional/polo vêm do alimentador da OS. */
function geralRegionalPoloHtml(mes){
  const lista = osProducaoBase().filter(o=> o.statusOS!=="Cancelada" && (o.statusOS==="Executada"
    ? String(o.dataExecucao||"").startsWith(mes) : true));
  const nova = ()=>({ poda:{prev:0,real:0,pend:0}, faixa:{prev:0,real:0,pend:0} });
  const regs = {};
  lista.forEach(o=>{
    const reg = regionalDaOS(o) || "Sem regional";
    const polo = municipioDaOS(o) || "Sem polo";
    const r = regs[reg] || (regs[reg] = { tot:nova(), polos:{} });
    const pl = r.polos[polo] || (r.polos[polo] = nova());
    const exec = o.statusOS==="Executada";
    ["poda","faixa"].forEach(t=>{
      const pv = qtdTipoOS(o,t,"prev"), rl = qtdTipoOS(o,t,"real");
      [r.tot, pl].forEach(x=>{ if(exec){ x[t].prev+=pv; x[t].real+=rl; } else x[t].pend+=pv; });
    });
  });
  const fmt = n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:0});
  const pct = (re,pv)=> pv>0 ? Math.round(re/pv*100)+"%" : "—";
  const cel = x=>`<td class="num">${fmt(x.prev)}</td><td class="num">${fmt(x.real)}</td><td class="num">${pct(x.real,x.prev)}</td><td class="num">${fmt(x.pend)}</td>`;
  const ordem = (a,b)=> a==="Sem regional"?1 : b==="Sem regional"?-1 : a.localeCompare(b,"pt-BR",{sensitivity:"base"});
  const total = nova();
  let corpo = "";
  Object.keys(regs).sort(ordem).forEach(rn=>{
    const r = regs[rn];
    ["poda","faixa"].forEach(t=>["prev","real","pend"].forEach(k=>{ total[t][k]+=r.tot[t][k]; }));
    corpo += `<tr class="reg-linha"><td><strong>${escapeHtml(rn)}</strong></td>${cel(r.tot.poda)}${cel(r.tot.faixa)}</tr>`;
    Object.keys(r.polos).sort(ordem).forEach(pn=>{
      corpo += `<tr class="polo-linha"><td>${escapeHtml(pn)}</td>${cel(r.polos[pn].poda)}${cel(r.polos[pn].faixa)}</tr>`;
    });
  });
  if(!corpo) return "";
  return `<div class="card" style="margin-top:14px;">
    <div class="card-head"><h3>Limpeza de faixa e Poda por regional e polo</h3><span class="pill info">${escapeHtml(mes.length===4 ? mes : mes.slice(5,7)+"/"+mes.slice(0,4))}</span></div>
    <div class="table-wrap"><table class="tab-regional">
      <thead>
        <tr><th rowspan="2">Regional / Polo</th><th colspan="4" class="grp">Poda (un.)</th><th colspan="4" class="grp">Limpeza de faixa (m²)</th></tr>
        <tr><th>Previsto</th><th>Realizado</th><th>%</th><th>Pendente</th><th>Previsto</th><th>Realizado</th><th>%</th><th>Pendente</th></tr>
      </thead>
      <tbody>${corpo}</tbody>
      <tfoot><tr><td><strong>Total</strong></td>${cel(total.poda)}${cel(total.faixa)}</tr></tfoot>
    </table></div>
    <p class="kpi-legenda">Previsto/Realizado: OS executadas no mês · Pendente: OS ainda não executadas (todas) · % = realizado ÷ previsto. Regional e polo pelo alimentador da OS.</p>
  </div>`;
}

function gerarPdfRelatorio(){
  const v = document.getElementById("view");
  const titulo = (v.querySelector("h3")||{}).textContent || "Resumo gerencial";
  const antes = document.title;
  document.title = "SPARK - " + titulo.replace(/[\\/:*?"<>|]/g,"-");
  document.body.classList.add("imprimindo");
  const fim = ()=>{ document.body.classList.remove("imprimindo"); document.title = antes; window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  setTimeout(()=>window.print(), 50);
}

/* v2.15.40 - SPARK se apresenta no topo da Visão Geral (pode ser recolhido; lembra a escolha) */
function sparkApresentacaoFechada(){ try{ return localStorage.getItem("sparkApresentacao")==="0"; }catch(e){ return false; } }
function sparkApresentacaoToggle(){
  try{ localStorage.setItem("sparkApresentacao", sparkApresentacaoFechada() ? "1" : "0"); }catch(e){}
  render();
}
function sparkApresentacaoHtml(){
  if(!sparkAtivo()) return "";
  if(sparkApresentacaoFechada()) return `<div class="spark-apres-mini no-print"><button class="btn btn-ghost btn-sm" type="button" onclick="sparkApresentacaoToggle()">Apresentação do SPARK</button></div>`;
  return `<section class="spark-apres no-print">
    <img src="assets/spark/spark_corpo.png" alt="SPARK">
    <div class="spark-apres-balao">
      <h3>Oi! Eu sou o SPARK</h3>
      <p>Eu ajudo a gente a manter a poda e a manutenção da rede em dia. Aqui no sistema você:</p>
      <ul>
        <li><b>vê no mapa</b> as OS de poda, limpeza de faixa e estrutura;</li>
        <li><b>programa as equipes</b> por proteção e acompanha o calendário;</li>
        <li><b>compara</b> o executado com a meta na Produtividade e justifica quando precisa;</li>
        <li><b>recebe alertas</b> de OS próximas, fora do padrão e sem recurso;</li>
        <li><b>importa e organiza as bases</b> e gera os envios e arquivos de auditoria.</li>
      </ul>
      <p>Qualquer aviso importante, eu falo por aqui.</p>
      <button class="btn btn-ghost btn-sm" type="button" onclick="sparkApresentacaoToggle()">Entendi, recolher</button>
    </div>
  </section>`;
}
/* =========================================================================
   v3.3.0 - VISÃO GERAL EM SEÇÕES (estilo jornal): menu de texto separado por "/",
   uma seção por vez. Resumo / Podas / Limpeza de faixa / Estruturas / Equipes /
   Atrasos / Regionais / Programação. Os cartões continuam podendo ir para tela cheia.
   ========================================================================= */
let geralSecao = "resumo";
const GERAL_SECOES = [["resumo","Resumo"],["podas","Podas"],["faixa","Limpeza de faixa"],["estruturas","Estruturas"],["equipes","Equipes"],["medias","Médias"],["atrasos","Atrasos"],["regionais","Regionais"],["programacao","Programação"]];
function setGeralSecao(s){ geralSecao = s; render(); }
function geralMenuHtml(){
  return `<nav class="jn-menu no-print" aria-label="Seções da Visão Geral">${GERAL_SECOES.map(([k,r],i)=>
    `${i?`<span class="jn-sep" aria-hidden="true">/</span>`:""}<button type="button" class="jn-item ${geralSecao===k?"ativo":""}" ${geralSecao===k?'aria-current="page"':""} onclick="setGeralSecao('${k}')">${r}</button>`).join("")}</nav>`;
}
const GERAL_STATUS_ABERTOS = ["Pendente","A reprogramar","Programada","Despachada"];
function geralIdadeDias(o){
  if(!o.dataAbertura) return null;
  const a = new Date(String(o.dataAbertura).slice(0,10)+"T12:00:00"), h = new Date(prodHojeIso()+"T12:00:00");
  const n = Math.round((h-a)/86400000);
  return isFinite(n) ? Math.max(0,n) : null;
}
const GERAL_FAIXAS_IDADE = [["até 15 dias",0,15,"#1E7A34"],["16 a 30 dias",16,30,"#6B9E2E"],["31 a 60 dias",31,60,"#B45309"],["61 a 90 dias",61,90,"#C2410C"],["mais de 90 dias",91,99999,"#B42318"]];
function geralNum(n, casas){ return Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:casas==null?0:casas}); }
/* barras horizontais simples e limpas: itens [{rotulo, valor, cor, extra}] */
function geralBarras(itens, unidade){
  if(!itens.length) return `<p class="chart-loading">Sem dados.</p>`;
  const max = Math.max(1, ...itens.map(i=>i.valor));
  return `<div class="jn-barras">${itens.map(i=>`
    <div class="jn-barra"><span class="jn-barra-rot">${escapeHtml(i.rotulo)}</span>
      <div class="jn-barra-trilho"><div class="jn-barra-fill" style="width:${Math.max(i.valor>0?2:0, i.valor/max*100)}%; background:${i.cor||"var(--primary)"};"></div></div>
      <span class="jn-barra-val">${geralNum(i.valor)}${unidade?` ${unidade}`:""}${i.extra?` <small>${escapeHtml(i.extra)}</small>`:""}</span></div>`).join("")}</div>`;
}
/* colunas por dia do mês de um valor qualquer: valores = {iso: n} */
function geralColunasDia(valores, mes, cor, unidade){
  if(String(mes).length===4){
    const por = {}; Object.keys(valores).forEach(d=>{ if(d.startsWith(mes)){ const k=d.slice(0,7); por[k]=(por[k]||0)+valores[d]; } });
    const itens = Object.keys(por).sort().map(k=>({ ym:k, valor:por[k], texto:`${GERAL_MESES_CURTO[parseInt(k.slice(5,7),10)-1]}/${k.slice(0,4)}: ${geralNum(por[k],1)} ${unidade||""}` }));
    return geralColunasMensais(itens.map(i=>({...i, corTxt:"#fff"})), cor, "Realizado por mês") + `<p class="jn-nota"><b>Clique num mês</b> para ver os dias.</p>`;
  }
  const [a,m] = mes.split("-").map(Number), ult = new Date(a, m, 0).getDate(), hoje = prodHojeIso();
  const dias = Array.from({length:ult}, (_,i)=>`${mes}-${String(i+1).padStart(2,"0")}`).filter(d=>d<=hoje);
  if(!dias.length) return `<p class="chart-loading">Sem dados no mês.</p>`;
  const W=720, H=210, pl=42, pr=8, pt=22, pb=26;
  const max = Math.max(1, ...dias.map(d=>valores[d]||0))*1.1, bw = (W-pl-pr)/dias.length;
  const y = v=>pt+(H-pt-pb)*(1-v/max);
  const barras = dias.map((d,i)=>{ const v = valores[d]||0, x = pl+i*bw+bw*.15, w = bw*.7;
    return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0,(H-pb)-y(v)).toFixed(1)}" fill="${cor}" rx="2"><title>${fmtDate(d)}: ${geralNum(v,1)} ${unidade||""}</title></rect>
      ${v>0 ? (((H-pb)-y(v)) >= 26
        ? `<text transform="translate(${(x+w/2+3).toFixed(1)} ${H-pb-4}) rotate(-90)" font-size="9" font-weight="700" fill="#fff">${geralNum(v)}</text>`
        : `<text transform="translate(${(x+w/2+3).toFixed(1)} ${(y(v)-3).toFixed(1)}) rotate(-90)" font-size="9" font-weight="700" fill="#374151">${geralNum(v)}</text>`) : ""}
      ${(i%Math.ceil(dias.length/12)===0)?`<text x="${(x+w/2).toFixed(1)}" y="${H-8}" font-size="10" text-anchor="middle" fill="#6B7280">${d.slice(8,10)}</text>`:""}`; }).join("");
  const ticks = [0,.5,1].map(f=>`<g><line x1="${pl}" x2="${W-pr}" y1="${y(max*f/1.1).toFixed(1)}" y2="${y(max*f/1.1).toFixed(1)}" stroke="#E5E7EB"/><text x="${pl-6}" y="${(y(max*f/1.1)+3).toFixed(1)}" font-size="10" text-anchor="end" fill="#6B7280">${geralNum(max*f/1.1)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;" role="img" aria-label="Realizado por dia">${ticks}${barras}</svg>`;
}
function geralRealPorDia(tipo, mes){
  const v = {};
  osProducaoBase().forEach(o=>{
    if(o.statusOS!=="Executada" || !o.dataExecucao) return;
    const d = String(o.dataExecucao).slice(0,10); if(!d.startsWith(mes)) return;
    const q = qtdTipoOS(o, tipo, "real"); if(q>0) v[d] = (v[d]||0)+q;
  });
  return v;
}
/* faixa de números grandes do tipo de serviço: previsto / realizado / pendente */
function geralTipoBloco(mes, t){
  const noMes = state.manutencaoOS.filter(o=> o.statusOS==="Executada" ? String(o.dataExecucao||"").startsWith(mes) : true);
  const r = resumoPorTipo(noMes)[t], rSgm = resumoPorTipo(noMes.filter(o=>o.origem!=="SIGOD"))[t], rSig = resumoPorTipo(noMes.filter(o=>o.origem==="SIGOD"))[t];
  const un = t==="faixa" ? "m²" : "un.", pct = r.prev>0 ? Math.round(r.real/r.prev*100) : null;
  return `<div class="jn-numeros">
      <div><span class="jn-rot">Previsto (executadas)</span><strong>${geralNum(r.prev)}</strong><span class="jn-sub">${un}</span></div>
      <div><span class="jn-rot">Realizado</span><strong>${geralNum(r.real)}</strong><span class="jn-sub">${pct!==null?pct+"% do previsto":un}</span></div>
      <div><span class="jn-rot">Pendente</span><strong>${geralNum(r.pend)}</strong><span class="jn-sub">${un} em OS abertas</span></div>
    </div>
    ${(rSig.prev||rSig.real) ? `<p class="jn-nota">Realizado: SGM <b>${geralNum(rSgm.real)}</b> · SIGOD <b>${geralNum(rSig.real)}</b> (${un})</p>` : ""}`;
}
function geralAbertas(){ return state.manutencaoOS.filter(o=>GERAL_STATUS_ABERTOS.includes(o.statusOS)); }

function geralSecaoResumo(ctx){
  const { d, mes, pAtingido, pProj, pCheia, abaixo, comMeta, pendentes, areprog, progAtivas, conflitos, un } = ctx;
  const abertas = geralAbertas();
  const velhas = abertas.filter(o=>{ const i = geralIdadeDias(o); return i!==null && i>30; }).length;
  const atencao = [];
  if(velhas>0) atencao.push(["bad", `<b>${geralNum(velhas)}</b> OS abertas há mais de 30 dias`, "atrasos"]);
  if(comMeta>0 && abaixo>0) atencao.push(["warn", `<b>${abaixo}</b> de ${comMeta} equipes abaixo de 90% da meta no ${un}`, "equipes"]);
  if(d.totMetaMes>0 && pProj<90) atencao.push(["warn", `Projeção do ${un} em <b>${pProj.toLocaleString("pt-BR")}%</b> da meta de poda`, "podas"]);
  if(areprog>0) atencao.push(["warn", `<b>${geralNum(areprog)}</b> OS a reprogramar`, "atrasos"]);
  if(conflitos>0) atencao.push(["bad", `<b>${conflitos}</b> conflito(s) de equipe na programação`, "programacao"]);
  if(!atencao.length) atencao.push(["ok", "Nada pedindo atenção agora.", null]);
  const c = pctColor(pAtingido), cp = pctColor(pCheia);
  return `
  <div class="jn-numeros jn-cinco">
    <div><span class="jn-rot">Meta de poda até hoje</span><strong style="color:${c.fg}">${pAtingido.toLocaleString("pt-BR")}%</strong><span class="jn-sub">${prodFmt(d.totExec)} de ${prodFmt(d.totMeta)}</span></div>
    <div><span class="jn-rot">Meta ${ctx.ano?"do ano":"do mês"} completa</span><strong style="color:${cp.fg}">${pCheia.toLocaleString("pt-BR")}%</strong><span class="jn-sub">${prodFmt(d.totExec)} de ${prodFmt(d.metaPeriodo)}${d.totMetaMes>0?` · no ritmo: ${pProj.toLocaleString("pt-BR")}%`:""}</span></div>
    <div><span class="jn-rot">Equipes abaixo de 90%</span><strong>${abaixo}<small> / ${comMeta}</small></strong><span class="jn-sub">no ${un}</span></div>
    <div><span class="jn-rot">OS pendentes</span><strong>${geralNum(pendentes)}</strong><span class="jn-sub">${areprog?geralNum(areprog)+" a reprogramar":"em aberto"}</span></div>
    <div><span class="jn-rot">Programações ativas</span><strong>${progAtivas}</strong><span class="jn-sub">${conflitos>0?conflitos+" conflito(s)":"sem conflitos"}</span></div>
  </div>
  <div class="jn-duas">
    <div class="card">
      <div class="card-head"><h3>Pede atenção agora</h3></div>
      <ul class="jn-atencao">${atencao.map(([cl,t,sec])=>`<li class="${cl}"><span class="jn-bolinha"></span><span>${t}</span>${sec?`<a href="#" onclick="setGeralSecao('${sec}'); return false;">ver</a>`:""}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <div class="card-head"><h3>Produção ${ctx.ano?"mensal":"diária"} x meta (poda)</h3></div>
      ${geralGraficoDiario(d)}
    </div>
  </div>`;
}
function geralSecaoPodas(ctx){
  const { mes } = ctx;
  const dp = geralDadosPodaTotal(mes);
  return `${geralTipoBloco(mes,"poda")}
  <div class="jn-duas">
    <div class="card">
      <div class="card-head"><h3>Produção ${ctx.ano?"mensal":"diária"} x meta · todas as podas</h3><span class="pill info">un.</span></div>
      ${geralGraficoDiario(dp)}
      <h4 class="jn-sub-h">Acumulado</h4>
      ${geralGraficoAcumulado(dp, "un.")}
    </div>
    <div class="card"><div class="card-head"><h3>Por ${ctx.ano?"mês":"semana"}</h3><span class="pill info">un.</span></div><div class="table-wrap">${geralPorSemana(dp)}</div>
      <p style="font-size:11.5px; color:var(--muted); margin:8px 0 0;">Realizado = todas as podas executadas (SGM + SIGOD, todas as equipes). Previsto = meta das equipes que têm meta cadastrada.</p></div>
  </div>`;
}
/* v3.4.3 - Limpeza de faixa / Estruturas: mesmo par de gráficos da Poda. Não há meta cadastrada para estes tipos,
   então a linha/coluna "Previsto" = previsto das OS executadas em cada dia (por data de execução). */
function geralDadosTipo(mes, t){
  const base = geralDados(mes);
  const real = {}, prev = {};
  osProducaoBase().forEach(o=>{
    if(o.statusOS!=="Executada" || !o.dataExecucao) return;
    const dia = String(o.dataExecucao).slice(0,10); if(!dia.startsWith(mes)) return;
    const r = qtdTipoOS(o,t,"real"), pv = qtdTipoOS(o,t,"prev");
    if(r>0) real[dia] = (real[dia]||0)+r;
    if(pv>0 && (r>0 || pv>0)) prev[dia] = (prev[dia]||0)+pv;
  });
  const porDia = base.porDia.map(x=>({ dia:x.dia, exec:real[x.dia]||0, meta:prev[x.dia]||0 }));
  return { ...base, porDia, nomeMeta:"previsto" };
}
/* v3.8.0 - PODA: o gráfico e a tabela da aba Podas passam a mostrar TODAS as podas executadas (todas as equipes,
   SGM + SIGOD, com ou sem meta) - o mesmo total do cartão "Realizado". A linha/coluna de meta continua sendo a das
   equipes que têm meta cadastrada (não existe meta para as demais). */
function geralDadosPodaTotal(mes){
  const base = geralDados(mes);
  const real = {};
  osProducaoBase().forEach(o=>{
    if(o.statusOS!=="Executada" || !o.dataExecucao) return;
    const dia = String(o.dataExecucao).slice(0,10); if(!dia.startsWith(mes)) return;
    const r = qtdTipoOS(o,"poda","real");
    if(r>0) real[dia] = (real[dia]||0)+r;
  });
  const porDia = base.porDia.map(x=>({ dia:x.dia, exec:real[x.dia]||0, meta:x.meta }));
  return { ...base, porDia };
}
/* acumulado do período (mês: dia a dia; ano: mês a mês) — linha cheia = realizado acumulado, tracejada = meta/previsto acumulado */
function geralGraficoAcumulado(dados, unidade){
  const NM = dados.nomeMeta || "meta";
  let pts;
  if(dados.ano){
    pts = geralPorMes(dados).map(x=>({ rot:GERAL_MESES_CURTO[parseInt(x.ym.slice(5,7),10)-1], dica:`${GERAL_MESES_CURTO[parseInt(x.ym.slice(5,7),10)-1]}/${x.ym.slice(0,4)}`, exec:x.exec, meta:x.meta }));
  } else {
    pts = dados.porDia.filter(x=>x.dia<=dados.fim).map(x=>({ rot:x.dia.slice(8,10), dica:fmtDate(x.dia), exec:x.exec, meta:x.meta }));
  }
  if(!pts.length) return `<p class="chart-loading">Sem dados no período.</p>`;
  let ae = 0, am = 0;
  pts.forEach(p=>{ ae += p.exec; am += p.meta; p.ae = ae; p.am = am; });
  const temMeta = am > 0;
  const W=720, H=210, pl=50, pr=14, pt=18, pb=26;
  const max = Math.max(1, ae, am) * 1.08;
  const n = pts.length, dx = n>1 ? (W-pl-pr)/(n-1) : 0;
  const X = i => n>1 ? pl + i*dx : (pl + (W-pl-pr)/2);
  const Y = v => pt + (H-pt-pb)*(1 - v/max);
  const linhaExec = pts.map((p,i)=>`${i?"L":"M"} ${X(i).toFixed(1)} ${Y(p.ae).toFixed(1)}`).join(" ");
  const area = `${linhaExec} L ${X(n-1).toFixed(1)} ${Y(0).toFixed(1)} L ${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  const linhaMeta = temMeta ? `<path d="${pts.map((p,i)=>`${i?"L":"M"} ${X(i).toFixed(1)} ${Y(p.am).toFixed(1)}`).join(" ")}" fill="none" stroke="#1F1F4C" stroke-width="2" stroke-dasharray="5 4"/>` : "";
  const ticks = [0,.5,1].map(f=>{ const v = max/1.08*f; return `<g><line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#E5E7EB"/><text x="${pl-6}" y="${(Y(v)+3).toFixed(1)}" font-size="10" text-anchor="end" fill="#6B7280">${geralNum(v)}</text></g>`; }).join("");
  const passo = Math.max(1, Math.ceil(n/12));
  const xs = pts.map((p,i)=> (i%passo===0 || i===n-1) ? `<text x="${X(i).toFixed(1)}" y="${H-8}" font-size="10" text-anchor="middle" fill="#6B7280">${p.rot}</text>` : "").join("");
  const bolas = pts.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.ae).toFixed(1)}" r="${n>16?2:3.2}" fill="#1E7A34"><title>${escapeHtml(p.dica)} — acumulado ${prodFmt(p.ae)}${temMeta?` · ${NM} acumulada ${prodFmt(p.am)}`:""}</title></circle>`).join("");
  const rotFim = `<text x="${(X(n-1)-4).toFixed(1)}" y="${(Y(ae)-7).toFixed(1)}" font-size="11" font-weight="700" text-anchor="end" fill="#14532D">${geralNum(ae)}</text>`
    + (temMeta ? `<text x="${(X(n-1)-4).toFixed(1)}" y="${(Y(am)-7).toFixed(1)}" font-size="10.5" text-anchor="end" fill="#1F1F4C">${geralNum(am)}</text>` : "");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;" role="img" aria-label="Produção acumulada">${ticks}<path d="${area}" fill="#1E7A34" opacity=".12"/>${linhaMeta}<path d="${linhaExec}" fill="none" stroke="#1E7A34" stroke-width="2.4"/>${bolas}${rotFim}${xs}</svg>
    <p style="font-size:11.5px; color:var(--muted); margin:4px 0 0;">Linha verde = ${unidade||"produção"} realizado acumulado no ${dados.ano?"ano":"mês"}${temMeta?`; tracejada = ${NM} acumulada`:""}.</p>`;
}
function geralSecaoTipo(ctx, t){
  const { mes } = ctx, rot = t==="faixa" ? "Limpeza de faixa" : "Estruturas", un = t==="faixa" ? "m²" : "un.";
  const dt = geralDadosTipo(mes, t);
  return `${geralTipoBloco(mes,t)}
  <div class="jn-duas">
    <div class="card"><div class="card-head"><h3>${rot}: produção ${ctx.ano?"mensal":"diária"} x previsto</h3><span class="pill info">${un}</span></div>${geralGraficoDiario(dt)}
      <h4 class="jn-sub-h">Acumulado</h4>
      ${geralGraficoAcumulado(dt, un)}</div>
    <div class="card"><div class="card-head"><h3>Por ${ctx.ano?"mês":"semana"}</h3><span class="pill info">${un}</span></div><div class="table-wrap">${geralPorSemana(dt)}</div></div>
  </div>`;
}
function geralSecaoEquipes(ctx){
  const { d } = ctx;
  const semProd = d.porEquipe.filter(x=>x.meta>0 && x.exec<=0);
  return `<div class="card"><div class="card-head"><h3>Ranking de equipes (% da meta de poda no ${ctx.un})</h3><a href="#produtividade" class="pill info" style="text-decoration:none;">Abrir produtividade</a></div>
      <div class="table-wrap">${geralRanking(d)}</div></div>
    <div class="card" style="margin-top:14px;"><div class="card-head"><h3>Equipes com meta e sem produção no ${ctx.un}</h3><span class="pill ${semProd.length?"warn":"ok"}">${semProd.length}</span></div>
      ${semProd.length ? `<p class="jn-lista">${semProd.map(x=>`<span class="mono">${escapeHtml(x.equipe.id)}</span>`).join(" · ")}</p>` : `<p class="chart-loading">Todas as equipes com meta tiveram produção.</p>`}</div>`;
}
/* v3.3.1 - Médias de produtividade por dia trabalhado (equipe, polo e regional; polo/regional em Linha Viva x Linha Morta) */
function geralSecaoMedias(ctx, imprimir){
  const { d } = ctx;
  const fp = geralMediaEqPoda;
  const equipes = (state.equipes||[]).filter(e=>(!fp.size || (fp.has("sim") && !!e.equipePoda) || (fp.has("nao") && !e.equipePoda)));
  const sufixo = fp.size===1 ? ` · equipe poda: ${fp.has("sim")?"sim":"não"}` : "";
  const rotulo = (d.diasAte.length ? `${fmtDate(d.diasAte[0])} a ${fmtDate(d.fim)}` : "sem dias") + sufixo;
  if(imprimir) return `<h3 class="pg-sub">Poda (un.)</h3>${prodMediasHtml(d.diasAte, equipes, "poda", rotulo, true)}<h3 class="pg-sub pg-quebra">Limpeza de faixa (km)</h3>${prodMediasHtml(d.diasAte, equipes, "faixa", rotulo, true)}`;
  return `<div class="jn-filtros-med no-print">
    <div class="tabs" title="Serviço">
      <button class="tab ${geralMediaServ==='poda'?'active':''}" onclick="setGeralMediaServ('poda')">Poda (un.)</button>
      <button class="tab ${geralMediaServ==='faixa'?'active':''}" onclick="setGeralMediaServ('faixa')">Limpeza de faixa (km)</button>
    </div>
    ${multiComboHtml("g_poda","Equipe poda",[{v:"sim",t:"Sim"},{v:"nao",t:"Não"}],geralMediaEqPoda,"toggleGeralMediaEqPoda","limparGeralMediaEqPoda","Todas")}
    </div>
    ${prodMediasHtml(d.diasAte, equipes, geralMediaServ, rotulo)}`;
}
function geralSecaoAtrasos(){
  const abertas = geralAbertas();
  const faixas = GERAL_FAIXAS_IDADE.map(([rot,mi,ma,cor])=>({ rotulo:rot, cor, valor: abertas.filter(o=>{ const i = geralIdadeDias(o); return i!==null && i>=mi && i<=ma; }).length }));
  const semData = abertas.filter(o=>geralIdadeDias(o)===null).length;
  const porReg = {};
  abertas.forEach(o=>{ const r = regionalDaOS(o) || "Sem regional"; const i = geralIdadeDias(o);
    const x = porReg[r] || (porReg[r] = { n:0, velhas:0 }); x.n++; if(i!==null && i>30) x.velhas++; });
  const regs = Object.entries(porReg).sort((a,b)=>b[1].velhas-a[1].velhas || b[1].n-a[1].n);
  const antigas = abertas.map(o=>({ o, i:geralIdadeDias(o) })).filter(x=>x.i!==null).sort((a,b)=>b.i-a.i).slice(0,12);
  return `<div class="jn-duas">
    <div class="card"><div class="card-head"><h3>OS abertas por idade</h3><span class="pill info">${geralNum(abertas.length)} OS</span></div>
      ${geralBarras(faixas, "OS")}
      <p class="jn-nota">Idade = dias desde a abertura da OS. Abertas = Pendente, A reprogramar, Programada e Despachada.${semData?` ${geralNum(semData)} OS sem data de abertura ficam fora das faixas.`:""}</p></div>
    <div class="card"><div class="card-head"><h3>Abertas por regional</h3></div>
      <div class="table-wrap"><table><thead><tr><th>Regional</th><th>Abertas</th><th>&gt; 30 dias</th></tr></thead><tbody>
        ${regs.map(([r,x])=>`<tr><td>${escapeHtml(r)}</td><td class="num">${geralNum(x.n)}</td><td class="num" style="${x.velhas?"color:var(--bad-fg); font-weight:700;":""}">${geralNum(x.velhas)}</td></tr>`).join("") || `<tr><td colspan="3" class="chart-loading">Sem OS abertas.</td></tr>`}
      </tbody></table></div></div>
  </div>
  <div class="card" style="margin-top:14px;"><div class="card-head"><h3>As 12 OS abertas mais antigas</h3><a href="#manutencao" class="pill info" style="text-decoration:none;">Ver mapa</a></div>
    <div class="table-wrap"><table><thead><tr><th>OS</th><th>Serviço</th><th>Status</th><th>Alimentador</th><th>Conjunto</th><th>Regional</th><th>Aberta em</th><th>Dias</th></tr></thead><tbody>
      ${antigas.map(({o,i})=>`<tr><td class="mono">${escapeHtml(o.id)}</td><td>${escapeHtml(servicoTextoOS(o))}</td><td>${statusPill(o.statusOS)}</td><td class="mono">${escapeHtml(o.alimentador||"")}</td><td>${escapeHtml(conjuntoDaOS(o))}</td><td>${escapeHtml(regionalDaOS(o)||"")}</td><td>${fmtDate(o.dataAbertura)}</td><td class="num"><b>${i}</b></td></tr>`).join("") || `<tr><td colspan="8" class="chart-loading">Sem OS abertas.</td></tr>`}
    </tbody></table></div></div>`;
}
function geralSecaoRegionais(ctx, imprimir){
  const { d, mes } = ctx;
  const km = (!imprimir) ? { cid:`<div id="kmRedePorCidade" class="chart-loading">Carregando…</div>`, tipo:`<div id="kmRedePorTipo" class="chart-loading">Carregando…</div>` }
    : (_kmRedeCache ? { cid: renderKmRedePorCidade(_kmRedeCache), tipo: renderKmRedePorTipo(_kmRedeCache) } : null);
  return `<div class="jn-duas">
      <div class="card"><div class="card-head"><h3>Poda: previsto x realizado por regional</h3></div>${geralPorRegional(d)}</div>
      ${km ? `<div class="card"><div class="card-head"><h3>Km de rede por polo</h3></div>${km.cid}</div>` : ""}
    </div>
    ${geralRegionalPoloHtml(mes)}
    ${km ? `<div class="card" style="margin-top:14px;"><div class="card-head"><h3>Km de rede por tipo</h3></div>${km.tipo}</div>` : ""}`;
}
function geralSecaoProgramacao(){
  const ini = progSemanaAtual(), fim = isoMais(ini,6);
  const semana = (state.programacoes||[]).filter(p=>p.status!=="Cancelada" && p.dataInicio<=fim && p.dataFim>=ini).sort((a,b)=>String(a.dataInicio).localeCompare(String(b.dataInicio))).slice(0,15);
  return `<div class="card"><div class="card-head"><h3>Programações da semana (${fmtDate(ini).slice(0,5)} a ${fmtDate(fim).slice(0,5)})</h3><a href="#programacao" class="pill info" style="text-decoration:none;">Abrir módulo</a></div>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Proteção | Conjunto</th><th>Equipe(s)</th><th>Status</th></tr></thead><tbody>
        ${semana.map(p=>`<tr><td>${fmtDate(p.dataInicio)}</td><td class="mono">${escapeHtml(protecaoConjuntoTexto(p))}</td><td>${escapeHtml((p.equipesIds||[]).join(", "))}</td><td>${statusPill(p.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="chart-loading">Nenhuma programação nesta semana.</td></tr>`}
      </tbody></table></div></div>`;
}

const GERAL_NOMES_MES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function geralRotPeriodo(a){ return String(a).length===4 ? String(a) : `${GERAL_NOMES_MES[parseInt(a.slice(5,7),10)-1]}/${a.slice(0,4)}`; }
function geralContexto(){
  const pendentes = state.manutencaoOS.filter(o=>o.statusOS==="Pendente").length;
  const areprog = state.manutencaoOS.filter(o=>o.statusOS==="A reprogramar").length;
  const progAtivas = state.programacoes.filter(p=>p.status!=="Cancelada" && p.status!=="Concluída").length;
  const conflitos = detectarConflitos().length;
  const mes = geralPeriodoRef();
  const d = geralDados(mes);
  const pAtingido = d.totMeta>0 ? Math.round(d.totExec/d.totMeta*1000)/10 : 0;
  const pProj = d.totMetaMes>0 ? Math.round(d.projecao/d.totMetaMes*1000)/10 : 0;
  const pCheia = d.metaPeriodo>0 ? Math.round(d.totExec/d.metaPeriodo*1000)/10 : 0;   /* v3.15.0 - executado / meta do período inteiro */
  const abaixo = d.porEquipe.filter(x=>x.meta>0 && x.exec/x.meta<0.9).length;
  const comMeta = d.porEquipe.filter(x=>x.meta>0).length;
  return { d, mes, ano: !!d.ano, un: d.ano ? "ano" : "mês", pAtingido, pProj, pCheia, abaixo, comMeta, pendentes, areprog, progAtivas, conflitos };
}
function geralCorpoDaSecao(k, ctx, imprimir){
  return ({ resumo:()=>geralSecaoResumo(ctx), podas:()=>geralSecaoPodas(ctx), faixa:()=>geralSecaoTipo(ctx,"faixa"), estruturas:()=>geralSecaoTipo(ctx,"estrutura"),
    equipes:()=>geralSecaoEquipes(ctx), medias:()=>geralSecaoMedias(ctx, imprimir), atrasos:()=>geralSecaoAtrasos(), regionais:()=>geralSecaoRegionais(ctx, imprimir), programacao:()=>geralSecaoProgramacao() })[k]();
}
function viewGeral(){
  const ctx = geralContexto(), { d, mes } = ctx;
  histGarantirPeriodo(mes);
  if(!GERAL_SECOES.some(([k])=>k===geralSecao)) geralSecao = "resumo";
  const corpo = geralCorpoDaSecao(geralSecao, ctx, false);
  const tituloSecao = (GERAL_SECOES.find(([k])=>k===geralSecao)||[])[1] || "";
  const seletor = ctx.ano
    ? `<select onchange="setGeralAno(this.value)" aria-label="Ano de referência">${(geralAnosDisponiveis().includes(mes)?geralAnosDisponiveis():[mes,...geralAnosDisponiveis()]).map(a=>`<option value="${a}" ${a===mes?"selected":""}>${a}</option>`).join("")}</select>`
    : `<select onchange="setGeralMes(this.value)" aria-label="Mês de referência">${geralMesesDisponiveis().map(m=>`<option value="${m}" ${m===mes?"selected":""}>${geralRotPeriodo(m)}</option>`).join("")}</select>`;
  return `
  <div class="jornal">
  ${geralSecao==="resumo" ? sparkApresentacaoHtml() : ""}
  <header class="jn-topo">
    <div class="jn-titulos"><span class="jn-edicao">Visão Geral · ${geralRotPeriodo(mes)}</span><h2>${escapeHtml(tituloSecao)}</h2></div>
    <div class="jn-acoes no-print">
      <span class="pill info">dados até ${fmtDate(d.fim)}</span>${histGeralAviso()}
      <div class="tabs" title="Nível do período (clique num mês do ano para descer)">
        <button class="tab ${ctx.ano?"active":""}" type="button" onclick="setGeralModo('ano')">Ano</button>
        <button class="tab ${ctx.ano?"":"active"}" type="button" onclick="setGeralModo('mes')">Ano/Mês</button>
      </div>
      ${seletor}
      <button class="btn btn-ghost btn-sm" type="button" onclick="gerarPdfGeral()" title="Gera o PDF com todas as seções da Visão Geral — escolha Salvar como PDF">Gerar PDF</button>
    </div>
  </header>
  ${geralMenuHtml()}
  <div class="jn-corpo">${corpo}</div>
  </div>`;
}
/* v3.3.2 - Gerar PDF: TODAS as seções da Visão Geral, uma por página */
async function gerarPdfGeral(){
  if(!_kmRedeCache && API_ONLINE){
    toast("Preparando o PDF…");
    try{ _kmRedeCache = await apiGet("/manutencao/km-rede-resumo", 120000); }catch(e){}
  }
  const ctx = geralContexto(), guardaMedias = _mediasUltimo;
  const secs = GERAL_SECOES.map(([k,r])=>`<section class="pg-secao"><h2>${escapeHtml(r)}</h2>${geralCorpoDaSecao(k, ctx, true)}</section>`).join("");
  _mediasUltimo = guardaMedias;
  let el = document.getElementById("printGeral");
  if(!el){ el = document.createElement("div"); el.id = "printGeral"; document.body.appendChild(el); }
  const rot = geralRotPeriodo(ctx.mes);
  el.innerHTML = `<div class="jornal"><h1>SPARK — Visão Geral · ${escapeHtml(rot)}</h1><p class="pg-sub0">Dados até ${fmtDate(ctx.d.fim)} · gerado em ${fmtDate(prodHojeIso())}</p>${secs}</div>`;
  const antes = document.title;
  document.title = "SPARK - Visão Geral " + rot.replace(/[\\/:*?"<>|]/g,"-");
  document.body.classList.add("imprimindo-geral");
  const fim = ()=>{ document.body.classList.remove("imprimindo-geral"); el.innerHTML = ""; document.title = antes; window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  setTimeout(()=>window.print(), 80);
}

/* Carrega e desenha os gráficos de Km de rede da Visão Geral (pedido do
   Mario: "os KM de rede, bt/mt/at por cidade essas coisas pode colocar uns
   gráficos na visão geral") — busca GET /api/manutencao/km-rede-resumo
   (Get-ResumoKmDeRede, manutencao.ps1) depois que a tela já renderizou
   (mesmo padrão de carregarVeraMapa: AFTER_RENDER chama isso, não bloqueia
   o primeiro render da Visão Geral esperando a rede). Gráfico simples
   (barras em HTML/CSS, sem biblioteca externa) — o sistema roda local via
   iniciar.bat, sem depender de internet pra carregar um gráfico. */
async function initVisaoGeral(){
  const elTipo = document.getElementById("kmRedePorTipo");
  const elCidade = document.getElementById("kmRedePorCidade");
  if(!elTipo || !elCidade) return;
  if(!API_ONLINE){
    const msg = `<p class="chart-loading">Controller offline — abra o sistema pelo iniciar.bat pra ver os km de rede de verdade.</p>`;
    elTipo.innerHTML = msg;
    elCidade.innerHTML = msg;
    return;
  }
  try{
    // v2.12.0 — timeout maior (não os 30s padrão do apiGet) só pra esta
    // chamada: Get-ResumoKmDeRede fica em cache depois da primeira vez
    // (ver Clear-KmRedeResumoCache), mas a PRIMEIRA chamada depois de
    // reiniciar o Controller (cache frio) ainda varre MT + BT + AT por
    // inteiro — numa base real grande isso pode passar dos 30s e abortar
    // ("signal is aborted"), mesmo o Controller funcionando normalmente, só
    // devagar nessa primeira vez. O Controller também tenta deixar essa
    // conta pronta sozinho, na subida (ver server.ps1), então isso aqui é
    // mais uma rede de segurança do que o caminho normal.
    const r = await apiGet("/manutencao/km-rede-resumo", 120000);
    _kmRedeCache = r;
    elTipo.innerHTML = renderKmRedePorTipo(r);
    elCidade.innerHTML = renderKmRedePorCidade(r);
  }catch(err){
    const msg = `<p class="chart-loading">Não consegui carregar o km de rede: ${escapeHtml(err.message)}</p>`;
    elTipo.innerHTML = msg;
    elCidade.innerHTML = msg;
  }
}
function barChartHtml(itens){
  // itens: [{rotulo, valor, cor}]. Barra horizontal simples, largura
  // proporcional ao maior valor do conjunto (não ao total — senão o maior
  // item nunca preenche a barra toda).
  const max = Math.max(1, ...itens.map(i=>i.valor));
  return `<div class="bar-chart">${itens.map(i=>`
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(i.rotulo)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,(i.valor/max*100))}%; background:${i.cor}"></div></div>
      <span class="bar-valor">${i.valor.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})} km</span>
    </div>
  `).join("")}</div>`;
}
function renderKmRedePorTipo(r){
  const itens = [
    { rotulo:"Média tensão (MT)", valor:r.porCamadaKm.mt||0, cor:"var(--primary)" },
    { rotulo:"Alta tensão (AT)",  valor:r.porCamadaKm.at||0, cor:"var(--accent)" },
    { rotulo:"Baixa tensão (BT)", valor:r.porCamadaKm.bt||0, cor:"var(--primary-2)" },
  ];
  const aviso = r.btAtIlustrativo
    ? `<p style="font-size:11.5px; color:var(--muted); margin-top:10px;">AT/BT ainda não têm shapefile real importado (dado ilustrativo) — só a MT reflete a rede de verdade por enquanto.</p>`
    : "";
  return barChartHtml(itens) + aviso;
}
function renderKmRedePorCidade(r){
  const porCidade = (r.porCidadeKm||[]).slice(0,10);
  if(porCidade.length===0){
    return `<p class="chart-loading">Sem alimentador cruzado com Polo ainda — importe a Proteção e o Vão (Importação de Bases) pra aparecer aqui.</p>`;
  }
  const itens = porCidade.map(c=>({ rotulo:c.municipio, valor:c.km, cor:"var(--primary)" }));
  const naoIdent = r.naoIdentificadoKm||0;
  const aviso = naoIdent>0
    ? `<p style="font-size:11.5px; color:var(--muted); margin-top:10px;">+ ${naoIdent.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})} km de MT em alimentadores sem Proteção importada ainda (sem município identificado).</p>`
    : "";
  return barChartHtml(itens) + aviso;
}

/* =========================================================================
   VIEW: Mapa de Manutenção
   ========================================================================= */
const statusColor = {
  "Pendente":"#B45309","A reprogramar":"#C2410C","Programada":"#1B4F8C","Despachada":"#6D28D9","Executada":"#1E7A34","Cancelada":"#94A3A6"
};

// camadas ilustrativas de shapefile (coordenadas de exemplo na região dos polos — não são os arquivos reais)
const CAMADA_RESERVA_LEGAL = [[-22.86,-46.90],[-22.83,-46.83],[-22.88,-46.78],[-22.93,-46.85]];
const CAMADA_APP = [[-22.55,-46.10],[-22.58,-46.00],[-22.66,-46.02],[-22.64,-46.13]];
const REDE_AT = [[-22.90,-46.95],[-22.75,-46.60],[-22.60,-46.10],[-22.00,-51.85]];
// REDE_MT_REAL: dados reais extraidos do shapefile SSDMT (BDGD/ANEEL) enviado pelo usuario
// alimentador CTMT 1395624, 881 trechos reais — formato [COD_ID, FAS_CON, TIP_CND, COMP(m), [[lat,lng],...]]
const REDE_MT_REAL = [
["1127808","ABC","1975HOR-3",6.251,[[-22.129279,-51.425412],[-22.129253,-51.425359]]],
["1127809","ABC","1975HOR-3",20.258,[[-22.129156,-51.425558],[-22.129279,-51.425412]]],
["1127810","ABC","1975HOR-3",32.656,[[-22.129279,-51.425412],[-22.129447,-51.425152]]],
["1127839","ABC","16512332HOR-3",24.417,[[-22.131744,-51.429988],[-22.131536,-51.430065]]],
["1127840","ABC","16512332HOR-3",8.697,[[-22.131536,-51.430065],[-22.131462,-51.430094]]],
["1127841","ABC","16512332HOR-3",9.843,[[-22.131536,-51.430065],[-22.131573,-51.430152]]],
["69262220","ABC","16512332HOR-3",15.408,[[-22.136926,-51.414151],[-22.136828,-51.414045]]],
["1592504","ABC","626986COM-3",40.78,[[-22.140123,-51.408969],[-22.140363,-51.408646]]],
["1143052","ABC","16512375HOR-3",58.827,[[-22.132911,-51.435408],[-22.132711,-51.434879]]],
["1143053","ABC","16512332HOR-3",30.713,[[-22.132911,-51.435408],[-22.133188,-51.4354]]],
["1143054","ABC","16512332HOR-3",49.114,[[-22.133188,-51.4354],[-22.13363,-51.43536]]],
["1143055","ABC","16512332HOR-3P",2.701,[[-22.13363,-51.43536],[-22.133668,-51.435323]]],
["1143145","ABC","1975HOR-3",31.25,[[-22.139844,-51.409433],[-22.140006,-51.409185]]],
["1143152","ABC","1975HOR-3",14.345,[[-22.129006,-51.424661],[-22.128884,-51.424706]]],
["1143153","ABC","1975HOR-3",3.731,[[-22.128884,-51.424706],[-22.128852,-51.424719]]],
["1143349","ABC","16512381HOR-3",30.495,[[-22.120353,-51.424917],[-22.120078,-51.424942]]],
["1143350","ABC","16512381HOR-3",31.922,[[-22.120078,-51.424942],[-22.119791,-51.424968]]],
["1143351","ABC","16512381HOR-3",40.97,[[-22.119791,-51.424968],[-22.119422,-51.425001]]],
["1143358","ABC","1975HOR-3",48.07,[[-22.121313,-51.421207],[-22.121407,-51.42168]]],
["1143362","ABC","1975HOR-3",34.642,[[-22.135254,-51.425699],[-22.135433,-51.425423]]],
["1143363","ABC","1975HOR-3",34.349,[[-22.135079,-51.425974],[-22.135254,-51.425699]]],
["1143364","ABC","16512380HOR-3",26.178,[[-22.118642,-51.424991],[-22.118409,-51.424947]]],
["1143365","ABC","16512380HOR-3",25.74,[[-22.118143,-51.424822],[-22.117934,-51.424713]]],
["1143366","ABC","16512380HOR-3",23.316,[[-22.117653,-51.424499],[-22.11748,-51.424369]]],
["1143367","ABC","1975HOR-3",17.463,[[-22.134453,-51.432798],[-22.134547,-51.432662]]],
["1143075","ABC","1975HOR-3",29.368,[[-22.116588,-51.423671],[-22.116549,-51.423389]]],
["1143368","ABC","1975HOR-3",35.258,[[-22.134547,-51.432662],[-22.134736,-51.432387]]],
["1143369","ABC","1975HOR-3",29.547,[[-22.134478,-51.431923],[-22.134634,-51.43169]]],
["1143374","ABC","16512381HOR-3",30.561,[[-22.125914,-51.426254],[-22.126088,-51.426484]]],
["1143375","ABC","16512381HOR-3",18.069,[[-22.126088,-51.426484],[-22.126191,-51.42662]]],
["1143377","ABC","16512381HOR-3",84.111,[[-22.125013,-51.424981],[-22.125457,-51.425656]]],
["1143390","ABC","16512332HOR-3P",69.856,[[-22.138897,-51.414313],[-22.139354,-51.414781]]],
["1143005","ABC","16512332HOR-3",38.19,[[-22.133616,-51.428428],[-22.133817,-51.428128]]],
["1143007","ABC","1975HOR-3",32.735,[[-22.135618,-51.425133],[-22.135785,-51.424872]]],
["1143011","ABC","1975HOR-3",28.583,[[-22.133357,-51.429085],[-22.133565,-51.42925]]],
["1143315","ABC","1975HOR-3",32.703,[[-22.123041,-51.425121],[-22.123064,-51.425437]]],
["1143329","ABC","1994COM-3",40.858,[[-22.138858,-51.412274],[-22.139073,-51.411952]]],
["1143422","ABC","16512332HOR-3",33.549,[[-22.131147,-51.428858],[-22.131053,-51.428548]]],
["1143423","ABC","1975HOR-3",34.89,[[-22.12912,-51.424976],[-22.129006,-51.424661]]],
["1143424","ABC","16512332HOR-3",33.67,[[-22.132032,-51.429881],[-22.131744,-51.429988]]],
["1143425","ABC","16512375HOR-3",44.86,[[-22.130864,-51.424329],[-22.131096,-51.423972]]],
["1143330","ABC","1994COM-3",37.685,[[-22.139073,-51.411952],[-22.139271,-51.411655]]],
["1143331","ABC","1994COM-3",22.111,[[-22.139271,-51.411655],[-22.139388,-51.411481]]],
["1143332","ABC","1994COM-3",38.199,[[-22.139388,-51.411481],[-22.139589,-51.41118]]],
["1143120","ABC","16512332HOR-3",32.463,[[-22.132179,-51.430331],[-22.132006,-51.430585]]],
["1143121","ABC","16512332HOR-3",31.916,[[-22.132217,-51.430241],[-22.13213,-51.429946]]],
["1143127","ABC","16512375HOR-3",27.353,[[-22.131254,-51.423731],[-22.131398,-51.423515]]],
["1143128","ABC","1975HOR-3",22.651,[[-22.13161,-51.423447],[-22.131748,-51.423556]]],
["1143129","ABC","1975HOR-3",46.887,[[-22.131748,-51.423556],[-22.132099,-51.423812]]],
["1143426","ABC","1975HOR-3P",7.698,[[-22.131096,-51.423972],[-22.131164,-51.423991]]],
["1143333","ABC","1994COM-3",26.487,[[-22.139589,-51.41118],[-22.139729,-51.410971]]],
["1143334","ABC","1994COM-3",32.72,[[-22.139729,-51.410971],[-22.139901,-51.410713]]],
["1143335","ABC","1975HOR-3",8.01,[[-22.139729,-51.410971],[-22.139769,-51.411036]]],
["1143336","ABC","1994COM-3",41.051,[[-22.139901,-51.410713],[-22.140117,-51.41039]]],
["1143344","ABC","1975HOR-3",25.706,[[-22.134317,-51.433],[-22.134453,-51.432798]]],
["1143347","ABC","16512381HOR-3",27.313,[[-22.120932,-51.424865],[-22.120686,-51.424887]]],
["1143348","ABC","16512381HOR-3",37.038,[[-22.120686,-51.424887],[-22.120353,-51.424917]]],
["1143434","ABC","1975HOR-3",26.107,[[-22.132099,-51.423812],[-22.132291,-51.423958]]],
["1143435","ABC","1975HOR-3",24.027,[[-22.132291,-51.423958],[-22.132468,-51.424093]]],
["1143440","ABC","16512375HOR-3",35.508,[[-22.135635,-51.417131],[-22.13582,-51.416849]]],
["1143441","ABC","1975HOR-3",6.505,[[-22.135635,-51.417131],[-22.135648,-51.417192]]],
["1143442","ABC","16512375HOR-3",21.631,[[-22.126982,-51.426495],[-22.126801,-51.426415]]],
["1143272","ABC","1975HOR-3",36.139,[[-22.138709,-51.416855],[-22.138383,-51.416838]]],
["1143277","ABC","16512375HOR-3",32.556,[[-22.128994,-51.427925],[-22.128981,-51.42761]]],
["1143279","ABC","16512375HOR-3",34.043,[[-22.128981,-51.42761],[-22.129007,-51.427281]]],
["1143281","ABC","16512375HOR-3",33.091,[[-22.129007,-51.427281],[-22.129123,-51.426985]]],
["1143282","ABC","16512332HOR-3",10.389,[[-22.128981,-51.42761],[-22.129066,-51.427566]]],
["1143283","ABC","16512332HOR-3",28.419,[[-22.130689,-51.432151],[-22.13089,-51.431979]]],
["1142282","ABC","16512381HOR-3",31.705,[[-22.121066,-51.424711],[-22.121038,-51.424405]]],
["1142283","ABC","16512381HOR-3",34.107,[[-22.121038,-51.424405],[-22.121008,-51.424076]]],
["1143184","ABC","16512375HOR-3",38.052,[[-22.129851,-51.430914],[-22.129667,-51.430602]]],
["1143186","ABC","16512375HOR-3",29.964,[[-22.129667,-51.430602],[-22.129532,-51.430351]]],
["1142987","ABC","16512375HOR-3",55.201,[[-22.131306,-51.43297],[-22.130993,-51.432553]]],
["1137793","ABC","16512375HOR-3",31.948,[[-22.134246,-51.419243],[-22.134412,-51.41899]]],
["1142989","ABC","16512375HOR-3",53.446,[[-22.130993,-51.432553],[-22.130689,-51.432151]]],
["1142993","ABC","16512375HOR-3",36.32,[[-22.129532,-51.430351],[-22.129358,-51.430052]]],
["1142996","ABC","16512375HOR-3",24.579,[[-22.129358,-51.430052],[-22.12924,-51.42985]]],
["1142999","ABC","16512375HOR-3",33.532,[[-22.12924,-51.42985],[-22.129152,-51.429539]]],
["1142291","ABC","1975HOR-3",39.07,[[-22.116069,-51.423916],[-22.115721,-51.423982]]],
["1142292","ABC","1975HOR-3",11.232,[[-22.115027,-51.424115],[-22.114894,-51.424142]]],
["1142293","ABC","1975HOR-3",21.389,[[-22.115455,-51.424034],[-22.115231,-51.424075]]],
["1142294","ABC","1975HOR-3",22.902,[[-22.115231,-51.424075],[-22.115027,-51.424115]]],
["1142295","ABC","1975HOR-3",62.521,[[-22.133569,-51.419042],[-22.133199,-51.4195]]],
["1142296","ABC","1975HOR-3",12.986,[[-22.116625,-51.42381],[-22.116588,-51.423671]]],
["1142297","ABC","1975HOR-3",29.848,[[-22.116625,-51.42381],[-22.116326,-51.423866]]],
["1142383","ABC","16512332HOR-3",32.566,[[-22.132029,-51.429628],[-22.131935,-51.429329]]],
["1142395","ABC","1975HOR-3",33.967,[[-22.117369,-51.425297],[-22.117196,-51.425569]]],
["1142396","ABC","1975HOR-3",33.903,[[-22.117543,-51.425027],[-22.117369,-51.425297]]],
["1142397","ABC","1975HOR-3",35.119,[[-22.117721,-51.424745],[-22.117543,-51.425027]]],
["1142398","ABC","1975HOR-3",33.477,[[-22.11791,-51.42445],[-22.11808,-51.424181]]],
["1142402","ABC","1975HOR-3",35.815,[[-22.116047,-51.423357],[-22.115996,-51.423014]]],
["1143195","ABC","16512375HOR-3",16.551,[[-22.137838,-51.413798],[-22.137926,-51.413667]]],
["1143196","ABC","16512375HOR-3",26.48,[[-22.137926,-51.413667],[-22.138065,-51.413459]]],
["1143197","ABC","1994COM-3",20.43,[[-22.138427,-51.412918],[-22.138533,-51.412757]]],
["1143198","ABC","16512375HOR-3",66.065,[[-22.138427,-51.412918],[-22.137942,-51.412544]]],
["1142206","ABC","1995COM-3",24.583,[[-22.137528,-51.420148],[-22.137448,-51.42037]]],
["1142207","ABC","1995COM-3",21.766,[[-22.137448,-51.42037],[-22.137393,-51.420573]]],
["1142210","ABC","1975HOR-3",29.368,[[-22.133312,-51.433467],[-22.133543,-51.433316]]],
["1137100","ABC","1975HOR-3",35.191,[[-22.132237,-51.432578],[-22.132433,-51.43231]]],
["1137101","ABC","1975HOR-3",17.86,[[-22.132674,-51.431982],[-22.132773,-51.431846]]],
["1137102","ABC","1975HOR-3",38.206,[[-22.132773,-51.431846],[-22.132987,-51.431555]]],
["1137112","ABC","16512381HOR-3",20.932,[[-22.119165,-51.425012],[-22.118976,-51.425021]]],
["1143200","ABC","16512375HOR-3",40.549,[[-22.12504,-51.42412],[-22.124823,-51.423803]]],
["1143201","ABC","1975HOR-3",33.873,[[-22.128319,-51.42275],[-22.128211,-51.422443]]],
["1143202","ABC","1975HOR-3",37.792,[[-22.128442,-51.423091],[-22.128319,-51.42275]]],
["1143205","ABC","16512375HOR-3",67.273,[[-22.132993,-51.421139],[-22.133348,-51.420609]]],
["1143206","ABC","16512375HOR-3",68.552,[[-22.133348,-51.420609],[-22.133706,-51.420067]]],
["1143207","ABC","16512375HOR-3",32.382,[[-22.133706,-51.420067],[-22.133892,-51.419781]]],
["1143208","ABC","1975HOR-3",28.928,[[-22.134249,-51.418001],[-22.134099,-51.418231]]],
["1143209","ABC","1975HOR-3",38.325,[[-22.134099,-51.418231],[-22.1339,-51.418535]]],
["1142403","ABC","1975HOR-3",33.646,[[-22.116095,-51.423679],[-22.116047,-51.423357]]],
["1142917","ABC","16512332HOR-3",10.583,[[-22.133665,-51.428098],[-22.133579,-51.428055]]],
["1142918","ABC","1975HOR-3",30.89,[[-22.137274,-51.425376],[-22.137438,-51.425133]]],
["1142919","ABC","1975HOR-3",26.269,[[-22.137135,-51.425582],[-22.137274,-51.425376]]],
["1142222","ABC","1975HOR-3",34.969,[[-22.1319,-51.433716],[-22.132217,-51.433604]]],
["1142223","ABC","16512375HOR-3",47.27,[[-22.1319,-51.433716],[-22.13159,-51.433363]]],
["1142225","ABC","1975HOR-3",42.117,[[-22.129253,-51.425359],[-22.12912,-51.424976]]],
["1137230","ABC","1975HOR-3",14.143,[[-22.128814,-51.424126],[-22.128767,-51.423998]]],
["1137231","ABC","1975HOR-3",24.361,[[-22.128767,-51.423998],[-22.128689,-51.423777]]],
["1137232","ABC","1975HOR-3",37.832,[[-22.128767,-51.423998],[-22.128502,-51.42423]]],
["1137233","ABC","1975HOR-3",10.493,[[-22.128767,-51.423998],[-22.128842,-51.423935]]],
["1143216","ABC","1975HOR-3",31.604,[[-22.140136,-51.413548],[-22.140341,-51.413762]]],
["1143217","ABC","1975HOR-3",15.246,[[-22.141151,-51.41461],[-22.141259,-51.414703]]],
["1143218","ABC","1975HOR-3",30.983,[[-22.139769,-51.411036],[-22.139975,-51.411239]]],
["1143219","ABC","1975HOR-3",35.891,[[-22.139975,-51.411239],[-22.140244,-51.411491]]],
["1137842","ABC","1975HOR-3",34.083,[[-22.129942,-51.424442],[-22.13012,-51.424172]]],
["1137843","ABC","1975HOR-3",31.203,[[-22.12978,-51.424689],[-22.129942,-51.424442]]],
["1137844","ABC","1975HOR-3",31.382,[[-22.129447,-51.425152],[-22.129621,-51.424911]]],
["1137846","ABC","1975HOR-3",31.031,[[-22.135405,-51.41623],[-22.135244,-51.416477]]],
["1142422","ABC","1975HOR-3",29.703,[[-22.133728,-51.425051],[-22.133946,-51.425217]]],
["1142423","ABC","1975HOR-3",23.036,[[-22.133946,-51.425217],[-22.134116,-51.425347]]],
["1142424","ABC","1975HOR-3",28.992,[[-22.134116,-51.425347],[-22.13433,-51.425509]]],
["1142425","ABC","1975HOR-3",33.141,[[-22.134528,-51.42566],[-22.134772,-51.425846]]],
["1142248","ABC","1995COM-3",32.1,[[-22.137393,-51.420573],[-22.137392,-51.420884]]],
["1142439","ABC","16512332HOR-3",40.01,[[-22.131935,-51.429329],[-22.131819,-51.428962]]],
["1137234","ABC","1975HOR-3",18.852,[[-22.137367,-51.412099],[-22.13727,-51.412249]]],
["1137235","ABC","1975HOR-3",21.176,[[-22.137367,-51.412099],[-22.137474,-51.411929]]],
["1137236","ABC","16512375COM-3",9.963,[[-22.13744,-51.412155],[-22.137367,-51.412099]]],
["1137237","ABC","16512375COM-3",20.093,[[-22.137367,-51.412099],[-22.13722,-51.411984]]],
["1137248","ABC","1975HOR-3",28.082,[[-22.132976,-51.419838],[-22.13283,-51.42006]]],
["1137249","ABC","1975HOR-3",65.755,[[-22.131756,-51.42169],[-22.132099,-51.421169]]],
["1142249","ABC","1975HOR-3",28.783,[[-22.136733,-51.417846],[-22.136993,-51.417865]]],
["1142250","ABC","1975HOR-3",31.028,[[-22.136993,-51.417865],[-22.137272,-51.417886]]],
["1142344","ABC","16512375HOR-3",29.941,[[-22.13582,-51.416849],[-22.135975,-51.416611]]],
["1142345","ABC","16512376HOR-3",35.007,[[-22.135975,-51.416611],[-22.136159,-51.416335]]],
["1142346","ABC","16512375HOR-3",32.585,[[-22.136159,-51.416335],[-22.136328,-51.416076]]],
["1142347","ABC","16512375HOR-3",37.257,[[-22.136328,-51.416076],[-22.136521,-51.415781]]],
["1142348","ABC","16512375HOR-3",28.368,[[-22.136521,-51.415781],[-22.136669,-51.415556]]],
["1142349","ABC","16512375HOR-3",38.9,[[-22.136669,-51.415556],[-22.136872,-51.415248]]],
["1142951","ABC","16512332HOR-3",37.676,[[-22.131352,-51.429532],[-22.131246,-51.429185]]],
["1142952","ABC","16512332HOR-3",38.267,[[-22.13146,-51.429885],[-22.131352,-51.429532]]],
["1142252","ABC","1975HOR-3",31.116,[[-22.118827,-51.42509],[-22.118658,-51.425332]]],
["1142253","ABC","1975HOR-3",32.808,[[-22.119017,-51.424812],[-22.119195,-51.424557]]],
["1142254","ABC","1975HOR-3",45.121,[[-22.119482,-51.424142],[-22.119725,-51.42379]]],
["1142257","ABC","1975HOR-3",36.523,[[-22.119725,-51.42379],[-22.119921,-51.423506]]],
["1142258","ABC","1975HOR-3",23.513,[[-22.119921,-51.423506],[-22.120048,-51.423323]]],
["1142350","ABC","16512375HOR-3",37.128,[[-22.136872,-51.415248],[-22.137065,-51.414953]]],
["1142355","ABC","1975HOR-3",32.925,[[-22.128548,-51.42339],[-22.128442,-51.423091]]],
["1143154","ABC","1995COM-3",29.895,[[-22.128733,-51.424748],[-22.128569,-51.424978]]],
["1143155","ABC","16512332HOR-3",8.491,[[-22.12978,-51.424689],[-22.129707,-51.424715]]],
["1143156","ABC","1975HOR-3",28.889,[[-22.129621,-51.424911],[-22.12978,-51.424689]]],
["1142953","ABC","1975HOR-3",23.47,[[-22.127906,-51.424745],[-22.127741,-51.424888]]],
["1142957","ABC","1975HOR-3",24.385,[[-22.127906,-51.424745],[-22.127757,-51.424548]]],
["1143253","ABC","16512375HOR-3",33.674,[[-22.137687,-51.412346],[-22.13744,-51.412155]]],
["1143256","ABC","16512375HOR-3",22.786,[[-22.129024,-51.428573],[-22.129014,-51.428352]]],
["1143258","ABC","16512375HOR-3",44.114,[[-22.129014,-51.428352],[-22.128994,-51.427925]]],
["1143267","ABC","1975HOR-3",8.012,[[-22.13159,-51.433363],[-22.131648,-51.433317]]],
["1137782","ABC","1975HOR-3",26.738,[[-22.135587,-51.415952],[-22.135725,-51.415739]]],
["1137787","ABC","16512375HOR-3",34.758,[[-22.132252,-51.422242],[-22.132435,-51.421969]]],
["1137788","ABC","16512332HOR-3P",8.132,[[-22.132252,-51.422242],[-22.132307,-51.422294]]],
["1137789","ABC","16512375HOR-3",33.385,[[-22.132435,-51.421969],[-22.132611,-51.421706]]],
["1137790","ABC","16512375HOR-3",34.24,[[-22.132611,-51.421706],[-22.132792,-51.421437]]],
["1137791","ABC","16512375HOR-3",39.853,[[-22.133892,-51.419781],[-22.1341,-51.419466]]],
["1137792","ABC","16512375HOR-3",28.062,[[-22.1341,-51.419466],[-22.134246,-51.419243]]],
["1143810","ABC","1975HOR-3",36.778,[[-22.1346,-51.417462],[-22.13441,-51.417754]]],
["1143811","ABC","1975HOR-3",31.07,[[-22.13441,-51.417754],[-22.134249,-51.418001]]],
["1584377","ABC","1994COM-3",34.536,[[-22.135704,-51.411214],[-22.135415,-51.411041]]],
["1585016","ABC","626986COM-3",33.003,[[-22.133665,-51.409926],[-22.133946,-51.410095]]],
["1544830","ABC","1994COM-3",38.735,[[-22.131264,-51.408862],[-22.13096,-51.408676]]],
["1530970","ABC","1994COM-3",30.973,[[-22.133988,-51.447102],[-22.133707,-51.446956]]],
["1190347","ABC","16512332HOR-3",82.973,[[-22.134749,-51.411348],[-22.134852,-51.412145]]],
["1190348","ABC","16512332HOR-3",39.229,[[-22.134852,-51.412145],[-22.135003,-51.412489]]],
["1190690","ABC","1994COM-3",29.91,[[-22.132495,-51.409604],[-22.132259,-51.409462]]],
["1190691","ABC","1975HOR-3",11.526,[[-22.132495,-51.409604],[-22.132498,-51.409716]]],
["1190692","ABC","1994COM-3",33.559,[[-22.132759,-51.409764],[-22.132495,-51.409604]]],
["1190693","ABC","1994COM-3",15.804,[[-22.132883,-51.409839],[-22.132759,-51.409764]]],
["1190694","ABC","1994COM-3",15.618,[[-22.133028,-51.409927],[-22.132883,-51.409839]]],
["1189691","ABC","1975HOR-3",36.932,[[-22.134133,-51.410915],[-22.13442,-51.411097]]],
["1189692","ABC","1975HOR-3",23.499,[[-22.13442,-51.411097],[-22.134604,-51.411212]]],
["1189693","ABC","1975HOR-3",17.789,[[-22.134604,-51.411212],[-22.134749,-51.411348]]],
["1493002","ABC","1975HOR-3",8.372,[[-22.125773,-51.425099],[-22.125819,-51.425035]]],
["1557146","ABC","1994COM-3",30.183,[[-22.136257,-51.411238],[-22.136006,-51.411044]]],
["1560637","ABC","16512375HOR-3",7.009,[[-22.125548,-51.424799],[-22.125511,-51.424744]]],
["1560638","ABC","16512375HOR-3",26.246,[[-22.125511,-51.424744],[-22.12536,-51.424548]]],
["1560639","ABC","16512381HOR-3",62.153,[[-22.125548,-51.424799],[-22.125013,-51.424981]]],
["1597223","ABC","626986COM-3",26.317,[[-22.132553,-51.419587],[-22.132295,-51.419579]]],
["1597224","ABC","626986COM-3",18.25,[[-22.132295,-51.419579],[-22.132131,-51.419578]]],
["1597225","ABC","626986COM-3",25.677,[[-22.132131,-51.419578],[-22.132079,-51.419336]]],
["1597226","ABC","626986COM-3",29.666,[[-22.132079,-51.419336],[-22.132071,-51.419048]]],
["45933270","ABC","626986COM-3",31.701,[[-22.141458,-51.409252],[-22.141662,-51.409467]]],
["45933280","ABC","626986COM-3",17.576,[[-22.141183,-51.408906],[-22.141283,-51.409065]]],
["45933281","ABC","626986COM-3",27.337,[[-22.141283,-51.409065],[-22.141458,-51.409252]]],
["44154794","ABC","16512352MUL-3",10.577,[[-22.128684,-51.424248],[-22.128666,-51.424147]]],
["1581043","ABC","1975COM-3",30.082,[[-22.133983,-51.410498],[-22.133841,-51.410747]]],
["50828357","ABC","626986COM-3",9.332,[[-22.123745,-51.423371],[-22.123696,-51.423445]]],
["1135418","ABC","1975HOR-3",17.151,[[-22.135785,-51.424872],[-22.135872,-51.424734]]],
["1135419","ABC","1975HOR-3",11.954,[[-22.135872,-51.424734],[-22.135934,-51.424639]]],
["1135420","ABC","1975HOR-3",21.135,[[-22.135872,-51.424734],[-22.136022,-51.424861]]],
["1135421","ABC","1975HOR-3",9.826,[[-22.135872,-51.424734],[-22.135802,-51.424675]]],
["1136411","ABC","1975HOR-3",10.212,[[-22.137082,-51.425663],[-22.137135,-51.425582]]],
["1136412","ABC","1975HOR-3",19.871,[[-22.137082,-51.425663],[-22.136975,-51.425818]]],
["1136413","ABC","1975HOR-3",9.886,[[-22.137009,-51.425607],[-22.137082,-51.425663]]],
["1136414","ABC","1975HOR-3",21.246,[[-22.137082,-51.425663],[-22.137238,-51.425782]]],
["1137064","ABC","16512375HOR-3",51.234,[[-22.13159,-51.433363],[-22.131306,-51.43297]]],
["1137067","ABC","16512332HOR-3",37.87,[[-22.132772,-51.429461],[-22.132974,-51.429165]]],
["1137068","ABC","16512332HOR-3",30.382,[[-22.132974,-51.429165],[-22.133146,-51.428935]]],
["1137069","ABC","1975HOR-3",26.097,[[-22.133146,-51.428935],[-22.133357,-51.429085]]],
["1137070","ABC","16512332HOR-3",29.349,[[-22.133146,-51.428935],[-22.133383,-51.428744]]],
["1137071","ABC","16512332HOR-3",41.518,[[-22.133383,-51.428744],[-22.133616,-51.428428]]],
["1135627","ABC","1975HOR-3",10.655,[[-22.119327,-51.425006],[-22.119336,-51.425109]]],
["1135628","ABC","1975HOR-3",7.405,[[-22.119327,-51.425006],[-22.119319,-51.424935]]],
["1135629","ABC","16512381HOR-3",10.524,[[-22.119422,-51.425001],[-22.119327,-51.425006]]],
["1135630","ABC","16512381HOR-3",17.933,[[-22.119327,-51.425006],[-22.119165,-51.425012]]],
["1538184","ABC","626986COM-3",16.097,[[-22.139544,-51.4169],[-22.139452,-51.417031]]],
["1538185","ABC","626986COM-3",29.107,[[-22.139452,-51.417031],[-22.139277,-51.417242]]],
["1538186","ABC","626986COM-3",17.447,[[-22.139277,-51.417242],[-22.139241,-51.417407]]],
["1538187","ABC","626986COM-3",29.661,[[-22.138959,-51.417398],[-22.138692,-51.417375]]],
["1538188","ABC","626986COM-3",30.09,[[-22.138692,-51.417375],[-22.138421,-51.41735]]],
["60167675","ABC","16512375HOR-3",5.976,[[-22.128463,-51.426988],[-22.128438,-51.426937]]],
["1515012","ABC","1994COM-3",28.501,[[-22.133988,-51.442963],[-22.134089,-51.442709]]],
["1515013","ABC","1994COM-3",30.467,[[-22.133879,-51.443234],[-22.133988,-51.442963]]],
["1525141","ABC","1994COM-3",34.662,[[-22.13459,-51.441406],[-22.134604,-51.44107]]],
["1554221","ABC","626986COM-3",29.322,[[-22.139241,-51.417407],[-22.138959,-51.417398]]],
["1549075","ABC","1994COM-3",38.254,[[-22.136734,-51.411607],[-22.136453,-51.41139]]],
["1552773","ABC","626986COM-3",26.441,[[-22.133181,-51.409628],[-22.133323,-51.40938]]],
["1552774","ABC","1995COM-3",30.382,[[-22.133323,-51.40938],[-22.133091,-51.409203]]],
["1552775","ABC","1994COM-3",4.274,[[-22.133169,-51.409668],[-22.133181,-51.409628]]],
["1552756","ABC","1975HOR-3",29.125,[[-22.135092,-51.416711],[-22.134891,-51.416894]]],
["1552757","ABC","1975HOR-3",23.622,[[-22.134891,-51.416894],[-22.134761,-51.417121]]],
["1552758","ABC","626986COM-3",36.847,[[-22.134218,-51.415952],[-22.134092,-51.415621]]],
["1552759","ABC","626986COM-3",37.202,[[-22.134341,-51.416288],[-22.134218,-51.415952]]],
["1552760","ABC","626986COM-3",37.199,[[-22.134473,-51.41662],[-22.134341,-51.416288]]],
["1552761","ABC","626986COM-3",26.213,[[-22.134876,-51.416893],[-22.134666,-51.416777]]],
["1552762","ABC","626986COM-3",26.848,[[-22.134666,-51.416777],[-22.134473,-51.41662]]],
["1542887","ABC","626986COM-3",16.767,[[-22.130761,-51.424506],[-22.130924,-51.424491]]],
["1525139","ABC","1994COM-3",36.019,[[-22.133034,-51.445521],[-22.133097,-51.445178]]],
["24139476","ABC","16512346MUL-3P",4.591,[[-22.130067,-51.424088],[-22.130041,-51.424054]]],
["34288072","ABC","1975HOR-3",33.095,[[-22.133978,-51.433379],[-22.134168,-51.433132]]],
["34288081","ABC","1975HOR-3",25.002,[[-22.133735,-51.433712],[-22.1336,-51.433906]]],
["34288089","ABC","1975HOR-3",25.382,[[-22.133873,-51.433514],[-22.133735,-51.433712]]],
["34288126","ABC","1975HOR-3",18.336,[[-22.133796,-51.433403],[-22.133978,-51.433379]]],
["34288133","ABC","1975HOR-3",18.199,[[-22.133978,-51.433379],[-22.133873,-51.433514]]],
["1555235","ABC","1975HOR-3",21.759,[[-22.133938,-51.410791],[-22.134133,-51.410915]]],
["1555236","ABC","16512375COM-3",26.156,[[-22.13722,-51.411984],[-22.137029,-51.411836]]],
["1540999","ABC","16512332HOR-3",33.752,[[-22.132325,-51.430573],[-22.132222,-51.430265]]],
["1538370","ABC","626986COM-3",42.626,[[-22.140523,-51.417241],[-22.140899,-51.417332]]],
["1168449","ABC","1994COM-3",24.249,[[-22.133099,-51.410261],[-22.13291,-51.410142]]],
["1168450","ABC","1994COM-3",7.617,[[-22.13291,-51.410142],[-22.132851,-51.410104]]],
["1579404","ABC","16512375HOR-3",47.382,[[-22.140877,-51.409253],[-22.141183,-51.408906]]],
["1534520","ABC","16512375HOR-3",11.233,[[-22.130707,-51.424598],[-22.130761,-51.424506]]],
["1534842","ABC","1995COM-3",32.262,[[-22.13844,-51.417973],[-22.138731,-51.417994]]],
["1534843","ABC","1995COM-3",30.27,[[-22.139457,-51.41876],[-22.139491,-51.419051]]],
["1534844","ABC","1995COM-3",32.548,[[-22.138147,-51.417951],[-22.13844,-51.417973]]],
["1519141","ABC","16512375HOR-3",27.848,[[-22.126637,-51.42625],[-22.126479,-51.42604]]],
["1541224","ABC","1995COM-3",36.66,[[-22.139632,-51.419014],[-22.139963,-51.419006]]],
["1541225","ABC","16512332COM-3",33.403,[[-22.140416,-51.418995],[-22.140717,-51.419015]]],
["1446275","ABC","16512381HOR-3",64.769,[[-22.124566,-51.424501],[-22.124204,-51.424008]]],
["1446276","ABC","16512381HOR-3",70.804,[[-22.125013,-51.424981],[-22.124566,-51.424501]]],
["1446278","ABC","16512381HOR-3",8.241,[[-22.124566,-51.424501],[-22.124492,-51.4245]]],
["1446279","ABC","16512381HOR-3",13.029,[[-22.124492,-51.4245],[-22.12438,-51.42454]]],
["1446280","ABC","16512381HOR-3",3.485,[[-22.124492,-51.4245],[-22.124502,-51.424531]]],
["1446281","ABC","16512381HOR-3",29.158,[[-22.124492,-51.4245],[-22.124309,-51.424296]]],
["1530977","ABC","1994COM-3",23.986,[[-22.13378,-51.44348],[-22.133879,-51.443234]]],
["1446923","ABC","1994COM-3",30.889,[[-22.134617,-51.44037],[-22.134515,-51.440091]]],
["1446924","ABC","1994COM-3",37.936,[[-22.134083,-51.438917],[-22.133956,-51.438575]]],
["1446925","ABC","1994COM-3",33.096,[[-22.134299,-51.439503],[-22.134189,-51.439205]]],
["24088777","ABC","16512346MUL-3P",4.44,[[-22.139088,-51.413565],[-22.139054,-51.413543]]],
["1127766","ABC","16512332HOR-3",22.849,[[-22.1321,-51.429854],[-22.132295,-51.429783]]],
["1127767","ABC","16512332HOR-3",8.071,[[-22.1321,-51.429854],[-22.132032,-51.429881]]],
["1127768","ABC","1975HOR-3",9.563,[[-22.13448,-51.41889],[-22.13455,-51.418944]]],
["1127769","ABC","1975HOR-3",12.863,[[-22.13448,-51.41889],[-22.134385,-51.418818]]],
["1127770","ABC","16512375HOR-3",12.686,[[-22.134412,-51.41899],[-22.13448,-51.41889]]],
["1127771","ABC","16512375HOR-3",24.797,[[-22.13448,-51.41889],[-22.134608,-51.418694]]],
["1127792","ABC","1975HOR-3",17.877,[[-22.133096,-51.431405],[-22.133195,-51.431268]]],
["1127793","ABC","1975HOR-3",27.09,[[-22.133195,-51.431268],[-22.133347,-51.431063]]],
["1127794","ABC","16512332HOR-3",5.824,[[-22.133195,-51.431268],[-22.133237,-51.431302]]],
["1127795","ABC","16512332HOR-3",13.722,[[-22.133195,-51.431268],[-22.133095,-51.431189]]],
["1127842","ABC","16512332HOR-3",20.429,[[-22.131536,-51.430065],[-22.13146,-51.429885]]],
["1127867","ABC","1975HOR-3",8.809,[[-22.135034,-51.426045],[-22.135079,-51.425974]]],
["1127868","ABC","1975HOR-3",23.796,[[-22.135034,-51.426045],[-22.134911,-51.426234]]],
["1127869","ABC","1975HOR-3",11.409,[[-22.13495,-51.425981],[-22.135034,-51.426045]]],
["1127870","ABC","1975HOR-3",19.8,[[-22.135034,-51.426045],[-22.135181,-51.426156]]],
["1127741","ABC","16512332HOR-3",9.997,[[-22.13213,-51.429946],[-22.1321,-51.429854]]],
["1127742","ABC","16512332HOR-3",24.562,[[-22.1321,-51.429854],[-22.132029,-51.429628]]],
["23735594","ABC","16512352MUL-3P",1.166,[[-22.141613,-51.408358],[-22.141607,-51.408349]]],
["23566077","ABC","16512352MUL-3P",17.867,[[-22.135737,-51.414577],[-22.1356,-51.414485]]],
["1584713","ABC","626986COM-3",16.279,[[-22.135089,-51.434036],[-22.134947,-51.434112]]],
["1584714","ABC","626986COM-3",35.525,[[-22.134947,-51.434112],[-22.134627,-51.434141]]],
["1584715","ABC","626986COM-3",33.97,[[-22.13511,-51.433707],[-22.135089,-51.434036]]],
["1584716","ABC","626986COM-3",8.118,[[-22.13511,-51.433707],[-22.135007,-51.433747]]],
["1584717","ABC","626986COM-3",16.561,[[-22.135109,-51.433243],[-22.135129,-51.433402]]],
["1584718","ABC","626986COM-3",31.535,[[-22.135129,-51.433402],[-22.13511,-51.433707]]],
["1589530","ABC","1975HOR-3",26.849,[[-22.13433,-51.425509],[-22.134528,-51.42566]]],
["1144011","ABC","16512375HOR-3",42.344,[[-22.132349,-51.434238],[-22.132089,-51.433937]]],
["1144013","ABC","16512375HOR-3",32.521,[[-22.132493,-51.434513],[-22.132349,-51.434238]]],
["1144118","ABC","1975HOR-3",29.453,[[-22.138975,-51.416869],[-22.138709,-51.416855]]],
["1143895","ABC","16512375HOR-3",30.457,[[-22.131096,-51.423972],[-22.131254,-51.423731]]],
["1143812","ABC","1975HOR-3",30.906,[[-22.1339,-51.418535],[-22.13374,-51.418781]]],
["1143813","ABC","16512332HOR-3",35.152,[[-22.132014,-51.43259],[-22.131898,-51.432273]]],
["1143814","ABC","16512332HOR-3",15.406,[[-22.138897,-51.414313],[-22.138803,-51.414422]]],
["1143815","ABC","1995COM-3P",25.829,[[-22.139355,-51.414796],[-22.139403,-51.415041]]],
["1143816","ABC","16512332HOR-3",51.223,[[-22.137252,-51.414504],[-22.136926,-51.414151]]],
["1143817","ABC","16512332HOR-3",26.406,[[-22.13746,-51.414725],[-22.137626,-51.414909]]],
["1143818","ABC","16512332HOR-3",34.698,[[-22.137626,-51.414909],[-22.137847,-51.415148]]],
["1143819","ABC","16512332HOR-3",34.5,[[-22.137847,-51.415148],[-22.138066,-51.415385]]],
["1143820","ABC","1975HOR-3",34.449,[[-22.135739,-51.41767],[-22.136046,-51.417724]]],
["1143821","ABC","1975HOR-3",25.722,[[-22.136046,-51.417724],[-22.136276,-51.417765]]],
["1143822","ABC","1975HOR-3",20.279,[[-22.136276,-51.417765],[-22.136456,-51.417797]]],
["1143823","ABC","1975HOR-3",27.394,[[-22.136456,-51.417797],[-22.136733,-51.417846]]],
["1143824","ABC","1975HOR-3",22.937,[[-22.13118,-51.425661],[-22.13135,-51.425788]]],
["1143825","ABC","1975HOR-3",31.74,[[-22.13135,-51.425788],[-22.131588,-51.425959]]],
["1143829","ABC","1975HOR-3",24.071,[[-22.139701,-51.409653],[-22.139844,-51.409433]]],
["1143830","ABC","16512332HOR-3",17.536,[[-22.138188,-51.415517],[-22.138299,-51.415638]]],
["1144120","ABC","1975HOR-3",30.741,[[-22.140703,-51.411984],[-22.140907,-51.412187]]],
["1144039","ABC","16512375HOR-3",25.251,[[-22.126479,-51.42604],[-22.126333,-51.425851]]],
["1144040","ABC","16512375HOR-3",38.653,[[-22.126333,-51.425851],[-22.126096,-51.425531]]],
["1144041","ABC","1975HOR-3",7.615,[[-22.126096,-51.425531],[-22.126147,-51.425481]]],
["1144042","ABC","16512375HOR-3",33.086,[[-22.126096,-51.425531],[-22.125909,-51.425281]]],
["1143832","ABC","1975HOR-3",33.54,[[-22.13455,-51.418944],[-22.134802,-51.419125]]],
["1143833","ABC","16512375HOR-3",26.305,[[-22.134608,-51.418694],[-22.134745,-51.418485]]],
["1144043","ABC","16512375HOR-3",24.015,[[-22.125909,-51.425281],[-22.125773,-51.425099]]],
["1144044","ABC","16512375HOR-3",39.65,[[-22.125773,-51.425099],[-22.125548,-51.424799]]],
["1144045","ABC","16512375HOR-3",22.62,[[-22.12536,-51.424548],[-22.125232,-51.424377]]],
["1144046","ABC","1975HOR-3",37.569,[[-22.140244,-51.411491],[-22.140478,-51.411755]]],
["1143842","ABC","16512332HOR-3",41.884,[[-22.132549,-51.429789],[-22.132772,-51.429461]]],
["1143843","ABC","1975HOR-3",32.918,[[-22.13374,-51.418781],[-22.133569,-51.419042]]],
["1143844","ABC","1975HOR-3",23.395,[[-22.13595,-51.414705],[-22.135765,-51.414595]]],
["1144154","ABC","1975HOR-3",27.274,[[-22.119195,-51.424557],[-22.119341,-51.424344]]],
["1144155","ABC","1975HOR-3",26.054,[[-22.119341,-51.424344],[-22.119482,-51.424142]]],
["1143944","ABC","16512375HOR-3",28.884,[[-22.130689,-51.432151],[-22.130523,-51.431935]]],
["1143866","ABC","16512375HOR-3",37.882,[[-22.134745,-51.418485],[-22.134942,-51.418185]]],
["1143867","ABC","16512375HOR-3",35.148,[[-22.134942,-51.418185],[-22.135125,-51.417906]]],
["1143868","ABC","16512375VER-3",25.894,[[-22.135125,-51.417906],[-22.13526,-51.417701]]],
["1143946","ABC","16512332HOR-3",19.912,[[-22.130419,-51.431787],[-22.130313,-51.431943]]],
["1143947","ABC","16512375HOR-3",46.776,[[-22.130419,-51.431787],[-22.130147,-51.431439]]],
["1144072","ABC","16512375HOR-3",44.831,[[-22.132711,-51.434879],[-22.132493,-51.434513]]],
["1144073","ABC","1975HOR-3",78.797,[[-22.132711,-51.434879],[-22.132033,-51.435113]]],
["1144074","ABC","1975HOR-3",17.224,[[-22.122969,-51.424114],[-22.122957,-51.423947]]],
["1144075","ABC","1975HOR-3",38.641,[[-22.122996,-51.424488],[-22.122969,-51.424114]]],
["1144076","ABC","1975HOR-3",32.321,[[-22.123018,-51.424809],[-22.123041,-51.425121]]],
["1144169","ABC","1975HOR-3",30.553,[[-22.139251,-51.416884],[-22.138975,-51.416869]]],
["1144172","ABC","1975HOR-3",32.016,[[-22.136031,-51.419356],[-22.13632,-51.419377]]],
["1144173","ABC","1975HOR-3",33.629,[[-22.13632,-51.419377],[-22.136623,-51.419399]]],
["1144174","ABC","1975HOR-3",20.478,[[-22.136623,-51.419399],[-22.136808,-51.419412]]],
["1144175","ABC","1975HOR-3",20.423,[[-22.136808,-51.419412],[-22.136992,-51.419425]]],
["1143959","ABC","16512375HOR-3",37.339,[[-22.129152,-51.429539],[-22.12905,-51.429167]]],
["1143960","ABC","16512375HOR-3",29.913,[[-22.12905,-51.429167],[-22.129035,-51.428877]]],
["1143962","ABC","16512375HOR-3",31.429,[[-22.129035,-51.428877],[-22.129024,-51.428573]]],
["1143964","ABC","16512375HOR-3",36.834,[[-22.129366,-51.426622],[-22.129557,-51.426329]]],
["1144176","ABC","1975HOR-3",26.053,[[-22.136992,-51.419425],[-22.137227,-51.419442]]],
["1144177","ABC","1975HOR-3",24.841,[[-22.137227,-51.419442],[-22.137451,-51.419458]]],
["1144178","ABC","1975HOR-3",26.024,[[-22.137782,-51.419481],[-22.138016,-51.419498]]],
["1144179","ABC","1975HOR-3",31.4,[[-22.137272,-51.417886],[-22.137555,-51.417907]]],
["1144081","ABC","1975HOR-3",36.017,[[-22.128531,-51.421773],[-22.128847,-51.421689]]],
["1144082","ABC","1975HOR-3",38.099,[[-22.128188,-51.421878],[-22.128531,-51.421773]]],
["1144083","ABC","1975HOR-3",43.262,[[-22.128188,-51.421878],[-22.127826,-51.421992]]],
["1144084","ABC","1975HOR-3",19.847,[[-22.128068,-51.422057],[-22.128188,-51.421878]]],
["1144085","ABC","1975HOR-3",8.659,[[-22.128099,-51.422134],[-22.128068,-51.422057]]],
["1144086","ABC","1975HOR-3",34.137,[[-22.128211,-51.422443],[-22.128099,-51.422134]]],
["1144087","ABC","1975HOR-3",28.639,[[-22.127757,-51.424548],[-22.127594,-51.424332]]],
["1144089","ABC","1975HOR-3",31.172,[[-22.135163,-51.419295],[-22.135444,-51.419315]]],
["1144180","ABC","1975HOR-3",33.857,[[-22.137555,-51.417907],[-22.13786,-51.41793]]],
["1144181","ABC","1975HOR-3",17.258,[[-22.134978,-51.419276],[-22.135163,-51.419295]]],
["1144189","ABC","1975HOR-3",31.583,[[-22.140676,-51.411737],[-22.140868,-51.41151]]],
["1143969","ABC","16512381HOR-3",32.984,[[-22.121496,-51.424814],[-22.121199,-51.424841]]],
["1143970","ABC","16512381HOR-3",30.806,[[-22.121773,-51.424789],[-22.121496,-51.424814]]],
["1143971","ABC","1975HOR-3",25.058,[[-22.134346,-51.43212],[-22.134478,-51.431923]]],
["1143972","ABC","1975HOR-3",35.604,[[-22.134158,-51.4324],[-22.134346,-51.43212]]],
["1143975","ABC","1975HOR-3",42.895,[[-22.128689,-51.423777],[-22.128548,-51.42339]]],
["1143976","ABC","1975HOR-3",9.765,[[-22.128845,-51.424214],[-22.128814,-51.424126]]],
["1143977","ABC","1975HOR-3",30.438,[[-22.128502,-51.42423],[-22.128289,-51.424415]]],
["1143978","ABC","1975HOR-3",23.061,[[-22.128289,-51.424415],[-22.128126,-51.424555]]],
["1143979","ABC","1975HOR-3",31.277,[[-22.128126,-51.424555],[-22.127906,-51.424745]]],
["1143980","ABC","1975HOR-3",31.752,[[-22.13786,-51.41793],[-22.138147,-51.417951]]],
["46749008","ABC","1983SUB-3P",4.557,[[-22.139849,-51.416957],[-22.139851,-51.416912]]],
["48307562","ABC","626986COM-3",33.087,[[-22.141382,-51.416777],[-22.141148,-51.416538]]],
["1494966","ABC","1994COM-3",22.315,[[-22.133174,-51.444994],[-22.13325,-51.444794]]],
["1494962","ABC","1994COM-3",17.109,[[-22.133097,-51.445178],[-22.133174,-51.444994]]],
["1580750","ABC","1994COM-3",19.236,[[-22.134083,-51.410345],[-22.133983,-51.410498]]],
["1531241","ABC","16512375HOR-3",19.629,[[-22.13297,-51.435587],[-22.132911,-51.435408]]],
["1531257","ABC","1994COM-3",35.163,[[-22.133336,-51.436718],[-22.133232,-51.436396]]],
["1531258","ABC","1994COM-3",25.159,[[-22.133046,-51.435817],[-22.13297,-51.435587]]],
["1531259","ABC","1994COM-3",36.957,[[-22.133451,-51.437055],[-22.133336,-51.436718]]],
["1515365","ABC","1975HOR-3",43.065,[[-22.132433,-51.43231],[-22.132674,-51.431982]]],
["1515366","ABC","1995COM-3",12.133,[[-22.132433,-51.43231],[-22.132519,-51.432384]]],
["1516661","ABC","1995COM-3",8.655,[[-22.126337,-51.425837],[-22.126396,-51.425781]]],
["1516311","ABC","16512320HOR-3",10.503,[[-22.13012,-51.424172],[-22.130067,-51.424088]]],
["1557692","ABC","1995COM-3",22.196,[[-22.139207,-51.413369],[-22.139172,-51.413581]]],
["1043601","ABC","1995COM-3",39.859,[[-22.114671,-51.424185],[-22.114316,-51.424253]]],
["1043602","ABC","1995COM-3",25.14,[[-22.114894,-51.424142],[-22.114671,-51.424185]]],
["1043603","ABC","1975VER-3",6.354,[[-22.114209,-51.424273],[-22.11422,-51.424333]]],
["1555181","ABC","1995COM-3",21.514,[[-22.1329,-51.409074],[-22.132733,-51.408968]]],
["1572986","ABC","16512375HOR-3",46.09,[[-22.129123,-51.426985],[-22.129366,-51.426622]]],
["1553175","ABC","16512375HOR-3",17.879,[[-22.141629,-51.408002],[-22.141742,-51.407832]]],
["49462693","ABC","626986COM-3",18.0,[[-22.12668,-51.423845],[-22.126548,-51.423947]]],
["1134878","ABC","16512375HOR-3",19.395,[[-22.137216,-51.414727],[-22.137318,-51.414574]]],
["1134879","ABC","16512375HOR-3",32.971,[[-22.137318,-51.414574],[-22.137493,-51.414315]]],
["1134880","ABC","16512332HOR-3",22.119,[[-22.137318,-51.414574],[-22.13746,-51.414725]]],
["1134881","ABC","16512332HOR-3",10.275,[[-22.137318,-51.414574],[-22.137252,-51.414504]]],
["1134981","ABC","1975HOR-3",7.395,[[-22.135349,-51.417568],[-22.135406,-51.417606]]],
["1134982","ABC","1975HOR-3",13.482,[[-22.135349,-51.417568],[-22.135246,-51.417497]]],
["1134983","ABC","16512375HOR-3",16.897,[[-22.13526,-51.417701],[-22.135349,-51.417568]]],
["49462669","ABC","1975HOR-3",14.173,[[-22.127095,-51.42367],[-22.127015,-51.423563]]],
["49462676","ABC","626986COM-3",35.762,[[-22.126548,-51.423947],[-22.126229,-51.423834]]],
["49462690","ABC","626986COM-3",19.511,[[-22.127015,-51.423563],[-22.127155,-51.423448]]],
["49462691","ABC","626986COM-3",10.441,[[-22.127015,-51.423563],[-22.12694,-51.423625]]],
["49462692","ABC","626986COM-3",36.663,[[-22.12694,-51.423625],[-22.12668,-51.423845]]],
["1134984","ABC","16512375HOR-3",18.43,[[-22.135349,-51.417568],[-22.135444,-51.417421]]],
["1135867","ABC","16512332HOR-3",16.203,[[-22.134927,-51.427954],[-22.135072,-51.427937]]],
["1135868","ABC","16512332HOR-3",20.051,[[-22.135072,-51.427937],[-22.135252,-51.427918]]],
["1135869","ABC","1975HOR-3",25.018,[[-22.135072,-51.427937],[-22.135092,-51.428178]]],
["1135870","ABC","1975HOR-3",15.466,[[-22.135072,-51.427937],[-22.135061,-51.427787]]],
["1135489","ABC","1975HOR-3",10.815,[[-22.132086,-51.432783],[-22.132026,-51.432866]]],
["1135490","ABC","1975HOR-3",26.907,[[-22.132086,-51.432783],[-22.132237,-51.432578]]],
["1135823","ABC","16512380HOR-3",20.631,[[-22.118409,-51.424947],[-22.118239,-51.424866]]],
["1134775","ABC","1975HOR-3",17.959,[[-22.141635,-51.41067],[-22.141752,-51.41079]]],
["1134776","ABC","1975HOR-3",10.709,[[-22.141635,-51.41067],[-22.141565,-51.410598]]],
["1134777","ABC","1975HOR-3",16.627,[[-22.141534,-51.41079],[-22.141635,-51.41067]]],
["1134778","ABC","1975HOR-3",13.811,[[-22.141635,-51.41067],[-22.141717,-51.410569]]],
["1135824","ABC","16512380HOR-3",11.585,[[-22.118239,-51.424866],[-22.118143,-51.424822]]],
["1135825","ABC","1975HOR-3",12.587,[[-22.118239,-51.424866],[-22.118174,-51.424967]]],
["1135826","ABC","1975HOR-3",23.234,[[-22.118239,-51.424866],[-22.11836,-51.424683]]],
["1135827","ABC","1975HOR-3",16.272,[[-22.117806,-51.424616],[-22.117721,-51.424745]]],
["1135828","ABC","1975HOR-3",20.666,[[-22.117806,-51.424616],[-22.11791,-51.42445]]],
["1135829","ABC","16512380HOR-3",17.354,[[-22.117934,-51.424713],[-22.117806,-51.424616]]],
["1135830","ABC","16512380HOR-3",20.79,[[-22.117806,-51.424616],[-22.117653,-51.424499]]],
["1134686","ABC","1975HOR-3",21.419,[[-22.134869,-51.419182],[-22.134981,-51.419013]]],
["1134687","ABC","1975HOR-3",14.321,[[-22.134869,-51.419182],[-22.134792,-51.419294]]],
["1134688","ABC","1975HOR-3",9.45,[[-22.134802,-51.419125],[-22.134869,-51.419182]]],
["1135491","ABC","16512332HOR-3",14.037,[[-22.132136,-51.432932],[-22.132086,-51.432783]]],
["1135492","ABC","16512332HOR-3",21.44,[[-22.132086,-51.432783],[-22.132014,-51.43259]]],
["1135601","ABC","16512381HOR-3",13.341,[[-22.121199,-51.424841],[-22.121079,-51.42485]]],
["1135602","ABC","16512381HOR-3",16.322,[[-22.121079,-51.42485],[-22.120932,-51.424865]]],
["1135603","ABC","16512381HOR-3",13.711,[[-22.121079,-51.42485],[-22.121092,-51.424983]]],
["1135604","ABC","16512381HOR-3",14.498,[[-22.121079,-51.42485],[-22.121066,-51.424711]]],
["1134689","ABC","1975HOR-3",15.425,[[-22.134869,-51.419182],[-22.134978,-51.419276]]],
["1388212","ABC","1994COM-3",33.041,[[-22.134276,-51.447188],[-22.133988,-51.447102]]],
["1388213","ABC","1994COM-3",36.428,[[-22.133707,-51.446956],[-22.13345,-51.446734]]],
["1388214","ABC","1994COM-3",32.952,[[-22.13345,-51.446734],[-22.133262,-51.446487]]],
["1388215","ABC","1994COM-3",34.731,[[-22.133262,-51.446487],[-22.133123,-51.446185]]],
["1118722","ABC","16512375HOR-3",43.668,[[-22.128438,-51.426937],[-22.128257,-51.426561]]],
["1125086","ABC","1975HOR-3",15.216,[[-22.135527,-51.416081],[-22.135587,-51.415952]]],
["1125087","ABC","1975HOR-3",19.891,[[-22.135527,-51.416081],[-22.135405,-51.41623]]],
["1125088","ABC","1975HOR-3",74.708,[[-22.136159,-51.416335],[-22.135527,-51.416081]]],
["1125099","ABC","1975HOR-3",21.691,[[-22.129006,-51.424661],[-22.128935,-51.424465]]],
["1125100","ABC","1975HOR-3",17.673,[[-22.128935,-51.424465],[-22.128877,-51.424305]]],
["1125101","ABC","1995COM-3",15.433,[[-22.128935,-51.424465],[-22.12902,-51.424346]]],
["1125102","ABC","1995COM-3",36.745,[[-22.128935,-51.424465],[-22.128733,-51.424748]]],
["55766197","ABC","1995COM-3",8.943,[[-22.141373,-51.408598],[-22.141443,-51.408642]]],
["55766205","ABC","626986COM-3",13.344,[[-22.141443,-51.408642],[-22.141509,-51.408778]]],
["1137868","ABC","16512381HOR-3",37.484,[[-22.123518,-51.424625],[-22.123181,-51.424658]]],
["1137869","ABC","16512381HOR-3",28.234,[[-22.123772,-51.4246],[-22.123518,-51.424625]]],
["1137870","ABC","16512381HOR-3",29.238,[[-22.124035,-51.424574],[-22.123772,-51.4246]]],
["1142460","ABC","1975HOR-3",37.096,[[-22.11836,-51.424683],[-22.118554,-51.424389]]],
["1142480","ABC","16512332HOR-3P",3.543,[[-22.13089,-51.431979],[-22.130873,-51.43195]]],
["1137904","ABC","1975HOR-3",29.468,[[-22.135244,-51.416477],[-22.135092,-51.416711]]],
["1137905","ABC","1975HOR-3",27.644,[[-22.134688,-51.417211],[-22.1346,-51.417462]]],
["1137909","ABC","1995COM-3",40.438,[[-22.137552,-51.419609],[-22.137528,-51.42]]],
["1142205","ABC","1995COM-3",15.19,[[-22.137528,-51.42],[-22.137528,-51.420148]]],
["1142456","ABC","1975HOR-3",36.265,[[-22.135433,-51.425423],[-22.135618,-51.425133]]],
["1142457","ABC","16512332HOR-3",27.676,[[-22.134678,-51.427981],[-22.134927,-51.427954]]],
["1142458","ABC","16512332HOR-3",38.937,[[-22.134328,-51.428022],[-22.134678,-51.427981]]],
["1142459","ABC","16512332HOR-3",42.681,[[-22.133945,-51.428067],[-22.134328,-51.428022]]],
["1137253","ABC","1975HOR-3",32.267,[[-22.135909,-51.41546],[-22.136076,-51.415204]]],
["1540559","ABC","16512332HOR-3",20.131,[[-22.138766,-51.414178],[-22.138897,-51.414313]]],
["1540560","ABC","16512332HOR-3",39.764,[[-22.138507,-51.413911],[-22.138766,-51.414178]]],
["1446926","ABC","1994COM-3",34.694,[[-22.134414,-51.439817],[-22.134299,-51.439503]]],
["1446927","ABC","1994COM-3",30.467,[[-22.134515,-51.440091],[-22.134414,-51.439817]]],
["1446928","ABC","1994COM-3",25.181,[[-22.133956,-51.438575],[-22.133873,-51.438348]]],
["1446929","ABC","1994COM-3",47.11,[[-22.134614,-51.440827],[-22.134617,-51.44037]]],
["48307541","ABC","626986COM-3",34.728,[[-22.141148,-51.416538],[-22.140922,-51.416304]]],
["48307557","ABC","626986COM-3",24.754,[[-22.140899,-51.417332],[-22.141144,-51.417291]]],
["48307558","ABC","626986COM-3",10.322,[[-22.141144,-51.417291],[-22.141236,-51.417273]]],
["48307559","ABC","626986COM-3",13.4,[[-22.141236,-51.417273],[-22.141339,-51.417205]]],
["48307560","ABC","626986COM-3",18.418,[[-22.141339,-51.417205],[-22.141437,-51.417061]]],
["48307561","ABC","626986COM-3",27.616,[[-22.141437,-51.417061],[-22.141382,-51.416777]]],
["1444291","ABC","1994COM-3",30.586,[[-22.133726,-51.43801],[-22.133625,-51.437734]]],
["1444292","ABC","1994COM-3",25.09,[[-22.134604,-51.44107],[-22.134614,-51.440827]]],
["1444293","ABC","1994COM-3",31.969,[[-22.134189,-51.439205],[-22.134083,-51.438917]]],
["1444294","ABC","1994COM-3",34.712,[[-22.133873,-51.438348],[-22.133726,-51.43801]]],
["1556515","ABC","1995COM-3",24.941,[[-22.133091,-51.409203],[-22.1329,-51.409074]]],
["1594742","ABC","626986COM-3",19.778,[[-22.128733,-51.424748],[-22.128563,-51.424859]]],
["1596105","ABC","626986COM-3",28.117,[[-22.130924,-51.424491],[-22.131152,-51.424643]]],
["1531239","ABC","1994COM-3",25.393,[[-22.133625,-51.437734],[-22.133589,-51.437456]]],
["1531240","ABC","1994COM-3",44.101,[[-22.133589,-51.437456],[-22.133451,-51.437055]]],
["1592190","ABC","626986COM-3",29.616,[[-22.133323,-51.40938],[-22.133452,-51.409096]]],
["1535667","ABC","626986COM-3",40.247,[[-22.139452,-51.417031],[-22.139834,-51.417102]]],
["1535668","ABC","626986COM-3",38.458,[[-22.140184,-51.417157],[-22.140523,-51.417241]]],
["1535669","ABC","1975HOR-3",24.291,[[-22.141259,-51.414703],[-22.141424,-51.414857]]],
["1535670","ABC","626986COM-3",39.213,[[-22.139834,-51.417102],[-22.140184,-51.417157]]],
["1534990","ABC","1995COM-3",8.991,[[-22.139491,-51.419051],[-22.139505,-51.419137]]],
["1534991","ABC","1995COM-3",50.136,[[-22.139963,-51.419006],[-22.140416,-51.418995]]],
["1534992","ABC","1995COM-3",33.741,[[-22.139,-51.418016],[-22.139304,-51.418039]]],
["1534993","ABC","1995COM-3",24.858,[[-22.139395,-51.418045],[-22.139384,-51.417805]]],
["1534994","ABC","1995COM-3",27.323,[[-22.139505,-51.419137],[-22.13954,-51.419399]]],
["36855556","ABC","626986COM-3P",4.987,[[-22.139403,-51.415041],[-22.139375,-51.415079]]],
["1568698","ABC","16512375HOR-3",21.039,[[-22.129948,-51.431089],[-22.129851,-51.430914]]],
["1215904","ABC","1995COM-3",28.999,[[-22.138633,-51.412609],[-22.138857,-51.412753]]],
["1215905","ABC","1995COM-3",22.955,[[-22.139096,-51.412981],[-22.139197,-51.413175]]],
["1215906","ABC","1994COM-3",18.79,[[-22.138533,-51.412757],[-22.138633,-51.412609]]],
["1215907","ABC","1995COM-3",15.865,[[-22.138633,-51.412609],[-22.138522,-51.412511]]],
["1215908","ABC","1994COM-3",42.626,[[-22.138633,-51.412609],[-22.138858,-51.412274]]],
["1215909","ABC","1995COM-3",35.34,[[-22.138857,-51.412753],[-22.139096,-51.412981]]],
["1215910","ABC","1995COM-3",20.032,[[-22.139197,-51.413175],[-22.139207,-51.413369]]],
["1169476","ABC","1994COM-3",40.013,[[-22.133411,-51.410458],[-22.133099,-51.410261]]],
["1169477","ABC","1994COM-3",31.823,[[-22.133658,-51.410615],[-22.133411,-51.410458]]],
["1170196","ABC","1994COM-3",27.952,[[-22.131485,-51.408993],[-22.131264,-51.408862]]],
["1170197","ABC","1994COM-3",24.712,[[-22.131708,-51.409132],[-22.131485,-51.408993]]],
["1170198","ABC","1994COM-3",21.834,[[-22.132052,-51.409337],[-22.13188,-51.409234]]],
["1170199","ABC","1994COM-3",26.288,[[-22.132259,-51.409462],[-22.132052,-51.409337]]],
["1171007","ABC","1994COM-3",25.718,[[-22.13291,-51.410142],[-22.133028,-51.409927]]],
["1171008","ABC","1994COM-3",10.392,[[-22.13291,-51.410142],[-22.132864,-51.410229]]],
["1576792","ABC","1994COM-3",30.949,[[-22.133028,-51.409927],[-22.133169,-51.409668]]],
["1576793","ABC","626986COM-3",9.056,[[-22.133169,-51.409668],[-22.133102,-51.409618]]],
["1564811","ABC","626986COM-3",20.422,[[-22.141484,-51.408216],[-22.141613,-51.408358]]],
["1547937","ABC","16512381HOR-3",2.305,[[-22.123554,-51.423072],[-22.123575,-51.423075]]],
["1542970","ABC","16512375HOR-3",21.542,[[-22.130761,-51.424506],[-22.130864,-51.424329]]],
["24106559","ABC","16512346MUL-3P",8.683,[[-22.140193,-51.415633],[-22.140232,-51.415706]]],
["23465057","ABC","16512343VER-3P",4.237,[[-22.124912,-51.426719],[-22.124878,-51.426699]]],
["23465059","ABC","16512343VER-3P",2.954,[[-22.138803,-51.414422],[-22.138777,-51.414415]]],
["23446580","ABC","16512343HOR-3P",10.37,[[-22.139451,-51.409557],[-22.139496,-51.409645]]],
["23437763","ABC","16512343HOR-3P",11.421,[[-22.130313,-51.431943],[-22.130258,-51.432037]]],
["23568965","ABC","16512352MUL-3P",7.062,[[-22.128954,-51.42792],[-22.128892,-51.427906]]],
["37825672","ABCN","16512352MUL-3NP",3.673,[[-22.139851,-51.416912],[-22.139842,-51.416878]]],
["23755296","ABC","16512352MUL-3P",6.284,[[-22.135648,-51.417192],[-22.135646,-51.417131]]],
["1603617","ABC","1975HOR-3",4.449,[[-22.128994,-51.427925],[-22.128954,-51.42792]]],
["1600717","ABC","16512375HOR-3",19.126,[[-22.130523,-51.431935],[-22.130419,-51.431787]]],
["1603972","ABC","1975HOR-3",3.664,[[-22.135765,-51.414595],[-22.135737,-51.414577]]],
["1603974","ABC","1975HOR-3",4.992,[[-22.13194,-51.422707],[-22.131976,-51.422735]]],
["1603975","ABC","1975HOR-3P",4.478,[[-22.140162,-51.415604],[-22.140193,-51.415633]]],
["1515908","ABC","1975HOR-3",9.343,[[-22.139172,-51.413581],[-22.139088,-51.413565]]],
["1562887","ABC","1975HOR-3",33.901,[[-22.134179,-51.43335],[-22.134485,-51.433328]]],
["1562888","ABC","626986COM-3",39.112,[[-22.134485,-51.433328],[-22.134849,-51.433264]]],
["1562889","ABC","626986COM-3",28.837,[[-22.134849,-51.433264],[-22.135109,-51.433243]]],
["1558386","ABC","16512332HOR-3",32.53,[[-22.132418,-51.433518],[-22.132358,-51.433209]]],
["68759903","ABC","1975HOR-3",12.249,[[-22.130953,-51.425492],[-22.131044,-51.425559]]],
["68759913","ABC","626986COM-3",5.8,[[-22.131044,-51.425559],[-22.131072,-51.425512]]],
["68759923","ABC","626986COM-3",7.542,[[-22.131044,-51.425559],[-22.131007,-51.425621]]],
["68759937","ABC","626986COM-3",34.208,[[-22.131007,-51.425621],[-22.130824,-51.425889]]],
["53559066","ABC","626986COM-3",36.71,[[-22.137991,-51.415735],[-22.137791,-51.416019]]],
["53559077","ABC","626986COM-3",34.645,[[-22.137791,-51.416019],[-22.137679,-51.416333]]],
["53559087","ABC","626986COM-3",8.749,[[-22.138188,-51.415517],[-22.138243,-51.415456]]],
["53559096","ABC","16512332HOR-3",19.078,[[-22.138066,-51.415385],[-22.138188,-51.415517]]],
["53559142","ABC","626986COM-3",31.282,[[-22.138188,-51.415517],[-22.137991,-51.415735]]],
["56685162","ABC","1975HOR-3",2.537,[[-22.121714,-51.420672],[-22.121724,-51.420649]]],
["56685170","ABC","16512381HOR-3",18.532,[[-22.121827,-51.420805],[-22.121714,-51.420672]]],
["1449457","ABC","1994COM-3",4.3,[[-22.136852,-51.44906],[-22.136876,-51.449094]]],
["1449458","ABC","1994COM-3",4.465,[[-22.136852,-51.44906],[-22.136822,-51.449032]]],
["1159921","ABC","16512381HOR-3",30.335,[[-22.124204,-51.424008],[-22.124075,-51.423748]]],
["1544628","ABC","1994COM-3",26.829,[[-22.136453,-51.41139],[-22.136257,-51.411238]]],
["1544629","ABC","1994COM-3",24.362,[[-22.133841,-51.410747],[-22.133658,-51.410615]]],
["1544630","ABC","1994COM-3",9.938,[[-22.134083,-51.410345],[-22.134116,-51.410256]]],
["1544631","ABC","1994COM-3",29.833,[[-22.134956,-51.410853],[-22.134708,-51.41074]]],
["1544632","ABC","1994COM-3",8.533,[[-22.13415,-51.410386],[-22.134083,-51.410345]]],
["1544633","ABC","1994COM-3",27.999,[[-22.135415,-51.411041],[-22.135204,-51.410891]]],
["1544634","ABC","1994COM-3",11.711,[[-22.133841,-51.410747],[-22.133938,-51.410791]]],
["36254346","ABC","1975HOR-3",9.999,[[-22.128877,-51.424305],[-22.128845,-51.424214]]],
["36254355","ABC","626986COM-3",18.156,[[-22.128845,-51.424214],[-22.128684,-51.424248]]],
["1534984","ABC","1995COM-3",29.896,[[-22.138731,-51.417994],[-22.139,-51.418016]]],
["1534985","ABC","1995COM-3",8.955,[[-22.139395,-51.418045],[-22.139385,-51.418131]]],
["1534986","ABC","1995COM-3",31.054,[[-22.13954,-51.419399],[-22.139582,-51.419697]]],
["1534987","ABC","1995COM-3",10.138,[[-22.139304,-51.418039],[-22.139395,-51.418045]]],
["1534988","ABC","1995COM-3",37.87,[[-22.139408,-51.418396],[-22.139457,-51.41876]]],
["1534989","ABC","1995COM-3",10.381,[[-22.139395,-51.418045],[-22.139489,-51.418052]]],
["1534845","ABC","1995COM-3",27.433,[[-22.139385,-51.418131],[-22.139408,-51.418396]]],
["1534846","ABC","1995COM-3",13.247,[[-22.139491,-51.419051],[-22.139632,-51.419014]]],
["1535824","ABC","1975HOR-3",22.532,[[-22.133978,-51.433379],[-22.134179,-51.43335]]],
["1549289","ABC","1994COM-3",7.22,[[-22.133841,-51.410747],[-22.133807,-51.410807]]],
["1549290","ABC","1994COM-3",35.126,[[-22.134423,-51.410559],[-22.13415,-51.410386]]],
["1549291","ABC","1994COM-3",27.757,[[-22.135204,-51.410891],[-22.134956,-51.410853]]],
["1549292","ABC","1994COM-3",37.727,[[-22.136006,-51.411044],[-22.135704,-51.411214]]],
["1549293","ABC","1994COM-3",21.714,[[-22.13188,-51.409234],[-22.131708,-51.409132]]],
["1549294","ABC","1994COM-3",28.728,[[-22.134083,-51.410345],[-22.133856,-51.410209]]],
["1549295","ABC","1994COM-3",36.632,[[-22.134708,-51.41074],[-22.134423,-51.410559]]],
["1575427","ABC","1975HOR-3",12.326,[[-22.134761,-51.417121],[-22.134688,-51.417211]]],
["1573752","ABC","626986COM-3",23.909,[[-22.133169,-51.409668],[-22.133366,-51.409764]]],
["1573753","ABC","626986COM-3",37.074,[[-22.133366,-51.409764],[-22.133665,-51.409926]]],
["1571413","ABC","16512375HOR-3",30.679,[[-22.129557,-51.426329],[-22.129716,-51.426086]]],
["1536786","ABC","1994COM-3",35.982,[[-22.138238,-51.413202],[-22.138427,-51.412918]]],
["1531260","ABC","1994COM-3",37.561,[[-22.133156,-51.436162],[-22.133046,-51.435817]]],
["1531261","ABC","1994COM-3",25.605,[[-22.133232,-51.436396],[-22.133156,-51.436162]]],
["1388031","ABC","1994COM-3",17.371,[[-22.136822,-51.449032],[-22.136734,-51.448892]]],
["1388032","ABC","1994COM-3",18.822,[[-22.136734,-51.448892],[-22.136648,-51.448735]]],
["1388033","ABC","1994COM-3",39.682,[[-22.136648,-51.448735],[-22.136428,-51.448431]]],
["1388034","ABC","1994COM-3",36.137,[[-22.136428,-51.448431],[-22.136228,-51.448154]]],
["1388035","ABC","1994COM-3",34.804,[[-22.136228,-51.448154],[-22.136035,-51.447888]]],
["1388036","ABC","1994COM-3",34.627,[[-22.136035,-51.447888],[-22.135814,-51.44765]]],
["1388037","ABC","1994COM-3",36.363,[[-22.135814,-51.44765],[-22.13553,-51.447472]]],
["1388038","ABC","1994COM-3",41.109,[[-22.13553,-51.447472],[-22.135182,-51.447335]]],
["1388039","ABC","1994COM-3",29.937,[[-22.135182,-51.447335],[-22.134919,-51.447266]]],
["1388040","ABC","1994COM-3",35.9,[[-22.134919,-51.447266],[-22.134597,-51.447226]]],
["1388041","ABC","1994COM-3",35.718,[[-22.134597,-51.447226],[-22.134276,-51.447188]]],
["1134466","ABC","1975HOR-3",28.187,[[-22.130824,-51.423105],[-22.130971,-51.422882]]],
["1134467","ABC","1975HOR-3",37.74,[[-22.130627,-51.423403],[-22.130824,-51.423105]]],
["1134468","ABC","1975HOR-3",29.977,[[-22.130471,-51.423641],[-22.130627,-51.423403]]],
["1134471","ABC","1975HOR-3",28.248,[[-22.127594,-51.424332],[-22.127434,-51.424119]]],
["1134472","ABC","1975HOR-3",27.764,[[-22.127434,-51.424119],[-22.127276,-51.42391]]],
["1134473","ABC","1975HOR-3",31.782,[[-22.127276,-51.42391],[-22.127095,-51.42367]]],
["1134474","ABC","1975HOR-3",24.77,[[-22.127015,-51.423563],[-22.126874,-51.423377]]],
["1134475","ABC","1975HOR-3",31.252,[[-22.136076,-51.415204],[-22.136258,-51.414928]]],
["1134476","ABC","1975HOR-3",42.828,[[-22.128847,-51.421689],[-22.129233,-51.421654]]],
["1134477","ABC","1975HOR-3",32.239,[[-22.130302,-51.423896],[-22.130471,-51.423641]]],
["1129247","ABC","16512375HOR-3",27.316,[[-22.141484,-51.408216],[-22.141629,-51.408002]]],
["1128860","ABC","16512375HOR-3",7.868,[[-22.137942,-51.412544],[-22.137859,-51.412478]]],
["1128861","ABC","16512375HOR-3",23.367,[[-22.137859,-51.412478],[-22.137687,-51.412346]]],
["1128862","ABC","1975HOR-3",6.859,[[-22.137859,-51.412478],[-22.137824,-51.412533]]],
["1128863","ABC","1975HOR-3",37.067,[[-22.137859,-51.412478],[-22.138048,-51.412181]]],
["1133980","ABC","16512375HOR-3",29.401,[[-22.13194,-51.422707],[-22.132095,-51.422475]]],
["1133981","ABC","16512375HOR-3",37.92,[[-22.132792,-51.421437],[-22.132993,-51.421139]]],
["1129154","ABC","1975HOR-3",33.191,[[-22.115741,-51.424375],[-22.115986,-51.424561]]],
["1129156","ABC","1975HOR-3",27.704,[[-22.136804,-51.425452],[-22.137009,-51.425607]]],
["1129157","ABC","1975HOR-3",35.128,[[-22.136545,-51.425256],[-22.136804,-51.425452]]],
["1129159","ABC","16512332HOR-3",31.705,[[-22.136255,-51.427666],[-22.136512,-51.427861]]],
["1129160","ABC","16512332HOR-3",32.124,[[-22.13598,-51.427841],[-22.136255,-51.427666]]],
["1129161","ABC","16512332HOR-3",25.506,[[-22.13575,-51.42786],[-22.13598,-51.427841]]],
["1129163","ABC","1975HOR-3",12.49,[[-22.121676,-51.420625],[-22.121639,-51.420511]]],
["1129164","ABC","1975HOR-3",29.615,[[-22.115603,-51.424129],[-22.115741,-51.424375]]],
["1133871","ABC","1975HOR-3",42.725,[[-22.133199,-51.4195],[-22.132976,-51.419838]]],
["1133872","ABC","1975HOR-3",29.595,[[-22.131438,-51.422172],[-22.131593,-51.421938]]],
["1133873","ABC","1975HOR-3",30.124,[[-22.131281,-51.42241],[-22.131438,-51.422172]]],
["1133877","ABC","16512381HOR-3",51.978,[[-22.121605,-51.420429],[-22.121286,-51.420012]]],
["1128270","ABC","1975HOR-3",15.926,[[-22.115721,-51.423982],[-22.115579,-51.424009]]],
["1128271","ABC","1975HOR-3",14.039,[[-22.115579,-51.424009],[-22.115455,-51.424034]]],
["1128272","ABC","1975HOR-3",12.726,[[-22.115579,-51.424009],[-22.115603,-51.424129]]],
["1128273","ABC","1975HOR-3",23.997,[[-22.115579,-51.424009],[-22.115538,-51.42378]]],
["1128276","ABC","16512332HOR-3",5.975,[[-22.133817,-51.428128],[-22.133844,-51.428077]]],
["1128277","ABC","16512332HOR-3",43.1,[[-22.133844,-51.428077],[-22.134047,-51.42772]]],
["1128278","ABC","16512332HOR-3",11.189,[[-22.133844,-51.428077],[-22.133945,-51.428067]]],
["1134292","ABC","16512375HOR-3",27.558,[[-22.127216,-51.426587],[-22.126982,-51.426495]]],
["1134294","ABC","16512375HOR-3",43.932,[[-22.137607,-51.414144],[-22.137838,-51.413798]]],
["1134295","ABC","16512375HOR-3",34.026,[[-22.125232,-51.424377],[-22.12504,-51.42412]]],
["1134296","ABC","1975HOR-3",29.173,[[-22.126874,-51.423377],[-22.126708,-51.423157]]],
["1134297","ABC","1975HOR-3",39.671,[[-22.129233,-51.421654],[-22.129591,-51.421658]]],
["1134298","ABC","16512375HOR-3",68.508,[[-22.129007,-51.427281],[-22.128463,-51.426988]]],
["1134075","ABC","1975HOR-3",31.529,[[-22.133843,-51.432871],[-22.134009,-51.432623]]],
["1134078","ABC","16512381HOR-3",176.997,[[-22.123554,-51.423072],[-22.122532,-51.421706]]],
["1134080","ABC","16512381HOR-3",56.61,[[-22.122532,-51.421706],[-22.122201,-51.421242]]],
["1134089","ABC","16512332HOR-3",4.656,[[-22.138803,-51.414422],[-22.138836,-51.41445]]],
["1134185","ABC","16512381HOR-3",25.436,[[-22.121676,-51.420625],[-22.121529,-51.420815]]],
["1134186","ABC","1975HOR-3",19.296,[[-22.121714,-51.420672],[-22.121642,-51.420841]]],
["1128279","ABC","16512332HOR-3",19.898,[[-22.133844,-51.428077],[-22.133665,-51.428098]]],
["1128280","ABC","1995COM-3",12.7,[[-22.14128,-51.408544],[-22.141179,-51.408485]]],
["1128281","ABC","1995COM-3",11.664,[[-22.14128,-51.408544],[-22.141373,-51.408598]]],
["1128282","ABC","16512375HOR-3",12.359,[[-22.14128,-51.408544],[-22.141334,-51.40844]]],
["1128602","ABC","1975HOR-3",27.77,[[-22.131593,-51.421938],[-22.131756,-51.42169]]],
["1134090","ABC","16512375COM-3",40.304,[[-22.137029,-51.411836],[-22.136734,-51.411607]]],
["1134478","ABC","1975HOR-3",34.898,[[-22.13012,-51.424172],[-22.130302,-51.423896]]],
["1134479","ABC","1975HOR-3",21.29,[[-22.137577,-51.411769],[-22.137685,-51.411598]]],
["1134481","ABC","16512332HOR-3",35.465,[[-22.131246,-51.429185],[-22.131147,-51.428858]]],
["1128880","ABC","1995COM-3",30.573,[[-22.129173,-51.424132],[-22.129341,-51.423897]]],
["1128881","ABC","1995COM-3",29.967,[[-22.129513,-51.423656],[-22.129677,-51.423426]]],
["1128882","ABC","1995COM-3",30.913,[[-22.129677,-51.423426],[-22.129847,-51.423188]]],
["1133897","ABC","1975HOR-3",33.481,[[-22.11545,-51.42317],[-22.115403,-51.422849]]],
["1133898","ABC","1975HOR-3",28.47,[[-22.115538,-51.42378],[-22.115498,-51.423507]]],
["1133899","ABC","1975HOR-3",35.242,[[-22.115498,-51.423507],[-22.11545,-51.42317]]],
["1133903","ABC","1975HOR-3",37.529,[[-22.135406,-51.417606],[-22.135739,-51.41767]]],
["1128287","ABC","16512332HOR-3",2.581,[[-22.132222,-51.430265],[-22.132217,-51.430241]]],
["1128288","ABC","16512332HOR-3",30.093,[[-22.132222,-51.430265],[-22.132384,-51.43003]]],
["1128289","ABC","16512332HOR-3",8.278,[[-22.132222,-51.430265],[-22.132179,-51.430331]]],
["1134097","ABC","1975HOR-3",25.403,[[-22.131588,-51.425959],[-22.131779,-51.426096]]],
["1129290","ABC","16512381HOR-3",61.255,[[-22.122201,-51.421242],[-22.121827,-51.420805]]],
["1129293","ABC","1975HOR-3",10.662,[[-22.121138,-51.421559],[-22.121051,-51.421604]]],
["1129294","ABC","1975HOR-3",13.765,[[-22.121102,-51.421408],[-22.121138,-51.421559]]],
["1129295","ABC","1975HOR-3",31.25,[[-22.121313,-51.421207],[-22.121102,-51.421408]]],
["1129298","ABC","16512381HOR-3",79.814,[[-22.125457,-51.425656],[-22.125914,-51.426254]]],
["1133904","ABC","1975HOR-3",33.344,[[-22.140527,-51.41191],[-22.140326,-51.412151]]],
["1133905","ABC","1975HOR-3",33.052,[[-22.140326,-51.412151],[-22.140116,-51.412379]]],
["1128297","ABC","1975HOR-3",19.993,[[-22.130478,-51.424923],[-22.130448,-51.425114]]],
["1128299","ABC","16512375HOR-3",28.074,[[-22.13033,-51.425145],[-22.130478,-51.424923]]],
["1128301","ABC","1975HOR-3",23.134,[[-22.116326,-51.423866],[-22.11612,-51.423905]]],
["1128302","ABC","1975HOR-3",5.795,[[-22.11612,-51.423905],[-22.116069,-51.423916]]],
["1128303","ABC","1975HOR-3",23.476,[[-22.11612,-51.423905],[-22.116095,-51.423679]]],
["1128304","ABC","1975HOR-3",10.057,[[-22.11612,-51.423905],[-22.116132,-51.424001]]],
["1128606","ABC","1975HOR-3",16.123,[[-22.139617,-51.409781],[-22.139701,-51.409653]]],
["1128607","ABC","1975HOR-3P",29.467,[[-22.139617,-51.409781],[-22.139451,-51.409557]]],
["1128608","ABC","1975HOR-3",3.728,[[-22.139609,-51.409823],[-22.139617,-51.409781]]],
["1128609","ABC","1975HOR-3",10.36,[[-22.139677,-51.409892],[-22.139609,-51.409823]]],
["1128610","ABC","626986COM-3",29.972,[[-22.139609,-51.409823],[-22.139442,-51.410048]]],
["1128611","ABC","1975HOR-3P",33.107,[[-22.139451,-51.409557],[-22.139241,-51.409328]]],
["1128612","ABC","1975HOR-3P",35.257,[[-22.139241,-51.409328],[-22.139023,-51.409079]]],
["1128613","ABC","626986COM-3",35.067,[[-22.139442,-51.410048],[-22.139261,-51.410327]]],
["1128615","ABC","16512332HOR-3",20.881,[[-22.136828,-51.414045],[-22.136696,-51.413901]]],
["1128616","ABC","1975HOR-3",41.181,[[-22.136258,-51.414928],[-22.13595,-51.414705]]],
["1128617","ABC","1975HOR-3",35.22,[[-22.135725,-51.415739],[-22.135909,-51.41546]]],
["1129109","ABC","1975HOR-3",43.264,[[-22.133457,-51.430902],[-22.133688,-51.430563]]],
["1128621","ABC","1975HOR-3",33.213,[[-22.138048,-51.412181],[-22.138221,-51.411918]]],
["1129110","ABC","1975HOR-3",20.612,[[-22.133347,-51.431063],[-22.133457,-51.430902]]],
["1134419","ABC","1975HOR-3",28.096,[[-22.131135,-51.422633],[-22.131281,-51.42241]]],
["1129196","ABC","1975HOR-3",24.176,[[-22.134772,-51.425846],[-22.13495,-51.425981]]],
["1133803","ABC","1975HOR-3",34.625,[[-22.141281,-51.410306],[-22.141055,-51.410074]]],
["1133804","ABC","1975HOR-3",43.548,[[-22.141565,-51.410598],[-22.141281,-51.410306]]],
["1134205","ABC","16512375HOR-3",42.932,[[-22.129716,-51.426086],[-22.129938,-51.425745]]],
["1134206","ABC","16512375HOR-3",42.854,[[-22.129938,-51.425745],[-22.130161,-51.425405]]],
["1134207","ABC","16512375HOR-3",32.74,[[-22.130161,-51.425405],[-22.13033,-51.425145]]],
["1134208","ABC","1975HOR-3",31.511,[[-22.130448,-51.425114],[-22.130681,-51.425289]]],
["1128007","ABC","1975HOR-3",12.47,[[-22.137451,-51.419458],[-22.137563,-51.419465]]],
["1128008","ABC","1975HOR-3",24.255,[[-22.137563,-51.419465],[-22.137782,-51.419481]]],
["1128009","ABC","1995COM-3",24.243,[[-22.137563,-51.419465],[-22.137584,-51.419231]]],
["1128010","ABC","1995COM-3",14.888,[[-22.137563,-51.419465],[-22.137552,-51.419609]]],
["1128011","ABC","16512381HOR-3",10.772,[[-22.118976,-51.425021],[-22.118879,-51.425011]]],
["1128012","ABC","16512381HOR-3",26.295,[[-22.118879,-51.425011],[-22.118642,-51.424991]]],
["1134029","ABC","1975HOR-3",20.935,[[-22.133125,-51.43349],[-22.133312,-51.433467]]],
["1134030","ABC","1975HOR-3",35.401,[[-22.133312,-51.433467],[-22.133629,-51.433421]]],
["1134031","ABC","1975HOR-3",18.531,[[-22.133629,-51.433421],[-22.133796,-51.433403]]],
["1134032","ABC","16512381HOR-3",53.344,[[-22.124075,-51.423748],[-22.123745,-51.423371]]],
["1134034","ABC","16512381HOR-3",37.405,[[-22.123745,-51.423371],[-22.123554,-51.423072]]],
["1133805","ABC","1975HOR-3",31.898,[[-22.14133,-51.411008],[-22.141534,-51.41079]]],
["1133806","ABC","1975HOR-3",34.105,[[-22.141118,-51.411248],[-22.14133,-51.411008]]],
["1133807","ABC","1975HOR-3",38.723,[[-22.140868,-51.41151],[-22.141118,-51.411248]]],
["1134114","ABC","16512375HOR-3",39.528,[[-22.130478,-51.424923],[-22.130678,-51.424606]]],
["1134116","ABC","1975HOR-3",29.483,[[-22.140341,-51.413762],[-22.140531,-51.413962]]],
["1134117","ABC","1975HOR-3",32.312,[[-22.140531,-51.413962],[-22.14074,-51.41418]]],
["1134118","ABC","1975HOR-3",30.94,[[-22.14074,-51.41418],[-22.140941,-51.41439]]],
["1134119","ABC","1975HOR-3",32.545,[[-22.140941,-51.41439],[-22.141151,-51.41461]]],
["1128314","ABC","1995COM-3",23.958,[[-22.132769,-51.419599],[-22.132553,-51.419587]]],
["1128315","ABC","1995COM-3",24.233,[[-22.132988,-51.419603],[-22.132769,-51.419599]]],
["1128316","ABC","1995COM-3",21.953,[[-22.133199,-51.4195],[-22.132988,-51.419603]]],
["1128322","ABC","1995COM-3",12.027,[[-22.114316,-51.424253],[-22.114209,-51.424273]]],
["1128323","ABC","1975HOR-3",19.423,[[-22.123009,-51.424675],[-22.122996,-51.424488]]],
["1129111","ABC","1975HOR-3",20.084,[[-22.137474,-51.411929],[-22.137577,-51.411769]]],
["1129112","ABC","1975HOR-3",33.888,[[-22.12897,-51.425818],[-22.129156,-51.425558]]],
["1129113","ABC","1975HOR-3",35.166,[[-22.128776,-51.426088],[-22.12897,-51.425818]]],
["1129114","ABC","1975HOR-3",24.095,[[-22.128643,-51.426273],[-22.128776,-51.426088]]],
["1129115","ABC","1975HOR-3",24.981,[[-22.128477,-51.426437],[-22.128643,-51.426273]]],
["1129118","ABC","16512375HOR-3",38.805,[[-22.124823,-51.423803],[-22.124604,-51.423509]]],
["1129119","ABC","16512375HOR-3",38.848,[[-22.124604,-51.423509],[-22.124385,-51.423215]]],
["1129120","ABC","16512375HOR-3",37.246,[[-22.124385,-51.423215],[-22.124175,-51.422932]]],
["1134420","ABC","1975HOR-3",31.423,[[-22.130971,-51.422882],[-22.131135,-51.422633]]],
["1128537","ABC","1975HOR-3",28.779,[[-22.139935,-51.412598],[-22.139755,-51.412799]]],
["1128538","ABC","1975HOR-3",24.093,[[-22.139755,-51.412799],[-22.139602,-51.412966]]],
["1128539","ABC","1975HOR-3",24.368,[[-22.139602,-51.412966],[-22.13976,-51.413155]]],
["1128540","ABC","1975HOR-3",23.719,[[-22.13976,-51.413155],[-22.139913,-51.413315]]],
["1128541","ABC","1975HOR-3",34.405,[[-22.139913,-51.413315],[-22.140136,-51.413548]]],
["1128819","ABC","1975HOR-3",7.928,[[-22.140574,-51.411853],[-22.140527,-51.41191]]],
["1128822","ABC","1975HOR-3",16.595,[[-22.115335,-51.422366],[-22.115186,-51.422392]]],
["1128823","ABC","1975HOR-3",22.631,[[-22.115335,-51.422366],[-22.115536,-51.422331]]],
["1128824","ABC","1975HOR-3",14.328,[[-22.115354,-51.422504],[-22.115335,-51.422366]]],
["1128825","ABC","1975HOR-3",19.417,[[-22.115335,-51.422366],[-22.115307,-51.422181]]],
["1129221","ABC","16512332HOR-3",34.546,[[-22.13544,-51.427897],[-22.13575,-51.42786]]],
["1129222","ABC","16512332HOR-3",20.866,[[-22.135252,-51.427918],[-22.13544,-51.427897]]],
["1129223","ABC","1975HOR-3",41.326,[[-22.13624,-51.425025],[-22.136545,-51.425256]]],
["1129224","ABC","1975HOR-3",29.505,[[-22.136022,-51.424861],[-22.13624,-51.425025]]],
["1128929","ABC","1995COM-3",15.846,[[-22.126182,-51.426632],[-22.126098,-51.426756]]],
["1128013","ABC","1975HOR-3",10.014,[[-22.118879,-51.425011],[-22.118827,-51.42509]]],
["1128014","ABC","1975HOR-3",25.625,[[-22.118879,-51.425011],[-22.119017,-51.424812]]],
["1128324","ABC","1975HOR-3",13.782,[[-22.123009,-51.424675],[-22.123018,-51.424809]]],
["1134046","ABC","16512375HOR-3",30.937,[[-22.132089,-51.433937],[-22.1319,-51.433716]]],
["1134047","ABC","16512381HOR-3",33.003,[[-22.12207,-51.424762],[-22.121773,-51.424789]]],
["1134048","ABC","16512381HOR-3",26.771,[[-22.122311,-51.42474],[-22.12207,-51.424762]]],
["1134049","ABC","16512381HOR-3",34.61,[[-22.122623,-51.424712],[-22.122311,-51.42474]]],
["1134050","ABC","16512381HOR-3",27.33,[[-22.122869,-51.424688],[-22.122623,-51.424712]]],
["1134051","ABC","1975HOR-3",19.715,[[-22.134168,-51.433132],[-22.134317,-51.433]]],
["1134052","ABC","1975HOR-3",28.238,[[-22.134009,-51.432623],[-22.134158,-51.4324]]],
["1133823","ABC","1975HOR-3",19.562,[[-22.132987,-51.431555],[-22.133096,-51.431405]]],
["1128325","ABC","16512381HOR-3",19.044,[[-22.123181,-51.424658],[-22.123009,-51.424675]]],
["1128326","ABC","16512381HOR-3",15.628,[[-22.123009,-51.424675],[-22.122869,-51.424688]]],
["1134441","ABC","1995COM-3",16.552,[[-22.141443,-51.408642],[-22.141572,-51.408723]]],
["1128546","ABC","16512381HOR-3",9.268,[[-22.121639,-51.420511],[-22.121605,-51.420429]]],
["1128562","ABC","1975HOR-3",28.97,[[-22.13369,-51.433099],[-22.133843,-51.432871]]],
["1128655","ABC","16512332HOR-3",38.916,[[-22.126088,-51.426484],[-22.125814,-51.426721]]],
["1128659","ABC","16512332HOR-3",4.68,[[-22.124954,-51.426719],[-22.124912,-51.426719]]],
["1128660","ABC","16512332HOR-3",66.504,[[-22.125814,-51.426721],[-22.12518,-51.426711]]],
["1128661","ABC","16512332HOR-3",25.073,[[-22.12518,-51.426711],[-22.124954,-51.426719]]],
["1127943","ABC","16512332HOR-3",18.624,[[-22.134535,-51.430032],[-22.13467,-51.43014]]],
["1127944","ABC","16512332HOR-3",19.746,[[-22.13467,-51.43014],[-22.134813,-51.430255]]],
["1127945","ABC","16512332HOR-3",24.321,[[-22.13467,-51.43014],[-22.134803,-51.429952]]],
["1127946","ABC","16512332HOR-3",10.327,[[-22.13467,-51.43014],[-22.134615,-51.43022]]],
["1128049","ABC","1975HOR-3",8.887,[[-22.139464,-51.416896],[-22.139544,-51.4169]]],
["1128050","ABC","1975HOR-3",23.601,[[-22.139464,-51.416896],[-22.139251,-51.416884]]],
["1134058","ABC","16512332HOR-3",35.023,[[-22.138299,-51.415638],[-22.138522,-51.415879]]],
["1134059","ABC","16512332HOR-3",36.77,[[-22.138522,-51.415879],[-22.138756,-51.416132]]],
["1134060","ABC","16512332HOR-3",36.862,[[-22.138756,-51.416132],[-22.13899,-51.416386]]],
["1134061","ABC","16512332HOR-3",21.85,[[-22.13899,-51.416386],[-22.139129,-51.416536]]],
["1134062","ABC","16512332HOR-3",25.583,[[-22.139129,-51.416536],[-22.139291,-51.416713]]],
["1129246","ABC","16512375HOR-3",24.814,[[-22.141334,-51.40844],[-22.141484,-51.408216]]],
["1128051","ABC","16512332HOR-3",26.814,[[-22.139291,-51.416713],[-22.139464,-51.416896]]],
["1128052","ABC","16512332HOR-3",3.288,[[-22.139464,-51.416896],[-22.139485,-51.416918]]],
["1129153","ABC","1975HOR-3",36.01,[[-22.115403,-51.422849],[-22.115354,-51.422504]]],
["1134163","ABC","1975HOR-3",52.373,[[-22.121642,-51.420841],[-22.121313,-51.421207]]],
["1128563","ABC","1975HOR-3",27.652,[[-22.133543,-51.433316],[-22.13369,-51.433099]]],
["1128574","ABC","1975HOR-3",25.782,[[-22.140006,-51.409185],[-22.140123,-51.408969]]],
["1128582","ABC","16512375HOR-3",28.715,[[-22.137065,-51.414953],[-22.137216,-51.414727]]],
["1134597","ABC","1975HOR-3",38.872,[[-22.132773,-51.433485],[-22.133125,-51.43349]]],
["1134598","ABC","1975HOR-3",39.505,[[-22.132418,-51.433518],[-22.132773,-51.433485]]],
["1134605","ABC","16512375HOR-3",36.693,[[-22.135444,-51.417421],[-22.135635,-51.417131]]],
["1133671","ABC","16512332HOR-3",35.517,[[-22.133095,-51.431189],[-22.132838,-51.430983]]],
["1133672","ABC","16512332HOR-3",37.089,[[-22.132838,-51.430983],[-22.132569,-51.430768]]],
["1133673","ABC","16512332HOR-3",33.687,[[-22.132569,-51.430768],[-22.132325,-51.430573]]],
["1127895","ABC","16512375HOR-3",19.693,[[-22.131398,-51.423515],[-22.131501,-51.423359]]],
["1127896","ABC","16512375HOR-3",10.311,[[-22.131501,-51.423359],[-22.131556,-51.423279]]],
["1127897","ABC","1975HOR-3",12.028,[[-22.131501,-51.423359],[-22.131413,-51.423291]]],
["1127898","ABC","1975HOR-3",11.425,[[-22.131501,-51.423359],[-22.131584,-51.423425]]],
["1128504","ABC","1975HOR-3",31.47,[[-22.140907,-51.412187],[-22.141111,-51.412399]]],
["1128512","ABC","1994COM-3",37.821,[[-22.140482,-51.409845],[-22.140681,-51.409547]]],
["1128513","ABC","1994COM-3",37.35,[[-22.140681,-51.409547],[-22.140877,-51.409253]]],
["1128518","ABC","1975HOR-3",40.802,[[-22.141055,-51.410074],[-22.14079,-51.409799]]],
["1128816","ABC","1975HOR-3",14.701,[[-22.140478,-51.411755],[-22.140574,-51.411853]]],
["1128817","ABC","1975HOR-3",19.673,[[-22.140574,-51.411853],[-22.140703,-51.411984]]],
["1128818","ABC","1975HOR-3",16.408,[[-22.140574,-51.411853],[-22.140676,-51.411737]]],
["1349688","ABC","1995COM-3P",40.671,[[-22.139616,-51.415062],[-22.139893,-51.415321]]],
["1349689","ABC","16512375HOR-3",28.692,[[-22.138065,-51.413459],[-22.138238,-51.413202]]],
["1349690","ABC","1995COM-3P",41.765,[[-22.139893,-51.415321],[-22.140162,-51.415604]]],
["1349691","ABC","16512332HOR-3",65.948,[[-22.138075,-51.41347],[-22.138507,-51.413911]]],
["1349692","ABC","1995COM-3P",32.576,[[-22.139409,-51.414838],[-22.139616,-51.415062]]],
["1349693","ABC","1995COM-3P",4.57,[[-22.139354,-51.414781],[-22.139409,-51.414838]]],
["1128478","ABC","16512380HOR-3",81.697,[[-22.11748,-51.424369],[-22.11688,-51.423908]]],
["1128479","ABC","1975HOR-3",26.236,[[-22.11688,-51.423908],[-22.116625,-51.42381]]],
["1128089","ABC","16512375VER-3",28.736,[[-22.137054,-51.448884],[-22.136852,-51.44906]]],
["1128498","ABC","16512375HOR-3",21.71,[[-22.137493,-51.414315],[-22.137607,-51.414144]]],
["1556033","ABC","16512375HOR-3",36.941,[[-22.141183,-51.408906],[-22.14128,-51.408544]]],
["24100387","ABC","16512358MUL-3P",8.468,[[-22.126396,-51.425781],[-22.126428,-51.425855]]],
["24099444","ABC","16512352MUL-3P",9.515,[[-22.126103,-51.426697],[-22.12602,-51.42672]]],
["24002364","ABC","16512346MUL-3P",2.863,[[-22.125819,-51.425035],[-22.125812,-51.425008]]],
["24078833","ABC","16512346MUL-3P",7.736,[[-22.126147,-51.425481],[-22.126144,-51.425556]]],
["1423269","ABC","16512381HOR-3",20.53,[[-22.12422,-51.424556],[-22.124035,-51.424574]]],
["1423271","ABC","16512381HOR-3",17.868,[[-22.12438,-51.42454],[-22.12422,-51.424556]]],
["24072996","ABC","16512346MUL-3P",8.382,[[-22.139375,-51.415079],[-22.139314,-51.415127]]],
["1439197","ABC","1994COM-3",39.004,[[-22.133634,-51.443824],[-22.13378,-51.44348]]],
["1439190","ABC","1994COM-3",35.183,[[-22.133047,-51.445861],[-22.133034,-51.445521]]],
["1439191","ABC","1994COM-3",30.944,[[-22.133528,-51.444102],[-22.133634,-51.443824]]],
["1439198","ABC","1994COM-3",40.993,[[-22.134462,-51.441779],[-22.13459,-51.441406]]],
["32535882","ABC","626986COM-3",15.078,[[-22.139834,-51.417102],[-22.139849,-51.416957]]],
["1439192","ABC","1994COM-3",40.675,[[-22.134317,-51.442141],[-22.134462,-51.441779]]],
["1439193","ABC","1994COM-3",34.404,[[-22.133123,-51.446185],[-22.133047,-51.445861]]],
["1439194","ABC","1994COM-3",23.029,[[-22.133446,-51.444308],[-22.133528,-51.444102]]],
["1439195","ABC","1994COM-3",31.076,[[-22.134206,-51.442418],[-22.134317,-51.442141]]],
["1439196","ABC","1994COM-3",25.225,[[-22.13325,-51.444794],[-22.133341,-51.44457]]],
["1439199","ABC","1994COM-3",29.421,[[-22.133341,-51.44457],[-22.133446,-51.444308]]],
["1439200","ABC","1994COM-3",32.674,[[-22.134089,-51.442709],[-22.134206,-51.442418]]],
["1426565","ABC","1995COM-3",7.553,[[-22.126191,-51.42662],[-22.126103,-51.426697]]],
["1568697","ABC","16512375HOR-3",39.302,[[-22.130147,-51.431439],[-22.129948,-51.431089]]],
["1134209","ABC","1975HOR-3",36.629,[[-22.130681,-51.425289],[-22.130953,-51.425492]]],
["1134210","ABC","1975HOR-3",18.33,[[-22.131044,-51.425559],[-22.13118,-51.425661]]],
["1134218","ABC","16512375HOR-3",26.21,[[-22.128257,-51.426561],[-22.128477,-51.426437]]],
["1134219","ABC","16512375HOR-3",23.584,[[-22.128257,-51.426561],[-22.128054,-51.426594]]],
["1134221","ABC","16512375HOR-3",25.86,[[-22.128054,-51.426594],[-22.12782,-51.426592]]],
["1134223","ABC","16512375HOR-3",25.36,[[-22.12782,-51.426592],[-22.127591,-51.42659]]],
["1134225","ABC","16512375HOR-3",41.57,[[-22.127591,-51.42659],[-22.127216,-51.426587]]],
["1134526","ABC","16512375HOR-3",29.627,[[-22.132095,-51.422475],[-22.132252,-51.422242]]],
["1133938","ABC","1975HOR-3",30.211,[[-22.140116,-51.412379],[-22.139935,-51.412598]]],
["1133646","ABC","16512381HOR-3",6.422,[[-22.121714,-51.420672],[-22.121676,-51.420625]]],
["1133946","ABC","1994COM-3",32.435,[[-22.140117,-51.41039],[-22.140288,-51.410134]]],
["1133947","ABC","1975HOR-3",70.794,[[-22.140117,-51.41039],[-22.139677,-51.409892]]],
["1133948","ABC","1994COM-3",36.671,[[-22.140288,-51.410134],[-22.140482,-51.409845]]],
["1134249","ABC","1975HOR-3",29.495,[[-22.132468,-51.424093],[-22.132686,-51.424258]]],
["1134250","ABC","1975HOR-3",27.55,[[-22.132686,-51.424258],[-22.132889,-51.424413]]],
["1134251","ABC","1975HOR-3",32.022,[[-22.132889,-51.424413],[-22.133125,-51.424592]]],
["1134260","ABC","1975HOR-3",22.914,[[-22.133125,-51.424592],[-22.133294,-51.424721]]],
["1134261","ABC","1975HOR-3",32.15,[[-22.133294,-51.424721],[-22.133531,-51.424901]]],
["1134262","ABC","1975HOR-3",26.718,[[-22.133531,-51.424901],[-22.133728,-51.425051]]],
["1133652","ABC","16512375HOR-3",24.895,[[-22.126801,-51.426415],[-22.126637,-51.42625]]],
["1133653","ABC","16512332HOR-3",30.853,[[-22.132384,-51.43003],[-22.132549,-51.429789]]],
["1133654","ABC","16512332HOR-3P",6.495,[[-22.133668,-51.435323],[-22.133611,-51.435313]]],
["1133660","ABC","16512332HOR-3",21.704,[[-22.134379,-51.429905],[-22.134535,-51.430032]]],
["1133661","ABC","16512332HOR-3",41.178,[[-22.134081,-51.429666],[-22.134379,-51.429905]]],
["1133968","ABC","1995COM-3",31.227,[[-22.129341,-51.423897],[-22.129513,-51.423656]]],
["1133974","ABC","1995COM-3",27.847,[[-22.12902,-51.424346],[-22.129173,-51.424132]]],
["1133976","ABC","1975HOR-3",32.906,[[-22.135735,-51.419335],[-22.136031,-51.419356]]],
["1133977","ABC","1975HOR-3",32.205,[[-22.135444,-51.419315],[-22.135735,-51.419335]]],
["1133978","ABC","16512375HOR-3",42.725,[[-22.131556,-51.423279],[-22.131782,-51.422943]]],
["1133979","ABC","16512375HOR-3",29.986,[[-22.131782,-51.422943],[-22.13194,-51.422707]]],
["1134269","ABC","16512332HOR-3",28.958,[[-22.133871,-51.429497],[-22.134081,-51.429666]]],
["1134270","ABC","16512332HOR-3",42.446,[[-22.133565,-51.42925],[-22.133871,-51.429497]]],
["1134271","ABC","16512332HOR-3",41.71,[[-22.134803,-51.429952],[-22.135038,-51.429636]]],
["1134272","ABC","1975HOR-3",38.3,[[-22.134911,-51.426234],[-22.134699,-51.426568]]],
["1134273","ABC","1975HOR-3",37.128,[[-22.134699,-51.426568],[-22.134525,-51.426876]]],
["1134274","ABC","16512332HOR-3",32.405,[[-22.134373,-51.427145],[-22.134525,-51.426876]]],
["1134275","ABC","16512332HOR-3",34.94,[[-22.134209,-51.427434],[-22.134373,-51.427145]]],
["1134276","ABC","16512332HOR-3",34.552,[[-22.134047,-51.42772],[-22.134209,-51.427434]]],
["1134588","ABC","16512332HOR-3",37.638,[[-22.132358,-51.433209],[-22.132136,-51.432932]]],
["1134589","ABC","1975HOR-3",23.905,[[-22.132247,-51.433589],[-22.132418,-51.433518]]]
];
const REDE_BT = [
  [[-22.90,-46.53],[-22.91,-46.52]], [[-22.93,-46.49],[-22.94,-46.485]],
  [[-22.98,-46.50],[-22.985,-46.51]], [[-22.84,-46.28],[-22.845,-46.275]],
];

function squareIcon(color){
  return L.divIcon({ className:"", html:`<div class="square-icon" style="background:${color}"></div>`, iconSize:[12,12], iconAnchor:[6,6] });
}

function equipesDisponiveis(){
  // Equipes reais vindas da importação de Podas (prefixo do número da OS,
  // ver Get-EquipeExecutoraDoNumeroOS no Controller) — não a lista fixa de
  // state.equipes (essa é a escala/meta cadastrada, pode ter gente que não
  // aparece nas OS do período, ou vice-versa).
  const set = new Set();
  state.manutencaoOS.forEach(o=>{ if(o.equipeId) set.add(o.equipeId); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
}

/* v2.13.10 - "Camadas do mapa" em subgrupos que abrem/fecham (Meio ambiente,
   Rede, Status da OS). So o Status da OS vem aberto; o que o usuario abrir/fechar
   fica lembrado (render() refaz a tela a cada filtro). */
const mapaFiltroGrupos = { localizacao:true, equipe:false, datas:false, sistemas:false };   // v3.13.0 - grupos do painel Filtros (Localização vem aberto)
const mapaGruposAbertos = { ambiente:false, rede:false, status:true };
function grupoCamadasHtml(chave, titulo, corpo){
  return `<details class="camadas-sub" ${mapaGruposAbertos[chave]?"open":""} ontoggle="mapaGruposAbertos['${chave}']=this.open">
    <summary>${titulo}</summary>
    <div class="breaker-group">${corpo}</div>
  </details>`;
}
function camadaItemHtml(c){
  return `
            <label class="breaker" data-layer="${c.id}">
              <span class="breaker-led${(c.id==="ativos"||EQUIP_CFG[c.id])?" tri":""}" style="color:${c.cor}"></span>
              <span class="breaker-name">${c.label}</span>
              ${c.alimentador ? `<span class="breaker-inline-multihost" id="${c.id}AlimentadorMultiHost" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()"></span>` : ""}
              <span class="breaker-switch"><input type="checkbox" ${c.checked?"checked":""}></span>
            </label>
            ${c.alimentador ? `<p id="${c.id}AlimentadorNota" style="display:none; color:var(--muted); font-size:11.5px; margin:-2px 0 8px 26px;"></p>` : ""}
            ${c.id==="aprl" ? `<p id="aprlMapaNota" style="color:var(--muted); font-size:11.5px; margin:-2px 0 8px 26px; line-height:1.5;"></p>` : ""}
            ${c.id==="vera" ? `<p id="veraNota" style="color:var(--muted); font-size:11.5px; margin:-2px 0 8px 26px;"></p>` : ""}
            ${c.id==="ativos" ? `<div id="ativosBox" style="display:none; margin:-2px 0 8px 26px;"><div id="ativosTipos" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;"></div><p id="ativosNota" style="color:var(--muted); font-size:11.5px; margin:0;"></p></div>` : ""}
            ${EQUIP_CFG[c.id] ? `<p id="equipNota_${c.id}" style="display:none; color:var(--muted); font-size:11.5px; margin:-2px 0 8px 26px;"></p>` : ""}
            ${c.id==="trafos" ? `<label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--muted); margin:-2px 0 8px 26px; cursor:pointer;"><input type="checkbox" ${equipRotulos?"checked":""} onchange="setEquipRotulos(this.checked)"> Rótulos nos equipamentos (código | kVA ou elo), a partir do zoom ${EQUIP_ROTULO_ZOOM}</label>` : ""}
            ${c.id==="protecoes" ? `<p style="font-size:11px; color:var(--muted); margin:-4px 0 8px 26px; line-height:1.6;"><span style="color:${EQUIP_PROT_COR["22"]}">▲</span> Fusível · <span style="color:${EQUIP_PROT_COR["27"]}">▲</span> Religador · <span style="color:${EQUIP_PROT_COR["19"]}">▲</span> Chave faca · <span style="color:${EQUIP_PROT_COR["29"]}">▲</span> Seccionalizador · <span style="color:#B42318">▲</span> Normal aberta</p>` : ""}`;
}
function viewManutencao(){
  const camadas = [
    {id:"reserva", label:"Reserva Legal", checked:false, cor:"#1E7A34", alimentador:true},
    {id:"app", label:"Área de Preservação (APP)", checked:false, cor:"#1B4F8C", alimentador:true},
    {id:"bt", label:"Rede BT", checked:false, cor:"#F37020", alimentador:true},
    {id:"mt", label:"Rede MT", checked:true, cor:"#6D28D9", alimentador:true},
    {id:"at", label:"Rede AT", checked:false, cor:"#B42318", alimentador:true},
    // VERA não é particionada por alimentador (é um ponto por árvore, base
    // única) - por isso não leva "alimentador:true" (sem combo de seleção).
    // Desligada por padrão: 141 mil pontos de uma vez é pesado, só carrega
    // quando a pessoa liga de propósito (ver carregarVeraMapa/initMapaManutencao).
    {id:"vera", label:"VERA (árvores)", checked:false, cor:"#2F9E44"},
    // v2.14.3 - Ativos = pontos do PONNOT (postes, derivações, etc.). São 760 mil
    // pontos, então só aparecem com zoom aproximado e só os da área visível.
    {id:"ativos", label:"Ativos", checked:false, cor:"#0E7490"},
    // v2.15.0 - equipamentos ligados ao poste (UNTRMT/UNSEMT/UNREMT/UNCRMT da BDGD)
    {id:"trafos", label:"Trafos", checked:false, cor:EQUIP_CFG.trafos.cor},
    {id:"protecoes", label:"Proteções", checked:false, cor:EQUIP_CFG.protecoes.cor},
    {id:"reguladores", label:"Reguladores", checked:false, cor:EQUIP_CFG.reguladores.cor},
    {id:"capacitores", label:"Capacitores", checked:false, cor:EQUIP_CFG.capacitores.cor},
    // v3.10.0 - pontos NIX (onde a rede parou, por cálculo): ligada por padrão, bolinha pulsando + círculo de raio
    {id:"nix", label:"Pontos Nix", checked:true, cor:"#D92D20"},
    // v3.12.0 - anel colorido nas OS que caem dentro/na borda de APP ou RL (não é camada de desenho: só estilo dos pontos)
    {id:"aprl", label:"Destacar OS em APP/RL", checked:true, cor:"#C026D3"},
  ];
  const statusLayerDefs = Object.keys(statusColor).map(s=>({id:s, label:s, checked:filtroStatusAtivos.has(s), cor:statusColor[s]}));
  const osVisiveis = osFiltradas();
  const nFiltrosAtivos = [filtroEquipe.size>0, filtroPrioridadeEW!==null, (filtroExecucaoDe||filtroExecucaoAte), (filtroAberturaDe||filtroAberturaAte), histMapa.sel.size>0, filtroPolo.size>0, filtroRegional.size>0, filtroTrecho.size>0, filtroServicos.size>0, filtroOrigem].filter(Boolean).length
    + Object.values(filtrosExtra||{}).filter(v=>v && (v.size===undefined ? true : v.size>0)).length;
  const equipes = equipesDisponiveis();
  const polos = polosDisponiveis();
  const regionais = regionaisDisponiveis();

  return `
  <div class="note" id="mapaInfoBanner" style="margin-bottom:14px;">
    ${ic("info")}<div id="mapaInfoBannerTexto">${API_ONLINE ? "Carregando camadas do mapa a partir do que foi importado em geo/…" : "Mapa em modo protótipo (Controller offline) — mostrando coordenadas de exemplo, não os arquivos importados."}</div>
  </div>

  <div class="card" id="mapaTopoCard" style="margin-bottom:14px;">
      <div id="mapaResumoCaixas">${mapaResumoCaixasHtml(osVisiveis)}</div>
      <p id="buscaCoordenadaErro" style="display:none; margin:-4px 0 10px; font-size:12px; color:var(--bad-fg);"></p>
      <p id="mapaSelecaoAreaHint" style="display:${modoSelecaoArea?'block':'none'}; margin:-4px 0 10px; font-size:12px; color:var(--muted);">${ic("info")||""} <span id="mapaSelecaoAreaHintTxt">${modoSelecaoForma==="poly" ? " Clique ponto a ponto no mapa pra desenhar a área; duplo clique (ou Enter) fecha, Esc cancela." : " Clique e arraste no mapa pra selecionar as OS dessa área — a tabela abaixo filtra pra elas."}</span></p>
  </div>

  <div class="card mapa-palco ${mapaSidebarColapsada?'mapa-sidebar-colapsada':''}" id="mapaGridWrap">
    <div class="mapa-area">
      <div id="mapaManutencao" class="leaflet-map tall mapa-grande"></div>
      ${coordMultiPainelHtml()}
      <div class="mapa-barra">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${rankMapaBotaoHtml()}
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="text" id="buscaCoordenadaInput" value="${escapeHtml(coordenadaBuscaTexto)}" placeholder="-22.324544, -55.432545" title="Cole uma coordenada (lat, lng) de uma reclamação de cliente e aperte Ir — o mapa centraliza nela pra ver o que já está pendente perto" style="width:190px; font-size:12px; padding:6px 8px; border-radius:7px; border:1px solid var(--border-hi); background:var(--surface);" onkeydown="if(event.key==='Enter'){ buscarCoordenadaNoMapa(); event.preventDefault(); }">
            <button class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="buscarCoordenadaNoMapa()" title="Centralizar o mapa nessa coordenada">${ic("target")||"◎"} Ir</button>
            <button type="button" class="btn ${coordMultiAberto||coordMultiTexto.trim()?"btn-primary":"btn-ghost"}" id="btnCoordMulti" style="padding:6px 10px; font-size:12px; font-weight:700;" onclick="coordMultiAlternar()" title="Ver várias coordenadas de uma vez (uma por linha)">+</button>
            ${coordenadaBuscaMarker || coordMultiGrupo ? `<button id="btnLimparCoordenadaBusca" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="limparCoordenadaBusca()" title="Tira o pino da coordenada buscada">${ic("close")||"×"}</button>` : ""}
          </div>
          <div class="sel-seg" role="group" aria-label="Selecionar OS no mapa">
            <button type="button" class="btn ${modoSelecaoArea&&modoSelecaoForma==='ret'?'btn-primary':'btn-ghost'}" id="btnSelecaoArea" onclick="alternarModoSelecaoArea('ret')" title="Clique e arraste no mapa pra selecionar as OS de um retângulo">▭ ${modoSelecaoArea&&modoSelecaoForma==='ret' ? "Cancelar" : "Retângulo"}</button>
            <button type="button" class="btn ${modoSelecaoArea&&modoSelecaoForma==='poly'?'btn-primary':'btn-ghost'}" id="btnSelecaoPoly" onclick="alternarModoSelecaoArea('poly')" title="Clique ponto a ponto pra desenhar a área; duplo clique (ou Enter) fecha, Esc cancela">⬠ ${modoSelecaoArea&&modoSelecaoForma==='poly' ? "Cancelar" : "Área livre"}</button>
          </div>
          <button class="btn btn-ghost" id="btnLimparSelecaoOS" style="padding:6px 12px; font-size:12px; display:${(osSelecionadaId || osSelecaoAreaIds) ? 'inline-flex' : 'none'};" onclick="limparSelecaoOS()" title="Limpa a seleção atual e volta a mostrar todas as OS, sem precisar recarregar a página">${ic("close")||"×"} Limpar seleção</button>
          <div class="mapa-busca">
            <div id="equipBuscaRes" class="equip-busca-res" style="display:none;"></div>
            <div id="endBuscaRes" class="equip-busca-res" style="display:none;"></div>
            <div class="mapa-busca-linha">
        <input type="text" id="endBuscaInput" class="${mapaBuscaModo==="endereco"?"":"oculto"}" placeholder="Digite o endereço e aperte Enter (ex.: Rua Cel. Leme, 100, Bragança Paulista)" onkeydown="if(event.key==='Enter'){ event.preventDefault(); buscarEndereco(this.value); }" aria-label="Buscar endereço">
        <input type="text" id="osBuscaInput" class="${mapaBuscaModo==="endereco"?"oculto":""}" placeholder="Buscar OS: número, alimentador, proteção, observação…" title="Para buscar mais de um de uma vez, separe por vírgula ou pela letra e: A-A1 e E-A2" value="${escapeHtml(filtroBuscaOS)}" oninput="buscarOS(this.value)" aria-label="Buscar OS">
        <button type="button" class="mapa-busca-modo ${mapaBuscaModo==="endereco"?"ativo":""}" id="btnBuscaModo" onclick="alternarModoBusca()" title="${mapaBuscaModo==="endereco"?"Voltar a buscar OS":"Buscar por endereço"}" aria-label="Alternar entre buscar OS e buscar endereço">📍</button>
        </div>
          </div>

        </div>
      </div>
      <button type="button" class="mapa-fab mapa-fab-limpar" id="btnLimparTudoMapa" style="display:${mapaTemFiltros()?'flex':'none'};" onclick="limparTudoMapa()" title="Limpar TODOS os filtros (os do painel, a busca, a seleção por área e o pino da coordenada)" aria-label="Limpar todos os filtros">${ic("filterX")}</button>
      <button type="button" class="mapa-fab ${mapaSidebarColapsada?'':'ativo'}" id="btnColapsarSidebarMapa" onclick="alternarSidebarMapa()" title="Filtros e camadas do mapa" aria-label="Filtros e camadas do mapa">${ic("filter")}${nFiltrosAtivos?`<span class="mapa-fab-badge">${nFiltrosAtivos}</span>`:""}</button>

    <div class="mapa-painel" id="mapaSidebarCard" style="display:${mapaSidebarColapsada?'none':''};">
      <div class="mapa-painel-topo"><strong>Filtros e camadas</strong><button type="button" class="mapa-painel-fechar" onclick="alternarSidebarMapa()" title="Fechar" aria-label="Fechar">×</button></div>
      <div class="mapa-abas" role="tablist" aria-label="Painel do mapa">
        <button type="button" role="tab" data-aba="filtros" class="${mapaPainelAba==='filtros'?'ativa':''}" aria-selected="${mapaPainelAba==='filtros'}" onclick="setMapaPainelAba('filtros')">Filtros${nFiltrosAtivos?`<span class="mapa-aba-badge">${nFiltrosAtivos}</span>`:''}</button>
        <button type="button" role="tab" data-aba="camadas" class="${mapaPainelAba==='camadas'?'ativa':''}" aria-selected="${mapaPainelAba==='camadas'}" onclick="setMapaPainelAba('camadas')">Camadas</button>
        <button type="button" role="tab" data-aba="visual" class="${mapaPainelAba==='visual'?'ativa':''}" aria-selected="${mapaPainelAba==='visual'}" onclick="setMapaPainelAba('visual')">Visualização</button>
      </div>
      <section class="mapa-aba" data-aba="filtros" role="tabpanel" ${mapaPainelAba!=='filtros'?'hidden':''}>
        ${(()=>{
          // v3.13.0 - filtros em grupos que abrem/fecham (como as Camadas): Equipe / Datas / Sistemas / Localização
          const ex = filtrosExtra || {};
          const nExtra = ch => (ex[ch] && ex[ch].size) ? 1 : 0;
          const nEquipe = (filtroEquipe.size>0?1:0) + (filtroTipoEquipeExec.size>0?1:0) + nExtra("tipoEquipeNecessaria");
          const nDatas = ((filtroExecucaoDe||filtroExecucaoAte)?1:0) + ((filtroAberturaDe||filtroAberturaAte)?1:0) + (histMapa.sel.size>0?1:0);
          const nSist = (filtroPrioridadeEW!==null?1:0) + (filtroOrigem?1:0);
          const nLoc = (filtroPolo.size>0?1:0) + (filtroRegional.size>0?1:0) + (filtroTrecho.size>0?1:0) + ["alimentador","zona","conjunto","localidade","prioridade"].reduce((t,c)=>t+nExtra(c),0);
          const tit = (nome, n) => `${nome}${n ? ` <span class="grp-badge">${n}</span>` : ""}`;
          const grupo = (chave, titulo, corpo) => `<details class="camadas-sub" ${mapaFiltroGrupos[chave]?"open":""} ontoggle="mapaFiltroGrupos['${chave}']=this.open">
            <summary>${titulo}</summary><div class="filtro-grupo-corpo">${corpo}</div></details>`;
          const gEquipe = `
            ${multiComboHtml("f_equipe","Equipe executora", equipes.map(eq=>({v:eq,t:eq})), filtroEquipe, "toggleFiltroEquipe", "limparFiltroEquipe", "Todas")}
            ${equipes.length===0 ? `<p style="color:var(--muted); font-size:11.5px; margin:-6px 0 8px;">Nenhuma equipe identificada ainda nas OS importadas.</p>` : ""}
            ${filtroTipoEquipeExecHtml()}
            ${filtrosExtraHtml(["tipoEquipeNecessaria"])}`;
          const gDatas = `
            ${histMapaPlanoHtml()}
            <div class="field">
              <label>Data de execução (executadas entre)</label>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <input type="date" id="filtroExecucaoDeInput" value="${filtroExecucaoDe||""}" onchange="setFiltroExecucaoPeriodo(this.value, undefined)">
                <input type="date" id="filtroExecucaoAteInput" value="${filtroExecucaoAte||""}" onchange="setFiltroExecucaoPeriodo(undefined, this.value)">
              </div>
              ${(filtroExecucaoDe||filtroExecucaoAte) ? `<button class="btn btn-ghost" style="padding:4px 10px; font-size:11.5px; margin-top:6px;" onclick="limparFiltroExecucaoPeriodo()">${ic("close")||"×"} Limpar período</button>` : ""}
            </div>
            <div class="field">
              <label>Data de abertura (abertas entre)</label>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <input type="date" id="filtroAberturaDeInput" value="${filtroAberturaDe||""}" onchange="setFiltroAberturaPeriodo(this.value, undefined)">
                <input type="date" id="filtroAberturaAteInput" value="${filtroAberturaAte||""}" onchange="setFiltroAberturaPeriodo(undefined, this.value)">
              </div>
              ${(filtroAberturaDe||filtroAberturaAte) ? `<button class="btn btn-ghost" style="padding:4px 10px; font-size:11.5px; margin-top:6px;" onclick="limparFiltroAberturaPeriodo()">${ic("close")||"×"} Limpar período</button>` : ""}
            </div>`;
          const gSist = `
            <div class="field">
              <label>Prioridade EW</label>
              <div class="tabs">
                <button class="tab ${filtroPrioridadeEW===null?'active':''}" onclick="setFiltroPrioridadeEW(null)">Todos</button>
                <button class="tab ${filtroPrioridadeEW===true?'active':''}" onclick="setFiltroPrioridadeEW(true)">Sim</button>
                <button class="tab ${filtroPrioridadeEW===false?'active':''}" onclick="setFiltroPrioridadeEW(false)">Não</button>
              </div>
            </div>
            <div class="field">
              <label>Origem</label>
              <div class="tabs">
                <button class="tab ${filtroOrigem===null?'active':''}" onclick="setFiltroOrigem(null)">Todos</button>
                <button class="tab ${filtroOrigem==='SGM'?'active':''}" onclick="setFiltroOrigem('SGM')">SGM</button>
                <button class="tab ${filtroOrigem==='SIGOD'?'active':''}" onclick="setFiltroOrigem('SIGOD')">SIGOD</button>
              </div>
            </div>`;
          const gLoc = `
            ${multiComboHtml("f_polo","Polo", polos.map(x=>({v:x,t:x})), filtroPolo, "toggleFiltroPolo", "limparFiltroPolo", "Todos")}
            ${polos.length===0 ? `<p style="color:var(--muted); font-size:11.5px; margin:-6px 0 8px;">Nenhum alimentador cruzado com Polo ainda — importe a Proteção e o Vão (nessa tela de Importação de Bases) pra esse filtro aparecer.</p>` : ""}
            ${multiComboHtml("f_regional","Regional", regionais.map(x=>({v:x,t:x})), filtroRegional, "toggleFiltroRegional", "limparFiltroRegional", "Todas")}
            ${filtroTrechoHtml()}
            ${filtrosExtraHtml(null, ["tipoEquipeNecessaria"])}`;
          return filtroServicosHtml() + grupo("localizacao", tit("Localização", nLoc), gLoc) + grupo("equipe", tit("Equipe", nEquipe), gEquipe) + grupo("datas", tit("Datas", nDatas), gDatas) + grupo("sistemas", tit("Sistemas", nSist), gSist);
        })()}
        <button class="btn btn-ghost" style="padding:5px 10px; font-size:12px; margin-top:6px;" onclick="limparFiltrosExtra()">${ic("close")||"×"} Limpar todos os filtros</button>
      </section>

      <section class="mapa-aba" data-aba="camadas" role="tabpanel" ${mapaPainelAba!=='camadas'?'hidden':''}>
        <p id="mapaCacheStatus" style="color:var(--muted); font-size:11.5px; margin:0 0 8px;"></p>
        ${grupoCamadasHtml("ambiente", "Meio ambiente", camadas.filter(c=>["reserva","app","aprl","vera"].includes(c.id)).map(camadaItemHtml).join(""))}
        ${grupoCamadasHtml("rede", "Rede", camadas.filter(c=>["bt","mt","at","ativos","trafos","protecoes","reguladores","capacitores","nix"].includes(c.id)).map(camadaItemHtml).join(""))}
        ${grupoCamadasHtml("status", "Status da OS", statusLayerDefs.map(c=>`
            <label class="breaker" data-layer="status_${c.id}">
              <span class="breaker-led" style="color:${c.cor}"></span>
              <span class="breaker-name">${c.label}</span>
              <span class="breaker-switch"><input type="checkbox" ${c.checked?"checked":""}></span>
            </label>`).join(""))}
      </section>

      ${mapaVisualMenuHtml()}
    </div>
    </div>
    <p class="map-status-line" id="mapaManutencaoStatus">Carregando mapa…</p>
  </div>

  <div class="card" style="margin-top:14px;">
    <div id="osTabelaContainer">${osTabelaHtml()}</div>
  </div>
  `;
}

/* Camadas reais: o Controller devolve GeoJSON puro (GET /api/manutencao/
   camadas) — estas duas funções desenham qualquer FeatureCollection de
   linhas/polígonos no Leaflet, com popup a partir de quaisquer propriedades
   que o Feature tiver (funciona tanto pros arquivos ilustrativos quanto
   pros importados de verdade, cujas propriedades são outras). */
function popupPropriedades(props){
  const linhas = Object.entries(props||{})
    .filter(([k])=>k!=="camada")
    .map(([k,v])=>`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`).join("");
  return `<dl>${linhas}</dl>`;
}
function renderPolylineFeatureCollection(geojson, layerGroup, cor, peso, dash){
  layerGroup.clearLayers();
  addPolylineFeatures(geojson && geojson.features, layerGroup, cor, peso, dash);
}
/* Mesmo desenho de renderPolylineFeatureCollection, mas sem limpar o que já
   está no layerGroup — usada pra ir acrescentando os trechos conforme cada
   alimentador chega no streaming de "Todos os alimentadores"
   (carregarRedeMt); limpar a cada lote apagaria os lotes anteriores. */
function addPolylineFeatures(features, layerGroup, cor, peso, dash){
  (features||[]).forEach(f=>{
    if(!f.geometry || f.geometry.type!=="LineString") return;
    const latlngs = f.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    const titulo = (f.properties && (f.properties.COD_ID || f.properties.camada)) || "Trecho";
    L.polyline(latlngs, { color:cor, weight:peso, dashArray:dash })
      .bindPopup(`<h4>${escapeHtml(String(titulo))}</h4>${popupPropriedades(f.properties)}`)
      .addTo(layerGroup);
  });
}
function renderPolygonFeatureCollection(geojson, layerGroup, cor, popupTitulo){
  layerGroup.clearLayers();
  if(!geojson || !geojson.features) return;
  geojson.features.forEach(f=>{
    if(!f.geometry || f.geometry.type!=="Polygon") return;
    const latlngs = f.geometry.coordinates[0].map(([lng,lat])=>[lat,lng]);
    L.polygon(latlngs, { color:cor, weight:1.5, fillOpacity:.18 }).bindPopup(popupTitulo).addTo(layerGroup);
  });
}
// Igual a addPolylineFeatures, mas pra polígono (Reserva Legal/APP, por
// alimentador) — NÃO limpa a layer antes (quem chama decide quando limpar),
// pra poder acumular vários alimentadores escolhidos no mesmo layerGroup,
// igual a addPolylineFeatures já faz pra MT.
function addPolygonFeatures(features, layerGroup, cor){
  (features||[]).forEach(f=>{
    if(!f.geometry || f.geometry.type!=="Polygon" || !f.geometry.coordinates || !f.geometry.coordinates[0]) return;
    const latlngs = f.geometry.coordinates[0].map(([lng,lat])=>[lat,lng]);
    const titulo = (f.properties && (f.properties.NOME || f.properties.nom_tema || f.properties.cod_tema)) || "Polígono";
    L.polygon(latlngs, { color:cor, weight:1.5, fillOpacity:.18 })
      .bindPopup(`<h4>${escapeHtml(String(titulo))}</h4>${popupPropriedades(f.properties)}`)
      .addTo(layerGroup);
  });
}
function renderCamadasIlustrativas(camadaLayers){
  L.polygon(CAMADA_RESERVA_LEGAL, { color:"#1E7A34", weight:1.5, fillOpacity:.18 }).bindPopup("Reserva Legal (ilustrativo)").addTo(camadaLayers.reserva);
  L.polygon(CAMADA_APP, { color:"#1B4F8C", weight:1.5, fillOpacity:.18 }).bindPopup("Área de Preservação Permanente (ilustrativo)").addTo(camadaLayers.app);
  L.polyline(REDE_AT, { color:"#B42318", weight:3.5 }).bindPopup("Rede AT (ilustrativo)").addTo(camadaLayers.at);
  REDE_MT_REAL.forEach(([codId, fases, cond, comp, pts])=>{
    L.polyline(pts, { color:"#6D28D9", weight:2.4 })
      .bindPopup(`<h4>Trecho MT ${escapeHtml(codId)}</h4><dl><dt>Fases</dt><dd>${escapeHtml(fases)}</dd><dt>Condutor</dt><dd>${escapeHtml(cond)}</dd><dt>Comprimento</dt><dd>${comp} m</dd></dl>`)
      .addTo(camadaLayers.mt);
  });
  REDE_BT.forEach(seg=> L.polyline(seg, { color:"#F37020", weight:1.8, dashArray:"4 3" }).addTo(camadaLayers.bt));
}

let mapManutencao = null;
let mapaCamadaLayersAtual = null;
let mapaVeraCarregada = false;
/* Esconder o painel lateral ("Filtros" + "Camadas do mapa") pra deixar o
   mapa maior (pedido do Mario: "o mapa é meio que a principal ferramenta,
   quanto maior ele for melhor é"). Lembrado entre visitas via localStorage
   (sem servidor envolvido — é só uma preferência de tela, não dado da
   base), igual ao padrão já usado pra "alimentador recém-importado". */
let mapaSidebarColapsada = true;   // v2.15.2: painel de filtros/camadas começa fechado (mapa em destaque)
/* v2.13.8 - paineis do lado do mapa: Filtros comeca fechado, Camadas aberto; lembra o que o usuario abrir/fechar (render() refaz a tela a cada filtro) */
/* v2.15.18 - o painel do mapa agora tem ABAS (Filtros / Camadas / Visualização) em vez de 3 seções que abrem e fecham; lembra a última aba */
let mapaPainelAba = "filtros";
try{ const a = localStorage.getItem("spark_mapa_painel_aba"); if(a==="filtros"||a==="camadas"||a==="visual") mapaPainelAba = a; }catch(e){ /* sem localStorage: começa em Filtros */ }
function setMapaPainelAba(a){
  mapaPainelAba = a;
  try{ localStorage.setItem("spark_mapa_painel_aba", a); }catch(e){}
  document.querySelectorAll("#mapaSidebarCard .mapa-abas [data-aba]").forEach(b=>{ const ativa = b.dataset.aba===a; b.classList.toggle("ativa", ativa); b.setAttribute("aria-selected", ativa ? "true" : "false"); });
  document.querySelectorAll("#mapaSidebarCard .mapa-aba").forEach(s=>{ s.hidden = s.dataset.aba!==a; });
}
try{ mapaSidebarColapsada = localStorage.getItem("spark_mapa_painel_aberto") !== "1"; }catch(e){ /* localStorage indisponível — começa fechado, sem quebrar nada */ }
let mapaMtDisponiveis = [];      // [{ctmt, nome}]
let mapaMtSelecionados = [];    // array de códigos CTMT, ou ["__todos__"]; default vazio
                                 // (pedido do Mario: "Todos" carregando de cara deixa o
                                 // mapa pesado demais com os 335 alimentadores reais)
let filtroPrioridadeEW = null;   // null = todos, true/false = filtra
let filtroOrigem = null;         // v2.15.9 - null = todos, "SGM" ou "SIGOD"
let filtroEquipe = new Set();     // vazio = todas; senão os equipeId escolhidos (v3.2.2: seleção múltipla)
let filtroExecucaoDe = null;     // "YYYY-MM-DD" ou null
let filtroExecucaoAte = null;    // "YYYY-MM-DD" ou null
let filtroAberturaDe = null;     // v3.13.0 - "YYYY-MM-DD" ou null (data de abertura/criação da OS)
let filtroAberturaAte = null;
let filtroPolo = new Set();       // vazio = todos; senão os municípios/polos escolhidos
let filtroRegional = new Set();   // vazio = todas; senão as regionais escolhidas

/* Busca por coordenada (pedido do Mario: "eventualmente nós temos
   reclamações e precisamos encontrar os lugares no mapa... escrever uma
   coordenada... e esse ponto aparecer no mapa, pro meu programador saber o
   que tem de pendente perto"). Não filtra a tabela nem o state - só marca
   um ponto no mapa (pino diferente dos marcadores de OS, pra não confundir
   com uma OS de verdade) e centraliza/dá zoom nele, pra o programador ver
   visualmente o que já está pendente ao redor antes de programar a
   reclamação. coordenadaBuscaTexto mantém o que foi digitado entre
   re-renders (ex.: ao ligar/desligar uma camada); coordenadaBuscaMarker é
   o L.marker em si, recriado a cada busca nova e removido do mapa em
   limparCoordenadaBusca(). */
let coordenadaBuscaTexto = "";
let coordenadaBuscaMarker = null;

/* município/polo e regional de uma OS — não vêm gravados na OS (ela só tem
   "alimentador"), são cruzados com state.mapaLocalidades (ver
   Get-MapaAlimentadorMunicipio/Get-MapaMunicipioLocalidade, Geografia.ps1,
   carregado uma vez no boot — ver loadStateFromApi em api.js). Uma OS cujo
   alimentador não tem nenhum ponto de Proteção importado ainda devolve
   null nos dois (mesmo critério do Km de rede por cidade na Visão Geral —
   fica "sem dado", não é chutado). */
/* v2.13.0 - Polo/Regional da OS vêm do cruzamento Proteção x Vão feito no
   Controller (alimentador -> polo/regional). A chave é normalizada
   (maiúscula, sem espaços nas pontas) dos dois lados, porque o código do
   alimentador da OS (GRID) e o da Proteção nem sempre vêm com a mesma
   caixa/espaçamento. O mapa normalizado é montado uma vez por carga. */
function normalizarAlimentador(a){ return String(a==null?"":a).trim().toUpperCase(); }
function mapaLocalidadesNormalizado(){
  const ml = state.mapaLocalidades || {};
  if(ml._normFonte === ml.porAlimentador && ml._norm) return ml._norm;
  const polo = {}, regional = {};
  Object.keys(ml.porAlimentador||{}).forEach(k=>{ polo[normalizarAlimentador(k)] = ml.porAlimentador[k]; });
  Object.keys(ml.regionalPorAlimentador||{}).forEach(k=>{ regional[normalizarAlimentador(k)] = ml.regionalPorAlimentador[k]; });
  ml._norm = { polo, regional };
  ml._normFonte = ml.porAlimentador;
  return ml._norm;
}
function municipioDaOS(o){
  return mapaLocalidadesNormalizado().polo[normalizarAlimentador(o.alimentador)] || null;
}
/* v2.13.29 - cidade da OS: localidade do SGM/SIGOD, senao o polo (municipio) do alimentador
   cruzado com Vao/Protecao. E o que a Logistica compara para alertar. */
function cidadeDaOS(o){
  return o.localidade || o.conjunto || municipioDaOS(o) || "";
}
function regionalDaOS(o){
  const direta = mapaLocalidadesNormalizado().regional[normalizarAlimentador(o.alimentador)];
  if(direta) return direta;
  const municipio = municipioDaOS(o);
  if(!municipio) return null;
  const info = (state.mapaLocalidades.porMunicipio||{})[municipio];
  return (info && info.regional) || null;
}
/* v3.2.1 - CONJUNTO da OS: cruza o alimentador da OS com a base "Conjuntos" (Gestão de Bases),
   carregada no login (state.conjuntos, ver loadStateFromApi) e recarregada ao editar/importar.
   Mesma normalização do alimentador (maiúscula, sem espaços nas pontas). OS cujo alimentador
   não está na base fica sem conjunto (""), nunca chutado. */
function mapaConjuntosNormalizado(){
  const lista = state.conjuntos || [];
  if(state._conjuntosNormFonte === lista && state._conjuntosNorm) return state._conjuntosNorm;
  const m = {};
  lista.forEach(c=>{ const k = normalizarAlimentador(c.a); if(k && !m[k]) m[k] = c; });
  state._conjuntosNorm = m; state._conjuntosNormFonte = lista;
  return m;
}
function conjuntoInfoDaOS(o){ return mapaConjuntosNormalizado()[normalizarAlimentador(o && o.alimentador)] || null; }
function conjuntoDaOS(o){ const c = conjuntoInfoDaOS(o); return c ? (c.n || "") : ""; }
async function recarregarConjuntos(){
  try{ state.conjuntos = await apiGet("/cadastros/conjuntos/mapa", 60000); }catch(e){ /* mantém o que já tinha */ }
}
/* v3.2.2 - "Proteção-Conjunto" da programação (calendário e PDF): conjunto pelo alimentador da programação
   (ou, se faltar, pelo alimentador de uma OS vinculada) */
function conjuntoDaProgramacao(p){
  let c = conjuntoDaOS({ alimentador:p.alimentador });
  if(!c){ for(const id of (p.osIds||[])){ const o = osPorId(id); if(o){ c = conjuntoDaOS(o); if(c) break; } } }
  return c;
}
function protecaoConjuntoTexto(p){ const c = conjuntoDaProgramacao(p); return (p.protecaoId||"—") + (c ? " | "+c : ""); }
function polosDisponiveis(){
  const set = new Set();
  state.manutencaoOS.forEach(o=>{ const m = municipioDaOS(o); if(m) set.add(m); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
}
function regionaisDisponiveis(){
  const set = new Set();
  state.manutencaoOS.forEach(o=>{ const r = regionalDaOS(o); if(r) set.add(r); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
}
/* Os breakers de "Status da OS" (Camadas do mapa) ligavam/desligavam só a
   camada do Leaflet - a grade de baixo continuava mostrando todo mundo,
   inclusive status que tinham acabado de ser desmarcados no mapa. Esse Set
   é o que fecha esse buraco: osFiltradas() também filtra por ele, então
   desmarcar "Pendente" nas camadas tira as Pendentes da tabela também, não
   só dos marcadores. Default = tudo ligado menos Cancelada, igual já era
   o padrão visual dos breakers. */
let filtroStatusAtivos = new Set(Object.keys(statusColor).filter(s=>s!=="Cancelada"));

/* Busca, paginação e seleção da tabela de OS — adicionados porque a base
   real de Podas chega a ~21 mil linhas (a de exemplo tinha só 8), e
   desenhar tudo de uma vez (tabela inteira + 21 mil marcadores no Leaflet)
   travava o navegador. A tabela agora só desenha TABELA_OS_POR_PAGINA
   linhas por vez; busca e paginação atualizam só o pedaço da tabela (e o
   estilo dos marcadores já existentes no mapa), sem reconstruir a tela
   inteira nem re-inicializar o Leaflet a cada tecla digitada. */
let filtroBuscaOS = "";
let tabelaOsPagina = 1;
const TABELA_OS_POR_PAGINA = 50;      // padrão
/* v3.10.7 - grid de OS do mapa: tamanho da página e colunas visíveis escolhidos pelo usuário (ficam salvos no navegador) */
const OS_POR_PAGINA_OPCOES = [10, 20, 50, 100, 200];
const OS_PREFS_CHAVE = "spark_os_grid_v1";
let osPorPagina = TABELA_OS_POR_PAGINA;
let osColsOcultas = new Set();      // ids das colunas que o usuário escondeu (coluna nova nasce visível)
let osColsAberto = false;           // painel "Colunas" aberto?
try{
  const j = JSON.parse(localStorage.getItem(OS_PREFS_CHAVE) || "{}");
  if(OS_POR_PAGINA_OPCOES.includes(j.porPagina)) osPorPagina = j.porPagina;
  if(Array.isArray(j.ocultas)) osColsOcultas = new Set(j.ocultas.map(String));
}catch(e){ /* localStorage indisponível — usa o padrão */ }
function salvarPrefsGridOS(){ try{ localStorage.setItem(OS_PREFS_CHAVE, JSON.stringify({ porPagina:osPorPagina, ocultas:[...osColsOcultas] })); }catch(e){} }
let osSelecionadaId = null;      // id da OS clicada na tabela (isola no mapa)
let mapaMarkersPorId = {};       // id da OS -> L.circleMarker já criado

/* Seleção por área desenhada no mapa (retângulo) — diferente da seleção de
   uma linha da tabela (osSelecionadaId, que só isola no mapa sem mudar a
   tabela): aqui o pedido foi "selecionei umas OS no mapa, quero que a
   grade de baixo filtre", então osSelecaoAreaIds (quando não-nulo) também
   entra em osFiltradas() e reduz a tabela de verdade, não só o mapa. */
let osSelecaoAreaIds = null;     // Set de ids, ou null = nenhuma seleção por área
let modoSelecaoForma = "ret";   // "ret" = retângulo, "poly" = área livre
let selecaoPoly = null; let selecaoPolyPts = []; let selecaoPolyLinha = null;
let modoSelecaoArea = false;     // true enquanto o usuário está desenhando o retângulo
let selecaoAreaRetangulo = null; // L.rectangle temporário sendo desenhado
let selecaoAreaInicio = null;    // L.LatLng do mousedown

/* Seleção por checkbox na tabela — diferente das duas seleções acima
   (que só filtram o que é MOSTRADO): esta é uma seleção de AÇÃO, pra
   juntar OS pendentes espalhadas e mandar pra uma única Programação de
   uma vez ("meus programadores têm que ver as OS pendentes no mapa e
   poder selecionar elas pra poder programar"). Só OS Pendente entram
   aqui — Despachada/Programada/Executada já têm seu próprio fluxo. */
let osSelecionadasProgramar = new Set();

/* v2.13.0 - OS "A reprogramar" também podem ser despachadas, igual Pendente. */
/* v3.8.3 - PERMISSÕES NA TELA DE PROGRAMAÇÃO: quem só visualiza não vê (nem aciona) criar / editar / cancelar.
   O Controller já recusava na hora de gravar; agora a tela também não oferece o botão. */
function progPodeCriar(){ return minhaPermissao("programacao","criar"); }
function progPodeEditar(){ return minhaPermissao("programacao","editar"); }
function progPodeExcluir(){ return minhaPermissao("programacao","excluirStatus"); }
function ehSelecionavelProgramar(o){ return progPodeCriar() && ehProgramavel(o); }
function ehProgramavel(o){ return !o._snap && o.statusOS!=="Executada" && o.statusOS!=="Cancelada" && !osAtendida(o); }   // v2.15.44: só Executada/Cancelada ficam de fora (o SPARK não fala direto com o SGM: OS devolvida pode ser reprogramada na hora)

function alternarSelecaoOsProgramar(id){
  if(osSelecionadasProgramar.has(id)) osSelecionadasProgramar.delete(id);
  else osSelecionadasProgramar.add(id);
  atualizarTabelaOS();
}
function limparSelecaoOsProgramar(){
  osSelecionadasProgramar.clear();
  atualizarTabelaOS();
}
/* Checkbox do cabeçalho (ao lado de "Status"): marca/desmarca todas as OS
   programáveis da PÁGINA exibida; "selecionar as N do filtro" estende pras
   demais páginas. Só Pendente/A reprogramar entram — as outras não têm
   como virar programação. */
function osProgramaveisDaPagina(){
  const lista = osFiltradas();
  const inicio = (tabelaOsPagina - 1) * osPorPagina;
  return lista.slice(inicio, inicio + osPorPagina).filter(ehSelecionavelProgramar);
}
function alternarSelecaoPagina(marcar){
  osProgramaveisDaPagina().forEach(o=>{ if(marcar) osSelecionadasProgramar.add(o.id); else osSelecionadasProgramar.delete(o.id); });
  atualizarTabelaOS();
}
function selecionarTodasDoFiltro(){
  osFiltradas().filter(ehSelecionavelProgramar).forEach(o=>osSelecionadasProgramar.add(o.id));
  atualizarTabelaOS();
}
function abrirProgramacaoComSelecionadas(){
  if(osSelecionadasProgramar.size === 0) return;
  if(!progPodeCriar()){ toast("Seu perfil só pode visualizar — sem permissão para criar programação."); return; }
  openProgramacaoModal(null, Array.from(osSelecionadasProgramar));
}

function osFiltradas(){
  let lista = osMapaBase();   // v3.14.0 - base viva (+ planos anteriores marcados no filtro Plano)
  if(filtroPrioridadeEW !== null) lista = lista.filter(o => !!o.prioridadeEW === filtroPrioridadeEW);
  if(filtroOrigem) lista = lista.filter(o => String(o.origem||"").toUpperCase() === filtroOrigem);
  if(filtroEquipe.size) lista = lista.filter(o => filtroEquipe.has(o.equipeId));
  if(filtroExecucaoDe || filtroExecucaoAte){
    // Só entra OS que TEM data de execução (naturalmente exclui as
    // Pendentes/Programadas, já que o pedido foi "filtro por tempo
    // (executadas)") e que cai dentro do período escolhido — comparação
    // por string "YYYY-MM-DD" funciona direto (mesmo formato, ordenável).
    lista = lista.filter(o => {
      if(!o.dataExecucao) return false;
      const d = String(o.dataExecucao).slice(0,10);
      if(filtroExecucaoDe && d < filtroExecucaoDe) return false;
      if(filtroExecucaoAte && d > filtroExecucaoAte) return false;
      return true;
    });
  }
  if(filtroAberturaDe || filtroAberturaAte){
    // v3.13.0 - período de ABERTURA: só entra OS com data de abertura dentro do intervalo
    lista = lista.filter(o => {
      if(!o.dataAbertura) return false;
      const d = String(o.dataAbertura).slice(0,10);
      if(filtroAberturaDe && d < filtroAberturaDe) return false;
      if(filtroAberturaAte && d > filtroAberturaAte) return false;
      return true;
    });
  }
  if(filtroBuscaOS.trim()){
    // v2.15.47: vários termos de uma vez, separados por vírgula, ponto e vírgula, "|", quebra de linha ou " e " (ex.: A-A1 e E-A2). Vale se a OS bater com QUALQUER um.
    const termos = buscaOSTermos(filtroBuscaOS);
    lista = lista.filter(o => {
      const campos = [o.id, o.alimentador, o.tipoServico, o.protecaoId, o.trecho, o.statusOS, o.origem, o.equipeId, o.descEsquema, o.observacao].map(v=>String(v||"").toLowerCase());
      return termos.some(q => campos.some(c => c.includes(q)));
    });
  }
  Object.keys(filtrosExtra).forEach(ch=>{
    const alvo = filtrosExtra[ch];
    if(alvo && alvo.size!==undefined){     // v3.2.2: seleção múltipla (Set)
      if(!alvo.size) return;
      lista = lista.filter(o => alvo.has(valorFiltroExtraOS(o, ch)));
      return;
    }
    const v = String(alvo).toLowerCase();
    const exato = FILTROS_EXTRA_DEF.find(d=>d.chave===ch && d.tipo==="select");
    lista = lista.filter(o => exato ? String(o[ch]==null?"":o[ch]).trim().toLowerCase()===v : String(o[ch]==null?"":o[ch]).toLowerCase().includes(v));
  });
  if(filtroServicos.size) lista = lista.filter(o => filtroServicos.has(String(o.tipoServico||"").trim()));
  if(filtroTipoEquipeExec.size) lista = lista.filter(o => filtroTipoEquipeExec.has(String(o.tipoEquipeExec||"").trim()));
  if(filtroTrecho.size) lista = lista.filter(o => filtroTrecho.has(String(o.trecho||"").trim().toUpperCase()));
  if(filtroPolo.size) lista = lista.filter(o => filtroPolo.has(municipioDaOS(o)));
  if(filtroRegional.size) lista = lista.filter(o => filtroRegional.has(regionalDaOS(o)));
  if(osSelecaoAreaIds) lista = lista.filter(o => osSelecaoAreaIds.has(o.id));
  lista = lista.filter(o => filtroStatusAtivos.has(o.statusOS));
  return lista;
}
/* v2.13.0 - filtros extras no padrão do BI original. Só aparecem os campos
   que as OS importadas realmente trazem (Zona, Trecho, Tensão, Grupo
   Recurso, Status Recurso, OS Primária, Plano Ano e ID Árvore VERA ainda não
   existem na base de OS — entram quando o importador passar a gravá-los). */
/* v3.3.7 - ZONA da OS (urbana/rural) pela área local do poste (ARE_LOC do PONNOT): UB = Urbana, NU = Rural */
function zonaDaOS(o){
  const a = String(o && o.posteAreaLocal || "").trim().toUpperCase();
  if(!a) return "";
  if(a==="UB") return "Urbana";
  if(a==="NU") return "Rural";
  return a;
}
const FILTROS_EXTRA_DEF = [
  { chave:"alimentador",         rotulo:"Alimentador",            tipo:"select" },   // v3.14.0 - o alimentador carimbado nas OS
  { chave:"zona",                 rotulo:"Zona",                   tipo:"select" },
  { chave:"tipoEquipeNecessaria", rotulo:"Tipo equipe necessária", tipo:"select" },
  { chave:"conjunto",             rotulo:"Conjunto",               tipo:"select" },
  { chave:"localidade",           rotulo:"Localidade",             tipo:"select" },
  { chave:"prioridade",           rotulo:"Prioridade",             tipo:"select" },
  // v2.15.47: Alimentador / Proteção / OS saíram daqui (a busca do mapa já filtra por eles, e aceita vários de uma vez)
];
/* v2.13.32 - "Tipo de equipe" vindo da coluna TIPO_EQUIPE_EXEC das grids do SGM
   (executada e pendente): seleção MÚLTIPLA — o programador marca 1 ou mais
   tipos pra achar as OS e despachar pro tipo certo de equipe. */
/* v2.15.7 - "Trecho" (T1, T2, T3, T4) vindo da coluna Trecho das grids do SGM:
   seleção múltipla, igual ao tipo de equipe. */
let filtroTrecho = new Set();
function toggleTrecho(v, marcado){
  if(marcado) filtroTrecho.add(v); else filtroTrecho.delete(v);
  tabelaOsPagina = 1;
  mapaPainelAba = "filtros";
  render();
}
function limparTrecho(){ filtroTrecho = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
/* v3.2.2 - COMBO DE SELEÇÃO MÚLTIPLA dos filtros (mesmo visual do filtro de alimentador: botão com seta,
   painel com busca, "Todos", "Limpar seleção" e uma caixinha por item). Sem nada marcado = sem filtro (Todos).
   O painel fica ABERTO depois de cada clique (a tela é redesenhada, então guardamos qual está aberto, o texto
   da busca e a posição da rolagem). */
let msAbertoId = null; const msBusca = {}; const msRolagem = {};
function msAberto(id, aberto){ if(aberto) msAbertoId = id; else if(msAbertoId===id) msAbertoId = null; }
function msFiltrar(id, termo, el){
  msBusca[id] = termo;
  const t = String(termo||"").trim().toLowerCase();
  const host = el.closest("details");
  if(host) host.querySelectorAll(".alimentador-multiselect-list .alimentador-multiselect-item").forEach(it=>{
    it.style.display = (!t || (it.getAttribute("data-nome")||"").includes(t)) ? "" : "none";
  });
}
function msResumo(sel, total, todosTxt, nomeUnico){
  if(sel.size===0) return `${todosTxt} (${total})`;
  if(sel.size===1) return nomeUnico;
  return `${sel.size} de ${total} selecionado(s)`;
}
/* opcoes: [{v:valor, t:texto exibido}] ou strings; sel: Set; fnToggle(valor, marcado) e fnLimpar() = nomes de funções globais */
function multiComboHtml(id, rotulo, opcoes, sel, fnToggle, fnLimpar, todosTxt, textoBusca, extra){
  extra = extra || {};
  const ops = opcoes.map(o=> (typeof o==="string") ? { v:o, t:o } : o);
  const t = String(msBusca[id]||"").trim().toLowerCase();
  const unico = sel.size===1 ? (((ops.find(o=>sel.has(o.v))||{}).t) || [...sel][0]) : "";
  return `<div class="field"><label>${escapeHtml(rotulo)}</label>
    <details class="alimentador-multiselect" ${msAbertoId===id?"open":""} ontoggle="msAberto('${id}', this.open)" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
      <summary>${escapeHtml(extra.resumo || msResumo(sel, ops.length, todosTxt||"Todos", unico))}</summary>
      <div class="alimentador-multiselect-panel">
        <input type="text" class="alimentador-multiselect-search" placeholder="${escapeHtml(textoBusca||"Buscar…")}" value="${escapeHtml(msBusca[id]||"")}" oninput="msFiltrar('${id}', this.value, this)">
        <div class="alimentador-multiselect-actions">
          ${extra.semTodos ? "" : `<label class="alimentador-multiselect-item alimentador-multiselect-todos">
            <input type="checkbox" ${sel.size===0?"checked":""} onchange="${fnLimpar}()"><span>Todos</span>
          </label>`}
          <button type="button" class="alimentador-multiselect-clear" onclick="${fnLimpar}()">${extra.limparTxt || "Limpar seleção"}</button>
        </div>
        <div class="alimentador-multiselect-divider"></div>
        <div class="alimentador-multiselect-list" onscroll="msRolagem['${id}']=this.scrollTop" data-ms-id="${id}">
          ${ops.map(o=>`<label class="alimentador-multiselect-item" data-nome="${escapeHtml(String(o.t).toLowerCase())}" ${t && !String(o.t).toLowerCase().includes(t)?'style="display:none"':""}>
            <input type="checkbox" ${sel.has(o.v)?"checked":""} onchange="${fnToggle}(${escapeHtml(JSON.stringify(o.v))}, this.checked)"><span>${escapeHtml(o.t)}</span></label>`).join("")}
        </div>
      </div>
    </details></div>`;
}
/* devolve a rolagem da lista do painel aberto depois que a tela é redesenhada */
function msRestaurarRolagem(){
  document.querySelectorAll(".alimentador-multiselect-list[data-ms-id]").forEach(l=>{
    const y = msRolagem[l.getAttribute("data-ms-id")]; if(y) l.scrollTop = y;
  });
}
function filtroTrechoHtml(){
  const cont = {};
  state.manutencaoOS.forEach(o=>{ const v = String(o.trecho||"").trim().toUpperCase(); if(v) cont[v] = (cont[v]||0)+1; });
  const vals = Object.keys(cont).sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  if(vals.length===0) return "";
  return multiComboHtml("f_trecho","Trecho", vals.map(v=>({v, t:`${v} (${cont[v].toLocaleString("pt-BR")})`})), filtroTrecho, "toggleTrecho", "limparTrecho", "Todos");
}
let filtroServicos = new Set();
function toggleServico(v, marcado){
  if(marcado) filtroServicos.add(v); else filtroServicos.delete(v);
  tabelaOsPagina = 1; mapaPainelAba = "filtros"; render();
}
function limparServicos(){ filtroServicos = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function filtroServicosHtml(){
  const cont = {};
  state.manutencaoOS.forEach(o=>{ const v = String(o.tipoServico||"").trim(); if(v) cont[v] = (cont[v]||0)+1; });
  const vals = Object.keys(cont).sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
  if(vals.length===0) return "";
  return multiComboHtml("f_servico","Serviço", vals.map(v=>({v, t:v})), filtroServicos, "toggleServico", "limparServicos", "Todos");
}
let filtroTipoEquipeExec = new Set();
function toggleTipoEquipeExec(v, marcado){
  if(marcado) filtroTipoEquipeExec.add(v); else filtroTipoEquipeExec.delete(v);
  tabelaOsPagina = 1;
  mapaPainelAba = "filtros";
  render();
}
function limparTipoEquipeExec(){ filtroTipoEquipeExec = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function filtroTipoEquipeExecHtml(){
  const vals = valoresDistintosOS("tipoEquipeExec");
  if(vals.length===0) return "";
  const cont = {};
  state.manutencaoOS.forEach(o=>{ const v = String(o.tipoEquipeExec||"").trim(); if(v) cont[v] = (cont[v]||0)+1; });
  return multiComboHtml("f_tipoeq","Tipo de equipe (grid)", vals.map(v=>({v, t:`${v} (${(cont[v]||0).toLocaleString("pt-BR")})`})), filtroTipoEquipeExec, "toggleTipoEquipeExec", "limparTipoEquipeExec", "Todos");
}
let filtrosExtra = {};
let _filtrosExtraCache = null, _filtrosExtraFonte = null;
/* valor de uma OS num filtro extra; "conjunto" vem da base Conjuntos (cruzamento pelo alimentador) */
function valorFiltroExtraOS(o, chave){
  const v = chave==="conjunto" ? conjuntoDaOS(o) : (chave==="zona" ? zonaDaOS(o) : o[chave]);
  return (v===undefined || v===null) ? "" : String(v).trim();
}
let _filtrosExtraConj = null;
function valoresDistintosOS(chave){
  if(_filtrosExtraFonte !== osMapaBase() || _filtrosExtraConj !== state.conjuntos){ _filtrosExtraCache = {}; _filtrosExtraFonte = osMapaBase(); _filtrosExtraConj = state.conjuntos; }
  if(_filtrosExtraCache[chave]) return _filtrosExtraCache[chave];
  const set = new Set();
  osMapaBase().forEach(o=>{ const v = valorFiltroExtraOS(o, chave); if(v!==undefined && v!==null && String(v).trim()!=="") set.add(String(v).trim()); });
  return (_filtrosExtraCache[chave] = Array.from(set).sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base",numeric:true})));
}
function setFiltroExtra(chave, v){
  if(v) filtrosExtra[chave] = v; else delete filtrosExtra[chave];
  tabelaOsPagina = 1;
  render();
}
function toggleFiltroExtra(chave, v, m){
  let set = filtrosExtra[chave];
  if(!set || set.size===undefined){ set = new Set(); filtrosExtra[chave] = set; }
  if(m) set.add(v); else set.delete(v);
  if(!set.size) delete filtrosExtra[chave];
  tabelaOsPagina = 1; mapaPainelAba = "filtros"; render();
}
FILTROS_EXTRA_DEF.forEach(d=>{
  window["toggleFiltroExtra_"+d.chave] = (v,m)=>toggleFiltroExtra(d.chave, v, m);
  window["limparFiltroExtra_"+d.chave] = ()=>limparFiltroExtraUm(d.chave);
});
function limparFiltroExtraUm(chave){ delete filtrosExtra[chave]; tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
/* v3.3.4 - botão ao lado do funil do mapa: limpa tudo (painel + busca + seleção por área + pino da coordenada) */
function mapaTemFiltros(){
  return !!(filtroEquipe.size || filtroPrioridadeEW!==null || filtroExecucaoDe || filtroExecucaoAte || filtroAberturaDe || filtroAberturaAte || histMapa.sel.size || filtroPolo.size || filtroRegional.size || filtroTrecho.size || filtroServicos.size || filtroTipoEquipeExec.size || filtroOrigem
    || Object.values(filtrosExtra||{}).some(v=>v && (v.size===undefined ? true : v.size>0))
    || String(filtroBuscaOS||"").trim() || osSelecionadaId || osSelecaoAreaIds || coordenadaBuscaMarker);
}
function atualizarBotaoLimparTudo(){ const b = document.getElementById("btnLimparTudoMapa"); if(b) b.style.display = mapaTemFiltros() ? "flex" : "none"; }
function limparTudoMapa(){
  filtroBuscaOS = ""; osSelecionadaId = null; osSelecaoAreaIds = null;
  limparCoordenadaBusca();
  limparFiltrosExtra();
}
function limparFiltrosExtra(){
  filtrosExtra = {}; filtroServicos = new Set(); filtroTipoEquipeExec = new Set(); filtroTrecho = new Set(); filtroEquipe = new Set(); filtroPolo = new Set(); filtroRegional = new Set();
  filtroPrioridadeEW = null; filtroOrigem = null; filtroExecucaoDe = null; filtroExecucaoAte = null; filtroAberturaDe = null; filtroAberturaAte = null; histMapa.sel.clear(); histMapa.atual = true; histMapa.base = null;
  tabelaOsPagina = 1;
  render();
}
function filtrosExtraHtml(soChaves, excetoChaves){
  return FILTROS_EXTRA_DEF.filter(d=>(!soChaves || soChaves.includes(d.chave)) && !(excetoChaves && excetoChaves.includes(d.chave))).map(d=>{
    const vals = valoresDistintosOS(d.chave);
    if(vals.length===0) return "";
    const atual = filtrosExtra[d.chave] || "";
    if(d.tipo==="select" && vals.length<=1500){
      const selSet = (atual && atual.size!==undefined) ? atual : new Set();
      return multiComboHtml("f_x_"+d.chave, d.rotulo, vals.map(v=>({v,t:v})), selSet, "toggleFiltroExtra_"+d.chave, "limparFiltroExtra_"+d.chave, "Todos");
    }
    if(d.chave==="protecaoId"){
      // v2.15.7 - são milhares de proteções: só digita (Enter ou sair do campo) e filtra por "contém"
      return `<div class="field"><label>${d.rotulo}</label>
        <input type="text" value="${escapeHtml(atual)}" placeholder="Digite o número da proteção…" onchange="setFiltroExtra('${d.chave}', this.value.trim())"></div>`;
    }
    return `<div class="field"><label>${d.rotulo}</label>
      <input type="text" list="dl_${d.chave}" value="${escapeHtml(atual)}" placeholder="Digite ou escolha…" onchange="setFiltroExtra('${d.chave}', this.value.trim())">
      <datalist id="dl_${d.chave}">${vals.slice(0,500).map(v=>`<option value="${escapeHtml(v)}">`).join("")}</datalist></div>`;
  }).join("");
}
function setFiltroOrigem(v){
  filtroOrigem = v;
  tabelaOsPagina = 1;
  render();
}
function setFiltroPrioridadeEW(v){
  filtroPrioridadeEW = v;
  tabelaOsPagina = 1;
  render();
}
function _tgSet(set, v, m){ if(m) set.add(v); else set.delete(v); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function toggleFiltroEquipe(v, m){ _tgSet(filtroEquipe, v, m); }
function limparFiltroEquipe(){ filtroEquipe = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function toggleFiltroPolo(v, m){ _tgSet(filtroPolo, v, m); }
function limparFiltroPolo(){ filtroPolo = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function toggleFiltroRegional(v, m){ _tgSet(filtroRegional, v, m); }
function limparFiltroRegional(){ filtroRegional = new Set(); tabelaOsPagina = 1; mapaPainelAba = "filtros"; render(); }
function setFiltroExecucaoPeriodo(de, ate){
  if(de !== undefined) filtroExecucaoDe = de || null;
  if(ate !== undefined) filtroExecucaoAte = ate || null;
  tabelaOsPagina = 1;
  render();
}
function setFiltroAberturaPeriodo(de, ate){
  if(de !== undefined) filtroAberturaDe = de || null;
  if(ate !== undefined) filtroAberturaAte = ate || null;
  tabelaOsPagina = 1;
  render();
}
function limparFiltroAberturaPeriodo(){
  filtroAberturaDe = null; filtroAberturaAte = null;
  tabelaOsPagina = 1;
  render();
}
function limparFiltroExecucaoPeriodo(){
  filtroExecucaoDe = null;
  filtroExecucaoAte = null;
  tabelaOsPagina = 1;
  render();
}

/* ---- esconder/mostrar o painel lateral (Filtros + Camadas do mapa) ----
   Troca só a classe do grid e o display do card, sem chamar render() — um
   render() completo aqui destruiria e recriaria o Leaflet do zero (ver
   initMapaManutencao), o que para uma base real de ~21 mil OS é lento e
   pisca a tela à toa por uma simples troca de layout. */
function alternarSidebarMapa(){
  mapaSidebarColapsada = !mapaSidebarColapsada;
  try{ localStorage.setItem("spark_mapa_painel_aberto", mapaSidebarColapsada ? "0" : "1"); }catch(e){ /* sem localStorage: não lembra entre visitas */ }
  const wrap = document.getElementById("mapaGridWrap");
  const card = document.getElementById("mapaSidebarCard");
  const btn = document.getElementById("btnColapsarSidebarMapa");
  if(wrap) wrap.classList.toggle("mapa-sidebar-colapsada", mapaSidebarColapsada);
  if(card) card.style.display = mapaSidebarColapsada ? "none" : "";
  if(btn) btn.classList.toggle("ativo", !mapaSidebarColapsada);
  // o painel flutua por cima do mapa: o tamanho do mapa não muda, não precisa invalidateSize
}

function coordenadaIcon(){
  // Pino vermelho (gota), bem diferente dos círculos coloridos por status
  // usados nas OS - pra ninguém confundir "onde é a reclamação" com "uma
  // OS de verdade nesse ponto".
  return L.divIcon({
    className:"",
    html:`<div style="width:26px; height:34px; transform:translate(-13px,-30px);">
      <svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 21 13 21s13-11.3 13-21C26 5.8 20.2 0 13 0z" fill="#B42318" stroke="#fff" stroke-width="1.5"/><circle cx="13" cy="13" r="5" fill="#fff"/></svg>
    </div>`,
    iconSize:[26,34], iconAnchor:[13,34],
  });
}
/* Lê "lat, lng" (aceita vírgula ou espaço como separador, com ou sem
   espaço depois da vírgula - cobre o formato que o Google Maps/WhatsApp
   costuma mandar quando alguém copia uma localização) e valida a faixa de
   verdade (lat -90..90, lng -180..180) antes de desenhar - uma coordenada
   fora da faixa quase sempre é lat/lng trocados ou um número colado
   errado, e silenciosamente centralizar o mapa em -55 de latitude (fora
   do Brasil) ia confundir mais do que ajudar. */
function buscarCoordenadaNoMapa(){
  const input = document.getElementById("buscaCoordenadaInput");
  const erroEl = document.getElementById("buscaCoordenadaErro");
  const texto = input ? input.value.trim() : "";
  coordenadaBuscaTexto = texto;
  const mostrarErro = (msg)=>{
    if(erroEl){ erroEl.textContent = msg; erroEl.style.display = "block"; }
    else toast(msg);
  };
  if(erroEl) erroEl.style.display = "none";
  if(!texto){ mostrarErro("Cole uma coordenada, tipo -22.324544, -55.432545."); return; }

  const partes = texto.split(/[,;\s]+/).map(p=>p.trim()).filter(Boolean);
  if(partes.length !== 2){
    mostrarErro("Formato esperado: latitude, longitude (ex.: -22.324544, -55.432545).");
    return;
  }
  const lat = parseFloat(partes[0].replace(",", "."));
  const lng = parseFloat(partes[1].replace(",", "."));
  if(!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180){
    mostrarErro("Coordenada inválida — confira se não trocou latitude com longitude.");
    return;
  }
  if(!mapManutencao){ mostrarErro("Mapa ainda carregando — tenta de novo em um instante."); return; }

  if(coordenadaBuscaMarker) mapManutencao.removeLayer(coordenadaBuscaMarker);
  coordenadaBuscaMarker = L.marker([lat, lng], { icon:coordenadaIcon(), zIndexOffset:1000 })
    .bindPopup(`<h4>Coordenada buscada</h4><dl><dt>Lat, Lng</dt><dd>${lat.toFixed(6)}, ${lng.toFixed(6)}</dd></dl><p style="font-size:11.5px; color:var(--muted); margin:4px 0 0;">Veja no mapa as OS pendentes perto desse ponto antes de programar a reclamação.</p>`)
    .addTo(mapManutencao)
    .openPopup();
  mapManutencao.setView([lat, lng], 15);
  atualizarBotaoLimparTudo();

  // Reconstrói só o botão "Ir"/input (não a tela toda) pra mostrar o "x" de
  // limpar sem perder o zoom/posição que acabou de ser aplicado.
  const btnWrap = input ? input.closest("div") : null;
  if(btnWrap && !document.getElementById("btnLimparCoordenadaBusca")){
    const btnLimpar = document.createElement("button");
    btnLimpar.id = "btnLimparCoordenadaBusca";
    btnLimpar.className = "btn btn-ghost";
    btnLimpar.style.cssText = "padding:6px 10px; font-size:12px;";
    btnLimpar.title = "Tira o pino da coordenada buscada";
    btnLimpar.innerHTML = `${ic("close")||"×"}`;
    btnLimpar.onclick = limparCoordenadaBusca;
    btnWrap.appendChild(btnLimpar);
  }
}
/* ---- v3.8.2 - VÁRIAS COORDENADAS: botão "+" ao lado do "Ir" abre uma caixa onde se cola uma coordenada por linha
   (lat, lng — também aceita ";" entre elas). "Mostrar no mapa" põe um pino numerado (1, 2, 3...) em cada uma e
   enquadra todas na tela. O pino único do campo ao lado continua funcionando separado. ---- */
let coordMultiAberto = false;
let coordMultiTexto = "";
let coordMultiGrupo = null;     // L.layerGroup com os pinos numerados (recriado a cada desenho / a cada render do mapa)
let coordMultiAviso = "";
function coordParseLista(texto){
  const ok = [], erros = [];
  String(texto||"").split(/[\n;]+/).map(l=>l.trim()).filter(Boolean).forEach((linha,i)=>{
    const partes = linha.split(/[,\s]+/).map(p=>p.trim()).filter(Boolean);
    const lat = parseFloat((partes[0]||"").replace(",", ".")), lng = parseFloat((partes[1]||"").replace(",", "."));
    if(partes.length < 2 || !isFinite(lat) || !isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) erros.push(linha);
    else ok.push({ lat, lng, linha });
  });
  return { ok, erros };
}
function coordNumIcon(n){
  return L.divIcon({ className:"", iconSize:[28,36], iconAnchor:[14,36],
    html:`<div style="width:28px; height:36px; transform:translate(-14px,-34px); position:relative;">
      <svg width="28" height="36" viewBox="0 0 26 34"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 21 13 21s13-11.3 13-21C26 5.8 20.2 0 13 0z" fill="#B42318" stroke="#fff" stroke-width="1.5"/></svg>
      <span style="position:absolute; left:0; right:0; top:6px; text-align:center; color:#fff; font:700 ${n>99?9:11}px/14px system-ui,sans-serif;">${n}</span></div>` });
}
function coordMultiPainelHtml(){
  if(!coordMultiAberto) return "";
  return `<div class="coord-multi" id="coordMultiPainel">
    <div class="coord-multi-topo"><strong>Várias coordenadas</strong><button type="button" class="mapa-painel-fechar" onclick="coordMultiAlternar()" title="Fechar" aria-label="Fechar">×</button></div>
    <p style="color:var(--muted); font-size:11.5px; margin:0 0 6px;">Cole uma coordenada por linha (latitude, longitude). Dá para colar direto de uma coluna do Excel.</p>
    <textarea id="coordMultiTexto" rows="6" spellcheck="false" placeholder="-22.837933, -46.115550&#10;-22.840100, -46.118200" oninput="coordMultiTexto=this.value">${escapeHtml(coordMultiTexto)}</textarea>
    <div id="coordMultiAviso" class="coord-multi-aviso">${coordMultiAviso}</div>
    <div class="coord-multi-botoes"><button type="button" class="btn btn-primary btn-sm" onclick="coordMultiMostrar()">Mostrar no mapa</button><button type="button" class="btn btn-ghost btn-sm" onclick="coordMultiLimpar()">Limpar pontos</button></div>
  </div>`;
}
function coordMultiAlternar(){
  coordMultiAberto = !coordMultiAberto;
  if(coordMultiAberto && typeof rankMapaFechar==="function") rankMapaFechar();
  const area = document.querySelector("#mapaGridWrap .mapa-area");
  let p = document.getElementById("coordMultiPainel");
  if(p) p.remove();
  if(coordMultiAberto && area){
    const tmp = document.createElement("div"); tmp.innerHTML = coordMultiPainelHtml();
    area.appendChild(tmp.firstElementChild);
    // se a caixa estava vazia, aproveita o que já está no campo de coordenada
    const ta = document.getElementById("coordMultiTexto");
    if(ta && !ta.value.trim()){ const inp = document.getElementById("buscaCoordenadaInput"); if(inp && inp.value.trim()){ ta.value = inp.value.trim(); coordMultiTexto = ta.value; } }
    if(ta) ta.focus();
  }
  const b = document.getElementById("btnCoordMulti");
  if(b){ const on = coordMultiAberto || !!coordMultiGrupo; b.classList.toggle("btn-primary", on); b.classList.toggle("btn-ghost", !on); }
}
function coordMultiDesenhar(enquadrar){
  if(!mapManutencao) return;
  if(coordMultiGrupo){ mapManutencao.removeLayer(coordMultiGrupo); coordMultiGrupo = null; }
  const { ok, erros } = coordParseLista(coordMultiTexto);
  coordMultiAviso = ok.length || erros.length
    ? `<b>${ok.length}</b> ponto(s) no mapa${erros.length ? ` · <span style="color:var(--bad-fg);">${erros.length} linha(s) ignorada(s): ${erros.slice(0,3).map(escapeHtml).join(" | ")}${erros.length>3?" …":""}</span>` : ""}` : "";
  if(ok.length){
    coordMultiGrupo = L.layerGroup(ok.map((c,i)=>L.marker([c.lat,c.lng], { icon:coordNumIcon(i+1), zIndexOffset:1000 })
      .bindPopup(`<h4>Coordenada ${i+1}</h4><dl><dt>Lat, Lng</dt><dd>${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</dd></dl>`))).addTo(mapManutencao);
    if(enquadrar){
      const pts = ok.map(c=>[c.lat,c.lng]);
      if(pts.length===1) mapManutencao.setView(pts[0], 16);
      else mapManutencao.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom:17 });
    }
  }
  const av = document.getElementById("coordMultiAviso"); if(av) av.innerHTML = coordMultiAviso;
  const b = document.getElementById("btnCoordMulti");
  if(b){ const on = coordMultiAberto || !!coordMultiGrupo; b.classList.toggle("btn-primary", on); b.classList.toggle("btn-ghost", !on); }
}
function coordMultiMostrar(){
  const ta = document.getElementById("coordMultiTexto"); if(ta) coordMultiTexto = ta.value;
  if(!coordMultiTexto.trim()){ coordMultiAviso = `<span style="color:var(--bad-fg);">Cole pelo menos uma coordenada.</span>`; const av = document.getElementById("coordMultiAviso"); if(av) av.innerHTML = coordMultiAviso; return; }
  coordMultiDesenhar(true);
  const x = document.getElementById("btnLimparCoordenadaBusca");
  if(!x){ const inp = document.getElementById("buscaCoordenadaInput"); const wrap = inp && inp.closest("div"); if(wrap && coordMultiGrupo){
    const bt = document.createElement("button"); bt.id = "btnLimparCoordenadaBusca"; bt.className = "btn btn-ghost"; bt.style.cssText = "padding:6px 10px; font-size:12px;"; bt.title = "Tira os pinos de coordenada do mapa"; bt.innerHTML = `${ic("close")||"×"}`; bt.onclick = limparCoordenadaBusca; wrap.appendChild(bt); } }
}
function coordMultiLimpar(){
  if(coordMultiGrupo && mapManutencao) mapManutencao.removeLayer(coordMultiGrupo);
  coordMultiGrupo = null; coordMultiTexto = ""; coordMultiAviso = "";
  const ta = document.getElementById("coordMultiTexto"); if(ta) ta.value = "";
  const av = document.getElementById("coordMultiAviso"); if(av) av.innerHTML = "";
  const b = document.getElementById("btnCoordMulti");
  if(b){ b.classList.toggle("btn-primary", coordMultiAberto); b.classList.toggle("btn-ghost", !coordMultiAberto); }
  if(!coordenadaBuscaMarker){ const x = document.getElementById("btnLimparCoordenadaBusca"); if(x) x.remove(); }
}
function limparCoordenadaBusca(){
  coordMultiLimpar();
  if(coordenadaBuscaMarker && mapManutencao) mapManutencao.removeLayer(coordenadaBuscaMarker);
  coordenadaBuscaMarker = null;
  coordenadaBuscaTexto = "";
  const input = document.getElementById("buscaCoordenadaInput");
  if(input) input.value = "";
  const erroEl = document.getElementById("buscaCoordenadaErro");
  if(erroEl) erroEl.style.display = "none";
  const btnLimpar = document.getElementById("btnLimparCoordenadaBusca");
  if(btnLimpar) btnLimpar.remove();
  atualizarBotaoLimparTudo();
}

/* ---- busca (afeta tabela + mapa, sem re-render completo) ---- */
function buscaOSTermos(texto){
  return String(texto||"").toLowerCase().split(/[,;|\n]+|\s+e\s+/).map(t=>t.trim()).filter(Boolean);
}
function buscarOS(valor){
  filtroBuscaOS = valor;
  tabelaOsPagina = 1;
  atualizarBotaoLimparTudo();
  atualizarTabelaOS();
  atualizarVisibilidadeMarcadores();
  equipBuscaAgendar(valor);
}
/* v3.1.4 - busca por ENDEREÇO no mapa (Nominatim / OpenStreetMap). Não mexe na busca de OS:
   o botão 📍 troca a caixa entre "OS" e "endereço"; só a view fala com o serviço externo, e só o texto digitado sai. */
let mapaBuscaModo = "os";
let enderecoMarcador = null;
function alternarModoBusca(){
  mapaBuscaModo = mapaBuscaModo==="os" ? "endereco" : "os";
  const e = document.getElementById("endBuscaInput"), o = document.getElementById("osBuscaInput"), b = document.getElementById("btnBuscaModo"), r = document.getElementById("endBuscaRes");
  if(e) e.classList.toggle("oculto", mapaBuscaModo!=="endereco");
  if(o) o.classList.toggle("oculto", mapaBuscaModo==="endereco");
  if(b){ b.classList.toggle("ativo", mapaBuscaModo==="endereco"); b.title = mapaBuscaModo==="endereco" ? "Voltar a buscar OS" : "Buscar por endereço"; }
  if(r) r.style.display = "none";
  const alvo = mapaBuscaModo==="endereco" ? e : o; if(alvo) alvo.focus();
}
async function buscarEndereco(texto){
  const res = document.getElementById("endBuscaRes");
  const q = String(texto||"").trim();
  if(!res) return;
  if(q.length < 4){ res.style.display = "block"; res.innerHTML = `<div class="end-msg">Digite o endereço completo (rua, número e cidade).</div>`; return; }
  res.style.display = "block"; res.innerHTML = `<div class="end-msg">Buscando…</div>`;
  try{
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&viewbox=-53.2,-19.7,-44.1,-25.4&q=" + encodeURIComponent(q);
    const ctrl = new AbortController(), t = setTimeout(()=>ctrl.abort(), 12000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(t);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const lista = await r.json();
    if(!Array.isArray(lista) || !lista.length){ res.innerHTML = `<div class="end-msg">Nenhum endereço encontrado. Tente incluir a cidade ou tirar o número.</div>`; return; }
    window._endResultados = lista;
    res.innerHTML = lista.map((x,i)=>`<button type="button" class="end-item" onclick="irParaEndereco(${i})">📍 ${escapeHtml(x.display_name)}</button>`).join("") + `<div class="end-msg end-cred">Dados © colaboradores do OpenStreetMap</div>`;
  }catch(err){
    res.innerHTML = `<div class="end-msg">Não consegui buscar o endereço agora (a rede pode estar bloqueando o serviço de busca). ${escapeHtml(err && err.name==="AbortError" ? "Tempo esgotado." : "")}</div>`;
  }
}
function irParaEndereco(i){
  const x = (window._endResultados||[])[i]; if(!x || typeof mapManutencao==="undefined" || !mapManutencao) return;
  const lat = parseFloat(x.lat), lng = parseFloat(x.lon);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try{ if(enderecoMarcador) enderecoMarcador.remove(); }catch(e){}
  enderecoMarcador = L.marker([lat,lng]).addTo(mapManutencao)
    .bindPopup(`<b>${escapeHtml(x.display_name)}</b><br><a href="#" onclick="removerEnderecoMarcado(); return false;">Remover marcação</a>`).openPopup();
  mapManutencao.setView([lat,lng], 17);
  const res = document.getElementById("endBuscaRes"); if(res) res.style.display = "none";
}
function removerEnderecoMarcado(){ try{ if(enderecoMarcador) enderecoMarcador.remove(); }catch(e){} enderecoMarcador = null; }
function limparBuscaOS(){
  const input = document.getElementById("osBuscaInput");
  if(input) input.value = "";
  buscarOS("");
}

/* ---- paginação da tabela ---- */
function totalPaginasOS(lista){
  return Math.max(1, Math.ceil(lista.length / osPorPagina));
}
function irParaPaginaOS(delta){
  const lista = osFiltradas();
  const totalPag = totalPaginasOS(lista);
  tabelaOsPagina = Math.min(totalPag, Math.max(1, tabelaOsPagina + delta));
  atualizarTabelaOS();
}

/* Mostra/esconde o botão "Limpar seleção" no card do mapa — fica bem perto
   de "Selecionar no mapa", pra não depender de rolar até a tabela (o "Ver
   todas" de lá continua funcionando igual, esse aqui é só mais um atalho
   pro mesmo limparSelecaoOS()). Chamado toda vez que a seleção muda, sem
   precisar de F5 pra "destravar" a tela. */
function atualizarBotaoLimparSelecao(){
  const btn = document.getElementById("btnLimparSelecaoOS");
  if(btn) btn.style.display = (osSelecionadaId || osSelecaoAreaIds) ? "inline-flex" : "none";
  atualizarBotaoLimparTudo();
}

/* ---- clicar numa linha: isola aquela OS no mapa ---- */
function selecionarOsNaTabela(id){
  osSelecionadaId = (osSelecionadaId === id) ? null : id;
  atualizarTabelaOS();
  atualizarVisibilidadeMarcadores();
  atualizarBotaoLimparSelecao();
  const m = mapaMarkersPorId[id];
  if(osSelecionadaId && m && mapManutencao){
    if(mapaModoPontosAtual === "cluster" && mapaClusterGroup){
      // no modo agrupado o ponto pode estar dentro de um círculo: abre até ele
      setTimeout(()=>{ try{ mapaClusterGroup.zoomToShowLayer(m, ()=>m.openPopup()); }catch(e){} }, 300);
    } else {
      mapManutencao.flyTo(m.getLatLng(), Math.max(mapManutencao.getZoom(), 14));
      setTimeout(()=>{ try{ m.openPopup(); }catch(e){} }, 350);
    }
  }
}
function limparSelecaoOS(){
  osSelecionadaId = null;
  osSelecaoAreaIds = null;
  tabelaOsPagina = 1;
  atualizarTabelaOS();
  atualizarVisibilidadeMarcadores();
  atualizarBotaoLimparSelecao();
}

/* ---- seleção por área desenhada no mapa (retângulo ou área livre) ---- */
function dentroDoPoligono(lat, lng, pts){
  let dentro = false;
  for(let i=0, j=pts.length-1; i<pts.length; j=i++){
    const yi=pts[i].lat, xi=pts[i].lng, yj=pts[j].lat, xj=pts[j].lng;
    if(((yi>lat)!==(yj>lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi)+xi)) dentro = !dentro;
  }
  return dentro;
}
function atualizarBotoesSelecaoArea(){
  const r = document.getElementById("btnSelecaoArea"), p = document.getElementById("btnSelecaoPoly");
  const on = (f)=> modoSelecaoArea && modoSelecaoForma===f;
  if(r){ r.classList.toggle("btn-primary", on("ret")); r.classList.toggle("btn-ghost", !on("ret")); r.textContent = "▭ " + (on("ret") ? "Cancelar" : "Retângulo"); }
  if(p){ p.classList.toggle("btn-primary", on("poly")); p.classList.toggle("btn-ghost", !on("poly")); p.textContent = "⬠ " + (on("poly") ? "Cancelar" : "Área livre"); }
  const hint = document.getElementById("mapaSelecaoAreaHint");
  const txt = document.getElementById("mapaSelecaoAreaHintTxt");
  if(txt) txt.textContent = modoSelecaoForma==="poly"
    ? " Clique ponto a ponto no mapa pra desenhar a área; duplo clique (ou Enter) fecha, Esc cancela."
    : " Clique e arraste no mapa pra selecionar as OS dessa área — a tabela abaixo filtra pra elas.";
  if(hint) hint.style.display = modoSelecaoArea ? "block" : "none";
}
function alternarModoSelecaoArea(forma){
  forma = forma || modoSelecaoForma;
  if(modoSelecaoArea && forma !== modoSelecaoForma){
    // troca de forma sem sair do modo
    cancelarDesenhoSelecaoArea();
    modoSelecaoForma = forma;
  } else {
    modoSelecaoForma = forma;
    modoSelecaoArea = !modoSelecaoArea;
    if(!modoSelecaoArea) cancelarDesenhoSelecaoArea();
  }
  if(mapManutencao){
    // retângulo: arrastar desenha, então trava o arrasto; área livre: clicar adiciona pontos, mapa continua arrastável
    mapManutencao.dragging[(modoSelecaoArea && modoSelecaoForma==="ret") ? "disable" : "enable"]();
    mapManutencao.doubleClickZoom[modoSelecaoArea ? "disable" : "enable"]();
    const el = mapManutencao.getContainer();
    if(el) el.style.cursor = modoSelecaoArea ? "crosshair" : "";
  }
  atualizarBotoesSelecaoArea();
}
function cancelarDesenhoSelecaoArea(){
  if(selecaoAreaRetangulo && mapManutencao) mapManutencao.removeLayer(selecaoAreaRetangulo);
  selecaoAreaRetangulo = null;
  selecaoAreaInicio = null;
  if(selecaoPoly && mapManutencao) mapManutencao.removeLayer(selecaoPoly);
  if(selecaoPolyLinha && mapManutencao) mapManutencao.removeLayer(selecaoPolyLinha);
  selecaoPoly = null; selecaoPolyLinha = null; selecaoPolyPts = [];
}
function aplicarSelecaoPorArea(testaPonto){
  const base = osMapaBase().filter(o =>
    (filtroPrioridadeEW === null || !!o.prioridadeEW === filtroPrioridadeEW) && typeof o.lat === "number" && typeof o.lng === "number" && testaPonto(o.lat, o.lng)
  );
  if(base.length === 0){
    toast("Nenhuma OS dentro da área desenhada.");
  } else {
    osSelecaoAreaIds = new Set(base.map(o=>o.id));
    osSelecionadaId = null;
    tabelaOsPagina = 1;
    atualizarTabelaOS();
    atualizarVisibilidadeMarcadores();
    atualizarBotaoLimparSelecao();
    toast(`${base.length} OS selecionada(s) na área — a tabela abaixo foi filtrada.`);
  }
}
function fecharPoligonoSelecao(){
  const pts = selecaoPolyPts.slice();
  cancelarDesenhoSelecaoArea();
  if(pts.length < 3){ toast("Marque pelo menos 3 pontos pra fechar a área."); return; }
  aplicarSelecaoPorArea((lat,lng)=>dentroDoPoligono(lat,lng,pts));
  alternarModoSelecaoArea();
}
function iniciarSelecaoAreaMapa(){
  if(!mapManutencao) return;
  mapManutencao.on("mousedown", (e)=>{
    if(!modoSelecaoArea || modoSelecaoForma!=="ret") return;
    selecaoAreaInicio = e.latlng;
    selecaoAreaRetangulo = L.rectangle([e.latlng, e.latlng], { color:"#2563EB", weight:1.5, fillOpacity:.12, dashArray:"4 3" }).addTo(mapManutencao);
  });
  mapManutencao.on("mousemove", (e)=>{
    if(!modoSelecaoArea) return;
    if(modoSelecaoForma==="ret"){
      if(!selecaoAreaInicio || !selecaoAreaRetangulo) return;
      selecaoAreaRetangulo.setBounds(L.latLngBounds(selecaoAreaInicio, e.latlng));
    } else if(selecaoPolyPts.length){
      // linha elástica do último ponto até o mouse
      const pts = selecaoPolyPts.concat([e.latlng]);
      if(selecaoPolyLinha) selecaoPolyLinha.setLatLngs(pts);
    }
  });
  mapManutencao.on("mouseup", (e)=>{
    if(!modoSelecaoArea || modoSelecaoForma!=="ret" || !selecaoAreaInicio) return;
    const bounds = L.latLngBounds(selecaoAreaInicio, e.latlng);
    cancelarDesenhoSelecaoArea();
    aplicarSelecaoPorArea((lat,lng)=>bounds.contains([lat,lng]));
    alternarModoSelecaoArea();
  });
  mapManutencao.on("click", (e)=>{
    if(!modoSelecaoArea || modoSelecaoForma!=="poly") return;
    selecaoPolyPts.push(e.latlng);
    if(!selecaoPoly){
      selecaoPoly = L.polygon(selecaoPolyPts, { color:"#2563EB", weight:1.5, fillOpacity:.12, dashArray:"4 3", interactive:false }).addTo(mapManutencao);
      selecaoPolyLinha = L.polyline(selecaoPolyPts, { color:"#2563EB", weight:1.5, dashArray:"2 4", interactive:false }).addTo(mapManutencao);
    } else {
      selecaoPoly.setLatLngs(selecaoPolyPts);
    }
  });
  mapManutencao.on("dblclick", (e)=>{
    if(!modoSelecaoArea || modoSelecaoForma!=="poly") return;
    // o clique do duplo-clique já adicionou o ponto duas vezes: tira o repetido
    if(selecaoPolyPts.length > 1) selecaoPolyPts.pop();
    fecharPoligonoSelecao();
  });
}
document.addEventListener("keydown", (ev)=>{
  if(!modoSelecaoArea || modoSelecaoForma!=="poly") return;
  const t = ev.target && ev.target.tagName;
  if(t==="INPUT" || t==="TEXTAREA" || t==="SELECT") return;
  if(ev.key==="Enter"){ ev.preventDefault(); fecharPoligonoSelecao(); }
  else if(ev.key==="Escape"){ alternarModoSelecaoArea(); }
});

/* Aplica busca + seleção nos marcadores JÁ CRIADOS (sem recriar nada) —
   os que não batem com a busca, ou que não são a OS selecionada quando há
   uma selecionada, ficam invisíveis (opacity 0) em vez de removidos, pra
   não pagar o custo de tirar/recolocar milhares de marcadores nos layers
   a cada tecla digitada. */
/* =========================================================================
   v2.13.11 - menu "Visualização do mapa": fundo (ruas/satélite/claro) e jeito
   de mostrar as OS (pontos, agrupados em círculos com a contagem, ou mapa de
   calor). Escolha lembrada via localStorage. Com muitas OS (>5.000) o padrão
   é "agrupados", que evita o borrão de dezenas de milhares de bolinhas.
   ========================================================================= */
const MAPA_PREFS_CHAVE = "spark_mapa_visual";
const MAPA_FUNDOS = {
  ruas:    { rotulo:"Ruas",     url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", opts:{ maxZoom:19, attribution:"&copy; OpenStreetMap" } },
  satelite:{ rotulo:"Satélite", url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", opts:{ maxZoom:19, attribution:"Imagens &copy; Esri, Maxar, Earthstar Geographics" } },
};
const MAPA_MODOS_PONTOS = {
  pontos:  { rotulo:"Pontos",    nota:"Uma bolinha por OS, colorida pelo status." },
  cluster: { rotulo:"Agrupados", nota:"Círculos com a quantidade de OS; clique ou dê zoom para abrir. Passe o mouse num círculo para ver o previsto/realizado do grupo." },
  calor:   { rotulo:"Calor",     nota:"Quanto mais quente, mais OS naquela região. Respeita os filtros e os status ligados." },
};
let mapaFundo = "ruas";
let mapaModoPontos = null;          // null = automático (agrupados se houver muitas OS)
let mapaVisualAberto = false;
try{
  const j = JSON.parse(localStorage.getItem(MAPA_PREFS_CHAVE) || "{}");
  if(MAPA_FUNDOS[j.fundo]) mapaFundo = j.fundo;
  if(MAPA_MODOS_PONTOS[j.pontos]) mapaModoPontos = j.pontos;
  if(typeof j.aberto === "boolean") mapaVisualAberto = j.aberto;
}catch(e){ /* localStorage indisponível — usa o padrão */ }
function salvarPrefsMapa(){
  try{ localStorage.setItem(MAPA_PREFS_CHAVE, JSON.stringify({ fundo:mapaFundo, pontos:mapaModoPontos, aberto:mapaVisualAberto })); }catch(e){}
}
function modoPontosEfetivo(){
  let m = mapaModoPontos || ((osMapaBase().length > 5000) ? "cluster" : "pontos");
  if(m === "cluster" && typeof L.markerClusterGroup !== "function") m = "pontos";
  if(m === "calor" && typeof L.heatLayer !== "function") m = "pontos";
  return m;
}
let mapaFundoLayer = null;
function aplicarFundoMapa(){
  if(!mapManutencao) return;
  if(mapaFundoLayer) mapManutencao.removeLayer(mapaFundoLayer);
  const f = MAPA_FUNDOS[mapaFundo];
  mapaFundoLayer = L.tileLayer(f.url, f.opts).addTo(mapManutencao);
  mapaFundoLayer.bringToBack();
}
function setMapaFundo(v){
  if(!MAPA_FUNDOS[v]) return;
  mapaFundo = v; salvarPrefsMapa(); aplicarFundoMapa();
  document.querySelectorAll("#mapaFundoTabs .tab").forEach(b=>b.classList.toggle("active", b.dataset.v === v));
}
function setMapaPontos(v){
  if(!MAPA_MODOS_PONTOS[v]) return;
  mapaModoPontos = v; salvarPrefsMapa(); aplicarModoPontos();
  const ef = modoPontosEfetivo();
  document.querySelectorAll("#mapaPontosTabs .tab").forEach(b=>b.classList.toggle("active", b.dataset.v === ef));
  const nota = document.getElementById("mapaPontosNota");
  if(nota) nota.textContent = MAPA_MODOS_PONTOS[ef].nota;
}
function mapaVisualMenuHtml(){
  const ef = modoPontosEfetivo();
  const abas = (id, itens, atual, fn) => `<div class="tabs" id="${id}">${Object.entries(itens).map(([k,d])=>`<button class="tab ${k===atual?"active":""}" data-v="${k}" onclick="${fn}('${k}')">${d.rotulo}</button>`).join("")}</div>`;
  return `<section class="mapa-aba" data-aba="visual" role="tabpanel" ${mapaPainelAba!=='visual'?'hidden':''}>
    <div class="breaker-group">
      <span class="breaker-group-label">Fundo do mapa</span>
      ${abas("mapaFundoTabs", MAPA_FUNDOS, mapaFundo, "setMapaFundo")}
    </div>
    <div class="breaker-group">
      <span class="breaker-group-label">Como mostrar as OS</span>
      ${abas("mapaPontosTabs", MAPA_MODOS_PONTOS, ef, "setMapaPontos")}
      <p id="mapaPontosNota" style="color:var(--muted); font-size:11.5px; margin:8px 0 0;">${MAPA_MODOS_PONTOS[ef].nota}</p>
    </div>
  </section>`;
}

let mapaStatusLayersAtual = null;   // status -> L.layerGroup (modo "pontos")
let mapaModoPontosAtual = "pontos";
let mapaClusterGroup = null, mapaHeatLayer = null, mapaMarkerSelecaoCalor = null;
let _pontosTimer = null, _pontosAssinatura = "";
const ESTILO_MARCADOR_VISIVEL = { opacity:1, fillOpacity:.92 };
function osMarkersVisiveis(){
  const ids = new Set(osFiltradas().map(o=>o.id));
  const out = [];
  for(const id in mapaMarkersPorId){
    if(ids.has(id) && (!osSelecionadaId || id === osSelecionadaId)) out.push(mapaMarkersPorId[id]);
  }
  return out;
}
function fmtMil(n){ return n >= 10000 ? (n/1000).toLocaleString("pt-BR",{maximumFractionDigits:1}) + " mil" : n.toLocaleString("pt-BR"); }
function tooltipClusterHtml(c){
  const filhos = c.getAllChildMarkers();
  const r = resumoPorTipo(filhos.map(m=>m._os).filter(Boolean));
  const f = n => Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:Math.abs(n)>=1000?0:1});
  const linhas = TIPOS_SERVICO.map(([t,nome])=>{
    const x = r[t]; if(!(x.prev||x.real||x.pend)) return "";
    return `<div><b>${nome}</b> — prev. ${f(x.prev)} · real. ${f(x.real)} · pend. ${f(x.pend)}</div>`;
  }).join("");
  const cont = contagemStatusFilhos(c);
  const porStatus = Object.keys(cont).sort((x,y)=>cont[y]-cont[x]).map(st=>`<div><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${statusColor[st]||"#888"};margin-right:5px;"></span>${escapeHtml(st)}: <b>${cont[st].toLocaleString("pt-BR")}</b></div>`).join("");
  return `<div style="font-size:12px;"><b>${filhos.length.toLocaleString("pt-BR")} OS</b>${porStatus ? `<div style="margin:3px 0 4px;">${porStatus}</div>` : ""}${linhas}</div>`;
}
/* v2.14.6 - cada agrupamento vira uma "pizza" (rosca) dividida pelo status das OS,
   com as mesmas cores da legenda de Status da OS; o total fica no centro. */
function contagemStatusFilhos(c){
  const cont = {};
  c.getAllChildMarkers().forEach(m=>{ const st = (m._os && m._os.statusOS) || "?"; cont[st] = (cont[st]||0) + 1; });
  return cont;
}
function iconeClusterPizza(c){
  const n = c.getChildCount();
  const d = n < 100 ? 40 : (n < 1000 ? 48 : 58);
  const cont = contagemStatusFilhos(c);
  const ordem = Object.keys(statusColor).filter(st=>cont[st]).concat(Object.keys(cont).filter(st=>!statusColor[st]));
  const cx = d/2, R = d/2 - 1.5;          // raio da pizza (sobra 1.5px pra borda branca)
  const rr = R/2, circ = 2*Math.PI*rr;    // pizza inteira = traço grosso (largura R) num círculo de raio R/2
  let acum = 0, fatias = "";
  ordem.forEach(st=>{
    const len = circ * cont[st] / n;
    fatias += `<circle cx="${cx}" cy="${cx}" r="${rr.toFixed(2)}" fill="none" stroke="${statusColor[st]||"#888"}" stroke-width="${R.toFixed(2)}" stroke-dasharray="${len.toFixed(2)} ${(circ-len).toFixed(2)}" stroke-dashoffset="${(-acum).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
    acum += len;
  });
  const temAprl = (typeof aprlTemFilhos === "function" && aprlTemFilhos(c));   // v3.13.2 - contorno magenta no grupo que tem OS em APP/RL
  const html = `<svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}" aria-hidden="true">${fatias}<circle cx="${cx}" cy="${cx}" r="${R.toFixed(2)}" fill="none" stroke="#fff" stroke-width="1.5"/></svg><span>${fmtMil(n)}</span>`;
  return L.divIcon({ html, className:"spark-cluster spark-cluster-pizza" + (temAprl ? " aprl-anel" : ""), iconSize:[d,d] });
}
function criarClusterMapa(){
  const g = L.markerClusterGroup({
    chunkedLoading:true, chunkInterval:80, showCoverageOnHover:false,
    /* v3.10.5 - o cluster vai até o fim do zoom: de perto (zoom 16+) só agrupa o que está praticamente em cima um do outro (~14 px)
       e, no zoom máximo, clicar no grupo ABRE as OS em leque (spiderfy). Antes o cluster era desligado no zoom 16 e as OS
       com a mesma coordenada ficavam empilhadas, uma escondendo a outra. */
    maxClusterRadius: z => z >= 16 ? 14 : 55,
    spiderfyOnMaxZoom:true, zoomToBoundsOnClick:true,
    iconCreateFunction: c => iconeClusterPizza(c),
  });
  g.on("clustermouseover", e => {
    try{ e.layer.unbindTooltip(); e.layer.bindTooltip(tooltipClusterHtml(e.layer), { direction:"top", opacity:.97 }).openTooltip(); }catch(err){}
  });
  return g;
}
function criarCalorMapa(){
  return L.heatLayer([], { radius:16, blur:20, maxZoom:11, minOpacity:.3,
    gradient:{ .2:"#2c7bb6", .4:"#abd9e9", .6:"#ffffbf", .8:"#fdae61", 1:"#d7191c" } });
}
/* Troca o modo: tira tudo que o modo anterior pôs no mapa e monta o novo. */
function aplicarModoPontos(){
  if(!mapManutencao || !mapaStatusLayersAtual) return;
  clearTimeout(_pontosTimer); _pontosAssinatura = "";
  if(mapaClusterGroup){ mapManutencao.removeLayer(mapaClusterGroup); mapaClusterGroup.clearLayers(); }
  if(mapaHeatLayer) mapManutencao.removeLayer(mapaHeatLayer);
  if(mapaMarkerSelecaoCalor){ mapManutencao.removeLayer(mapaMarkerSelecaoCalor); mapaMarkerSelecaoCalor = null; }
  Object.values(mapaStatusLayersAtual).forEach(l=>mapManutencao.removeLayer(l));
  const modo = modoPontosEfetivo();
  mapaModoPontosAtual = modo;
  if(modo === "pontos"){
    Object.entries(mapaStatusLayersAtual).forEach(([st,l])=>{ if(filtroStatusAtivos.has(st)) mapManutencao.addLayer(l); });
    atualizarVisibilidadeMarcadores();
    return;
  }
  if(modo === "cluster"){ if(!mapaClusterGroup) mapaClusterGroup = criarClusterMapa(); mapManutencao.addLayer(mapaClusterGroup); }
  else { if(!mapaHeatLayer) mapaHeatLayer = criarCalorMapa(); mapManutencao.addLayer(mapaHeatLayer); }
  reconstruirPontos(true);
}
function reconstruirPontos(forcar){
  if(!mapManutencao || mapaModoPontosAtual === "pontos") return;
  const ms = osMarkersVisiveis();
  let h = ms.length;
  for(let i=0;i<ms.length;i++) h = (Math.imul(h, 31) + ms[i]._idx) | 0;
  const assinatura = mapaModoPontosAtual + ":" + ms.length + ":" + h + ":" + (osSelecionadaId||"");
  if(!forcar && assinatura === _pontosAssinatura) return;
  _pontosAssinatura = assinatura;
  if(mapaModoPontosAtual === "cluster"){
    mapaClusterGroup.clearLayers();
    ms.forEach(m=>m.setStyle(ESTILO_MARCADOR_VISIVEL));
    mapaClusterGroup.addLayers(ms);
  } else {
    // peso por ponto cai com a quantidade de OS, senão com dezenas de milhares
    // tudo vira vermelho; poucas OS ficam mais "quentes" por ponto.
    const peso = Math.min(0.6, 3500 / Math.max(ms.length, 1));
    mapaHeatLayer.setLatLngs(ms.map(m=>{ const ll = m.getLatLng(); return [ll.lat, ll.lng, peso]; }));
    if(mapaMarkerSelecaoCalor){ mapManutencao.removeLayer(mapaMarkerSelecaoCalor); mapaMarkerSelecaoCalor = null; }
    if(osSelecionadaId && mapaMarkersPorId[osSelecionadaId]){
      mapaMarkerSelecaoCalor = mapaMarkersPorId[osSelecionadaId];
      mapaMarkerSelecaoCalor.setStyle(ESTILO_MARCADOR_VISIVEL);
      mapManutencao.addLayer(mapaMarkerSelecaoCalor);
    }
  }
}
function atualizarVisibilidadeMarcadores(){
  if(mapaModoPontosAtual !== "pontos"){
    // agrupados/calor: reconstrói só se o conjunto mudou, e sem travar a digitação da busca
    clearTimeout(_pontosTimer);
    _pontosTimer = setTimeout(()=>reconstruirPontos(false), 250);
    return;
  }
  const idsVisiveis = new Set(osFiltradas().map(o=>o.id));
  Object.entries(mapaMarkersPorId).forEach(([id, m])=>{
    const relevante = idsVisiveis.has(id) && (!osSelecionadaId || id === osSelecionadaId);
    m.setStyle(relevante ? { opacity:1, fillOpacity:.92 } : { opacity:0, fillOpacity:0 });
  });
}

/* Re-renderiza só o conteúdo do card da tabela (cabeçalho com contagem +
   paginação + linhas da página atual) — chamado pela busca, paginação e
   seleção de linha, sem tocar no mapa. */
/* v2.13.4 - caixinhas em cima do mapa: total de OS no filtro + um resumo
   por tipo de serviço (Poda, Limpeza de faixa, Estruturas). Cada caixinha de
   serviço tem 3 divisões:
     Previsto  = soma do "previsto" das OS já executadas
     Realizado = soma do "realizado" das OS já executadas
     Pendente  = soma do "previsto" das OS ainda não executadas
                 (Pendente, Programada, Despachada, A reprogramar...)
   OS Cancelada não entra. Segue o filtro atual da tela (osFiltradas). O tipo
   usa a mesma regra da Programação: "faixa"/"limpeza" -> Limpeza de faixa,
   "estrutura" -> Estruturas, o resto (Poda, Poda + Estrutura...) -> Poda. */
function categoriaServicoOS(o){
  const t = String(o.tipoServico||"").toLowerCase();
  if(t.includes("faixa") || t.includes("limpeza")) return "faixa";
  if(t.includes("estrutura")) return "estrutura";
  return "poda";
}
/* v2.13.5 - quantidade por tipo = SOMA das quantidades de todas as linhas da
   OS na MO (como o BI): poda em unidades, limpeza de faixa em m², estrutura em
   unidades. Bases importadas antes disso não têm os campos por tipo (null) e
   caem no previsto/realizado antigo, só no tipo da própria OS. */
const QTD_CAMPOS = { poda:["previstoPoda","realizadoPoda"], faixa:["previstoLimpeza","realizadoLimpeza"], estrutura:["previstoEstrutura","realizadoEstrutura"] };
function qtdTipoOS(o, tipo, kind){          // kind: "prev" | "real"
  const f = QTD_CAMPOS[tipo][kind==="prev" ? 0 : 1];
  if(typeof o[f] === "number") return o[f];
  if(categoriaServicoOS(o) !== tipo) return 0;
  return Number(kind==="prev" ? o.previsto : o.realizado) || 0;
}
/* número único mostrado em tabela/popup: o do tipo principal da OS */
function qtdOS(o, kind){ return qtdTipoOS(o, categoriaServicoOS(o), kind); }
/* v3.1.15 - uma OS pode ter MAIS DE UM tipo de serviço (ex.: Poda 15 + Limpeza de faixa 90.035 m²).
   servicosDaOS lista todos os tipos com previsto/realizado; os textos abaixo são usados na tabela,
   no popup do mapa, nos Excel e nas programações. O número único (qtdOS) continua sendo o do tipo principal. */
const SERVICO_NOME = { poda:"Poda", faixa:"Limpeza de faixa", estrutura:"Estruturas" };
const SERVICO_UNID = { poda:"", faixa:" m²", estrutura:"" };
function servicosDaOS(o){
  const res = [];
  TIPOS_SERVICO.forEach(([t])=>{ const pv = qtdTipoOS(o,t,"prev"), rl = qtdTipoOS(o,t,"real"); if(pv>0 || rl>0) res.push({ cat:t, nome:SERVICO_NOME[t], prev:pv, real:rl }); });
  if(!res.length){ const t = categoriaServicoOS(o); res.push({ cat:t, nome:SERVICO_NOME[t], prev:0, real:0 }); }
  return res;
}
function servicoTextoOS(o){
  const sv = servicosDaOS(o);
  return sv.length > 1 ? sv.map(x=>x.nome).join(" + ") : (o.tipoServico || sv[0].nome);
}
/* "Poda 15 · Limpeza de faixa 90035 m²" (kind: "prev" | "real"); com um tipo só devolve o número */
function qtdTextoOS(o, kind, fnReal){
  const sv = servicosDaOS(o);
  if(sv.length < 2) return (kind==="real" && fnReal) ? fnReal(o) : qtdOS(o, kind);
  return sv.map(x=>`${x.nome} ${(kind==="real" && fnReal) ? fnReal(o, x.cat) : x[kind]}${SERVICO_UNID[x.cat]}`).join(" · ");
}
function qtdCelulaOS(o, kind){
  const sv = servicosDaOS(o);
  if(sv.length < 2) return String(qtdOS(o, kind));
  return sv.map(x=>`<div style="white-space:nowrap;">${x[kind]}<span style="color:var(--muted); font-size:10.5px;"> ${x.cat==="faixa"?"m² faixa":(x.cat==="estrutura"?"estr.":"poda")}</span></div>`).join("");
}
/* seis colunas (previsto/realizado por tipo) para os Excel — pra despachar sem perder nenhum tipo */
function colunasPorTipoXlsx(o){
  const g = (t,k)=> qtdTipoOS(o,t,k);
  return {
    "Poda previsto": g("poda","prev"), "Poda realizado": g("poda","real"),
    "Limpeza de faixa previsto (m²)": g("faixa","prev"), "Limpeza de faixa realizado (m²)": g("faixa","real"),
    "Estruturas previsto": g("estrutura","prev"), "Estruturas realizado": g("estrutura","real")
  };
}
const TIPOS_SERVICO = [ ["poda","Poda"], ["faixa","Limpeza de faixa"], ["estrutura","Estruturas"] ];
function resumoPorTipo(lista){
  const r = { poda:{prev:0,real:0,pend:0}, faixa:{prev:0,real:0,pend:0}, estrutura:{prev:0,real:0,pend:0} };
  lista.forEach(o=>{
    if(o.statusOS === "Cancelada") return;
    const exec = o.statusOS === "Executada";
    TIPOS_SERVICO.forEach(([t])=>{
      if(exec){ r[t].prev += qtdTipoOS(o,t,"prev"); r[t].real += qtdTipoOS(o,t,"real"); }
      else r[t].pend += qtdTipoOS(o,t,"prev");
    });
  });
  return r;
}
function mapaResumoServicos(lista){ return resumoPorTipo(lista); }
function mapaResumoCaixasHtml(lista){
  const fmt = n => { n = Number(n||0); return n.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 1 }); };
  const r = mapaResumoServicos(lista);
  const caixa = (titulo, c)=>`
    <div class="kpi-box">
      <div class="kpi-titulo">${titulo}</div>
      <div class="kpi-tres">
        <div><strong>${fmt(c.prev)}</strong><span>Previsto</span></div>
        <div><strong>${fmt(c.real)}</strong><span>Realizado</span></div>
        <div><strong>${fmt(c.pend)}</strong><span>Pendente</span></div>
      </div>
    </div>`;
  return `<div class="mapa-kpis">
    <div class="kpi-box kpi-total"><div class="kpi-titulo">OSs no filtro atual</div><div class="kpi-grande" id="mapaContagemFiltro">${fmt(lista.length)}</div></div>
    ${caixa("Poda", r.poda)}${caixa("Limpeza de faixa", r.faixa)}${caixa("Estruturas", r.estrutura)}
  </div>
  <p class="kpi-legenda">Previsto e Realizado: OS já executadas · Pendente: serviços previstos nas OS ainda não executadas (canceladas ficam de fora).</p>`;
}
function atualizarTabelaOS(){
  const container = document.getElementById("osTabelaContainer");
  if(container){
    container.innerHTML = osTabelaHtml();
    const cb = document.getElementById("osSelTudo");
    if(cb && cb.dataset.parcial==="1") cb.indeterminate = true;
  }
  // o título em cima do mapa ("N OSs no filtro atual") também depende do
  // filtro - sem isso ele ficava parado no número de antes toda vez que um
  // filtro era aplicado sem passar pelo render() completo (busca, seleção
  // por área, breakers de Status da OS).
  const caixas = document.getElementById("mapaResumoCaixas");
  if(caixas) caixas.innerHTML = mapaResumoCaixasHtml(osFiltradas());
}
/* v2.13.33 - ordenação da tabela de OS (conjunto inteiro, não só a página) */
let osOrdem = null;   // { campo, dir }
const OS_ORDEM_CAMPOS = { descesq:o=>o.descEsquema||"", obs:o=>o.observacao||"", status:o=>o.statusOS, id:o=>o.id, tipoeq:o=>o.tipoEquipeExec||"", origem:o=>o.origem, servico:o=>o.tipoServico, equipe:o=>o.equipeId, alimentador:o=>o.alimentador, conjunto:o=>conjuntoDaOS(o), protecao:o=>o.protecaoId, trecho:o=>o.trecho, localidade:o=>o.localidade||o.conjunto||"", polo:o=>municipioDaOS(o)||"", regional:o=>regionalDaOS(o)||"", lat:o=>(typeof o.lat==="number"?o.lat:""), lng:o=>(typeof o.lng==="number"?o.lng:""), abertura:o=>o.dataAbertura, execucao:o=>o.dataExecucao, previsto:o=>qtdOS(o,"prev"), realizado:o=>qtdOS(o,"real") , prevpoda:o=>osQtdServico(o,"poda","prev"), realpoda:o=>osQtdServico(o,"poda","real"), prevestr:o=>osQtdServico(o,"estrutura","prev"), realestr:o=>osQtdServico(o,"estrutura","real"), prevlimp:o=>osQtdServico(o,"faixa","prev"), reallimp:o=>osQtdServico(o,"faixa","real") };
function ordenarOS(campo){
  if(osOrdem && osOrdem.campo===campo){ osOrdem = osOrdem.dir===1 ? { campo, dir:-1 } : null; }
  else osOrdem = { campo, dir:1 };
  tabelaOsPagina = 1;
  atualizarTabelaOS();
}
/* v3.4.2 - grid de OS do mapa: Previsto/Realizado separados por tipo de serviço (Poda, Estrutura, Limpeza).
   osQtdServico devolve "" quando a OS não tem aquele serviço (célula vazia, vai pro fim na ordenação). */
function fmtNum(v){ return (Number(v)||0).toLocaleString("pt-BR", { maximumFractionDigits:2 }); }
const OS_GRID_SERV = [ ["poda","Poda","podas"], ["estrutura","Estrutura","estruturas"], ["faixa","Limpeza","m² de limpeza de faixa"] ];
const OS_GRID_ORD = { poda:["prevpoda","realpoda"], estrutura:["prevestr","realestr"], faixa:["prevlimp","reallimp"] };
function osQtdServico(o, cat, kind){
  const sv = servicosDaOS(o).find(x=>x.cat===cat);
  return sv ? sv[kind] : "";
}
function osTotaisServicos(lista){
  const t = { poda:{n:0,prev:0,real:0}, estrutura:{n:0,prev:0,real:0}, faixa:{n:0,prev:0,real:0} };
  for(const o of lista){ for(const x of servicosDaOS(o)){ const a = t[x.cat]; a.n++; a.prev += x.prev; a.real += x.real; } }
  return t;
}
/* v3.10.7 - colunas opcionais da grid (status e OS são fixas). "serv" = grupo Previsto/Realizado de um tipo de serviço. */
const OS_COLS = [
  { id:"tipoeq", rot:"Tipo equipe", ord:"tipoeq", td:o=>`<td>${o.tipoEquipeExec ? escapeHtml(o.tipoEquipeExec) : `<span style="color:var(--muted);">—</span>`}</td>` },
  { id:"poda", rot:"Poda (previsto / realizado)", serv:"poda" },
  { id:"estrutura", rot:"Estrutura (previsto / realizado)", serv:"estrutura" },
  { id:"faixa", rot:"Limpeza de faixa (previsto / realizado)", serv:"faixa" },
  { id:"equipe", rot:"Equipe", ord:"equipe", td:o=>`<td class="mono">${escapeHtml(o.equipeId||"—")}</td>` },
  { id:"alimentador", rot:"Alimentador", ord:"alimentador", td:o=>`<td class="mono">${escapeHtml(o.alimentador)}</td>` },
  { id:"conjunto", rot:"Conjunto", ord:"conjunto", td:o=>`<td>${escapeHtml(conjuntoDaOS(o))}</td>` },
  { id:"protecao", rot:"Proteção", ord:"protecao", td:o=>`<td class="mono">${escapeHtml(o.protecaoId)}</td>` },
  { id:"trecho", rot:"Trecho", ord:"trecho", td:o=>`<td class="mono">${escapeHtml(o.trecho||"")}</td>` },
  { id:"localidade", rot:"Localidade", ord:"localidade", td:o=>`<td>${escapeHtml(o.localidade||o.conjunto||"")}</td>` },
  { id:"polo", rot:"Polo", ord:"polo", td:o=>`<td>${escapeHtml(municipioDaOS(o)||"")}</td>` },
  { id:"regional", rot:"Regional", ord:"regional", td:o=>`<td>${escapeHtml(regionalDaOS(o)||"")}</td>` },
  { id:"abertura", rot:"Abertura", ord:"abertura", td:o=>`<td>${fmtDate(o.dataAbertura)}</td>` },
  { id:"execucao", rot:"Execução", ord:"execucao", td:o=>`<td>${fmtDate(o.dataExecucao)}</td>` },
  { id:"lat", rot:"Latitude", ord:"lat", td:o=>`<td class="mono">${typeof o.lat==="number" ? o.lat.toFixed(6) : ""}</td>` },
  { id:"lng", rot:"Longitude", ord:"lng", td:o=>`<td class="mono">${typeof o.lng==="number" ? o.lng.toFixed(6) : ""}</td>` },
  { id:"origem", rot:"Origem", ord:"origem", td:o=>`<td>${escapeHtml(o.origem)}</td>` },
  { id:"descesq", rot:"Descrição do esquema", ord:"descesq", td:o=>`<td class="os-texto" title="${escapeHtml(o.descEsquema||"")}">${escapeHtml(o.descEsquema||"")}</td>` },
  { id:"obs", rot:"Observação", ord:"obs", td:o=>`<td class="os-texto" title="${escapeHtml(o.observacao||"")}">${escapeHtml(o.observacao||"")}</td>` },
];
function osColsAlternar(ev){ if(ev) ev.stopPropagation(); osColsAberto = !osColsAberto; atualizarTabelaOS(); }
function osColsAlternarUma(id){ if(osColsOcultas.has(id)) osColsOcultas.delete(id); else osColsOcultas.add(id); salvarPrefsGridOS(); atualizarTabelaOS(); }
function osColsTodas(mostrar){ osColsOcultas = mostrar ? new Set() : new Set(OS_COLS.map(c=>c.id)); salvarPrefsGridOS(); atualizarTabelaOS(); }
function mudarPorPaginaOS(v){
  const n = parseInt(v,10); if(!OS_POR_PAGINA_OPCOES.includes(n)) return;
  const inicio = (tabelaOsPagina - 1) * osPorPagina;     // mantém na tela a mesma OS do topo
  osPorPagina = n; tabelaOsPagina = Math.floor(inicio / n) + 1;
  salvarPrefsGridOS(); atualizarTabelaOS();
}
document.addEventListener("click", e=>{ if(osColsAberto && !(e.target.closest && e.target.closest(".os-cols-wrap"))){ osColsAberto = false; atualizarTabelaOS(); } });
function osServTds(o, cat){ return ["prev","real"].map(k=>{ const v = osQtdServico(o,cat,k); return `<td class="num">${v===""?`<span style="color:var(--muted);">—</span>`:fmtNum(v)}</td>`; }).join(""); }
function osTabelaHtml(){
  let lista = osFiltradas();
  if(osOrdem && OS_ORDEM_CAMPOS[osOrdem.campo]) lista = ordenarPorTexto(lista, OS_ORDEM_CAMPOS[osOrdem.campo], osOrdem.dir);
  const totalPag = totalPaginasOS(lista);
  tabelaOsPagina = Math.min(tabelaOsPagina, totalPag);
  const inicio = (tabelaOsPagina - 1) * osPorPagina;
  const pagina = lista.slice(inicio, inicio + osPorPagina);

  const progPag = pagina.filter(ehSelecionavelProgramar);
  const marcadasPag = progPag.filter(o=>osSelecionadasProgramar.has(o.id)).length;
  const todasPag = progPag.length>0 && marcadasPag===progPag.length;
  const parcialPag = marcadasPag>0 && !todasPag;
  const totSrv = osTotaisServicos(lista);
  const colsVis = OS_COLS.filter(c=>!osColsOcultas.has(c.id));
  const temServ = colsVis.some(c=>c.serv), rs = temServ ? 3 : 1;
  const totalProgFiltro = lista.filter(ehSelecionavelProgramar).length;
  const mostrarEstender = todasPag && totalProgFiltro > progPag.length && osSelecionadasProgramar.size < totalProgFiltro;

  return `
    <div class="card-head" style="margin-bottom:10px;">
      <h3>Ordens de Serviço <span style="color:var(--muted); font-weight:500;">— ${lista.length.toLocaleString("pt-BR")} no filtro${lista.length!==osMapaBase().length ? ` (de ${osMapaBase().length.toLocaleString("pt-BR")} no total)` : ""}</span></h3>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        ${osSelecaoAreaIds ? `<span class="pill info">${osSelecaoAreaIds.size} selecionada(s) no mapa</span>` : ""}
        ${mostrarEstender ? `<button class="btn btn-ghost btn-sm" onclick="selecionarTodasDoFiltro()">Selecionar as ${totalProgFiltro.toLocaleString("pt-BR")} OS do filtro</button>` : ""}
        ${osSelecionadasProgramar.size > 0 ? `
          <span class="pill ok">${osSelecionadasProgramar.size} marcada(s) pra programar</span>
          <button class="btn btn-primary btn-sm" onclick="abrirProgramacaoComSelecionadas()">${ic("plus")||"+"} Programar selecionadas</button>
          <button class="btn btn-ghost btn-sm" onclick="limparSelecaoOsProgramar()">${ic("close")||"×"} Desmarcar</button>
        ` : ""}
        <div class="os-cols-wrap">
          <button class="btn btn-ghost" style="padding:6px 12px; font-size:12px;" onclick="osColsAlternar(event)" title="Escolher quais colunas aparecem na grid">Colunas ▾ <span style="color:var(--muted);">${colsVis.length}/${OS_COLS.length}</span></button>
          ${osColsAberto ? `<div class="os-cols-panel">
            <div class="os-cols-topo"><button class="btn btn-ghost btn-sm" onclick="osColsTodas(true)">Mostrar todas</button><button class="btn btn-ghost btn-sm" onclick="osColsTodas(false)">Ocultar todas</button></div>
            <div class="os-cols-lista">${OS_COLS.map(c=>`<label class="os-cols-item"><input type="checkbox" ${osColsOcultas.has(c.id)?"":"checked"} onchange="osColsAlternarUma('${c.id}')"> ${c.rot}</label>`).join("")}</div>
            <p class="os-cols-nota">Status e OS ficam sempre visíveis. Sua escolha fica salva neste navegador.</p>
          </div>` : ""}
        </div>
        <button class="btn btn-ghost" style="padding:6px 12px; font-size:12px;" onclick="exportarOSParaExcel()" title="Exporta as OS do filtro/seleção atual para um arquivo Excel">${ic("download")||"⬇"} Exportar (.xlsx)</button>
        ${(osSelecionadaId || osSelecaoAreaIds) ? `<button class="btn btn-ghost" style="padding:6px 12px; font-size:12px;" onclick="limparSelecaoOS()">${ic("close")||"×"} Ver todas</button>` : ""}
        <div style="display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--muted);">
          <label style="display:flex; align-items:center; gap:5px;">Por página <select onchange="mudarPorPaginaOS(this.value)" style="padding:4px 6px; font-size:12px;">${OS_POR_PAGINA_OPCOES.map(n=>`<option value="${n}" ${n===osPorPagina?"selected":""}>${n}</option>`).join("")}</select></label>
          <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaOS(-1)" ${tabelaOsPagina<=1?"disabled":""}>‹</button>
          <span>Página ${tabelaOsPagina} de ${totalPag}</span>
          <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaOS(1)" ${tabelaOsPagina>=totalPag?"disabled":""}>›</button>
        </div>
      </div>
    </div>
    <p style="color:var(--muted); font-size:11.5px; margin:-4px 0 10px;">Marque as OS (qualquer status, menos <strong>Executada</strong> e <strong>Cancelada</strong>) que vão virar uma Programação — o que não for marcado continua aqui, disponível.</p>
    <div class="table-wrap"><table data-sort-manual>
      <thead>
        <tr><th class="checkbox-cell" rowspan="${rs}"><input type="checkbox" id="osSelTudo" ${todasPag?"checked":""} ${progPag.length===0?"disabled":""} title="Selecionar todas as OS programáveis desta página" onchange="alternarSelecaoPagina(this.checked)" ${parcialPag?'data-parcial="1"':""}></th>${[["status","Status"],["id","OS"]].map(([c,r])=>ordenarHeadHtml(true,r,c,osOrdem,"ordenarOS").replace("<th ",`<th rowspan="${rs}" `)).join("")}${colsVis.map(c=>c.serv ? (()=>{ const g = OS_GRID_SERV.find(x=>x[0]===c.serv); return `<th colspan="2" class="os-serv-grupo" title="Previsto e realizado de ${g[2]}">${g[1]} <span class="os-serv-qtd">· ${totSrv[c.serv].n.toLocaleString("pt-BR")} OS</span></th>`; })() : ordenarHeadHtml(true,c.rot,c.ord,osOrdem,"ordenarOS").replace("<th ",`<th rowspan="${rs}" `)).join("")}</tr>
        ${temServ ? `<tr>${colsVis.filter(c=>c.serv).map(c=>OS_GRID_ORD[c.serv].map((f,ix)=>ordenarHeadHtml(true,ix?"Realizado":"Previsto",f,osOrdem,"ordenarOS")).join("")).join("")}</tr>
        <tr class="os-serv-totais" title="Total de todas as OS do filtro (não só desta página)">${colsVis.filter(c=>c.serv).map(c=>`<th class="num">${fmtNum(totSrv[c.serv].prev)}</th><th class="num">${fmtNum(totSrv[c.serv].real)}</th>`).join("")}</tr>` : ""}
      </thead>
      <tbody>
        ${pagina.length===0 ? `<tr><td colspan="40" style="text-align:center; color:var(--muted); padding:24px;">Nenhuma OS encontrada${filtroBuscaOS?` para "${escapeHtml(filtroBuscaOS)}"`:""}.</td></tr>` : ""}
        ${pagina.map(o=>`
          <tr class="os-row ${o.id===osSelecionadaId?'os-row-selected':''}">
            <td class="checkbox-cell" onclick="event.stopPropagation()">
              ${ehSelecionavelProgramar(o) ? `<input type="checkbox" ${osSelecionadasProgramar.has(o.id)?"checked":""} onchange="alternarSelecaoOsProgramar('${escapeHtml(o.id).replace(/'/g,"\\'")}')">` : ""}
            </td>
            <td onclick="selecionarOsNaTabela('${escapeHtml(o.id).replace(/'/g,"\\'")}')" style="cursor:pointer;" title="Clique para ver essa OS no mapa">${statusPill(o.statusOS)}</td>
            <td class="mono" onclick="selecionarOsNaTabela('${escapeHtml(o.id).replace(/'/g,"\\'")}')" style="cursor:pointer;">${escapeHtml(o.id)}${o._ajuste?'<span class="os-ajuste" title="OS com Ajuste (Gestão de Bases): tipo de equipe, equipe, alimentador ou proteção foram corrigidos à mão">✎</span>':""}${o.aprox?'<span class="os-aprox" title="Posição aproximada: a coordenada não veio no GRID, o ponto está no centro da cidade/setor e pode estar errado.">*</span>':""}</td>
            ${colsVis.map(c=>c.serv ? osServTds(o,c.serv) : c.td(o)).join("")}
          </tr>`).join("")}
      </tbody>
    </table></div>
  `;
}

/* Exporta as OS do filtro/seleção ATUAL (busca + Prioridade EW + seleção
   por área no mapa, se houver uma) pra um .xlsx — pedido pra equipe saber
   quais OS mandar pros tablets em campo. Usa o mesmo XLSX (SheetJS) já
   usado pra gerar o modelo de importação, então não precisa de nada novo
   carregado nem de ida ao Controller — o arquivo é montado e baixado
   direto no navegador. */
/* =========================================================================
   v2.15.35 - MAPA DE AUDITORIA (Google Meu Mapas)
   OS executadas no período -> um arquivo por regional (.kmz + .xlsx), com uma
   camada por prestador e as mesmas colunas do mapa montado à mão.
   Prestador da equipe: campo `prestador` do cadastro (se existir) -> plantão
   (OS SIGOD ou equipe ...PL01) -> prefixo da empresa terceira -> departamento.
   ========================================================================= */
const AUD_PREFIXOS = [ ["SOLLUZ","SOLLUZ"], ["FFRIO","FFRIO"], ["BRTB","BRTB"], ["REER","REER"], ["REN","REN"], ["BET","BET"], ["TOB","TOB"], ["ECO","ECO"], ["MGA","MEGA"], ["DSX","DSX"] ];
const AUD_CORES = ["#C2185B","#7B1FA2","#00ACC1","#FBC02D","#F57C00","#388E3C","#1976D2","#5D4037","#455A64","#E53935","#8E24AA","#00897B"];
function audPrestador(o, e){
  if(e && e.prestador) return String(e.prestador);
  const id = String((e && e.id) || o.equipeId || "").toUpperCase();
  if(String(o.origem||"").toUpperCase()==="SIGOD" || /PL\d*$/.test(id)) return "Plantão";
  const p = AUD_PREFIXOS.find(([pre])=>id.startsWith(pre));
  if(p) return p[1];
  return (e && e.departamento) || "Sem prestador";
}
let audCfg = { de:"", ate:"", servico:"poda", regional:"" };
let audGrupos = [];
function audSelecionar(){
  audPadroes();
  const de = audCfg.de, ate = audCfg.ate, serv = audCfg.servico, reg = audCfg.regional;
  const eqs = new Map((state.equipes||[]).map(e=>[String(e.id),e]));
  let semPos = 0, semEquipe = 0;
  const linhas = [];
  (state.manutencaoOS||[]).forEach(o=>{
    if(o.statusOS!=="Executada" || !o.dataExecucao) return;
    const dia = String(o.dataExecucao).slice(0,10);
    if((de && dia<de) || (ate && dia>ate)) return;
    if(serv==="poda" && categoriaServicoOS(o)!=="poda") return;
    const e = eqs.get(String(o.equipeId||""));
    const regional = String((e && e.regional) || regionalDaOS(o) || "").toUpperCase();
    if(reg && regional!==reg) return;
    if(!e) semEquipe++;
    if(o.aprox || typeof o.lat!=="number" || typeof o.lng!=="number"){ semPos++; return; }
    linhas.push({ o, e, dia, regional: regional || "SEM REGIONAL", prestador: audPrestador(o,e) });
  });
  return { de, ate, linhas, semPos, semEquipe };
}
function audQtd(o,kind){ const v = qtdOS(o,kind); return v>0 ? `${o.tipoServico||"Poda"}: ${v}` : ""; }
function audCampos(l){
  const o = l.o, e = l.e || {};
  return [
    ["EQUIPE.Prestador", l.prestador], ["DPTO EQUIPE", e.departamento||""], ["Polo", String(e.polo || municipioDaOS(o) || "").toUpperCase()],
    ["Regional", l.regional], ["Equipe Executora", o.equipeId||""], ["EQUIPE PROP/TERC", String(e.proprioTerceiro||"").toUpperCase()],
    ["CodAtivo", o.codAtivo||""], ["Dt Execução", fmtDate(o.dataExecucao)], ["Latitude", Number(o.lat).toFixed(6)], ["Longitude", Number(o.lng).toFixed(6)],
    ["Qtd Previsto", audQtd(o,"prev")], ["Qtd Medido", audQtd(o,"real")], ["Qtd Auditado", ""], ["Status", "PENDENTE DE FISCALIZACAO"], ["DIA", String(Number(l.dia.slice(8,10)))]
  ];
}
function audKml(regional, porPrest, cores, de, ate){
  const estilos = Object.keys(porPrest).map(p=>`<Style id="aud_${prefNomeArquivo(p)}"><IconStyle><color>${prefKmlCor(cores[p])}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>`).join("");
  const pastas = [];
  Object.keys(porPrest).forEach(p=>{
    const lista = porPrest[p], blocos = Math.ceil(lista.length/2000);
    for(let b=0;b<blocos;b++){
      const fatia = lista.slice(b*2000,(b+1)*2000);
      pastas.push(`<Folder><name>${prefXml(p)}${blocos>1?` (${b+1})`:""}</name>${fatia.map(l=>{
        const dados = audCampos(l).map(([k,v])=>`<Data name="${prefXml(k)}"><value>${prefXml(v)}</value></Data>`).join("");
        return `<Placemark><name>${prefXml(l.o.id)}</name><styleUrl>#aud_${prefNomeArquivo(p)}</styleUrl><ExtendedData>${dados}</ExtendedData><Point><coordinates>${Number(l.o.lng).toFixed(6)},${Number(l.o.lat).toFixed(6)},0</coordinates></Point></Placemark>`;
      }).join("")}</Folder>`);
    }
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Auditoria ${prefXml(regional)} - ${fmtDate(de)} a ${fmtDate(ate)}</name>${estilos}${pastas.join("")}</Document></kml>`;
}
function audXlsxBytes(porPrest){
  const wb = XLSX.utils.book_new();
  Object.keys(porPrest).forEach(p=>{
    const linhas = porPrest[p].map(l=>{ const r = { "OS": l.o.id }; audCampos(l).forEach(([k,v])=>{ r[k] = v; }); return r; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), String(p).replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31) || "Prestador");
  });
  return new Uint8Array(XLSX.write(wb, { type:"array", bookType:"xlsx" }));
}
function audPadroes(){
  if(!audCfg.ate) audCfg.ate = prefHojeIso();
  if(!audCfg.de){ const d = new Date(); d.setDate(d.getDate()-14); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); audCfg.de = d.toISOString().slice(0,10); }
}
/* v2.15.36 - página "Auditoria de podas" na Gestão de Bases: um arquivo por regional x prestador */
function audCalcularGrupos(){
  const r = audSelecionar();
  const mapa = {};
  r.linhas.forEach(l=>{ const k = l.regional+"\u0000"+l.prestador; (mapa[k] = mapa[k]||{ regional:l.regional, prestador:l.prestador, lista:[] }).lista.push(l); });
  audGrupos = Object.values(mapa).sort((a,b)=>a.regional.localeCompare(b.regional,"pt-BR") || a.prestador.localeCompare(b.prestador,"pt-BR"));
  audGrupos.forEach(g=>g.lista.sort((a,b)=>a.dia.localeCompare(b.dia) || String(a.o.id).localeCompare(String(b.o.id),"pt-BR",{numeric:true})));
  return r;
}
function audNomeBase(g, r){ return `Auditoria_${prefNomeArquivo(g.regional)}_${prefNomeArquivo(g.prestador)}_${r.de}_a_${r.ate}`; }
async function audArquivosDoGrupo(g, r, tipos){
  const base = audNomeBase(g, r), porPrest = { [g.prestador]: g.lista }, out = [];
  if(tipos.includes("xlsx")) out.push({ nome:`${base}.xlsx`, dados: audXlsxBytes(porPrest) });
  if(tipos.includes("kmz")){
    const kml = new TextEncoder().encode(audKml(g.regional, porPrest, { [g.prestador]: AUD_CORES[0] }, r.de, r.ate).replace(/<name>Auditoria /, `<name>Auditoria ${prefXml(g.prestador)} `));
    out.push({ nome:`${base}.kmz`, dados: await prefBytes(zipStore([{ nome:"doc.kml", dados:kml }])) });
  }
  return out;
}
async function audBaixarGrupo(i, tipo){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const g = audGrupos[i]; if(!g) return;
  const r = { de:audCfg.de, ate:audCfg.ate };
  const a = (await audArquivosDoGrupo(g, r, [tipo]))[0];
  prefBaixarBlob(new Blob([a.dados]), a.nome);
}
async function audBaixarTudo(){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  if(!audGrupos.length){ toast("Nada para baixar nesse filtro."); return; }
  const r = { de:audCfg.de, ate:audCfg.ate }, arquivos = [];
  for(const g of audGrupos){
    const pasta = prefNomeArquivo(g.regional).toUpperCase();
    (await audArquivosDoGrupo(g, r, ["xlsx","kmz"])).forEach(a=>arquivos.push({ nome:`${pasta}/${a.nome}`, dados:a.dados }));
  }
  prefBaixarBlob(zipStore(arquivos), `SPARK_Auditoria_${r.de}_a_${r.ate}.zip`);
  toast(`${arquivos.length} arquivo(s) gerados, organizados por regional.`);
}
function audTabelaHtml(){
  const r = audCalcularGrupos();
  const aviso = [];
  if(r.semPos) aviso.push(`${r.semPos} OS ficaram de fora por não terem posição real.`);
  if(r.semEquipe) aviso.push(`${r.semEquipe} OS com equipe fora do cadastro (sem departamento/polo).`);
  const total = audGrupos.reduce((t,g)=>t+g.lista.length,0);
  return `
    <div class="card-head" style="margin-bottom:8px;">
      <h3 style="margin:0;">${audGrupos.length} arquivo(s) · ${total.toLocaleString("pt-BR")} OS</h3>
      <button class="btn btn-primary btn-sm" onclick="audBaixarTudo()" ${audGrupos.length?"":"disabled"}>${ic("download")} Baixar tudo (.zip por regional)</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Regional</th><th>Prestador</th><th>OS</th><th>Arquivo</th><th></th></tr></thead>
      <tbody>${audGrupos.length===0 ? `<tr><td colspan="5"><div class="empty">${ic("empty")}<div>Nenhuma OS executada com posição real nesse período/filtro.</div></div></td></tr>` :
        audGrupos.map((g,i)=>`<tr>
          <td>${escapeHtml(g.regional)}</td><td>${escapeHtml(g.prestador)}</td><td class="num">${g.lista.length.toLocaleString("pt-BR")}${g.lista.length>2000?` <span class="pill warn" title="O Meu Mapas aceita 2.000 pontos por camada">&gt; 2.000</span>`:""}</td>
          <td class="mono" style="font-size:11.5px;">${escapeHtml(audNomeBase(g,{de:audCfg.de,ate:audCfg.ate}))}</td>
          <td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="audBaixarGrupo(${i},'xlsx')">.xlsx</button> <button class="btn btn-ghost btn-sm" onclick="audBaixarGrupo(${i},'kmz')" title="Para importar no Google Meu Mapas">.kmz</button></td>
        </tr>`).join("")}</tbody>
    </table></div>
    ${aviso.length?`<p style="color:var(--muted); font-size:12px; margin:8px 0 0;">${aviso.join(" ")}</p>`:""}`;
}
function audAtualizar(campo, v){
  audCfg[campo] = v;
  const w = document.getElementById("audTabela"); if(w) w.innerHTML = audTabelaHtml();
}
function auditoriaPaginaHtml(){
  audPadroes();
  const regionais = [...new Set((state.equipes||[]).map(e=>String(e.regional||"").toUpperCase()).filter(Boolean))].sort();
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Separa as OS <strong>executadas</strong> no período por regional e por prestador e gera um arquivo para cada combinação — pronto para enviar por e-mail. O <strong>.kmz</strong> importa direto no Google Meu Mapas (uma camada por arquivo, até 2.000 pontos) e o <strong>.xlsx</strong> tem as mesmas colunas. "Baixar tudo" entrega um .zip com uma pasta por regional. Só entram OS com posição real.</p>
    <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:14px; align-items:end;">
      <div class="field"><label>Execução de</label><input type="date" value="${audCfg.de}" onchange="audAtualizar('de',this.value)"></div>
      <div class="field"><label>até</label><input type="date" value="${audCfg.ate}" onchange="audAtualizar('ate',this.value)"></div>
      <div class="field"><label>Serviço</label><select onchange="audAtualizar('servico',this.value)"><option value="poda" ${audCfg.servico==="poda"?"selected":""}>Só poda</option><option value="todos" ${audCfg.servico==="todos"?"selected":""}>Todos os serviços</option></select></div>
      <div class="field"><label>Regional</label><select onchange="audAtualizar('regional',this.value)"><option value="">Todas</option>${regionais.map(r=>`<option value="${escapeHtml(r)}" ${audCfg.regional===r?"selected":""}>${escapeHtml(r)}</option>`).join("")}</select></div>
    </div>
    <div id="audTabela">${audTabelaHtml()}</div>`;
}

function exportarOSParaExcel(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const lista = osFiltradas();
  if(lista.length === 0){ toast("Nenhuma OS no filtro atual pra exportar."); return; }
  const linhas = lista.map(o => ({
    "OS": o.id + (o.aprox ? "*" : ""),
    "Status": o.statusOS,
    "Origem": o.origem,
    "Serviço": servicoTextoOS(o),
    "Equipe executora": o.equipeId || "",
    "Departamento da equipe": (typeof equipeInfo==="function" && o.equipeId && equipeInfo(o.equipeId) && equipeInfo(o.equipeId).departamento) || "",
    "Equipe necessária": o.tipoEquipeNecessaria || "",
    "Tipo de equipe": o.tipoEquipeExec || "",
    "Zona": zonaDaOS(o),
    "ID do poste": o.posteId || "",
    "ID árvore (VERA)": o.idVera || "",
    "Origem da posição": o.origemPos || "",
    "Alimentador": o.alimentador,
    "Conjunto": conjuntoDaOS(o),
    "Proteção": o.protecaoId,
    "Trecho": o.trecho || "",
    "Localidade": o.localidade || o.conjunto || "",
    "Polo": municipioDaOS(o) || "",
    "Regional": regionalDaOS(o) || "",
    "Prioridade EW": o.prioridadeEW ? "Sim" : "Não",
    "Abertura": o.dataAbertura ? fmtDate(o.dataAbertura) : "",
    "Execução": o.dataExecucao ? fmtDate(o.dataExecucao) : "",
    "Previsto": qtdOS(o,"prev"),
    "Previsto estimado pelo esquema": o.previstoPorEsquema ? "Sim" : "",
    "Realizado": qtdOS(o,"real"),
    ...colunasPorTipoXlsx(o),
    "Latitude": o.lat,
    "Longitude": o.lng,
    "Posição aproximada": o.aprox ? "Sim" : "",
    "Descrição do esquema": o.descEsquema || "",
    "Observação": o.observacao || ""
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "OS");
  const agora = new Date();
  const carimbo = `${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,"0")}${String(agora.getDate()).padStart(2,"0")}_${String(agora.getHours()).padStart(2,"0")}${String(agora.getMinutes()).padStart(2,"0")}`;
  XLSX.writeFile(wb, `SPARK_OS_${carimbo}.xlsx`);
  toast(`${lista.length.toLocaleString("pt-BR")} OS exportada(s) para Excel.`);
}

/* Rede MT é particionada por alimentador (um .geojson por CTMT) porque a
   base completa tem centenas de milhares de trechos — por padrão carrega
   só o(s) alimentador(es) escolhido(s), mas "Todos" busca e junta todos de
   uma vez (pode demorar e deixar o mapa pesado se houver muitos).

   O combo virou multi-seleção (pedido do Mario: poder marcar mais de um
   alimentador pra aparecer junto no mapa) — "selecionados" é sempre um
   array; ["__todos__"] é o caso especial de "todos". Com mais de um
   específico marcado, cada um é buscado em sequência (1 por vez, nunca em
   paralelo): um fan-out de GETs simultâneos por alimentador já tinha
   travado o Controller antes num caso real (até 335 de uma vez) — ver o
   comentário logo abaixo, no caso "__todos__", que foi corrigido trocando
   por streaming; aqui o número de alimentadores marcados à mão tende a ser
   pequeno, mas o princípio (nunca disparar N GETs ao mesmo tempo pro
   Controller) continua valendo. */
async function carregarRedeMt(selecionados){
  // v2.12.0 - a MT segue o mesmo caminho das outras camadas por alimentador
  // (cache de sessão + 1 pedido por vez) — ver carregarCamadaParticionada.
  await carregarCamadaParticionada("mt", selecionados);
}
/* VERA (árvores) no Mapa de Manutenção (pedido do Mario: "são importantes
   pra nós") — streaming/NDJSON (ver Invoke-VeraMapaStream no Controller),
   igual à Rede MT "Todos os alimentadores": uma base de 141 mil+ pontos de
   uma vez não dá pra mandar num GET comum sem travar. Carrega só na
   primeira vez que a camada é ligada (ver o listener em initMapaManutencao)
   e fica guardada depois — desligar/religar o breaker só esconde/mostra a
   layer já carregada, sem buscar de novo. */
async function carregarVeraMapa(){
  if(!mapaCamadaLayersAtual) return;
  const layer = mapaCamadaLayersAtual.vera;
  const notaEl = document.getElementById("veraNota");
  if(!API_ONLINE){
    if(notaEl) notaEl.textContent = "Controller offline — abra o sistema pelo iniciar.bat pra ver as árvores de verdade.";
    return;
  }
  const mudouDeTela = ()=> !mapaCamadaLayersAtual || mapaCamadaLayersAtual.vera !== layer;
  try{
    // v2.12.0 - os pontos já vêm da pré-carga em segundo plano (mapacache.js)
    // quando ela terminou; se ainda estiver no meio, espera; só busca direto
    // no Controller se a pré-carga não existe (ou falhou).
    if(mapaCache.iniciada && mapaCache.vera.estado !== "pronta" && mapaCache.vera.estado !== "erro"){
      if(notaEl) notaEl.textContent = "Aguardando a carga em segundo plano das camadas…";
      await mapaCacheAguardar(()=> !mapaCache.iniciada || mapaCache.vera.estado === "pronta" || mapaCache.vera.estado === "erro");
    }
    if(mudouDeTela()) return;
    let pontos = (mapaCache.vera.estado === "pronta") ? mapaCache.vera.pontos : null;
    if(!pontos){
      pontos = [];
      await apiGetStream("/manutencao/vera-mapa", (p)=>{
        if(p.tipo === "lote" && p.pontos){
          p.pontos.forEach(pt=>pontos.push(pt));
          if(notaEl && typeof p.total === "number" && p.total>0){
            notaEl.textContent = `Carregando árvores — ${pontos.length.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")}…`;
          }
        }
      });
    }
    // desenha em fatias, cedendo o navegador entre elas (141 mil marcadores
    // de uma vez congelariam a tela)
    const FATIA = 4000;
    for(let i=0; i<pontos.length; i+=FATIA){
      if(mudouDeTela()) return;
      pontos.slice(i, i+FATIA).forEach(([lat, lng, idVera, especie])=>{
        if(typeof lat !== "number" || typeof lng !== "number") return;
        L.circleMarker([lat, lng], { radius:3, color:"#2F9E44", weight:1, fillColor:"#2F9E44", fillOpacity:.75 })
          .bindPopup(`<h4>Árvore ${escapeHtml(String(idVera||""))}</h4><dl><dt>Espécie</dt><dd>${escapeHtml(especie||"—")}</dd></dl>`)
          .addTo(layer);
      });
      if(notaEl) notaEl.textContent = `Desenhando árvores — ${Math.min(i+FATIA, pontos.length).toLocaleString("pt-BR")} de ${pontos.length.toLocaleString("pt-BR")}…`;
      await new Promise(r=>setTimeout(r,0));
    }
    mapaVeraCarregada = true;
    if(notaEl) notaEl.textContent = `${pontos.length.toLocaleString("pt-BR")} árvore(s) carregada(s).`;
  }catch(err){
    toast("Não consegui carregar a VERA no mapa: " + err.message);
    if(notaEl) notaEl.textContent = "Erro ao carregar — tente ligar a camada de novo.";
  }
}
/* v2.14.3 - Camada "Ativos" (PONNOT). Não dá pra mandar 760 mil pontos pro
   navegador, então busca só os da área visível (GET /postes/area) e só com
   zoom aproximado; refaz a busca quando o mapa é movimentado. */
const ATIVOS_ZOOM_MIN = 14;
/* v2.15.2 - ativos desenhados como TRIÂNGULO (no mesmo canvas, leve mesmo com 8 mil
   pontos) para não se confundirem com as bolinhas das OS e dos equipamentos. */
L.Canvas.include({
  _updateAtivoTri(layer){
    if(!this._drawing || layer._empty()) return;
    const p = layer._point, ctx = this._ctx, r = layer._radius;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r*1.2); ctx.lineTo(p.x + r*1.1, p.y + r*.85); ctx.lineTo(p.x - r*1.1, p.y + r*.85);
    ctx.closePath();
    this._fillStroke(ctx, layer);
  }
});
const AtivoTriangulo = L.CircleMarker.extend({ _updatePath(){ if(this._renderer._updateAtivoTri) this._renderer._updateAtivoTri(this); else this._renderer._updateCircle(this); } });
const ATIVOS_COR = { POS:"#0E7490", DRV:"#7C3AED", FLT:"#B45309", TOR:"#B42318", PSU:"#047857", PON:"#1D4ED8", PIS:"#BE185D", PMF:"#4B5563", "0":"#6B7280" };
const ATIVOS_NOME = { POS:"Poste", DRV:"Derivação", FLT:"Flutuante", TOR:"Torre", PSU:"Poste de subestação", PON:"Ponto", PIS:"Ponto de iluminação", PMF:"Ponto de medição/fronteira", "0":"Sem tipo" };
let ativosLigado = false, ativosTiposSel = null, ativosTiposTodos = [], ativosSeq = 0, ativosTimer = null, ativosMapa = null;
function ativosReset(){
  ativosLigado = false; ativosTiposSel = null; ativosTiposTodos = []; ativosSeq++;
  clearTimeout(ativosTimer);
  if(ativosMapa){ ativosMapa.off("moveend", ativosAgendar); ativosMapa = null; }
}
function ativosLigar(ligado){
  ativosLigado = ligado;
  const box = document.getElementById("ativosBox");
  if(box) box.style.display = ligado ? "" : "none";
  if(!mapManutencao) return;
  if(ligado){
    if(ativosMapa !== mapManutencao){ mapManutencao.on("moveend", ativosAgendar); ativosMapa = mapManutencao; }
    ativosCarregar();
  } else {
    ativosSeq++;
    if(mapaCamadaLayersAtual) mapaCamadaLayersAtual.ativos.clearLayers();
  }
}
function ativosAgendar(){ clearTimeout(ativosTimer); ativosTimer = setTimeout(ativosCarregar, 250); }
function ativosToggleTipo(t){
  if(!ativosTiposSel) ativosTiposSel = new Set(["POS"]);
  if(ativosTiposSel.has(t)) ativosTiposSel.delete(t); else ativosTiposSel.add(t);
  ativosTiposHtml(); ativosCarregar();
}
function ativosTiposHtml(){
  const el = document.getElementById("ativosTipos");
  if(!el) return;
  const sel = ativosTiposSel || new Set(["POS"]);
  el.innerHTML = ativosTiposTodos.map(t=>`<button type="button" class="tab ${sel.has(t)?"active":""}" style="padding:1px 7px; font-size:11px;" title="${escapeHtml(ATIVOS_NOME[t]||t)}" onclick="ativosToggleTipo('${t}')">${escapeHtml(t)}</button>`).join("");
}
async function ativosCarregar(){
  if(!ativosLigado || !mapManutencao || !mapaCamadaLayersAtual) return;
  const layer = mapaCamadaLayersAtual.ativos;
  const nota = document.getElementById("ativosNota");
  if(!API_ONLINE){ if(nota) nota.textContent = "Controller offline — abra pelo iniciar.bat."; return; }
  if(mapManutencao.getZoom() < ATIVOS_ZOOM_MIN){
    layer.clearLayers(); ativosSeq++;
    if(nota) nota.textContent = "Aproxime o mapa (zoom " + ATIVOS_ZOOM_MIN + " ou mais) para ver os ativos.";
    return;
  }
  const seq = ++ativosSeq;
  const b = mapManutencao.getBounds();
  const sel = ativosTiposSel || new Set(["POS"]);
  const q = `sul=${b.getSouth()}&oeste=${b.getWest()}&norte=${b.getNorth()}&leste=${b.getEast()}&tipos=${encodeURIComponent([...sel].join(","))}&limite=8000`;
  if(nota) nota.textContent = "Buscando ativos…";
  try{
    const r = await apiGet("/postes/area?" + q, 60000);
    if(seq !== ativosSeq || !ativosLigado) return;   // chegou resposta velha
    if(!ativosTiposSel && !(r.tipos||[]).includes("POS")) ativosTiposSel = new Set(r.tipos||[]);
    ativosTiposTodos = r.tipos || [];
    ativosTiposHtml();
    layer.clearLayers();
    (r.pontos||[]).forEach(([codId, tipo, areaLoc, conj, lat, lng])=>{
      const cor = ATIVOS_COR[tipo] || "#0E7490";
      new AtivoTriangulo([lat, lng], { radius:5.5, color:"#fff", weight:1, fillColor:cor, fillOpacity:.95 })
        .bindPopup(`<h4>${escapeHtml(ATIVOS_NOME[tipo]||tipo)} ${escapeHtml(String(codId))}</h4><dl>
          <dt>COD_ID</dt><dd>${escapeHtml(String(codId))}</dd><dt>Tipo (TIP_PN)</dt><dd>${escapeHtml(tipo)}</dd>
          <dt>Área local (ARE_LOC)</dt><dd>${escapeHtml(areaLoc||"—")}</dd><dt>Conjunto (CONJ)</dt><dd>${escapeHtml(conj||"—")}</dd>
          <dt>Latitude</dt><dd>${lat}</dd><dt>Longitude</dt><dd>${lng}</dd></dl>`)
        .addTo(layer);
    });
    if(nota){
      if(!r.total && !ativosTiposTodos.length) nota.textContent = "Base de Postes (PONNOT) ainda não importada.";
      else nota.textContent = r.truncado
        ? `Mostrando ${(r.pontos||[]).length.toLocaleString("pt-BR")} de ${r.total.toLocaleString("pt-BR")} ativos na área — aproxime mais ou filtre o tipo.`
        : `${(r.total||0).toLocaleString("pt-BR")} ativo(s) na área.`;
    }
  }catch(err){
    if(seq === ativosSeq && nota) nota.textContent = "Erro ao buscar ativos: " + err.message;
  }
}

/* ===========================================================================
   v2.15.0 - Equipamentos ligados ao poste: Trafos (UNTRMT), Proteções (UNSEMT),
   Reguladores (UNREMT) e Capacitores (UNCRMT) da BDGD. O Controller acha o poste
   de cada um pelo PAC (que carrega a coordenada) e aqui só vem o que está na
   área visível (GET /equip/area). Item = [codId, posteId, lat, lng, ctmt, conj, v0..v4]:
     trafos      v0 potência kVA · v1 posto · v2 tensão sec. kV · v3 fases · v4 tipo
     protecoes   v0 tipo (TIP_UNID) · v1 elo · v2 corrente A · v3 normal F/A · v4 fases
     reguladores v0 tipo (TIP_REGU) · v1 fases · v2 banco · v3 TIP_UNID
     capacitores v0 potência · v1 fases · v2 banco · v3 TIP_UNID
   Clicar numa proteção ilumina o alimentador dela (rede MT do CTMT). */
const EQUIP_ZOOM_MIN = 14;
const EQUIP_CFG = {
  trafos:      { label:"Trafo",      plural:"Trafos",      cor:"#EA580C", raio:7 },
  protecoes:   { label:"Proteção",   plural:"Proteções",   cor:"#0F766E", raio:4.5 },
  reguladores: { label:"Regulador",  plural:"Reguladores", cor:"#7C3AED", raio:6 },
  capacitores: { label:"Capacitor",  plural:"Capacitores", cor:"#BE185D", raio:5.5 },
};
/* Nomes PROVÁVEIS do TIP_UNID das proteções (confirmar com a tabela de domínio da BDGD).
   O que não está aqui aparece como "Tipo NN". */
const EQUIP_TIP_UNID = { "22":"Chave fusível", "27":"Religador", "19":"Chave faca", "29":"Seccionalizador" };
/* v2.15.23 - cor por tipo de proteção (TIP_UNID); aberta continua vermelha */
const EQUIP_PROT_COR = { "22":"#0F766E", "27":"#2563EB", "19":"#CA8A04", "29":"#0891B2" };
const EQUIP_ROTULO_ZOOM = 16, EQUIP_ROTULO_MAX = 700;
let equipRotulos = true;
try{ equipRotulos = localStorage.getItem("spark_equip_rotulos") !== "0"; }catch(e){}
const EQUIP_COLS = {
  trafos:      ["Potência (kVA)","Posto","Tensão sec. (kV)","Fases","Tipo"],
  protecoes:   ["Tipo (TIP_UNID)","Elo","Corrente (A)","Normal","Fases"],
  reguladores: ["Tipo (TIP_REGU)","Fases","Banco","TIP_UNID",""],
  capacitores: ["Potência","Fases","Banco","TIP_UNID",""],
};
const EQUIP_TIPO_COL = { trafos:1, protecoes:0, reguladores:0, capacitores:3 };   // qual v* vira "tipo" nos filtros
let equipLigado = { trafos:false, protecoes:false, reguladores:false, capacitores:false };
let equipSeq = { trafos:0, protecoes:0, reguladores:0, capacitores:0 };
let equipTimer = null, equipMapa = null, equipDestaqueLayer = null, equipDestaqueSeq = 0;
const equipPosteCache = new Map();
function equipNum(v){ const n = parseFloat(String(v).replace(",",".")); return isNaN(n) ? String(v||"") : String(n); }
function equipNomeTipoProt(v){ return EQUIP_TIP_UNID[v] || (v ? "Tipo "+v : "Proteção"); }
/* Texto fixo no mapa: "código | kVA" (trafo) e "código | elo" (proteção), como no app de referência. */
/* v2.15.24 - nome que o campo conhece (Número Operativo, do Smallworld) quando a base de nomes foi importada; senão o COD_ID da BDGD. */
function equipNome(it){ return (it[11] && String(it[11]).trim()) || it[0]; }
function equipRotuloTexto(camada, it){
  const cod = equipNome(it);
  if(camada==="trafos") return `${cod} | ${equipNum(it[6])}`;
  if(camada==="protecoes"){
    const elo = it[7] && it[7]!=="0" ? it[7] : equipNomeTipoProt(it[6]);
    return `${cod} | ${elo}`;
  }
  if(camada==="reguladores") return `${cod} | ${it[6]||"REG"}`;
  return `${cod} | ${equipNum(it[6])}`;
}
function setEquipRotulos(v){
  equipRotulos = !!v;
  try{ localStorage.setItem("spark_equip_rotulos", equipRotulos ? "1" : "0"); }catch(e){}
  equipAgendar();
}
function equipTitulo(camada, it){
  if(camada==="trafos") return `Trafo ${equipNum(it[6])} kVA`;
  if(camada==="protecoes") return equipNomeTipoProt(it[6]) + (it[7] && it[7]!=="0" ? " " + it[7] : "");
  if(camada==="reguladores") return `Regulador ${it[6]||""}`.trim();
  return `Capacitor ${equipNum(it[6])}`;
}
function equipResumoLinha(camada, it, semNome){
  if(camada==="trafos") return [semNome ? "" : (it[11]||""), `${equipNum(it[6])} kVA`, it[7] ? `posto ${it[7]}` : "", it[9] ? `fases ${it[9]}` : ""].filter(Boolean).join(" · ");
  if(camada==="protecoes") return [equipNomeTipoProt(it[6]), it[7] && it[7]!=="0" ? `elo ${it[7]}` : "", it[8] ? `${equipNum(it[8])} A` : "", it[9]==="A" ? "normal ABERTA" : (it[9]==="F" ? "normal fechada" : "")].filter(Boolean).join(" · ");
  if(camada==="reguladores") return [`tipo ${it[6]||"—"}`, it[7] ? `fases ${it[7]}` : "", it[8] ? `banco ${it[8]}` : ""].filter(Boolean).join(" · ");
  return [`${equipNum(it[6])}`, it[7] ? `fases ${it[7]}` : "", it[8] ? `banco ${it[8]}` : ""].filter(Boolean).join(" · ");
}
function equipPopupHtml(camada, it){
  const cols = EQUIP_COLS[camada];
  const linhas = cols.map((rot,i)=> rot && it[6+i] !== "" && it[6+i] != null
    ? `<dt>${escapeHtml(rot)}</dt><dd>${escapeHtml(camada==="protecoes" && i===0 ? equipNomeTipoProt(it[6])+" ("+it[6]+")" : camada==="protecoes" && i===3 ? (it[9]==="A"?"Aberta":(it[9]==="F"?"Fechada":it[9])) : it[6+i])}</dd>` : "").join("");
  return `<h4>${escapeHtml(equipNome(it))} · ${escapeHtml(equipTitulo(camada, it))}</h4><dl>
    ${it[11]?`<dt>Nº operativo</dt><dd>${escapeHtml(it[11])}</dd>`:""}<dt>COD_ID</dt><dd>${escapeHtml(it[0])}</dd>${it[1]?`<dt>Poste</dt><dd>${escapeHtml(it[1])}</dd>`:`<dt>Poste</dt><dd style="color:var(--muted)">não encontrado (posição pelo PAC)</dd>`}
    ${linhas}${it[4]?`<dt>Alimentador (CTMT)</dt><dd>${escapeHtml(it[4])}</dd>`:""}${it[5]?`<dt>Conjunto</dt><dd>${escapeHtml(it[5])}</dd>`:""}</dl>${camada==="protecoes" && it[11] ? `<p id="equipCadNota" style="margin:4px 0 0; font-size:11.5px; color:var(--muted);">Consultando o cadastro de Proteção…</p>` : ""}
    ${camada==="protecoes" && it[4] ? `<p id="equipDestNota" style="margin:6px 0 0; font-size:11.5px; color:var(--muted);">Iluminando o alimentador ${escapeHtml(it[4])}…</p>` : ""}`;
}
function equipReset(){
  Object.keys(EQUIP_CFG).forEach(k=>{ equipLigado[k] = false; equipSeq[k]++; });
  clearTimeout(equipTimer);
  if(equipMapa){ equipMapa.off("moveend", equipAgendar); equipMapa = null; }
  equipDestaqueSeq++; equipDestaqueLayer = null;
  equipPosteCache.clear();
}
function equipLigar(camada, ligado){
  equipLigado[camada] = ligado;
  const nota = document.getElementById("equipNota_" + camada);
  if(nota) nota.style.display = ligado ? "" : "none";
  if(ligado){
    if(equipMapa !== mapManutencao){ mapManutencao.on("moveend", equipAgendar); equipMapa = mapManutencao; }
    equipCarregar(camada);
  }else{
    equipSeq[camada]++;
    if(mapaCamadaLayersAtual && mapaCamadaLayersAtual[camada]) mapaCamadaLayersAtual[camada].clearLayers();
  }
}
function equipAgendar(){
  clearTimeout(equipTimer);
  equipTimer = setTimeout(()=>{ Object.keys(EQUIP_CFG).forEach(k=>{ if(equipLigado[k]) equipCarregar(k); }); }, 250);
}
function equipDestaqueLimpar(){
  equipDestaqueSeq++;
  if(equipDestaqueLayer) equipDestaqueLayer.clearLayers();
}
async function equipDestacar(ctmt){
  if(!mapManutencao || !ctmt) return;
  const seq = ++equipDestaqueSeq;
  if(!equipDestaqueLayer || !mapManutencao.hasLayer(equipDestaqueLayer)) equipDestaqueLayer = L.layerGroup().addTo(mapManutencao);
  equipDestaqueLayer.clearLayers();
  const aviso = (txt)=>{ const el = document.getElementById("equipDestNota"); if(el) el.textContent = txt; };
  try{
    const feats = (await mapaCacheObterFeatures("mt", String(ctmt))).filter(f=>f.geometry && f.geometry.type==="LineString");
    if(seq !== equipDestaqueSeq) return;
    if(!feats.length){ aviso(`A rede MT do alimentador ${ctmt} não está importada — nada para iluminar.`); return; }
    const linhas = feats.map(f=>f.geometry.coordinates.map(([lng,lat])=>[lat,lng]));
    linhas.forEach(ll=> L.polyline(ll, { color:"#FDE047", weight:12, opacity:.35, interactive:false }).addTo(equipDestaqueLayer));   // brilho
    linhas.forEach(ll=> L.polyline(ll, { color:"#F59E0B", weight:4.5, opacity:.95, interactive:false }).addTo(equipDestaqueLayer));  // fio
    aviso(`Alimentador ${ctmt} iluminado (${linhas.length.toLocaleString("pt-BR")} trecho(s)).`);
  }catch(err){
    if(seq === equipDestaqueSeq) aviso(`Não consegui carregar a rede do alimentador ${ctmt}.`);
  }
}
/* v2.15.25 - disjuntor/trecho/alimentador do cadastro de Proteção, pedidos só ao abrir o popup (a 1ª vez pode levar alguns segundos). */
const equipCadCache = new Map();
async function equipCadastroPreencher(nome){
  if(!nome) return;
  const pinta = (c)=>{
    const el = document.getElementById("equipCadNota"); if(!el) return;
    if(!c || !c.achou){ el.textContent = c && c.erro ? "Cadastro de Proteção indisponível." : "Fora do cadastro de Proteção."; return; }
    el.style.color = "var(--text)";
    el.innerHTML = `<strong>Cadastro:</strong> ${[c.disjuntor?`disjuntor ${escapeHtml(c.disjuntor)}`:"", c.trecho?`trecho ${escapeHtml(c.trecho)}`:"", c.alimentador?`alim. ${escapeHtml(c.alimentador)}`:""].filter(Boolean).join(" · ") || "sem dados"}`;
  };
  if(equipCadCache.has(nome)){ pinta(equipCadCache.get(nome)); return; }
  try{
    const c = await apiGet(`/equip/cadastro?nome=${encodeURIComponent(nome)}`, 180000);
    equipCadCache.set(nome, c); pinta(c);
  }catch(e){ pinta({ achou:false, erro:true }); }
}
function equipMarcador(camada, it, rotulo){
  const cfg = EQUIP_CFG[camada];
  const aberta = camada==="protecoes" && it[9]==="A";
  const corTipo = camada==="protecoes" ? (EQUIP_PROT_COR[it[6]] || cfg.cor) : cfg.cor;
  const m = new AtivoTriangulo([it[2], it[3]], { radius:cfg.raio+1, color:"#fff", weight:1.2, fillColor: aberta ? "#B42318" : corTipo, fillOpacity:.95 });
  m.bindPopup(()=>equipPopupHtml(camada, it));
  if(rotulo) m.bindTooltip(equipRotuloTexto(camada, it), { permanent:true, direction:"bottom", offset:[0,6], className:"equip-rotulo", opacity:1 });
  else m.bindTooltip(`${equipRotuloTexto(camada, it)} · ${equipTitulo(camada, it)}${it[1]?` · poste ${it[1]}`:""}`, { direction:"top", opacity:.95 });
  if(camada==="protecoes"){
    m.on("popupopen", ()=>{ equipDestacar(it[4]); try{ m.bringToFront(); }catch(e){} equipCadastroPreencher(it[11]); });
    m.on("popupclose", ()=>equipDestaqueLimpar());
  }
  return m;
}
async function equipCarregar(camada){
  if(!equipLigado[camada] || !mapManutencao || !mapaCamadaLayersAtual) return;
  const layer = mapaCamadaLayersAtual[camada];
  const nota = document.getElementById("equipNota_" + camada);
  const cfg = EQUIP_CFG[camada];
  if(!API_ONLINE){ if(nota) nota.textContent = "Controller offline — abra pelo iniciar.bat."; return; }
  if(mapManutencao.getZoom() < EQUIP_ZOOM_MIN){
    layer.clearLayers(); equipSeq[camada]++;
    if(nota) nota.textContent = `Aproxime o mapa (zoom ${EQUIP_ZOOM_MIN} ou mais) para ver ${cfg.plural.toLowerCase()}.`;
    return;
  }
  const seq = ++equipSeq[camada];
  const b = mapManutencao.getBounds();
  if(nota) nota.textContent = "Buscando…";
  try{
    const r = await apiGet(`/equip/area?camada=${camada}&sul=${b.getSouth()}&oeste=${b.getWest()}&norte=${b.getNorth()}&leste=${b.getEast()}&limite=8000`, 60000);
    if(seq !== equipSeq[camada] || !equipLigado[camada]) return;
    layer.clearLayers();
    const comRotulo = equipRotulos && mapManutencao.getZoom() >= EQUIP_ROTULO_ZOOM && (r.itens||[]).length <= EQUIP_ROTULO_MAX;
    (r.itens||[]).forEach(it=> equipMarcador(camada, it, comRotulo).addTo(layer));
    if(nota){
      if(!r.total) nota.textContent = (r.itens||[]).length ? "" : `Nenhum(a) ${cfg.label.toLowerCase()} na área (ou a base ainda não foi importada em Importação de Bases > Equipamentos).`;
      else nota.textContent = r.truncado
        ? `Mostrando ${(r.itens||[]).length.toLocaleString("pt-BR")} de ${r.total.toLocaleString("pt-BR")} na área — aproxime mais.`
        : `${r.total.toLocaleString("pt-BR")} ${cfg.plural.toLowerCase()} na área.`;
    }
  }catch(err){
    if(seq === equipSeq[camada] && nota) nota.textContent = "Erro ao buscar: " + err.message;
  }
}
/* v2.15.23 - busca de equipamento pelo código (COD_ID) na caixa "Buscar OS" do mapa. */
let equipBuscaTimer = null, equipBuscaSeq = 0, equipBuscaItens = [], equipBuscaTemp = null;
function equipBuscaAgendar(valor){
  clearTimeout(equipBuscaTimer);
  const box = document.getElementById("equipBuscaRes");
  const v = String(valor||"").trim();
  if(v.length < 4 || !API_ONLINE){ equipBuscaSeq++; if(box){ box.style.display = "none"; box.innerHTML = ""; } return; }
  equipBuscaTimer = setTimeout(()=>equipBuscar(v), 350);
}
async function equipBuscar(v){
  const seq = ++equipBuscaSeq;
  const box = document.getElementById("equipBuscaRes");
  if(!box) return;
  const achados = [];
  await Promise.all(Object.keys(EQUIP_CFG).map(async camada=>{
    try{
      const r = await apiGet(`/equip/lista?camada=${camada}&busca=${encodeURIComponent(v)}&pagina=1`, 20000);
      (r.itens||[]).slice(0,5).forEach(it=> achados.push({ camada, it }));
    }catch(e){}
  }));
  if(seq !== equipBuscaSeq) return;
  equipBuscaItens = achados.slice(0,8);
  if(!equipBuscaItens.length){ box.style.display = "none"; box.innerHTML = ""; return; }
  box.innerHTML = `<div class="equip-busca-tit">Equipamentos</div>` + equipBuscaItens.map((a,i)=>
    `<button type="button" onclick="equipIrPara(${i})"><strong>${escapeHtml(equipNome(a.it))}</strong> <span>${escapeHtml(EQUIP_CFG[a.camada].label)} · ${escapeHtml(equipResumoLinha(a.camada, a.it, true) || "—")}${a.it[1]?` · poste ${escapeHtml(a.it[1])}`:""}</span></button>`).join("");
  box.style.display = "block";
}
function equipIrPara(i){
  const a = equipBuscaItens[i]; if(!a || !mapManutencao) return;
  const box = document.getElementById("equipBuscaRes"); if(box) box.style.display = "none";
  if(equipBuscaTemp){ try{ mapManutencao.removeLayer(equipBuscaTemp); }catch(e){} equipBuscaTemp = null; }
  mapManutencao.setView([a.it[2], a.it[3]], Math.max(mapManutencao.getZoom(), 18));
  const m = equipMarcador(a.camada, a.it, true).addTo(mapManutencao);
  equipBuscaTemp = m;
  m.openPopup();
  m.on("popupclose", ()=>{ try{ mapManutencao.removeLayer(m); }catch(e){} if(equipBuscaTemp===m) equipBuscaTemp = null; });
}
/* Trafo / proteção do poste da OS (popup e tooltip da OS) - busca sob demanda, com cache. */
function equipPosteHtml(posteId){
  const d = equipPosteCache.get(posteId);
  if(!d || d==="erro") return "";
  if(d==="carregando") return `<dt>Equipamentos</dt><dd style="color:var(--muted);">buscando…</dd>`;
  const linhas = [];
  Object.keys(EQUIP_CFG).forEach(c=>{
    (d[c]||[]).forEach(it=> linhas.push(`<dt>${escapeHtml(EQUIP_CFG[c].label)}</dt><dd>${escapeHtml(equipResumoLinha(c, it))}</dd>`));
  });
  return linhas.join("");
}
async function equipPosteCarregar(posteId, depois){
  if(!posteId || equipPosteCache.has(posteId)){ return; }
  equipPosteCache.set(posteId, "carregando");
  try{
    const d = await apiGet("/equip/poste?id=" + encodeURIComponent(posteId), 30000);
    equipPosteCache.set(posteId, d || {});
  }catch(err){
    equipPosteCache.set(posteId, "erro");
  }
  if(depois) depois();
}

async function trocarAlimentadorMt(selecionados){
  mapaMtSelecionados = selecionados;
  atualizarResumoAlimentadorMulti("mt");
  await carregarRedeMt(selecionados);
}

/* Reserva Legal, APP, Rede BT e Rede AT: todas particionadas por
   alimentador no Controller — um .geojson por alimentador (ver
   Get-CamadaConfig), vindas de shapefile (BT/AT) ou de vários .kmz um por
   alimentador (RL/APP, "Trecho_<ALIMENTADOR>_RL.kmz" / "..._APP.kmz") — e a
   base é incremental (cada upload só sobrescreve a partição daquele
   alimentador). Por isso seguem o MESMO esquema de carregamento sob-demanda
   da MT (?rl=/?app=/?bt=/?at= por alimentador, ?rl=__todos__ etc. via
   streaming). carregarCamadaParticionada() abaixo generaliza essa lógica
   pra não duplicar o que carregarRedeMt já faz — a MT continua com sua
   própria função, intocada, pra não arriscar regressão no que já funciona.

   v2.11.3 — BT e AT entraram nesse esquema agora: até aqui eram um arquivo
   único carregado por inteiro (ver popularSelectAlimentadorSimples, que
   existia antes e foi removida). Assim que a BT real foi importada
   (100MB+), isso sozinho travava o Controller (single-threaded) tempo
   suficiente pra estourar o timeout do navegador em QUALQUER outro pedido
   concorrente ("signal is aborted without reason" — reportado pelo Mario:
   "tu não separou a bt igual a mt, tem 1 arquivo de mais de 100mb pra
   carregar de uma só vez"). Agora cada alimentador de BT/AT é seu próprio
   arquivo pequeno, igual à MT. */
let mapaReservaSelecionados = [], mapaAppSelecionados = [];
let mapaBtSelecionados = [], mapaAtSelecionados = [];   // default vazio, mesmo motivo do mapaMtSelecionados
const CAMADA_PARTICIONADA_CONFIG = {
  mt:      { queryParam: "ctmt", chaveResposta: "rede_mt",       cor: "#6D28D9", tipo: "linha", peso: 2.4 },
  reserva: { queryParam: "rl",  chaveResposta: "reserva_legal", cor: "#1E7A34", tipo: "poligono" },
  app:     { queryParam: "app", chaveResposta: "app",           cor: "#1B4F8C", tipo: "poligono" },
  bt:      { queryParam: "bt",  chaveResposta: "rede_bt",       cor: "#F37020", tipo: "linha", peso: 1.8, dash: "4 3" },
  at:      { queryParam: "at",  chaveResposta: "rede_at",       cor: "#B42318", tipo: "linha", peso: 3.5 },
};
const CAMADA_PARTICIONADA_NOME = { mt: "a Rede MT", reserva: "a Reserva Legal", app: "a APP", bt: "a Rede BT", at: "a Rede AT" };
const CAMADA_PARTICIONADA_NOME_CURTO = { mt: "Rede MT", reserva: "Reserva Legal", app: "APP", bt: "Rede BT", at: "Rede AT" };
function getSelecionadosCamada(prefixo){
  return { mt:mapaMtSelecionados, bt:mapaBtSelecionados, at:mapaAtSelecionados, reserva:mapaReservaSelecionados, app:mapaAppSelecionados }[prefixo] || [];
}
function setSelecionadosCamada(prefixo, valor){
  if(prefixo==="mt") mapaMtSelecionados = valor;
  else if(prefixo==="bt") mapaBtSelecionados = valor;
  else if(prefixo==="at") mapaAtSelecionados = valor;
  else if(prefixo==="reserva") mapaReservaSelecionados = valor;
  else if(prefixo==="app") mapaAppSelecionados = valor;
}
/* v2.12.0 - cada alimentador vem do cache de sessão (mapacache.js) quando a
   pré-carga em segundo plano já o trouxe — escolher/trocar alimentadores
   fica instantâneo, sem ir ao Controller. Se ainda não está na memória, é
   buscado sozinho (1 por vez, nunca em paralelo). "Todos" = percorre a lista
   de alimentadores da camada do mesmo jeito. Troca rápida de seleção: cada
   chamada ganha um "token" e a anterior pára de desenhar assim que percebe
   que já existe uma mais nova (senão duas cargas desenhariam na mesma layer). */
/* v3.12.0 - CARGA POR ZOOM + ÁREA VISÍVEL (mesma ideia dos postes, num "meio do caminho").
   Os alimentadores escolhidos continuam vindo do cache de sessão, mas em vez de criar um objeto do
   Leaflet para CADA trecho/polígono (centenas de milhares com "Todos"), guarda só os dados (com a
   caixa de coordenadas de cada um) e desenha apenas o que cai na tela (mais uma margem), refazendo
   a cada movimento do mapa que sair da área já desenhada.
     - zoom >= CAMADA_ZOOM_MIN[camada]: desenha o que está na tela (teto de CAMADA_MAX_DESENHO);
     - zoom abaixo disso: só desenha se couber pouco (<= CAMADA_LIVRE) — 1 ou 2 alimentadores
       aparecem inteiros de longe; "Todos" pede para aproximar. */
const CAMADA_ZOOM_MIN = { at:10, mt:12, reserva:12, app:12, bt:13 };
const CAMADA_MAX_DESENHO = 6000;
const CAMADA_LIVRE = 2500;
const mapaCamadaReg = {};          // prefixo -> { itens:[{f,s,w,n,e}], total, nAlim, desenhado:LatLngBounds|null }
let mapaCamadaTimer = null;
function camadaViewportReset(){
  Object.keys(mapaCamadaReg).forEach(k=>{ delete mapaCamadaReg[k]; });
  clearTimeout(mapaCamadaTimer);
}
function camadaRegistrar(reg, features){
  (features||[]).forEach(f=>{
    const g = f && f.geometry; if(!g) return;
    const cs = g.type === "LineString" ? g.coordinates : (g.type === "Polygon" && g.coordinates ? g.coordinates[0] : null);
    if(!cs || !cs.length) return;
    let s = 90, n = -90, w = 180, e = -180;
    for(let i=0; i<cs.length; i++){
      const lng = cs[i][0], lat = cs[i][1];
      if(lat < s) s = lat; if(lat > n) n = lat; if(lng < w) w = lng; if(lng > e) e = lng;
    }
    reg.itens.push({ f, s, w, n, e });
  });
  reg.total = reg.itens.length;
}
function camadaNota(prefixo, texto){
  const el = document.getElementById(prefixo + "AlimentadorNota");
  if(el){ el.textContent = texto; el.style.display = texto ? "" : "none"; }
}
function camadaAtualizarViewport(prefixo, forcar){
  const cfg = CAMADA_PARTICIONADA_CONFIG[prefixo];
  const reg = mapaCamadaReg[prefixo];
  const layerGroup = mapaCamadaLayersAtual && mapaCamadaLayersAtual[prefixo];
  if(!cfg || !reg || !layerGroup || !mapManutencao) return;
  const unidade = cfg.tipo === "linha" ? "trecho(s)" : "polígono(s)";
  const nome = CAMADA_PARTICIONADA_NOME_CURTO[prefixo] || prefixo;
  const z = Math.round(mapManutencao.getZoom()), zmin = CAMADA_ZOOM_MIN[prefixo] || 12;
  const perto = z >= zmin;
  const vis = mapManutencao.getBounds();
  if(!forcar && reg.desenhado && reg.desenhado.contains(vis)) return;
  const sel = b => reg.itens.filter(it=> it.n >= b.getSouth() && it.s <= b.getNorth() && it.e >= b.getWest() && it.w <= b.getEast());
  const limite = perto ? CAMADA_MAX_DESENHO : CAMADA_LIVRE;
  let area = perto ? vis.pad(0.5) : vis;
  let lista = sel(area);
  if(perto && lista.length > limite && area !== vis){ area = vis; lista = sel(area); }
  const sufixoAlim = reg.nAlim > 1 ? ` de ${reg.nAlim} alimentadores` : "";
  if(lista.length > limite && !perto){
    layerGroup.clearLayers(); reg.desenhado = null;
    camadaNota(prefixo, `${reg.total.toLocaleString("pt-BR")} ${unidade}${sufixoAlim} carregado(s) — muitos para esta área: aproxime o mapa (zoom ${zmin} ou mais, agora ${z}) para ver ${nome}.`);
    return;
  }
  let cortado = false;
  if(lista.length > limite){ lista = lista.slice(0, limite); cortado = true; }
  layerGroup.clearLayers();
  const feats = lista.map(it=>it.f);
  if(cfg.tipo === "linha") addPolylineFeatures(feats, layerGroup, cfg.cor, cfg.peso, cfg.dash);
  else addPolygonFeatures(feats, layerGroup, cfg.cor);
  reg.desenhado = cortado ? null : area;
  camadaNota(prefixo, `${lista.length.toLocaleString("pt-BR")} de ${reg.total.toLocaleString("pt-BR")} ${unidade}${sufixoAlim} na área visível${cortado ? ` — há mais do que cabe: aproxime o mapa para ver tudo` : (perto ? "" : ` — aproxime (zoom ${zmin}+) para ver sempre`)}.`);
}
function camadasViewportAgendar(){
  clearTimeout(mapaCamadaTimer);
  mapaCamadaTimer = setTimeout(()=>{
    if(!mapManutencao || !mapaCamadaLayersAtual) return;
    Object.keys(mapaCamadaReg).forEach(pref=>{
      const g = mapaCamadaLayersAtual[pref];
      if(g && mapManutencao.hasLayer(g)) camadaAtualizarViewport(pref, false);
    });
  }, 160);
}
const mapaCargaToken = { mt:0, bt:0, at:0, reserva:0, app:0 };
async function carregarCamadaParticionada(prefixo, selecionados){
  const cfg = CAMADA_PARTICIONADA_CONFIG[prefixo];
  const layerGroup = mapaCamadaLayersAtual && mapaCamadaLayersAtual[prefixo];
  if(!cfg || !layerGroup || !selecionados) return;
  const meuToken = ++mapaCargaToken[prefixo];
  const cancelado = ()=> meuToken !== mapaCargaToken[prefixo] || !mapaCamadaLayersAtual || mapaCamadaLayersAtual[prefixo] !== layerGroup;
  const unidade = cfg.tipo === "linha" ? "trecho(s)" : "polígono(s)";
  const notaEl = document.getElementById(prefixo + "AlimentadorNota");
  layerGroup.clearLayers();
  delete mapaCamadaReg[prefixo];
  if(selecionados.length===0){ if(notaEl) notaEl.textContent = "Nenhum alimentador selecionado."; return; }
  const grupos = mapaAlimentadorGrupos[prefixo] || [];
  const todos = selecionados.includes("__todos__");
  const codigos = todos ? grupos.map(g=>g.ctmt) : selecionados;
  const reg = { itens:[], total:0, nAlim:codigos.length, desenhado:null };
  mapaCamadaReg[prefixo] = reg;
  if(todos && notaEl) notaEl.textContent = codigos.length > 30
    ? `Lendo os ${codigos.length} alimentadores…`
    : "Carregando todos os alimentadores…";
  try{
    for(let i=0; i<codigos.length; i++){
      if(cancelado()) return;
      if(notaEl && codigos.length>1) notaEl.textContent = `Carregando alimentador ${i+1} de ${codigos.length} — ${reg.total.toLocaleString("pt-BR")} ${unidade} até agora…`;
      const features = await mapaCacheObterFeatures(prefixo, codigos[i]);
      if(cancelado()) return;
      camadaRegistrar(reg, features);
      // desenha o que já dá (só a área visível) de vez em quando e cede o navegador
      if(i % 6 === 5){
        camadaAtualizarViewport(prefixo, true);
        await new Promise(r=>setTimeout(r,0));
        if(cancelado()) return;
      }
    }
    camadaAtualizarViewport(prefixo, true);
  }catch(err){
    toast(`Não consegui carregar ${CAMADA_PARTICIONADA_NOME[prefixo] || prefixo}: ` + err.message);
  }
}
async function trocarAlimentadorReserva(selecionados){
  mapaReservaSelecionados = selecionados;
  atualizarResumoAlimentadorMulti("reserva");
  await carregarCamadaParticionada("reserva", selecionados);
}
async function trocarAlimentadorApp(selecionados){
  mapaAppSelecionados = selecionados;
  atualizarResumoAlimentadorMulti("app");
  await carregarCamadaParticionada("app", selecionados);
}
async function trocarAlimentadorBt(selecionados){
  mapaBtSelecionados = selecionados;
  atualizarResumoAlimentadorMulti("bt");
  await carregarCamadaParticionada("bt", selecionados);
}
async function trocarAlimentadorAt(selecionados){
  mapaAtSelecionados = selecionados;
  atualizarResumoAlimentadorMulti("at");
  await carregarCamadaParticionada("at", selecionados);
}
// Monta (1ª vez) ou esvazia o combo multi-seleção de Reserva Legal/APP a
// partir da lista {ctmt,nome} que o Controller devolve em
// reserva_legal_disponiveis/app_disponiveis (GET /manutencao/camadas sem
// ?rl=/?app=), e carrega a seleção salva (ou nada, por padrão — mesma
// regra da MT: não força "Todos" sozinho). Chamado de initMapaManutencao().
// Lembrete "acabei de importar" (pedido do Mario: "o resultado da
// importação do kmz tem que aparecer no mapa de manutenção") — guardado no
// localStorage (sobrevive à troca de tela) pra popularMultiSelectParticionado
// pré-marcar "Todos" sozinho na PRÓXIMA vez que o Mapa de Manutenção for
// aberto, em vez de deixar vazio por padrão como de costume. Só funciona
// quando sobram POUCOS alimentadores no total (mesmo limite de "pesado"
// usado pra MT, 30) — com uma base grande (reimportação, centenas de
// alimentadores já carregados antes), continua valendo o padrão de não
// carregar nada sozinho, só com um aviso discreto em vez de pré-marcar.
function lembrarAlimentadoresRecemImportados(camada, teveSucesso){
  const prefixo = camada === "app" ? "app" : "reserva";
  try{
    if(teveSucesso) localStorage.setItem("spark_kmz_recem_importado_" + prefixo, "1");
    else localStorage.removeItem("spark_kmz_recem_importado_" + prefixo);
  }catch(e){ /* localStorage indisponível — sem pré-seleção automática, sem quebrar nada */ }
}
/* Combo travado enquanto a camada ainda carrega em segundo plano (mapacache.js). */
function mostrarComboCarregando(prefixo){
  const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
  const notaEl = document.getElementById(prefixo + "AlimentadorNota");
  if(notaEl) notaEl.style.display = "none";
  if(!hostEl) return;
  const texto = "⏳ " + mapaCacheProgressoTexto(prefixo);
  const existente = hostEl.querySelector("[data-carregando]");
  if(existente){ existente.textContent = texto; return; }
  hostEl.innerHTML = `<span class="alimentador-multiselect-carregando" data-carregando="1" title="Os alimentadores estão sendo carregados em segundo plano — o combo libera sozinho quando terminar.">${escapeHtml(texto)}</span>`;
}
// lista {ctmt,nome} de cada camada, como veio do Controller — guardada pra
// poder (re)montar o combo quando a pré-carga terminar
let mapaListasDoMapa = { mt:[], reserva:[], app:[], at:[], bt:[] };
let mapaCacheDesinscrever = null;
async function popularCamadaNoMapa(prefixo){
  const lista = mapaListasDoMapa[prefixo] || [];
  if(prefixo === "mt") await popularMultiSelectMt(lista);
  else await popularMultiSelectParticionado(prefixo, lista);
}
// Chamada a cada avanço da pré-carga enquanto o Mapa de Manutenção está
// aberto: atualiza o "carregando X/Y" e libera o combo de cada camada assim
// que ela termina.
function mapaAtualizarCombosPelaPreCarga(){
  ["mt","reserva","app","at","bt"].forEach(prefixo=>{
    const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
    if(!hostEl) return;
    const placeholder = hostEl.querySelector("[data-carregando]");
    if(!placeholder) return;
    if(mapaCacheOcupada(prefixo)){ placeholder.textContent = "⏳ " + mapaCacheProgressoTexto(prefixo); return; }
    popularCamadaNoMapa(prefixo);
  });
  const statusEl = document.getElementById("mapaCacheStatus");
  if(statusEl){
    const ocupadas = ["mt","reserva","app","at","bt"].filter(p=>mapaCacheOcupada(p));
    const veraOcupada = mapaCache.iniciada && (mapaCache.vera.estado==="aguardando" || mapaCache.vera.estado==="carregando");
    statusEl.textContent = (ocupadas.length || veraOcupada)
      ? "Carregando as camadas em segundo plano — ficam guardadas na memória até você sair do sistema."
      : (mapaCache.iniciada ? `Camadas na memória da sessão (${mapaCacheMegabytes()} MB) — trocar de alimentador é instantâneo.` : "");
  }
}
// Popula (1ª vez) ou esvazia o combo multi-seleção de uma camada
// particionada (reserva/app/bt/at) a partir da lista {ctmt,nome} que o
// Controller devolve (GET /manutencao/camadas sem o parâmetro daquela
// camada), e carrega a seleção salva (ou nada, por padrão — não força
// "Todos" sozinho). Chamado de initMapaManutencao(). Genérica desde a
// v2.11.3 (quando BT/AT entraram no mesmo esquema particionado da MT) via
// getSelecionadosCamada/setSelecionadosCamada, em vez de só reserva/app.
async function popularMultiSelectParticionado(prefixo, disponiveisBrutos){
  const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
  const notaEl = document.getElementById(prefixo + "AlimentadorNota");
  const disponiveis = (disponiveisBrutos || []).slice()
    .sort((a,b)=> (a.nome||a.ctmt).localeCompare(b.nome||b.ctmt, "pt-BR", { sensitivity:"base" }));
  mapaAlimentadorGrupos[prefixo] = disponiveis.map(a=>({ ctmt:a.ctmt, nome:a.nome||a.ctmt }));
  if(disponiveis.length === 0){
    if(hostEl) hostEl.innerHTML = "";
    if(notaEl) notaEl.style.display = "none";
    setSelecionadosCamada(prefixo, []);
    if(mapaCamadaLayersAtual && mapaCamadaLayersAtual[prefixo]) { mapaCamadaLayersAtual[prefixo].clearLayers(); delete mapaCamadaReg[prefixo]; }
    return;
  }
  // v2.12.0 - enquanto a pré-carga em segundo plano ainda está trazendo esta
  // camada, o combo fica travado ("carregando X/Y…"); quando ela termina, a
  // tela chama esta função de novo (ver mapaAtualizarCombosPelaPreCarga) e o
  // combo de verdade aparece, já com a seleção salva.
  if(mapaCacheOcupada(prefixo)){ mostrarComboCarregando(prefixo); return; }
  if(notaEl) notaEl.style.display = "";
  const codigos = disponiveis.map(a=>a.ctmt);
  let selecionadosAtuais = getSelecionadosCamada(prefixo).filter(v=>v==="__todos__" || codigos.includes(v));
  let marcouAutomatico = false;
  // Lembrete "acabei de importar" (pedido do Mario) só existe pra Reserva
  // Legal/APP, que vêm de upload de .kmz um por vez — o upload de
  // shapefile da BT/AT (um só arquivo com todos os alimentadores) já
  // recarrega a tela inteira depois de importar, não precisa desse flag.
  if(prefixo === "reserva" || prefixo === "app"){
    try{
      const flagKey = "spark_kmz_recem_importado_" + prefixo;
      if(localStorage.getItem(flagKey) === "1"){
        localStorage.removeItem(flagKey);
        if(selecionadosAtuais.length===0 && disponiveis.length<=30){ selecionadosAtuais = ["__todos__"]; marcouAutomatico = true; }
      }
    }catch(e){ /* sem localStorage, segue sem pré-seleção */ }
  }
  setSelecionadosCamada(prefixo, selecionadosAtuais);
  if(hostEl) hostEl.innerHTML = alimentadorMultiSelectHtml(prefixo, mapaAlimentadorGrupos[prefixo], selecionadosAtuais);
  await carregarCamadaParticionada(prefixo, selecionadosAtuais);
  if(marcouAutomatico) toast(`${disponiveis.length>1?"Alimentadores importados":"Alimentador importado"} já aparecendo no mapa (${CAMADA_PARTICIONADA_NOME_CURTO[prefixo] || prefixo}).`);
}

/* ---------------- combo de alimentador com checkbox (multi-seleção) ----------------
   Substitui o <select> de um valor só nas 3 camadas (MT/BT/AT) por um
   <details> aninhado com uma caixinha de seleção por alimentador, pra dar
   pra marcar mais de um ao mesmo tempo (pedido do Mario). Fica dentro do
   <label class="breaker"> que já existe pra ligar/desligar a camada
   inteira — como clicar em QUALQUER lugar de um <label> normalmente ativa
   o controle associado a ele (o checkbox da camada), todo clique aqui
   dentro precisa de stopPropagation, do mesmo jeito que o <select> antigo
   já fazia.

   IMPORTANTE (bug corrigido): a cada marcar/desmarcar, atualizarResumoAlimentadorMulti()
   NÃO reconstrói mais o innerHTML inteiro do host — isso trocava o
   <details> por um novo, sem o atributo "open", e fechava o dropdown a
   cada clique (reportado pelo Mario: "quando eu clicar na seleção fechar
   a combobox é ruim"). Agora ela só ajusta o texto do <summary> e o
   .checked de cada <input> no lugar (sincronizarPainelAlimentadorMulti).
   O rebuild completo (alimentadorMultiSelectHtml) fica só pra quando o
   combo é populado/trocado de alimentadores disponíveis (import novo,
   troca de camada), não pra cada toggle. */
let mapaAlimentadorGrupos = { mt:[], bt:[], at:[], reserva:[], app:[] };
function alimentadorMultiSelectHtml(prefixo, grupos, selecionados){
  const todos = selecionados.includes("__todos__");
  const resumo = todos ? `Todos (${grupos.length})` : (selecionados.length===0 ? "Nenhum selecionado" : `${selecionados.length} de ${grupos.length} selecionado(s)`);
  return `
    <details class="alimentador-multiselect" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
      <summary>${escapeHtml(resumo)}</summary>
      <div class="alimentador-multiselect-panel">
        <input type="text" class="alimentador-multiselect-search" placeholder="Buscar alimentador…"
               oninput="filtrarAlimentadorMulti('${prefixo}', this.value)">
        <div class="alimentador-multiselect-actions">
          <label class="alimentador-multiselect-item alimentador-multiselect-todos">
            <input type="checkbox" ${todos?"checked":""} onchange="onToggleAlimentadorMulti('${prefixo}','__todos__',this.checked)">
            <span>Todos</span>
          </label>
          <button type="button" class="alimentador-multiselect-clear" onclick="limparSelecaoAlimentadorMulti('${prefixo}')">Limpar seleção</button>
        </div>
        <div class="alimentador-multiselect-divider"></div>
        <div class="alimentador-multiselect-list">
          ${grupos.map(g=>`
          <label class="alimentador-multiselect-item" data-nome="${escapeHtml((g.nome + " " + g.ctmt).toLowerCase())}">
            <input type="checkbox" data-ctmt="${escapeHtml(g.ctmt)}" ${(!todos && selecionados.includes(g.ctmt))?"checked":""} onchange="onToggleAlimentadorMulti('${prefixo}','${escapeHtml(g.ctmt)}',this.checked)">
            <span>${escapeHtml(g.nome)}</span>
          </label>`).join("")}
        </div>
      </div>
    </details>
  `;
}
// Filtro de busca dentro do painel: só esconde/mostra os itens que já
// estão no DOM (não refaz o innerHTML), então o foco do campo de busca e
// o estado "aberto" do <details> não se perdem a cada letra digitada.
function filtrarAlimentadorMulti(prefixo, termo){
  const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
  if(!hostEl) return;
  const t = (termo || "").trim().toLowerCase();
  hostEl.querySelectorAll(".alimentador-multiselect-list .alimentador-multiselect-item").forEach(el=>{
    const nome = el.getAttribute("data-nome") || "";
    el.style.display = (!t || nome.includes(t)) ? "" : "none";
  });
}
function aplicarSelecaoAlimentador(prefixo, novo){
  if(prefixo === "mt"){ trocarAlimentadorMt(novo); }
  else if(prefixo === "bt"){ trocarAlimentadorBt(novo); }
  else if(prefixo === "at"){ trocarAlimentadorAt(novo); }
  else if(prefixo === "reserva"){ trocarAlimentadorReserva(novo); }
  else if(prefixo === "app"){ trocarAlimentadorApp(novo); }
}
function onToggleAlimentadorMulti(prefixo, valor, marcado){
  const estadoAtual = getSelecionadosCamada(prefixo);
  let novo;
  if(valor === "__todos__"){
    novo = marcado ? ["__todos__"] : [];
  } else {
    novo = estadoAtual.filter(v=>v!=="__todos__");
    novo = marcado ? [...new Set([...novo, valor])] : novo.filter(v=>v!==valor);
  }
  aplicarSelecaoAlimentador(prefixo, novo);
}
// Atalho pedido pelo Mario: opção rápida pra voltar a "nenhum selecionado"
// (o botão aparece ao lado de "Todos" dentro do painel).
function limparSelecaoAlimentadorMulti(prefixo){
  aplicarSelecaoAlimentador(prefixo, []);
}
// Ajusta só o resumo (<summary>) e o .checked de cada checkbox já
// renderizado, sem tocar no <details> em si — é isso que mantém o
// dropdown aberto depois de marcar/desmarcar um item.
function sincronizarPainelAlimentadorMulti(prefixo, grupos, selecionados){
  const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
  if(!hostEl) return;
  const todos = selecionados.includes("__todos__");
  const summaryEl = hostEl.querySelector("summary");
  if(summaryEl) summaryEl.textContent = todos
    ? `Todos (${grupos.length})`
    : (selecionados.length===0 ? "Nenhum selecionado" : `${selecionados.length} de ${grupos.length} selecionado(s)`);
  const todosInput = hostEl.querySelector(".alimentador-multiselect-todos input[type=checkbox]");
  if(todosInput) todosInput.checked = todos;
  hostEl.querySelectorAll(".alimentador-multiselect-list input[type=checkbox]").forEach(input=>{
    input.checked = !todos && selecionados.includes(input.getAttribute("data-ctmt"));
  });
}
function atualizarResumoAlimentadorMulti(prefixo){
  const hostEl = document.getElementById(prefixo + "AlimentadorMultiHost");
  const grupos = mapaAlimentadorGrupos[prefixo] || [];
  const selecionados = getSelecionadosCamada(prefixo);
  if(!hostEl || grupos.length <= 1) return;
  // Já existe um <details> renderizado pra esse prefixo? Só sincroniza no
  // lugar. Senão (primeira vez), faz o rebuild completo mesmo.
  if(hostEl.querySelector("details")) sincronizarPainelAlimentadorMulti(prefixo, grupos, selecionados);
  else hostEl.innerHTML = alimentadorMultiSelectHtml(prefixo, grupos, selecionados);
}

function normalizarOSApi(o){
  /* A API guarda a coordenada aninhada em "localizacao" (mesmo formato do
     model/manutencao_os.json e do endpoint GET /manutencao/os) — aqui achata
     pro formato flat (lat/lng) que o resto do mapa e a tabela de OS esperam,
     e garante valores padrão pros campos que a tabela usa sem checar null
     (protecaoId em <td class="mono">, etc.) */
  const loc = o.localizacao || {};
  return {
    id: o.id, origem: (o.origem === "GRID" ? "SGM" : o.origem) || "SGM",
    statusOS: o.statusOS || "Pendente",
    tipoServico: o.tipoServico || "—", tipoEquipeNecessaria: o.tipoEquipeNecessaria || "",
    equipeId: o.equipeId || null,
    prioridadeEW: !!o.prioridadeEW,
    dataAbertura: o.dataAbertura || null, dataExecucao: o.dataExecucao || null,
    alimentador: o.alimentador || "", conjunto: o.conjunto || "", localidade: o.localidade || o.conjunto || "",
    protecaoId: o.protecaoId || "",
    lat: (typeof o.lat === "number") ? o.lat : loc.lat,
    lng: (typeof o.lng === "number") ? o.lng : loc.lng,
    fonte: o.fonte || loc.fonte || "",
    aprox: !!(o.aprox || loc.aproximada),
    previstoPorEsquema: !!o.previstoPorEsquema,
    previsto: (typeof o.previsto === "number") ? o.previsto : 0,
    realizado: (typeof o.realizado === "number") ? o.realizado : 0,
    previstoPoda: (typeof o.previstoPoda === "number") ? o.previstoPoda : null,
    previstoLimpeza: (typeof o.previstoLimpeza === "number") ? o.previstoLimpeza : null,
    previstoEstrutura: (typeof o.previstoEstrutura === "number") ? o.previstoEstrutura : null,
    realizadoPoda: (typeof o.realizadoPoda === "number") ? o.realizadoPoda : null,
    realizadoLimpeza: (typeof o.realizadoLimpeza === "number") ? o.realizadoLimpeza : null,
    realizadoEstrutura: (typeof o.realizadoEstrutura === "number") ? o.realizadoEstrutura : null,
    observacao: o.observacao || "",
    descEsquema: o.descEsquema || ""
  };
}
/* Combo da Rede MT (a MT tem lista/banner próprios, por isso não passa por
   popularMultiSelectParticionado). Mesma regra: travado enquanto a MT ainda
   carrega em segundo plano, montado de verdade quando termina. */
async function popularMultiSelectMt(listaBruta){
  const bannerEl = document.getElementById("mapaInfoBannerTexto");
  const multiHostEl = document.getElementById("mtAlimentadorMultiHost");
  const notaEl = document.getElementById("mtAlimentadorNota");
  // Ordenado por nome (não pelo código CTMT, que não diz nada pro usuário)
  // pra achar um alimentador na lista sem precisar rolar tudo.
  mapaMtDisponiveis = (listaBruta || []).slice()
    .sort((a,b)=> (a.nome||a.ctmt).localeCompare(b.nome||b.ctmt, "pt-BR", { sensitivity:"base" }));
  mapaAlimentadorGrupos.mt = mapaMtDisponiveis.map(a=>({ ctmt:a.ctmt, nome:a.nome||a.ctmt }));
  if(mapaMtDisponiveis.length === 0){
    if(multiHostEl) multiHostEl.innerHTML = "";
    if(notaEl) notaEl.style.display = "none";
    mapaMtSelecionados = [];
    if(bannerEl) bannerEl.innerHTML = `Mapa com base cartográfica real (OpenStreetMap via Leaflet). Nenhum shapefile de Rede MT foi importado ainda — importe em "Importação de Bases" para ver a rede real aqui.`;
    return;
  }
  if(mapaCacheOcupada("mt")){
    mostrarComboCarregando("mt");
    if(bannerEl) bannerEl.innerHTML = `Mapa com base cartográfica real (OpenStreetMap via Leaflet). Carregando as camadas em segundo plano — os combos de alimentador liberam sozinhos quando cada camada terminar.`;
    return;
  }
  if(notaEl) notaEl.style.display = "";
  const codigos = mapaMtDisponiveis.map(a=>a.ctmt);
  // O código CTMT (ex.: "1378394") é um identificador interno da BDGD, não faz
  // sentido pra quem tá escolhendo uma equipe/alimentador — mostra só o nome;
  // cai pro próprio código só quando não há nome.
  const rotulo = a => a.nome || a.ctmt;
  // Não força "Todos" (nem o alimentador da primeira OS visível): com 335
  // alimentadores reais, desenhar "Todos" sem o usuário pedir deixa o mapa
  // pesado demais (pedido do Mario). Fica o que estava salvo, ou vazio.
  const padrao = mapaMtSelecionados.filter(v=>v==="__todos__" || codigos.includes(v));
  mapaMtSelecionados = padrao;
  if(multiHostEl) multiHostEl.innerHTML = alimentadorMultiSelectHtml("mt", mapaAlimentadorGrupos.mt, padrao);
  await carregarRedeMt(padrao);
  const descricaoSelecao = padrao.includes("__todos__")
    ? "todos os alimentadores"
    : (padrao.length === 0
        ? "nenhum alimentador selecionado"
        : (padrao.length === 1
            ? `o alimentador <strong>${escapeHtml(rotulo(mapaMtDisponiveis.find(a=>a.ctmt===padrao[0]) || { ctmt:padrao[0] }))}</strong>`
            : `${padrao.length} alimentadores selecionados`));
  if(bannerEl) bannerEl.innerHTML = `Mapa com base cartográfica real (OpenStreetMap via Leaflet). Camadas carregadas de <span class="mono">geo/</span> — Rede MT mostrando ${descricaoSelecao} (${mapaMtDisponiveis.length} ${mapaMtDisponiveis.length>1?"disponíveis":"disponível"}, escolha ao lado — dá pra marcar mais de um). Reserva Legal/APP/BT/AT usam o shapefile/kmz real por alimentador quando importado, ou ficam vazias enquanto isso.`;
}
async function initMapaManutencao(){
  const el = document.getElementById("mapaManutencao");
  if(!el) return;
  if(mapManutencao){ mapManutencao.remove(); mapManutencao=null; }
  // o mapa é recriado do zero a cada visita a esta tela — zera o estado do
  // modo "selecionar no mapa" junto, senão ele ficaria "ligado" sem o
  // listener correspondente no mapa novo.
  modoSelecaoArea = false;
  cancelarDesenhoSelecaoArea();
  coordenadaBuscaMarker = null;

  // OS reais (Importação de Bases > Podas): já vieram de state.manutencaoOS
  // no boot (loadStateFromApi, em api.js) — não busca de novo aqui. Antes
  // este trecho refazia GET /manutencao/os toda vez que a tela de Mapa de
  // Manutenção era aberta; com a base real (~21 mil OS) isso significava
  // alguns segundos de espera + reprocessamento à toa a cada visita, sem
  // necessidade (os dados não mudam sozinhos — só depois de uma nova
  // importação, e aí faz sentido recarregar a página).

  // preferCanvas: com a base real de Podas passando de 20 mil pontos, o
  // Leaflet desenhando cada círculo como um elemento SVG próprio (padrão)
  // deixava o mapa pesado pra interagir (zoom/pan travando); com canvas,
  // todos os marcadores são desenhados numa única superfície, muito mais
  // leve pra essa quantidade.
  mapManutencao = L.map(el, { zoomControl:true }).setView([-22.34,-49.4], 7);
  camadaViewportReset();                                   // v3.12.0 - rede/APP/RL desenhadas só na área visível
  mapManutencao.on("moveend", camadasViewportAgendar);
  mapaFundoLayer = null; mapaClusterGroup = null; mapaHeatLayer = null; mapaMarkerSelecaoCalor = null; mapaModoPontosAtual = "pontos";
  aplicarFundoMapa();
  iniciarSelecaoAreaMapa();

  const camadaLayers = {
    reserva: L.layerGroup(), app: L.layerGroup(), bt: L.layerGroup(), mt: L.layerGroup(), at: L.layerGroup(),
    vera: L.layerGroup(), ativos: L.layerGroup(),
    trafos: L.layerGroup(), protecoes: L.layerGroup(), reguladores: L.layerGroup(), capacitores: L.layerGroup(),
    nix: L.layerGroup(),
    aprl: L.layerGroup(),   // v3.12.0 - vazio de propósito: só existe para o interruptor "Destacar OS em APP/RL"
  };
  mapaCamadaLayersAtual = camadaLayers;
  if(typeof nixDesenhar === "function") nixDesenhar(camadaLayers.nix, mapManutencao).catch(()=>{});
  mapaVeraCarregada = false;
  ativosReset();
  equipReset();

  // OS "visíveis" aqui é TODAS as OS (não só as da busca/página atual) —
  // os marcadores de todo mundo são criados uma vez só; busca e seleção de
  // linha depois só ligam/desligam a opacidade dos que já existem (ver
  // atualizarVisibilidadeMarcadores), bem mais barato que recriar
  // milhares de marcadores a cada tecla digitada.
  const baseMapa = osMapaBase();
  const todasAsOs = (filtroPrioridadeEW === null) ? baseMapa : baseMapa.filter(o => !!o.prioridadeEW === filtroPrioridadeEW);
  const osVisiveis = osFiltradas();
  const statusLayers = {};
  mapaMarkersPorId = {};
  let idxMarcador = 0;
  Object.keys(statusColor).forEach(s=>{ statusLayers[s] = L.layerGroup(); });
  todasAsOs.forEach(o=>{
    if(typeof o.lat !== "number" || typeof o.lng !== "number") return;   // v2.13.19: OS sem localização não tem ponto
    const m = L.circleMarker([o.lat, o.lng], { radius:7, color:"#fff", weight:1.5, fillColor:statusColor[o.statusOS]||"#888", fillOpacity:.92 });
    /* v2.13.28 - o HTML da caixinha so e montado quando o popup/tooltip abre (antes era montado
       para TODAS as OS ao abrir o mapa - dezenas de milhares de strings e datas formatadas) */
    const htmlOS = ()=>`<h4>${escapeHtml(o.id)}${o.aprox?"*":""}</h4>${histMapaPopupLinha(o)}${aprlPopupLinha(o)}${o.aprox?'<p style="margin:0 0 6px; font-size:11.5px; color:#B45309;">* Posição aproximada (sem coordenada no SGM): o ponto pode estar errado.</p>':""}<dl><dt>Serviço</dt><dd>${escapeHtml(servicoTextoOS(o))}</dd>${zonaDaOS(o)?`<dt>Zona</dt><dd>${escapeHtml(zonaDaOS(o))}</dd>`:""}${o.tipoEquipeExec?`<dt>Tipo equipe</dt><dd>${escapeHtml(o.tipoEquipeExec)}</dd>`:""}${o.posteId?`<dt>Poste</dt><dd>${escapeHtml(o.posteId)}${o.posteAreaLocal?` · ${escapeHtml(o.posteAreaLocal)}`:""}${o.posteConjunto?` · conj ${escapeHtml(String(o.posteConjunto))}`:""}</dd>`:""}${o.posteId?equipPosteHtml(o.posteId):""}${o.origemPos?`<dt>Posição</dt><dd>${escapeHtml(o.origemPos==="VERA" ? "VERA" + (o.idVera?` (${o.idVera})`:"") : ({XY:"XY da grid",POSTE:"Poste (PONNOT)",CIDADE:"Centro da cidade (aprox.)"}[o.origemPos]||o.origemPos))}</dd>`:""}${o.idVera && o.origemPos!=="VERA"?`<dt>ID VERA</dt><dd>${escapeHtml(String(o.idVera))}</dd>`:""}<dt>Status</dt><dd>${escapeHtml(o.statusOS)}</dd><dt>Alimentador</dt><dd>${escapeHtml(o.alimentador)}</dd>${conjuntoDaOS(o)?`<dt>Conjunto</dt><dd>${escapeHtml(conjuntoDaOS(o))}</dd>`:""}${o.protecaoId?`<dt>Proteção</dt><dd>${escapeHtml(o.protecaoId)}</dd>`:""}${o.trecho?`<dt>Trecho</dt><dd>${escapeHtml(o.trecho)}</dd>`:""}<dt>Criação</dt><dd>${o.dataAbertura?fmtDate(o.dataAbertura):"—"}</dd><dt>Execução</dt><dd>${o.dataExecucao?fmtDate(o.dataExecucao):"—"}</dd><dt>Previsto</dt><dd>${escapeHtml(String(qtdTextoOS(o,"prev")))}${o.previstoPorEsquema?` <span style="color:#B45309; font-size:11px;" title="OS sem MO: previsto 1 definido pelo tipo do esquema (base Esquemas)">· estimado pelo esquema</span>`:""}</dd><dt>Realizado</dt><dd>${escapeHtml(String(qtdTextoOS(o,"real")))}</dd></dl>`;
    m.bindPopup(htmlOS);
    /* v2.13.26 - passar o mouse mostra a mesma caixinha (clicar continua abrindo/fixando o popup) */
    m.bindTooltip(htmlOS, { direction:"top", offset:[0,-8], opacity:1, className:"os-tip" });
    if(o.posteId && API_ONLINE){
      const aoAbrir = ()=> equipPosteCarregar(o.posteId, ()=>{
        try{ if(m.isPopupOpen()) m.getPopup().update(); }catch(e){}
        try{ if(m.isTooltipOpen && m.isTooltipOpen()) m.getTooltip().update(); }catch(e){}
      });
      m.on("popupopen", aoAbrir); m.on("tooltipopen", aoAbrir);
    }
    m.on("popupopen", ()=>m.closeTooltip());
    m._os = o; m._idx = idxMarcador++;
    if(statusLayers[o.statusOS]) m.addTo(statusLayers[o.statusOS]);
    mapaMarkersPorId[o.id] = m;
  });
  // pontos / agrupados / calor (menu "Visualização do mapa") — monta o modo escolhido
  mapaStatusLayersAtual = statusLayers;
  aplicarModoPontos();
  aprlPosMapa();   // v3.12.0 - anel nas OS em APP/RL (carrega o índice se ainda não veio)

  // O mapa é recriado do zero a cada visita (comentário acima) — sem isso,
  // trocar um filtro (que chama render() e reconstrói o mapa) fazia o pino
  // da coordenada buscada sumir no meio da conferência de uma reclamação.
  if(coordenadaBuscaTexto) buscarCoordenadaNoMapa();
  coordMultiGrupo = null;   // a camada morreu junto com o mapa antigo
  if(coordMultiTexto.trim()) coordMultiDesenhar(false);

  const allLayers = { ...camadaLayers };
  Object.entries(statusLayers).forEach(([s,layer])=>{ allLayers["status_"+s] = layer; });

  // liga os "breakers" já aqui, com os grupos ainda vazios — como cada
  // layerGroup é o MESMO objeto que populamos depois (real ou ilustrativo),
  // o mapa reflete o conteúdo assim que ele chegar, sem precisar religar nada
  document.querySelectorAll('#view [data-layer]').forEach(breaker=>{
    const key = breaker.getAttribute("data-layer");
    const input = breaker.querySelector("input");
    const led = breaker.querySelector(".breaker-led");
    if(!allLayers[key]) return;
    const ehStatus = key.startsWith("status_");
    function sync(){
      if(key === "aprl") aprlLigarMapa(input.checked);   // v3.12.0 - só estilo dos pontos, sem camada
      // nos modos agrupados/calor as bolinhas por status não vão pro mapa (quem
      // desenha é o cluster/calor, que já respeita os status ligados)
      const soEstado = ehStatus && mapaModoPontosAtual !== "pontos";
      if(input.checked){
        led.classList.add("on"); if(!soEstado) mapManutencao.addLayer(allLayers[key]);
        if(CAMADA_PARTICIONADA_CONFIG[key]) camadaAtualizarViewport(key, true);   // v3.12.0 - ao religar, redesenha só a área visível agora
      }
      else { led.classList.remove("on"); if(!soEstado) mapManutencao.removeLayer(allLayers[key]); }
      // "Status da OS" não é só uma camada do mapa — também decide o que
      // aparece na grade abaixo (ver filtroStatusAtivos/osFiltradas).
      if(ehStatus){
        const statusNome = key.slice("status_".length);
        if(input.checked) filtroStatusAtivos.add(statusNome); else filtroStatusAtivos.delete(statusNome);
      }
    }
    sync();
    input.addEventListener("change", ()=>{
      sync();
      if(ehStatus){
        tabelaOsPagina = 1;
        atualizarTabelaOS();
        atualizarVisibilidadeMarcadores();
      }
      // VERA é uma base única (não por alimentador) e grande o bastante
      // (141 mil+ árvores) pra não carregar sozinha ao abrir o mapa — só
      // busca de verdade na primeira vez que a pessoa liga a camada.
      if(key === "vera" && input.checked && !mapaVeraCarregada){
        carregarVeraMapa();
      }
      if(key === "ativos") ativosLigar(input.checked);
      if(EQUIP_CFG[key]) equipLigar(key, input.checked);
    });
  });

  const bannerEl = document.getElementById("mapaInfoBannerTexto");
  const multiHostEl = document.getElementById("mtAlimentadorMultiHost");
  const notaEl = document.getElementById("mtAlimentadorNota");

  // v2.12.0 - se a tela anterior ainda estava inscrita na pré-carga, sai antes
  // de se inscrever de novo (o mapa é recriado a cada visita)
  if(mapaCacheDesinscrever){ mapaCacheDesinscrever(); mapaCacheDesinscrever = null; }

  if(API_ONLINE){
    try{
      // As listas de alimentadores (pequenas) vêm do cache se a pré-carga já
      // as buscou; senão pede agora. Cada combo só é montado quando a camada
      // dele terminou de carregar em segundo plano (popularCamadaNoMapa).
      const camadasResp = await mapaCacheObterListas();
      mapaListasDoMapa = {
        mt: camadasResp.rede_mt_disponiveis || [],
        reserva: camadasResp.reserva_legal_disponiveis || [],
        app: camadasResp.app_disponiveis || [],
        at: camadasResp.rede_at_disponiveis || [],
        bt: camadasResp.rede_bt_disponiveis || [],
      };
      for(const prefixo of ["mt","reserva","app","at","bt"]){
        await popularCamadaNoMapa(prefixo);
      }
      mapaCacheDesinscrever = mapaCacheOuvir(mapaAtualizarCombosPelaPreCarga);
      mapaAtualizarCombosPelaPreCarga();
    }catch(err){
      console.error(err);
      renderCamadasIlustrativas(camadaLayers);
      if(multiHostEl) multiHostEl.innerHTML = "";
      if(notaEl) notaEl.style.display = "none";
      ["reserva","app","bt","at"].forEach(p=>{
        const h = document.getElementById(p+"AlimentadorMultiHost"), n = document.getElementById(p+"AlimentadorNota");
        if(h) h.innerHTML = ""; if(n) n.style.display = "none";
      });
      if(bannerEl) bannerEl.innerHTML = `Não consegui carregar as camadas reais do Controller (${escapeHtml(err.message)}) — mostrando dados de exemplo.`;
    }
  } else {
    renderCamadasIlustrativas(camadaLayers);
    if(multiHostEl) multiHostEl.innerHTML = "";
    if(notaEl) notaEl.style.display = "none";
    ["reserva","app","bt","at"].forEach(p=>{
      const h = document.getElementById(p+"AlimentadorMultiHost"), n = document.getElementById(p+"AlimentadorNota");
      if(h) h.innerHTML = ""; if(n) n.style.display = "none";
    });
    if(bannerEl) bannerEl.innerHTML = `Protótipo · Controller offline — mostrando coordenadas de exemplo (881 trechos ilustrativos), não os arquivos que você importou. Abra pelo iniciar.bat para ver os dados reais.`;
  }

  const statusEl = document.getElementById("mapaManutencaoStatus");
  if(statusEl){
    // v2.13.19 - legenda das OS sem coordenada (posição aproximada) e das sem localização
    const comPonto = osVisiveis.filter(o=>typeof o.lat==="number" && typeof o.lng==="number");
    const nAprox = comPonto.filter(o=>o.aprox).length;
    const nSemPonto = osVisiveis.length - comPonto.length;
    let h = escapeHtml(comPonto.length + " OS(s) plotada(s) — fundo: " + MAPA_FUNDOS[mapaFundo].rotulo + ".");
    if(nAprox > 0) h += `<br><strong>*</strong> OS com asterisco no número (${nAprox.toLocaleString("pt-BR")}): a coordenada não veio no SGM, então o ponto foi colocado no centro da cidade (ou do setor) e pode estar errado.`;
    if(nSemPonto > 0) h += `<br>${nSemPonto.toLocaleString("pt-BR")} OS sem nenhuma localização: contam nos totais, mas ficam fora do mapa.`;
    statusEl.innerHTML = h;
  }
}

/* =========================================================================
   VIEW: Produtividade
   ========================================================================= */
let produtividadeTab = "dia";
/* =========================================================================
   VIEW: Produtividade — formato do BI (v2.13.0)
   Matriz Departamento > Regional > Polo > Própria/Terceira > Equipe, com
   subtotais e total. Colunas por período: Dia (dias agrupados por semana),
   Semana ou Mês — cada uma com Executado, Meta e % Geral (Mês também com
   Meta Mês). Executado = soma do "realizado" das OS executadas pela equipe
   no dia (dataExecucao); Meta = meta mensal da equipe / dias úteis do mês,
   só em dia útil (sábado, domingo e feriados cadastrados não têm meta).
   ========================================================================= */
const PROD_MULTI = ["ano","mes","semanaMes","departamento","regional","polo","proprioTerceiro","equipePoda","equipe"];
let prodFiltro = { de:"", ate:"" };
PROD_MULTI.forEach(c=>{ prodFiltro[c] = new Set(); });
let prodAbertos = null;           // Set de chaves de nós abertos (null = ainda não inicializado)
const PROD_DIAS_PADRAO = { dia:14, semana:56, mes:180 };

function setProdFiltro(campo, valor){ prodFiltro[campo] = valor; render(); }
function toggleProdFiltro(c, v, marcado){ if(marcado) prodFiltro[c].add(String(v)); else prodFiltro[c].delete(String(v)); render(); }
function limparProdFiltro(c){ prodFiltro[c].clear(); render(); }
PROD_MULTI.forEach(c=>{ window["tpf_"+c] = (v,m)=>toggleProdFiltro(c,v,m); window["lpf_"+c] = ()=>limparProdFiltro(c); });
function limparProdFiltros(){
  prodFiltro.de = ""; prodFiltro.ate = "";
  PROD_MULTI.forEach(c=>prodFiltro[c].clear());
  render();
}
function prodHojeIso(){ return new Date().toISOString().slice(0,10); }
function prodSemanaDoMes(iso){
  const d = new Date(iso+"T12:00:00");
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + ((primeiro.getDay()+6)%7)) / 7);
}
function prodSemanaIso(iso){
  const d = new Date(iso+"T12:00:00");
  d.setDate(d.getDate() + 3 - ((d.getDay()+6)%7));
  const s1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - s1)/86400000 - 3 + ((s1.getDay()+6)%7)) / 7);
}
function prodEhDiaUtil(iso){
  const dow = new Date(iso+"T12:00:00").getDay();
  if(dow===0 || dow===6) return false;
  return !(state.feriados||[]).some(f=>String(f.data||"").slice(0,10)===iso);
}

/* executado[equipeId][iso] — das OS (Controller) ou, no protótipo offline, da série de exemplo */
/* v2.15.54 - metas por serviço: "poda" (unidades) e "faixa" (km lineares).
   A OS de limpeza de faixa vem em m² de uma faixa de 15 m (7,5 m para cada lado da rede):
   m² ÷ 15 = metros lineares; m² ÷ 15.000 = km lineares.
   Produtividade: separada por serviço (seletor). Aderência da programação: misturada em podas equivalentes
   (faixa m² ÷ 100 = podas; meta de faixa em km × 150 = podas). */
const FAIXA_M2_POR_KM = 15000;
const FAIXA_PODAS_POR_KM = 150;      // 15.000 m² ÷ 100
let prodServico = "poda";            // poda | faixa
function setProdServico(v){ prodServico = (v==="faixa") ? "faixa" : "poda"; render(); }
function metaTipo(m){ return (m && m.tipo==="faixa") ? "faixa" : "poda"; }
function prodUnidade(tipo){ return (tipo||prodServico)==="faixa" ? "km" : "un."; }
let _prodExecCache = {}, _prodExecFonte = null;
function prodExecucao(tipo){
  tipo = tipo || prodServico;
  const fonte = osProducaoBase();
  if(_prodExecFonte!==fonte){ _prodExecCache = {}; _prodExecFonte = fonte; }
  if(_prodExecCache[tipo]) return _prodExecCache[tipo];
  const m = {};
  let temOS = false;
  fonte.forEach(o=>{
    let q = qtdTipoOS(o, tipo, "real");
    if(tipo==="faixa") q = q / FAIXA_M2_POR_KM;      // m² -> km lineares
    if(!o.equipeId || !o.dataExecucao || !(q>0)) return;
    temOS = true;
    const d = String(o.dataExecucao).slice(0,10);
    ((m[o.equipeId] = m[o.equipeId] || {})[d] = (m[o.equipeId][d]||0) + q);
  });
  if(tipo==="poda" && !temOS && !API_ONLINE){
    const dias = ["2026-09-21","2026-09-22","2026-09-23","2026-09-24"];
    Object.keys(state.producao||{}).forEach(eq=>{ m[eq] = {}; (state.producao[eq]||[]).forEach((v,i)=>{ if(v) m[eq][dias[i]] = v; }); });
  }
  _prodExecCache[tipo] = m;
  return m;
}
function prodMetaDe(equipeId, anoMes, tipo){
  tipo = tipo || prodServico;
  const ms = (state.metas||[]).filter(m=>m.equipeId===equipeId && metaTipo(m)===tipo);
  if(!ms.length) return null;
  const exata = ms.find(m=>m.anoMes===anoMes);
  if(exata) return exata;
  const anteriores = ms.filter(m=>m.anoMes<anoMes).sort((a,b)=>b.anoMes.localeCompare(a.anoMes));
  return anteriores[0] || null;
}
function prodMetaDia(equipeId, iso, tipo){
  if(!prodEhDiaUtil(iso)) return 0;
  if(!equipeIdAtiva(equipeId)) return 0;         // v3.5.2 - equipe inativa: sem meta (não se cobra), mas a produção dela conta
  if(indispNaData(equipeId, iso)) return 0;      // v2.14.1 - equipe indisponivel: sem meta
  const m = prodMetaDe(equipeId, iso.slice(0,7), tipo);
  if(!m || !m.metaMensal) return 0;
  return m.metaMensal / (m.diasUteis || 21);
}

/* dias candidatos (padrão ou período escolhido) já passados pelos filtros Ano/Mês/Semana do Mês */
function prodDiasSelecionados(){
  const f = prodFiltro, hoje = prodHojeIso();
  const ate = f.ate || hoje;
  const de = f.de || isoMais(ate, -(PROD_DIAS_PADRAO[produtividadeTab]-1));
  const dias = [];
  for(let d=de; d<=ate && dias.length<800; d=isoMais(d,1)){
    if(f.ano.size && !f.ano.has(d.slice(0,4))) continue;
    if(f.mes.size && !f.mes.has(d.slice(5,7))) continue;
    if(f.semanaMes.size && !f.semanaMes.has(String(prodSemanaDoMes(d)))) continue;
    dias.push(d);
  }
  return dias;
}
function prodColunas(dias){
  if(produtividadeTab==="dia"){
    const porSemana = {};
    dias.forEach(d=>{ const s = isoSegundaDe(d); (porSemana[s] = porSemana[s]||[]).push(d); });
    return Object.keys(porSemana).sort().map(s=>({
      grupo:`Sem ${prodSemanaIso(s)} · ${fmtDate(s).slice(0,5)}`,
      cols: porSemana[s].map(d=>({ rotulo: `${["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][new Date(d+"T12:00:00").getDay()]} ${d.slice(8,10)}/${d.slice(5,7)}`, dias:[d], dia:d }))
    }));
  }
  if(produtividadeTab==="semana"){
    const porSemana = {};
    dias.forEach(d=>{ const s = isoSegundaDe(d); (porSemana[s] = porSemana[s]||[]).push(d); });
    return [{ grupo:"Semanas", cols: Object.keys(porSemana).sort().map(s=>({ rotulo:`Sem ${prodSemanaIso(s)} (${fmtDate(s).slice(0,5)})`, dias: porSemana[s] })) }];
  }
  const porMes = {};
  dias.forEach(d=>{ (porMes[d.slice(0,7)] = porMes[d.slice(0,7)]||[]).push(d); });
  const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return [{ grupo:"Meses", cols: Object.keys(porMes).sort().map(m=>({ rotulo:`${nomes[parseInt(m.slice(5,7),10)-1]}/${m.slice(0,4)}`, dias: porMes[m], anoMes:m, comMetaMes:true })) }];
}
function prodEquipesFiltradas(){
  const f = prodFiltro;
  const ok = (set, v)=> !set.size || set.has(String(v||""));
  // v3.5.2 - equipe INATIVA: o que ela produziu no passado continua contando; ela só aparece se produziu nos dias escolhidos
  // (e sem meta, então ninguém é cobrado por ela). Inativa sem produção no período fica de fora.
  const inativas = (state.equipes||[]).some(e=>!equipeAtiva(e));
  let diasSel = null, exs = null;
  if(inativas){ diasSel = prodDiasSelecionados(); exs = [prodExecucao("poda"), prodExecucao("faixa")]; }
  const produziu = e => exs.some(m=>{ const x = m[e.id]; return x && diasSel.some(d=>x[d]>0); });
  return (state.equipes||[]).filter(e=>
    (equipeAtiva(e) || produziu(e)) && ok(f.polo, e.polo) && ok(f.regional, e.regional) && ok(f.departamento, e.departamento) &&
    ok(f.proprioTerceiro, e.proprioTerceiro) && ok(f.equipe, e.id) &&
    (!f.equipePoda.size || (f.equipePoda.has("sim") && !!e.equipePoda) || (f.equipePoda.has("nao") && !e.equipePoda)));
}
function prodCelula(equipeId, col){
  const ex = prodExecucao()[equipeId] || {};
  let exec = 0, meta = 0;
  col.dias.forEach(d=>{ exec += ex[d]||0; meta += prodMetaDia(equipeId, d); });
  let metaMes = 0;
  if(col.comMetaMes){ metaMes = prodMetaMesAjustada(equipeId, col.anoMes); }
  return { exec, meta, metaMes };
}
function prodCorPct(p){
  const h = Math.max(0, Math.min(100, p)) * 1.2;           // 0% vermelho -> 100% verde
  return `background:hsl(${h} 68% 84%); color:hsl(${h} 55% 22%);`;
}
function prodFmt(n){ const k = prodServico==="faixa" ? 100 : 10; return (Math.round(n*k)/k).toLocaleString("pt-BR"); }
function prodJustificada(equipeId, iso){ return (state.justificativas||[]).some(j=>j.equipeId===equipeId && String(j.data).slice(0,10)===iso); }

function prodConstruirArvore(equipes, colunasFlat){
  const raiz = { chave:"", nivel:-1, filhos:new Map(), vals: colunasFlat.map(()=>({exec:0,meta:0,metaMes:0})) };
  equipes.forEach(e=>{
    const caminho = [e.departamento||"Sem departamento", e.regional||"Sem regional", e.polo||"Sem polo", e.proprioTerceiro||"Sem tipo"];
    let no = raiz, chave = "";
    const vals = colunasFlat.map(c=>prodCelula(e.id, c));
    const somar = n=>vals.forEach((v,i)=>{ n.vals[i].exec+=v.exec; n.vals[i].meta+=v.meta; n.vals[i].metaMes+=v.metaMes; });
    somar(raiz);
    caminho.forEach((nome,nivel)=>{
      chave += "/"+nome;
      if(!no.filhos.has(nome)) no.filhos.set(nome, { chave, nome, nivel, filhos:new Map(), equipes:[], vals: colunasFlat.map(()=>({exec:0,meta:0,metaMes:0})) });
      no = no.filhos.get(nome);
      somar(no);
    });
    no.equipes.push({ equipe:e, vals });
  });
  return raiz;
}
function prodToggle(chave){
  if(prodAbertos.has(chave)) prodAbertos.delete(chave); else prodAbertos.add(chave);
  render();
}
function prodExpandirTudo(abrir){
  if(!abrir){ prodAbertos = new Set(); render(); return; }
  prodAbertos = new Set();
  const todos = new Set();
  prodEquipesFiltradas().forEach(e=>{
    const c = [e.departamento||"Sem departamento", e.regional||"Sem regional", e.polo||"Sem polo", e.proprioTerceiro||"Sem tipo"];
    let k = ""; c.forEach(n=>{ k+="/"+n; todos.add(k); });
  });
  prodAbertos = todos; render();
}

function prodCelulasHtml(vals, colunasFlat, opts){
  // opts.folha = { equipeId } para mostrar o botão Justificar (só na aba Dia)
  return vals.map((v,i)=>{
    const col = colunasFlat[i];
    const semMeta = !(v.meta>0);
    const p = semMeta ? null : Math.round((v.exec / v.meta) * 1000)/10;
    let h = `<td class="num">${v.exec ? prodFmt(v.exec) : (semMeta ? "" : "0")}</td>`;
    h += `<td class="num">${semMeta ? "" : prodFmt(v.meta)}</td>`;
    if(col.comMetaMes) h += `<td class="num">${v.metaMes ? prodFmt(v.metaMes) : ""}</td>`;
    let btn = "";
    if(opts && opts.folha && produtividadeTab==="dia"){
      const eq = escapeHtml(opts.folha).replace(/'/g,"\\'");
      if(prodJustificada(opts.folha, col.dia)){
        btn = ` <button type="button" class="pill ok just-selo" title="Ver a justificativa" onclick="event.stopPropagation(); abrirJustificativaLeitura('${eq}','${col.dia}')">Justificada</button>`;
      } else if(p!==null && p<90){
        btn = ` <button class="btn btn-primary btn-sm" style="padding:1px 7px; font-size:11px;" title="Abaixo de 90% — justificar este dia" onclick="event.stopPropagation(); openJustificativaModal('${eq}','${col.dia}')">Justificar</button>`;
      }
    }
    h += `<td class="num" style="white-space:nowrap; ${p!==null?prodCorPct(p):''}">${p!==null ? p.toLocaleString("pt-BR")+"%" : ""}${btn}</td>`;
    return h;
  }).join("");
}
function prodLinhasHtml(no, colunasFlat){
  let html = "";
  const filhos = Array.from(no.filhos.values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"}));
  filhos.forEach(f=>{
    const aberto = prodAbertos.has(f.chave);
    const temFilhos = f.filhos.size>0 || f.equipes.length>0;
    html += `<tr class="prod-no prod-n${f.nivel}">
      <td class="prod-nome" style="padding-left:${8+f.nivel*16}px; cursor:pointer;" onclick="prodToggle('${escapeHtml(f.chave).replace(/'/g,"\\'")}')">${temFilhos ? (aberto?"▾":"▸") : ""} <strong>${escapeHtml(f.nome)}</strong></td>
      ${prodCelulasHtml(f.vals, colunasFlat, null)}
    </tr>`;
    if(aberto){
      html += prodLinhasHtml(f, colunasFlat);
      f.equipes.sort((a,b)=>String(a.equipe.id).localeCompare(String(b.equipe.id),"pt-BR",{numeric:true})).forEach(t=>{
        html += `<tr>
          <td class="prod-nome mono" style="padding-left:${8+(f.nivel+1)*16}px;">${escapeHtml(t.equipe.id)}${equipeAtiva(t.equipe)?"":` <span class="pill muted" title="Equipe inativa: a produção conta, mas não há meta nem cobrança">inativa</span>`}</td>
          ${prodCelulasHtml(t.vals, colunasFlat, { folha:t.equipe.id })}
        </tr>`;
      });
    }
  });
  return html;
}

function viewProdutividade(){
  const dias = prodDiasSelecionados();
  const grupos = prodColunas(dias);
  const colunasFlat = grupos.flatMap(g=>g.cols);
  const equipes = prodEquipesFiltradas();
  if(prodAbertos===null){
    // abre tudo por padrão (o botão Justificar fica na linha da equipe); "Recolher" fecha
    prodAbertos = new Set();
    equipes.forEach(e=>{
      let k = ""; [e.departamento||"Sem departamento", e.regional||"Sem regional", e.polo||"Sem polo", e.proprioTerceiro||"Sem tipo"].forEach(n=>{ k+="/"+n; prodAbertos.add(k); });
    });
  }
  const arvore = prodConstruirArvore(equipes, colunasFlat);
  const f = prodFiltro;
  const uniq = c=>[...new Set((state.equipes||[]).map(e=>e[c]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
  const anoAtual = new Date().getFullYear();
  const meses = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const nomesMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const nGrupoCols = c => c.comMetaMes ? 4 : 3;
  const total = arvore.vals;
  const rotuloRef = dias.length ? `${fmtDate(dias[0])} a ${fmtDate(dias[dias.length-1])}` : "sem dias no filtro";

  return `
  <div class="card-head" style="margin-bottom:12px; flex-wrap:wrap; gap:8px;">
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <div class="tabs" title="Serviço da meta">
        <button class="tab ${prodServico==='poda'?'active':''}" onclick="setProdServico('poda')">Poda (un.)</button>
        <button class="tab ${prodServico==='faixa'?'active':''}" onclick="setProdServico('faixa')">Limpeza de faixa (km)</button>
      </div>
      <div class="tabs">
        <button class="tab ${produtividadeTab==='dia'?'active':''}" onclick="setProdTab('dia')">Dia</button>
        <button class="tab ${produtividadeTab==='semana'?'active':''}" onclick="setProdTab('semana')">Semana</button>
        <button class="tab ${produtividadeTab==='mes'?'active':''}" onclick="setProdTab('mes')">Mês</button>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="pill info">Período: ${rotuloRef}</span>
      <button class="btn btn-primary btn-sm" onclick="bolAbrir()" title="Baixar o boletim (equipe x dia, Prev. x Real.) em Excel ou PDF">${ic("download")||"⬇"} Boletim</button>
      <button class="btn btn-ghost btn-sm" onclick="prodExpandirTudo(true)">Expandir tudo</button>
      <button class="btn btn-ghost btn-sm" onclick="prodExpandirTudo(false)">Recolher</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:14px;">
    <div class="filters" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; align-items:end;">
      <div class="field"><label>De</label><input type="date" value="${f.de}" onchange="setProdFiltro('de',this.value)"></div>
      <div class="field"><label>Até</label><input type="date" value="${f.ate}" onchange="setProdFiltro('ate',this.value)"></div>
      ${multiComboHtml("p_ano","Ano",[anoAtual-1,anoAtual,anoAtual+1].map(String),f.ano,"tpf_ano","lpf_ano","Todos")}
      ${multiComboHtml("p_mes","Mês",meses.map((m,i)=>({v:m,t:nomesMes[i]})),f.mes,"tpf_mes","lpf_mes","Todos")}
      ${multiComboHtml("p_sem","Semana do mês",[1,2,3,4,5,6].map(n=>({v:String(n),t:n+"ª semana"})),f.semanaMes,"tpf_semanaMes","lpf_semanaMes","Todas")}
      ${multiComboHtml("p_dep","Departamento",uniq("departamento"),f.departamento,"tpf_departamento","lpf_departamento","Todos")}
      ${multiComboHtml("p_reg","Regional",uniq("regional"),f.regional,"tpf_regional","lpf_regional","Todas")}
      ${multiComboHtml("p_polo","Polo",uniq("polo"),f.polo,"tpf_polo","lpf_polo","Todos")}
      ${multiComboHtml("p_pt","Própria/Terceira",uniq("proprioTerceiro"),f.proprioTerceiro,"tpf_proprioTerceiro","lpf_proprioTerceiro","Todas")}
      ${multiComboHtml("p_poda","Equipe poda",[{v:"sim",t:"Sim"},{v:"nao",t:"Não"}],f.equipePoda,"tpf_equipePoda","lpf_equipePoda","Todas")}
      ${multiComboHtml("p_eq","Equipes executoras",(state.equipes||[]).map(e=>e.id).sort((a,b)=>String(a).localeCompare(String(b),"pt-BR",{numeric:true})),f.equipe,"tpf_equipe","lpf_equipe","Todas")}
      <div class="field"><label>&nbsp;</label><button class="btn btn-ghost btn-limpar-filtros" type="button" onclick="limparProdFiltros()">Limpar filtros</button></div>
    </div>
  </div>

  <div class="card">
    ${colunasFlat.length===0 || equipes.length===0 ? `<div class="empty">${ic("empty")}<div>Nada para mostrar com esses filtros.</div></div>` : `
    <div class="table-wrap" style="overflow:auto; max-height:70vh;"><table class="prod-matrix">
      <thead>
        <tr><th rowspan="3" style="min-width:230px; position:sticky; left:0; z-index:3; background:var(--surface);">Dep. › Regional › Polo › Tipo › Equipe</th>
          ${grupos.map(g=>`<th colspan="${g.cols.reduce((s,c)=>s+nGrupoCols(c),0)}" style="text-align:center;">${escapeHtml(g.grupo)}</th>`).join("")}</tr>
        <tr>${colunasFlat.map(c=>`<th colspan="${nGrupoCols(c)}" style="text-align:center;">${escapeHtml(c.rotulo)}</th>`).join("")}</tr>
        <tr>${colunasFlat.map(c=>`<th>Exec.</th><th>Meta</th>${c.comMetaMes?"<th>Meta mês</th>":""}<th>% Geral</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${prodLinhasHtml(arvore, colunasFlat)}
        <tr class="prod-total" style="font-weight:700; border-top:2px solid var(--border-hi);">
          <td class="prod-nome" style="padding-left:8px;">Total</td>
          ${prodCelulasHtml(total, colunasFlat, null)}
        </tr>
      </tbody>
    </table></div>`}
    <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">Executado = produção das OS executadas no dia. Meta = meta mensal ÷ dias úteis (fim de semana e feriado não têm meta). Equipes sem meta aparecem sem %. ${produtividadeTab==="dia" ? "Dia abaixo de 90% mostra o botão <strong>Justificar</strong>." : ""}</p>
  </div>
  `;
}
/* =========================================================================
   v3.3.0 - PRODUTIVIDADE: MÉDIA POR DIA TRABALHADO
   Média = realizado ÷ dias em que a equipe subiu OS (dia com produção > 0), no período e nos filtros da tela,
   para o serviço escolhido (Poda un. ou Limpeza de faixa km). Equipe = a média da equipe; polo e regional =
   total realizado ÷ total de "equipe-dias" trabalhados, separados em Linha Viva (LV) e Linha Morta (LM)
   pelo tipo da equipe (tipoEquipe; se não vier LV/LM, tenta pelo código da equipe).
   ========================================================================= */
let geralMediaEqPoda = new Set();   // v3.3.6 - filtro "Equipe poda" das Médias (vazio = todas; "sim"/"nao")
function toggleGeralMediaEqPoda(v, m){ if(m) geralMediaEqPoda.add(String(v)); else geralMediaEqPoda.delete(String(v)); render(); }
function limparGeralMediaEqPoda(){ geralMediaEqPoda.clear(); render(); }
let geralMediaServ = "poda";   // serviço da seção Médias da Visão Geral
function setGeralMediaServ(v){ geralMediaServ = (v==="faixa") ? "faixa" : "poda"; render(); }
let _mediasUltimo = null;
function prodLinhaDaEquipe(e){
  const t = String((e && e.tipoEquipe) || "").toUpperCase(), id = String((e && e.id) || "").toUpperCase();
  if(/\bLV\b|VIVA/.test(t) || t==="LV") return "LV";
  if(/\bLM\b|MORTA/.test(t) || t==="LM") return "LM";
  if(/LV/.test(id)) return "LV";
  if(/LM/.test(id)) return "LM";
  return "OUT";
}
const PROD_LINHA_ROT = { LV:"Linha Viva", LM:"Linha Morta", OUT:"Outras" };
function prodMediasDados(dias, equipes, tipo){
  const exec = prodExecucao(tipo);
  const porEquipe = equipes.map(e=>{
    const m = exec[e.id] || {};
    let real = 0, trab = 0;
    dias.forEach(d=>{ const v = m[d]||0; if(v>0){ real += v; trab++; } });
    return { equipe:e, linha:prodLinhaDaEquipe(e), real, dias:trab, media: trab>0 ? real/trab : null };
  });
  const agrupa = campo=>{
    const mapa = {};
    porEquipe.forEach(x=>{
      const chave = x.equipe[campo] || (campo==="polo" ? "Sem polo" : "Sem regional");
      const g = mapa[chave] || (mapa[chave] = { nome:chave, LV:{real:0,dias:0,eq:0}, LM:{real:0,dias:0,eq:0}, OUT:{real:0,dias:0,eq:0} });
      const c = g[x.linha]; c.real += x.real; c.dias += x.dias; if(x.dias>0) c.eq++;
    });
    return Object.values(mapa).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"}));
  };
  return { porEquipe, porPolo:agrupa("polo"), porRegional:agrupa("regional") };
}
function prodMediasHtml(dias, equipes, tipo, rotuloPeriodo, imprimir){
  if(!dias.length || !equipes.length) return `<div class="card"><div class="empty">${ic("empty")}<div>Nada para mostrar neste período.</div></div></div>`;
  const D = prodMediasDados(dias, equipes, tipo);
  _mediasUltimo = { D, tipo, rotuloPeriodo };
  const un = prodUnidade(tipo), nServ = tipo==="faixa" ? "Limpeza de faixa" : "Poda";
  const fm = n=>(n===null||n===undefined||!isFinite(n)) ? "—" : (Math.round(n*(tipo==="faixa"?100:10))/(tipo==="faixa"?100:10)).toLocaleString("pt-BR");
  const med = c=>c.dias>0 ? c.real/c.dias : null;
  const temOut = [...D.porPolo, ...D.porRegional].some(g=>g.OUT.dias>0) || D.porEquipe.some(x=>x.linha==="OUT" && x.dias>0);
  const linhas = temOut ? ["LV","LM","OUT"] : ["LV","LM"];
  const cabGrupo = `${linhas.map(l=>`<th colspan="3" class="grp" style="text-align:center;">${PROD_LINHA_ROT[l]}</th>`).join("")}`;
  const cabSub = linhas.map(()=>`<th>Dias</th><th>Realizado</th><th>Média/dia</th>`).join("");
  const celulas = g=>linhas.map(l=>`<td class="num">${g[l].dias ? g[l].dias.toLocaleString("pt-BR") : "—"}</td><td class="num">${g[l].dias ? fm(g[l].real) : "—"}</td><td class="num"><strong>${fm(med(g[l]))}</strong></td>`).join("");
  const tabelaGrupo = (titulo, lista, rotulo)=>{
    const tot = { LV:{real:0,dias:0}, LM:{real:0,dias:0}, OUT:{real:0,dias:0} };
    lista.forEach(g=>["LV","LM","OUT"].forEach(l=>{ tot[l].real += g[l].real; tot[l].dias += g[l].dias; }));
    return `<div class="card" style="margin-top:14px;"><div class="card-head"><h3>${titulo}</h3><span class="pill info">${nServ} · ${un}/dia trabalhado</span></div>
      <div class="table-wrap"><table class="prod-medias"><thead><tr><th rowspan="2">${rotulo}</th>${cabGrupo}</tr><tr>${cabSub}</tr></thead><tbody>
        ${lista.map(g=>`<tr><td>${escapeHtml(g.nome)}</td>${celulas(g)}</tr>`).join("")}
      </tbody><tfoot><tr><td><strong>Total</strong></td>${celulas(tot)}</tr></tfoot></table></div></div>`;
  };
  const eqOrd = D.porEquipe.slice().sort((a,b)=>(b.media===null?-1:b.media)-(a.media===null?-1:a.media));
  const totReal = D.porEquipe.reduce((s,x)=>s+x.real,0), totDias = D.porEquipe.reduce((s,x)=>s+x.dias,0);
  const linhaEq = x=>`<tr><td class="mono">${escapeHtml(x.equipe.id)}</td><td>${PROD_LINHA_ROT[x.linha]}</td><td>${escapeHtml(x.equipe.polo||"")}</td><td>${escapeHtml(x.equipe.regional||"")}</td><td class="num">${x.dias||"—"}</td><td class="num">${x.dias?fm(x.real):"—"}</td><td class="num"><strong>${fm(x.media)}</strong></td></tr>`;
  const cabEq = `<thead><tr><th>Equipe</th><th>Linha</th><th>Polo</th><th>Regional</th><th>Dias</th><th>Realizado</th><th>Média/dia</th></tr></thead>`;
  if(imprimir){   // PDF: resumos primeiro; lista de equipes em duas colunas
    const meio = Math.ceil(eqOrd.length/2), a = eqOrd.slice(0,meio), b = eqOrd.slice(meio);
    return `<div class="jn-numeros" style="margin-top:0;">
      <div><span class="jn-rot">Média geral por dia trabalhado</span><strong>${fm(totDias>0?totReal/totDias:null)}</strong><span class="jn-sub">${un} · ${nServ}</span></div>
      <div><span class="jn-rot">Equipes que produziram</span><strong>${D.porEquipe.filter(x=>x.dias>0).length}<small> / ${D.porEquipe.length}</small></strong><span class="jn-sub">no período</span></div>
      <div><span class="jn-rot">Equipe-dias trabalhados</span><strong>${totDias.toLocaleString("pt-BR")}</strong><span class="jn-sub">dias com OS executada</span></div></div>
    <div class="pg-duas-med">${tabelaGrupo("Média por polo", D.porPolo, "Polo")}${tabelaGrupo("Média por regional", D.porRegional, "Regional")}</div>
    <div class="card"><div class="card-head"><h3>Média por equipe</h3><span class="pill info">${nServ} · ${un}/dia trabalhado</span></div>
      <div class="pg-duas-eq"><table class="prod-medias">${cabEq}<tbody>${a.map(linhaEq).join("")}</tbody></table><table class="prod-medias">${cabEq}<tbody>${b.map(linhaEq).join("")}</tbody></table></div></div>
    <p style="color:var(--muted); font-size:10px; margin-top:6px;">Média = realizado ÷ dias em que a equipe subiu OS. Polo e regional: total realizado ÷ total de equipe-dias, separado por Linha Viva e Linha Morta. Período: ${escapeHtml(rotuloPeriodo||"")}.</p>`;
  }
  return `
  <div class="jn-numeros" style="margin-top:0;">
    <div><span class="jn-rot">Média geral por dia trabalhado</span><strong>${fm(totDias>0?totReal/totDias:null)}</strong><span class="jn-sub">${un} · ${nServ}</span></div>
    <div><span class="jn-rot">Equipes que produziram</span><strong>${D.porEquipe.filter(x=>x.dias>0).length}<small> / ${D.porEquipe.length}</small></strong><span class="jn-sub">no período</span></div>
    <div><span class="jn-rot">Equipe-dias trabalhados</span><strong>${totDias.toLocaleString("pt-BR")}</strong><span class="jn-sub">dias com OS executada</span></div>
  </div>
  <div class="card"><div class="card-head"><h3>Média por equipe</h3><div style="display:flex; gap:8px; align-items:center;"><span class="pill info">${nServ} · ${un}/dia trabalhado</span><button class="btn btn-ghost btn-sm no-print" type="button" onclick="exportarProdMediasXlsx()">${ic("download")} Excel</button></div></div>
    <div class="table-wrap" style="max-height:60vh; overflow:auto;"><table class="prod-medias"><thead><tr><th>Equipe</th><th>Linha</th><th>Polo</th><th>Regional</th><th>Dias trabalhados</th><th>Realizado</th><th>Média/dia</th></tr></thead><tbody>
      ${eqOrd.map(x=>`<tr><td class="mono">${escapeHtml(x.equipe.id)}</td><td>${PROD_LINHA_ROT[x.linha]}</td><td>${escapeHtml(x.equipe.polo||"")}</td><td>${escapeHtml(x.equipe.regional||"")}</td><td class="num">${x.dias||"—"}</td><td class="num">${x.dias?fm(x.real):"—"}</td><td class="num"><strong>${fm(x.media)}</strong></td></tr>`).join("")}
    </tbody></table></div></div>
  ${tabelaGrupo("Média por polo", D.porPolo, "Polo")}
  ${tabelaGrupo("Média por regional", D.porRegional, "Regional")}
  <p style="color:var(--muted); font-size:11.5px; margin-top:8px; line-height:1.5;">Média = realizado ÷ dias em que a equipe subiu OS (só dia com produção conta). Em polo e regional: total realizado ÷ total de equipe-dias trabalhados, separado por Linha Viva e Linha Morta (tipo da equipe). Período: ${escapeHtml(rotuloPeriodo||"")}.</p>`;
}
function exportarProdMediasXlsx(){
  if(!_mediasUltimo){ toast("Nada para exportar."); return; }
  const D = _mediasUltimo.D, tipo = _mediasUltimo.tipo, un = prodUnidade(tipo);
  const r2 = n=>(n===null||!isFinite(n)) ? "" : Math.round(n*100)/100;
  const wb = XLSX.utils.book_new();
  const wsE = XLSX.utils.json_to_sheet(D.porEquipe.map(x=>({ "Equipe":x.equipe.id, "Linha":PROD_LINHA_ROT[x.linha], "Polo":x.equipe.polo||"", "Regional":x.equipe.regional||"", "Dias trabalhados":x.dias, [`Realizado (${un})`]:r2(x.real), [`Média/dia (${un})`]:r2(x.media) })));
  wsE["!cols"] = [{wch:14},{wch:12},{wch:20},{wch:14},{wch:16},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsE, "Por equipe");
  const grupoLinhas = (lista, rot)=>{ const out = []; lista.forEach(g=>["LV","LM","OUT"].forEach(l=>{ const c = g[l]; if(!c.dias && l==="OUT") return;
      out.push({ [rot]:g.nome, "Linha":PROD_LINHA_ROT[l], "Equipes que produziram":c.eq, "Equipe-dias trabalhados":c.dias, [`Realizado (${un})`]:r2(c.real), [`Média/dia (${un})`]:r2(c.dias>0?c.real/c.dias:null) }); })); return out; };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grupoLinhas(D.porPolo,"Polo")), "Por polo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grupoLinhas(D.porRegional,"Regional")), "Por regional");
  XLSX.writeFile(wb, `SPARK_media_produtividade_${tipo}_${prodHojeIso()}.xlsx`);
  toast("Médias exportadas para Excel.");
}
function setProdTab(t){ produtividadeTab = t; render(); }

/* v2.15.33 - leitura da justificativa (qualquer usuário) */
function abrirJustificativaLeitura(equipeId, data){
  const lista = (state.justificativas||[]).filter(j=>j.equipeId===equipeId && String(j.data).slice(0,10)===data);
  if(!lista.length) return;
  const nomeAutor = j => { if(j.autor) return j.autor; const u = (state.usuarios||[]).find(x=>String(x.id)===String(j.autorId)); return (u && (u.nome||u.email)) || "—"; };
  openModal(`
    <button type="button" class="just-x" onclick="closeModal()" title="Fechar" aria-label="Fechar">&times;</button>
    <h2>Justificativa</h2>
    <p class="modal-sub"><span class="mono">${escapeHtml(equipeId)}</span> · ${fmtDate(data)}</p>
    ${lista.map(j=>`
      <div class="just-bloco">
        ${j.tipo ? `<span class="pill info">${escapeHtml(j.tipo)}</span>` : ``}
        <p class="just-texto">${escapeHtml(j.texto||"")}</p>
        <p class="just-meta">${escapeHtml(nomeAutor(j))}${j.criadoEm ? " · registrada em "+fmtDateTime(j.criadoEm) : ""}</p>
      </div>`).join("")}
  `);
}

/* v2.15.33 - "Nova" justificativa pela Gestão de Bases: equipe (com busca) e dia livres */
function justNovaPode(){ return minhaPermissao("gestaoBases","criar"); }
function justNovaIds(){ return equipesAtivas().map(e=>String(e.id)).sort((x,y)=>x.localeCompare(y,"pt-BR",{sensitivity:"base"})); }
function justNovaListar(q){
  const lista = document.getElementById("justNovaLista"); if(!lista) return;
  const t = String(q||"").trim().toLowerCase();
  const ids = justNovaIds().filter(id=>!t || id.toLowerCase().includes(t));
  lista.innerHTML = ids.length ? ids.map(id=>`<div class="combo-item" data-id="${escapeHtml(id)}" onmousedown="event.preventDefault(); justNovaEscolher(this.dataset.id)">${escapeHtml(id)}</div>`).join("") : `<div class="combo-vazio">Nenhuma equipe encontrada</div>`;
  lista.style.display = "block";
}
function justNovaDigitou(v){ document.getElementById("justNovaEquipe").value = ""; justNovaListar(v); }
function justNovaEscolher(id){
  document.getElementById("justNovaEquipe").value = id;
  document.getElementById("justNovaBusca").value = id;
  document.getElementById("justNovaLista").style.display = "none";
}
function justNovaFechar(){
  const l = document.getElementById("justNovaLista"); if(l) l.style.display = "none";
  const h = document.getElementById("justNovaEquipe"), b = document.getElementById("justNovaBusca");
  if(h && b){ // texto digitado que não virou escolha: se bate exatamente com uma equipe, aceita; senão limpa
    if(!h.value){ const ex = justNovaIds().find(id=>id.toLowerCase()===b.value.trim().toLowerCase()); if(ex){ h.value = ex; b.value = ex; } else b.value = ""; }
  }
}
function openJustificativaNova(){
  if(!justNovaPode()){ toast("Sem permissão para criar justificativas na Gestão de Bases."); return; }
  const tipos = listaNomes("justificativaTipo");
  openModal(`
    <h2>Justificar produção</h2>
    <p class="modal-sub">Uma vez enviada, a justificativa não pode ser editada.</p>
    <div class="field" style="margin-bottom:12px;">
      <label>Equipe</label>
      <div class="combo">
        <input id="justNovaBusca" type="text" placeholder="Digite para buscar ou escolha a equipe…" autocomplete="off" onfocus="justNovaListar(this.value)" oninput="justNovaDigitou(this.value)" onblur="justNovaFechar()">
        <input id="justNovaEquipe" type="hidden">
        <div id="justNovaLista" class="combo-lista" style="display:none;"></div>
      </div>
    </div>
    <div class="field" style="margin-bottom:12px;"><label>Dia</label><input id="justNovaDia" type="date"></div>
    <div class="field" style="margin-bottom:12px;">
      <label>Tipo da justificativa</label>
      <select id="justTipo"><option value="">— selecione —</option>${tipos.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}</select>
    </div>
    <div class="field">
      <label>Explicação</label>
      <textarea id="justText" placeholder="Descreva o que aconteceu com a equipe neste dia..."></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarJustificativaNova()">${ic("check")} Enviar justificativa</button>
    </div>
  `);
}
function salvarJustificativaNova(){
  const equipeId = document.getElementById("justNovaEquipe").value;
  const data = document.getElementById("justNovaDia").value;
  if(!equipeId){ toast("Escolha a equipe."); return; }
  if(!data){ toast("Escolha o dia."); return; }
  if(prodJustificada(equipeId, data)){ toast("Essa equipe já tem justificativa nesse dia."); return; }
  salvarJustificativa(equipeId, data, "gestao");
}

/* ---- Justificar: equipe e dia travados; escolhe o tipo e escreve o texto ---- */
function openJustificativaModal(equipeId, data){
  const tipos = listaNomes("justificativaTipo");
  openModal(`
    <h2>Justificar produção</h2>
    <p class="modal-sub">Uma vez enviada, a justificativa não pode ser editada.</p>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field"><label>Equipe</label><input value="${escapeHtml(equipeId)}" disabled></div>
      <div class="field"><label>Dia</label><input value="${fmtDate(data)}" disabled></div>
    </div>
    <div class="field" style="margin-bottom:12px;">
      <label>Tipo da justificativa</label>
      <select id="justTipo"><option value="">— selecione —</option>${tipos.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}</select>
    </div>
    <div class="field">
      <label>Explicação</label>
      <textarea id="justText" placeholder="Descreva o que aconteceu com a equipe neste dia..."></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarJustificativa('${escapeHtml(equipeId).replace(/'/g,"\\'")}','${data}')">${ic("check")} Enviar justificativa</button>
    </div>
  `);
}
function salvarJustificativa(equipeId, data, origem){
  const tipo = document.getElementById("justTipo").value;
  const texto = document.getElementById("justText").value.trim();
  if(!tipo){ toast("Escolha o tipo da justificativa."); return; }
  if(!texto){ toast("Escreva a explicação antes de enviar."); return; }
  const nova = { id: uid("j"), equipeId, data, tipo, texto, autor:nomeAtual(), criadoEm:new Date().toISOString() };
  state.justificativas.unshift(nova);
  if(API_ONLINE){
    // v2.13.13: guarda o id que o Controller gerou (precisa dele pra excluir depois)
    apiSend("POST", "/justificativas", { equipeId, data, tipo, texto, origem: origem||"produtividade" })
      .then(r=>{ if(r && r.id) nova.id = r.id; })
      .catch(err=>{ console.warn("[SPARK] Falha ao sincronizar com o Controller:", err.message); toast("Alterado localmente — não foi possível salvar no Controller agora."); });
  }
  closeModal();
  toast("Justificativa registrada e bloqueada para edição.");
  render();
}

/* lista de justificativas - v2.13.12: pagina da Gestao de Bases (antes era um
   botao/modal ao lado de Dia/Semana/Mes na Produtividade) */
let justListaFiltro = { equipe:"", tipo:"", de:"", ate:"" };
function justListaFiltrar(){
  const f = justListaFiltro;
  return state.justificativas.filter(j=>
    (!f.equipe || String(j.equipeId).toLowerCase().includes(f.equipe.toLowerCase())) &&
    (!f.tipo || j.tipo===f.tipo) &&
    (!f.de || String(j.data).slice(0,10)>=f.de) && (!f.ate || String(j.data).slice(0,10)<=f.ate));
}
/* v3.5.2 - Excel das justificativas (para mandar a outro departamento sem liberar login); respeita os filtros da lista */
function exportarJustificativasExcel(){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const l = justListaFiltrar().slice().sort((a,b)=>String(b.data).localeCompare(String(a.data)) || String(a.equipeId).localeCompare(String(b.equipeId)));
  if(!l.length){ toast("Nada para exportar com esses filtros."); return; }
  const dados = l.map(j=>{
    const e = equipeInfo(j.equipeId) || {};
    return { "Equipe": String(j.equipeId), "Data": fmtDate(j.data), "Tipo": j.tipo||"", "Explicação": j.texto||"",
      "Polo": e.polo||"", "Regional": e.regional||"", "Departamento": e.departamento||"",
      "Autor": String(j.autor||""), "Registrado em": j.criadoEm ? fmtDateTime(j.criadoEm) : "" };
  });
  const ws = XLSX.utils.json_to_sheet(dados), wb = XLSX.utils.book_new();
  ws["!cols"] = [14,12,34,50,14,14,16,22,18].map(w=>({ wch:w }));
  XLSX.utils.book_append_sheet(wb, ws, "Justificativas");
  XLSX.writeFile(wb, `SPARK_justificativas_${prefHojeIso()}.xlsx`);
}
function justListaLinhasHtml(){
  const l = justListaFiltrar();
  const podeExcluir = minhaPermissao("gestaoBases","excluirStatus");
  if(!l.length) return `<tr><td colspan="${podeExcluir?7:6}"><div class="empty">${ic("empty")}<div>Nenhuma justificativa encontrada.</div></div></td></tr>`;
  return l.map(j=>`<tr>
    <td class="mono">${escapeHtml(String(j.equipeId))}</td><td>${fmtDate(j.data)}</td>
    <td>${j.tipo ? `<span class="pill info">${escapeHtml(j.tipo)}</span>` : `<span style="color:var(--muted);">—</span>`}</td>
    <td>${escapeHtml(j.texto||"")}</td><td>${escapeHtml(String(j.autor||"—"))}</td><td>${fmtDateTime(j.criadoEm)}</td>${podeExcluir?`<td style="white-space:nowrap;"><button class="btn btn-danger btn-sm" onclick="confirmarExcluirJustificativa('${escapeHtml(String(j.id)).replace(/'/g,"\\'")}')">Excluir</button></td>`:""}</tr>`).join("");
}
function confirmarExcluirJustificativa(id){
  const j = state.justificativas.find(x=>String(x.id)===String(id));
  if(!j) return;
  openModal(`
    <h2>Excluir justificativa?</h2>
    <p class="modal-sub mono">${escapeHtml(String(j.equipeId))} · ${fmtDate(j.data)} · ${escapeHtml(j.tipo||"—")}</p>
    <p style="font-size:13px;">${escapeHtml(j.texto||"")}</p>
    <p style="font-size:13px;">A justificativa some da lista e a equipe/dia volta a aparecer como <strong>sem justificativa</strong> na Produtividade. O registro não é apagado do banco — fica marcado como excluído, com quem excluiu e quando.</p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="excluirJustificativa('${escapeHtml(String(j.id)).replace(/'/g,"\\'")}')">Excluir</button>
    </div>`);
}
async function excluirJustificativa(id){
  try{
    if(API_ONLINE) await apiDelete(`/justificativas/${encodeURIComponent(id)}`);
    state.justificativas = state.justificativas.filter(x=>String(x.id)!==String(id));
    closeModal();
    toast("Justificativa excluída.");
    render();
  }catch(err){
    toast(`Erro ao excluir: ${err.message}`);
  }
}
function justListaContagemTxt(){
  const n = justListaFiltrar().length, t = state.justificativas.length;
  return n === t ? `${t} justificativa(s)` : `${n} de ${t} justificativa(s)`;
}
function justListaSet(campo, v){
  justListaFiltro[campo] = v;
  const tb = document.getElementById("justListaRows"); if(tb) tb.innerHTML = justListaLinhasHtml();
  const ct = document.getElementById("justListaCont"); if(ct) ct.textContent = justListaContagemTxt();
}
function justListaLimpar(){
  justListaFiltro = { equipe:"", tipo:"", de:"", ate:"" };
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
}
function justificativasPaginaHtml(){
  const tipos = [...new Set([...listaNomes("justificativaTipo",true), ...state.justificativas.map(j=>j.tipo).filter(Boolean)])];
  const podeExcluir = minhaPermissao("gestaoBases","excluirStatus");
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Equipe com % abaixo de 90% no dia precisa de justificativa (botão "Justificar" na Produtividade). Pelo botão "Nova" dá para justificar qualquer equipe e dia, por exemplo quando produziu mas o plano foi desviado. Os registros não podem ser editados${podeExcluir ? " — só excluídos (a equipe/dia volta a ficar sem justificativa)" : ""}.</p>
    <div style="margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap;">
      ${justNovaPode() ? `<button class="btn btn-primary btn-sm" onclick="openJustificativaNova()">${ic("plus")} Nova</button>` : ""}
      <button class="btn btn-ghost btn-sm" onclick="exportarJustificativasExcel()" title="Baixa em Excel as justificativas que estão na lista (respeita os filtros acima)">${ic("download")} Baixar Excel</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)) auto; gap:8px; margin-bottom:10px; align-items:center;">
      <input type="text" placeholder="Equipe…" value="${escapeHtml(justListaFiltro.equipe)}" oninput="justListaSet('equipe',this.value)">
      <select onchange="justListaSet('tipo',this.value)"><option value="">Todos os tipos</option>${tipos.map(t=>`<option value="${escapeHtml(t)}" ${justListaFiltro.tipo===t?"selected":""}>${escapeHtml(t)}</option>`).join("")}</select>
      <input type="date" value="${justListaFiltro.de}" onchange="justListaSet('de',this.value)" title="De">
      <input type="date" value="${justListaFiltro.ate}" onchange="justListaSet('ate',this.value)" title="Até">
      <button class="btn btn-ghost btn-sm" onclick="justListaLimpar()">Limpar</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Equipe</th><th>Data</th><th>Tipo</th><th>Explicação</th><th>Autor</th><th>Registrado em</th>${podeExcluir?"<th></th>":""}</tr></thead>
      <tbody id="justListaRows">${justListaLinhasHtml()}</tbody>
    </table></div>
    <div style="color:var(--muted); font-size:12px; margin-top:8px;" id="justListaCont">${justListaContagemTxt()}</div>`;
}

/* =========================================================================
   Indisponibilidade de equipes (v2.14.1) — Gestão de Bases
   - Período (de/até) + motivo (mesma lista dos "Tipos de justificativa") + texto.
   - Avisa o programador ao escolher a equipe na Nova programação.
   - Tira a meta da equipe nos dias indisponíveis (Produtividade).
   ========================================================================= */
function indispNaData(equipeId, iso){
  return (state.indisponibilidades||[]).find(i=>i.equipeId===equipeId && String(i.dataInicio).slice(0,10)<=iso && iso<=String(i.dataFim).slice(0,10)) || null;
}
function indispNoPeriodo(equipeId, de, ate){
  if(!de || !ate) return [];
  return (state.indisponibilidades||[]).filter(i=>i.equipeId===equipeId && String(i.dataInicio).slice(0,10)<=ate && String(i.dataFim).slice(0,10)>=de);
}
function indispPeriodoTxt(i){
  const a = fmtDate(i.dataInicio), b = fmtDate(i.dataFim);
  return a===b ? a : `${a.slice(0,5)} a ${b.slice(0,5)}`;
}
/* meta do mês descontando os dias úteis em que a equipe está indisponível */
function prodMetaMesAjustada(equipeId, anoMes, tipo){
  if(!equipeIdAtiva(equipeId)) return 0;   // v3.5.2 - inativa: sem meta
  const m = prodMetaDe(equipeId, anoMes, tipo);
  if(!m || !m.metaMensal) return 0;
  const dias = m.diasUteis || 21, porDia = m.metaMensal/dias;
  const ultimo = new Date(parseInt(anoMes.slice(0,4),10), parseInt(anoMes.slice(5,7),10), 0).getDate();
  let tirar = 0;
  for(let d=1; d<=ultimo; d++){
    const iso = `${anoMes}-${String(d).padStart(2,"0")}`;
    if(prodEhDiaUtil(iso) && indispNaData(equipeId, iso)) tirar += porDia;
  }
  return Math.max(0, m.metaMensal - tirar);
}
function indispDiasUteis(i){
  let n = 0;
  for(let d=String(i.dataInicio).slice(0,10), fim=String(i.dataFim).slice(0,10), g=0; d<=fim && g<800; d=isoMais(d,1), g++) if(prodEhDiaUtil(d)) n++;
  return n;
}

let indispFiltro = { equipe:"", tipo:"", soVigentes:true };
function indispListaFiltrar(){
  const f = indispFiltro, hoje = prefHojeIso();
  return (state.indisponibilidades||[]).filter(i=>
    (!f.equipe || String(i.equipeId).toLowerCase().includes(f.equipe.toLowerCase())) &&
    (!f.tipo || i.tipo===f.tipo) &&
    (!f.soVigentes || String(i.dataFim).slice(0,10)>=hoje))
    .sort((a,b)=>String(b.dataInicio).localeCompare(String(a.dataInicio)));
}
function indispLinhasHtml(){
  const l = indispListaFiltrar(), podeExcluir = minhaPermissao("gestaoBases","excluirStatus"), hoje = prefHojeIso();
  if(!l.length) return `<tr><td colspan="${podeExcluir?9:8}"><div class="empty">${ic("empty")}<div>Nenhuma indisponibilidade encontrada.</div></div></td></tr>`;
  return l.map(i=>{
    const ini = String(i.dataInicio).slice(0,10), fim = String(i.dataFim).slice(0,10);
    const sit = fim<hoje ? `<span class="pill muted">Encerrada</span>` : (ini<=hoje ? `<span class="pill warn">Vigente</span>` : `<span class="pill info">Futura</span>`);
    return `<tr>
      <td class="mono">${escapeHtml(String(i.equipeId))}</td><td>${fmtDate(ini)}</td><td>${fmtDate(fim)}</td>
      <td class="num">${indispDiasUteis(i)}</td><td>${sit}</td><td>${escapeHtml(i.tipo||"")}</td>
      <td>${escapeHtml(i.texto||"")}</td><td>${escapeHtml(String(i.autor||"—"))}</td>
      ${podeExcluir?`<td style="white-space:nowrap;"><button class="btn btn-danger btn-sm" onclick="indispExcluir('${escapeHtml(String(i.id)).replace(/'/g,"\\'")}')">Excluir</button></td>`:""}</tr>`;
  }).join("");
}
function indispContagemTxt(){
  const n = indispListaFiltrar().length, t = (state.indisponibilidades||[]).length;
  return n===t ? `${t} indisponibilidade(s)` : `${n} de ${t} indisponibilidade(s)`;
}
function indispSet(campo, v){
  indispFiltro[campo] = v;
  const tb = document.getElementById("indispRows"); if(tb) tb.innerHTML = indispLinhasHtml();
  const ct = document.getElementById("indispCont"); if(ct) ct.textContent = indispContagemTxt();
}
function indispPaginaHtml(){
  const pode = minhaPermissao("produtividade","criar");
  const tipos = [...new Set([...listaNomes("justificativaTipo",true), ...(state.indisponibilidades||[]).map(i=>i.tipo).filter(Boolean)])];
  const tiposAtivos = listaNomes("justificativaTipo");
  const equipes = (state.equipes||[]).map(e=>e.id).sort((a,b)=>String(a).localeCompare(String(b),"pt-BR",{numeric:true,sensitivity:"base"}));
  const hoje = prefHojeIso();
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Período em que a equipe <strong>não pode receber serviço</strong> (férias, treinamento, veículo parado…). Nesses dias a <strong>meta da equipe sai da Produtividade</strong> e o programador recebe um <strong>aviso</strong> ao escolher a equipe numa programação.</p>
    ${pode ? `<div class="card" style="margin-bottom:14px; padding:14px;">
      <h3 style="margin:0 0 10px; font-size:14px;">Nova indisponibilidade</h3>
      <div style="display:grid; grid-template-columns:minmax(180px,1.4fr) 1fr 1fr minmax(200px,1.4fr); gap:10px; align-items:start;">
        <div class="field"><label>Equipe(s) <span style="color:var(--muted); font-weight:400;">(Ctrl para várias)</span></label>
          <select id="indEquipes" multiple size="5">${equipes.map(e=>`<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")}</select></div>
        <div class="field"><label>De</label><input type="date" id="indDe" value="${hoje}"></div>
        <div class="field"><label>Até</label><input type="date" id="indAte" value="${hoje}"></div>
        <div class="field"><label>Motivo</label>
          <select id="indTipo"><option value="">— selecione —</option>${tiposAtivos.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}</select></div>
      </div>
      <div class="field" style="margin-top:8px;"><label>Observação</label><textarea id="indTexto" rows="2" placeholder="Detalhe, se precisar (opcional)"></textarea></div>
      <div style="margin-top:10px;"><button class="btn btn-primary" onclick="indispSalvar()">${ic("check")} Registrar indisponibilidade</button></div>
    </div>` : ""}
    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)) auto auto; gap:8px; margin-bottom:10px; align-items:center;">
      <input type="text" placeholder="Equipe…" value="${escapeHtml(indispFiltro.equipe)}" oninput="indispSet('equipe',this.value)">
      <select onchange="indispSet('tipo',this.value)"><option value="">Todos os motivos</option>${tipos.map(t=>`<option value="${escapeHtml(t)}" ${indispFiltro.tipo===t?"selected":""}>${escapeHtml(t)}</option>`).join("")}</select>
      <label class="check-row" style="margin:0;"><input type="checkbox" ${indispFiltro.soVigentes?"checked":""} onchange="indispSet('soVigentes',this.checked)"> só vigentes e futuras</label>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Equipe</th><th>De</th><th>Até</th><th>Dias úteis</th><th>Situação</th><th>Motivo</th><th>Observação</th><th>Autor</th>${minhaPermissao("gestaoBases","excluirStatus")?"<th></th>":""}</tr></thead>
      <tbody id="indispRows">${indispLinhasHtml()}</tbody>
    </table></div>
    <div style="color:var(--muted); font-size:12px; margin-top:8px;" id="indispCont">${indispContagemTxt()}</div>`;
}
async function indispSalvar(){
  const sel = Array.from(document.getElementById("indEquipes").selectedOptions).map(o=>o.value);
  const de = document.getElementById("indDe").value, ate = document.getElementById("indAte").value;
  const tipo = document.getElementById("indTipo").value, texto = document.getElementById("indTexto").value.trim();
  if(!sel.length){ toast("Escolha ao menos uma equipe."); return; }
  if(!de || !ate){ toast("Informe o período (de / até)."); return; }
  if(ate < de){ toast("A data final não pode ser antes da inicial."); return; }
  if(!tipo){ toast("Escolha o motivo da indisponibilidade."); return; }
  if(!state.indisponibilidades) state.indisponibilidades = [];
  let ok = 0, erros = 0;
  for(const equipeId of sel){
    const nova = { id:uid("i"), equipeId, dataInicio:de, dataFim:ate, tipo, texto, autor:nomeAtual(), criadoEm:new Date().toISOString() };
    try{
      if(API_ONLINE){ const r = await apiSend("POST", "/indisponibilidades", { equipeId, dataInicio:de, dataFim:ate, tipo, texto }); if(r && r.id) nova.id = r.id; }
      state.indisponibilidades.unshift(nova); ok++;
    }catch(err){ erros++; console.warn("[SPARK] indisponibilidade:", err.message); }
  }
  toast(erros ? `${ok} registrada(s); ${erros} com erro (veja permissão/conexão).` : `${ok} indisponibilidade(s) registrada(s). A meta já sai da Produtividade nesses dias.`);
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
}
function indispExcluir(id){
  const i = (state.indisponibilidades||[]).find(x=>String(x.id)===String(id)); if(!i) return;
  openModal(`
    <h2>Excluir indisponibilidade?</h2>
    <p class="modal-sub">${escapeHtml(i.equipeId)} · ${indispPeriodoTxt(i)} · ${escapeHtml(i.tipo||"")}</p>
    <p style="font-size:13px;">A meta da equipe volta a contar nesse período e o aviso na programação some. O registro não é apagado do banco — fica marcado como excluído.</p>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="indispExcluirConfirmar('${escapeHtml(String(id)).replace(/'/g,"\\'")}')">Excluir</button></div>`);
}
async function indispExcluirConfirmar(id){
  try{
    if(API_ONLINE) await apiDelete(`/indisponibilidades/${encodeURIComponent(id)}`);
    state.indisponibilidades = (state.indisponibilidades||[]).filter(x=>String(x.id)!==String(id));
    closeModal(); toast("Indisponibilidade excluída.");
    const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
  }catch(err){ toast(`Erro ao excluir: ${err.message}`); }
}

/* =========================================================================
   VIEW: Metas (CRUD)
   ========================================================================= */
function viewMetas(){
  return `
  <div class="card-head" style="margin-bottom:12px;">
    <div></div>
    <div style="display:flex; gap:8px;">
      ${minhaPermissao("metas","importar") ? `<button class="btn btn-ghost" onclick="openImportModal('Metas')">${ic("upload")} Importar Excel</button>` : ""}
      ${minhaPermissao("metas","criar") ? `<button class="btn btn-primary" onclick="openMetaModal()">${ic("plus")} Nova meta</button>` : ""}
    </div>
  </div>
  <div class="card">
    <div class="table-wrap"><table>
      <thead><tr><th>Equipe</th><th>Mês</th><th>Meta mensal</th><th>Dias úteis</th><th>Meta diária</th><th>Atualizado</th><th></th></tr></thead>
      <tbody id="metasRows">${metasRowsHtml()}</tbody>
    </table></div>
  </div>
  `;
}
function metasRowsHtml(){
  return state.metas.map(m=>`
    <tr>
      <td class="mono">${m.equipeId}${metaTipo(m)==="faixa"?" · faixa":""}</td>
      <td>${m.anoMes}</td>
      <td class="num">${m.metaMensal}</td>
      <td class="num">${m.diasUteis}</td>
      <td class="num">${(m.metaMensal/m.diasUteis).toFixed(1)}</td>
      <td>${fmtDate(m.atualizadoEm)} · ${m.atualizadoPor}</td>
      <td>${minhaPermissao("metas","editar") ? `<button class="btn btn-ghost btn-sm" onclick="openMetaModal('${m.id}')">Editar</button>` : ""}</td>
    </tr>`).join("");
}
/* v3.10.2 - janela de metas: 12 campos (jan-dez) por ano; troca de ano mantém o que já foi digitado */
let metaDraft = null;   // { equipeId, tipo, ano, edicao, valores:{ "2026":{ 1:"357", ... } } }
function metaMesesDoAno(equipeId, tipo, ano){
  const r = {};
  state.metas.forEach(m=>{
    if(String(m.equipeId)===String(equipeId) && metaTipo(m)===tipo && String(m.anoMes||"").slice(0,4)===String(ano)) r[parseInt(String(m.anoMes).slice(5,7),10)] = m;
  });
  return r;
}
function metaDiasUteisOffline(anoMes){
  const [a,m] = String(anoMes).split("-").map(Number); let n = 0;
  for(let d=1; d<=new Date(a,m,0).getDate(); d++){ const w = new Date(a,m-1,d).getDay(); if(w!==0 && w!==6) n++; }
  return n;
}
function openMetaGrupo(enc, tipo){ openMetaModal("", decodeURIComponent(enc), tipo); }
function openMetaModal(id, equipeId, tipo, ano){
  if(!minhaPermissao("metas","editar") && !minhaPermissao("metas","criar")){ toast("Seu perfil só pode visualizar."); return; }
  const alvo = id ? state.metas.find(x=>x.id===id) : null;
  if(alvo){ equipeId = alvo.equipeId; tipo = metaTipo(alvo); ano = String(alvo.anoMes).slice(0,4); }
  tipo = tipo==="faixa" ? "faixa" : "poda";
  if(equipeId && !ano){
    const anos = [...new Set(state.metas.filter(m=>String(m.equipeId)===String(equipeId) && metaTipo(m)===tipo).map(m=>String(m.anoMes).slice(0,4)))].sort();
    const atual = String(new Date().getFullYear());
    ano = anos.includes(atual) || !anos.length ? atual : anos[anos.length-1];
  }
  metaDraft = { equipeId: equipeId||"", tipo, ano: String(ano || new Date().getFullYear()), edicao: !!equipeId, valores:{} };
  openModal(`
    <h2>${metaDraft.edicao ? "Metas da equipe" : "Nova meta"}</h2>
    <p class="modal-sub">${metaDraft.edicao ? "Preencha a meta de cada mês do ano. Deixar um mês vazio remove a meta dele." : "Digite para buscar no cadastro de equipes (as de poda aparecem primeiro). Se a equipe não estiver na lista, pode escrever o nome dela."}</p>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field">
        <label>Equipe</label>
        <input id="metaEquipe" list="dlMetaEquipes" autocomplete="off" placeholder="Digite o nome da equipe…" value="${escapeHtml(metaDraft.equipeId)}" ${metaDraft.edicao?"disabled":""} onchange="metaCamposMudaram()">
        <datalist id="dlMetaEquipes">${state.equipes.slice().sort((x,y)=>(y.equipePoda?1:0)-(x.equipePoda?1:0) || String(x.id).localeCompare(String(y.id),"pt-BR",{numeric:true})).map(e=>`<option value="${escapeHtml(e.id)}">${e.equipePoda?"":"(não é de poda)"}</option>`).join("")}</datalist>
      </div>
      <div class="field">
        <label>Serviço</label>
        <select id="metaTipo" ${metaDraft.edicao?"disabled":""} onchange="metaCamposMudaram()">
          <option value="poda" ${tipo==="poda"?"selected":""}>Poda (unidades)</option>
          <option value="faixa" ${tipo==="faixa"?"selected":""}>Limpeza de faixa (km lineares)</option>
        </select>
      </div>
    </div>
    <div id="metaMesesWrap">${metaMesesHtml()}</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="metaSalvarBtn" onclick="salvarMeta()">${ic("check")} Salvar</button>
    </div>
  `);
  const mm = document.querySelector("#modalOverlay .modal"); if(mm) mm.classList.add("modal-largo");
}
function metaMesesHtml(){
  const d = metaDraft, ex = metaMesesDoAno(d.equipeId, d.tipo, d.ano), rasc = d.valores[d.ano] || {};
  const un = d.tipo==="faixa" ? "km lineares" : "unidades";
  const campos = META_MESES.map((nome,k)=>{
    const mes = k+1, v = rasc[mes] !== undefined ? rasc[mes] : (ex[mes] ? String(ex[mes].metaMensal).replace(".",",") : "");
    return `<div class="field"><label style="font-size:11.5px;">${nome}${ex[mes]?"":` <span style="color:var(--muted); font-weight:400;">· novo</span>`}</label><input id="metaM${mes}" type="text" inputmode="decimal" value="${escapeHtml(v)}" placeholder="—" oninput="metaDigitou(${mes}, this.value)"></div>`;
  }).join("");
  return `
    <div style="display:flex; gap:8px; align-items:end; flex-wrap:wrap; margin-bottom:12px;">
      <div class="field" style="margin:0;"><label>Ano</label>
        <div style="display:flex; gap:4px; align-items:center;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="metaTrocarAno(${Number(d.ano)-1})">‹</button>
          <input id="metaAno" type="number" min="2020" max="2100" value="${escapeHtml(d.ano)}" style="width:90px; text-align:center;" onchange="metaTrocarAno(this.value)">
          <button type="button" class="btn btn-ghost btn-sm" onclick="metaTrocarAno(${Number(d.ano)+1})">›</button>
        </div>
      </div>
      <div class="field" style="margin:0 0 0 auto;"><label>Mesmo valor para os 12 meses</label>
        <div style="display:flex; gap:6px;"><input id="metaTodos" type="text" inputmode="decimal" placeholder="${d.tipo==="faixa"?"ex.: 4,5":"ex.: 357"}" style="width:110px;"><button type="button" class="btn btn-ghost btn-sm" onclick="metaPreencherTodos()">Aplicar</button></div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:6px;">${campos}</div>
    <p style="margin:0 0 4px; font-size:11.5px; color:var(--muted);">Meta mensal em ${un}. Os dias úteis de cada mês são calculados pelo sistema (com os feriados cadastrados).</p>`;
}
function metaDigitou(mes, v){ const d = metaDraft; (d.valores[d.ano] = d.valores[d.ano] || {})[mes] = v; }
function metaRedesenharMeses(){ const w = document.getElementById("metaMesesWrap"); if(w) w.innerHTML = metaMesesHtml(); }
function metaCamposMudaram(){
  const eq = document.getElementById("metaEquipe"), ti = document.getElementById("metaTipo");
  if(!metaDraft.edicao){
    const novoEq = eq ? eq.value.trim() : "", novoTi = ti && ti.value==="faixa" ? "faixa" : "poda";
    if(novoEq !== metaDraft.equipeId || novoTi !== metaDraft.tipo){ metaDraft.equipeId = novoEq; metaDraft.tipo = novoTi; metaDraft.valores = {}; }
  }
  metaRedesenharMeses();
}
function metaTrocarAno(a){
  const n = parseInt(a,10);
  if(!(n >= 2000 && n <= 2100)){ toast("Informe um ano válido (2000 a 2100)."); metaRedesenharMeses(); return; }
  const eq = document.getElementById("metaEquipe");
  if(!metaDraft.edicao && eq) metaDraft.equipeId = eq.value.trim();
  metaDraft.ano = String(n); metaRedesenharMeses();
}
function metaPreencherTodos(){
  const v = (document.getElementById("metaTodos").value||"").trim();
  const n = parseFloat(v.replace(",","."));
  if(!(n > 0)){ toast("Digite um valor maior que zero."); return; }
  const d = metaDraft; d.valores[d.ano] = d.valores[d.ano] || {};
  for(let m=1; m<=12; m++) d.valores[d.ano][m] = v;
  metaRedesenharMeses();
}
async function salvarMeta(){
  const d = metaDraft; if(!d) return;
  const eq = document.getElementById("metaEquipe"), ti = document.getElementById("metaTipo");
  if(!d.edicao){ d.equipeId = eq ? eq.value.trim() : d.equipeId; d.tipo = ti && ti.value==="faixa" ? "faixa" : "poda"; }
  if(!d.equipeId){ toast("Informe a equipe."); return; }
  const ops = [];
  for(const ano of Object.keys(d.valores).sort()){
    const ex = metaMesesDoAno(d.equipeId, d.tipo, ano);
    for(const mes of Object.keys(d.valores[ano]).map(Number).sort((a,b)=>a-b)){
      const txt = String(d.valores[ano][mes]||"").trim(), rec = ex[mes], anoMes = `${ano}-${String(mes).padStart(2,"0")}`;
      if(txt===""){ if(rec) ops.push({ k:"del", rec, anoMes }); continue; }
      const n = parseFloat(txt.replace(",","."));
      if(!(n > 0)){ toast(`Valor inválido em ${META_MESES[mes-1]}/${ano}.`); return; }
      if(!rec) ops.push({ k:"post", n, anoMes });
      else if(Number(rec.metaMensal) !== n) ops.push({ k:"put", n, rec, anoMes });
    }
  }
  if(!ops.length){ toast("Nada foi alterado."); return; }
  if(ops.some(o=>o.k==="post") && !minhaPermissao("metas","criar")){ toast("Seu perfil não pode criar metas novas."); return; }
  if(ops.some(o=>o.k!=="post") && !minhaPermissao("metas","editar")){ toast("Seu perfil não pode alterar ou remover metas existentes."); return; }
  const btn = document.getElementById("metaSalvarBtn"); if(btn){ btn.disabled = true; btn.textContent = "Salvando…"; }
  const hoje = new Date().toISOString().slice(0,10), cont = { post:0, put:0, del:0 }, falhas = [];
  for(const o of ops){   // um de cada vez: o Controller grava o arquivo inteiro a cada chamada
    try{
      if(o.k==="post"){
        let nova = { id:uid("m"), equipeId:d.equipeId, tipo:d.tipo, anoMes:o.anoMes, metaMensal:o.n, diasUteis:metaDiasUteisOffline(o.anoMes), atualizadoPor:nomeAtual(), atualizadoEm:hoje };
        if(API_ONLINE){ const r = await apiPost("/metas", { equipeId:d.equipeId, tipo:d.tipo, anoMes:o.anoMes, metaMensal:o.n }); if(r && r.id){ nova.id = r.id; if(r.diasUteis) nova.diasUteis = r.diasUteis; } }
        state.metas.push(nova);
      } else if(o.k==="put"){
        let dias = o.rec.diasUteis;
        if(API_ONLINE){ const r = await apiPut(`/metas/${encodeURIComponent(o.rec.id)}`, { anoMes:o.anoMes, metaMensal:o.n }); if(r && r.diasUteis) dias = r.diasUteis; }
        Object.assign(o.rec, { metaMensal:o.n, diasUteis:dias, atualizadoPor:nomeAtual(), atualizadoEm:hoje });
      } else {
        if(API_ONLINE) await apiDelete(`/cadastros/metas/${encodeURIComponent(o.rec.id)}`);
        state.metas = state.metas.filter(m=>m.id!==o.rec.id);
      }
      cont[o.k]++;
    }catch(err){ falhas.push(`${o.anoMes}: ${err.message}`); }
  }
  closeModal();
  const partes = [cont.post && `${cont.post} criada(s)`, cont.put && `${cont.put} atualizada(s)`, cont.del && `${cont.del} removida(s)`].filter(Boolean);
  toast(`Metas salvas${partes.length ? ": "+partes.join(", ") : ""}.${falhas.length ? ` ${falhas.length} falhou: ${falhas[0]}` : ""}`);
  metaDraft = null;
  render();
}
function confirmarExcluirMetasGrupo(enc, tipo){
  const equipeId = decodeURIComponent(enc);
  if(!minhaPermissao("metas","editar")){ toast("Seu perfil só pode visualizar."); return; }
  const n = state.metas.filter(m=>String(m.equipeId)===equipeId && metaTipo(m)===tipo).length;
  openModal(`
    <h2>Excluir metas da equipe?</h2>
    <p class="modal-sub mono">${escapeHtml(equipeId)} · ${tipo==="faixa"?"Faixa (km)":"Poda (un.)"}</p>
    <p style="font-size:13px;">Serão excluídas as <strong>${n} meta(s) mensais</strong> dessa equipe (todos os anos). Nada é apagado do banco — é só uma marca (flag); um administrador pode restaurar em "ver excluídas".</p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="excluirMetasGrupo('${enc}','${tipo}')">Excluir</button>
    </div>`);
}
async function excluirMetasGrupo(enc, tipo){
  const equipeId = decodeURIComponent(enc);
  const alvo = state.metas.filter(m=>String(m.equipeId)===equipeId && metaTipo(m)===tipo);
  let ok = 0, falha = 0;
  for(const m of alvo){
    try{ if(API_ONLINE) await apiDelete(`/cadastros/metas/${encodeURIComponent(m.id)}`); state.metas = state.metas.filter(x=>x.id!==m.id); ok++; }
    catch(e){ falha++; }
  }
  closeModal();
  toast(`${ok} meta(s) excluída(s)${falha?` · ${falha} falhou`:""}.`);
  try{ await carregarCadastroPagina(); }catch(e){ render(); }
}

/* =========================================================================
   VIEW: Programação
   ========================================================================= */
/* v3.0.1 - desempenho da Programação: índice de OS por id, caches e conflitos sem laço duplo */
let _osIdxRef = null, _osIdxLen = -1, _osIdx = null;
function osPorId(id){
  const a = state.manutencaoOS;
  if(_osIdxRef!==a || _osIdxLen!==a.length){ _osIdx = new Map(); for(let i=0;i<a.length;i++) _osIdx.set(a[i].id, a[i]); _osIdxRef = a; _osIdxLen = a.length; }
  return _osIdx.get(id) || (state.osSnapMap ? state.osSnapMap.get(String(id)) : undefined);   // v3.0.7: copia guardada na programacao quando a OS saiu da base
}
/* v3.0.3 - OS programada é sempre a PRIMÁRIA: ela só é "atendida" quando volta uma OS EXECUTADA apontando para ela (osPrimaria).
   A própria primária continua Pendente na base, então não dá para olhar só o statusOS dela. */
let _prRef = null, _prLen = -1, _prMap = new Map(), _prSnap = null;
function execPorPrimaria(){
  const a = state.manutencaoOS || [];
  if(_prRef!==a || _prLen!==a.length || _prSnap!==state.execSnapMap){
    _prMap = new Map();
    for(let i=0;i<a.length;i++){ const o=a[i]; if(o.statusOS==="Executada" && o.osPrimaria){ const k=String(o.osPrimaria).trim(); let l=_prMap.get(k); if(!l){ l=[]; _prMap.set(k,l); } l.push(o); } }
    // v3.0.7 - executadas filhas guardadas na programação (execSnap) que já não estão na base
    const sn = state.execSnapMap;
    if(sn) sn.forEach((lista,k)=>{ lista.forEach(x=>{ let l=_prMap.get(k); if(!l){ l=[]; _prMap.set(k,l); } if(!l.some(y=>String(y.id)===String(x.id))) l.push(x); }); });
    _prRef = a; _prLen = a.length; _prSnap = sn;
  }
  return _prMap;
}
/* v3.0.6 - OS da programação: a primária some da base quando a grid pendente é reimportada depois da execução;
   nesse caso usa as OS Executadas que apontam para ela (elas carregam previsto e realizado), para não perder os números */
function osDaProgramacao(p){
  const out = [];
  (p.osIds||[]).forEach(id=>{
    const o = osPorId(id);
    if(o){ out.push(o); return; }
    const f = execPorPrimaria().get(String(id).trim());
    if(f) f.forEach(x=>out.push(x));
  });
  return out;
}
function osAtendida(o){ return o.statusOS==="Executada" || execPorPrimaria().has(String(o.id).trim()); }
function realizadoOS(o, tipo){   // realizado da OS programada = o dela + o das executadas que apontam para ela
  let t = tipo ? qtdTipoOS(o,tipo,"real") : qtdOS(o,"real");
  if(o.statusOS!=="Executada"){ const f = execPorPrimaria().get(String(o.id).trim()); if(f) f.forEach(x=>{ t += tipo ? qtdTipoOS(x,tipo,"real") : qtdOS(x,"real"); }); }
  return t;
}
/* assinatura barata das programações: muda quando qualquer uma é criada/editada/cancelada */
function progAssinatura(){
  const ps = state.programacoes || [];
  let sig = ps.length + "#" + (state.manutencaoOS||[]).length + "#" + (state.logProgramacoes||[]).length + "#" + (state.equipes||[]).length + "#";
  for(let i=0;i<ps.length;i++){
    const p = ps[i];
    sig += p.id+"|"+p.status+"|"+p.dataInicio+"|"+p.dataFim+"|"+(p.equipesIds||[]).join(",")+"|"+(p.osIds||[]).length+"/"+(p.osSnap?p.osSnap.length:0)+"/"+(p.execSnap?p.execSnap.length:0)+"|"+(p.localidade||"")+"|"+(p.numeroSIS||"")+"|"+(p.observacao||"")+"|"+(p.protecaoId||"")+"|"+(p.alimentador||"")+"|"+(p.tipoProgramacao||"")+";";
  }
  return sig;
}
let _confSig = null, _confRes = null;
function detectarConflitos(){
  const sig = progAssinatura();
  if(_confSig===sig && _confRes) return _confRes;
  const conflitos = [];
  const porEquipe = new Map();
  state.programacoes.forEach(p=>{
    if(p.status==="Cancelada") return;
    (p.equipesIds||[]).forEach(id=>{ if(!porEquipe.has(id)) porEquipe.set(id, []); porEquipe.get(id).push(p); });
  });
  const vistos = new Set();
  porEquipe.forEach(lista=>{
    lista.sort((a,b)=> a.dataInicio<b.dataInicio ? -1 : a.dataInicio>b.dataInicio ? 1 : 0);
    for(let i=0;i<lista.length;i++){
      for(let j=i+1;j<lista.length && lista[j].dataInicio<=lista[i].dataFim;j++){
        const a = lista[i], b = lista[j];
        if(a.id===b.id) continue;
        const k = a.id<b.id ? a.id+"\u0001"+b.id : b.id+"\u0001"+a.id;
        if(vistos.has(k)) continue;
        vistos.add(k);
        conflitos.push({a:a.id,b:b.id});
      }
    }
  });
  _confSig = sig; _confRes = conflitos;
  return conflitos;
}
let programacaoTab = "protecoes"; // protecoes | equipes | lacunas | oportunidades
function setProgramacaoTab(t){ programacaoTab = t; if(t==="equipes") logFiltroSemana = logSemanaAtual(); render(); }

function viewProgramacao(){
  const lacunasQtd = logLacunas().length;
  const oportunidadesQtd = logOportunidades(logDadosEnriquecidos()).length;
  const entregasQtd = new Set((state.programacoes||[]).filter(p=>p.previstoConcluir && p.status!=="Cancelada").map(p=>String(p.protecaoId||"").trim().toUpperCase())).size;
  return `
  <div class="tabs" style="margin-bottom:14px;">
    <button class="tab ${programacaoTab==='protecoes'?'active':''}" onclick="setProgramacaoTab('protecoes')">Proteções</button>
    <button class="tab ${programacaoTab==='equipes'?'active':''}" onclick="setProgramacaoTab('equipes')">Programação por equipe</button>
    <button class="tab ${programacaoTab==='porOS'?'active':''}" onclick="setProgramacaoTab('porOS')" title="Uma linha por OS programada: concluída, no prazo ou atrasada">Programação por OSs${poAtrasadasQtd()?` (${poAtrasadasQtd()} atrasada${poAtrasadasQtd()>1?"s":""})`:``}</button>
    <button class="tab ${programacaoTab==='lacunas'?'active':''}" onclick="setProgramacaoTab('lacunas')">Equipes sem programação${lacunasQtd?` (${lacunasQtd})`:``}</button>
    <button class="tab ${programacaoTab==='oportunidades'?'active':''}" onclick="setProgramacaoTab('oportunidades')">Oportunidades${oportunidadesQtd?` (${oportunidadesQtd})`:``}</button>
    <button class="tab ${programacaoTab==='entregas'?'active':''}" onclick="setProgramacaoTab('entregas')" title="Programações marcadas como 'encerra as pendências do elemento de proteção'">Entregam elemento${entregasQtd?` (${entregasQtd})`:``}</button>
  </div>
  ${programacaoTab==='protecoes' ? viewProgramacaoProtecoes() : ``}
  ${programacaoTab==='equipes' ? viewProgramacaoEquipes() : ``}
  ${programacaoTab==='porOS' ? viewProgramacaoPorOS() : ``}
  ${programacaoTab==='lacunas' ? viewProgramacaoLacunas() : ``}
  ${programacaoTab==='oportunidades' ? viewProgramacaoOportunidades() : ``}
  ${programacaoTab==='entregas' ? viewProgramacaoEntregas() : ``}
  `;
}

/* ---- v2.13.0: listas cadastráveis (Plano / Equipe necessária / tipos de justificativa) ---- */
const LISTAS_PADRAO_FRONT = {
  plano: ["Alimentadores Sensíveis","ARSESP","Conjunto ESS","Fora Plano","LD (34Kv E 40Kv)","Linha do Basta","Não Efetivo","Reclamações","Repasse","Repetibilidade","SOMA","T1 & T2","TOP AL ESS LT",'T3 "U" Maior 200 UC'],
  equipeNecessaria: ["LM - LIVRE","LM - DESLIGAMENTO","LINHA VIVA","LINHA VIVA 18mts","RECOLHA"],
  justificativaTipo: ["Serviços Comerciais","Férias","Sem Informação","Treinamento","Déficit de efetivo Próprio (aguardando contratação)","Veículo Quebrado/Manutenção","Atuando em manutenção/estrutura","Apoio na Recolha","Chuva","Déficit de efetivo Terceiro","Colaborador Afastado","Serviços Baroneza","Trabalhando no corte","Contingência","Outros","Colaborador de férias"],
};
/* nomes ativos de uma lista; offline cai nos valores padrão do pedido */
function listaNomes(lista, incluirInativos){
  const itens = state.listas && state.listas[lista];
  if(Array.isArray(itens) && itens.length){
    return itens.filter(i => !i.excluido && (incluirInativos || i.ativo !== false)).map(i => (typeof i === "string" ? i : i.nome));
  }
  return (LISTAS_PADRAO_FRONT[lista] || []).slice();
}

/* Status da OS = status de origem (importado) + sobreposição "Programada"
   enquanto existir programação ATIVA com ela. Cancelar a programação só
   deixa de aplicar a sobreposição: a OS volta pro status de origem
   (Pendente ou A reprogramar). Mesma regra do Controller (manutencao.ps1). */
function recalcularStatusOS(){
  const ativas = new Set();
  (state.programacoes||[]).forEach(p=>{
    if(p.status==="Cancelada" || p.status==="Concluída") return;
    (p.osIds||[]).forEach(id=>ativas.add(id));
  });
  (state.manutencaoOS||[]).forEach(o=>{
    // statusBase = status de origem; só existe pra OS programável (Pendente /
    // A reprogramar) — as demais (Executada, Despachada…) não mudam por aqui.
    const base = o.statusBase || o.statusOS;
    if(base!=="Pendente" && base!=="A reprogramar") return;
    o.statusBase = base;
    o.statusOS = ativas.has(o.id) ? "Programada" : base;
  });
}

/* ---- filtros / semana da aba Proteções ---- */
const PROG_CAMPOS_MULTI = ["regional","polo","equipe","status","plano","equipeNecessaria"];
function novoProgFiltro(busca){ const f = { busca: busca||"", situacao: "" }; PROG_CAMPOS_MULTI.forEach(c=>{ f[c] = new Set(); }); return f; }
let progFiltro = novoProgFiltro();
let progSemanaInicio = null;      // ISO da segunda-feira da semana exibida
let progSoSemana = false;         // lista só com a semana exibida?
/* v2.15.27 - a tabela de programações é paginada (muitas linhas deixavam a tela enorme) */
const PROG_PAG_TAM = 15;
let progPagina = 1;
let progSelecionadaId = null;     // programação em foco (grid <-> mapa)

function isoSegundaDe(dataIso){
  const d = new Date(dataIso+"T12:00:00");
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d.toISOString().slice(0,10);
}
function isoMais(dataIso, dias){
  const d = new Date(dataIso+"T12:00:00");
  d.setDate(d.getDate()+dias);
  return d.toISOString().slice(0,10);
}
function progSemanaAtual(){
  if(!progSemanaInicio) progSemanaInicio = isoSegundaDe(new Date().toISOString().slice(0,10));
  return progSemanaInicio;
}
function setProgSemana(delta){
  progPagina = 1;
  if(delta===0) progSemanaInicio = isoSegundaDe(new Date().toISOString().slice(0,10));
  else progSemanaInicio = isoMais(progSemanaAtual(), delta*7);
  render();
}
function setProgSemanaData(v){ if(v){ progPagina = 1; progSemanaInicio = isoSegundaDe(v); render(); } }
function setProgFiltro(campo, valor){ progFiltro[campo] = valor; progPagina = 1; render(); }
function toggleProgFiltro(campo, v, m){ if(m) progFiltro[campo].add(v); else progFiltro[campo].delete(v); progPagina = 1; render(); }
function limparProgFiltroCampo(campo){ progFiltro[campo] = new Set(); progPagina = 1; render(); }
PROG_CAMPOS_MULTI.forEach(c=>{
  window["toggleProgFiltro_"+c] = (v,m)=>toggleProgFiltro(c, v, m);
  window["limparProgFiltro_"+c] = ()=>limparProgFiltroCampo(c);
});
function limparProgFiltros(){
  progFiltro = novoProgFiltro();
  progSoSemana = false; progPagina = 1; render();
}
function setProgSoSemana(v){ progSoSemana = !!v; progPagina = 1; render(); }
function equipeInfo(id){ return (state.equipes||[]).find(e=>e.id===id) || null; }
/* v3.5.2 - equipe INATIVA (Gestão de Bases > Equipes > "Ativa? = Não"): não aparece na Produtividade/Visão Geral (ninguém é cobrado
   por equipe parada) e não pode receber programação nova. Sem o campo, vale como ativa. */
function equipeAtiva(e){
  if(!e) return false;
  const v = e.ativo;
  if(v === false || v === 0) return false;
  if(typeof v === "string" && /^(false|0|n[aã]o|nao|inativ[oa])$/i.test(v.trim())) return false;
  return true;
}
function equipeIdAtiva(id){ const e = equipeInfo(id); return e ? equipeAtiva(e) : true; }
function equipesAtivas(){ return (state.equipes||[]).filter(equipeAtiva); }

/* v3.5.5 - situação da programação para os números clicáveis do topo: multi | entregue | tempo | atrasada */
function progAbertasPorProt(){
  const m = new Map();
  (state.programacoes||[]).forEach(p=>{
    if(p.status==="Cancelada" || programacaoResumoOS(p).concluida || !p.protecaoId) return;
    m.set(p.protecaoId, (m.get(p.protecaoId)||0)+1);
  });
  return m;
}
function progSituacaoDe(p, multiMap){
  if(p.status==="Cancelada") return "";
  const r = programacaoResumoOS(p);
  return r.concluida ? "entregue" : (r.atrasada ? "atrasada" : "tempo");
}
function programacoesFiltradas(ignorarSituacao){
  const f = progFiltro, q = f.busca.trim().toLowerCase();
  const sit = ignorarSituacao ? "" : (f.situacao||"");
  const multiMap = sit==="multi" ? progAbertasPorProt() : null;
  const semIni = progSemanaAtual(), semFim = isoMais(semIni, 6);
  return (state.programacoes||[]).filter(p=>{
    if(sit){
      if(sit==="multi"){ if(p.status==="Cancelada" || programacaoResumoOS(p).concluida || (multiMap.get(p.protecaoId)||0) < 2) return false; }
      else if(progSituacaoDe(p) !== sit) return false;
    }
    if(f.status.size && !f.status.has(p.status)) return false;
    if(f.plano.size && !f.plano.has(p.plano||p.tipoPlano)) return false;
    if(f.equipeNecessaria.size && !f.equipeNecessaria.has(p.equipeNecessaria)) return false;
    if(f.equipe.size && !(p.equipesIds||[]).some(id=>f.equipe.has(id))) return false;
    if(f.polo.size && !(p.equipesIds||[]).some(id=>f.polo.has((equipeInfo(id)||{}).polo))) return false;
    if(f.regional.size && !(p.equipesIds||[]).some(id=>f.regional.has((equipeInfo(id)||{}).regional))) return false;
    if(progSoSemana && !(p.dataInicio<=semFim && p.dataFim>=semIni)) return false;
    if(q){
      const alvo = [p.protecaoId,p.alimentador,p.numeroSIS,(p.equipesIds||[]).join(" "),(programacaoResumoOS(p).cidades||[]).join(" ")].join(" ").toLowerCase();
      if(!alvo.includes(q)) return false;
    }
    return true;
  });
}
function progOpcoes(campoEquipe){
  return [...new Set((state.equipes||[]).map(e=>e[campoEquipe]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
}
function progFiltrosHtml(){
  const f = progFiltro;
  const sel = (campo, rotulo, opts, todos)=>multiComboHtml("p_"+campo, rotulo, opts.map(o=>({v:o,t:o})), f[campo], "toggleProgFiltro_"+campo, "limparProgFiltro_"+campo, todos||"Todos");
  const equipesComProg = [...new Set((state.programacoes||[]).flatMap(p=>p.equipesIds||[]))].sort();
  const statusOpts = [...new Set((state.programacoes||[]).map(p=>p.status).filter(Boolean))].sort();
  return `<div class="card" style="margin-bottom:14px;">
    <div class="filters" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; align-items:end;">
      <div class="field"><label>Buscar</label><input type="text" value="${escapeHtml(f.busca)}" placeholder="Proteção, alimentador, SIS, equipe…" onchange="setProgFiltro('busca', this.value)"></div>
      ${sel("regional","Regional",progOpcoes("regional"),"Todas")}
      ${sel("polo","Polo",progOpcoes("polo"))}
      ${sel("equipe","Equipe",equipesComProg)}
      ${sel("status","Status",statusOpts)}
      ${sel("plano","Plano",listaNomes("plano",true))}
      ${sel("equipeNecessaria","Equipe necessária",listaNomes("equipeNecessaria",true))}
      <button class="btn btn-ghost btn-sm" onclick="limparProgFiltros()">${ic("close")||"×"} Limpar filtros</button>
    </div>
  </div>`;
}

/* v3.5.4 - faixa de números no topo da Programação > Proteções (no lugar do aviso de "conflitos de equipe").
   Conta PROGRAMAÇÕES (as linhas da lista), respeitando os filtros da tela; cancelada não entra. A situação segue o que a lista mostra:
   Entregue = Concluída; Atrasada = selo "Atrasada" da linha (data fim passou e ainda há OS sem atendimento); Em tempo = o resto. */
function progResumo(lista){
  const vivas = lista.filter(p=>p.status!=="Cancelada");
  let entregues = 0, atrasadas = 0, noPrazo = 0;
  vivas.forEach(p=>{
    const r = programacaoResumoOS(p);
    if(r.concluida) entregues++; else if(r.atrasada) atrasadas++; else noPrazo++;
  });
  // proteção com mais de uma programação ABERTA (olha todas as programações, não só as filtradas; conta as proteções que estão na lista)
  const abertasPorProt = new Map();
  (state.programacoes||[]).forEach(p=>{
    if(p.status==="Cancelada" || programacaoResumoOS(p).concluida || !p.protecaoId) return;
    abertasPorProt.set(p.protecaoId, (abertasPorProt.get(p.protecaoId)||0)+1);
  });
  const naLista = new Set(vivas.map(p=>p.protecaoId));
  let multi = 0; naLista.forEach(pr=>{ if((abertasPorProt.get(pr)||0) > 1) multi++; });
  return { total:vivas.length, entregues, noPrazo, atrasadas, multi };
}
function progResumoHtml(lista){
  const r = progResumo(lista), atual = progFiltro.situacao || "";
  const k = (chave, rot, n, cor, dica)=>`<button type="button" class="po-kpi ${chave && atual===chave?"ativo":""}" onclick="setProgFiltro('situacao','${atual===chave?"":chave}')" title="${dica} Clique para filtrar a lista."><span class="po-kpi-n" style="color:${cor};">${Number(n).toLocaleString("pt-BR")}</span><span class="po-kpi-l">${rot}</span></button>`;
  return `<div class="po-kpis">
    ${k("", "Programadas", r.total, "var(--text)", "Programações no filtro (as canceladas não entram).")}
    ${k("multi", "Proteções com mais de uma programação", r.multi, r.multi?"var(--warn-fg)":"var(--text)", "Proteções que têm mais de uma programação ainda aberta (não concluída nem cancelada). Ao filtrar, a lista mostra essas programações.")}
    ${k("entregue", "Entregues", r.entregues, "var(--ok-fg)", "Programações concluídas.")}
    ${k("tempo", "Em tempo", r.noPrazo, "var(--info-fg)", "Programações abertas cuja data fim ainda não passou.")}
    ${k("atrasada", "Atrasadas", r.atrasadas, "var(--bad-fg)", "Programações com data fim vencida e OS ainda sem atendimento (o selo Atrasada da lista).")}
  </div>`;
}

function viewProgramacaoProtecoes(){
  const lista = programacoesFiltradas();
  return `
  ${progResumoHtml(programacoesFiltradas(true))}

  ${progFiltrosHtml()}

  <div class="card-head" style="margin-bottom:12px;">
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <h3 style="margin:0;">${lista.length} programação(ões) no filtro</h3>
      <label class="check-row" style="margin:0;"><input type="checkbox" ${progSoSemana?"checked":""} onchange="setProgSoSemana(this.checked)"> só a semana do calendário</label>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      ${souAdministrador() && API_ONLINE ? `<button class="btn btn-ghost btn-sm" onclick="pedirZerarProgramacoes()" title="Só administrador: apaga todas as programações (com cópia de segurança)">${ic("close")} Zerar programações</button>` : ""}
      <button class="btn btn-ghost btn-sm" onclick="exportarProgramacoesXlsx()" title="Baixa em Excel todas as programações do filtro atual (não só a página)">${ic("download")} Excel (.xlsx)</button>
      ${progPodeCriar() ? `<button class="btn btn-primary" onclick="openProgramacaoModal()">${ic("plus")} Nova programação</button>` : ""}
    </div>
  </div>

  <div class="card">
    <div class="table-wrap"><table>
      <thead><tr><th>Status</th><th>Proteção</th><th>Alimentador</th><th>Cidade</th><th>Datas</th><th>Equipe(s)</th><th>Plano</th><th>Equipe necessária</th><th>Prev. / Real.</th><th>SIS</th><th></th></tr></thead>
      <tbody id="progRows">${programacaoRowsHtml()}</tbody>
    </table></div>
    <div id="progPager">${progPagerHtml()}</div>
  </div>

  <div class="card" style="margin-top:14px;">
    <div class="card-head">
      <h3>Calendário — semana de ${fmtDate(progSemanaAtual())} a ${fmtDate(isoMais(progSemanaAtual(),6))}</h3>
      <div style="display:flex; align-items:center; gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="setProgSemana(-1)" title="Semana anterior">‹</button>
        <button class="btn btn-ghost btn-sm" onclick="setProgSemana(0)">Hoje</button>
        <button class="btn btn-ghost btn-sm" onclick="setProgSemana(1)" title="Próxima semana">›</button>
        <input type="date" value="${progSemanaAtual()}" onchange="setProgSemanaData(this.value)" title="Ir para a semana de…" style="font-size:12px; padding:5px 8px;">
        <button class="btn btn-ghost btn-sm" onclick="exportarCalendarioXlsx()" title="Baixa o calendário da semana em Excel (aba Calendário e aba Lista, pronta para filtrar)">${ic("download")} Excel</button>
        <button class="btn btn-ghost btn-sm" onclick="exportarCalendarioPdf()" title="Gera um PDF com TODAS as equipes programadas na semana, uma embaixo da outra (escolha Salvar como PDF)">${ic("download")} PDF</button>
      </div>
    </div>
    ${renderCalendario()}
  </div>

  <div class="card" style="margin-top:14px;">
    <h3>Visão logística — OS programadas e bases das equipes</h3>
    <div id="mapaLogistica" class="leaflet-map"></div>
    <p id="mapaLogisticaInfo" style="color:var(--muted); font-size:12.5px; margin-top:8px;">Círculos = OS das programações do filtro (cor = status da programação). Clique numa linha da tabela ou num círculo para destacar a programação nos dois. Quadrados = base das equipes; a linha tracejada é a distância em linha reta até a programação selecionada.</p>
  </div>
  `;
}
/* Resumo das OS vinculadas a uma Programação — cidade(s), previsto/realizado
   somados e se está "atrasada" (passou da data-fim e ainda tem OS vinculada
   que não foi Executada — é o sinal de alerta que o dia-seguinte de
   reconciliação, quando ligado ao Controller, vai acender de verdade). */
function programacaoResumoOS(p){
  const os = osDaProgramacao(p);
  const cidades = [...new Set(os.map(o=>o.localidade||o.conjunto).filter(Boolean))];
  const previsto = os.reduce((s,o)=>s+qtdOS(o,"prev"), 0);
  const realizado = os.reduce((s,o)=>s+realizadoOS(o), 0);
  const hoje = new Date().toISOString().slice(0,10);
  const pendentes = os.filter(o=>!osAtendida(o)).length;
  const atrasada = p.status!=="Cancelada" && p.status!=="Concluída" && p.dataFim < hoje && pendentes > 0;
  const concluida = p.status==="Concluída" || (p.status!=="Cancelada" && os.length>0 && pendentes===0);
  return { os, cidades, previsto, realizado, atrasada, pendentes, concluida };
}
/* v2.15.29 - zera SÓ as programações (teste de carga); o servidor guarda uma cópia em model/programacao_backup_*.json */
function pedirZerarProgramacoes(){
  if(!souAdministrador()) return;
  const n = (state.programacoes||[]).length;
  openModal(`
    <h2>Zerar programações?</h2>
    <p style="font-size:13px;">Isso apaga <strong>todas as ${n.toLocaleString("pt-BR")} programação(ões)</strong>. Equipes, Vão, Proteção, OS e as demais bases <strong>não</strong> são tocadas. O servidor guarda uma cópia de segurança em <code>model/programacao_backup_…json</code>.</p>
    <div class="field"><label>Digite APAGAR para liberar o botão</label><input id="zerarProgTxt" type="text" autocomplete="off" oninput="document.getElementById('zerarProgBtn').disabled = this.value.trim().toUpperCase()!=='APAGAR'"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="zerarProgBtn" disabled onclick="zerarProgramacoes()">Zerar programações</button>
    </div>`);
}
async function zerarProgramacoes(){
  const btn = document.getElementById("zerarProgBtn"); if(btn) btn.disabled = true;
  try{
    const r = await apiPost("/programacao/zerar", { confirmar:"APAGAR" }, 120000);
    state.programacoes = []; progPagina = 1; progSelecionadaId = null;
    recalcularStatusOS();   // as OS que estavam "Programada" só por causa dessas programações voltam a Pendente / A reprogramar
    closeModal(); render();
    toast(`${Number(r.apagadas||0).toLocaleString("pt-BR")} programação(ões) apagada(s)${r.backup ? " · cópia: "+r.backup : ""}`);
  }catch(err){ if(btn) btn.disabled = false; toast("Não consegui zerar: " + err.message); }
}
function progTotalPaginas(){ return Math.max(1, Math.ceil(programacoesFiltradas().length / PROG_PAG_TAM)); }
function progPagerHtml(){
  const total = programacoesFiltradas().length, pags = progTotalPaginas();
  if(progPagina > pags) progPagina = pags;
  if(total <= PROG_PAG_TAM) return "";
  const ini = (progPagina-1)*PROG_PAG_TAM + 1, fim = Math.min(total, progPagina*PROG_PAG_TAM);
  return `<div class="pager" style="display:flex; align-items:center; justify-content:space-between; padding:10px 4px 2px;">
    <span style="color:var(--muted); font-size:12px;">${ini}–${fim} de ${total} · página ${progPagina} de ${pags}</span>
    <div style="display:flex; gap:6px;">
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="progIrPagina(1)" ${progPagina<=1?"disabled":""} title="Primeira">«</button>
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="progIrPagina(progPagina-1)" ${progPagina<=1?"disabled":""}>‹</button>
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="progIrPagina(progPagina+1)" ${progPagina>=pags?"disabled":""}>›</button>
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="progIrPagina(${pags})" ${progPagina>=pags?"disabled":""} title="Última">»</button>
    </div>
  </div>`;
}
/* troca de página sem re-renderizar a tela (o mapa e o calendário não piscam) */
function progIrPagina(n){
  progPagina = Math.max(1, Math.min(progTotalPaginas(), Number(n)||1));
  const tb = document.getElementById("progRows"), pg = document.getElementById("progPager");
  if(tb) tb.innerHTML = programacaoRowsHtml();
  if(pg) pg.innerHTML = progPagerHtml();
}

/* =========================================================================
   v3.1.3 - ABA "PROGRAMAÇÃO POR OSs": uma linha por OS programada (para o coordenador ver a
   aderência ao plano). Situação da OS dentro da programação:
     Concluída        = atendida (OS Executada apontando para ela) até a data fim da programação
     Concluída c/ atraso = atendida depois da data fim
     Atrasada         = a data fim já passou e a OS continua sem atendimento
     Programada       = ainda dentro do prazo
   Usa as cópias guardadas na programação quando a OS já saiu da base. Programação cancelada não entra.
   ========================================================================= */
let poFiltro = { busca:"", situacao:"", equipe:"", regional:"", polo:"", de:"", ate:"" };
let poPagina = 1;
const PO_TAM = 25;
const PO_SITUACOES = [["atrasada","Atrasada","bad"],["programada","Programada (no prazo)","info"],["concluida_atraso","Concluída com atraso","warn"],["concluida","Concluída no prazo","ok"]];
let _poSig = null, _poRes = null;
function poDiasEntre(a, b){ return Math.round((new Date(b+"T12:00:00") - new Date(a+"T12:00:00"))/86400000); }
function poLinhas(){
  const sig = progAssinatura() + "|" + new Date().toISOString().slice(0,10);
  if(_poSig===sig && _poRes) return _poRes;
  const hoje = new Date().toISOString().slice(0,10);
  const out = [];
  (state.programacoes||[]).forEach(p=>{
    if(p.status==="Cancelada" || !p.dataFim) return;
    const equipes = (p.equipesIds||[]);
    const polos = new Set(), regionais = new Set();
    equipes.forEach(id=>{ const e = equipeInfo(id); if(e){ if(e.polo) polos.add(e.polo); if(e.regional) regionais.add(e.regional); } });
    (p.osIds||[]).forEach(id=>{
      const o = osPorId(id);
      const lista = o ? [o] : (execPorPrimaria().get(String(id).trim()) || []);
      if(!lista.length){
        out.push({ osId:String(id), o:null, p, equipes, polos, regionais, situacao:(p.dataFim<hoje?"atrasada":"programada"), dias:(p.dataFim<hoje?poDiasEntre(p.dataFim,hoje):0), prev:0, real:0, exec:"", tipo:"", cidade:p.localidade||"" });
        return;
      }
      lista.forEach(x=>{
        const atendida = osAtendida(x);
        let exec = "";
        if(atendida){
          const filhas = execPorPrimaria().get(String(x.id).trim()) || [];
          const datas = filhas.map(f=>f.dataExecucao).filter(Boolean);
          if(x.statusOS==="Executada" && x.dataExecucao) datas.push(x.dataExecucao);
          exec = datas.length ? datas.sort().slice(-1)[0] : "";
        }
        let situacao, dias = 0;
        if(atendida){
          if(exec && exec > p.dataFim){ situacao = "concluida_atraso"; dias = poDiasEntre(p.dataFim, exec); }
          else situacao = "concluida";
        } else if(p.dataFim < hoje){ situacao = "atrasada"; dias = poDiasEntre(p.dataFim, hoje); }
        else situacao = "programada";
        out.push({ osId:String(x.id), o:x, p, equipes, polos, regionais, situacao, dias, prev:qtdOS(x,"prev"), real:realizadoOS(x), exec, tipo:servicoTextoOS(x), cidade:x.localidade||x.conjunto||p.localidade||"" });
      });
    });
  });
  const rank = { atrasada:0, programada:1, concluida_atraso:2, concluida:3 };
  out.sort((a,b)=> rank[a.situacao]-rank[b.situacao] || (a.situacao==="atrasada" ? b.dias-a.dias : (a.situacao==="programada" ? a.p.dataFim.localeCompare(b.p.dataFim) : b.p.dataFim.localeCompare(a.p.dataFim))) || a.osId.localeCompare(b.osId));
  _poSig = sig; _poRes = out;
  return out;
}
function poAtrasadasQtd(){ try{ return poLinhas().filter(r=>r.situacao==="atrasada").length; }catch(e){ return 0; } }
function poFiltradas(ignorarSituacao){
  const f = poFiltro, q = f.busca.trim().toLowerCase();
  return poLinhas().filter(r=>{
    if(!ignorarSituacao && f.situacao && r.situacao!==f.situacao) return false;
    if(f.equipe && !r.equipes.includes(f.equipe)) return false;
    if(f.polo && !r.polos.has(f.polo)) return false;
    if(f.regional && !r.regionais.has(f.regional)) return false;
    if(f.de && r.p.dataFim < f.de) return false;
    if(f.ate && r.p.dataInicio > f.ate) return false;
    if(q){
      const alvo = [r.osId, r.p.protecaoId, r.p.alimentador, r.p.numeroSIS, r.equipes.join(" "), r.cidade].join(" ").toLowerCase();
      if(!alvo.includes(q)) return false;
    }
    return true;
  });
}
function setPoFiltro(campo, valor){ poFiltro[campo] = valor; poPagina = 1; render(); }
function limparPoFiltros(){ poFiltro = { busca:"", situacao:"", equipe:"", regional:"", polo:"", de:"", ate:"" }; poPagina = 1; render(); }
function poIrPagina(n){ poPagina = Math.max(1, Math.min(Math.max(1, Math.ceil(poFiltradas().length/PO_TAM)), Number(n)||1)); render(); }
function poPillSituacao(r){
  const s = PO_SITUACOES.find(x=>x[0]===r.situacao) || PO_SITUACOES[1];
  const extra = r.situacao==="atrasada" ? ` · ${r.dias} dia${r.dias>1?"s":""}` : (r.situacao==="concluida_atraso" ? ` · +${r.dias} dia${r.dias>1?"s":""}` : "");
  return `<span class="pill ${s[2]}"><span class="dot" style="background:currentColor"></span>${escapeHtml(s[1].replace(" (no prazo)",""))}${extra}</span>`;
}
function viewProgramacaoPorOS(){
  const base = poFiltradas(true), lista = poFiltradas(false);
  const cont = { atrasada:0, programada:0, concluida_atraso:0, concluida:0 };
  base.forEach(r=>{ cont[r.situacao]++; });
  const vencidas = cont.concluida + cont.concluida_atraso + cont.atrasada;
  const pctPrazo = vencidas ? Math.round(cont.concluida/vencidas*100) : null;
  const pags = Math.max(1, Math.ceil(lista.length/PO_TAM));
  if(poPagina > pags) poPagina = pags;
  const pag = lista.slice((poPagina-1)*PO_TAM, poPagina*PO_TAM);
  const sel = (campo, rotulo, opts)=>`<div class="field"><label>${rotulo}</label><select onchange="setPoFiltro('${campo}', this.value)"><option value="">Todos</option>${opts.map(o=>`<option value="${escapeHtml(o)}" ${poFiltro[campo]===o?"selected":""}>${escapeHtml(o)}</option>`).join("")}</select></div>`;
  const equipesComProg = [...new Set((state.programacoes||[]).filter(p=>p.status!=="Cancelada").flatMap(p=>p.equipesIds||[]))].sort();
  const kpi = (chave, rotulo, valor, cor)=>`<button type="button" class="po-kpi ${chave && poFiltro.situacao===chave?"ativo":""}" onclick="setPoFiltro('situacao','${poFiltro.situacao===chave?"":chave}')" title="Clique para filtrar"><span class="po-kpi-n" style="color:${cor};">${valor.toLocaleString("pt-BR")}</span><span class="po-kpi-l">${rotulo}</span></button>`;
  return `
  <div class="po-kpis">
    ${kpi("", "OS programadas", base.length, "var(--text)")}
    ${kpi("atrasada", "Atrasadas", cont.atrasada, "var(--bad-fg)")}
    ${kpi("programada", "Programadas (no prazo)", cont.programada, "var(--info-fg)")}
    ${kpi("concluida_atraso", "Concluídas com atraso", cont.concluida_atraso, "var(--warn-fg)")}
    ${kpi("concluida", "Concluídas no prazo", cont.concluida, "var(--ok-fg)")}
    <div class="po-kpi po-kpi-info" title="Concluídas no prazo ÷ (concluídas + atrasadas): só conta OS cujo prazo já venceu"><span class="po-kpi-n">${pctPrazo===null?"—":pctPrazo+"%"}</span><span class="po-kpi-l">Cumprimento do prazo</span></div>
  </div>
  <div class="card" style="margin-bottom:14px;">
    <div class="filters" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; align-items:end;">
      <div class="field"><label>Buscar</label><input type="text" value="${escapeHtml(poFiltro.busca)}" placeholder="OS, proteção, alimentador, equipe…" onchange="setPoFiltro('busca', this.value)"></div>
      ${sel("regional","Regional",progOpcoes("regional"))}
      ${sel("polo","Polo",progOpcoes("polo"))}
      ${sel("equipe","Equipe",equipesComProg)}
      <div class="field"><label>Prazo de</label><input type="date" value="${escapeHtml(poFiltro.de)}" onchange="setPoFiltro('de', this.value)"></div>
      <div class="field"><label>até</label><input type="date" value="${escapeHtml(poFiltro.ate)}" onchange="setPoFiltro('ate', this.value)"></div>
      <button class="btn btn-ghost btn-sm" onclick="limparPoFiltros()">${ic("close")||"×"} Limpar filtros</button>
    </div>
  </div>
  <div class="card-head" style="margin-bottom:12px;">
    <h3 style="margin:0;">${lista.length.toLocaleString("pt-BR")} OS no filtro</h3>
    <button class="btn btn-ghost btn-sm" onclick="exportarProgramacaoPorOSXlsx()" title="Baixa em Excel todas as OS do filtro atual (não só a página)">${ic("download")} Excel (.xlsx)</button>
  </div>
  <div class="card">
    <div class="table-wrap"><table>
      <thead><tr><th>Situação</th><th>OS</th><th>Serviço</th><th>Cidade</th><th>Proteção</th><th>Equipe(s)</th><th>Prazo da programação</th><th>Prev. / Real.</th><th>Atendida em</th></tr></thead>
      <tbody>${pag.length===0 ? `<tr><td colspan="9" style="text-align:center; color:var(--muted); padding:24px;">Nenhuma OS programada no filtro atual.</td></tr>` : pag.map(r=>`
        <tr class="os-row" style="cursor:pointer;" onclick="abrirDetalheProgramacao('${r.p.id}')" title="Clique para ver a programação">
          <td style="white-space:nowrap;">${poPillSituacao(r)}</td>
          <td class="mono">${escapeHtml(r.osId)}</td>
          <td>${escapeHtml(r.tipo||"—")}</td>
          <td>${escapeHtml(r.cidade||"—")}</td>
          <td class="mono">${escapeHtml(r.p.protecaoId||"")}</td>
          <td>${escapeHtml(r.equipes.join(", "))}</td>
          <td style="white-space:nowrap;">${fmtDate(r.p.dataInicio)}${r.p.dataInicio!==r.p.dataFim?" – "+fmtDate(r.p.dataFim):""}</td>
          <td class="mono" style="white-space:nowrap;">${r.prev} / ${r.real}</td>
          <td>${r.exec ? fmtDate(r.exec) : `<span style="color:var(--muted);">—</span>`}</td>
        </tr>`).join("")}</tbody>
    </table></div>
    ${lista.length>PO_TAM ? `<div class="pager" style="display:flex; align-items:center; justify-content:space-between; padding:10px 4px 2px;">
      <span style="color:var(--muted); font-size:12px;">${(poPagina-1)*PO_TAM+1}–${Math.min(lista.length, poPagina*PO_TAM)} de ${lista.length.toLocaleString("pt-BR")} · página ${poPagina} de ${pags}</span>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="poIrPagina(1)" ${poPagina<=1?"disabled":""}>«</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="poIrPagina(poPagina-1)" ${poPagina<=1?"disabled":""}>‹</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="poIrPagina(poPagina+1)" ${poPagina>=pags?"disabled":""}>›</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="poIrPagina(${pags})" ${poPagina>=pags?"disabled":""}>»</button>
      </div></div>` : ""}
  </div>
  <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">Uma OS que está em mais de uma programação (reprogramada) aparece uma vez para cada programação. Programações canceladas não entram.</p>`;
}
function exportarProgramacaoPorOSXlsx(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const lista = poFiltradas(false);
  if(!lista.length){ toast("Nenhuma OS no filtro atual para exportar."); return; }
  const nomes = Object.fromEntries(PO_SITUACOES.map(s=>[s[0], s[1]]));
  const linhas = lista.map(r=>({
    "Situação": nomes[r.situacao], "Dias de atraso": r.dias||"", "OS": r.osId, "Serviço": r.tipo, "Cidade": r.cidade,
    "Proteção": r.p.protecaoId||"", "Alimentador": r.p.alimentador||"", "Equipe(s)": r.equipes.join(", "),
    "Início": fmtDate(r.p.dataInicio), "Prazo (data fim)": fmtDate(r.p.dataFim), "Status da programação": r.p.status||"",
    "Previsto": r.prev, "Realizado": r.real, "Atendida em": r.exec ? fmtDate(r.exec) : "", "SIS": r.p.numeroSIS||""
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [{wch:22},{wch:9},{wch:14},{wch:14},{wch:22},{wch:14},{wch:14},{wch:18},{wch:11},{wch:14},{wch:14},{wch:9},{wch:9},{wch:12},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "OS programadas");
  XLSX.writeFile(wb, `programacao_por_os_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`${lista.length.toLocaleString("pt-BR")} OS exportada(s) para Excel.`);
}
/* v3.1.0 - clicar no status abre os mesmos dados do cartão da Programação por equipe (1ª equipe, 1º dia) */
function abrirDetalheProgramacao(id){
  const p = (state.programacoes||[]).find(x=>x.id===id);
  if(!p) return;
  if(p.status==="Cancelada"){ toast("Programação cancelada: sem detalhe para mostrar."); return; }
  const eq = (p.equipesIds||[])[0];
  if(!eq || !p.dataInicio){ toast("Esta programação não tem equipe ou data para mostrar o detalhe."); return; }
  abrirDetalheLogProgramacao(`prot_${p.id}_${eq}_${p.dataInicio}`);
}
/* v3.1.0 - Excel com TODAS as programações do filtro atual (aba 1: uma linha por programação; aba 2: uma linha por OS) */
function exportarProgramacoesXlsx(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const lista = programacoesFiltradas();
  if(lista.length===0){ toast("Nenhuma programação no filtro atual para exportar."); return; }
  const linhas = [], osLinhas = [];
  lista.forEach(p=>{
    const r = programacaoResumoOS(p);
    const equipes = (p.equipesIds||[]).join(", ");
    const periodo = fmtDate(p.dataInicio) + (p.dataInicio!==p.dataFim ? " a "+fmtDate(p.dataFim) : "");
    linhas.push({
      "Status": p.status||"", "Atrasada": r.atrasada ? "Sim" : "", "Proteção": p.protecaoId||"", "Alimentador": p.alimentador||"",
      "Cidade": r.cidades.join(", "), "Data início": fmtDate(p.dataInicio), "Data fim": fmtDate(p.dataFim), "Equipe(s)": equipes,
      "Plano": p.plano||p.tipoPlano||"", "Equipe necessária": p.equipeNecessaria||"", "SIS": p.numeroSIS||"",
      "Qtd. OS": r.os.length, "OS pendentes": r.pendentes, "Previsto": r.previsto, "Realizado": r.realizado,
      "OS": r.os.map(o=>o.id).join(", "), "Observação": p.observacao||""
    });
    r.os.forEach(o=>{
      osLinhas.push({
        "Proteção": p.protecaoId||"", "Equipe(s)": equipes, "Período": periodo, "Status da programação": p.status||"",
        "OS": o.id, "Alimentador": o.alimentador||p.alimentador||"", "Tipo": servicoTextoOS(o), "Localidade": o.localidade||o.conjunto||"",
        "Situação da OS": osAtendida(o) ? "Atendida" : "Pendente", "Previsto": qtdTextoOS(o,"prev"), "Realizado": qtdTextoOS(o,"real",realizadoOS),
        "Latitude": o.lat!=null?o.lat:"", "Longitude": o.lng!=null?o.lng:""
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [{wch:11},{wch:9},{wch:14},{wch:14},{wch:22},{wch:11},{wch:11},{wch:18},{wch:18},{wch:18},{wch:12},{wch:8},{wch:11},{wch:9},{wch:9},{wch:40},{wch:36}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Programações");
  if(osLinhas.length){
    const wo = XLSX.utils.json_to_sheet(osLinhas);
    wo["!cols"] = [{wch:14},{wch:18},{wch:22},{wch:14},{wch:14},{wch:12},{wch:22},{wch:12},{wch:9},{wch:9},{wch:11},{wch:11}];
    XLSX.utils.book_append_sheet(wb, wo, "OS por programação");
  }
  XLSX.writeFile(wb, `programacoes_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`${lista.length} programação(ões) exportada(s) para Excel.`);
}
function programacaoRowsHtml(){
  const todas = programacoesFiltradas();
  if(todas.length===0) return `<tr><td colspan="11" style="text-align:center; color:var(--muted); padding:24px;">Nenhuma programação no filtro atual.</td></tr>`;
  const pags = Math.max(1, Math.ceil(todas.length / PROG_PAG_TAM));
  if(progPagina > pags) progPagina = pags;
  const lista = todas.slice((progPagina-1)*PROG_PAG_TAM, progPagina*PROG_PAG_TAM);
  return lista.map(p=>{
    const r = programacaoResumoOS(p);
    const ativa = p.status!=="Cancelada" && p.status!=="Concluída";
    const env = envioInfo(p), selo = envioSeloHtml(p);
    const confirmadaEm = envioConfirmadas.get(p), recemConfirmada = !!confirmadaEm && (Date.now()-confirmadaEm) < 2500;
    const statusHtml = (selo && env.criando) ? selo
      : (selo ? `${statusPill(p.status)} ${selo}` : statusPill(p.status));
    return `
    <tr class="os-row ${p.id===progSelecionadaId?'os-row-selected':''} ${env&&env.estado==='enviando'?'envio-linha':''} ${recemConfirmada?'envio-ok-linha':''}" data-prog="${p.id}" onclick="selecionarProgramacao('${p.id}')" style="cursor:pointer; ${p.status==='Cancelada'?'opacity:.6;':''}">
      <td onclick="event.stopPropagation(); abrirDetalheProgramacao('${p.id}')" style="cursor:pointer;" title="Clique para ver os dados e as OS da programação">${statusHtml}${r.atrasada && !(env&&env.criando)?` <span class="pill bad">${ic("warn")} Atrasada</span>`:``}</td>
      <td class="mono">${escapeHtml(p.protecaoId)}</td>
      <td class="mono">${escapeHtml(p.alimentador)}</td>
      <td>${r.cidades.length ? escapeHtml(r.cidades.join(", ")) : `<span style="color:var(--muted);">—</span>`}</td>
      <td>${fmtDate(p.dataInicio)}${p.dataInicio!==p.dataFim? " – "+fmtDate(p.dataFim):""}</td>
      <td>${escapeHtml((p.equipesIds||[]).join(", "))}</td>
      <td>${p.plano||p.tipoPlano ? escapeHtml(p.plano||p.tipoPlano) : `<span style="color:var(--muted);">—</span>`}</td>
      <td>${p.equipeNecessaria ? `<span class="pill info">${escapeHtml(p.equipeNecessaria)}</span>` : (p.desligamento ? `<span class="pill ${p.desligamento==='DS'?'bad':'info'}">${p.desligamento==='DS'?'LM - DESLIGAMENTO':'LINHA VIVA'}</span>` : "—")}</td>
      <td class="mono" style="white-space:nowrap;">${r.os.length ? `${r.previsto} / ${r.realizado}` : "—"}</td>
      <td class="mono">${escapeHtml(p.numeroSIS||"")}</td>
      <td style="white-space:nowrap;" onclick="event.stopPropagation()">
        ${!progPodeEditar() && !progPodeExcluir() ? "" : env && env.estado==="falhou"
          ? `<button class="btn btn-primary btn-sm" onclick="envioTentarDeNovo('${p.id}')">Tentar de novo</button> <button class="btn btn-ghost btn-sm" onclick="envioDescartar('${p.id}')">Descartar</button>`
          : (p.status==="Cancelada"
            ? (progPodeExcluir() ? `<button class="btn btn-primary btn-sm" ${env?"disabled":""} title="Volta a programação para Programada, do jeito que estava" onclick="reprogramarProgramacao('${p.id}')">Reprogramar</button>` : "")
            : (progPodeEditar() ? `<button class="btn btn-ghost btn-sm" ${env?"disabled":""} onclick="openProgramacaoModal('${p.id}')">Editar</button>` : ""))
          + (ativa && progPodeExcluir() ? ` <button class="btn btn-danger btn-sm" ${env?"disabled":""} onclick="cancelarProgramacao('${p.id}')">Cancelar</button>` : ``)}
      </td>
    </tr>`;
  }).join("");
}
/* =========================================================================
   v2.15.15 - ENVIO "OTIMISTA" DA PROGRAMAÇÃO
   Quem programa não precisa perceber a concorrência de gravação: a programação
   aparece na hora na tela com o selo "Enviando" e o SPARK envia ao Controller
   em segundo plano, em fila (uma por vez, na ordem). Se o arquivo estiver
   ocupado por outro usuário (erro 5xx, timeout, rede), tenta de novo sozinho
   (1, 2, 3, 4, 5 e 5 s = ~20 s, 7 tentativas no total). Só mostra "Não enviada" (com Tentar de
   novo / Descartar) se desistir ou se o Controller recusar (4xx). O id é um
   GUID criado aqui, então reenviar nunca duplica (o Controller reconhece).
   ========================================================================= */
const filaEnvio = [];                 // { p, tipo:'criar'|'editar'|'status', metodo, pathFn, corpo, desfazer, aoConcluir, tent }
const envioFalhas = new Map();        // p -> { jobs:[...], erro }
const envioConfirmadas = new Map();   // p -> instante em que o Controller confirmou (para o brilho da linha)
let filaEnvioRodando = false;
const ENVIO_ESPERAS_MS = [1000, 2000, 3000, 4000, 5000, 5000];   // 6 novas tentativas, ~20 s de espera no total
function envioInfo(p){
  const f = envioFalhas.get(p);
  if(f) return { estado:"falhou", erro:f.erro, criando: f.jobs.some(x=>x.tipo==="criar") };
  const j = filaEnvio.find(x=>x.p===p);
  if(!j) return null;
  return { estado:"enviando", tent:j.tent||0, criando: filaEnvio.some(x=>x.p===p && x.tipo==="criar") };
}
function enviarProgramacao(job){
  if(!API_ONLINE) return;               // sem Controller: fica só local, como sempre foi
  job.tent = 0;
  filaEnvio.push(job);
  processarFilaEnvio();
}
function envioErroDefinitivo(err){
  const m = String((err && err.message) || "").match(/->\s*(\d{3})/);
  if(!m) return false;                  // sem resposta (rede/timeout): tenta de novo
  const s = +m[1];
  return s>=400 && s<500 && s!==408 && s!==429;
}
function envioMensagemErro(err){
  const msg = String((err && err.message) || "");
  const m = msg.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : (msg || "erro desconhecido");
}
async function processarFilaEnvio(){
  if(filaEnvioRodando) return;
  filaEnvioRodando = true;
  try{
    while(filaEnvio.length){
      const job = filaEnvio[0];
      let resp = null, erro = null;
      try{ resp = await apiSend(job.metodo, job.pathFn(), job.corpo); }catch(e){ erro = e; }
      if(!erro){
        filaEnvio.shift();
        try{ if(job.aoConcluir) job.aoConcluir(resp); }catch(e){ console.warn("[SPARK] aoConcluir:", e); }
        if(!filaEnvio.some(x=>x.p===job.p)) envioConfirmadas.set(job.p, Date.now());
        render();
        continue;
      }
      if(!envioErroDefinitivo(erro) && job.tent < ENVIO_ESPERAS_MS.length){
        const espera = ENVIO_ESPERAS_MS[job.tent];
        job.tent++;
        render();                       // atualiza "tentativa N"
        await new Promise(r=>setTimeout(r, espera));
        continue;
      }
      // desistiu: tira da fila tudo o que era dessa programação e guarda para "Tentar de novo"
      const jobs = filaEnvio.filter(x=>x.p===job.p);
      for(let i=filaEnvio.length-1;i>=0;i--) if(filaEnvio[i].p===job.p) filaEnvio.splice(i,1);
      envioFalhas.set(job.p, { jobs, erro: envioMensagemErro(erro) });
      console.warn("[SPARK] Envio da programação falhou:", erro && erro.message);
      toast("Uma programação não foi enviada — veja \"Tentar de novo\" na linha dela.");
      render();
    }
  } finally { filaEnvioRodando = false; }
}
function envioTentarDeNovo(id){
  const p = state.programacoes.find(x=>x.id===id);
  const f = p && envioFalhas.get(p);
  if(!f) return;
  envioFalhas.delete(p);
  f.jobs.forEach(j=>{ j.tent = 0; filaEnvio.push(j); });
  render();
  processarFilaEnvio();
}
function envioDescartar(id){
  const p = state.programacoes.find(x=>x.id===id);
  const f = p && envioFalhas.get(p);
  if(!f) return;
  f.jobs.slice().reverse().forEach(j=>{ try{ if(j.desfazer) j.desfazer(); }catch(e){} });
  envioFalhas.delete(p);
  recalcularStatusOS();
  toast("Alteração descartada.");
  render();
}
window.addEventListener("beforeunload", e=>{ if(filaEnvio.length){ e.preventDefault(); e.returnValue = ""; } });
/* selo da coluna Status: "Enviando" (brilho passando), "Salvando" nas edições, "Não enviada" na falha */
function envioSeloHtml(p){
  const e = envioInfo(p);
  if(!e) return null;
  if(e.estado==="falhou") return `<span class="pill bad envio-falha" title="${escapeHtml(e.erro)}">${ic("warn")} Não enviada</span>`;
  const dica = e.tent>0 ? "Outro usuário está gravando agora — o SPARK tenta de novo sozinho, você não precisa fazer nada." : "Enviando para o Controller…";
  const rot = e.criando ? "Enviando" : "Salvando";
  return `<span class="pill envio" title="${dica}"><span class="dot"></span>${rot}${e.tent>0?` <span class="envio-tent">· tentativa ${e.tent+1}</span>`:""}</span>`;
}
function cancelarProgramacao(id){
  if(!progPodeExcluir()){ toast("Sem permissão para cancelar programação."); return; }
  const p = state.programacoes.find(x=>x.id===id);
  if(!p) return;
  const statusAntes = p.status;
  p.status = "Cancelada";
  enviarProgramacao({ p, tipo:"status", metodo:"PATCH", pathFn:()=>`/programacao/${p.id}/status`, corpo:{ status:"Cancelada" }, desfazer:()=>{ p.status = statusAntes; } });
  // OS vinculadas voltam ao status de origem (Pendente / A reprogramar)
  recalcularStatusOS();
  toast("Programação cancelada — nada foi excluído; as OS dela voltaram ao status anterior.");
  render();
}
// v2.15.6 - programação CANCELADA tem o botão "Reprogramar": só desfaz o cancelamento
// (volta a "Programada", com os mesmos dados). Quem quiser mudar data/equipe usa o Editar
// depois. Nada é recriado; as OS dela voltam a ficar vinculadas.
function reprogramarProgramacao(id){
  if(!progPodeExcluir()){ toast("Sem permissão para reprogramar."); return; }
  const p = state.programacoes.find(x=>x.id===id);
  if(!p || p.status!=="Cancelada") return;
  const statusAntes = p.status;
  p.status = "Programada";
  enviarProgramacao({ p, tipo:"status", metodo:"PATCH", pathFn:()=>`/programacao/${p.id}/status`, corpo:{ status:"Programada" }, desfazer:()=>{ p.status = statusAntes; } });
  recalcularStatusOS();
  toast("Programação reprogramada — voltou para Programada. Se precisar mudar data ou equipe, use Editar.");
  render();
}
/* v3.2.0 - PDF do calendario da semana: TODAS as equipes programadas, uma embaixo da outra (sem a rolagem da tela) */
/* v3.2.3 - Excel do calendário da semana: aba "Calendário" (equipe x dia, igual à tela; várias programações na
   mesma célula uma por linha) e aba "Lista" (uma linha por equipe/dia/programação, pronta para filtrar e extrair) */
function exportarCalendarioXlsx(){
  const ini = progSemanaAtual();
  const dias = [0,1,2,3,4,5,6].map(i=>isoMais(ini,i));
  const nomes = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const ativas = programacoesFiltradas().filter(p=>p.status!=="Cancelada");
  const equipes = [...new Set(ativas.filter(p=>p.dataInicio<=dias[6] && p.dataFim>=dias[0]).flatMap(p=>p.equipesIds||[]))].sort();
  if(!equipes.length){ toast("Nenhuma programação ativa nessa semana (com os filtros atuais)."); return; }
  const cab = ["Equipe", ...dias.map((d,i)=>`${nomes[i]} ${d.slice(8,10)}/${d.slice(5,7)}`)];
  const matriz = [cab], lista = [];
  equipes.forEach(eq=>{
    const linha = [eq];
    dias.forEach((iso,i)=>{
      const progs = ativas.filter(p=>(p.equipesIds||[]).includes(eq) && p.dataInicio<=iso && iso<=p.dataFim);
      linha.push(progs.map(protecaoConjuntoTexto).join("\n"));
      progs.forEach(p=>lista.push({
        "Equipe":eq, "Data":fmtDate(iso), "Dia":nomes[i], "Proteção":p.protecaoId||"", "Conjunto":conjuntoDaProgramacao(p),
        "Alimentador":p.alimentador||"", "Status":p.status||"", "Plano":p.plano||p.tipoPlano||"", "Tipo":p.tipoProgramacao||"",
        "SIS/WR":p.numeroSIS||"", "Início":fmtDate(p.dataInicio), "Fim":fmtDate(p.dataFim),
      }));
    });
    matriz.push(linha);
  });
  const wb = XLSX.utils.book_new();
  const wc = XLSX.utils.aoa_to_sheet(matriz);
  wc["!cols"] = [{wch:14}, ...dias.map(()=>({wch:30}))];
  XLSX.utils.book_append_sheet(wb, wc, "Calendário");
  const wl = XLSX.utils.json_to_sheet(lista);
  wl["!cols"] = [{wch:14},{wch:11},{wch:6},{wch:14},{wch:26},{wch:14},{wch:12},{wch:16},{wch:16},{wch:14},{wch:11},{wch:11}];
  XLSX.utils.book_append_sheet(wb, wl, "Lista");
  XLSX.writeFile(wb, `calendario_${dias[0]}_a_${dias[6]}.xlsx`);
  toast(`Calendário exportado: ${equipes.length} equipe(s), ${lista.length} programação(ões) nos dias.`);
}
function exportarCalendarioPdf(){
  const ini = progSemanaAtual();
  const dias = [0,1,2,3,4,5,6].map(i=>isoMais(ini,i));
  const nomes = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const ativas = programacoesFiltradas().filter(p=>p.status!=="Cancelada");
  const equipes = [...new Set(ativas.filter(p=>p.dataInicio<=dias[6] && p.dataFim>=dias[0]).flatMap(p=>p.equipesIds||[]))].sort();
  if(!equipes.length){ toast("Nenhuma programação ativa nessa semana (com os filtros atuais)."); return; }
  const linhas = equipes.map(eq=>`<tr><th class="cal-eq">${escapeHtml(eq)}</th>${dias.map(iso=>{
    const progs = ativas.filter(p=>(p.equipesIds||[]).includes(eq) && p.dataInicio<=iso && iso<=p.dataFim);
    return `<td class="${iso===dias[5]||iso===dias[6]?"cal-fds":""}">${progs.map(p=>`<span class="cal-pill">${escapeHtml(protecaoConjuntoTexto(p))}</span>`).join("")}</td>`;
  }).join("")}</tr>`).join("");
  let el = document.getElementById("printProg");
  if(!el){ el = document.createElement("div"); el.id = "printProg"; document.body.appendChild(el); }
  el.innerHTML = `
    <h1>Calendário — semana de ${fmtDate(dias[0])} a ${fmtDate(dias[6])}</h1>
    <p class="pp-sub">${equipes.length} equipe(s) com programação · gerado pelo SPARK em ${new Date().toLocaleString("pt-BR")}</p>
    <table class="cal-pdf"><thead><tr><th class="cal-eq">Equipe</th>${dias.map((d,i)=>`<th>${nomes[i]} ${d.slice(8,10)}/${d.slice(5,7)}</th>`).join("")}</tr></thead>
    <tbody>${linhas}</tbody></table>`;
  const pg = document.createElement("style");
  pg.id = "paginaCalendarioPdf";
  pg.textContent = "@page{ size:A4 landscape; margin:8mm; }";
  document.head.appendChild(pg);
  const antes = document.title;
  document.title = `SPARK_Calendario_${dias[0]}_a_${dias[6]}`;
  document.body.classList.add("imprimindo-prog");
  const fim = ()=>{ document.body.classList.remove("imprimindo-prog"); document.title = antes; el.innerHTML = ""; const x = document.getElementById("paginaCalendarioPdf"); if(x) x.remove(); window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  setTimeout(()=>window.print(), 50);
}
function renderCalendario(){
  const ini = progSemanaAtual();
  const dias = [0,1,2,3,4,5,6].map(i=>isoMais(ini,i));
  const nomes = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const ativas = programacoesFiltradas().filter(p=>p.status!=="Cancelada");
  const equipesComProg = [...new Set(ativas.filter(p=>p.dataInicio<=dias[6] && p.dataFim>=dias[0]).flatMap(p=>p.equipesIds||[]))].sort();
  if(equipesComProg.length===0) return `<div class="empty">${ic("empty")}<div>Nenhuma programação ativa nessa semana (com os filtros atuais).</div></div>`;
  return `
  <div class="calendar-scroll" title="${equipesComProg.length} equipe(s) com programação na semana">
  <div class="calendar-grid">
    <div class="calendar-head">Equipe</div>
    ${dias.map((d,i)=>`<div class="calendar-head">${nomes[i]} ${d.slice(8,10)}/${d.slice(5,7)}</div>`).join("")}
    ${equipesComProg.map(eq=>`
      <div class="cal-team mono">${escapeHtml(eq)}</div>
      ${dias.map(iso=>{
        const progs = ativas.filter(p=>(p.equipesIds||[]).includes(eq) && p.dataInicio<=iso && iso<=p.dataFim);
        return `<div>${progs.map(p=>`<div class="cal-block ${p.id===progSelecionadaId?'cal-block-sel':''}" style="background:var(--info-bg); color:var(--info-fg); cursor:pointer;" onclick="selecionarProgramacao('${p.id}')" title="${escapeHtml(p.alimentador||"")}">${escapeHtml(protecaoConjuntoTexto(p))}</div>`).join("")}</div>`;
      }).join("")}
    `).join("")}
  </div>
  </div>
  ${equipesComProg.length>6 ? `<div style="color:var(--muted); font-size:11.5px; margin-top:6px;">${equipesComProg.length} equipes na semana — role a tabela para ver as demais.</div>` : ""}`;
}

/* ---- mapa logístico: OS de cada programação do filtro ---- */
let mapLogistica = null;
let mapLogisticaGrupos = {};   // programacaoId -> L.featureGroup
let mapLogisticaBases = null;
const COR_STATUS_PROG = { "Programada":"#1B4F8C", "Despachada":"#7C3AED", "Em andamento":"#B45309", "Concluída":"#15803D", "Cancelada":"#9CA3AF" };
/* v3.0.1 - o mapa da Programação só é montado quando aparece na tela (a tabela abre na hora) */
let _mapaLogObs = null;
function initMapaLogisticaAdiado(){
  const el = document.getElementById("mapaLogistica");
  if(_mapaLogObs){ _mapaLogObs.disconnect(); _mapaLogObs = null; }
  if(mapLogistica){ try{ mapLogistica.remove(); }catch(e){} mapLogistica = null; }
  if(!el) return;
  if(typeof IntersectionObserver === "undefined"){ setTimeout(initMapaLogistica, 0); return; }
  _mapaLogObs = new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)){ _mapaLogObs.disconnect(); _mapaLogObs = null; setTimeout(initMapaLogistica, 0); }
  }, { rootMargin:"150px" });
  _mapaLogObs.observe(el);
}
function initMapaLogistica(){
  const el = document.getElementById("mapaLogistica");
  if(!el) return;
  if(mapLogistica){ mapLogistica.remove(); mapLogistica=null; }
  mapLogisticaGrupos = {};
  mapLogistica = L.map(el, { zoomControl:true }).setView([-22.55,-47.4], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(mapLogistica);

  mapLogisticaBases = L.layerGroup().addTo(mapLogistica);
  state.equipes.filter(e=>typeof e.baseLat==="number" && typeof e.baseLng==="number").forEach(e=>{
    L.marker([e.baseLat, e.baseLng], { icon: squareIcon("#3D3D7A") })
      .bindPopup(`<h4>${escapeHtml(e.id)}</h4><dl><dt>Polo</dt><dd>${escapeHtml(e.polo||"")}</dd><dt>Tipo</dt><dd>${escapeHtml(e.proprioTerceiro||"")}</dd></dl>`)
      .addTo(mapLogisticaBases);
  });

  const todos = [];
  programacoesFiltradas().filter(p=>p.status!=="Cancelada").forEach(p=>{
    const grupo = L.featureGroup();
    const cor = COR_STATUS_PROG[p.status] || "#1B4F8C";
    let os = (p.osIds||[]).map(id=>osPorId(id)).filter(o=>o && typeof o.lat==="number" && typeof o.lng==="number");
    // programação sem OS vinculada: cai na coordenada de qualquer OS da mesma proteção
    if(os.length===0 && p.protecaoId){
      const o = state.manutencaoOS.find(x=>x.protecaoId===p.protecaoId && typeof x.lat==="number" && typeof x.lng==="number");
      if(o) os = [o];
    }
    os.forEach(o=>{
      L.circleMarker([o.lat,o.lng], { radius:6.5, color:"#fff", weight:1.4, fillColor:cor, fillOpacity:.92 })
        .bindPopup(()=>`<h4>OS ${escapeHtml(o.id)}</h4><dl><dt>Proteção</dt><dd>${escapeHtml(p.protecaoId)}</dd><dt>Alimentador</dt><dd>${escapeHtml(p.alimentador||"")}</dd><dt>Equipe(s)</dt><dd>${escapeHtml((p.equipesIds||[]).join(", "))}</dd><dt>Data</dt><dd>${fmtDate(p.dataInicio)}</dd></dl>`)
        .on("click", ()=>selecionarProgramacao(p.id, { doMapa:true }))
        .addTo(grupo);
      todos.push([o.lat,o.lng]);
    });
    if(os.length){
      (p.equipesIds||[]).forEach(eqId=>{
        const eq = equipeInfo(eqId);
        if(eq && typeof eq.baseLat==="number" && typeof eq.baseLng==="number"){
          L.polyline([[eq.baseLat,eq.baseLng],[os[0].lat,os[0].lng]], { color:"#F37020", weight:2, dashArray:"5 5", opacity:.85, interactive:false }).addTo(grupo);
        }
      });
      grupo.addTo(mapLogistica);
      mapLogisticaGrupos[p.id] = grupo;
    }
  });
  if(todos.length) mapLogistica.fitBounds(L.latLngBounds(todos).pad(0.2), { maxZoom:13 });
  if(progSelecionadaId) destacarProgramacaoNoMapa(progSelecionadaId, false);
}
function destacarProgramacaoNoMapa(id, voar){
  Object.keys(mapLogisticaGrupos).forEach(pid=>{
    const sel = pid===id;
    mapLogisticaGrupos[pid].eachLayer(l=>{
      if(l.setStyle && l.getRadius) l.setStyle({ radius: sel?10:6.5, weight: sel?3:1.4, color: sel?"#111":"#fff" });
      if(l.setStyle && !l.getRadius) l.setStyle({ opacity: sel?1:.35 });
    });
    if(sel && mapLogisticaGrupos[pid].bringToFront) mapLogisticaGrupos[pid].bringToFront();
  });
  const g = mapLogisticaGrupos[id];
  if(g && voar){
    try{ mapLogistica.fitBounds(g.getBounds().pad(0.5), { maxZoom:15 }); }catch(e){}
  }
}
/* Clique numa linha da grid, num bloco do calendário ou num círculo do
   mapa: destaca nos três sem re-renderizar a tela (o mapa não pisca). */
function selecionarProgramacao(id, opts){
  progSelecionadaId = (progSelecionadaId===id && !(opts&&opts.doMapa)) ? null : id;
  document.querySelectorAll("#progRows tr[data-prog]").forEach(tr=>tr.classList.toggle("os-row-selected", tr.dataset.prog===progSelecionadaId));
  document.querySelectorAll(".cal-block").forEach(b=>b.classList.remove("cal-block-sel"));
  if(progSelecionadaId){
    destacarProgramacaoNoMapa(progSelecionadaId, !(opts&&opts.doMapa));
    if(opts && opts.doMapa && !document.querySelector(`#progRows tr[data-prog="${progSelecionadaId}"]`)){
      const idx = programacoesFiltradas().findIndex(p=>p.id===progSelecionadaId);
      if(idx>=0) progIrPagina(Math.floor(idx/PROG_PAG_TAM)+1);
    }
    const tr = document.querySelector(`#progRows tr[data-prog="${progSelecionadaId}"]`);
    if(tr && opts && opts.doMapa) tr.scrollIntoView({ block:"nearest", behavior:"smooth" });
  } else {
    destacarProgramacaoNoMapa("", false);
  }
}

/* =========================================================================
   VIEW: Programação por equipe (Logística) — absorvido do sistema
   "Acompanhamento da Programação". Três sub-telas dentro do módulo
   Programação: matriz semanal por equipe (Poda/Faixa/Estrutura), equipes
   sem programação numa semana (lacunas) e oportunidades de deslocamento
   (mesma equipe indo a lugares diferentes na mesma semana, com um dia de
   furo entre atendimentos no mesmo destino). Regras de cor e de furo
   documentadas no sistema de origem: card fica "sem volume" só quando
   Poda=Faixa=Estrutura=0; cada quadrante tem sua própria faixa de
   cor (ver logSinal); lacuna é dia útil (seg–sáb) sem nenhum campo
   operacional válido registrado pra equipe naquela semana.
   ========================================================================= */
let logFiltroRegional = "";
let logFiltroPolo = "";
let logFiltroEquipe = "";
let logFiltroSemana = "";
function setLogFiltro(campo, valor){
  if(campo==="regional") logFiltroRegional = valor;
  if(campo==="polo") logFiltroPolo = valor;
  if(campo==="equipe") logFiltroEquipe = valor;
  if(campo==="semana") logFiltroSemana = valor;
  render();
}
function limparLogFiltros(){
  logFiltroRegional = logFiltroPolo = logFiltroEquipe = logFiltroSemana = "";
  render();
}

let _eqMapA = null, _eqMapB = null, _eqMapLA = -1, _eqMapLB = -1, _eqMap = null;
function logEquipePorId(id){
  const A = state.logEquipes || [], B = state.equipes || [];
  if(_eqMapA!==A || _eqMapB!==B || _eqMapLA!==A.length || _eqMapLB!==B.length){
    _eqMap = new Map();
    B.forEach(e=>_eqMap.set(e.id, e));
    A.forEach(e=>_eqMap.set(e.id, e));     // logEquipes tem prioridade, como antes
    _eqMapA = A; _eqMapB = B; _eqMapLA = A.length; _eqMapLB = B.length;
  }
  return _eqMap.get(id);
}
function logEnrich(p){
  const eq = logEquipePorId(p.equipeId);
  return {
    ...p,
    origem: (eq && (eq.polo)) || "Não localizada",
    regional: (eq && eq.regional) || p.regionalArquivo || "Não localizada",
  };
}
/* A matriz "Programação por equipe" (aba absorvida do sistema separado)
   só olhava pra state.logProgramacoes, que vem da importação da base
   legada — uma Programação criada aqui dentro do SPARK (manual, ou pelo
   fluxo novo "selecionar no mapa → Programar selecionadas") nunca
   aparecia ali, mesmo já valendo de verdade pra equipe. Esta função
   converte cada state.programacoes (as da aba Proteções) num registro no
   MESMO formato da matriz, um por dia × equipe dentro do intervalo
   dataInicio–dataFim, pra elas entrarem juntas na mesma grade sem duplicar
   nem precisar reimportar nada. */
function logProgramacoesSinteticas(){
  const saida = [];
  (state.programacoes||[]).forEach(p=>{
    if(p.status === "Cancelada") return;
    if(!p.dataInicio || !p.dataFim) return;
    const osVinculadas = osDaProgramacao(p);
    const resumoProg = programacaoResumoOS(p);   // v3.0.7: cor do cartão (concluída / atrasada)
    const cidades = p.localidade ? [p.localidade] : [...new Set(osVinculadas.map(cidadeDaOS).filter(Boolean))];
    const resumo = { poda:0, faixa:0, estrutura:0 };
    osVinculadas.forEach(o=>{
      resumo.poda += qtdTipoOS(o,"poda","prev");
      resumo.faixa += qtdTipoOS(o,"faixa","prev");
      resumo.estrutura += qtdTipoOS(o,"estrutura","prev");
    });
    const inicio = new Date(p.dataInicio+"T12:00:00");
    const fim = new Date(p.dataFim+"T12:00:00");
    if(isNaN(inicio) || isNaN(fim)) return;
    // v3.1.3 - distância do percurso (km, em linha reta, saindo da base da equipe) das OS desta programação
    const kmPorEquipe = {};
    (p.equipesIds||[]).forEach(eqId=>{ try{ kmPorEquipe[eqId] = logProgRota(osVinculadas, eqId).km || 0; }catch(e){ kmPorEquipe[eqId] = 0; } });
    for(let d = new Date(inicio); d <= fim; d.setDate(d.getDate()+1)){
      const dataIso = d.toISOString().slice(0,10);
      (p.equipesIds||[]).forEach(eqId=>{
        saida.push({
          id: `prot_${p.id}_${eqId}_${dataIso}`,
          data: dataIso, equipeId: eqId, regionalArquivo: "",
          elemento: p.protecaoId, alimentador: p.alimentador,
          localidade: cidades.join(", "),
          tipoProgramacao: p.tipoProgramacao || "Programação de Proteção",
          siswr: p.numeroSIS || "",
          status: p.status,
          observacoes: p.observacao || "",
          fonte: "Programação de Proteções (SPARK)", layout: "PROTECOES",
          vinculoResumo: { qtdOS: osVinculadas.length, poda: resumo.poda, faixa: resumo.faixa, estrutura: resumo.estrutura },
          progConcluida: resumoProg.concluida, progAtrasada: resumoProg.atrasada, kmRota: kmPorEquipe[eqId] || 0,
        });
      });
    }
  });
  return saida;
}
let _logEnrSig = null, _logEnrRes = null;
function logDadosEnriquecidos(){
  const sig = progAssinatura();
  if(_logEnrSig===sig && _logEnrRes) return _logEnrRes;
  _logEnrRes = [...(state.logProgramacoes||[]), ...logProgramacoesSinteticas()].map(logEnrich);
  _logEnrSig = sig;
  return _logEnrRes;
}
const _logWeekCache = new Map();
function logWeekOf(dataStr){
  let r = _logWeekCache.get(dataStr);
  if(r!==undefined) return r;
  const d = new Date(dataStr+"T12:00:00");
  const dow = (d.getDay()+6)%7; // segunda = 0
  d.setDate(d.getDate()-dow);
  r = d.toISOString().slice(0,10);
  if(_logWeekCache.size > 5000) _logWeekCache.clear();
  _logWeekCache.set(dataStr, r);
  return r;
}
const LOG_VALORES_INVALIDOS = ["#N/D","N/D","ND","#ND","N.A.","NA","NULL","VAZIO","-","--"];
function logIsValidOperational(v){
  const x = (v==null ? "" : String(v)).trim().toUpperCase();
  if(!x) return false;
  return !LOG_VALORES_INVALIDOS.includes(x);
}
function logIsOperational(p){
  return logIsValidOperational(p.elemento) || logIsValidOperational(p.alimentador) || logIsValidOperational(p.localidade) || logIsValidOperational(p.siswr) || logIsValidOperational(p.tipoProgramacao);
}
function logDadosFiltrados(){
  return logDadosEnriquecidos().filter(p=>
    (!logFiltroRegional || p.regional===logFiltroRegional) &&
    (!logFiltroPolo || p.origem===logFiltroPolo) &&
    (!logFiltroEquipe || p.equipeId===logFiltroEquipe) &&
    (!logFiltroSemana || logWeekOf(p.data)===logFiltroSemana)
  );
}
function logBaseParaLacunas(){
  return logDadosEnriquecidos().filter(p=>
    (!logFiltroRegional || p.regional===logFiltroRegional) &&
    (!logFiltroPolo || p.origem===logFiltroPolo) &&
    (!logFiltroEquipe || p.equipeId===logFiltroEquipe)
  );
}
function logOpcoes(lista, campo){
  return [...new Set(lista.map(p=>p[campo]).filter(Boolean))].sort();
}
function logOSVinculadas(p){
  const ids = new Set((state.logVinculos||{})[p.id] || []);
  return (state.logOS||[]).filter(o=>ids.has(o.id));
}
let _opRef = null, _opRes = null;
function logOportunidades(ps){
  if(_opRef===ps && _opRes) return _opRes;
  const r = logOportunidadesCalc(ps);
  _opRef = ps; _opRes = r;
  return r;
}
function logOportunidadesCalc(ps){
  const grupos = {};
  ps.filter(logIsOperational).forEach(p=>{
    const destino = p.localidade || p.alimentador;
    if(p.data && p.equipeId && logIsValidOperational(destino)){
      const chave = p.equipeId+"|"+logWeekOf(p.data)+"|"+String(destino).toUpperCase();
      (grupos[chave] = grupos[chave] || []).push(p);
    }
  });
  return Object.values(grupos).map(a=>{
    const datas = [...new Set(a.map(x=>x.data))].sort();
    const ruim = datas.slice(1).some((d,i)=> (new Date(d) - new Date(datas[i]))/86400000 > 1);
    return {
      regional: a[0].regional, equipeId: a[0].equipeId, origem: a[0].origem,
      destino: a[0].localidade || a[0].alimentador, datas, semana: logWeekOf(a[0].data), ruim,
    };
  }).filter(x=>x.ruim);
}
function logSemanasParaLacunas(){
  if(logFiltroSemana) return [logFiltroSemana];
  const semanas = [...new Set(logDadosFiltrados().map(p=>logWeekOf(p.data)).filter(Boolean))].sort();
  return semanas.length ? [semanas[semanas.length-1]] : [];
}
let _lacKey = null, _lacRes = null;
function logLacunas(){
  const key = progAssinatura() + "~" + logFiltroRegional + "~" + logFiltroPolo + "~" + logFiltroEquipe + "~" + logFiltroSemana;
  if(_lacKey===key && _lacRes) return _lacRes;
  const r = logLacunasCalc();
  _lacKey = key; _lacRes = r;
  return r;
}
function logLacunasCalc(){
  const base = logBaseParaLacunas();
  const semanas = logSemanasParaLacunas();
  const saida = [];
  semanas.forEach(semana=>{
    const segunda = new Date(semana+"T12:00:00");
    const dias = [0,1,2,3,4,5].map(i=>{ const d=new Date(segunda); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); });
    const wp = base.filter(p=>logWeekOf(p.data)===semana);
    const equipesSemana = [...new Set(wp.map(p=>p.equipeId).filter(Boolean))];
    equipesSemana.forEach(eqId=>{
      const tp = wp.filter(p=>p.equipeId===eqId);
      const presentes = new Set(tp.filter(logIsOperational).map(p=>p.data));
      const faltando = dias.filter(d=>!presentes.has(d));
      if(faltando.length) saida.push({ equipeId:eqId, origem:tp[0].origem, regional:tp[0].regional, semana, dias, faltando, presentes });
    });
  });
  return saida.sort((a,b)=> b.faltando.length - a.faltando.length || a.equipeId.localeCompare(b.equipeId));
}
function logSinal(tipo, valor){
  if(valor<=0) return "neutral";
  if(tipo==="poda") return valor>=10 ? "good" : valor>=7 ? "warn" : "bad";
  if(tipo==="faixa") return valor>=100 ? "good" : valor>=50 ? "warn" : "bad";
  if(tipo==="estrutura") return valor>=2 ? "good" : "warn";
  return "neutral";
}
function logCardVazio(s){ return !(s.poda>0 || s.faixa>0 || s.estrutura>0); }

function logFiltrosHtml(baseParaOpcoes, semSemanaTodas){
  const regionais = logOpcoes(baseParaOpcoes, "regional");
  const polos = logOpcoes(baseParaOpcoes, "origem");
  const equipesOpt = logOpcoes(baseParaOpcoes, "equipeId");
  const semanasSet = new Set(baseParaOpcoes.map(p=>logWeekOf(p.data)));
  if(semSemanaTodas) semanasSet.add(logSemanaAtual());   // a semana atual sempre aparece, mesmo sem programação
  const semanas = [...semanasSet].sort();
  return `
  <div class="filters" style="display:grid; grid-template-columns:repeat(4,1fr) auto; gap:10px; align-items:end;">
    <div class="field"><label>Regional</label>
      <select onchange="setLogFiltro('regional',this.value)">
        <option value="">Todas</option>
        ${regionais.map(r=>`<option value="${escapeHtml(r)}" ${logFiltroRegional===r?"selected":""}>${escapeHtml(r)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Polo</label>
      <select onchange="setLogFiltro('polo',this.value)">
        <option value="">Todos</option>
        ${polos.map(r=>`<option value="${escapeHtml(r)}" ${logFiltroPolo===r?"selected":""}>${escapeHtml(r)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Equipe</label>
      <select onchange="setLogFiltro('equipe',this.value)">
        <option value="">Todas</option>
        ${equipesOpt.map(r=>`<option value="${escapeHtml(r)}" ${logFiltroEquipe===r?"selected":""}>${escapeHtml(r)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Semana</label>
      <select onchange="setLogFiltro('semana',this.value)">
        ${semSemanaTodas ? "" : `<option value="">Todas</option>`}
        ${semanas.map(s=>`<option value="${s}" ${logFiltroSemana===s?"selected":""}>Semana de ${fmtDate(s)}${s===logSemanaAtual()?" (atual)":""}</option>`).join("")}
      </select>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="limparLogFiltros()">${ic("close")} Limpar</button>
  </div>`;
}

/* v2.15.53 - "Programação por equipe" monta só a semana escolhida (padrão: a semana atual, sempre selecionada) para carregar mais rápido */
function logSemanaAtual(){ return logWeekOf(prodHojeIso()); }
function viewProgramacaoEquipes(){
  if(!logFiltroSemana) logFiltroSemana = logSemanaAtual();
  const ps = logDadosFiltrados();
  const oportunidades = logOportunidades(ps);
  const criticos = new Set(oportunidades.map(o=>o.equipeId+"|"+o.semana+"|"+String(o.destino||"").toUpperCase()));
  const semanas = [...new Set(ps.map(p=>logWeekOf(p.data)))].sort();
  return `
  <div class="card" style="margin-bottom:14px;">${logFiltrosHtml(logDadosEnriquecidos(), true)}</div>
  ${semanas.length===0 ? `<div class="card"><div class="empty">${ic("empty")}<div>Nenhuma programação de equipe no filtro atual.</div></div></div>` : semanas.map(semana=>{
    const wp = ps.filter(p=>logWeekOf(p.data)===semana);
    const dias = [...new Set(wp.map(p=>p.data))].sort();
    const equipesSemana = [...new Set(wp.map(p=>p.equipeId))].sort();
    return `
    <div class="semana-ampla">
      <h3>Semana de ${fmtDate(semana)}</h3>
      <div class="table-wrap"><table class="log-matrix">
        <thead><tr><th>Equipe / origem</th>${dias.map(d=>`<th>${fmtDate(d)}</th>`).join("")}</tr></thead>
        <tbody>
        ${equipesSemana.map(eqId=>{
          const tp = wp.filter(p=>p.equipeId===eqId);
          const e0 = tp[0];
          return `<tr>
            <td><b class="mono">${escapeHtml(eqId)}</b><div style="color:var(--muted); font-size:11px; margin-top:2px;">${escapeHtml(e0.origem)} · ${escapeHtml(e0.regional)}</div></td>
            ${dias.map(d=>{
              const doDia = tp.filter(p=>p.data===d);
              return `<td>${doDia.map(p=>{
                const destino = p.localidade || p.alimentador || "";
                const s = p.vinculoResumo || {poda:0,faixa:0,estrutura:0,qtdOS:0};
                const alerta = criticos.has(p.equipeId+"|"+semana+"|"+String(destino).toUpperCase());
                const vazio = logCardVazio(s);
                return `
                <div class="log-cell ${alerta?"alert":""} ${vazio?"empty-volume":""} ${p.progConcluida?"log-concluida":(p.progAtrasada?"log-atrasada":"")}" onclick="abrirDetalheLogProgramacao('${p.id}')">
                  <b class="mono" style="font-size:12px;">${escapeHtml(p.elemento || p.alimentador || "#N/D")}</b>
                  <div class="log-linha" title="SIS/WR">${escapeHtml(p.siswr || "Sem SIS/WR")}</div>
                  <div class="log-linha" title="Localidade">${escapeHtml(destino || "#N/D")}</div>
                  <div class="log-linha" title="${p.kmRota>0 ? "Percurso em linha reta passando pelas OS, saindo da base da equipe" : "Quantidade de OS"}">${s.qtdOS} OS${p.kmRota>0 ? ` · ≈ ${(Math.round(p.kmRota*10)/10).toLocaleString("pt-BR")} km` : ""}</div>
                  <div class="log-quads">
                    <div class="log-quad ${logSinal("poda",s.poda)}" title="Poda"><strong>${s.poda}</strong>Poda</div>
                    <div class="log-quad ${logSinal("faixa",s.faixa)}" title="Limpeza de faixa"><strong>${s.faixa}</strong>Faixa</div>
                    <div class="log-quad ${logSinal("estrutura",s.estrutura)}" title="Estrutura"><strong>${s.estrutura}</strong>Estr.</div>
                    <div class="log-quad ${p.observacoes?"warn":"neutral"}" title="Observações"><strong>${p.observacoes?"SIM":"NÃO"}</strong>Obs.</div>
                  </div>
                </div>`;
              }).join("") || `<span style="color:var(--muted); font-size:11px;">—</span>`}</td>`;
            }).join("")}
          </tr>`;
        }).join("")}
        </tbody>
      </table></div>
    </div>`;
  }).join("")}
  `;
}

/* v2.15.19 - dados de uma programação do Log (card do dia) já normalizados pra tela e pras exportações */
/* v2.15.51 - ordem de percurso das OS: caminho aberto mais curto (vizinho mais próximo + melhoria 2-opt).
   Se a equipe tem base cadastrada (baseLat/baseLng), o percurso parte da base; senão, escolhe o melhor ponto de partida.
   OS sem coordenada vão para o fim. Distâncias em linha reta (haversine) - é uma ordem sugerida, não roteirização por ruas. */
function logProgKm(a,b){
  const R = 6371, r = Math.PI/180, dLa = (b.lat-a.lat)*r, dLn = (b.lng-a.lng)*r;
  const h = Math.sin(dLa/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLn/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function logProgRota(lista, equipeId){
  const com = [], sem = [];
  lista.forEach(o=>{
    const lat = parseFloat(o.lat), lng = parseFloat(o.lng);
    if(Number.isFinite(lat) && Number.isFinite(lng)) com.push({ o, lat, lng }); else sem.push(o);
  });
  const eq = equipeInfo(equipeId);
  const bLat = eq ? parseFloat(eq.baseLat) : NaN, bLng = eq ? parseFloat(eq.baseLng) : NaN;
  const base = (Number.isFinite(bLat) && Number.isFinite(bLng)) ? { lat:bLat, lng:bLng } : null;
  if(com.length < 2) return { lista: com.map(x=>x.o).concat(sem), km:0, base:!!base && com.length>0 };
  const n = com.length;
  const D = com.map(a=>com.map(b=>logProgKm(a,b)));
  const dBase = base ? com.map(a=>logProgKm(base,a)) : null;
  const comp = ord => { let t = dBase ? dBase[ord[0]] : 0; for(let i=1;i<ord.length;i++) t += D[ord[i-1]][ord[i]]; return t; };
  const vizinho = ini => { const ord = [ini], usado = new Set(ord); while(ord.length<n){ const u = ord[ord.length-1]; let m=-1, md=Infinity; for(let j=0;j<n;j++) if(!usado.has(j) && D[u][j]<md){ md=D[u][j]; m=j; } ord.push(m); usado.add(m); } return ord; };
  const dois = ord => {
    let melhorou = true, guard = 0;
    while(melhorou && guard++ < 60){
      melhorou = false;
      for(let i=0;i<n-1;i++) for(let k=i+1;k<n;k++){
        const novo = ord.slice(0,i).concat(ord.slice(i,k+1).reverse(), ord.slice(k+1));
        if(comp(novo) + 1e-9 < comp(ord)){ ord = novo; melhorou = true; }
      }
    }
    return ord;
  };
  const inicios = dBase ? [dBase.indexOf(Math.min(...dBase))] : com.map((_,i)=>i);
  let melhor = null, mk = Infinity;
  inicios.forEach(ini=>{ const ord = dois(vizinho(ini)); const k = comp(ord); if(k<mk){ mk = k; melhor = ord; } });
  return { lista: melhor.map(i=>com[i].o).concat(sem), km: mk, base: !!base };
}
function logProgDados(id){
  const p = logDadosEnriquecidos().find(x=>x.id===id);
  if(!p) return null;
  const ehSintetico = String(p.id).startsWith("prot_");
  // Cards sintéticos (id "prot_...", vindos de state.programacoes — ver
  // logProgramacoesSinteticas) não têm entrada em state.logVinculos (isso só
  // existe pra base legada importada), mas têm as OS de verdade linkadas em
  // state.manutencaoOS — usa essas em vez de logOSVinculadas.
  const progOriginal = ehSintetico ? state.programacoes.find(x => p.id.startsWith(`prot_${x.id}_`)) : null;
  const ligadasBase = ehSintetico
    ? (progOriginal ? osDaProgramacao(progOriginal) : [])
    : logOSVinculadas(p);
  const rota = logProgRota(ligadasBase, p.equipeId);   // v2.15.51: OS em ordem de percurso
  const ligadas = rota.lista;
  const linhas = ligadas.map(o=>{
    const lat = (o.lat!=null && o.lat!=="") ? parseFloat(o.lat) : NaN;
    const lng = (o.lng!=null && o.lng!=="") ? parseFloat(o.lng) : NaN;
    const tem = Number.isFinite(lat) && Number.isFinite(lng);
    const link = tem ? `https://www.google.com/maps?q=${lat},${lng}` : "";
    if(ehSintetico) return { os:o.id, alim:o.alimentador||p.alimentador||"", tipo:servicoTextoOS(o), localidade:o.localidade||o.conjunto||"", lat:tem?lat:"", lng:tem?lng:"", prev:qtdTextoOS(o,"prev"), real:qtdTextoOS(o,"real",realizadoOS), link, obs:o.observacao||"" };
    const partes = [["Poda",o.poda],["Faixa",o.faixa],["Estrutura",o.estrutura]].filter(x=>Number(x[1])>0);
    return { os:o.numeroOS, alim:o.alimentador||p.alimentador||"", tipo:partes.map(x=>x[0]).join(" + "), localidade:o.localidade||"", lat:tem?lat:"", lng:tem?lng:"", prev:partes.map(x=>x[0]+" "+x[1]).join(" · "), real:"", link, obs:o.observacao||"" };
  });
  return { p, ehSintetico, progOriginal, ligadas, linhas, rota };
}
function logProgOrigemTexto(d){
  if(!d.ehSintetico) return "";
  const o = d.progOriginal && d.progOriginal.origemTela;
  if(o === "Mapa") return `Programação feita pelo <strong>Mapa de manutenção</strong> do SPARK (não veio da base legada importada).`;
  if(o === "Proteções") return `Programação feita pela aba <strong>Proteções</strong> do SPARK (não veio da base legada importada).`;
  return `Programação feita no <strong>SPARK</strong> (não veio da base legada importada).`;
}

/* v2.15.40 - aderência da programação à capacidade da equipe no dia:
   carga prevista (soma do previsto das OS, na mesma unidade da meta) / meta diária da equipe. */
function logProgAderencia(d){
  const p = d.p, s = p.vinculoResumo || {};
  // v2.15.41 - equivalência em podas: limpeza de faixa (m) / 100; poda e estrutura em unidades
  let poda=0, faixa=0, estr=0;
  if(d.ehSintetico) d.ligadas.forEach(o=>{ poda += qtdTipoOS(o,"poda","prev")||0; faixa += qtdTipoOS(o,"faixa","prev")||0; estr += qtdTipoOS(o,"estrutura","prev")||0; });
  else { poda = Number(s.poda)||0; faixa = Number(s.faixa)||0; estr = Number(s.estrutura)||0; }
  const carga = poda + faixa/100 + estr;
  // v2.15.54: capacidade do dia = meta de poda + meta de faixa (km × 150) em podas equivalentes
  const meta = prodMetaDia(p.equipeId, p.data, "poda") + prodMetaDia(p.equipeId, p.data, "faixa") * FAIXA_PODAS_POR_KM;
  const base = { carga, poda, faixa, estr, meta };
  if(!(meta>0)) return Object.assign(base, { pct:null, tom:"neutro" });
  const pct = carga/meta*100;
  return Object.assign(base, { pct, tom:(pct>=80 && pct<=120) ? "ok" : "alerta" });
}
function logProgSparkResumo(d){
  const a = logProgAderencia(d), n = d.ligadas.length;
  const f = v=>Math.round(v).toLocaleString("pt-BR");
  const f1 = v=>(Math.round(v*10)/10).toLocaleString("pt-BR");
  const carga = `<b>${f1(a.carga)}</b> podas`;
  let img = "spark_cabeca", titulo, msg;
  const rp = d.progOriginal ? programacaoResumoOS(d.progOriginal) : null;
  if(rp && rp.concluida){
    // v3.0.7 - programação concluída: SPARK feliz, mostra o previsto x realizado gravado
    img = "spark_orgulhoso"; titulo = "Programação concluída!";
    msg = `Todas as <b>${rp.os.length}</b> OS foram atendidas. Previsto <b>${f1(rp.previsto)}</b> · realizado <b>${f1(rp.realizado)}</b>. Bom trabalho!`;
    return `<div class="spark-resumo ok">
    <img src="assets/spark/${img}.png" alt="SPARK">
    <div class="spark-resumo-balao"><strong>${titulo}</strong><div>${msg}</div></div>
  </div>`;
  }
  if(a.tom==="neutro"){
    titulo = "Sem meta pra comparar";
    msg = `Essa equipe não tem meta cadastrada (ou está sem meta nesse dia: fim de semana, feriado ou indisponível). Carga programada: ${carga} em ${n} OS.`;
  } else if(a.tom==="ok"){
    img = "spark_orgulhoso"; titulo = `Programação aderente: ${f(a.pct)}% da capacidade`;
    msg = `Carga de ${carga} para uma meta diária de <b>${f1(a.meta)}</b>. Está dentro da faixa de 80% a 120%. Bom trabalho!`;
  } else {
    img = "spark_alerta"; const abaixo = a.pct<80;
    titulo = `Atenção: ${f(a.pct)}% da capacidade`;
    msg = `Carga de ${carga} para uma meta diária de <b>${f1(a.meta)}</b>. ${abaixo?"A equipe fica com folga: dá pra programar mais OS.":"A equipe está sobrecarregada: vale redistribuir parte das OS."}`;
  }
  return `<div class="spark-resumo ${a.tom}">
    <img src="assets/spark/${img}.png" alt="SPARK">
    <div class="spark-resumo-balao"><strong>${titulo}</strong><div>${msg}</div></div>
  </div>`;
}

function abrirDetalheLogProgramacao(id){
  const d = logProgDados(id);
  if(!d) return;
  const { p, ehSintetico, ligadas } = d;
  const s = p.vinculoResumo || {};
  const origemTxt = logProgOrigemTexto(d);
  openModal(`
    <h2>${escapeHtml(p.equipeId)} · ${fmtDate(p.data)}</h2>
    <p class="modal-sub">${escapeHtml(p.elemento || p.alimentador || "#N/D")} · ${escapeHtml(p.localidade || "—")}</p>
    ${logProgSparkResumo(d)}
    ${origemTxt ? `<p style="font-size:12px; color:var(--muted); margin:0 0 8px;">${origemTxt}</p>` : ``}
    <p>Poda ${s.poda||0} · Faixa ${s.faixa||0} · Estrutura ${s.estrutura||0} · ${ligadas.length} OS</p>
    <p style="margin:6px 0 10px;"><strong>Observação da programação:</strong> ${escapeHtml(p.observacoes || "Sem observação")}</p>
    ${logProgMapaHtml(d)}
    <h3 style="margin-bottom:8px;">OS vinculadas</h3>
    ${ligadas.length===0 ? `<p style="color:var(--muted); font-size:12.5px;">Nenhuma OS vinculada.</p>` : ligadas.map((o,i)=> ehSintetico ? `
      <div class="card" style="margin-bottom:8px; padding:10px 12px;">
        <span class="log-prog-pino pino-mini ${osAtendida(o)?"pino-ok":""}">${i+1}</span><b class="mono">${escapeHtml(o.id)}</b> · ${escapeHtml(servicoTextoOS(o))} · ${osAtendida(o)?"Atendida":"Pendente"} · Previsto ${escapeHtml(String(qtdTextoOS(o,"prev")))} · Realizado ${escapeHtml(String(qtdTextoOS(o,"real",realizadoOS)))}
        <div style="font-size:11px; color:var(--muted); margin-top:3px;">${escapeHtml(o.localidade||o.conjunto||"")}</div>
        ${(o.lat&&o.lng) ? `<a class="btn btn-ghost btn-sm" style="margin-top:8px;" href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener noreferrer">Localizar no mapa</a>` : ""}
      </div>` : `
      <div class="card" style="margin-bottom:8px; padding:10px 12px;">
        <span class="log-prog-pino pino-mini">${i+1}</span><b class="mono">${escapeHtml(o.numeroOS)}</b> · ${escapeHtml(o.protecao)} · ${escapeHtml(o.trecho)} · Poda ${o.poda} · Faixa ${o.faixa} · Estrutura ${o.estrutura}
        <div style="font-size:11px; color:var(--muted); margin-top:3px;">${escapeHtml(o.tipoEquipamento||"")}${(o.lat&&o.lng)?` · ${o.lat}, ${o.lng}`:""}</div>
        ${(o.lat&&o.lng) ? `<a class="btn btn-ghost btn-sm" style="margin-top:8px;" href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener noreferrer">Localizar no mapa</a>` : ""}
      </div>`).join("")}
    <div class="modal-foot" style="justify-content:space-between;">
      <div class="modal-foot-exp">
        <button class="btn btn-ghost" ${ligadas.length?"":"disabled"} onclick="exportarProgLogPdf('${p.id}')" title="Abre a impressão do navegador: escolha &quot;Salvar como PDF&quot;">${ic("download")} PDF</button>
        <button class="btn btn-ghost" ${ligadas.length?"":"disabled"} onclick="exportarProgLogXlsx('${p.id}')">${ic("download")} Excel (.xlsx)</button>
      </div>
      <div style="display:flex; gap:8px;">
        ${ehSintetico ? "" : `<button class="btn btn-ghost" onclick="abrirHistoricoProgramacao('${p.id}')" title="Quem alterou o quê e quando nesta programação">Histórico</button>`}
        <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
      </div>
    </div>
  `);
  const m = document.querySelector("#modalOverlay .modal"); if(m) m.classList.add("modal-largo");
  logProgMapaIniciar(d);
}

/* v2.15.49 - mapinha das OS da programação (popup) e página de mapa no PDF */
function logProgPontos(d){
  const pts = [];
  d.linhas.forEach((l,i)=>{ if(l.lat!=="" && l.lng!=="" && Number.isFinite(l.lat) && Number.isFinite(l.lng)) pts.push({ n:i+1, os:l.os, lat:l.lat, lng:l.lng, tipo:l.tipo }); });
  return pts;
}
/* v3.1.7 - rota POR RUAS (OSRM, serviço público do OpenStreetMap) para a ordem de percurso da programação.
   Só as coordenadas dos pontos saem do navegador. Se o serviço não responder, tudo continua em linha reta. */
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
const logRotaRuasCache = {};
let logProgComBase = false;   // padrão: rota só entre as OS, sem a base da equipe
try{ logProgComBase = localStorage.getItem("spark_rota_base") === "1"; }catch(e){}
let logProgMapaDados = null;
function alternarBaseNoMapa(v){
  logProgComBase = !!v;
  try{ localStorage.setItem("spark_rota_base", logProgComBase ? "1" : "0"); }catch(e){}
  if(logProgMapaDados) logProgMapaIniciar(logProgMapaDados);
}
function logProgWaypoints(d, semBase){
  const pts = logProgPontos(d).map(p=>({ lat:p.lat, lng:p.lng }));
  let base = null;
  if(!semBase && d.rota && d.rota.base){
    const eq = equipeInfo(d.p.equipeId);
    const bl = eq ? parseFloat(eq.baseLat) : NaN, bn = eq ? parseFloat(eq.baseLng) : NaN;
    if(Number.isFinite(bl) && Number.isFinite(bn)) base = { lat:bl, lng:bn };
  }
  return { pts, base, todos: base ? [base].concat(pts) : pts };
}
async function logProgRotaRuas(d, semBase){
  const w = logProgWaypoints(d, semBase);
  if(w.todos.length < 2) return null;
  const chave = w.todos.map(x=>x.lat.toFixed(5)+","+x.lng.toFixed(5)).join(";");
  if(logRotaRuasCache[chave] !== undefined) return logRotaRuasCache[chave];
  try{
    let metros = 0, segundos = 0, coords = [];
    // o serviço aceita muitos pontos, mas pedimos em blocos de 25 (o último ponto de um bloco abre o próximo)
    for(let i=0; i < w.todos.length-1; i += 24){
      const bloco = w.todos.slice(i, i+25);
      if(bloco.length < 2) break;
      const url = OSRM_URL + bloco.map(x=>x.lng+","+x.lat).join(";") + "?overview=full&geometries=geojson&steps=false";
      const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 12000);
      let resp; try{ resp = await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }
      if(!resp.ok) throw new Error("HTTP "+resp.status);
      const j = await resp.json();
      if(j.code !== "Ok" || !j.routes || !j.routes[0]) throw new Error(j.code || "sem rota");
      metros += j.routes[0].distance; segundos += j.routes[0].duration;
      coords = coords.concat(j.routes[0].geometry.coordinates.map(c=>[c[1], c[0]]));
    }
    let reta = 0; for(let i=1;i<w.todos.length;i++) reta += logProgKm(w.todos[i-1], w.todos[i]);
    const r = { km: metros/1000, min: segundos/60, coords, base: !!w.base, reta };
    logRotaRuasCache[chave] = r;
    return r;
  }catch(e){
    return null; // não guarda a falha: da próxima vez tenta de novo
  }
}
function logProgRotaRuasTexto(rr, d){
  const f1 = n => (Math.round(n*10)/10).toLocaleString("pt-BR");
  const dur = rr.min >= 60 ? `${Math.floor(rr.min/60)} h ${Math.round(rr.min%60)} min` : `${Math.round(rr.min)} min`;
  return `≈ ${f1(rr.km)} km por ruas · cerca de ${dur} de carro${rr.reta>0 ? ` (em linha reta: ${f1(rr.reta)} km)` : ""}`;
}
function logProgMapaHtml(d){
  if(d.linhas.length===0) return "";
  const pts = logProgPontos(d);
  if(!pts.length) return `<p style="color:var(--muted); font-size:12px; margin:0 0 10px;">Nenhuma OS desta programação tem coordenada para mostrar no mapa.</p>`;
  const sem = d.linhas.length - pts.length;
  return `<div style="margin:0 0 12px;">
    <h3 style="margin-bottom:6px;">Localização das OS${sem?` <span style="font-weight:400; font-size:12px; color:var(--muted);">(${sem} sem coordenada)</span>`:""}</h3>
    ${logProgWaypoints(d).base ? `<label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); margin:0 0 4px; cursor:pointer;"><input type="checkbox" ${logProgComBase?"checked":""} onchange="alternarBaseNoMapa(this.checked)"> Incluir a base da equipe no trajeto</label>` : ""}
    <p id="logProgRotaRuas" style="font-size:12px; color:var(--muted); margin:-2px 0 6px;">${logProgWaypoints(d).todos.length>1 ? "Calculando a rota por ruas…" : ""}</p>
    <div id="logProgMapa" class="log-prog-mapa"></div>
  </div>`;
}
let logProgMapaInst = null;
function logProgMapaIniciar(d){
  logProgMapaDados = d;
  if(logProgMapaInst){ try{ logProgMapaInst.remove(); }catch(e){} logProgMapaInst = null; }
  const el = document.getElementById("logProgMapa");
  if(!el || typeof L === "undefined") return;
  const pts = logProgPontos(d);
  if(!pts.length) return;
  const mp = L.map(el, { scrollWheelZoom:false, zoomControl:true, attributionControl:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(mp);
  const grupo = [];
  pts.forEach(pt=>{
    const mk = L.marker([pt.lat, pt.lng], { icon: L.divIcon({ className:"", html:`<div class="log-prog-pino ${(d.ehSintetico && d.ligadas[pt.n-1] && osAtendida(d.ligadas[pt.n-1]))?"pino-ok":""}">${pt.n}</div>`, iconSize:[26,26], iconAnchor:[13,13] }) })
      .bindPopup(`<b>${escapeHtml(String(pt.os))}</b><br>${escapeHtml(pt.tipo||"")}`).addTo(mp);
    grupo.push(mk.getLatLng());
  });
  const linhaReta = (pts.length>1) ? L.polyline(grupo, { color:"#F37020", weight:3, opacity:.85, dashArray:"7 6" }).addTo(mp) : null;
  if(pts.length===1) mp.setView(grupo[0], 16); else mp.fitBounds(L.latLngBounds(grupo), { padding:[30,30], maxZoom:16 });
  logProgMapaInst = mp;
  let limitesRota = null;
  const semBaseMapa = !logProgComBase;
  const txt0 = document.getElementById("logProgRotaRuas");
  if(txt0){ txt0.style.color = "var(--muted)"; txt0.textContent = logProgWaypoints(d, semBaseMapa).todos.length>1 ? "Calculando a rota por ruas…" : ""; }
  if(logProgWaypoints(d, semBaseMapa).todos.length>1){
    logProgRotaRuas(d, semBaseMapa).then(rr=>{
      if(logProgMapaInst !== mp) return; // popup fechado/trocado enquanto esperava
      const txt = document.getElementById("logProgRotaRuas");
      if(!rr){ if(txt){ const w0 = logProgWaypoints(d, semBaseMapa).todos; let km0 = 0; for(let i=1;i<w0.length;i++) km0 += logProgKm(w0[i-1], w0[i]); txt.textContent = `Rota por ruas indisponível agora (serviço sem resposta ou bloqueado na rede) — mostrando linha reta: ≈ ${(Math.round(km0*10)/10).toLocaleString("pt-BR")} km.`; } return; }
      if(linhaReta) mp.removeLayer(linhaReta);
      const rota = L.polyline(rr.coords, { color:"#2563EB", weight:4, opacity:.8 }).addTo(mp);
      limitesRota = rota.getBounds();
      const w = logProgWaypoints(d, semBaseMapa);
      if(w.base) L.marker([w.base.lat, w.base.lng], { icon: L.divIcon({ className:"", html:`<div class="log-prog-base" title="Base da equipe">B</div>`, iconSize:[22,22], iconAnchor:[11,11] }) }).bindPopup("Base da equipe").addTo(mp);
      if(txt){ txt.textContent = logProgRotaRuasTexto(rr, d); txt.style.color = "var(--text)"; }
      try{ mp.fitBounds(limitesRota.pad(0.08), { padding:[24,24], maxZoom:16 }); }catch(e){}
    });
  }
  setTimeout(()=>{ try{ mp.invalidateSize(); if(limitesRota) mp.fitBounds(limitesRota.pad(0.08), { padding:[24,24], maxZoom:16 }); else if(pts.length>1) mp.fitBounds(L.latLngBounds(grupo), { padding:[30,30], maxZoom:16 }); }catch(e){} }, 350);
}
/* imagem estática do mapa (tiles do OpenStreetMap + pinos numerados) para a última página do PDF */
async function logProgMapaImagem(pts, W, H, rr, base){
  const rad = Math.PI/180;
  const px = (lng,z)=> (lng+180)/360 * 256 * Math.pow(2,z);
  const py = (lat,z)=>{ const s = Math.sin(lat*rad); return (0.5 - Math.log((1+s)/(1-s))/(4*Math.PI)) * 256 * Math.pow(2,z); };
  const alvo = pts.concat(base ? [base] : []).concat((rr && rr.coords) ? rr.coords.map(c=>({ lat:c[0], lng:c[1] })) : []);
  const lats = alvo.map(p=>p.lat), lngs = alvo.map(p=>p.lng);
  const mnLa = Math.min(...lats), mxLa = Math.max(...lats), mnLn = Math.min(...lngs), mxLn = Math.max(...lngs);
  const margem = 90;
  let z = 17;
  for(; z>3; z--){
    const w = px(mxLn,z)-px(mnLn,z), h = py(mnLa,z)-py(mxLa,z);
    if(w <= W-2*margem && h <= H-2*margem) break;
  }
  const cx = (px(mnLn,z)+px(mxLn,z))/2, cy = (py(mnLa,z)+py(mxLa,z))/2;
  const x0 = cx - W/2, y0 = cy - H/2;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#e8e6df"; g.fillRect(0,0,W,H);
  const tx0 = Math.floor(x0/256), tx1 = Math.floor((x0+W)/256), ty0 = Math.floor(y0/256), ty1 = Math.floor((y0+H)/256);
  const n = Math.pow(2,z), tarefas = [];
  for(let tx=tx0; tx<=tx1; tx++) for(let ty=ty0; ty<=ty1; ty++){
    if(ty<0 || ty>=n) continue;
    const wx = ((tx % n)+n)%n;
    tarefas.push(new Promise(res=>{
      const im = new Image(); im.crossOrigin = "anonymous";
      const t = setTimeout(()=>res(), 9000);
      im.onload = ()=>{ clearTimeout(t); g.drawImage(im, tx*256-x0, ty*256-y0); res(); };
      im.onerror = ()=>{ clearTimeout(t); res(); };
      im.src = `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`;
    }));
  }
  await Promise.all(tarefas);
  if(rr && rr.coords && rr.coords.length>1){
    g.beginPath(); rr.coords.forEach((c,i)=>{ const x = px(c[1],z)-x0, y = py(c[0],z)-y0; if(i===0) g.moveTo(x,y); else g.lineTo(x,y); });
    g.lineWidth = 6; g.lineJoin = "round"; g.strokeStyle = "rgba(37,99,235,.82)"; g.stroke();
  } else if(pts.length>1){
    g.beginPath(); pts.forEach((pt,i)=>{ const x = px(pt.lng,z)-x0, y = py(pt.lat,z)-y0; if(i===0) g.moveTo(x,y); else g.lineTo(x,y); });
    g.lineWidth = 4; g.strokeStyle = "rgba(243,112,32,.85)"; g.setLineDash([14,10]); g.stroke(); g.setLineDash([]);
  }
  if(base){
    const bx = px(base.lng,z)-x0, by = py(base.lat,z)-y0;
    g.fillStyle = "#1e3a8a"; g.fillRect(bx-14,by-14,28,28); g.lineWidth = 3; g.strokeStyle = "#fff"; g.strokeRect(bx-14,by-14,28,28);
    g.fillStyle = "#fff"; g.font = "bold 17px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("B", bx, by+1);
  }
  pts.forEach(pt=>{
    const x = px(pt.lng,z)-x0, y = py(pt.lat,z)-y0;
    g.beginPath(); g.arc(x,y,17,0,Math.PI*2); g.fillStyle = "#F37020"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#fff"; g.font = "bold 17px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(pt.n), x, y+1);
  });
  g.font = "13px Arial"; g.textAlign = "right"; g.textBaseline = "bottom"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(W-190,H-24,190,24);
  g.fillStyle = "#333"; g.fillText("© OpenStreetMap", W-8, H-6);
  try{ return cv.toDataURL("image/jpeg", 0.88); }catch(e){ return null; }
}

/* v2.15.19 - exporta as OS da programação (OS, Lat, Long, Previsto, link do Google Maps...) */
function logProgNomeArquivo(d){
  const base = `SPARK_Programacao_${d.p.equipeId}_${d.p.data}`;
  return base.replace(/[\\/:*?"<>|\s]+/g,"_");
}
function exportarProgLogXlsx(id){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const d = logProgDados(id);
  if(!d || d.linhas.length===0){ toast("Esta programação não tem OS para exportar."); return; }
  const linhas = d.linhas.map((l,i)=>({
    "Ordem": i+1, "OS": l.os, "Alimentador": l.alim, "Tipo": l.tipo, "Localidade": l.localidade,
    "Latitude": l.lat, "Longitude": l.lng,
    "Previsto": l.prev, "Realizado": l.real,
    "Google Maps": l.link, "Observação": l.obs
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  // o link vira hiperlink clicável no Excel
  d.linhas.forEach((l,i)=>{ if(l.link){ const c = ws["J"+(i+2)]; if(c) c.l = { Target:l.link, Tooltip:"Abrir no Google Maps" }; } });
  ws["!cols"] = [{wch:7},{wch:24},{wch:16},{wch:14},{wch:22},{wch:12},{wch:12},{wch:10},{wch:10},{wch:46},{wch:40}];
  const s = d.p.vinculoResumo || {};
  const meta = XLSX.utils.aoa_to_sheet([
    ["Equipe", d.p.equipeId], ["Data", fmtDate(d.p.data)],
    ["Proteção / elemento", d.p.elemento || d.p.alimentador || ""], ["Alimentador", d.p.alimentador || ""],
    ["Localidade", d.p.localidade || ""], ["SIS / WR", d.p.siswr || ""],
    ["Status", d.p.status || ""], ["Qtd. de OS", d.linhas.length],
    ["Poda", s.poda||0], ["Faixa", s.faixa||0], ["Estrutura", s.estrutura||0],
    ["Observação da programação", d.p.observacoes || ""]
  ]);
  meta["!cols"] = [{wch:28},{wch:50}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "OS");
  XLSX.utils.book_append_sheet(wb, meta, "Programação");
  XLSX.writeFile(wb, logProgNomeArquivo(d) + ".xlsx");
  toast(`${d.linhas.length} OS exportada(s) para Excel.`);
}
async function exportarProgLogPdf(id){
  const d = logProgDados(id);
  if(!d || d.linhas.length===0){ toast("Esta programação não tem OS para exportar."); return; }
  if(logProgWaypoints(d,true).todos.length>1) toast("Calculando a rota por ruas…");
  const rr = (logProgWaypoints(d,true).todos.length>1) ? await logProgRotaRuas(d, true) : null;
  const s = d.p.vinculoResumo || {};
  const linhasHtml = d.linhas.map((l,i)=>`<tr>
      <td class="num">${i+1}</td><td class="mono">${escapeHtml(l.os)}</td><td>${escapeHtml(l.tipo)}</td><td>${escapeHtml(l.localidade)}</td>
      <td class="mono">${l.lat===""?"—":l.lat}</td><td class="mono">${l.lng===""?"—":l.lng}</td>
      <td class="num">${escapeHtml(l.prev)}</td><td class="num">${escapeHtml(l.real)}</td>
      <td>${l.link ? `<a href="${l.link}">${l.link.replace("https://www.","")}</a>` : "—"}</td>
      <td>${escapeHtml(l.obs)}</td></tr>`).join("");
  const alimsPdf = [...new Set(d.linhas.map(l=>l.alim).filter(Boolean))].join(", ");
  let el = document.getElementById("printProg");
  if(!el){ el = document.createElement("div"); el.id = "printProg"; document.body.appendChild(el); }
  el.innerHTML = `
    <h1>${escapeHtml(d.p.equipeId)} · ${fmtDate(d.p.data)}</h1>
    <p class="pp-sub">${escapeHtml(d.p.elemento || d.p.alimentador || "")}${alimsPdf ? " · Alimentador: "+escapeHtml(alimsPdf) : ""}${d.p.localidade ? " · "+escapeHtml(d.p.localidade) : ""}${d.p.siswr ? " · "+escapeHtml(d.p.siswr) : ""}</p>
    <p class="pp-sub">Poda ${s.poda||0} · Faixa ${s.faixa||0} · Estrutura ${s.estrutura||0} · ${d.linhas.length} OS${rr ? " · "+logProgRotaRuasTexto(rr, d) : ""}${d.p.observacoes ? " · Obs.: "+escapeHtml(d.p.observacoes) : ""}</p>
    <table class="${d.linhas.length>12?"pp-compacta":""}"><thead><tr><th>Ordem</th><th>OS</th><th>Tipo</th><th>Localidade</th><th>Latitude</th><th>Longitude</th><th>Previsto</th><th>Realizado</th><th>Google Maps</th><th>Observação</th></tr></thead>
    <tbody>${linhasHtml}</tbody></table>
    <p class="pp-rodape">Gerado pelo SPARK em ${new Date().toLocaleString("pt-BR")}</p>`;
  // v2.15.49: última página = mapa das OS (página cheia)
  const pts = logProgPontos(d);
  if(pts.length){
    toast("Montando o mapa para o PDF…");
    const img = await logProgMapaImagem(pts, 1750, 1000, rr, null);
    if(img){
      el.innerHTML += `<div class="pp-mapa-pagina"><h2>Localização das OS — ${escapeHtml(d.p.equipeId)} · ${fmtDate(d.p.data)}</h2>
        <img src="${img}" alt="Mapa das OS">
        <p class="pp-leg">${rr ? `Ordem de percurso sugerida (entre as OS): ${logProgRotaRuasTexto(rr, d)}. Linha azul = caminho por ruas. ` : (pts.length>1 ? `Ordem de percurso sugerida (entre as OS): ≈ ${(Math.round(pts.slice(1).reduce((t,q,i)=>t+logProgKm(pts[i],q),0)*10)/10).toLocaleString("pt-BR")} km em linha reta (rota por ruas indisponível no momento). ` : "")}Os números do mapa são os da coluna "Ordem" da tabela.</p></div>`;
    }
  }
  const antes = document.title;
  document.title = logProgNomeArquivo(d);
  document.body.classList.add("imprimindo-prog");
  const fim = ()=>{ document.body.classList.remove("imprimindo-prog"); document.title = antes; el.innerHTML = ""; window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  setTimeout(()=>window.print(), 50);
}

let logLacunasCache = [];
function viewProgramacaoLacunas(){
  const lacunas = logLacunas();
  logLacunasCache = lacunas;
  const semanas = logSemanasParaLacunas();
  const baseAnalisada = logBaseParaLacunas();
  let analisadas = 0;
  semanas.forEach(s=> analisadas += new Set(baseAnalisada.filter(p=>logWeekOf(p.data)===s).map(p=>p.equipeId)).size);
  const totalDias = lacunas.reduce((s,x)=>s+x.faltando.length, 0);
  const maior = Math.max(0, ...lacunas.map(x=>x.faltando.length));
  return `
  <div class="card" style="margin-bottom:14px;">${logFiltrosHtml(logDadosEnriquecidos())}</div>
  <div class="grid cols-4" style="margin-bottom:14px;">
    <div class="card kpi"><div class="label">Equipes analisadas</div><div class="value">${analisadas}</div></div>
    <div class="card kpi"><div class="label">Equipes com lacunas</div><div class="value">${lacunas.length}</div></div>
    <div class="card kpi"><div class="label">Dias sem programação</div><div class="value">${totalDias}</div></div>
    <div class="card kpi"><div class="label">Maior lacuna</div><div class="value">${maior}</div></div>
  </div>
  <div class="card">
    <h3>Equipes com lacunas${semanas.length===1 ? " na semana de "+fmtDate(semanas[0]) : ""}</h3>
    <p style="color:var(--muted); font-size:12px; margin:-4px 0 12px;">Sem semana selecionada no filtro, mostra a semana mais recente com programação. Clique numa equipe pra ver o calendário.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Equipe</th><th>Origem</th><th>Regional</th><th>Semana</th><th>Dias sem programação</th><th></th></tr></thead>
      <tbody>
      ${lacunas.length===0 ? `<tr><td colspan="6"><div class="empty">${ic("empty")}<div>Nenhuma lacuna encontrada no filtro atual.</div></div></td></tr>` :
      lacunas.map((x,i)=>`
        <tr style="cursor:pointer;" onclick="abrirDetalheLacuna(${i})">
          <td class="mono"><b>${escapeHtml(x.equipeId)}</b></td>
          <td>${escapeHtml(x.origem)}</td>
          <td>${escapeHtml(x.regional)}</td>
          <td>${fmtDate(x.semana)}</td>
          <td><span class="pill bad">${x.faltando.length} dia(s)</span></td>
          <td><button class="btn btn-ghost btn-sm">Ver calendário</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>
  `;
}
function abrirDetalheLacuna(i){
  const x = logLacunasCache[i];
  if(!x) return;
  openModal(`
    <h2>${escapeHtml(x.equipeId)}</h2>
    <p class="modal-sub">${escapeHtml(x.origem)} · ${escapeHtml(x.regional)} · Semana de ${fmtDate(x.semana)}</p>
    <div class="grid cols-3" style="gap:8px;">
      ${x.dias.map(d=>{
        const ok = x.presentes.has(d);
        return `
        <div class="card" style="padding:10px; text-align:center; border-color:${ok?"var(--ok-fg)":"var(--bad-fg)"};">
          <b style="font-size:11px; text-transform:uppercase; color:var(--muted);">${new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"})}</b>
          <div style="font-size:12px; margin:4px 0;">${fmtDate(d)}</div>
          <div style="font-size:10.5px; font-weight:700; color:${ok?"var(--ok-fg)":"var(--bad-fg)"};">${ok?"PROGRAMADO":"SEM PROGRAMAÇÃO"}</div>
        </div>`;
      }).join("")}
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div>
  `);
}


/* v2.15.37 - aba "Entregam elemento": uma linha por ELEMENTO (proteção), resumindo as programações dele.
   Entrega = alguma programação do elemento tem "encerra as pendências" marcado; SIS = o das programações
   (se houver mais de um, mostra todos); programações canceladas não contam. */
let entregaFiltro = { busca:"", status:"", depto:"", regional:"", cidade:"", entrega:"sim", de:"", ate:"" };
function setEntregaFiltro(k,v){ entregaFiltro[k] = v; render(); }
function limparEntregaFiltro(){ entregaFiltro = { busca:"", status:"", depto:"", regional:"", cidade:"", entrega:"sim", de:"", ate:"" }; render(); }
let _entSig = null, _entRes = null;
function entregasElementos(){
  const hoje = new Date().toISOString().slice(0,10);
  const sig = progAssinatura() + "@" + hoje;
  if(_entSig===sig && _entRes) return _entRes;
  _entRes = entregasElementosCalc(hoje); _entSig = sig;
  return _entRes;
}
function entregasElementosCalc(hoje){
  const mapa = new Map();
  const idx = { get:(id)=>osPorId(id) };   // índice compartilhado (v3.0.1)
  (state.programacoes||[]).forEach(p=>{
    if(p.status==="Cancelada") return;
    const chave = String(p.protecaoId||"").trim().toUpperCase(); if(!chave) return;
    const osP = osDaProgramacao(p);
    const r = { os:osP, cidades:[...new Set(osP.map(o=>o.localidade||o.conjunto).filter(Boolean))], atrasada: p.status!=="Concluída" && p.dataFim < hoje && osP.some(o=>!osAtendida(o)) };
    let g = mapa.get(chave);
    if(!g){ g = { elemento:p.protecaoId, alimentadores:new Set(), cidades:new Set(), regionais:new Set(), deptos:new Set(), sis:new Set(), os:new Map(), progs:[], entrega:false, inicio:p.dataInicio, fim:p.dataFim, atrasada:false, pendente:false }; mapa.set(chave,g); }
    g.progs.push(p);
    if(p.alimentador) g.alimentadores.add(p.alimentador);
    (p.localidade ? [p.localidade] : r.cidades).forEach(c=>g.cidades.add(String(c).toUpperCase()));
    if(p.regional) g.regionais.add(String(p.regional).toUpperCase());
    (p.equipesIds||[]).forEach(id=>{ const e = equipeInfo(id); if(e){ if(e.departamento) g.deptos.add(String(e.departamento).toUpperCase()); if(!p.regional && e.regional) g.regionais.add(String(e.regional).toUpperCase()); } });
    if(String(p.numeroSIS||"").trim()) g.sis.add(String(p.numeroSIS).trim());
    r.os.forEach(o=>g.os.set(o.id,o));
    if(p.previstoConcluir) g.entrega = true;
    // v3.0.4 - programação cujas OS já foram TODAS atendidas (executada apontando para a primária) não deixa o elemento "A entregar", mesmo que o Controller ainda não tenha marcado Concluída
    const todasAtendidas = (p.osIds||[]).length>0 && (p.osIds||[]).every(id=>{ const o = osPorId(id); return o ? osAtendida(o) : execPorPrimaria().has(String(id).trim()); });
    if(p.status!=="Concluída" && !todasAtendidas) g.pendente = true;
    if(r.atrasada) g.atrasada = true;
    if(String(p.dataInicio) < String(g.inicio)) g.inicio = p.dataInicio;
    if(String(p.dataFim) > String(g.fim)) g.fim = p.dataFim;
  });
  return [...mapa.values()].map(g=>{
    const os = [...g.os.values()];
    g.qtdOS = os.length; g.pendOS = os.filter(o=>!osAtendida(o)).length;
    g.prev = os.reduce((t,o)=>t+qtdOS(o,"prev"),0); g.real = os.reduce((t,o)=>t+realizadoOS(o),0);
    g.situacao = g.pendente ? "A entregar" : "Entregue";
    return g;
  });
}
function entregasLista(){
  const f = entregaFiltro, q = f.busca.trim().toLowerCase();
  return entregasElementos().filter(g=>{
    if(f.entrega==="sim" && !g.entrega) return false;
    if(f.entrega==="nao" && g.entrega) return false;
    if(f.status && g.situacao!==f.status) return false;
    if(f.depto && !g.deptos.has(f.depto)) return false;
    if(f.regional && !g.regionais.has(f.regional)) return false;
    if(f.cidade && !g.cidades.has(f.cidade)) return false;
    if(f.de && String(g.fim) < f.de) return false;
    if(f.ate && String(g.inicio) > f.ate) return false;
    if(q){
      const txt = [g.elemento,[...g.alimentadores].join(" "),[...g.sis].join(" "),[...g.cidades].join(" "),[...g.os.keys()].join(" "),g.progs.map(p=>(p.equipesIds||[]).join(" ")).join(" ")].join(" ").toLowerCase();
      if(!txt.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=> (a.situacao===b.situacao ? 0 : (a.situacao==="A entregar" ? -1 : 1)) || String(a.inicio).localeCompare(String(b.inicio)) || String(a.elemento).localeCompare(String(b.elemento),"pt-BR",{numeric:true}));
}
function entregaVerProgramacoes(elemento){
  progFiltro = novoProgFiltro(String(elemento));
  progSoSemana = false; progPagina = 1; programacaoTab = "protecoes"; render();
}
function viewProgramacaoEntregas(){
  const todos = entregasElementos().filter(g=>g.entrega);
  const lista = entregasLista(), f = entregaFiltro;
  const opc = (valores, atual, rotulo) => `<option value="">${rotulo}</option>` + [...valores].sort((a,b)=>a.localeCompare(b,"pt-BR")).map(v=>`<option value="${escapeHtml(v)}" ${atual===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  const deptos = new Set(), regs = new Set(), cids = new Set();
  entregasElementos().forEach(g=>{ g.deptos.forEach(x=>deptos.add(x)); g.regionais.forEach(x=>regs.add(x)); g.cidades.forEach(x=>cids.add(x)); });
  const nEnt = lista.filter(g=>g.entrega).length, nA = lista.filter(g=>g.situacao==="A entregar").length, nE = lista.length - nA;
  const comSis = lista.filter(g=>g.sis.size).length;
  const temFiltro = f.busca || f.status || f.depto || f.regional || f.cidade || f.de || f.ate || f.entrega!=="sim";
  return `
  <div class="card ent-filtros" style="margin-bottom:14px;">
    <p style="color:var(--muted); font-size:12px; margin:0 0 12px;">Um elemento <strong>entrega</strong> quando alguma programação dele está marcada como "encerra as pendências do elemento de proteção". O SIS é o das programações do elemento. Programações canceladas não contam.</p>
    <div class="ent-grid">
      <div class="field ent-busca"><label>Buscar</label><input value="${escapeHtml(f.busca)}" placeholder="Elemento, alimentador, SIS, OS ou equipe" onchange="setEntregaFiltro('busca',this.value)"></div>
      <div class="field"><label>Departamento</label><select onchange="setEntregaFiltro('depto',this.value)">${opc(deptos,f.depto,"Todos")}</select></div>
      <div class="field"><label>Regional</label><select onchange="setEntregaFiltro('regional',this.value)">${opc(regs,f.regional,"Todas")}</select></div>
      <div class="field"><label>Cidade</label><select onchange="setEntregaFiltro('cidade',this.value)">${opc(cids,f.cidade,"Todas")}</select></div>
      <div class="field"><label>Situação</label><select onchange="setEntregaFiltro('status',this.value)">${["","A entregar","Entregue"].map(x=>`<option value="${x}" ${f.status===x?"selected":""}>${x||"Todas"}</option>`).join("")}</select></div>
      <div class="field"><label>Entrega</label><select onchange="setEntregaFiltro('entrega',this.value)">${[["sim","Entregam"],["nao","Não entregam"],["todos","Todos"]].map(([v,r])=>`<option value="${v}" ${f.entrega===v?"selected":""}>${r}</option>`).join("")}</select></div>
      <div class="field"><label>Datas de</label><input type="date" value="${f.de}" onchange="setEntregaFiltro('de',this.value)"></div>
      <div class="field"><label>até</label><input type="date" value="${f.ate}" onchange="setEntregaFiltro('ate',this.value)"></div>
      <div class="field ent-limpar"><button class="btn btn-ghost" onclick="limparEntregaFiltro()" ${temFiltro?"":"disabled"}>Limpar filtros</button></div>
    </div>
  </div>
  <div class="card">
    <div class="card-head" style="margin-bottom:10px;">
      <h3 style="margin:0;">${lista.length} elemento(s) · ${nA} a entregar · ${nE} entregue(s) · ${comSis} com SIS</h3>
      <button class="btn btn-ghost btn-sm" onclick="exportarEntregasXlsx()" ${lista.length?"":"disabled"}>${ic("download")} Exportar (.xlsx)</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Situação</th><th>Elemento (proteção)</th>${f.entrega!=="sim"?"<th>Entrega</th>":""}<th>Alimentador</th><th>Cidade</th><th>Regional</th><th>Depto</th><th>Datas</th><th>SIS</th><th>OS</th><th>Prev. / Real.</th><th>Prog.</th></tr></thead>
      <tbody>
      ${lista.length===0 ? `<tr><td colspan="12"><div class="empty">${ic("empty")}<div>Nenhum elemento no filtro atual.</div></div></td></tr>` :
      lista.map(g=>`
        <tr class="os-row" style="cursor:pointer;" onclick="entregaVerProgramacoes('${escapeHtml(String(g.elemento)).replace(/'/g,"\\'")}')" title="Ver as programações deste elemento">
          <td>${g.situacao==="Entregue" ? `<span class="pill ok">Entregue</span>` : `<span class="pill info">A entregar</span>`}${g.atrasada?` <span class="pill bad">${ic("warn")} Atrasada</span>`:``}</td>
          <td class="mono">${escapeHtml(g.elemento)}</td>
          ${f.entrega!=="sim" ? `<td>${g.entrega ? `<span class="pill ok">Entrega</span>` : `<span style="color:var(--muted);">Não</span>`}</td>` : ""}
          <td class="mono">${escapeHtml([...g.alimentadores].join(", "))}</td>
          <td>${escapeHtml([...g.cidades].join(", ")) || "—"}</td>
          <td>${escapeHtml([...g.regionais].join(", ")) || "—"}</td>
          <td>${escapeHtml([...g.deptos].join(", ")) || "—"}</td>
          <td style="white-space:nowrap;">${fmtDate(g.inicio)}${g.inicio!==g.fim? " – "+fmtDate(g.fim):""}</td>
          <td class="mono">${g.sis.size ? escapeHtml([...g.sis].join(", ")) : `<span style="color:var(--muted);">—</span>`}</td>
          <td class="num">${g.qtdOS} <span style="color:var(--muted);">(${g.pendOS} pend.)</span></td>
          <td class="mono" style="white-space:nowrap;">${g.qtdOS ? `${g.prev} / ${g.real}` : "—"}</td>
          <td class="num">${g.progs.length}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>`;
}
function exportarEntregasXlsx(){
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const lista = entregasLista();
  // previsto/realizado separados por tipo de serviço (cada um leva um tempo diferente): poda e estrutura em unidades, faixa em m²
  const soma = (tipo, kind, g) => { let t = 0; g.os.forEach(o=>{ t += qtdTipoOS(o, tipo, kind) || 0; }); return Math.round(t*10)/10; };
  const linhas = lista.map(g=>({
    "Situação": g.situacao, "Elemento (proteção)": g.elemento, "Entrega": g.entrega ? "Sim" : "Não",
    "Alimentador": [...g.alimentadores].join(", "), "Cidade": [...g.cidades].join(", "), "Regional": [...g.regionais].join(", "), "Departamento": [...g.deptos].join(", "),
    "Início": fmtDate(g.inicio), "Fim": fmtDate(g.fim), "SIS": [...g.sis].join(", "),
    "Qtd OS": g.qtdOS, "OS pendentes": g.pendOS,
    "Poda prev. (un)": soma("poda","prev",g), "Poda real. (un)": soma("poda","real",g),
    "Limpeza de faixa prev. (m²)": soma("faixa","prev",g), "Limpeza de faixa real. (m²)": soma("faixa","real",g),
    "Estrutura prev. (un)": soma("estrutura","prev",g), "Estrutura real. (un)": soma("estrutura","real",g),
    "Programações": g.progs.length }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Entregam elemento");
  XLSX.writeFile(wb, `SPARK_Entregam_elemento_${prefHojeIso()}.xlsx`);
}

let logOportunidadesCache = [];
function viewProgramacaoOportunidades(){
  const ps = logDadosFiltrados();
  const oportunidades = logOportunidades(ps);
  logOportunidadesCache = oportunidades;
  return `
  <div class="card" style="margin-bottom:14px;">${logFiltrosHtml(logDadosEnriquecidos())}</div>
  <div class="card">
    <p style="color:var(--muted); font-size:12px; margin:0 0 12px;">Mesma equipe indo a destinos diferentes na mesma semana, com pelo menos um dia de intervalo entre atendimentos no mesmo lugar — sinal de que a sequência pode ser reagrupada pra reduzir deslocamento.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Regional</th><th>Equipe</th><th>Origem</th><th>Destino</th><th>Datas</th><th></th></tr></thead>
      <tbody>
      ${oportunidades.length===0 ? `<tr><td colspan="6"><div class="empty">${ic("empty")}<div>Nenhuma oportunidade logística no filtro atual.</div></div></td></tr>` :
      oportunidades.map((o,i)=>`
        <tr>
          <td>${escapeHtml(o.regional)}</td>
          <td class="mono">${escapeHtml(o.equipeId)}</td>
          <td>${escapeHtml(o.origem)}</td>
          <td>${escapeHtml(o.destino||"—")}</td>
          <td>${o.datas.map(d=>fmtDate(d)).join(", ")}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="abrirSugestaoLogistica(${i})">Ver sugestão</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>
  `;
}
function abrirSugestaoLogistica(i){
  const o = logOportunidadesCache[i];
  if(!o) return;
  const ps = logDadosFiltrados().filter(p=>p.equipeId===o.equipeId && logWeekOf(p.data)===o.semana);
  const doDestino = ps.filter(p=>String(p.localidade||p.alimentador||"").toUpperCase()===String(o.destino||"").toUpperCase());
  const outras = ps.filter(p=>String(p.localidade||p.alimentador||"").toUpperCase()!==String(o.destino||"").toUpperCase());
  const sequencia = [...doDestino, ...outras];
  openModal(`
    <h2>Sugestão logística</h2>
    <p class="modal-sub">Agrupar primeiro ${escapeHtml(o.destino||"—")}, pra reduzir o deslocamento da equipe ${escapeHtml(o.equipeId)}.</p>
    <div style="display:flex; flex-wrap:wrap; gap:6px; margin:12px 0;">
      ${sequencia.map((p,idx)=>`<span class="pill info">${idx+1}. ${escapeHtml(p.localidade||p.alimentador||"—")} · ${fmtDate(p.data)}</span>`).join("")}
    </div>
    <p style="color:var(--muted); font-size:11.5px;">Sugestão indicativa — não altera nenhuma programação.</p>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div>
  `);
}

function equipesProgramaveis(jaSelecionadas){
  // Só pode ser escalada a equipe que tem registro na base de Metas (mesmo
  // com meta 0). Equipe já salva na programação continua na lista.
  const comMeta = new Set((state.metas||[]).map(m=>m.equipeId));
  // v3.5.2 - equipe inativa só continua na lista se JÁ estava nesta programação (não dá para escalar de novo)
  return (state.equipes||[]).filter(e => (equipeAtiva(e) && comMeta.has(e.id)) || (jaSelecionadas||[]).includes(e.id));
}

/* Proteções/alimentadores conhecidos (fallback offline e sugestão do
   Alimentador). Com o Controller, a busca de Proteção usa a base de
   Proteção importada (/programacao/buscar-protecao). */
function protecoesConhecidas(){
  const s = new Set();
  state.manutencaoOS.forEach(o=>{ if(o.protecaoId) s.add(o.protecaoId); });
  state.programacoes.forEach(p=>{ if(p.protecaoId) s.add(p.protecaoId); });
  return Array.from(s).sort((a,b)=>a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
}
function alimentadoresConhecidos(){
  const s = new Set();
  state.manutencaoOS.forEach(o=>{ if(o.alimentador) s.add(o.alimentador); });
  state.programacoes.forEach(p=>{ if(p.alimentador) s.add(p.alimentador); });
  return Array.from(s).sort((a,b)=>a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
}
function preencherAlimentadorPelaProtecao(protecaoId){
  const alimentadorInput = document.getElementById("pgAlimentador");
  if(!alimentadorInput || alimentadorInput.value.trim()) return;
  const contagem = {};
  state.manutencaoOS.forEach(o=>{
    if(o.protecaoId === protecaoId.trim() && o.alimentador) contagem[o.alimentador] = (contagem[o.alimentador]||0) + 1;
  });
  const melhores = Object.entries(contagem).sort((a,b)=>b[1]-a[1]);
  if(melhores.length) alimentadorInput.value = melhores[0][0];
}

/* ---- busca de Proteção (base de Proteção importada) ---- */
let pgBuscaTimer = null, pgBuscaSeq = 0;
function pgBuscarProtecao(q){
  clearTimeout(pgBuscaTimer);
  const box = document.getElementById("pgProtResultados");
  if(!box) return;
  q = (q||"").trim();
  if(q.length < 2){ box.style.display = "none"; box.innerHTML = ""; return; }
  pgBuscaTimer = setTimeout(async ()=>{
    const seq = ++pgBuscaSeq;
    box.style.display = "block";
    box.innerHTML = `<div style="padding:8px; color:var(--muted); font-size:12px;">Buscando…</div>`;
    let itens = [];
    try{
      if(API_ONLINE){
        // a 1ª busca carrega a base de Proteção (~100 mil linhas) na memória do Controller: demora
        const r = await apiGet(`/programacao/buscar-protecao?q=${encodeURIComponent(q)}&limite=15`, 120000);
        itens = r.resultados || [];
      } else {
        const ql = q.toLowerCase();
        itens = protecoesConhecidas().filter(v=>v.toLowerCase().includes(ql)).slice(0,15).map(v=>{
          const o = state.manutencaoOS.find(x=>x.protecaoId===v);
          return { protecaoId:v, alimentador:o?o.alimentador:"" };
        });
      }
    }catch(e){
      if(seq!==pgBuscaSeq) return;
      itens = protecoesConhecidas().filter(v=>v.toLowerCase().includes(q.toLowerCase())).slice(0,15).map(v=>({ protecaoId:v, alimentador:"" }));
    }
    if(seq!==pgBuscaSeq) return;
    box.innerHTML = itens.length ? itens.map((it,i)=>`
      <div class="pg-res" onclick="pgEscolherProtecao(${i})" style="padding:7px 10px; cursor:pointer; border-bottom:1px solid var(--border);">
        <span class="mono"><strong>${escapeHtml(it.protecaoId||"")}</strong></span>
        <span style="color:var(--muted); font-size:12px;"> · ${escapeHtml(it.alimentador||"s/ alimentador")}${it.trecho?` · trecho ${escapeHtml(it.trecho)}`:""}</span>
      </div>`).join("") : `<div style="padding:8px; color:var(--muted); font-size:12px;">Nada encontrado — dá pra digitar a proteção mesmo assim.</div>`;
    box._itens = itens;
  }, 300);
}
function pgEscolherProtecao(i){
  const box = document.getElementById("pgProtResultados");
  const it = box && box._itens && box._itens[i];
  if(!it) return;
  document.getElementById("pgProtecao").value = it.protecaoId || "";
  if(it.alimentador) document.getElementById("pgAlimentador").value = it.alimentador;
  box.style.display = "none";
}

/* ---- seleção ordenada de equipes ---- */
let pgEquipesSel = [];   // ids na ordem escolhida (é a ordem gravada)
let pgEquipesOpcoes = [];
function pgRenderEquipes(){
  const box = document.getElementById("pgEquipesLista");
  const chips = document.getElementById("pgEquipesSelecionadas");
  if(!box || !chips) return;
  const q = ((document.getElementById("pgEquipeBusca")||{}).value||"").trim().toLowerCase();
  const polo = (document.getElementById("pgEquipePolo")||{}).value||"";
  const reg = (document.getElementById("pgEquipeRegional")||{}).value||"";
  const dI = (document.getElementById("pgInicio")||{}).value||"", dF = (document.getElementById("pgFim")||{}).value||dI;
  const indispDe = id => indispNoPeriodo(id, dI, dF);
  const lista = pgEquipesOpcoes.filter(e=>
    (!q || String(e.id).toLowerCase().includes(q)) &&
    (!polo || e.polo===polo) && (!reg || e.regional===reg));
  box.innerHTML = lista.length ? lista.map(e=>`
    <label class="check-row" style="display:flex; align-items:center; gap:8px; padding:4px 8px; margin:0; border-bottom:1px solid var(--border);">
      <input type="checkbox" ${pgEquipesSel.includes(e.id)?"checked":""} onchange="pgToggleEquipe('${escapeHtml(e.id).replace(/'/g,"\\'")}')">
      <span class="mono" style="flex:1;">${escapeHtml(e.id)}${equipeAtiva(e)?"":` <span class="pill bad" title="Equipe inativa: não pode receber programação nova">Inativa</span>`}${indispDe(e.id).length?` <span class="pill bad" title="${escapeHtml(indispDe(e.id).map(i=>`${indispPeriodoTxt(i)} · ${i.tipo}`).join(" | "))}">Indisponível</span>`:""}</span>
      <span style="color:var(--muted); font-size:11.5px;">${escapeHtml(e.polo||"")}${e.proprioTerceiro?` · ${escapeHtml(e.proprioTerceiro)}`:""}</span>
    </label>`).join("") : `<div style="padding:10px; color:var(--muted); font-size:12px;">Nenhuma equipe nesse filtro.</div>`;
  chips.innerHTML = pgEquipesSel.length ? pgEquipesSel.map((id,i)=>`
    <span class="pill ${indispDe(id).length?"bad":"info"}" style="display:inline-flex; align-items:center; gap:4px;">
      <span class="mono">${i+1}. ${escapeHtml(id)}${indispDe(id).length?" ⚠":""}${equipeIdAtiva(id)?"":" (inativa)"}</span>
      <button class="btn-link" type="button" title="Subir" onclick="pgMoverEquipe(${i},-1)" style="border:0; background:none; cursor:pointer;">↑</button>
      <button class="btn-link" type="button" title="Descer" onclick="pgMoverEquipe(${i},1)" style="border:0; background:none; cursor:pointer;">↓</button>
      <button class="btn-link" type="button" title="Remover" onclick="pgToggleEquipe('${escapeHtml(id).replace(/'/g,"\\'")}')" style="border:0; background:none; cursor:pointer;">×</button>
    </span>`).join("") : `<span style="color:var(--muted); font-size:12px;">Nenhuma equipe escolhida ainda — uma OS pode ter mais de uma equipe, e a programação aparece para todas.</span>`;
  const av = document.getElementById("pgIndispAviso");
  if(av){
    const linhas = pgEquipesSel.flatMap(id=>indispDe(id).map(i=>`<li><strong class="mono">${escapeHtml(id)}</strong> indisponível de ${indispPeriodoTxt(i)} — ${escapeHtml(i.tipo||"")}${i.texto?` (${escapeHtml(i.texto)})`:""}</li>`));
    av.innerHTML = linhas.length ? `<div class="note" style="margin-bottom:8px; background:#FDF1EF; color:#8E2A1E; border:1px solid #C0392B;">${ic("warn")}<div><strong>Atenção: equipe indisponível no período da programação.</strong><ul style="margin:4px 0 0 16px; padding:0;">${linhas.join("")}</ul></div></div>` : "";
  }
}
function pgToggleEquipe(id){
  const i = pgEquipesSel.indexOf(id);
  if(i>=0) pgEquipesSel.splice(i,1); else pgEquipesSel.push(id);
  pgRenderEquipes();
}
function pgMoverEquipe(i, delta){
  const j = i+delta;
  if(j<0 || j>=pgEquipesSel.length) return;
  [pgEquipesSel[i], pgEquipesSel[j]] = [pgEquipesSel[j], pgEquipesSel[i]];
  pgRenderEquipes();
}

let programacaoModalEditando = null;   // id da programação em edição (null = nova)
let programacaoModalOsIds = []; // OS (de manutencaoOS) vinculadas à programação sendo criada/editada no modal
let programacaoModalOrigem = ""; // v2.15.19 - de onde a programação nova saiu: "Mapa" (OS marcadas no mapa/grid) ou "Proteções" (botão Nova programação)

function openProgramacaoModal(id, osIdsPreSelecionadas){
  if(id ? !progPodeEditar() : !progPodeCriar()){ toast("Seu perfil só pode visualizar — sem permissão para " + (id ? "editar" : "criar") + " programação."); return; }
  const p = id ? state.programacoes.find(x=>x.id===id) : null;
  programacaoModalOsIds = (p ? (p.osIds || []) : (osIdsPreSelecionadas || [])).slice();
  programacaoModalEditando = p ? p.id : null;
  if(!p) programacaoModalOrigem = (osIdsPreSelecionadas && osIdsPreSelecionadas.length) ? "Mapa" : "Proteções";
  const osVinculadas = programacaoModalOsIds.map(osId => osPorId(osId)).filter(Boolean);
  const protecoesUnicas = new Set(osVinculadas.map(o=>o.protecaoId));
  const alimentadoresUnicos = new Set(osVinculadas.map(o=>o.alimentador));
  const protecaoPre = p ? p.protecaoId : (protecoesUnicas.size===1 ? [...protecoesUnicas][0] : '');
  // v2.13.29 - alimentador mais frequente quando as OS tem varios; cidade/polo/regional automaticos
  const contAlim = {}; osVinculadas.forEach(o=>{ if(o.alimentador) contAlim[o.alimentador]=(contAlim[o.alimentador]||0)+1; });
  const alimMaisFreq = Object.entries(contAlim).sort((a,b)=>b[1]-a[1]).map(x=>x[0])[0] || '';
  const alimentadorPre = p ? p.alimentador : (alimentadoresUnicos.size===1 ? [...alimentadoresUnicos][0] : alimMaisFreq);
  const cidadesAuto = [...new Set(osVinculadas.map(cidadeDaOS).filter(Boolean))];
  const polosAuto = [...new Set(osVinculadas.map(o=>municipioDaOS(o)).filter(Boolean))];
  const regionaisAuto = [...new Set(osVinculadas.map(o=>regionalDaOS(o)).filter(Boolean))];
  const cidadePre = p ? (p.localidade||"") : cidadesAuto.join(", ");
  const poloPre = p ? (p.polo||"") : polosAuto.join(", ");
  const regionalPre = p ? (p.regional||"") : regionaisAuto.join(", ");
  pgEquipesSel = p ? (p.equipesIds||[]).slice() : [];
  // ordem da lista: polo, depois nome — facilita achar a equipe da região
  pgEquipesOpcoes = equipesProgramaveis(pgEquipesSel).slice().sort((a,b)=>
    String(a.polo||"").localeCompare(String(b.polo||""),"pt-BR",{sensitivity:"base"}) ||
    String(a.id).localeCompare(String(b.id),"pt-BR",{sensitivity:"base",numeric:true}));
  const polos = [...new Set(pgEquipesOpcoes.map(e=>e.polo).filter(Boolean))].sort();
  const regionais = [...new Set(pgEquipesOpcoes.map(e=>e.regional).filter(Boolean))].sort();
  const previstoTotal = osVinculadas.reduce((s,o)=>s+qtdOS(o,"prev"), 0);
  const alimentadoresOpt = alimentadoresConhecidos();
  const planoAtual = p ? (p.plano||p.tipoPlano||"") : "";
  const planos = listaNomes("plano");
  if(planoAtual && !planos.includes(planoAtual)) planos.push(planoAtual);
  const eqNec = listaNomes("equipeNecessaria");
  const eqNecAtual = p ? (p.equipeNecessaria || (p.desligamento==="DS" ? "LM - DESLIGAMENTO" : p.desligamento==="LV" ? "LINHA VIVA" : "")) : "";
  if(eqNecAtual && !eqNec.includes(eqNecAtual)) eqNec.push(eqNecAtual);
  const hoje = new Date().toISOString().slice(0,10);
  openModal(`
    <h2>${p? "Editar programação" : "Nova programação"}</h2>
    <p class="modal-sub">Cancelar não exclui o registro — apenas altera o status; as OS voltam a Pendente / A reprogramar.</p>
    <div class="note" id="pgOsBox" style="margin-bottom:12px;">
      ${ic("info")||""}
      <div id="pgOsBoxInner">${pgOsBoxHtml()}</div>
    </div>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field" style="position:relative;"><label>Proteção <span style="color:var(--muted); font-weight:400;">(digite 2+ letras para buscar)</span></label>
        <input id="pgProtecao" autocomplete="off" value="${escapeHtml(protecaoPre)}" placeholder="ex.: V0488-7" oninput="pgBuscarProtecao(this.value); preencherAlimentadorPelaProtecao(this.value)">
        <div id="pgProtResultados" style="display:none; position:absolute; z-index:5; left:0; right:0; max-height:220px; overflow:auto; background:var(--surface); border:1px solid var(--border-hi); border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,.12);"></div>
      </div>
      <div class="field"><label>Alimentador</label>
        <input id="pgAlimentador" list="dlAlimentadores" value="${escapeHtml(alimentadorPre)}" placeholder="ex.: AS1C03">
        <datalist id="dlAlimentadores">${alimentadoresOpt.slice(0,800).map(v=>`<option value="${escapeHtml(v)}">`).join("")}</datalist>
      </div>
    </div>
    <p id="pgAutoDica" style="color:var(--muted); font-size:11.5px; margin:-4px 0 12px;"></p>
    <div style="margin-bottom:12px;">
      <div class="field campo-logistica" id="pgCidadeBox"><label>Cidade / localidade <span class="tag-obrig">OBRIGATÓRIO · Logística</span></label><input id="pgCidade" data-auto="${escapeHtml(cidadesAuto.join(", "))}" value="${escapeHtml(cidadePre)}" placeholder="preenchida pelas OS — confira ou digite" oninput="pgCidadeValida()"><p class="campo-logistica-dica">A Logística compara as programações por este campo. Sem ele não grava.</p></div>
    </div>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field"><label>Polo</label><input id="pgPolo" data-auto="${escapeHtml(polosAuto.join(", "))}" value="${escapeHtml(poloPre)}"></div>
      <div class="field"><label>Regional</label><input id="pgRegional" data-auto="${escapeHtml(regionaisAuto.join(", "))}" value="${escapeHtml(regionalPre)}"></div>
    </div>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field"><label>Data início</label><input id="pgInicio" type="date" value="${p?p.dataInicio:hoje}" onchange="pgRenderEquipes()"></div>
      <div class="field"><label>Data fim</label><input id="pgFim" type="date" value="${p?p.dataFim:hoje}" onchange="pgRenderEquipes()"></div>
    </div>
    <div class="field" style="margin-bottom:12px;">
      <label>Equipe(s) <span style="color:var(--muted); font-weight:400;">— escolha uma ou mais; a ordem abaixo é a ordem gravada</span></label>
      <div id="pgEquipesSelecionadas" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;"></div>
      <div id="pgIndispAviso"></div>
      <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; margin-bottom:6px;">
        <input id="pgEquipeBusca" type="text" placeholder="Buscar equipe…" oninput="pgRenderEquipes()">
        <select id="pgEquipePolo" onchange="pgRenderEquipes()"><option value="">Polo: todos</option>${polos.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}</select>
        <select id="pgEquipeRegional" onchange="pgRenderEquipes()"><option value="">Regional: todas</option>${regionais.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}</select>
      </div>
      <div id="pgEquipesLista" style="max-height:190px; overflow:auto; border:1px solid var(--border-hi); border-radius:8px;"></div>
      <p style="color:var(--muted); font-size:11.5px; margin:6px 0 0;">Só aparecem equipes cadastradas na base de Metas (mesmo com meta zero) — é o que garante medir a produtividade depois.</p>
    </div>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field"><label>Plano</label>
        <select id="pgPlano"><option value="">— selecione —</option>${planos.map(x=>`<option value="${escapeHtml(x)}" ${planoAtual===x?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Equipe necessária</label>
        <select id="pgEquipeNecessaria"><option value="">— selecione —</option>${eqNec.map(x=>`<option value="${escapeHtml(x)}" ${eqNecAtual===x?"selected":""}>${escapeHtml(x)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="field-row" style="margin-bottom:12px;">
      <div class="field"><label>Número SIS</label><input id="pgSis" value="${p?escapeHtml(p.numeroSIS||''):''}" placeholder="ex.: WR 238025999"></div>
    </div>
    <div class="field" style="margin-bottom:12px;">
      <label>Observação</label>
      <textarea id="pgObs" rows="4" style="resize:vertical; min-height:80px;" placeholder="Escreva aqui o que for necessário sobre esta programação...">${p?escapeHtml(p.observacao||''):''}</textarea>
    </div>
    <label class="check-row">
      <input type="checkbox" id="pgConcluir" ${p&&p.previstoConcluir?"checked":""}>
      Esta programação encerra as pendências do elemento de proteção
    </label>
    <div class="modal-foot">
      ${p ? `<button class="btn btn-ghost" style="margin-right:auto;" onclick="abrirHistoricoProgramacao('${p.id}')" title="Quem alterou o quê e quando nesta programação">Histórico</button>` : ""}
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarProgramacao('${p?p.id:''}')">${ic("check")} Salvar</button>
    </div>
  `);
  { const mm = document.querySelector("#modalOverlay .modal"); if(mm) mm.classList.add("modal-largo"); }
  pgRenderEquipes();
  if(!p) pgAutoPreencherProtecao(osVinculadas, alimentadorPre, alimentadoresUnicos.size);
}
/* v2.13.29 - proteção automática: a do alimentador mais perto do centro das OS selecionadas */
/* v3.0.2 - tirar / adicionar OS na programação (popup Nova/Editar) */
function pgOsNorm(x){ return String(x||"").toUpperCase().replace(/\s+/g," ").trim(); }
function pgOsBoxHtml(){
  const lista = programacaoModalOsIds.map(id=>({ id, o:osPorId(id) }));
  const prev = lista.reduce((t,x)=>t+(x.o ? qtdOS(x.o,"prev") : 0), 0);
  return `<strong>${lista.length} OS vinculada(s)</strong> · previsto total: ${prev}
    <div class="os-vinc-lista">
      ${lista.map((x,i)=>`<span class="pill muted mono os-vinc-pill">${escapeHtml(x.id)}${x.o ? " · "+escapeHtml(x.o.localidade||x.o.conjunto||"—") : " · (não encontrada)"}${x.o && x.o.statusBase==="A reprogramar"?" · A reprogramar":""}${x.o && x.o._snap?" · fora da grid pendente":""}<button type="button" class="os-vinc-x" title="Tirar esta OS da programação" aria-label="Tirar ${escapeHtml(x.id)}" onclick="pgOsRemover(${i})">×</button></span>`).join("") || `<span style="color:var(--muted); font-size:12px;">Nenhuma OS vinculada.</span>`}
    </div>
    <div class="os-vinc-add">
      <input id="pgOsNova" type="text" autocomplete="off" placeholder="+ Adicionar OS (ex.: 007970/2026)" onkeydown="if(event.key==='Enter'){ event.preventDefault(); pgOsAdicionar(); }">
      <button type="button" class="btn btn-ghost btn-sm" onclick="pgOsAdicionar()">+ Adicionar</button>
    </div>
    <div id="pgOsMsg" class="os-vinc-msg" aria-live="polite"></div>`;
}
function pgOsMsg(txt, html){ const el = document.getElementById("pgOsMsg"); if(el){ if(html) el.innerHTML = txt; else el.textContent = txt; } }
function pgOsRefresh(){
  const el = document.getElementById("pgOsBoxInner"); if(el) el.innerHTML = pgOsBoxHtml();
  // programação NOVA: cidade/polo/regional/alimentador/proteção acompanham as OS enquanto o usuário não tiver mexido
  if(programacaoModalEditando) return;
  const os = programacaoModalOsIds.map(id=>osPorId(id)).filter(Boolean);
  const auto = {
    pgCidade: [...new Set(os.map(cidadeDaOS).filter(Boolean))].join(", "),
    pgPolo: [...new Set(os.map(o=>municipioDaOS(o)).filter(Boolean))].join(", "),
    pgRegional: [...new Set(os.map(o=>regionalDaOS(o)).filter(Boolean))].join(", ")
  };
  Object.keys(auto).forEach(k=>{
    const inp = document.getElementById(k); if(!inp) return;
    if(!inp.value.trim() || inp.value === (inp.dataset.auto||"")){ inp.value = auto[k]; }
    inp.dataset.auto = auto[k];
  });
  if(typeof pgCidadeValida==="function") pgCidadeValida();
  const prot = new Set(os.map(o=>o.protecaoId).filter(Boolean));
  const ip = document.getElementById("pgProtecao");
  if(ip && !ip.value.trim() && prot.size===1){ ip.value = [...prot][0]; preencherAlimentadorPelaProtecao(ip.value); }
}
function pgOsRemover(i){
  programacaoModalOsIds.splice(i,1);
  pgOsRefresh();
}
function pgOsAdicionarId(id){
  if(programacaoModalOsIds.includes(id)){ pgOsMsg("Essa OS já está nesta programação."); return; }
  const o = osPorId(id);
  if(!o){ pgOsMsg("OS não encontrada."); return; }
  if(o._snap){ pgOsMsg(`A OS ${id} não está mais na base pendente.`); return; }
  if(!ehProgramavel(o)){ pgOsMsg(`A OS ${id} está ${o.statusOS} e não pode ser programada.`); return; }
  const outra = (state.programacoes||[]).find(pg=>pg.status!=="Cancelada" && pg.status!=="Concluída" && pg.id!==programacaoModalEditando && (pg.osIds||[]).includes(id));
  programacaoModalOsIds.push(id);
  pgOsRefresh();
  pgOsMsg(outra ? `OS ${id} adicionada — ela já está na programação de ${(outra.equipesIds||[]).join(", ")||"—"} (${fmtDate(outra.dataInicio)}); ao salvar você escolhe mover ou manter nas duas.` : `OS ${id} adicionada.`);
  const inp = document.getElementById("pgOsNova"); if(inp){ inp.value = ""; inp.focus(); }
}
function pgOsAdicionar(){
  const inp = document.getElementById("pgOsNova"); if(!inp) return;
  const q = pgOsNorm(inp.value);
  if(!q){ pgOsMsg("Digite o número da OS."); return; }
  const exata = osPorId(inp.value.trim()) || state.manutencaoOS.find(o=>pgOsNorm(o.id)===q);
  if(exata){ pgOsAdicionarId(exata.id); return; }
  const ach = [];
  for(const o of state.manutencaoOS){ if(pgOsNorm(o.id).includes(q)){ ach.push(o); if(ach.length>=200) break; } }
  if(!ach.length){ pgOsMsg("Nenhuma OS encontrada com esse número. Confira se ela já foi importada."); return; }
  const prog = ach.filter(ehProgramavel).filter(o=>!programacaoModalOsIds.includes(o.id));
  if(!prog.length){
    const o = ach[0];
    pgOsMsg(programacaoModalOsIds.includes(o.id) ? "Essa OS já está nesta programação." : `A OS ${o.id} está ${o.statusOS} e não pode ser programada.`);
    return;
  }
  if(prog.length===1){ pgOsAdicionarId(prog[0].id); return; }
  pgOsMsg(`${prog.length>12?"Várias OS encontradas (mostrando 12). ":"Escolha a OS: "}` + prog.slice(0,12).map(o=>`<button type="button" class="pill muted mono os-vinc-pill os-vinc-escolher" onclick='pgOsAdicionarId(${JSON.stringify(o.id).replace(/'/g,"&#39;")})'>${escapeHtml(o.id)} · ${escapeHtml(o.localidade||o.conjunto||"—")} · ${escapeHtml(o.statusOS)}</button>`).join(" "), true);
}
async function pgAutoPreencherProtecao(osVinculadas, alimentador, qtdAlimentadores){
  const dica = document.getElementById("pgAutoDica");
  const inpProt = document.getElementById("pgProtecao");
  if(!inpProt || inpProt.value.trim() || !alimentador) {
    if(dica && qtdAlimentadores>1) dica.textContent = `As OS selecionadas têm ${qtdAlimentadores} alimentadores — usei o mais frequente (${alimentador}); ajuste se precisar.`;
    return;
  }
  if(dica) dica.textContent = qtdAlimentadores>1
    ? `As OS selecionadas têm ${qtdAlimentadores} alimentadores — usei o mais frequente (${alimentador}). Buscando a proteção…`
    : "Buscando a proteção mais próxima…";
  const pts = osVinculadas.filter(o=>typeof o.lat==="number" && typeof o.lng==="number" && o.alimentador===alimentador && !o.aprox);
  const base = pts.length ? pts : osVinculadas.filter(o=>typeof o.lat==="number" && typeof o.lng==="number");
  const lat = base.length ? base.reduce((s,o)=>s+o.lat,0)/base.length : "";
  const lng = base.length ? base.reduce((s,o)=>s+o.lng,0)/base.length : "";
  try{
    if(!API_ONLINE) throw new Error("offline");
    const r = await apiGet(`/programacao/protecao-proxima?alimentador=${encodeURIComponent(alimentador)}&lat=${lat}&lng=${lng}`, 120000);
    const el = document.getElementById("pgProtecao");
    if(!el || el.value.trim()) return;
    if(r && r.encontrada){
      el.value = r.protecaoId || "";
      if(dica) dica.textContent = `Proteção preenchida automaticamente (${r.protecaoId}${r.distanciaM!=null?`, a ~${r.distanciaM} m do centro das OS`:""}; o alimentador tem ${r.total} proteção(ões)). Confira e troque se preciso.`;
    } else if(dica){
      dica.textContent = r && r.total ? `O alimentador ${alimentador} tem ${r.total} proteções e as OS não têm coordenada para escolher a mais próxima — busque pela Proteção.` : `Não achei proteção para o alimentador ${alimentador} na base de Proteção.`;
    }
  }catch(e){
    if(dica) dica.textContent = "Não consegui buscar a proteção automaticamente — digite 2+ letras no campo Proteção.";
  }
}
/* v2.14.1 - Cidade/localidade obrigatória (a Logística compara por ela): borda vermelha enquanto vazia */
function pgCidadeValida(marcar){
  const el = document.getElementById("pgCidade"), box = document.getElementById("pgCidadeBox");
  if(!el) return true;
  const ok = !!el.value.trim();
  if(box) box.classList.toggle("invalido", !ok && (marcar===true || box.classList.contains("invalido")));
  return ok;
}
/* v3.0.7 - cópia da OS enviada ao Controller junto com a programação (ele guarda dentro dela; nunca sobrescreve a que já tem) */
function osParaSnap(o){
  return { id:o.id, origem:o.origem, statusOS:o.statusOS, tipoServico:o.tipoServico, tipoEquipeNecessaria:o.tipoEquipeNecessaria, tipoEquipeExec:o.tipoEquipeExec, trecho:o.trecho,
    osPrimaria:o.osPrimaria, alimentador:o.alimentador, conjunto:o.conjunto, protecaoId:o.protecaoId, localidade:o.localidade, dataAbertura:o.dataAbertura, dataExecucao:o.dataExecucao,
    previsto:o.previsto, realizado:o.realizado, previstoPoda:o.previstoPoda, previstoLimpeza:o.previstoLimpeza, previstoEstrutura:o.previstoEstrutura,
    realizadoPoda:o.realizadoPoda, realizadoLimpeza:o.realizadoLimpeza, realizadoEstrutura:o.realizadoEstrutura, observacao:o.observacao, descEsquema:o.descEsquema, statusBase:o.statusBase,
    lat:o.lat, lng:o.lng, fonte:o.fonte };
}
function snapDasOS(ids){ return (ids||[]).map(i=>osPorId(i)).filter(o=>o && !o._snap).map(osParaSnap); }
function aposSalvarProgramacao(prog, resp){
  const rp = resp && resp.programacao; if(!rp) return;
  if(rp.osSnap) prog.osSnap = rp.osSnap;
  if(rp.execSnap) prog.execSnap = rp.execSnap;
  if(typeof reconstruirSnapMaps==="function") reconstruirSnapMaps();
}
/* ---- v3.4.0 - OS já em outra programação ativa + histórico (log) das programações ---- */
function pgConflitosOs(idEditando, osIds){
  const atual = idEditando ? (state.programacoes||[]).find(x=>x.id===idEditando) : null;
  const jaNesta = new Set((atual && atual.osIds || []).map(String));
  const porProg = new Map();
  (state.programacoes||[]).forEach(pg=>{
    if(pg.id===idEditando || pg.status==="Cancelada" || pg.status==="Concluída") return;
    const ids = new Set((pg.osIds||[]).map(String));
    (osIds||[]).map(String).forEach(o=>{
      if(jaNesta.has(o) || !ids.has(o)) return;
      if(!porProg.has(pg.id)) porProg.set(pg.id, { p:pg, os:[] });
      porProg.get(pg.id).os.push(o);
    });
  });
  return [...porProg.values()];
}
let _pgDecisaoId = "";
function pgFecharOverlay(){ const o = document.getElementById("pgOverlayExtra"); if(o) o.remove(); }
function pgAbrirOverlay(html){
  pgFecharOverlay();
  const d = document.createElement("div"); d.id = "pgOverlayExtra"; d.className = "pg-ov";
  d.innerHTML = `<div class="pg-ov-box" role="dialog" aria-modal="true">${html}</div>`;
  d.addEventListener("mousedown", e=>{ if(e.target===d) pgFecharOverlay(); });
  document.body.appendChild(d);
}
function pgDecidirMover(id, conf){
  _pgDecisaoId = id || "";
  const total = conf.reduce((n,c)=>n+c.os.length,0);
  const linhas = conf.map(c=>`<li><b>${c.os.length} OS</b> (${c.os.slice(0,4).map(escapeHtml).join(", ")}${c.os.length>4?"…":""}) na programação de <b>${escapeHtml((c.p.equipesIds||[]).join(", ")||"—")}</b> · ${fmtDate(c.p.dataInicio)}${c.p.dataFim && c.p.dataFim!==c.p.dataInicio ? " a "+fmtDate(c.p.dataFim) : ""}${c.p.protecaoId ? " · "+escapeHtml(c.p.protecaoId) : ""}</li>`).join("");
  pgAbrirOverlay(`<h3>${total===1 ? "Esta OS já está em outra programação" : `${total} OS já estão em outra programação`}</h3>
    <ul class="pg-ov-lista">${linhas}</ul>
    <p class="pg-ov-txt"><b>Mover</b> tira a(s) OS da programação anterior e deixa só nesta (fica registrado no histórico das duas). <b>Manter nas duas</b> deixa a OS nas duas programações.</p>
    <div class="pg-ov-foot">
      <button class="btn btn-ghost" type="button" onclick="pgFecharOverlay()">Cancelar</button>
      <button class="btn btn-ghost" type="button" onclick="pgDecisao('manter')">Manter nas duas</button>
      <button class="btn btn-primary" type="button" onclick="pgDecisao('mover')">Mover para esta</button>
    </div>`);
}
function pgDecisao(modo){ pgFecharOverlay(); salvarProgramacao(_pgDecisaoId, modo); }
const PG_LOG_CAMPOS = { protecaoId:"Proteção", alimentador:"Alimentador", dataInicio:"Início", dataFim:"Fim", equipesIds:"Equipes", numeroSIS:"SIS/WR", plano:"Plano", equipeNecessaria:"Equipe necessária", desligamento:"Desligamento", observacao:"Observação", localidade:"Cidade", polo:"Polo", regional:"Regional", previstoConcluir:"Encerra pendências", status:"Status" };
const PG_LOG_ACOES = { criar:"Criou", editar:"Editou", status:"Status", "mover-saida":"OS movida para outra programação", "mover-entrada":"OS movida de outra programação" };
function pgLogValor(v){ const t = String(v==null?"":v); return /^\d{4}-\d\d-\d\d/.test(t) ? fmtDate(t.slice(0,10)) : (t==="true"?"sim":(t==="false"?"não":(t||"—"))); }
function pgLogDetalhe(ev){
  const partes = [];
  (ev.m||[]).forEach(m=>{
    const rot = PG_LOG_CAMPOS[m.c] || m.c;
    partes.push(ev.a==="criar" ? `${rot}: ${escapeHtml(pgLogValor(m.para))}` : `<b>${escapeHtml(rot)}</b>: ${escapeHtml(pgLogValor(m.de))} → ${escapeHtml(pgLogValor(m.para))}`);
  });
  if((ev.add||[]).length) partes.push(`<b>OS incluída(s):</b> ${escapeHtml(ev.add.slice(0,12).join(", "))}${ev.add.length>12?` … (+${ev.add.length-12})`:""}`);
  if((ev.rem||[]).length) partes.push(`<b>OS retirada(s):</b> ${escapeHtml(ev.rem.slice(0,12).join(", "))}${ev.rem.length>12?` … (+${ev.rem.length-12})`:""}`);
  if(ev.ref){ const o = (state.programacoes||[]).find(x=>x.id===ev.ref); partes.push(`<span style="color:var(--muted);">${ev.a==="mover-saida"?"para":"de"}: ${o ? escapeHtml((o.equipesIds||[]).join(", ")||"—")+" · "+fmtDate(o.dataInicio) : "outra programação"}</span>`); }
  return partes.join("<br>") || "—";
}
async function abrirHistoricoProgramacao(id){
  if(!API_ONLINE){ pgAbrirOverlay(`<h3>Histórico</h3><p class="pg-ov-txt">O histórico só existe com o Controller ligado.</p><div class="pg-ov-foot"><button class="btn btn-ghost" onclick="pgFecharOverlay()">Fechar</button></div>`); return; }
  pgAbrirOverlay(`<h3>Histórico da programação</h3><p class="pg-ov-txt">Carregando…</p>`);
  try{
    const r = await apiGet(`/programacao/${encodeURIComponent(id)}/log`);
    const ev = (r && r.eventos) || [];
    const linhas = ev.map(e=>`<tr><td style="white-space:nowrap;">${escapeHtml(new Date(e.t).toLocaleString("pt-BR"))}</td><td>${escapeHtml(e.usuario||e.u||"")}</td><td>${escapeHtml(PG_LOG_ACOES[e.a]||e.a)}</td><td>${pgLogDetalhe(e)}</td></tr>`).join("");
    pgAbrirOverlay(`<h3>Histórico da programação</h3>
      ${ev.length ? `<div class="pg-ov-tabela"><table><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>${linhas}</tbody></table></div>` : `<p class="pg-ov-txt">Nenhuma alteração registrada ainda (o histórico começa a valer a partir desta versão).</p>`}
      <div class="pg-ov-foot"><button class="btn btn-ghost" onclick="pgFecharOverlay()">Fechar</button></div>`);
  }catch(e){
    pgAbrirOverlay(`<h3>Histórico da programação</h3><p class="pg-ov-txt">Não consegui carregar o histórico (${escapeHtml(String((e&&e.message)||e))}). Se acabou de atualizar o SPARK, reinicie o Controller.</p><div class="pg-ov-foot"><button class="btn btn-ghost" onclick="pgFecharOverlay()">Fechar</button></div>`);
  }
}
function salvarProgramacao(id, decisao){
  const protecaoId = document.getElementById("pgProtecao").value.trim();
  const alimentador = document.getElementById("pgAlimentador").value.trim();
  const dataInicio = document.getElementById("pgInicio").value;
  const dataFim = document.getElementById("pgFim").value;
  const equipesIds = pgEquipesSel.slice();
  const numeroSIS = document.getElementById("pgSis").value.trim();
  const observacao = document.getElementById("pgObs").value.trim();
  const plano = document.getElementById("pgPlano").value;
  const equipeNecessaria = document.getElementById("pgEquipeNecessaria").value;
  // legado: o campo antigo "desligamento" (DS/LV) continua sendo gravado, derivado da equipe necessária
  const desligamento = equipeNecessaria==="LM - DESLIGAMENTO" ? "DS" : "LV";
  const previstoConcluir = document.getElementById("pgConcluir").checked;
  if(!pgCidadeValida(true)){ toast("Preencha a Cidade / localidade — é obrigatória para a Logística."); const c = document.getElementById("pgCidade"); if(c) c.focus(); return; }
  if(!protecaoId || !alimentador || equipesIds.length===0){ toast("Preencha proteção, alimentador e ao menos uma equipe."); return; }
  {
    const jaTinha = new Set(((id && (state.programacoes||[]).find(x=>x.id===id)) || {}).equipesIds || []);
    const inativas = equipesIds.filter(e=>!equipeIdAtiva(e) && !jaTinha.has(e));
    if(inativas.length){ toast(`Equipe inativa não pode receber programação: ${inativas.join(", ")}. Ative em Gestão de Bases > Equipes ou escolha outra.`); return; }
  }
  if(!plano){ toast("Escolha o Plano da programação."); return; }
  if(!equipeNecessaria){ toast("Escolha a Equipe necessária."); return; }
  if(dataFim < dataInicio){ toast("A data fim não pode ser antes da data início."); return; }
  const indispSel = equipesIds.flatMap(eq=>indispNoPeriodo(eq, dataInicio, dataFim).map(i=>`• ${eq}: ${indispPeriodoTxt(i)} — ${i.tipo}`));
  if(indispSel.length && !decisao && !window.confirm(`Equipe(s) indisponível(is) no período desta programação:\n\n${indispSel.join("\n")}\n\nGravar mesmo assim?`)) return;

  const osIds = programacaoModalOsIds.slice();
  const localidade = (document.getElementById("pgCidade")||{}).value ? document.getElementById("pgCidade").value.trim() : "";
  const polo = (document.getElementById("pgPolo")||{}).value ? document.getElementById("pgPolo").value.trim() : "";
  const regional = (document.getElementById("pgRegional")||{}).value ? document.getElementById("pgRegional").value.trim() : "";
  const campos = { protecaoId, alimentador, dataInicio, dataFim, equipesIds, numeroSIS, observacao, plano, tipoPlano: plano, equipeNecessaria, desligamento, previstoConcluir, osIds, localidade, polo, regional };

  // v3.4.0 - OS que já estão em outra programação ativa: Mover / Manter nas duas / Cancelar
  const conf = pgConflitosOs(id, osIds);
  if(conf.length && !decisao){ pgDecidirMover(id, conf); return; }
  const moverOs = [], guardaAntigas = [];
  if(conf.length && decisao==="mover"){
    conf.forEach(c=>{
      c.os.forEach(o=>moverOs.push({ osId:o, de:c.p.id }));
      guardaAntigas.push({ p:c.p, osIds:(c.p.osIds||[]).slice(), osSnap:c.p.osSnap ? c.p.osSnap.slice() : undefined });
      c.p.osIds = (c.p.osIds||[]).filter(x=>!c.os.includes(String(x)));
      if(c.p.osSnap) c.p.osSnap = c.p.osSnap.filter(sn=>!c.os.includes(String(sn.id)));
    });
  }
  const restaurarAntigas = ()=>guardaAntigas.forEach(g=>{ g.p.osIds = g.osIds; if(g.osSnap) g.p.osSnap = g.osSnap; });
  const extraCorpo = moverOs.length ? { moverOs } : {};
  const vazias = conf.filter(c=>decisao==="mover" && (c.p.osIds||[]).length===0);
  if(vazias.length) setTimeout(()=>toast(`A programação de ${(vazias[0].p.equipesIds||[]).join(", ")||"—"} (${fmtDate(vazias[0].p.dataInicio)}) ficou sem OS — cancele-a se não for mais usada.`), 1800);

  if(id){
    const prog = state.programacoes.find(x=>x.id===id);
    const antes = {}; Object.keys(campos).forEach(k=>{ antes[k] = prog[k]; });
    Object.assign(prog, campos);
    enviarProgramacao({ p:prog, tipo:"editar", metodo:"PUT", pathFn:()=>`/programacao/${prog.id}`, corpo:{ ...campos, osSnap:snapDasOS(osIds), ...extraCorpo },
      desfazer:()=>{ Object.assign(prog, antes); restaurarAntigas(); },
      aoConcluir:resp=>{ aposSalvarProgramacao(prog, resp); if(resp && resp.avisosConflito && resp.avisosConflito.length) toast("Salvo com aviso: " + resp.avisosConflito[0]); } });
    toast("Programação atualizada.");
  } else {
    // v2.15.15 - o id (GUID) nasce aqui: se o envio precisar ser repetido o Controller reconhece e não duplica
    const idNovo = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : uid("p");
    const nova = { id:idNovo, ...campos, tipoProgramacao:"Poda", status:"Programada", programador:nomeAtual(), origemTela:programacaoModalOrigem };
    state.programacoes.push(nova);
    enviarProgramacao({ p:nova, tipo:"criar", metodo:"POST", pathFn:()=>"/programacao", corpo:{ ...campos, id:idNovo, tipoProgramacao:nova.tipoProgramacao, origemTela:programacaoModalOrigem, osSnap:snapDasOS(osIds), ...extraCorpo },
      desfazer:()=>{ const i = state.programacoes.indexOf(nova); if(i>=0) state.programacoes.splice(i,1); if(progSelecionadaId===nova.id) progSelecionadaId = null; restaurarAntigas(); },
      aoConcluir:resp=>{
        // se o Controller devolver outro id, passa a usar o dele (senão cancelar/editar depois dá 404)
        const rid = resp && resp.programacao && resp.programacao.id;
        if(rid && rid!==nova.id){ if(progSelecionadaId===nova.id) progSelecionadaId = rid; nova.id = rid; }
        aposSalvarProgramacao(nova, resp);
        if(resp && resp.avisosConflito && resp.avisosConflito.length) toast("Salvo com aviso: " + resp.avisosConflito[0]);
      } });
    toast("Programação criada.");
  }

  // OS Pendente / A reprogramar vinculadas passam a "Programada" (mesma regra do Controller)
  recalcularStatusOS();
  osSelecionadasProgramar.clear();
  progSemanaInicio = isoSegundaDe(dataInicio);   // mostra a semana da programação que acabou de ser salva
  closeModal();
  render();
}

/* =========================================================================
   VIEW: Envio às Prefeituras  (v2.13.34 - período, tipos de OS por prefeitura, Excel + KMZ)
   - Período (De/Até) vale para: Executada (data de execução) e Programada/
     Despachada (data da programação). Pendente / A reprogramar entram TODAS
     (foto de hoje), a não ser que marque "aplicar o período também às pendentes".
   - Cada prefeitura pode ter seus próprios tipos de OS e KMZ sim/não
     (botão "Configurar"); quem não tem configuração usa o padrão da tela.
   - Gera, por município, 1 Excel + 1 KMZ (Google Earth) e junta tudo num .zip.
   ========================================================================= */
let relatorioGerado = null;
const PREF_STATUS = ["Executada","Programada","Despachada","Pendente","A reprogramar","Cancelada"];
let prefConfig = {};                       // municipio -> { tiposOS:[..]|null, kmz:true|false|null }
let prefConfigCarregada = false;
let prefPeriodo = null;                    // { de, ate }
let prefTiposPadrao = new Set(["Executada","Programada","Despachada","Pendente","A reprogramar"]);
let prefKmzPadrao = true;
let prefAplicarPendentes = false;

function prefHojeIso(){ const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function prefSomaDias(iso, n){ const d = new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function prefPeriodoAtual(){
  if(!prefPeriodo){ const h = prefHojeIso(); prefPeriodo = { de:h, ate:prefSomaDias(h,6) }; }
  return prefPeriodo;
}
function prefPreset(k){
  const h = prefHojeIso();
  if(k==="prox7") prefPeriodo = { de:h, ate:prefSomaDias(h,6) };
  else if(k==="ult7") prefPeriodo = { de:prefSomaDias(h,-6), ate:h };
  else if(k==="mes"){ prefPeriodo = { de:h.slice(0,8)+"01", ate:h }; }
  else if(k==="mesAnt"){
    const d = new Date(h.slice(0,8)+"01T12:00:00"); d.setDate(0);
    const fim = d.toISOString().slice(0,10); prefPeriodo = { de:fim.slice(0,8)+"01", ate:fim };
  }
  prefRedesenharForm();
}
function prefSetPeriodo(campo, v){ prefPeriodoAtual()[campo] = v; prefRedesenharForm(); }
function prefToggleTipoPadrao(st, on){ if(on) prefTiposPadrao.add(st); else prefTiposPadrao.delete(st); }
function prefRedesenharForm(){ const el = document.getElementById("prefFormCard"); if(el) el.innerHTML = prefFormHtml(); }
function prefNorm(s){ return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim().toUpperCase(); }

function prefTiposDe(nome){ const c = prefConfig[nome]; return (c && Array.isArray(c.tiposOS) && c.tiposOS.length) ? c.tiposOS : Array.from(prefTiposPadrao); }
function prefKmzDe(nome){ const c = prefConfig[nome]; return (c && typeof c.kmz==="boolean") ? c.kmz : prefKmzPadrao; }

async function prefCarregarConfig(){
  if(!API_ONLINE){ prefConfigCarregada = true; return; }
  try{
    const lista = await apiGet("/prefeituras/config");
    prefConfig = {};
    (lista||[]).forEach(c=>{ prefConfig[c.municipio] = { tiposOS:c.tiposOS||null, kmz:(typeof c.kmz==="boolean")?c.kmz:null }; });
  }catch(e){ /* sem config salva: vale o padrão */ }
  prefConfigCarregada = true;
  const t = document.getElementById("prefMunicipiosCard"); if(t) t.innerHTML = prefMunicipiosHtml();
}

function prefMunicipiosHtml(){
  const podeEditar = minhaPermissao("prefeituras","editar");
  return `
    <div class="card-head"><h3>Municípios cadastrados</h3>${minhaPermissao("prefeituras","importar") ? `<button class="btn btn-ghost btn-sm" onclick="openImportModal('Contatos de Prefeituras')">${ic("upload")} Importar</button>` : ""}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Município</th><th>Contato</th><th>E-mail</th><th>Recebe</th><th>KMZ</th><th></th></tr></thead>
      <tbody>
        ${state.municipios.length===0 ? `<tr><td colspan="6"><div class="empty">${ic("empty")}<div>Nenhum município cadastrado — importe os contatos.</div></div></td></tr>` : state.municipios.map(m=>{
          const propria = prefConfig[m.nome] && Array.isArray(prefConfig[m.nome].tiposOS) && prefConfig[m.nome].tiposOS.length;
          const kmzPropria = prefConfig[m.nome] && typeof prefConfig[m.nome].kmz==="boolean";
          return `<tr>
            <td>${escapeHtml(m.nome)}</td><td>${escapeHtml(m.contatoNome||"")}</td><td class="mono">${escapeHtml(m.email||"")}</td>
            <td>${prefTiposDe(m.nome).map(t=>`<span class="pill" style="margin:1px; background:${statusColor[t]||"#64748b"}22; color:${statusColor[t]||"#64748b"};">${escapeHtml(t)}</span>`).join("")}${propria?"":` <span style="color:var(--muted); font-size:11px;">(padrão)</span>`}</td>
            <td>${prefKmzDe(m.nome) ? "Sim" : "Não"}${kmzPropria?"":` <span style="color:var(--muted); font-size:11px;">(padrão)</span>`}</td>
            <td style="white-space:nowrap;">${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="prefAbrirConfig(${escapeHtml(JSON.stringify(m.nome))})">Configurar</button>` : ""}</td>
          </tr>`; }).join("")}
      </tbody>
    </table></div>`;
}

function prefFormHtml(){
  const p = prefPeriodoAtual();
  const fmt = iso => iso ? fmtDate(iso) : "—";
  return `
    <h3>Gerar arquivos para as prefeituras</h3>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:28px; margin-top:10px; align-items:start;">
      <div>
        <div style="display:grid; grid-template-columns:repeat(2,minmax(150px,220px)); gap:10px;">
          <div class="field"><label>De</label><input type="date" value="${p.de}" onchange="prefSetPeriodo('de', this.value)"></div>
          <div class="field"><label>Até</label><input type="date" value="${p.ate}" onchange="prefSetPeriodo('ate', this.value)"></div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin:2px 0 12px;">
          <button class="btn btn-ghost btn-sm" onclick="prefPreset('prox7')">Próximos 7 dias</button>
          <button class="btn btn-ghost btn-sm" onclick="prefPreset('ult7')">Últimos 7 dias</button>
          <button class="btn btn-ghost btn-sm" onclick="prefPreset('mes')">Mês atual</button>
          <button class="btn btn-ghost btn-sm" onclick="prefPreset('mesAnt')">Mês anterior</button>
        </div>
        <div style="font-size:13px; padding-top:8px; border-top:1px solid var(--border,rgba(0,0,0,.1));"><span style="color:var(--muted);">Período:</span> <strong>${fmt(p.de)} a ${fmt(p.ate)}</strong></div>
      </div>
      <div>
        <div style="margin:0 0 4px; font-size:12.5px; font-weight:600;">Tipos de OS (padrão — vale para quem não tem configuração própria)</div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          ${PREF_STATUS.map(st=>`<label class="check-row" style="margin:0;"><input type="checkbox" ${prefTiposPadrao.has(st)?"checked":""} onchange="prefToggleTipoPadrao('${st}', this.checked)"> ${st}</label>`).join("")}
        </div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:4px;">
          <label class="check-row" style="margin:0;"><input type="checkbox" ${prefKmzPadrao?"checked":""} onchange="prefKmzPadrao=this.checked; document.getElementById('prefMunicipiosCard').innerHTML = prefMunicipiosHtml();"> Gerar também o KMZ (Google Earth) — padrão</label>
          <label class="check-row" style="margin:0;"><input type="checkbox" ${prefAplicarPendentes?"checked":""} onchange="prefAplicarPendentes=this.checked"> Aplicar o período também às pendentes / a reprogramar (pela data de abertura)</label>
        </div>
        <p style="color:var(--muted); font-size:11.5px; margin:8px 0 0;">Executada usa a data de execução; Programada/Despachada, a data da programação. Pendente e A reprogramar entram todas (foto de hoje), salvo a opção acima.</p>
        <div style="margin-top:14px;">
          <button class="btn btn-accent" onclick="gerarRelatorioPrefeituras()">${ic("mail")} Gerar arquivos</button>
        </div>
      </div>
    </div>`;
}

function viewPrefeituras(){
  return `
  <div class="card" id="prefFormCard">${prefFormHtml()}</div>
  <div class="card" style="margin-top:14px;" id="prefMunicipiosCard">${prefMunicipiosHtml()}</div>
  <div class="card" style="margin-top:14px;" id="relatorioCard">
    ${relatorioGerado ? renderRelatorioPrefeituras() : `<div class="empty">${ic("empty")}<div>Escolha o período e os tipos de OS e clique em "Gerar arquivos" para pré-visualizar o que cada prefeitura vai receber.</div></div>`}
  </div>`;
}

/* ---- configuração por prefeitura ---- */
function prefAbrirConfig(nome){
  const c = prefConfig[nome] || {};
  const proprios = Array.isArray(c.tiposOS) && c.tiposOS.length;
  const tipos = proprios ? c.tiposOS : Array.from(prefTiposPadrao);
  openModal(`
    <h2>Configurar envio — ${escapeHtml(nome)}</h2>
    <p class="modal-sub">Quais OS essa prefeitura recebe e se recebe o KMZ.</p>
    <label class="check-row" style="margin-bottom:8px;"><input type="checkbox" id="prefCfgPadrao" ${proprios?"":"checked"} onchange="document.querySelectorAll('.prefCfgTipo').forEach(i=>i.disabled=this.checked)"> Usar o padrão da tela</label>
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
      ${PREF_STATUS.map(st=>`<label class="check-row" style="margin:0;"><input type="checkbox" class="prefCfgTipo" value="${st}" ${tipos.includes(st)?"checked":""} ${proprios?"":"disabled"}> ${st}</label>`).join("")}
    </div>
    <div class="field"><label>KMZ (Google Earth)</label>
      <select id="prefCfgKmz">
        <option value="" ${typeof c.kmz!=="boolean"?"selected":""}>Padrão da tela</option>
        <option value="1" ${c.kmz===true?"selected":""}>Sim, gerar</option>
        <option value="0" ${c.kmz===false?"selected":""}>Não gerar</option>
      </select></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="prefCfgSalvar" onclick="prefSalvarConfig(${escapeHtml(JSON.stringify(nome))})">${ic("check")} Salvar</button>
    </div>`);
}
async function prefSalvarConfig(nome){
  const padrao = document.getElementById("prefCfgPadrao").checked;
  const tipos = padrao ? null : Array.from(document.querySelectorAll(".prefCfgTipo")).filter(i=>i.checked).map(i=>i.value);
  if(!padrao && tipos.length===0){ toast("Marque ao menos um tipo de OS (ou use o padrão)."); return; }
  const k = document.getElementById("prefCfgKmz").value;
  const kmz = k==="" ? null : k==="1";
  try{
    if(API_ONLINE) await apiSend("PUT", `/prefeituras/config/${encodeURIComponent(nome)}`, { tiposOS:tipos, kmz });
    if(tipos===null && kmz===null) delete prefConfig[nome]; else prefConfig[nome] = { tiposOS:tipos, kmz };
    closeModal(); toast("Configuração salva.");
    document.getElementById("prefMunicipiosCard").innerHTML = prefMunicipiosHtml();
  }catch(err){ toast(`Erro ao salvar: ${err.message}`); }
}

/* ---- seleção das OS de cada município ---- */
function prefOsPorMunicipio(){
  const nomes = new Map();                       // nome normalizado -> nome cadastrado
  state.municipios.forEach(m=>nomes.set(prefNorm(m.nome), m.nome));
  const progPorOS = {};
  (state.programacoes||[]).forEach(pg=>{ if(pg.status==="Cancelada") return; (pg.osIds||[]).forEach(id=>{ (progPorOS[id] = progPorOS[id]||[]).push(pg); }); });
  const por = {}; let semMunicipio = 0;
  state.manutencaoOS.forEach(o=>{
    let alvo = null;
    for(const c of [o.localidade, o.conjunto, municipioDaOS(o)]){ const n = nomes.get(prefNorm(c)); if(n){ alvo = n; break; } }
    if(!alvo){ semMunicipio++; return; }
    (por[alvo] = por[alvo]||[]).push(o);
  });
  return { por, semMunicipio, progPorOS };
}
function prefOSNoPeriodo(o, tipos, de, ate, progPorOS){
  const st = o.statusOS;
  if(!tipos.includes(st)) return false;
  if(st==="Executada"){ const d = o.dataExecucao ? String(o.dataExecucao).slice(0,10) : ""; return !!d && d>=de && d<=ate; }
  if(st==="Programada" || st==="Despachada"){
    const pgs = progPorOS[o.id];
    if(!pgs || !pgs.length) return true;           // sem programação datada: não dá pra filtrar
    return pgs.some(pg=>{ const i = String(pg.dataInicio||"").slice(0,10), f = String(pg.dataFim||pg.dataInicio||"").slice(0,10); return i<=ate && f>=de; });
  }
  if(prefAplicarPendentes){ const d = o.dataAbertura ? String(o.dataAbertura).slice(0,10) : ""; return !d || (d>=de && d<=ate); }
  return true;                                      // Pendente / A reprogramar / Cancelada: todas
}

function gerarRelatorioPrefeituras(){
  const p = prefPeriodoAtual();
  if(!p.de || !p.ate || p.de>p.ate){ toast("Confira o período: a data inicial precisa ser menor ou igual à final."); return; }
  if(prefTiposPadrao.size===0 && !Object.values(prefConfig).some(c=>c.tiposOS&&c.tiposOS.length)){ toast("Marque ao menos um tipo de OS."); return; }
  const { por, semMunicipio, progPorOS } = prefOsPorMunicipio();
  const itens = [];
  state.municipios.forEach(m=>{
    const tipos = prefTiposDe(m.nome);
    const lista = (por[m.nome]||[]).filter(o=>prefOSNoPeriodo(o, tipos, p.de, p.ate, progPorOS));
    if(!lista.length) return;
    const porStatus = {}; lista.forEach(o=>{ porStatus[o.statusOS] = (porStatus[o.statusOS]||0)+1; });
    itens.push({ municipio:m.nome, tipos, kmz:prefKmzDe(m.nome), lista, porStatus, comCoord:lista.filter(o=>o.lat!=null && o.lng!=null).length, progPorOS });
  });
  relatorioGerado = { geradoEm:new Date().toISOString(), de:p.de, ate:p.ate, itens, semMunicipio, totalMunicipios:state.municipios.length };
  document.getElementById("relatorioCard").innerHTML = renderRelatorioPrefeituras();
  toast(itens.length ? `${itens.length} município(s) com OS no período.` : "Nenhuma OS encontrada para esse período e tipos.");
}

function renderRelatorioPrefeituras(){
  const r = relatorioGerado;
  const totalOS = r.itens.reduce((a,i)=>a+i.lista.length,0);
  return `
    <div class="card-head" style="margin-bottom:10px; flex-wrap:wrap; gap:8px;">
      <h3 style="margin:0;">Arquivos gerados — ${fmtDate(r.de)} a ${fmtDate(r.ate)}</h3>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${r.itens.length ? `<button class="btn btn-primary btn-sm" onclick="prefBaixarTudo()">${ic("download")} Baixar tudo (.zip)</button>` : ""}
        ${r.itens.length && API_ONLINE ? `<button class="btn btn-ghost btn-sm" onclick="prefSalvarNoServidor()">${ic("upload")} Salvar na pasta do servidor (Automate)</button>` : ""}
      </div>
    </div>
    <p style="color:var(--muted); font-size:12px; margin:0 0 10px;">${r.itens.length} município(s) · ${totalOS.toLocaleString("pt-BR")} OS${r.semMunicipio ? ` · ${r.semMunicipio.toLocaleString("pt-BR")} OS sem município cadastrado ficaram de fora` : ""}.</p>
    ${r.itens.length===0 ? `<div class="empty">${ic("empty")}<div>Nenhuma OS para esse período e tipos.</div></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>Município</th><th>OS</th><th>Por status</th><th>Com coordenada</th><th>Arquivos</th></tr></thead>
      <tbody>
        ${r.itens.map((it,i)=>`<tr>
          <td>${escapeHtml(it.municipio)}</td>
          <td class="num">${it.lista.length}</td>
          <td>${Object.entries(it.porStatus).map(([st,n])=>`<span class="pill" style="margin:1px; background:${statusColor[st]||"#64748b"}22; color:${statusColor[st]||"#64748b"};">${escapeHtml(st)}: ${n}</span>`).join("")}</td>
          <td class="num">${it.comCoord}</td>
          <td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="prefBaixarUm(${i},'xlsx')">${ic("download")} .xlsx</button>${it.kmz ? ` <button class="btn btn-ghost btn-sm" onclick="prefBaixarUm(${i},'kmz')">${ic("download")} .kmz</button>` : ""}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`}`;
}

/* ---- geração dos arquivos ---- */
function prefNomeArquivo(s){ return prefNorm(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"") || "municipio"; }
function prefDataProg(o, progPorOS){
  const pgs = progPorOS[o.id]; if(!pgs || !pgs.length) return "";
  const pg = pgs[0]; const i = fmtDate(pg.dataInicio), f = fmtDate(pg.dataFim||pg.dataInicio);
  return i===f ? i : `${i} a ${f}`;
}
function prefXlsxBytes(it){
  const linhas = it.lista.slice().sort((a,b)=>String(a.statusOS).localeCompare(String(b.statusOS),"pt-BR") || String(a.id).localeCompare(String(b.id),"pt-BR",{numeric:true})).map(o=>({
    "OS": o.id, "Status": o.statusOS, "Serviço": servicoTextoOS(o),
    "Cidade/Localidade": cidadeDaOS(o), "Alimentador": o.alimentador, "Proteção": o.protecaoId,
    "Abertura": o.dataAbertura ? fmtDate(o.dataAbertura) : "", "Execução": o.dataExecucao ? fmtDate(o.dataExecucao) : "",
    "Programação": prefDataProg(o, it.progPorOS), "Equipe": o.equipeId || "",
    "Previsto": qtdOS(o,"prev"), "Realizado": qtdOS(o,"real"), ...colunasPorTipoXlsx(o),
    "Latitude": o.lat==null ? "" : o.lat, "Longitude": o.lng==null ? "" : o.lng,
    "Posição aproximada": o.aprox ? "Sim" : ""
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [14,14,18,24,16,14,12,12,20,14,10,10,12,12,12].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "OS");
  return new Uint8Array(XLSX.write(wb, { type:"array", bookType:"xlsx" }));
}
function prefXml(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c])); }
function prefKmlCor(hex){ const h = String(hex||"#64748b").replace("#",""); return "ff"+h.slice(4,6)+h.slice(2,4)+h.slice(0,2); }
function prefKml(it, r){
  const estilos = Object.keys(statusColor).map(st=>`<Style id="st_${prefNomeArquivo(st)}"><IconStyle><color>${prefKmlCor(statusColor[st])}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>`).join("");
  const porSt = {}; it.lista.forEach(o=>{ if(o.lat==null || o.lng==null) return; (porSt[o.statusOS] = porSt[o.statusOS]||[]).push(o); });
  const pastas = Object.entries(porSt).map(([st,lista])=>`<Folder><name>${prefXml(st)} (${lista.length})</name>${lista.map(o=>{
    const desc = [["Status",o.statusOS],["Serviço",o.tipoServico],["Alimentador",o.alimentador],["Proteção",o.protecaoId],["Abertura",o.dataAbertura?fmtDate(o.dataAbertura):""],["Execução",o.dataExecucao?fmtDate(o.dataExecucao):""],["Programação",prefDataProg(o,it.progPorOS)],["Equipe",o.equipeId||""],["Previsto",qtdOS(o,"prev")],["Realizado",qtdOS(o,"real")],["Obs.",o.aprox?"Posição aproximada":""]]
      .filter(([,v])=>v!==""&&v!=null).map(([k,v])=>`<tr><td><b>${prefXml(k)}</b></td><td>${prefXml(v)}</td></tr>`).join("");
    return `<Placemark><name>${prefXml(o.id)}</name><styleUrl>#st_${prefNomeArquivo(st)}</styleUrl><description><![CDATA[<table>${desc}</table>]]></description><Point><coordinates>${Number(o.lng).toFixed(6)},${Number(o.lat).toFixed(6)},0</coordinates></Point></Placemark>`;
  }).join("")}</Folder>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${prefXml(it.municipio)} — ${fmtDate(r.de)} a ${fmtDate(r.ate)}</name>${estilos}${pastas}</Document></kml>`;
}
/* ZIP mínimo (sem compressão) — suficiente para o .kmz e para empacotar os arquivos */
let _crcTab = null;
function crc32(u8){
  if(!_crcTab){ _crcTab = new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); _crcTab[n]=c>>>0; } }
  let c = 0xFFFFFFFF; for(let i=0;i<u8.length;i++) c = _crcTab[(c^u8[i])&0xFF] ^ (c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function zipStore(arquivos){
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)) & 0xFFFF, dd = (((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()) & 0xFFFF;
  arquivos.forEach(a=>{
    const nome = enc.encode(a.nome), dados = a.dados, crc = crc32(dados);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x0800,true); h.setUint16(8,0,true);
    h.setUint16(10,dt,true); h.setUint16(12,dd,true); h.setUint32(14,crc,true); h.setUint32(18,dados.length,true); h.setUint32(22,dados.length,true);
    h.setUint16(26,nome.length,true); h.setUint16(28,0,true);
    partes.push(new Uint8Array(h.buffer), nome, dados);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true);
    c.setUint16(12,dt,true); c.setUint16(14,dd,true); c.setUint32(16,crc,true); c.setUint32(20,dados.length,true); c.setUint32(24,dados.length,true);
    c.setUint16(28,nome.length,true); c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer), nome);
    off += 30 + nome.length + dados.length;
  });
  let tamCentral = 0; central.forEach(x=>tamCentral += x.length);
  const f = new DataView(new ArrayBuffer(22));
  f.setUint32(0,0x06054b50,true); f.setUint16(8,arquivos.length,true); f.setUint16(10,arquivos.length,true); f.setUint32(12,tamCentral,true); f.setUint32(16,off,true);
  return new Blob([...partes, ...central, new Uint8Array(f.buffer)], { type:"application/zip" });
}
async function prefBytes(blob){ return new Uint8Array(await blob.arrayBuffer()); }
async function prefArquivosDoItem(it){
  const base = prefNomeArquivo(it.municipio), r = relatorioGerado, lista = [];
  lista.push({ nome:`${base}.xlsx`, dados:prefXlsxBytes(it) });
  if(it.kmz && it.comCoord>0){
    const kml = new TextEncoder().encode(prefKml(it, r));
    lista.push({ nome:`${base}.kmz`, dados:await prefBytes(zipStore([{ nome:"doc.kml", dados:kml }])) });
  }
  return lista;
}
function prefBaixarBlob(blob, nome){
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function prefBaixarUm(i, tipo){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const it = relatorioGerado.itens[i];
  const arqs = await prefArquivosDoItem(it);
  const a = arqs.find(x=>x.nome.endsWith("."+tipo));
  if(!a){ toast(tipo==="kmz" ? "Nenhuma OS com coordenada para gerar o KMZ." : "Arquivo não gerado."); return; }
  prefBaixarBlob(new Blob([a.dados]), a.nome);
}
async function prefMontarPacote(){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return null; }
  const todos = [];
  for(const it of relatorioGerado.itens){ (await prefArquivosDoItem(it)).forEach(a=>todos.push(a)); }
  const r = relatorioGerado;
  return { blob:zipStore(todos), nome:`prefeituras_${r.de}_a_${r.ate}.zip`, qtd:todos.length };
}
async function prefBaixarTudo(){
  toast("Montando os arquivos…");
  const pk = await prefMontarPacote(); if(!pk) return;
  prefBaixarBlob(pk.blob, pk.nome); toast(`${pk.qtd} arquivo(s) no .zip.`);
}
async function prefSalvarNoServidor(){
  toast("Montando os arquivos…");
  const pk = await prefMontarPacote(); if(!pk) return;
  try{
    const bytes = new Uint8Array(await pk.blob.arrayBuffer()); let bin = ""; const passo = 0x8000;
    for(let i=0;i<bytes.length;i+=passo) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+passo));
    const resp = await apiPost("/prefeituras/salvar-pacote", { nome:pk.nome, base64:btoa(bin) });
    toast(`Salvo no servidor: ${resp.pasta}`);
  }catch(err){ toast(`Erro ao salvar no servidor: ${err.message}`); }
}

/* =========================================================================
   VIEW: Importação de Bases
   ========================================================================= */
/* Nomes de coluna e a base ("apiBase") batem exatamente com
   controller/lib/Validacao.ps1 ($Script:ImportSchemas) — se um dia mudar
   um lado, muda o outro também, senão a validação real vai rejeitar tudo
   por "coluna ausente" mesmo com o Excel certo. */
const SCHEMAS = {
  // v3.6.0 - listas de prioridade da engenharia (definido em rank.js)
  "Rank de prioridade": RANK_SCHEMA,
  "Metas": { tipo:"excel", apiBase:"Metas", campos:[["CodigoEquipe","Texto","Sim"],["AnoMes","Texto (AAAA-MM)","Sim"],["MetaMensal","Número (poda: unidades; faixa: km lineares)","Sim"],["Servico","Texto: Poda ou Limpeza de faixa (vazio = Poda)","Não"]] },
  "Equipes": { tipo:"excel", apiBase:"Equipes", campos:[["CodigoEquipe","Texto","Sim"],["TipoEquipe","Texto","Sim"],["Polo","Texto","Sim"],["Regional","Texto","Sim"],["Departamento","Texto","Sim"],["ProprioTerceiro","Texto","Sim"],["EquipePoda","true/false","Sim"],["BaseLat","Número","Não"],["BaseLng","Número","Não"],["Ativa","true/false (Não = equipe inativa: some da Produtividade e não recebe programação; em branco mantém o que já está)","Não"]] },
  // v2.13.0 - cabeçalhos iguais aos arquivos reais (d.Vao.xlsx ~793 mil linhas,
  // d.Protecao.xlsx ~214 mil). Sobem como arquivo cru em streaming (grande:true,
  // endpoint próprio) — o Controller agrega: Vão vira 1 registro por Proteção
  // (postes, Rota km, Polo/Regional) e Proteção 1 por ELEMENTO.
  "Vão": { tipo:"excel", grande:true, nomeCurto:"Vão", endpoint:"/importacao/vao", unidade:"proteção(ões) (agrupadas dos postes)", apiBase:"Vao", campos:[["Poste 1","Texto","Sim"],["Proteção","Texto","Sim — liga o poste à proteção (e ao Polo/Regional)"],["Regional","Texto","Não"],["Polo","Texto","Não"],["Rota (km)","Número","Não — somado por proteção"]] },
  "Proteção": { tipo:"excel", grande:true, nomeCurto:"Proteção", endpoint:"/importacao/protecao", unidade:"elemento(s) de proteção", apiBase:"Protecao", campos:[["ELEMENTO","Texto","Sim — chave (as linhas repetidas do mesmo elemento são fundidas)"],["PROT. ELEMENTO","Texto","Não"],["PROT. ELEMENTO 2","Texto","Não — é o que liga ao Vão"],["ALIMENTADOR","Texto","Não — usado no filtro e no cruzamento com Polo"],["ZONA","Texto","Não"],["LAT","Número","Não"],["LONG","Número","Não"],["TRECHO","Texto","Não"],["TRECHO COM T4","Texto","Não"],["PLANO EASY WORK","Texto","Não"]] },
  // Cabeçalho alinhado com a exportação real do VERA (planilha "ÁrvoresFiltradas...xlsx")
  // — o schema antigo ("IdVera", "Especie" sem acento) não existia nesse
  // arquivo de verdade, e toda linha caía como erro. "ID árvore" é a coluna
  // de ID real; Lat/Lng aceitam vírgula ou ponto decimal.
  // "grande:true" (pedido do Mario: "quebra as etapas igual você fez com o
  // shapefile") — em vez do caminho genérico de 3 passos (ler no navegador
  // com XLSX.js -> /importacao/validar -> /importacao/confirmar, que manda
  // o Excel inteiro já parseado como um JSON gigante), a VERA sobe o .xlsx
  // CRU direto pro Controller (/importacao/vera, streaming/NDJSON — igual
  // shapefile/podas/kmz), que lê e grava sem nunca passar as 140 mil+
  // linhas por um ConvertFrom-Json/XLSX.js. Continua tipo "excel" (mesmo
  // optgroup/aceita .xlsx) — só muda o que acontece ao selecionar/enviar o
  // arquivo (ver onImportFileSelected/executarImportacao/schemaInfoHtml).
  "VERA": { tipo:"excel", grande:true, nomeCurto:"VERA", endpoint:"/importacao/vera", unidade:"árvore(s)", apiBase:"VERA", campos:[["ID árvore","Número","Sim"],["Alimentadores","Texto","Sim"],["Lat","Número (vírgula ou ponto)","Sim"],["Lng","Número (vírgula ou ponto)","Sim"],["Espécie","Texto","Não"],["Cidade","Texto","Não"]] },
  "Contatos de Prefeituras": { tipo:"excel", apiBase:"Prefeituras", campos:[["Municipio","Texto","Sim"],["ContatoNome","Texto","Sim"],["Email","Texto (e-mail)","Sim"],["Telefone","Texto","Não"]] },
  // v2.13.22 - de-para "Prioridade EW" (Prioridade x Grupo Recurso -> Sim/Não). Usada ao importar as OS do SGM.
  // v2.15.20 - esquemas do SGM que NAO podem ser ignorados: OS pendente sem MO entra com previsto 1 do TIPO do esquema.
  "Esquemas (SGM)": { tipo:"excel", apiBase:"Esquemas", campos:[["CODIGO","Texto (código do esquema no SGM)","Sim"],["DESCRICAO ESQUEMA","Texto (igual ao DescEsquema da grid do SGM)","Sim — é com ela que a OS é comparada"],["TIPO","Poda, Limpeza ou Estrutura","Não — esquema sem TIPO é ignorado"]] },
  // v3.2.1 - de-para Alimentador -> Conjunto (urgente): cada OS passa a mostrar o conjunto do seu alimentador.
  "Conjuntos (alimentador)": { tipo:"excel", apiBase:"Conjuntos", campos:[["Conjunto","Número/Texto (código do conjunto)","Não"],["Alimentador","Texto (é a chave do cruzamento com a OS)","Sim"],["Nome Conjunto","Texto (resultado: o conjunto que aparece na OS)","Sim"],["Regional","Texto","Não"],["Sigla","Texto","Não"],["Tensão (1ª coluna)","Número (ex.: 13,8)","Não"],["Tensão (2ª coluna)","Texto (ex.: 11,4/13,8)","Não"]] },
  "Prioridade EW": { tipo:"excel", apiBase:"PrioridadeEW", campos:[["Chave","Texto","Não"],["Tensão","Texto","Não — não muda o resultado"],["Prioridade","Texto (URGENTE, EMERGENCIAL, ALTA, BAIXA...)","Sim"],["Grupo Recurso","Texto (Poda, Limpeza de Faixa, Estrutura)","Sim"],["Prioridade EW","Sim / Não","Sim"],["Regional","Texto","Não — não muda o resultado"]] },
  // D_Localidade (pedido do Mario: arquivo que ele mandou, "um de para
  // escondido aqui das localidades") — cabeçalho igual ao arquivo real
  // (aba "D_LOCALIDADE"). POLO é o campo usado pro cruzamento com
  // Vão/Proteção/Prefeituras/Mapa de Manutenção (é ele que bate com
  // "municipio" nessas bases — LOCALIDADE é mais fino e não tem
  // equivalente hoje).
  "D_Localidade": { tipo:"excel", apiBase:"Localidades", campos:[["COD LOCALIDADE","Texto","Sim"],["POLO","Texto","Sim — cruza com Município em Vão/Proteção/Prefeituras"],["LOCALIDADE","Texto","Sim"],["POSTO OPERACIONAL","Texto","Não"],["POLO2","Texto","Não"],["REGIONAL","Texto","Não"],["COORDENADOR RESPONSÁVEL","Texto","Não"],["SUPERVISOR RESPONSÁVEL","Texto","Não"],["PONTO FOCAL RESPONSÁVEL","Texto","Não"],["COD LOCALIDADE2","Texto","Não"]] },
  "Rede MT (Shapefile)": { tipo:"shapefile", geometria:"Linha — 1 trecho de rede por registro", origem:"Extrato BDGD/ANEEL (camada SSDMT)", camada:"rede_media_tensao",
    campos:[["CTMT","Texto","Sim — identifica o alimentador"],["CT_COD_OP","Texto","Não — código operacional do alimentador (ex.: V-A1), usado no seletor do mapa"],["NOM_ALIM","Texto","Não — alternativa ao CT_COD_OP, se a base não tiver esse campo"],["COD_ID","Texto","Sim — identificador do trecho"],["SUB","Texto","Não"],["FAS_CON","Texto","Não — fases do trecho"],["TIP_CND","Texto","Não — tipo de condutor"],["COMP","Número","Não — comprimento em metros"]] },
  "Rede BT (Shapefile)": { tipo:"shapefile", geometria:"Linha — 1 trecho de rede por registro", origem:"Extrato BDGD/ANEEL (camada SSDBT)", camada:"rede_baixa_tensao",
    campos:[["CTMT","Texto","Sim — identifica o alimentador"],["COD_ID","Texto","Sim — identificador do trecho"],["SUB","Texto","Não"]] },
  "Postes (PONNOT)": { tipo:"shapefile", geometria:"Ponto — 1 por poste/ponto notável (760 mil+)", origem:"Extrato PONNOT (pontos notáveis). Dica: o .dbf é enorme — mande tudo num .zip (comprime muito)", camada:"postes",
    campos:[["COD_ID","Texto","Sim — é o ID do poste (a grid SGM traz em 'Complemento de Localização', sem o '218-')"],["TIP_PN","Texto","Sim — tipo do ponto (POS = poste, DRV, FLT, TOR…)"],["ARE_LOC","Texto","Sim — área (UB urbana / NU não urbana)"],["CONJ","Número","Sim — conjunto elétrico"],["(geometria)","Ponto","Sim — latitude/longitude do .shp"]] },
  "Equipamentos (Trafos/Proteções…)": { tipo:"shapefile", geometria:"Sem geometria própria — a posição vem do PAC_1 (coordenada codificada) e é ligada ao poste do PONNOT", origem:"Extrato BDGD/ANEEL: DBFs das unidades UNTRMT (trafos), UNSEMT (proteções), UNREMT (reguladores) e UNCRMT (capacitores). Só o .dbf é necessário (pode mandar vários de uma vez ou um .zip). Importe o PONNOT antes. Também aceita os Excels exportados do GeoSpatial Analysis: “Power Transformer Installation” (trafos) e “Isolating Equipment Installation” (chaves/fusíveis/religadores) — colunas Id e Name = Número Operativo, ex.: TR-1301, C7420-3: vários arquivos se somam, e rótulos, popup e busca passam a usar esse nome.", camada:"equipamentos",
    campos:[["COD_ID","Texto","Sim — identificador do equipamento"],["PAC_1 / PAC_2","Texto","Sim — traz a coordenada (SIRGAS 2000 / UTM 22S); 97% dos casos"],["CTMT","Texto","Não — alimentador (usado para iluminar a rede ao clicar na proteção)"],["POT_NOM, POSTO, TEN_LIN_SE, FAS_CON_P, TIP_TRAFO","Texto/Número","Trafos"],["TIP_UNID, CAP_ELO, COR_NOM, P_N_OPE, FAS_CON","Texto/Número","Proteções"],["TIP_REGU, BANC","Texto","Reguladores"],["POT_NOM, BANC","Texto","Capacitores"]] },
  "Rede AT (Shapefile)": { tipo:"shapefile", geometria:"Linha — 1 trecho de rede por registro", origem:"Extrato BDGD/ANEEL (camada SSDAT)", camada:"rede_alta_tensao",
    campos:[["COD_ID","Texto","Sim — identificador do trecho"],["SUB","Texto","Não"]] },
  // Reserva Legal e APP (pedido do Mario): também são por alimentador, um
  // .kmz por alimentador — igual à Rede MT, mas em vez de .shp+.dbf é um
  // .kmz (zip com um .kml dentro). "Incremental": subir o .kmz de um
  // alimentador novo não apaga os que já tinham sido carregados antes.
  // "origem" vai direto pro innerHTML em schemaInfoHtml() — "<ALIMENTADOR>"
  // literal ali é lido como uma tag HTML desconhecida e some da tela (virou
  // "Trecho__RL.kmz" sem o meio), por isso o nome do espaço reservado usa
  // parênteses em vez de "<>".
  "Reserva Legal (KMZ)": { tipo:"kmz", geometria:"Polígono — 1 ou mais por alimentador", origem:"Um .kmz por alimentador, nomeado 'Trecho_(ALIMENTADOR)_RL.kmz'", camada:"reserva_legal" },
  "Área de Preservação — APP (KMZ)": { tipo:"kmz", geometria:"Polígono — 1 ou mais por alimentador", origem:"Um .kmz por alimentador, nomeado 'Trecho_(ALIMENTADOR)_APP.kmz'", camada:"app" },
  "Podas — Pendente (SGM + MO)": { tipo:"podas", subtipo:"pendente", endpoint:"/importacao/podas-pendente",
    origem:"2 planilhas cruzadas pelo número da OS: as OS ainda em aberto (SGM pendente) e a mão de obra prevista (MO_PENDENTE). Separado do Executado pra ficar leve — dá pra atualizar só as pendentes sem esperar o arquivo grande.",
    arquivosEsperados:[
      { chave:"gridPendente", rotulo:"SGM_PENDENTE", padroes:["sgm_pendente","sgm pendente","grid_pendente","grid pendente"], papel:"OS ainda em aberto (traz a coordenada e o estado — criada/despachada/programada…)" },
      { chave:"moPendente", rotulo:"MO_PENDENTE", padroes:["mo_pendente","mo pendente"], papel:"Mão de obra prevista nas OS pendentes (também dá o \"Previsto\")" },
      { chave:"moExecutada", rotulo:"MO_EXECUTADA", padroes:["mo_executada","mo executada"], papel:"Opcional — só preenche o \"Realizado\" de pendentes que já tenham algum apontamento", opcional:true },
    ],
    campos:[["OSNumero","Texto","Sim — é a chave do cruzamento entre as 2 planilhas"],["COORDENADA UTM X / Y","Número","Sim — zona 22, hemisfério sul (convertido para lat/lng automaticamente)"],["CodEstado","Texto","Sim — define o status (Pendente/Programada/Despachada)"],["CodSetor","Texto","Não — usado como alimentador"],["DE-PARA RECURSOS.MO 1 / 2","Texto","Sim (na MO) — tipo de serviço (Poda, Limpeza de Faixa, Estrutura)"]] },
  "Podas — Executado (SGM + MO)": { tipo:"podas", subtipo:"executado", endpoint:"/importacao/podas-executado",
    origem:"2 planilhas cruzadas pelo número da OS: as OS já executadas (SGM executado) e a mão de obra apontada (MO_EXECUTADA). O arquivo SGM executado costuma ser um arquivo grande (~180 mil linhas) — pode levar vários minutos.",
    arquivosEsperados:[
      { chave:"gridExecutado", rotulo:"SGM_EXECUTADO", padroes:["sgm_executado","sgm executado","grid_executado","grid executado"], papel:"OS já executadas (traz a coordenada e se a OS está fechada)" },
      { chave:"moExecutada", rotulo:"MO_EXECUTADA", padroes:["mo_executada","mo executada"], papel:"Mão de obra apontada nas OS executadas (dá o \"Realizado\" e o tipo de serviço)" },
      { chave:"moPendente", rotulo:"MO_PENDENTE", padroes:["mo_pendente","mo pendente"], papel:"Opcional — dá o \"Previsto\" de cada OS (vem da OS-mãe/OSPrimária, apontada aqui). Sem ela, Previsto fica 0.", opcional:true },
    ],
    campos:[["Número OS","Texto","Sim — é a chave do cruzamento entre as 2 planilhas"],["COORDENADA UTM X / Y","Número","Sim — zona 22, hemisfério sul (convertido para lat/lng automaticamente)"],["OSFechada?","Texto","Sim — define o status (Executada/Despachada)"],["CodSetor","Texto","Não — usado como alimentador"],["DE-PARA RECURSOS.MO 1 / 2","Texto","Sim (na MO) — tipo de serviço (Poda, Limpeza de Faixa, Estrutura)"]] },
  // v3.11.0 - HISTORICO por PLANO (01/nov do ano anterior a 31/out): mesmas planilhas do Executado, mas grava num
  // arquivo separado por plano (nao entra na base de hoje, nos alertas, no rank nem nas programacoes).
  "Podas — Executado histórico (SGM + MO)": { tipo:"podas", subtipo:"historico", endpoint:"/importacao/podas-historico",
    origem:"Planos já fechados (anos anteriores). Mesmas 2 planilhas do Executado, cruzadas pelo número da OS: SGM executado e MO_EXECUTADA. Você informa o <b>plano</b> (plano 2026 = 01/11/2025 a 31/10/2026) e escolhe <b>substituir</b> ou <b>acrescentar</b>. A OS entra pela data de execução; fora do período do plano é rejeitada. Fica guardado em separado (consulta no menu <b>Histórico de Podas</b>) e não mexe na base de hoje. Suba um plano por vez — são ~100 mil OS por plano e pode levar vários minutos.",
    arquivosEsperados:[
      { chave:"gridExecutado", rotulo:"SGM_EXECUTADO", padroes:["sgm_executado","sgm executado","grid_executado","grid executado"], papel:"OS executadas do plano (traz a coordenada e se a OS está fechada)" },
      { chave:"moExecutada", rotulo:"MO_EXECUTADA", padroes:["mo_executada","mo executada"], papel:"Mão de obra apontada nas OS do plano (dá o \"Realizado\" e o tipo de serviço)" },
      { chave:"moPendente", rotulo:"MO_PENDENTE", padroes:["mo_pendente","mo pendente"], papel:"Opcional — dá o \"Previsto\" de cada OS (OS-mãe). Sem ela, Previsto fica 0.", opcional:true },
    ],
    campos:[["Número OS","Texto","Sim — é a chave do cruzamento entre as 2 planilhas"],["Término Execução (ou Início Execução)","Data","Sim — define o plano da OS"],["COORDENADA UTM X / Y","Número","Sim — zona 22, hemisfério sul (convertido para lat/lng automaticamente)"],["OSFechada?","Texto","Sim — define o status (Executada/Despachada)"],["CodSetor","Texto","Não — usado como alimentador"],["DE-PARA RECURSOS.MO 1 / 2","Texto","Sim (na MO) — tipo de serviço (Poda, Limpeza de Faixa, Estrutura)"]] },
  "Podas — SIGOD pendentes": { tipo:"podas", subtipo:"sigodpend", endpoint:"/importacao/podas-sigod-pendente",
    origem:"1 planilha só (pendentes_sigod.xlsx): as OS de poda ainda pendentes no SIGOD (serviços 324 e 77). Cada linha é 1 poda prevista, entra como Pendente e aparece no mapa, nos cards e na tabela por regional/polo. Lote próprio: não apaga o SIGOD executado nem o SGM; subir de novo substitui só este lote. Prioridade EW não conta para o SIGOD.",
    arquivosEsperados:[
      { chave:"sigodPendente", rotulo:"pendentes_sigod", padroes:["pendentes_sigod","pendentes sigod","pendente_sigod","sigod_pend","pendentes"], papel:"OS pendentes do SIGOD (traz número da OS, datas, localidade e coordenada UTM)" },
    ],
    campos:[["numos","Texto","Sim — número da OS (vira SIGOD-<número>)"],["vlrcdn_x / vlrcdn_y","Número","Não — UTM zona 22 sul; sem coordenada ou com valor inválido a OS entra no centro da cidade, marcada com *"],["nomelcd","Texto","Não — localidade, usada na posição aproximada"],["datasol / dataprev","Data","Não — criação e prazo"],["codserv","Número","Não — 324 ou 77 (ambos viram poda)"]] },
  "Podas — SIGOD (OS)": { tipo:"podas", subtipo:"sigod", endpoint:"/importacao/podas-sigod",
    origem:"1 planilha só (basePoda<mês>-<ano>.xlsx, aba \"Base Poda\"): as podas de oportunidade e de plantão registradas no SIGOD. Não precisa de MO — a planilha já vem com 1 linha por OS e a coordenada em graus. Cada importação substitui só o lote SIGOD; as OS do SGM (Pendente/Executado) ficam intactas.",
    arquivosEsperados:[
      { chave:"basePoda", rotulo:"basePoda (SIGOD)", padroes:["basepoda","base_poda","base poda"], papel:"Podas do SIGOD — aba \"Base Poda\" (traz número da OS, status, coordenada, alimentador e município)" },
    ],
    campos:[["NUM_OS","Texto","Sim — número da OS"],["VLR_COORDENADA_LATITUDE / LONGITUDE","Número","Sim — já em graus (linhas sem coordenada válida não entram no mapa)"],["Status / Tipo da OS","Texto","Define Executada/Pendente e Oportunidade/Plantão"],["Alimentador / Município","Texto","Não — usados no filtro e no popup"],["Observação da OS","—","Não é importada (pode conter dado pessoal de cliente)"]] },
};
let importSelecionada = "Metas";
let importArquivoAtual = null;
let importLinhasParseadas = null;
let importValidacao = null;
let importArquivosShapefile = [];
let importArquivosPodas = [];
// Espelha Get-ModuloDaBase (controller/routes/importacao.ps1) — mesma regra,
// usada aqui só pra decidir o que aparece na lista (pedido do Mario: "os
// menus e abas que a pessoa não tem permissão ela nem consiga ver que
// existe"). A permissão de verdade continua sendo checada no Controller.
function moduloDaBase(nomeBase){
  if(nomeBase === "Metas") return "metas";
  if(nomeBase === "Contatos de Prefeituras") return "prefeituras";
  if(nomeBase === "Rank de prioridade") return "prioridade";
  return "manutencao";
}
function schemaVisivel(nomeBase){
  return minhaPermissao(moduloDaBase(nomeBase), "importar");
}
function schemasVisiveis(){
  return Object.keys(SCHEMAS).filter(schemaVisivel);
}
function viewImportacao(){
  const visiveis = schemasVisiveis();
  if(!visiveis.includes(importSelecionada)){
    importSelecionada = visiveis[0] || importSelecionada;
  }
  if(visiveis.length === 0){
    return `<div class="card"><div class="empty">${ic("empty")}<div>Você não tem permissão pra importar nenhuma base. Fale com um administrador se precisar de acesso.</div></div></div>`;
  }
  return `
  <div class="grid" style="grid-template-columns:1.1fr 1fr; gap:14px;">
    <div class="card">
      <h3>1. Escolha a base</h3>
      <div class="field" style="margin-bottom:14px;">
        <select id="importBaseSelect" onchange="mudarBaseImportacao(this.value)">
          <optgroup label="Planilhas Excel">
            ${visiveis.filter(k=>SCHEMAS[k].tipo==="excel").map(k=>`<option ${k===importSelecionada?"selected":""}>${k}</option>`).join("")}
          </optgroup>
          <optgroup label="Shapefiles (rede elétrica)">
            ${visiveis.filter(k=>SCHEMAS[k].tipo==="shapefile").map(k=>`<option ${k===importSelecionada?"selected":""}>${k}</option>`).join("")}
          </optgroup>
          <optgroup label="KMZ (Reserva Legal / APP, por alimentador)">
            ${visiveis.filter(k=>SCHEMAS[k].tipo==="kmz").map(k=>`<option ${k===importSelecionada?"selected":""}>${k}</option>`).join("")}
          </optgroup>
          ${visiveis.some(k=>SCHEMAS[k].tipo==="rank") ? `<optgroup label="Programação (engenharia)">
            ${visiveis.filter(k=>SCHEMAS[k].tipo==="rank").map(k=>`<option ${k===importSelecionada?"selected":""}>${k}</option>`).join("")}
          </optgroup>` : ""}
          <optgroup label="Podas (cruzamento de planilhas)">
            ${visiveis.filter(k=>SCHEMAS[k].tipo==="podas").map(k=>`<option ${k===importSelecionada?"selected":""}>${k}</option>`).join("")}
          </optgroup>
        </select>
      </div>
      <div id="schemaInfo">${schemaInfoHtml()}</div>
    </div>

    <div class="card">
      <h3>2. Envie o(s) arquivo(s)</h3>
      <div id="histImportSlot">${histImportCamposHtml()}</div>
      <div class="import-drop" id="importDrop"
           onclick="document.getElementById('importFileInput').click()"
           ondragover="event.preventDefault(); this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="onImportFileDrop(event)">${importDropHtml()}</div>
      <input type="file" id="importFileInput"
             accept="${SCHEMAS[importSelecionada].tipo==="shapefile" ? (SCHEMAS[importSelecionada].camada==="equipamentos" ? ".zip,.dbf,.xlsx" : ".zip,.shp,.shx,.dbf,.prj") : SCHEMAS[importSelecionada].tipo==="kmz" ? ".kmz" : SCHEMAS[importSelecionada].tipo==="podas" ? ".xlsx,.xls" : ".xlsx,.xls,.csv"}"
             ${SCHEMAS[importSelecionada].tipo!=="excel" ? "multiple" : ""}
             style="display:none" onchange="onImportFileSelected(this.files)">
      <button class="btn btn-primary" id="importActionBtn" style="margin-top:12px; width:100%; justify-content:center;" onclick="executarImportacao()">${ic("check")} ${rotuloBotaoImportar(SCHEMAS[importSelecionada])}</button>
      <div id="importResult"></div>
    </div>
  </div>

  <div class="card" style="margin-top:14px;">
    <h3>Histórico de importações</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Base</th><th>Usuário</th><th>Quando</th><th>Processados</th><th>Erros</th><th>Arquivo</th></tr></thead>
      <tbody id="importLogRows">${importLogRowsHtml()}</tbody>
    </table></div>
  </div>
  `;
}

/* =========================================================================
   v3.5.0 - AJUSTE DE OS (aba "Ajuste de OS" da Gestão de Bases)
   A equipe de campo corrige OS levantadas erradas: tipo de equipe, equipe executora, alimentador e proteção
   informados aqui SOBREPÕEM o original (SGM/SIGOD) em todo o sistema e sobrevivem a novas cargas de GRID.
   Campo em branco = não ajustar. Só quem edita a Manutenção grava; o Controller confere de novo.
   ========================================================================= */
/* v3.8.5 - Ajuste de OS paginado (15 por página) + busca: com ~1.300 ajustes a tela desenhava tudo de uma vez e,
   pior, procurava cada OS na base inteira (milhares x milhares). Agora desenha só a página e procura só essas OS. */
const AJUSTE_POR_PAGINA = 15;
let ajBusca = "", ajPag = 1;
function ajusteOsListaOrdenada(){
  return (state.ajustesOS||[]).slice().sort((a,b)=>String(b.atualizadoEm||"").localeCompare(String(a.atualizadoEm||"")));
}
function ajusteOsTabelaHtml(){
  const pode = minhaPermissao("manutencao","editar");
  const lista = ajusteOsListaOrdenada();
  const q = ajBusca.trim().toUpperCase();
  const comIdx = lista.map((a,i)=>({a,i}));
  const filtrada = q ? comIdx.filter(({a})=>[a.id,a.tipoEquipe,a.equipeId,a.alimentador,a.protecaoId].some(v=>String(v||"").toUpperCase().includes(q))) : comIdx;
  const totalPag = Math.max(1, Math.ceil(filtrada.length / AJUSTE_POR_PAGINA));
  if(ajPag > totalPag) ajPag = totalPag;
  if(ajPag < 1) ajPag = 1;
  const pagina = filtrada.slice((ajPag-1)*AJUSTE_POR_PAGINA, ajPag*AJUSTE_POR_PAGINA);
  // procura na base só as OS desta página (uma passada)
  const ids = new Set(pagina.map(({a})=>String(a.id).trim().toUpperCase()));
  const mapaOS = new Map();
  if(ids.size) for(const x of (state.manutencaoOS||[])){ const k = String(x.id).trim().toUpperCase(); if(ids.has(k)){ mapaOS.set(k, x); if(mapaOS.size===ids.size) break; } }
  const linhas = pagina.map(({a,i})=>{
    const o = mapaOS.get(String(a.id).trim().toUpperCase());
    const orig = o && o._orig ? o._orig : null;
    const cel = (aj, ori)=> aj ? `<b>${escapeHtml(aj)}</b>${(orig && String(ori||"")!==aj) ? `<div style="font-size:10.5px; color:var(--muted);">era: ${escapeHtml(ori||"—")}</div>` : ""}` : `<span style="color:var(--muted);">—</span>`;
    return `<tr>
      <td class="mono">${escapeHtml(a.id)}</td>
      <td>${o ? statusPill(o.statusOS) : `<span class="pill muted" title="A OS ainda não está na base; o ajuste vale quando ela chegar.">fora da base</span>`}</td>
      <td>${cel(a.tipoEquipe, orig && orig.tipoEquipeExec)}</td><td>${cel(a.equipeId, orig && orig.equipeId)}</td>
      <td>${cel(a.alimentador, orig && orig.alimentador)}</td><td>${cel(a.protecaoId, orig && orig.protecaoId)}</td>
      <td style="font-size:11.5px; white-space:nowrap;">${escapeHtml(nomeUsuarioPorId(a.atualizadoPor))}<div style="color:var(--muted);">${a.atualizadoEm ? escapeHtml(new Date(a.atualizadoEm).toLocaleString("pt-BR")) : ""}</div></td>
      <td style="white-space:nowrap;">${pode ? `<button class="btn btn-ghost btn-sm" onclick="ajusteOsEditar(${i})">Editar</button> <button class="btn btn-ghost btn-sm" onclick="ajusteOsRemover(${i})">Remover</button>` : ""}</td>
    </tr>`; }).join("");
  return `
    <div class="table-wrap"><table data-sort-manual>
      <thead><tr><th>OS</th><th>Status</th><th>Tipo de equipe</th><th>Equipe executora</th><th>Alimentador</th><th>Proteção</th><th>Último ajuste</th><th></th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="8" style="text-align:center; color:var(--muted); padding:16px;">${q ? "Nenhum ajuste encontrado para essa busca." : "Nenhum ajuste cadastrado."}</td></tr>`}</tbody>
    </table></div>
    ${filtrada.length > AJUSTE_POR_PAGINA ? `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${ajPag<=1?"disabled":""} onclick="ajusteOsIrPagina(${ajPag-1})">‹ Anterior</button><span>Página ${ajPag} de ${totalPag} · ${filtrada.length.toLocaleString("pt-BR")} ajuste(s)</span><button type="button" class="btn btn-ghost btn-sm" ${ajPag>=totalPag?"disabled":""} onclick="ajusteOsIrPagina(${ajPag+1})">Próxima ›</button></div>` : ""}`;
}
function ajusteOsRedesenharTabela(){ const el = document.getElementById("ajTabelaWrap"); if(el) el.innerHTML = ajusteOsTabelaHtml(); }
function ajusteOsIrPagina(n){ ajPag = n; ajusteOsRedesenharTabela(); }
function ajusteOsBuscar(v){ ajBusca = v; ajPag = 1; ajusteOsRedesenharTabela(); }
function ajusteOsCardHtml(){
  const pode = minhaPermissao("manutencao","editar");
  const lista = state.ajustesOS||[];
  const tipos = [...new Set([...(valoresDistintosOS("tipoEquipeExec")||[]), ...((typeof listaNomes==="function") ? listaNomes("equipeNecessaria") : [])].filter(Boolean))].sort();
  const eqs = equipesAtivas().map(e=>e.id).sort();
  const campo = (id, rot, ph, dl)=>`<div class="field" style="margin:0;"><label>${rot}</label><input id="${id}" ${dl?`list="${dl}"`:""} placeholder="${ph}" autocomplete="off" ${pode?"":"disabled"}></div>`;
  return `<div id="ajusteOsCard">
    <h3>Ajuste de OS</h3>
    <p style="color:var(--muted); font-size:12px; margin:0 0 10px;">Quando a OS foi levantada errada, informe aqui os valores corretos. O ajuste <strong>vale mais que o original</strong> (SGM/SIGOD) em todo o sistema — mapa, grid, programações, produtividade, alertas e Excel — e continua valendo quando uma nova carga de GRID entrar. Deixe em branco o que não precisa mudar. ${pode?"":"<br><strong>Você pode ver os ajustes, mas só quem edita a Manutenção pode alterá-los.</strong>"}</p>
    <datalist id="ajTipos">${tipos.map(t=>`<option value="${escapeHtml(t)}">`).join("")}</datalist>
    <datalist id="ajEquipes">${eqs.map(t=>`<option value="${escapeHtml(t)}">`).join("")}</datalist>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; align-items:end;">
      ${campo("ajOs","OS","ex.: ESS-RD-BP 007962/2026","")}
      ${campo("ajTipo","Tipo de equipe","(manter original)","ajTipos")}
      ${campo("ajEquipe","Equipe executora","(manter original)","ajEquipes")}
      ${campo("ajAlim","Alimentador","(manter original)","")}
      ${campo("ajProt","Proteção","(manter original)","")}
    </div>
    <div id="ajInfo" style="font-size:12px; color:var(--muted); margin:8px 0;"></div>
    ${pode ? `<div style="display:flex; gap:8px;"><button class="btn btn-primary" onclick="ajusteOsSalvar()">${ic("check")} Salvar ajuste</button><button class="btn btn-ghost" onclick="ajusteOsLimpar()">Limpar</button></div>` : ""}
    <h3 style="margin-top:16px;">Ajustes em vigor <span style="color:var(--muted); font-weight:500;">— ${lista.length}</span></h3>
    <div class="usr-busca"><input type="search" placeholder="Buscar ajuste: OS, tipo de equipe, equipe, alimentador, proteção…" value="${escapeHtml(ajBusca)}" oninput="ajusteOsBuscar(this.value)"></div>
    <div id="ajTabelaWrap">${ajusteOsTabelaHtml()}</div>
  </div>`;
}
function nomeUsuarioPorId(id){ const u = (state.usuarios||[]).find(x=>x.id===id); return u ? u.nome : "—"; }
function ajusteOsAchar(id){
  const k = String(id||"").trim().toUpperCase(); if(!k) return null;
  return (state.manutencaoOS||[]).find(x=>String(x.id).trim().toUpperCase()===k) || null;
}
function ajusteOsInfo(){
  const el = document.getElementById("ajInfo"); if(!el) return;
  const id = (document.getElementById("ajOs")||{}).value || "";
  if(!id.trim()){ el.textContent = ""; return; }
  const o = ajusteOsAchar(id), aj = ajusteDaOS(id);
  if(!o){ el.innerHTML = `OS <b>não encontrada na base</b> — o ajuste será guardado e passa a valer quando ela chegar.`; return; }
  const ori = o._orig || { tipoEquipeExec:o.tipoEquipeExec, equipeId:o.equipeId, alimentador:o.alimentador, protecaoId:o.protecaoId };
  el.innerHTML = `OS encontrada (${escapeHtml(o.statusOS)}${aj?" · já tem ajuste":""}). Original: tipo de equipe <b>${escapeHtml(ori.tipoEquipeExec||"—")}</b> · equipe <b>${escapeHtml(ori.equipeId||"—")}</b> · alimentador <b>${escapeHtml(ori.alimentador||"—")}</b> · proteção <b>${escapeHtml(ori.protecaoId||"—")}</b>`;
}
function ajusteOsPreencher(a){
  const set = (i,v)=>{ const e = document.getElementById(i); if(e) e.value = v||""; };
  set("ajOs", a.id); set("ajTipo", a.tipoEquipe); set("ajEquipe", a.equipeId); set("ajAlim", a.alimentador); set("ajProt", a.protecaoId);
  ajusteOsInfo();
}
function ajusteOsEditar(i){
  const lista = ajusteOsListaOrdenada();
  if(lista[i]){ ajusteOsPreencher(lista[i]); const c = document.getElementById("ajOs"); if(c) c.scrollIntoView({block:"center"}); }
}
function ajusteOsLimpar(){ ajusteOsPreencher({ id:"" }); }
document.addEventListener("change", e=>{
  if(e.target && e.target.id==="ajOs"){
    const a = ajusteDaOS(e.target.value);
    if(a) ajusteOsPreencher(a); else ajusteOsInfo();
  }
});
async function ajusteOsSalvar(){
  const v = i=>((document.getElementById(i)||{}).value||"").trim();
  const id = v("ajOs");
  if(!id){ toast("Informe a OS."); return; }
  const corpo = { tipoEquipe:v("ajTipo"), equipeId:v("ajEquipe"), alimentador:v("ajAlim"), protecaoId:v("ajProt") };
  if(!corpo.tipoEquipe && !corpo.equipeId && !corpo.alimentador && !corpo.protecaoId){ toast("Preencha pelo menos um campo para ajustar."); return; }
  const o = ajusteOsAchar(id), idFinal = (o ? o.id : id).trim().toUpperCase();
  try{
    let reg = { id:idFinal, ...corpo, atualizadoPor:(currentUser&&currentUser.id)||"", atualizadoEm:new Date().toISOString() };
    if(API_ONLINE) reg = await apiSend("PUT", `/ajustes/${encodeURIComponent(idFinal)}`, corpo);
    const lista = (state.ajustesOS||[]).filter(a=>String(a.id).toUpperCase()!==idFinal); lista.push(reg);
    reconstruirAjustesMap(lista);
    reaplicarAjusteNaOS(idFinal);
    toast(`Ajuste da OS ${idFinal} salvo.`);
    render();
  }catch(err){ toast(`Não consegui salvar o ajuste: ${(err&&err.message)||err}`); }
}
async function ajusteOsRemover(i){
  const lista = ajusteOsListaOrdenada();
  const a = lista[i]; if(!a) return;
  if(!window.confirm(`Remover o ajuste da OS ${a.id}? Ela volta a valer o que veio do SGM/SIGOD.`)) return;
  try{
    if(API_ONLINE) await apiSend("DELETE", `/ajustes/${encodeURIComponent(a.id)}`);
    reconstruirAjustesMap((state.ajustesOS||[]).filter(x=>String(x.id).toUpperCase()!==String(a.id).toUpperCase()));
    reaplicarAjusteNaOS(a.id);
    toast(`Ajuste da OS ${a.id} removido.`);
    render();
  }catch(err){ toast(`Não consegui remover: ${(err&&err.message)||err}`); }
}
function schemaInfoHtml(){
  const s = SCHEMAS[importSelecionada];
  // s.campos não existe nas entradas "kmz" (Reserva Legal/APP não têm
  // cabeçalho de coluna pra mostrar — são polígono, não planilha/atributo)
  // — sem o "|| []" aqui, só SELECIONAR uma delas no combo já quebrava essa
  // função inteira (schemaInfoHtml é chamada de novo a cada render da tela,
  // então o erro se repetia a cada clique em "Importação de Bases" depois
  // disso, dando a impressão de tela travada).
  const linhas = (s.campos || []).map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${String(r[2]).startsWith("Sim")?`<span class="pill warn">obrigatório</span>`:`<span class="pill muted">opcional</span>`}</td></tr>`).join("");
  if(s.tipo==="rank"){
    return `<div class="note" style="margin-bottom:12px;">${ic("info")}<div>${s.origem}</div></div>
      <h3>Colunas lidas</h3>
      <div class="table-wrap"><table><thead><tr><th>Coluna</th><th>Formato</th><th>Uso</th></tr></thead><tbody>${s.campos.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${String(r[2]).startsWith("Sim")?`<span class="pill warn">obrigatório</span>`:`<span class="pill muted">opcional</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if(s.tipo==="podas"){
    return `
      <div class="note" style="margin-bottom:12px;">${ic("info")}<div>${s.origem}</div></div>
      <h3>Os arquivos (${s.arquivosEsperados.filter(a=>!a.opcional).length} obrigatório(s) + ${s.arquivosEsperados.filter(a=>a.opcional).length} opcional(is))</h3>
      <div class="table-wrap" style="margin-bottom:14px;"><table>
        <thead><tr><th>Arquivo</th><th>Papel</th></tr></thead>
        <tbody>${s.arquivosEsperados.map(a=>`<tr><td class="mono">${a.rotulo}</td><td>${a.papel}</td></tr>`).join("")}</tbody>
      </table></div>
      <h3>Colunas usadas no cruzamento</h3>
      <div class="table-wrap"><table class="schema-table">
        <thead><tr><th>Coluna</th><th>Tipo</th><th>Obrigatório</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      ${s.subtipo==="historico" ? `<p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Só entram as OS que aparecem tanto no SGM quanto na MO (cruzamento pelo número da OS) e cuja data de execução cai no período do plano. O histórico é guardado em separado e consultado em <b>Histórico de Podas</b>; ele não mexe nas OS de hoje, nos alertas, no rank nem nas programações.</p>` : `<p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Só entram no mapa as OS que aparecem tanto no SGM quanto na MO correspondente (cruzamento pelo número da OS). Sem coordenada válida, a OS também fica de fora — o resumo depois de importar mostra quantas caíram em cada caso. Importar este lote não mexe nas OS do outro lote (Executado/Pendente) que já estiverem carregadas.</p>`}
    `;
  }
  if(s.tipo==="shapefile"){
    return `
      <div class="note" style="margin-bottom:12px;">${ic("info")}<div><strong>${s.origem}.</strong> Geometria esperada: ${s.geometria}.</div></div>
      <h3>Arquivos necessários</h3>
      <div class="table-wrap" style="margin-bottom:14px;"><table>
        <thead><tr><th>Extensão</th><th>Papel</th></tr></thead>
        <tbody>
          <tr><td class="mono">.shp</td><td>Geometria (as linhas da rede)</td></tr>
          <tr><td class="mono">.dbf</td><td>Atributos de cada trecho (tabela)</td></tr>
          <tr><td class="mono">.shx</td><td>Índice — confirmamos que veio junto, mas não é lido diretamente</td></tr>
          <tr><td class="mono">.prj</td><td>Sistema de coordenadas — avisamos se não for geográfico (graus)</td></tr>
        </tbody>
      </table></div>
      <h3>Atributos (.dbf) esperados</h3>
      <div class="table-wrap"><table class="schema-table">
        <thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      <p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Um arquivo <span class="mono">.fix</span> às vezes acompanha o shapefile — é um subproduto de alguma ferramenta de GIS, não faz parte do padrão shapefile e não é usado nesta importação.</p>
    `;
  }
  if(s.tipo==="kmz"){
    return `
      <div class="note" style="margin-bottom:12px;">${ic("info")}<div><strong>${s.origem}.</strong> Geometria esperada: ${s.geometria}.</div></div>
      <h3>Um arquivo por alimentador</h3>
      <p style="font-size:12.5px; margin-bottom:10px;">Selecione quantos <span class="mono">.kmz</span> quiser de uma vez — cada um vira a camada de <strong>um</strong> alimentador. O nome do arquivo é o que diz qual é qual (ex.: <span class="mono">Trecho_AL1C01_${s.camada==="app"?"APP":"RL"}.kmz</span> → alimentador <span class="mono">AL1C01</span>).</p>
      <h3>Base incremental</h3>
      <p style="font-size:12.5px; color:var(--muted);">Subir o .kmz de um alimentador novo <strong>não apaga</strong> os alimentadores já carregados antes — cada upload só grava/atualiza a partição do(s) alimentador(es) enviado(s) agora. Pra apagar um alimentador importado errado, use a aba "Camadas de rede" em Gestão de Bases.</p>
    `;
  }
  return `
    <h3>Cabeçalho e tipos esperados</h3>
    <div class="table-wrap"><table class="schema-table">
      <thead><tr><th>Coluna</th><th>Tipo</th><th>Obrigatório</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>
    <button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="baixarModeloExcel()">${ic("upload")} Baixar modelo</button>
  `;
}
function baixarModeloExcel(){
  const s = SCHEMAS[importSelecionada];
  if(typeof XLSX === "undefined"){ toast("Biblioteca de planilha não carregou — confira sua conexão."); return; }
  const cabecalho = s.campos.map(c=>c[0]);
  const ws = XLSX.utils.aoa_to_sheet([cabecalho]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, `modelo_${importSelecionada.replace(/\s+/g,"_")}.xlsx`);
}
function importDropHtml(){
  const s = SCHEMAS[importSelecionada];
  if(s.tipo==="rank"){
    return `${ic("upload")}<div style="margin-top:8px; font-weight:600;">Arraste o Excel da engenharia aqui ou clique para selecionar</div><div style="font-size:11.5px; margin-top:4px;">.xlsx — cada aba pode virar uma lista</div>
      <div class="import-file-name" id="importFileName">${rankImp ? escapeHtml(rankImp.arquivo) : ""}</div>`;
  }
  if(s.tipo==="shapefile"){
    const nomes = importArquivosShapefile.map(f=>f.name).join(", ");
    return `${ic("upload")}<div style="margin-top:8px; font-weight:600;">Arraste os arquivos aqui ou clique para selecionar</div>
      <div style="font-size:11.5px; margin-top:4px;">.shp + .dbf (+ .shx e .prj se tiver) — soltos ou tudo dentro de um único .zip</div>
      <div class="import-file-name" id="importFileName">${nomes ? escapeHtml(nomes) : ""}</div>`;
  }
  if(s.tipo==="kmz"){
    // reaproveita o mesmo array de "vários arquivos" do shapefile — mesma
    // mecânica (seleciona/arrasta vários, cada um some pro próprio papel),
    // só muda o que cada arquivo representa (1 alimentador inteiro, não um
    // pedaço de um shapefile só).
    const nomes = importArquivosShapefile.map(f=>f.name).join(", ");
    return `${ic("upload")}<div style="margin-top:8px; font-weight:600;">Arraste os .kmz aqui ou clique para selecionar</div>
      <div style="font-size:11.5px; margin-top:4px;">1 ou mais .kmz — um por alimentador (ex.: Trecho_AL1C01_${s.camada==="app"?"APP":"RL"}.kmz)</div>
      <div class="import-file-name" id="importFileName">${nomes ? escapeHtml(nomes) : ""}</div>`;
  }
  if(s.tipo==="podas"){
    const detectados = detectarArquivosPodas(importArquivosPodas);
    const linhas = s.arquivosEsperados.map(a=>{
      const achou = detectados[a.chave];
      return `<div style="display:flex; justify-content:space-between; gap:8px; padding:4px 0;">
        <span class="mono">${a.rotulo}${a.opcional?` <span style="color:var(--muted); font-weight:400;">(opcional)</span>`:``}</span>
        <span>${achou ? `${ic("check")} ${escapeHtml(achou.name)}` : `<span style="color:var(--muted);">— não selecionado</span>`}</span>
      </div>`;
    }).join("");
    return `${ic("upload")}<div style="margin-top:8px; font-weight:600;">${s.arquivosEsperados.length===1?"Arraste o arquivo aqui ou clique para selecionar":`Arraste os ${s.arquivosEsperados.length} arquivos juntos ou clique para selecionar`}</div>
      <div style="font-size:11.5px; margin-top:4px;">Reconheço qual é qual pelo nome do arquivo (ex.: ${s.subtipo==="sigodpend"?"pendentes_sigod.xlsx":s.subtipo==="sigod"?"basePoda09-2026.xlsx":`SGM_${(s.subtipo==="executado"||s.subtipo==="historico")?"EXECUTADO":"PENDENTE"}_CONSOLIDADO.xlsx (o nome GRID_${(s.subtipo==="executado"||s.subtipo==="historico")?"EXECUTADO":"PENDENTE"}_CONSOLIDADO.xlsx também vale)`})</div>
      <div id="importFileName" style="text-align:left; margin-top:10px;">${linhas}</div>`;
  }
  return `${ic("upload")}<div style="margin-top:8px; font-weight:600;">Arraste o Excel aqui ou clique para selecionar</div><div style="font-size:11.5px; margin-top:4px;">.xlsx, .xls ou .csv</div>
    <div class="import-file-name" id="importFileName">${importArquivoAtual ? escapeHtml(importArquivoAtual.name) : ""}</div>`;
}
function detectarArquivosPodas(arquivos){
  const s = SCHEMAS[importSelecionada];
  const detectados = {};
  s.arquivosEsperados.forEach(a=>{
    detectados[a.chave] = arquivos.find(f=>{
      const nome = f.name.toLowerCase();
      return a.padroes.some(p=>nome.includes(p));
    }) || null;
  });
  return detectados;
}
function importLogRowsHtml(){
  if(state.importLog.length===0) return `<tr><td colspan="6"><div class="empty">${ic("empty")}<div>Nenhuma importação registrada ainda.</div></div></td></tr>`;
  return state.importLog.map(l=>`<tr><td>${l.base}</td><td>${l.usuario}</td><td>${fmtDateTime(l.dataHora)}</td><td class="num">${l.processados}</td><td class="num">${l.erros}</td><td class="mono">${l.arquivo}</td></tr>`).join("");
}
function mudarBaseImportacao(v){
  importSelecionada = v;
  importArquivoAtual = null;
  importLinhasParseadas = null;
  importValidacao = null;
  importArquivosShapefile = [];
  importArquivosPodas = [];
  rankImp = null;
  const s = SCHEMAS[v];
  document.getElementById("schemaInfo").innerHTML = schemaInfoHtml();
  document.getElementById("importDrop").innerHTML = importDropHtml();
  document.getElementById("importResult").innerHTML = "";
  const input = document.getElementById("importFileInput");
  if(input){
    input.value = "";
    input.accept = s.tipo==="shapefile" ? ".zip,.shp,.shx,.dbf,.prj" : s.tipo==="kmz" ? ".kmz" : s.tipo==="podas" ? ".xlsx,.xls" : s.tipo==="rank" ? ".xlsx,.xls" : ".xlsx,.xls,.csv";
    if(s.tipo!=="excel" && s.tipo!=="rank"){ input.setAttribute("multiple",""); } else { input.removeAttribute("multiple"); }
  }
  const btn = document.getElementById("importActionBtn");
  if(btn){ btn.innerHTML = `${ic("check")} ${rotuloBotaoImportar(s)}`; }
  histImportPrepararCampos();
}
/* Rótulo do botão de ação — centralizado aqui porque agora são 4 fluxos
   de "upload direto, 1 clique" (shapefile/kmz/podas/VERA) e só 5 bases
   continuam no fluxo genérico de 2 passos (Validar -> Confirmar). */
function rotuloBotaoImportar(s){
  if(s.tipo==="shapefile") return "Importar shapefile";
  if(s.tipo==="kmz") return "Importar KMZ";
  if(s.tipo==="podas") return "Importar podas";
  if(s.tipo==="rank") return "Enviar lista";
  if(s.tipo==="excel" && s.grande) return "Importar " + (s.nomeCurto || "base");
  return "Validar arquivo";
}

/* ---------------- upload real do arquivo ---------------- */
function onImportFileDrop(e){
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  onImportFileSelected(e.dataTransfer.files);
}
async function onImportFileSelected(files){
  if(!files || !files.length) return;
  const s = SCHEMAS[importSelecionada];

  if(s.tipo==="rank"){ await rankArquivoSelecionado(files); return; }

  if(s.tipo==="shapefile" || s.tipo==="kmz"){
    importArquivosShapefile = Array.from(files);
    importValidacao = null;
    document.getElementById("importFileName").textContent = importArquivosShapefile.map(f=>f.name).join(", ");
    const rotulo = s.tipo==="kmz" ? "Importar KMZ" : "Importar shapefile";
    document.getElementById("importResult").innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div>${importArquivosShapefile.length} arquivo(s) selecionado(s). Clique em "${rotulo}".</div></div>`;
    return;
  }

  if(s.tipo==="podas"){
    // acumula em vez de substituir — dá pra selecionar os 4 em passadas
    // separadas, e arrastar um substitui só o que bater o mesmo nome de papel
    const novos = Array.from(files);
    const detectadosNovos = detectarArquivosPodas(novos);
    s.arquivosEsperados.forEach(a=>{
      if(detectadosNovos[a.chave]){
        importArquivosPodas = importArquivosPodas.filter(f=>!detectarArquivosPodas([f])[a.chave]);
        importArquivosPodas.push(detectadosNovos[a.chave]);
      }
    });
    document.getElementById("importDrop").innerHTML = importDropHtml();
    const detectados = detectarArquivosPodas(importArquivosPodas);
    const faltando = s.arquivosEsperados.filter(a=>!a.opcional && !detectados[a.chave]);
    document.getElementById("importResult").innerHTML = faltando.length===0
      ? `<div class="note" style="margin-top:12px;">${ic("check")}<div>Os ${s.arquivosEsperados.length} arquivos foram reconhecidos. Clique em "Importar podas".</div></div>`
      : `<div class="note" style="margin-top:12px; background:var(--warn-bg); color:var(--warn-fg);">${ic("info")}<div>Ainda falta: ${faltando.map(a=>a.rotulo).join(", ")}. O nome do arquivo precisa conter esse padrão (ex.: ${s.subtipo==="sigod"?"basePoda09-2026.xlsx":`SGM_${(s.subtipo==="executado"||s.subtipo==="historico")?"EXECUTADO":"PENDENTE"}_CONSOLIDADO.xlsx (o nome GRID_${(s.subtipo==="executado"||s.subtipo==="historico")?"EXECUTADO":"PENDENTE"}_CONSOLIDADO.xlsx também vale)`}).</div></div>`;
    return;
  }

  const file = files[0];

  // VERA ("grande") não passa por XLSX.js no navegador — o arquivo cru
  // (até 140 mil+ linhas reais) só é guardado aqui e enviado como está;
  // quem lê é o Controller (ver enviarVera). Diferente do resto do fluxo
  // "excel" genérico logo abaixo, que ainda lê no navegador porque as
  // outras bases (Metas/Equipes/Vão/Proteção/Prefeituras) são pequenas e
  // o passo de "Validar antes de Confirmar" continua útil pra elas.
  if(s.tipo==="excel" && s.grande){
    importArquivoAtual = file;
    importValidacao = null;
    document.getElementById("importFileName").textContent = file.name;
    document.getElementById("importResult").innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div>"${escapeHtml(file.name)}" selecionado. Clique em "Importar ${escapeHtml(s.nomeCurto || "base")}".</div></div>`;
    return;
  }

  importArquivoAtual = file;
  importValidacao = null;
  document.getElementById("importFileName").textContent = file.name;
  document.getElementById("importResult").innerHTML = barraIndeterminadaHtml(`Lendo "${file.name}"…`);
  try{
    importLinhasParseadas = await parseArquivoImportacao(file);
    document.getElementById("importResult").innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div>${importLinhasParseadas.length} linha(s) lida(s). Clique em "Validar arquivo".</div></div>`;
  }catch(err){
    console.error(err);
    importLinhasParseadas = null;
    document.getElementById("importResult").innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Não consegui ler esse arquivo (${escapeHtml(err.message||String(err))}). Confira se é um .xlsx/.xls/.csv válido.</div></div>`;
  }
}
/* Barra "indeterminada" (sem percentual conhecido, ao contrário da
   importBarraHtml de Podas/shapefile) — usada nos 3 passos das importações
   genéricas (ler o Excel no navegador, validar no Controller, gravar no
   Controller), que costumam ser rápidos demais pra valer a pena medir
   progresso real, mas ainda merecem um indicador visível de carregamento. */
function barraIndeterminadaHtml(mensagem){
  return `
    <div class="note" style="margin-top:12px;">${ic("info")}<div>${escapeHtml(mensagem)}</div></div>
    <div class="bar-track" style="margin-top:8px;"><div class="bar-fill-indeterminate"></div></div>
  `;
}
function parseArquivoImportacao(file){
  return new Promise((resolve, reject)=>{
    if(typeof XLSX === "undefined"){ reject(new Error("biblioteca de planilha não carregada")); return; }
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:"array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(sheet, { defval:"", raw:false });
        resolve(linhas);
      }catch(err){ reject(err); }
    };
    reader.onerror = ()=>reject(new Error("falha ao ler o arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

/* ---------------- validar / confirmar (chamadas reais à API) ----------------
   Timeout de 120s (era o padrão de 30s, sem jeito de estender — apiSend não
   aceitava timeoutMs): bases pequenas (Metas, Equipes, Vão, Proteção,
   Prefeituras) validam em menos de 1s, mas a VERA (árvores) pode chegar a
   140 mil+ linhas num envio só, e mesmo depois de corrigido o "+=" O(n²)
   em Test-ImportRows (Validacao.ps1), ler/transferir um corpo JSON desse
   tamanho ainda merece uma folga maior que o padrão genérico. */
const IMPORT_GENERICA_TIMEOUT_MS = 120000;

/* Trava contra duplo-clique: sem isso, clicar "Validar arquivo" mais de
   uma vez (ex.: enquanto a barra ainda está rodando, achando que não
   registrou o clique) dispara requisições concorrentes com o mesmo corpo
   grande em paralelo, piorando exatamente o cenário que já é mais lento
   (base grande) — sem ganho nenhum, já que o resultado da segunda chamada
   simplesmente substitui o da primeira. Os botões de shapefile/podas já
   se desabilitavam assim; a importação genérica (Validar/Confirmar) nunca
   tinha recebido o mesmo cuidado. */
let importEmAndamento = false;

async function executarImportacao(){
  const s = SCHEMAS[importSelecionada];
  if(s.tipo==="rank"){ await rankExecutarImportacao(); return; }
  if(s.tipo==="shapefile"){ await enviarShapefile(); return; }
  if(s.tipo==="kmz"){ await enviarKmz(); return; }
  if(s.tipo==="podas"){ await enviarPodas(); return; }
  if(s.tipo==="excel" && s.grande){ await enviarVera(); return; }
  if(importEmAndamento) return;
  const resultEl = document.getElementById("importResult");
  if(!importLinhasParseadas || importLinhasParseadas.length===0){
    toast("Selecione um arquivo antes de validar.");
    return;
  }
  if(!API_ONLINE){
    toast("Controller offline — abra o sistema pelo iniciar.bat para importar de verdade.");
    return;
  }
  importEmAndamento = true;
  const btn = document.getElementById("importActionBtn");
  if(btn) btn.disabled = true;
  resultEl.innerHTML = barraIndeterminadaHtml(`Validando ${importLinhasParseadas.length} linha(s)…`);
  try{
    const resp = await apiPost("/importacao/validar", { base:s.apiBase, linhas:importLinhasParseadas }, IMPORT_GENERICA_TIMEOUT_MS);
    importValidacao = resp;
    resultEl.innerHTML = renderValidacaoResultado(resp);
  }catch(err){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao validar: ${escapeHtml(err.message)}</div></div>`;
  }finally{
    importEmAndamento = false;
    if(btn) btn.disabled = false;
  }
}
function renderValidacaoResultado(resp){
  const totalErros = (typeof resp.totalErros === "number") ? resp.totalErros : (resp.erros ? resp.erros.length : 0);
  const temErro = totalErros>0;
  const previaLinhas = (resp.preVisualizacao||[]).map((row,i)=>`
    <tr><td>${i+1}</td>${Object.values(row).map(v=>`<td>${escapeHtml(String(v))}</td>`).join("")}</tr>`).join("");
  const previaCabecalho = resp.preVisualizacao && resp.preVisualizacao.length
    ? Object.keys(resp.preVisualizacao[0]).map(k=>`<th>${escapeHtml(k)}</th>`).join("") : "";
  const erros = resp.erros || [];
  return `
    <div class="note" style="margin-top:12px; ${temErro?'background:var(--warn-bg); color:var(--warn-fg);':''}">
      ${ic("info")}<div>${resp.validas} de ${resp.totalLinhas} linha(s) válida(s)${temErro?`, ${totalErros} erro(s) encontrado(s)`:" — nenhum erro."}</div>
    </div>
    ${temErro ? `
    <div class="table-wrap" style="margin-top:8px;"><table>
      <thead><tr><th>Linha</th><th>Coluna</th><th>Motivo</th></tr></thead>
      <tbody>${erros.map(e=>`<tr style="background:var(--bad-bg);"><td>${e.numeroLinha}</td><td class="mono">${escapeHtml(e.coluna)}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join("")}</tbody>
    </table></div>
    ${totalErros>erros.length ? `<p style="color:var(--muted); font-size:11.5px; margin-top:6px;">Mostrando os primeiros ${erros.length} de ${totalErros} erro(s) — corrija esses e revalide para ver os demais.</p>` : ""}` : ""}
    ${previaLinhas ? `
    <h3 style="margin-top:14px;">Pré-visualização (linhas válidas)</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th>${previaCabecalho}</tr></thead>
      <tbody>${previaLinhas}</tbody>
    </table></div>` : ""}
    ${resp.validas>0 ? `<button class="btn btn-accent" id="importConfirmarBtn" style="margin-top:12px; width:100%; justify-content:center;" onclick="confirmarImportacao()">${ic("check")} Confirmar e gravar ${resp.validas} registro(s)</button>` : ""}
  `;
}
async function confirmarImportacao(){
  if(importEmAndamento) return;
  const s = SCHEMAS[importSelecionada];
  const resultEl = document.getElementById("importResult");
  if(!importLinhasParseadas){ toast("Selecione e valide um arquivo primeiro."); return; }
  importEmAndamento = true;
  const btn = document.getElementById("importConfirmarBtn");
  if(btn) btn.disabled = true;
  resultEl.innerHTML = barraIndeterminadaHtml("Gravando…");
  try{
    const resp = await apiPost("/importacao/confirmar", { base:s.apiBase, linhas:importLinhasParseadas, arquivoOrigem: importArquivoAtual ? importArquivoAtual.name : "" }, IMPORT_GENERICA_TIMEOUT_MS);
    resultEl.innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div>${resp.processados} registro(s) gravado(s) em model/. Log de importação atualizado abaixo.</div></div>`;
    toast(`Importação concluída — ${resp.processados} registro(s) gravado(s).`);
    if(s.apiBase==="Conjuntos") await recarregarConjuntos();
    if(resp.log){
      state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
      const tbody = document.getElementById("importLogRows");
      if(tbody) tbody.innerHTML = importLogRowsHtml();
    }
  }catch(err){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao gravar: ${escapeHtml(err.message)}</div></div>`;
  }finally{
    importEmAndamento = false;
    if(btn) btn.disabled = false;
  }
}

/* Shapefile de rede (MT/BT/AT): o navegador só empacota e envia os arquivos
   — quem lê o .shp/.dbf binário e grava o GeoJSON é o Controller (mesmo
   leitor do script de linha de comando). Sem etapa separada de "validar":
   o próprio ato de importar já grava, exatamente como o script sempre fez.
   Upload em streaming (mesmo padrão NDJSON do Podas — ver
   apiUploadFormDataStream em api.js e Invoke-ShapefileStreamingUpload no
   Controller): o SSDMT real tem 427.910 registros e pode levar minutos pra
   ler, então a barra de progresso mostra fase a fase (descompactando →
   lendo .shp → lendo .dbf → cruzando → gravando) em vez de travar numa
   mensagem estática — e o timeout é "de trava" (reinicia a cada linha de
   progresso recebida), não um limite fixo de poucos minutos como antes. */
async function enviarShapefile(){
  const s = SCHEMAS[importSelecionada];
  const resultEl = document.getElementById("importResult");
  if(importArquivosShapefile.length===0){ toast("Selecione os arquivos do shapefile antes de importar."); return; }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat para importar de verdade."); return; }

  const temShp = importArquivosShapefile.some(f=>f.name.toLowerCase().endsWith(".shp"));
  const temDbf = importArquivosShapefile.some(f=>f.name.toLowerCase().endsWith(".dbf"));
  const temZip = importArquivosShapefile.some(f=>f.name.toLowerCase().endsWith(".zip"));
  if(s.camada==="equipamentos"){
    const temXlsx = importArquivosShapefile.some(f=>f.name.toLowerCase().endsWith(".xlsx"));
    if(!temZip && !temDbf && !temXlsx){
      resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Preciso dos .dbf (UNTRMT, UNSEMT, UNREMT, UNCRMT) — soltos ou dentro de um .zip — ou dos Excels do GeoSpatial (Power Transformer / Isolating Equipment = nomes operativos).</div></div>`;
      return;
    }
  }else if(!temZip && (!temShp || !temDbf)){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Faltam arquivos — preciso do .shp e do .dbf juntos (ou de um .zip com eles dentro).</div></div>`;
    return;
  }

  resultEl.innerHTML = importBarraHtml();
  const btn = document.getElementById("importActionBtn");
  if(btn) btn.disabled = true;
  try{
    const fd = new FormData();
    fd.append("camada", s.camada);
    fd.append("base", importSelecionada);
    importArquivosShapefile.forEach(f => fd.append("arquivo", f, f.name));
    // stallMs mais folgado que o padrão (120s) pra essa rota: mesmo com o
    // escritor de GeoJSON rápido (progresso a cada trecho, não mais um
    // ConvertTo-Json silencioso), uma camada BT real pode ter centenas de
    // milhares de trechos, e cada linha de progresso ainda depende da rede
    // entregar a resposta em partes a tempo — uma margem maior custa nada
    // e evita abortar uma importação que só estava sendo lenta de verdade.
    const resp = await apiUploadFormDataStream("/importacao/shapefile", fd, atualizarBarraShapefile, 240000);

    if(s.camada==="equipamentos"){
      const eq = resp.equipamentos || {};
      const pc = (n,t)=> t ? Math.round(100*n/t) : 0;
      resultEl.innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div><strong>Equipamentos importados e ligados ao poste:</strong>
        ${(eq.camadas||[]).map(c=>`<br>• <strong>${escapeHtml((EQUIP_CFG[c.camada]||{}).plural||c.camada)}</strong> (${escapeHtml(c.arquivo)}): ${Number(c.total).toLocaleString("pt-BR")} gravado(s) — ${Number(c.comPoste).toLocaleString("pt-BR")} com poste (${pc(c.comPoste,c.total)}%)${c.semPoste?`, ${c.semPoste} só com a posição do PAC`:""}${c.semPosicao?`; <span style="color:var(--warn-fg);">${Number(c.semPosicao).toLocaleString("pt-BR")} sem coordenada no PAC (ficam fora do mapa)</span>`:""}`).join("")}
        ${(eq.nomes||[]).map(n=>`<br>• <strong>Nomes operativos — ${n.camada==="protecoes"?"proteções/chaves":"trafos"}</strong> (${escapeHtml(n.arquivo)}): ${Number(n.lidos).toLocaleString("pt-BR")} nome(s) lido(s); a base de nomes agora tem ${Number(n.totalGravado).toLocaleString("pt-BR")}.`).join("")}
        ${(eq.nomesIgnorados||[]).length ? `<br><span style="color:var(--bad-fg);">Excel ignorado (só “Transformer” e “Isolating” ligam à BDGD): ${(eq.nomesIgnorados||[]).map(escapeHtml).join(", ")}</span>` : ""}
        ${(eq.ignorados||[]).length ? `<br><span style="color:var(--muted);">Ignorados (nome não reconhecido): ${(eq.ignorados||[]).map(escapeHtml).join(", ")}</span>` : ""}
        <br><span style="color:var(--muted);">Veja no Mapa de Manutenção (camadas Trafos / Proteções, zoom 14+) e em Gestão de Bases &gt; Equipamentos.</span></div></div>`;
      toast("Equipamentos importados.");
      importArquivosShapefile = [];
      const inp2 = document.getElementById("importFileInput"); if(inp2) inp2.value = "";
      const nm2 = document.getElementById("importFileName"); if(nm2) nm2.textContent = "";
      if(resp.log){
        state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
        const tb = document.getElementById("importLogRows"); if(tb) tb.innerHTML = importLogRowsHtml();
      }
      if(btn) btn.disabled = false;
      return;
    }
    if(s.camada==="postes"){
      const ap = resp.aplicadoNasOS || {};
      resultEl.innerHTML = `<div class="note" style="margin-top:12px;">${ic("check")}<div><strong>${(resp.trechos||0).toLocaleString("pt-BR")} ponto(s)</strong> gravado(s)${resp.rejeitados>0?`, ${resp.rejeitados} sem geometria`:""}.${resp.postes && resp.postes.porTipo ? `<br>Por tipo: ${Object.entries(resp.postes.porTipo).map(([k,v])=>`${escapeHtml(k)} ${Number(v).toLocaleString("pt-BR")}`).join(" · ")}` : ""}
        <br>Cruzamento com as OS: <strong>${ap.posteEncontrado||0}</strong> de ${ap.osComPoste||0} poste(s) das OS encontrados; ${ap.viraramPoste||0} OS passaram a usar a posição do poste, ${ap.viraramVera||0} a da VERA; ${ap.localidadePorPoste||0} OS sem localidade ganharam o município do poste.<br><span style="color:var(--muted);">Atualize a página (F5) para ver as posições novas no mapa.</span></div></div>`;
      toast("Postes importados e cruzados com as OS.");
      importArquivosShapefile = [];
      const inp = document.getElementById("importFileInput"); if(inp) inp.value = "";
      const nm = document.getElementById("importFileName"); if(nm) nm.textContent = "";
      if(btn) btn.disabled = false;
      return;
    }
    const avisoHtml = resp.avisoProjecao ? `<div class="note" style="margin-top:8px; background:var(--warn-bg); color:var(--warn-fg);">${ic("info")}<div>${escapeHtml(resp.avisoProjecao)}</div></div>` : "";
    const resumoAlimentadores = resp.particionado
      ? `${resp.alimentadores} alimentador(es) gravado(s) em geo/rede_mt/ (um .geojson por CTMT)`
      : `${resp.alimentadores} alimentador(es) gravado(s) num único arquivo GeoJSON`;
    resultEl.innerHTML = `
      <div class="note" style="margin-top:12px;">${ic("check")}<div>${resp.trechos} trecho(s) importado(s)${resp.rejeitados>0?`, ${resp.rejeitados} rejeitado(s)`:""} — ${resumoAlimentadores}.</div></div>
      ${avisoHtml}
      <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">O mapa (módulo Mapa de Manutenção) já serve esses arquivos na hora, sem precisar reiniciar o Controller.</p>
    `;
    toast(`Shapefile importado — ${resp.trechos} trecho(s) gravado(s).`);
    importArquivosShapefile = [];
    const input = document.getElementById("importFileInput");
    if(input) input.value = "";
    const nameEl = document.getElementById("importFileName");
    if(nameEl) nameEl.textContent = "";
    if(resp.log){
      state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
      const tbody = document.getElementById("importLogRows");
      if(tbody) tbody.innerHTML = importLogRowsHtml();
    }
  }catch(err){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao importar: ${escapeHtml(err.message)}</div></div>`;
  }finally{
    if(btn) btn.disabled = false;
  }
}

/* Reserva Legal / APP (KMZ, por alimentador): mesmo endpoint e mesmo
   streaming/NDJSON do shapefile (POST /importacao/shapefile) — só muda o
   que vai no campo "camada" (reserva_legal/app) e que cada arquivo já é um
   .kmz fechado, um por alimentador, não pedaços de um shapefile só (então,
   ao contrário do shapefile, não tem checagem de ".shp + .dbf juntos" —
   qualquer quantidade de .kmz já é válida). O Controller identifica o
   alimentador de cada .kmz pelo nome do arquivo (ver Read-KmzPlacemarks) e
   grava/atualiza só a partição desse(s) alimentador(es) — upload é sempre
   incremental, nunca apaga os outros já carregados.

   LOTES (pedido do Mario, depois de travar o Controller com um teste real):
   em vez de mandar os .kmz selecionados TODOS numa única requisição HTTP
   (que com 300+ arquivos pode virar um corpo enorme numa única conexão —
   e se der qualquer problema no meio, o lote inteiro se perde, nenhum
   alimentador fica salvo), o upload é dividido em lotes pequenos
   (KMZ_LOTE_TAMANHO arquivos por vez), enviados em SEQUÊNCIA (nunca em
   paralelo, mesmo princípio de nunca abrir um fan-out de pedidos pro
   Controller já aplicado em outros lugares deste arquivo). O usuário
   continua selecionando os 300+ de uma vez só (o <input> já aceita
   multi-seleção) — o front-end é quem fatia em lotes sozinho, sem pedir
   nada a mais. Se um lote falhar (ex.: Controller reiniciando no meio),
   os lotes JÁ enviados continuam salvos (cada lote é uma gravação
   independente e incremental no Controller) — só esse lote entra como
   rejeitado, e os próximos continuam tentando. */
const KMZ_LOTE_TAMANHO = 10;
function particionarEmLotes(lista, tamanho){
  const lotes = [];
  for(let i=0; i<lista.length; i+=tamanho) lotes.push(lista.slice(i, i+tamanho));
  return lotes;
}
async function enviarKmz(){
  const s = SCHEMAS[importSelecionada];
  const resultEl = document.getElementById("importResult");
  if(importArquivosShapefile.length===0){ toast("Selecione pelo menos um .kmz antes de importar."); return; }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat para importar de verdade."); return; }

  const temKmz = importArquivosShapefile.some(f=>f.name.toLowerCase().endsWith(".kmz"));
  if(!temKmz){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Nenhum .kmz selecionado — envie um ou mais arquivos .kmz (um por alimentador).</div></div>`;
    return;
  }

  const lotes = particionarEmLotes(importArquivosShapefile, KMZ_LOTE_TAMANHO);
  const btn = document.getElementById("importActionBtn");
  if(btn) btn.disabled = true;

  let totalAlimentadores = 0, totalTrechos = 0, totalRejeitados = 0;
  const errosPorArquivo = [];
  const logsGravados = [];
  let falhasSeguidas = 0;
  let interrompidoEm = null;

  for(let li=0; li<lotes.length; li++){
    const lote = lotes[li];
    const prefixoLote = lotes.length>1 ? `Lote ${li+1} de ${lotes.length} (${lote.length} arquivo(s)) — ` : "";
    resultEl.innerHTML = importBarraHtml();
    const notaLoteEl = () => document.getElementById("importProgTexto");
    const enviarArquivos = async (arquivos) => {
      const fd = new FormData();
      fd.append("camada", s.camada);
      fd.append("base", importSelecionada);
      arquivos.forEach(f => fd.append("arquivo", f, f.name));
      const resp = await apiUploadFormDataStream("/importacao/shapefile", fd, (p)=>{
        atualizarBarraShapefile(p);
        const el = notaLoteEl();
        if(el && prefixoLote) el.textContent = prefixoLote + el.textContent;
      }, 300000);
      totalAlimentadores += resp.alimentadores || 0;
      totalTrechos += resp.trechos || 0;
      totalRejeitados += resp.rejeitados || 0;
      if(Array.isArray(resp.errosDetalhe)) errosPorArquivo.push(...resp.errosDetalhe);
      if(resp.log) logsGravados.push(resp.log);
    };
    try{
      await enviarArquivos(lote);
      falhasSeguidas = 0;
    }catch(err){
      // v2.13.0 - o lote falhou (tempo esgotado, erro no Controller...). Em
      // vez de descartar os 20 arquivos de uma vez (e parar depois de 2
      // lotes ruins — era o "parou no meio" da Reserva Legal), tenta de novo
      // um arquivo por vez: o que for bom entra, só o realmente ruim é
      // rejeitado, com o motivo dele. O que já foi gravado antes do erro é
      // regravado igual (gravação por alimentador, idempotente).
      let falhasNoLote = 0;
      for(const f of lote){
        try{
          await enviarArquivos([f]);
          falhasSeguidas = 0;
        }catch(err1){
          falhasNoLote++;
          falhasSeguidas++;
          totalRejeitados++;
          errosPorArquivo.push({ arquivo: f.name, motivo: err1.message });
          // 5 arquivos seguidos falhando (mesmo sozinhos) = Controller
          // fora do ar de verdade — para aqui e avisa.
          if(falhasSeguidas >= 5){ interrompidoEm = li; break; }
        }
      }
      if(interrompidoEm !== null) break;
    }
  }

  const errosHtml = errosPorArquivo.length
    ? `<details style="margin-top:8px;"><summary style="cursor:pointer; font-size:12px; color:var(--muted);">${errosPorArquivo.length} arquivo(s) com problema — ver detalhe</summary>
        <div class="table-wrap" style="margin-top:6px;"><table class="schema-table"><thead><tr><th>Arquivo</th><th>Motivo</th></tr></thead><tbody>
          ${errosPorArquivo.map(e=>`<tr><td class="mono">${escapeHtml(e.arquivo)}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join("")}
        </tbody></table></div></details>`
    : "";
  const avisoInterrupcaoHtml = interrompidoEm!==null
    ? `<div class="note" style="margin-top:8px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Parei no lote ${interrompidoEm+1} de ${lotes.length} depois de falhas seguidas — confira se o Controller ainda está aberto (iniciar.bat) e tente de novo só com os arquivos que faltaram (os alimentadores já gravados até aqui continuam salvos).</div></div>`
    : "";

  resultEl.innerHTML = `
    <div class="note" style="margin-top:12px;">${ic("check")}<div>${totalAlimentadores} alimentador(es) gravado(s)${totalRejeitados>0?`, ${totalRejeitados} arquivo(s) rejeitado(s)`:""} — ${totalTrechos} polígono(s) ao todo, em geo/${s.camada}/ (um .geojson por alimentador)${lotes.length>1?`, enviados em ${lotes.length} lote(s)`:""}.</div></div>
    ${avisoInterrupcaoHtml}
    ${errosHtml}
    <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">O mapa (módulo Mapa de Manutenção) já serve esses arquivos na hora — escolha o(s) alimentador(es) no combo da camada "${s.camada==="app"?"APP":"Reserva Legal"}". Os alimentadores já carregados antes continuam intactos.</p>
  `;
  toast(`KMZ importado — ${totalAlimentadores} alimentador(es) gravado(s)${totalRejeitados>0?`, ${totalRejeitados} rejeitado(s)`:""}.`);
  // Lembra qual(is) alimentador(es) acabou(aram) de subir — a próxima visita
  // ao Mapa de Manutenção pré-marca eles no combo de Reserva Legal/APP
  // automaticamente (ver initMapaManutencao/popularMultiSelectParticionado),
  // em vez de deixar vazio por padrão como de costume: o pedido aqui era
  // justamente "o resultado tem que aparecer no mapa", sem precisar marcar
  // na mão o alimentador que você acabou de subir agora mesmo.
  lembrarAlimentadoresRecemImportados(s.camada, totalAlimentadores > 0);
  // v3.12.0 - KMZ de APP/RL novo = a posição das OS contra os polígonos mudou: refaz o índice (segundo plano, sem travar a tela)
  if((s.camada==="app" || s.camada==="reserva_legal") && totalAlimentadores > 0) aprlRecalcularSilencioso();

  importArquivosShapefile = [];
  const input = document.getElementById("importFileInput");
  if(input) input.value = "";
  const nameEl = document.getElementById("importFileName");
  if(nameEl) nameEl.textContent = "";
  if(logsGravados.length){
    logsGravados.forEach(log=>{
      state.importLog.unshift({ id: log.id, base: log.base, usuario: nomeAtual(), dataHora: log.dataHora, processados: log.registrosProcessados, erros: log.registrosComErro, arquivo: log.arquivoOrigem });
    });
    const tbody = document.getElementById("importLogRows");
    if(tbody) tbody.innerHTML = importLogRowsHtml();
  }
  if(btn) btn.disabled = false;
}

/* ---------------- Gerenciar camadas carregadas (apagar 1 alimentador) ----------------
   Tela (modal) separada por Rede MT/AT/BT — cada linha é um alimentador já
   importado, com um X na frente. Clicar no X não apaga na hora: troca a
   linha por um aviso com "Confirmar"/"Cancelar", pra evitar apagar uma
   base inteira sem querer. Backend: GET /importacao/camadas (lista) e
   DELETE /importacao/camadas/<camada>/<chave> (apaga 1) — ver
   Get-AlimentadoresCarregados/Remove-AlimentadorCarregado em
   ShapefileImporter.ps1. */
let gerenciarCamadasDados = null;
let gerenciarCamadasConfirmando = null; // "<camada>|<chave>" da linha com aviso aberto, ou null
const GERENCIAR_CAMADAS_ORDEM = [
  { chave:"rede_media_tensao", label:"Rede MT" },
  { chave:"rede_alta_tensao", label:"Rede AT" },
  { chave:"rede_baixa_tensao", label:"Rede BT" },
  // Reserva Legal e APP passaram a ser particionadas por alimentador (vários
  // .kmz, base incremental — pedido do Mario) e já são servidas pelo mesmo
  // GET /importacao/camadas (Get-AlimentadoresCarregados é camada-agnóstico),
  // então só precisaram entrar nesta lista pra aparecer aqui.
  { chave:"reserva_legal", label:"Reserva Legal" },
  { chave:"app", label:"APP (Área de Preservação)" },
];
/* Movido da Importação de Bases pra uma aba da Gestão de Bases (pedido do
   Mario) — renderiza direto em #cadastroGridWrap (o mesmo host das outras
   abas de cadastro) em vez de abrir um modal. */
async function abrirGerenciarCamadas(){
  gerenciarCamadasConfirmando = null;
  const body = document.getElementById("cadastroGridWrap");
  if(body) body.innerHTML = `<div class="note">${ic("info")}<div>Carregando…</div></div>`;
  if(!API_ONLINE){
    if(body) body.innerHTML = `<div class="note" style="background:var(--warn-bg); color:var(--warn-fg);">${ic("info")}<div>Controller offline — abra o sistema pelo iniciar.bat pra gerenciar as camadas de verdade.</div></div>`;
    return;
  }
  try{
    gerenciarCamadasDados = await apiGet("/importacao/camadas");
    renderGerenciarCamadas();
  }catch(err){
    const el = document.getElementById("cadastroGridWrap");
    // "Failed to fetch" é erro de REDE (não um 4xx/5xx do Controller) — na
    // prática quase sempre significa que o Controller fechou ou ainda não
    // subiu, então a mensagem genérica "Erro ao carregar" não dizia o que
    // fazer. Mensagem mais específica pra esse caso em particular.
    const mensagem = /failed to fetch/i.test(err.message)
      ? "Não consegui falar com o Controller — confira se a janela do iniciar.bat ainda está aberta (se ela fechou sozinha, reabra o SPARK por ela de novo)."
      : `Erro ao carregar: ${escapeHtml(err.message)}`;
    if(el) el.innerHTML = `<div class="note" style="background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>${mensagem}</div></div>`;
  }
}
function renderGerenciarCamadas(){
  const body = document.getElementById("cadastroGridWrap");
  if(!body || !gerenciarCamadasDados) return;
  const camadaAtiva = (CADASTROS_BASES[cadastroBaseAtiva]||{}).camada;
  body.innerHTML = cadastroAcoesHtml() + GERENCIAR_CAMADAS_ORDEM.filter(c=>!camadaAtiva || c.chave===camadaAtiva).map(c=>{
    const itens = gerenciarCamadasDados[c.chave] || [];
    return `
      <div style="margin-bottom:16px;">
        <h4 style="font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin-bottom:6px;">${c.label} <span style="font-weight:400;">(${itens.length})</span></h4>
        ${itens.length===0
          ? `<p style="color:var(--muted); font-size:12.5px;">Nenhum alimentador carregado.</p>`
          : `<div style="display:flex; flex-direction:column; gap:6px;">${itens.map(it=>alimentadorRowHtml(c.chave, it)).join("")}</div>`}
      </div>`;
  }).join("");
}
function alimentadorRowHtml(camada, item){
  const idLinha = `${camada}|${item.chave}`;
  const trechosTexto = typeof item.trechos==="number" ? `${item.trechos.toLocaleString("pt-BR")} trecho(s)` : "—";
  if(gerenciarCamadasConfirmando === idLinha){
    return `
      <div style="display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:10px; background:var(--bad-bg); color:var(--bad-fg);">
        ${ic("warn")}
        <div style="flex:1; font-size:12.5px;">Apagar <strong>${escapeHtml(item.nome)}</strong> (${trechosTexto})? Não dá pra desfazer.</div>
        <button class="btn btn-sm" style="background:var(--bad-fg); color:#fff; border-color:var(--bad-fg);" onclick="excluirAlimentador('${camada}','${item.chave}')">Confirmar</button>
        <button class="btn btn-ghost btn-sm" onclick="cancelarExclusaoAlimentador()">Cancelar</button>
      </div>`;
  }
  return `
    <div style="display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:10px; background:var(--surface-2);">
      <button class="btn btn-ghost btn-sm" title="Apagar este alimentador" style="padding:4px 7px;" onclick="pedirConfirmacaoExclusao('${camada}','${item.chave}')">${ic("close")}</button>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.nome)}</div>
        <div style="font-size:11.5px; color:var(--muted);">${trechosTexto}</div>
      </div>
    </div>`;
}
function pedirConfirmacaoExclusao(camada, chave){
  gerenciarCamadasConfirmando = `${camada}|${chave}`;
  renderGerenciarCamadas();
}
function cancelarExclusaoAlimentador(){
  gerenciarCamadasConfirmando = null;
  renderGerenciarCamadas();
}
async function excluirAlimentador(camada, chave){
  try{
    await apiSend("DELETE", `/importacao/camadas/${camada}/${encodeURIComponent(chave)}`);
    gerenciarCamadasDados[camada] = (gerenciarCamadasDados[camada]||[]).filter(it=>it.chave!==chave);
    gerenciarCamadasConfirmando = null;
    renderGerenciarCamadas();
    toast("Alimentador apagado.");
    if(camada==="app" || camada==="reserva_legal") aprlRecalcularSilencioso();
  }catch(err){
    toast(`Erro ao apagar: ${err.message}`);
  }
}

/* "Apagar tudo" — aba admin-only de Gestão de Bases (pedido do Mario: "cria
   um botão ai pra só o adm poder apagar tudo de uma vez... preciso começar
   os testes"). Reaproveita o mesmo padrão de confirmação em 2 passos da
   "Camadas de rede" (bloco vermelho inline, "não dá pra desfazer",
   Confirmar/Cancelar) em vez de um window.confirm() genérico, só que pra
   uma ação muito mais destrutiva — por isso exige digitar "APAGAR" antes
   do botão Confirmar ligar, uma camada extra de segurança contra clique
   acidental numa ação que não tem volta. */
/* ---------------- v3.16.1 - Importar sistema antigo (so no Laravel, so admin) ----------------
   O admin escolhe a pasta "model" do SPARK antigo (PowerShell). O navegador manda cada .json/.tsv
   em pedacos de 8 MB (passa por qualquer limite de upload) e no fim pede pro servidor rodar o
   migrar.php, que SUBSTITUI todos os dados numa transacao (se falhar, nada muda). */
const LEGADO_PEDACO = 8 * 1024 * 1024;
let legadoEstado = { arquivos: [], rodando: false, msg: "", log: "", erro: false };
function legadoHtml(){
  const e = legadoEstado;
  const totalMb = e.arquivos.reduce((s,f)=>s+f.size,0) / 1048576;
  const temUsuarios = e.arquivos.some(f=>f.name==="usuarios.json");
  return `
  <div style="max-width:760px;">
    <h3 style="margin:0 0 6px;">Importar dados do sistema antigo</h3>
    <p style="color:var(--muted); font-size:13px; margin:0 0 12px;">Escolha a pasta <b>model</b> do SPARK antigo (a que fica ao lado do <code>iniciar.bat</code>).
      Todos os dados do sistema novo serão <b>substituídos</b> pelos dessa pasta: usuários, equipes, OS, programações, metas, histórico etc.
      É feito de uma vez só: se der erro no meio, nada é alterado.</p>
    <div class="note" style="margin-bottom:12px;">${ic("info")}<div>Depois da importação, os usuários entram com o <b>e-mail e a senha que usavam no sistema antigo</b>.
      Se o seu e-mail não estiver lá, sua conta atual é mantida.</div></div>
    <div class="field" style="margin-bottom:12px;"><label>Pasta model</label>
      <input type="file" id="legadoPasta" webkitdirectory directory multiple onchange="legadoEscolheu(this.files)" ${e.rodando?"disabled":""}></div>
    ${e.arquivos.length ? `<p style="font-size:13px; margin:0 0 12px;">${e.arquivos.length} arquivos .json/.jsonl/.tsv · ${totalMb.toFixed(1)} MB ${temUsuarios ? "" : `<b style="color:var(--bad-fg);">— não achei o usuarios.json: essa é mesmo a pasta model?</b>`}</p>` : ""}
    <div class="field" style="margin-bottom:12px;"><label>Para confirmar, digite SUBSTITUIR</label>
      <input id="legadoConfirma" placeholder="SUBSTITUIR" style="max-width:220px;" ${e.rodando?"disabled":""}></div>
    <button class="btn btn-primary" onclick="legadoImportar()" ${e.rodando || !temUsuarios ? "disabled" : ""}>${ic("check")} Importar e substituir tudo</button>
    ${e.msg ? `<div class="note" style="margin-top:14px; ${e.erro ? "background:var(--bad-bg); color:var(--bad-fg);" : (e.rodando ? "" : "background:var(--ok-bg); color:var(--ok-fg);")}">${ic(e.erro?"info":"check")}<div>${escapeHtml(e.msg)}</div></div>` : ""}
    ${e.log ? `<details style="margin-top:10px;" ${e.erro?"open":""}><summary style="cursor:pointer; font-size:12.5px;">Detalhes da importação</summary><pre style="font-size:11.5px; max-height:320px; overflow:auto; background:var(--panel-2,#f4f4f4); padding:10px; border-radius:8px;">${escapeHtml(e.log)}</pre></details>` : ""}
  </div>`;
}
function legadoRender(){ const w = document.getElementById("cadastroGridWrap"); if(w && cadastroBaseAtiva==="legado") w.innerHTML = cadastroGridHtml(); }
function legadoEscolheu(lista){
  // so os arquivos soltos da pasta (ignora subpastas como _locks) e so .json/.jsonl/.tsv
  legadoEstado.arquivos = [...(lista||[])].filter(f => /^[A-Za-z0-9_\-]{1,120}\.(json|jsonl|tsv)$/.test(f.name) && (f.webkitRelativePath||"").split("/").length <= 2);
  legadoEstado.msg = ""; legadoEstado.log = ""; legadoEstado.erro = false;
  legadoRender();
}
async function legadoImportar(){
  const conf = (document.getElementById("legadoConfirma")||{}).value || "";
  if(conf.trim().toUpperCase() !== "SUBSTITUIR"){ toast("Digite SUBSTITUIR para confirmar."); return; }
  const e = legadoEstado;
  e.rodando = true; e.erro = false; e.log = "";
  let lote = null;
  try{
    lote = (await apiPost("/importacao/legado/iniciar", {})).lote;
    const total = e.arquivos.reduce((s,f)=>s+f.size,0) || 1;
    let enviado = 0;
    for(const f of e.arquivos){
      for(let pos = 0; pos < f.size || (pos === 0 && f.size === 0); pos += LEGADO_PEDACO){
        const fd = new FormData();
        fd.append("nome", f.name); fd.append("offset", String(pos));
        fd.append("parte", f.slice(pos, pos + LEGADO_PEDACO), f.name);
        await apiUploadFormData(`/importacao/legado/${lote}/parte`, fd);
        enviado += Math.min(LEGADO_PEDACO, f.size - pos);
        e.msg = `Enviando ${f.name}… ${Math.round(enviado*100/total)}%`;
        legadoRender();
        if(f.size === 0) break;
      }
    }
    e.msg = "Arquivos enviados. Gravando no banco (pode levar alguns minutos — não feche esta aba)…";
    legadoRender();
    const r = await apiPost(`/importacao/legado/${lote}/executar`, { confirmacao: "SUBSTITUIR" }, 3600000);
    e.rodando = false;
    e.log = (r && r.log) || "";
    e.msg = `Importação concluída (${r.arquivos} arquivos). Entre de novo ` + (r.adminRecolocado ? "com sua conta atual (seu e-mail não estava no sistema antigo)." : "com seu e-mail e a senha do sistema antigo.") + " Recarregando…";
    legadoRender();
    setTimeout(()=>location.reload(), 4000);
  }catch(err){
    e.rodando = false; e.erro = true;
    let t = err.message; const m = t.match(/\(([^)]+)\)\s*$/); if(m) t = m[1];
    e.msg = `Erro: ${t}`;
    if(lote){ try{ await apiDelete(`/importacao/legado/${lote}`); }catch(x){} }
    legadoRender();
  }
}

let resetarTudoConfirmando = false;
let resetarTudoEmAndamento = false;
let resetarTudoResultado = null;
function resetarTudoHtml(){
  if(!souAdministrador()){
    // Defesa em profundidade: mesmo que alguém force cadastroBaseAtiva via
    // console, a ação em si também é bloqueada no servidor
    // (Test-Administrador, em routes/importacao.ps1).
    return `<div class="note" style="background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Só administradores têm acesso a esta aba.</div></div>`;
  }
  if(resetarTudoResultado){
    return `
      <div class="note" style="background:var(--ok-bg); color:var(--ok-fg);">${ic("check")}<div>${escapeHtml(resetarTudoResultado)}</div></div>
      <p style="color:var(--muted); font-size:12px; margin-top:10px;">A página vai recarregar em instantes pra atualizar todas as telas…</p>
    `;
  }
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:14px;">
      Apaga de uma vez todas as bases importadas — Equipes, Vão, Proteção, VERA, Prefeituras, Metas, Podas/OS, Programação, Justificativas, Logística e o histórico de importações — além das camadas de rede (MT/AT/BT), Reserva Legal e APP já carregadas.
      <strong>Usuários, permissões e feriados cadastrados não são afetados.</strong>
    </p>
    ${!resetarTudoConfirmando ? `
      <button class="btn" style="background:var(--bad-fg); color:#fff; border-color:var(--bad-fg);" onclick="pedirConfirmacaoResetarTudo()">${ic("warn")} Apagar todas as bases</button>
    ` : `
      <div style="display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:12px; background:var(--bad-bg); color:var(--bad-fg); max-width:460px;">
        ${ic("warn")}
        <div style="font-size:13px;"><strong>Essa ação não pode ser desfeita.</strong> Todas as bases importadas e as camadas de rede serão apagadas permanentemente.</div>
        <div style="font-size:12.5px;">Pra confirmar, digite <strong>APAGAR</strong> no campo abaixo:</div>
        <input id="resetarTudoConfirmaTexto" placeholder="Digite APAGAR" oninput="atualizarBotaoResetarTudo()" style="max-width:220px;">
        <div style="display:flex; gap:8px;">
          <button id="resetarTudoBtnConfirmar" class="btn btn-sm" disabled style="background:var(--bad-fg); color:#fff; border-color:var(--bad-fg); opacity:.5;" onclick="confirmarResetarTudo()">${resetarTudoEmAndamento ? "Apagando…" : "Confirmar, apagar tudo"}</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelarResetarTudo()" ${resetarTudoEmAndamento?"disabled":""}>Cancelar</button>
        </div>
      </div>
    `}
  `;
}
function pedirConfirmacaoResetarTudo(){
  resetarTudoConfirmando = true;
  renderResetarTudo();
}
function cancelarResetarTudo(){
  resetarTudoConfirmando = false;
  renderResetarTudo();
}
function atualizarBotaoResetarTudo(){
  const input = document.getElementById("resetarTudoConfirmaTexto");
  const btn = document.getElementById("resetarTudoBtnConfirmar");
  if(!input || !btn) return;
  const ok = input.value.trim().toUpperCase() === "APAGAR";
  btn.disabled = !ok;
  btn.style.opacity = ok ? "1" : ".5";
}
function renderResetarTudo(){
  const wrap = document.getElementById("cadastroGridWrap");
  if(wrap) wrap.innerHTML = resetarTudoHtml();
}
async function confirmarResetarTudo(){
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat pra apagar as bases de verdade."); return; }
  resetarTudoEmAndamento = true;
  renderResetarTudo();
  try{
    await apiSend("POST", "/importacao/resetar-tudo", {});
    resetarTudoConfirmando = false;
    resetarTudoResultado = "Todas as bases importadas e as camadas de rede foram apagadas.";
    renderResetarTudo();
    toast("Bases apagadas.");
    // Praticamente toda tela do sistema depende de dados que acabaram de
    // ser zerados (OS, metas, cadastros, camadas no mapa…) — recarregar a
    // página inteira garante que tudo volte a bater com o servidor, em vez
    // de tentar atualizar cada pedacinho de `state` na mão aqui.
    setTimeout(()=>location.reload(), 1800);
  }catch(err){
    resetarTudoEmAndamento = false;
    toast(`Erro ao apagar: ${err.message}`);
    renderResetarTudo();
  }
}

/* Podas (OS + MO): o navegador só reconhece qual arquivo é qual pelo nome —
   quem lê as planilhas .xlsx, cruza pela OS e converte as coordenadas UTM é
   o Controller (controller/lib/PodasImporter.ps1 + XlsxReader.ps1).
   Executado e Pendente são enviados em lotes SEPARADOS (cada um só com os
   seus 2 arquivos): o GRID_EXECUTADO real tem ~180 mil linhas/69 colunas e
   pode levar vários minutos pra ler, enquanto o GRID_PENDENTE é bem mais
   rápido — juntar os dois numa única espera deixava a tela pesada à toa
   mesmo pra quem só queria atualizar as pendentes.

   Progresso: o Controller vai escrevendo o progresso direto na resposta
   deste próprio upload (streaming/NDJSON — ver apiUploadFormDataStream em
   api.js e Invoke-PodasStreamingUpload no Controller). Não é polling numa
   rota separada porque o Controller só atende um pedido por vez: enquanto
   este upload grande estivesse rodando, uma pergunta "como tá o progresso?"
   em outra chamada ficaria só esperando na fila, sem resposta, até o
   upload terminar — testado e confirmado nesse formato antes de mudar. */
/* Barra de progresso em tempo real (streaming/NDJSON) — compartilhada por
   todas as importações de arquivo que passam pelo Controller (Podas e
   shapefile de rede). Cada tipo só precisa do seu próprio "tradutor" de
   fase -> texto (atualizarBarraPodas/atualizarBarraShapefile abaixo). */
function importBarraHtml(){
  return `
    <div class="note" style="margin-top:12px;">${ic("info")}<div id="importProgTexto">Enviando os arquivos…</div></div>
    <div class="bar-track" style="margin-top:8px;"><div class="bar-fill" id="importProgBarra" style="width:4%; background:var(--primary-2); transition:width .35s ease;"></div></div>
    <p style="color:var(--muted); font-size:11px; margin-top:4px;">Isso lê o arquivo inteiro no Controller — não feche esta aba enquanto a barra andar.</p>
  `;
}
function atualizarBarraImport(p, formatarTexto){
  const barra = document.getElementById("importProgBarra");
  const texto = document.getElementById("importProgTexto");
  if(!barra || !texto) return;
  if(typeof p.percentual === "number"){ barra.style.width = Math.max(4, p.percentual) + "%"; }
  texto.textContent = formatarTexto(p);
}
/* "recebendo"/"recebido": o Controller manda esses dois antes de qualquer
   coisa, enquanto ainda está só recebendo o upload (até uns 60MB no
   GRID_EXECUTADO real) — sem isso essa etapa ficava muda tempo demais e
   estourava o timeout de trava do navegador antes da leitura do Excel em
   si sequer começar (ver Get-MultipartFormData em server.ps1). Comum às
   duas barras (Podas e shapefile), por isso fica num só lugar. */
function textoRecebendoUpload(p){
  if(typeof p.bytesTotal === "number" && p.bytesTotal>0){
    const mb = (n)=> (n/1048576).toFixed(1).replace(".", ",");
    return `Enviando o(s) arquivo(s) ao Controller… — ${mb(p.bytesRecebidos||0)} de ${mb(p.bytesTotal)} MB`;
  }
  return "Enviando o(s) arquivo(s) ao Controller…";
}
function atualizarBarraPodas(p){
  atualizarBarraImport(p, (p)=>{
    if(p.fase === "recebendo" || p.fase === "recebido") return textoRecebendoUpload(p);
    if(p.fase === "indexando") return `Indexando textos de ${p.arquivo}${typeof p.linha==="number" ? ` — ${p.linha.toLocaleString("pt-BR")} encontrados` : "…"}`;
    if(p.fase === "cruzando") return `Cruzando SGM com MO e convertendo coordenadas…${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")} linhas` : ""}`;
    if(p.fase === "gravando") return "Gravando o resultado…";
    if(p.arquivo) return `Lendo ${p.arquivo}${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")} linhas` : "…"}`;
    return "Processando…";
  });
}
function atualizarBarraShapefile(p){
  atualizarBarraImport(p, (p)=>{
    switch(p.fase){
      case "recebendo": case "recebido": return textoRecebendoUpload(p);
      case "descompactando": return "Descompactando o .zip…";
      case "lendo-shp": return `Lendo geometria (.shp)${typeof p.linha==="number" ? ` — ${p.linha.toLocaleString("pt-BR")} trecho(s)` : "…"}`;
      case "lendo-dbf": return `Lendo atributos (.dbf)${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")}` : "…"}`;
      case "cruzando": return "Cruzando geometria com atributos…";
      case "gravando": return "Gravando GeoJSON…";
      case "lendo-kmz": return `Lendo arquivo .kmz${typeof p.arquivo==="number" && typeof p.total==="number" ? ` — ${p.arquivo} de ${p.total}` : "…"}`;
      default:
        // KMZ grava um alimentador por vez — a fase chega como
        // "gravando-<ALIMENTADOR>" (ver Write-FeatureCollectionPoligono em
        // KmzImporter.ps1), por isso o prefixo em vez de um nome fixo.
        if(typeof p.fase==="string" && p.fase.startsWith("gravando-")){
          return `Gravando polígonos — alimentador ${p.fase.slice("gravando-".length)}${typeof p.linha==="number" && typeof p.total==="number" ? ` (${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")})` : "…"}`;
        }
        return "Processando…";
    }
  });
}
async function enviarPodas(){
  const s = SCHEMAS[importSelecionada];
  const resultEl = document.getElementById("importResult");
  const detectados = detectarArquivosPodas(importArquivosPodas);
  const faltando = s.arquivosEsperados.filter(a=>!a.opcional && !detectados[a.chave]);
  if(faltando.length>0){
    toast(`Faltou: ${faltando.map(a=>a.rotulo).join(", ")}.`);
    return;
  }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat para importar de verdade."); return; }
  const ehHistorico = s.subtipo === "historico";
  if(ehHistorico && !histImportConfirmar()) return;

  resultEl.innerHTML = importBarraHtml();
  const btn = document.getElementById("importActionBtn");
  if(btn) btn.disabled = true;
  try{
    const fd = new FormData();
    if(ehHistorico){ fd.append("plano", String(histImportPlano)); fd.append("modo", histImportModo); }
    s.arquivosEsperados.forEach(a => { if(detectados[a.chave]) fd.append(a.chave, detectados[a.chave], detectados[a.chave].name); });
    const resp = await apiUploadFormDataStream(s.endpoint, fd, atualizarBarraPodas, 600000);
    const r = resp.resumo;
    if(ehHistorico){
      resultEl.innerHTML = histImportResultadoHtml(r);
      toast(`Histórico — plano ${r.historicoPlano} gravado — ${r.totalPlotadas} OS.`);
      importArquivosPodas = [];
      document.getElementById("importDrop").innerHTML = importDropHtml();
      histCarregarPlanos().then(()=>{ const el = document.getElementById("histImportInfo"); if(el) el.innerHTML = histImportInfoHtml(); });
      if(resp.log){
        state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
        const tbody = document.getElementById("importLogRows");
        if(tbody) tbody.innerHTML = importLogRowsHtml();
      }
      return;
    }
    const ehSigod = s.subtipo === "sigod";
    if(s.subtipo === "sigodpend"){
      resultEl.innerHTML = `
        <div class="note" style="margin-top:12px;">${ic("check")}<div>${r.totalPlotadas} OS pendentes do SIGOD gravada(s).</div></div>
        <div class="table-wrap" style="margin-top:10px;"><table>
          <thead><tr><th></th><th>Total na planilha</th><th>Com coordenada</th><th>Coordenada inválida</th><th>Com posição aproximada*</th><th>Sem localização</th><th>Já executadas no SIGOD (não repetidas)</th><th>Sem número</th></tr></thead>
          <tbody><tr><td>SIGOD pendentes</td><td class="num">${r.sigodPendTotal}</td><td class="num">${r.sigodPendComCoordenada}</td><td class="num">${r.sigodPendCoordInvalida}</td><td class="num">${r.sigodPendAproximadas}</td><td class="num">${r.sigodPendSemPosicao}</td><td class="num">${r.sigodPendJaExecutadas}</td><td class="num">${r.sigodPendSemNumeroOS}</td></tr></tbody>
        </table></div>
        <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">OS sem coordenada ficam no centro da cidade e aparecem com * no número. O SIGOD executado e o SGM continuam intactos.</p>`;
      toast(`SIGOD pendentes importado — ${r.totalPlotadas} OS.`);
      importArquivosPodas = [];
      document.getElementById("importDrop").innerHTML = importDropHtml();
      if(resp.log){
        state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
        const tbody = document.getElementById("importLogRows");
        if(tbody) tbody.innerHTML = importLogRowsHtml();
      }
      return;
    }
    const ehExecutado = s.subtipo === "executado";
    const rotuloLote = ehSigod ? "SIGOD" : (ehExecutado ? "Executado" : "Pendente");
    const outroLote = ehSigod ? "SGM (Pendente/Executado)" : (ehExecutado ? "Pendente" : "Executado");
    if(ehSigod){
      resultEl.innerHTML = `
        <div class="note" style="margin-top:12px;">${ic("check")}<div>${r.totalPlotadas} OS do SIGOD importada(s) e contadas nos totais${r.sigodSemCoordenada ? ` (${r.sigodSemCoordenada} sem coordenada válida: ${r.sigodAproximadas||0} com posição aproximada no centro da localidade, marcadas com *, e ${r.sigodSemPosicao||0} sem posição, que contam nos totais mas ficam fora do mapa)` : ""}.</div></div>
        <div class="table-wrap" style="margin-top:10px;"><table>
          <thead><tr><th></th><th>Total na planilha</th><th>Sem número de OS</th><th>Sem coordenada válida (entram nos totais)</th><th>Com coordenada</th><th>Executadas</th><th>Plantão</th></tr></thead>
          <tbody><tr><td>SIGOD</td><td class="num">${r.sigodTotal}</td><td class="num">${r.sigodSemNumeroOS}</td><td class="num">${r.sigodSemCoordenada}</td><td class="num">${r.sigodPlotadas}</td><td class="num">${r.sigodExecutadas}</td><td class="num">${r.sigodPlantao}</td></tr></tbody>
        </table></div>
        <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">As OS do ${outroLote} que já estavam carregadas continuam intactas. As podas do SIGOD aparecem no Mapa de Manutenção junto com as demais (use o filtro de origem/status).</p>
      `;
    } else {
    const total = ehExecutado ? r.executadoTotal : r.pendenteTotal;
    const semMO = ehExecutado ? r.executadoSemMO : r.pendenteSemMO;
    const semCoord = ehExecutado ? r.executadoSemCoordenada : r.pendenteSemCoordenada;
    const plotadas = ehExecutado ? r.executadoPlotadas : r.pendentePlotadas;
    const aproximadas = (ehExecutado ? r.executadoAproximadas : r.pendenteAproximadas) || 0;
    const semPosicao = (ehExecutado ? r.executadoSemPosicao : r.pendenteSemPosicao) || 0;

    resultEl.innerHTML = `
      <div class="note" style="margin-top:12px;">${ic("check")}<div>${r.totalPlotadas} OS plotada(s) no mapa (lote ${rotuloLote}).</div></div>
      <div class="table-wrap" style="margin-top:10px;"><table>
        <thead><tr><th></th><th>Total na planilha</th><th>Sem MO correspondente</th><th>Sem coordenada no SGM</th><th>Com posição aproximada*</th><th>Sem localização</th><th>Plotadas com coordenada</th></tr></thead>
        <tbody>
          <tr><td>${rotuloLote}</td><td class="num">${total}</td><td class="num">${semMO}</td><td class="num">${semCoord}</td><td class="num">${aproximadas}</td><td class="num">${semPosicao}</td><td class="num">${plotadas}</td></tr>
        </tbody>
      </table></div>
      ${(!ehExecutado && r.localidadePorPoste) ? `<div class="note" style="margin-top:8px;">${ic("info")}<div><strong>${r.localidadePorPoste}</strong> OS ficaram com a localidade pelo município do poste (a grid pendente não traz Localidade). Municípios sem nome ficam sem localidade — cadastre na base <strong>Municípios</strong>.</div></div>` : ``}
      ${(!ehExecutado && r.pendentePrevistoPorEsquema) ? `<div class="note" style="margin-top:8px;">${ic("info")}<div><strong>${r.pendentePrevistoPorEsquema}</strong> OS pendente(s) sem MO entraram com previsto 1 pelo esquema (base <strong>Esquemas</strong>).</div></div>` : ``}
      <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">"Sem MO correspondente" são OS que existem no SGM mas não apareceram na planilha de mão de obra (ou vice-versa) — só entram as que bateram nas duas${(ehExecutado && r.executadoSoPrevisto) ? ` (exceto ${Number(r.executadoSoPrevisto).toLocaleString("pt-BR")} OS executadas sem MO executada, mas com previsto na MO pendente: ficam com realizado 0, como no BI)` : ""}${r.podaLinear ? ` Foram tratadas ${Number(r.podaLinear).toLocaleString("pt-BR")} OS de PODA LINEAR: recursos zerados e limpeza de faixa pelo tamanho do vão (Rota km × 15.000 m²), como no BI.` : ""}${r.podaLinearSemVao ? " ⚠ A base de Vão ainda não foi reimportada nesta versão: a regra de poda linear não foi aplicada (reimporte o d.Vao e depois este arquivo)." : ""} *OS sem coordenada no SGM continuam no sistema (entram nos totais) com posição aproximada no centro da cidade (ou do setor) e aparecem com asterisco no número; as sem nenhuma referência contam nos totais mas ficam fora do mapa. As OS do outro lote (${outroLote}) que já estavam carregadas continuam intactas. O Mapa de Manutenção já mostra essas OS reais assim que você abrir a tela, sem precisar reiniciar o Controller.</p>
    `;
    }
    toast(`Podas — ${rotuloLote} importado — ${r.totalPlotadas} OS plotada(s).`);
    importArquivosPodas = [];
    document.getElementById("importDrop").innerHTML = importDropHtml();
    if(resp.log){
      state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
      const tbody = document.getElementById("importLogRows");
      if(tbody) tbody.innerHTML = importLogRowsHtml();
    }
  }catch(err){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao importar: ${escapeHtml(err.message)}</div></div>`;
  }finally{
    if(btn) btn.disabled = false;
  }
}

/* "fase" chega como "lendo-vera" (ver Invoke-VeraStreamingUpload no
   Controller) além das fases comuns (recebendo/recebido/validando/
   gravando) compartilhadas com as outras rotas grandes. */
function atualizarBarraVera(p){
  atualizarBarraImport(p, (p)=>{
    switch(p.fase){
      case "recebendo": case "recebido": return textoRecebendoUpload(p);
      case "lendo-vera": return `Lendo a planilha${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")} linhas` : "…"}`;
      case "validando": return `Validando${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")} linha(s)` : "…"}`;
      case "gravando": return `Gravando${typeof p.linha==="number" && typeof p.total==="number" && p.total>0 ? ` — ${p.linha.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")} árvore(s)` : "…"}`;
      case "salvando-json": return `Salvando o arquivo da base${typeof p.total==="number" ? ` (${p.total.toLocaleString("pt-BR")} registro(s))` : ""} — essa parte pode demorar um pouco num arquivo grande…`;
      // As árvores já foram salvas nesse ponto — isso é só um aviso de que o
      // histórico de importações não atualizou, não um erro da importação
      // em si (ver Invoke-VeraStreamingUpload no Controller).
      case "aviso": return p.mensagem || "Aviso durante a gravação…";
      case "resumo-km": return "Cruzando alimentador com Polo/Regional e atualizando os resumos…";
      default: return "Processando…";
    }
  });
}
/* VERA (árvores): upload direto do .xlsx cru, 1 clique, streaming/NDJSON —
   igual shapefile/podas/kmz (ver comentário no Controller,
   Invoke-VeraStreamingUpload, pro motivo). Diferente deles, não acumula
   lista de arquivos (importArquivosShapefile/Podas): reaproveita
   importArquivoAtual, o mesmo var do fluxo genérico "excel", já que é
   sempre um arquivo só. */
async function enviarVera(){
  const s = SCHEMAS[importSelecionada];
  const resultEl = document.getElementById("importResult");
  const unidade = s.unidade || "registro(s)";
  const nomeBase = s.nomeCurto || "VERA";
  if(!importArquivoAtual){ toast(`Selecione o arquivo de ${nomeBase} antes de importar.`); return; }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat para importar de verdade."); return; }
  if(importEmAndamento) return;
  importEmAndamento = true;

  resultEl.innerHTML = importBarraHtml();
  const btn = document.getElementById("importActionBtn");
  if(btn) btn.disabled = true;
  try{
    const fd = new FormData();
    fd.append("arquivo", importArquivoAtual, importArquivoAtual.name);
    // stallMs folgado igual ao shapefile/podas — a planilha real pode
    // passar de 140 mil linhas e cada linha de progresso ainda depende da
    // rede entregar a resposta a tempo.
    const resp = await apiUploadFormDataStream(s.endpoint || "/importacao/vera", fd, atualizarBarraVera, 600000);

    const totalErros = (typeof resp.totalErros === "number") ? resp.totalErros : 0;
    const erros = resp.erros || [];
    const errosHtml = erros.length
      ? `<details style="margin-top:8px;"><summary style="cursor:pointer; font-size:12px; color:var(--muted);">${totalErros} linha(s) com erro — ver detalhe</summary>
          <div class="table-wrap" style="margin-top:6px;"><table><thead><tr><th>Linha</th><th>Coluna</th><th>Motivo</th></tr></thead><tbody>
            ${erros.map(e=>`<tr style="background:var(--bad-bg);"><td>${e.numeroLinha}</td><td class="mono">${escapeHtml(e.coluna)}</td><td>${escapeHtml(e.motivo)}</td></tr>`).join("")}
          </tbody></table></div>
          ${totalErros>erros.length ? `<p style="color:var(--muted); font-size:11.5px; margin-top:6px;">Mostrando os primeiros ${erros.length} de ${totalErros}.</p>` : ""}
        </details>`
      : "";
    resultEl.innerHTML = `
      <div class="note" style="margin-top:12px;">${ic("check")}<div>${resp.processados.toLocaleString("pt-BR")} ${unidade} gravada(s) de ${resp.totalLinhas.toLocaleString("pt-BR")} linha(s) na planilha${totalErros>0?`, ${totalErros.toLocaleString("pt-BR")} linha(s) descartada(s)`:""}.${resp.resumo && typeof resp.resumo.alimentadoresComPolo==="number" ? ` ${resp.resumo.alimentadoresComPolo.toLocaleString("pt-BR")} alimentador(es) já cruzado(s) com Polo/Regional.` : ""}</div></div>
      ${errosHtml}
      <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">${s.endpoint==="/importacao/vera" ? 'Subir a planilha de novo atualiza as árvores que já existiam (mesmo "ID árvore") e acrescenta as novas, sem apagar o resto.' : 'Subir a planilha de novo substitui a base inteira (é um arquivo completo). Para o filtro Polo/Regional do Mapa funcionar, importe a Proteção e o Vão (a ordem não importa).'}</p>
    `;
    toast(`${nomeBase} importada — ${resp.processados.toLocaleString("pt-BR")} ${unidade} gravada(s).`);
    importArquivoAtual = null;
    importLinhasParseadas = null;
    const input = document.getElementById("importFileInput");
    if(input) input.value = "";
    const nameEl = document.getElementById("importFileName");
    if(nameEl) nameEl.textContent = "";
    if(resp.log){
      state.importLog.unshift({ id: resp.log.id, base: resp.log.base, usuario: nomeAtual(), dataHora: resp.log.dataHora, processados: resp.log.registrosProcessados, erros: resp.log.registrosComErro, arquivo: resp.log.arquivoOrigem });
      const tbody = document.getElementById("importLogRows");
      if(tbody) tbody.innerHTML = importLogRowsHtml();
    }
  }catch(err){
    resultEl.innerHTML = `<div class="note" style="margin-top:12px; background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao importar: ${escapeHtml(err.message)}</div></div>`;
  }finally{
    importEmAndamento = false;
    if(btn) btn.disabled = false;
  }
}

/* =========================================================================
   VIEW: Gestão de Bases (listar + editar)

   Importação de Bases (tela anterior) só sobe um Excel — depois de
   importado, não tinha nenhum jeito de ver ou corrigir UM registro
   específico sem subir a planilha inteira de novo. Esta tela cobre isso
   pra Equipes, Vão, Proteção e VERA (árvores): uma grid paginada (50 por
   página, como pedido) com um botão Editar na frente de cada linha.

   Equipes é pequena (dezenas de registros) e já tinha rota própria
   (/api/equipes, sem paginação) — carrega tudo de uma vez e pagina aqui no
   JS mesmo. Vão/Proteção/VERA usam a rota nova /api/cadastros/<base>, que
   pagina e busca no SERVIDOR (ver routes/cadastros.ps1): a VERA real passa
   de 140 mil linhas (mesma planilha que estourou a importação na v2.4.4),
   então mandar a base inteira pro navegador travaria essa tela do mesmo
   jeito — mesmo corrigido o "+=" O(n²), não faz sentido reler/filtrar 140
   mil registros no JS a cada página virada.
   ========================================================================= */
const CADASTROS_BASES = {
  equipes: {
    label: "Equipes", apiBase: null, keyField: "id",
    colunas: [["id","Código"],["tipoEquipe","Tipo"],["polo","Polo"],["regional","Regional"],["equipePoda","Poda?"],["ativo","Ativa?"]],
    campos: [
      { nome:"nome", rotulo:"Nome", tipo:"texto" },
      { nome:"tipoEquipe", rotulo:"Tipo de equipe", tipo:"texto" },
      { nome:"polo", rotulo:"Polo", tipo:"texto" },
      { nome:"regional", rotulo:"Regional", tipo:"texto" },
      { nome:"departamento", rotulo:"Departamento", tipo:"texto" },
      { nome:"proprioTerceiro", rotulo:"Própria/Terceira", tipo:"texto" },
      { nome:"equipePoda", rotulo:"Equipe de poda?", tipo:"booleano" },
      { nome:"baseLat", rotulo:"Base — Latitude", tipo:"numero" },
      { nome:"baseLng", rotulo:"Base — Longitude", tipo:"numero" },
      { nome:"ativo", rotulo:"Ativa?", tipo:"booleano" },
    ],
  },
  vao: {
    label: "Vão", apiBase: "vao", keyField: "protecaoId",
    colunas: [["protecaoId","Proteção"],["polo","Polo"],["regional","Regional"],["postes","Postes"],["rotaKm","Rota (km)"]],
    campos: [
      { nome:"polo", rotulo:"Polo", tipo:"texto" },
      { nome:"regional", rotulo:"Regional", tipo:"texto" },
      { nome:"postes", rotulo:"Postes", tipo:"numero" },
      { nome:"rotaKm", rotulo:"Rota (km)", tipo:"numero" },
    ],
  },
  protecao: {
    label: "Proteção", apiBase: "protecao", keyField: "protecaoId",
    colunas: [["protecaoId","Elemento"],["protecao2","Proteção (Vão)"],["alimentador","Alimentador"],["zona","Zona"],["trecho","Trecho"],["lat","Latitude"],["lng","Longitude"]],
    campos: [
      { nome:"protElemento", rotulo:"Prot. elemento", tipo:"texto" },
      { nome:"protecao2", rotulo:"Prot. elemento 2 (liga ao Vão)", tipo:"texto" },
      { nome:"alimentador", rotulo:"Alimentador", tipo:"texto" },
      { nome:"zona", rotulo:"Zona", tipo:"texto" },
      { nome:"trecho", rotulo:"Trecho", tipo:"texto" },
      { nome:"trechoT4", rotulo:"Trecho com T4", tipo:"texto" },
      { nome:"planoEasyWork", rotulo:"Plano Easy Work", tipo:"texto" },
      { nome:"lat", rotulo:"Latitude", tipo:"numero" },
      { nome:"lng", rotulo:"Longitude", tipo:"numero" },
    ],
  },
  vera: {
    label: "VERA (árvores)", apiBase: "vera", keyField: "idVera",
    colunas: [["idVera","ID VERA"],["alimentador","Alimentador"],["especie","Espécie"],["cidade","Cidade"],["lat","Latitude"],["lng","Longitude"]],
    campos: [
      { nome:"alimentador", rotulo:"Alimentador", tipo:"texto" },
      { nome:"especie", rotulo:"Espécie", tipo:"texto" },
      { nome:"cidade", rotulo:"Cidade", tipo:"texto" },
      { nome:"lat", rotulo:"Latitude", tipo:"numero" },
      { nome:"lng", rotulo:"Longitude", tipo:"numero" },
    ],
  },
  // v2.15.20 - aba Esquemas: esquemas do SGM que nao podem ser ignorados. TIPO decide o previsto 1 (poda / m2 de faixa / estrutura) das OS pendentes sem MO.
  esquemas: {
    label: "Esquemas", apiBase: "esquemas", keyField: "codigo",
    colunas: [["codigo","Código"],["descricao","Descrição do esquema"],["tipo","Tipo"]],
    campos: [
      { nome:"descricao", rotulo:"Descrição do esquema (igual ao DescEsquema do SGM)", tipo:"texto" },
      { nome:"tipo", rotulo:"Tipo", tipo:"texto", opcoes:["Poda","Limpeza","Estrutura"], vazio:"(sem tipo — esquema ignorado)" },
    ],
  },
  // v2.15.21 - municipio do poste (MUN do PONNOT) -> nome; preenche a localidade das OS pendentes.
  municipios: {
    label: "Municípios", apiBase: "municipios", keyField: "codigo",
    colunas: [["codigo","Código IBGE"],["nome","Município"]],
    campos: [
      { nome:"nome", rotulo:"Município (nome que vira a localidade da OS)", tipo:"texto" },
    ],
  },
  // v3.2.1 - aba Conjuntos: de-para Alimentador -> Conjunto (a OS busca o conjunto pelo alimentador).
  conjuntos: {
    label: "Conjuntos", apiBase: "conjuntos", keyField: "alimentador",
    colunas: [["alimentador","Alimentador"],["nomeConjunto","Nome do conjunto"],["codConjunto","Cód. conjunto"],["regional","Regional"],["sigla","Sigla"],["tensaoNominal","Tensão (kV)"],["tensao","Tensão"]],
    campos: [
      { nome:"nomeConjunto", rotulo:"Nome do conjunto (é o que aparece na OS)", tipo:"texto" },
      { nome:"codConjunto", rotulo:"Código do conjunto", tipo:"texto" },
      { nome:"regional", rotulo:"Regional", tipo:"texto" },
      { nome:"sigla", rotulo:"Sigla", tipo:"texto" },
      { nome:"tensaoNominal", rotulo:"Tensão (kV)", tipo:"texto" },
      { nome:"tensao", rotulo:"Tensão (faixa)", tipo:"texto" },
    ],
  },
  // v2.13.22 - aba EW: de-para Prioridade x Grupo Recurso -> Prioridade EW (Sim/Não).
  ew: {
    label: "EW", apiBase: "prioridade_ew", keyField: "chave",
    colunas: [["prioridade","Prioridade"],["grupoRecurso","Grupo Recurso"],["prioridadeEW","Prioridade EW"],["tensao","Tensão"],["regional","Regional"]],
    campos: [
      { nome:"tensao", rotulo:"Tensão", tipo:"texto" },
      { nome:"prioridade", rotulo:"Prioridade", tipo:"texto" },
      { nome:"grupoRecurso", rotulo:"Grupo Recurso", tipo:"texto" },
      { nome:"prioridadeEW", rotulo:"Prioridade EW (Sim/Não)", tipo:"texto" },
      { nome:"regional", rotulo:"Regional", tipo:"texto" },
    ],
  },
  // v2.13.0 - Metas passou do menu pra cá; Plano, Equipe necessária e tipos
  // de justificativa são listas pequenas cadastráveis (CRUD simples).
  metas: { label: "Metas", especial: "metas" },
  plano: { label: "Planos", especial: "lista", lista: "plano", rotuloItem: "plano" },
  equipeNecessaria: { label: "Equipe necessária", especial: "lista", lista: "equipeNecessaria", rotuloItem: "tipo de equipe" },
  justificativas: { label: "Justificativas", especial: "justificativas" },
  justificativaTipo: { label: "Tipos de justificativa", especial: "lista", lista: "justificativaTipo", rotuloItem: "tipo de justificativa" },
  // v3.1.1 - perguntas e respostas do chat de Ajuda (canto da tela)
  ajuda: { label: "Ajuda", especial: "ajuda" },
  indisponibilidade: { label: "Indisponibilidade de equipes", especial: "indisp" },
  // v3.5.0 - correção manual e soberana de OS levantada errada
  ajusteOs: { label: "Ajuste de OS", especial: "ajuste" },
  auditoria: { label: "Auditoria de podas", especial: "auditoria" },
  // v3.6.0 - listas de prioridade da engenharia (aba só aparece com a permissão "prioridade")
  rankListas: { label: "Rank de prioridade", especial: "rankgestao" },
  // Não é um cadastro com grid paginado como os outros — é a mesma tela de
  // "apagar alimentador carregado errado" que antes vivia só na
  // Importação de Bases (pedido do Mario: "não faz sentido só os
  // alimentadores estarem ali na importação"). `especial` marca esse caso
  // pra cadastroGridHtml/carregarCadastroPagina pularem o fluxo de
  // grid+edição e renderizarem via renderGerenciarCamadas() no lugar.
  // v2.13.24 - uma aba por camada (antes era uma aba só, "Camadas de rede").
  camadaMT: { label: "Rede MT", especial: "camadas", camada: "rede_media_tensao" },
  camadaBT: { label: "Rede BT", especial: "camadas", camada: "rede_baixa_tensao" },
  camadaAT: { label: "Rede AT", especial: "camadas", camada: "rede_alta_tensao" },
  camadaRL: { label: "Reserva Legal", especial: "camadas", camada: "reserva_legal" },
  camadaAPP: { label: "APP", especial: "camadas", camada: "app" },
  // v2.14.3 - Ativos = base de postes/pontos notáveis (PONNOT), 760 mil+ linhas: consulta paginada no servidor
  ativos: { label: "Ativos", especial: "ativos" },
  // v2.15.0 - Equipamentos ligados ao poste (trafos, proteções, reguladores, capacitores): consulta paginada no servidor
  equipamentos: { label: "Equipamentos", especial: "equip" },
  // "Apagar tudo" (pedido do Mario: "cria um botão ai pra só o adm poder
  // apagar tudo de uma vez... preciso começar os testes") — zera de uma vez
  // só todas as bases importadas/geradas pelo uso (Equipes, Vão, Proteção,
  // VERA, Prefeituras, Metas, Podas/OS, Programação, Justificativas,
  // Logística, log de importações) e as camadas de rede/Reserva Legal/APP,
  // pra recomeçar os testes do zero sem editar arquivo na mão. "soAdmin"
  // marca essa aba pra só aparecer pra quem é Administrador de verdade —
  // ver filtrarCadastrosBasesVisiveis() e souAdministrador().
  // v3.16.1 - so no sistema novo (Laravel): carrega a pasta model/ do sistema antigo inteira
  legado: {
    label: "Importar sistema antigo", especial: "legado", soAdmin: true, soLaravel: true,
  },
  resetar: {
    label: "Apagar tudo", especial: "resetar", soAdmin: true,
  },
};
function souAdministrador(){
  // Sem login real (protótipo offline, Controller fora do ar) mantemos o
  // mesmo comportamento de minhaPermissao() — tudo liberado, pra não
  // travar a demo. Com login de verdade, só quem é Administrador de fato.
  if(!currentUser) return true;
  return currentUser.perfilBase === "Administrador";
}
function cadastrosBasesVisiveis(){
  // Mesma lógica usada pra esconder itens do menu/abas sem permissão (ver
  // minhaPermissao/ROUTES) — aqui a única aba restrita por hoje é a de
  // "Apagar tudo", que não tem módulo próprio na matriz (é uma ação de
  // administrador, não de um módulo de negócio).
  return Object.entries(CADASTROS_BASES).filter(([,c]) =>
    (!c.soAdmin || souAdministrador()) &&
    (!c.soLaravel || (typeof API_BACKEND !== "undefined" && API_BACKEND === "laravel")) &&
    (c.especial !== "metas" || minhaPermissao("metas","visualizar")) &&
    (c.especial !== "rankgestao" || minhaPermissao("prioridade","visualizar")));
}
const CADASTRO_TAMANHO_PAGINA = 50;
let cadastroBaseAtiva = "equipes";
let cadastroPagina = 1;
let cadastroBusca = "";
let cadastroTotal = 0;
let cadastroRegistros = [];
let cadastroCarregando = false;
let cadastroOrdem = null;   // { campo, dir } - v2.13.33
let cadastroVerExcluidos = false;   // admin: lista os registros com a flag "excluído" (pra restaurar)

function viewCadastros(){
  // Se a aba ativa ficou escondida (ex.: perfil não é mais Administrador),
  // volta pra uma aba visível em vez de renderizar algo que a pessoa não
  // deveria nem saber que existe.
  const visiveis = cadastrosBasesVisiveis();
  if(!visiveis.some(([k])=>k===cadastroBaseAtiva)){
    cadastroBaseAtiva = visiveis[0][0];
  }
  const cfgAtivo = CADASTROS_BASES[cadastroBaseAtiva];
  const ehCamadas = cfgAtivo.especial === "camadas";
  const ehResetar = cfgAtivo.especial === "resetar";
  const semBusca = !!cfgAtivo.especial;   // camadas/resetar/metas/listas têm controles próprios
  return `
  <div class="card-head" style="margin-bottom:12px; flex-wrap:wrap; gap:10px;">
    <div class="tabs" style="flex-wrap:wrap;">
      ${visiveis.map(([k,c])=>`<button class="tab ${cadastroBaseAtiva===k?'active':''}" onclick="trocarCadastroBase('${k}')">${c.label}</button>`).join("")}
    </div>
    ${semBusca ? "" : `
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      ${souAdministrador() ? `<label class="check-row" style="margin:0;"><input type="checkbox" ${cadastroVerExcluidos?"checked":""} onchange="alternarVerExcluidos(this.checked)"> ver excluídos</label>` : ""}
      <input id="cadastroBuscaInput" placeholder="Buscar…" value="${escapeHtml(cadastroBusca)}" style="min-width:220px;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); aplicarCadastroBusca(); }">
      <button class="btn btn-ghost btn-sm" onclick="aplicarCadastroBusca()">${ic("filter")} Buscar</button>
    </div>`}
  </div>
  <div class="card">
    ${ehCamadas ? `<p style="color:var(--muted); font-size:12.5px; margin-bottom:14px;">Importou um alimentador errado, duplicado ou pela metade? Apague só ele aqui, sem precisar reimportar a camada inteira — separado por Rede MT, AT e BT pra não confundir.</p>` : ""}
    <div id="cadastroGridWrap">${cadastroGridHtml()}</div>
  </div>
  `;
}

function cadastroGridHtml(){
  return cadastroAcoesHtml() + cadastroGridHtmlCore();
}
function cadastroGridHtmlCore(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  if(cfg.especial === "camadas"){
    return `<div class="note">${ic("info")}<div>Carregando…</div></div>`;
  }
  if(cfg.especial === "resetar"){
    return resetarTudoHtml();
  }
  if(cfg.especial === "legado") return legadoHtml();
  if(cfg.especial === "rankgestao") return rankGestaoHtml();
  if(cfg.especial === "metas") return metasGestaoHtml();
  if(cfg.especial === "justificativas") return justificativasPaginaHtml();
  if(cfg.especial === "indisp") return indispPaginaHtml();
  if(cfg.especial === "ajuste") return ajusteOsCardHtml();
  if(cfg.especial === "auditoria") return auditoriaPaginaHtml();
  if(cfg.especial === "ativos") return ativosGestaoHtml();
  if(cfg.especial === "equip") return equipGestaoHtml();
  if(cfg.especial === "lista") return listaGestaoHtml(cfg);
  if(cfg.especial === "ajuda") return ajudaGestaoHtml();
  if(cadastroCarregando){
    return barraIndeterminadaHtml(`Carregando ${cfg.label.toLowerCase()}…`);
  }
  if(!cadastroRegistros.length){
    return `<div class="empty">${ic("empty")}<div>${cadastroBusca ? "Nenhum registro encontrado pra essa busca." : (cadastroVerExcluidos ? "Nenhum registro excluído." : "Nenhum registro cadastrado ainda — importe pela tela Importação de Bases.")}</div></div>`;
  }
  const totalPaginas = Math.max(1, Math.ceil(cadastroTotal / CADASTRO_TAMANHO_PAGINA));
  return `
    <div class="table-wrap"><table data-sort-manual>
      <thead><tr>${cfg.colunas.map(([campo,rotulo])=>ordenarHeadHtml(true,rotulo,campo,cadastroOrdem,"ordenarCadastro")).join("")}<th></th></tr></thead>
      <tbody>
        ${cadastroRegistros.map(r=>`<tr>${cfg.colunas.map(([campo])=>`<td class="${typeof r[campo]==='number'?'num':''}">${formatarValorCadastro(r[campo])}</td>`).join("")}<td style="white-space:nowrap;">${!podeEditarLinhaBase() ? "" : cadastroVerExcluidos
          ? `<button class="btn btn-ghost btn-sm" onclick="restaurarCadastro('${escapeHtml(cadastroBaseAtiva)}','${escapeHtml(String(r[cfg.keyField]))}')">Restaurar</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="abrirEdicaoCadastro('${escapeHtml(String(r[cfg.keyField]))}')">Editar</button> <button class="btn btn-danger btn-sm" onclick="confirmarExcluirCadastro('${escapeHtml(cadastroBaseAtiva)}','${escapeHtml(String(r[cfg.keyField]))}')">Excluir</button>`}</td></tr>`).join("")}
      </tbody>
    </table></div>
    <div class="pager" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px;">
      <span style="color:var(--muted); font-size:12px;">${cadastroTotal} registro(s)${cadastroBusca?` — filtrado por "${escapeHtml(cadastroBusca)}"`:""} · página ${cadastroPagina} de ${totalPaginas}</span>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaCadastro(-1)" ${cadastroPagina<=1?"disabled":""}>‹</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaCadastro(1)" ${cadastroPagina>=totalPaginas?"disabled":""}>›</button>
      </div>
    </div>
  `;
}
function formatarValorCadastro(v){
  if(v===true) return "Sim";
  if(v===false) return "Não";
  if(v===null || v===undefined || v==="") return "—";
  return escapeHtml(String(v));
}
function trocarCadastroBase(base){
  if(base===cadastroBaseAtiva) return;
  cadastroBaseAtiva = base;
  cadastroOrdem = null;
  cadastroVerExcluidos = false;
  cadastroPagina = 1;
  cadastroBusca = "";
  render();
}
function aplicarCadastroBusca(){
  const input = document.getElementById("cadastroBuscaInput");
  cadastroBusca = input ? input.value.trim() : "";
  cadastroPagina = 1;
  carregarCadastroPagina();
}
function irParaPaginaCadastro(delta){
  cadastroPagina += delta;
  carregarCadastroPagina();
}
async function initCadastros(){
  cadastroPagina = 1;
  await carregarCadastroPagina();
}
function ordenarCadastro(campo){
  if(cadastroOrdem && cadastroOrdem.campo===campo){ cadastroOrdem = cadastroOrdem.dir===1 ? { campo, dir:-1 } : null; }
  else cadastroOrdem = { campo, dir:1 };
  cadastroPagina = 1;
  carregarCadastroPagina();
}
async function carregarCadastroPagina(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  if(cfg.especial === "camadas"){
    await abrirGerenciarCamadas();
    return;
  }
  if(cfg.especial === "resetar"){
    return; // nada pra carregar — resetarTudoHtml() já renderiza tudo
  }
  if(cfg.especial === "legado") return; // legadoHtml() já renderiza tudo
  if(cfg.especial === "ativos"){ await ativosGestaoCarregar(); return; }
  if(cfg.especial === "equip"){ await equipGestaoCarregar(); return; }
  if(cfg.especial === "ajuda"){
    await ajudaCarregar(true);
    const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
    return;
  }
  if(cfg.especial === "metas" || cfg.especial === "lista" || cfg.especial === "justificativas" || cfg.especial === "indisp" || cfg.especial === "auditoria" || cfg.especial === "ajuste" || cfg.especial === "rankgestao"){
    if(cfg.especial === "rankgestao"){ try{ await rankCarregarListas(true); }catch(e){ state.rankListas = state.rankListas || []; } }
    if(cfg.especial === "lista" && API_ONLINE){
      try{ const l = await apiGet("/listas"); if(l) state.listas = l; }catch(e){ /* mantém o que já está carregado */ }
    }
    const w = document.getElementById("cadastroGridWrap");
    if(w) w.innerHTML = cadastroGridHtml();
    return;
  }
  cadastroCarregando = true;
  const wrap = document.getElementById("cadastroGridWrap");
  if(wrap) wrap.innerHTML = cadastroGridHtml();
  try{
    if(cadastroBaseAtiva==="equipes" && !cadastroVerExcluidos){
      // Equipes é pequena (dezenas de registros) e já vem carregada em
      // state.equipes mesmo sem Controller (dados de exemplo do protótipo)
      // — funciona offline, sem rota paginada, busca/pagina no próprio JS.
      let todos = state.equipes || [];
      if(cadastroBusca){
        const termo = cadastroBusca.toLowerCase();
        todos = todos.filter(e => String(e.id||"").toLowerCase().includes(termo) || String(e.polo||"").toLowerCase().includes(termo) || String(e.regional||"").toLowerCase().includes(termo));
      }
      if(cadastroOrdem) todos = ordenarPorTexto(todos, e=>e[cadastroOrdem.campo], cadastroOrdem.dir);
      cadastroTotal = todos.length;
      const inicio = (cadastroPagina-1)*CADASTRO_TAMANHO_PAGINA;
      cadastroRegistros = todos.slice(inicio, inicio+CADASTRO_TAMANHO_PAGINA);
    } else if(!API_ONLINE){
      // Vão/Proteção/VERA não têm dados de exemplo no protótipo offline
      // (são as bases novas, sem seed local) — precisam do Controller de
      // verdade pra listar.
      cadastroRegistros = []; cadastroTotal = 0;
      if(wrap) wrap.innerHTML = `<div class="note">${ic("info")}<div>Controller offline — abra o sistema pelo iniciar.bat pra ver/editar ${cfg.label.toLowerCase()} de verdade.</div></div>`;
      return;
    } else {
      // Vão/Proteção/VERA: paginação e busca no servidor (ver
      // routes/cadastros.ps1) — timeout mais folgado que o padrão (30s)
      // porque ler model/vera.json inteiro (140 mil+ linhas) pra devolver
      // só 50 ainda leva um tempo real, mesmo paginado.
      const qs = new URLSearchParams({ pagina:String(cadastroPagina), tamanhoPagina:String(CADASTRO_TAMANHO_PAGINA), busca:cadastroBusca });
      if(cadastroVerExcluidos) qs.set("excluidos","1");
      if(cadastroOrdem){ qs.set("ordenar", cadastroOrdem.campo); qs.set("dir", cadastroOrdem.dir>0 ? "asc" : "desc"); }
      const resp = await apiGet(`/cadastros/${cfg.apiBase || cadastroBaseAtiva}?${qs.toString()}`, 60000);
      cadastroRegistros = resp.registros || [];
      cadastroTotal = resp.total || 0;
    }
  }catch(err){
    cadastroRegistros = []; cadastroTotal = 0;
    if(wrap) wrap.innerHTML = `<div class="note" style="background:var(--bad-bg); color:var(--bad-fg);">${ic("info")}<div>Erro ao carregar: ${escapeHtml(err.message)}</div></div>`;
    cadastroCarregando = false;
    return;
  }
  cadastroCarregando = false;
  if(wrap) wrap.innerHTML = cadastroGridHtml();
}
/* ---- v2.13.0: "Excluir" = flag (exclusão lógica) ---- */
function alternarVerExcluidos(v){
  cadastroVerExcluidos = !!v;
  cadastroPagina = 1;
  carregarCadastroPagina();
}

/* v2.13.30 - "Novo registro" e "Apagar tudo" em todas as telas da Gestão de
   Bases. Só aparecem pra quem pode SUBIR (importar) e EDITAR a base — o
   backend confere de novo (Test-PodeEscreverBase), então esconder o botão
   é só conforto. Metas usa o módulo "metas"; o resto, "manutencao". */
/* v3.8.3 - Editar / Excluir / Restaurar nas linhas da Gestão de Bases: só com editar + importar (igual ao Controller) */
function podeEditarLinhaBase(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva] || {};
  const mod = (cfg.especial==="metas") ? "metas" : "manutencao";
  return minhaPermissao(mod,"importar") && minhaPermissao(mod,"editar");
}
function podeEscreverBase(chaveBase){
  const cfg = CADASTROS_BASES[chaveBase || cadastroBaseAtiva];
  if(!cfg || cfg.especial==="resetar" || cfg.especial==="legado" || cfg.especial==="justificativas" || cfg.especial==="indisp" || cfg.especial==="auditoria" || cfg.especial==="ajuste" || cfg.especial==="rankgestao") return false;
  if(!API_ONLINE) return false;
  const mod = (cfg.especial==="metas") ? "metas" : "manutencao";
  return minhaPermissao(mod,"importar") && minhaPermissao(mod,"editar");
}
function cadastroAcoesHtml(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  if(!podeEscreverBase() || cfg.especial === "ajuda") return "";
  const grid = !cfg.especial;
  const novo = grid && !cadastroVerExcluidos
    ? `<button class="btn btn-primary btn-sm" onclick="abrirNovoRegistroCadastro()">${ic("plus")} Novo registro</button>` : "";
  return `<div style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
    ${novo}
    <button class="btn btn-danger btn-sm" onclick="pedirApagarTudoBase()">${ic("close")} Apagar tudo</button>
  </div>`;
}
function abrirNovoRegistroCadastro(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  if(!podeEscreverBase()) return;
  const campoChave = (cfg.campos.some(c=>c.nome===cfg.keyField)) ? [] : [{ nome:cfg.keyField, rotulo: (cfg.colunas.find(c=>c[0]===cfg.keyField)||[,cfg.keyField])[1] + " (chave)", tipo:"texto" }];
  const padrao = { ativo:true };
  openModal(`
    <h2>Novo registro — ${escapeHtml(cfg.label)}</h2>
    <p class="modal-sub">Grava 1 linha direto na base, sem reimportar. ${cadastroBaseAtiva==="ew" ? "Se deixar a chave em branco, ela é montada com Tensão-Prioridade-Grupo-Regional." : "A chave não pode se repetir."}</p>
    <div id="cadastroEdicaoCampos">
      ${[...campoChave, ...cfg.campos].map(c=>campoEdicaoCadastroHtml(c, padrao[c.nome])).join("")}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="cadastroSalvarBtn" onclick="salvarNovoRegistroCadastro()">${ic("check")} Salvar</button>
    </div>
  `);
}
async function salvarNovoRegistroCadastro(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  const payload = {};
  const campos = cfg.campos.some(c=>c.nome===cfg.keyField) ? cfg.campos : [{ nome:cfg.keyField, tipo:"texto" }, ...cfg.campos];
  campos.forEach(c=>{
    const el = document.getElementById(`cadCampo_${c.nome}`);
    if(!el) return;
    if(c.tipo==="booleano") payload[c.nome] = el.checked;
    else if(c.tipo==="numero") payload[c.nome] = el.value==="" ? null : Number(el.value);
    else payload[c.nome] = el.value.trim();
  });
  if(!payload[cfg.keyField] && cadastroBaseAtiva!=="ew"){ toast("Preencha o campo-chave."); return; }
  const btn = document.getElementById("cadastroSalvarBtn");
  if(btn) btn.disabled = true;
  try{
    await apiPost(`/cadastros/${cfg.apiBase || cadastroBaseAtiva}`, payload);
    if(cadastroBaseAtiva==="equipes"){ try{ await loadStateFromApi(); }catch(e){} }
    if(cadastroBaseAtiva==="conjuntos") await recarregarConjuntos();
    closeModal();
    toast("Registro incluído.");
    await carregarCadastroPagina();
  }catch(err){
    toast(err.message.includes("409") ? "Já existe um registro com essa chave." : `Erro ao salvar: ${err.message}`);
  }finally{
    if(btn) btn.disabled = false;
  }
}
/* v2.14.3 - Gestão de Bases > Ativos (PONNOT). 760 mil linhas: a tabela é só
   consulta (busca/tipo/página no servidor); a carga vem de Importação de Bases
   > "Postes (PONNOT)". Aqui dá para ver o resumo, reaplicar a posição nas OS e
   apagar a base inteira. */
const ativosGest = { busca:"", tipo:"", pagina:1, total:0, linhas:[], resumo:null, carregando:false, erro:"", aplicando:false };
async function ativosGestaoCarregar(){
  if(!API_ONLINE){ ativosGest.erro = "Controller offline — abra pelo iniciar.bat."; ativosGestaoRender(); return; }
  ativosGest.carregando = true; ativosGest.erro = ""; ativosGestaoRender();
  try{
    const [res, lista] = await Promise.all([
      apiGet("/postes/resumo"),
      apiGet(`/postes/lista?pagina=${ativosGest.pagina}&busca=${encodeURIComponent(ativosGest.busca)}&tipo=${encodeURIComponent(ativosGest.tipo)}`, 60000),
    ]);
    ativosGest.resumo = res; ativosGest.total = lista.total||0; ativosGest.linhas = lista.linhas||[];
  }catch(err){ ativosGest.erro = err.message; }
  ativosGest.carregando = false; ativosGestaoRender();
}
function ativosGestaoRender(){
  const w = document.getElementById("cadastroGridWrap");
  if(w && CADASTROS_BASES[cadastroBaseAtiva].especial==="ativos") w.innerHTML = cadastroGridHtml();
}
function ativosGestaoBuscar(){
  const i = document.getElementById("ativosGestBusca"), t = document.getElementById("ativosGestTipo");
  ativosGest.busca = i ? i.value.trim() : ""; ativosGest.tipo = t ? t.value : ""; ativosGest.pagina = 1;
  ativosGestaoCarregar();
}
function ativosGestaoPagina(d){ ativosGest.pagina = Math.max(1, ativosGest.pagina + d); ativosGestaoCarregar(); }
async function ativosGestaoReaplicar(){
  if(ativosGest.aplicando) return;
  ativosGest.aplicando = true; ativosGestaoRender();
  try{
    const r = await apiPost("/postes/aplicar", {});
    toast("Posição reaplicada nas OS" + (r && typeof r.osAtualizadas === "number" ? ` (${r.osAtualizadas.toLocaleString("pt-BR")} OS atualizada(s)).` : "."));
    try{ await loadStateFromApi(); }catch(e){}
  }catch(err){ toast("Não consegui reaplicar: " + err.message); }
  ativosGest.aplicando = false; ativosGestaoRender();
}
function ativosGestaoHtml(){
  const g = ativosGest, r = g.resumo || {};
  const porTipo = r.porTipo || {};
  const tipos = Object.keys(porTipo).sort();
  const fmt = n => Number(n||0).toLocaleString("pt-BR");
  const quando = r.atualizadoEm ? new Date(r.atualizadoEm).toLocaleString("pt-BR") : "";
  const podeAplicar = API_ONLINE && minhaPermissao("manutencao","importar") && minhaPermissao("manutencao","editar");
  const totalPag = Math.max(1, Math.ceil(g.total / 50));
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Base de <strong>postes e pontos notáveis (PONNOT)</strong> — é ela que alimenta a camada <strong>Ativos</strong> do Mapa de Manutenção e a posição "Poste" das OS. A carga é feita em <strong>Importação de Bases &gt; Postes (PONNOT)</strong>.</p>
    ${g.erro ? `<div class="note">${ic("info")}<div>${escapeHtml(g.erro)}</div></div>` : ""}
    <div class="card" style="padding:12px 14px; margin-bottom:12px;">
      ${r.total ? `<div style="display:flex; flex-wrap:wrap; gap:14px; align-items:center;">
        <div><div style="font-size:11.5px; color:var(--muted);">Total de ativos</div><strong style="font-size:18px;">${fmt(r.total)}</strong></div>
        ${tipos.map(t=>`<div><div style="font-size:11.5px; color:var(--muted);" title="${escapeHtml(ATIVOS_NOME[t]||t)}">${escapeHtml(t)}</div><strong>${fmt(porTipo[t])}</strong></div>`).join("")}
        <div style="margin-left:auto; font-size:12px; color:var(--muted);">${quando ? `Atualizado em ${escapeHtml(quando)}` : ""}${r.arquivo ? `<br>${escapeHtml(r.arquivo)}` : ""}</div>
      </div>` : `<div style="color:var(--muted);">${g.carregando ? "Carregando…" : "Base de ativos (PONNOT) ainda não importada."}</div>`}
      ${podeAplicar && r.total ? `<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" ${g.aplicando?"disabled":""} onclick="ativosGestaoReaplicar()">${g.aplicando ? "Reaplicando…" : "Reaplicar posição nas OS (VERA &gt; XY &gt; Poste &gt; Cidade)"}</button></div>` : ""}
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
      <input id="ativosGestBusca" placeholder="COD_ID, conjunto ou área local…" value="${escapeHtml(g.busca)}" style="min-width:240px;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); ativosGestaoBuscar(); }">
      <select id="ativosGestTipo" onchange="ativosGestaoBuscar()"><option value="">Todos os tipos</option>${tipos.map(t=>`<option value="${escapeHtml(t)}" ${g.tipo===t?"selected":""}>${escapeHtml(t)} — ${escapeHtml(ATIVOS_NOME[t]||t)}</option>`).join("")}</select>
      <button class="btn btn-ghost btn-sm" onclick="ativosGestaoBuscar()">${ic("filter")} Buscar</button>
    </div>
    ${g.carregando ? barraIndeterminadaHtml("Consultando ativos…") : (!g.linhas.length ? `<div class="empty">${ic("empty")}<div>${(g.busca||g.tipo) ? "Nenhum ativo encontrado para esse filtro." : "Nenhum ativo cadastrado."}</div></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>COD_ID</th><th>Tipo (TIP_PN)</th><th>Área local (ARE_LOC)</th><th>Conjunto (CONJ)</th><th>Latitude</th><th>Longitude</th></tr></thead>
      <tbody>${g.linhas.map(l=>`<tr><td>${escapeHtml(l.codId)}</td><td>${escapeHtml(l.tipo)}</td><td>${escapeHtml(l.areaLocal||"—")}</td><td>${escapeHtml(l.conjunto||"—")}</td><td class="num">${l.lat}</td><td class="num">${l.lng}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="pager" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px;">
      <span style="color:var(--muted); font-size:12px;">${fmt(g.total)} ativo(s)${(g.busca||g.tipo)?" no filtro":""} · página ${fmt(g.pagina)} de ${fmt(totalPag)}</span>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="ativosGestaoPagina(-1)" ${g.pagina<=1?"disabled":""}>‹</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="ativosGestaoPagina(1)" ${g.pagina>=totalPag?"disabled":""}>›</button>
      </div>
    </div>`)}`;
}

/* v2.15.0 - Gestão de Bases > Equipamentos (trafos, proteções, reguladores, capacitores).
   A carga é em Importação de Bases > Equipamentos; aqui só consulta (paginada no servidor). */
const equipGest = { camada:"trafos", busca:"", tipo:"", pagina:1, total:0, itens:[], resumo:null, carregando:false, erro:"", conf:null, confCarregando:false };
/* v2.15.25 - conferência: posição do cadastro de Proteção (d.Proteção) x posição do equipamento na BDGD, ligados pelo nome operativo. */
async function equipConferir(){
  if(!API_ONLINE){ toast("Controller offline."); return; }
  const inp = document.getElementById("equipConfMetros");
  const m = Math.max(10, Number(inp && inp.value) || 200);
  equipGest.confCarregando = true; equipGest.conf = null; equipGestaoRender();
  try{ equipGest.conf = await apiGet(`/equip/conferencia?metros=${m}&limite=500`, 180000); }
  catch(err){ equipGest.conf = { erro: err.message }; }
  equipGest.confCarregando = false; equipGestaoRender();
}
function equipConferenciaHtml(){
  const g = equipGest, fmt = n => Number(n||0).toLocaleString("pt-BR");
  const c = g.conf;
  const barra = `<div class="card" style="padding:12px 14px; margin-bottom:12px;">
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <strong style="font-size:13px;">Conferir posição do cadastro de Proteção</strong>
      <span style="color:var(--muted); font-size:12px;">mostra as proteções cujo LAT/LONG do cadastro está a mais de</span>
      <input id="equipConfMetros" type="number" min="10" value="${c && c.metros ? c.metros : 200}" style="width:80px;"> <span style="color:var(--muted); font-size:12px;">m do equipamento da BDGD</span>
      <button class="btn btn-ghost btn-sm" onclick="equipConferir()" ${g.confCarregando?"disabled":""}>${ic("filter")} Conferir</button>
    </div>`;
  if(g.confCarregando) return barra + barraIndeterminadaHtml("Comparando posições…") + `</div>`;
  if(!c) return barra + `<div style="color:var(--muted); font-size:12px; margin-top:6px;">Precisa da base de Proteção, das proteções da BDGD e do Excel Isolating (nomes) já importados.</div></div>`;
  if(c.erro) return barra + `<div class="note" style="margin-top:8px;">${ic("info")}<div>${escapeHtml(c.erro)}</div></div></div>`;
  return barra + `<div style="margin-top:8px; font-size:12.5px;">${fmt(c.comparados)} comparada(s): <strong>${fmt(c.ok)}</strong> dentro de ${fmt(c.metros)} m, <strong style="color:var(--bad-fg);">${fmt(c.acima)}</strong> mais longe${c.semCadastro ? ` · ${fmt(c.semCadastro)} com nome mas fora do cadastro` : ""}.${c.acima>(c.itens||[]).length ? ` Mostrando as ${fmt((c.itens||[]).length)} mais distantes.` : ""}</div>
    ${(c.itens||[]).length ? `<div class="table-wrap" style="margin-top:8px; max-height:340px; overflow:auto;"><table>
      <thead><tr><th>Nome</th><th>COD_ID</th><th class="num">Distância (m)</th><th>Alim. (CTMT)</th><th>Posição BDGD</th><th>Posição cadastro</th></tr></thead>
      <tbody>${c.itens.map(x=>`<tr><td><strong>${escapeHtml(x[1])}</strong></td><td>${escapeHtml(x[0])}</td><td class="num">${fmt(x[2])}</td><td>${escapeHtml(x[7]||"—")}</td><td>${Number(x[3]).toFixed(5)}, ${Number(x[4]).toFixed(5)}</td><td>${Number(x[5]).toFixed(5)}, ${Number(x[6]).toFixed(5)}</td></tr>`).join("")}</tbody>
    </table></div>` : ""}</div>`;
}
async function equipGestaoCarregar(){
  if(!API_ONLINE){ equipGest.erro = "Controller offline — abra pelo iniciar.bat."; equipGestaoRender(); return; }
  equipGest.carregando = true; equipGest.erro = ""; equipGestaoRender();
  try{
    const [res, lista] = await Promise.all([
      apiGet("/equip/resumo"),
      apiGet(`/equip/lista?camada=${equipGest.camada}&pagina=${equipGest.pagina}&busca=${encodeURIComponent(equipGest.busca)}&tipo=${encodeURIComponent(equipGest.tipo)}`, 60000),
    ]);
    equipGest.resumo = res || {}; equipGest.total = lista.total||0; equipGest.itens = lista.itens||[];
  }catch(err){ equipGest.erro = err.message; }
  equipGest.carregando = false; equipGestaoRender();
}
function equipGestaoRender(){
  const w = document.getElementById("cadastroGridWrap");
  if(w && CADASTROS_BASES[cadastroBaseAtiva].especial==="equip") w.innerHTML = cadastroGridHtml();
}
function equipGestaoCamada(c){ equipGest.camada = c; equipGest.busca = ""; equipGest.tipo = ""; equipGest.pagina = 1; equipGestaoCarregar(); }
function equipGestaoBuscar(){
  const i = document.getElementById("equipGestBusca"), t = document.getElementById("equipGestTipo");
  equipGest.busca = i ? i.value.trim() : ""; equipGest.tipo = t ? t.value : ""; equipGest.pagina = 1;
  equipGestaoCarregar();
}
function equipGestaoPagina(d){ equipGest.pagina = Math.max(1, equipGest.pagina + d); equipGestaoCarregar(); }
function equipGestaoHtml(){
  const g = equipGest, res = g.resumo || {}, r = res[g.camada] || null;
  const fmt = n => Number(n||0).toLocaleString("pt-BR");
  const quando = r && r.atualizadoEm ? new Date(r.atualizadoEm).toLocaleString("pt-BR") : "";
  const totalPag = Math.max(1, Math.ceil(g.total / 50));
  const porTipo = (r && r.porTipo) || {};
  const tipos = Object.keys(porTipo).sort();
  const cols = EQUIP_COLS[g.camada];
  const tipoRot = (t)=> g.camada==="protecoes" ? `${t} — ${equipNomeTipoProt(t)}` : t;
  const valor = (it,i)=>{
    const v = it[6+i];
    if(g.camada==="protecoes" && i===0) return `${v} · ${equipNomeTipoProt(v)}`;
    if(g.camada==="protecoes" && i===3) return v==="A" ? "Aberta" : (v==="F" ? "Fechada" : v);
    return v;
  };
  return `
    <p style="color:var(--muted); font-size:12.5px; margin-bottom:12px;">Equipamentos da rede <strong>ligados ao poste</strong> (BDGD: UNTRMT, UNSEMT, UNREMT, UNCRMT). Alimentam as camadas <strong>Trafos</strong>, <strong>Proteções</strong>, <strong>Reguladores</strong> e <strong>Capacitores</strong> do Mapa de Manutenção e o trafo/proteção do poste no popup da OS. A carga é feita em <strong>Importação de Bases &gt; Equipamentos</strong> (precisa do PONNOT antes).</p>
    ${g.erro ? `<div class="note">${ic("info")}<div>${escapeHtml(g.erro)}</div></div>` : ""}
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
      ${Object.keys(EQUIP_CFG).map(c=>{ const x = res[c]; return `<button type="button" class="tab ${g.camada===c?"active":""}" onclick="equipGestaoCamada('${c}')">${escapeHtml(EQUIP_CFG[c].plural)} <span style="opacity:.7;">${x ? fmt(x.total) : "—"}</span></button>`; }).join("")}
    </div>
    <div class="card" style="padding:12px 14px; margin-bottom:12px;">
      ${r ? `<div style="display:flex; flex-wrap:wrap; gap:14px; align-items:center;">
        <div><div style="font-size:11.5px; color:var(--muted);">Total</div><strong style="font-size:18px;">${fmt(r.total)}</strong></div>
        <div><div style="font-size:11.5px; color:var(--muted);">Com poste</div><strong>${fmt(r.comPoste)}</strong></div>
        ${r.semPoste ? `<div><div style="font-size:11.5px; color:var(--muted);">Só posição do PAC</div><strong>${fmt(r.semPoste)}</strong></div>` : ""}
        ${r.semPosicao ? `<div title="PAC em formato de nome, sem coordenada: ficam fora do mapa"><div style="font-size:11.5px; color:var(--muted);">Sem coordenada (fora)</div><strong>${fmt(r.semPosicao)}</strong></div>` : ""}
        ${tipos.slice(0,10).map(t=>`<div><div style="font-size:11.5px; color:var(--muted);">${escapeHtml(g.camada==="trafos" ? "Posto "+t : tipoRot(t))}</div><strong>${fmt(porTipo[t])}</strong></div>`).join("")}
        <div style="margin-left:auto; font-size:12px; color:var(--muted);">${quando ? `Atualizado em ${escapeHtml(quando)}` : ""}</div>
      </div>` : `<div style="color:var(--muted);">${g.carregando ? "Carregando…" : `${escapeHtml(EQUIP_CFG[g.camada].plural)} ainda não importados.`}</div>`}
    </div>
    ${g.camada==="protecoes" ? equipConferenciaHtml() : ""}
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
      <input id="equipGestBusca" placeholder="COD_ID, poste, alimentador (CTMT) ou conjunto…" value="${escapeHtml(g.busca)}" style="min-width:280px;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); equipGestaoBuscar(); }">
      <select id="equipGestTipo" onchange="equipGestaoBuscar()"><option value="">Todos os tipos</option>${tipos.map(t=>`<option value="${escapeHtml(t)}" ${g.tipo===t?"selected":""}>${escapeHtml(tipoRot(t))}</option>`).join("")}</select>
      <button class="btn btn-ghost btn-sm" onclick="equipGestaoBuscar()">${ic("filter")} Buscar</button>
    </div>
    ${g.carregando ? barraIndeterminadaHtml("Consultando equipamentos…") : (!g.itens.length ? `<div class="empty">${ic("empty")}<div>${(g.busca||g.tipo) ? "Nada encontrado para esse filtro." : "Nenhum registro."}</div></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>COD_ID</th>${g.itens.some(it=>it[11])?"<th>Nº operativo</th>":""}<th>Poste</th>${cols.map(c=>c?`<th>${escapeHtml(c)}</th>`:"").join("")}<th>Alimentador</th><th>Conj.</th><th>Latitude</th><th>Longitude</th></tr></thead>
      <tbody>${g.itens.map(it=>`<tr><td>${escapeHtml(it[0])}</td>${g.itens.some(x=>x[11])?`<td>${escapeHtml(it[11]||"—")}</td>`:""}<td>${escapeHtml(it[1]||"—")}</td>${cols.map((c,i)=>c?`<td>${escapeHtml(String(valor(it,i)||"—"))}</td>`:"").join("")}<td>${escapeHtml(it[4]||"—")}</td><td>${escapeHtml(it[5]||"—")}</td><td class="num">${it[2]}</td><td class="num">${it[3]}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="pager" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px;">
      <span style="color:var(--muted); font-size:12px;">${fmt(g.total)} registro(s)${(g.busca||g.tipo)?" no filtro":""} · página ${fmt(g.pagina)} de ${fmt(totalPag)}</span>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="equipGestaoPagina(-1)" ${g.pagina<=1?"disabled":""}>‹</button>
        <button class="btn btn-ghost" style="padding:5px 9px;" onclick="equipGestaoPagina(1)" ${g.pagina>=totalPag?"disabled":""}>›</button>
      </div>
    </div>`)}
    <p style="color:var(--muted); font-size:11.5px; margin-top:10px;">Os nomes dos tipos de proteção (22 = chave fusível, 27 = religador…) são os prováveis da BDGD; o código bruto aparece junto. Para o nome oficial, falta a tabela de domínio da BDGD.</p>`;
}

function pedirApagarTudoBase(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  if(!podeEscreverBase()) return;
  openModal(`
    <h2>Apagar tudo — ${escapeHtml(cfg.label)}?</h2>
    <p style="font-size:13px;">Isso <strong>zera a tabela inteira</strong> (${cfg.especial==="equip" ? "só a camada selecionada: "+escapeHtml((EQUIP_CFG[equipGest.camada]||{}).plural||"") : cfg.especial==="camadas" ? "todos os alimentadores desta camada" : cfg.especial==="lista" ? "todos os itens desta lista" : "todos os registros"}). <strong>Não dá pra desfazer</strong>; depois é só importar de novo ou cadastrar um por um.</p>
    <div class="field"><label>Digite APAGAR para liberar o botão</label><input id="apagarTudoBaseTxt" type="text" autocomplete="off" oninput="document.getElementById('apagarTudoBaseBtn').disabled = this.value.trim().toUpperCase()!=='APAGAR'"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="apagarTudoBaseBtn" disabled onclick="apagarTudoBase()">Apagar tudo</button>
    </div>
  `);
}
async function apagarTudoBase(){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  const btn = document.getElementById("apagarTudoBaseBtn");
  if(btn) btn.disabled = true;
  try{
    if(cfg.especial==="camadas") await apiDelete(`/importacao/camadas/${cfg.camada}?confirmar=sim`);
    else if(cfg.especial==="lista") await apiDelete(`/listas?lista=${encodeURIComponent(cfg.lista)}&confirmar=sim`);
    else if(cfg.especial==="ativos") await apiDelete(`/postes?confirmar=sim`);
    else if(cfg.especial==="equip") await apiDelete(`/equip?camada=${encodeURIComponent(equipGest.camada)}&confirmar=sim`);
    else await apiDelete(`/cadastros/${cfg.apiBase || cadastroBaseAtiva}?confirmar=sim`);
    if(cadastroBaseAtiva==="equipes" || cadastroBaseAtiva==="metas"){ try{ await loadStateFromApi(); }catch(e){} }
    closeModal();
    toast("Tabela apagada.");
    await carregarCadastroPagina();
  }catch(err){
    toast(`Erro ao apagar: ${err.message}`);
    if(btn) btn.disabled = false;
  }
}

function confirmarExcluirCadastro(base, chave){
  if(!podeEditarLinhaBase()){ toast("Seu perfil só pode visualizar."); return; }
  openModal(`
    <h2>Excluir registro?</h2>
    <p class="modal-sub mono">${escapeHtml(base)} · ${escapeHtml(chave)}</p>
    <p style="font-size:13px;">O registro some das listas e filtros, mas <strong>nada é apagado do banco</strong> — é só uma marca (flag). Um administrador pode restaurar depois em "ver excluídos".</p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="excluirCadastro('${escapeHtml(base).replace(/'/g,"\\'")}','${escapeHtml(chave).replace(/'/g,"\\'")}')">Excluir</button>
    </div>
  `);
}
async function excluirCadastro(base, chave){
  try{
    if(API_ONLINE) await apiDelete(`/cadastros/${encodeURIComponent(base)}/${encodeURIComponent(chave)}`);
    if(base==="equipes") state.equipes = state.equipes.filter(e=>e.id!==chave);
    if(base==="metas") state.metas = state.metas.filter(m=>m.id!==chave);
    if(base==="conjuntos") await recarregarConjuntos();
    closeModal();
    toast("Registro excluído (flag) — nada foi apagado do banco.");
    await carregarCadastroPagina();
  }catch(err){
    toast(`Erro ao excluir: ${err.message}`);
  }
}
async function restaurarCadastro(base, chave){
  if(!podeEditarLinhaBase()){ toast("Seu perfil só pode visualizar."); return; }
  try{
    await apiPost(`/cadastros/${encodeURIComponent(base)}/${encodeURIComponent(chave)}/restaurar`, {});
    toast("Registro restaurado.");
    if(base==="equipes" || base==="metas"){ try{ await loadStateFromApi(); }catch(e){} }
    if(base==="conjuntos") await recarregarConjuntos();
    await carregarCadastroPagina();
  }catch(err){
    toast(`Erro ao restaurar: ${err.message}`);
  }
}

/* ---- v2.13.0: Metas dentro da Gestão de Bases (paginada, com filtros de equipe) ---- */
let metasGestaoFiltro = { busca:"", polo:"", regional:"", ano:"" };
let metasGestaoPagina = 1;
let metasExcluidosLista = null;   // admin: metas com a flag, carregadas do Controller
const METAS_POR_PAGINA = 50;
const META_MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
/* v3.10.2 - a lista da Gestão de Bases mostra UMA linha por equipe+serviço (com "metas em X meses"); os registros continuam sendo mensais */
function metasGrupos(){
  const f = metasGestaoFiltro, q = f.busca.trim().toLowerCase(), mapa = new Map();
  state.metas.forEach(m=>{
    if(f.ano && String(m.anoMes||"").slice(0,4)!==f.ano) return;
    const k = m.equipeId+"|"+metaTipo(m);
    let g = mapa.get(k);
    if(!g){ g = { equipeId:m.equipeId, tipo:metaTipo(m), e:equipeInfo(m.equipeId)||{}, ms:[] }; mapa.set(k,g); }
    g.ms.push(m);
  });
  const hoje = new Date().toISOString().slice(0,7);
  return [...mapa.values()].filter(g=>(!q || String(g.equipeId).toLowerCase().includes(q)) && (!f.polo || g.e.polo===f.polo) && (!f.regional || g.e.regional===f.regional))
    .map(g=>{
      g.ms.sort((a,b)=>String(a.anoMes).localeCompare(String(b.anoMes)));
      g.atual = g.ms.find(m=>m.anoMes===hoje) || g.ms.filter(m=>m.anoMes<=hoje).pop() || g.ms[g.ms.length-1];
      g.atualizadoEm = g.ms.reduce((a,m)=>String(m.atualizadoEm||"")>a ? String(m.atualizadoEm||"") : a, "");
      return g;
    });
}
function metasGestaoFiltradas(){
  const r = metasGrupos().sort((a,b)=>String(a.equipeId).localeCompare(String(b.equipeId),"pt-BR",{numeric:true}) || a.tipo.localeCompare(b.tipo));
  return (metasOrdem && METAS_ORDEM_CAMPOS[metasOrdem.campo]) ? ordenarPorTexto(r, METAS_ORDEM_CAMPOS[metasOrdem.campo], metasOrdem.dir) : r;
}
/* modo "ver excluídas" (admin): lista simples, um registro por mês, para poder restaurar */
function metasExcluidasFiltradas(){
  const f = metasGestaoFiltro, q = f.busca.trim().toLowerCase();
  return (metasExcluidosLista||[]).map(m=>({ m, e: equipeInfo(m.equipeId) || {} })).filter(({m,e})=>
    (!q || String(m.equipeId).toLowerCase().includes(q)) && (!f.polo || e.polo===f.polo) && (!f.regional || e.regional===f.regional) &&
    (!f.ano || String(m.anoMes||"").slice(0,4)===f.ano))
    .sort((a,b)=>String(a.m.equipeId).localeCompare(String(b.m.equipeId),"pt-BR",{numeric:true}) || String(b.m.anoMes).localeCompare(String(a.m.anoMes)));
}
/* v2.13.33 - ordenação das Metas (todas as páginas) */
let metasOrdem = null;
const METAS_ORDEM_CAMPOS = { equipe:g=>g.equipeId, servico:g=>g.tipo, polo:g=>g.e.polo, regional:g=>g.e.regional, meses:g=>g.ms.length, atual:g=>g.atual ? g.atual.metaMensal : null, atualizado:g=>g.atualizadoEm };
function ordenarMetas(campo){
  if(metasOrdem && metasOrdem.campo===campo){ metasOrdem = metasOrdem.dir===1 ? { campo, dir:-1 } : null; }
  else metasOrdem = { campo, dir:1 };
  metasGestaoPagina = 1;
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
}
function setMetasGestaoFiltro(campo, v){
  metasGestaoFiltro[campo] = v; metasGestaoPagina = 1;
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = metasGestaoHtml();
}
function irParaPaginaMetas(d){
  metasGestaoPagina += d;
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = metasGestaoHtml();
}
async function metasVerExcluidos(v){
  cadastroVerExcluidos = !!v; metasGestaoPagina = 1;
  if(v && API_ONLINE){
    try{ const r = await apiGet("/cadastros/metas?excluidos=1&tamanhoPagina=200", 60000); metasExcluidosLista = r.registros || []; }
    catch(e){ metasExcluidosLista = []; toast("Não consegui listar as metas excluídas."); }
  }
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = metasGestaoHtml();
}
function metasGestaoHtml(){
  const excl = cadastroVerExcluidos && metasExcluidosLista;
  const lista = excl ? metasExcluidasFiltradas() : metasGestaoFiltradas();
  const totalPag = Math.max(1, Math.ceil(lista.length / METAS_POR_PAGINA));
  metasGestaoPagina = Math.min(Math.max(1, metasGestaoPagina), totalPag);
  const pagina = lista.slice((metasGestaoPagina-1)*METAS_POR_PAGINA, metasGestaoPagina*METAS_POR_PAGINA);
  const f = metasGestaoFiltro;
  const polos = progOpcoes("polo"), regionais = progOpcoes("regional");
  const anos = [...new Set(state.metas.map(m=>String(m.anoMes||"").slice(0,4)).filter(Boolean))].sort().reverse();
  const podeEditar = minhaPermissao("metas","editar"), podeCriar = minhaPermissao("metas","criar"), podeImportar = minhaPermissao("metas","importar");
  const opt = (arr, atual)=>arr.map(v=>`<option value="${escapeHtml(v)}" ${atual===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  const cab = `
  <div class="card-head" style="margin-bottom:12px; flex-wrap:wrap; gap:8px;">
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:end;">
      <div class="field"><label>Equipe</label><input type="text" value="${escapeHtml(f.busca)}" placeholder="Código da equipe…" oninput="setMetasGestaoFiltro('busca',this.value)" style="min-width:160px;"></div>
      <div class="field"><label>Regional</label><select onchange="setMetasGestaoFiltro('regional',this.value)"><option value="">Todas</option>${opt(regionais,f.regional)}</select></div>
      <div class="field"><label>Polo</label><select onchange="setMetasGestaoFiltro('polo',this.value)"><option value="">Todos</option>${opt(polos,f.polo)}</select></div>
      <div class="field"><label>Ano</label><select onchange="setMetasGestaoFiltro('ano',this.value)"><option value="">Todos</option>${opt(anos,f.ano)}</select></div>
      ${souAdministrador() ? `<label class="check-row" style="margin:0 0 6px;"><input type="checkbox" ${cadastroVerExcluidos?"checked":""} onchange="metasVerExcluidos(this.checked)"> ver excluídas</label>` : ""}
    </div>
    <div style="display:flex; gap:8px;">
      ${podeImportar ? `<button class="btn btn-ghost" onclick="openImportModal('Metas')">${ic("upload")} Importar Excel</button>` : ""}
      ${podeCriar ? `<button class="btn btn-primary" onclick="openMetaModal()">${ic("plus")} Nova meta</button>` : ""}
    </div>
  </div>`;
  const pager = `
  <div class="pager" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px;">
    <span style="color:var(--muted); font-size:12px;">${lista.length} ${excl?"meta(s) excluída(s)":"equipe(s)/serviço(s)"} · página ${metasGestaoPagina} de ${totalPag}</span>
    <div style="display:flex; gap:6px;">
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaMetas(-1)" ${metasGestaoPagina<=1?"disabled":""}>‹</button>
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="irParaPaginaMetas(1)" ${metasGestaoPagina>=totalPag?"disabled":""}>›</button>
    </div>
  </div>`;
  if(excl){
    return cab + `<div class="table-wrap"><table><thead><tr><th>Equipe</th><th>Serviço</th><th>Mês</th><th>Meta mensal</th><th>Atualizado</th><th></th></tr></thead><tbody>
      ${pagina.length===0 ? `<tr><td colspan="6"><div class="empty">${ic("empty")}<div>Nenhuma meta excluída.</div></div></td></tr>` : pagina.map(({m})=>`
        <tr><td class="mono">${escapeHtml(String(m.equipeId))}</td><td>${metaTipo(m)==="faixa" ? "Faixa (km)" : "Poda (un.)"}</td><td>${escapeHtml(m.anoMes||"")}</td><td class="num">${m.metaMensal}</td><td>${fmtDate(m.atualizadoEm)} · ${escapeHtml(m.atualizadoPor||"")}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="restaurarMeta('${m.id}')">Restaurar</button></td></tr>`).join("")}
    </tbody></table></div>` + pager;
  }
  const linhas = pagina.map(g=>{
    const porAno = {}; g.ms.forEach(m=>{ const a = String(m.anoMes).slice(0,4); (porAno[a] = porAno[a] || []).push(m); });
    const chips = Object.keys(porAno).sort().map(a=>{
      const n = porAno[a].length, tit = porAno[a].map(m=>META_MESES[(parseInt(String(m.anoMes).slice(5,7),10)||1)-1]).join(", ");
      return `<span class="pill ${n>=12?"ok":"info"}" title="${escapeHtml(tit)}" style="margin:0 4px 2px 0;">${a} · ${n} ${n===1?"mês":"meses"}</span>`;
    }).join("");
    const at = g.atual, atMes = at ? `${String(at.anoMes).slice(5,7)}/${String(at.anoMes).slice(0,4)}` : "";
    const enc = encodeURIComponent(String(g.equipeId));
    return `<tr>
      <td class="mono">${escapeHtml(String(g.equipeId))}</td>
      <td>${g.tipo==="faixa" ? "Faixa (km)" : "Poda (un.)"}</td>
      <td>${escapeHtml(g.e.polo||"—")}</td><td>${escapeHtml(g.e.regional||"—")}</td>
      <td>${chips}</td>
      <td class="num">${at ? `${at.metaMensal} <span style="color:var(--muted); font-size:11px;">(${atMes})</span>` : "—"}</td>
      <td>${g.atualizadoEm ? fmtDate(g.atualizadoEm) : "—"}</td>
      <td style="white-space:nowrap;">${(podeEditar||podeCriar) ? `<button class="btn btn-ghost btn-sm" onclick="openMetaGrupo('${enc}','${g.tipo}')">Editar</button>` : ""} ${podeEditar ? `<button class="btn btn-danger btn-sm" onclick="confirmarExcluirMetasGrupo('${enc}','${g.tipo}')">Excluir</button>` : ""}</td>
    </tr>`;
  }).join("");
  return cab + `<div class="table-wrap"><table data-sort-manual>
    <thead><tr>${[["equipe","Equipe"],["servico","Serviço"],["polo","Polo"],["regional","Regional"],["meses","Metas cadastradas"],["atual","Meta atual"],["atualizado","Atualizado"]].map(([c,r])=>ordenarHeadHtml(true,r,c,metasOrdem,"ordenarMetas")).join("")}<th></th></tr></thead>
    <tbody>${pagina.length===0 ? `<tr><td colspan="8"><div class="empty">${ic("empty")}<div>Nenhuma meta encontrada.</div></div></td></tr>` : linhas}</tbody>
  </table></div>` + pager;
}
async function restaurarMeta(id){
  await restaurarCadastro("metas", id);
  try{ const r = await apiGet("/cadastros/metas?excluidos=1&tamanhoPagina=200", 60000); metasExcluidosLista = r.registros || []; }catch(e){}
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = metasGestaoHtml();
}

/* ---- v2.13.0: CRUD das listas (Plano / Equipe necessária / Tipos de justificativa) ---- */
function listaItensGestao(lista){
  const itens = state.listas && state.listas[lista];
  return Array.isArray(itens) ? itens.slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0)) : [];
}
function listaGestaoHtml(cfg){
  if(!API_ONLINE){
    return `<div class="note">${ic("info")}<div>Controller offline — abra o sistema pelo iniciar.bat para cadastrar ${cfg.rotuloItem}s. Enquanto isso valem os padrões: ${escapeHtml(listaNomes(cfg.lista).join(" · "))}.</div></div>`;
  }
  const itens = listaItensGestao(cfg.lista);
  const podeEditar = minhaPermissao("manutencao","editar");
  return `
  <div style="display:flex; gap:8px; align-items:end; margin-bottom:12px; flex-wrap:wrap;">
    <div class="field" style="flex:1; min-width:240px;"><label>Novo ${cfg.rotuloItem}</label><input id="listaNovoNome" type="text" placeholder="Nome…" onkeydown="if(event.key==='Enter'){ event.preventDefault(); adicionarItemLista('${cfg.lista}'); }"></div>
    ${podeEditar ? `<button class="btn btn-primary" onclick="adicionarItemLista('${cfg.lista}')">${ic("plus")} Adicionar</button>` : ""}
  </div>
  <div class="table-wrap"><table>
    <thead><tr><th style="width:90px;">Ordem</th><th>Nome</th><th>Ativo?</th><th></th></tr></thead>
    <tbody>
      ${itens.length===0 ? `<tr><td colspan="4"><div class="empty">${ic("empty")}<div>Nenhum item cadastrado.</div></div></td></tr>` : itens.map((i,idx)=>`
        <tr>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" ${idx===0?"disabled":""} onclick="moverItemLista('${cfg.lista}','${i.id}',-1)">↑</button>
            <button class="btn btn-ghost btn-sm" ${idx===itens.length-1?"disabled":""} onclick="moverItemLista('${cfg.lista}','${i.id}',1)">↓</button>
          </td>
          <td>${escapeHtml(i.nome)}</td>
          <td><input type="checkbox" ${i.ativo!==false?"checked":""} ${podeEditar?"":"disabled"} onchange="alternarAtivoItemLista('${cfg.lista}','${i.id}',this.checked)" title="Inativo = não aparece pra escolher em registros novos; os antigos continuam valendo"></td>
          <td style="white-space:nowrap;">${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="renomearItemLista('${cfg.lista}','${i.id}')">Editar</button> <button class="btn btn-danger btn-sm" onclick="excluirItemLista('${cfg.lista}','${i.id}')">Excluir</button>` : ""}</td>
        </tr>`).join("")}
    </tbody>
  </table></div>
  <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">Excluir só esconde o item (flag) — programações e justificativas antigas que usam ele continuam mostrando o nome.</p>`;
}
async function recarregarListasGestao(){
  try{ const l = await apiGet("/listas"); if(l) state.listas = l; }catch(e){}
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
}
async function adicionarItemLista(lista){
  const el = document.getElementById("listaNovoNome");
  const nome = el ? el.value.trim() : "";
  if(!nome){ toast("Digite o nome."); return; }
  try{ await apiPost("/listas", { lista, nome }); toast("Item adicionado."); await recarregarListasGestao(); }
  catch(err){ toast(err.message.includes("409") ? "Já existe um item com esse nome." : `Erro: ${err.message}`); }
}
async function alternarAtivoItemLista(lista, id, ativo){
  try{ await apiPut(`/listas/${id}`, { ativo }); await recarregarListasGestao(); }catch(err){ toast(`Erro: ${err.message}`); }
}
async function excluirItemLista(lista, id){
  const i = listaItensGestao(lista).find(x=>x.id===id);
  if(!i || !window.confirm(`Excluir "${i.nome}"? (só esconde o item — nada é apagado do banco)`)) return;
  try{ await apiPut(`/listas/${id}`, { excluido:true }); toast("Item excluído (flag)."); await recarregarListasGestao(); }catch(err){ toast(`Erro: ${err.message}`); }
}
async function renomearItemLista(lista, id){
  const i = listaItensGestao(lista).find(x=>x.id===id);
  if(!i) return;
  const nome = window.prompt("Novo nome:", i.nome);
  if(nome===null || !nome.trim() || nome.trim()===i.nome) return;
  try{ await apiPut(`/listas/${id}`, { nome:nome.trim() }); await recarregarListasGestao(); }catch(err){ toast(`Erro: ${err.message}`); }
}
async function moverItemLista(lista, id, delta){
  const itens = listaItensGestao(lista);
  const idx = itens.findIndex(x=>x.id===id), j = idx+delta;
  if(idx<0 || j<0 || j>=itens.length) return;
  const a = itens[idx], b = itens[j];
  try{
    await apiPut(`/listas/${a.id}`, { ordem: b.ordem });
    await apiPut(`/listas/${b.id}`, { ordem: a.ordem });
    await recarregarListasGestao();
  }catch(err){ toast(`Erro: ${err.message}`); }
}

/* ---- v3.1.1: Gestão de Bases > Ajuda (perguntas e respostas do chat) ---- */
function ajudaGestaoHtml(){
  if(!API_ONLINE){
    return `<div class="note">${ic("info")}<div>Controller offline — abra o sistema pelo iniciar.bat para cadastrar as perguntas da Ajuda.</div></div>`;
  }
  const itens = ajudaItens.filter(i=>!i.excluido).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const podeEditar = minhaPermissao("manutencao","editar");
  return `
  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
    <p style="margin:0; color:var(--muted); font-size:12.5px;">Estas perguntas aparecem no chat de Ajuda (botão redondo no canto da tela). O SPARK procura a resposta pelas palavras da pergunta, da resposta e pelas <b>palavras-chave</b>.</p>
    ${podeEditar ? `<button class="btn btn-primary btn-sm" onclick="abrirEdicaoAjuda()">${ic("plus")} Nova pergunta</button>` : ""}
  </div>
  <div class="table-wrap"><table>
    <thead><tr><th style="width:90px;">Ordem</th><th>Assunto</th><th>Pergunta</th><th>Ativa?</th><th></th></tr></thead>
    <tbody>
      ${itens.length===0 ? `<tr><td colspan="5"><div class="empty">${ic("empty")}<div>Nenhuma pergunta cadastrada.</div></div></td></tr>` : itens.map((i,idx)=>`
        <tr>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" ${idx===0||!podeEditar?"disabled":""} onclick="moverItemAjuda('${i.id}',-1)">↑</button>
            <button class="btn btn-ghost btn-sm" ${idx===itens.length-1||!podeEditar?"disabled":""} onclick="moverItemAjuda('${i.id}',1)">↓</button>
          </td>
          <td><span class="pill info">${escapeHtml(i.categoria||"Geral")}</span></td>
          <td>${escapeHtml(i.pergunta)}<div style="color:var(--muted); font-size:11.5px; margin-top:2px;">${escapeHtml(String(i.resposta||"").slice(0,110))}${String(i.resposta||"").length>110?"…":""}</div></td>
          <td><input type="checkbox" ${i.ativo!==false?"checked":""} ${podeEditar?"":"disabled"} onchange="alternarAtivoAjuda('${i.id}',this.checked)" title="Inativa = não aparece no chat"></td>
          <td style="white-space:nowrap;">${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="abrirEdicaoAjuda('${i.id}')">Editar</button> <button class="btn btn-danger btn-sm" onclick="excluirItemAjuda('${i.id}')">Excluir</button>` : ""}</td>
        </tr>`).join("")}
    </tbody>
  </table></div>
  <p style="color:var(--muted); font-size:11.5px; margin-top:8px;">Excluir só esconde a pergunta (flag). Inativa = fica aqui, mas não aparece no chat.</p>`;
}
async function recarregarAjudaGestao(){
  await ajudaCarregar(true);
  const w = document.getElementById("cadastroGridWrap"); if(w) w.innerHTML = cadastroGridHtml();
}
function abrirEdicaoAjuda(id){
  const i = id ? ajudaItens.find(x=>x.id===id) : null;
  const cats = [...new Set(ajudaItens.map(x=>x.categoria).filter(Boolean))];
  openModal(`
    <h2>${i ? "Editar pergunta" : "Nova pergunta"}</h2>
    <p class="modal-sub">Aparece no chat de Ajuda do SPARK.</p>
    <div class="field" style="margin-bottom:12px;"><label>Assunto</label>
      <input id="ajCategoria" type="text" list="ajCategorias" value="${escapeHtml(i?i.categoria:"")}" placeholder="Ex.: Programação">
      <datalist id="ajCategorias">${cats.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist></div>
    <div class="field" style="margin-bottom:12px;"><label>Pergunta</label><input id="ajPergunta" type="text" value="${escapeHtml(i?i.pergunta:"")}"></div>
    <div class="field" style="margin-bottom:12px;"><label>Resposta</label><textarea id="ajResposta" rows="6" style="width:100%;">${escapeHtml(i?i.resposta:"")}</textarea></div>
    <div class="field" style="margin-bottom:12px;"><label>Palavras-chave (ajudam o SPARK a achar a resposta)</label><input id="ajPalavras" type="text" value="${escapeHtml(i?i.palavras:"")}" placeholder="Ex.: senha trocar alterar login"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoAjuda('${i?i.id:""}')">${ic("check")} Salvar</button>
    </div>`);
}
async function salvarEdicaoAjuda(id){
  const corpo = {
    categoria: document.getElementById("ajCategoria").value.trim(),
    pergunta: document.getElementById("ajPergunta").value.trim(),
    resposta: document.getElementById("ajResposta").value.trim(),
    palavras: document.getElementById("ajPalavras").value.trim()
  };
  if(!corpo.pergunta || !corpo.resposta){ toast("Preencha a pergunta e a resposta."); return; }
  try{
    if(id) await apiPut(`/ajuda/${id}`, corpo); else await apiPost("/ajuda", corpo);
    closeModal(); toast(id ? "Pergunta atualizada." : "Pergunta adicionada."); await recarregarAjudaGestao();
  }catch(err){ toast(`Erro: ${err.message}`); }
}
async function alternarAtivoAjuda(id, ativo){
  try{ await apiPut(`/ajuda/${id}`, { ativo }); await recarregarAjudaGestao(); }catch(err){ toast(`Erro: ${err.message}`); }
}
async function excluirItemAjuda(id){
  const i = ajudaItens.find(x=>x.id===id);
  if(!i || !window.confirm(`Excluir a pergunta "${i.pergunta}"? (só esconde — nada é apagado do banco)`)) return;
  try{ await apiPut(`/ajuda/${id}`, { excluido:true }); toast("Pergunta excluída (flag)."); await recarregarAjudaGestao(); }catch(err){ toast(`Erro: ${err.message}`); }
}
async function moverItemAjuda(id, delta){
  const itens = ajudaItens.filter(i=>!i.excluido).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const idx = itens.findIndex(x=>x.id===id), j = idx+delta;
  if(idx<0 || j<0 || j>=itens.length) return;
  const a = itens[idx], b = itens[j];
  try{
    let oa = a.ordem, ob = b.ordem;
    if(oa===ob){ oa = idx+1; ob = j+1; }
    await apiPut(`/ajuda/${a.id}`, { ordem: ob });
    await apiPut(`/ajuda/${b.id}`, { ordem: oa });
    await recarregarAjudaGestao();
  }catch(err){ toast(`Erro: ${err.message}`); }
}

function abrirEdicaoCadastro(chave){
  if(!podeEditarLinhaBase()){ toast("Seu perfil só pode visualizar."); return; }
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  const registro = cadastroRegistros.find(r => String(r[cfg.keyField])===chave);
  if(!registro) return;
  openModal(`
    <h2>Editar ${cfg.label.toLowerCase()}</h2>
    <p class="modal-sub mono">${cfg.keyField}: ${escapeHtml(chave)}</p>
    <div id="cadastroEdicaoCampos">
      ${cfg.campos.map(c=>campoEdicaoCadastroHtml(c, registro[c.nome])).join("")}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="cadastroSalvarBtn" onclick="salvarEdicaoCadastro('${escapeHtml(chave)}')">${ic("check")} Salvar</button>
    </div>
  `);
}
function campoEdicaoCadastroHtml(campo, valor){
  const id = `cadCampo_${campo.nome}`;
  if(campo.tipo==="booleano"){
    return `<div class="field" style="margin-bottom:12px;"><label><input type="checkbox" id="${id}" ${valor?"checked":""}> ${campo.rotulo}</label></div>`;
  }
  if(campo.opcoes){
    const vl = valor===null||valor===undefined ? "" : String(valor);
    const opts = [...campo.opcoes]; if(vl && !opts.some(o=>o.toLowerCase()===vl.toLowerCase())) opts.push(vl);
    return `<div class="field" style="margin-bottom:12px;"><label>${campo.rotulo}</label><select id="${id}"><option value="">${escapeHtml(campo.vazio||"—")}</option>${opts.map(o=>`<option value="${escapeHtml(o)}" ${o.toLowerCase()===vl.toLowerCase()?"selected":""}>${escapeHtml(o)}</option>`).join("")}</select></div>`;
  }
  const tipoInput = campo.tipo==="numero" ? "number" : "text";
  return `<div class="field" style="margin-bottom:12px;"><label>${campo.rotulo}</label><input id="${id}" type="${tipoInput}" ${campo.tipo==="numero"?'step="any"':''} value="${valor===null||valor===undefined?'':escapeHtml(String(valor))}"></div>`;
}
async function salvarEdicaoCadastro(chave){
  const cfg = CADASTROS_BASES[cadastroBaseAtiva];
  const payload = {};
  cfg.campos.forEach(c=>{
    const el = document.getElementById(`cadCampo_${c.nome}`);
    if(!el) return;
    if(c.tipo==="booleano") payload[c.nome] = el.checked;
    else if(c.tipo==="numero") payload[c.nome] = el.value===""? null : Number(el.value);
    else payload[c.nome] = el.value;
  });
  const btn = document.getElementById("cadastroSalvarBtn");
  if(btn) btn.disabled = true;
  try{
    if(cadastroBaseAtiva==="equipes"){
      const atualizado = API_ONLINE ? await apiPut(`/equipes/${encodeURIComponent(chave)}`, payload) : { id:chave, ...payload };
      const idx = state.equipes.findIndex(e=>e.id===chave);
      if(idx>=0) state.equipes[idx] = { ...state.equipes[idx], ...atualizado };
    } else {
      const atualizado = API_ONLINE ? await apiPut(`/cadastros/${cfg.apiBase}/${encodeURIComponent(chave)}`, payload) : { [cfg.keyField]:chave, ...payload };
      const idx = cadastroRegistros.findIndex(r=>String(r[cfg.keyField])===chave);
      if(idx>=0) cadastroRegistros[idx] = { ...cadastroRegistros[idx], ...atualizado };
    }
    if(cadastroBaseAtiva==="conjuntos") await recarregarConjuntos();
    closeModal();
    toast("Registro atualizado.");
    const wrap = document.getElementById("cadastroGridWrap");
    if(wrap) wrap.innerHTML = cadastroGridHtml();
  }catch(err){
    toast(`Erro ao salvar: ${err.message}`);
  }finally{
    if(btn) btn.disabled = false;
  }
}

/* =========================================================================
   VIEW: Usuários & Permissões
   ========================================================================= */
/* v2.13.0 - pedidos de cadastro vindos da tela de login (só e-mail) */
function solicitacoesHtml(){
  const lista = state.solicitacoes || [];
  if(!lista.length || !minhaPermissao("usuarios","editar")) return "";
  return `
  <div class="card" style="margin-bottom:14px; border-left:4px solid var(--warn-fg);">
    <div class="card-head"><h3>Solicitações de cadastro <span class="pill warn">${lista.length}</span></h3></div>
    <div class="table-wrap"><table>
      <thead><tr><th>E-mail</th><th>Pedido em</th><th></th></tr></thead>
      <tbody>
        ${lista.map(sl=>`<tr>
          <td>${escapeHtml(sl.email)}</td><td>${fmtDateTime(sl.criadoEm)}</td>
          <td style="white-space:nowrap;"><button class="btn btn-primary btn-sm" onclick="abrirAprovarSolicitacao('${sl.id}')">${ic("check")} Aprovar</button>
          <button class="btn btn-danger btn-sm" onclick="recusarSolicitacao('${sl.id}')">Recusar</button></td></tr>`).join("")}
      </tbody>
    </table></div>
  </div>`;
}
async function recarregarSolicitacoes(){
  try{ state.solicitacoes = await apiGet("/usuarios/solicitacoes"); }catch(e){ state.solicitacoes = []; }
}
function abrirAprovarSolicitacao(id){
  const sl = (state.solicitacoes||[]).find(x=>x.id===id);
  if(!sl) return;
  openModal(`
    <h2>Aprovar cadastro</h2>
    <p class="modal-sub">${sl.temSenha
      ? `${escapeHtml(sl.email)} já escolheu a própria senha no pedido — confira o nome e escolha o perfil-modelo.`
      : `${escapeHtml(sl.email)} só informou o e-mail — defina nome, perfil-modelo e uma senha inicial (avise a pessoa; ela pode trocar depois).`}</p>
    <div id="aprovarErro"></div>
    <div class="field" style="margin-bottom:12px;"><label>Nome</label><input id="aprNome" value="${escapeHtml(sl.nome || sl.email.split("@")[0])}"></div>
    <div class="field" style="margin-bottom:12px;"><label>Perfil-modelo</label>
      <select id="aprPerfil">${Object.keys(state.perfisModelo).map(p=>`<option value="${escapeHtml(p)}" ${p==="Consulta"?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
    <div class="field"><label>${sl.temSenha ? "Nova senha (opcional)" : "Senha inicial"}</label><input id="aprSenha" type="text" placeholder="${sl.temSenha ? "deixe em branco para manter a senha escolhida pela pessoa" : "mínimo 8 caracteres"}"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="aprovarSolicitacao('${id}')">${ic("check")} Aprovar e criar usuário</button>
    </div>`);
}
async function aprovarSolicitacao(id){
  const nome = document.getElementById("aprNome").value.trim();
  const perfilBase = document.getElementById("aprPerfil").value;
  const senha = document.getElementById("aprSenha").value;
  const erro = document.getElementById("aprovarErro");
  const sl = (state.solicitacoes||[]).find(x=>x.id===id);
  const temSenha = !!(sl && sl.temSenha);
  if((!temSenha || senha) && senha.length<8){ erro.innerHTML = `<div class="login-error">${ic("info")}<div>${temSenha ? "A nova senha precisa ter pelo menos 8 caracteres (ou deixe em branco)." : "Defina uma senha inicial (mínimo 8 caracteres)."}</div></div>`; return; }
  try{
    await apiPost(`/usuarios/solicitacoes/${id}/aprovar`, { nome, perfilBase, senha });
    closeModal(); toast("Cadastro aprovado — usuário criado e ativo.");
    await recarregarSolicitacoes();
    try{ await loadStateFromApi(); }catch(e){}
    render();
  }catch(err){
    let t = err.message; const m = t.match(/\(([^)]+)\)\s*$/); if(m) t = m[1];
    erro.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(t)}</div></div>`;
  }
}
async function recusarSolicitacao(id){
  const sl = (state.solicitacoes||[]).find(x=>x.id===id);
  if(!sl || !window.confirm(`Recusar o pedido de ${sl.email}?`)) return;
  try{ await apiPost(`/usuarios/solicitacoes/${id}/recusar`, {}); toast("Pedido recusado."); await recarregarSolicitacoes(); render(); }
  catch(err){ toast(`Erro: ${err.message}`); }
}

/* v2.15.12 - lista de usuários em duas abas: Ativos (inclui pendentes) e Bloqueados */
let usuariosAba = "ativos";
function usuarioEhBloqueado(u){ return !!u && u.statusConta==="Bloqueado"; }
function usuariosDaAba(aba){ return state.usuarios.filter(u => (aba==="bloqueados") === usuarioEhBloqueado(u)); }
function trocarAbaUsuarios(aba){
  if(aba===usuariosAba) return;
  const atual = state.usuarios.find(x=>x.id===currentUserPermViewId);
  const lista = usuariosDaAba(aba);
  // se o usuário aberto no painel não pertence à aba nova, abre o primeiro dela
  if(lista.length && !(atual && lista.includes(atual))){
    if(permRascunho && !window.confirm("Há alterações de permissão não salvas. Descartar e trocar de usuário?")) return;
    permRascunho = null;
    currentUserPermViewId = lista[0].id;
  }
  usuariosAba = aba; usuariosPag = 1;
  render();
}
function usuarioLinhaHtml(u){
  return `
    <div onclick="selecionarUsuarioPermissao('${u.id}')" style="display:flex; align-items:center; gap:10px; padding:9px 6px; border-radius:10px; cursor:pointer; ${u.id===currentUserPermViewId?'background:var(--surface-2); box-shadow:inset 3px 0 0 var(--accent);':''}">
      <div class="avatar-lg" style="background:${corAvatar(u.nome)}">${iniciais(u.nome)}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:13px;">${escapeHtml(u.nome)}</div>
        <div style="font-size:11.5px; color:var(--muted);">${escapeHtml(u.perfilBase||"")}</div>
      </div>
      ${u.statusConta==="Pendente" ? `<span class="pill warn">pendente</span>` : u.statusConta==="Bloqueado" ? `<span class="pill bad">bloqueado</span>` : `<span class="pill ok">ativo</span>`}
    </div>`;
}
const USUARIOS_POR_PAGINA = 10;
let usuariosBusca = "", usuariosPag = 1;
function usuariosIrPagina(n){ usuariosPag = n; render(); }
function usuariosBuscar(v){
  usuariosBusca = v; usuariosPag = 1;
  clearTimeout(usuariosBuscar._t);
  usuariosBuscar._t = setTimeout(()=>{
    render();
    const i = document.getElementById("usrBusca");
    if(i){ i.focus(); const n = i.value.length; try{ i.setSelectionRange(n,n); }catch(e){} }
  }, 200);
}
function viewUsuarios(){
  const nBloq = usuariosDaAba("bloqueados").length, nAtivos = state.usuarios.length - nBloq;
  const lista = usuariosDaAba(usuariosAba);
  // painel da direita sempre mostra alguém da aba aberta (ex.: ao abrir a tela já numa conta bloqueada)
  if(lista.length && !permRascunho && !lista.some(x=>x.id===currentUserPermViewId)) currentUserPermViewId = lista[0].id;
  const termos = usuariosBusca.trim().toLowerCase();
  const filtrada = termos ? lista.filter(u=>(String(u.nome||"")+" "+String(u.email||"")+" "+String(u.perfilBase||"")).toLowerCase().includes(termos)) : lista;
  const totalPag = Math.max(1, Math.ceil(filtrada.length / USUARIOS_POR_PAGINA));
  if(usuariosPag > totalPag) usuariosPag = totalPag;
  if(usuariosPag < 1) usuariosPag = 1;
  const pagina = filtrada.slice((usuariosPag-1)*USUARIOS_POR_PAGINA, usuariosPag*USUARIOS_POR_PAGINA);
  const abaBtn = (id, rot, n) => `<button type="button" class="btn btn-sm ${usuariosAba===id?"btn-primary":"btn-ghost"}" onclick="trocarAbaUsuarios('${id}')">${rot} <span style="opacity:.75;">(${n})</span></button>`;
  return `
  ${solicitacoesHtml()}
  <div class="grid" style="grid-template-columns:1fr 1.6fr; gap:14px;">
    <div class="card">
      <div class="card-head"><h3>Usuários</h3><button class="btn btn-ghost btn-sm" onclick="toast('Abriria o formulário de novo cadastro.')">${ic("plus")} Novo</button></div>
      <div class="usr-busca">${abaBtn("ativos","Ativos",nAtivos)}${abaBtn("bloqueados","Bloqueados",nBloq)}<input type="text" id="usrBusca" value="${escapeHtml(usuariosBusca)}" placeholder="Buscar usuário…" title="Busca por nome, e-mail ou perfil" oninput="usuariosBuscar(this.value)" autocomplete="off"></div>
      ${lista.length ? (pagina.length ? pagina.map(usuarioLinhaHtml).join("") : `<p style="color:var(--muted); font-size:12.5px; padding:10px 6px;">Nenhum usuário encontrado para essa busca.</p>`) : `<p style="color:var(--muted); font-size:12.5px; padding:10px 6px;">${usuariosAba==="bloqueados" ? "Nenhum usuário bloqueado." : "Nenhum usuário ativo."}</p>`}
      ${filtrada.length > USUARIOS_POR_PAGINA ? `<div class="usr-pag"><button type="button" class="btn btn-ghost btn-sm" ${usuariosPag<=1?"disabled":""} onclick="usuariosIrPagina(${usuariosPag-1})">‹ Anterior</button><span>${(usuariosPag-1)*USUARIOS_POR_PAGINA+1}–${Math.min(usuariosPag*USUARIOS_POR_PAGINA, filtrada.length)} de ${filtrada.length}</span><button type="button" class="btn btn-ghost btn-sm" ${usuariosPag>=totalPag?"disabled":""} onclick="usuariosIrPagina(${usuariosPag+1})">Próxima ›</button></div>` : ""}
    </div>

    <div class="card">
      ${lista.length ? permissaoPainelHtml() : `<p style="color:var(--muted);">${usuariosAba==="bloqueados" ? "Nenhum usuário bloqueado no momento." : "Nenhum usuário ativo."}</p>`}
    </div>
  </div>
  `;
}
function iniciais(nome){ return nome.split(" ").filter(Boolean).slice(0,2).map(n=>n[0]).join("").toUpperCase(); }
function corAvatar(nome){
  const cores = ["#1F1F4C","#1B4F8C","#B45309","#6D28D9","#B42318"];
  let h=0; for(const c of nome) h+=c.charCodeAt(0);
  return cores[h%cores.length];
}
function selecionarUsuarioPermissao(id){
  if(id===currentUserPermViewId) return;
  if(permRascunho && !window.confirm("Há alterações de permissão não salvas. Descartar e trocar de usuário?")) return;
  permRascunho = null;
  currentUserPermViewId = id; render();
}
/* v2.13.0 - rascunho das permissões: marcar/desmarcar caixas NÃO grava
   mais na hora; fica como rascunho até clicar em Salvar (ou Descartar). */
let permRascunho = null;   // { usuarioId, matriz, perfilBase|null }
const MODULO_ROTULOS = { manutencao:"Manutenção", produtividade:"Produtividade", metas:"Metas", programacao:"Programação", prefeituras:"Prefeituras", gestaoBases:"Gestão de Bases", alertas:"Alertas (menu)", prioridade:"Prioridade da programação", nix:"Pontos Nix", usuarios:"Configuração" };
function permMatrizAtual(uid){
  if(permRascunho && permRascunho.usuarioId===uid) return permRascunho.matriz;
  return state.permissoes[uid] || {};
}
function permIniciarRascunho(uid){
  if(!permRascunho || permRascunho.usuarioId!==uid){
    permRascunho = { usuarioId:uid, matriz: JSON.parse(JSON.stringify(state.permissoes[uid]||{})), perfilBase:null };
  }
  return permRascunho;
}
function permSalvar(){
  if(!permRascunho) return;
  const { usuarioId, matriz, perfilBase } = permRascunho;
  state.permissoes[usuarioId] = JSON.parse(JSON.stringify(matriz));
  const corpo = perfilBase ? { perfilBase, matriz } : { matriz };
  if(perfilBase){ const u = state.usuarios.find(x=>x.id===usuarioId); if(u) u.perfilBase = perfilBase; }
  syncApi("PUT", `/permissoes/${usuarioId}`, corpo);
  permRascunho = null;
  toast("Permissões salvas.");
  render();
}
function permDescartar(){
  permRascunho = null;
  toast("Alterações descartadas.");
  render();
}
function permalteracoesPendentes(){ return !!permRascunho; }
function permBarraHtml(){
  if(!permRascunho) return "";
  return `<div class="note" style="background:var(--warn-bg); color:var(--warn-fg); margin:0 0 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
    <div style="display:flex; gap:8px; align-items:center;">${ic("warn")}<strong>Alterações não salvas</strong></div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-ghost btn-sm" onclick="permDescartar()">Descartar</button>
      <button class="btn btn-primary btn-sm" onclick="permSalvar()">${ic("check")} Salvar alterações</button>
    </div></div>`;
}
window.addEventListener("beforeunload", e=>{ if(permRascunho){ e.preventDefault(); e.returnValue = ""; } });

function permissaoPainelHtml(){
  const u = state.usuarios.find(x=>x.id===currentUserPermViewId);
  const matriz = permMatrizAtual(u.id);
  const podeEditar = minhaPermissao("usuarios","editar");
  const podeStatus = minhaPermissao("usuarios","excluirStatus");
  if(u.statusConta==="Pendente"){
    return `
      <div class="card-head"><h3>${u.nome}</h3><span class="pill warn">cadastro pendente</span></div>
      <p style="color:var(--muted);">Este usuário se cadastrou e aguarda liberação de um administrador antes de acessar qualquer módulo.</p>
      ${podeEditar ? (()=>{ const sl=(state.solicitacoes||[]).find(x=>String(x.email||"").toLowerCase()===String(u.email||"").toLowerCase());
        return sl ? `<button class="btn btn-primary" onclick="abrirAprovarSolicitacao('${sl.id}')">${ic("check")} Aprovar acesso</button>`
                  : `<button class="btn btn-primary" onclick="liberarUsuario('${u.id}')">${ic("check")} Liberar acesso</button>`; })() : `<p style="color:var(--muted); font-size:12px;">Você não tem permissão pra liberar usuários.</p>`}
    `;
  }
  const souEsseUsuario = currentUser && currentUser.id === u.id;
  return `
    ${permBarraHtml()}
    <div class="card-head">
      <h3>${u.nome} <span style="font-weight:400; color:var(--muted); font-size:12.5px;">— ${u.email}</span></h3>
      <div class="field" style="width:220px;">
        <select onchange="aplicarPerfilModelo('${u.id}', this.value)" ${podeEditar?"":"disabled"}>
          <option>Aplicar perfil-modelo…</option>
          ${Object.keys(state.perfisModelo).map(p=>`<option value="${p}">${p}</option>`).join("")}
        </select>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:-6px 0 14px;">
      ${u.statusConta==="Bloqueado" ? `<span class="pill bad">${ic("info")} bloqueado — não consegue logar</span>` : `<span class="pill ok">${ic("check")} ativo</span>`}
      ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="abrirRedefinirSenha('${u.id}')">${ic("info")} Redefinir senha</button>` : ""}
      ${podeStatus ? (u.statusConta==="Bloqueado"
        ? `<button class="btn btn-ghost btn-sm" onclick="desbloquearUsuario('${u.id}')">${ic("check")} Desbloquear</button>`
        : `<button class="btn btn-ghost btn-sm" ${souEsseUsuario?"disabled title=\"Você não pode bloquear a própria conta\"":""} onclick="bloquearUsuario('${u.id}')">${ic("info")} Bloquear acesso</button>`) : ""}
      ${(podeStatus && u.statusConta==="Bloqueado" && !souEsseUsuario) ? `<button class="btn btn-danger btn-sm" style="margin-left:auto;" onclick="excluirUsuario('${u.id}')">${ic("close")} Excluir usuário</button>` : ""}
    </div>
    <div class="table-wrap"><table class="perm-grid">
      <thead><tr><th>Módulo</th><th>Visualizar</th><th>Criar</th><th>Editar</th><th>Excluir/Status</th><th>Importar</th></tr></thead>
      <tbody>
        ${state.MODULOS.map(mod=>`
          <tr>
            <td>${MODULO_ROTULOS[mod]||mod}</td>
            ${state.ACOES.map(acao=> (mod==="alertas" && acao!=="visualizar") || (mod==="prioridade" && (acao==="criar"||acao==="editar")) || (mod==="nix" && acao==="editar") ? `<td class="checkbox-cell"></td>` : `
              <td class="checkbox-cell"><input type="checkbox" ${(mod==="alertas" ? (matriz.alertas && typeof matriz.alertas.visualizar==="boolean" ? matriz.alertas.visualizar : (u.perfilBase==="Administrador" || alertasVisivel(matriz))) : (matriz[mod] && matriz[mod][acao])) ? "checked":""} ${podeEditar?"":"disabled"} onchange="togglePermissao('${u.id}','${mod}','${acao}',this.checked)"></td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table></div>
    <p style="color:var(--muted); font-size:11.5px; margin-top:10px;">"Alertas (menu)" só mostra ou esconde o menu Alertas para esse usuário. Ajuste fino por usuário. O perfil-modelo é só um ponto de partida — cada caixa pode ser ligada ou desligada individualmente.</p>
  `;
}
function togglePermissao(uid, mod, acao, val){
  const r = permIniciarRascunho(uid);
  r.matriz[mod] = r.matriz[mod] || {};
  r.matriz[mod][acao] = val;
  render();   // mostra a barra "alterações não salvas"
}
function aplicarPerfilModelo(uid, perfil){
  if(!state.perfisModelo[perfil]) return;
  const r = permIniciarRascunho(uid);
  r.matriz = JSON.parse(JSON.stringify(state.perfisModelo[perfil]));
  r.perfilBase = perfil;
  toast(`Perfil "${perfil}" aplicado como rascunho — clique em Salvar para confirmar.`);
  render();
}
function liberarUsuario(uid){
  state.usuarios.find(u=>u.id===uid).statusConta = "Ativo";
  syncApi("PATCH", `/usuarios/${uid}/liberar`);
  state.solicitacoes = (state.solicitacoes||[]).filter(x=>String(x.email||"").toLowerCase()!==String(state.usuarios.find(u=>u.id===uid).email||"").toLowerCase());
  toast("Usuário liberado. Já pode acessar o sistema.");
  render();
}
function bloquearUsuario(uid){
  const u = state.usuarios.find(x=>x.id===uid);
  if(!confirm(`Bloquear o acesso de ${u.nome}? A pessoa não vai mais conseguir logar até você desbloquear.`)) return;
  u.statusConta = "Bloqueado";
  syncApi("PATCH", `/usuarios/${uid}/bloquear`);
  usuariosAba = "bloqueados";   // acompanha o usuário pra aba onde ele agora está
  toast(`${u.nome} bloqueado(a).`);
  render();
}
function desbloquearUsuario(uid){
  const u = state.usuarios.find(x=>x.id===uid);
  u.statusConta = "Ativo";
  syncApi("PATCH", `/usuarios/${uid}/desbloquear`);
  usuariosAba = "ativos";
  toast(`${u.nome} desbloqueado(a) — já pode logar de novo.`);
  render();
}
/* v2.15.12 - exclui de vez um usuário BLOQUEADO (o Controller também confere). */
function excluirUsuario(uid){
  const u = state.usuarios.find(x=>x.id===uid);
  if(!u || u.statusConta!=="Bloqueado") return;
  openModal(`
    <h2>Excluir usuário</h2>
    <p class="modal-sub">Excluir <strong>${escapeHtml(u.nome)}</strong> (${escapeHtml(u.email||"")}) de vez? Isso remove o acesso e as permissões e não dá pra desfazer. O histórico que a pessoa gerou continua, mas o nome dela passa a aparecer como "—".</p>
    <div id="excluirUsuarioErro"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="excluirUsuarioConfirmar('${uid}')">Excluir usuário</button>
    </div>
  `);
}
async function excluirUsuarioConfirmar(uid){
  const erroEl = document.getElementById("excluirUsuarioErro");
  const u = state.usuarios.find(x=>x.id===uid);
  if(!u) return closeModal();
  if(API_ONLINE){
    try{ await apiDelete(`/usuarios/${uid}`); }
    catch(err){
      let t = err.message; const m = t.match(/\(([^)]+)\)\s*$/); if(m) t = m[1];
      if(erroEl) erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(t)}</div></div>`;
      return;
    }
  }
  state.usuarios = state.usuarios.filter(x=>x.id!==uid);
  delete state.permissoes[uid];
  if(permRascunho && permRascunho.usuarioId===uid) permRascunho = null;
  let resto = usuariosDaAba(usuariosAba);
  if(!resto.length){ usuariosAba = "ativos"; resto = usuariosDaAba("ativos"); }
  const prox = resto[0] || state.usuarios[0];
  currentUserPermViewId = prox ? prox.id : null;
  closeModal();
  toast(`${u.nome} excluído(a).`);
  render();
}
function abrirRedefinirSenha(uid){
  const u = state.usuarios.find(x=>x.id===uid);
  openModal(`
    <h2>Redefinir senha — ${u.nome}</h2>
    <p class="modal-sub">Defina uma nova senha pra este usuário. Ele(a) não precisa saber a senha atual — avise a pessoa pela sua forma de comunicação de costume.</p>
    <div id="redefSenhaErro"></div>
    <div class="field">
      <label>Nova senha</label>
      <input type="password" id="redefSenhaNova" placeholder="mínimo 3 caracteres" autofocus>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarRedefinirSenha('${uid}')">${ic("check")} Salvar nova senha</button>
    </div>
  `);
}
async function salvarRedefinirSenha(uid){
  const senhaNova = document.getElementById("redefSenhaNova").value;
  const erroEl = document.getElementById("redefSenhaErro");
  if(!senhaNova || senhaNova.length < 3){
    erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>A senha precisa ter pelo menos 3 caracteres.</div></div>`;
    return;
  }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat pra alterar senhas de verdade."); closeModal(); return; }
  try{
    await apiPatch(`/usuarios/${uid}/senha`, { senhaNova });
    closeModal();
    toast("Senha redefinida.");
  }catch(err){
    erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(err.message)}</div></div>`;
  }
}

/* =========================================================================
   Minha conta — trocar a própria senha, sair
   ========================================================================= */
/* v2.15.35 - menu "Alertas": liga/desliga por usuário na matriz (só "Visualizar").
   Quem nunca teve a caixa marcada/desmarcada segue a permissão de Manutenção
   (comportamento de antes); a escolha explícita vale para todos, até Administrador. */
function alertasVisivel(matriz){
  if(matriz && matriz.alertas && typeof matriz.alertas.visualizar === "boolean") return matriz.alertas.visualizar;
  return !!(matriz && matriz.manutencao && matriz.manutencao.visualizar);
}
function minhaPermissao(modulo, acao){
  if(modulo === "alertas" && acao === "visualizar" && currentUser){
    const m = state.permissoes[currentUser.id] || {};
    if(m.alertas && typeof m.alertas.visualizar === "boolean") return m.alertas.visualizar;
    if(currentUser.perfilBase === "Administrador") return true;
    return alertasVisivel(m);
  }
  // Sem login real (protótipo offline) mantemos o comportamento de sempre:
  // tudo liberado, pra não travar a demo.
  if(!currentUser) return true;
  if(currentUser.perfilBase === "Administrador") return true;
  const matriz = state.permissoes[currentUser.id] || {};
  return !!(matriz[modulo] && matriz[modulo][acao]);
}
function atualizarUserPill(){
  const nome = currentUser ? currentUser.nome : "Admin Exemplo";
  const perfil = currentUser ? currentUser.perfilBase : "Administrador";
  const av = document.getElementById("userPillAvatar");
  const nm = document.getElementById("userPillNome");
  const pf = document.getElementById("userPillPerfil");
  if(av) av.textContent = iniciais(nome);
  if(nm) nm.textContent = nome;
  if(pf) pf.textContent = perfil;
}
function abrirMinhaConta(){
  const nome = currentUser ? currentUser.nome : "Admin Exemplo";
  const email = currentUser ? currentUser.email : "—";
  const perfil = currentUser ? currentUser.perfilBase : "Administrador";
  openModal(`
    <h2>Minha conta</h2>
    <p class="modal-sub">${escapeHtml(nome)} — ${escapeHtml(email)} · ${escapeHtml(perfil)}</p>
    <h3 style="font-size:13.5px; margin:18px 0 4px;">Trocar minha senha</h3>
    <div id="minhaSenhaErro"></div>
    <div class="field">
      <label>Senha atual</label>
      <input type="password" id="minhaSenhaAtual" autocomplete="current-password">
    </div>
    <div class="field">
      <label>Nova senha</label>
      <input type="password" id="minhaSenhaNova" autocomplete="new-password" placeholder="mínimo 3 caracteres">
    </div>
    <label class="spark-opcao tema-opcao"><span class="tema-ico">🌙</span><span style="flex:1;"><strong>Modo escuro</strong><br><span style="color:var(--muted);">Troca as cores do sistema para um visual escuro neste navegador.</span></span><input type="checkbox" ${temaEscuro()?"checked":""} onchange="setTemaEscuro(this.checked)"></label>
    <label class="spark-opcao"><img src="assets/spark/spark_cabeca.png" alt=""><span style="flex:1;"><strong>SPARK, o assistente</strong><br><span style="color:var(--muted);">Mostrar o SPARK ao lado dos avisos neste navegador.</span></span><input type="checkbox" ${sparkAtivo()?"checked":""} onchange="setSparkAtivo(this.checked)"></label>
    <div class="modal-foot" style="justify-content:space-between;">
      <button class="btn btn-ghost" onclick="fazerLogout()">${ic("info")} Sair</button>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
        <button class="btn btn-primary" onclick="salvarTrocaMinhaSenha()">${ic("check")} Trocar senha</button>
      </div>
    </div>
  `);
}
async function salvarTrocaMinhaSenha(){
  const erroEl = document.getElementById("minhaSenhaErro");
  const senhaAtual = document.getElementById("minhaSenhaAtual").value;
  const senhaNova = document.getElementById("minhaSenhaNova").value;
  if(!senhaNova || senhaNova.length < 3){
    erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>A nova senha precisa ter pelo menos 3 caracteres.</div></div>`;
    return;
  }
  if(!API_ONLINE){ toast("Controller offline — abra o sistema pelo iniciar.bat pra trocar a senha de verdade."); return; }
  try{
    await apiPost("/auth/trocar-senha", { senhaAtual, senhaNova });
    closeModal();
    toast("Senha alterada com sucesso.");
  }catch(err){
    erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(err.message)}</div></div>`;
  }
}

/* =========================================================================
   Tela de login — mostrada antes do app quando há Controller real
   (API_ONLINE) e ainda não há sessão válida. Ver bootApp()/fazerLogin() em
   api.js.
   ========================================================================= */
function mostrarTelaLogin(){
  document.getElementById("bootLoading").classList.add("hidden");
  document.getElementById("shell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginErrorBox").innerHTML = "";
  const form = document.getElementById("loginForm");
  if(form) form.reset();
  setTimeout(()=>{ const el = document.getElementById("loginEmail"); if(el) el.focus(); }, 30);
}
function mostrarApp(){
  document.getElementById("bootLoading").classList.add("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("shell").classList.remove("hidden");
  atualizarUserPill();
  renderNav();
  render();
  // v2.12.0 - carrega as camadas do mapa em segundo plano (mapacache.js),
  // pra o Mapa de Manutenção já abrir com tudo na memória da sessão.
  setTimeout(()=>{ if(typeof mapaCacheIniciar === "function") mapaCacheIniciar(); }, MAPA_CACHE_ATRASO_INICIAL_MS);
}
/* v2.13.0 - "Solicitar cadastro": a pessoa informa só o e-mail; o pedido
   aparece pro administrador em Usuários & Permissões (Aprovar / Recusar). */
function mostrarSolicitarCadastro(){
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("loginTitulo").classList.add("hidden");
  document.getElementById("loginErrorBox").innerHTML = "";
  document.getElementById("solicitarMsg").innerHTML = "";
  document.getElementById("solicitarForm").classList.remove("hidden");
  const em = document.getElementById("loginEmail").value.trim();
  if(em) document.getElementById("solicitarEmail").value = em;
  document.getElementById("solicitarEmail").focus();
}
function voltarParaLogin(){
  document.getElementById("solicitarForm").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("loginTitulo").classList.remove("hidden");
}
async function onSolicitarCadastro(event){
  event.preventDefault();
  const email = document.getElementById("solicitarEmail").value.trim();
  const nome = document.getElementById("solicitarNome").value.trim();
  const senha = document.getElementById("solicitarSenha").value;
  const senha2 = document.getElementById("solicitarSenha2").value;
  const msg = document.getElementById("solicitarMsg");
  const btn = document.getElementById("solicitarBtn");
  if(!API_ONLINE){
    msg.innerHTML = `<div class="login-error">${ic("info")}<div>Controller offline — abra o sistema pelo iniciar.bat para enviar o pedido.</div></div>`;
    return false;
  }
  // v3.16.1 - a propria pessoa escolhe a senha no pedido (o admin so aprova)
  if(senha.length < 8){ msg.innerHTML = `<div class="login-error">${ic("info")}<div>A senha precisa ter pelo menos 8 caracteres.</div></div>`; return false; }
  if(senha !== senha2){ msg.innerHTML = `<div class="login-error">${ic("info")}<div>As duas senhas não conferem.</div></div>`; return false; }
  btn.disabled = true;
  try{
    const r = await apiPost("/usuarios/solicitar-cadastro", { email, nome, senha });
    msg.innerHTML = `<div class="login-ok">${ic("check")}<div>${escapeHtml((r && r.mensagem) || "Pedido enviado.")}</div></div>`;
    ["solicitarEmail","solicitarNome","solicitarSenha","solicitarSenha2"].forEach(i => { document.getElementById(i).value = ""; });
  }catch(err){
    let t = err.message; const m = t.match(/\(([^)]+)\)\s*$/); if(m) t = m[1];
    msg.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(t)}</div></div>`;
  }finally{
    btn.disabled = false;
  }
  return false;
}

async function onLoginSubmit(event){
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const btn = document.getElementById("loginBtn");
  const erroEl = document.getElementById("loginErrorBox");
  erroEl.innerHTML = "";
  btn.disabled = true;
  loginProgresso("Validando login…");
  let logadoComSucesso = false;
  try{
    await fazerLogin(email, senha);
    logadoComSucesso = true; // login (senha/status da conta) já passou daqui pra baixo
    loginProgresso("Carregando dados…");
    await loadStateFromApi();
    loginProgresso("Montando a tela…");
    await new Promise(r=>setTimeout(r,30));
    mostrarApp();
  }catch(err){
    // Se o login em si deu certo (senha correta, conta ativa) mas algo
    // falhou DEPOIS disso ao montar a tela (ex.: um módulo de acesso
    // restrito devolvendo 403 — ver apiGetOuVazio em api.js pros casos já
    // tratados), o problema não é a credencial — mostrar "Não consegui
    // entrar" nesse caso confundiria quem tá testando login achando que
    // errou a senha.
    let msg = logadoComSucesso
      ? "Login ok, mas não consegui carregar o sistema — tente de novo."
      : "Não consegui entrar — tente de novo.";
    const m = err.message.match(/\(([^)]+)\)\s*$/);
    if(m) msg = m[1];
    erroEl.innerHTML = `<div class="login-error">${ic("info")}<div>${escapeHtml(msg)}</div></div>`;
  }finally{
    btn.disabled = false;
    loginProgresso(null);
  }
  return false;
}
function loginProgresso(txt){
  const box = document.getElementById("loginProgress"), t = document.getElementById("loginProgressTxt");
  if(!box) return;
  if(txt){ if(t) t.textContent = txt; box.classList.remove("hidden"); } else box.classList.add("hidden");
}

/* =========================================================================
   VIEW: Alertas  (v2.14.0)  — OS Próximas / Outliers / Recurso ZERO / Configurações
   Os alertas são calculados aqui no navegador sobre as OS já carregadas;
   parâmetros (Configurações) e tratamento ficam no Controller
   (/api/alertas/config e /api/alertas/tratados).
   ========================================================================= */
const ALERTAS_STATUS = ["Pendente","A reprogramar","Programada","Despachada","Executada","Cancelada"];
const ALERTAS_PADRAO = {
  proximas: {
    janelaDias: 30,                       // executadas nos últimos N dias
    raioM: 50,                            // distância máxima entre as duas OS (metros)
    mesmoRecurso: true,                   // poda só com poda, estrutura só com estrutura, faixa só com faixa
    incluirAproximadas: false,            // OS sem coordenada (posição aproximada) fora por padrão
    ignorarOsPrimaria: true,              // executada que é "filha" da pendente é o fluxo normal
    statusPendentes: ["Pendente","A reprogramar","Programada","Despachada"],
    statusExecutadas: ["Executada"]
  },
  outliers: {
    limite: { poda:100, faixa:1000, estrutura:100 },   // poda/estrutura em unidades, faixa no número da OS (m²)
    aplicarPrevisto: true, aplicarRealizado: true,
    status: ["Pendente","A reprogramar","Programada","Despachada","Executada"]
  },
  zero: {
    semMO: true,                          // OS sem nenhuma linha de mão de obra
    qtdZero: true,                        // OS com MO, mas quantidade total zero
    exigirEsquema: true,                  // só se a descrição do esquema indicar poda
    palavrasEsquema: "PODA",              // separadas por vírgula
    status: ["Pendente","A reprogramar","Programada","Despachada","Executada"]
  }
};
let alertasConfig = JSON.parse(JSON.stringify(ALERTAS_PADRAO));
let alertasConfigInfo = null;             // { atualizadoEm, atualizadoPor } ou null
let alertasTratados = {};                 // "tipo|chave" -> { status, por, em }
let alertasAba = "proximas";
let alertasBusca = "";
let alertasVerTratados = false;
let alertasOrdem = {};                    // aba -> { campo, dir }
let alertasPagina = {};                   // aba -> n
let alertasCache = {};                    // aba -> { os, cfg, linhas }
const ALERTAS_POR_PAGINA = 100;

function alertasMesclarConfig(salvo){
  const base = JSON.parse(JSON.stringify(ALERTAS_PADRAO));
  if(!salvo) return base;
  ["proximas","outliers","zero"].forEach(g=>{
    if(salvo[g] && typeof salvo[g]==="object"){
      Object.keys(base[g]).forEach(k=>{
        if(salvo[g][k]===undefined || salvo[g][k]===null) return;
        if(k==="limite" && typeof salvo[g][k]==="object") base[g][k] = { ...base[g][k], ...salvo[g][k] };
        else base[g][k] = salvo[g][k];
      });
    }
  });
  return base;
}
async function alertasCarregar(){
  if(API_ONLINE){
    try{
      const r = await apiGet("/alertas/config");
      alertasConfig = alertasMesclarConfig(r && r.valores);
      alertasConfigInfo = r && r.valores ? { atualizadoEm:r.atualizadoEm, atualizadoPor:r.atualizadoPor } : null;
    }catch(e){ /* usa o padrão */ }
    try{
      const t = await apiGet("/alertas/tratados");
      alertasTratados = {};
      (t||[]).forEach(x=>{ alertasTratados[`${x.tipo}|${x.chave}`] = x; });
    }catch(e){ /* sem tratamentos */ }
  }
  alertasCache = {};
  const w = document.getElementById("alertasConteudo"); if(w) w.innerHTML = alertasConteudoHtml();
  // v3.12.0 - o índice de APP/RL é grande: chega depois e redesenha só se a aba estiver aberta
  aprlGarantir().then(ok=>{ if(ok && document.getElementById("alertasConteudo")) alertasRedesenhar(); });
}

/* ---------- cálculo ---------- */
function alertasGeoOk(o, incluirAprox){
  if(o.lat==null || o.lng==null || isNaN(o.lat) || isNaN(o.lng)) return false;
  return incluirAprox || !o.aprox;
}
function alertasCategorias(o){
  const s = new Set();
  TIPOS_SERVICO.forEach(([t])=>{ if(qtdTipoOS(o,t,"prev")>0 || qtdTipoOS(o,t,"real")>0) s.add(t); });
  if(!s.size) s.add(categoriaServicoOS(o));
  return s;
}
function alertasCalcProximas(cfg){
  const hoje = prefHojeIso(), de = prefSomaDias(hoje, -Math.max(0, Number(cfg.janelaDias)||0));
  const raio = Math.max(1, Number(cfg.raioM)||50);
  const stP = new Set(cfg.statusPendentes), stE = new Set(cfg.statusExecutadas);
  const execs = [], pends = [];
  state.manutencaoOS.forEach(o=>{
    if(!alertasGeoOk(o, cfg.incluirAproximadas)) return;
    if(stE.has(o.statusOS)){
      const d = o.dataExecucao ? String(o.dataExecucao).slice(0,10) : "";
      if(d && d>=de && d<=hoje) execs.push(o);
    }
    if(stP.has(o.statusOS) && !stE.has(o.statusOS)) pends.push(o);
  });
  if(!execs.length || !pends.length) return [];
  const lat0 = execs.reduce((a,o)=>a+o.lat,0)/execs.length;
  const ky = 111320, kx = 111320*Math.cos(lat0*Math.PI/180);
  const xy = o => [o.lng*kx, o.lat*ky];
  const grade = new Map();
  execs.forEach(o=>{ const [x,y] = xy(o); const k = Math.floor(x/raio)+","+Math.floor(y/raio); (grade.get(k) || grade.set(k,[]).get(k)).push(o); });
  const hojeMs = new Date(hoje+"T12:00:00").getTime();
  const catsCache = new Map();
  const cats = o => catsCache.get(o) || (catsCache.set(o, alertasCategorias(o)), catsCache.get(o));
  const linhas = [];
  pends.forEach(p=>{
    const [px,py] = xy(p), cx = Math.floor(px/raio), cy = Math.floor(py/raio);
    const viz = [];
    for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++){
      const cel = grade.get((cx+dx)+","+(cy+dy)); if(!cel) continue;
      cel.forEach(e=>{
        if(e.id===p.id) return;
        const [ex,ey] = xy(e), dist = Math.hypot(ex-px, ey-py);
        if(dist>raio) return;
        if(cfg.ignorarOsPrimaria && (e.osPrimaria===p.id || p.osPrimaria===e.id || (e.osPrimaria && e.osPrimaria===p.osPrimaria))) return;
        if(cfg.mesmoRecurso){ const cp = cats(p), ce = cats(e); let ok = false; cp.forEach(c=>{ if(ce.has(c)) ok = true; }); if(!ok) return; }
        const dias = Math.round((hojeMs - new Date(String(e.dataExecucao).slice(0,10)+"T12:00:00").getTime())/86400000);
        viz.push({ o:e, dist:Math.round(dist), dias });
      });
    }
    if(viz.length){
      viz.sort((a,b)=>a.dist-b.dist);
      linhas.push({ chave:p.id, os:p, viz, minDist:viz[0].dist, nViz:viz.length, ultimaExec:viz.map(v=>String(v.o.dataExecucao).slice(0,10)).sort().pop() });
    }
  });
  return linhas;
}
function alertasCalcOutliers(cfg){
  const st = new Set(cfg.status), linhas = [];
  state.manutencaoOS.forEach(o=>{
    if(!st.has(o.statusOS)) return;
    TIPOS_SERVICO.forEach(([t,nome])=>{
      const lim = Number(cfg.limite[t]); if(!(lim>0)) return;
      const prev = qtdTipoOS(o,t,"prev"), real = qtdTipoOS(o,t,"real");
      const pPrev = cfg.aplicarPrevisto && prev>lim, pReal = cfg.aplicarRealizado && real>lim;
      if(!pPrev && !pReal) return;
      linhas.push({ chave:`${o.id}|${t}`, os:o, tipo:t, tipoNome:nome, prev, real, limite:lim, excede: pPrev&&pReal ? "Previsto e realizado" : (pPrev ? "Previsto" : "Realizado"), maior:Math.max(pPrev?prev:0, pReal?real:0) });
    });
  });
  return linhas;
}
function alertasNormTxt(s){ return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase(); }
function alertasCalcZero(cfg){
  const st = new Set(cfg.status);
  const palavras = String(cfg.palavrasEsquema||"").split(",").map(x=>alertasNormTxt(x).trim()).filter(Boolean);
  const linhas = [];
  state.manutencaoOS.forEach(o=>{
    if(!st.has(o.statusOS)) return;
    let total = 0; TIPOS_SERVICO.forEach(([t])=>{ total += qtdTipoOS(o,t,"prev") + qtdTipoOS(o,t,"real"); });
    if(total>0) return;
    const semMO = !o.tipoServico || o.tipoServico==="—";
    if(semMO && !cfg.semMO) return;
    if(!semMO && !cfg.qtdZero) return;
    const esq = o.descEsquema || o.observacao || "";   // v3.10.5: cargas antigas ainda traziam a descrição do esquema em "observacao"
    if(cfg.exigirEsquema){
      const n = alertasNormTxt(esq);
      if(!n || (palavras.length && !palavras.some(p=>n.includes(p)))) return;
    }
    linhas.push({ chave:o.id, os:o, motivo: semMO ? "Sem MO" : "MO com quantidade zero", esquema:esq });
  });
  return linhas;
}
function alertasLinhas(aba){
  if(aba==="apprl") return aprlLinhas();   // v3.12.0
  const cfg = alertasConfig[aba==="proximas" ? "proximas" : aba==="outliers" ? "outliers" : "zero"];
  const sig = JSON.stringify(cfg);
  const c = alertasCache[aba];
  if(c && c.os===state.manutencaoOS && c.sig===sig) return c.linhas;
  const linhas = aba==="proximas" ? alertasCalcProximas(cfg) : aba==="outliers" ? alertasCalcOutliers(cfg) : alertasCalcZero(cfg);
  alertasCache[aba] = { os:state.manutencaoOS, sig, linhas };
  return linhas;
}

/* ---------- tabelas ---------- */
function alertasColunas(aba){
  const id = r=>r.os.id;
  if(aba==="apprl") return aprlColunasAlerta();
  if(aba==="proximas") return [
    ["os","OS pendente",r=>r.os.id], ["status","Status",r=>r.os.statusOS], ["origem","Origem",r=>r.os.origem], ["servico","Serviço",r=>r.os.tipoServico],
    ["alim","Alimentador",r=>r.os.alimentador], ["loc","Localidade",r=>cidadeDaOS(r.os)],
    ["n","Executadas próximas",r=>r.nViz], ["dist","Mais próxima (m)",r=>r.minDist], ["ult","Última execução",r=>r.ultimaExec]
  ];
  if(aba==="outliers") return [
    ["os","OS",id], ["status","Status",r=>r.os.statusOS], ["origem","Origem",r=>r.os.origem], ["tipo","Tipo",r=>r.tipoNome],
    ["prev","Previsto",r=>r.prev], ["real","Realizado",r=>r.real], ["exc","Excede em",r=>r.excede],
    ["equipe","Equipe",r=>r.os.equipeId||""], ["alim","Alimentador",r=>r.os.alimentador], ["loc","Localidade",r=>cidadeDaOS(r.os)]
  ];
  return [
    ["os","OS",id], ["status","Status",r=>r.os.statusOS], ["origem","Origem",r=>r.os.origem], ["motivo","Motivo",r=>r.motivo],
    ["esq","Esquema",r=>r.esquema], ["alim","Alimentador",r=>r.os.alimentador], ["loc","Localidade",r=>cidadeDaOS(r.os)], ["ab","Abertura",r=>r.os.dataAbertura||""]
  ];
}
function alertasCelula(aba, campo, r){
  const o = r.os;
  if(campo==="os") return `<span class="mono">${escapeHtml(o.id)}</span>`;
  if(campo==="status") return statusPill(o.statusOS);
  if(aba==="apprl" && campo==="situacao") return aprlSituacaoHtml(r.cl);
  if(aba==="proximas" && campo==="n"){
    const lista = r.viz.slice(0,3).map(v=>`<div style="font-size:11.5px; white-space:nowrap;"><span class="mono">${escapeHtml(v.o.id)}</span> · ${escapeHtml(v.o.origem)} · ${v.dist} m · ${fmtDate(v.o.dataExecucao)} (${v.dias} d)${v.o.equipeId?` · ${escapeHtml(v.o.equipeId)}`:""}</div>`).join("");
    return `<strong>${r.nViz}</strong>${lista}${r.nViz>3?`<div style="font-size:11px; color:var(--muted);">+ ${r.nViz-3} outra(s)</div>`:""}`;
  }
  if(aba==="proximas" && campo==="ult") return fmtDate(r.ultimaExec);
  if(aba==="outliers" && (campo==="prev"||campo==="real"||campo==="lim")) return `<span class="num">${Number(campo==="prev"?r.prev:campo==="real"?r.real:r.limite).toLocaleString("pt-BR")}</span>`;
  if(campo==="ab") return o.dataAbertura ? fmtDate(o.dataAbertura) : "—";
  const col = alertasColunas(aba).find(c=>c[0]===campo);
  const v = col ? col[2](r) : "";
  return escapeHtml(v===""||v==null ? "—" : v);
}
function alertasFiltrar(aba, linhas){
  const q = alertasNormTxt(alertasBusca).trim();
  return linhas.filter(r=>{
    if(q){
      const o = r.os;
      const txt = alertasNormTxt([o.id,o.alimentador,cidadeDaOS(o),o.protecaoId,o.equipeId,r.esquema,...(r.viz?r.viz.map(v=>v.o.id):[])].join(" "));
      if(!txt.includes(q)) return false;
    }
    return true;
  });
}
function alertasOrdenar(aba, campo){
  const o = alertasOrdem[aba];
  alertasOrdem[aba] = (o && o.campo===campo) ? (o.dir===1 ? { campo, dir:-1 } : null) : { campo, dir:1 };
  alertasPagina[aba] = 1;
  alertasRedesenhar();
}
function alertasPag(d){ alertasPagina[alertasAba] = Math.max(1,(alertasPagina[alertasAba]||1)+d); alertasRedesenhar(); }
function alertasSetBusca(v){ alertasBusca = v; alertasPagina = {}; alertasRedesenharTabela(); }
function alertasSetVerTratados(v){ alertasVerTratados = v; alertasPagina = {}; alertasRedesenhar(); }
function alertasRedesenhar(){ const w = document.getElementById("alertasConteudo"); if(w) w.innerHTML = alertasConteudoHtml(); const c = document.getElementById("cfgAlertasWrap"); if(c) c.innerHTML = alertasConfigHtml(); }
function alertasRedesenharTabela(){ const w = document.getElementById("alertasTabelaWrap"); if(w) w.innerHTML = alertasTabelaHtml(alertasAba); else alertasRedesenhar(); }
function alertasTrocarAba(aba){ alertasAba = aba; alertasRedesenhar(); }

function alertasTabelaHtml(aba){
  const todas = alertasLinhas(aba);
  let linhas = alertasFiltrar(aba, todas);
  const cols = alertasColunas(aba);
  const ord = alertasOrdem[aba];
  if(ord){ const col = cols.find(c=>c[0]===ord.campo); if(col) linhas = ordenarPorTexto(linhas, col[2], ord.dir); }
  else if(aba==="proximas") linhas = linhas.slice().sort((a,b)=>a.minDist-b.minDist);
  else if(aba==="outliers") linhas = linhas.slice().sort((a,b)=>b.maior-a.maior);
  else if(aba==="apprl") linhas = linhas.slice().sort(aprlComparar);
  const totalPag = Math.max(1, Math.ceil(linhas.length/ALERTAS_POR_PAGINA));
  const pag = Math.min(alertasPagina[aba]||1, totalPag); alertasPagina[aba] = pag;
  const pagina = linhas.slice((pag-1)*ALERTAS_POR_PAGINA, pag*ALERTAS_POR_PAGINA);
  const podeTratar = minhaPermissao("manutencao","editar");
  const trat = r => alertasTratados[`${aba}|${r.chave}`];
  const usaTrat = false;   // v3.4.4 - coluna Tratamento removida a pedido
  return `
    <p style="color:var(--muted); font-size:12px; margin:0 0 8px;">${linhas.length.toLocaleString("pt-BR")} alerta(s)${alertasBusca?` para a busca`:""}${(usaTrat && !alertasVerTratados && todas.some(r=>{const t=trat(r); return t && t.status!=="Em análise";})) ? " · tratados ocultos" : ""}.</p>
    <div class="table-wrap"><table data-sort-manual>
      <thead><tr>${cols.map(([c,r])=>ordenarHeadHtml(true,r,c,ord,"alertasOrdenarAba")).join("")}${usaTrat?"<th>Tratamento</th>":""}<th></th></tr></thead>
      <tbody>
        ${pagina.length===0 ? `<tr><td colspan="${cols.length+(usaTrat?2:1)}"><div class="empty">${ic("empty")}<div>Nenhum alerta com os parâmetros atuais.</div></div></td></tr>` : pagina.map(r=>{
          const t = trat(r);
          const ids = aba==="proximas" ? [r.os.id, ...r.viz.map(v=>v.o.id)] : [r.os.id];
          return `<tr>${cols.map(([c])=>`<td>${alertasCelula(aba,c,r)}</td>`).join("")}
            ${!usaTrat ? "" : `<td style="white-space:nowrap;">${podeTratar ? `<select onchange="alertasTratar('${aba}', ${escapeHtml(JSON.stringify(r.chave))}, this.value)" style="min-width:120px;">
                ${["","Em análise","Resolvido","Falso positivo"].map(s=>`<option value="${s}" ${(t?t.status:"")===s?"selected":""}>${s||"— não tratado"}</option>`).join("")}</select>`
              : escapeHtml(t?t.status:"—")}${t?`<div style="font-size:10.5px; color:var(--muted);">${escapeHtml(t.por||"")}</div>`:""}</td>`}
            <td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick='alertasVerNoMapa(${escapeHtml(JSON.stringify(ids))})' title="Ver no mapa">Mapa</button></td></tr>`; }).join("")}
      </tbody>
    </table></div>
    ${linhas.length>ALERTAS_POR_PAGINA ? `<div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:8px; font-size:12px; color:var(--muted);">
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="alertasPag(-1)" ${pag<=1?"disabled":""}>‹</button> Página ${pag} de ${totalPag}
      <button class="btn btn-ghost" style="padding:5px 9px;" onclick="alertasPag(1)" ${pag>=totalPag?"disabled":""}>›</button></div>` : ""}`;
}
function alertasOrdenarAba(campo){ alertasOrdenar(alertasAba, campo); }
async function alertasTratar(aba, chave, status){
  try{
    if(API_ONLINE) await apiSend("PUT", "/alertas/tratados", { tipo:aba, chave, status });
    const k = `${aba}|${chave}`;
    if(status) alertasTratados[k] = { tipo:aba, chave, status, por:(currentUser&&currentUser.nome)||"", em:new Date().toISOString() }; else delete alertasTratados[k];
    alertasRedesenhar();
  }catch(err){ toast(`Erro ao salvar o tratamento: ${err.message}`); }
}
function alertasVerNoMapa(ids){
  osSelecaoAreaIds = new Set(ids);
  tabelaOsPagina = 1;
  goTo("manutencao");
}
function alertasExportar(){
  if(typeof XLSX==="undefined"){ toast("Biblioteca de planilha (XLSX) não carregada."); return; }
  const aba = alertasAba;
  const cols = alertasColunas(aba);
  const linhas = alertasFiltrar(aba, alertasLinhas(aba));
  if(!linhas.length){ toast("Nada para exportar."); return; }
  const dados = linhas.map(r=>{
    const l = {};
    cols.forEach(([c,rot,get])=>{ l[rot] = get(r); });
    if(aba==="proximas") l["Executadas próximas (detalhe)"] = r.viz.map(v=>`${v.o.id} (${v.o.origem}, ${v.dist} m, ${fmtDate(v.o.dataExecucao)}${v.o.equipeId?`, ${v.o.equipeId}`:""})`).join("; ");
    return l;
  });
  const ws = XLSX.utils.json_to_sheet(dados), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alertas");
  XLSX.writeFile(wb, `alertas_${aba}_${prefHojeIso()}.xlsx`);
}

/* ---------- páginas ---------- */
function alertasDescricao(aba){
  if(aba==="apprl") return aprlDescricaoAlerta();   // v3.12.0
  const c = alertasConfig;
  if(aba==="proximas") return `OS pendentes/programadas com uma OS <strong>executada</strong> nos últimos <strong>${c.proximas.janelaDias} dias</strong> a até <strong>${c.proximas.raioM} m</strong>${c.proximas.mesmoRecurso?", do mesmo recurso (poda só com poda, estrutura só com estrutura)":""}. Pode ser serviço de emergência feito no lugar da OS programada — confira antes de despachar ou baixar.`;
  if(aba==="outliers") return `OS com quantidade acima do limite: poda &gt; <strong>${c.outliers.limite.poda}</strong>, limpeza de faixa &gt; <strong>${c.outliers.limite.faixa}</strong>, estrutura &gt; <strong>${c.outliers.limite.estrutura}</strong> (${[c.outliers.aplicarPrevisto?"previsto":null,c.outliers.aplicarRealizado?"realizado":null].filter(Boolean).join(" e ")}).`;
  return `OS com esquema de poda${c.zero.exigirEsquema?` (descrição do esquema com: ${escapeHtml(c.zero.palavrasEsquema)})`:""} e <strong>recurso zero</strong>: ${[c.zero.semMO?"sem nenhuma linha de MO":null,c.zero.qtdZero?"com MO de quantidade zero":null].filter(Boolean).join(" ou ")}.`;
}
function alertasStatsHtml(){
  const por = {};
  TIPOS_SERVICO.forEach(([t])=>{ por[t] = []; });
  state.manutencaoOS.forEach(o=>{ if(o.statusOS==="Cancelada") return; TIPOS_SERVICO.forEach(([t])=>{ const v = Math.max(qtdTipoOS(o,t,"prev"), qtdTipoOS(o,t,"real")); if(v>0) por[t].push(v); }); });
  const pct = (a,p)=>{ if(!a.length) return "—"; const s = a.slice().sort((x,y)=>x-y); return Math.round(s[Math.min(s.length-1, Math.floor(p*s.length))]).toLocaleString("pt-BR"); };
  return `<table style="font-size:12px;"><thead><tr><th>Tipo</th><th>OS com quantidade</th><th>Mediana</th><th>P90</th><th>P99</th><th>Máximo</th></tr></thead><tbody>${
    TIPOS_SERVICO.map(([t,n])=>`<tr><td>${n}</td><td class="num">${por[t].length.toLocaleString("pt-BR")}</td><td class="num">${pct(por[t],.5)}</td><td class="num">${pct(por[t],.9)}</td><td class="num">${pct(por[t],.99)}</td><td class="num">${por[t].length?Math.round(Math.max(...por[t])).toLocaleString("pt-BR"):"—"}</td></tr>`).join("")}</tbody></table>`;
}
function alertasConfigHtml(){
  const c = alertasConfig, pode = minhaPermissao("manutencao","editar"), dis = pode ? "" : "disabled";
  const chk = (id,v,rot)=>`<label class="check-row" style="margin:0;"><input type="checkbox" id="${id}" ${v?"checked":""} ${dis}> ${rot}</label>`;
  const sts = (pref, sel)=>`<div style="display:flex; gap:12px; flex-wrap:wrap;">${ALERTAS_STATUS.map(s=>`<label class="check-row" style="margin:0;"><input type="checkbox" class="${pref}" value="${s}" ${sel.includes(s)?"checked":""} ${dis}> ${s}</label>`).join("")}</div>`;
  const num = (id,v,rot,ajuda)=>`<div class="field"><label>${rot}</label><input type="number" min="0" step="any" id="${id}" value="${v}" ${dis} style="max-width:160px;">${ajuda?`<p style="color:var(--muted); font-size:11px; margin:3px 0 0;">${ajuda}</p>`:""}</div>`;
  return `
    <div class="card" style="margin-bottom:14px;">
      <h3>OS Próximas</h3>
      <div style="display:flex; gap:18px; flex-wrap:wrap;">
        ${num("alCfgJanela", c.proximas.janelaDias, "Executadas nos últimos (dias)")}
        ${num("alCfgRaio", c.proximas.raioM, "Raio de proximidade (metros)", "Postes ficam a ~40 m um do outro.")}
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; margin:6px 0;">
        ${chk("alCfgMesmo", c.proximas.mesmoRecurso, "Comparar só o mesmo recurso (poda com poda, estrutura com estrutura, limpeza de faixa com limpeza de faixa)")}
        ${chk("alCfgAprox", c.proximas.incluirAproximadas, "Incluir OS sem coordenada (posição aproximada) — pode gerar alertas falsos")}
        ${chk("alCfgPrimaria", c.proximas.ignorarOsPrimaria, "Ignorar quando a executada é filha da pendente (OS Primária) — é o fluxo normal")}
      </div>
      <div style="font-size:12.5px; font-weight:600; margin:8px 0 4px;">Status considerados como "pendente"</div>${sts("alCfgStP", c.proximas.statusPendentes)}
      <div style="font-size:12.5px; font-weight:600; margin:8px 0 4px;">Status considerados como "executada"</div>${sts("alCfgStE", c.proximas.statusExecutadas)}
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Outliers</h3>
      <div style="display:flex; gap:18px; flex-wrap:wrap;">
        ${num("alCfgLimPoda", c.outliers.limite.poda, "Poda — acima de (unidades)")}
        ${num("alCfgLimFaixa", c.outliers.limite.faixa, "Limpeza de faixa — acima de", "Vale o número que está na OS.")}
        ${num("alCfgLimEstr", c.outliers.limite.estrutura, "Estrutura — acima de (unidades)")}
      </div>
      <div style="display:flex; gap:18px; flex-wrap:wrap; margin:6px 0;">${chk("alCfgPrev", c.outliers.aplicarPrevisto, "Conferir o previsto")}${chk("alCfgReal", c.outliers.aplicarRealizado, "Conferir o realizado")}</div>
      <div style="font-size:12.5px; font-weight:600; margin:8px 0 4px;">Status considerados</div>${sts("alCfgStO", c.outliers.status)}
      <details style="margin-top:10px;"><summary style="cursor:pointer; font-size:12.5px;">Como estão as quantidades hoje? (ajuda a escolher o limite)</summary><div style="margin-top:6px;">${alertasStatsHtml()}</div></details>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Recurso ZERO</h3>
      <div style="display:flex; flex-direction:column; gap:4px; margin:6px 0;">
        ${chk("alCfgSemMO", c.zero.semMO, "Alertar OS sem nenhuma linha de MO (sem recurso)")}
        ${chk("alCfgQtdZero", c.zero.qtdZero, "Alertar OS com MO, mas quantidade total zero")}
        ${chk("alCfgEsq", c.zero.exigirEsquema, "Só se a descrição do esquema (DescEsquema) indicar poda")}
      </div>
      <div class="field"><label>Palavras que indicam esquema de poda (separadas por vírgula)</label><input type="text" id="alCfgPalavras" value="${escapeHtml(c.zero.palavrasEsquema)}" ${dis} style="max-width:420px;"></div>
      <div style="font-size:12.5px; font-weight:600; margin:8px 0 4px;">Status considerados</div>${sts("alCfgStZ", c.zero.status)}
    </div>
    ${pode ? `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="alertasSalvarConfig()">${ic("check")} Salvar parâmetros</button>
      <button class="btn btn-ghost" onclick="alertasRestaurarConfig()">Restaurar padrão</button>
      ${alertasConfigInfo ? `<span style="color:var(--muted); font-size:11.5px;">Última alteração: ${escapeHtml(alertasConfigInfo.atualizadoPor||"")} em ${alertasConfigInfo.atualizadoEm?fmtDateTime(alertasConfigInfo.atualizadoEm):""}</span>` : ""}
    </div>` : `<p style="color:var(--muted); font-size:12px;">Você pode ver os parâmetros, mas não alterá-los.</p>`}`;
}
function alertasLerConfigDaTela(){
  const g = id => document.getElementById(id);
  const sel = cls => Array.from(document.querySelectorAll("."+cls)).filter(i=>i.checked).map(i=>i.value);
  const n = (id, pad) => { const v = Number(g(id).value); return (isNaN(v) || v<0) ? pad : v; };
  return {
    proximas: { janelaDias:n("alCfgJanela",30), raioM:Math.max(1,n("alCfgRaio",50)), mesmoRecurso:g("alCfgMesmo").checked, incluirAproximadas:g("alCfgAprox").checked, ignorarOsPrimaria:g("alCfgPrimaria").checked, statusPendentes:sel("alCfgStP"), statusExecutadas:sel("alCfgStE") },
    outliers: { limite:{ poda:n("alCfgLimPoda",100), faixa:n("alCfgLimFaixa",1000), estrutura:n("alCfgLimEstr",100) }, aplicarPrevisto:g("alCfgPrev").checked, aplicarRealizado:g("alCfgReal").checked, status:sel("alCfgStO") },
    zero: { semMO:g("alCfgSemMO").checked, qtdZero:g("alCfgQtdZero").checked, exigirEsquema:g("alCfgEsq").checked, palavrasEsquema:g("alCfgPalavras").value.trim(), status:sel("alCfgStZ") }
  };
}
async function alertasSalvarConfig(){
  const nova = alertasLerConfigDaTela();
  if(!nova.proximas.statusPendentes.length || !nova.proximas.statusExecutadas.length){ toast("Em OS Próximas, marque ao menos um status de pendente e um de executada."); return; }
  if(!nova.outliers.aplicarPrevisto && !nova.outliers.aplicarRealizado){ toast("Em Outliers, confira o previsto, o realizado ou os dois."); return; }
  try{
    if(API_ONLINE){ const r = await apiSend("PUT", "/alertas/config", nova); alertasConfigInfo = { atualizadoEm:r.atualizadoEm, atualizadoPor:r.atualizadoPor }; }
    alertasConfig = alertasMesclarConfig(nova); alertasCache = {};
    toast("Parâmetros salvos."); alertasRedesenhar();
  }catch(err){ toast(`Erro ao salvar: ${err.message}`); }
}
async function alertasRestaurarConfig(){
  if(!window.confirm("Voltar todos os parâmetros dos alertas para o padrão?")) return;
  try{
    if(API_ONLINE) await apiDelete("/alertas/config");
    alertasConfig = JSON.parse(JSON.stringify(ALERTAS_PADRAO)); alertasConfigInfo = null; alertasCache = {};
    toast("Parâmetros restaurados."); alertasRedesenhar();
  }catch(err){ toast(`Erro: ${err.message}`); }
}
function alertasConteudoHtml(){
  const abas = [["proximas","OS Próximas"],["outliers","Outliers"],["zero","Recurso ZERO"],["apprl","APP / RL"]];
  const contar = a => { try{ return alertasFiltrar(a, alertasLinhas(a)).length; }catch(e){ return null; } };
  let corpo;
  if(alertasAba==="config") alertasAba = "proximas";   // v3.10.0: parâmetros foram para o menu Configuração
  corpo = `
    <p style="color:var(--muted); font-size:12.5px; margin:0 0 10px;">${alertasDescricao(alertasAba)}</p>
    ${alertasAba==="apprl" ? aprlFiltrosHtml() + aprlResumoAlertaHtml() + aprlAvisoIndiceHtml() : ""}
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
      <input placeholder="Buscar OS, alimentador, localidade…" value="${escapeHtml(alertasBusca)}" oninput="alertasSetBusca(this.value)" style="min-width:260px;">
      <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="alertasExportar()">${ic("download")} Exportar (.xlsx)</button>
    </div>
    <div id="alertasTabelaWrap">${alertasTabelaHtml(alertasAba)}</div>`;
  return `
    <div class="tabs" style="margin-bottom:14px; flex-wrap:wrap;">
      ${abas.map(([k,r])=>{ const n = k==="config" ? null : contar(k); return `<button class="tab ${alertasAba===k?"active":""}" onclick="alertasTrocarAba('${k}')">${r}${n!=null?` <span class="pill ${n?"warn":""}" style="margin-left:4px;">${n.toLocaleString("pt-BR")}</span>`:""}</button>`; }).join("")}
    </div>${corpo}`;
}
/* ---------------- v3.10.0 - menu CONFIGURAÇÃO ---------------- */
let cfgAba = "alertas";
function cfgAbas(){
  return [
    ["alertas","Alertas", minhaPermissao("alertas","visualizar")],
    ["nix","Pontos Nix", minhaPermissao("nix","importar")],
    ["aprl","APP / RL", minhaPermissao("manutencao","visualizar")],
    ["usuarios","Usuários & Permissões", minhaPermissao("usuarios","editar")],
  ].filter(x=>x[2]);
}
function viewConfiguracao(){
  const abas = cfgAbas();
  if(!abas.some(x=>x[0]===cfgAba) && abas.length) cfgAba = abas[0][0];
  let corpo = "";
  if(cfgAba==="alertas") corpo = `<div id="cfgAlertasWrap">${alertasConfigHtml()}</div>`;
  else if(cfgAba==="nix") corpo = nixConfigConteudoHtml();
  else if(cfgAba==="aprl") corpo = `<div id="cfgAprlWrap">${aprlConfigHtml()}</div>`;
  else if(cfgAba==="usuarios") corpo = viewUsuarios();
  return `<div class="tabs" style="margin-bottom:14px; flex-wrap:wrap;">${abas.map(([k,r])=>`<button class="tab ${cfgAba===k?"active":""}" onclick="cfgTrocarAba('${k}')">${r}</button>`).join("")}</div>${corpo}`;
}
function cfgTrocarAba(k){ cfgAba = k; render(); }
async function cfgDepoisDeRenderizar(){
  if(cfgAba==="alertas"){ await alertasCarregar(); const c = document.getElementById("cfgAlertasWrap"); if(c) c.innerHTML = alertasConfigHtml(); }
  else if(cfgAba==="nix"){ nixAbrirPeloMenu(); }
  else if(cfgAba==="aprl"){ await aprlConfigDepoisDeRenderizar(); }
}

function viewAlertas(){
  return `<div class="card"><div id="alertasConteudo">${alertasConteudoHtml()}</div></div>`;
}


/* ---------------- registro de views ---------------- */
const VIEWS = {
  geral: viewGeral,
  manutencao: viewManutencao,
  produtividade: viewProdutividade,
  alertas: viewAlertas,
  metas: viewMetas,
  programacao: viewProgramacao,
  prioridade: viewPrioridade,
  nix: viewNixPagina,
  historico: viewHistoricoPagina,
  prefeituras: viewPrefeituras,
  importacao: viewImportacao,
  cadastros: viewCadastros,
  usuarios: viewUsuarios,
  configuracao: viewConfiguracao,
};
const AFTER_RENDER = {
  geral: initVisaoGeral,
  manutencao: initMapaManutencao,
  programacao: initMapaLogisticaAdiado,
  cadastros: initCadastros,
  prefeituras: prefCarregarConfig,
  alertas: alertasCarregar,
  prioridade: rankAnInit,
  nix: nixPaginaInit,
  historico: historicoPaginaInit,
  configuracao: cfgDepoisDeRenderizar,
};

function openImportModal(base){ goTo("importacao"); setTimeout(()=>{ importSelecionada=base; render(); document.getElementById("importBaseSelect").value=base; }, 30); }

/* ---------------- boot ----------------
   bootApp() (definido em api.js) decide entre dados reais do Controller e
   os dados de exemplo abaixo, e só então chama renderNav()/render(). */
bootApp();
