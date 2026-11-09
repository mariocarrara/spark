# XlsxReader.ps1 — leitor de planilhas .xlsx em PowerShell puro (sem módulos
# de terceiros), pensado para arquivos GRANDES (a base real de podas tem
# arquivos de até ~60MB / 178 mil linhas / 69 colunas).
#
# Em vez de carregar a planilha inteira em memória (o que geraria um XML de
# ~470MB só para uma das bases), o leitor:
#   1) abre o .xlsx como um .zip em memória (é isso que um .xlsx é);
#   2) lê xl/sharedStrings.xml uma vez pra montar a tabela de textos;
#   3) percorre xl/worksheets/sheet1.xml com um XmlReader "forward-only"
#      (streaming), e pula (Reader.Skip()) qualquer coluna que não esteja
#      na lista pedida — só as colunas que interessam viram objeto .NET.
#
# Isso mantém o uso de memória proporcional ao número de colunas pedidas,
# não ao tamanho total do arquivo.
#
# No PowerShell 7+ (pwsh) os tipos de System.IO.Compression já vêm
# carregados. No Windows PowerShell 5.1 (o "powershell" que já vem pronto
# no Windows, usado pelo iniciar.bat) eles NÃO vêm — sem isso o server
# nem sobe (erro "Não é possível localizar o tipo
# [System.IO.Compression.ZipArchiveMode]"). Add-Type com -ErrorAction
# SilentlyContinue porque no pwsh isso já está carregado e tentar de novo
# gera um aviso inofensivo, não um erro.
Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

function ConvertFrom-ColunaLetra {
    <# "A" -> 0, "B" -> 1, ..., "Z" -> 25, "AA" -> 26, etc. #>
    param([Parameter(Mandatory)][string]$Letra)
    $col = 0
    foreach ($ch in $Letra.ToCharArray()) {
        $col = $col * 26 + ([int][char]$ch - [int][char]'A' + 1)
    }
    return $col - 1
}

function ConvertFrom-CelulaRef {
    <# Extrai o índice de coluna (0-based) direto da referência de célula
       (ex.: "AE23" -> 30), andando caractere a caractere até achar o
       primeiro dígito — bem mais rápido que "-replace '[0-9]',''" quando
       chamado alguns milhões de vezes (planilhas de 100+ mil linhas). #>
    param([string]$Ref)
    if ([string]::IsNullOrEmpty($Ref)) { return -1 }
    $col = 0
    $achouLetra = $false
    foreach ($ch in $Ref.ToCharArray()) {
        if ($ch -ge '0' -and $ch -le '9') { break }
        $col = $col * 26 + ([int]$ch - [int][char]'A' + 1)
        $achouLetra = $true
    }
    if (-not $achouLetra) { return -1 }
    return $col - 1
}

function Get-SharedStringsXlsx {
    <# -ProgressCallback/-ProgressLabel (opcionais): num arquivo real com
       muitas colunas de texto livre (a base de podas tem 69), a tabela de
       textos compartilhados (xl/sharedStrings.xml) pode ter centenas de
       milhares de entradas — e isso é lido INTEIRO antes de qualquer linha
       da planilha em si, sem nenhum jeito de pular. Sem aviso de progresso
       aqui, essa fase inicial ficava muda tempo suficiente pra estourar o
       timeout de trava do navegador (mesma causa-raiz do "BodyStreamBuffer
       was aborted" já corrigido no recebimento do upload - ver
       Get-MultipartFormData em server.ps1). Throttled por tempo, não por
       total (não dá pra saber o total de entradas sem ler tudo primeiro). #>
    param([Parameter(Mandatory)]$Zip, [scriptblock]$ProgressCallback, [string]$ProgressLabel)
    $entry = $Zip.GetEntry("xl/sharedStrings.xml")
    $lista = New-Object System.Collections.Generic.List[string]
    if (-not $entry) { return $lista }

    $stream = $entry.Open()
    try {
        $reader = [System.Xml.XmlReader]::Create($stream)
        $ultimoProgresso = [DateTime]::MinValue
        # Mesmo cuidado do Read-XlsxColunas: ReadElementContentAsString() em
        # <t> que é filho único de <si> já deixa o reader no </si> de
        # fechamento. Se a checagem de parada só acontecer no topo do loop
        # (via outro Read()), esse fechamento é pulado e a próxima <si> some
        # (o buffer é limpo antes de ser salvo) — só sobrava na lista o caso
        # raro de <t/> vazio, que por não ter Read() "roubado" batia certo
        # por acidente. Por isso aqui a parada é checada logo depois do
        # ReadElementContentAsString(), antes de pedir outro Read().
        while ($reader.Read()) {
            if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'si') {
                if ($reader.IsEmptyElement) { $lista.Add(""); continue }
                $profundidade = $reader.Depth
                $texto = New-Object System.Text.StringBuilder
                while ($true) {
                    if (-not $reader.Read()) { break }
                    if ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.Depth -eq $profundidade) { break }
                    if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 't') {
                        if (-not $reader.IsEmptyElement) {
                            $texto.Append($reader.ReadElementContentAsString()) | Out-Null
                            if ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.Depth -eq $profundidade) { break }
                        }
                    }
                }
                $lista.Add($texto.ToString())
                if ($ProgressCallback) {
                    $agora = [DateTime]::UtcNow
                    if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                        $ultimoProgresso = $agora
                        # sem "percentual" de propósito: não dá pra saber o
                        # total de entradas sem ler tudo, e mandar 0 faria a
                        # barra "voltar" visualmente do que já tinha andado
                        # na etapa de upload - só o texto avisa aqui.
                        & $ProgressCallback @{ fase = 'indexando'; arquivo = $ProgressLabel; linha = $lista.Count }
                    }
                }
            }
        }
        $reader.Close()
    } finally { $stream.Close() }
    return $lista
}

function Get-PrimeiraPlanilhaEntry {
    <# Localiza a primeira aba dentro do .xlsx. Assume o caso comum
       (xl/worksheets/sheet1.xml); se não existir com esse nome exato,
       cai pra primeira entrada que bater com o padrão. #>
    param([Parameter(Mandatory)]$Zip)
    $direta = $Zip.GetEntry("xl/worksheets/sheet1.xml")
    if ($direta) { return $direta }
    return ($Zip.Entries | Where-Object { $_.FullName -match '^xl/worksheets/sheet\d+\.xml$' } |
        Sort-Object FullName | Select-Object -First 1)
}

function Read-XlsxColunasLento {
    <# Lê só as colunas pedidas (por nome do cabeçalho, linha 1) de um
       .xlsx e devolve @{ linhas = <lista de hashtables ordenados>;
       totalLinhas = <int> }. Colunas que não existirem no arquivo saem
       como $null em todas as linhas (sem erro — quem chama decide o que
       fazer).

       -ProgressCallback/-ProgressLabel/-ProgressFase (opcionais): se
       informado, ProgressCallback é um scriptblock chamado periodicamente
       com um hashtable de progresso (fase/arquivo/linha/total/percentual),
       usando o total de linhas do próprio arquivo (elemento
       <dimension ref="A1:BQ178100"/> do sheet1.xml, que o Excel já grava
       com o intervalo usado - dá o total exato sem precisar de uma passada
       extra só pra contar). Quem monta o callback decide o que fazer com
       cada linha de progresso (ex.: escrever direto na resposta HTTP em
       andamento - ver Invoke-PodasStreamingUpload em routes/importacao.ps1). #>
    param(
        [Parameter(Mandatory)][byte[]]$Bytes,
        [Parameter(Mandatory)][string[]]$Colunas,
        [scriptblock]$ProgressCallback,
        [string]$ProgressLabel,
        [string]$ProgressFase,
        [scriptblock]$LinhaCallback
    )
    # v2.13.0 - -LinhaCallback (opcional): em vez de acumular TODAS as linhas
    # em memoria (o Vao real tem ~793 mil), cada linha lida e entregue ao
    # callback e descartada; o retorno traz linhas vazias. Quem usa agrega
    # por conta propria (ver Invoke-BaseGrandeStreamingUpload).
    $ms = New-Object System.IO.MemoryStream(,$Bytes)
    $zip = New-Object System.IO.Compression.ZipArchive($ms, [System.IO.Compression.ZipArchiveMode]::Read)
    try {
        $sharedStrings = Get-SharedStringsXlsx -Zip $zip -ProgressCallback $ProgressCallback -ProgressLabel $ProgressLabel
        $sheetEntry = Get-PrimeiraPlanilhaEntry -Zip $zip
        if (-not $sheetEntry) { throw "Não encontrei nenhuma planilha (xl/worksheets/*.xml) dentro do arquivo." }

        $resultados = New-Object System.Collections.Generic.List[object]
        $mapaColunas = @{}       # nome do campo pedido -> índice da coluna no arquivo
        $colunasDesejadasIdx = @{}  # índice da coluna -> nome do campo pedido (montado após o cabeçalho)
        $numeroLinha = 0

        $stream = $sheetEntry.Open()
        try {
            $reader = [System.Xml.XmlReader]::Create($stream)
            $linhaAtual = $null
            $dentroLinha = $false
            $totalEstimado = 0
            $ultimoProgresso = [DateTime]::MinValue

            # Otimização: numa planilha larga (a de podas tem 69 colunas, só
            # ~10 usadas), cada linha ainda precisa ser varrida célula a
            # célula pra saber o índice de cada uma — mas assim que já
            # encontramos TODAS as colunas pedidas numa linha, o resto dela
            # não importa mais. $colunasEncontradasNaLinha conta quantas das
            # colunas pedidas já apareceram nesta linha; ao bater o total,
            # $linhaSatisfeita liga e as células seguintes são puladas sem
            # nem calcular o índice (ConvertFrom-CelulaRef) ou consultar o
            # dicionário — só reader.Skip() direto. Não depende de as
            # colunas virem em ordem crescente no XML (algo que o Excel faz,
            # mas não é garantido): se alguma coluna pedida estiver ausente
            # nesta linha em particular, o total nunca "bate" e ela é
            # varrida inteira como antes — nunca fica mais lento, só mais
            # rápido quando dá certo.
            $totalColunasDesejadas = 0
            $colunasEncontradasNaLinha = 0
            $linhaSatisfeita = $false

            # Cuidado geral deste laço: tanto Reader.Skip() quanto
            # ReadElementContentAsString() já deixam o reader posicionado no
            # PRÓXIMO nó a inspecionar — eles não "terminam" no nó atual
            # esperando um Read() adicional. Um `while ($reader.Read()) {...}`
            # comum chama Read() de novo no topo de toda iteração (inclusive
            # após um `continue`), o que consome esse próximo nó sem
            # processá-lo e desalinha a leitura da linha inteira (colunas que
            # vêm logo depois de uma coluna pulada saem trocadas). Por isso
            # usamos uma flag: só chamamos Read() quando o nó atual já foi
            # totalmente processado por nós mesmos.
            $precisaAvancar = $true
            while ($true) {
                if ($precisaAvancar) {
                    if (-not $reader.Read()) { break }
                }
                $precisaAvancar = $true

                if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element) {
                    if ($reader.LocalName -eq 'dimension') {
                        # <dimension ref="A1:BQ178100"/> - pega o número da
                        # última linha usada direto do atributo, sem contar
                        # nada na unha; -1 porque a linha 1 é cabeçalho.
                        $refAttr = $reader.GetAttribute('ref')
                        if ($refAttr -match '[A-Za-z]+(\d+)$') {
                            $totalEstimado = [Math]::Max(0, [int]$Matches[1] - 1)
                        }
                    }
                    elseif ($reader.LocalName -eq 'row') {
                        $numeroLinha++
                        $linhaAtual = @{}
                        $dentroLinha = $true
                        $colunasEncontradasNaLinha = 0
                        $linhaSatisfeita = $false
                        if ($ProgressCallback -and $totalEstimado -gt 0) {
                            $agora = [DateTime]::UtcNow
                            if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                                $ultimoProgresso = $agora
                                $linhaProcessada = [Math]::Max(0, $numeroLinha - 1)
                                $pct = [Math]::Min(99, [Math]::Round(100.0 * $linhaProcessada / $totalEstimado, 1))
                                & $ProgressCallback @{
                                    fase = $ProgressFase; arquivo = $ProgressLabel
                                    linha = $linhaProcessada; total = $totalEstimado; percentual = $pct
                                }
                            }
                        }
                    }
                    elseif ($dentroLinha -and $reader.LocalName -eq 'c') {
                        if ($linhaSatisfeita) {
                            $reader.Skip()
                            $precisaAvancar = $false
                            continue
                        }
                        $tipo = $reader.GetAttribute('t')
                        $idxCol = ConvertFrom-CelulaRef -Ref $reader.GetAttribute('r')

                        # Na linha de cabeçalho (1) captura tudo pra descobrir os
                        # nomes das colunas; nas demais, só o que foi pedido —
                        # o resto é pulado com Skip() (rápido, não materializa).
                        $querEssaColuna = ($numeroLinha -eq 1) -or ($idxCol -ge 0 -and $colunasDesejadasIdx.ContainsKey($idxCol))
                        if (-not $querEssaColuna) {
                            $reader.Skip()
                            $precisaAvancar = $false
                            continue
                        }

                        $valor = $null
                        if (-not $reader.IsEmptyElement) {
                            $profundidadeInicial = $reader.Depth
                            while ($true) {
                                if (-not $reader.Read()) { break }
                                if ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.Depth -eq $profundidadeInicial) { break }
                                if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and ($reader.LocalName -eq 'v' -or $reader.LocalName -eq 't')) {
                                    $valor = $reader.ReadElementContentAsString()
                                    if ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.Depth -eq $profundidadeInicial) { break }
                                }
                            }
                            # O reader já está exatamente no </c> (fechamento da
                            # própria célula) — a próxima iteração deve, sim,
                            # chamar Read() normalmente (não mexemos em $precisaAvancar).
                        }

                        if ($tipo -eq 's' -and $null -ne $valor -and $valor -ne '') {
                            $i = 0
                            if ([int]::TryParse($valor, [ref]$i) -and $i -ge 0 -and $i -lt $sharedStrings.Count) {
                                $valor = $sharedStrings[$i]
                            }
                        }

                        if ($idxCol -ge 0) { $linhaAtual[$idxCol] = $valor }

                        if ($numeroLinha -gt 1 -and $totalColunasDesejadas -gt 0) {
                            $colunasEncontradasNaLinha++
                            if ($colunasEncontradasNaLinha -ge $totalColunasDesejadas) { $linhaSatisfeita = $true }
                        }
                    }
                }
                elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.LocalName -eq 'row') {
                    $dentroLinha = $false
                    if ($numeroLinha -eq 1) {
                        foreach ($idxCol in @($linhaAtual.Keys)) {
                            $nomeCampo = $linhaAtual[$idxCol]
                            if ($nomeCampo -and ($Colunas -contains $nomeCampo) -and -not $mapaColunas.ContainsKey($nomeCampo)) {
                                $mapaColunas[$nomeCampo] = $idxCol
                                $colunasDesejadasIdx[$idxCol] = $nomeCampo
                            }
                        }
                        # só a partir daqui dá pra saber quantas colunas
                        # pedidas de fato existem no arquivo - usado pelo
                        # atalho de "linha já satisfeita" acima.
                        $totalColunasDesejadas = $colunasDesejadasIdx.Count
                    } else {
                        $registro = [ordered]@{}
                        foreach ($nomeCampo in $Colunas) {
                            if ($mapaColunas.ContainsKey($nomeCampo)) {
                                $idxCol = $mapaColunas[$nomeCampo]
                                $registro[$nomeCampo] = if ($linhaAtual.ContainsKey($idxCol)) { $linhaAtual[$idxCol] } else { $null }
                            } else {
                                $registro[$nomeCampo] = $null
                            }
                        }
                        if ($LinhaCallback) { & $LinhaCallback $registro } else { $resultados.Add($registro) }
                    }
                    $linhaAtual = $null
                }
            }
            $reader.Close()
        } finally { $stream.Close() }

        return @{ linhas = $resultados; totalLinhas = [Math]::Max(0, $numeroLinha - 1); colunasEncontradas = @($mapaColunas.Keys) }
    } finally {
        $zip.Dispose()
    }
}

# =============================================================================
# v2.13.6 - LEITOR RAPIDO (C#). O laco em PowerShell (uma passada por celula:
# GRID_EXECUTADO tem ~178 mil linhas x 69 colunas = ~12 milhoes de celulas)
# levava ~27 min so na fase "grid". A mesma leitura em C# compilado leva
# segundos (Vao de 793 mil linhas: ~4 s). Devolve exatamente o mesmo formato
# do leitor antigo (linhas = OrderedDictionary por linha, valores como texto
# cru do XML, null quando a coluna nao existe). Se o Add-Type falhar por
# qualquer motivo, cai sozinho pro leitor lento (Read-XlsxColunasLento).
# =============================================================================
$Script:SparkXlsxFonte = @'
using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

// Leitor de .xlsx em streaming (v2.13.6). Escrito em C# 5 de proposito: o
// Add-Type do Windows PowerShell 5.1 compila com o csc do .NET Framework.
public sealed class SparkXlsxStream : IDisposable
{
    private MemoryStream ms;
    private ZipArchive zip;
    private Stream sheetStream;
    private XmlReader r;
    private List<string> shared;
    private string[] colunas;
    private int[] colParaPos;
    private int totalWanted;
    private bool headerLido;

    public int TotalEstimado;
    public int LinhasLidas;
    public OrderedDictionary Row;
    public string[] Vals;            // valores da linha atual (na ordem de 'colunas')
    public bool SemDicionario;       // true: nao monta 'Row' (so 'Vals') - bem mais rapido
    public List<string> ColunasEncontradas = new List<string>();
    public List<string> Cabecalhos = new List<string>();   // v2.13.12c: cabecalhos reais da planilha (diagnostico)

    // v2.13.12c: compara cabecalhos sem se importar com acentos decompostos (a + ~),
    // espacos nas pontas/duplicados, espaco "duro" e maiusculas/minusculas.
    private static string Norm(string t)
    {
        if (t == null) return "";
        string x;
        try { x = t.Normalize(NormalizationForm.FormC); } catch (ArgumentException) { x = t; }
        x = x.Replace('\u00A0', ' ').Trim();
        while (x.IndexOf("  ") >= 0) x = x.Replace("  ", " ");
        return x.ToLowerInvariant();
    }

    public SparkXlsxStream(byte[] bytes, string[] colunasPedidas)
    {
        colunas = colunasPedidas;
        ms = new MemoryStream(bytes, false);
        zip = new ZipArchive(ms, ZipArchiveMode.Read);
        shared = LerSharedStrings();
        ZipArchiveEntry sheet = zip.GetEntry("xl/worksheets/sheet1.xml");
        if (sheet == null)
        {
            List<string> nomes = new List<string>();
            foreach (ZipArchiveEntry e in zip.Entries)
            {
                string n = e.FullName;
                if (n.StartsWith("xl/worksheets/sheet") && n.EndsWith(".xml") && n.IndexOf('/', 19) < 0) nomes.Add(n);
            }
            nomes.Sort(StringComparer.Ordinal);
            if (nomes.Count > 0) sheet = zip.GetEntry(nomes[0]);
        }
        if (sheet == null) throw new InvalidOperationException("Nao encontrei nenhuma planilha (xl/worksheets/*.xml) dentro do arquivo.");
        sheetStream = sheet.Open();
        XmlReaderSettings cfg = new XmlReaderSettings();
        cfg.DtdProcessing = DtdProcessing.Ignore;
        r = XmlReader.Create(sheetStream, cfg);
        colParaPos = new int[16384];
        for (int i = 0; i < colParaPos.Length; i++) colParaPos[i] = -1;
    }

    private List<string> LerSharedStrings()
    {
        ZipArchiveEntry entry = zip.GetEntry("xl/sharedStrings.xml");
        List<string> lista = new List<string>();
        if (entry == null) return lista;
        using (Stream st = entry.Open())
        {
            XmlReaderSettings cfg = new XmlReaderSettings();
            cfg.DtdProcessing = DtdProcessing.Ignore;
            using (XmlReader rd = XmlReader.Create(st, cfg))
            {
                while (rd.Read())
                {
                    if (rd.NodeType != XmlNodeType.Element) continue;
                    if (rd.LocalName == "sst")
                    {
                        string uc = rd.GetAttribute("uniqueCount");
                        int n;
                        if (uc != null && int.TryParse(uc, out n) && n > 0 && n < 50000000) lista.Capacity = n;
                        continue;
                    }
                    if (rd.LocalName != "si") continue;
                    if (rd.IsEmptyElement) { lista.Add(""); continue; }
                    int d = rd.Depth;
                    string unico = null;
                    StringBuilder sb = null;
                    while (rd.Read())
                    {
                        if (rd.NodeType == XmlNodeType.EndElement && rd.Depth == d) break;
                        if (rd.NodeType == XmlNodeType.Element && rd.LocalName == "t" && !rd.IsEmptyElement)
                        {
                            string tx = rd.ReadElementContentAsString();
                            if (unico == null && sb == null) unico = tx;
                            else
                            {
                                if (sb == null) { sb = new StringBuilder(unico); }
                                sb.Append(tx);
                            }
                            if (rd.NodeType == XmlNodeType.EndElement && rd.Depth == d) break;
                        }
                    }
                    if (sb != null) lista.Add(sb.ToString());
                    else lista.Add(unico == null ? "" : unico);
                }
            }
        }
        return lista;
    }

    private static int ColIndex(string reff)
    {
        int col = 0;
        for (int i = 0; i < reff.Length; i++)
        {
            char c = reff[i];
            if (c >= 'A' && c <= 'Z') col = col * 26 + (c - 'A' + 1);
            else if (c >= 'a' && c <= 'z') col = col * 26 + (c - 'a' + 1);
            else break;
        }
        return col - 1;
    }

    // Le uma <row> inteira. Header: devolve dicionario idx->texto. Dados: preenche 'vals' por posicao.
    private bool LerLinha(bool header, Dictionary<int, string> hdr, string[] vals)
    {
        int rowDepth = r.Depth;
        if (r.IsEmptyElement) return false;
        int found = 0;
        int lastIdx = -1;
        bool pending = false;
        while (true)
        {
            if (!pending) { if (!r.Read()) break; }
            pending = false;
            if (r.NodeType == XmlNodeType.EndElement && r.Depth == rowDepth) break;
            if (r.NodeType != XmlNodeType.Element || r.LocalName != "c") continue;

            string refAttr = r.GetAttribute("r");
            int idx = refAttr != null ? ColIndex(refAttr) : lastIdx + 1;
            lastIdx = idx;
            int pos = -1;
            if (!header)
            {
                if (idx >= 0 && idx < colParaPos.Length) pos = colParaPos[idx];
                if (pos < 0) { r.Skip(); pending = true; continue; }
            }
            string t = r.GetAttribute("t");
            string v = null;
            if (!r.IsEmptyElement)
            {
                int d = r.Depth;
                bool inline = (t == "inlineStr");
                while (true)
                {
                    if (!r.Read()) break;
                    if (r.NodeType == XmlNodeType.EndElement && r.Depth == d) break;
                    if (r.NodeType == XmlNodeType.Element && (r.LocalName == "v" || r.LocalName == "t"))
                    {
                        string tx = r.ReadElementContentAsString();
                        if (v == null || !inline) v = tx; else v = v + tx;
                        if (r.NodeType == XmlNodeType.EndElement && r.Depth == d) break;
                    }
                }
            }
            if (t == "s" && !string.IsNullOrEmpty(v))
            {
                int si;
                if (int.TryParse(v, out si) && si >= 0 && si < shared.Count) v = shared[si];
            }
            if (header)
            {
                if (idx >= 0) hdr[idx] = v;
            }
            else
            {
                vals[pos] = v;
                found++;
                if (found >= totalWanted)
                {
                    // ja temos tudo o que foi pedido: pula o resto da linha
                    while (!(r.NodeType == XmlNodeType.EndElement && r.Depth == rowDepth))
                    {
                        if (r.EOF) break;
                        r.Skip();
                    }
                    break;
                }
            }
        }
        return true;
    }

    public bool Next()
    {
        while (r.Read())
        {
            if (r.NodeType != XmlNodeType.Element) continue;
            string n = r.LocalName;
            if (n == "dimension")
            {
                string refAttr = r.GetAttribute("ref");
                if (refAttr != null)
                {
                    int fim = refAttr.Length;
                    int ini = fim;
                    while (ini > 0 && refAttr[ini - 1] >= '0' && refAttr[ini - 1] <= '9') ini--;
                    int ult;
                    if (ini < fim && int.TryParse(refAttr.Substring(ini), out ult)) TotalEstimado = Math.Max(0, ult - 1);
                }
                continue;
            }
            if (n != "row") continue;

            if (!headerLido)
            {
                Dictionary<int, string> hdr = new Dictionary<int, string>();
                LerLinha(true, hdr, null);
                headerLido = true;
                List<int> idxs = new List<int>(hdr.Keys);
                idxs.Sort();
                bool[] achou = new bool[colunas.Length];
                foreach (int idx in idxs)
                {
                    string nome = hdr[idx];
                    if (string.IsNullOrEmpty(nome) || idx >= colParaPos.Length) continue;
                    if (Cabecalhos.Count < 200) Cabecalhos.Add(nome);
                    int p = Array.IndexOf(colunas, nome);
                    if (p < 0)
                    {
                        string nn = Norm(nome);
                        for (int k = 0; k < colunas.Length; k++)
                        {
                            if (!achou[k] && Norm(colunas[k]) == nn) { p = k; break; }
                        }
                    }
                    if (p >= 0 && !achou[p])
                    {
                        achou[p] = true;
                        colParaPos[idx] = p;
                        ColunasEncontradas.Add(colunas[p]);
                        totalWanted++;
                    }
                }
                continue;
            }

            string[] vals = new string[colunas.Length];
            if (!LerLinha(false, null, vals)) continue;
            LinhasLidas++;
            Vals = vals;
            if (SemDicionario) { Row = null; return true; }
            OrderedDictionary d = new OrderedDictionary(colunas.Length);
            for (int i = 0; i < colunas.Length; i++) d[colunas[i]] = vals[i];
            Row = d;
            return true;
        }
        Row = null;
        Vals = null;
        return false;
    }

    public void Dispose()
    {
        if (r != null) { r.Close(); r = null; }
        if (sheetStream != null) { sheetStream.Close(); sheetStream = null; }
        if (zip != null) { zip.Dispose(); zip = null; }
        if (ms != null) { ms.Dispose(); ms = null; }
    }
}

// Agregador do Vao (v2.13.7): 1 registro por PROTECAO (soma de postes e de
// Rota km, primeiro Polo/Regional nao vazio). Mesma regra do callback que
// rodava em PowerShell linha a linha (793 mil linhas), so que compilado.
public sealed class SparkVaoItem
{
    public string Protecao;
    public string Regional;
    public string Polo;
    public int Postes;
    public double RotaKm;
}

public sealed class SparkVaoAgg : IDisposable
{
    private SparkXlsxStream rd;
    private Dictionary<string, SparkVaoItem> itens = new Dictionary<string, SparkVaoItem>(StringComparer.OrdinalIgnoreCase);
    private List<SparkVaoItem> ordem = new List<SparkVaoItem>();
    // v2.15.4 - Rota (km) POR POSTE (a 1a linha de cada "Poste 1"), pra poda linear:
    // limpeza de faixa = tamanho do vao (Rota km) x 15 m. Fica fora do agrupamento
    // por protecao, que continua igual.
    private Dictionary<string, double> postesKm = new Dictionary<string, double>();
    private List<string> ordemPostes = new List<string>();
    public int Lidas;
    public int SemChave;
    private int iPoste, iProt, iReg, iPolo, iRota;

    // Colunas do Vao (nomes fixos; \u00e7\u00e3 = "ça" de Protecao).
    public SparkVaoAgg(byte[] bytes, string[] colunas)
    {
        rd = new SparkXlsxStream(bytes, colunas);
        rd.SemDicionario = true;
        iPoste = Array.IndexOf(colunas, "Poste 1");
        iProt = Array.IndexOf(colunas, "Prote\u00e7\u00e3o");
        iReg = Array.IndexOf(colunas, "Regional");
        iPolo = Array.IndexOf(colunas, "Polo");
        iRota = Array.IndexOf(colunas, "Rota (km)");
    }

    public int LinhasLidas { get { return rd.LinhasLidas; } }
    public int TotalEstimado { get { return rd.TotalEstimado; } }
    public int Quantidade { get { return ordem.Count; } }
    public string[] Encontradas() { return rd.ColunasEncontradas.ToArray(); }
    public SparkVaoItem Item(int i) { return ordem[i]; }

    private static string Limpar(string v)
    {
        if (v == null) return null;
        string t = v.Trim();
        if (t.Length == 0) return null;
        if (string.Equals(t, "#N/A", StringComparison.OrdinalIgnoreCase)) return null;
        if (string.Equals(t, "Sem", StringComparison.OrdinalIgnoreCase)) return null;
        return t;
    }

    private static bool Numero(string v, out double d)
    {
        d = 0.0;
        if (string.IsNullOrWhiteSpace(v)) return false;
        string limpo = v.Trim().Replace(",", ".");
        return double.TryParse(limpo, System.Globalization.NumberStyles.Float | System.Globalization.NumberStyles.AllowThousands,
            System.Globalization.CultureInfo.InvariantCulture, out d);
    }

    private static string Pega(string[] v, int i) { return (i >= 0 && i < v.Length) ? v[i] : null; }

    // "5286727" e "5286727.0" viram a mesma chave; "0" nao e poste.
    private static string PosteChave(string p)
    {
        string t = p.Trim();
        if (t.EndsWith(".0")) t = t.Substring(0, t.Length - 2);
        if (t.StartsWith("218-")) t = t.Substring(4);
        if (t.Length == 0 || t == "0") return null;
        return t;
    }

    public int QuantidadePostes { get { return ordemPostes.Count; } }

    // Grava "poste<TAB>rotaKm" (ponto decimal) e devolve quantos postes gravou.
    public int EscreverPostes(string caminho)
    {
        string tmp = caminho + ".tmp";
        using (StreamWriter w = new StreamWriter(tmp, false, new UTF8Encoding(false)))
        {
            foreach (string pk in ordemPostes)
                w.Write(pk + "\t" + postesKm[pk].ToString("R", System.Globalization.CultureInfo.InvariantCulture) + "\n");
        }
        if (File.Exists(caminho)) File.Delete(caminho);
        File.Move(tmp, caminho);
        return ordemPostes.Count;
    }

    // Processa ate 'max' linhas; true = ainda ha mais (o PowerShell chama em
    // laco e aproveita entre as chamadas pra mandar o progresso).
    public bool Passo(int max)
    {
        int n = 0;
        while (n < max)
        {
            if (!rd.Next()) return false;
            n++;
            Lidas++;
            string[] v = rd.Vals;
            string prot = Limpar(Pega(v, iProt));
            string poste = Limpar(Pega(v, iPoste));
            if (poste != null)
            {
                string pk = PosteChave(poste);
                double kmPoste;
                if (pk != null && !postesKm.ContainsKey(pk) && Numero(Pega(v, iRota), out kmPoste))
                {
                    postesKm[pk] = kmPoste;
                    ordemPostes.Add(pk);
                }
            }
            if (prot == null || poste == null) { SemChave++; continue; }
            SparkVaoItem a;
            if (!itens.TryGetValue(prot, out a))
            {
                a = new SparkVaoItem();
                a.Protecao = prot;
                itens[prot] = a;
                ordem.Add(a);
            }
            a.Postes++;
            double km;
            if (Numero(Pega(v, iRota), out km)) a.RotaKm += km;
            if (a.Polo == null) a.Polo = Limpar(Pega(v, iPolo));
            if (a.Regional == null) a.Regional = Limpar(Pega(v, iReg));
        }
        return true;
    }

    public void Dispose() { if (rd != null) { rd.Dispose(); rd = null; } }
}

// v2.15.24 - "Numero Operativo" dos equipamentos (exportacao Smallworld/GeoSpatial):
// colunas Id, Name (e Alias, se houver) -> model/equip_nomes_<camada>.tsv (id<TAB>nome<TAB>alias).
// Varios arquivos (limite de 10 mil linhas por exportacao) se somam: o que ja esta gravado
// e mantido e o Id repetido e atualizado.
public sealed class SparkNomesAgg : IDisposable
{
    private SparkXlsxStream rd;
    private Dictionary<string, string[]> itens = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
    public int Lidas;
    public int SemChave;
    private int iId, iNome, iAlias;

    public SparkNomesAgg(byte[] bytes)
    {
        string[] colunas = new string[] { "Id", "Name", "Alias" };
        rd = new SparkXlsxStream(bytes, colunas);
        rd.SemDicionario = true;
        iId = 0; iNome = 1; iAlias = 2;
    }

    public int LinhasLidas { get { return rd.LinhasLidas; } }
    public int TotalEstimado { get { return rd.TotalEstimado; } }
    public int Quantidade { get { return itens.Count; } }
    public string[] Encontradas() { return rd.ColunasEncontradas.ToArray(); }

    public static string ChaveId(string v)
    {
        if (v == null) return null;
        string t = v.Trim();
        if (t.EndsWith(".0")) t = t.Substring(0, t.Length - 2);
        if (t.Length == 0 || t == "0") return null;
        return t;
    }

    private static string Limpo(string v)
    {
        if (v == null) return "";
        return v.Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ').Trim();
    }

    public bool Passo(int max)
    {
        int n = 0;
        while (n < max)
        {
            if (!rd.Next()) return false;
            n++;
            Lidas++;
            string[] v = rd.Vals;
            string id = ChaveId(v != null && v.Length > iId ? v[iId] : null);
            string nome = Limpo(v != null && v.Length > iNome ? v[iNome] : null);
            string alias = Limpo(v != null && v.Length > iAlias ? v[iAlias] : null);
            if (id == null || (nome.Length == 0 && alias.Length == 0)) { SemChave++; continue; }
            itens[id] = new string[] { nome, alias };
        }
        return true;
    }

    // Soma ao arquivo existente (se houver) e devolve o total gravado.
    public int Gravar(string caminho)
    {
        Dictionary<string, string[]> tudo = SparkNomes.LerArquivo(caminho);
        foreach (KeyValuePair<string, string[]> kv in itens) tudo[kv.Key] = kv.Value;
        string tmp = caminho + ".tmp";
        using (StreamWriter w = new StreamWriter(tmp, false, new UTF8Encoding(false)))
        {
            foreach (KeyValuePair<string, string[]> kv in tudo)
                w.Write(kv.Key + "\t" + kv.Value[0] + "\t" + kv.Value[1] + "\n");
        }
        if (File.Exists(caminho)) File.Delete(caminho);
        File.Move(tmp, caminho);
        return tudo.Count;
    }

    public void Dispose() { if (rd != null) { rd.Dispose(); rd = null; } }
}

public static class SparkNomes
{
    private static readonly Dictionary<string, KeyValuePair<DateTime, Dictionary<string, string[]>>> cache =
        new Dictionary<string, KeyValuePair<DateTime, Dictionary<string, string[]>>>();
    private static readonly object trava = new object();

    public static Dictionary<string, string[]> LerArquivo(string caminho)
    {
        Dictionary<string, string[]> d = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        if (!File.Exists(caminho)) return d;
        foreach (string linha in File.ReadAllLines(caminho, new UTF8Encoding(false)))
        {
            string[] p = linha.Split('\t');
            if (p.Length < 2 || p[0].Length == 0) continue;
            d[p[0]] = new string[] { p[1], p.Length > 2 ? p[2] : "" };
        }
        return d;
    }

    public static Dictionary<string, string[]> Carregar(string caminho)
    {
        if (!File.Exists(caminho)) return new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        DateTime mt = File.GetLastWriteTimeUtc(caminho);
        lock (trava)
        {
            KeyValuePair<DateTime, Dictionary<string, string[]>> c;
            if (cache.TryGetValue(caminho, out c) && c.Key == mt) return c.Value;
            Dictionary<string, string[]> d = LerArquivo(caminho);
            cache[caminho] = new KeyValuePair<DateTime, Dictionary<string, string[]>>(mt, d);
            return d;
        }
    }

    // Nome a mostrar: Name; se vazio, Alias; se nao achar, "".
    public static string Nome(string caminho, string id)
    {
        if (string.IsNullOrEmpty(id)) return "";
        string[] v;
        if (!Carregar(caminho).TryGetValue(id, out v)) return "";
        return v[0].Length > 0 ? v[0] : v[1];
    }

    // Ids cujo nome (ou alias) contem o texto (sem diferenciar maiusculas), ate 'max'.
    public static string[] Buscar(string caminho, string texto, int max)
    {
        List<string> r = new List<string>();
        if (string.IsNullOrWhiteSpace(texto)) return r.ToArray();
        string t = texto.Trim();
        foreach (KeyValuePair<string, string[]> kv in Carregar(caminho))
        {
            if (kv.Value[0].IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0 ||
                kv.Value[1].IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                r.Add(kv.Key);
                if (r.Count >= max) break;
            }
        }
        return r.ToArray();
    }
}

public sealed class SparkConfResultado
{
    public int Comparados;
    public int Ok;
    public int Acima;
    public int SemCadastro;
    public List<string[]> Linhas = new List<string[]>();
}

public static class SparkConferencia
{
    private static double Dist(double la1, double lo1, double la2, double lo2)
    {
        double r = 6371000.0, k = Math.PI / 180.0;
        double dLa = (la2 - la1) * k, dLo = (lo2 - lo1) * k;
        double a = Math.Sin(dLa / 2) * Math.Sin(dLa / 2) + Math.Cos(la1 * k) * Math.Cos(la2 * k) * Math.Sin(dLo / 2) * Math.Sin(dLo / 2);
        return 2 * r * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    // v2.15.25 - compara a posicao do cadastro de Protecao (LAT/LONG) com a do equipamento da BDGD,
    // ligando pelo nome operativo. Devolve as 'max' mais distantes acima de 'limM' metros.
    public static SparkConfResultado Conferir(string arqEquip, string arqNomes, string[] elem, double[] lat, double[] lng, double limM, int max)
    {
        SparkConfResultado res = new SparkConfResultado();
        Dictionary<string, int> idx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < elem.Length; i++)
        {
            if (string.IsNullOrEmpty(elem[i])) continue;
            if (!idx.ContainsKey(elem[i])) idx[elem[i]] = i;
        }
        Dictionary<string, string[]> nomes = SparkNomes.Carregar(arqNomes);
        System.Globalization.CultureInfo inv = System.Globalization.CultureInfo.InvariantCulture;
        foreach (string linha in File.ReadAllLines(arqEquip, new UTF8Encoding(false)))
        {
            string[] p = linha.Split('\t');
            if (p.Length < 11) continue;
            string[] nm;
            if (!nomes.TryGetValue(p[0], out nm)) continue;
            string nome = nm[0].Length > 0 ? nm[0] : nm[1];
            int k;
            if (nome.Length == 0 || !idx.TryGetValue(nome, out k)) { res.SemCadastro++; continue; }
            double la, lo;
            if (!double.TryParse(p[2], System.Globalization.NumberStyles.Float, inv, out la)) continue;
            if (!double.TryParse(p[3], System.Globalization.NumberStyles.Float, inv, out lo)) continue;
            if (double.IsNaN(lat[k]) || double.IsNaN(lng[k])) continue;
            res.Comparados++;
            double d = Dist(la, lo, lat[k], lng[k]);
            if (d <= limM) { res.Ok++; continue; }
            res.Acima++;
            res.Linhas.Add(new string[] { p[0], nome, Math.Round(d).ToString(inv), la.ToString("R", inv), lo.ToString("R", inv),
                lat[k].ToString("R", inv), lng[k].ToString("R", inv), p[4] });
        }
        res.Linhas.Sort(delegate(string[] a, string[] b) { return double.Parse(b[2], inv).CompareTo(double.Parse(a[2], inv)); });
        if (res.Linhas.Count > max) res.Linhas.RemoveRange(max, res.Linhas.Count - max);
        return res;
    }
}

// Busca de sequencia de bytes (usada pelo parser de multipart do upload).
public static class SparkBytes
{
    public static int IndexOf(byte[] hay, byte[] needle, int start)
    {
        int n = needle.Length;
        if (n == 0 || start >= hay.Length) return -1;
        byte first = needle[0];
        int limite = hay.Length - n;
        for (int i = start; i <= limite; i++)
        {
            if (hay[i] != first) continue;
            int j = 1;
            while (j < n && hay[i + j] == needle[j]) j++;
            if (j == n) return i;
        }
        return -1;
    }
}
'@

function Initialize-SparkXlsx {
    if ($Script:SparkXlsxPronto -eq $true) { return $true }
    if ($Script:SparkXlsxPronto -eq $false) { return $false }
    try {
        if (-not ('SparkXlsxStream' -as [type])) {
            Add-Type -TypeDefinition $Script:SparkXlsxFonte -Language CSharp `
                -ReferencedAssemblies @('System.IO.Compression.dll', 'System.Xml.dll', 'System.dll') -ErrorAction Stop
        }
        $Script:SparkXlsxPronto = $true
    } catch {
        Write-Host ("  [aviso] leitor rapido de Excel indisponivel (" + $_.Exception.Message + ") - usando o leitor lento.") -ForegroundColor Yellow
        $Script:SparkXlsxPronto = $false
    }
    return $Script:SparkXlsxPronto
}

function Import-NomesEquipXlsx {
    <# v2.15.24 - le a exportacao do Smallworld (Id, Name, Alias) e SOMA ao arquivo de nomes da camada. #>
    param([Parameter(Mandatory)][byte[]]$Bytes, [Parameter(Mandatory)][string]$Arquivo, [Parameter(Mandatory)][string]$Destino, [scriptblock]$ProgressCallback)
    if (-not (Initialize-SparkXlsx)) { throw "Leitor rapido de Excel indisponivel (compilador C#) - nao consigo ler os nomes." }
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'indexando'; arquivo = $Arquivo; linha = 0 } }
    $ag = [SparkNomesAgg]::new($Bytes)
    try {
        $ultimo = [DateTime]::MinValue
        $mais = $true
        while ($mais) {
            $mais = $ag.Passo(2000)
            if ($ProgressCallback) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimo).TotalMilliseconds -ge 400) {
                    $ultimo = $agora
                    $msg = @{ fase = 'lendo'; arquivo = $Arquivo; linha = [int]$ag.LinhasLidas }
                    $tot = [int]$ag.TotalEstimado
                    if ($tot -gt 0) { $msg['total'] = $tot; $msg['percentual'] = [Math]::Min(99.0, [Math]::Round(100.0 * $ag.LinhasLidas / $tot, 1)) }
                    & $ProgressCallback $msg
                }
            }
        }
        $enc = [string[]]$ag.Encontradas()
        if ($enc -notcontains 'Id' -or $enc -notcontains 'Name') {
            throw ("Nao achei as colunas Id e Name em " + $Arquivo + " (achei: " + ($enc -join ', ') + ").")
        }
        $gravados = [int]$ag.Gravar($Destino)
        return @{ arquivo = $Arquivo; lidas = [int]$ag.Lidas; lidos = [int]$ag.Quantidade; semChave = [int]$ag.SemChave; totalGravado = $gravados }
    } finally { $ag.Dispose() }
}

function Read-XlsxColunas {
    <# Mesmos parametros e mesmo retorno de sempre (ver Read-XlsxColunasLento
       para a descricao completa de -ProgressCallback/-LinhaCallback). #>
    param(
        [Parameter(Mandatory)][byte[]]$Bytes,
        [Parameter(Mandatory)][string[]]$Colunas,
        [scriptblock]$ProgressCallback,
        [string]$ProgressLabel,
        [string]$ProgressFase,
        [scriptblock]$LinhaCallback
    )
    if (-not (Initialize-SparkXlsx)) {
        return (Read-XlsxColunasLento -Bytes $Bytes -Colunas $Colunas -ProgressCallback $ProgressCallback `
            -ProgressLabel $ProgressLabel -ProgressFase $ProgressFase -LinhaCallback $LinhaCallback)
    }
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'indexando'; arquivo = $ProgressLabel; linha = 0 } }
    $resultados = New-Object System.Collections.Generic.List[object]
    $rd = [SparkXlsxStream]::new($Bytes, [string[]]$Colunas)
    try {
        $ultimoProgresso = [DateTime]::MinValue
        while ($rd.Next()) {
            # v2.13.7: o total (<dimension>) so e lido DENTRO do Next(), entao tem
            # de ser consultado aqui (antes era lido antes do laco, valia 0 e o
            # progresso nunca era enviado). Sem total ainda manda "linha".
            if ($ProgressCallback -and (($rd.LinhasLidas % 200) -eq 0)) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                    $ultimoProgresso = $agora
                    $msg = @{ fase = $ProgressFase; arquivo = $ProgressLabel; linha = $rd.LinhasLidas }
                    $total = $rd.TotalEstimado
                    if ($total -gt 0) {
                        $msg.total = $total
                        $msg.percentual = [Math]::Min(99, [Math]::Round(100.0 * $rd.LinhasLidas / $total, 1))
                    }
                    & $ProgressCallback $msg
                }
            }
            if ($LinhaCallback) { & $LinhaCallback $rd.Row } else { $resultados.Add($rd.Row) }
        }
        return @{ linhas = $resultados; totalLinhas = $rd.LinhasLidas; colunasEncontradas = @($rd.ColunasEncontradas); cabecalhos = @($rd.Cabecalhos) }
    } finally {
        $rd.Dispose()
    }
}

function Read-VaoAgregado {
    <# v2.13.7 - le o Vao (793 mil linhas) e agrega por Protecao inteiramente em
       C# (SparkVaoAgg). O PowerShell so toca em tipos simples (numeros, texto).
       Devolve $null se o leitor C# nao estiver disponivel (quem chama cai no
       caminho antigo, com callback em PowerShell). #>
    param(
        [Parameter(Mandatory)][byte[]]$Bytes,
        [Parameter(Mandatory)][string[]]$Colunas,
        [scriptblock]$ProgressCallback,
        [string]$ProgressLabel,
        [string]$ProgressFase,
        [string]$ArquivoPostes
    )
    if (-not (Initialize-SparkXlsx)) { return $null }
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'indexando'; arquivo = $ProgressLabel; linha = 0 } }
    $ag = [SparkVaoAgg]::new($Bytes, [string[]]$Colunas)
    try {
        $ultimoProgresso = [DateTime]::MinValue
        $mais = $true
        while ($mais) {
            $mais = $ag.Passo(2000)
            if ($ProgressCallback) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                    $ultimoProgresso = $agora
                    $msg = @{ fase = $ProgressFase; arquivo = $ProgressLabel; linha = [int]$ag.LinhasLidas }
                    $total = [int]$ag.TotalEstimado
                    if ($total -gt 0) {
                        $msg['total'] = $total
                        $msg['percentual'] = [Math]::Min(99.0, [Math]::Round(100.0 * $ag.LinhasLidas / $total, 1))
                    }
                    & $ProgressCallback $msg
                }
            }
        }
        $lista = New-Object System.Collections.Generic.List[object]
        $qtd = [int]$ag.Quantidade
        for ($i = 0; $i -lt $qtd; $i++) {
            $it = $ag.Item($i)
            $lista.Add(@{ protecaoId = $it.Protecao; regional = $it.Regional; polo = $it.Polo; postes = $it.Postes; rotaKm = $it.RotaKm })
        }
        $enc = [string[]]$ag.Encontradas()
        $nPostes = 0
        if ($ArquivoPostes) { $nPostes = [int]$ag.EscreverPostes($ArquivoPostes) }
        return @{ itens = $lista; lidas = [int]$ag.Lidas; semChave = [int]$ag.SemChave; totalLinhas = [int]$ag.LinhasLidas; colunasEncontradas = $enc; postesKm = $nPostes }
    } finally {
        $ag.Dispose()
    }
}

function ConvertFrom-UtmParaLatLng {
    <# UTM -> lat/lng (fórmula inversa de Snyder) — traduzido linha a linha
       do Power Query M que já é usado hoje na planilha (elipsoide
       GRS80/SIRGAS2000: a=6378137, f=1/298.257222101; zona sempre tratada
       como hemisfério sul, offset fixo de 10.000.000 em Y, igual ao
       original). Mantido de propósito igual ao da planilha, inclusive na
       validação de região abaixo — é o que garante que os números batem
       com o que a equipe já confere hoje, em vez de só "matematicamente
       equivalente". Fora da região de atuação (SP + Sul de MG +
       Guarapuava), devolve $null — mesma regra do Power Query original
       (que devolve "" nesse caso), tratado por quem chama como "sem
       coordenada válida" (mesmo balde das OS sem X/Y preenchido). #>
    param(
        [Parameter(Mandatory)][double]$Leste,
        [Parameter(Mandatory)][double]$Norte,
        [int]$Zona = 22
    )
    $aaa = 6378137.0
    $f = 1.0 / 298.257222101
    $b = $aaa * (1 - $f)
    $e = [Math]::Sqrt([Math]::Pow($aaa,2) - [Math]::Pow($b,2)) / $aaa
    $eNegado = [Math]::Sqrt([Math]::Pow($aaa,2) - [Math]::Pow($b,2)) / $b
    $e1 = (1 - [Math]::Sqrt(1 - [Math]::Pow($e,2))) / (1 + [Math]::Sqrt(1 - [Math]::Pow($e,2)))

    $M = ($Norte - 10000000.0) / 0.9996
    $mu = $M / ($aaa * (1 - [Math]::Pow($e,2)/4 - 3*[Math]::Pow($e,4)/64 - 5*[Math]::Pow($e,6)/256))

    $Phi1 = $mu +
        [Math]::Sin(2*$mu) * ((3*$e1)/2 - 27*[Math]::Pow($e1,3)/32) +
        [Math]::Sin(4*$mu) * ((21*[Math]::Pow($e1,2))/16 - 55*[Math]::Pow($e1,4)/32) +
        [Math]::Sin(6*$mu) * ((151*[Math]::Pow($e1,3))/96) +
        [Math]::Sin(8*$mu) * ((1097*[Math]::Pow($e1,4))/512)

    $c1 = [Math]::Pow($eNegado,2) * [Math]::Pow([Math]::Cos($Phi1),2)
    $t1 = [Math]::Pow([Math]::Tan($Phi1),2)
    $n1 = $aaa / [Math]::Sqrt(1 - [Math]::Pow($e,2) * [Math]::Pow([Math]::Sin($Phi1),2))
    $r1 = $n1 * (1 - [Math]::Pow($e,2)) / (1 - [Math]::Pow($e,2) * [Math]::Pow([Math]::Sin($Phi1),2))
    $d = ($Leste - 500000.0) / ($n1 * 0.9996)

    $Phi = $Phi1 - ($n1 * [Math]::Tan($Phi1) / $r1) * (
        ([Math]::Pow($d,2) / 2) `
        - ([Math]::Pow($d,4) * (5 + 3*$t1 + 10*$c1 - 4*[Math]::Pow($c1,2) - 9*[Math]::Pow($eNegado,2)) / 24) `
        + ([Math]::Pow($d,6) * (61 + 90*$t1 + 298*$c1 + 45*[Math]::Pow($t1,2) - 3*[Math]::Pow($c1,2)) / 720)
    )

    $Lambda = (
        $d `
        - ([Math]::Pow($d,3) * (1 + 2*$t1 + $c1) / 6) `
        + ([Math]::Pow($d,5) * (5 - 2*$c1 + 28*$t1 - 3*[Math]::Pow($c1,2) + 24*[Math]::Pow($t1,2) + 8*[Math]::Pow($eNegado,2)) / 120)
    ) / [Math]::Cos($Phi1)

    $zcm = 3 + (6*($Zona - 1)) - 180

    $latitude = $Phi * 180.0 / [Math]::PI
    $longitude = $zcm + ($Lambda * 180.0 / [Math]::PI)

    if ($latitude -lt -26.0 -or $latitude -gt -19.5 -or $longitude -lt -53.2 -or $longitude -gt -43.5) {
        return $null
    }

    return @{ lat = $latitude; lng = $longitude }
}

function ConvertFrom-SerialExcelParaData {
    <# Excel guarda datas como número de série (dias desde 1899-12-30), mas
       algumas exportações trazem a data já formatada como texto
       ("24/11/2025 13:27:11"). Tenta as duas formas antes de desistir —
       devolve uma string ISO (yyyy-MM-dd) ou $null. #>
    param($Valor)
    if ([string]::IsNullOrWhiteSpace($Valor)) { return $null }
    $texto = $Valor.Trim()

    $num = 0.0
    if ([double]::TryParse($texto, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num) -and $num -gt 0) {
        try { return ([DateTime]::new(1899,12,30).AddDays($num)).ToString("yyyy-MM-dd") } catch { }
    }

    # O cast [string[]] é essencial aqui: sem ele, o PowerShell não resolve
    # a sobrecarga TryParseExact(string, string[], ...) direito (passa a
    # tratar como se fosse outra assinatura) e o parsing falha silenciosamente
    # pra QUALQUER data em formato texto (dd/MM/yyyy) — só as datas gravadas
    # como número de série do Excel (o caminho de cima) funcionavam. Achado
    # testando o novo filtro de período de execução: datas como
    # "01/03/2026 08:00:00" vinham sempre como $null.
    $formatos = [string[]]@("dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy")
    $data = [DateTime]::MinValue
    if ([DateTime]::TryParseExact($texto, $formatos, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$data)) {
        return $data.ToString("yyyy-MM-dd")
    }
    return $null
}
