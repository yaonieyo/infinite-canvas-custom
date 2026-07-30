param(
    [string]$CanvasId = "ba3858fd0441429f9911a064228e2a68",
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
    $scriptDir = Split-Path -Parent $PSCommandPath
    return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Copy-RelativeFile {
    param(
        [string]$SourceRoot,
        [string]$TargetRoot,
        [string]$RelativePath
    )

    $source = Join-Path $SourceRoot $RelativePath
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) {
        Write-Warning "Skip missing file: $RelativePath"
        return $false
    }

    $target = Join-Path $TargetRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    return $true
}

function Convert-ToLocalMediaPath {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    $candidate = $Value.Trim().Replace("\", "/")

    if ($candidate -match '^https?://[^/]+/(?<path>(assets|output)/.+)$') {
        $candidate = $Matches.path
    } elseif ($candidate -match '^/?(?<path>(assets|output)/.+)$') {
        $candidate = $Matches.path
    } else {
        return ""
    }

    $candidate = [Uri]::UnescapeDataString($candidate).TrimStart("/")
    if ($candidate.Contains("..")) { return "" }
    return $candidate
}

function Add-ReferencedMediaPaths {
    param(
        [object]$Value,
        [System.Collections.Generic.HashSet[string]]$Result
    )

    if ($null -eq $Value) { return }
    if ($Value -is [string]) {
        $relative = Convert-ToLocalMediaPath -Value $Value
        if ($relative) { [void]$Result.Add($relative) }
        return
    }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($entryValue in $Value.Values) {
            Add-ReferencedMediaPaths -Value $entryValue -Result $Result
        }
        return
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        foreach ($item in $Value) {
            Add-ReferencedMediaPaths -Value $item -Result $Result
        }
        return
    }
    foreach ($property in $Value.PSObject.Properties) {
        Add-ReferencedMediaPaths -Value $property.Value -Result $Result
    }
}

function Get-ReferencedMediaFiles {
    param(
        [string]$Root,
        [string[]]$JsonFiles
    )

    $result = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($relativeJson in $JsonFiles) {
        $jsonPath = Join-Path $Root $relativeJson
        if (!(Test-Path -LiteralPath $jsonPath -PathType Leaf)) { continue }
        $document = Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Add-ReferencedMediaPaths -Value $document -Result $result
    }
    return @($result | Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) } | Sort-Object)
}

function New-ManifestFile {
    param(
        [string]$Stage,
        [string]$Root,
        [string[]]$FeatureFiles,
        [string[]]$DemoFiles,
        [string[]]$ApiConfigFiles,
        [string]$PackageKind,
        [string]$CanvasId
    )

    $allFiles = @($FeatureFiles + $DemoFiles + $ApiConfigFiles | Sort-Object -Unique)
    $hashes = [ordered]@{}
    foreach ($relative in $allFiles) {
        $path = Join-Path $Stage $relative
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $hashes[$relative] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    $manifest = [ordered]@{
        name = "infinite-canvas-storyboard-workflow"
        packageKind = $PackageKind
        exportedAt = (Get-Date).ToString("s")
        sourceVersion = (Get-Content -LiteralPath (Join-Path $Root "VERSION") -Raw -ErrorAction SilentlyContinue).Trim()
        canvasId = $CanvasId
        featureFiles = @($FeatureFiles)
        demoFiles = @($DemoFiles)
        apiConfigFiles = @($ApiConfigFiles)
        sha256 = $hashes
        notes = @(
            "Installs the current script-to-storyboard, storyboard, prompt optimization and asset collector workflow.",
            "The installer backs up every replaced target file before copying.",
            "The private package contains the selected canvas, referenced media and local API provider configuration."
        )
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Stage "storyboard_feature_manifest.json") -Encoding UTF8
}

function New-Package {
    param(
        [string]$Root,
        [string]$OutputDir,
        [string]$Timestamp,
        [string]$Name,
        [string[]]$FeatureFiles,
        [string[]]$DemoFiles,
        [string[]]$ApiConfigFiles,
        [string]$CanvasId,
        [string]$PackageKind
    )

    $stage = Join-Path $env:TEMP "infinite_canvas_pack_${Name}_$Timestamp"
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    $copiedFeatures = @($FeatureFiles | Where-Object { Copy-RelativeFile -SourceRoot $Root -TargetRoot $stage -RelativePath $_ })
    $copiedDemo = @($DemoFiles | Where-Object { Copy-RelativeFile -SourceRoot $Root -TargetRoot $stage -RelativePath $_ })
    $copiedApi = @($ApiConfigFiles | Where-Object { Copy-RelativeFile -SourceRoot $Root -TargetRoot $stage -RelativePath $_ })

    New-ManifestFile -Stage $stage -Root $Root -FeatureFiles $copiedFeatures -DemoFiles $copiedDemo -ApiConfigFiles $copiedApi -PackageKind $PackageKind -CanvasId $CanvasId

    $zip = Join-Path $OutputDir "${Name}_$Timestamp.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal -Force
    Remove-Item -LiteralPath $stage -Recurse -Force
    return $zip
}

$root = Get-ProjectRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) { $OutputDir = Join-Path $root "backup" }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

$featureFiles = @(
    "main.py",
    "static/js/smart-canvas.js",
    "static/js/script-to-storyboard.js",
    "static/js/canvas-list.js",
    "static/js/canvas.js",
    "static/css/smart-canvas.css",
    "static/css/canvas-list.css",
    "static/css/canvas.css",
    "static/smart-canvas.html",
    "static/canvas.html",
    "static/canvas-list.html",
    "static/index.html",
    "static/system-prompts/infinite-canvas-prompt-templates.md",
    "tools/codex_batch_storyboard_images.js",
    "tools/storyboard_workflow_pack.ps1",
    "tools/build_storyboard_feature_package.ps1",
    "tools/install_storyboard_features.ps1",
    "tools/install_storyboard_features.bat",
    "tools/storyboard_feature_install_README.md"
)

$canvasFile = "data/canvases/$CanvasId.json"
if (!(Test-Path -LiteralPath (Join-Path $root $canvasFile) -PathType Leaf)) {
    throw "Canvas not found: $canvasFile"
}

$personalJson = @($canvasFile, "data/projects.json", "data/asset_library.json", "data/prompt_libraries.json")
$mediaFiles = Get-ReferencedMediaFiles -Root $root -JsonFiles $personalJson
$demoFiles = @($personalJson + $mediaFiles | Sort-Object -Unique)
$apiConfigFiles = @("data/api_providers.json")

$featureZip = New-Package -Root $root -OutputDir $OutputDir -Timestamp $timestamp -Name "infinite_canvas_storyboard_features" -FeatureFiles $featureFiles -DemoFiles @() -ApiConfigFiles @() -CanvasId $CanvasId -PackageKind "feature-only"
$privateZip = New-Package -Root $root -OutputDir $OutputDir -Timestamp $timestamp -Name "infinite_canvas_storyboard_private_backup" -FeatureFiles $featureFiles -DemoFiles $demoFiles -ApiConfigFiles $apiConfigFiles -CanvasId $CanvasId -PackageKind "private-backup"

Write-Host "OK: packages created"
Write-Host "Feature installer: $featureZip"
Write-Host "Private backup:    $privateZip"
Write-Host "Referenced media:  $($mediaFiles.Count)"
