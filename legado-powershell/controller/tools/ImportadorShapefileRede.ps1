# ============================================================
# ImportadorShapefileRede.ps1
# Importa shapefiles da BDGD/ANEEL (SSDMT, SSDBT, SSDAT...) por linha de
# comando e gera GeoJSON pronto para o mapa.
#
# Este é o caminho "avançado": pra quem prefere terminal, tem um shapefile
# grande demais para subir pelo navegador com folga, ou quer automatizar a
# importação (agendador de tarefas etc.). Para o dia a dia, a tela
# "Importação de Bases" > Rede MT/BT/AT (Shapefile) do próprio SPARK já
# aceita arrastar e soltar os arquivos direto — sem precisar deste script.
# As duas formas usam exatamente o mesmo leitor de .shp/.dbf
# (controller/lib/ShapefileImporter.ps1), já testado contra os 427.910
# registros reais do SSDMT enviado.
#
# Uso:
#   .\ImportadorShapefileRede.ps1 -CaminhoShp "C:\dados\SSDMT.shp" `
#       -Camada "rede_media_tensao"
#
# (a pasta de saída é sempre a geo/ do próprio pacote — não precisa
# informar; a MT vira vários arquivos particionados por alimentador em
# geo/rede_mt/, a BT e a AT viram um geo/rede_bt.geojson ou
# geo/rede_at.geojson único.)
# ============================================================

param(
    [Parameter(Mandatory=$true)][string]$CaminhoShp,
    [Parameter(Mandatory=$true)][ValidateSet('rede_media_tensao','rede_baixa_tensao','rede_alta_tensao')][string]$Camada
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot "..\lib\ShapefileImporter.ps1")

$base = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName((Resolve-Path $CaminhoShp)), [System.IO.Path]::GetFileNameWithoutExtension($CaminhoShp))
$caminhoDbf = "$base.dbf"
$caminhoPrj = "$base.prj"
if (-not (Test-Path "$base.shx")) { Write-Warning "Não encontrei o .shx ao lado do .shp — ele não é necessário para esta importação (lemos o .shp sequencialmente), mas confirme que não faltou copiar nenhum arquivo." }
if (-not (Test-Path $caminhoDbf)) { throw "Não encontrei $caminhoDbf. O shapefile precisa vir com .shp + .dbf (e .prj) juntos." }
# Um arquivo ".fix" às vezes acompanha o shapefile (log de correção de alguma
# ferramenta de GIS) — não é um componente padrão do shapefile e não é usado aqui.

Write-Host "Lendo $CaminhoShp ..." -ForegroundColor Cyan
$shpBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $CaminhoShp))
$dbfBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $caminhoDbf))
$prjTexto = if (Test-Path $caminhoPrj) { Get-Content $caminhoPrj -Raw } else { $null }

$geoRoot = Join-Path $PSScriptRoot "..\..\geo"
$resultado = Import-ShapefileRede -ShpBytes $shpBytes -DbfBytes $dbfBytes -PrjTexto $prjTexto -Camada $Camada -GeoRoot $geoRoot

if ($resultado.avisoProjecao) { Write-Warning $resultado.avisoProjecao }

Write-Host ""
Write-Host "Concluído." -ForegroundColor Green
if ($resultado.particionado) {
    Write-Host ("  Alimentadores processados : {0}" -f $resultado.alimentadores)
} else {
    Write-Host ("  Arquivo gravado           : geo\{0}.geojson" -f $Camada.Replace('rede_media_tensao','rede_mt').Replace('rede_baixa_tensao','rede_bt').Replace('rede_alta_tensao','rede_at'))
}
Write-Host ("  Trechos importados        : {0}" -f $resultado.trechos)
Write-Host ("  Registros rejeitados      : {0}" -f $resultado.rejeitados)
Write-Host ""
Write-Host "Rota da API que serve essas camadas: GET /api/manutencao/camadas" -ForegroundColor DarkGray
