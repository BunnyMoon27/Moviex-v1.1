$ErrorActionPreference = "Stop"
$exe = "C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe"
$root = Join-Path $env:LOCALAPPDATA "MovieX\mongodb"
$data = Join-Path $root "data"
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $data,$logs | Out-Null
if (Get-NetTCPConnection -LocalPort 27018 -State Listen -ErrorAction SilentlyContinue) { Write-Output "MovieX MongoDB already listening on 27018"; exit 0 }
if (-not (Test-Path $exe)) { throw "MongoDB 9.0 Server is not installed at $exe" }
$args = "--dbpath `"$data`" --replSet rs0 --bind_ip 127.0.0.1 --port 27018 --logpath `"$(Join-Path $logs 'mongod.log')`" --logappend"
Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden
Start-Sleep -Seconds 2
if (-not (Get-NetTCPConnection -LocalPort 27018 -State Listen -ErrorAction SilentlyContinue)) { throw "MovieX MongoDB failed to start. Check logs." }
Write-Output "MovieX MongoDB ready on port 27018"
