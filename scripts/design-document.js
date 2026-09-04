const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const designSource = join(hexo.base_dir, 'docs', 'DESIGN.md');

function publicMarkdown() {
  return readFileSync(designSource, 'utf8')
    .replace(/^# Blue Note 设计规范\s*\n/, '')
    .replace(
      '](./PUBLISHING.md)',
      '](https://github.com/CHEology/bluenote/blob/master/docs/PUBLISHING.md)'
    )
    .replace(
      '](../AGENTS.md)',
      '](https://github.com/CHEology/bluenote/blob/master/AGENTS.md)'
    );
}

hexo.extend.generator.register('design-document', function generateDesignDocument() {
  return hexo.render.render({
    text: publicMarkdown(),
    engine: 'markdown'
  }).then(function buildPage(content) {
    return {
      path: 'design/index.html',
      layout: 'page',
      data: {
        title: 'Design',
        subtitle: 'Design',
        description: 'Blue Note 的颜色、字体、排版、组件与视觉验收规范。',
        comments: false,
        body_class: 'design-doc-page',
        content: '<div class="markdown-body design-document">' + content + '</div>'
      }
    };
  });
});
