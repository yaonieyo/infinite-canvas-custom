#!/usr/bin/env python3
"""Build standalone frontend plugin ZIP packages for the canvas plugin manager."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGINS_DIR = ROOT / "plugins"
OUTPUT_DIR = ROOT / "dist" / "canvas-plugins"
PLUGIN_IDS = ("storyboard-suite", "poster-frame", "reference-mention", "doubao-video")


def package_plugin(plugin_id: str) -> Path:
    source = PLUGINS_DIR / plugin_id
    manifest_path = source / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"缺少插件清单：{manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("id") != plugin_id:
        raise ValueError(f"插件目录和 manifest.id 不一致：{plugin_id}")
    entry = source / str(manifest.get("entry") or "")
    if not entry.is_file():
        raise FileNotFoundError(f"缺少插件入口：{entry}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    version = str(manifest.get("version") or "0.0.0").replace("/", "-")
    output = OUTPUT_DIR / f"{plugin_id}-{version}.zip"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if not path.is_file() or "__pycache__" in path.parts:
                continue
            archive.write(path, path.relative_to(source).as_posix())
    return output


def main() -> int:
    requested = tuple(sys.argv[1:]) or PLUGIN_IDS
    unknown = [item for item in requested if item not in PLUGIN_IDS]
    if unknown:
        print(f"未知插件：{', '.join(unknown)}", file=sys.stderr)
        return 2
    for plugin_id in requested:
        print(package_plugin(plugin_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
