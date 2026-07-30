param(
    [string]$TargetRoot = "",
    [switch]$IncludeDemoCanvas,
    [switch]$IncludeApiConfig,
    [switch]$InstallPrivateBackup
)

$ErrorActionPreference = "Stop"

function Resolve-PackageRoot {
    $scriptDir = Split-Path -Parent $PSCommandPath
    $candidate = Resolve-Path (Join-Path $scriptDir "..")
    if (Test-Path -LiteralPath (Join-Path $candidate "storyboard_feature_manifest.json")) {
        return $candidate.Path
    }
    $cwd = (Get-Location).Path
    if (Test-Path -LiteralPath (Join-Path $cwd "storyboard_feature_manifest.json")) {
        return $cwd
    }
    throw "Cannot find storyboard_feature_manifest.json. Please run this script from the extracted package."
}

function Copy-RelativeFile {
    param(
        [string]$SourceRoot,
        [string]$TargetRoot,
        [string]$RelativePath,
        [string]$BackupRoot
    )
    $source = Join-Path $SourceRoot $RelativePath
    if (!(Test-Path -LiteralPath $source)) {
        Write-Warning "Skip missing package file: $RelativePath"
        return $false
    }

    $target = Join-Path $TargetRoot $RelativePath
    if (Test-Path -LiteralPath $target) {
        $backup = Join-Path $BackupRoot $RelativePath
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
        Copy-Item -LiteralPath $target -Destination $backup -Force
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    return $true
}

$packageRoot = Resolve-PackageRoot

if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
    $TargetRoot = Read-Host "请输入另一台电脑上的无限画布项目根目录"
}

$target = (Resolve-Path $TargetRoot).Path
if (!(Test-Path -LiteralPath (Join-Path $target "main.py") -PathType Leaf) -or
    !(Test-Path -LiteralPath (Join-Path $target "static") -PathType Container)) {
    throw "TargetRoot is not an infinite canvas project: $target"
}
$manifestPath = Join-Path $packageRoot "storyboard_feature_manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ($InstallPrivateBackup) {
    $IncludeDemoCanvas = $true
    $IncludeApiConfig = $true
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $target "backup/pre_storyboard_feature_install_$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$files = New-Object System.Collections.Generic.List[string]
foreach ($file in @($manifest.featureFiles)) {
    if (![string]::IsNullOrWhiteSpace($file)) { $files.Add([string]$file) }
}

if ($IncludeDemoCanvas) {
    foreach ($file in @($manifest.demoFiles)) {
        if (![string]::IsNullOrWhiteSpace($file)) { $files.Add([string]$file) }
    }
}

if ($IncludeApiConfig) {
    foreach ($file in @($manifest.apiConfigFiles)) {
        if (![string]::IsNullOrWhiteSpace($file)) { $files.Add([string]$file) }
    }
}

$uniqueFiles = @($files | Sort-Object -Unique)
foreach ($relative in $uniqueFiles) {
    $source = Join-Path $packageRoot $relative
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $hashProperty = $manifest.sha256.PSObject.Properties[$relative]
    if ($hashProperty) {
        $actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
        $expectedHash = ([string]$hashProperty.Value).ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "Package verification failed: $relative"
        }
    }
}

$copied = 0
foreach ($relative in $uniqueFiles) {
    if (Copy-RelativeFile -SourceRoot $packageRoot -TargetRoot $target -RelativePath $relative -BackupRoot $backupRoot) {
        $copied += 1
    }
}

Write-Host ""
Write-Host "OK: Storyboard features installed."
Write-Host "Target: $target"
Write-Host "Copied files: $copied"
Write-Host "Backup of replaced files: $backupRoot"
Write-Host ""
Write-Host "If the app is running, restart it and refresh the browser."
