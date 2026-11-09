<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tabela `usuarios` do schema.sql (o schema e a fonte da verdade; o Laravel nao cria esta tabela).
 */
class Usuario extends Model implements AuthenticatableContract
{
    use Authenticatable;

    public const ADMIN = 'Administrador';

    protected $table = 'usuarios';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['id', 'nome', 'email', 'status_conta', 'perfil_base'];

    // Nunca sai em JSON.
    protected $hidden = ['senha_hash', 'senha_legada'];

    protected function casts(): array
    {
        return ['criado_em' => 'datetime', 'ultimo_login' => 'datetime'];
    }

    public function getAuthPassword(): string
    {
        return (string) $this->senha_hash;
    }

    public function getRememberTokenName(): string
    {
        return ''; // sem "lembrar-me" por cookie
    }

    public function permissoes(): HasMany
    {
        return $this->hasMany(Permissao::class, 'usuario_id');
    }

    public function ativo(): bool
    {
        return $this->status_conta === 'Ativo';
    }

    public function isAdmin(): bool
    {
        return $this->ativo() && $this->perfil_base === self::ADMIN;
    }

    /** Mesma regra do Test-Permissao do legado: admin ativo pode tudo; os demais, pela matriz. */
    public function pode(string $modulo, string $acao): bool
    {
        if (! $this->ativo()) {
            return false;
        }
        if ($this->perfil_base === self::ADMIN) {
            return true;
        }

        return $this->permissoes()->where('modulo', $modulo)->where('acao', $acao)->exists();
    }

    /** Formato que o front legado espera em /auth/login e /auth/me. */
    public function paraFront(): array
    {
        return ['id' => $this->id, 'nome' => $this->nome, 'email' => $this->email, 'perfilBase' => $this->perfil_base];
    }
}
