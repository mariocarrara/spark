<?php

use App\Http\Controllers\Api\AjudaController;
use App\Http\Controllers\Api\AjusteController;
use App\Http\Controllers\Api\AlertasController;
use App\Http\Controllers\Api\AppRlController;
use App\Http\Controllers\Api\AtivosController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CadastroController;
use App\Http\Controllers\Api\CamadasController;
use App\Http\Controllers\Api\CamadasRedeController;
use App\Http\Controllers\Api\EquipeController;
use App\Http\Controllers\Api\FeriadoController;
use App\Http\Controllers\Api\HistoricoController;
use App\Http\Controllers\Api\ImportacaoBasesController;
use App\Http\Controllers\Api\ImportacaoController;
use App\Http\Controllers\Api\ImportacaoGridController;
use App\Http\Controllers\Api\ImportacaoRedeController;
use App\Http\Controllers\Api\IndisponibilidadeController;
use App\Http\Controllers\Api\JustificativaController;
use App\Http\Controllers\Api\ListaController;
use App\Http\Controllers\Api\ManutencaoController;
use App\Http\Controllers\Api\NixController;
use App\Http\Controllers\Api\MapaRedeController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\PendenteController;
use App\Http\Controllers\Api\PermissaoController;
use App\Http\Controllers\Api\PrefeiturasController;
use App\Http\Controllers\Api\ProgramacaoController;
use App\Http\Controllers\Api\RankController;
use App\Http\Controllers\Api\RegrasController;
use App\Http\Controllers\Api\RegistrosController;
use App\Http\Controllers\Api\UsuarioController;
use Illuminate\Support\Facades\Route;

// Prefixo /api (bootstrap/app.php). Contrato: migracao/INVENTARIO_API.md.

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'backend' => 'laravel', // o front mostra recursos que so existem no sistema novo
    'hora' => now()->toIso8601String(),
    'usuario' => request()->user('api')?->nome ?? 'Anônimo',
]));

// Publicas
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/usuarios/solicitar-cadastro', [UsuarioController::class, 'solicitarCadastro'])->middleware('throttle:5,10');

Route::middleware('auth:api')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/trocar-senha', [AuthController::class, 'trocarSenha']);

    // Usuarios (a permissao de cada acao e conferida no controller, com a mensagem do legado)
    Route::get('/usuarios', [UsuarioController::class, 'index']);
    Route::get('/usuarios/solicitacoes', [UsuarioController::class, 'solicitacoes']);
    Route::post('/usuarios/solicitacoes/{id}/aprovar', [UsuarioController::class, 'aprovar']);
    Route::post('/usuarios/solicitacoes/{id}/recusar', [UsuarioController::class, 'recusar']);
    Route::patch('/usuarios/{id}/liberar', [UsuarioController::class, 'liberar']);
    Route::patch('/usuarios/{id}/bloquear', [UsuarioController::class, 'bloquear']);
    Route::patch('/usuarios/{id}/desbloquear', [UsuarioController::class, 'desbloquear']);
    Route::patch('/usuarios/{id}/senha', [UsuarioController::class, 'redefinirSenha']);
    Route::delete('/usuarios/{id}', [UsuarioController::class, 'destroy']);

    Route::get('/permissoes/{usuarioId}', [PermissaoController::class, 'show']);
    Route::put('/permissoes/{usuarioId}', [PermissaoController::class, 'update']);

    // Cadastros
    Route::get('/equipes', [EquipeController::class, 'index']);
    Route::get('/equipes/sem-cadastro', [EquipeController::class, 'semCadastro']);
    Route::post('/equipes/cadastrar-varias', [EquipeController::class, 'cadastrarVarias']);
    Route::post('/equipes', [EquipeController::class, 'store']);
    Route::put('/equipes/{id}', [EquipeController::class, 'update']);

    Route::get('/feriados', [FeriadoController::class, 'index']);
    Route::post('/feriados', [FeriadoController::class, 'store']);

    Route::get('/listas', [ListaController::class, 'index']);
    Route::post('/listas', [ListaController::class, 'store']);
    Route::put('/listas/{id}', [ListaController::class, 'update']);
    Route::delete('/listas', [ListaController::class, 'destroyTodos']);

    Route::get('/indisponibilidades', [IndisponibilidadeController::class, 'index']);
    Route::post('/indisponibilidades', [IndisponibilidadeController::class, 'store']);
    Route::delete('/indisponibilidades/{id}', [IndisponibilidadeController::class, 'destroy']);

    Route::get('/importacao/log', [ImportacaoController::class, 'log']);

    // Gestao de Bases > camadas de rede (lista e apagar; a importacao de KMZ/Shapefile ainda nao foi portada)
    Route::get('/importacao/camadas', [CamadasRedeController::class, 'index']);
    Route::get('/importacao/camadas/{camada}/exportar', [CamadasRedeController::class, 'exportar']);
    Route::post('/importacao/camadas/{camada}/alimentador', [CamadasRedeController::class, 'importarAlimentador']);
    Route::delete('/importacao/camadas/{camada}', [CamadasRedeController::class, 'destroyCamada']);
    Route::delete('/importacao/camadas/{camada}/{chave}', [CamadasRedeController::class, 'destroyAlimentador'])->where('chave', '.+');

    // Mapa de Manutencao
    Route::get('/manutencao/os', [ManutencaoController::class, 'os']);
    Route::get('/manutencao/vera-mapa', [CamadasController::class, 'veraMapa']);
    Route::get('/postes/resumo', [CamadasController::class, 'postesResumo']);
    Route::get('/postes/area', [CamadasController::class, 'postesArea']);
    Route::get('/postes/lista', [CamadasController::class, 'postesLista']);
    Route::get('/equip/resumo', [CamadasController::class, 'equipResumo']);
    Route::get('/equip/area', [CamadasController::class, 'equipArea']);
    Route::get('/equip/poste', [CamadasController::class, 'equipPoste']);
    Route::get('/equip/lista', [CamadasController::class, 'equipLista']);
    Route::get('/equip/cadastro', [CamadasController::class, 'equipCadastro']);
    Route::get('/equip/conferencia', [CamadasController::class, 'equipConferencia']);
    Route::delete('/postes', [AtivosController::class, 'apagarPostes']);
    Route::post('/postes/aplicar', [AtivosController::class, 'aplicar']);
    Route::delete('/equip', [AtivosController::class, 'apagarEquip']);
    Route::post('/importacao/resetar-tudo', [AtivosController::class, 'resetarTudo']);
    Route::get('/manutencao/localidades-mapa', [ManutencaoController::class, 'localidadesMapa']);
    Route::get('/manutencao/camadas', [MapaRedeController::class, 'camadas']);
    Route::get('/manutencao/km-rede-resumo', [MapaRedeController::class, 'kmRedeResumo']);
    Route::get('/cadastros/conjuntos/mapa', [ManutencaoController::class, 'conjuntosMapa']);

    // Gestao de Bases: listagem paginada, novo, editar, excluir (flag), restaurar, apagar tudo
    Route::get('/cadastros/{base}', [CadastroController::class, 'index']);
    Route::get('/cadastros/{base}/exportar', [CadastroController::class, 'exportar']);
    Route::post('/cadastros/{base}/importar/iniciar', [CadastroController::class, 'importarIniciar']);
    Route::post('/cadastros/{base}/importar/{lote}/parte', [CadastroController::class, 'importarParte']);
    Route::post('/cadastros/{base}/importar/{lote}/aplicar', [CadastroController::class, 'importarAplicar']);
    Route::post('/cadastros/{base}', [CadastroController::class, 'store']);
    Route::delete('/cadastros/{base}', [CadastroController::class, 'destroyTodos']);
    Route::post('/cadastros/{base}/{chave}/restaurar', [CadastroController::class, 'restaurar'])->where('chave', '.+');
    Route::put('/cadastros/{base}/{chave}', [CadastroController::class, 'update'])->where('chave', '.+');
    Route::delete('/cadastros/{base}/{chave}', [CadastroController::class, 'destroy'])->where('chave', '.+');
    Route::get('/ajustes', [AjusteController::class, 'index']);
    // o numero da OS tem "/" (ex.: AUDTUP1  000304/2026): {osId} aceita barra
    Route::put('/ajustes/{osId}', [AjusteController::class, 'salvar'])->where('osId', '.+');
    Route::delete('/ajustes/{osId}', [AjusteController::class, 'remover'])->where('osId', '.+');

    // Alertas (calculados no navegador; aqui so parametros e tratamento)
    Route::get('/alertas/config', [AlertasController::class, 'config']);
    Route::put('/alertas/config', [AlertasController::class, 'salvarConfig']);
    Route::delete('/alertas/config', [AlertasController::class, 'apagarConfig']);
    Route::get('/alertas/tratados', [AlertasController::class, 'tratados']);
    Route::put('/alertas/tratados', [AlertasController::class, 'tratar']);

    // Ajuda (perguntas e respostas do chat)
    Route::get('/ajuda', [AjudaController::class, 'index']);
    Route::post('/ajuda', [AjudaController::class, 'store']);
    Route::put('/ajuda/{id}', [AjudaController::class, 'update']);

    // Prefeituras e Logistica
    Route::get('/prefeituras', [PrefeiturasController::class, 'index']);
    Route::get('/prefeituras/config', [PrefeiturasController::class, 'config']);
    Route::put('/prefeituras/config/{municipio}', [PrefeiturasController::class, 'salvarConfig'])->where('municipio', '.+');
    Route::post('/prefeituras/salvar-pacote', [PrefeiturasController::class, 'salvarPacote']);
    Route::get('/logistica/{qual}', [PrefeiturasController::class, 'logistica'])->where('qual', 'equipes|programacoes|os|vinculos');

    // Pontos Nix e Rank de prioridade
    Route::get('/nix', [NixController::class, 'index']);
    Route::post('/nix', [NixController::class, 'store']);
    Route::put('/nix', [NixController::class, 'raio']);
    Route::delete('/nix', [NixController::class, 'destroy']);
    Route::get('/rank', [RankController::class, 'index']);
    Route::post('/rank', [RankController::class, 'store']);
    Route::get('/rank/{id}', [RankController::class, 'show']);
    Route::delete('/rank/{id}', [RankController::class, 'destroy']);

    // Configuracao > Regras de importacao (v3.33)
    Route::get('/regras', [RegrasController::class, 'index']);
    Route::get('/regras/historico', [RegrasController::class, 'historico']);
    Route::post('/regras/validar', [RegrasController::class, 'validar']);
    Route::post('/regras/simular', [RegrasController::class, 'simular']);
    Route::post('/regras', [RegrasController::class, 'store']);
    Route::put('/regras/{id}', [RegrasController::class, 'update']);
    Route::delete('/regras/{id}', [RegrasController::class, 'destroy']);

    // OS x APP / Reserva Legal
    Route::get('/apprl/indice', [AppRlController::class, 'indice']);
    Route::get('/apprl/config', [AppRlController::class, 'config']);
    Route::put('/apprl/config', [AppRlController::class, 'salvarConfig']);
    Route::post('/apprl/recalcular', [AppRlController::class, 'recalcular']);

    // Historico de podas por plano
    Route::get('/historico/planos', [HistoricoController::class, 'planos']);
    Route::get('/historico/os', [HistoricoController::class, 'os']);
    Route::get('/historico/exportar', [HistoricoController::class, 'exportar']);
    Route::get('/historico/mapa', [HistoricoController::class, 'mapa']);
    Route::delete('/historico/planos/{plano}', [HistoricoController::class, 'apagarPlano']);
    Route::post('/historico/planos/{plano}/importar', [HistoricoController::class, 'importarPlano']);

    // Metas e Justificativas (a produtividade e calculada no navegador)
    Route::get('/metas', [MetaController::class, 'index']);
    Route::post('/metas', [MetaController::class, 'store']);
    Route::put('/metas/{id}', [MetaController::class, 'update']);
    Route::get('/justificativas', [JustificativaController::class, 'index']);
    Route::post('/justificativas', [JustificativaController::class, 'store']);
    Route::delete('/justificativas/{id}', [JustificativaController::class, 'destroy']);

    // Gestao de Bases: exportar/importar Programacoes, Ajustes de OS e os logs deles
    Route::get('/registros/{base}/exportar', [RegistrosController::class, 'exportar']);
    Route::post('/registros/{base}/importar', [RegistrosController::class, 'importar']);

    // Programacao
    Route::get('/programacao', [ProgramacaoController::class, 'index']);
    Route::post('/programacao', [ProgramacaoController::class, 'store']);
    Route::get('/programacao/buscar-protecao', [ProgramacaoController::class, 'buscarProtecao']);
    Route::get('/programacao/protecao-proxima', [ProgramacaoController::class, 'protecaoProxima']);
    Route::get('/programacao/logistica', [ProgramacaoController::class, 'logistica']);
    Route::post('/programacao/zerar', [ProgramacaoController::class, 'zerar']);
    Route::get('/programacao/{id}/log', [ProgramacaoController::class, 'log']);
    Route::patch('/programacao/{id}/status', [ProgramacaoController::class, 'status']);
    Route::put('/programacao/{id}', [ProgramacaoController::class, 'update']);

    // Importacao de bases pequenas (o navegador le a planilha)
    Route::post('/importacao/validar', [ImportacaoBasesController::class, 'validar']);
    Route::post('/importacao/confirmar', [ImportacaoBasesController::class, 'confirmar']);

    // Rede MT/BT/AT (Shapefile) e Reserva Legal / APP (KMZ), com progresso ao vivo
    Route::post('/importacao/shapefile', [ImportacaoRedeController::class, 'importar']);

    // Importacao das grids de OS (SGM/SIGOD) com progresso ao vivo
    Route::post('/importacao/{segmento}', [ImportacaoGridController::class, 'podas'])
        ->where('segmento', 'podas-executado|podas-pendente|podas-historico|podas-sigod|podas-sigod-pendente');

    // TRANSICAO: modulos ainda nao portados que o front le ao abrir (respondem vazio)
    foreach (array_keys(PendenteController::PENDENTES) as $rota) {
        Route::get('/'.$rota, [PendenteController::class, 'vazio'])->defaults('rota', $rota);
    }
});

// Qualquer outra rota /api: ainda nao migrada (mensagem clara na tela em vez de erro generico)
Route::fallback([PendenteController::class, 'naoMigrado']);
