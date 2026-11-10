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
                ALTER TABLE metas ALTER COLUMN meta_mensal TYPE NUMERIC, ALTER COLUMN meta_diaria TYPE NUMERIC;");
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
