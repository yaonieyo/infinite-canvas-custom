# 画布定制功能本地补丁包

这个补丁包用于保护当前定制功能，避免项目更新后功能永久丢失。

它保存的是当前已验证可用的画布定制文件快照，不只是 `@引用图片`。

目前包含这些功能：

- 批量画框入口和画框节点
- AI 拆分产品海报提示词卡
- 画框节点的模型、接口、画幅、清晰度控制
- 画框参考图继承和显示
- 智能图片输入框 `@参考图`
- 提示词卡 `@参考图`
- 画框提示词框 `@参考图`
- `@图片` 的资源绑定和删除解绑
- 豆包账号池视频接口
- 画布视频节点发送提示词和参考图到豆包账号池服务
- 仅豆包视频接口固定使用 5 秒或 10 秒
- 豆包视频结果轮询并回填到画布
- 相关样式和页面入口

它保存了这些代码/静态文件快照：

- `main.py`
- `static/index.html`
- `static/api-settings.html`
- `static/js/canvas.js`
- `static/js/smart-canvas.js`
- `static/js/smart-canvas-storyboard-extension.js`
- `static/js/api-settings.js`
- `static/css/smart-canvas.css`
- `static/smart-canvas.html`
- `static/vendor/js/lucide.js`
- `static/js/theme.js`
- `static/js/touch-mouse.js`
- `static/js/i18n.js`
- `static/js/i18n/smart-canvas.js`
- `static/vendor/css/fonts.css`
- `static/images/logo.png`
- `mac-启动服务.command`

## 怎么用

给别人安装时：

1. 把整个 `local-patches` 文件夹复制到“大雄无限画布”项目根目录
2. Mac 双击 `local-patches/安装全部画布定制功能.command`
3. Windows 双击 `local-patches/install_all_canvas_custom_features.bat`
4. 安装完成后重启服务，浏览器里强制刷新

项目更新后，如果批量画框、提示词卡、画框里的 `@参考图` 等定制功能消失：

1. Mac 双击运行 `local-patches/安装全部画布定制功能.command`；Windows 双击运行 `local-patches/install_all_canvas_custom_features.bat`
2. 脚本会先备份当前项目里的文件
3. 然后恢复全部定制功能
4. 浏览器里强制刷新

如果只想检查补丁是否完整，先运行：

```bash
python3 local-patches/at-reference/restore_at_reference_patch.py --diagnose
```

Windows 也可以双击：

```text
local-patches/check_canvas_custom_features.bat
```

## 重要说明

这不是官方插件，因为当前项目没有稳定插件接口。

它是“可恢复补丁包”：

- 好处：更新后功能不会永久丢失，可以一键恢复。
- 风险：如果原项目新版本也改了同样这些文件，恢复补丁可能覆盖新版本里这些文件的新改动。
- 安全措施：脚本恢复前一定会先备份当前文件，备份在 `local-patches/at-reference/backups/`。

如果恢复后发现新版本功能少了，保留备份目录，让 Codex 对比适配。

## 命令行

查看状态：

```bash
python3 local-patches/at-reference/restore_at_reference_patch.py --status
```

强制恢复：

```bash
python3 local-patches/at-reference/restore_at_reference_patch.py --force
```
