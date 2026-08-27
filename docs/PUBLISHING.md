# Blue Note 标准化发文流程

本文是新增、转换、检查和发布 Blue Note 文章的操作标准。文章 Markdown 是唯一事实来源；生成后的 HTML 不是编辑对象。

## 1. 可接受的原稿

以下形式都可以作为输入：

- 已写好的 Markdown；
- Word（`.docx`）、Google Docs 导出文件或富文本；
- 纯文本、聊天记录或分段笔记；
- 正文加一组本地图片；
- 图集及图片说明。

非 Markdown 原稿在入库前统一转换为 UTF-8 Markdown。转换时保留标题层级、段落、引用、代码块、链接、图片顺序和强调语义，同时去掉仅服务于原编辑器的样式。

## 2. 文件与元数据标准

文章存放在：

```text
source/_posts/<可读文件名>.md
```

标准 Front Matter：

```yaml
---
title: 文章标题
date: 2026-08-27 14:30:00
updated: 2026-08-27 14:30:00
tags:
  - 标签
description: 用于首页和搜索结果的一至两句话摘要。
banner_img: /images/theme_fluid_bg/文章头图.jpg
index_img:
---
```

字段规则：

- `title`、`date` 和 `description` 必填。
- `date` 使用 `YYYY-MM-DD HH:mm:ss`，站点时区固定为 `America/New_York`。
- 修改正文后同步更新 `updated`；修正错别字可酌情不改。
- `tags` 使用简短、稳定的主题词。标签页自动生成，导航栏不单独展示标签入口。
- 只有标题与期望 URL 不一致时才添加 `slug`；已发布文章不得随意修改 `date` 或 `slug`，否则旧链接会失效。
- `banner_img` 可省略并使用站点默认头图。
- `index_img` 留空时首页使用纯文字卡片，这是 Blue Note 当前的默认设计。

## 3. 图片标准

新增本地图片建议存放在：

```text
source/images/posts/<年份>/<文章短名>/
```

Markdown 中使用以站点根目录为基准的路径：

```markdown
![准确、简短的替代文字](/images/posts/2026/example/photo.jpg)
```

发布前确认：

- 文件名可读且稳定，不使用临时截图名称；
- 图片方向正确，无无意中包含的定位或隐私信息；
- 照片按实际展示尺寸合理压缩；
- 每张有意义的图片都有替代文字；
- 外链图片必须是长期稳定的 HTTPS 地址。现有历史图集的外链为保持原文而保留，新文章优先使用仓库内图片。

## 4. 创建和编辑

安装依赖后创建文章：

```bash
npm ci
npm run new -- "文章标题"
```

补齐 Front Matter 和正文，再启动预览：

```bash
npm run server
```

浏览 <http://localhost:4000/bluenote/>，至少检查：首页卡片、文章页、移动端窄屏、所有图片、代码块和链接。

## 5. 发布前质量门槛

运行：

```bash
npm run check
```

该命令会清理旧产物、完整生成站点，并验证：

- 主页、404、About、Links、归档和搜索索引存在；
- 所有预期文章成功生成；
- 首页能找到文章标题并载入自定义样式；
- HTML 中指向 `/bluenote/` 的本地资源均存在。

命令失败时不得发布。先修复首个明确错误，再重新运行完整检查。

## 6. 提交和自动发布

检查改动：

```bash
git status --short
git diff --check
```

提交并推送：

```bash
git add source scaffolds tooling docs _config.yml _config.fluid.yml package.json package-lock.json .github README.md
git commit -m "Publish <文章标题>"
git push origin master
```

推送 `master` 后 GitHub Actions 自动执行 `npm ci`、构建、验证和 Pages 部署。无需运行 `hexo deploy`，也不要提交 `public/`。

发布完成后验证：

1. GitHub Actions 的 `Build and deploy Blue Note` 工作流成功；
2. <https://cheology.github.io/bluenote/> 首页出现新文章；
3. 新文章 URL 返回正常页面，图片和样式均加载；
4. 归档、对应标签和站内搜索能够找到新文章。

## 7. 自动转换和代发布

若由自动化助手完成发布，标准任务边界是：

1. 读取原稿及图片，不改写作者事实和表达意图；
2. 转换为规范 Markdown 并补齐必要元数据；
3. 将图片整理到标准目录并修正引用；
4. 本地构建、资源检查和浏览器视觉检查；
5. 展示或说明实质性编辑；
6. 提交、推送，等待工作流完成；
7. 验证线上 URL 后交付结果。

用户只需提供原稿、期望标题，以及必要时提供标签或发布时间。其余格式转换、文件组织、生成和发布步骤可以自动完成。

## 8. 修订与回滚

修订已发布文章时直接编辑对应 Markdown，更新 `updated`，重新执行完整流程。

若新版本发布异常，优先通过一个新的 Git 提交恢复上一个正确版本，不改写远端历史：

```bash
git revert <problem-commit>
git push origin master
```

回滚推送同样会触发自动构建和部署。不要删除 Git 历史，也不要手动替换 GitHub Pages 上的文件。
