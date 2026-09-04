const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { validateGallery, renderGallery } = require('../tooling/lib/gallery.cjs');

hexo.extend.generator.register('gallery', function generateGallery() {
  const manifest = JSON.parse(readFileSync(join(hexo.source_dir, '_data/gallery.json'), 'utf8'));
  const photos = validateGallery(manifest, hexo.source_dir);
  return ['few', 'all'].map(mode => ({
    path: mode === 'few' ? 'gallery/index.html' : 'gallery/all/index.html',
    layout: 'page',
    data: {
      title: 'Gallery',
      subtitle: 'Gallery',
      comments: false,
      body_class: 'gallery-page',
      content: renderGallery(photos, hexo.config.root, { mode })
    }
  }));
});

hexo.extend.filter.register('after_render:html', function galleryAssets(html) {
  if (!html.includes('class="gallery-collection"') || !html.includes('</head>')) return html;
  const root = hexo.config.root.replace(/\/?$/, '/');
  return html
    .replace('</head>', '<link rel="stylesheet" href="' + root + 'css/gallery.css">\n</head>')
    .replace('</body>', (html.includes('data-gallery-model') ? '<script defer src="' + root + 'js/gallery-selection.js"></script>\n' : '') + '<script defer src="' + root + 'js/gallery.js"></script>\n</body>');
}, 40);
