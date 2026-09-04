# Blue Note 标准化发文流程

本文是新增、转换、检查和发布 Blue Note 文章的操作标准。文章 Markdown 是唯一事实来源；生成后的 HTML 不是编辑对象。

所有颜色、字体、字号、行距、行宽、方框、分隔线、图片和响应式处理统一遵循 [`docs/DESIGN.md`](./DESIGN.md)。视觉规范变化时必须同步更新设计文档与 CSS，不得只为单篇文章临时另造一套样式。

## 0. 核心原则：文字归作者

原稿是正文措辞、顺序、分段、括号、重复和修辞结构的唯一权威。除明确错字和机械排版（中英文间距、标点规范、忠实的公式展示）外，不得在未经作者确认的情况下改写、删减、扩写或以事实核查为由直接改正文。

视觉设计必须通过 CSS 和克制的排版实现，不得通过重组文字制造层级。尤其不得擅自把“关于……。”一类正文句子升格为标题，不得把行内枚举拆成列表，不得抽取独立引语，也不得自行添加目录、摘要、图注、参考资料或延伸阅读。标题沿用原稿或文件名；如果事实表述可能有疑问，先向作者说明，再决定是否修改。

常规内容框统一使用 `literary-panel`，以《Z.A.T.O. 随想》首个内容框为视觉标准。文章专属样式只能安排框内内容，不得另行覆盖框的宽度、边线、底色和内边距；诗歌等确有不同语义的特殊结构可以保留例外。

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
index_img:
---
```

字段规则：

- `title`、`date` 和 `description` 必填。
- `date` 使用 `YYYY-MM-DD HH:mm:ss`，站点时区固定为 `America/New_York`。
- 修改正文后同步更新 `updated`；修正错别字可酌情不改。
- `tags` 使用简短、稳定的主题词。标签页自动生成，导航栏不单独展示标签入口。
- 只有标题与期望 URL 不一致时才添加 `slug`；已发布文章不得随意修改 `date` 或 `slug`，否则旧链接会失效。
- 内容页统一使用无图编辑式页眉，不设置 `banner_img`；首页继续保留站点视觉封面。
- `index_img` 留空时首页使用纯文字卡片，这是 Blue Note 当前的默认设计。

## 3. 图片标准

普通文章图片存放在：

```text
source/images/posts/<年份>/<文章短名>/
```

图集图片存放在：

```text
source/images/galleries/<年份>/<图集短名>/
```

Markdown 中使用以站点根目录为基准的路径：

```markdown
![准确、简短的替代文字](/images/posts/2026/example/photo.jpg)
```

摄影图集先从作者保留的原始图片生成三档网页文件：

```bash
npm run gallery:prepare -- --input "/本机/原图目录" --year 2026 --slug gallery-name
```

命令保留一份与交付图相同像素尺寸、比例和完整画面的高清主文件，并生成长边 `800px`、`1600px` 与 `2880px` 的 sRGB 渐进式预览 JPEG。所有发布文件删除 EXIF 元数据，但高清主文件不进行有损缩小。Markdown 只引用不带尺寸后缀的高清主文件；构建时自动加入响应式 `srcset`、固有宽高、首图优先加载和其余图片原生懒加载。图集文章不需要额外的 Front Matter 字段。

更新已经存在的图集时，在确认原图目录与目标图集无误后添加 `--force`；工具会先完整生成新文件，再替换旧目录：

```bash
npm run gallery:prepare -- --input "/本机/原图目录" --year 2026 --slug gallery-name --force
```

发布前确认：

- 文件名可读且稳定，不使用临时截图名称；
- 图片方向正确，无无意中包含的定位或隐私信息；
- 高清主文件与作者交付图的像素尺寸、宽高比和画面边界完全一致，没有裁切或拉伸；
- 每张有意义的图片都有替代文字；
- 线上正文不得直接热链第三方图床；外部地址只作为原图传递或正文链接使用。

## 4. 创建和编辑

### 独立 Gallery 的照片录入

Gallery 与博客文章分开管理，唯一清单是 `source/_data/gallery.json`。`/gallery/` 默认进入 A few，每次随机展示 3–5 张；`/gallery/all/` 的 All photographs 保留全部约 50 张的编排。不要为每张照片新建文章，也不要自动导入《秋之纽约_2023.11》的照片。

收到作者照片后，先确认原始像素尺寸、方向、画面边界、色彩及展示顺序，再准备预览。没有作者图注时省略 caption；alt 只提供准确的无障碍描述，不显示成图注。清单数组顺序就是完整模式的观看顺序；随机模式以既有展幅为单位抽取，不能拆开双联。Reshuffle 只重排当前小展览，图库充足时避开上一轮照片，不改动原清单。

单项结构如下（仅为字段示例，不是待发布照片）：

~~~json
{
  "version": 1,
  "photos": [
    {
      "id": "photo-001",
      "alt": "作者确认的照片描述",
      "full": { "src": "/images/galleries/2026/selected/photo-001.jpg", "width": 6000, "height": 4000 },
      "previews": [
        { "src": "/images/galleries/2026/selected/photo-001-800.jpg", "width": 800, "height": 533 },
        { "src": "/images/galleries/2026/selected/photo-001-1600.jpg", "width": 1600, "height": 1067 },
        { "src": "/images/galleries/2026/selected/photo-001-2880.jpg", "width": 2880, "height": 1920 }
      ]
    }
  ]
}
~~~

像素尺寸必须读取实际文件，不使用示例数字。主文件保持原分辨率，预览保持完整构图；Gallery 首页的 srcset 不包含主文件。随机模式只创建本轮照片的图片节点，不把 50 张照片全部插入后隐藏；无脚本时保留少量照片及完整模式链接。构建会校验清单、路径、预览比例和重复 ID；`npm run check` 同时检查空页、混合比例排列、抽取数量与完整双联、重抽后的大图导航、焦点和失败降级。照片未到时保留空数组，不提交测试照片。

2026-09 选集：作者交付的 Gallery 文件夹中 Red 32 张、Orange 18 张，共 50 张；Yellow-only 和无标签文件未收录。`tooling/gallery-selection.json` 记录文件名、无障碍描述和受托编排，`spread` 定义单幅／双联，`sequence` 定义连续段落；公开清单不包含 Finder 标签、当地路径或 EXIF。39 个展幅包含 11 个双联；雪夜为连续段落，玻璃前女孩的两张、同一草地的两种作者裁幅分别相邻，其他双联是视觉并置，不宣称来自同一拍摄事件。

此批使用 `tooling/import-selected-gallery.cjs` 导入，不使用普通博客图集的旧导入流程。命令接受一个绝对源目录；本机需 Sharp 和 jpegtran，可分别通过 `GALLERY_SHARP`（模块路径）、`GALLERY_JPEGTRAN`（程序路径）指定。导入器拒绝覆盖既有输出目录；它核对选择标签、方向与 sRGB，然后生成独立发布副本。原文件不写入、不改标签。

高清文件通过 jpegtran 无损重排 JPEG 系数并恢复原 ICC；逐张比较解码像素 SHA-256、实际宽高和 ICC 字节完全一致。只对长边 800/1600/2880px 的预览进行缩放与质量 92、4:4:4 渐进式 JPEG 编码。200 个发布文件均不包含 EXIF、IPTC 或注释，保留 ICC；源相机序列号、时间和定位不会上传。导入器输出清单后，用 `apply_patch` 更新 `source/_data/gallery.json`，再运行 `npm run check`。

本批高清副本 237,274,156 bytes，预览 117,616,035 bytes，总计 354,890,191 bytes（约 338 MiB）；这是存储量，不是一次打开页面的传输量。页面按需选预览、延迟加载，点击某张才请求该张高清文件；等待时保留预览，失败也不清空已显示的画面。

### 普通博客文章

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

- 主页、404、About、归档和搜索索引存在，已停用的 Links 页面不会生成；
- 所有预期文章成功生成；
- 首页能找到文章标题并载入主题与站点样式；
- 任何页面都不请求第三方 CSS、JavaScript 或字体，也不再引用旧主题依赖；
- HTML 中指向 `/bluenote/` 的本地资源均存在。

命令失败时不得发布。先修复首个明确错误，再重新运行完整检查。

涉及版式或主题的修改，另运行视觉对比：

```bash
npm run visual:capture && npm run visual:compare
```

对比结果写入 `tooling/visual/report.md`，差异图在 `tooling/visual/diff/`。基线由 `npm run visual:baseline` 从上一个已验收的构建生成（截图不入库）；有意的差异记录在 `tooling/visual/allowed-differences.json`。

## 6. 提交和自动发布

检查改动：

```bash
git status --short
git diff --check
```

提交并推送：

```bash
git add source scaffolds tooling docs themes _config.yml _config.bluenote.yml package.json package-lock.json .github README.md AGENTS.md
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

## 9. 私密文章

私密文章仍使用一个仓库和 GitHub Pages，不依赖数据库。公开仓库中只保存 AES-256-GCM 加密后的文章档案；可读的 Markdown 临时保存在本机 `.private-posts/`，该目录不会被 Git 提交。

将一篇公开文章转为私密文章：

```bash
npm run private:hide -- "文章文件名.md"
```

首次使用时输入并再次确认至少 16 个字符的私人密码。密码不会显示在终端、写入仓库或保存到生成网页。命令会把正文移入本机 `.private-posts/`，在原文章位置生成只含公开元数据和锁定界面的占位文件，并更新 `source/private/posts.enc.json` 与公开标题清单。

阅读不需要终端，也没有单独的 `/private/` 页面或统一的 `Private` 导航入口。未解锁时，私密文章在首页完全隐藏，不占卡片位置，也不会出现在搜索结果中；只有归档保留标题和锁标。解锁后，私密文章会恢复出现在首页和搜索中，归档中的标记也会切换为已解锁状态。点击归档中的标题会进入原来的文章网址，在文章内输入密码即可解锁。

输入密码后，浏览器使用 Web Crypto 在本地解密正文。解锁成功后仅把派生出的解密密钥保存在当前浏览器的站点存储中，不保存明文密码；刷新、打开其他文章或重新启动浏览器后仍可继续阅读。需要退出时，在归档中点击 `UNLOCKED`，确认后即删除网站保存的解密密钥并恢复锁定；这不会删除 Chrome 或其他密码管理器保存的密码。标题、日期和“这是私密文章”的状态是公开的，正文仍只存在于 AES-256-GCM 加密档案中。

编辑本机 `.private-posts/` 中的文章后，重新加密：

```bash
npm run private:sync
```

将私密文章重新公开：

```bash
npm run private:publish -- "文章文件名.md"
```

在新电脑或重新克隆仓库后，先用密码恢复本机可编辑源文件：

```bash
npm run private:restore
```

安全边界：

- 使用唯一、足够长的密码；静态加密文件可以被下载后离线猜测，弱密码不安全。
- 不要遗忘密码。站点和 GitHub 都没有密码重置能力；忘记后只能从仍保留明文的本机或备份恢复。
- 已经在公开 Git 历史中出现过的旧文章，转为私密后正文会从当前网站消失，但旧提交仍可能包含原文。新建的私密文章应直接放入 `.private-posts/` 后执行 `private:sync`，不要先提交正文到 `source/_posts/`。
- 私密文章使用的敏感图片也不能放在公开的 `source/images/` 中；当前加密档案只保护文章文本及内嵌 HTML，不会自动加密单独的图片文件。
