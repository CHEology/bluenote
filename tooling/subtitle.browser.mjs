import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, statSync} from 'node:fs';
import {resolve, join, extname, sep} from 'node:path';
import {chromium, webkit} from 'playwright';
const publicDir = resolve('public');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    assert(pathname.startsWith('/bluenote/'));
    let file = resolve(publicDir, pathname.slice('/bluenote/'.length));
    assert(file === publicDir || file.startsWith(publicDir + sep));
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    let content = readFileSync(file);
    if (extname(file) === '.html') content = content.toString().replace(/<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">/g, '');
    res.writeHead(200, {'content-type': mime[extname(file)] || 'application/octet-stream'});
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = (process.env.BLUE_NOTE_ORIGIN || 'http://127.0.0.1:' + server.address().port) + '/bluenote/';
try {
  for (const [name, engine] of Object.entries({chromium, webkit})) {
    const browser = await engine.launch();
    try {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion});
        await page.goto(url);
        const line = page.locator('.letterbox-dock__line span');
        const slogan = 'Dream to be a tranquil spectator.';
        const links = page.locator('.letterbox-entry__link');
        const first = links.nth(0), second = links.nth(1);
        async function expectSlogan() {
          await page.waitForTimeout(300);
          assert.equal(await line.innerText(), slogan);
          assert.equal(await page.locator('.letterbox-dock').evaluate(e => e.classList.contains('is-idle')), true);
        }
        // The lower bar keeps the slogan: no previews on pointer, focus or narrow screens.
        assert.equal(await links.evaluateAll(all => all.filter(a => a.hasAttribute('data-excerpt')).length), 0);
        await expectSlogan();
        await first.hover(); await expectSlogan();
        await first.locator('.letterbox-entry__title').hover(); await expectSlogan();
        await second.hover(); await expectSlogan();
        await first.focus(); await expectSlogan();
        await second.focus(); await expectSlogan();
        await page.setViewportSize({width: 390, height: 844}); await expectSlogan();
        await page.close();
        console.log(`${name}, ${reducedMotion}: the slogan stays under pointer, keyboard and on phones`);
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(r => server.close(r)); }
