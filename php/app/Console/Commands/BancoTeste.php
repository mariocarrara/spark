<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PDO;

/**
 * (Re)cria o banco de TESTES a partir do migracao/schema.sql (o mesmo de producao).
 *   php artisan spark:banco-teste
 * So aceita banco cujo nome termina em "_test" (nunca apaga o banco de verdade).
 */
class BancoTeste extends Command
{
    protected $signature = 'spark:banco-teste {--banco=spark_test}';
    protected $description = 'Recria o banco de testes (spark_test) com o schema.sql';

    public function handle(): int
    {
        $banco = (string) $this->option('banco');
        if (! preg_match('/^[a-z0-9_]+_test$/', $banco)) {
            $this->error('Por seguranca, o nome do banco de testes precisa terminar em _test.');

            return self::FAILURE;
        }
        $c = config('database.connections.pgsql');
        $dsn = fn (string $db) => "pgsql:host={$c['host']};port={$c['port']};dbname={$db}";

        $adm = new PDO($dsn('postgres'), $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $existe = $adm->prepare('SELECT 1 FROM pg_database WHERE datname = ?');
        $existe->execute([$banco]);
        if (! $existe->fetchColumn()) {
            $adm->exec('CREATE DATABASE "'.$banco.'"');
            $this->info("Banco {$banco} criado.");
        }

        $schema = base_path('../migracao/schema.sql');
        if (! is_file($schema)) {
            $this->error("Nao achei {$schema}");

            return self::FAILURE;
        }
        $pdo = new PDO($dsn($banco), $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->exec(file_get_contents($schema)); // o schema.sql faz DROP/CREATE do schema "spark"
        $n = $pdo->query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'spark'")->fetchColumn();
        $this->info("Schema carregado em {$banco}: {$n} tabelas.");

        return self::SUCCESS;
    }
}
