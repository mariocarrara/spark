-- =============================================================================
-- SPARK - esquema PostgreSQL + PostGIS (rascunho v0, gerado a partir dos arquivos reais de model/)
-- Convencoes: nomes em portugues, snake_case; ids de negocio continuam TEXT (OS, equipes, protecoes);
-- coordenadas em geometry(Point,4326) (lng,lat); datas de negocio em DATE; momentos em TIMESTAMPTZ.
-- Tudo que era "flag de exclusao" (excluido) segue como exclusao logica.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- busca por trecho de texto (OS, protecao, alimentador)

DROP SCHEMA IF EXISTS spark CASCADE;
CREATE SCHEMA spark;
SET search_path = spark, public;

-- ---------------------------------------------------------------------------
-- 1. Usuarios, perfis, sessoes, auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id             TEXT PRIMARY KEY,                 -- "u1", "u-<guid>" (mantidos para nao quebrar referencias)
  nome           TEXT NOT NULL,
  email          TEXT NOT NULL,
  senha_hash     TEXT,                             -- password_hash() (Argon2id/bcrypt)
  senha_legada   TEXT,                             -- base64 antigo; apagado no 1o login (vira senha_hash)
  status_conta   TEXT NOT NULL DEFAULT 'Ativo',    -- Ativo | Bloqueado | PendenteAprovacao
  perfil_base    TEXT NOT NULL DEFAULT 'Consulta', -- Administrador | Programador | Supervisor de Equipe | Gestor/Coordenador | Consulta
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_login   TIMESTAMPTZ
);
CREATE UNIQUE INDEX usuarios_email_uq ON usuarios (lower(email));

-- matriz de permissoes: existe a linha = acao liberada
CREATE TABLE permissoes (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo     TEXT NOT NULL,   -- manutencao, produtividade, metas, programacao, prefeituras, gestaoBases, alertas, prioridade, nix, usuarios
  acao       TEXT NOT NULL,   -- visualizar | criar | editar | excluirStatus | importar
  PRIMARY KEY (usuario_id, modulo, acao)
);

CREATE TABLE sessoes (
  token_hash  TEXT PRIMARY KEY,                    -- SHA-256 do token (o token em si nunca fica no banco)
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL,
  ip          INET,
  user_agent  TEXT
);
CREATE INDEX sessoes_usuario_ix ON sessoes (usuario_id);
CREATE INDEX sessoes_expira_ix  ON sessoes (expira_em);

CREATE TABLE tentativas_login (                    -- bloqueio por tentativas erradas
  id        BIGSERIAL PRIMARY KEY,
  email     TEXT,
  ip        INET,
  momento   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sucesso   BOOLEAN NOT NULL
);
CREATE INDEX tentativas_login_ix ON tentativas_login (lower(email), momento DESC);

CREATE TABLE solicitacoes_cadastro (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Pendente',   -- Pendente | Aprovada | Recusada
  criado_em    TIMESTAMPTZ NOT NULL,
  decidido_em  TIMESTAMPTZ,
  decidido_por TEXT
);

-- auditoria generica (quem, o que, em qual registro, de onde)
CREATE TABLE auditoria (
  id          BIGSERIAL PRIMARY KEY,
  momento     TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id  TEXT,
  acao        TEXT NOT NULL,        -- criar | alterar | excluir | importar | login | ...
  entidade    TEXT NOT NULL,        -- 'programacao', 'os', 'nix', ...
  registro_id TEXT,
  ip          INET,
  detalhes    JSONB                 -- de/para; NUNCA senhas nem dados sensiveis em texto aberto
);
CREATE INDEX auditoria_entidade_ix ON auditoria (entidade, registro_id, momento DESC);
CREATE INDEX auditoria_usuario_ix  ON auditoria (usuario_id, momento DESC);

CREATE TABLE importacoes_log (
  id                    TEXT PRIMARY KEY,
  data_hora             TIMESTAMPTZ NOT NULL,
  usuario_id            TEXT,
  base                  TEXT NOT NULL,
  arquivo_origem        TEXT,
  registros_processados INT NOT NULL DEFAULT 0,
  registros_com_erro    INT NOT NULL DEFAULT 0
);
CREATE INDEX importacoes_log_ix ON importacoes_log (data_hora DESC);

-- ---------------------------------------------------------------------------
-- 2. Cadastros
-- ---------------------------------------------------------------------------
CREATE TABLE equipes (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  tipo_equipe     TEXT,
  polo            TEXT,
  regional        TEXT,
  departamento    TEXT,
  proprio_terceiro TEXT,
  equipe_poda     BOOLEAN NOT NULL DEFAULT false,
  base            geometry(Point,4326),            -- base fisica da equipe (baseLat/baseLng)
  ativo           BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE metas (
  id             TEXT PRIMARY KEY,
  equipe_id      TEXT NOT NULL,                    -- sem FK: ha metas de equipes ja inativas/removidas
  tipo           TEXT NOT NULL DEFAULT 'poda',     -- poda | faixa
  ano_mes        CHAR(7) NOT NULL,                 -- 'AAAA-MM'
  meta_mensal    NUMERIC NOT NULL,                 -- sem limite de casas (metas de faixa tem 9 decimais)
  dias_uteis     INT NOT NULL,
  meta_diaria    NUMERIC,
  origem         TEXT,
  atualizado_por TEXT,
  atualizado_em  TIMESTAMPTZ,
  UNIQUE (equipe_id, tipo, ano_mes)
);
CREATE INDEX metas_ano_mes_ix ON metas (ano_mes);

CREATE TABLE feriados (
  data        DATE PRIMARY KEY,
  descricao   TEXT NOT NULL,
  abrangencia TEXT NOT NULL DEFAULT 'Nacional'
);

CREATE TABLE indisponibilidades (
  id          TEXT PRIMARY KEY,
  equipe_id   TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  tipo        TEXT,
  texto       TEXT,
  autor_id    TEXT,
  criado_em   TIMESTAMPTZ,
  excluido    BOOLEAN NOT NULL DEFAULT false,
  excluido_por TEXT,
  excluido_em  TIMESTAMPTZ
);
CREATE INDEX indisponibilidades_ix ON indisponibilidades (equipe_id, data_inicio, data_fim) WHERE NOT excluido;

CREATE TABLE justificativas (
  id          TEXT PRIMARY KEY,
  data        DATE NOT NULL,
  equipe_id   TEXT NOT NULL,
  tipo        TEXT,
  texto       TEXT,
  autor_id    TEXT,
  criado_em   TIMESTAMPTZ,
  excluido    BOOLEAN NOT NULL DEFAULT false,
  excluido_por TEXT,
  excluido_em  TIMESTAMPTZ
);
CREATE INDEX justificativas_ix ON justificativas (equipe_id, data) WHERE NOT excluido;

CREATE TABLE listas_cadastro (                     -- plano, equipeNecessaria, justificativaTipo ...
  id       TEXT PRIMARY KEY,
  lista    TEXT NOT NULL,
  nome     TEXT NOT NULL,
  ordem    INT NOT NULL DEFAULT 0,
  ativo    BOOLEAN NOT NULL DEFAULT true,
  excluido BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE esquemas (codigo TEXT PRIMARY KEY, descricao TEXT NOT NULL, tipo TEXT);

CREATE TABLE conjuntos (
  id             SERIAL PRIMARY KEY,
  regional       TEXT, sigla TEXT, tensao_nominal TEXT, cod_conjunto TEXT, nome_conjunto TEXT,
  alimentador    TEXT, tensao TEXT
);
CREATE INDEX conjuntos_alim_ix ON conjuntos (alimentador);

CREATE TABLE alimentador_polo (alimentador TEXT PRIMARY KEY, polo TEXT, regional TEXT);

CREATE TABLE prioridade_ew (
  chave         TEXT PRIMARY KEY,
  grupo_recurso TEXT, prioridade_ew TEXT, prioridade TEXT, regional TEXT, tensao TEXT
);

CREATE TABLE ajuda_faq (
  id TEXT PRIMARY KEY, categoria TEXT, pergunta TEXT NOT NULL, resposta TEXT NOT NULL, palavras TEXT,
  ordem INT NOT NULL DEFAULT 0, ativo BOOLEAN NOT NULL DEFAULT true, excluido BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE configuracoes (                       -- alertas_config, app_rl_config, raio do Nix ...
  chave          TEXT PRIMARY KEY,
  valor          JSONB NOT NULL,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por TEXT
);

CREATE TABLE alertas_tratados (
  tipo TEXT NOT NULL, chave TEXT NOT NULL, status TEXT NOT NULL,
  usuario_id TEXT, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, chave)
);

-- "Excluir" da Gestao de Bases (exclusoes.json do legado): fica fora do registro para uma
-- reimportacao da base nao "ressuscitar" o que foi excluido. O admin pode restaurar.
CREATE TABLE exclusoes (
  base  TEXT NOT NULL,
  chave TEXT NOT NULL,
  em    TIMESTAMPTZ,
  por   TEXT,
  PRIMARY KEY (base, chave)
);

-- Rede de seguranca da migracao: todo .json do model/ que ainda nao tem tabela propria
-- (logistica_*, prefeituras, localidades, municipios...) e guardado inteiro aqui, intacto,
-- ate o modulo correspondente ser portado.
CREATE TABLE legado_bruto (
  entidade     TEXT PRIMARY KEY,                 -- nome do arquivo sem .json
  dados        JSONB NOT NULL,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gestao de Bases > Importar (por aba): as linhas chegam em pedacos e ficam aqui ate o "aplicar",
-- que grava tudo de uma vez numa transacao. Lotes velhos (> 1 dia) sao apagados sozinhos.
CREATE UNLOGGED TABLE IF NOT EXISTS cadastro_import (
  lote       UUID NOT NULL,
  base       TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  n          INT  NOT NULL,                       -- ordem da linha no arquivo (a ultima repetida vale)
  dados      JSONB NOT NULL,                      -- ja com os nomes das colunas da tabela
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lote, n)
);

-- ---------------------------------------------------------------------------
-- 3. Ordens de servico (base atual e historico por plano)
--    Plano N = 01/11/(N-1) a 31/10/N. O historico e separado de tudo que e vivo (alertas, rank, mapa de hoje).
-- ---------------------------------------------------------------------------
CREATE TABLE os (
  id                    TEXT PRIMARY KEY,           -- numero da OS (com os espacos do original; a chave de comparacao e trim)
  origem                TEXT NOT NULL,              -- SGM | SIGOD
  os_primaria           TEXT,
  id_vera               TEXT,
  status_os             TEXT NOT NULL,              -- Pendente | A reprogramar | Despachada | Programada | Executada | Cancelada
  tipo_servico          TEXT NOT NULL,              -- Poda | Limpeza de faixa | Estrutura ...
  tipo_equipe_necessaria TEXT,
  tipo_equipe_exec      TEXT,
  prioridade_ew         BOOLEAN NOT NULL DEFAULT false,
  equipe_id             TEXT,
  data_abertura         DATE,
  data_execucao         DATE,
  data_prevista         DATE,
  alimentador           TEXT,
  conjunto              TEXT,
  protecao_id           TEXT,
  trecho                TEXT,
  localidade            TEXT,
  desc_esquema          TEXT,
  observacao            TEXT,
  -- posicao da OS e como foi obtida (VERA > XY > Poste > centro da cidade)
  loc                   geometry(Point,4326),
  loc_fonte             TEXT,
  loc_origem            TEXT,
  loc_aproximada        BOOLEAN NOT NULL DEFAULT false,
  -- quantidades
  previsto              NUMERIC(14,3) NOT NULL DEFAULT 0,
  realizado             NUMERIC(14,3) NOT NULL DEFAULT 0,
  previsto_poda         NUMERIC(14,3) NOT NULL DEFAULT 0,
  previsto_limpeza      NUMERIC(14,3) NOT NULL DEFAULT 0,
  previsto_estrutura    NUMERIC(14,3) NOT NULL DEFAULT 0,
  realizado_poda        NUMERIC(14,3) NOT NULL DEFAULT 0,
  realizado_limpeza     NUMERIC(14,3) NOT NULL DEFAULT 0,
  realizado_estrutura   NUMERIC(14,3) NOT NULL DEFAULT 0,
  -- dados do poste que a OS aponta
  poste_id              TEXT,
  poste_tipo            TEXT,
  poste_area_local      TEXT,
  poste_conjunto        TEXT,
  poste_mun             TEXT,
  poste_loc             geometry(Point,4326),
  previsto_por_esquema  BOOLEAN,
  localidade_por_poste  BOOLEAN,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX os_loc_gix        ON os USING GIST (loc);
CREATE INDEX os_status_ix      ON os (status_os);
CREATE INDEX os_exec_ix        ON os (data_execucao) WHERE data_execucao IS NOT NULL;
CREATE INDEX os_abertura_ix    ON os (data_abertura);
CREATE INDEX os_equipe_exec_ix ON os (equipe_id, data_execucao);
CREATE INDEX os_alim_ix        ON os (alimentador);
CREATE INDEX os_protecao_ix    ON os (protecao_id);
CREATE INDEX os_primaria_ix    ON os (os_primaria) WHERE os_primaria IS NOT NULL;
CREATE INDEX os_id_trgm_ix     ON os USING GIN (id gin_trgm_ops);

CREATE TABLE os_historico (LIKE os INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE os_historico ADD COLUMN plano INT NOT NULL;
ALTER TABLE os_historico ADD PRIMARY KEY (plano, id);
CREATE INDEX os_hist_loc_gix   ON os_historico USING GIST (loc);
CREATE INDEX os_hist_exec_ix   ON os_historico (plano, data_execucao);
CREATE INDEX os_hist_equipe_ix ON os_historico (equipe_id, data_execucao);
CREATE INDEX os_hist_alim_ix   ON os_historico (alimentador);
CREATE INDEX os_hist_id_trgm   ON os_historico USING GIN (id gin_trgm_ops);

CREATE TABLE historico_planos (
  plano INT PRIMARY KEY, total INT NOT NULL, inicio DATE NOT NULL, fim DATE NOT NULL,
  atualizado_em TIMESTAMPTZ, usuario_id TEXT, modo TEXT, novas INT, atualizadas INT, arquivos TEXT
);

-- ajuste manual por OS (tipo de equipe, equipe, alimentador, protecao) e seu historico
CREATE TABLE ajustes_os (
  os_id TEXT PRIMARY KEY, alimentador TEXT, tipo_equipe TEXT, protecao_id TEXT, equipe_id TEXT,
  criado_por TEXT, criado_em TIMESTAMPTZ, atualizado_por TEXT, atualizado_em TIMESTAMPTZ
);
CREATE TABLE ajustes_os_log (
  id BIGSERIAL PRIMARY KEY, momento TIMESTAMPTZ NOT NULL, usuario_id TEXT, os_id TEXT NOT NULL,
  acao TEXT NOT NULL, de JSONB, para JSONB
);

-- ---------------------------------------------------------------------------
-- 4. Programacao
-- ---------------------------------------------------------------------------
CREATE TABLE programacoes (
  id                 UUID PRIMARY KEY,
  tipo_programacao   TEXT NOT NULL DEFAULT 'Poda',
  status             TEXT NOT NULL,                 -- Programada | Concluida | Cancelada
  data_inicio        DATE NOT NULL,
  data_fim           DATE NOT NULL,
  protecao_id        TEXT,
  alimentador        TEXT,
  localidade         TEXT,
  regional           TEXT,
  polo               TEXT,
  plano              TEXT,
  tipo_plano         TEXT,
  equipe_necessaria  TEXT,
  desligamento       TEXT,
  numero_sis         TEXT,
  observacao         TEXT,
  origem_tela        TEXT,
  previsto_concluir  BOOLEAN NOT NULL DEFAULT false,
  programador_id     TEXT,
  exec_snap          JSONB,                         -- copias das OS EXECUTADAS (filhas) que apontam para as programadas (execSnap)
  criado_em          TIMESTAMPTZ NOT NULL,
  atualizado_em      TIMESTAMPTZ NOT NULL
);
CREATE INDEX programacoes_data_ix  ON programacoes (data_inicio, data_fim);
CREATE INDEX programacoes_prot_ix  ON programacoes (protecao_id);
CREATE INDEX programacoes_status_ix ON programacoes (status);

CREATE TABLE programacao_equipes (
  programacao_id UUID NOT NULL REFERENCES programacoes(id) ON DELETE CASCADE,
  equipe_id      TEXT NOT NULL,
  PRIMARY KEY (programacao_id, equipe_id)
);
CREATE INDEX programacao_equipes_ix ON programacao_equipes (equipe_id);

CREATE TABLE programacao_os (
  programacao_id UUID NOT NULL REFERENCES programacoes(id) ON DELETE CASCADE,
  os_id          TEXT NOT NULL,                     -- sem FK: a OS pode sair da base atual
  ordem          INT  NOT NULL DEFAULT 0,
  snapshot       JSONB,                             -- foto da OS no momento da programacao (osSnap)
  PRIMARY KEY (programacao_id, os_id)
);
CREATE INDEX programacao_os_ix ON programacao_os (os_id);

CREATE TABLE programacao_log (
  id BIGSERIAL PRIMARY KEY, programacao_id UUID NOT NULL, momento TIMESTAMPTZ NOT NULL, usuario_id TEXT,
  acao TEXT NOT NULL, resumo TEXT, ref TEXT, mudancas JSONB,
  os_add JSONB, os_rem JSONB                       -- OS incluidas / retiradas nessa alteracao (add/rem do legado)
);
CREATE INDEX programacao_log_ix ON programacao_log (programacao_id, momento DESC);

-- ---------------------------------------------------------------------------
-- 5. Rede, protecoes, postes e equipamentos (aqui o PostGIS substitui os indices em C#)
-- ---------------------------------------------------------------------------
CREATE TABLE protecoes (
  id            SERIAL PRIMARY KEY,
  protecao_id   TEXT NOT NULL,
  prot_elemento TEXT,
  protecao2     TEXT,
  alimentador   TEXT,
  trecho        TEXT,
  trecho_t4     TEXT,
  zona          TEXT,
  plano_easywork TEXT,
  loc           geometry(Point,4326)
);
CREATE INDEX protecoes_id_ix   ON protecoes (protecao_id);
CREATE INDEX protecoes_alim_ix ON protecoes (alimentador);
CREATE INDEX protecoes_loc_gix ON protecoes USING GIST (loc);
CREATE INDEX protecoes_id_trgm ON protecoes USING GIN (protecao_id gin_trgm_ops);

CREATE TABLE protecao_alimentador (alimentador TEXT NOT NULL, protecao_id TEXT NOT NULL, PRIMARY KEY (alimentador, protecao_id));

CREATE TABLE vao (protecao_id TEXT PRIMARY KEY, polo TEXT, regional TEXT, postes INT, rota_km NUMERIC(12,5));
CREATE TABLE vao_postes (poste_id TEXT PRIMARY KEY, rota_km NUMERIC(12,5) NOT NULL);

CREATE TABLE vera (
  id_vera TEXT PRIMARY KEY, especie TEXT, cidade TEXT, alimentador TEXT, loc geometry(Point,4326)
);
CREATE INDEX vera_alim_ix ON vera (alimentador);
CREATE INDEX vera_loc_gix ON vera USING GIST (loc);

CREATE TABLE postes (                                -- PONNOT (~760 mil)
  cod_id  TEXT PRIMARY KEY,
  tipo    TEXT,
  area_local TEXT,
  conjunto TEXT,
  municipio TEXT,
  loc     geometry(Point,4326) NOT NULL
);
CREATE INDEX postes_loc_gix ON postes USING GIST (loc);
CREATE INDEX postes_tipo_ix ON postes (tipo);

CREATE TABLE equipamentos (                          -- trafos, protecoes, capacitores, reguladores
  camada  TEXT NOT NULL,                             -- trafos | protecoes | capacitores | reguladores
  cod_id  TEXT NOT NULL,
  poste   TEXT,
  ctmt    TEXT,
  conj    TEXT,
  v0 TEXT, v1 TEXT, v2 TEXT, v3 TEXT, v4 TEXT,       -- significado depende da camada (ver Equip.ps1, SparkEquip.Campos)
  nome_operativo TEXT,                               -- equip_nomes_*.tsv (numero operativo)
  loc     geometry(Point,4326),
  PRIMARY KEY (camada, cod_id)
);
CREATE INDEX equipamentos_loc_gix ON equipamentos USING GIST (loc);
CREATE INDEX equipamentos_poste_ix ON equipamentos (poste);

-- camadas vetoriais carregadas dos KMZ/Shapefile (pasta geo/)
CREATE TABLE rede_trechos (
  id          BIGSERIAL PRIMARY KEY,
  camada      TEXT NOT NULL,                         -- mt | bt | at
  alimentador TEXT,
  atributos   JSONB,                                 -- atributos do DBF preservados
  geom        geometry(MultiLineString,4326) NOT NULL
);
CREATE INDEX rede_trechos_gix ON rede_trechos USING GIST (geom);
CREATE INDEX rede_trechos_alim_ix ON rede_trechos (camada, alimentador);

CREATE TABLE areas_protegidas (                      -- APP e Reserva Legal
  id          BIGSERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL,                         -- app | rl
  alimentador TEXT,
  atributos   JSONB,
  geom        geometry(MultiPolygon,4326) NOT NULL
);
CREATE INDEX areas_protegidas_gix ON areas_protegidas USING GIST (geom);
CREATE INDEX areas_protegidas_tipo_ix ON areas_protegidas (tipo, alimentador);

-- ---------------------------------------------------------------------------
-- 6. Prioridade (rank) e Pontos Nix
-- ---------------------------------------------------------------------------
CREATE TABLE rank_listas (
  id TEXT PRIMARY KEY, enviado_em TIMESTAMPTZ, enviado_por TEXT, enviado_por_nome TEXT, arquivo TEXT, aba TEXT,
  referencia TEXT, origem TEXT, autor_arquivo TEXT, criado_arquivo_em TIMESTAMPTZ, modificado_arquivo_em TIMESTAMPTZ,
  hash TEXT, linhas INT, com_data INT, rejeitadas INT
);
CREATE TABLE rank_itens (
  lista_id TEXT NOT NULL REFERENCES rank_listas(id) ON DELETE CASCADE,
  posicao  INT  NOT NULL,                            -- r
  elemento TEXT NOT NULL,                            -- e
  dec      NUMERIC, trecho TEXT, alim TEXT, reg TEXT, polo TEXT, conj TEXT, plano TEXT,
  di DATE, df DATE,
  PRIMARY KEY (lista_id, posicao)
);
CREATE INDEX rank_itens_elem_ix ON rank_itens (lista_id, elemento);

CREATE TABLE nix (
  id        TEXT PRIMARY KEY,
  elemento  TEXT NOT NULL, ranque TEXT, trecho TEXT, alim TEXT, reg TEXT, conj TEXT, tensao TEXT,
  dh TEXT, ppf TEXT,
  manual    BOOLEAN NOT NULL DEFAULT false,
  criado_por TEXT, criado_em TIMESTAMPTZ
);
CREATE TABLE nix_pontos (
  nix_id TEXT NOT NULL REFERENCES nix(id) ON DELETE CASCADE,
  ordem  INT NOT NULL,
  loc    geometry(Point,4326) NOT NULL,
  PRIMARY KEY (nix_id, ordem)
);
CREATE INDEX nix_pontos_gix ON nix_pontos USING GIST (loc);
