$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker Desktop дастрас нест." }
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path "backups" "tjs-edu-$stamp.dump"
cmd /c "docker compose exec -T db pg_dump -U tjsedu -d tjs_edu -Fc > `"$file`""
if ($LASTEXITCODE -ne 0) { throw "Нусхаи эҳтиётӣ сохта нашуд." }
Write-Host "Нусхаи эҳтиётӣ сабт шуд: $file" -ForegroundColor Green
