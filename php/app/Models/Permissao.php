<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Tabela `permissoes`: existir a linha (usuario, modulo, acao) = acao liberada. */
class Permissao extends Model
{
    protected $table = 'permissoes';
    protected $primaryKey = null;
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['usuario_id', 'modulo', 'acao'];
}
