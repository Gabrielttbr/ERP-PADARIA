# Abre o Sistema PDV no navegador em tela cheia (chamado pelo Iniciar_Padaria.bat).
#
# - Espera o servidor responder em /api/health (ate 90 s) em vez de um tempo fixo.
# - Abre o Edge (ou o Chrome) em modo aplicativo (sem barra de endereco e abas)
#   e em tela cheia. F11 sai da tela cheia; Alt+F4 fecha a janela.
# - Usa um perfil proprio do navegador, separado do uso pessoal: assim a janela
#   sempre abre em tela cheia, mesmo com o navegador ja aberto, e sem login,
#   sincronizacao ou extensoes da conta do usuario.
# - Sem Edge nem Chrome, abre no navegador padrao (janela comum).

param([string]$Url = "http://localhost:8000")

$ErrorActionPreference = "SilentlyContinue"

# 1. Espera o servidor subir
$limite = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $limite) {
    try {
        $r = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep -Milliseconds 700
}

# 2. Procura Edge ou Chrome
$navegadores = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$exe = $navegadores | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $exe) {
    Start-Process $Url
    exit 0
}

# 3. Abre em tela cheia, com perfil proprio (fica na pasta do usuario do Windows)
$perfil = Join-Path $env:LOCALAPPDATA "GiroNegocios\navegador"
New-Item -ItemType Directory -Force -Path $perfil | Out-Null

Start-Process -FilePath $exe -ArgumentList @(
    "--app=$Url",
    "--start-fullscreen",
    "--user-data-dir=`"$perfil`"",
    "--no-first-run",
    "--no-default-browser-check",
    # Perfil so do sistema: sem login automatico na conta Microsoft, sem
    # sincronizar e sem extensoes (que abririam janelas/abas por cima)
    "--disable-sync",
    "--disable-extensions",
    "--disable-features=msImplicitSignin,msEdgeSyncConsent",
    "--disable-session-crashed-bubble"
)
