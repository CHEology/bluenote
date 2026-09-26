'use strict';

const { existsSync } = require('node:fs');
const { resolve, sep } = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A single opt-in component keeps author text separate from playback metadata.
hexo.extend.filter.register('before_post_render', function (data) {
  if (!data.music) return data;
  const music = data.music;
  for (const field of ['title', 'artist', 'album', 'audio', 'cover']) {
    if (typeof music[field] !== 'string' || !music[field].trim()) throw new Error(`Invalid music.${field}: ${data.source}`);
  }
  if (!Number.isFinite(music.duration) || music.duration <= 0) throw new Error(`Invalid music.duration: ${data.source}`);
  const asset = (value, prefix) => {
    const file = resolve(this.source_dir, '.' + value);
    if (!value.startsWith(prefix) || /[?#]/.test(value) || !file.startsWith(resolve(this.source_dir) + sep) || !existsSync(file)) {
      throw new Error(`Music requires an existing local ${prefix} asset: ${value}`);
    }
    return escape(this.config.root.replace(/\/$/, '') + value);
  };
  const audio = asset(music.audio, '/audio/posts/');
  const cover = asset(music.cover, '/images/posts/');
  const title = escape(music.title), artist = escape(music.artist), album = escape(music.album);
  const duration = `${Math.floor(music.duration / 60)}:${String(Math.floor(music.duration % 60)).padStart(2, '0')}`;
  const markup = `<div class="post-music no-lightbox" data-post-music data-duration="${music.duration}" role="group" aria-label="文章配乐：${title}">
<img class="post-music__cover" src="${cover}" width="100" height="100" alt="${album} 专辑封面" loading="eager" decoding="async">
<div class="post-music__body">
<div class="post-music__title" lang="ja">${title}</div>
<div class="post-music__metadata">
<div class="post-music__artist"><span lang="ja">${artist}</span> · <span lang="en">${album}</span></div>
</div>
<div class="post-music__loading visually-hidden" role="status"></div>
<audio class="post-music__audio" src="${audio}" controls preload="none" aria-label="${title} — ${artist}"><a href="${audio}">打开音频</a></audio>
<div class="post-music__controls">
<button class="post-music__play" type="button" disabled aria-label="播放">
<svg class="post-music__play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5v15l12-7.5z"/></svg>
<svg class="post-music__pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
</button>
<input class="post-music__seek" type="range" disabled min="0" max="${music.duration}" step="0.1" value="0" aria-label="播放进度" aria-valuetext="0:00 / ${duration}">
<span class="post-music__time"><span data-music-current>0:00</span> / <span data-music-duration>${duration}</span></span>
<div class="post-music__volume-controls">
<button class="post-music__mute" type="button" disabled aria-label="静音" aria-pressed="false">
<svg class="post-music__sound-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
<svg class="post-music__muted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="m16 9 6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
</button>
<input class="post-music__volume" type="range" disabled min="0" max="1" step="0.05" value="0.7" aria-label="音量">
</div>
</div>
<div class="post-music__status" role="status" hidden><span data-music-status></span> <a href="${audio}" data-music-fallback hidden>打开音频</a></div>
</div>
</div>`;
  data.content = `${markup}\n\n${data.content}`;
  return data;
});

// Load the site-owned component only on pages that actually include music.
hexo.extend.filter.register('after_render:html', function (html) {
  if (!html.includes('data-post-music')) return html;
  const root = this.config.root.replace(/\/$/, '');
  return html.replace('</head>', `<link rel="stylesheet" href="${root}/css/post-music.css">\n<noscript><style>.post-music__audio { display: block; } .post-music__controls { display: none; }</style></noscript>\n</head>`)
    .replace('</body>', `<script defer src="${root}/js/post-music.js" onerror="document.documentElement.classList.add('post-music-fallback')"></script>\n</body>`);
}, 30);
