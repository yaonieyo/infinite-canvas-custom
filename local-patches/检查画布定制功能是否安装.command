#!/bin/bash
set -e
cd "$(dirname "$0")"

PATCH_SCRIPT="at-reference/restore_at_reference_patch.py"
if [ ! -f "$PATCH_SCRIPT" ]; then
  echo "找不到补丁脚本：$PATCH_SCRIPT"
  echo "请确认你复制的是完整 local-patches 文件夹。"
  read -r -p "按回车退出..."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 "$PATCH_SCRIPT" --diagnose
else
  echo "找不到 python3，无法运行检查脚本。"
  read -r -p "按回车退出..."
  exit 1
fi

read -r -p "按回车退出..."
