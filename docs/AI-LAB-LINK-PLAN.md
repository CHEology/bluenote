# Blue Note × AI Lab：文字目录与文末回应入口

日期：2026-09-05  
状态：按作者最后一次修订执行；本文件以作者最新确认的文末横框为准。
设计权威：Blue Note 的 `docs/DESIGN.md` 与 AI Lab 的 `docs/DESIGN.md`。

## 作者确认的要求

1. AI Lab 总目录采用参考图中的文件夹层级、缩进和连接线，统一为本站蓝灰视觉。
2. 回应页末级 URL 沿用原标题，包含中文、空格和标点，不使用拼音。
3. Blue Note 入口采用最新确认的狭长横框，文案为 `Read the ai-written reflection` 并保留右上箭头；字号与下方上一篇／下一篇一致。
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

四篇文章在正文与可选标签之后、上下篇导航之前显示一个与正文等宽的狭长横框。整框可点击，文案 `Read the ai-written reflection` 左对齐，右上箭头靠右。最小高度 56px，内边距 12px 16px，间隔 16px；上方留 40px，下方留 24px。沿用主题 `--panel` 底色与 `--line` 细边线，直角、无阴影；字体与上下篇导航同为 0.9rem（14.4px）。窄屏文字可自然换行，不缩字号。

reflection 为单数，指对应的一篇回应。链接在同一标签页进入 ai-lab；其页末原文链接保持不变。上下篇继续使用原有双列导航；不增加三列样式或私密链接专项改动。未配置及私密文章不显示横框。原文正文、段落、日期和已有 URL 保持不变。

## 内容状态

- `pending`：目录标“待写”，正文仅“回应尚未发布。”，可返回原文；不编造署名、模型或发布日期，使用 `noindex, follow`。
- `published`：必须指定非空 Markdown 正文和真实有效发布日期，才显示内容与日期并允许索引。署名按实际提供的信息填写，未提供时省略，不因缺少署名暂停发布（作者于 2026-09-05 确认）。页址不变。
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

独立主题 `hexo-theme-bluenote` 1.2.2：

- `layout/post.ejs` 与 `layout/_partials/post-companion.ejs`：在正文后、上下篇导航前输出关联阅读横框；图标归主题共用图标库。
- `scripts/companion.js`：读取通用 companion 元数据并验证 HTTPS 目标，自动排除私密文章。
- `assets/css/50-post.css`：文末入口样式。
- `test/companion.test.cjs`：关联内容位置、标签转义、URL 与未配置／私密文章检查。

Blue Note：四篇文章的 Front Matter、主题版本与锁文件，以及设计／发布规范。主题不写死 AI Lab 域名或四篇文章名，安装副本不直接编辑。

## 检查与发布

两站分别运行 `npm run check`；主题运行 `npm test` 与 `npm run test:browser`。Blue Note 使用修改前的已发布构建生成视觉基线，运行 `visual:capture`、`visual:compare` 并登记精确的预期差异。四篇原文及其他文章均校验正文哈希未变。

联动检查覆盖 Chromium 与 WebKit、1280px／390px／320px、明暗模式、目录键盘开合、四组原文→回应→原文、页首无新增导航、正确中文地址、待写元数据及本地资源。再验证无脚本时目录和普通链接仍可操作。

发布顺序为 AI Lab 对应页先上线，之后发布主题标签并升级 Blue Note 的锁定依赖；Blue Note 发布入口前确认 AI Lab 地址可达。发布后核对两个 Actions 成功、线上 CSS 与 HTML 和已验证版本一致，以及真实浏览器往返。回滚时先撤 Blue Note 入口，再撤 AI Lab 对应页，不改原文地址或 Git 历史。
