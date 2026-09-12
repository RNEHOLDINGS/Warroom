# Serves this folder at http://localhost:8123, and to your phone on the same
# Wi-Fi at http://<this-pc>:8123
#
# Run with:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Stop with: Ctrl+C
#
# You do not need this to use the app on this PC -- double-clicking index.html
# works too. You DO need it for reading screenshots, and for the phone.
#
# -LocalOnly goes back to answering only this machine.

param([int]$Port = 8123, [switch]$LocalOnly)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# What every served path must start with. With the separator on: a bare
# "starts with the folder name" test let /../Warroom-old/anything through,
# because ...\Warroom-old starts with ...\Warroom -- to anyone on the Wi-Fi.
$rootDir = $root.TrimEnd('\') + '\'

# Loopback answers only this PC, so a phone on the same Wi-Fi gets nothing and
# it looks like the address is wrong. Any listens on the network too.
$bind = if ($LocalOnly) { [System.Net.IPAddress]::Loopback } else { [System.Net.IPAddress]::Any }
$listener = [System.Net.Sockets.TcpListener]::new($bind, $Port)
$listener.Start()

$lan = $null
if (-not $LocalOnly) {
  try {
    $lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
      Sort-Object -Property @{ Expression = { $_.InterfaceAlias -like '*Wi-Fi*' } } -Descending |
      Select-Object -First 1).IPAddress
  } catch {}
}

Write-Host ""
Write-Host "  War Room is running." -ForegroundColor Green
Write-Host "    On this PC:  http://localhost:$Port/"
if ($lan) {
  Write-Host "    On a phone:  http://${lan}:$Port/" -ForegroundColor Cyan
  Write-Host "                 (same Wi-Fi. If it will not load, Windows Firewall"
  Write-Host "                  is blocking it -- see the README.)"
}
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
  
      if ($resolved -and $resolved.StartsWith($rootDir, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved -PathType Leaf)) {
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
