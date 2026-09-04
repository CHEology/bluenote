/* global hexo */
'use strict';

const { escapeHTML } = require('hexo-util');

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

function declarations(map, prefix) {
  return Object.entries(map || {})
    .filter(([, value]) => !isEmpty(value))
    .map(([key, value]) => `--${prefix}${key}:${String(value).trim()}`)
    .join(';');
}

/* Layout classes are decided at build time so the first paint already has the final design. */
hexo.extend.helper.register('body_classes', function(page) {
  const theme = this.theme;
  const classes = [];

  if (this.is_home()) {
    classes.push('home-page');
  } else if (this.is_post()) {
    classes.push('editorial-page', 'post-page');
    const photo = theme.post && theme.post.photo_layout;
    if (photo && photo.enable !== false) {
      const count = (String(page.content || '').match(/<img\b/gi) || []).length;
      if (count >= (Number(photo.min_images) || 3)) classes.push('photo-post');
    }
    if (page.private_post) classes.push('private-post-page');
  } else if (this.is_archive() || this.is_tag() || this.is_category()) {
    classes.push('editorial-page', 'listing-page');
  } else if (page.layout === 'about') {
    classes.push('editorial-page', 'about-page');
  } else if (page.layout === 'tags' || page.layout === 'categories') {
    classes.push('editorial-page', 'listing-page', `${page.layout}-page`);
  } else if (page.layout === '404') {
    classes.push('error-page');
  } else {
    classes.push('editorial-page');
  }

  if (page.body_class) {
    classes.push(...String(page.body_class).split(/\s+/).filter(Boolean));
  }
  return [...new Set(classes)].join(' ');
});

hexo.extend.helper.register('masthead_title', function(page) {
  const __ = this.__;
  const theme = this.theme;
  if (this.is_post()) return page.subtitle || page.title || '';
  if (this.is_archive()) return (theme.archive && theme.archive.title) || __('archive.title');
  if (this.is_tag()) return [__('tag.title'), page.tag].join(' - ');
  if (this.is_category()) return [__('category.title'), page.category].join(' - ');
  if (page.layout === 'about') return (theme.about && theme.about.title) || __('about.title');
  if (page.layout === 'tags') return __('tag.title');
  if (page.layout === 'categories') return __('category.title');
  if (page.layout === '404') return __('page404.title');
  return page.subtitle || page.title || '';
});

hexo.extend.helper.register('page_title', function(page) {
  if (this.is_post()) return page.title || '';
  if (page.layout === 'about' || this.is_archive() || this.is_tag() || this.is_category() ||
      page.layout === 'tags' || page.layout === 'categories' || page.layout === '404') {
    return this.masthead_title(page);
  }
  return page.title || this.masthead_title(page);
});

hexo.extend.helper.register('theme_color', function() {
  const colors = this.theme.colors || {};
  if (this.is_home()) return (colors.home && colors.home.nav) || '#2f4154';
  return (colors.light && colors.light.masthead) || '#53616b';
});

/* Colour and font tokens come from the theme configuration; the site can override any of them. */
hexo.extend.helper.register('theme_tokens_css', function() {
  const theme = this.theme;
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};
  const light = declarations(colors.light, '');
  const home = declarations(colors.home, 'home-');
  let dark = declarations(colors.dark, '');
  Object.entries(colors.home || {}).forEach(([key, value]) => {
    if (key.endsWith('-dark') && !isEmpty(value)) dark += `;--home-${key.slice(0, -5)}:${String(value).trim()}`;
  });
  const fontVars = [
    fonts.ui ? `--font-ui:${fonts.ui}` : '',
    fonts.prose ? `--font-prose:${fonts.prose}` : '',
    fonts.math ? `--font-math:${fonts.math}` : '',
    fonts.mono ? `--font-mono:${fonts.mono}` : '',
    !isEmpty(fonts.letter_spacing) ? `--letter-spacing:${fonts.letter_spacing}` : ''
  ].filter(Boolean).join(';');
  const rootBlock = [light, home, fontVars].filter(Boolean).join(';');
  let css = `:root{${rootBlock}}`;
  if (theme.dark_mode && theme.dark_mode.enable && dark) {
    css += `@media (prefers-color-scheme: dark){:root:not([data-scheme="light"]){${dark}}}:root[data-scheme="dark"]{${dark}}`;
  }
  return css;
});

/* Inline in <head>: apply a saved colour-scheme preference before the first paint. */
hexo.extend.helper.register('scheme_boot_script', function() {
  if (!(this.theme.dark_mode && this.theme.dark_mode.enable)) return '';
  return '(function(){var d=document.documentElement,k=d.getAttribute("data-scheme-storage")||"bluenote.color-scheme",o=d.getAttribute("data-scheme-legacy"),s=null;'
    + 'try{s=localStorage.getItem(k);if(!s&&o){var l=localStorage.getItem(o);if(l==="dark"||l==="light"){s=l;localStorage.setItem(k,l);}if(l!==null){localStorage.removeItem(o);}}}catch(e){}'
    + 'var f=d.getAttribute("data-scheme-default");if(!s&&(f==="dark"||f==="light")){s=f;}'
    + 'if(s==="dark"||s==="light"){d.setAttribute("data-scheme",s);}})();';
});

hexo.extend.helper.register('post_toc', function(page) {
  const options = this.theme.post && this.theme.post.toc;
  if (!options || !options.enable || page.toc === false || !page.content) return '';
  return this.toc(page.content, {
    list_number: false,
    min_depth: Number(options.min_depth) || 1,
    max_depth: Number(options.max_depth) || 6,
    class: 'toc'
  });
});

hexo.extend.helper.register('icon', function(name, className) {
  const classes = ['icon', `icon--${name}`];
  if (className) classes.push(className);
  return `<svg class="${escapeHTML(classes.join(' '))}" aria-hidden="true" focusable="false"><use href="#icon-${escapeHTML(name)}"></use></svg>`;
});
