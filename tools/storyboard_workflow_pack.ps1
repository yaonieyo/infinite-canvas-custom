param(
    [ValidateSet("Export", "Restore")]
    [string]$Mode = "Export",

    [string]$PackagePath = "",

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
        [string]$Root,
        [string]$RelativePath,
        [string]$TargetRoot
    )
    $source = Join-Path $Root $RelativePath
    if (!(Test-Path -LiteralPath $source)) {
        Write-Warning "Skip missing: $RelativePath"
        return $false
    }
    $target = Join-Path $TargetRoot $RelativePath
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    return $true
}

function Get-CanvasAssetPaths {
    param(
        [string]$Root,
        [object]$Canvas
    )
    $result = New-Object System.Collections.Generic.HashSet[string]
    $nodes = @($Canvas.nodes)
    foreach ($node in $nodes) {
        foreach ($bucket in @("images", "manualInputRefs", "runInputRefs", "runPromptRefs")) {
            foreach ($item in @($node.$bucket)) {
                $url = [string]($item.url)
                if ([string]::IsNullOrWhiteSpace($url)) { continue }
                $rel = ""
                if ($url.StartsWith("/assets/")) {
                    $rel = $url.TrimStart("/")
                } elseif ($url.StartsWith("/output/")) {
                    $rel = $url.TrimStart("/")
                } elseif ($url.StartsWith("assets/") -or $url.StartsWith("output/")) {
                    $rel = $url
                }
                if ($rel) {
                    $full = Join-Path $Root $rel
                    if (Test-Path -LiteralPath $full) {
                        [void]$result.Add($rel)
                    }
                }
            }
        }
    }
    return @($result)
}

function Export-StoryboardWorkflow {
    $root = Get-ProjectRoot
    if (!$OutputDir) {
        $script:OutputDir = Join-Path $root "backup"
    }
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $stage = Join-Path $env:TEMP "storyboard_workflow_pack_$timestamp"
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    $files = @(
        "main.py",
        "static/js/smart-canvas.js",
        "static/js/script-to-storyboard.js",
        "static/js/canvas.js",
        "static/css/smart-canvas.css",
        "static/css/canvas.css",
        "static/smart-canvas.html",
        "static/canvas.html",
        "static/canvas-list.html",
        "static/index.html",
        "static/js/canvas-list.js",
        "static/system-prompts/infinite-canvas-prompt-templates.md",
        "tools/codex_batch_storyboard_images.js",
        "tools/storyboard_workflow_pack.ps1",
        "tools/build_storyboard_feature_package.ps1",
        "tools/install_storyboard_features.ps1",
        "tools/install_storyboard_features.bat",
        "tools/storyboard_feature_install_README.md",
        "data/projects.json",
        "data/asset_library.json",
        "data/prompt_libraries.json",
        "data/api_providers.json"
    )

    $canvasRel = "data/canvases/$CanvasId.json"
    if (Test-Path -LiteralPath (Join-Path $root $canvasRel)) {
        $files += $canvasRel
        $canvas = Get-Content -LiteralPath (Join-Path $root $canvasRel) -Raw -Encoding UTF8 | ConvertFrom-Json
        $assetPaths = Get-CanvasAssetPaths -Root $root -Canvas $canvas
        $files += $assetPaths
    } else {
        Write-Warning "Canvas not found: $canvasRel"
        $assetPaths = @()
    }

    $files = @($files | Where-Object { $_ } | Sort-Object -Unique)
    $copied = @()
    foreach ($rel in $files) {
        if (Copy-RelativeFile -Root $root -RelativePath $rel -TargetRoot $stage) {
            $copied += $rel
        }
    }

    $manifest = [ordered]@{
        name = "script-to-storyboard-workflow-pack"
        exported_at = (Get-Date).ToString("s")
        project_root = $root
        canvas_id = $CanvasId
        canvas_file = $canvasRel
        files = $copied
        asset_count = @($assetPaths).Count
        notes = @(
            "Contains Codex storyboard workflow code changes.",
            "Contains the selected smart canvas JSON.",
            "Contains local assets referenced by that canvas.",
            "Restore with: powershell -ExecutionPolicy Bypass -File tools/storyboard_workflow_pack.ps1 -Mode Restore -PackagePath <zip>"
        )
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stage "storyboard_workflow_manifest.json") -Encoding UTF8

    $zip = Join-Path $OutputDir "storyboard_workflow_pack_$timestamp.zip"
    if (Test-Path -LiteralPath $zip) {
        Remove-Item -LiteralPath $zip -Force
    }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
    Remove-Item -LiteralPath $stage -Recurse -Force

    Write-Host "OK Exported storyboard workflow package:"
    Write-Host $zip
    Write-Host "Files: $($copied.Count)"
    Write-Host "Canvas assets: $(@($assetPaths).Count)"
}

function Restore-StoryboardWorkflow {
    $root = Get-ProjectRoot
    if ([string]::IsNullOrWhiteSpace($PackagePath)) {
        $latest = Get-ChildItem -LiteralPath (Join-Path $root "backup") -Filter "storyboard_workflow_pack_*.zip" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if (!$latest) {
            throw "PackagePath is required, and no package was found under backup/."
        }
        $PackagePath = $latest.FullName
    }
    $package = (Resolve-Path $PackagePath).Path
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $stage = Join-Path $env:TEMP "storyboard_workflow_restore_$timestamp"
    $preBackup = Join-Path $root "backup/pre_storyboard_restore_$timestamp"
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    New-Item -ItemType Directory -Force -Path $preBackup | Out-Null

    Expand-Archive -LiteralPath $package -DestinationPath $stage -Force
    $manifestPath = Join-Path $stage "storyboard_workflow_manifest.json"
    if (!(Test-Path -LiteralPath $manifestPath)) {
        throw "Invalid package: storyboard_workflow_manifest.json not found."
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $files = @($manifest.files)
    foreach ($rel in $files) {
        $source = Join-Path $stage $rel
        if (!(Test-Path -LiteralPath $source)) { continue }
        $target = Join-Path $root $rel
        if (Test-Path -LiteralPath $target) {
            [void](Copy-RelativeFile -Root $root -RelativePath $rel -TargetRoot $preBackup)
        }
        $targetDir = Split-Path -Parent $target
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
    Remove-Item -LiteralPath $stage -Recurse -Force

    Write-Host "OK Restored storyboard workflow package:"
    Write-Host $package
    Write-Host "Restored files: $($files.Count)"
    Write-Host "Previous files backup:"
    Write-Host $preBackup
}

if ($Mode -eq "Export") {
    Export-StoryboardWorkflow
} else {
    Restore-StoryboardWorkflow
}
