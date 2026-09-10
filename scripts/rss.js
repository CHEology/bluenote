const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { feedPath, renderFeed, xml } = require('../tooling/lib/rss.cjs');

hexo.extend.generator.register('public-rss', function(locals) {
  const manifest = JSON.parse(readFileSync(join(hexo.source_dir, 'private/posts.public.json'), 'utf8'));
  return { path: feedPath, data: renderFeed(locals.posts.toArray(), hexo.config, manifest) };
});

// Invisible feed discovery for readers; the only visible entrance is on About.
hexo.extend.injector.register('head_end',
  `<link rel="alternate" type="application/rss+xml" title="${xml(hexo.config.title)} RSS" href="${xml(new URL(feedPath, hexo.config.url.replace(/\/?$/, '/')).href)}">`);
