<?php

namespace App\Console\Commands;

use App\Models\Usuario;
use App\Services\Auditoria;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Cria (ou reativa) um administrador numa instalacao limpa. A senha e pedida no
 * terminal (nao fica em historico de comando nem em arquivo).
 *   php artisan spark:admin-semente admin@empresa.com.br "Nome do Admin"
 */
class AdminSemente extends Command
{
    protected $signature = 'spark:admin-semente {email} {nome} {--senha-env= : le a senha desta variavel de ambiente (sem perguntar)} {--so-se-nao-houver-admin : nao faz nada se ja existir administrador ativo}';
    protected $description = 'Cria ou reativa um usuario Administrador (instalacao limpa)';

    public function handle(): int
    {
        if ($this->option('so-se-nao-houver-admin') && Usuario::where('perfil_base', Usuario::ADMIN)->where('status_conta', 'Ativo')->exists()) {
            $this->info('Ja existe administrador; nada a fazer (pode apagar SPARK_ADMIN_EMAIL/SPARK_ADMIN_SENHA do Render).');

            return self::SUCCESS;
        }

        $email = mb_strtolower(trim($this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('E-mail invalido.');

            return self::FAILURE;
        }

        $min = config('spark.senha_min');
        if ($var = $this->option('senha-env')) {
            // modo sem terminal (Render sem Shell): a senha vem de uma variavel de ambiente
            $senha = (string) getenv($var);
        } else {
            $senha = (string) $this->secret('Senha do administrador');
            if ($senha !== '' && $senha !== (string) $this->secret('Repita a senha')) {
                $this->error('As senhas nao conferem.');

                return self::FAILURE;
            }
        }
        if (mb_strlen($senha) < $min) {
            $this->error("A senha precisa ter pelo menos {$min} caracteres.");

            return self::FAILURE;
        }

        $usuario = Usuario::whereRaw('lower(email) = ?', [$email])->first()
            ?? new Usuario(['id' => 'u-'.Str::uuid()->toString(), 'email' => $email]);
        $novo = ! $usuario->exists;
        $usuario->nome = $this->argument('nome');
        $usuario->perfil_base = Usuario::ADMIN;
        $usuario->status_conta = 'Ativo';
        $usuario->senha_hash = Hash::make($senha);
        $usuario->senha_legada = null;
        $usuario->save();

        Auditoria::registrar($novo ? 'criar' : 'alterar', 'usuarios', $usuario->id, null, ['origem' => 'spark:admin-semente', 'perfil' => Usuario::ADMIN]);
        $this->info(($novo ? 'Administrador criado: ' : 'Administrador atualizado: ').$usuario->id);

        return self::SUCCESS;
    }
}
