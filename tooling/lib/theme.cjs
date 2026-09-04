const { existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const checkout = join(__dirname, '../../themes/bluenote');
const themeRoot = existsSync(join(checkout, 'package.json')) ? checkout : dirname(require.resolve('hexo-theme-bluenote/package.json'));
module.exports = { themeRoot, themeFile: (...parts) => join(themeRoot, ...parts) };
