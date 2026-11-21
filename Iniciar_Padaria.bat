@echo off
:: Inicializador do Sistema PDV (usado pelo atalho "Sistema PDV" da area de trabalho).
:: Este arquivo vem do repositorio e e atualizado pelo ATUALIZAR_SISTEMA.bat:
:: nao edite na maquina do cliente.
title Sistema PDV
color 0A
cd /d "C:\Padaria\backend"
set "PYTHONPATH=C:\Padaria\backend"
if not exist "C:\Padaria\backend\uploads" mkdir "C:\Padaria\backend\uploads"
echo.
echo  ============================================
echo       SISTEMA PDV - Iniciando...
echo  ============================================
echo.
echo  Acesse: http://localhost:8000
echo  Para encerrar: feche esta janela.
echo.
echo  [!] Verificando se a porta 8000 esta livre...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
:: Abre o sistema em tela cheia assim que o servidor responder
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Padaria\abrir_sistema.ps1"
"C:\Padaria\backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
echo.
echo  [!] Servidor encerrado ou falhou. Verifique o erro acima.
pause
