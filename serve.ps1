# Leaf Yard fallback server for Windows machines without Node.js.
# Serves .\public at http://localhost:8080 using only built-in PowerShell.
# No live reload here: refresh the browser yourself after editing.
param([int]$Port = 8080)

$root = Join-Path $PSScriptRoot 'public'
$types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.webp'='image/webp';
  '.ico'='image/x-icon'; '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.wav'='audio/wav'; '.woff2'='font/woff2'
}

$listener = New-Object System.Net.HttpListener
while ($true) {
  try { $listener.Prefixes.Clear(); $listener.Prefixes.Add("http://localhost:$Port/"); $listener.Start(); break }
  catch { if ($Port -ge 8100) { throw }; $Port++; $listener = New-Object System.Net.HttpListener }
}
$link = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Leaf Yard is running at $link"
Write-Host "  Fresh game:   $($link)?fresh"
Write-Host "  Fast-forward: $($link)?speed=4"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""
Start-Process $link

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($rel.EndsWith('/')) { $rel += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $rel.TrimStart('/')))
    $res = $ctx.Response
    if ($file.StartsWith([IO.Path]::GetFullPath($root)) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}
