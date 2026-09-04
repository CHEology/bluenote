/* global hexo */
'use strict';

const { existsSync } = require('node:fs');
const { join } = require('node:path');

hexo.extend.generator.register('bluenote-pages', function() {
  const theme = this.theme.config;
  const routes = [];

  if ((!theme.page404 || theme.page404.enable !== false) && !existsSync(join(this.source_dir, '404.html'))) {
    routes.push({ path: '404.html', layout: '404', data: { layout: '404', title: 'Page not found' } });
  }
  if (!theme.tags || theme.tags.enable !== false) {
    routes.push({ path: 'tags/index.html', layout: 'tags', data: { layout: 'tags', title: 'Tags' } });
  }
  if (theme.categories && theme.categories.enable) {
    routes.push({ path: 'categories/index.html', layout: 'categories', data: { layout: 'categories', title: 'Categories' } });
  }
  return routes;
});
