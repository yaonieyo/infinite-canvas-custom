#!/bin/bash
# 修复权限并启动服务
# 双击运行即可

cd "$(dirname "$0")"

echo "============================================"
echo "   ComfyUI-API-Modelscope"
echo "============================================"
echo ""
echo "修复权限中..."

# 移除安全限制（只针对实际存在的文件类型）
xattr -r -d com.apple.quarantine *.command 2>/dev/null
xattr -r -d com.apple.quarantine main.py 2>/dev/null

# 设置执行权限（修正：原脚本引用了不存在的 启动服务.command/启动服务.py）
chmod +x *.command 2>/dev/null
chmod +x main.py 2>/dev/null

echo "权限已修复！"
echo ""

# 将 macOS 系统代理传给 Python/Node/Rust CLI。
# gpt-image-2-skill 不一定会自动读取系统代理；不导出这些变量时会直连 OpenAI 并超时。
HTTP_PROXY_HOST=$(scutil --proxy 2>/dev/null | awk -F': ' '/HTTPProxy[[:space:]]*:/{print $2; exit}')
HTTP_PROXY_PORT=$(scutil --proxy 2>/dev/null | awk -F': ' '/HTTPPort[[:space:]]*:/{print $2; exit}')
HTTPS_PROXY_HOST=$(scutil --proxy 2>/dev/null | awk -F': ' '/HTTPSProxy[[:space:]]*:/{print $2; exit}')
HTTPS_PROXY_PORT=$(scutil --proxy 2>/dev/null | awk -F': ' '/HTTPSPort[[:space:]]*:/{print $2; exit}')
SOCKS_PROXY_HOST=$(scutil --proxy 2>/dev/null | awk -F': ' '/SOCKSProxy[[:space:]]*:/{print $2; exit}')
SOCKS_PROXY_PORT=$(scutil --proxy 2>/dev/null | awk -F': ' '/SOCKSPort[[:space:]]*:/{print $2; exit}')

if [ -n "$HTTPS_PROXY_HOST" ] && [ -n "$HTTPS_PROXY_PORT" ]; then
    export HTTPS_PROXY="http://${HTTPS_PROXY_HOST}:${HTTPS_PROXY_PORT}"
    export https_proxy="$HTTPS_PROXY"
fi
if [ -n "$HTTP_PROXY_HOST" ] && [ -n "$HTTP_PROXY_PORT" ]; then
    export HTTP_PROXY="http://${HTTP_PROXY_HOST}:${HTTP_PROXY_PORT}"
    export http_proxy="$HTTP_PROXY"
fi
if [ -z "$HTTPS_PROXY" ] && [ -z "$HTTP_PROXY" ] && [ -n "$SOCKS_PROXY_HOST" ] && [ -n "$SOCKS_PROXY_PORT" ]; then
    export ALL_PROXY="socks5://${SOCKS_PROXY_HOST}:${SOCKS_PROXY_PORT}"
    export all_proxy="$ALL_PROXY"
fi
if [ -n "$HTTPS_PROXY" ] || [ -n "$HTTP_PROXY" ] || [ -n "$ALL_PROXY" ]; then
    export NO_PROXY="127.0.0.1,localhost,::1"
    export no_proxy="$NO_PROXY"
    echo "已加载系统代理：${HTTPS_PROXY:-${HTTP_PROXY:-$ALL_PROXY}}"
    echo ""
fi

# 清理占用 3000 端口的旧进程，避免 address already in use
OLD_PID=$(lsof -ti :3000 2>/dev/null)
if [ -n "$OLD_PID" ]; then
    echo "检测到 3000 端口被占用，正在停止旧进程 (PID: $OLD_PID)..."
    kill $OLD_PID 2>/dev/null
    sleep 1
    # 仍未退出则强制结束
    if lsof -ti :3000 >/dev/null 2>&1; then
        kill -9 $(lsof -ti :3000) 2>/dev/null
    fi
    echo "旧进程已停止。"
    echo ""
fi

echo "正在启动服务..."
echo "本机访问： http://127.0.0.1:3000/"
echo "============================================"
echo ""

# 等后端起来后自动打开浏览器；服务仍在当前窗口里运行，关掉窗口就会停止服务。
(sleep 2; open "http://127.0.0.1:3000/" >/dev/null 2>&1) &

# 优先使用 Homebrew Python，避免部分工具管理的 Python 签名问题
if [ -x /opt/homebrew/bin/python3 ]; then
    /opt/homebrew/bin/python3 main.py
elif [ -x /usr/local/bin/python3 ]; then
    /usr/local/bin/python3 main.py
elif command -v python3 >/dev/null 2>&1; then
    python3 main.py
else
    echo "错误：找不到 Python3，请先安装 Python 3.10+："
    echo "https://www.python.org/downloads/"
    read -p "按 Enter 键退出..."
    exit 1
fi
