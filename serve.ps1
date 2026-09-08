# Serves this folder at http://localhost:8123
# Run with:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Stop with: Ctrl+C
#
# You do not need this to use the app -- double-clicking index.html works too.
# It is here for when a browser is fussy about local files.

param([int]$Port = 8123)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host ""
Write-Host "  War Room is running at http://localhost:$Port/" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

$types = @{
  '.html'        = 'text/html; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.ico'         = 'image/x-icon'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
  '.woff2'       = 'font/woff2'
  # Browsers will not offer to install the app if the manifest and icons come
  # back as octet-stream, so these two matter more than they look.
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

try {
  while ($true) {
    # One connection must never take the server down with it. Browsers --
    # headless Chromium especially -- hang up mid-request constantly, and an
    # unhandled IOException here would throw straight past the accept loop
    # into `finally`, stopping the listener silently. The symptom is the
    # *page* appearing to fail, which sends you looking in the wrong file.
    $client = $null
    try {
      $client = $listener.AcceptTcpClient()
      $stream = $client.GetStream()

      # Chromium opens speculative sockets it may never send a request on. This
      # loop is single threaded, so one silent socket blocking in ReadLine()
      # freezes the whole server -- every later page load just hangs, which
      # looks exactly like the app failing to start. A read timeout turns that
      # into an IOException the catch below discards.
      $stream.ReadTimeout = 5000
      $stream.WriteTimeout = 5000

      $reader = [System.IO.StreamReader]::new($stream)

      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { $client.Close(); continue }
  
      $path = ($requestLine -split ' ')[1]
      $path = ($path -split '\?')[0]
      if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
      $path = [System.Uri]::UnescapeDataString($path)
  
      # Resolve inside $root only -- refuse anything that escapes it.
      $full = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
      $resolved = $null
      try { $resolved = (Resolve-Path -LiteralPath $full -ErrorAction Stop).Path } catch {}
  
      if ($resolved -and $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
        $ctype = $types[$ext]
        if (-not $ctype) { $ctype = 'application/octet-stream' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
        Write-Host "  200  $path"
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
        Write-Host "  404  $path" -ForegroundColor DarkYellow
      }
  
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
      $client.Close()
    } catch {
      # Dropped connection, malformed request line, unreadable file. Log and
      # keep serving.
      Write-Host "  --   $($_.Exception.GetType().Name)" -ForegroundColor DarkGray
    } finally {
      if ($client) { try { $client.Close() } catch {} }
    }
  }
} finally {
  $listener.Stop()
  Write-Host "Stopped."
}
