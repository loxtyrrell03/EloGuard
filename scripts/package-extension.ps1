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

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force

Write-Host "Packaged $zip"
