# Blue Note

个人博客：<https://cheology.github.io/bluenote/>

使用 [Hexo](https://hexo.io/) 与自有主题 [hexo-theme-bluenote](https://github.com/CHEology/hexo-theme-bluenote) 构建，通过 GitHub Pages 发布。主题是独立仓库，以 npm 依赖的方式引入（`package.json` 中锁定版本标签）；它不依赖任何前端框架、图标字体或第三方请求，可供其他 Hexo 站点复用。

## Project standards

- [设计规范](docs/DESIGN.md)：站点视觉、排版、组件交互与验收的统一规范。
- [发文流程](docs/PUBLISHING.md)：内容与资源录入、检查、发布及回滚的操作标准。
- [主题 1.1 与博客复验](docs/VALIDATION-2026-09-04.md)：移动适配、独立安装与线上加载测量。

## Repository structure

```text
.
├── node_modules/hexo-theme-bluenote/  # 主题（npm 依赖；源码见 github.com/CHEology/hexo-theme-bluenote）
├── source/
│   ├── _posts/        # Markdown 文章
│   ├── css/           # 站点专属样式（私密文章、Design Doc、随想公式、配乐）
│   ├── js/            # 站点专属交互（私密文章、配乐）
│   ├── audio/posts/   # 作者选择的完整文章配乐
│   └── images/, img/  # 图片资源
├── scripts/           # 站点构建处理（Design Doc、私密链接标记、配乐组件）
├── tooling/           # 内容、构建与视觉对比检查
├── _config.yml        # Hexo 配置
├── _config.bluenote.yml # 主题站点配置
└── .github/workflows/ # GitHub Pages 发布
```

Gallery 的渲染、抽选、响应式预览和大图观看属于主题的可选模块；本仓库只保存照片清单、照片和导入工具。独立主题仓库另有不含个人内容的最小示例站、桌面／手机截图和本地验证命令，暂不添加主题 CI。
