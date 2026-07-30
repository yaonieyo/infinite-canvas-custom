# 无限画布分镜工作流安装说明

这套备份会生成两个压缩包：

- `infinite_canvas_storyboard_features_时间戳.zip`：轻量功能安装包，不包含个人画布、素材和 API 配置，适合迁移到另一台同版本无限画布。
- `infinite_canvas_storyboard_private_backup_时间戳.zip`：私人完整备份，包含正式画布、该画布引用的本地素材、资产库、提示词库和 API 提供商配置。不要发给别人。

## 包含的功能

- 剧本拆镜到镜头故事板卡
- 故事板图 / 视频提示词生成入口
- 镜头资产收集器
- 多资产绑定：同一个人物可绑定特写、四视图、服装、表情等多张参考图
- 无资产标记：某个角色、场景或道具不想给参考图时可明确设为无资产
- 生成前检查：缺资产、连续性风险会在生成前提示
- 上一镜结束帧继承
- 故事板滚轮浏览与节点排版优化
- 人物/场景两级资产选择器与多收集器状态隔离
- AI 提示词优化、横版故事板约束和视频提示词联动
- APIMART 等视频接口所需的前后端代码

## 推荐安装方式

1. 在另一台电脑先准备好原版无限画布项目。
2. 解压本压缩包。
3. 双击解压目录中的 `tools/install_storyboard_features.bat`，输入目标项目根目录。

也可以使用 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install_storyboard_features.ps1 -TargetRoot "D:\你的无限画布项目目录"
```

## 如果要连示例画布一起导入

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install_storyboard_features.ps1 -TargetRoot "D:\你的无限画布项目目录" -IncludeDemoCanvas
```

## 如果要连 API 配置一起导入

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install_storyboard_features.ps1 -TargetRoot "D:\你的无限画布项目目录" -IncludeApiConfig
```

注意：API 配置可能包含你自己的接口信息。只在你自己的电脑之间迁移，不要把带 API 配置的包发给别人。

## 一次恢复私人完整备份

解压 `infinite_canvas_storyboard_private_backup_时间戳.zip` 后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install_storyboard_features.ps1 -TargetRoot "D:\你的无限画布项目目录" -InstallPrivateBackup
```

安装器会先校验压缩包内文件的 SHA-256，校验失败时不会覆盖目标项目。

## 安装后

重启无限画布服务，并刷新浏览器页面。

如果安装后想回退，安装脚本会把被覆盖的旧文件保存到目标项目的：

```text
backup/pre_storyboard_feature_install_时间戳
```
