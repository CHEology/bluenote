# Blue Note × AI Lab：文字目录与文末回应入口

日期：2026-09-05  
状态：按作者最后一次修订执行；本文件取代先前页首切换方案。  
设计权威：Blue Note 的 `docs/DESIGN.md` 与 AI Lab 的 `docs/DESIGN.md`。

## 作者确认的要求

1. AI Lab 总目录采用参考图中的文件夹层级、缩进和连接线，统一为本站蓝灰视觉。
2. 回应页末级 URL 沿用原标题，包含中文、空格和标点，不使用拼音。
3. Blue Note 入口只出现在文章结尾，低调、与正文排版协调；开头不放切换条。
4. 先实现目录、阅读页和往返链接；本轮不创作回应正文。

## 两站结构

AI Lab 首页保留原有大字标，在其下以原生 details/summary 组织“文字 → Blue Note 回应 → 四篇标题”。已有层级默认展开，文件夹可用键盘收起；标题链接进入文章，“目录 ↗”进入独立文字目录。图标为细线文件夹／文档，连接线为 1px，中性灰底和蓝色强调支持明暗模式。

AI Lab 文字目录位于 `/ai-lab/writing/`。内容页使用同一标识的小版本、所在目录、约 634px 的衬线阅读列和正文末尾的原文链接。两站独立构建，不共享主题或浏览器运行脚本。

| 原文标题 | Blue Note 原文路径 | AI Lab 回应路径 |
| --- | --- | --- |
| 布涅星 | `/bluenote/2023/09/26/布涅星/` | `/ai-lab/writing/bluenote/布涅星/` |
| Z.A.T.O. 随想 | `/bluenote/2026/08/27/Z.A.T.O-随想/` | `/ai-lab/writing/bluenote/Z.A.T.O. 随想/` |
| 0902 - 随想 | `/bluenote/2026/09/02/近期随想/` | `/ai-lab/writing/bluenote/0902 - 随想/` |
| 修图 | `/bluenote/2026/09/05/修图/` | `/ai-lab/writing/bluenote/修图/` |

表格使用可读路径；HTML 链接按标准进行 UTF-8 百分号编码，浏览器看到的文名保持原标题。

## Blue Note 文末入口

四篇文章在 `.markdown-body` 之后、上一篇／下一篇之前显示一次 `AI Lab · 回应 ↗`。与正文左对齐，上方留 2.5rem、4rem 短细线，文字 14px、行距 1.6，触控高度至少 44px。沿用 `--link` 和 `--line` 等主题变量，不使用按钮底色、方框、页内 tab 或悬浮工具。

它是普通 HTTPS 链接，在同一标签页进入对应回应。AI Lab 页末 `Blue Note · 原文 ↗` 指回对应原文。没有关联记录的文章和私密文章不显示入口。四篇原文只增加 companion 元数据，正文、段落、日期和已有 URL 保持不变。

## 内容状态

- `pending`：目录标“待写”，正文仅“回应尚未发布。”，可返回原文；不编造署名、模型或发布日期，使用 `noindex, follow`。
- `published`：必须指定非空 Markdown 正文、实际署名和真实有效发布日期，才显示内容与日期并允许索引。页址不变。
- `draft`：不生成目录条目或页面。公开仓库中的已提交源码仍然公开。

未来每篇可以根据内容选择回应、辨析、延伸阅读或共同创作。涉及事实与引文时再核实来源，AI 文本不自动成为作者原文的新版本。

## 实现文件

AI Lab：

- `writing/entries.json`：分组、条目顺序、原标题、原文 URL 和状态。
- `templates/writing.html`：文字目录与阅读页共用页面外壳。
- `scripts/writing.mjs`：标题路径校验、目录与内容生成，Markdown 仅在构建时解析。
- `site/assets/style.css`：整个站点的目录、字标、阅读与明暗配色。
- `scripts/validate.mjs`、`test/writing.test.mjs`：产物路径／资源和内容状态检查。
- `docs/ADDING-WRITING.md`：后续填写回应的方法。

独立主题 `hexo-theme-bluenote` 1.2.0：

- `layout/_partials/post-companion.ejs` 与 `layout/post.ejs`：仅在正文后输出可选关系链接。
- `scripts/companion.js`：读取通用 companion 元数据并验证 HTTPS 目标，自动排除私密文章。
- `assets/css/50-post.css`：文末入口样式。
- `test/companion.test.cjs`：关联内容位置、标签转义、URL 与未配置／私密文章检查。

Blue Note：四篇文章的 Front Matter、主题版本与锁文件，以及设计／发布规范。主题不写死 AI Lab 域名或四篇文章名，安装副本不直接编辑。

## 检查与发布

两站分别运行 `npm run check`；主题运行 `npm test` 与 `npm run test:browser`。Blue Note 使用修改前的已发布构建生成视觉基线，运行 `visual:capture`、`visual:compare` 并登记精确的预期差异。四篇原文及其他文章均校验正文哈希未变。

联动检查覆盖 Chromium 与 WebKit、1280px／390px／320px、明暗模式、目录键盘开合、四组原文→回应→原文、页首无新增导航、正确中文地址、待写元数据及本地资源。再验证无脚本时目录和普通链接仍可操作。

发布顺序为 AI Lab 对应页先上线，之后发布主题标签并升级 Blue Note 的锁定依赖；Blue Note 发布入口前确认 AI Lab 地址可达。发布后核对两个 Actions 成功、线上 CSS 与 HTML 和已验证版本一致，以及真实浏览器往返。回滚时先撤 Blue Note 入口，再撤 AI Lab 对应页，不改原文地址或 Git 历史。
