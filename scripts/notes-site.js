/* global hexo */
'use strict';

// Blue Note's side of the Notes module (DESIGN.md §9.3): the composer assets, and a
// strict Content-Security-Policy on every notes page, where a device may hold a token
// that can write to the repository.
const { createHash } = require('node:crypto');

function notesSettings(ctx) {
  const notes = ctx.theme.config.notes || {};
  return {
    enable: Boolean(notes.enable),
    path: String(notes.path || 'notes').replace(/^\/+|\/+$/g, ''),
    dir: String(notes.dir || '_notes').replace(/^\/+|\/+$/g, ''),
    compose: notes.compose && notes.compose.repo ? notes.compose : null
  };
}

const attribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

hexo.extend.filter.register('after_render:html', function addComposer(html) {
  const notes = notesSettings(this);
  if (!notes.enable || !notes.compose || !html.includes('<div class="notes')) return html;
  const root = this.config.root.replace(/\/?$/, '/');
  const script = '<script defer src="' + root + 'js/notes-compose.js"' +
    ' data-repo="' + attribute(notes.compose.repo) + '"' +
    ' data-branch="' + attribute(notes.compose.branch || 'main') + '"' +
    ' data-dir="' + attribute([String(this.config.source_dir || 'source').replace(/\/+$/, ''), notes.dir].join('/')) + '"' +
    ' data-timezone="' + attribute(this.config.timezone || 'UTC') + '"' +
    ' data-key-url="' + root + 'private/notes-key.enc.json"' +
    ' data-tags-url="' + root + notes.path + '/tags.json"></script>';
  return html.replace('</head>', '<link rel="stylesheet" href="' + root + 'css/notes-compose.css">\n</head>')
    .replace('</body>', script + '\n</body>');
}, 50);

async function readRoute(path) {
  const chunks = [];
  for await (const chunk of hexo.route.get(path)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

const sha256 = (text) => "'sha256-" + createHash('sha256').update(text, 'utf8').digest('base64') + "'";

// Runs after the theme versions assets (priority 100), so the hashes cover the final HTML.
hexo.extend.filter.register('after_generate', async function notesContentSecurityPolicy() {
  const notes = notesSettings(this);
  if (!notes.enable) return;
  const prefix = notes.path + '/';
  const pages = hexo.route.list().filter((path) => path.startsWith(prefix) && path.endsWith('.html'));
  await Promise.all(pages.map(async (path) => {
    const html = await readRoute(path);
    const scripts = new Set();
    for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\bsrc=/.test(attributes) || /\btype="application\/(?:ld\+)?json"/.test(attributes)) continue;
      scripts.add(sha256(body));
    }
    const handlers = new Set();
    for (const [, body] of html.matchAll(/\son[a-z]+="([^"]*)"/g)) handlers.add(sha256(body.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
    const policy = [
      "default-src 'self'",
      "script-src 'self' " + [...scripts].join(' ') + (handlers.size ? " 'unsafe-hashes' " + [...handlers].join(' ') : ''),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "media-src 'self'",
      "connect-src 'self' https://api.github.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'"
    ].join('; ');
    if (!/<meta charset="UTF-8">/.test(html)) throw new Error('Notes page has no charset meta to anchor its security policy: ' + path);
    hexo.route.set(path, html.replace('<meta charset="UTF-8">',
      '<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">'));
  }));
}, 110);
