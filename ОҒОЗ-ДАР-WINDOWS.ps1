$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "TJS Edu: санҷиши талабот..." -ForegroundColor Cyan
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
  $secret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  @"
SESSION_SECRET=$secret
POSTGRES_PASSWORD=$secret
"@ | Set-Content -Encoding ascii ".env"
  Write-Host "Файли .env бо калидҳои маҳаллӣ сохта шуд." -ForegroundColor Green
}

Write-Host "Оғози база ва барнома..." -ForegroundColor Cyan
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Оғоз нашуд. Паёми хатои Docker-ро санҷед." -ForegroundColor Red
  Read-Host "Enter барои баромадан"
  exit 1
}
Write-Host ""
Write-Host "TJS Edu бояд дар ин суроға кушода шавад: http://localhost:8080" -ForegroundColor Green
Write-Host "Барои қатъ кардан: docker compose down" -ForegroundColor Yellow
Read-Host "Enter барои анҷом"
