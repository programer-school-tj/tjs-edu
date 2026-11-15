$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function New-RandomHex([int]$ByteCount) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $bytes = New-Object byte[] $ByteCount
    $rng.GetBytes($bytes)
    return ([BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
  } finally {
    $rng.Dispose()
  }
}

Write-Host "TJS Edu: санҷиши Docker Desktop..." -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker Desktop насб нест. Аввал Docker Desktop ва WSL2-ро насб кунед." -ForegroundColor Red
  Read-Host "Enter барои баромадан"
  exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker Desktop-ро кушоед ва баъд ин файлро аз нав иҷро кунед." -ForegroundColor Red
  Read-Host "Enter барои баромадан"
  exit 1
}

if (-not (Test-Path ".env")) {
  $sessionSecret = New-RandomHex 48
  $databasePassword = New-RandomHex 32
  @"
SESSION_SECRET=$sessionSecret
POSTGRES_PASSWORD=$databasePassword
"@ | Set-Content -Encoding ascii ".env"
  Write-Host "Файли .env бо калидҳои алоҳидаи тасодуфӣ сохта шуд." -ForegroundColor Green
} else {
  Write-Host "Файли .env мавҷуд аст. Он тағйир дода намешавад." -ForegroundColor Yellow
}

Write-Host "Оғози PostgreSQL, иҷрои мигратсияҳо ва сохтани барнома..." -ForegroundColor Cyan
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker Compose хатогӣ дод. Сабтҳои охирин:" -ForegroundColor Red
  docker compose logs --tail 80 db app
  Read-Host "Enter барои баромадан"
  exit 1
}

Write-Host "Интизори омода шудани TJS Edu..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 36; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 5
}
if (-not $ready) {
  Write-Host "Барнома дар вақти муайяншуда омода нашуд. Сабтҳои сервер:" -ForegroundColor Red
  docker compose logs --tail 100 db app
  Read-Host "Enter барои баромадан"
  exit 1
}

Write-Host ""
Write-Host "TJS Edu фаъол аст: http://localhost:8080" -ForegroundColor Green
Write-Host "Санҷиши API: http://localhost:8080/health" -ForegroundColor Green
Write-Host "Барои қатъ кардан: docker compose down" -ForegroundColor Yellow
Read-Host "Enter барои анҷом"
