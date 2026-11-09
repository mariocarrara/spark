@echo off
chcp 65001 >nul
REM ============================================================
REM  iniciar.bat - abre o SPARK
REM  Duplo clique. Liga o Controller (controller\server.ps1) e abre
REM  o navegador sozinho. Para fechar o sistema, feche esta janela.
REM ============================================================
REM v3.13.3 - pushd (e nao cd) porque o CMD nao aceita pasta de REDE (\\servidor\pasta) como pasta atual:
REM o pushd liga uma letra de unidade temporaria (Z:, Y:...) nessa pasta. O script roda por essa letra.
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\controller\server.ps1"
set CODIGO=%ERRORLEVEL%
popd

REM O Controller so termina aqui se parou (erro ou fechamento). Em
REM qualquer caso a janela fica aberta pra dar tempo de ler.
echo.
echo ============================================================
echo  ATENCAO: o Controller do SPARK PAROU (codigo %CODIGO%).
echo  Se apareceu erro em vermelho acima, tire um print desta janela
echo  inteira e envie para quem cuida do SPARK.
echo  O sistema NAO esta no ar enquanto esta mensagem aparecer.
echo ============================================================
echo.
pause
