# 更新日志

这里记录每个版本实际新增的功能、修复的问题和重要调整。

## 2026.08.02

### 新增

- 剧本到故事板工作流：支持纯剧本拆镜、详细分镜输入和故事板节点。
- 导演分镜故事板：支持九宫格、十二宫格、彩色分镜和写实分镜图。
- 故事板资产收集器：按人物、场景、道具分类，支持无资产、手动选择和多镜头收集。
- 资产匹配信心度与升降排序，支持人物别名、备注名和多个候选资产。
- 合并上游画布、模型和素材管理更新，同时保留当前剧本与故事板定制功能。

### 修复

- 修复故事板输出帧不真实、分镜图和视频节点混用的问题。
- 修复故事板输出节点不居中、黑边和生成结果不可见的问题。
- 修复外卖袋、鸡蛋、泡面、迎宾牌等道具被误判为人物或场景的问题。
- 修复生图提示词里同一场景参考图重复的问题：同一场景合并，不同场景保留。

### 提交

- `da96fd2` Fix duplicate scene references in image prompts
- `c97fd59` feat: add asset match confidence and sorting
- `a868841` Improve storyboard asset collector layout
- `7e69a9e` Merge upstream 2026.08.01 features selectively

## 2026.08.01

### 新增与修复

- 合并本地画布定制功能与上游更新。
- 故事板输出改为真实分镜帧，并优化输出节点样式。
- 补充项目介绍、备份说明和版本基线记录。

### 提交

- `58f39c6` fix: create real frames for storyboard image outputs
- `e9f4d88` fix: style storyboard output nodes
- `957e202` docs: add project overview and backup guide
- `1330974` Merge remote-tracking branch origin/main

## 2026.07.31

### 初始定制版本

- 建立当前无限画布可用版本基线。
- 合并本地画布定制功能。
- 刷新并分类故事板资产候选项。

### 提交

- `b2875fa` baseline-2026-07-31
- `39b85f4` feat: merge local canvas custom features
- `9ab9e6f` fix: refresh and classify storyboard asset candidates

