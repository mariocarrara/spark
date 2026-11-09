# SPARK — contexto do projeto (leia antes de agir)

Responda ao Mario em portugues. Ele e gestor no Grupo Energisa, entende PHP/seguranca, nao e dev em tempo integral: explique curto, entregue pronto.

## O que e
Sistema de programacao de podas/manutencao, mapa (Leaflet), produtividade, alertas, Pontos Nix, APP/RL, historico por plano. Versao atual do legado: **v3.16.1**.

## Estado
- `legado-powershell/`: PowerShell 5.1 (HttpListener) com `controller/server.ps1`, `routes/*.ps1`, `lib/*.ps1`; dados em JSON em `model/` (`Read-JsonModel`/`Write-JsonModel`); front vanilla JS em `view/js` (app.js gigante). PowerShell NUNCA foi executado no ambiente do Claude: so revisado. Arquivos com BOM + LF.
- Decisao do Mario: migrar para **PHP 8.3 + Laravel 11 (MVC normal; decidido em 08/11/2026, antes era MVC simples sem framework) + PostgreSQL 16 + PostGIS**, hospedado no **Render** (Docker para PHP; Postgres gerenciado). Motivo: concorrencia de arquivos, limite de linhas, GIS.
- Estrategia (strangler): o PHP responde o MESMO contrato `/api/...` (ver `migracao/INVENTARIO_API.md`), front-end quase inalterado, modulo por modulo. Plano em `migracao/PLANO_MIGRACAO.md`.
- `migracao/schema.sql` (42 tabelas) e `migrar.php` (COPY; sentinela `@@NULO@@` para NULL; EWKT `SRID=4326;POINT(lng lat)`) ja testados com dados reais.

## Proximos passos
1. FEITO (08/11/2026) fundacao em `php/` (ver `php/README.md`): `/api/health`, `/api/auth/login|logout|me|trocar-senha` no contrato do legado; token Bearer (so SHA-256 na tabela `sessoes`, validade deslizante 12 h); senha legada (XOR+base64) vira `password_hash` no 1o login; bloqueio 5 falhas/e-mail ou 20/IP em 15 min; middlewares `perm:modulo,acao` e `admin`; auditoria sem senha; `php artisan spark:admin-semente`. Sem cookie, logo sem CSRF. Testes: `php artisan spark:banco-teste` (1a vez) + `php artisan test`, no Postgres `spark_test` com o schema.sql real (DatabaseTransactions). Composer travado em PHP 8.2.12 (`config.platform`) para rodar no XAMPP local e no 8.3. Testado em 09/11/2026 contra o Postgres do Docker (banco vazio + usuario temporario): login, me, logout, usuarios, solicitar-cadastro, permissoes OK. Falta: carregar dados reais (a pasta `legado-powershell/model/` deste PC esta vazia) e Dockerfile do Render.
   - Fuso: `APP_TIMEZONE=America/Sao_Paulo` (decidido 09/11/2026).
   - Banco local: Docker na porta **5433** (o Windows tem um PostgreSQL 18 nativo na 5432). Tabelas no schema **`spark`** (`DB_SEARCH_PATH=spark,public`).
2. FEITO (09/11/2026) usuarios/permissoes: `/api/usuarios` (lista, solicitar-cadastro publico com throttle, solicitacoes aprovar/recusar, liberar, bloquear, desbloquear, senha, DELETE) e `/api/permissoes/{id}` GET/PUT. Travas novas: nao-admin nao mexe em conta de admin, nao cria admin, nao altera a propria matriz; respostas sem senha; bloquear/redefinir derruba sessoes; perfis-modelo em `config/spark.php`. `alertas.visualizar` vira linha explicita (sem valor = segue manutencao.visualizar; `migrar.php` ajustado). v3.16.1 (09/11/2026, front + PS + Laravel): no "Solicitar cadastro" a pessoa informa nome e escolhe a propria senha (8-72); `solicitacoes` devolve `nome`/`temSenha`; aprovar sem senha mantem a escolhida (admin pode substituir); login antes da aprovacao da 403. No PS a marca e `senhaDefinida=true` no usuario pendente; `migrar.php` zera a senha GUID dos pedidos antigos. NAO portado: `POST /usuarios/cadastro` (publico, aceitava perfil livre, front nao usa). GET permissoes segue aberto a qualquer logado (o front carrega a matriz de todos no boot).
3. EM ANDAMENTO (09/11/2026) cadastros + front servido pelo Laravel (`FrontController`, `SPARK_FRONT_DIR`, sem sessao/cookie, bloqueia ../): FEITO `/equipes` GET/POST/PUT (escrita = manutencao importar+editar; legado nao conferia), `/feriados` GET/POST (upsert pela data), `/listas` GET/POST/PUT/DELETE?confirmar=sim (semeia os padroes), `/indisponibilidades` GET/POST/DELETE (logica), `/importacao/log` GET. TRANSICAO: `PendenteController::PENDENTES` responde vazio nos GETs de abertura dos modulos nao portados (o front so tolera 403, nao 404) e o fallback /api responde "ainda nao migrado"; ao portar um modulo, tirar dali. FALTA: metas + metas/importar, justificativas, produtividade/resumo, equipes/importar, cadastros genericos (`/cadastros/<base>`, exclusoes da Gestao de Bases), conjuntos/mapa.
4. Depois importadores de OS/Excel (grids SGM, SIGOD, MO), mapa/rede (KMZ/Shapefile -> PostGIS, APP/RL), programacao/alertas/produtividade.

## Escopo por municipio (prefeituras)
Prototipo em `migracao/escopo_prefeitura.sql` + `teste_rls.sql` (9 testes passam): role `spark_app` sem BYPASSRLS, por requisicao `SET LOCAL spark.escopo='interno'|'municipios'` e `spark.municipios='ibge1,ibge2'`, default-deny, view `os_portal` (security_invoker) com lista branca de campos. Municipio vem do codigo IBGE do poste ou do poste mais proximo ate 300 m. Pendente: poligonos IBGE, RLS nas demais tabelas, tela admin usuario x municipio. Norma ANEEL: REN 1.137/2025 (manejo vegetal) encontrada; Mario falou "1.133", confirmar. Compartilhamento exige convenio + LGPD.

## Regras
- Seguranca: PDO preparado sempre; password_hash; AES-256-GCM (sodium) para dado sensivel com chave fora do banco; sem segredo no codigo; HTTPS em producao; auditoria sem senhas.
- **Nunca** versionar `model/`, `geo/`, e-mails/senhas reais. O `.gitignore` ja cobre; nao o enfraqueca.
- JSON gravado em disco e respostas da API sempre compactos (regra do legado).
- Regras de negocio no backend, nao so no front.
- Plano N = 01/11/(N-1) a 31/10/N; ano civil A usa planos A e A+1.
- Metas: upsert por equipe+AnoMes; `prodMetaDe` repete a ultima meta anterior se o mes nao tem.

## Decisoes em aberto (perguntar ao Mario)
- PENDENTE (adiado pelo Mario em 09/11/2026): carregar dados reais. Agora pela tela: Gestao de Bases > "Importar sistema antigo" (so admin, so com backend Laravel; `ImportacaoLegadoController`): o navegador manda a pasta model/ em pedacos de 8 MB (storage/app/legado/<lote>), depois roda `migrar.php` como subprocesso (senha via env SPARK_DB_PASS; no Windows precisa passar SystemRoot). `migrar.php` agora roda tudo numa transacao (falha = nada muda; testado). Se o e-mail do admin que importou nao vier nos dados, a conta dele e recolocada. A importacao zera sessoes e auditoria. v3.16.3: aceita .jsonl (programacao_log, ajustes_os_log); migra tambem alertas_tratados, exclusoes (tabela nova), app_rl_config e prefeituras_config (em configuracoes); todo .json/.jsonl sem tabela propria (logistica_*, prefeituras, localidades, municipios, nix_log, rank_log...) vai INTACTO para a tabela nova `legado_bruto` (entidade, dados jsonb) - ler dali ao portar o modulo. Ids de programacao fora do formato UUID viram UUID fixo (uuidDe). app_rl_indice.json e ignorado (recalculavel).
- Regra para metas duplicadas (equipe "Plantao" tem 13 valores em 2026-01).
- Senhas no go-live (forcar redefinicao?). Instalacao limpa precisa de admin semente (nao ha no Auth.ps1).
- Campos liberados ao portal da prefeitura (juridico) e tempo real x periodico.
- Reduzir memoria do navegador (~657 MB, front carrega ~113 mil OS): exige bbox/paginacao/agregacao no servidor; adiado.
- Render: disco persistente, >= 2 GB RAM, backups.

## Historico
Detalhado por versao nos docs do Project "Base Poda" (claude/spark-historico-*.md), no claude.ai.
