# =============================================================================
# routes/usuarios.ps1 — Módulo 6: Usuários e Permissões (Escopo, seção 8)
# =============================================================================

function Invoke-UsuariosRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # POST /api/usuarios/cadastro — fica PendenteAprovacao até liberação (8.1)
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "cadastro") {
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        if ($usuarios | Where-Object { $_.email -eq $Body.email }) {
            return @{ status = 409; body = @{ erro = "Já existe um usuário cadastrado com este e-mail." } }
        }
        if ([string]::IsNullOrWhiteSpace($Body.senha)) {
            return @{ status = 400; body = @{ erro = "Informe uma senha." } }
        }
        $novo = @{
            id = New-EntityId -Prefix "u"
            nome = $Body.nome
            email = $Body.email
            senha = (ConvertTo-SenhaOfuscada -Texto $Body.senha)
            statusConta = "PendenteAprovacao"
            perfilBase = if ($Body.perfilBase) { $Body.perfilBase } else { "Consulta" }
        }
        $usuarios += $novo
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        return @{ status = 201; body = @{ id = $novo.id; nome = $novo.nome; email = $novo.email; statusConta = $novo.statusConta } }
    }

    # POST /api/usuarios/solicitar-cadastro { email } - PUBLICA (tela de login).
    # So guarda o pedido em model/solicitacoes_cadastro.json; quem libera (ou
    # recusa) e o administrador, na tela Usuarios & Permissoes. Resposta sempre
    # generica pra nao servir de "consulta de e-mails cadastrados".
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "solicitar-cadastro") {
        $email = if ($Body.email) { "$($Body.email)".Trim().ToLower() } else { "" }
        if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
            return @{ status = 400; body = @{ erro = "Informe um e-mail válido." } }
        }
        # v3.16.1 - a propria pessoa escolhe a senha no pedido (o admin so aprova)
        $senhaPedido = if ($null -ne $Body.senha) { "$($Body.senha)" } else { "" }
        if ($senhaPedido.Length -lt 8 -or $senhaPedido.Length -gt 72) {
            return @{ status = 400; body = @{ erro = "Escolha uma senha de 8 a 72 caracteres." } }
        }
        $nomePedido = if ($Body.nome) { "$($Body.nome)".Trim() } else { "" }
        if ($nomePedido.Length -gt 120) { $nomePedido = $nomePedido.Substring(0, 120) }
        if ([string]::IsNullOrWhiteSpace($nomePedido)) { $nomePedido = $email.Split("@")[0] }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $jaUsuario = @($usuarios | Where-Object { $_.email -and $_.email.Trim().ToLower() -eq $email })
        $solic = @(Read-JsonModel -Entity "solicitacoes_cadastro")
        $jaPedido = @($solic | Where-Object { $_.email -eq $email -and $_.status -eq "Pendente" })
        if ($jaUsuario.Count -eq 0 -and $jaPedido.Count -eq 0) {
            $solic += @{ id = (New-EntityId -Prefix "s"); email = $email; status = "Pendente"; criadoEm = (Get-IsoNow) }
            Write-JsonModel -Entity "solicitacoes_cadastro" -Data $solic
            # aparece na lista de Usuarios como "pendente", ja com a senha que a
            # pessoa escolheu; o login so passa depois da aprovacao (statusConta Ativo)
            $usuarios += @{
                id = (New-EntityId -Prefix "u"); nome = $nomePedido; email = $email
                senha = (ConvertTo-SenhaOfuscada -Texto $senhaPedido)
                statusConta = "PendenteAprovacao"; perfilBase = "Consulta"; origem = "solicitacao"; senhaDefinida = $true
            }
            Write-JsonModel -Entity "usuarios" -Data $usuarios
        }
        return @{ status = 200; body = @{ ok = $true; mensagem = "Pedido recebido. Um administrador vai analisar e liberar seu acesso." } }
    }

    # GET /api/usuarios/solicitacoes - pedidos pendentes (so quem edita Usuarios)
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "solicitacoes") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver solicitações de cadastro." } }
        }
        $pend = @(Read-JsonModel -Entity "solicitacoes_cadastro" | Where-Object { $_.status -eq "Pendente" })
        # v3.16.1 - nome e temSenha (a pessoa ja escolheu a propria senha) vem do usuario pendente
        $usuariosPend = @(Read-JsonModel -Entity "usuarios" | Where-Object { $_.statusConta -eq "PendenteAprovacao" })
        $lista = foreach ($sp in $pend) {
            $em = "$($sp.email)".Trim().ToLower()
            $up = $usuariosPend | Where-Object { $_.email -and "$($_.email)".Trim().ToLower() -eq $em } | Select-Object -First 1
            @{ id = $sp.id; email = $sp.email; status = $sp.status; criadoEm = $sp.criadoEm
               nome = if ($up) { $up.nome } else { $null }
               temSenha = [bool]($up -and $up.senhaDefinida -eq $true) }
        }
        return @{ status = 200; body = @($lista) }
    }

    # POST /api/usuarios/solicitacoes/{id}/aprovar { nome, perfilBase, senha } -
    # cria o usuario ATIVO (a pessoa so informou e-mail, entao o admin define
    # nome e senha inicial) com a matriz do perfil-modelo escolhido.
    if ($Method -eq "POST" -and $Segments.Count -eq 3 -and $Segments[0] -eq "solicitacoes" -and $Segments[2] -eq "aprovar") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para aprovar cadastros." } }
        }
        $solic = @(Read-JsonModel -Entity "solicitacoes_cadastro")
        $idx = 0..($solic.Count - 1) | Where-Object { $solic[$_].id -eq $Segments[1] } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Solicitação não encontrada." } } }
        if ($solic[$idx].status -ne "Pendente") { return @{ status = 409; body = @{ erro = "Essa solicitação já foi decidida." } } }
        $perfil = if ($Body.perfilBase) { $Body.perfilBase } else { "Consulta" }
        $email = "$($solic[$idx].email)".Trim().ToLower()
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $uidx = $null
        for ($i = 0; $i -lt $usuarios.Count; $i++) {
            if ($usuarios[$i].email -and "$($usuarios[$i].email)".Trim().ToLower() -eq $email) { $uidx = $i; break }
        }
        # v3.16.1 - senha opcional quando a pessoa ja escolheu a dela no pedido;
        # se o admin informar uma, ela substitui a escolhida.
        $jaTemSenha = ($null -ne $uidx -and $usuarios[$uidx].statusConta -eq "PendenteAprovacao" -and $usuarios[$uidx].senhaDefinida -eq $true)
        $senhaAprov = if ($null -ne $Body.senha) { "$($Body.senha)" } else { "" }
        if (($senhaAprov -eq "" -and -not $jaTemSenha) -or ($senhaAprov -ne "" -and $senhaAprov.Length -lt 8)) {
            return @{ status = 400; body = @{ erro = "Defina uma senha inicial (mínimo 8 caracteres)." } }
        }
        $nome = if ($Body.nome -and "$($Body.nome)".Trim()) { "$($Body.nome)".Trim() } elseif ($null -ne $uidx -and $usuarios[$uidx].nome) { $usuarios[$uidx].nome } else { $email.Split("@")[0] }
        if ($null -ne $uidx -and $usuarios[$uidx].statusConta -eq "Ativo") {
            # ja existe e ativo (ex.: aprovacao anterior que parou no meio): so fecha o pedido
            $userId = $usuarios[$uidx].id; $nome = $usuarios[$uidx].nome
        } elseif ($null -ne $uidx) {
            # usuario pendente criado pelo pedido: ativa, define nome/senha/perfil
            $userId = $usuarios[$uidx].id
            Set-PropValor $usuarios[$uidx] "nome" $nome
            if ($senhaAprov -ne "") { Set-PropValor $usuarios[$uidx] "senha" (ConvertTo-SenhaOfuscada -Texto $senhaAprov) }
            Set-PropValor $usuarios[$uidx] "statusConta" "Ativo"
            Set-PropValor $usuarios[$uidx] "perfilBase" $perfil
            Write-JsonModel -Entity "usuarios" -Data $usuarios
        } else {
            $userId = New-EntityId -Prefix "u"
            $usuarios += @{
                id = $userId; nome = $nome; email = $email
                senha = (ConvertTo-SenhaOfuscada -Texto $senhaAprov)
                statusConta = "Ativo"; perfilBase = $perfil
            }
            Write-JsonModel -Entity "usuarios" -Data $usuarios
        }
        $permissoes = @(Read-JsonModel -Entity "permissoes")
        if (@($permissoes | Where-Object { $_.usuarioId -eq $userId }).Count -eq 0) {
            $permissoes += @{ usuarioId = $userId; perfilBase = $perfil; matriz = (Get-PerfilModelo -Perfil $perfil) }
            Write-JsonModel -Entity "permissoes" -Data $permissoes
        }
        Set-PropValor $solic[$idx] "status" "Aprovada"
        Set-PropValor $solic[$idx] "decididoEm" (Get-IsoNow)
        Set-PropValor $solic[$idx] "decididoPor" $Usuario.nome
        Write-JsonModel -Entity "solicitacoes_cadastro" -Data $solic
        return @{ status = 200; body = @{ id = $userId; nome = $nome; email = $email; statusConta = "Ativo"; perfilBase = $perfil } }
    }

    # POST /api/usuarios/solicitacoes/{id}/recusar
    if ($Method -eq "POST" -and $Segments.Count -eq 3 -and $Segments[0] -eq "solicitacoes" -and $Segments[2] -eq "recusar") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para recusar cadastros." } }
        }
        $solic = @(Read-JsonModel -Entity "solicitacoes_cadastro")
        $idx = 0..($solic.Count - 1) | Where-Object { $solic[$_].id -eq $Segments[1] } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Solicitação não encontrada." } } }
        $emailRec = "$($solic[$idx].email)".Trim().ToLower()
        Set-PropValor $solic[$idx] "status" "Recusada"
        Set-PropValor $solic[$idx] "decididoEm" (Get-IsoNow)
        Set-PropValor $solic[$idx] "decididoPor" $Usuario.nome
        Write-JsonModel -Entity "solicitacoes_cadastro" -Data $solic
        # remove o usuario pendente criado por esse pedido (nunca um ja ativo)
        $todos = @(Read-JsonModel -Entity "usuarios")
        $resto = @($todos | Where-Object { -not ($_.email -and "$($_.email)".Trim().ToLower() -eq $emailRec -and $_.statusConta -eq "PendenteAprovacao" -and $_.origem -eq "solicitacao") })
        if ($resto.Count -ne $todos.Count) { Write-JsonModel -Entity "usuarios" -Data $resto }
        return @{ status = 200; body = @{ id = $solic[$idx].id; status = "Recusada" } }
    }

    # GET /api/usuarios (qualquer usuário logado - a tela de Usuários já
    # esconde as ações de quem não tem permissão de editar)
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        $usuarios = @(Read-JsonModel -Entity "usuarios") | ForEach-Object {
            @{ id = $_.id; nome = $_.nome; email = $_.email; statusConta = $_.statusConta; perfilBase = $_.perfilBase }
        }
        return @{ status = 200; body = @($usuarios) }
    }

    # PATCH /api/usuarios/{id}/liberar
    if ($Method -eq "PATCH" -and $Segments.Count -eq 2 -and $Segments[1] -eq "liberar") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para liberar Usuários." } }
        }
        $id = $Segments[0]
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $idx = 0..($usuarios.Count - 1) | Where-Object { $usuarios[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }

        Set-PropValor $usuarios[$idx] "statusConta" "Ativo"
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        $emailLib = "$($usuarios[$idx].email)".Trim().ToLower()
        $solicLib = @(Read-JsonModel -Entity "solicitacoes_cadastro")
        $mudou = $false
        foreach ($sl in $solicLib) {
            if ($sl.status -eq "Pendente" -and "$($sl.email)".Trim().ToLower() -eq $emailLib) {
                Set-PropValor $sl "status" "Aprovada"; Set-PropValor $sl "decididoEm" (Get-IsoNow); $mudou = $true
            }
        }
        if ($mudou) { Write-JsonModel -Entity "solicitacoes_cadastro" -Data $solicLib }

        # cria a matriz de permissões a partir do perfil-modelo (Escopo 8.3)
        $perfilModelo = Get-PerfilModelo -Perfil $usuarios[$idx].perfilBase
        $permissoes = @(Read-JsonModel -Entity "permissoes")
        $jaExiste = $permissoes | Where-Object { $_.usuarioId -eq $id }
        if (-not $jaExiste) {
            $permissoes += @{ usuarioId = $id; perfilBase = $usuarios[$idx].perfilBase; matriz = $perfilModelo }
            Write-JsonModel -Entity "permissoes" -Data $permissoes
        }
        return @{ status = 200; body = $usuarios[$idx] }
    }

    # PATCH /api/usuarios/{id}/bloquear
    if ($Method -eq "PATCH" -and $Segments.Count -eq 2 -and $Segments[1] -eq "bloquear") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para bloquear Usuários." } }
        }
        $id = $Segments[0]
        if ($id -eq $Usuario.usuarioId) { return @{ status = 400; body = @{ erro = "Você não pode bloquear a própria conta." } } }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $idx = 0..($usuarios.Count - 1) | Where-Object { $usuarios[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }
        $usuarios[$idx].statusConta = "Bloqueado"
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        return @{ status = 200; body = $usuarios[$idx] }
    }

    # PATCH /api/usuarios/{id}/desbloquear
    if ($Method -eq "PATCH" -and $Segments.Count -eq 2 -and $Segments[1] -eq "desbloquear") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para desbloquear Usuários." } }
        }
        $id = $Segments[0]
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $idx = 0..($usuarios.Count - 1) | Where-Object { $usuarios[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }
        $usuarios[$idx].statusConta = "Ativo"
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        return @{ status = 200; body = $usuarios[$idx] }
    }

    # DELETE /api/usuarios/{id} (v2.15.12) - exclui de vez um usuario BLOQUEADO.
    # So quem tem "Excluir/Status" em Usuarios; nao exclui a si mesmo e nao
    # exclui quem nao esta bloqueado (bloquear primeiro e a trava de seguranca).
    # Remove tambem a matriz de permissoes e derruba sessoes abertas dele.
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para excluir Usuários." } }
        }
        $id = $Segments[0]
        if ($id -eq $Usuario.usuarioId) { return @{ status = 400; body = @{ erro = "Você não pode excluir a própria conta." } } }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $alvo = $usuarios | Where-Object { $_.id -eq $id } | Select-Object -First 1
        if ($null -eq $alvo) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }
        if ($alvo.statusConta -ne "Bloqueado") {
            return @{ status = 409; body = @{ erro = "Só é possível excluir usuários bloqueados. Bloqueie o acesso primeiro." } }
        }
        $restantes = @($usuarios | Where-Object { $_.id -ne $id })
        Write-JsonModel -Entity "usuarios" -Data $restantes
        $permissoes = @(Read-JsonModel -Entity "permissoes")
        if ($permissoes | Where-Object { $_.usuarioId -eq $id }) {
            Write-JsonModel -Entity "permissoes" -Data @($permissoes | Where-Object { $_.usuarioId -ne $id })
        }
        foreach ($tk in @($Script:Sessions.Keys)) {
            if ($Script:Sessions[$tk].usuarioId -eq $id) { $Script:Sessions.Remove($tk) }
        }
        return @{ status = 200; body = @{ ok = $true; id = $id } }
    }

    # PATCH /api/usuarios/{id}/senha — um administrador redefine a senha de
    # outro usuário, sem precisar saber a senha atual (ex.: usuário esqueceu).
    if ($Method -eq "PATCH" -and $Segments.Count -eq 2 -and $Segments[1] -eq "senha") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para redefinir senha de outro usuário." } }
        }
        $id = $Segments[0]
        if ([string]::IsNullOrWhiteSpace($Body.senhaNova) -or $Body.senhaNova.Length -lt 3) {
            return @{ status = 400; body = @{ erro = "A senha precisa ter pelo menos 3 caracteres." } }
        }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $idx = 0..($usuarios.Count - 1) | Where-Object { $usuarios[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }
        $usuarios[$idx].senha = (ConvertTo-SenhaOfuscada -Texto $Body.senhaNova)
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        return @{ status = 200; body = @{ ok = $true } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/usuarios." } }
}

function Invoke-PermissoesRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/permissoes/{usuarioId}
    if ($Method -eq "GET" -and $Segments.Count -eq 1) {
        $usuarioId = $Segments[0]
        $matriz = Get-UserPermissions -UsuarioId $usuarioId
        return @{ status = 200; body = @{ usuarioId = $usuarioId; matriz = $matriz } }
    }

    # PUT /api/permissoes/{usuarioId}
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar matriz de permissões." } }
        }
        $usuarioId = $Segments[0]
        $permissoes = @(Read-JsonModel -Entity "permissoes")
        $idx = 0..($permissoes.Count - 1) | Where-Object { $permissoes[$_].usuarioId -eq $usuarioId } | Select-Object -First 1
        if ($null -eq $idx) {
            $permissoes += @{ usuarioId = $usuarioId; perfilBase = $Body.perfilBase; matriz = $Body.matriz }
        } else {
            $permissoes[$idx].matriz = $Body.matriz
            if ($Body.perfilBase) { $permissoes[$idx].perfilBase = $Body.perfilBase }
        }
        Write-JsonModel -Entity "permissoes" -Data $permissoes
        return @{ status = 200; body = @{ usuarioId = $usuarioId; matriz = $Body.matriz } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/permissoes." } }
}

function Invoke-AuthRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # POST /api/auth/login — pública (não precisa de token pra chamar essa)
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "login") {
        $email = if ($Body.email) { $Body.email.Trim().ToLower() } else { "" }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $usuario = $usuarios | Where-Object { $_.email -and $_.email.Trim().ToLower() -eq $email } | Select-Object -First 1
        if (-not $usuario) { return @{ status = 401; body = @{ erro = "E-mail ou senha inválidos." } } }
        if (-not (Test-SenhaUsuario -SenhaDigitada $Body.senha -SenhaGravada $usuario.senha)) {
            return @{ status = 401; body = @{ erro = "E-mail ou senha inválidos." } }
        }
        if ($usuario.statusConta -eq "PendenteAprovacao") { return @{ status = 403; body = @{ erro = "Cadastro pendente de liberação por um administrador." } } }
        if ($usuario.statusConta -eq "Bloqueado") { return @{ status = 403; body = @{ erro = "Usuário bloqueado. Fale com um administrador." } } }
        $token = New-Session -Usuario $usuario
        return @{ status = 200; body = @{ token = $token; usuario = @{ id = $usuario.id; nome = $usuario.nome; email = $usuario.email; perfilBase = $usuario.perfilBase } } }
    }

    # POST /api/auth/logout
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "logout") {
        return @{ status = 200; body = @{ ok = $true } }
    }

    # GET /api/auth/me — front-end usa isso pra revalidar um token salvo
    # (localStorage) quando a página é recarregada, sem pedir login de novo
    # enquanto o Controller continuar no ar.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "me") {
        if (-not $Usuario -or $Usuario.usuarioId -eq "anonimo") {
            return @{ status = 401; body = @{ erro = "Sessão inválida." } }
        }
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $usuario = $usuarios | Where-Object { $_.id -eq $Usuario.usuarioId } | Select-Object -First 1
        if (-not $usuario -or $usuario.statusConta -ne "Ativo") {
            return @{ status = 401; body = @{ erro = "Sessão inválida." } }
        }
        return @{ status = 200; body = @{ id = $usuario.id; nome = $usuario.nome; email = $usuario.email; perfilBase = $usuario.perfilBase } }
    }

    # POST /api/auth/trocar-senha — o próprio usuário troca a própria senha
    # (precisa saber a senha atual; pra "esqueci a senha" é o admin quem
    # redefine via PATCH /api/usuarios/{id}/senha).
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "trocar-senha") {
        $usuarios = @(Read-JsonModel -Entity "usuarios")
        $idx = 0..($usuarios.Count - 1) | Where-Object { $usuarios[$_].id -eq $Usuario.usuarioId } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Usuário não encontrado." } } }
        if (-not (Test-SenhaUsuario -SenhaDigitada $Body.senhaAtual -SenhaGravada $usuarios[$idx].senha)) {
            return @{ status = 401; body = @{ erro = "Senha atual incorreta." } }
        }
        if ([string]::IsNullOrWhiteSpace($Body.senhaNova) -or $Body.senhaNova.Length -lt 3) {
            return @{ status = 400; body = @{ erro = "A nova senha precisa ter pelo menos 3 caracteres." } }
        }
        $usuarios[$idx].senha = (ConvertTo-SenhaOfuscada -Texto $Body.senhaNova)
        Write-JsonModel -Entity "usuarios" -Data $usuarios
        return @{ status = 200; body = @{ ok = $true } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/auth." } }
}

function Get-PerfilModelo {
    <# Perfis pré-configurados (Escopo 8.3) — ponto de partida ajustável
       depois pelo administrador via matriz individual. #>
    param([string]$Perfil)
    $total = @{ visualizar = $true; criar = $true; editar = $true; excluirStatus = $true; importar = $true }
    switch ($Perfil) {
        "Administrador" {
            return @{ manutencao=$total; produtividade=$total; metas=$total; programacao=$total; prefeituras=$total; gestaoBases=$total; usuarios=$total }
        }
        "Programador" {
            return @{
                manutencao = @{ visualizar = $true }
                produtividade = @{ visualizar = $true }
                metas = @{ visualizar = $true }
                programacao = @{ visualizar = $true; criar = $true; editar = $true; excluirStatus = $true }
                prefeituras = @{ visualizar = $true }
                gestaoBases = @{ visualizar = $true }
                usuarios = @{}
            }
        }
        "Supervisor de Equipe" {
            return @{
                manutencao = @{ visualizar = $true }
                produtividade = @{ visualizar = $true; criar = $true }
                metas = @{ visualizar = $true }
                programacao = @{ visualizar = $true }
                prefeituras = @{}
                gestaoBases = @{ visualizar = $true }
                usuarios = @{}
            }
        }
        "Gestor/Coordenador" {
            return @{
                manutencao = @{ visualizar = $true }
                produtividade = @{ visualizar = $true }
                metas = @{ visualizar = $true; criar = $true; editar = $true; importar = $true }
                programacao = @{ visualizar = $true }
                prefeituras = @{ visualizar = $true }
                gestaoBases = @{ visualizar = $true }
                usuarios = @{}
            }
        }
        default { # Consulta
            return @{
                manutencao = @{ visualizar = $true }
                produtividade = @{ visualizar = $true }
                metas = @{ visualizar = $true }
                programacao = @{ visualizar = $true }
                prefeituras = @{ visualizar = $true }
                gestaoBases = @{ visualizar = $true }
                usuarios = @{}
            }
        }
    }
}
