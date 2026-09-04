/* global hexo */
'use strict';

const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/* The theme keeps its CSS and JS as small ordered files under assets/ and ships
   each as a single request: css/bluenote.css and js/bluenote.js. */
function bundle(directory, extension) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => `/* ${name} */\n${readFileSync(join(directory, name), 'utf8').trim()}\n`)
    .join('\n');
}

hexo.extend.generator.register('bluenote-assets', function() {
  const assets = join(this.theme_dir, 'assets');
  return [
    { path: 'css/bluenote.css', data: () => bundle(join(assets, 'css'), '.css') },
    { path: 'js/bluenote.js', data: () => bundle(join(assets, 'js'), '.js') }
  ];
});
