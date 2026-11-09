# =============================================================================
# Equip.ps1 (v2.15.0)
# Equipamentos da rede ligados ao POSTE (PONNOT):
#     trafos (UNTRMT), protecoes (UNSEMT), reguladores (UNREMT), capacitores (UNCRMT)
#
# Os DBFs da BDGD (UN*) NAO trazem geometria nem o campo do poste, mas o PAC_1
# de cada unidade e' um codigo que carrega a coordenada:
#     45744789755289990ET  ->  X 457447,89  Y 7552899,90  (SIRGAS 2000 / UTM 22S)
# O Controller decodifica o PAC, converte para lat/lng e acha o poste do PONNOT
# a menos de 8 m. Resultado: model/equip_<camada>.tsv (1 linha por equipamento):
#   COD_ID \t POSTE \t lat \t lng \t CTMT \t CONJ \t v0 \t v1 \t v2 \t v3 \t v4
# O significado de v0..v4 depende da camada (ver SparkEquip.Campos).
# Roda no mesmo Add-Type do Postes.ps1 (precisa dos tipos SparkPostesArea/Indice).
# =============================================================================

$Script:SparkEquipFonte = @'

public class SparkEquipResultado
{
    public int Total;
    public int ComPoste;
    public int SemPoste;
    public int SemPosicao;
    public int Apagados;
    public Dictionary<string,int> PorTipo = new Dictionary<string,int>();
}

public class SparkPosteGrade
{
    public SparkPostesIndice Ix;
    public long[] Chave;
    public int[] Ordem;
    public const double Cel = 0.0005;

    public static long K(int ia, int ib) { return (long)ia * 1000000L + (long)ib; }

    public SparkPosteGrade(SparkPostesIndice ix)
    {
        Ix = ix;
        int n = ix.N;
        Chave = new long[n];
        Ordem = new int[n];
        for (int i = 0; i < n; i++)
        {
            Chave[i] = K((int)Math.Floor((ix.Lat[i] + 90.0) / Cel), (int)Math.Floor((ix.Lng[i] + 180.0) / Cel));
            Ordem[i] = i;
        }
        Array.Sort(Chave, Ordem);
    }

    private int Inicio(long k)
    {
        int lo = 0, hi = Chave.Length;
        while (lo < hi) { int m = (lo + hi) >> 1; if (Chave[m] < k) lo = m + 1; else hi = m; }
        return lo;
    }

    // poste mais proximo (indice) a ate maxM metros; -1 se nao houver
    public int Mais(double lat, double lng, double maxM, out double distM)
    {
        distM = 1e18;
        int melhor = -1;
        int ia = (int)Math.Floor((lat + 90.0) / Cel), ib = (int)Math.Floor((lng + 180.0) / Cel);
        double kx = 111320.0 * Math.Cos(lat * Math.PI / 180.0), ky = 111320.0;
        for (int da = -1; da <= 1; da++)
            for (int db = -1; db <= 1; db++)
            {
                long k = K(ia + da, ib + db);
                for (int j = Inicio(k); j < Chave.Length && Chave[j] == k; j++)
                {
                    int p = Ordem[j];
                    double dx = (Ix.Lng[p] - lng) * kx, dy = (Ix.Lat[p] - lat) * ky;
                    double d = Math.Sqrt(dx * dx + dy * dy);
                    if (d < distM) { distM = d; melhor = p; }
                }
            }
        if (melhor >= 0 && distM > maxM) return -1;
        return melhor;
    }
}

public static class SparkEquip
{
    private static SparkPosteGrade grade;
    private static SparkPostesIndice gradeBase;
    private static readonly object trava = new object();

    public static string[] Campos(string camada)
    {
        switch (camada)
        {
            case "trafos":      return new string[] { "POT_NOM", "POSTO", "TEN_LIN_SE", "FAS_CON_P", "TIP_TRAFO" };
            case "protecoes":   return new string[] { "TIP_UNID", "CAP_ELO", "COR_NOM", "P_N_OPE", "FAS_CON" };
            case "reguladores": return new string[] { "TIP_REGU", "FAS_CON", "BANC", "TIP_UNID", "" };
            case "capacitores": return new string[] { "POT_NOM", "FAS_CON", "BANC", "TIP_UNID", "" };
        }
        return null;
    }

    // coluna (dentro de v0..v4) usada como "tipo" nos resumos/filtros
    public static int IdxTipo(string camada)
    {
        switch (camada) { case "trafos": return 1; case "capacitores": return 3; }
        return 0;
    }

    private static string Texto(byte[] b, int ini, int len)
    {
        int fim = ini + len;
        while (fim > ini && (b[fim-1] == 32 || b[fim-1] == 0)) fim--;
        int i = ini;
        while (i < fim && (b[i] == 32 || b[i] == 0)) i++;
        if (fim <= i) return "";
        return Encoding.GetEncoding(28591).GetString(b, i, fim - i).Replace("\t", " ").Replace("\r", " ").Replace("\n", " ");
    }

    // PAC com coordenada: <X*100><Y*100 em 9 digitos><2 letras>. Falso se for um PAC "de nome" (ex.: 2JQM156771).
    public static bool DecodePac(string s, out double e, out double n)
    {
        e = 0; n = 0;
        if (s == null || s.Length < 12) return false;
        int L = s.Length;
        if (!(char.IsLetter(s[L-1]) && char.IsLetter(s[L-2]))) return false;
        int dl = L - 2;
        if (dl < 10 || dl > 18) return false;
        for (int i = 0; i < dl; i++) if (s[i] < '0' || s[i] > '9') return false;
        long y, x;
        if (!long.TryParse(s.Substring(dl - 9, 9), out y)) return false;
        if (!long.TryParse(s.Substring(0, dl - 9), out x)) return false;
        n = y / 100.0; e = x / 100.0;
        return e > 100000.0 && e < 1300000.0 && n > 6500000.0 && n < 8300000.0;
    }

    // UTM (SIRGAS 2000 / GRS80), hemisferio sul, meridiano central lon0 -> graus
    public static void UtmSulParaLatLng(double E, double N, double lon0, out double lat, out double lng)
    {
        double a = 6378137.0, f = 1.0 / 298.257222101, k0 = 0.9996;
        double n1 = f / (2.0 - f), n2 = n1 * n1, n3 = n2 * n1, n4 = n3 * n1;
        double A = a / (1.0 + n1) * (1.0 + n2 / 4.0 + n4 / 64.0);
        double xi1 = (N - 10000000.0) / (k0 * A), eta1 = (E - 500000.0) / (k0 * A);
        double b1 = n1 / 2.0 - 2.0 * n2 / 3.0 + 37.0 * n3 / 96.0, b2 = n2 / 48.0 + n3 / 15.0, b3 = 17.0 * n3 / 480.0;
        double xi = xi1 - (b1 * Math.Sin(2 * xi1) * Math.Cosh(2 * eta1) + b2 * Math.Sin(4 * xi1) * Math.Cosh(4 * eta1) + b3 * Math.Sin(6 * xi1) * Math.Cosh(6 * eta1));
        double eta = eta1 - (b1 * Math.Cos(2 * xi1) * Math.Sinh(2 * eta1) + b2 * Math.Cos(4 * xi1) * Math.Sinh(4 * eta1) + b3 * Math.Cos(6 * xi1) * Math.Sinh(6 * eta1));
        double chi = Math.Asin(Math.Sin(xi) / Math.Cosh(eta));
        double d1 = 2.0 * n1 - 2.0 * n2 / 3.0 - 2.0 * n3, d2 = 7.0 * n2 / 3.0 - 8.0 * n3 / 5.0, d3 = 56.0 * n3 / 15.0;
        double la = chi + d1 * Math.Sin(2 * chi) + d2 * Math.Sin(4 * chi) + d3 * Math.Sin(6 * chi);
        lat = la * 180.0 / Math.PI;
        lng = lon0 + Math.Atan2(Math.Sinh(eta), Math.Cos(xi)) * 180.0 / Math.PI;
    }

    private static SparkPosteGrade Grade(string postesArquivo)
    {
        if (!File.Exists(postesArquivo)) return null;
        SparkPostesIndice ix = SparkPostesArea.Indice(postesArquivo);
        lock (trava)
        {
            if (grade == null || !object.ReferenceEquals(gradeBase, ix)) { grade = new SparkPosteGrade(ix); gradeBase = ix; }
            return grade;
        }
    }

    public static SparkEquipResultado Converter(byte[] dbf, string camada, string postesArquivo, string saida)
    {
        SparkEquipResultado r = new SparkEquipResultado();
        string[] campos = Campos(camada);
        if (campos == null) throw new Exception("Camada de equipamento desconhecida: " + camada);
        if (dbf == null || dbf.Length < 33) throw new Exception("Arquivo .dbf vazio ou inválido.");
        int nRec = BitConverter.ToInt32(dbf, 4);
        int hdrLen = BitConverter.ToUInt16(dbf, 8);
        int recLen = BitConverter.ToUInt16(dbf, 10);
        Dictionary<string,int[]> col = new Dictionary<string,int[]>();
        int off = 1;
        for (int p = 32; p + 32 <= hdrLen && dbf[p] != 0x0D; p += 32)
        {
            string nome = Encoding.ASCII.GetString(dbf, p, 11).Split('\0')[0].Trim().ToUpperInvariant();
            int len = dbf[p + 16];
            col[nome] = new int[] { off, len };
            off += len;
        }
        if (!col.ContainsKey("COD_ID")) throw new Exception("O .dbf não tem a coluna COD_ID.");
        if (!col.ContainsKey("PAC_1") && !col.ContainsKey("PAC_2")) throw new Exception("O .dbf não tem PAC_1/PAC_2 (é preciso para achar o poste).");
        SparkPosteGrade g = Grade(postesArquivo);
        int iTipo = IdxTipo(camada);
        CultureInfo inv = CultureInfo.InvariantCulture;
        string tmp = saida + ".tmp";
        using (StreamWriter w = new StreamWriter(tmp, false, new UTF8Encoding(false)))
        {
            for (int i = 0; i < nRec; i++)
            {
                int rec = hdrLen + i * recLen;
                if (rec + recLen > dbf.Length) break;
                if (dbf[rec] == (byte)'*') { r.Apagados++; continue; }
                string cod = Texto(dbf, rec + col["COD_ID"][0], col["COD_ID"][1]);
                if (cod.Length == 0) { r.SemPosicao++; continue; }
                double e = 0, n = 0; bool ok = false;
                if (col.ContainsKey("PAC_1")) ok = DecodePac(Texto(dbf, rec + col["PAC_1"][0], col["PAC_1"][1]), out e, out n);
                if (!ok && col.ContainsKey("PAC_2")) ok = DecodePac(Texto(dbf, rec + col["PAC_2"][0], col["PAC_2"][1]), out e, out n);
                if (!ok) { r.SemPosicao++; continue; }
                double lat, lng;
                UtmSulParaLatLng(e, n, -51.0, out lat, out lng);
                string poste = "";
                if (g != null)
                {
                    double dist;
                    int pi = g.Mais(lat, lng, 8.0, out dist);
                    if (pi >= 0) { poste = g.Ix.Id[pi]; lat = g.Ix.Lat[pi]; lng = g.Ix.Lng[pi]; }
                }
                if (poste.Length > 0) r.ComPoste++; else r.SemPoste++;
                string ctmt = col.ContainsKey("CTMT") ? Texto(dbf, rec + col["CTMT"][0], col["CTMT"][1]) : "";
                string conj = col.ContainsKey("CONJ") ? Texto(dbf, rec + col["CONJ"][0], col["CONJ"][1]) : "";
                w.Write(cod); w.Write('\t'); w.Write(poste); w.Write('\t');
                w.Write(lat.ToString("0.000000", inv)); w.Write('\t'); w.Write(lng.ToString("0.000000", inv)); w.Write('\t');
                w.Write(ctmt); w.Write('\t'); w.Write(conj);
                string tipo = "";
                for (int c = 0; c < 5; c++)
                {
                    string v = "";
                    if (campos[c].Length > 0 && col.ContainsKey(campos[c])) v = Texto(dbf, rec + col[campos[c]][0], col[campos[c]][1]);
                    w.Write('\t'); w.Write(v);
                    if (c == iTipo) tipo = v;
                }
                w.Write('\n');
                r.Total++;
                int q; r.PorTipo.TryGetValue(tipo, out q); r.PorTipo[tipo] = q + 1;
            }
        }
        if (File.Exists(saida)) File.Delete(saida);
        File.Move(tmp, saida);
        return r;
    }
}

public class SparkEquipIndice
{
    public int N;
    public DateTime Mtime;
    public string[][] Linha;
    public double[] Lat;
    public double[] Lng;
    public Dictionary<string,List<int>> PorPoste = new Dictionary<string,List<int>>();
    public Dictionary<string,int> PorTipo = new Dictionary<string,int>();
    public int ComPoste;
}

public class SparkEquipListaResultado
{
    public int Total;
    public bool Truncado;
    public List<string[]> Linhas = new List<string[]>();
}

public static class SparkEquipConsulta
{
    private static readonly Dictionary<string,SparkEquipIndice> cache = new Dictionary<string,SparkEquipIndice>();
    private static readonly object trava = new object();

    public static SparkEquipIndice Carregar(string arquivo, string camada)
    {
        DateTime mt = File.GetLastWriteTimeUtc(arquivo);
        lock (trava)
        {
            SparkEquipIndice c;
            if (cache.TryGetValue(arquivo, out c) && c.Mtime == mt) return c;
            string[] linhas = File.ReadAllLines(arquivo, new UTF8Encoding(false));
            SparkEquipIndice ix = new SparkEquipIndice();
            ix.Mtime = mt;
            ix.Linha = new string[linhas.Length][];
            ix.Lat = new double[linhas.Length];
            ix.Lng = new double[linhas.Length];
            CultureInfo inv = CultureInfo.InvariantCulture;
            int iTipo = SparkEquip.IdxTipo(camada);
            int k = 0;
            for (int i = 0; i < linhas.Length; i++)
            {
                string[] p = linhas[i].Split('\t');
                if (p.Length < 11) continue;
                double la, lo;
                if (!double.TryParse(p[2], NumberStyles.Float, inv, out la)) continue;
                if (!double.TryParse(p[3], NumberStyles.Float, inv, out lo)) continue;
                ix.Linha[k] = p; ix.Lat[k] = la; ix.Lng[k] = lo;
                if (p[1].Length > 0)
                {
                    ix.ComPoste++;
                    List<int> l;
                    if (!ix.PorPoste.TryGetValue(p[1], out l)) { l = new List<int>(); ix.PorPoste[p[1]] = l; }
                    l.Add(k);
                }
                string tp = p[6 + iTipo];
                int q; ix.PorTipo.TryGetValue(tp, out q); ix.PorTipo[tp] = q + 1;
                k++;
            }
            ix.N = k;
            cache[arquivo] = ix;
            return ix;
        }
    }

    // v2.15.3 - protecao tipo 22 (fusivel) no MESMO poste de um trafo e o fusivel do proprio
    // trafo: ja se sabe que existe, nao precisa aparecer no mapa nem no popup da OS.
    private static SparkEquipIndice TrafosDe(string arquivo, string camada)
    {
        if (camada != "protecoes") return null;
        string f = Path.Combine(Path.GetDirectoryName(arquivo), "equip_trafos.tsv");
        return File.Exists(f) ? Carregar(f, "trafos") : null;
    }
    private static bool FusivelDeTrafo(SparkEquipIndice tr, string[] l, int iTipo)
    {
        return tr != null && l[6 + iTipo] == "22" && l[1].Length > 0 && tr.PorPoste.ContainsKey(l[1]);
    }

    // equipamentos dentro do retangulo; tiposCsv filtra pela coluna "tipo" da camada
    public static SparkEquipListaResultado Area(string arquivo, string camada, double sul, double oeste, double norte, double leste, string tiposCsv, int limite)
    {
        SparkEquipListaResultado r = new SparkEquipListaResultado();
        if (!File.Exists(arquivo)) return r;
        SparkEquipIndice ix = Carregar(arquivo, camada);
        int iTipo = SparkEquip.IdxTipo(camada);
        HashSet<string> tipos = null;
        if (!string.IsNullOrEmpty(tiposCsv))
        {
            tipos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string t in tiposCsv.Split(',')) tipos.Add(t.Trim());
        }
        SparkEquipIndice trf = TrafosDe(arquivo, camada);
        for (int i = 0; i < ix.N; i++)
        {
            double la = ix.Lat[i], lo = ix.Lng[i];
            if (la < sul || la > norte || lo < oeste || lo > leste) continue;
            if (FusivelDeTrafo(trf, ix.Linha[i], iTipo)) continue;
            if (tipos != null && !tipos.Contains(ix.Linha[i][6 + iTipo])) continue;
            r.Total++;
            if (r.Linhas.Count < limite) r.Linhas.Add(ix.Linha[i]); else r.Truncado = true;
        }
        return r;
    }

    public static List<string[]> PorPoste(string arquivo, string camada, string poste)
    {
        List<string[]> r = new List<string[]>();
        if (!File.Exists(arquivo) || string.IsNullOrEmpty(poste)) return r;
        SparkEquipIndice ix = Carregar(arquivo, camada);
        List<int> l;
        SparkEquipIndice trf = TrafosDe(arquivo, camada);
        int iTipo = SparkEquip.IdxTipo(camada);
        if (ix.PorPoste.TryGetValue(poste, out l)) foreach (int i in l) { if (FusivelDeTrafo(trf, ix.Linha[i], iTipo)) continue; r.Add(ix.Linha[i]); }
        return r;
    }

    public static SparkEquipListaResultado Listar(string arquivo, string camada, string busca, string tipo, int pular, int tamanho)
    {
        SparkEquipListaResultado r = new SparkEquipListaResultado();
        if (!File.Exists(arquivo)) return r;
        SparkEquipIndice ix = Carregar(arquivo, camada);
        int iTipo = SparkEquip.IdxTipo(camada);
        bool temBusca = !string.IsNullOrEmpty(busca), temTipo = !string.IsNullOrEmpty(tipo);
        for (int i = 0; i < ix.N; i++)
        {
            string[] p = ix.Linha[i];
            if (temTipo && !string.Equals(p[6 + iTipo], tipo, StringComparison.OrdinalIgnoreCase)) continue;
            if (temBusca && p[0].IndexOf(busca, StringComparison.OrdinalIgnoreCase) < 0
                && p[1].IndexOf(busca, StringComparison.OrdinalIgnoreCase) < 0
                && !string.Equals(p[4], busca, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(p[5], busca, StringComparison.OrdinalIgnoreCase)) continue;
            if (r.Total >= pular && r.Linhas.Count < tamanho) r.Linhas.Add(p);
            r.Total++;
        }
        return r;
    }

    public static int ComPoste(string arquivo, string camada)
    {
        if (!File.Exists(arquivo)) return 0;
        return Carregar(arquivo, camada).ComPoste;
    }

    public static Dictionary<string,int> PorTipo(string arquivo, string camada)
    {
        if (!File.Exists(arquivo)) return new Dictionary<string,int>();
        return Carregar(arquivo, camada).PorTipo;
    }
}
'@

# junta o C# dos equipamentos ao dos postes (um unico Add-Type, tipos se enxergam)
if ($Script:SparkPostesFonte -and ($Script:SparkPostesFonte -notmatch 'SparkEquipConsulta')) {
    $Script:SparkPostesFonte = $Script:SparkPostesFonte + "`r`n" + $Script:SparkEquipFonte
}

$Script:EquipCamadas = [ordered]@{
    trafos      = @{ rotulo = "Trafos";      arquivoDbf = "UNTRMT"; plural = "trafos (UNTRMT)" }
    protecoes   = @{ rotulo = "Proteções";   arquivoDbf = "UNSEMT"; plural = "proteções (UNSEMT)" }
    reguladores = @{ rotulo = "Reguladores"; arquivoDbf = "UNREMT"; plural = "reguladores (UNREMT)" }
    capacitores = @{ rotulo = "Capacitores"; arquivoDbf = "UNCRMT"; plural = "capacitores (UNCRMT)" }
}

function Get-EquipArquivo { param([string]$Camada) return (Join-Path $Script:ModelRoot ("equip_" + $Camada + ".tsv")) }

# v2.15.24 - Numero Operativo (nome que o campo conhece), vindo do Smallworld: model/equip_nomes_trafos.tsv
function Get-EquipNomesArquivo { param([string]$Camada) return (Join-Path $Script:ModelRoot ("equip_nomes_" + $Camada + ".tsv")) }

function Test-EquipNomes {
    param([string]$Camada)
    if ($Camada -ne 'trafos' -and $Camada -ne 'protecoes') { return $false }
    if (-not (Test-Path (Get-EquipNomesArquivo -Camada $Camada))) { return $false }
    return (Initialize-SparkXlsx)
}

function Test-EquipCamada { param([string]$Camada) return ($Script:EquipCamadas.Contains($Camada)) }

function Get-EquipCamadaPorNomeArquivo {
    param([string]$Nome)
    $n = $Nome.ToUpper()
    foreach ($k in $Script:EquipCamadas.Keys) { if ($n.Contains($Script:EquipCamadas[$k].arquivoDbf)) { return $k } }
    return $null
}

function Import-EquipUpload {
    <# Aceita .dbf soltos (UNTRMT/UNSEMT/UNREMT/UNCRMT) ou um .zip com eles. Precisa do PONNOT ja importado. #>
    param([Parameter(Mandatory)][array]$Arquivos, [scriptblock]$ProgressCallback)

    if (-not (Initialize-SparkPostes)) { throw "Nao consegui carregar o leitor de equipamentos (compilador C# indisponivel)." }

    # v2.15.24 - .xlsx do Smallworld (Id, Name) = nomes operativos; somam ao que ja existe
    $nomesRes = New-Object System.Collections.ArrayList
    $nomesIgn = New-Object System.Collections.ArrayList
    $xl = @($Arquivos | Where-Object { "$($_.FileName)".ToLower().EndsWith(".xlsx") })
    $n_x = 0
    foreach ($a in $xl) {
        $n_x++
        $nm = "$($a.FileName)".ToLower()
        $camNome = $null
        if ($nm -match 'transformer|trafo|xfrmr') { $camNome = 'trafos' }
        elseif ($nm -match 'isolat') { $camNome = 'protecoes' }   # chaves (faca, fusivel, religador...): Id = COD_ID da UNSEMT
        if (-not $camNome) { [void]$nomesIgn.Add($a.FileName); continue }
        $r = Import-NomesEquipXlsx -Bytes $a.Bytes -Arquivo $a.FileName -Destino (Get-EquipNomesArquivo -Camada $camNome) -ProgressCallback $ProgressCallback
        $r['camada'] = $camNome
        [void]$nomesRes.Add($r)
    }
    $soNomes = ($xl.Count -gt 0) -and (@($Arquivos | Where-Object { $e = "$($_.FileName)".ToLower(); $e.EndsWith(".dbf") -or $e.EndsWith(".zip") }).Count -eq 0)
    if ($soNomes) {
        if ($nomesRes.Count -eq 0) { throw "Nao reconheci o Excel. O nome precisa conter 'Transformer' (trafos) ou 'Isolating' (chaves/protecoes)." }
        return @{ camadas = @(); ignorados = @(); nomes = $nomesRes.ToArray(); nomesIgnorados = $nomesIgn.ToArray() }
    }
    if (-not (Test-Path (Get-PostesArquivo))) { throw "Importe primeiro a base de Postes (PONNOT) - e' ela que liga cada equipamento ao poste." }

    $dbfs = New-Object System.Collections.ArrayList
    foreach ($a in $Arquivos) {
        $n = "$($a.FileName)".ToLower()
        if ($n.EndsWith(".zip")) {
            if ($ProgressCallback) { & $ProgressCallback @{ fase = "descompactando"; percentual = 5 } }
            $ms = New-Object System.IO.MemoryStream(,$a.Bytes)
            $zip = [System.IO.Compression.ZipArchive]::new($ms, [System.IO.Compression.ZipArchiveMode]::Read)
            try {
                foreach ($entry in $zip.Entries) {
                    if ($entry.Name.ToLower().EndsWith(".dbf")) {
                        $s = $entry.Open(); $buf = New-Object System.IO.MemoryStream; $s.CopyTo($buf); $s.Close()
                        [void]$dbfs.Add(@{ nome = $entry.Name; bytes = $buf.ToArray() })
                    }
                }
            } finally { $zip.Dispose(); $ms.Dispose() }
        } elseif ($n.EndsWith(".dbf")) {
            [void]$dbfs.Add(@{ nome = $a.FileName; bytes = $a.Bytes })
        }
    }
    if ($dbfs.Count -eq 0) { throw "Nao encontrei nenhum .dbf (UNTRMT, UNSEMT, UNREMT ou UNCRMT) no que foi enviado." }

    $resultados = New-Object System.Collections.ArrayList
    $ignorados = New-Object System.Collections.ArrayList
    $feitos = 0
    foreach ($d in $dbfs) {
        $camada = Get-EquipCamadaPorNomeArquivo -Nome $d.nome
        if (-not $camada) { [void]$ignorados.Add($d.nome); continue }
        $feitos++
        if ($ProgressCallback) { & $ProgressCallback @{ fase = "gravando"; arquivo = ("lendo " + $d.nome + " e achando o poste de cada equipamento"); percentual = [math]::Min(90, 15 + 20 * $feitos) } }
        $r = [SparkEquip]::Converter($d.bytes, $camada, (Get-PostesArquivo), (Get-EquipArquivo -Camada $camada))
        $porTipo = [ordered]@{}
        foreach ($k in ($r.PorTipo.Keys | Sort-Object)) { $porTipo[$(if ($k) { $k } else { '(vazio)' })] = $r.PorTipo[$k] }
        [void]$resultados.Add(@{
            camada = $camada; arquivo = $d.nome; total = [int]$r.Total; comPoste = [int]$r.ComPoste; semPoste = [int]$r.SemPoste
            semPosicao = [int]$r.SemPosicao; apagados = [int]$r.Apagados; porTipo = $porTipo
        })
    }
    if ($resultados.Count -eq 0) { throw "Nenhum dos arquivos e' de equipamento conhecido. Os nomes precisam conter UNTRMT, UNSEMT, UNREMT ou UNCRMT." }
    return @{ camadas = $resultados.ToArray(); ignorados = $ignorados.ToArray(); nomes = $nomesRes.ToArray(); nomesIgnorados = $nomesIgn.ToArray() }
}

function Get-ProtecaoCadastro {
    <# v2.15.25 - cadastro de Protecao (d.Protecao) por nome do elemento: disjuntor (PROT. ELEMENTO 2), trecho, alimentador. #>
    param([string]$Nome)
    if (-not $Nome -or -not (Get-Command Get-ProtecaoParaBusca -ErrorAction SilentlyContinue)) { return $null }
    $lista = Get-ProtecaoParaBusca
    if (-not $Script:ProtecaoPorNome -or -not [object]::ReferenceEquals($Script:ProtecaoPorNomeRef, $lista)) {
        $h = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::OrdinalIgnoreCase)
        foreach ($x in $lista) { if ($x.id -and -not $h.ContainsKey([string]$x.id)) { $h[[string]$x.id] = $x } }
        $Script:ProtecaoPorNome = $h
        $Script:ProtecaoPorNomeRef = $lista
    }
    $r = $null
    if ($Script:ProtecaoPorNome.TryGetValue($Nome, [ref]$r)) { return $r }
    return $null
}

function Get-EquipCadastro {
    <# Disjuntor / trecho / alimentador do cadastro de Protecao para UM nome (chamado ao abrir o popup). #>
    param([string]$Nome)
    $c = Get-ProtecaoCadastro -Nome $Nome
    if (-not $c) { return @{ achou = $false } }
    return @{ achou = $true; disjuntor = [string]$c.p2; trecho = [string]$c.trecho; alimentador = [string]$c.alim }
}

function Get-EquipConferencia {
    <# v2.15.25 - protecoes cujo LAT/LONG do cadastro esta longe da posicao do equipamento na BDGD. #>
    param([double]$Metros = 200, [int]$Limite = 500)
    $camada = 'protecoes'
    $arq = Get-EquipArquivo -Camada $camada
    $arqN = Get-EquipNomesArquivo -Camada $camada
    if (-not (Test-Path $arq)) { throw "Importe primeiro as protecoes da BDGD (UNSEMT)." }
    if (-not (Test-Path $arqN)) { throw "Importe primeiro o Excel Isolating Equipment (nomes operativos das protecoes)." }
    if (-not (Initialize-SparkXlsx)) { throw "Compilador C# indisponivel." }
    if (-not (Get-Command Get-ProtecaoParaBusca -ErrorAction SilentlyContinue)) { throw "Base de Protecao indisponivel." }
    $lista = @(Get-ProtecaoParaBusca)
    if ($lista.Count -eq 0) { throw "Importe primeiro a base de Protecao (d.Protecao.xlsx)." }
    $n = $lista.Count
    $el = New-Object 'string[]' $n; $la = New-Object 'double[]' $n; $lo = New-Object 'double[]' $n
    for ($i = 0; $i -lt $n; $i++) {
        $x = $lista[$i]
        $el[$i] = [string]$x.id
        if ($null -ne $x.lat -and $null -ne $x.lng) { $la[$i] = [double]$x.lat; $lo[$i] = [double]$x.lng } else { $la[$i] = [double]::NaN; $lo[$i] = [double]::NaN }
    }
    $r = [SparkConferencia]::Conferir($arq, $arqN, $el, $la, $lo, $Metros, $Limite)
    $linhas = New-Object System.Collections.ArrayList
    foreach ($l in $r.Linhas) { [void]$linhas.Add(@($l[0], $l[1], [double]$l[2], [double]$l[3], [double]$l[4], [double]$l[5], [double]$l[6], $l[7])) }
    return @{ metros = $Metros; comparados = [int]$r.Comparados; ok = [int]$r.Ok; acima = [int]$r.Acima; semCadastro = [int]$r.SemCadastro; itens = $linhas.ToArray() }
}

function Get-EquipArea {
    param([string]$Camada, [double]$Sul, [double]$Oeste, [double]$Norte, [double]$Leste, [string]$Tipos = "", [int]$Limite = 4000)
    $vazio = @{ total = 0; truncado = $false; itens = @() }
    if (-not (Test-EquipCamada $Camada)) { return $vazio }
    $arq = Get-EquipArquivo -Camada $Camada
    if (-not (Test-Path $arq)) { return $vazio }
    if (-not (Initialize-SparkPostes)) { return $vazio }
    $r = [SparkEquipConsulta]::Area($arq, $Camada, $Sul, $Oeste, $Norte, $Leste, $Tipos, $Limite)
    $temNomes = Test-EquipNomes $Camada; $nomeArq = Get-EquipNomesArquivo -Camada $Camada
    $itens = New-Object System.Collections.ArrayList
    foreach ($p in $r.Linhas) {
        [void]$itens.Add(@($p[0], $p[1], [double]$p[2], [double]$p[3], $p[4], $p[5], $p[6], $p[7], $p[8], $p[9], $p[10], $(if ($temNomes) { [string][SparkNomes]::Nome($nomeArq, [string]$p[0]) } else { '' })))
    }
    return @{ total = [int]$r.Total; truncado = [bool]$r.Truncado; itens = $itens.ToArray() }
}

function Get-EquipPoste {
    <# Tudo que esta pendurado num poste: @{ trafos = @(...); protecoes = @(...); ... } #>
    param([string]$Poste)
    $res = [ordered]@{}
    if (-not $Poste -or -not (Initialize-SparkPostes)) { return $res }
    foreach ($camada in $Script:EquipCamadas.Keys) {
        $arq = Get-EquipArquivo -Camada $camada
        if (-not (Test-Path $arq)) { continue }
        $l = [SparkEquipConsulta]::PorPoste($arq, $camada, $Poste)
        if ($l.Count -eq 0) { continue }
        $temNomes = Test-EquipNomes $camada; $nomeArq = Get-EquipNomesArquivo -Camada $camada
        $itens = New-Object System.Collections.ArrayList
        foreach ($p in $l) { [void]$itens.Add(@($p[0], $p[1], [double]$p[2], [double]$p[3], $p[4], $p[5], $p[6], $p[7], $p[8], $p[9], $p[10], $(if ($temNomes) { [string][SparkNomes]::Nome($nomeArq, [string]$p[0]) } else { '' }))) }
        $res[$camada] = $itens.ToArray()
    }
    return $res
}

function Get-EquipLista {
    param([string]$Camada, [string]$Busca = "", [string]$Tipo = "", [int]$Pagina = 1, [int]$Tamanho = 50)
    $vazio = @{ total = 0; pagina = $Pagina; tamanhoPagina = $Tamanho; itens = @() }
    if (-not (Test-EquipCamada $Camada)) { return $vazio }
    $arq = Get-EquipArquivo -Camada $Camada
    if (-not (Test-Path $arq)) { return $vazio }
    if (-not (Initialize-SparkPostes)) { return $vazio }
    $pular = ([math]::Max(1, $Pagina) - 1) * $Tamanho
    $temNomes = Test-EquipNomes $Camada; $nomeArq = Get-EquipNomesArquivo -Camada $Camada
    $itens = New-Object System.Collections.ArrayList
    # v2.15.24 - busca pelo nome operativo (ex.: "TR-1301"): acha os Ids e traz cada trafo pela BDGD
    if ($temNomes -and $Busca -and $Busca.Trim().Length -ge 2) {
        $ids = [string[]][SparkNomes]::Buscar($nomeArq, $Busca, 200)
        if ($ids.Count -gt 0) {
            $achados = New-Object System.Collections.ArrayList
            foreach ($id in $ids) {
                $rr = [SparkEquipConsulta]::Listar($arq, $Camada, $id, $Tipo, 0, 5)
                foreach ($p in $rr.Linhas) { if ([string]$p[0] -eq $id) { [void]$achados.Add($p); break } }
            }
            if ($achados.Count -gt 0) {
                $fatia = @($achados.ToArray() | Select-Object -Skip $pular -First $Tamanho)
                foreach ($p in $fatia) { [void]$itens.Add(@($p[0], $p[1], [double]$p[2], [double]$p[3], $p[4], $p[5], $p[6], $p[7], $p[8], $p[9], $p[10], $(if ($temNomes) { [string][SparkNomes]::Nome($nomeArq, [string]$p[0]) } else { '' }))) }
                return @{ total = [int]$achados.Count; pagina = $Pagina; tamanhoPagina = $Tamanho; itens = $itens.ToArray() }
            }
        }
    }
    $r = [SparkEquipConsulta]::Listar($arq, $Camada, $Busca, $Tipo, $pular, $Tamanho)
    foreach ($p in $r.Linhas) { [void]$itens.Add(@($p[0], $p[1], [double]$p[2], [double]$p[3], $p[4], $p[5], $p[6], $p[7], $p[8], $p[9], $p[10], $(if ($temNomes) { [string][SparkNomes]::Nome($nomeArq, [string]$p[0]) } else { '' }))) }
    return @{ total = [int]$r.Total; pagina = $Pagina; tamanhoPagina = $Tamanho; itens = $itens.ToArray() }
}

function Get-EquipResumo {
    $meta = @(Read-JsonModel -Entity "equip_meta")
    $out = [ordered]@{}
    foreach ($camada in $Script:EquipCamadas.Keys) {
        $arq = Get-EquipArquivo -Camada $camada
        if (-not (Test-Path $arq)) { continue }
        $m = $meta | Where-Object { $_.camada -eq $camada } | Select-Object -First 1
        $out[$camada] = @{
            rotulo = $Script:EquipCamadas[$camada].rotulo
            total = $(if ($m) { $m.total } else { 0 }); comPoste = $(if ($m) { $m.comPoste } else { 0 })
            semPoste = $(if ($m) { $m.semPoste } else { 0 }); semPosicao = $(if ($m) { $m.semPosicao } else { 0 })
            porTipo = $(if ($m) { $m.porTipo } else { @{} })
            atualizadoEm = $(if ($m) { $m.atualizadoEm } else { $null }); atualizadoPor = $(if ($m) { $m.atualizadoPor } else { $null })
        }
    }
    return $out
}

function Remove-EquipBase {
    param([string]$Camada)
    $arq = Get-EquipArquivo -Camada $Camada
    if (Test-Path $arq) { Remove-Item -LiteralPath $arq -Force }
    $meta = @(@(Read-JsonModel -Entity "equip_meta") | Where-Object { $_.camada -ne $Camada })
    Write-JsonModel -Entity "equip_meta" -Data $meta
}

function Initialize-EquipPrewarm {
    <# Le os TSV de equipamentos para a memoria antes do primeiro pedido. Devolve quantas camadas existem. #>
    $n = 0
    if (-not (Initialize-SparkPostes)) { return 0 }
    foreach ($camada in $Script:EquipCamadas.Keys) {
        $arq = Get-EquipArquivo -Camada $camada
        if (Test-Path $arq) { [void][SparkEquipConsulta]::ComPoste($arq, $camada); $n++ }
    }
    return $n
}
