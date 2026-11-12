<?php

namespace App\Console\Commands;

use App\Services\RedeGeo;
use Illuminate\Console\Command;

/** Carrega a pasta geo/ do sistema antigo (rede_mt, rede_bt, rede_at, reserva_legal, app) no banco. Substitui as camadas que existirem na pasta. */
class ImportarGeo extends Command
{
    protected $signature = 'spark:importar-geo {pasta : pasta geo/ do sistema antigo}';

    protected $description = 'Carrega a pasta geo/ do legado (Rede MT/BT/AT, Reserva Legal, APP) no PostGIS';

    public function handle(): int
    {
        $pasta = rtrim((string) $this->argument('pasta'), '/\\');
        if (! is_dir($pasta)) {
            $this->error("Pasta nao encontrada: {$pasta}");

            return self::FAILURE;
        }
        ini_set('memory_limit', '1024M');
        $t = microtime(true);
        RedeGeo::importarPasta($pasta, fn ($m) => $this->line($m));
        $this->info(sprintf('Concluido em %.0f s.', microtime(true) - $t));

        return self::SUCCESS;
    }
}
