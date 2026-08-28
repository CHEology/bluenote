const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function privateManifest() {
  try {
    return JSON.parse(
      readFileSync(join(hexo.base_dir, 'source', 'private', 'posts.public.json'), 'utf8')
    ).posts || [];
  } catch (error) {
    return [];
  }
}

function markPrivateLinks(html) {
  privateManifest().forEach(function(post) {
    var escaped = post.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp('href="' + escaped + '"', 'g'),
      'href="' + post.url + '" data-private-link="' + post.id + '"'
    );
  });
  return html;
}

/* Mark content pages at build time so they share one layout before JavaScript runs. */
hexo.extend.filter.register('after_render:html', function applyEditorialLayout(html) {
  var classes = [];

  html = markPrivateLinks(html);

  if (html.includes('<article class="post-content')) {
    classes.push('editorial-page', 'post-page');
    if (html.includes('data-private-post-id=')) classes.push('private-post-page');
  } else if (html.includes('<div class="list-group">')) {
    classes.push('editorial-page', 'listing-page');
    html = html.replace(
      /(<div class="list-group">\s*)<p class="h4">[^<]*<\/p>\s*<hr>/,
      '$1'
    );
  } else if (html.includes('class="about-content page-content')) {
    classes.push('editorial-page', 'about-page');
  } else if (html.includes('<article class="page-content')) {
    classes.push('editorial-page');
  }

  if (classes.length > 0) {
    html = html.replace(
      /(<div id="banner" class="banner"[^>]*?)\s+style="background:[^"]*"/,
      '$1'
    );
    html = html.replace('<body>', '<body class="' + classes.join(' ') + '">');
  }

  return html;
});
