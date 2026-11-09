<?php

// Regras do SPARK que nao sao do Laravel. Valores ajustaveis por .env.
return [
    // Pasta do front-end (view/ do legado), servida pelo FrontController.
    'front_dir' => env('SPARK_FRONT_DIR', base_path('../legado-powershell/view')),

    // Importar sistema antigo (Gestao de Bases): script de migracao, tamanho maximo e tempo limite.
    'migrar_script' => env('SPARK_MIGRAR_SCRIPT', base_path('../migracao/migrar.php')),
    'legado_max_mb' => (int) env('SPARK_LEGADO_MAX_MB', 4096),
    'legado_timeout_s' => (int) env('SPARK_LEGADO_TIMEOUT_S', 3600),

    // Validade do token de sessao (horas). Renovado a cada uso (janela deslizante).
    'sessao_horas' => (int) env('SPARK_SESSAO_HORAS', 12),

    // Bloqueio por tentativas erradas de login (por e-mail e por IP).
    'login_max_falhas_email' => (int) env('SPARK_LOGIN_MAX_FALHAS_EMAIL', 5),
    'login_max_falhas_ip' => (int) env('SPARK_LOGIN_MAX_FALHAS_IP', 20),
    'login_janela_minutos' => (int) env('SPARK_LOGIN_JANELA_MINUTOS', 15),

    // Tamanho minimo de senha nova (o legado aceitava 3).
    'senha_min' => (int) env('SPARK_SENHA_MIN', 8),

    // Modulos e acoes da matriz de permissoes (iguais ao legado).
    'modulos' => ['manutencao', 'produtividade', 'metas', 'programacao', 'prefeituras', 'gestaoBases', 'alertas', 'prioridade', 'nix', 'usuarios'],
    'acoes' => ['visualizar', 'criar', 'editar', 'excluirStatus', 'importar'],
    // Perfis-modelo (Get-PerfilModelo do legado): matriz inicial ao aprovar/liberar um usuario.
    // "alertas.visualizar" nao existe no legado: segue manutencao.visualizar (regra alertasVisivel do front).
    'perfis' => [
        'Administrador' => '*',
        'Programador' => ['manutencao' => ['visualizar'], 'produtividade' => ['visualizar'], 'metas' => ['visualizar'], 'programacao' => ['visualizar', 'criar', 'editar', 'excluirStatus'], 'prefeituras' => ['visualizar'], 'gestaoBases' => ['visualizar']],
        'Supervisor de Equipe' => ['manutencao' => ['visualizar'], 'produtividade' => ['visualizar', 'criar'], 'metas' => ['visualizar'], 'programacao' => ['visualizar'], 'gestaoBases' => ['visualizar']],
        'Gestor/Coordenador' => ['manutencao' => ['visualizar'], 'produtividade' => ['visualizar'], 'metas' => ['visualizar', 'criar', 'editar', 'importar'], 'programacao' => ['visualizar'], 'prefeituras' => ['visualizar'], 'gestaoBases' => ['visualizar']],
        'Consulta' => ['manutencao' => ['visualizar'], 'produtividade' => ['visualizar'], 'metas' => ['visualizar'], 'programacao' => ['visualizar'], 'prefeituras' => ['visualizar'], 'gestaoBases' => ['visualizar']],
    ],
];
