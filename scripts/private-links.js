const { readFileSync } = require('node:fs');
const { join } = require('node:path');

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
  return html;
});
