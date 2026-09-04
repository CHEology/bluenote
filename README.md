# Blue Note

个人博客：<https://cheology.github.io/bluenote/>

使用 [Hexo](https://hexo.io/) 与自有主题 [hexo-theme-bluenote](https://github.com/CHEology/hexo-theme-bluenote) 构建，通过 GitHub Pages 发布。主题是独立仓库，以 npm 依赖的方式引入（`package.json` 中锁定版本标签）；它不依赖任何前端框架、图标字体或第三方请求，可供其他 Hexo 站点复用。

## Project standards

- [设计规范](docs/DESIGN.md)：颜色、字体、字号、行距、行宽、内容框及视觉验收的唯一规范。
- [发文流程](docs/PUBLISHING.md)：从原稿转换、检查到发布与回滚的操作标准。

## Repository structure

```text
.
├── node_modules/hexo-theme-bluenote/  # 主题（npm 依赖；源码见 github.com/CHEology/hexo-theme-bluenote）
├── source/
│   ├── _posts/        # Markdown 文章
│   ├── css/           # 站点专属样式（私密文章、Design Doc、随想公式）
│   ├── js/            # 站点专属交互（私密文章）
│   └── images/, img/  # 图片资源
├── scripts/           # 站点构建处理（Design Doc、私密链接标记）
├── tooling/           # 内容、构建与视觉对比检查
├── _config.yml        # Hexo 配置
├── _config.bluenote.yml # 主题站点配置
└── .github/workflows/ # GitHub Pages 发布
```

Gallery 的渲染、抽选、响应式预览和大图观看属于主题的可选模块；本仓库只保存照片清单、照片和导入工具。独立主题仓库另有不含个人内容的最小示例站、桌面／手机截图和本地验证命令，暂不添加主题 CI。
