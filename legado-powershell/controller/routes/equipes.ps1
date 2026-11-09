# =============================================================================
# routes/equipes.ps1
# Módulo Equipes: cadastro-base consumido por Manutenção, Produtividade e
# Programação (visão logística). Não tinha uma seção de endpoints dedicada
# no Detalhamento Técnico v1.0 — adicionado aqui porque é referenciado por
# equipeId/equipesIds em vários outros módulos e precisa existir para o
# front-end montar a hierarquia Departamento > Regional > Polo > Equipe.
# =============================================================================

function Invoke-EquipesRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/equipes
    # @(...) por causa da mesma pegadinha do Windows PowerShell 5.1 já vista
    # em outras rotas (Send-JsonResponse/Write-JsonModel, v2.8.1/2.8.2):
    # sem o @(...), uma base de Equipes vazia (zero cadastros ainda, ou
    # zerada pelo "Apagar tudo" e não reimportada) fazia essa rota devolver
    # "null" em vez de "[]" — e o front-end quebrava com "Cannot read
    # properties of null (reading 'filter')" em equipesProgramaveis() ao
    # tentar abrir o modal de Programação, mesmo sem nenhuma relação direta
    # com Programação (só porque Equipes, consumida por ela, estava vazia).
    # Essa era a única rota de leitura de lista no Controller que ainda não
    # tinha esse cuidado — as outras (POST aqui embaixo, produtividade.ps1,
    # programacao.ps1) já envolviam com @(...).
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        # v2.13.0 - equipes com a flag "Excluir" (Gestao de Bases) nao aparecem
        return @{ status = 200; body = @(Remove-RegistrosExcluidos -Base "equipes" -Campo "id" -Registros @(Read-JsonModel -Entity "equipes")) }
    }

    # POST /api/equipes
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para cadastrar equipes." } }
        }
        $equipes = @(Read-JsonModel -Entity "equipes")
        $novo = @{
            id = $Body.id
            nome = $Body.nome
            tipoEquipe = $Body.tipoEquipe
            polo = $Body.polo
            regional = $Body.regional
            departamento = $Body.departamento
            proprioTerceiro = $Body.proprioTerceiro
            equipePoda = [bool]$Body.equipePoda
            baseLat = $Body.baseLat
            baseLng = $Body.baseLng
            ativo = $true
        }
        $equipes += $novo
        Write-JsonModel -Entity "equipes" -Data $equipes
        return @{ status = 201; body = $novo }
    }

    # PUT /api/equipes/{id}
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        $id = $Segments[0]
        $equipes = @(Read-JsonModel -Entity "equipes")
        $idx = 0..($equipes.Count - 1) | Where-Object { $equipes[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Equipe não encontrada." } } }
        foreach ($prop in $Body.PSObject.Properties) {
            $equipes[$idx] | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
        }
        Write-JsonModel -Entity "equipes" -Data $equipes
        return @{ status = 200; body = $equipes[$idx] }
    }

    # POST /api/equipes/importar — o Excel usa nomes de coluna (CodigoEquipe,
    # TipoEquipe...) diferentes dos campos do JSON (id, tipoEquipe...); o
    # PosProcessar faz essa tradução, igual ao que já existe para Metas.
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "importar") {
        # v3.5.2 - "ativo" nao pode voltar para true a cada importacao: se a planilha trouxer a coluna Ativa/Ativo vale ela;
        # senao mantem o que a equipe ja tinha no cadastro (equipe nova nasce ativa).
        $ativoAtual = @{}
        foreach ($eqAtual in @(Read-JsonModel -Entity "equipes")) {
            if ($eqAtual.PSObject.Properties["ativo"]) { $ativoAtual["$($eqAtual.id)"] = $eqAtual.ativo }
        }
        return Invoke-ImportacaoGenerica -Base "Equipes" -Body $Body -Usuario $Usuario -EntityFile "equipes" -KeyField "id" -PosProcessar {
            param($row)
            $ativaTxt = "$(Get-CampoDoRowComAlias -Row $row -Campos @('Ativa','Ativo'))".Trim().ToLower()
            $ativoFinal = $true
            if ($ativaTxt) { $ativoFinal = -not ($ativaTxt -match '^(false|0|n[aã]o|nao|inativ[oa]|n)$') }
            else {
                $chaveEq = "$(Get-CampoDoRow -Row $row -Campo 'CodigoEquipe')"
                if ($ativoAtual.ContainsKey($chaveEq)) { $ativoFinal = $ativoAtual[$chaveEq] }
            }
            $podaTexto = "$(Get-CampoDoRow -Row $row -Campo 'EquipePoda')".ToLower()
            return @{
                id = Get-CampoDoRow -Row $row -Campo "CodigoEquipe"
                nome = Get-CampoDoRow -Row $row -Campo "CodigoEquipe"
                tipoEquipe = Get-CampoDoRow -Row $row -Campo "TipoEquipe"
                polo = Get-CampoDoRow -Row $row -Campo "Polo"
                regional = Get-CampoDoRow -Row $row -Campo "Regional"
                departamento = Get-CampoDoRow -Row $row -Campo "Departamento"
                proprioTerceiro = Get-CampoDoRow -Row $row -Campo "ProprioTerceiro"
                equipePoda = ($podaTexto -eq "true" -or $podaTexto -eq "sim" -or $podaTexto -eq "1")
                baseLat = $(try { [double](Get-CampoDoRow -Row $row -Campo "BaseLat") } catch { $null })
                baseLng = $(try { [double](Get-CampoDoRow -Row $row -Campo "BaseLng") } catch { $null })
                ativo = $ativoFinal
            }
        }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/equipes." } }
}
