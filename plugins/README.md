# 无限画布插件目录

每个插件使用一个独立目录，并在目录根部放置 `manifest.json`。插件入口通过宿主 API 加载，当前宿主版本为 `1.0`。

插件包只允许包含前端资源。后端接口仍由主服务注册，等接口契约稳定后再增加后端插件适配器，避免上传插件直接执行任意 Python 代码。

当前功能已经按边界拆成四个内置插件：`storyboard-suite`、`poster-frame`、`reference-mention`、`doubao-video`。`storyboard-suite` 仍是故事板扩展的兼容桥，另外三个插件已经通过 `registerNodeType`、`registerPromptEditorExtension`、`registerGenerationProvider` 接入宿主；原有大文件保留为渲染和数据兼容层，避免旧画布失效。

插件入口可使用的宿主接口包括：

- `registerNodeType` / `invokeNodeType`：注册节点类型和创建入口。
- `registerPromptEditorExtension`：为指定节点绑定提示词编辑器扩展。
- `registerGenerationProvider`：注册接口、模型和生成参数能力。
- `registerCapability`：向插件管理器和其他扩展声明功能边界。
- `getCoreApi`：调用画布核心提供的兼容适配器，不直接修改核心全局变量。

启动服务后打开 `/static/canvas-plugins.html` 管理插件。Mac 也可以运行 `tools/打开画布插件管理.command`，Windows 可以运行 `tools/open_canvas_plugin_manager.bat`。

需要迁移插件时，在项目根目录运行 `python3 tools/package_canvas_plugins.py`。脚本会在 `dist/canvas-plugins/` 生成四个独立 ZIP；在另一台电脑打开插件管理器，使用“导入插件 ZIP”即可安装。脚本也可以只打包某一个插件，例如 `python3 tools/package_canvas_plugins.py poster-frame`。
