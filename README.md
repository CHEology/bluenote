# Blue Note

个人博客：<https://cheology.github.io/bluenote/>

使用 [Hexo](https://hexo.io/) 与仓库内自有主题 [bluenote](themes/bluenote/README.md) 构建，通过 GitHub Pages 发布。主题不依赖任何前端框架、图标字体或第三方请求，可供其他 Hexo 站点复用。

## Project standards

- [设计规范](docs/DESIGN.md)：颜色、字体、字号、行距、行宽、内容框及视觉验收的唯一规范。
- [发文流程](docs/PUBLISHING.md)：从原稿转换、检查到发布与回滚的操作标准。

## Repository structure

```text
.
├── themes/bluenote/   # 自有主题：模板、样式、脚本、配置默认值
├── source/
│   ├── _posts/        # Markdown 文章
│   ├── css/           # 站点专属样式（私密文章、Gallery、Design Doc、随想公式）
│   ├── js/            # 站点专属交互（私密文章、Gallery）
│   └── images/, img/  # 图片资源
├── scripts/           # 站点构建处理（Gallery、Design Doc、私密链接标记）
├── tooling/           # 内容、构建与视觉对比检查
├── _config.yml        # Hexo 配置
├── _config.bluenote.yml # 主题站点配置
└── .github/workflows/ # GitHub Pages 发布
```
