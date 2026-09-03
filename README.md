# Blue Note

个人博客：<https://cheology.github.io/bluenote/>

使用 [Hexo](https://hexo.io/) 与 [Fluid](https://github.com/fluid-dev/hexo-theme-fluid) 构建，通过 GitHub Pages 发布。

## Project standards

- [设计规范](docs/DESIGN.md)：颜色、字体、字号、行距、行宽、内容框及视觉验收的唯一规范。
- [发文流程](docs/PUBLISHING.md)：从原稿转换、检查到发布与回滚的操作标准。

## Repository structure

```text
.
├── source/
│   ├── _posts/        # Markdown 文章
│   ├── css/           # 自定义样式
│   ├── js/            # 页面交互
│   └── images/, img/  # 图片资源
├── scripts/           # 构建处理
├── tooling/           # 内容与构建检查
├── _config.yml        # Hexo 配置
├── _config.fluid.yml  # Fluid 配置
└── .github/workflows/ # GitHub Pages 发布
```
