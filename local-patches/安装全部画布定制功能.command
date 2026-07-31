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

echo "============================================"
echo "   安装全部画布定制功能"
echo "============================================"
echo ""
echo "会安装/恢复以下功能："
echo "- 批量画框"
echo "- 产品海报画框"
echo "- AI 拆分提示词卡"
echo "- 画框接口/模型/画幅/清晰度控制"
echo "- 参考图继承和显示"
echo "- 智能图片/提示词卡/画框里的 @参考图"
echo "- 豆包账号池视频接口"
echo ""
echo "安装前会自动备份当前项目文件。"
echo ""

if command -v python3 >/dev/null 2>&1; then
  python3 "$PATCH_SCRIPT" --force
else
  echo "找不到 python3，无法运行安装脚本。"
  read -r -p "按回车退出..."
  exit 1
fi

read -r -p "按回车退出..."
