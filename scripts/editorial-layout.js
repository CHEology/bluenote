/* Mark content pages at build time so they share one layout before JavaScript runs. */
hexo.extend.filter.register('after_render:html', function applyEditorialLayout(html) {
  var classes = [];

  if (html.includes('<article class="post-content')) {
    classes.push('editorial-page', 'post-page');
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
    html = html.replace('<body>', '<body class="' + classes.join(' ') + '">');
  }

  return html;
});
