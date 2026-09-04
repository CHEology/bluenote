/* global hexo */
'use strict';

const { createHash } = require('node:crypto');

async function readRoute(path) {
  const chunks = [];
  for await (const chunk of hexo.route.get(path)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/* Append a content hash to every site-hosted CSS/JS reference so caches refresh
   exactly when a file changes. Runs after all routes exist. */
hexo.extend.filter.register('after_generate', async function versionAssets() {
  if (this.theme.config.asset_version === false) return;
  const root = hexo.config.root.replace(/\/?$/, '/');
  const routes = hexo.route.list();
  const versions = new Map();

  await Promise.all(routes.filter((path) => /\.(css|js)$/.test(path)).map(async (path) => {
    const contents = await readRoute(path);
    versions.set(root + path, createHash('sha256').update(contents).digest('hex').slice(0, 12));
  }));

  await Promise.all(routes.filter((path) => path.endsWith('.html')).map(async (path) => {
    const html = (await readRoute(path)).toString('utf8');
    const versioned = html.replace(/<(?:link|script)\b[^>]*>/g, (element) =>
      element.replace(/\b(href|src)="([^"?#]+)(?:\?([^"#]*))?(#[^"]*)?"/g, (tag, attr, url, query = '', fragment = '') => {
        if (!url.startsWith(root)) return tag;
        let decoded = url;
        try { decoded = decodeURI(url); } catch (error) { /* keep as is */ }
        const version = versions.get(decoded);
        if (!version) return tag;
        const params = new URLSearchParams(query.replaceAll('&amp;', '&'));
        params.set('v', version);
        return `${attr}="${url}?${params.toString().replaceAll('&', '&amp;')}${fragment}"`;
      })
    );
    if (versioned !== html) hexo.route.set(path, versioned);
  }));
}, 100);
