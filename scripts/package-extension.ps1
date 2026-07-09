param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
$manifestPath = Join-Path $root "manifest.json"

if (-not $Version) {
    $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
    $Version = $manifest.version
}

$dist = Join-Path $root "dist"
$stage = Join-Path $dist "EloGuard-$Version"
$zip = Join-Path $dist "EloGuard-$Version.zip"

New-Item -ItemType Directory -Force -Path $dist | Out-Null

$resolvedDist = (Resolve-Path $dist).Path
if (Test-Path $stage) {
    $resolvedStage = (Resolve-Path $stage).Path
    if (-not $resolvedStage.StartsWith($resolvedDist, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove unexpected staging path: $resolvedStage"
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}

if (Test-Path $zip) {
    Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null

$files = @(
    "manifest.json",
    "popup.html",
    "popup.css",
    "popup.js",
    "content.js",
    "styles.css",
    "icon.png"
)

foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $stage $file)
}

foreach ($dir in @("lib", "engine")) {
    Copy-Item -LiteralPath (Join-Path $root $dir) -Destination (Join-Path $stage $dir) -Recurse
}

# Build the zip manually so entry paths use forward slashes. Compress-Archive
# (and .NET Framework's ZipFile.CreateFromDirectory) on Windows PowerShell 5.1
# store nested paths with backslashes, which violates the ZIP spec and breaks
# Chrome's loader (manifest.json references lib/... and engine/... with slashes).
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$stageFull = (Resolve-Path $stage).Path.TrimEnd('\')
$zipStream = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($item in Get-ChildItem -LiteralPath $stageFull -Recurse -File) {
        $entryName = $item.FullName.Substring($stageFull.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($item.FullName)
        try { $fileStream.CopyTo($entryStream) }
        finally { $fileStream.Dispose(); $entryStream.Dispose() }
    }
}
finally {
    $archive.Dispose()
    $zipStream.Dispose()
}

Write-Host "Packaged $zip"
