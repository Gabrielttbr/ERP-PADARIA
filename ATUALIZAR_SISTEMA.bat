@echo off
setlocal

:: ============================================================================
::  SISTEMA PDV - ATUALIZADOR (Windows / SQLite)
::  1. para o servidor   2. backup do banco   3. baixa a versao nova (git)
::  4. dependencias e build   5. reinicia.  Para em qualquer erro.
:: ============================================================================

set "ROOT=C:\Padaria"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "DB_FILE=%BACKEND%\padaria.db"
set "BACKUP_DIR=%ROOT%\backups"
set "ETAPA=inicio"

:: O git pull pode trocar este proprio arquivo, e o cmd le o .bat aos poucos
:: enquanto executa. Por isso o atualizador roda a partir de uma copia no TEMP.
if /i "%~1"=="--copia" goto inicio
copy /Y "%~f0" "%TEMP%\ATUALIZAR_ERP_PADARIA.bat" >nul
if errorlevel 1 (
    echo  [ERRO] Nao foi possivel preparar o atualizador na pasta TEMP.
    pause
    exit /b 1
)
:: Sem "call": o controle passa para a copia e nao volta para este arquivo
"%TEMP%\ATUALIZAR_ERP_PADARIA.bat" --copia

:inicio

title ATUALIZAR - Sistema PDV
echo.
echo  ============================================================
echo       SISTEMA PDV - ATUALIZADOR
echo  O banco de dados NAO e apagado: antes de atualizar, e feito
echo  um backup em %BACKUP_DIR%
echo.
echo  Feche o sistema e nao faca vendas durante a atualizacao.
echo  ============================================================
echo.
pause

:: --- Pre-requisitos ---
git --version >nul 2>&1
if errorlevel 1 (
    set "MOTIVO=Git nao encontrado. Rode o INSTALAR_SISTEMA.bat."
    goto falha
)
if not exist "%ROOT%\.git" (
    set "MOTIVO=%ROOT% nao e uma instalacao feita pelo instalador (sem .git)."
    goto falha
)
if not exist "%DB_FILE%" (
    set "MOTIVO=Banco de dados nao encontrado em %DB_FILE%. Nada foi alterado."
    goto falha
)

cd /d "%ROOT%"
for /f %%h in ('git rev-parse --short HEAD') do set "VERSAO_ANTES=%%h"
echo  Versao instalada:
git log -1 --date=short --format="     %%h  %%ad  %%s"
echo.

:: --- 1. Para o servidor ---
set "ETAPA=parar"
echo  [1/5] Parando o servidor...
call :parar_servidor
timeout /t 2 /nobreak >nul
netstat -aon 2>nul | findstr ":8000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    set "MOTIVO=O servidor continua rodando na porta 8000. Feche o Sistema PDV e tente de novo."
    goto falha
)
echo  [OK] Servidor parado.

:: --- 2. Backup do banco ---
set "ETAPA=backup"
echo.
echo  [2/5] Fazendo backup do banco de dados...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
:: Data/hora no mesmo formato em qualquer idioma do Windows
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%t"
if not defined TS (
    set "MOTIVO=Nao foi possivel obter a data/hora para o nome do backup."
    goto falha
)
set "BACKUP_FILE=%BACKUP_DIR%\padaria_%TS%.db"

copy /Y "%DB_FILE%" "%BACKUP_FILE%" >nul
if errorlevel 1 (
    set "MOTIVO=Falha ao copiar o banco para %BACKUP_FILE% (disco cheio ou arquivo em uso?)."
    goto falha
)
:: Transacao interrompida: o SQLite precisa do -journal para recuperar
if exist "%DB_FILE%-journal" copy /Y "%DB_FILE%-journal" "%BACKUP_FILE%-journal" >nul

for %%A in ("%DB_FILE%") do set "TAM_BANCO=%%~zA"
for %%A in ("%BACKUP_FILE%") do set "TAM_BACKUP=%%~zA"
if not "%TAM_BANCO%"=="%TAM_BACKUP%" (
    set "MOTIVO=O backup ficou com tamanho diferente do banco (%TAM_BACKUP% x %TAM_BANCO% bytes)."
    goto falha
)
echo  [OK] Backup: %BACKUP_FILE%  (%TAM_BACKUP% bytes)

:: --- 3. Baixa a versao nova ---
set "ETAPA=git"
echo.
echo  [3/5] Baixando a versao nova...
:: O Iniciar_Padaria.bat vem do repositorio. Instalacoes antigas tem uma versao
:: gerada pelo instalador por cima dele: descarta, para o git atualizar o arquivo.
set "INICIAR=%ROOT%\Iniciar_Padaria.bat"
git checkout -- Iniciar_Padaria.bat >nul 2>&1

git pull --ff-only
set "ERRO_GIT=%errorlevel%"
if not "%ERRO_GIT%"=="0" (
    set "MOTIVO=O git pull falhou (internet? arquivos alterados em %ROOT%?). O sistema continua na versao anterior."
    goto falha
)

for /f %%h in ('git rev-parse --short HEAD') do set "VERSAO_DEPOIS=%%h"
if "%VERSAO_ANTES%"=="%VERSAO_DEPOIS%" (
    echo  [OK] Ja estava na versao mais recente.
) else (
    echo  [OK] Versoes novas baixadas:
    git log --date=short --format="     %%h  %%ad  %%s" %VERSAO_ANTES%..HEAD
)

:: --- 4. Dependencias e build ---
set "ETAPA=build"
echo.
echo  [4/5] Atualizando dependencias e recompilando...
:: Sem --upgrade: instala so o que o requirements.txt pede de novo, sem trocar
:: de versao o que ja funciona (foi assim que a SQLAlchemy 2.1 chegou sem o greenlet).
"%BACKEND%\venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt" -q
if errorlevel 1 (
    set "MOTIVO=Falha ao instalar as dependencias Python (veja a mensagem acima)."
    goto falha
)
echo  [OK] Dependencias Python.

cd /d "%FRONTEND%"
call npm install --legacy-peer-deps --silent
if errorlevel 1 (
    set "MOTIVO=Falha ao instalar as dependencias do frontend (veja a mensagem acima)."
    goto falha
)
echo  [OK] Dependencias do frontend.

call npm run build
if errorlevel 1 (
    set "MOTIVO=Falha ao compilar o frontend (veja a mensagem acima)."
    goto falha
)
echo  [OK] Interface compilada.

:: --- 5. Reinicia ---
echo.
echo  [5/5] Iniciando o sistema...
start "Sistema PDV" cmd /k ""%INICIAR%""

echo.
echo  ============================================================
echo   ATUALIZACAO CONCLUIDA
echo     Versao anterior : %VERSAO_ANTES%
echo     Versao atual    : %VERSAO_DEPOIS%
echo     Backup do banco : %BACKUP_FILE%
echo  ============================================================
echo.
pause
exit /b 0


:: --- Falha: explica o que aconteceu e o estado em que o sistema ficou ---
:falha
echo.
echo  ============================================================
echo   [ERRO] A ATUALIZACAO NAO FOI CONCLUIDA
echo  ============================================================
echo   %MOTIVO%
echo.
if defined VERSAO_ANTES echo   Versao que estava instalada : %VERSAO_ANTES%
if defined BACKUP_FILE if exist "%BACKUP_FILE%" echo   Backup do banco             : %BACKUP_FILE%
echo.
if "%ETAPA%"=="build" (
    echo   O codigo novo ja foi baixado, mas a instalacao ficou pela metade.
    echo   Rode o ATUALIZAR_SISTEMA.bat de novo. Se o erro continuar, volte
    echo   para a versao anterior:  cd /d %ROOT% ^&^& git reset --hard %VERSAO_ANTES%
    echo   e rode o ATUALIZAR_SISTEMA.bat outra vez.
) else (
    echo   O sistema continua na versao anterior. Abra o Sistema PDV normalmente.
)
echo.
pause
exit /b 1


:parar_servidor
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
exit /b 0
