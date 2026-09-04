/* global hexo */
'use strict';

const { slugize, stripHTML } = require('hexo-util');

const anchorIcon = '<svg class="icon icon--link" aria-hidden="true" focusable="false"><use href="#icon-link"></use></svg>';
const imageFile = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

/* Find the inner ranges of every `<div class="markdown-body ...">` in a rendered page. */
function markdownBlocks(html) {
  const blocks = [];
  const opener = /<div\b[^>]*\bclass="[^"]*\bmarkdown-body\b[^"]*"[^>]*>/g;
  let open;
  while ((open = opener.exec(html))) {
    const innerStart = open.index + open[0].length;
    const tags = /<\/?div\b[^>]*>/g;
    tags.lastIndex = innerStart;
    let depth = 1;
    let innerEnd = -1;
    let tag;
    while ((tag = tags.exec(html))) {
      if (tag[0][1] === '/') {
        depth -= 1;
        if (depth === 0) { innerEnd = tag.index; break; }
      } else {
        depth += 1;
      }
    }
    if (innerEnd === -1) break;
    blocks.push({ start: innerStart, end: innerEnd });
    opener.lastIndex = innerEnd;
  }
  return blocks;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=("([^"]*)"|'([^']*)')`, 'i'));
  if (!match) return '';
  return match[2] !== undefined ? match[2] : match[3];
}

function addAttributes(tag, attributes) {
  return tag.replace(/\s*(\/?)>$/, (end, slash) => `${attributes}${slash}>`);
}

function enhance(inner, options) {
  const ids = new Set();

  if (options.anchors) {
    inner = inner.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (match, level, attrs = '', text) => {
      if (/class="[^"]*\bheading-anchor\b/.test(text)) return match;
      let id = attribute(`<h${attrs}>`, 'id');
      if (!id) {
        const base = slugize(stripHTML(text).trim(), { transform: 1 }) || 'section';
        id = base;
        let counter = 1;
        while (ids.has(id)) id = `${base}-${counter++}`;
        attrs += ` id="${id}"`;
      }
      ids.add(id);
      const anchor = `<a class="heading-anchor" href="#${encodeURI(id)}" aria-hidden="true" tabindex="-1">${anchorIcon}</a>`;
      // hexo-renderer-marked already emits an empty <a class="headerlink">; reuse it instead of adding a second anchor.
      const headerlink = /<a\b[^>]*\bclass="headerlink"[^>]*>\s*<\/a>/;
      if (headerlink.test(text)) return `<h${level}${attrs}>${text.replace(headerlink, '')}${anchor}</h${level}>`;
      return `<h${level}${attrs}>${text}${anchor}</h${level}>`;
    });
  }

  if (options.captions) {
    inner = inner.replace(/<p>\s*((?:<a\b[^>]*>)?\s*<img\b[^>]*>\s*(?:<\/a>)?)\s*<\/p>/g, (match, imageHtml) => {
      const imageTag = imageHtml.match(/<img\b[^>]*>/)[0];
      const caption = attribute(imageTag, 'title') || attribute(imageTag, 'alt');
      if (!caption) return match;
      if (options.skipFilenameAlt && imageFile.test(caption.trim())) return match;
      return `<figure class="figure">${imageHtml}<figcaption class="image-caption">${caption}</figcaption></figure>`;
    });
  }

  let imageIndex = 0;
  inner = inner.replace(/<img\b[^>]*>/g, (tag) => {
    const first = imageIndex === 0;
    imageIndex += 1;
    let additions = '';
    if (!/\bloading=/i.test(tag)) additions += ` loading="${first ? 'eager' : 'lazy'}"`;
    if (!/\bdecoding=/i.test(tag)) additions += ' decoding="async"';
    return additions ? addAttributes(tag, additions) : tag;
  });

  return inner;
}

/* Heading anchors, figure captions and native lazy loading for every markdown body. */
hexo.extend.filter.register('after_render:html', function enhanceMarkdown(html) {
  if (!html || !html.includes('markdown-body')) return html;
  const post = this.theme.config.post || {};
  const captions = post.figure_captions || {};
  const options = {
    anchors: post.heading_anchors !== false,
    captions: captions.enable !== false,
    skipFilenameAlt: captions.skip_filename_alt !== false
  };
  const blocks = markdownBlocks(html);
  if (!blocks.length) return html;
  let output = '';
  let cursor = 0;
  for (const block of blocks) {
    output += html.slice(cursor, block.start) + enhance(html.slice(block.start, block.end), options);
    cursor = block.end;
  }
  return output + html.slice(cursor);
}, 20);
