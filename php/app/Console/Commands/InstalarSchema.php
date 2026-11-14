<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Cria as tabelas (migracao/schema.sql) SO se o schema "spark" ainda nao existir.
 * Seguro de rodar a cada deploy: com o banco ja instalado, nao faz nada (nunca apaga dados).
 *   php artisan spark:instalar-schema
 */
class InstalarSchema extends Command
{
    protected $signature = 'spark:instalar-schema';
    protected $description = 'Cria as tabelas do SPARK se o banco estiver vazio (nao mexe em banco ja instalado)';

    public function handle(): int
    {
        $existe = DB::selectOne("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'spark' AND table_name = 'usuarios'")->n > 0;
        if ($existe) {
            // tabelas acrescentadas depois da 1a instalacao (v3.16.3)
            DB::unprepared("SET search_path = spark, public;
                CREATE TABLE IF NOT EXISTS exclusoes (base TEXT NOT NULL, chave TEXT NOT NULL, em TIMESTAMPTZ, por TEXT, PRIMARY KEY (base, chave));
                CREATE TABLE IF NOT EXISTS legado_bruto (entidade TEXT PRIMARY KEY, dados JSONB NOT NULL, importado_em TIMESTAMPTZ NOT NULL DEFAULT now());
                ALTER TABLE programacoes ADD COLUMN IF NOT EXISTS exec_snap JSONB;
                ALTER TABLE programacao_log ADD COLUMN IF NOT EXISTS os_add JSONB;
                ALTER TABLE programacao_log ADD COLUMN IF NOT EXISTS os_rem JSONB;
                ALTER TABLE metas ALTER COLUMN meta_mensal TYPE NUMERIC, ALTER COLUMN meta_diaria TYPE NUMERIC;
                CREATE UNLOGGED TABLE IF NOT EXISTS cadastro_import (lote UUID NOT NULL, base TEXT NOT NULL, usuario_id TEXT NOT NULL, n INT NOT NULL,
                    dados JSONB NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (lote, n));
                CREATE TABLE IF NOT EXISTS rede_feicoes (id BIGSERIAL PRIMARY KEY, camada TEXT NOT NULL, alimentador TEXT NOT NULL, atributos JSONB,
                    geom geometry(Geometry,4326) NOT NULL);
                CREATE INDEX IF NOT EXISTS rede_feicoes_gix ON rede_feicoes USING GIST (geom);
                CREATE INDEX IF NOT EXISTS rede_feicoes_alim_ix ON rede_feicoes (camada, alimentador, id);
                CREATE TABLE IF NOT EXISTS rede_alimentadores (camada TEXT NOT NULL, alimentador TEXT NOT NULL, nome TEXT, nomes JSONB,
                    trechos INT NOT NULL DEFAULT 0, metros NUMERIC, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (camada, alimentador));
                CREATE TABLE IF NOT EXISTS app_rl_indice (os_id TEXT PRIMARY KEY, app NUMERIC, rl NUMERIC);
                CREATE TABLE IF NOT EXISTS equip_nomes (camada TEXT NOT NULL, cod_id TEXT NOT NULL, nome TEXT, alias TEXT, PRIMARY KEY (camada, cod_id));
                INSERT INTO equip_nomes (camada, cod_id, nome) SELECT camada, cod_id, nome_operativo FROM equipamentos
                    WHERE coalesce(nome_operativo, '') <> '' AND NOT EXISTS (SELECT 1 FROM equip_nomes) ON CONFLICT DO NOTHING;
                -- v3.17: as tabelas antigas da rede nunca receberam dados (a geo/ nao tinha sido portada)
                DO \$\$ BEGIN
                  -- EXECUTE dinamico: o PL/pgSQL nao pode citar a tabela direto (quebra quando ela ja nao existe)
                  DECLARE t TEXT; vazia BOOLEAN; BEGIN
                    FOREACH t IN ARRAY ARRAY['rede_trechos', 'areas_protegidas'] LOOP
                      IF to_regclass(t) IS NOT NULL THEN
                        EXECUTE format('SELECT NOT EXISTS (SELECT 1 FROM %I)', t) INTO vazia;
                        IF vazia THEN EXECUTE format('DROP TABLE %I', t); END IF;
                      END IF;
                    END LOOP;
                  END;
                END \$\$;");
            $this->info('Banco ja instalado; nada a fazer.');

            return self::SUCCESS;
        }
        $schema = base_path('../migracao/schema.sql');
        if (! is_file($schema)) {
            $this->error("Nao achei {$schema}");

            return self::FAILURE;
        }
        DB::unprepared(file_get_contents($schema));
        $this->info('Tabelas do SPARK criadas.');

        return self::SUCCESS;
    }
}
