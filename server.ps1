$port = 8000
# Buscar puerto libre entre 8000 y 8020
while ($true) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        break
    } catch {
        $port++
        if ($port -gt 8020) {
            Write-Host "Error: No se pudo iniciar el servidor web. Todos los puertos del 8000 al 8020 están ocupados."
            Read-Host "Presiona Enter para salir..."
            exit
        }
    }
}

Clear-Host
Write-Host "==================================================" -ForegroundColor Red
Write-Host "  DREAD FACILITY - SERVIDOR LOCAL ACTIVO" -ForegroundColor Yellow -BackgroundColor Black
Write-Host "==================================================" -ForegroundColor Red
Write-Host "  Puerto del servidor: $port" -ForegroundColor White
Write-Host "  Abriendo http://localhost:$port/ en tu navegador..." -ForegroundColor Green
Write-Host "  NO CIERRES ESTA VENTANA MIENTRAS JUEGAS." -ForegroundColor DarkRed -BackgroundColor White
Write-Host "==================================================" -ForegroundColor Red

# Abrir el navegador por defecto
Start-Process "http://localhost:$port/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $url = $request.Url.LocalPath
        if ($url -eq "/") { $url = "/index.html" }
        
        # Limpiar "/" inicial para Join-Path
        $url = $url.TrimStart('/')
        $path = Join-Path (Get-Location) $url
        
        if (Test-Path $path -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            
            $ext = [System.IO.Path]::GetExtension($path).ToLower()
            $mime = "application/octet-stream"
            if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $mime = "text/javascript; charset=utf-8" }
            elseif ($ext -eq ".ttf") { $mime = "font/ttf" }
            elseif ($ext -eq ".png") { $mime = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }
            elseif ($ext -eq ".ico") { $mime = "image/x-icon" }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Archivo no encontrado")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    # Manejar salida o detención
    if ($listener) { $listener.Stop() }
}
