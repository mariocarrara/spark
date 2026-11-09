SET search_path = spark, public;
\echo '--- 1) conexao como spark_app SEM definir escopo (deve ver ZERO linhas: negar por padrao)'
BEGIN; SELECT count(*) AS os_visiveis FROM os; ROLLBACK;
\echo '--- 2) escopo interno (empresa): ve tudo'
BEGIN; SET LOCAL spark.escopo='interno'; SELECT count(*) AS os_visiveis FROM os; ROLLBACK;
\echo '--- 3) prefeitura A (Presidente Prudente = 3541406): so as OS dela'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
SELECT count(*) AS os_visiveis, count(DISTINCT municipio_ibge) AS municipios_distintos, min(municipio_ibge) FROM os; ROLLBACK;
\echo '--- 4) prefeitura B (Braganca Paulista 3507605 + 3504008): so as dela'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3507605,3504008';
SELECT count(*) AS os_visiveis, array_agg(DISTINCT municipio_ibge) FROM os; ROLLBACK;
\echo '--- 5) prefeitura A tenta ler OS da B por id: nao enxerga'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
SELECT count(*) AS achou FROM os WHERE municipio_ibge='3507605'; ROLLBACK;
\echo '--- 6) prefeitura A tenta ALTERAR OS da B: 0 linhas afetadas'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
UPDATE os SET status_os='Cancelada' WHERE municipio_ibge='3507605'; ROLLBACK;
\echo '--- 7) prefeitura A tenta INSERIR OS em outro municipio: bloqueado pelo WITH CHECK'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
INSERT INTO os (id, origem, status_os, tipo_servico, municipio_ibge) VALUES ('TESTE-X','SGM','Pendente','Poda','3507605'); ROLLBACK;
\echo '--- 8) visao do portal para a prefeitura A: colunas permitidas e quantidade (sem equipe/observacao)'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
SELECT count(*) AS linhas_portal FROM os_portal;
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS colunas FROM information_schema.columns WHERE table_schema='spark' AND table_name='os_portal'; ROLLBACK;
\echo '--- 9) prefeitura tenta ler coluna proibida pela visao (observacao): erro'
BEGIN; SET LOCAL spark.escopo='municipios'; SET LOCAL spark.municipios='3541406';
SELECT observacao FROM os_portal LIMIT 1; ROLLBACK;
