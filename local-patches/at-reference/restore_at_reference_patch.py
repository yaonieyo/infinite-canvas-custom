#!/usr/bin/env python3
import hashlib
import shutil
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PATCH_DIR = Path(__file__).resolve().parent
SNAPSHOT_DIR = PATCH_DIR / "snapshot"
PROJECT_MARKER = Path("static/smart-canvas.html")

FILES = [
    Path("main.py"),
    Path("static/index.html"),
    Path("static/api-settings.html"),
    Path("static/js/canvas.js"),
    Path("static/js/smart-canvas.js"),
    Path("static/js/smart-canvas-storyboard-extension.js"),
    Path("static/js/api-settings.js"),
    Path("static/css/smart-canvas.css"),
    Path("static/smart-canvas.html"),
    Path("static/vendor/js/lucide.js"),
    Path("static/js/theme.js"),
    Path("static/js/touch-mouse.js"),
    Path("static/js/i18n.js"),
    Path("static/js/i18n/smart-canvas.js"),
    Path("static/vendor/css/fonts.css"),
    Path("static/images/logo.png"),
    Path("mac-启动服务.command"),
]

FEATURE_MARKERS = {
    "main.py": [
        "doubao-pool",
        "generate_doubao_pool_video",
        "is_doubao_pool_provider",
    ],
    "static/api-settings.html": [
        'value="doubao-pool"',
    ],
    "static/js/api-settings.js": [
        "DOUBAO_POOL_DEFAULT_BASE_URL",
        "doubao-pool",
        "doubao-video",
    ],
    "static/smart-canvas.html": [
        'data-create-type="poster-frame"',
        "mentionPicker",
        "mentionPreview",
    ],
    "static/js/smart-canvas.js": [
        "function createPosterFrameNode",
        "function createPosterFrameBatchNode",
        "function buildPosterFrameItemsWithAI",
        "function bindPosterFrameMentionInput",
        "function renderMentionPicker",
        "doubao-pool",
    ],
    "static/js/smart-canvas-storyboard-extension.js": [
        "function createSmartStoryboardOutputs",
        "function bindScriptStoryboardControls",
    ],
    "static/js/canvas.js": [
        "function normalizeVideoDurationForProvider",
        "function renderVideoBody",
        "doubao-pool",
    ],
    "static/css/smart-canvas.css": [
        ".poster-frame-card",
        ".poster-frame-batch-card",
        ".mention-image-token",
        ".mention-picker",
    ],
    "static/js/i18n/smart-canvas.js": [
        "smart.mentionInput",
        "smart.promptPlaceholderNode",
    ],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def status() -> tuple[bool, list[str]]:
    messages = []
    all_installed = True
    for rel in FILES:
        target = ROOT / rel
        snap = SNAPSHOT_DIR / rel
        key = rel.as_posix()
        if not target.exists():
            all_installed = False
            messages.append(f"MISSING target: {key}")
            continue
        if not snap.exists():
            all_installed = False
            messages.append(f"MISSING snapshot: {key}")
            continue
        if sha256(target) == sha256(snap):
            messages.append(f"OK installed: {key}")
        else:
            all_installed = False
            messages.append(f"DIFFERENT from patch snapshot: {key}")
    return all_installed, messages


def diagnose() -> tuple[bool, list[str]]:
    messages = []
    ok = True
    if not (ROOT / PROJECT_MARKER).exists():
        return False, [
            "FAIL: 没有找到 static/smart-canvas.html。",
            "请确认 local-patches 文件夹放在大雄无限画布项目根目录下。",
        ]
    for rel, markers in FEATURE_MARKERS.items():
        path = ROOT / rel
        if not path.exists():
            ok = False
            messages.append(f"FAIL: 缺少文件 {rel}")
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        missing = [marker for marker in markers if marker not in text]
        if missing:
            ok = False
            messages.append(f"FAIL: {rel} 缺少功能标记：{', '.join(missing)}")
        else:
            messages.append(f"OK: {rel} 功能标记存在")
    return ok, messages


def backup_current() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = ROOT / "local-patches" / "at-reference" / "backups" / stamp
    for rel in FILES:
        target = ROOT / rel
        if target.exists():
            copy_file(target, backup_dir / rel)
    return backup_dir


def restore(force: bool = False) -> int:
    if not (ROOT / PROJECT_MARKER).exists():
        print("没有找到大雄无限画布项目根目录。")
        print("请把整个 local-patches 文件夹放到项目根目录下，再运行：")
        print("local-patches/安装全部画布定制功能.command")
        return 1
    installed, messages = status()
    print("\n".join(messages))
    if installed:
        print("\n画布定制功能补丁已经是当前版本，不需要恢复。")
        return 0

    backup_dir = backup_current()
    print(f"\n已备份当前文件到：{backup_dir}")

    if not force:
        print("\n检测到当前项目文件和补丁快照不同。")
        print("如果这是刚更新后的原项目，可以输入 y 恢复画布定制功能。")
        print(f"注意：恢复会把这 {len(FILES)} 个文件替换成补丁包保存的版本；新版本里同文件的新改动可能需要之后再适配。")
        answer = input("是否恢复？输入 y 回车继续，其他键取消：").strip().lower()
        if answer != "y":
            print("已取消，没有覆盖任何文件。")
            return 2

    for rel in FILES:
        copy_file(SNAPSHOT_DIR / rel, ROOT / rel)
        print(f"已恢复：{rel.as_posix()}")
    print("\n安装后检查：")
    ok, messages = diagnose()
    print("\n".join(messages))
    if not ok:
        print("\n安装检查未通过。请把上面的 FAIL 内容截图发给 Codex。")
        return 1
    print("\n恢复完成。请重新启动服务或在浏览器里 Cmd+Shift+R 强制刷新。")
    return 0


def main() -> int:
    args = set(sys.argv[1:])
    if "--status" in args:
        _, messages = status()
        print("\n".join(messages))
        return 0
    if "--diagnose" in args or "--check" in args:
        ok, messages = diagnose()
        print("\n".join(messages))
        return 0 if ok else 1
    return restore(force="--force" in args)


if __name__ == "__main__":
    raise SystemExit(main())
