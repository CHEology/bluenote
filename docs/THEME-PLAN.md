# Blue Note 自有主题（bluenote）迁移方案

状态：已按“推荐”决策执行，实现位于分支 `theme/bluenote`（基线标签 `pre-bluenote-theme`）；执行结果见文末“执行结果”一节  
撰写日期：2026-09-04  
适用范围：将 Blue Note 从 Hexo + Fluid 1.9.9 迁移到仓库内自有主题 `themes/bluenote`，最终网页呈现与当前尽可能一致、风格统一、不再依赖 Fluid、Bootstrap、jQuery 与阿里 iconfont，并让主题可供其他 Hexo 站点复用。

本文分七部分：0 需要作者拍板的决策；1 产品需求；2 主题架构设计；3 文件级改动清单；4 实施步骤；5 测试、校对与视觉检查方案；6 风险与缓解；附录 A 基线测量值、附录 B DOM 契约、附录 C `validate-site.mjs` 断言变更表。

---

## 0. 需要作者拍板的决策

以下各项都会改变可见结果或工作方式，默认按“推荐”执行；作者不同意时改用备选项。

| # | 事项 | 推荐 | 备选 | 说明 |
| --- | --- | --- | --- | --- |
| D1 | 文章正文列宽 | 固定 `max-width: 39.5rem`（632px），与 1280px 基线的 631px 几乎一致，并满足 `DESIGN.md` §4.1 的 36–42rem | 沿用 Fluid 的视口比例宽度 | 现状是 Bootstrap 栅格算出来的：1280 视口 631px，1440 视口 720px，1920 视口 888px，后两者已超出设计规范。固定后 ≥1440 屏幕会比现在窄。 |
| D2 | 图标 | 主题内联 SVG（搜索、日夜切换、日期、左右箭头、目录、菜单三线）替换 iconfont | 继续本地托管两份 iconfont 字体 | 字形会有细微差别；iconfont 的字体授权不清晰，且 96 KB 字体只为 5 个可见图标。 |
| D3 | 顶部 NProgress 加载进度条（Fluid 默认，`#29d` 蓝色 3px） | 去掉 | 作为主题可选模块保留，默认开 | 高饱和蓝条与 `DESIGN.md` §2.4 不符；去掉同时少一个第三方脚本。 |
| D4 | 首页标语打字效果 | 继续使用本地托管的 typed.js 2.0.12（行为逐字一致） | 主题自带约 30 行实现 | 打字节奏、光标闪烁完全一致优先。 |
| D5 | `.markdown-body` 基础排版样式 | 第一阶段原样 vendored `github-markdown-css@4.0.0`（当前从 lib.baomitu.com 远程加载） | 精简重写 | 先保证一致，等视觉对比工具就位后（第 5 阶段）再精简。 |
| D6 | `/tags/`（标签云）与 `404.html` | 改为编辑式版式：标签页用 760px 列表，404 保留封面图和编辑式导航，取消 5 秒自动跳转 | 逐像素复刻 Fluid 默认外观 | 这两页目前仍是 Fluid 默认的白色浮卡、`/img/default.png` 灯塔封面、蓝色标签云，与站点其它页面风格不统一，属于遗留而非设计。 |
| D7 | 无 JavaScript 时底部红色横幅 “Blog works best with JavaScript enabled” | 去掉 | 保留 | 站内已有 noscript 回退（Gallery 等）。 |
| D8 | 深色模式偏好的存储键 | 新键 `bluenote.color-scheme`，首次加载读取旧键 `Fluid_Color_Scheme` 迁移后删除 | 沿用旧键 | 读者已保存的手动偏好不丢失。 |
| D9 | 深色模式下 Fluid 给所有 `img` 加 `filter: brightness(.9)` | 保留（写入主题 tokens，可配置关闭） | 去掉 | 这是当前可见行为，影响 About 头像、文章图片、Gallery；`DESIGN.md` §8 说“不得使用装饰性滤镜”，但它一直存在。 |
| D10 | 文章内图片点击放大 | 主题自带 `<dialog>` 灯箱（与 Gallery 大图观看同一视觉：#242424 背景、关闭/上一张/下一张） | 继续加载 jQuery + fancybox 3.5.7 | fancybox 目前从 lib.baomitu.com 远程加载，是 jQuery 的唯一硬依赖。 |
| D11 | `<meta name="theme-color">` | 改为页眉色：编辑页 `#53616b`/深色 `#282a2b`，首页 `#061521` | 保持 Fluid 默认 `#2f4154`/`#1f3144` | 影响手机浏览器地址栏颜色。现值是 Fluid 默认，与页眉不一致。 |
| D12 | 主题命名与发布形式 | 先在本仓库 `themes/bluenote/` 开发；稳定后用 `git subtree split` 拆成独立仓库 `hexo-theme-bluenote`，可选发布 npm | 一开始就独立仓库 | 同仓库便于逐页对齐；拆分时历史可保留。 |
| D13 | 主题 CSS/JS 交付形式 | 源码分文件维护，构建时由主题脚本合并为 `css/bluenote.css` 与 `js/bluenote.js` 各一个请求 | 多个 `<link>`/`<script>` | 少请求且保留可读源码。 |
| D14 | Gallery 内容区宽度 | 按 `DESIGN.md` §8.3 使用 `1160px`，与页眉标题对齐 | 复刻旧实现的 `1046px` | 实施中发现旧实现被 Bootstrap 外层容器截到 1046px，与文档和页眉都不对齐；在 1280px 参考宽度下照片区只相差 7px（行宽同时受 78svh 图高限制）。 |
| D15 | 代码块右上角的语言标签与复制按钮（Fluid code-widget） | 去掉 | 主题重新实现 | Design Doc 的代码块曾显示 “TEXT” 标签和复制按钮；`DESIGN.md` 未定义该组件，且它依赖 clipboard.js 远程脚本。 |

---

## 1. 产品需求

### 1.1 目标

1. 用 `themes/bluenote` 完整替代 `hexo-theme-fluid`，删除 Bootstrap 4.6.1、jQuery 3.6.4、阿里 iconfont，以及所有对 lib.baomitu.com 的远程请求（当前文章页仍远程加载 github-markdown-css、hint.css、fancybox、tocbot、anchor.js、clipboard.js）。
2. 在 1280px 桌面与 390px 手机两个参考宽度、浅色与深色两种模式下，首页、文章页、归档、标签列表、About、Gallery、Design Doc、私密文章页的呈现与当前一致；允许的差异只限第 0 节列出的决策项和第 1.6 节的清单。
3. 全站风格统一：所有页面共用同一导航、页眉、颜色、字体、内容网格，包括目前仍是 Fluid 默认样式的 `/tags/` 与 404。
4. 主题本身具备独立价值：一个“安静的编辑式”Hexo 主题，配置驱动、无框架依赖、零第三方请求、内建深色模式、中英文衬线排版、首页影像封面加方形卡片网格，可被其他 Hexo 站点直接使用。
5. 现有工作流不变：`npm run check` 仍是唯一质量门槛；GitHub Actions 流程不改；`AGENTS.md`、`DESIGN.md`、`PUBLISHING.md` 的规则继续有效并同步更新。

### 1.2 非目标

- 不改任何文章 Markdown 的正文文字、顺序、分段（`AGENTS.md` 的作者权威原则）。
- 不改 Gallery 的照片编排、随机小展逻辑、大图观看行为（`tooling/gallery.test.cjs` 24 项测试保持通过且不修改）。
- 不改私密文章的加密格式、解锁流程与工具命令。
- 不做新的视觉设计；不引入新颜色、新字号、新组件。
- 不引入构建工具链（不加 Sass、PostCSS、打包器）；主题使用原生 CSS、原生 JS、EJS 模板。

### 1.3 使用者与场景

| 使用者 | 场景 | 需求 |
| --- | --- | --- |
| 作者（本站） | 写文章、发图集、改设计规范 | 发文流程、命令、校验与现在一致；样式改动只在主题与少量站点 CSS 中进行 |
| 读者 | 桌面与手机阅读、切换深色模式、搜索、解锁私密文章、看 Gallery | 页面外观、交互、加载速度不变或更好；没有第三方连接 |
| 其他站点使用者 | 把主题装到自己的 Hexo 站 | 只改 `_config.bluenote.yml` 就能得到完整站点；README 有配置参考；不含 Blue Note 专属内容 |
| 自动化助手 | 按文档执行发布与检查 | 文档中的文件职责与命令准确 |

### 1.4 功能需求（按模块，写明现状与目标）

**F1 全局骨架**
- `layout.ejs` 输出 `<html lang data-root="/bluenote/" data-scheme-default="auto">`，`<body class="...">` 的布局类在构建时确定（首页 `home-root`/`home-page`，内容页 `editorial-page` 加 `post-page`/`listing-page`/`about-page`/`gallery-page`/`design-doc-page`/`photo-post`/`private-post-page`/`tags-page`/`error-page`），不再由 `scripts/editorial-layout.js` 靠正则嗅探 Fluid 标记回填。
- `<head>`：charset、viewport、favicon 与 apple-touch-icon、`theme-color`（按页面类型取 token）、description、Hexo 内建 `open_graph()`、`<title>`（`页面标题 - 站名`）、首页封面 `<link rel="preload" as="image" fetchpriority="high">`、主题 CSS、站点自定义 CSS、内联的颜色模式初始化脚本（防止深色闪白）、`meta_generator`。
- 页脚：默认不渲染任何内容（当前被 `display:none` 隐藏），配置 `footer.content` 非空时才输出。

**F2 导航**
- 桌面：左侧站名（20px 粗体），右侧文字菜单（14px，字距 0.055em，悬停金色 `#f3dca6` 并出现从中间展开的 1px 下划线）、搜索入口（`#site-search`，文字“Search”）、日夜切换（图标按钮，悬停时显示目标模式的图标）。顶部透明覆盖在页眉或封面之上，滚动超过 50px 后变为实色（编辑页 `#53616b`/深色 `#282a2b`；首页始终 `#2f4154`/深色 `#1f3144`），带 `0 2px 5px rgba(0,0,0,.16), 0 2px 10px rgba(0,0,0,.12)` 阴影，高度 64px（手机 66px）。
- 手机（<992px）：三线按钮（30×20，白色 3px 圆角线条，打开时变为 X），全屏纵向文字菜单，背景为导航色，项高约 40px，底部 1px `rgba(255,255,255,.14)` 分隔线，只有 Search 与日夜切换显示右侧 16px 图标；打开时 `body.mobile-menu-open` 禁止滚动；点击任意链接或窗口变宽到 ≥992px 时关闭；0.18s 淡入并有 20ms 递进。
- 菜单项来自 `_config.bluenote.yml`，支持 `name`、`link`、`icon`、`target`；不支持下拉子菜单（当前未用，主题第一版不做）。

**F3 首页**
- 固定全屏封面（`home.cover`），线性渐变遮罩，居中打字标语（32px 白色，阴影 `0 2px 22px rgba(2,13,22,.75)`，typed.js 70ms/字，光标 `_`），滚动超过 28% 视口高度时标语淡出上移。
- 第二屏：最多 12 张方形卡片（`home.cards`），桌面 4 列、≤991px 3 列、≤767px 单列；卡片 `#091821`、悬停 `#0d202b`、阴影 `0 10px 26px rgba(2,9,14,.14)`；标题 `clamp(1.15rem, 2.5vh, 1.45rem)` 600 字重、摘要 3 行截断、底部日期（0.7rem，带日期图标 0.75 透明度）。私密文章在未解锁时由 `private.css` 隐藏（保留 `.index-card:has(a[data-private-link])` 钩子）。
- 无分页控件（多于 12 篇只显示最新 12 篇；读者从 Archives 看全部），与现状一致。

**F4 编辑式页眉（内容页）**
- 高 216px（手机 176px）、实色 `#53616b`/`#282a2b`，标题容器 `min(100% - 2rem, 760px)` 左对齐、贴底（下内边距 2.65rem，手机 1.9rem），标题 `clamp(1.72rem, 2.15vw, 2.05rem)`（手机 1.5rem）400 字重、字距 0.035em、行高 1.25，标题下方 2.75rem×1px（手机 2.25rem）浅色短线。Gallery 页容器加宽到 `min(100% - 4rem, 1160px)`。
- 文章页页眉不显示日期（现状被隐藏），标题元素即页面 `<h1>`（当前另有隐藏的 `#seo-header`，合并为一个）。

**F5 文章页**
- 正文列：桌面 632px（D1），手机左右 1rem（425–767px 为 2rem）；`.markdown-body` 17px、行高 1.78、段距 1.15em、Charter 字体栈；链接 `#637583`。
- 保留：文末上一篇/下一篇（0.9rem，带箭头图标，手机只显示 Previous/Next 文字）；标签列表与版权卡不显示；右侧目录（Hexo 内建 `toc()` 构建时生成，全部展开，滚动高亮当前标题，无标题时不渲染整个侧栏；<992px 隐藏）；标题悬停锚点链接（构建时生成，无 anchor.js）；图片 `figure` 包裹与图注（alt 为文件名时不生成图注，与 `site.js` 现有行为一致）；图片点击灯箱（D10）；照片文章（≥3 张 `/images/galleries/` 图）用 1080px 宽版并隐藏侧栏。
- `scripts/gallery-images.js` 的响应式 `srcset` 处理不变。

**F6 列表页（归档、年/月归档、单个标签）**
- 760px 列；年份小标签（0.86rem、500 字重、字距 0.08em、次要色）；每项 `日期 标题`（日期 0.8rem 等宽数字占 4.5rem，标题 1rem，行内边距 0.78rem 0.2rem，底线 1px）；悬停 `#435d70` 加 `rgba(99,117,131,.08)` 底色；无“N posts in total”。
- 归档页末尾的“SITE / DOC Design Doc”条目由主题配置 `archive.extra_entries` 声明式渲染，不再靠正则插入。
- 私密文章在列表中的 LOCKED/UNLOCKED 状态由 `private.js` 继续注入（保留 `.listing__item`/`.listing__title` 钩子）。

**F7 About**
- 8rem 圆形头像（1px 边线、无阴影）、名字 1.45rem 500 字重、简介次要色，正文 `.markdown-body` 上距 2.5rem；无社交图标（配置为空时不渲染容器）。

**F8 独立页面（Gallery、Design Doc、其他 `layout: page`）**
- `page.ejs` 只负责页眉与 760px（或页面声明的宽度类）容器，正文原样输出；生成器通过 `data.body_class` 传入 `gallery-page`/`design-doc-page`，主题不知道 Gallery 的存在。
- Design Doc 的专属样式（首段元信息、h2/h3、表格、代码块）移到站点级 `source/css/design-doc.css`。

**F9 标签索引与 404（D6）**
- `/tags/`：编辑式列表，每行 `标签名 · N`，链接到标签页。
- `404.html`：编辑式导航加封面图（配置 `page404.cover`），标题 “Page not found”，正文一行返回首页链接；不自动跳转。

**F10 深色模式**
- `dark_mode.default: auto` 跟随系统；点击切换写入本地偏好；偏好等于系统值时清除偏好回到自动；系统变化实时生效（当前 `site.js` 的 `matchMedia` 监听纳入主题）；`<html data-scheme="dark|light">` 属性加 `prefers-color-scheme` 双轨 CSS，与现在 `data-user-color-scheme` 机制等价；切换时 `body` 颜色 0.2s 过渡；深色下 `img` 亮度 0.9（D9）。
- 私密对话框与搜索面板目前只跟随系统深色（不跟随手动切换），这是现状，本次不改，记入后续事项。

**F11 搜索与私密文章（站点级模块，保持不变）**
- `source/js/search.js`、`source/js/private.js` 及其 CSS 继续作为站点资源加载；只做两处适配：站点根路径改读 `document.documentElement.dataset.root`；关闭手机菜单改调用主题暴露的 `window.BlueNote.nav.close()`。

**F12 资源与性能**
- 所有 CSS/JS/字体/图片由本站托管；每个 HTML 里不存在 `https://` 的样式表或脚本。
- 构建时对本站 CSS/JS 附加内容哈希 `?v=`（现 `scripts/page-loading.js` 逻辑迁入主题）。
- 首页 CSS 总量目标：主题 CSS < 60 KB 未压缩（现在 Bootstrap 160 KB + main.css 52 KB + 自定义 43 KB）；JS 去掉 jQuery 90 KB 与 Bootstrap 64 KB。
- 图片原生 `loading="lazy"`；去掉 Fluid 的 `loading.gif` 占位方案。

**F13 可复用性**
- 主题目录自带 `package.json`（`hexo-theme-bluenote`）、`README.md`（安装、全部配置项、DOM 契约、可选模块）、`LICENSE`（MIT）、`CHANGELOG.md`、`languages/en.yml` 与 `zh-CN.yml`、带注释的默认 `_config.yml`。
- 没有 Blue Note 专属内容：站名、封面、头像、菜单、颜色、字体、Design Doc 条目全部来自站点配置；主题默认值是中性的示例。
- 颜色与字体 token 可在站点配置里覆盖，主题在 `<head>` 生成一段 `:root{--…}` 覆盖块。

### 1.5 非功能需求

- 可访问性：键盘可见焦点；菜单、切换按钮有 `aria-label`/`aria-expanded`；`prefers-reduced-motion` 下关闭过渡；对比度不低于现状。
- 兼容性：最近两个大版本的 Safari、Chrome、Firefox；iOS Safari。使用 `:has()`、`svh`、`<dialog>` 等已在现站使用的特性，不再新增更激进的特性。
- 无框架、无构建链、无运行时依赖；唯一第三方运行时代码为 typed.js（D4）与 github-markdown-css（D5），均本地托管并保留许可证。
- 主题 CSS 中 `!important` 目标为 0（现自定义 CSS 有 33 处，几乎全部是为了压过 Fluid/Bootstrap）；例外只允许 `[hidden]` 与打印样式。

### 1.6 有意保留的差异（迁移后与现在不同，但属于修正，不算回归）

1. 文章列宽在 ≥1440px 屏幕变窄到 632px（D1）。
2. 图标字形略有差异（D2）。
3. 无顶部蓝色进度条（D3）。
4. `/tags/` 与 404 页改为编辑式（D6）。
5. 无 noscript 红色横幅（D7）。
6. 手机地址栏颜色随页眉色（D11）。
7. 文章图片灯箱外观与 Gallery 统一（D10）。
8. 深色模式偏好键迁移（D8，读者无感）。
9. 页眉标题成为唯一 `<h1>`；不再有隐藏的重复标题（无视觉影响）。
10. `img` 不再先显示 `loading.gif` 再替换（无视觉影响，加载更早）。

---

## 2. 主题架构设计

### 2.1 目录结构

```text
themes/bluenote/
├── _config.yml                 # 带注释的默认配置（中性示例值）
├── package.json                # name: hexo-theme-bluenote, license: MIT, hexo peer 版本
├── README.md                   # 安装、配置参考、可选模块、DOM 契约、升级说明
├── CHANGELOG.md
├── LICENSE                     # MIT；附 vendored 资源许可证清单
├── languages/
│   ├── en.yml                  # Home/Archives/Tags/About/Search/Previous/Next/Table of Contents/...
│   └── zh-CN.yml
├── layout/
│   ├── layout.ejs              # html/head/body 骨架，body class 计算，图标 sprite
│   ├── index.ejs               # 首页：封面 + 卡片网格
│   ├── post.ejs                # 文章：页眉 + 正文列 + 目录 + 上下篇
│   ├── page.ejs                # 独立页：页眉 + 内容列（宽度由 page.body_class 决定）
│   ├── archive.ejs             # 归档、年/月归档
│   ├── tag.ejs                 # 单个标签 → 复用列表 partial
│   ├── tags.ejs                # 标签索引（D6）
│   ├── category.ejs            # 分类列表（主题完整性；Blue Note 关闭）
│   ├── about.ejs
│   ├── 404.ejs
│   └── _partials/
│       ├── head.ejs            # meta、favicon、theme-color、open_graph、预加载、CSS、token 覆盖块、scheme 初始化脚本
│       ├── nav.ejs             # 桌面导航 + 手机菜单 + 日夜切换
│       ├── cover.ejs           # 首页封面与标语
│       ├── masthead.ejs        # 编辑式页眉
│       ├── listing.ejs         # 按年分组的文章列表 + extra_entries
│       ├── card.ejs            # 首页卡片
│       ├── post-nav.ejs        # 上一篇/下一篇
│       ├── toc.ejs             # 目录（Hexo toc() 助手）
│       ├── pagination.ejs      # 分页（列表页 total>1 时）
│       ├── icons.ejs           # 内联 SVG symbol sprite
│       ├── footer.ejs
│       └── scripts.ejs         # 主题 JS、可选模块、站点 custom_js
├── scripts/                    # 主题级 Hexo 脚本（随主题走）
│   ├── helpers.js              # body_classes()、icon()、theme_tokens_css()、site_root()
│   ├── generators.js           # 404.html、tags/index.html、categories/index.html（按配置）
│   ├── content-filters.js      # 标题锚点、figure/figcaption、原生 lazy、h1 id 补全
│   ├── assets.js               # 合并 source/css → css/bluenote.css、source/js → js/bluenote.js（D13）
│   └── asset-versions.js       # after_generate：本站 CSS/JS 内容哈希 ?v=（迁自 scripts/page-loading.js）
└── source/
    ├── css/                    # 按顺序合并；每个文件顶部注明职责
    │   ├── 00-tokens.css       # :root 浅色/深色/首页 token；字体栈；间距尺度
    │   ├── 01-base.css         # 最小 reset（替代 Bootstrap Reboot 中可见部分）、html/body、链接、滚动条、打印
    │   ├── 10-nav.css          # 桌面导航、滚动态、手机菜单、日夜切换
    │   ├── 20-masthead.css     # 编辑式页眉（含 Gallery 宽版）
    │   ├── 30-home.css         # 首页封面、卡片网格（自 source/css/home.css 迁入并去 !important）
    │   ├── 40-editorial.css    # 内容容器、列表、About、标签索引、404、分页
    │   ├── 50-post.css         # 正文列、目录、上下篇、照片文章、锚点、图注、灯箱
    │   ├── 60-markdown.css     # vendored github-markdown-css 4.0.0（裁去 octicon/task-list）+ 现有 Fluid 覆盖
    │   ├── 70-panels.css       # .literary-panel / .literary-block--verse 等通用文学块（自 literary-blocks.css）
    │   ├── 80-highlight.css    # 代码块配色（浅色 github.css、深色 dark.css，自 highlight.js 11.12 vendored）
    │   └── 90-print.css
    ├── js/
    │   ├── 00-core.js          # window.BlueNote 命名空间、root、事件总线
    │   ├── 10-scheme.js        # 深色模式（含旧键迁移、系统变化监听、theme-color 同步）
    │   ├── 20-nav.js           # 滚动态、手机菜单开关、BlueNote.nav.close()
    │   ├── 30-home.js          # 标语淡出（自 source/js/home.js）
    │   ├── 40-toc.js           # 目录当前项高亮
    │   ├── 50-lightbox.js      # 文章图片灯箱（D10）
    │   └── 60-typing.js        # 调用 vendored typed.js（D4）
    ├── vendor/
    │   ├── typed.js/2.0.12/    # 迁自 source/vendor
    │   └── LICENSES.md
    └── img/
        └── default-cover.jpg   # 主题演示用中性封面（非 Blue Note 素材）
```

Hexo 8 通过根目录 `_config.yml` 的 `theme: bluenote` 定位 `themes/bluenote`，并自动读取根目录 `_config.bluenote.yml` 覆盖主题默认配置（Hexo ≥5 内建，不需要 Fluid 那套 merge 脚本）。

### 2.2 配置模型 `_config.bluenote.yml`

Blue Note 的实际值如下；主题 `_config.yml` 提供同结构的中性默认值。

```yaml
brand: Blue Note
favicon: /images/theme_fluid_bg/机动警察 和平保卫战 猫 头像.png
apple_touch_icon: /images/theme_fluid_bg/机动警察 和平保卫战 猫 头像.png

fonts:
  ui: 'Times, "Times New Roman", Georgia, serif'
  prose: 'Charter, Georgia, "Times New Roman", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", STSong, serif'
  math: 'Times, "Times New Roman", Georgia, serif'
  letter_spacing: 0.02em

colors:            # 可只写需要覆盖的键；键名即 CSS 变量名去掉 --
  light: { paper: "#eee9df", text: "#3e3a34", heading: "#2d2b27", muted: "#777168", link: "#637583", link-hover: "#435d70", line: "rgba(62,58,52,0.16)", masthead: "#53616b", masthead-text: "#f4f1eb", masthead-line: "rgba(244,241,235,0.48)", accent: "#f3dca6", panel: "rgba(99,117,131,0.08)", code-bg: "#f6f8fa", inline-code-bg: "rgba(175,184,193,0.2)", scrollbar: "#c4c6c9", scrollbar-hover: "#a6a6a6" }
  dark:  { paper: "#302f2d", text: "#dedad2", prose: "#d8d4cc", heading: "#e8e3da", muted: "#aaa59d", link: "#b8c0c5", link-hover: "#d0d5d8", line: "rgba(222,218,210,0.16)", masthead: "#282a2b", masthead-text: "#eeeae3", masthead-line: "rgba(238,234,227,0.38)", code-bg: "#303030", inline-code-bg: "rgba(99,110,123,0.4)", scrollbar: "#687582", scrollbar-hover: "#9da8b3", image-brightness: 0.9 }
  home:  { background: "#061521", nav: "#2f4154", nav-dark: "#1f3144", card: "#091821", card-hover: "#0d202b", card-title: "#e9e8e2", card-excerpt: "rgba(220,221,216,0.72)", card-meta: "rgba(218,218,211,0.64)" }

nav:
  menu:
    - { name: Home, link: / }
    - { name: Archives, link: /archives/ }
    - { name: Gallery, link: /gallery/ }
    - { name: About, link: /about/ }
    - { name: Search, link: "#site-search", icon: search }
  scheme_toggle: true

home:
  cover: /images/theme_fluid_bg/2021.11-2880.jpg
  preload_cover: true
  slogan: Dream to be a tranquil spectator.
  typing: { enable: true, speed: 70, cursor: "_" }
  cards: 12
  excerpt: true
  date: true

post:
  toc: { enable: true, min_depth: 1, max_depth: 6 }
  prev_next: true
  show_tags: false
  heading_anchors: true
  figure_captions: { enable: true, skip_filename_alt: true }
  lightbox: true
  photo_layout: { enable: true, min_images: 3, image_path: /images/galleries/ }

archive:
  show_total: false
  extra_entries:
    - { section: SITE, kind: DOC, title: Design Doc, summary: 颜色、字体、排版与组件规范, link: /design/ }

about:
  avatar: /images/theme_fluid_bg/机动警察 和平保卫战 猫 头像.png
  name: cheology
  intro: 语言的边界划定思绪的历史与领地。
  links: []

tags: { enable: true }
categories: { enable: false }
page404: { enable: true, cover: /images/theme_fluid_bg/videoCover-穿梭在暴雨中的武汉杨泗港大桥..1213717019.jpeg }

dark_mode: { enable: true, default: auto, legacy_storage_key: Fluid_Color_Scheme }
progress_bar: { enable: false }          # D3
noscript_warning: false                  # D7
open_graph: true
asset_version: true
footer: { content: "" }

custom_css:
  - /css/site.css
  - /css/design-doc.css
  - /css/thought-notes.css
  - /css/private.css
  - /css/search.css
custom_js:
  - /js/private.js
  - /js/search.js
```

### 2.3 模板输出结构（新 DOM 命名）

| 页面 | body class | 主要结构 |
| --- | --- | --- |
| 首页 | `home-page`（`html.home-root`） | `header.site-header` > `nav.site-nav` + `div.home-cover#banner[style=background-image]` > `.home-cover__mask` > `.home-cover__slogan` > `#subtitle` ；`main.home-main` > `.home-grid` > `article.index-card` × N（`.index-header` `.index-excerpt` `.index-meta`） |
| 文章 | `editorial-page post-page [photo-post] [private-post-page]` | `header.site-header` > `nav.site-nav` + `div.masthead` > `.masthead__inner` > `h1.masthead__title`；`main.page-body` > `.post-layout` > `article.post-content` > `.markdown-body` + `nav.post-nav`；`aside.post-toc`（有标题时） |
| 归档/标签/年月 | `editorial-page listing-page` | `.masthead` + `main.page-body` > `.content-column` > `section.listing` > `p.listing__year` + `a.listing__item` > `time.listing__date` + `span.listing__title`；末尾 `p.listing__section` + `a.listing__item.listing__item--entry` |
| 标签索引 | `editorial-page listing-page tags-page` | 同上，`a.listing__item` > `span.listing__title` + `span.listing__count` |
| About | `editorial-page about-page` | `.masthead` + `.content-column` > `.about-avatar` `.about-name` `.about-intro` + `article.about-content` > `.markdown-body` |
| 独立页 | `editorial-page` + `page.body_class` | `.masthead`（Gallery 宽版由 `.gallery-page` 控制）+ `.content-column` > `article.page-content` > 原样内容 |
| 404 | `error-page` | 导航 + `.home-cover`（无标语）+ 一行返回链接 |

站点级脚本与 CSS 依赖的旧类名对照见附录 B。

### 2.4 构建期脚本（主题 `scripts/`）

| 文件 | 钩子 | 作用 | 来源 |
| --- | --- | --- | --- |
| `helpers.js` | helper | `body_classes(page)`、`icon(name)`、`theme_tokens_css()`（把 `colors`/`fonts` 覆盖写成 `:root{}`）、`site_root()` | 新 |
| `generators.js` | generator | `404.html`（若 `source/404.html` 不存在）、`tags/index.html`、`categories/index.html`（按开关） | 替代 Fluid `generators/pages.js` |
| `content-filters.js` | `after_post_render` | 为无 id 的 `h1` 补 id；标题内插入 `a.heading-anchor`；`<p><img></p>` 转 `<figure><img><figcaption>`（alt 为文件名时无图注）；图片加 `loading="lazy" decoding="async"`（首图 eager） | 替代 anchor.js、`Fluid.plugins.imageCaption`、Fluid lazyload、`site.js` 图注清理 |
| `assets.js` | generator | 读取主题 `source/css/*.css`、`source/js/*.js` 按文件名排序合并，输出 `css/bluenote.css`、`js/bluenote.js`；原分文件不进入 `public/` | 新（D13） |
| `asset-versions.js` | `after_generate`（优先级 100） | 本站 CSS/JS 内容哈希 `?v=` | 迁自 `scripts/page-loading.js` |

### 2.5 站点与主题的职责边界（迁移后）

| 留在 Blue Note 仓库 | 进入主题 |
| --- | --- |
| `scripts/design-document.js`（生成 `/design/`，传 `body_class: design-doc-page`） | 布局、页眉、导航、首页、列表、文章、About、404、标签索引 |
| `scripts/gallery-page.js`（生成 `/gallery/`，传 `body_class: gallery-page`，注入 gallery.css/js） | 深色模式、手机菜单、目录、锚点、图注、灯箱、打字效果 |
| `scripts/gallery-images.js`（响应式 srcset） | 资源合并与版本号 |
| `scripts/editorial-layout.js` → 缩减为 `scripts/private-links.js`（只做 `data-private-link` 标记） | `.literary-panel` 与诗歌块（通用文学组件） |
| `source/css/site.css`（原 custom.css 中 Blue Note 专属：私密文章 `pre:first-child` 特例）、`design-doc.css`、`thought-notes.css`、`private.css`、`search.css`、`gallery.css` | `.markdown-body` 基础排版与代码配色 |
| `source/js/private.js`、`search.js`、`gallery.js`、`gallery-selection.js` | 图标 sprite |
| `tooling/*`、`docs/*`、`.github/*` | README/LICENSE/CHANGELOG/languages |

---

## 3. 文件级改动清单

### 3.1 新增

| 路径 | 内容 |
| --- | --- |
| `themes/bluenote/**` | 第 2.1 节全部文件 |
| `_config.bluenote.yml` | 第 2.2 节 |
| `source/css/site.css` | 自 `custom.css`/`literary-blocks.css` 抽出的 Blue Note 专属规则：`[data-private-post-id="eeddfa74ef298a0c"] .private-post-shell__content > pre:first-child` 系列 |
| `source/css/design-doc.css` | 自 `custom.css` 抽出的 `.design-doc-page` 全部规则（原样） |
| `scripts/private-links.js` | 自 `editorial-layout.js` 保留的 `markPrivateLinks()`（`after_render:html`） |
| `tooling/visual/capture.mjs` | Playwright：按页面 × 视口 × 模式截图、计算样式快照、可见文本快照（第 5.1 节） |
| `tooling/visual/compare.mjs` | 截图像素差异（pixelmatch）、样式与文本 diff 报告 |
| `tooling/visual/pages.json` | 被测页面清单与选择器清单 |
| `tooling/visual/.gitignore` | 忽略 `baseline/` 与 `current/` 截图 |

### 3.2 修改

| 路径 | 改动 |
| --- | --- |
| `_config.yml` | `theme: fluid` → `theme: bluenote`；`highlight` 段改为 `hljs: true`、`wrap: false`、`auto_detect: false`、`line_number: false`（Fluid 之前在运行时强制覆盖这些值；现无代码块的文章，Design Doc 代码块当前为无高亮的 `<pre><code>`，此设置保持该输出） |
| `package.json` | `dependencies` 删除 `hexo-theme-fluid`、`hexo-renderer-stylus`；`devDependencies` 新增 `playwright`、`pixelmatch`、`pngjs`；`scripts` 新增 `visual:baseline`、`visual:capture`、`visual:compare`；`description` 去掉 Fluid |
| `package-lock.json` | 随 `npm uninstall`/`npm install` 更新 |
| `scripts/design-document.js` | `data` 增加 `body_class: 'design-doc-page'` |
| `scripts/gallery-page.js` | `data` 增加 `body_class: 'gallery-page'`；`galleryAssets` 保留 |
| `scripts/gallery-images.js` | 不改（其 `after_render:html` 优先级 30 早于主题图片过滤器；主题过滤器遇到已有 `srcset`/`loading` 的图片不再改写） |
| `scripts/editorial-layout.js` | 删除（内容拆到 `private-links.js` 与主题） |
| `scripts/page-loading.js` | 删除（三项职责分别进入主题 `head.ejs`、不再需要的 iconfont 改写、`asset-versions.js`） |
| `source/js/private.js` | `siteRoot` 改读 `document.documentElement.dataset.root`；`closeMobileMenu()` 改为 `window.BlueNote && BlueNote.nav.close()`；选择器 `.list-group-item` → `.listing__item`、`.list-group-item-title` → `.listing__title`、`.post-prevnext` → `.post-nav`；其余不变 |
| `source/js/search.js` | 同上两处（root、closeMobileMenu）；overlay 内 `<span class="iconfont icon-search">` 改为 `<span class="site-search-dialog__icon">`（样式仍是 mask SVG） |
| `source/css/private.css` | `.navbar .private-lock-icon` → `.site-nav .private-lock-icon`；`.mobile-grid-item .private-lock-icon` → `.site-menu__item .private-lock-icon`；`.post-prevnext a[data-private-link]` → `.post-nav a[data-private-link]`；`.index-card`/`.index-header`/`.index-excerpt` 不变 |
| `source/css/search.css` | `.site-search-dialog__field .icon-search` → `.site-search-dialog__icon`；其余不变 |
| `source/css/gallery.css` | `.editorial-page.gallery-page #board > .container` → `.gallery-page .content-column`；`.gallery-page .banner-text` → `.gallery-page .masthead__inner`；其余不变（测试断言的 `.gallery-bay`、`.gallery-row > .gallery-item:only-child`、`.has-preview …` 段落不动） |
| `source/css/thought-notes.css` | 不改（只依赖 `.post-page .markdown-body`） |
| `source/_posts/*.md`、`source/about/index.md` | 不改。`lazyload: false` 前言字段保留但主题不读取 |
| `scaffolds/post.md` | 删除 `index_img:`（Fluid 字段） |
| `tooling/validate-site.mjs` | 按附录 C 逐条更新 |
| `tooling/validate-private-vault.mjs` | 不改（检查的是 `data-private-link`、`data-private-post-id`、`private.js` 字符串，均保留） |
| `tooling/gallery.test.cjs` | 不改 |
| `docs/DESIGN.md` | §2.3 补首页导航色 `#2f4154`/`#1f3144`（现为未记录的 Fluid 默认值）；§9.1 “Bootstrap、图标字体、jQuery…由本站托管”改为“主题不再使用这些依赖”；§11 实现边界按第 2.5 节改写文件职责；§12 验收步骤加入 `npm run visual:compare` |
| `docs/PUBLISHING.md` | §3 删除“图集文章的 Front Matter 设为 `lazyload: false`”说明；§6 `git add` 列表加 `themes _config.bluenote.yml`，去掉 `_config.fluid.yml`；§5 说明视觉对比命令 |
| `docs/VENDORED-ASSETS.md` | 改写为主题 vendored 清单：typed.js 2.0.12（MIT）、github-markdown-css 4.0.0（MIT）、highlight.js 11.12.0 `github.css`/`dark.css`（BSD-3）；删除 Bootstrap/jQuery/iconfont/nprogress 条目；首页封面段落保留 |
| `README.md` | “使用 Hexo 与 Fluid 构建”改为“使用 Hexo 与自有主题 bluenote 构建”；仓库结构树加 `themes/bluenote/`，`_config.fluid.yml` → `_config.bluenote.yml`，`source/css` 说明改为“站点专属样式” |
| `AGENTS.md` | 无需改（原则不变）；可在末尾加一句“主题代码位于 `themes/bluenote`，样式改动先看 `docs/DESIGN.md` §11” |
| `.github/workflows/pages.yml` | 不改 |

### 3.3 删除

| 路径 | 原因 |
| --- | --- |
| `_config.fluid.yml` | 被 `_config.bluenote.yml` 取代 |
| `source/vendor/bootstrap/` | 不再使用（224 KB） |
| `source/vendor/jquery/` | 不再使用（90 KB） |
| `source/vendor/iconfont/` | 不再使用（96 KB，D2） |
| `source/vendor/nprogress/` | D3 |
| `source/vendor/typed.js/` | 移入主题 `source/vendor/` |
| `source/css/custom.css` | 拆入主题 `10-nav`/`20-masthead`/`40-editorial`/`50-post` 与站点 `site.css`/`design-doc.css` |
| `source/css/home.css` | 移入主题 `30-home.css` |
| `source/css/literary-blocks.css` | 移入主题 `70-panels.css`（去掉 `.post-page` 前缀限定，改为 `.markdown-body .literary-panel`），私密文章特例进 `site.css` |
| `source/css/typography.css` | 字体栈进入主题 tokens |
| `source/js/site.js` | 全部职责已由主题构建期与 `10-scheme.js` 承担 |
| `source/js/home.js` | 移入主题 `30-home.js` |
| `source/img/{avatar,default,fluid,loading,police_beian}.png/gif` | Fluid 遗留素材；`source/img/icons/*.svg` 保留（search/private 用） |
| `public/xml/`、`public/css/{main,highlight,highlight-dark,gitalk}.css`、`public/js/{boot,utils,events,plugins,color-schema,img-lazyload,local-search,leancloud,openkounter,umami-view}.js` | 生成物，随 Fluid 消失 |

### 3.4 移动/改名

| 从 | 到 |
| --- | --- |
| `source/vendor/typed.js/2.0.12/*` | `themes/bluenote/source/vendor/typed.js/2.0.12/*` |
| `scripts/page-loading.js` 的 `versionPageAssets` | `themes/bluenote/scripts/asset-versions.js` |
| `scripts/editorial-layout.js` 的 `markPrivateLinks` | `scripts/private-links.js` |
| `source/css/custom.css` 的 `.design-doc-page` 段 | `source/css/design-doc.css` |

---

## 4. 实施步骤

每阶段结束都要 `npm run check` 通过；第 2 阶段起同时 `npm run visual:compare` 通过（阈值见 5.1）。全程在分支 `theme/bluenote` 上进行，`master` 随时可发布。

### 阶段 0：冻结基线（约半天）

1. 在当前 `master`（提交 `32d90a6` 之后的干净状态）打标签 `pre-bluenote-theme`。
2. 安装 `playwright`（含 Chromium）、`pixelmatch`、`pngjs` 为 devDependencies；写 `tooling/visual/capture.mjs`、`compare.mjs`、`pages.json`。
3. `npm run build && npm run visual:baseline`：对第 5.1 节页面清单生成基线截图、计算样式快照、可见文本快照，存入 `tooling/visual/baseline/`（git 忽略；可随时从标签重建）。
4. 把附录 A 的测量值写入 `pages.json` 的“关键选择器”列表，作为样式快照的采样点。
5. 完成标准：基线目录齐全；`visual:compare` 对基线自比为零差异。

### 阶段 1：主题骨架与 token，双主题并存（约 1 天）

1. 创建 `themes/bluenote/` 目录、`package.json`、`_config.yml`、`languages/`、`layout/layout.ejs`、`_partials/head.ejs`、`nav.ejs`、`icons.ejs`、`scripts/helpers.js`、`assets.js`、`asset-versions.js`、`generators.js`，以及 `00-tokens.css`、`01-base.css`、`10-nav.css`、`00-core.js`、`10-scheme.js`、`20-nav.js`。
2. 写 `_config.bluenote.yml`；`_config.yml` 改 `theme: bluenote`（切回 `fluid` 即回滚，两套配置并存到阶段 4）。
3. `01-base.css` 只写可见影响项：`box-sizing`、`html{font-size:16px;letter-spacing:.02em}`、`body{line-height:1.5;margin:0}`、标题/段落默认外边距、`img{vertical-align:middle;max-width:100%}`、`button` 重置、6px 滚动条、链接颜色与过渡。
4. 先让首页与文章页“能打开”，导航与页眉先对齐（附录 A 的导航/页眉数值）。
5. 完成标准：`npm run check` 中除 `validate-site` 外全部通过；导航与页眉在两视口两模式下 `visual:compare` 差异 < 0.5%。

### 阶段 2：逐页对齐（约 2 天）

顺序：文章页 → 归档/标签 → About → Design Doc → Gallery → 首页 → 标签索引与 404。

每页步骤相同：
1. 写模板与对应 CSS 文件，把原 `custom.css`/`home.css` 规则搬入并去掉 `!important` 与 Fluid 选择器前缀；
2. 跑 `visual:compare` 看该页的像素差异与样式快照 diff；
3. 逐条消除差异，直到该页在 4 个组合（1280/390 × 浅/深）下差异 < 0.5%，且样式快照中除 D1–D11 允许项外无差异；
4. 更新 `validate-site.mjs` 对应断言（附录 C）。

关键点：
- 文章页正文列按 D1；目录用 `toc(page.content, {list_number:false, min_depth, max_depth})`，无条目时整个 `aside.post-toc` 不输出；
- 归档 `extra_entries` 渲染后与现在 “SITE / DOC / Design Doc / 摘要” 的字号、间距一致；
- Gallery 页只验证页眉与容器宽度（1160px），照片区由现有 `gallery.css` 负责；
- 首页整体迁 `home.css`，只改选择器，数值不动；
- 标签索引与 404 按 D6 新写，不做像素对比，做人工检查。

### 阶段 3：行为与交互（约 1 天）

1. `content-filters.js`：标题锚点、figure/figcaption、原生 lazy、h1 id；验证 5 篇文章 `.markdown-body` 的可见文本与阶段 0 快照完全一致。
2. `40-toc.js` 当前项高亮；`50-lightbox.js`；`60-typing.js` + vendored typed.js；`30-home.js` 淡出。
3. 适配 `private.js`、`search.js`、`private.css`、`search.css`、`gallery.css` 的选择器（3.2 节）。
4. 交互回归清单（5.4 节）全部人工过一遍。
5. 完成标准：`npm run check` 全绿（含更新后的 `validate-site`）；交互清单无缺陷。

### 阶段 4：清理与文档（约半天）

1. 删除 3.3 节文件；`npm uninstall hexo-theme-fluid hexo-renderer-stylus`；确认 `package-lock.json` 无 `fluid`、`stylus` 字样。
2. 更新 `docs/DESIGN.md`、`PUBLISHING.md`、`VENDORED-ASSETS.md`、`README.md`、`scaffolds/post.md`。
3. 全站扫描：`grep -ri "fluid\|bootstrap\|jquery\|alicdn\|baomitu" public/ themes/ source/ scripts/ tooling/ docs/` 只允许出现在 `docs/THEME-PLAN.md` 与 `CHANGELOG`。
4. 完成标准：干净仓库上 `npm ci && npm run check && npm run visual:compare` 通过；PR 触发的 Actions 构建通过。

### 阶段 5：可复用性打磨（约 1 天，可与发布分开）

1. 主题 README：安装（`themes/` 目录或 npm）、配置参考（2.2 节每个键的类型、默认值、说明）、可选模块、DOM 契约、Blue Note 之外的示例配置。
2. 用一个临时空 Hexo 站（`hexo init /tmp/theme-demo`，只放 3 篇示例文章）验证主题在无任何站点脚本、无 Gallery、无私密文章时可用，首页/文章/归档/标签/About/404 正常。
3. 视情况把 `github-markdown-css` 精简为主题实际用到的规则（D5 第二步），用 `visual:compare` 守住。
4. `git subtree split --prefix=themes/bluenote -b theme-export`，推到独立仓库 `hexo-theme-bluenote`（D12）。

### 发布

1. 在 `theme/bluenote` 分支开 PR，Actions 通过后合并 `master`，自动部署。
2. 线上验证（5.5 节）。
3. 出现问题时 `git revert` 合并提交即可回到 Fluid 版本（`node_modules` 由 `npm ci` 按锁文件恢复）。

---

## 5. 测试、校对与视觉检查方案

### 5.1 自动化视觉与样式对比（`tooling/visual/`）

**页面清单**（`pages.json`）：

| 键 | URL | 备注 |
| --- | --- | --- |
| home | `/bluenote/` | 首屏与滚动到卡片区各一张 |
| home-menu | `/bluenote/` + 打开手机菜单 | 仅 390px |
| post-text | `/bluenote/2026/09/02/近期随想/` | 含 `.literary-panel` 公式 |
| post-zato | `/bluenote/2026/08/27/Z.A.T.O-随想/` | 含 signal 面板与诗歌块 |
| post-story | `/bluenote/2023/09/26/布涅星/` | 长文 |
| post-photo | `/bluenote/2023/11/19/秋之纽约-2023-11/` | 照片文章宽版 |
| post-private | `/bluenote/2023/07/31/小蓝本/` | 锁定态 |
| archives | `/bluenote/archives/` | 含 Design Doc 条目 |
| archive-year | `/bluenote/archives/2023/` | |
| tag | `/bluenote/tags/其他/` | |
| tags | `/bluenote/tags/` | 只在迁移后截图（D6） |
| about | `/bluenote/about/` | |
| gallery | `/bluenote/gallery/` | 随机小展：固定随机种子（页面注入 `Math.random` 桩）后再截图 |
| gallery-all | `/bluenote/gallery/all/` | 首屏与第 3 展位 |
| design | `/bluenote/design/` | 首屏、表格段、代码块段 |
| 404 | `/bluenote/404.html` | 只在迁移后截图（D6） |

**矩阵**：视口 1280×900 与 390×844；`prefers-color-scheme` light 与 dark；共 16 页 × 4 = 64 张全页截图（首页固定封面按首屏与卡片区两段截）。

**三种快照**：
1. 全页 PNG 截图，`compare.mjs` 用 pixelmatch（阈值 0.1）计算差异像素比例，输出差异图到 `tooling/visual/diff/`；通过标准：每张 < 0.5%，且差异区域不落在正文文字区（对照文本快照）。
2. 计算样式快照：对 `pages.json` 里每页约 20 个选择器采集 `getComputedStyle` 的 `font-family/size/weight/line-height/letter-spacing/color/background-color/padding/margin/border/box-shadow/width/height/x/y`，写 JSON；`compare` 输出逐项差异，允许列表只包含 D1–D11 涉及项（如 `.markdown-body.width` 在 ≥1440 视口）。
3. 可见文本快照：每页 `document.body.innerText` 规范化空白后存文本；文章页另存 `.markdown-body` 的 `innerText` 与 `innerHTML`。通过标准：文章正文 `innerText` 完全一致；`innerHTML` 只允许 `figure`/`figcaption`/`loading`/`decoding`/`heading-anchor` 差异（用白名单正则剔除后一致）。

**命令**：`npm run visual:baseline`（从 `pre-bluenote-theme` 标签的构建产物采集，或直接读取已保存基线）、`npm run visual:capture`（当前构建）、`npm run visual:compare`。本地运行，不进 CI（Chromium 体积大，且视觉对比需要人看差异图）。

### 5.2 结构与依赖断言（进入 `npm run check`）

在 `validate-site.mjs` 中新增：
- 所有 HTML 中不存在 `https://` 的 `<link rel="stylesheet">` 与 `<script src>`；不存在 `alicdn`、`baomitu`、`bootstrap`、`jquery`、`fluid`、`iconfont` 字样。
- 每个 HTML 含 `<html … data-root="/bluenote/"`、`<meta name="theme-color"`、头部内联的 scheme 初始化脚本、`css/bluenote.css?v=`、`js/bluenote.js?v=`。
- `public/` 中不存在 `css/main.css`、`js/boot.js`、`xml/`、`vendor/bootstrap`、`vendor/jquery`、`vendor/iconfont`。
- 主题合并后的 `css/bluenote.css` 中 `!important` 只出现在 `[hidden]` 与 `@media print` 段落。
- 每篇文章的 `<article class="post-content">` 内 `.markdown-body` 的纯文本（去标签）与源 Markdown 渲染结果一致（用 `hexo.render` 独立渲染后比较，防止主题过滤器改动正文）。
- 现有断言按附录 C 迁移。

### 5.3 校对

1. 文字校对：5.1 的文本快照保证正文零改动；另对导航文案（Home/Archives/Gallery/About/Search）、页眉标题、上一篇/下一篇文案、Design Doc 条目文案、404 文案逐一与现站对照。
2. 文档校对：`README.md`、`docs/*.md`、主题 `README.md` 中的文件路径全部用 `ls` 验证存在；命令全部实际运行一次；`DESIGN.md` §11 的职责表与仓库目录一一对应。
3. 配置校对：`_config.bluenote.yml` 每个键在主题 `_config.yml` 里有默认值与注释；未知键构建时告警（主题 `helpers.js` 做一次浅校验）。
4. 许可证校对：`themes/bluenote/LICENSE` 与 `source/vendor/LICENSES.md` 列出 typed.js、github-markdown-css、highlight.js 样式的许可证原文与版本。

### 5.4 交互回归清单（人工，桌面 Safari + Chrome，iPhone Safari 或模拟器）

| 项 | 步骤 | 期望 |
| --- | --- | --- |
| 日夜切换 | 点击图标；刷新；改系统外观；再点回与系统一致 | 立即切换，刷新保持；系统变化实时跟随；回到一致时偏好清除；图标悬停显示目标模式 |
| 旧偏好迁移 | 在旧站设为 dark 后打开新站 | 仍为 dark，`localStorage` 只剩新键 |
| 首页 | 打字标语；滚动 30% 标语淡出；卡片悬停；键盘 Tab 到卡片 | 与现在一致；焦点框可见 |
| 手机菜单 | 打开、点链接、旋转/放大到桌面宽度、Esc | 打开/关闭动画；点链接关闭；变宽自动关闭；`body` 不可滚动 |
| 搜索 | 菜单点 Search；输入；Esc；手机菜单打开时点 Search | 面板打开、结果正确、关闭恢复焦点；手机菜单自动关闭 |
| 私密文章 | 未解锁首页不见《小蓝本》；归档 LOCKED；文章页 Unlock 输错/输对；归档 UNLOCKED 点击退出 | 全部与现在一致 |
| 文章页 | 目录点击定位与高亮（用含标题的临时草稿测试）；上一篇/下一篇；标题锚点悬停；图片点击灯箱与键盘 | 一致或按 D10 |
| 照片文章 | 图片宽版、srcset 选图、首图 eager | 与现在一致 |
| Gallery | A few/All 切换、Reshuffle、大图、左右键、Esc、缩放 | 与现在一致（代码未动） |
| Design Doc | 表格横向滚动、代码块、目录内链接 | 一致 |
| 404 | 打开不存在的地址 | 编辑式 404，可返回首页 |
| 打印 | 文章页打印预览 | 无导航、页眉、目录；正文完整 |
| 无 JS | 禁用 JS 打开首页、文章、Gallery | 布局正确（body class 构建期写入），Gallery 显示 noscript 照片 |

### 5.5 发布前后验证

- 发布前：`npm ci && npm run check && npm run visual:compare`；`git status` 干净；`public/` 未提交。
- 发布后：线上首页、一篇文章、归档、Gallery、Design Doc 各打开一次；浏览器开发者工具 Network 面板确认没有第三方域名请求；`view-source` 确认 `css/bluenote.css?v=` 哈希与本地构建一致；手机实机看一次深色与菜单。

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Bootstrap Reboot/栅格的隐性默认值遗漏（如 `line-height:1.5`、`h1-h6` 外边距、`.container` 断点宽度） | 局部几像素偏移 | 样式快照按选择器逐项对比；`01-base.css` 从 Reboot 中只抄可见影响项 |
| github-markdown-css 与 Fluid `markdown.styl` 的叠加顺序 | 标题、表格、代码块细节 | D5 第一阶段原样 vendored，且保持原加载顺序：markdown-base → 主题覆盖 → 站点 CSS |
| 字体回退：Charter/Songti 在不同机器不同 | 截图差异非本次改动造成 | 基线与当前在同一台机器同一浏览器采集；CI 不跑视觉对比 |
| Gallery 随机小展每次不同 | 截图无法比较 | 采集时注入固定随机种子 |
| `validate-site.mjs` 改动过多引入错误 | 门槛失效 | 附录 C 逐条对应，先在 Fluid 构建上跑“旧断言”、在新构建上跑“新断言”，两组都要通过各自的构建 |
| `private.js`/`search.js` 选择器改名遗漏 | 锁标、搜索失效 | 5.4 清单；`validate-private-vault.mjs` 保留 |
| 读者浏览器缓存旧 CSS | 短时样式错乱 | 资源版本号机制保留，文件名也换了（`bluenote.css`） |
| 拆分独立仓库后两边漂移 | 维护成本 | 阶段 5 再拆；拆前主题里不能有 Blue Note 专属值 |

---

## 附录 A：基线测量值（2026-09-04，本机 Chromium，浅色，除注明外为 1280×900）

| 元素 | 值 |
| --- | --- |
| `html` | 16px，字距 0.32px（0.02em），Times 字体栈 |
| `body` | 行高 24px，`#eee9df` / `#3e3a34`；深色 `#302f2d` / `#dedad2` |
| 导航 `#navbar` | 高 64px，内边距 12px 16px，14px，顶部透明，阴影 `0 2px 5px rgba(0,0,0,.16), 0 2px 10px rgba(0,0,0,.12)`；手机高 66px，内边距 8px 16px，16px/40px |
| 站名 | 20px 粗体白色，行高 30px |
| 菜单项 | 14px，字距 0.77px，白色；悬停 `#f3dca6` |
| 三线按钮 | 54×28，线条 30×20 |
| 首页导航底色 | `#2f4154`（深色 `#1f3144`） |
| 首页封面遮罩 | `linear-gradient(rgba(3,15,25,.3) 0%, rgba(3,15,25,.1) 45%, rgba(3,15,25,.28) 100%)` |
| 首页标语 | 32px 白色，行高 38.4px |
| 首页 `main` | 上内边距 72px，最小高 100svh |
| 卡片网格 | 4×216px，间距 13.5px，容器 1180px |
| 卡片 | `#091821`，阴影 `0 10px 26px rgba(2,9,14,.14)`；标题 22.5px/28.1px `#e9e8e2`；摘要 14.08px/21.8px `rgba(220,221,216,.72)`；日期 11.2px `rgba(218,218,211,.64)` 字距 .45px，图标 0.75 透明度 |
| 页眉 | 216px（手机 176px），`#53616b`（深色 `#282a2b`）；文字容器 760px 贴底；标题 27.52px/34.4px，字距 .96px，`#f4f1eb`（深色 `#eeeae3`）；手机标题 24px/30px，容器 358px，下内边距 30.4px |
| 内容容器 `#board` | 上 52px 下 64px（手机上 40px）；非文章页容器 760px |
| 文章列 | `.post-content` 789px，左右各 78.9px 内边距 → `.markdown-body` 631px；手机 358px，左右 16px |
| 正文 | Charter 栈，17px/30.26px，段距 19.55px，`.markdown-body` 下外边距 32px |
| `.literary-panel`（公式面板） | 20.48px，内边距 28/26.4/25.6px，上 36px 下 40px，底 `rgba(99,117,131,.08)`，线 `rgba(62,58,52,.16)`；手机内边距 23.2/17.6px |
| 上一篇/下一篇 | 14.4px，上下外边距 16px |
| 目录 `#toc` | 侧栏宽 212px；当前文章无标题时 `visibility:hidden` |
| 归档 | 容器 760px；年份 13.76px 500 字距 1.1px `#777168`，下 7.2px；条目 54px 高，内边距 12.48px 3.2px，底线 1px；日期 12.8px 占 72px；标题 16px；SITE 上距 36px；DOC 11.52px；摘要 12.48px |
| About | 头像 128px 圆形 1px 线；名字 23.2px 500；简介 16px `#777168`；正文上距 40px |
| Design Doc | 首段 13.44px/22.2px `#777168` 底线 下 40px；h2 21.6px 500 上 52px 下 20px 底线；h3 16.8px 600 上 33.6px 下 14.4px；表格 14.08px，th 底 `rgba(99,117,131,.06)` 内边距 10.4px 12px 600；`pre` 底 `#f6f8fa`（深色 `#303030`）1px 线 内边距 23.2px 16px，代码 SFMono 12.43px；行内代码 14.62px 底 `rgba(175,184,193,.2)` 3px 圆角；`ul` 左 34px |
| 手机菜单 | 全屏 `#53616b`，z-index 1029，上 70.4px，容器 358px；项内边距 15.2px，底线 `rgba(255,255,255,.14)`；文字 14.72px 字距 .81px 白色左对齐；Search 与切换图标 16px 右置 |
| 深色 token（实测） | 文字 `#dedad2`、正文 `#d8d4cc`、标题 `#e8e3da`、次要 `#aaa59d`、链接 `#b8c0c5`、悬停 `#d0d5d8`、线 `rgba(222,218,210,.16)`、页眉 `#282a2b`、代码底 `#303030`、行内代码 `rgba(99,110,123,.4)`、滚动条 `#687582`；`theme-color` 变为 `#1f3144`（Fluid 默认） |
| 滚动条 | 6px，`#c4c6c9` 悬停 `#a6a6a6`（深色 `#687582`/`#9da8b3`） |
| 日夜切换 | 浅色时显示 `icon-light`，悬停切换为对面图标；首次加载 `data-user-color-scheme="light"` 即写入 |

## 附录 B：DOM 契约（站点级代码依赖，主题必须提供）

| 旧（Fluid） | 新（bluenote） | 依赖方 |
| --- | --- | --- |
| `html.home-root`、`body.home-page` | 不变 | `home.css`（迁入主题）、`private.css`、`validate-site` |
| `body.editorial-page/.post-page/.listing-page/.about-page/.gallery-page/.design-doc-page/.photo-post` | 不变 | `gallery.css`、`design-doc.css`、`thought-notes.css`、`site.css`、`validate-site` |
| `div#banner.banner[style=background: url(...)]`（首页） | `div#banner.home-cover[style=background-image: url(...)]` | `validate-site`（封面预加载断言改写） |
| `.navbar-brand`（取站点根） | `html[data-root]` | `private.js`、`search.js` |
| `#mobile-grid-menu.show`、`.animated-icon.open`、`body.mobile-menu-open` | `BlueNote.nav.close()`；`body.mobile-menu-open` 保留 | `private.js`、`search.js` |
| `.navbar .private-lock-icon`、`.mobile-grid-item .private-lock-icon` | `.site-nav …`、`.site-menu__item …` | `private.css` |
| `.index-card`、`.index-header`、`.index-excerpt` | 不变 | `private.css`、`private.js` |
| `.list-group-item`、`.list-group-item-title` | `.listing__item`、`.listing__title` | `private.js`、`private.css`、`validate-site` |
| `.post-prevnext` | `.post-nav` | `private.css`、`private.js` |
| `article.post-content` > `.markdown-body` | 不变 | `validate-site`、`gallery-page.js` 守卫、内容 CSS |
| `a[href$="#site-search"]` | 不变 | `search.js` |
| `[data-private-link]`、`[data-private-post-id]`、`.private-*` | 不变 | 私密系统 |
| `.literary-panel`、`.literary-block*`、`.thought-note__*` | 不变（`.post-page .markdown-body` 前缀保留） | 文章内容 |
| `.gallery-*`、`[data-gallery-*]` | 不变 | Gallery |
| `#subtitle[data-typed-text]` | 不变 | 打字效果 |
| `#color-toggle-btn`、`#color-toggle-icon` | `button.scheme-toggle`、`.scheme-toggle__icon` | 主题内部；`validate-site` 断言改写 |

## 附录 C：`tooling/validate-site.mjs` 断言变更表

| 现有断言 | 处理 |
| --- | --- |
| 必需文件列表中的 `css/home.css`、`css/custom.css`、`css/typography.css`、`js/site.js`、`js/home.js` | 替换为 `css/bluenote.css`、`js/bluenote.js`、`css/site.css`、`css/design-doc.css`、`css/thought-notes.css`；`css/private.css`、`css/search.css`、`js/private.js`、`js/search.js`、`css/gallery.css`、`js/gallery.js`、`js/gallery-selection.js` 保留 |
| `links/index.html` 不得存在 | 保留 |
| 文章 front matter 与外链图片检查 | 保留 |
| 首页 `<html class="home-root"` 与 `<body class="home-page">` | 保留 |
| 首页封面 `<div id="banner"[^>]*style="background: url(...)` 与 preload 一致 | 改为匹配 `id="banner" class="home-cover"` 与 `background-image: url(...)`；preload 断言不变 |
| 首页 CSS/JS 不得为外链 | 扩展到所有 HTML（5.2） |
| 首页含三篇标题；含自定义资源 `/bluenote/css/home.css` 等 | 标题保留；资源改为 `css/bluenote.css`、`js/bluenote.js`、`css/site.css` |
| 首页导航无 Links、有 Gallery；不加载 gallery 资源 | 保留 |
| `private.css` 含 `.index-card:has(a[data-private-link])` 规则 | 保留 |
| `site.js` 含 `matchMedia('(prefers-color-scheme: dark)')` | 改为检查 `js/bluenote.js` |
| `search.js` 私密过滤字符串 | 保留 |
| 归档 body class、无 “posts in total”、无图片页眉、含 Design Doc 条目 | body class 保留；页眉断言改为“`.masthead` 无 `style=`”；Design Doc 断言改为匹配 `listing__item--entry` 且文案不变 |
| Design 页 body class、`markdown-body design-document`、第一节标题 | 保留 |
| About body class、无图片页眉 | 保留 / 同上改写 |
| Gallery 全部断言 | 保留（标记不变） |
| 全站 `?v=` 版本一致 | 保留（版本逻辑迁入主题） |
| `custom.css` 五项字符串检查 | 改为：`css/bluenote.css` 含 `--masthead-background: #53616b`、`--nav-hover: #f3dca6`（token 名以实际为准）、页眉高度 `216px`、`.scheme-toggle:hover .scheme-toggle__icon` 规则；手机菜单断言改为 HTML 中 `.site-menu` 内除 Search 与切换外无 `<svg`/`<i` |
| 首页无 `icon-home-fill` 等 | 改为全站无 `iconfont`、`alicdn` |
| `scroll-top-button` 不存在 | 保留 |
| 文章页 body class、无图片页眉、照片文章类、图片属性 | 保留 / 页眉断言改写 |
| 本地引用存在性 | 保留 |
| 新增 | 5.2 节全部 |

---

## 执行结果（2026-09-04）

按第 0 节的推荐项执行，另增加执行中发现的 D14、D15。

**完成情况**

- `themes/bluenote/`：11 个布局模板、12 个 partial、5 个构建期脚本、12 个 CSS 源文件（合并为 `css/bluenote.css`，约 59 KB）、8 个 JS 源文件（合并为 `js/bluenote.js`，约 21 KB）、中英文语言包、README、CHANGELOG、LICENSE 与第三方许可证清单。
- 站点：`_config.yml` 改为 `theme: bluenote`；新增 `_config.bluenote.yml`、`source/css/site.css`、`source/css/design-doc.css`、`scripts/private-links.js`；`private.js`、`private.css`、`gallery.css`、`thought-notes.css` 只改了选择器与变量名；删除 `_config.fluid.yml`、`custom.css`、`home.css`、`literary-blocks.css`、`typography.css`、`search.css`、`site.js`、`home.js`、`search.js`、`editorial-layout.js`、`page-loading.js`、`source/vendor/`（Bootstrap、jQuery、iconfont、NProgress）及 Fluid 遗留图片；`package.json` 移除 `hexo-theme-fluid` 与 `hexo-renderer-stylus`。
- 生成结果：任何页面不再引用第三方 CSS/JS；`public/` 中没有 Bootstrap、jQuery、iconfont、Fluid 脚本或 `main.css`。
- 校验：`npm run check` 通过（`validate-site` 按附录 C 改写并新增依赖、token、`!important` 等断言；`validate-private-vault` 与 24 项 Gallery 测试未改动，全部通过）。
- 视觉对比：`tooling/visual/` 的 64 份快照（16 页 × 2 视口 × 2 模式）与 Fluid 基线对比通过。除下列有意差异外，截图像素差异均低于 0.4%，正文文本完全一致：
  - `gallery/all/`：内容区从 1046px 改为 1160px（D14），差异 1.3–5.7%；
  - `design/`：`DESIGN.md` 本身在本次迁移中更新（§2.3、§4.1、§9.1、§11、§12），代码块段落随之下移；文本变更前的对比差异为 0.02–0.11%；
  - 已登记的计算样式差异均为容器嵌套变化或图标由字体改为 SVG，见 `tooling/visual/allowed-differences.json`。
- 交互验证（Chromium）：日夜切换与偏好存储、旧偏好键迁移、系统深色跟随、滚动后导航变实色、图标悬停预览、手机菜单开合与自动关闭、搜索面板与私密文章过滤、私密文章解锁对话框、照片文章灯箱与键盘切换、`prefers-reduced-motion` 下直接显示标语、无 JS 错误。

**执行中修正的认识**

- 旧文章列宽是 Bootstrap 栅格算出的 634.67px（1280px 无滚动条）；固定值定为 `39.667rem` 以精确匹配参考宽度。
- 旧 Gallery 内容区实际只有 1046px，与 `DESIGN.md` 的 1160px 不符（D14）。
- Fluid 在首页深色模式下把标语染成 `#d0d0d0`、导航文字 `#d0d0d0`、导航底色 `#1f3144`；这些未记录的默认值已写入 `DESIGN.md` §2.3 与主题 token。
- `typed.js` 若在构造后立刻 `stop()` 再 `start()`，会启动第二个退格循环；主题改为直接构造。
- Hexo 对主题配置里的数组按下标合并，因此主题默认菜单必须为空数组，回退菜单写在模板中。

**后续处理（2026-09-04 同日）**

1. 私密对话框与搜索面板已改为同时响应系统深色与手动选择（`:root:not([data-scheme="light"])` 加 `:root[data-scheme="dark"]` 双轨），在三种组合下验证通过。
2. 主题已用 `git subtree split` 拆为独立仓库 <https://github.com/CHEology/hexo-theme-bluenote>（保留两次提交的历史，标签 `v1.0.0`）。博客删除 `themes/bluenote`，改以 npm 依赖 `hexo-theme-bluenote`（`git+https://…#v1.0.0`）引入；`themes/` 已加入 `.gitignore` 供本地调试用的克隆使用。拆分后 `npm ci`（禁用 ssh、只走 https）、`npm run check`、视觉对比均通过，生成结果与拆分前一致。
3. `theme/bluenote` 已合并到 `master` 并推送；线上验证记录见本节末尾。

**仍开放的选项**

- 把 `github-markdown-css` 精简为主题实际用到的规则（D5 第二步）。
- 把主题发布到 npm registry（目前通过 git 标签安装已足够）。

**线上验证（2026-09-04）**

- GitHub Actions 运行 33918068824（build、deploy）成功；线上 `css/bluenote.css` 的内容版本与本地构建一致（`00221f7a90f4`）。
- 首页、文章、归档、Gallery、标签、About、Design Doc 均返回 200，页面中只有本站 CSS/JS 引用，没有 Bootstrap、jQuery、iconfont 或 Fluid 脚本；不存在的地址返回编辑式 404。
