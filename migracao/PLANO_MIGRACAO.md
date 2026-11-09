# SPARK — migração para PHP + PostgreSQL/PostGIS (rascunho v0)

## 1. Decisões já tomadas
- **Backend:** PHP 8.3, MVC próprio (sem framework pesado), PDO com prepared statements. Composer só para bibliotecas de segurança e leitura de Excel/KMZ.
- **Banco:** PostgreSQL 16 + PostGIS 3.4 (Render tem PostgreSQL gerenciado). Testado aqui: o schema sobe sem erro.
- **Front-end:** não muda. O PHP responde nas mesmas rotas `/api/...` (ver `INVENTARIO_API.md`).
- **Migração por módulos**, PowerShell e PHP convivendo até o fim; cada módulo validado comparando as respostas dos dois lados.

## 2. O que já está feito e testado com os dados reais (`model/` enviada em 06/11/2026)
| Item | Resultado |
|---|---|
| `schema.sql` | 42 tabelas, índices GiST (espaciais), btree e trigram. Sobe limpo no PostgreSQL 16 + PostGIS 3.4 |
| `migrar.php` | Carrega o `model/` inteiro em ~40 s (COPY). Repetível. Contagens conferem com os JSON |
| Volumes | 113.118 OS atuais · 108.349 OS de histórico (3 planos) · 760.650 postes · 109.343 proteções · 141.316 VERA · 156 mil equipamentos · 804 programações |
| Consultas geoespaciais | "proteção mais próxima de uma OS": 49 ms · produção de poda por mês: 96 ms |

## 3. Achados nos dados (decidir antes de ir ao ar)
1. **Metas duplicadas:** 1.369 linhas no JSON, mas só 1.225 combinações equipe+tipo+mês. 12 combinações aparecem repetidas com **valores diferentes** (ex.: equipe "Plantão", 2026-01, 13 linhas com 102, 391, 187, 153, 170, 357, 204, 136…). No sistema atual vale a primeira linha encontrada; na migração, a última. É preciso decidir a regra certa (provavelmente a equipe "Plantão" precisa de um código por regional, ou a meta é a soma).
2. **Senhas:** estão apenas em base64 (reversível). A migração guarda em `senha_legada`; no primeiro login o PHP confere, grava `password_hash` e apaga a antiga. Recomendação: **forçar troca de senha** de todos no go-live.
3. **OS sem coordenada:** 67 de 113.118 (0,06%).
4. A coluna `app_rl_indice.json` (índice em C#) deixa de existir: com PostGIS a distância OS→APP/RL vira consulta indexada sobre `areas_protegidas`.
5. `logistica_*` e `prefeituras`, `localidades`, `exclusoes` estão vazios na amostra: tabelas só serão criadas quando os módulos forem migrados.

## 4. Ordem das próximas fases
1. **Fundação PHP:** roteador, PDO, login (`password_hash`), sessão (cookie Secure/HttpOnly), CSRF, bloqueio por tentativas, permissões por perfil, auditoria. *(`/api/auth`, `/api/usuarios`, `/api/permissoes`)*
2. **Cadastros:** equipes, metas, feriados, indisponibilidades, justificativas, listas, ajuda, Nix, rank.
3. **OS e importação de Excel** (grid SGM/MO, executado, pendente, histórico por plano). Leitura de xlsx grande em streaming.
4. **Mapa e rede:** camadas por área (bbox) com PostGIS, postes, equipamentos, KMZ/Shapefile → `rede_trechos` / `areas_protegidas`, APP/RL.
5. **Programação, alertas, produtividade, visão geral, logística, prefeituras.**
6. Desligar o PowerShell.

## 5. Ambiente local e Render
- Local (Windows): PostgreSQL 16 + PostGIS (Stack Builder), PHP 8.3 com `pdo_pgsql, pgsql, sodium, zip, gd, mbstring, openssl`. Alternativa: Docker (`docker-compose.yml`, a combinar).
- Render: serviço web em Docker (PHP) + PostgreSQL gerenciado (inclui PostGIS e backup nos planos pagos). HTTPS automático.
- Segredos (chaves, senha do banco) só em variáveis de ambiente, nunca no código.

## 6. Como rodar o que existe
```
createdb spark
psql -d spark -f schema.sql
php -d memory_limit=-1 migrar.php <pasta_model> "pgsql:host=127.0.0.1;port=5432;dbname=spark" postgres <senha>
```

## 7. Portal da prefeitura — escopo de dados por município (protótipo testado)
Arquivos: `escopo_prefeitura.sql` (tabelas `municipios`, `usuario_municipios`, coluna `os.municipio_ibge`, Row Level Security, visão `os_portal`) e `teste_rls.sql` (9 testes de isolamento).
- Município da OS: o do poste que ela aponta (`poste_mun`, código IBGE) ou, na falta, o do poste mais próximo (≤ 300 m). Resultado nos dados reais: **112.502 de 113.118 OS (99,5%)** com município; 616 ficam sem (e por isso invisíveis às prefeituras — falha segura).
- A aplicação conecta como `spark_app` (sem BYPASSRLS) e, a cada pedido, declara o escopo na transação (`SET LOCAL spark.escopo`). **Sem declarar, vê zero linhas.**
- Testes passaram: sem escopo = 0; interno = 113.118; prefeitura A = só o município dela; A não lê, não altera e não insere em município de B; a visão do portal não expõe equipe, observação nem prioridade interna.
- **Pendências:** (1) trocar o "poste mais próximo" pelos **limites municipais do IBGE** (resolve OS na divisa); (2) estender a RLS às demais tabelas que uma conta externa possa tocar (e dar a ela só SELECT na visão); (3) tela do administrador para vincular usuário × municípios; (4) lista de campos aprovada pelo jurídico; (5) auditoria de acesso das contas externas.
