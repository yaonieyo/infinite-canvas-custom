# Git 使用说明

这个项目使用 Git 保存程序代码的修改历史。Git 不会保存 API 密钥、画布运行数据、人物与场景资产、生成图片、视频和历史备份。

## 当前保护方式

- 完整离线备份：保存整个项目，包括本地数据和资产。
- Git 版本记录：保存代码、页面、提示词模板和安装工具，便于比较与回退。
- GitHub 私有仓库：连接后用于异地保存 Git 代码，默认不向外公开。

## 常用命令

查看有哪些文件发生变化：

```powershell
git status
```

保存一次代码版本：

```powershell
git add -A
git commit -m "说明这次修改了什么"
```

上传到已经连接的 GitHub 私有仓库：

```powershell
git push
```

查看最近的版本：

```powershell
git log --oneline -10
```

不要删除 `.git` 文件夹，它保存着本地版本历史。不要把 `API/.env`、`data`、`assets` 手工强制加入 Git。
