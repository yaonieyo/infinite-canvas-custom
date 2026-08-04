# 无限画布插件目录

每个插件使用一个独立目录，并在目录根部放置 `manifest.json`。插件入口通过宿主 API 加载，当前宿主版本为 `1.0`。

插件包只允许包含前端资源。后端接口仍由主服务注册，等接口契约稳定后再增加后端插件适配器，避免上传插件直接执行任意 Python 代码。

当前 `storyboard-suite` 是兼容桥接版：它已经可以单独启停和重装，但内部仍调用现有故事板扩展文件。后续会按 `registerNodeType`、`registerPromptEditorExtension`、`registerGenerationProvider` 等宿主接口逐步拆出功能。

启动服务后打开 `/static/canvas-plugins.html` 管理插件。Mac 也可以运行 `tools/打开画布插件管理.command`，Windows 可以运行 `tools/open_canvas_plugin_manager.bat`。
