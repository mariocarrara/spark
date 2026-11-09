-- =============================================================================
-- PROTOTIPO: escopo de dados por municipio (portal da prefeitura) com Row Level Security
-- Rodar depois de schema.sql + migrar.php. Municipio = codigo IBGE (7 digitos).
-- =============================================================================
SET search_path = spark, public;

CREATE TABLE IF NOT EXISTS municipios (
  cod_ibge TEXT PRIMARY KEY,
  nome     TEXT,
  geom     geometry(MultiPolygon,4326)          -- limites do IBGE (a carregar); hoje usamos o poste mais proximo
);
CREATE TABLE IF NOT EXISTS usuario_municipios (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cod_ibge   TEXT NOT NULL REFERENCES municipios(cod_ibge),
  concedido_por TEXT, concedido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, cod_ibge)
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS externo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE os ADD COLUMN IF NOT EXISTS municipio_ibge TEXT;
CREATE INDEX IF NOT EXISTS os_municipio_ix ON os (municipio_ibge);

-- 1) municipio da OS: (a) o do poste que ela aponta; (b) senao o do poste mais proximo (<= 300 m)
UPDATE os SET municipio_ibge = poste_mun WHERE poste_mun IS NOT NULL AND municipio_ibge IS NULL;
-- (usa o indice espacial: KNN por geometry <-> e confere a distancia em metros so no candidato escolhido)
UPDATE os o SET municipio_ibge = p.municipio
  FROM (SELECT o2.id, n.municipio
        FROM os o2
        CROSS JOIN LATERAL (SELECT po.municipio, po.loc FROM postes po ORDER BY po.loc <-> o2.loc LIMIT 1) n
        WHERE o2.municipio_ibge IS NULL AND o2.loc IS NOT NULL
          AND ST_Distance(n.loc::geography, o2.loc::geography) <= 300) p
  WHERE o.id = p.id AND p.municipio IS NOT NULL;

-- 2) nomes (demo): localidade mais frequente entre as OS do codigo
INSERT INTO municipios (cod_ibge, nome)
SELECT m.cod, (SELECT localidade FROM os WHERE municipio_ibge = m.cod AND localidade IS NOT NULL GROUP BY localidade ORDER BY count(*) DESC LIMIT 1)
FROM (SELECT DISTINCT municipio_ibge AS cod FROM os WHERE municipio_ibge IS NOT NULL) m
ON CONFLICT DO NOTHING;

-- 3) papeis: a aplicacao conecta como spark_app (sem BYPASSRLS, nao e dona das tabelas)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='spark_app') THEN CREATE ROLE spark_app LOGIN PASSWORD 'troque-esta-senha'; END IF; END $$;
GRANT USAGE ON SCHEMA spark TO spark_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA spark TO spark_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA spark TO spark_app;

-- 4) Row Level Security. A aplicacao, a cada pedido, faz (dentro da transacao):
--      SET LOCAL spark.escopo = 'interno'            -- usuario da empresa: ve tudo
--      SET LOCAL spark.escopo = 'municipios'; SET LOCAL spark.municipios = '3541406,3507605'   -- prefeitura
--    Sem nada setado => nenhuma linha (negar por padrao).
CREATE OR REPLACE FUNCTION spark.escopo_ok(mun TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT CASE current_setting('spark.escopo', true)
           WHEN 'interno'    THEN true
           WHEN 'municipios' THEN mun = ANY (string_to_array(coalesce(current_setting('spark.municipios', true), ''), ','))
           ELSE false END
$$;
ALTER TABLE os ENABLE ROW LEVEL SECURITY;
ALTER TABLE os FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS os_escopo ON os;
CREATE POLICY os_escopo ON os FOR ALL TO spark_app USING (escopo_ok(municipio_ibge)) WITH CHECK (escopo_ok(municipio_ibge));

-- 5) Visao do portal: so os campos que a prefeitura pode ver (sem equipe, sem observacao, sem prioridade interna)
CREATE OR REPLACE VIEW os_portal WITH (security_invoker = true) AS
SELECT id, status_os, tipo_servico, data_abertura, data_execucao, alimentador, localidade, municipio_ibge,
       previsto_poda, realizado_poda, previsto_limpeza, realizado_limpeza, previsto_estrutura, realizado_estrutura,
       ST_Y(loc) AS lat, ST_X(loc) AS lng
FROM os WHERE NOT loc_aproximada;
GRANT SELECT ON os_portal TO spark_app;
