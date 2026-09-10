'use strict';

const { stripHTML } = require('hexo-util');

const feedPath = 'rss.xml';
const xml = value => String(value ?? '')
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function renderFeed(posts, config, manifest) {
  // A missing or malformed exclusion list must stop publication, never expose posts.
  if (manifest?.version !== 1 || !Array.isArray(manifest.posts) ||
      manifest.posts.some(p => !p || typeof p.url !== 'string' || !p.url ||
        typeof p.filename !== 'string' || !p.filename || typeof p.id !== 'string' || !p.id)) {
    throw new Error('RSS requires a valid private-post manifest.');
  }
  const site = config.url.replace(/\/?$/, '/');
  const pathKey = url => decodeURIComponent(new URL(url, site).pathname).replace(/\/$/, '');
  const privatePaths = new Set(manifest.posts.map(p => pathKey(p.url)));
  const privateSources = new Set(manifest.posts.map(p => '_posts/' + p.filename));
  const items = posts.filter(post =>
    post.published !== false && String(post.source || '').startsWith('_posts/') &&
    (post.private_post === undefined || post.private_post === false) && !post.private_id &&
    !privateSources.has(post.source) && !privatePaths.has(pathKey(post.permalink))
  ).map(post => {
    const link = new URL(post.permalink, site);
    if (link.origin !== new URL(site).origin || !link.href.startsWith(site)) {
      throw new Error('RSS article URL must belong to this site.');
    }
    const date = new Date(Number(post.date.valueOf()));
    if (!Number.isFinite(date.getTime())) throw new Error('RSS article requires a valid publication date.');
    // Deliberately use only public metadata, never content, excerpts, vaults or file mtimes.
    return { title: post.title, description: stripHTML(String(post.description || '')),
      link: link.href, date };
  }).sort((a, b) => b.date - a.date || (a.link < b.link ? -1 : a.link > b.link ? 1 : 0));

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(config.title)}</title>
    <link>${xml(site)}</link>
    <description>${xml(config.description)}</description>
    <language>zh-CN</language>
    <atom:link href="${xml(new URL(feedPath, site).href)}" rel="self" type="application/rss+xml" />
${items.map(item => `    <item>
      <title>${xml(item.title)}</title>
      <link>${xml(item.link)}</link>
      <guid isPermaLink="true">${xml(item.link)}</guid>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <description>${xml(item.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
}

module.exports = { feedPath, renderFeed, xml };
