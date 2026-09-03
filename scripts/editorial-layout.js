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

function appendInsideFirstDiv(html, className, fragment) {
  var marker = '<div class="' + className + '">';
  var start = html.indexOf(marker);
  if (start === -1) return html;

  var depth = 0;
  var tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = start;
  var match;

  while ((match = tags.exec(html))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(0, match.index) + fragment + html.slice(match.index);
      }
    } else {
      depth += 1;
    }
  }

  return html;
}

function addArchiveDesignDocument(html) {
  var root = hexo.config.root.endsWith('/') ? hexo.config.root : hexo.config.root + '/';
  var entry = [
    '<p class="h5 archive-design-label">SITE</p>',
    '<a href="' + root + 'design/" class="list-group-item list-group-item-action archive-design-link">',
    '  <span class="archive-design-kind" aria-hidden="true">DOC</span>',
    '  <span class="list-group-item-title archive-design-copy">',
    '    <span>Design Doc</span>',
    '    <span class="archive-design-summary">颜色、字体、排版与组件规范</span>',
    '  </span>',
    '</a>'
  ].join('\n');

  return appendInsideFirstDiv(html, 'list-group', '\n' + entry + '\n');
}

/* Mark content pages at build time so they share one layout before JavaScript runs. */
hexo.extend.filter.register('after_render:html', function applyEditorialLayout(html, data) {
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
    var renderPath = data && typeof data.path === 'string' ? data.path.replace(/\\/g, '/') : '';
    if (renderPath.endsWith('/archives/index.html') || renderPath === 'archives/index.html' || html.includes('<title>Archives - Blue Note</title>')) {
      html = addArchiveDesignDocument(html);
    }
  } else if (html.includes('class="about-content page-content')) {
    classes.push('editorial-page', 'about-page');
  } else if (html.includes('<article class="page-content')) {
    classes.push('editorial-page');
    if (html.includes('class="markdown-body design-document"')) {
      classes.push('design-doc-page');
    }
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
