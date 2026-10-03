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
        const idle = await line.innerText();
        const links = page.locator('.letterbox-entry__link');
        const first = links.nth(0), second = links.nth(1);
        const excerpt = await first.getAttribute('data-excerpt');
        async function expectLine(text) {
          await page.waitForTimeout(300);
          assert.equal(await line.innerText(), text);
          assert.equal(await page.locator('.letterbox-dock').evaluate(e => e.classList.contains('is-swapping')), false);
        }
        await first.hover(); await expectLine(excerpt);
        // The year heading is inside the index, outside any article link.
        await page.locator('.letterbox-year__title').first().hover(); await expectLine(idle);
        await first.locator('time').hover(); await expectLine(excerpt);
        await first.locator('.letterbox-entry__title').hover(); await expectLine(excerpt);
        await second.hover(); await expectLine(await second.getAttribute('data-excerpt'));
        await page.mouse.move(30, 300); await expectLine(idle);
        // Leaving during either stage of the text transition must not leave stale text.
        for (const delay of [10, 110]) {
          await first.hover(); await page.waitForTimeout(delay);
          await page.locator('.letterbox-year__title').first().hover(); await expectLine(idle);
        }
        await first.focus(); await expectLine(excerpt);
        await second.focus(); await expectLine(await second.getAttribute('data-excerpt'));
        await second.evaluate(e => e.blur()); await expectLine(idle);
        await first.hover(); await expectLine(excerpt);
        await page.setViewportSize({width: 390, height: 844}); await expectLine(idle);
        await page.close();
        console.log(`${name}, ${reducedMotion}: article exits, child transitions, rapid movement, keyboard and mobile passed`);
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(r => server.close(r)); }
