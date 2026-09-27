const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');

let privateBoot;
hexo.extend.filter.register('before_generate', function () {
  const encrypted = readFileSync(join(hexo.source_dir, 'private/posts.enc.json'));
  const version = createHash('sha256').update(encrypted).digest('hex').slice(0, 20);
  const script = readFileSync(join(hexo.source_dir, 'js/private-boot.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const url = hexo.config.root.replace(/\/$/, '') + '/private/posts.enc.json?v=' + version;
  privateBoot = '<script id="bluenote-private-boot" data-archive-url="' + url + '">' + script + '</script>';
});

/* Mark every link to a private post at build time so locked visitors never see a
   card for it before JavaScript runs (see source/css/private.css). */
function privateManifest() {
  try {
    return JSON.parse(
      readFileSync(join(hexo.base_dir, 'source', 'private', 'posts.public.json'), 'utf8')
    ).posts || [];
  } catch (error) {
    return [];
  }
}

hexo.extend.filter.register('after_render:html', function markPrivateLinks(html) {
  privateManifest().forEach(function(post) {
    const escaped = post.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp('href="' + escaped + '"', 'g'),
      'href="' + post.url + '" data-private-link="' + post.id + '"'
    );
  });
  return html.replace('</head>', privateBoot + '</head>');
});
