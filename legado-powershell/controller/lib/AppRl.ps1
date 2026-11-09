# =============================================================================
# lib/AppRl.ps1 - OS dentro / perto de APP e Reserva Legal (v3.12.0)
#
# Para cada OS com posicao confiavel (nao "aproximada"), mede a DISTANCIA EM METROS ate a
# divisa mais proxima do poligono de APP e do de RL (negativa = DENTRO; positiva = fora).
# So guarda no indice as OS que estao DENTRO de algum poligono ou a ate MaxM (100 m) de um.
# A tolerancia (ex.: 15 m) NAO entra no calculo: ela e so uma regua aplicada pelo navegador em
# cima dessa distancia (dentro = mais fundo que a tolerancia; borda = a menos que a tolerancia
# da divisa; fora = alem). Por isso mudar a tolerancia na Configuracao e instantaneo.
#
# Os poligonos vem de geo/app/*.geojson e geo/reserva_legal/*.geojson (um por alimentador,
# gravados pelo KmzImporter). A conta e feita em C# (Add-Type, como Postes.ps1): em PowerShell
# puro, ~110 mil OS levariam minutos. Sem o C# o calculo e pulado (aviso), nada mais quebra.
# Arquivos: model/app_rl_indice.json (resultado), model/app_rl_config.json (tolerancia).
# Recalcula sozinho: ao fim de toda importacao de podas e ao subir KMZ de APP/RL.
# =============================================================================

$Script:SparkAppRlFonte = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

public class SparkAppRlPol {
    public double[] Lat;
    public double[] Lng;
    public double MinLat, MaxLat, MinLng, MaxLng;
}

public class SparkAppRlArquivo {
    public long Ticks;
    public List<SparkAppRlPol> Pols = new List<SparkAppRlPol>();
}

public static class SparkAppRl {
    public const double Cel = 0.003;   // lado da celula da grade, em graus (~330 m)
    public static double MaxM = 100.0; // so guarda quem esta dentro ou a ate MaxM metros de um poligono

    static Dictionary<string, SparkAppRlArquivo>[] arqs = new Dictionary<string, SparkAppRlArquivo>[] {
        new Dictionary<string, SparkAppRlArquivo>(StringComparer.OrdinalIgnoreCase),
        new Dictionary<string, SparkAppRlArquivo>(StringComparer.OrdinalIgnoreCase) };
    static Dictionary<long, List<SparkAppRlPol>>[] grade = new Dictionary<long, List<SparkAppRlPol>>[] {
        new Dictionary<long, List<SparkAppRlPol>>(), new Dictionary<long, List<SparkAppRlPol>>() };

    static int Cx(double lng) { return (int)Math.Floor(lng / Cel); }
    static int Cy(double lat) { return (int)Math.Floor(lat / Cel); }
    static long Chave(int ix, int iy) { return ((long)ix << 32) ^ (long)(uint)iy; }

    static double LerNumero(string s, ref int p) {
        int ini = p;
        while (p < s.Length) {
            char c = s[p];
            if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') p++; else break;
        }
        if (p == ini) return double.NaN;
        return double.Parse(s.Substring(ini, p - ini), NumberStyles.Float, CultureInfo.InvariantCulture);
    }

    // le o anel externo de cada "Polygon" do GeoJSON gravado pelo KmzImporter ([lng,lat],...)
    static void LerArquivo(string caminho, List<SparkAppRlPol> saida) {
        string txt = File.ReadAllText(caminho, System.Text.Encoding.UTF8);
        string chave = "\"coordinates\":[[";
        List<double> lats = new List<double>();
        List<double> lngs = new List<double>();
        int idx = 0;
        while (true) {
            idx = txt.IndexOf(chave, idx, StringComparison.Ordinal);
            if (idx < 0) break;
            int p = idx + chave.Length;
            lats.Clear(); lngs.Clear();
            while (p < txt.Length && txt[p] == '[') {
                p++;
                double x = LerNumero(txt, ref p);
                if (p < txt.Length && txt[p] == ',') p++;
                double y = LerNumero(txt, ref p);
                while (p < txt.Length && txt[p] != ']') p++;   // pula um eventual 3o valor (altitude)
                if (p < txt.Length) p++;                        // fecha o ponto
                if (!double.IsNaN(x) && !double.IsNaN(y)) { lngs.Add(x); lats.Add(y); }
                if (p < txt.Length && txt[p] == ',') p++; else break;
            }
            if (lats.Count >= 3) {
                SparkAppRlPol pol = new SparkAppRlPol();
                pol.Lat = lats.ToArray();
                pol.Lng = lngs.ToArray();
                pol.MinLat = double.MaxValue; pol.MaxLat = double.MinValue;
                pol.MinLng = double.MaxValue; pol.MaxLng = double.MinValue;
                for (int i = 0; i < pol.Lat.Length; i++) {
                    if (pol.Lat[i] < pol.MinLat) pol.MinLat = pol.Lat[i];
                    if (pol.Lat[i] > pol.MaxLat) pol.MaxLat = pol.Lat[i];
                    if (pol.Lng[i] < pol.MinLng) pol.MinLng = pol.Lng[i];
                    if (pol.Lng[i] > pol.MaxLng) pol.MaxLng = pol.Lng[i];
                }
                saida.Add(pol);
            }
            idx = p;
        }
    }

    // camada: 0 = APP, 1 = Reserva Legal. So le de novo o arquivo que mudou desde a ultima vez.
    public static int CarregarPasta(int camada, string pasta) {
        Dictionary<string, SparkAppRlArquivo> d = arqs[camada];
        HashSet<string> existentes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (Directory.Exists(pasta)) {
            foreach (string f in Directory.GetFiles(pasta, "*.geojson")) {
                string nome = Path.GetFileNameWithoutExtension(f);
                if (nome.StartsWith("_")) continue;
                existentes.Add(nome);
                long ticks = File.GetLastWriteTimeUtc(f).Ticks;
                SparkAppRlArquivo a;
                if (d.TryGetValue(nome, out a) && a.Ticks == ticks) continue;
                a = new SparkAppRlArquivo();
                a.Ticks = ticks;
                try { LerArquivo(f, a.Pols); } catch (Exception) { a.Pols.Clear(); }
                d[nome] = a;
            }
        }
        List<string> sobrou = new List<string>();
        foreach (string k in d.Keys) { if (!existentes.Contains(k)) sobrou.Add(k); }
        foreach (string k in sobrou) { d.Remove(k); }
        int total = 0;
        foreach (SparkAppRlArquivo a2 in d.Values) { total += a2.Pols.Count; }
        return total;
    }

    // alimentadores que tem pelo menos 1 poligono na camada
    public static string[] Alimentadores(int camada) {
        List<string> r = new List<string>();
        foreach (KeyValuePair<string, SparkAppRlArquivo> kv in arqs[camada]) {
            if (kv.Value.Pols.Count > 0) r.Add(kv.Key);
        }
        r.Sort(StringComparer.OrdinalIgnoreCase);
        return r.ToArray();
    }

    public static void Construir() {
        double margem = MaxM / 100000.0 + 0.0005;
        for (int c = 0; c < 2; c++) {
            Dictionary<long, List<SparkAppRlPol>> g = new Dictionary<long, List<SparkAppRlPol>>();
            foreach (SparkAppRlArquivo a in arqs[c].Values) {
                foreach (SparkAppRlPol pol in a.Pols) {
                    int x0 = Cx(pol.MinLng - margem), x1 = Cx(pol.MaxLng + margem);
                    int y0 = Cy(pol.MinLat - margem), y1 = Cy(pol.MaxLat + margem);
                    for (int ix = x0; ix <= x1; ix++) {
                        for (int iy = y0; iy <= y1; iy++) {
                            long k = Chave(ix, iy);
                            List<SparkAppRlPol> l;
                            if (!g.TryGetValue(k, out l)) { l = new List<SparkAppRlPol>(); g[k] = l; }
                            l.Add(pol);
                        }
                    }
                }
            }
            grade[c] = g;
        }
    }

    // NaN = longe de tudo (alem de MaxM) | negativo = DENTRO (profundidade ate a divisa, em m) | positivo = fora, a tantos m
    public static double Medir(int camada, double lat, double lng) {
        List<SparkAppRlPol> cand;
        if (!grade[camada].TryGetValue(Chave(Cx(lng), Cy(lat)), out cand)) return double.NaN;
        double mx = 111320.0 * Math.Cos(lat * Math.PI / 180.0);
        double my = 110540.0;
        double dLat = MaxM / my, dLng = MaxM / mx;
        double melhorDentro = -1.0;
        double melhorFora = double.MaxValue;
        for (int n = 0; n < cand.Count; n++) {
            SparkAppRlPol p = cand[n];
            if (lat < p.MinLat - dLat || lat > p.MaxLat + dLat || lng < p.MinLng - dLng || lng > p.MaxLng + dLng) continue;
            int k = p.Lat.Length;
            bool dentro = false;
            double dmin2 = double.MaxValue;
            for (int i = 0, j = k - 1; i < k; j = i++) {
                double xi = (p.Lng[i] - lng) * mx, yi = (p.Lat[i] - lat) * my;
                double xj = (p.Lng[j] - lng) * mx, yj = (p.Lat[j] - lat) * my;
                if ((yi > 0) != (yj > 0)) {
                    double xc = xi + (0 - yi) * (xj - xi) / (yj - yi);
                    if (xc > 0) dentro = !dentro;
                }
                double dx = xj - xi, dy = yj - yi;
                double l2 = dx * dx + dy * dy;
                double t = 0.0;
                if (l2 > 0) {
                    t = -(xi * dx + yi * dy) / l2;
                    if (t < 0) t = 0; else if (t > 1) t = 1;
                }
                double px = xi + t * dx, py = yi + t * dy;
                double d2 = px * px + py * py;
                if (d2 < dmin2) dmin2 = d2;
            }
            double dist = Math.Sqrt(dmin2);
            if (dentro) { if (dist > melhorDentro) melhorDentro = dist; }
            else if (dist < melhorFora) melhorFora = dist;
        }
        if (melhorDentro >= 0) return -melhorDentro;
        if (melhorFora <= MaxM) return melhorFora;
        return double.NaN;
    }

    public static void ConsultarLote(double[] lat, double[] lng, double[] saidaApp, double[] saidaRl) {
        for (int i = 0; i < lat.Length; i++) {
            saidaApp[i] = Medir(0, lat[i], lng[i]);
            saidaRl[i] = Medir(1, lat[i], lng[i]);
        }
    }
}
'@

function Initialize-SparkAppRl {
    if ($Script:SparkAppRlPronto -eq $true) { return $true }
    if ($Script:SparkAppRlPronto -eq $false) { return $false }
    try {
        if (-not ('SparkAppRl' -as [type])) {
            Add-Type -TypeDefinition $Script:SparkAppRlFonte -Language CSharp -ReferencedAssemblies @('System.dll') -ErrorAction Stop
        }
        $Script:SparkAppRlPronto = $true
    } catch {
        Write-Host ("  [aviso] calculo de APP/RL indisponivel (" + $_.Exception.Message + ")") -ForegroundColor Yellow
        $Script:SparkAppRlPronto = $false
    }
    return $Script:SparkAppRlPronto
}

$Script:AppRlMaxM = 100
$Script:AppRlTolPadrao = 15
$Script:AppRlBytesCache = $null
$Script:AppRlBytesStamp = 0

function Get-AppRlIndicePath { return (Join-Path $Script:ModelRoot "app_rl_indice.json") }

function Get-AppRlConfig {
    $reg = @(Read-JsonModel -Entity "app_rl_config") | Select-Object -First 1
    $tol = $Script:AppRlTolPadrao
    if ($reg -and $null -ne $reg.toleranciaM) { $tol = [double]$reg.toleranciaM }
    return [ordered]@{
        toleranciaM = $tol; toleranciaMax = $Script:AppRlMaxM
        atualizadoEm = $(if ($reg) { $reg.atualizadoEm } else { $null })
        atualizadoPor = $(if ($reg) { $reg.atualizadoPor } else { $null })
    }
}

function Update-AppRlIndice {
    <# Recalcula o indice de OS x APP/RL. -Lista = OS ja em memoria (importacao de podas); sem ela
       le model/manutencao_os.json (upload de KMZ). Devolve @{ ok; aviso; avaliadas; noIndice; ... }.
       Nunca lanca: quem chama (importacao) nao pode quebrar por causa disto. #>
    param($Lista = $null, [scriptblock]$ProgressCallback = $null)
    try {
        if (-not (Initialize-SparkAppRl)) { return @{ ok = $false; aviso = "Calculo de APP/RL indisponivel neste servidor (C# nao carregou)." } }
        $sinal = { param($txt) if ($ProgressCallback) { try { & $ProgressCallback @{ fase = 'gravando'; arquivo = $txt; percentual = 99 } } catch { } } }
        $cron = [System.Diagnostics.Stopwatch]::StartNew()
        $geoRoot = Join-Path (Split-Path $Script:ModelRoot -Parent) "geo"
        & $sinal 'lendo as camadas de APP e RL'
        [SparkAppRl]::MaxM = [double]$Script:AppRlMaxM
        $nApp = [SparkAppRl]::CarregarPasta(0, (Join-Path $geoRoot "app"))
        $nRl = [SparkAppRl]::CarregarPasta(1, (Join-Path $geoRoot "reserva_legal"))
        [SparkAppRl]::Construir()
        $altApp = [SparkAppRl]::Alimentadores(0)
        $altRl = [SparkAppRl]::Alimentadores(1)
        Write-Host ("  [app/rl] camadas lidas: {0} poligonos de APP, {1} de RL ({2:N1}s)" -f $nApp, $nRl, $cron.Elapsed.TotalSeconds) -ForegroundColor DarkCyan

        if ($null -eq $Lista) { & $sinal 'lendo as OS'; $Lista = @(Read-JsonModel -Entity "manutencao_os") }
        $ids = New-Object 'System.Collections.Generic.List[string]'
        $lats = New-Object 'System.Collections.Generic.List[double]'
        $lngs = New-Object 'System.Collections.Generic.List[double]'
        $semPosicao = 0
        foreach ($o in $Lista) {
            $loc = $o.localizacao
            if ($null -eq $loc -or $null -eq $loc.lat -or $null -eq $loc.lng) { $semPosicao++; continue }
            if ($loc.aproximada) { $semPosicao++; continue }
            $ids.Add(([string]$o.id).Trim()); $lats.Add([double]$loc.lat); $lngs.Add([double]$loc.lng)
        }
        $latArr = $lats.ToArray(); $lngArr = $lngs.ToArray()
        $sApp = New-Object 'double[]' $latArr.Length
        $sRl = New-Object 'double[]' $latArr.Length
        & $sinal 'medindo a distancia das OS ate APP e RL'
        [SparkAppRl]::ConsultarLote($latArr, $lngArr, $sApp, $sRl)
        Write-Host ("  [app/rl] {0} OS medidas ({1:N1}s)" -f $latArr.Length, $cron.Elapsed.TotalSeconds) -ForegroundColor DarkCyan

        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append('{"geradoEm":"').Append((Get-IsoNow)).Append('","maxM":').Append($Script:AppRlMaxM)
        [void]$sb.Append(',"avaliadas":').Append($latArr.Length).Append(',"semPosicao":').Append($semPosicao)
        [void]$sb.Append(',"alimentadoresApp":[')
        $primeiro = $true
        foreach ($a in $altApp) { if (-not $primeiro) { [void]$sb.Append(',') }; $primeiro = $false; [void]$sb.Append('"').Append((ConvertTo-JsonTextoEscapado $a)).Append('"') }
        [void]$sb.Append('],"alimentadoresRl":[')
        $primeiro = $true
        foreach ($a in $altRl) { if (-not $primeiro) { [void]$sb.Append(',') }; $primeiro = $false; [void]$sb.Append('"').Append((ConvertTo-JsonTextoEscapado $a)).Append('"') }
        [void]$sb.Append('],"os":{')
        $noIndice = 0; $primeiro = $true
        for ($i = 0; $i -lt $latArr.Length; $i++) {
            $da = $sApp[$i]; $dr = $sRl[$i]
            $temA = -not [double]::IsNaN($da); $temR = -not [double]::IsNaN($dr)
            if (-not ($temA -or $temR)) { continue }
            if (-not $primeiro) { [void]$sb.Append(',') }
            $primeiro = $false; $noIndice++
            [void]$sb.Append('"').Append((ConvertTo-JsonTextoEscapado $ids[$i])).Append('":[')
            if ($temA) { [void]$sb.Append([Math]::Round($da, 1).ToString("0.0", $inv)) } else { [void]$sb.Append('null') }
            [void]$sb.Append(',')
            if ($temR) { [void]$sb.Append([Math]::Round($dr, 1).ToString("0.0", $inv)) } else { [void]$sb.Append('null') }
            [void]$sb.Append(']')
        }
        [void]$sb.Append('}}')

        $path = Get-AppRlIndicePath
        $tmp = "$path.tmp"
        [System.IO.File]::WriteAllText($tmp, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -Path $tmp -Destination $path -Force
        $Script:AppRlBytesCache = $null
        Write-Host ("  [app/rl] indice gravado: {0} OS dentro ou a ate {1} m de APP/RL ({2:N1}s)" -f $noIndice, $Script:AppRlMaxM, $cron.Elapsed.TotalSeconds) -ForegroundColor DarkCyan
        return @{ ok = $true; aviso = $null; avaliadas = $latArr.Length; semPosicao = $semPosicao; noIndice = $noIndice; poligonosApp = $nApp; poligonosRl = $nRl }
    } catch {
        Write-Warning "Nao foi possivel calcular APP/RL: $($_.Exception.Message)"
        return @{ ok = $false; aviso = "Nao foi possivel calcular APP/RL: $($_.Exception.Message)" }
    }
}

function Get-AppRlIndiceBytes {
    <# bytes do indice (cache em memoria enquanto o arquivo nao mudar); $null se ainda nao foi calculado #>
    $path = Get-AppRlIndicePath
    if (-not (Test-Path $path)) { return $null }
    $stamp = (Get-Item $path).LastWriteTimeUtc.Ticks
    if ($Script:AppRlBytesCache -and $Script:AppRlBytesStamp -eq $stamp) { return $Script:AppRlBytesCache }
    $Script:AppRlBytesCache = [System.IO.File]::ReadAllBytes($path)
    $Script:AppRlBytesStamp = $stamp
    return $Script:AppRlBytesCache
}
