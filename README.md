# Blue Note

Blue Note 是一个以 Markdown 为唯一文章源、由 Hexo 构建并通过 GitHub Actions 发布到 GitHub Pages 的静态博客。

- 线上地址：<https://cheology.github.io/bluenote/>
- 源码仓库：<https://github.com/CHEology/bluenote>
- 发布分支：`master`
- Node.js：22（CI），最低支持 20.19
- Hexo：8.1.2
- Fluid：1.9.9

## 当前结果

2026-08-27 已完成从“只保存生成后 HTML”到“保存 Markdown 源码并自动构建”的迁移：

- 现有 3 篇文章已恢复到 `source/_posts/*.md`。
- 文章日期、URL、标签、图片链接和正文内容均已保留。
- 首页网格、文章阅读配色、宽版图集和 About 页面定制已迁移到源码层。
- 构建产物统一写入 `public/`，不再提交到 Git。
- 每次推送 `master` 都会由 GitHub Actions 重新构建、检查并发布。
- 本地验证会检查必需页面、文章数量和全部站内资源链接。

旧版静态文件仍可从 2026-08-27 之前的 Git 提交中查看或恢复，但不再作为当前源码维护。

## 项目结构

```text
.
├── source/
│   ├── _posts/          # Markdown 文章；日常内容维护入口
│   ├── images/          # 站点及文章图片
│   ├── css/             # Blue Note 自定义样式
│   ├── js/              # Blue Note 自定义交互
│   ├── about/           # About 页面
│   └── links/           # Links 页面
├── scaffolds/post.md    # 新文章模板
├── tooling/             # 构建结果校验
├── _config.yml          # Hexo 站点配置
├── _config.fluid.yml    # Fluid 主题覆盖配置
├── package.json         # 固定版本、构建命令
└── .github/workflows/   # GitHub Pages 自动发布
```

`node_modules/`、`db.json` 和 `public/` 都是可再生成内容，不应提交。

## 本地运行

首次安装：

```bash
npm ci
```

启动预览：

```bash
npm run server
```

打开 <http://localhost:4000/bluenote/>。

执行与 CI 相同的完整检查：

```bash
npm run check
```

只有 `npm run check` 通过后才应发布。

## 新增文章

创建标准文章文件：

```bash
npm run new -- "文章标题"
```

然后编辑 `source/_posts/文章标题.md`。不要直接修改 `public/` 或仓库根目录的 HTML；首页、归档、标签和搜索索引都会由 Hexo 自动生成。

完整的文章字段、图片规范、格式转换、检查、发布和回滚流程见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## 发布机制

向 `master` 推送后，[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 会依次执行：

1. 使用 `npm ci` 安装锁定版本。
2. 使用 Hexo 从 Markdown 生成 `public/`。
3. 运行 `tooling/validate-site.mjs` 检查生成结果。
4. 将 `public/` 作为不可变构建产物部署到 GitHub Pages。

Pull Request 只构建和检查，不会部署。发布不依赖本地安装的 Hexo，也不需要把生成 HTML 提交到仓库。

## 恢复历史内容

历史中删除的文章和图片仍保留在 Git 记录里。可先定位路径：

```bash
git log --all --name-status -- 2023/
```

再从目标提交提取旧文件用于人工迁移：

```bash
git restore --source=<commit> -- '2023/目标路径'
```

提取的旧 HTML 应转换为 Markdown 并放入 `source/_posts/`，不应重新作为根目录静态文件发布。
