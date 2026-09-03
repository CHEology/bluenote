const { existsSync, readFileSync } = require('node:fs');
const { extname, join } = require('node:path');

const derivativeLongEdges = [800, 1600, 2880];

function jpegDimensions(path) {
  const data = readFileSync(path);
  let offset = 2;

  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = data.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }

  return null;
}

function addAttribute(tag, name, value) {
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

hexo.extend.filter.register('after_render:html', function responsiveGalleryImages(html) {
  let imageIndex = 0;
  const root = hexo.config.root.endsWith('/') ? hexo.config.root : `${hexo.config.root}/`;

  return html.replace(/<img\b[^>]*\bsrc=(['"])([^'"]*\/images\/galleries\/[^'"]+\.jpe?g)\1[^>]*>/gi, function(tag, quote, sourceUrl) {
    if (tag.includes('data-gallery-thumbnail')) return tag;
    const pathname = decodeURIComponent(sourceUrl.split(/[?#]/)[0]);
    let sourcePath = pathname;
    if (sourcePath.startsWith(root)) sourcePath = sourcePath.slice(root.length);
    sourcePath = sourcePath.replace(/^\/+/, '');

    const baseFile = join(hexo.base_dir, 'source', sourcePath);
    const extension = extname(baseFile);
    const stemUrl = sourceUrl.slice(0, sourceUrl.length - extension.length);
    const variants = derivativeLongEdges.map((longEdge) => ({
      file: baseFile.slice(0, -extension.length) + `-${longEdge}${extension}`,
      url: `${stemUrl}-${longEdge}${extension}`
    }));

    if (!existsSync(baseFile) || variants.some((variant) => !existsSync(variant.file))) return tag;

    const dimensions = jpegDimensions(baseFile);
    if (!dimensions) return tag;
    const variantDimensions = variants.map((variant) => jpegDimensions(variant.file));
    if (variantDimensions.some((variant) => !variant)) return tag;
    variants.forEach((variant, index) => {
      variant.width = variantDimensions[index].width;
    });

    tag = tag
      .replace(/\s(?:srcset|sizes|loading|decoding|fetchpriority|width|height|lazyload)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\slazyload(?=\s|>)/gi, '');

    const srcset = variants
      .concat({ url: sourceUrl, width: dimensions.width })
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(', ');

    tag = addAttribute(tag, 'srcset', srcset);
    tag = addAttribute(tag, 'sizes', '(max-width: 767px) calc(100vw - 3rem), (max-width: 1140px) calc(100vw - 6rem), 1080px');
    tag = addAttribute(tag, 'width', dimensions.width);
    tag = addAttribute(tag, 'height', dimensions.height);
    tag = addAttribute(tag, 'decoding', 'async');
    tag = addAttribute(tag, 'loading', imageIndex === 0 ? 'eager' : 'lazy');
    if (imageIndex === 0) tag = addAttribute(tag, 'fetchpriority', 'high');
    imageIndex += 1;
    return tag;
  });
}, 30);
