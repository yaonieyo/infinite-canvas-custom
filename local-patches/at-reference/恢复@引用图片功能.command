#!/bin/bash
set -e
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  python3 restore_at_reference_patch.py
else
  echo "找不到 python3，无法运行恢复脚本。"
  echo "请先安装 Python 3，或者用项目启动脚本里的 Python 环境运行："
  echo "python3 local-patches/at-reference/restore_at_reference_patch.py"
  read -r -p "按回车退出..."
  exit 1
fi

read -r -p "按回车退出..."
