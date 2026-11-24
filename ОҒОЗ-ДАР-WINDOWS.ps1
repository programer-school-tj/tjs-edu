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
  Write-Host "Docker Desktop-ро кушоед ва то ҳолати Running интизор шавед." -ForegroundColor Red
  Read-Host "Enter барои баромадан"
  exit 1
}

# Keep all unrelated .env settings and preserve each valid secret independently.
$envLines = @()
if (Test-Path ".env") {
  $envLines = @(Get-Content ".env")
}
$envText = $envLines -join "`n"
$sessionMatch = [regex]::Match($envText, "(?m)^SESSION_SECRET=([A-Za-z0-9_-]{32,})\s*$")
$databaseMatch = [regex]::Match($envText, "(?m)^POSTGRES_PASSWORD=([0-9a-f]{64})\s*$")

if ($sessionMatch.Success) {
  $sessionSecret = $sessionMatch.Groups[1].Value
} else {
  $sessionSecret = New-RandomHex 48
}
if ($databaseMatch.Success) {
  $databasePassword = $databaseMatch.Groups[1].Value
} else {
  $databasePassword = New-RandomHex 32
}

$envLines = @($envLines | Where-Object { $_ -notmatch "^(SESSION_SECRET|POSTGRES_PASSWORD)=" })
$envLines += "SESSION_SECRET=$sessionSecret"
$envLines += "POSTGRES_PASSWORD=$databasePassword"
Set-Content -Path ".env" -Value $envLines -Encoding ascii
Write-Host "Танзимоти .env омодаанд; дигар параметрҳои мавҷуда нигоҳ дошта шуданд." -ForegroundColor Green

Write-Host "Санҷиши docker compose..." -ForegroundColor Cyan
docker compose config --quiet
if ($LASTEXITCODE -ne 0) {
  Write-Host "docker-compose.yml ё файли .env нодуруст аст. Танзимотро санҷед." -ForegroundColor Red
  Read-Host "Enter барои баромадан"
  exit 1
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
Write-Host "Барои нусхаи эҳтиётӣ: docker compose exec -T db pg_dump -U tjsedu tjs_edu > tjs-edu-backup.sql" -ForegroundColor Yellow
Read-Host "Enter барои анҷом"
