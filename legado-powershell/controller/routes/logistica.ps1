# =============================================================================
# routes/logistica.ps1 — Programação de equipes (visão logística), absorvida
# do sistema "Acompanhamento da Programação V7.2". Fica dentro do mesmo
# módulo de permissão "programacao" (Escopo, seção 5) — é uma visão nova
# (matriz semanal por equipe, lacunas, oportunidades de deslocamento) do
# mesmo módulo, não um módulo separado, então usa a mesma permissão
# "visualizar" que já protege /api/programacao.
#
# Ao contrário de /api/programacao (proteções — uma programação = um
# desligamento agendado), aqui uma "programação" é um dia de trabalho de
# UMA equipe num elemento/alimentador, com o volume de Poda/Faixa/Estrutura
# já resumido (vinculoResumo) a partir das OS batidas contra ela na
# importação de origem. Filtragem (regional/polo/equipe/semana/período) é
# feita no front-end, igual ao restante do SPARK (os três arquivos somados
# não passam de ~3.000 registros — não compensa complexidade de filtro
# server-side pra esse volume).
# =============================================================================

function Invoke-LogisticaRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
    }

    # GET /api/logistica/equipes — cadastro-base (id/polo/regional) só das
    # equipes reais importadas pra Programação por equipe. Fica separado de
    # /api/equipes de propósito: aquele é o cadastro "oficial" curado
    # (usado por Produtividade, Metas e Programação de Proteções); aqui são
    # 243 códigos de equipe vindos direto do arquivo de origem, sem os
    # outros campos (tipoEquipe, base, etc.) — bom o bastante pra rotular a
    # matriz semanal, ruim pra virar linha de tabela nos outros módulos.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "equipes") {
        return @{ status = 200; body = @(Read-JsonModel -Entity "logistica_equipes") }
    }

    # GET /api/logistica/programacoes
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "programacoes") {
        return @{ status = 200; body = @(Read-JsonModel -Entity "logistica_programacoes") }
    }

    # GET /api/logistica/os
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "os") {
        return @{ status = 200; body = @(Read-JsonModel -Entity "logistica_os") }
    }

    # GET /api/logistica/vinculos — { vinculos: {programacaoId: [osId,...]}, estatisticas: {...} }
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "vinculos") {
        return @{ status = 200; body = (Read-JsonModel -Entity "logistica_vinculos") }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/logistica." } }
}
