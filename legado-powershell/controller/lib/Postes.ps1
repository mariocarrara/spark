# =============================================================================
# Postes.ps1 (v2.15.0 - o C# dos equipamentos de Equip.ps1 e compilado junto)
# Base de postes (shapefile PONNOT, pontos) + cadeia de posicao das OS SGM:
#     Coordenada da VERA  >  XY da grid  >  Poste (PONNOT)  >  centro da cidade
#
# - Import-PostesUpload : .shp + .dbf do PONNOT (soltos ou num .zip) -> model/postes.tsv
#   (TSV compacto: COD_ID, TIP_PN, ARE_LOC, CONJ, lat, lng, MUN - 1 linha por ponto;
#   MUN = codigo IBGE do municipio, v2.15.21).
#   Fica fora do JSON de proposito: sao ~760 mil pontos.
# - Set-PosicaoPorVeraEPoste : usado pelos importadores das grids (OS recem lidas).
# - Invoke-AplicarPosicaoPostesVera : reaplica a cadeia nas OS ja gravadas
#   (roda sozinho depois de importar o PONNOT; tambem em POST /api/postes/aplicar).
# =============================================================================

$Script:SparkPostesFonte = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

public class SparkPostesResultado
{
    public int Total;
    public int SemGeometria;
    public int Apagados;
    public Dictionary<string,int> PorTipo = new Dictionary<string,int>();
}

public static class SparkPostes
{
    private static string Texto(byte[] b, int ini, int len)
    {
        int fim = ini + len;
        while (fim > ini && (b[fim-1] == 32 || b[fim-1] == 0)) fim--;
        int i = ini;
        while (i < fim && (b[i] == 32 || b[i] == 0)) i++;
        if (fim <= i) return "";
        return Encoding.GetEncoding(28591).GetString(b, i, fim - i).Replace("\t", " ");
    }

    // Converte .shp (pontos) + .dbf do PONNOT num TSV compacto:
    // COD_ID \t TIP_PN \t ARE_LOC \t CONJ \t lat \t lng \t MUN
    public static SparkPostesResultado Converter(byte[] shp, byte[] dbf, string saida)
    {
        SparkPostesResultado r = new SparkPostesResultado();
        if (shp == null || shp.Length < 100) throw new Exception("Arquivo .shp vazio ou inválido.");
        if (dbf == null || dbf.Length < 33) throw new Exception("Arquivo .dbf vazio ou inválido.");
        int tipoShape = BitConverter.ToInt32(shp, 32);
        if (tipoShape != 1) throw new Exception("O shapefile não é de pontos (tipo " + tipoShape + "). Para postes envie o PONNOT (pontos).");

        int nRec = BitConverter.ToInt32(dbf, 4);
        int hdrLen = BitConverter.ToUInt16(dbf, 8);
        int recLen = BitConverter.ToUInt16(dbf, 10);
        int oCod = -1, lCod = 0, oTip = -1, lTip = 0, oAre = -1, lAre = 0, oConj = -1, lConj = 0, oMun = -1, lMun = 0;
        int off = 1;
        for (int p = 32; p + 32 <= hdrLen && dbf[p] != 0x0D; p += 32)
        {
            string nome = Encoding.ASCII.GetString(dbf, p, 11).Split('\0')[0].Trim().ToUpperInvariant();
            int len = dbf[p + 16];
            if (nome == "COD_ID") { oCod = off; lCod = len; }
            else if (nome == "TIP_PN") { oTip = off; lTip = len; }
            else if (nome == "ARE_LOC") { oAre = off; lAre = len; }
            else if (nome == "CONJ") { oConj = off; lConj = len; }
            else if (nome == "MUN") { oMun = off; lMun = len; }
            off += len;
        }
        if (oCod < 0) throw new Exception("O .dbf não tem a coluna COD_ID.");

        string tmp = saida + ".tmp";
        CultureInfo inv = CultureInfo.InvariantCulture;
        using (StreamWriter w = new StreamWriter(tmp, false, new UTF8Encoding(false)))
        {
            int pos = 100, idx = 0;
            while (pos + 8 <= shp.Length && idx < nRec)
            {
                int contLen = (shp[pos+4] << 24) | (shp[pos+5] << 16) | (shp[pos+6] << 8) | shp[pos+7]; // palavras de 16 bits, big-endian
                int dados = pos + 8;
                int bytesConteudo = contLen * 2;
                int rec = hdrLen + idx * recLen;
                idx++;
                if (rec + recLen > dbf.Length) { pos = dados + bytesConteudo; break; }
                if (dbf[rec] == (byte)'*') { r.Apagados++; pos = dados + bytesConteudo; continue; }
                int st = BitConverter.ToInt32(shp, dados);
                if (st != 1) { r.SemGeometria++; pos = dados + bytesConteudo; continue; }
                double x = BitConverter.ToDouble(shp, dados + 4);
                double y = BitConverter.ToDouble(shp, dados + 12);
                pos = dados + bytesConteudo;
                string cod = Texto(dbf, rec + oCod, lCod);
                if (cod.Length == 0) { r.SemGeometria++; continue; }
                string tip = oTip >= 0 ? Texto(dbf, rec + oTip, lTip) : "";
                string are = oAre >= 0 ? Texto(dbf, rec + oAre, lAre) : "";
                string conj = oConj >= 0 ? Texto(dbf, rec + oConj, lConj) : "";
                string mun = oMun >= 0 ? Texto(dbf, rec + oMun, lMun) : "";
                w.Write(cod); w.Write('\t'); w.Write(tip); w.Write('\t'); w.Write(are); w.Write('\t'); w.Write(conj); w.Write('\t');
                w.Write(y.ToString("0.000000", inv)); w.Write('\t'); w.Write(x.ToString("0.000000", inv)); w.Write('\t'); w.Write(mun); w.Write('\n');
                r.Total++;
                int c; r.PorTipo.TryGetValue(tip, out c); r.PorTipo[tip] = c + 1;
            }
        }
        if (File.Exists(saida)) File.Delete(saida);
        File.Move(tmp, saida);
        return r;
    }

    // Procura só os ids pedidos: id -> "TIP \t ARE \t CONJ \t lat \t lng \t MUN"
    public static Dictionary<string,string> Buscar(string arquivo, HashSet<string> ids)
    {
        Dictionary<string,string> achou = new Dictionary<string,string>();
        if (ids == null || ids.Count == 0 || !File.Exists(arquivo)) return achou;
        using (StreamReader rd = new StreamReader(arquivo, new UTF8Encoding(false)))
        {
            string linha;
            while ((linha = rd.ReadLine()) != null)
            {
                int t = linha.IndexOf('\t');
                if (t <= 0) continue;
                string id = linha.Substring(0, t);
                if (ids.Contains(id)) achou[id] = linha.Substring(t + 1);
            }
        }
        return achou;
    }
}
public class SparkPostesAreaResultado
{
    public int Total;
    public bool Truncado;
    public List<string[]> Pontos = new List<string[]>();
}

public class SparkPostesIndice
{
    public int N;
    public DateTime Mtime;
    public string[] Id;
    public double[] Lat;
    public double[] Lng;
    public byte[] Tipo;
    public byte[] Are;
    public string[] Conj;
    public List<string> Tipos = new List<string>();
    public List<string> Ares = new List<string>();
}

public static class SparkPostesArea
{
    private static SparkPostesIndice indice;
    private static string indiceArquivo;
    private static readonly object trava = new object();

    private static SparkPostesIndice Carregar(string arquivo)
    {
        DateTime mt = File.GetLastWriteTimeUtc(arquivo);
        lock (trava)
        {
            if (indice != null && indiceArquivo == arquivo && indice.Mtime == mt) return indice;
            string[] linhas = File.ReadAllLines(arquivo, new UTF8Encoding(false));
            SparkPostesIndice ix = new SparkPostesIndice();
            ix.Mtime = mt;
            int n = linhas.Length;
            ix.Id = new string[n]; ix.Lat = new double[n]; ix.Lng = new double[n];
            ix.Tipo = new byte[n]; ix.Are = new byte[n]; ix.Conj = new string[n];
            Dictionary<string,int> tmap = new Dictionary<string,int>();
            Dictionary<string,int> amap = new Dictionary<string,int>();
            CultureInfo inv = CultureInfo.InvariantCulture;
            int k = 0;
            for (int i = 0; i < n; i++)
            {
                string[] p = linhas[i].Split('\t');
                if (p.Length < 6) continue;
                double la, lo;
                if (!double.TryParse(p[4], NumberStyles.Float, inv, out la)) continue;
                if (!double.TryParse(p[5], NumberStyles.Float, inv, out lo)) continue;
                int t; if (!tmap.TryGetValue(p[1], out t)) { t = ix.Tipos.Count; ix.Tipos.Add(p[1]); tmap[p[1]] = t; }
                int a; if (!amap.TryGetValue(p[2], out a)) { a = ix.Ares.Count; ix.Ares.Add(p[2]); amap[p[2]] = a; }
                ix.Id[k] = p[0]; ix.Lat[k] = la; ix.Lng[k] = lo; ix.Tipo[k] = (byte)t; ix.Are[k] = (byte)a; ix.Conj[k] = p[3];
                k++;
            }
            ix.N = k;
            indice = ix; indiceArquivo = arquivo;
            return ix;
        }
    }

    public static SparkPostesIndice Indice(string arquivo) { return Carregar(arquivo); }

    public static string[] TiposDisponiveis(string arquivo)
    {
        if (!File.Exists(arquivo)) return new string[0];
        return Carregar(arquivo).Tipos.ToArray();
    }

    // Pontos dentro do retangulo (graus). tiposCsv vazio = todos os tipos.
    public static SparkPostesAreaResultado Area(string arquivo, double sul, double oeste, double norte, double leste, string tiposCsv, int limite)
    {
        SparkPostesAreaResultado r = new SparkPostesAreaResultado();
        if (!File.Exists(arquivo)) return r;
        SparkPostesIndice ix = Carregar(arquivo);
        bool[] tipoOk = new bool[ix.Tipos.Count];
        bool todos = string.IsNullOrEmpty(tiposCsv);
        if (!todos)
        {
            string[] ts = tiposCsv.Split(',');
            for (int i = 0; i < ix.Tipos.Count; i++)
                for (int j = 0; j < ts.Length; j++)
                    if (string.Equals(ix.Tipos[i], ts[j].Trim(), StringComparison.OrdinalIgnoreCase)) tipoOk[i] = true;
        }
        CultureInfo inv = CultureInfo.InvariantCulture;
        for (int i = 0; i < ix.N; i++)
        {
            double la = ix.Lat[i], lo = ix.Lng[i];
            if (la < sul || la > norte || lo < oeste || lo > leste) continue;
            if (!todos && !tipoOk[ix.Tipo[i]]) continue;
            r.Total++;
            if (r.Pontos.Count < limite)
                r.Pontos.Add(new string[] { ix.Id[i], ix.Tipos[ix.Tipo[i]], ix.Ares[ix.Are[i]], ix.Conj[i], la.ToString("0.000000", inv), lo.ToString("0.000000", inv) });
            else r.Truncado = true;
        }
        return r;
    }
}

public class SparkPostesListaResultado
{
    public int Total;
    public List<string[]> Linhas = new List<string[]>();
}

public static class SparkPostesLista
{
    // Lista paginada: busca = parte do COD_ID (ou do CONJ/ARE_LOC exatos); tipo vazio = todos.
    public static SparkPostesListaResultado Listar(string arquivo, string busca, string tipo, int pular, int tamanho)
    {
        SparkPostesListaResultado r = new SparkPostesListaResultado();
        if (!File.Exists(arquivo)) return r;
        SparkPostesIndice ix = SparkPostesArea.Indice(arquivo);
        int tipoIdx = -1;
        if (!string.IsNullOrEmpty(tipo))
        {
            for (int i = 0; i < ix.Tipos.Count; i++) if (string.Equals(ix.Tipos[i], tipo, StringComparison.OrdinalIgnoreCase)) tipoIdx = i;
            if (tipoIdx < 0) return r;
        }
        bool temBusca = !string.IsNullOrEmpty(busca);
        CultureInfo inv = CultureInfo.InvariantCulture;
        for (int i = 0; i < ix.N; i++)
        {
            if (tipoIdx >= 0 && ix.Tipo[i] != tipoIdx) continue;
            if (temBusca && ix.Id[i].IndexOf(busca, StringComparison.OrdinalIgnoreCase) < 0
                && !string.Equals(ix.Conj[i], busca, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(ix.Ares[ix.Are[i]], busca, StringComparison.OrdinalIgnoreCase)) continue;
            if (r.Total >= pular && r.Linhas.Count < tamanho)
                r.Linhas.Add(new string[] { ix.Id[i], ix.Tipos[ix.Tipo[i]], ix.Ares[ix.Are[i]], ix.Conj[i], ix.Lat[i].ToString("0.000000", inv), ix.Lng[i].ToString("0.000000", inv) });
            r.Total++;
        }
        return r;
    }
}
'@

function Initialize-SparkPostes {
    if ($Script:SparkPostesPronto -eq $true) { return $true }
    if ($Script:SparkPostesPronto -eq $false) { return $false }
    try {
        if (-not ('SparkPostes' -as [type])) {
            Add-Type -TypeDefinition $Script:SparkPostesFonte -Language CSharp -ReferencedAssemblies @('System.dll') -ErrorAction Stop
        }
        $Script:SparkPostesPronto = $true
    } catch {
        Write-Host ("  [aviso] leitor de postes indisponivel (" + $_.Exception.Message + ")") -ForegroundColor Yellow
        $Script:SparkPostesPronto = $false
    }
    return $Script:SparkPostesPronto
}

# v2.15.21 - codigo IBGE do municipio (MUN do PONNOT) -> nome. A grid pendente nao traz
# 'Localidade'; a OS ganha o municipio do poste. Semente aprendida das OS executadas
# (poste -> MUN x Localidade da grid, coerencia total); o que faltar (ou estiver
# diferente) se corrige na Gestao de Bases > Municipios (model/municipios.json), que
# tem prioridade sobre a semente.
$Script:SparkMunicipiosSemente = @{
    '3109105' = 'BUENO BRANDAO'
    '3110509' = 'CAMANDUCAIA'
    '3110608' = 'CAMBUI'
    '3119906' = 'CORREGO DO BOM JESUS'
    '3124500' = 'ESTIVA'
    '3125101' = 'EXTREMA'
    '3133600' = 'ITAPEVA'
    '3143807' = 'MUNHOZ'
    '3165578' = 'SENADOR AMARAL'
    '3169109' = 'TOLEDO'
    '3500105' = 'ADAMANTINA'
    '3500204' = 'ADOLFO'
    '3500808' = 'ALFREDO MARCONDES'
    '3501301' = 'ALVARES MACHADO'
    '3503356' = 'ARCO IRIS'
    '3504008' = 'ASSIS'
    '3505807' = 'BASTOS'
    '3507209' = 'BORA'
    '3507407' = 'BORBOREMA'
    '3507605' = 'BRAGANCA PAULISTA'
    '3508900' = 'CAIABU'
    '3509106' = 'CAIUA'
    '3510005' = 'CANDIDO MOTA'
    '3511102' = 'CATANDUVA'
    '3511201' = 'CATIGUA'
    '3513306' = 'CRUZALIA'
    '3514700' = 'ECHAPORA'
    '3514924' = 'ELISIARIO'
    '3515129' = 'EMILIANOPOLIS'
    '3516101' = 'FLORINEA'
    '3519204' = 'IACRI'
    '3519501' = 'IBIRAREMA'
    '3519907' = 'IEPE'
    '3520608' = 'INDIANA'
    '3520806' = 'INUBIA PAULISTA'
    '3521507' = 'IRAPUA'
    '3521903' = 'ITAJOBI'
    '3525508' = 'JOANOPOLIS'
    '3525607' = 'JOAO RAMALHO'
    '3527405' = 'LUCELIA'
    '3527900' = 'LUTECIA'
    '3528809' = 'MARACAI'
    '3528858' = 'MARAPOAMA'
    '3529203' = 'MARTINOPOLIS'
    '3529500' = 'MENDONCA'
    '3531209' = 'MONTE ALEGRE DO SUL'
    '3532157' = 'NANTES'
    '3532801' = 'NOVA ALIANCA'
    '3533254' = 'NOVAIS'
    '3533502' = 'NOVO HORIZONTE'
    '3534500' = 'OSCAR BRESSANE'
    '3534609' = 'OSVALDO CRUZ'
    '3535309' = 'PALMITAL'
    '3535507' = 'PARAGUACU PAULISTA'
    '3536000' = 'PARAPUA'
    '3536802' = 'PEDRA BELA'
    '3537156' = 'PEDRINHAS PAULISTA'
    '3538105' = 'ROBERTO'
    '3538204' = 'PINHALZINHO'
    '3538303' = 'PIQUEROBI'
    '3539707' = 'PLATINA'
    '3540853' = 'PRACINHA'
    '3541208' = 'PRESIDENTE BERNARDES'
    '3541307' = 'PRESIDENTE EPITACIO'
    '3541406' = 'PRESIDENTE PRUDENTE'
    '3541505' = 'PRESIDENTE VENCESLAU'
    '3541703' = 'QUATA'
    '3542206' = 'RANCHARIA'
    '3542404' = 'REGENTE FEIJO'
    '3543204' = 'RIBEIRAO DO SUL'
    '3543238' = 'RIBEIRAO DOS INDIOS'
    '3543808' = 'RINOPOLIS'
    '3544707' = 'SAGRES'
    '3544806' = 'SALES'
    '3545100' = 'SALMOURAO'
    '3545407' = 'SALTO GRANDE'
    '3547700' = 'SANTO ANASTACIO'
    '3548302' = 'SANTO EXPEDITO'
    '3552601' = 'TABAPUA'
    '3552908' = 'TACIBA'
    '3553955' = 'TARUMA'
    '3554953' = 'TUIUTI'
    '3555000' = 'TUPA'
    '3556008' = 'URUPES'
    '3556354' = 'VARGEM'
    '4109401' = 'GUARAPUAVA'
}

function Get-TabelaMunicipios {
    <# codigo IBGE (texto) -> nome do municipio. Base editavel por cima da semente. #>
    $t = @{}
    foreach ($k in $Script:SparkMunicipiosSemente.Keys) { $t[[string]$k] = [string]$Script:SparkMunicipiosSemente[$k] }
    foreach ($m in @(Read-JsonModel -Entity "municipios")) {
        if ($m.excluido) { continue }
        $c = ([string]$m.codigo).Trim(); $n = ([string]$m.nome).Trim()
        if ($c -and $n) { $t[$c] = $n }
    }
    return $t
}

function Get-PostesArquivo { return (Join-Path $Script:ModelRoot "postes.tsv") }

function Import-PostesUpload {
    param([Parameter(Mandatory)][array]$Arquivos, [scriptblock]$ProgressCallback)

    if (-not (Initialize-SparkPostes)) { throw "Nao consegui carregar o leitor de postes (compilador C# indisponivel)." }
    $shpBytes = $null; $dbfBytes = $null
    $zipArquivo = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".zip"
    if ($zipArquivo) {
        if ($ProgressCallback) { & $ProgressCallback @{ fase = "descompactando"; percentual = 5 } }
        $ms = New-Object System.IO.MemoryStream(,$zipArquivo.Bytes)
        $zip = [System.IO.Compression.ZipArchive]::new($ms, [System.IO.Compression.ZipArchiveMode]::Read)
        try {
            foreach ($entry in $zip.Entries) {
                $n = $entry.Name.ToLower()
                if ($n.EndsWith(".shp") -or $n.EndsWith(".dbf")) {
                    $s = $entry.Open(); $buf = New-Object System.IO.MemoryStream; $s.CopyTo($buf); $s.Close()
                    if ($n.EndsWith(".shp")) { $shpBytes = $buf.ToArray() } else { $dbfBytes = $buf.ToArray() }
                }
            }
        } finally { $zip.Dispose(); $ms.Dispose() }
    } else {
        $a = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".shp"; if ($a) { $shpBytes = $a.Bytes }
        $b = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".dbf"; if ($b) { $dbfBytes = $b.Bytes }
    }
    if (-not $shpBytes -or -not $dbfBytes) { throw "Nao encontrei o .shp e o .dbf do PONNOT no que foi enviado (soltos ou dentro de um .zip)." }

    if ($ProgressCallback) { & $ProgressCallback @{ fase = "gravando"; arquivo = "convertendo os pontos do PONNOT"; percentual = 30 } }
    $r = [SparkPostes]::Converter($shpBytes, $dbfBytes, (Get-PostesArquivo))
    $porTipo = [ordered]@{}
    foreach ($k in ($r.PorTipo.Keys | Sort-Object)) { $porTipo[$(if ($k) { $k } else { '(vazio)' })] = $r.PorTipo[$k] }
    return @{ total = [int]$r.Total; semGeometria = [int]$r.SemGeometria; apagados = [int]$r.Apagados; porTipo = $porTipo }
}

function Get-PostesMapa {
    <# ids (HashSet[string]) -> hashtable id -> @{ tipo; areaLocal; conjunto; lat; lng; mun } #>
    param([System.Collections.Generic.HashSet[string]]$Ids)
    $mapa = @{}
    if (-not $Ids -or $Ids.Count -eq 0) { return $mapa }
    if (-not (Test-Path (Get-PostesArquivo))) { return $mapa }
    if (-not (Initialize-SparkPostes)) { return $mapa }
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $achou = [SparkPostes]::Buscar((Get-PostesArquivo), $Ids)
    foreach ($id in $achou.Keys) {
        $p = $achou[$id].Split("`t")
        if ($p.Count -lt 5) { continue }
        $mapa[$id] = @{ tipo = $p[0]; areaLocal = $p[1]; conjunto = $p[2]; lat = [double]::Parse($p[3], $inv); lng = [double]::Parse($p[4], $inv); mun = $(if ($p.Count -ge 6) { ([string]$p[5]).Trim() } else { '' }) }
    }
    return $mapa
}

function Get-PostesArea {
    <# Pontos do PONNOT dentro de um retangulo (camada "Ativos" do mapa). Tipos = "POS,TOR" ou vazio. #>
    param([double]$Sul, [double]$Oeste, [double]$Norte, [double]$Leste, [string]$Tipos = "", [int]$Limite = 4000)
    $vazio = @{ total = 0; truncado = $false; tipos = @(); pontos = @() }
    if (-not (Test-Path (Get-PostesArquivo))) { return $vazio }
    if (-not (Initialize-SparkPostes)) { return $vazio }
    $arq = Get-PostesArquivo
    $r = [SparkPostesArea]::Area($arq, $Sul, $Oeste, $Norte, $Leste, $Tipos, $Limite)
    $pts = New-Object System.Collections.ArrayList
    foreach ($p in $r.Pontos) { [void]$pts.Add(@($p[0], $p[1], $p[2], $p[3], [double]$p[4], [double]$p[5])) }
    return @{ total = [int]$r.Total; truncado = [bool]$r.Truncado; tipos = @([SparkPostesArea]::TiposDisponiveis($arq)); pontos = $pts.ToArray() }
}

function Get-PostesLista {
    param([string]$Busca = "", [string]$Tipo = "", [int]$Pagina = 1, [int]$Tamanho = 50)
    $vazio = @{ total = 0; pagina = $Pagina; tamanhoPagina = $Tamanho; linhas = @() }
    if (-not (Test-Path (Get-PostesArquivo))) { return $vazio }
    if (-not (Initialize-SparkPostes)) { return $vazio }
    $pular = ([math]::Max(1, $Pagina) - 1) * $Tamanho
    $r = [SparkPostesLista]::Listar((Get-PostesArquivo), $Busca, $Tipo, $pular, $Tamanho)
    $linhas = New-Object System.Collections.ArrayList
    foreach ($p in $r.Linhas) { [void]$linhas.Add(@{ codId = $p[0]; tipo = $p[1]; areaLocal = $p[2]; conjunto = $p[3]; lat = [double]$p[4]; lng = [double]$p[5] }) }
    return @{ total = [int]$r.Total; pagina = $Pagina; tamanhoPagina = $Tamanho; linhas = $linhas.ToArray() }
}

function Remove-PostesBase {
    $arq = Get-PostesArquivo
    if (Test-Path $arq) { Remove-Item -LiteralPath $arq -Force }
    Write-JsonModel -Entity "postes_meta" -Data @()
}

function Get-VeraMapa {
    <# ids da VERA (HashSet[string]) -> hashtable id -> @{ lat; lng } #>
    param([System.Collections.Generic.HashSet[string]]$Ids)
    $mapa = @{}
    if (-not $Ids -or $Ids.Count -eq 0) { return $mapa }
    foreach ($v in @(Read-JsonModel -Entity "vera")) {
        if ($v.excluido) { continue }
        $id = ([string]$v.idVera).Trim()
        if ($id -and $Ids.Contains($id) -and $null -ne $v.lat -and $null -ne $v.lng) { $mapa[$id] = @{ lat = [double]$v.lat; lng = [double]$v.lng } }
    }
    return $mapa
}

function Get-IdVeraDaGrid {
    <# "CODIGO DA ARVORE" da grid SGM (id da arvore na VERA). Vazio/"-" -> $null #>
    param($Linha)
    $t = ([string]$Linha['CODIGO DA ARVORE']).Trim()
    if ([string]::IsNullOrWhiteSpace($t) -or $t -eq '-' -or $t -eq '0') { return $null }
    if ($t.StartsWith('=')) { $t = $t.TrimStart('=').Trim('"') }
    if ($t -match '^\d+\.0+$') { $t = $t.Substring(0, $t.IndexOf('.')) }
    return $t
}

function Resolve-PosicaoOS {
    <# VERA > XY > POSTE. Devolve @{ lat; lng; origem } ou $null (sem posicao melhor que a cidade). #>
    param($IdVera, $PosteId, $VeraMapa, $PosteMapa, $LatXY, $LngXY)
    if ($IdVera -and $VeraMapa.ContainsKey([string]$IdVera)) {
        $v = $VeraMapa[[string]$IdVera]; return @{ lat = $v.lat; lng = $v.lng; origem = 'VERA' }
    }
    if ($null -ne $LatXY -and $null -ne $LngXY) { return @{ lat = $LatXY; lng = $LngXY; origem = 'XY' } }
    if ($PosteId -and $PosteMapa.ContainsKey([string]$PosteId)) {
        $p = $PosteMapa[[string]$PosteId]; return @{ lat = $p.lat; lng = $p.lng; origem = 'POSTE' }
    }
    return $null
}

function Set-PosicaoPorVeraEPoste {
    <# Importadores das grids: aplica VERA > XY > POSTE nas OS recem lidas ($Novos, hashtables)
       e devolve a lista das que continuam SEM posicao (essas vao pro centro da cidade). #>
    param([Parameter(Mandatory)]$Novos, [Parameter(Mandatory)]$SemCoordLista)
    $stats = @{ veraComId = 0; veraUsada = 0; posteComId = 0; posteEncontrado = 0; posteUsado = 0; localidadePorPoste = 0 }
    $tabMun = Get-TabelaMunicipios
    $idsVera = [System.Collections.Generic.HashSet[string]]::new()
    $idsPoste = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($r in $Novos) {
        if ($r['idVera']) { [void]$idsVera.Add([string]$r['idVera']); $stats.veraComId++ }
        if ($r['posteId']) { [void]$idsPoste.Add([string]$r['posteId']); $stats.posteComId++ }
    }
    $veraMapa = Get-VeraMapa -Ids $idsVera
    $posteMapa = Get-PostesMapa -Ids $idsPoste
    $semAinda = New-Object System.Collections.Generic.List[object]
    foreach ($r in $Novos) {
        $loc = $r['localizacao']
        $temXY = ($null -ne $loc['lat'] -and $null -ne $loc['lng'])
        $res = Resolve-PosicaoOS -IdVera $r['idVera'] -PosteId $r['posteId'] -VeraMapa $veraMapa -PosteMapa $posteMapa -LatXY $(if ($temXY) { $loc['lat'] } else { $null }) -LngXY $(if ($temXY) { $loc['lng'] } else { $null })
        if ($r['posteId'] -and $posteMapa.ContainsKey([string]$r['posteId'])) {
            $p = $posteMapa[[string]$r['posteId']]; $stats.posteEncontrado++
            $r['posteTipo'] = $p.tipo; $r['posteAreaLocal'] = $p.areaLocal; $r['posteConjunto'] = $p.conjunto; $r['posteLat'] = $p.lat; $r['posteLng'] = $p.lng
            $r['posteMun'] = $p.mun
            # v2.15.21 - sem Localidade na grid (pendente): usa o municipio do poste
            if ([string]::IsNullOrWhiteSpace([string]$r['localidade']) -and $p.mun -and $tabMun.ContainsKey([string]$p.mun)) {
                $r['localidade'] = $tabMun[[string]$p.mun]; $r['localidadePorPoste'] = $true; $stats.localidadePorPoste++
            }
        }
        if ($res) {
            $loc['lat'] = [Math]::Round([double]$res.lat, 6); $loc['lng'] = [Math]::Round([double]$res.lng, 6)
            $loc['aproximada'] = $false; $loc['origem'] = $res.origem
            if ($res.origem -eq 'VERA') { $stats.veraUsada++ } elseif ($res.origem -eq 'POSTE') { $stats.posteUsado++ }
        }
    }
    foreach ($it in $SemCoordLista) {
        $loc = $it['reg']['localizacao']
        if ($null -eq $loc['lat'] -or $null -eq $loc['lng']) { $semAinda.Add($it) }
    }
    return @{ semCoord = $semAinda; stats = $stats }
}

function Set-OrigemCidadeNasAproximadas {
    param($SemCoordLista)
    foreach ($it in $SemCoordLista) {
        $loc = $it['reg']['localizacao']
        if ($loc['aproximada']) { $loc['origem'] = 'CIDADE' }
    }
}

function Invoke-AplicarPosicaoPostesVera {
    <# Reaplica a cadeia nas OS SGM JA gravadas (model/manutencao_os.json). Usado depois de
       importar o PONNOT (ou a VERA) sem precisar reimportar as grids. Nao mexe em OS SIGOD. #>
    param([scriptblock]$ProgressCallback)
    $os = @(Read-JsonModel -Entity "manutencao_os")
    $idsVera = [System.Collections.Generic.HashSet[string]]::new()
    $idsPoste = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($o in $os) {
        if ($o.origem -ne 'SGM') { continue }
        if ($o.idVera) { [void]$idsVera.Add([string]$o.idVera) }
        if ($o.posteId) { [void]$idsPoste.Add([string]$o.posteId) }
    }
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'cruzando'; arquivo = 'cruzando OS com VERA e postes'; percentual = 70 } }
    $veraMapa = Get-VeraMapa -Ids $idsVera
    $posteMapa = Get-PostesMapa -Ids $idsPoste
    $st = @{ osComPoste = $idsPoste.Count; posteEncontrado = 0; osAtualizadas = 0; viraramVera = 0; viraramPoste = 0; localidadePorPoste = 0 }
    $tabMun = Get-TabelaMunicipios
    $nOs = $os.Count; $iOs = 0
    foreach ($o in $os) {
        $iOs++
        if (($iOs % 5000) -eq 0 -and $ProgressCallback) { & $ProgressCallback @{ fase = 'cruzando'; arquivo = ('cruzando OS com VERA e postes: ' + $iOs + ' de ' + $nOs); percentual = [int](70 + 25 * $iOs / [math]::Max(1, $nOs)) } }
        if ($o.origem -ne 'SGM' -or -not $o.localizacao) { continue }
        $loc = $o.localizacao
        $mudou = $false
        if ($o.posteId -and $posteMapa.ContainsKey([string]$o.posteId)) {
            $p = $posteMapa[[string]$o.posteId]; $st.posteEncontrado++
            Set-PropValor $o 'posteTipo' $p.tipo; Set-PropValor $o 'posteAreaLocal' $p.areaLocal; Set-PropValor $o 'posteConjunto' $p.conjunto
            Set-PropValor $o 'posteLat' $p.lat; Set-PropValor $o 'posteLng' $p.lng; $mudou = $true
            Set-PropValor $o 'posteMun' $p.mun
            # v2.15.21 - OS sem localidade (pendente) ou com localidade ja vinda do poste: acompanha o municipio do poste
            if ($p.mun -and $tabMun.ContainsKey([string]$p.mun) -and ([string]::IsNullOrWhiteSpace([string]$o.localidade) -or $o.localidadePorPoste)) {
                Set-PropValor $o 'localidade' $tabMun[[string]$p.mun]; Set-PropValor $o 'localidadePorPoste' $true; $st.localidadePorPoste++
            }
        }
        # XY so existe se a posicao atual veio do XY da grid (origem XY, ou gravada antes de existir "origem")
        $ehXY = (-not $loc.aproximada) -and ($null -ne $loc.lat) -and ($null -ne $loc.lng) -and ((-not $loc.origem) -or $loc.origem -eq 'XY')
        $res = Resolve-PosicaoOS -IdVera $o.idVera -PosteId $o.posteId -VeraMapa $veraMapa -PosteMapa $posteMapa -LatXY $(if ($ehXY) { $loc.lat } else { $null }) -LngXY $(if ($ehXY) { $loc.lng } else { $null })
        if ($res -and ($loc.origem -ne $res.origem -or $res.origem -ne 'XY')) {
            if ($res.origem -ne 'XY') {
                Set-PropValor $loc 'lat' ([Math]::Round([double]$res.lat, 6)); Set-PropValor $loc 'lng' ([Math]::Round([double]$res.lng, 6))
                Set-PropValor $loc 'aproximada' $false
                if ($res.origem -eq 'VERA') { $st.viraramVera++ } else { $st.viraramPoste++ }
            }
            Set-PropValor $loc 'origem' $res.origem; $mudou = $true
        } elseif (-not $res -and $loc.aproximada -and $loc.origem -ne 'CIDADE') {
            Set-PropValor $loc 'origem' 'CIDADE'; $mudou = $true
        }
        if ($mudou) { $st.osAtualizadas++ }
    }
    if ($st.osAtualizadas -gt 0) {
        if ($ProgressCallback) { & $ProgressCallback @{ fase = 'gravando'; percentual = 95 } }
        Write-JsonModel -Entity "manutencao_os" -Data $os
    }
    return $st
}
