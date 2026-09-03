const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { groupRows } = require('../../source/js/gallery.js');
const { imageDimensions } = require('./image-dimensions.cjs');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function validateGallery(manifest, sourceRoot) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.photos)) {
    throw new Error('Gallery requires version: 1 and a photos array.');
  }
  const ids = new Set();
  return manifest.photos.map((photo) => {
    if (!photo || typeof photo.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(photo.id) || ids.has(photo.id)) {
      throw new Error('Gallery photo IDs must be unique, lowercase, and URL-safe.');
    }
    ids.add(photo.id);
    if (typeof photo.alt !== 'string' || !photo.alt.trim()) {
      throw new Error('Missing Gallery alt text: ' + photo.id);
    }
    if (photo.caption !== undefined && typeof photo.caption !== 'string') {
      throw new Error('Gallery captions must be author-supplied text: ' + photo.id);
    }
    const checkImage = (image) => {
      if (!image || !/^\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png)$/i.test(image.src) ||
          image.src.split('/').some((part) => part === '..' || part === '.')) {
        throw new Error('Gallery image must use a local /images/ path: ' + photo.id);
      }
      if (![image.width, image.height].every((size) => Number.isInteger(size) && size > 0)) {
        throw new Error('Gallery image requires its real pixel dimensions: ' + photo.id);
      }
      if (sourceRoot && !existsSync(join(sourceRoot, image.src.slice(1)))) {
        throw new Error('Gallery image not found: ' + image.src);
      }
      if (sourceRoot) {
        const actual = imageDimensions(join(sourceRoot, image.src.slice(1)));
        if (!actual || actual.width !== image.width || actual.height !== image.height) {
          throw new Error('Gallery dimensions do not match the actual image: ' + image.src);
        }
      }
      return image;
    };
    const full = checkImage(photo.full);
    if (!Array.isArray(photo.previews) || photo.previews.length === 0) {
      throw new Error('Gallery requires separate previews: ' + photo.id);
    }
    const widths = new Set();
    const paths = new Set();
    const previews = photo.previews.map(checkImage).sort((a, b) => a.width - b.width);
    for (const preview of previews) {
      const ratioError = Math.abs((preview.width / preview.height) / (full.width / full.height) - 1);
      if (preview.src === full.src || preview.width >= full.width || preview.height > full.height ||
          ratioError > 0.01 || widths.has(preview.width) || paths.has(preview.src)) {
        throw new Error('Gallery previews must preserve framing, be smaller, and have unique widths: ' + photo.id);
      }
      widths.add(preview.width);
      paths.add(preview.src);
    }
    return { id: photo.id, alt: photo.alt, caption: photo.caption || '', full, previews };
  });
}

function renderGallery(photos, root) {
  const base = (root || '/').replace(/\/?$/, '/');
  const url = (path) => base + path.replace(/^\//, '');
  const item = (photo, index) => {
    const full = photo.full;
    const preview = photo.previews[0];
    const srcset = photo.previews.map((image) => url(image.src) + ' ' + image.width + 'w').join(', ');
    return [
      '<figure class="gallery-item" style="--gallery-ratio:' + full.width / full.height + '">',
      '<a class="gallery-photo" href="' + escapeHtml(url(full.src)) + '" data-gallery-open="' + escapeHtml(photo.id) + '"',
      ' data-width="' + full.width + '" data-height="' + full.height + '" aria-label="' + escapeHtml(photo.alt) + '">',
      '<img data-gallery-thumbnail src="' + escapeHtml(url(preview.src)) + '" srcset="' + escapeHtml(srcset) + '"',
      ' sizes="(max-width: 767px) calc(100vw - 3rem), (max-width: 1140px) 50vw, 540px"',
      ' width="' + full.width + '" height="' + full.height + '" alt="' + escapeHtml(photo.alt) + '"',
      ' loading="' + (index < 2 ? 'eager' : 'lazy') + '" decoding="async">',
      '</a>',
      photo.caption ? '<figcaption>' + escapeHtml(photo.caption) + '</figcaption>' : '',
      '</figure>'
    ].join('');
  };
  const rows = groupRows(photos.map((photo) => photo.full.width / photo.full.height), 1080, false);
  let offset = 0;
  const grid = rows.map((count) => {
    const partial = count === 1 && photos[offset].full.width / photos[offset].full.height < 2.7;
    const items = photos.slice(offset, offset + count).map((photo, index) => item(photo, offset + index));
    offset += count;
    return '<div class="gallery-row' + (partial ? ' gallery-row--partial' : '') + '">' + items.join('') + '</div>';
  }).join('\n');

  return [
    '<section class="gallery-collection" aria-label="照片集">',
    '<h1 class="gallery-sr-only">Gallery</h1>',
    photos.length ? '<div class="gallery-grid" data-gallery-grid>' + grid + '</div>' :
      '<p class="gallery-empty">尚未收录照片。</p>',
    '</section>',
    photos.length ? [
      '<dialog class="gallery-viewer" aria-label="照片浏览" data-gallery-viewer>',
      '<div class="gallery-viewer-toolbar">',
      '<p class="gallery-viewer-count" data-gallery-count aria-live="polite" aria-atomic="true"></p>',
      '<div class="gallery-viewer-controls">',
      '<button type="button" data-gallery-prev aria-label="上一张"><span aria-hidden="true">←</span></button>',
      '<button type="button" data-gallery-next aria-label="下一张"><span aria-hidden="true">→</span></button>',
      '<button type="button" data-gallery-close aria-label="关闭照片"><span aria-hidden="true">×</span></button>',
      '</div></div>',
      '<div class="gallery-viewer-stage" data-gallery-stage>',
      '<button type="button" class="gallery-image-toggle" data-gallery-zoom aria-label="放大到原始尺寸" aria-pressed="false" hidden></button>',
      '<div class="gallery-viewer-status" data-gallery-status>',
      '<p role="status" data-gallery-message></p>',
      '<a data-gallery-original target="_blank" rel="noopener" hidden>打开原图</a>',
      '</div></div>',
      '<p class="gallery-viewer-caption" data-gallery-caption hidden></p>',
      '</dialog>'
    ].join('') : ''
  ].join('\n');
}

module.exports = { validateGallery, renderGallery };
