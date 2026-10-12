# Rebuild favicon and install icons from art/icon-master.png.
Add-Type -AssemblyName System.Drawing

$iconRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public'))
$masterPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../art/icon-master.png'))
$master = [System.Drawing.Bitmap]::new($masterPath)
$background = $master.GetPixel(0, 0)

function New-IconBitmap([int]$size, [string]$kind) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear($background)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    if ($kind -eq 'favicon') {
      # At browser-tab sizes, show Tinker's hat, maple leaf and eye rather than the full rover.
      $source = [System.Drawing.Rectangle]::new(305, 90, 650, 650)
      $target = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    } elseif ($kind -eq 'maskable') {
      # Android may crop to a circle: keep the antenna and wheels inside its safe area.
      $padding = [int][Math]::Round($size * 0.125)
      $source = [System.Drawing.Rectangle]::new(0, 0, $master.Width, $master.Height)
      $target = [System.Drawing.Rectangle]::new($padding, $padding, $size - 2 * $padding, $size - 2 * $padding)
    } else {
      $source = [System.Drawing.Rectangle]::new(0, 0, $master.Width, $master.Height)
      $target = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    }
    $graphics.DrawImage($master, $target, $source, [System.Drawing.GraphicsUnit]::Pixel)
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

try {
  $outputs = @(
    @{ Size = 192; Kind = 'standard'; Path = 'icons/icon-192.png' },
    @{ Size = 512; Kind = 'standard'; Path = 'icons/icon-512.png' },
    @{ Size = 192; Kind = 'maskable'; Path = 'icons/icon-maskable-192.png' },
    @{ Size = 512; Kind = 'maskable'; Path = 'icons/icon-maskable-512.png' },
    @{ Size = 180; Kind = 'standard'; Path = 'icons/apple-touch-icon.png' },
    @{ Size = 32; Kind = 'favicon'; Path = 'icons/favicon-32.png' }
  )
  foreach ($output in $outputs) {
    $bitmap = New-IconBitmap $output.Size $output.Kind
    try { $bitmap.Save((Join-Path $iconRoot $output.Path), [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose() }
  }

  # ICO holds three PNG images, so Windows and browsers can choose a suitable size.
  $images = @()
  foreach ($size in @(16, 32, 48)) {
    $bitmap = New-IconBitmap $size 'favicon'
    $stream = [System.IO.MemoryStream]::new()
    try { $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); $images += ,@{ Size = $size; Bytes = $stream.ToArray() } }
    finally { $stream.Dispose(); $bitmap.Dispose() }
  }
  $file = [System.IO.File]::Create((Join-Path $iconRoot 'favicon.ico'))
  $writer = [System.IO.BinaryWriter]::new($file)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$images.Count)
    $offset = 6 + 16 * $images.Count
    foreach ($entry in $images) {
      $writer.Write([byte]$entry.Size); $writer.Write([byte]$entry.Size)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$entry.Bytes.Length); $writer.Write([uint32]$offset)
      $offset += $entry.Bytes.Length
    }
    foreach ($entry in $images) { $writer.Write([byte[]]$entry.Bytes) }
  } finally { $writer.Dispose(); $file.Dispose() }
} finally { $master.Dispose() }
