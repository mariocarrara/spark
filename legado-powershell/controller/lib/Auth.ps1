# =============================================================================
# Auth.ps1 — login, sessão, senha e permissões
#
# Não há integração com Active Directory (definido no Escopo, seção 8.1).
# Sessão simples baseada em token opaco mantido em memória do processo
# (suficiente para o volume de 15-20 usuários e o padrão "cada usuário roda
# seu próprio processo local" da arquitetura, sempre em localhost - ver
# server.ps1). Como o processo é local por usuário, a sessão não sobrevive
# a um reinício do Controller (fechar e abrir o iniciar.bat de novo) - o
# front-end detecta isso (uma chamada de API volta 401) e mostra a tela de
# login outra vez.
#
# Senha: guardada ofuscada (NÃO é um hash criptográfico de verdade) no campo
# "senha" de model/usuarios.json, via ConvertTo-SenhaOfuscada/
# ConvertFrom-SenhaOfuscada logo abaixo — XOR byte a byte com uma chave fixa
# + Base64, pra não deixar a senha em texto puro no JSON que fica na pasta
# compartilhada de rede. Isso é reversível por quem tem acesso ao código
# (não é proteção contra um administrador do sistema), mas é o que foi
# pedido: algo simples, não uma biblioteca de criptografia de verdade.
# =============================================================================

$Script:Sessions = @{}
$Script:SenhaChaveXor = [System.Text.Encoding]::UTF8.GetBytes("SPARK-ENERGISA-2026-v1")

function New-Session {
    param([Parameter(Mandatory)]$Usuario)
    $token = [guid]::NewGuid().ToString("N")
    $Script:Sessions[$token] = @{
        usuarioId = $Usuario.id
        nome      = $Usuario.nome
        criadoEm  = Get-IsoNow
    }
    return $token
}

function Remove-Session {
    param([string]$Token)
    if (-not [string]::IsNullOrWhiteSpace($Token) -and $Script:Sessions.ContainsKey($Token)) {
        $Script:Sessions.Remove($Token)
    }
}

function Get-SessionUser {
    param([string]$Token)
    if ([string]::IsNullOrWhiteSpace($Token)) { return $null }
    return $Script:Sessions[$Token]
}

function ConvertTo-SenhaOfuscada {
    <# Ofusca uma senha em texto puro pra gravar no JSON. Reversível de
       propósito (não é hash) - ver nota no topo do arquivo. #>
    param([Parameter(Mandatory)][string]$Texto)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Texto)
    $chave = $Script:SenhaChaveXor
    $saida = New-Object byte[] ($bytes.Length)
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $saida[$i] = $bytes[$i] -bxor $chave[$i % $chave.Length]
    }
    return [Convert]::ToBase64String($saida)
}

function ConvertFrom-SenhaOfuscada {
    <# Reverte ConvertTo-SenhaOfuscada. Devolve "" se o texto não for um
       Base64 válido (ex.: usuário antigo sem senha definida ainda). #>
    param([string]$TextoOfuscado)
    if ([string]::IsNullOrEmpty($TextoOfuscado)) { return "" }
    try {
        $bytes = [Convert]::FromBase64String($TextoOfuscado)
    } catch {
        return ""
    }
    $chave = $Script:SenhaChaveXor
    $saida = New-Object byte[] ($bytes.Length)
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $saida[$i] = $bytes[$i] -bxor $chave[$i % $chave.Length]
    }
    return [System.Text.Encoding]::UTF8.GetString($saida)
}

function Test-SenhaUsuario {
    param([string]$SenhaDigitada, [string]$SenhaGravada)
    if ([string]::IsNullOrEmpty($SenhaGravada)) { return $false }
    if ($null -eq $SenhaDigitada) { $SenhaDigitada = "" }
    return (ConvertFrom-SenhaOfuscada -TextoOfuscado $SenhaGravada) -ceq $SenhaDigitada
}

function Test-ForcaSenha {
    <# v3.18.0 - regra de senha para quem ESCOLHE a própria senha (pedido de cadastro): mínimo 8 caracteres, ao menos uma
       letra e um número, não pode ser só uma sequência óbvia nem conter o e-mail. Devolve "" se estiver ok, senão o motivo. #>
    param([string]$Senha, [string]$Email)
    if ([string]::IsNullOrEmpty($Senha) -or $Senha.Length -lt 8) { return "A senha precisa ter pelo menos 8 caracteres." }
    if ($Senha.Length -gt 128) { return "A senha é longa demais (máximo 128 caracteres)." }
    if ($Senha -notmatch '[A-Za-z]') { return "Use pelo menos uma letra na senha." }
    if ($Senha -notmatch '[0-9]') { return "Use pelo menos um número na senha." }
    $min = $Senha.ToLower()
    $comuns = @('12345678','123456789','1234567890','abc12345','senha123','senha1234','password1','password123','qwerty123','energisa1','energisa123','spark1234','spark123','admin123','mudar123')
    if ($comuns -contains $min) { return "Essa senha é muito comum. Escolha outra." }
    if ($Senha -match '^(.)\1+$') { return "A senha não pode repetir o mesmo caractere." }
    if (-not [string]::IsNullOrWhiteSpace($Email)) {
        $local = "$Email".Trim().ToLower().Split('@')[0]
        if ($local.Length -ge 4 -and $min.Contains($local)) { return "A senha não pode conter o seu e-mail." }
    }
    return ""
}

function Get-UserPermissions {
    <# Retorna a matriz de permissões do usuário; se não houver registro
       específico, cai no perfil-modelo do usuário (Escopo, seção 8.3). #>
    param([Parameter(Mandatory)][string]$UsuarioId)
    $permissoes = Read-JsonModel -Entity "permissoes"
    $registro = $permissoes | Where-Object { $_.usuarioId -eq $UsuarioId } | Select-Object -First 1
    if ($registro) { return $registro.matriz }
    return @{}
}

function Test-Permissao {
    <# Verifica se o usuário tem a ação liberada no módulo. Administrador
       tem acesso total independente da matriz (seção 8.3 do Escopo). #>
    param(
        [Parameter(Mandatory)][string]$UsuarioId,
        [Parameter(Mandatory)][string]$Modulo,
        [Parameter(Mandatory)][string]$Acao
    )
    $usuarios = Read-JsonModel -Entity "usuarios"
    $usuario = $usuarios | Where-Object { $_.id -eq $UsuarioId } | Select-Object -First 1
    if (-not $usuario) { return $false }
    if ($usuario.statusConta -ne "Ativo") { return $false }
    if ($usuario.perfilBase -eq "Administrador") { return $true }

    $matriz = Get-UserPermissions -UsuarioId $UsuarioId
    if ($matriz.$Modulo -and $matriz.$Modulo.$Acao) { return $true }
    return $false
}

function Test-PermissaoHistorico {
    <# v3.26.0 - menu "Histórico de Podas" tem caixa própria na matriz (modulo "historico", Visualizar).
       Sem escolha explícita (nunca marcada/desmarcada), vale a permissão de Manutenção como antes.
       Administrador sempre pode. #>
    param([Parameter(Mandatory)][string]$UsuarioId)
    $usuarios = Read-JsonModel -Entity "usuarios"
    $u = $usuarios | Where-Object { $_.id -eq $UsuarioId } | Select-Object -First 1
    if (-not $u -or $u.statusConta -ne "Ativo") { return $false }
    if ($u.perfilBase -eq "Administrador") { return $true }
    $matriz = Get-UserPermissions -UsuarioId $UsuarioId
    if ($matriz.historico -and $null -ne $matriz.historico.visualizar -and $matriz.historico.visualizar -is [bool]) { return [bool]$matriz.historico.visualizar }
    return (Test-Permissao -UsuarioId $UsuarioId -Modulo "manutencao" -Acao "visualizar")
}

function Test-Administrador {
    <# Confirma se o usuário é Administrador de verdade, consultando
       model/usuarios.json pelo id da sessão (o objeto $Usuario que chega
       nas rotas só tem usuarioId/nome/criadoEm - ver New-Session - nunca
       confiar num "perfilBase" vindo de fora). Usado por ações que só
       fazem sentido pra administrador e não têm módulo/ação próprios na
       matriz de permissões, como "apagar todas as bases" (pedido do
       Mario: "só o adm poder apagar tudo de uma vez"). #>
    param([Parameter(Mandatory)][string]$UsuarioId)
    $usuarios = Read-JsonModel -Entity "usuarios"
    $usuario = $usuarios | Where-Object { $_.id -eq $UsuarioId } | Select-Object -First 1
    if (-not $usuario) { return $false }
    if ($usuario.statusConta -ne "Ativo") { return $false }
    return $usuario.perfilBase -eq "Administrador"
}
