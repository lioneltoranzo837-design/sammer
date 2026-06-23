$nodeDir = "$PWD\node_temp\node-v20.14.0-win-x64"
if (!(Test-Path "$nodeDir\node.exe")) {
    Write-Host "Descargando herramientas necesarias (Node.js) para compilar el juego..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.14.0/node-v20.14.0-win-x64.zip" -OutFile "node.zip"
    Write-Host "Extrayendo archivos..." -ForegroundColor Yellow
    Expand-Archive "node.zip" -DestinationPath "node_temp" -Force
    Remove-Item "node.zip"
}

$env:PATH = "$nodeDir;" + $env:PATH
Write-Host "Preparando el código de tu amigo..." -ForegroundColor Yellow
npm install
Write-Host "Compilando a JavaScript..." -ForegroundColor Yellow
npm run build:ts
Write-Host "¡Compilación terminada! Ahora puedes abrir el servidor y jugar." -ForegroundColor Green
