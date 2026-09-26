// Verify the built player, including real MP3 decoding, seeking and fallbacks.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium, webkit } from 'playwright';

const root = resolve('public');
const output = resolve('tooling/audit/music');
mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.xml': 'application/xml', '.json': 'application/json' };
const server = createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (!pathname.startsWith('/bluenote/')) { res.writeHead(404).end(); return; }
  let file = resolve(root, pathname.slice('/bluenote/'.length));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  if (extname(file) === '.html') {
    // Avoid WebKit upgrading loopback requests; production retains the policy.
    res.writeHead(200, { 'Content-Type': mime['.html'] });
    res.end(readFileSync(file, 'utf8').replace(/<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">/g, ''));
    return;
  }
  const size = statSync(file).size;
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
  res.writeHead(range ? 206 : 200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
  if (req.method === 'HEAD') res.end(); else createReadStream(file, { start, end }).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/bluenote/`;
const article = base + '2026/09/25/一些想象/';
const original = readFileSync('source/_posts/一些想象.md', 'utf8').split(/^---\s*$/m)[2].trim().split(/\n\n+/).filter(p => !p.startsWith('<p aria-hidden'));

try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of [1280, 390, 320]) for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const requests = [], errors = [];
        page.on('request', r => requests.push(r.url()));
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(article, { waitUntil: 'networkidle' });
        assert.equal(requests.some(u => u.endsWith('.mp3')), false, 'No audio request before interaction');
        assert.deepEqual(requests.filter(u => /^https?:/.test(u) && new URL(u).origin !== new URL(base).origin), [], 'No third-party network requests');
        assert.deepEqual((await page.locator('.markdown-body > p').allTextContents()).filter(t => t.trim()), original, 'Original paragraphs unchanged');
        assert.equal(await page.locator('.post-music__controls').isVisible(), true);
        assert.equal(await page.locator('.post-music__audio').isVisible(), false);
        assert.equal(await page.locator('.post-music__pause-icon').isVisible(), false);
        assert.equal(await page.locator('.post-music__cover').evaluate(e => e.complete && e.naturalWidth > 0), true);
        assert.equal(await page.locator('.post-music__cover').getAttribute('tabindex'), null, 'Cover is not a lightbox control');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.locator('.post-music').evaluate(p => {
          const parent = p.getBoundingClientRect();
          return [...p.querySelectorAll('button,input,img,.post-music__time')].some(e => { const r = e.getBoundingClientRect(); return r.width && r.right > parent.right + 1; });
        }), false, 'All controls fit');
        await page.screenshot({ path: `${output}/${engine.name()}-${width}-${colorScheme}.png`, fullPage: true });
        if (width === 1280 && colorScheme === 'light') {
          const audio = page.locator('audio');
          const seek = page.locator('.post-music__seek');
          // Set position before metadata is loaded, without starting playback.
          await seek.fill('160');
          await page.waitForFunction(() => { const a = document.querySelector('audio'); return a.readyState > 0 && Math.abs(a.currentTime - 160) < 0.5; });
          assert.equal(await audio.evaluate(a => a.paused), true);
          assert.ok(Math.abs(await audio.evaluate(a => a.duration) - 281.704478) < 0.2);
          await page.locator('.post-music__play').click();
          await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > 160.2);
          await page.locator('.post-music__play').click();
          assert.equal(await audio.evaluate(a => a.paused), true);
          await seek.focus();
          const before = await audio.evaluate(a => a.currentTime);
          await page.keyboard.press('ArrowLeft');
          assert.ok(await audio.evaluate(a => a.currentTime) < before);
          await page.locator('.post-music__volume').fill('0');
          await page.locator('.post-music__mute').click();
          assert.equal(await audio.evaluate(a => !a.muted && a.volume > 0), true);
          await page.locator('.post-music__mute').click();
          assert.equal(await audio.evaluate(a => a.muted), true);
          await page.locator('.post-music__mute').click();
          await seek.fill('281.4');
          await page.locator('.post-music__play').click();
          await page.waitForFunction(() => document.querySelector('audio').ended && document.querySelector('[data-post-music]').dataset.playing === 'false');
          assert.equal(await page.locator('.post-music').getAttribute('data-playing'), 'false');
          await page.route('**/*.mp3', route => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
          await page.reload({ waitUntil: 'networkidle' });
          await page.locator('.post-music__play').click();
          await page.locator('[data-music-fallback]').waitFor({ state: 'visible' });
          assert.equal(await page.locator('.post-music__play').getAttribute('aria-label'), '播放', 'Failed media offers playback again');
          await page.unroute('**/*.mp3');
          await page.locator('.post-music__play').click();
          await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > 0).catch(async error => {
            console.error(await audio.evaluate(a => ({ error: a.error?.code, message: a.error?.message, paused: a.paused, time: a.currentTime, ready: a.readyState, network: a.networkState, src: a.getAttribute('src') })));
            console.error(requests.filter(u => u.includes('.mp3')));
            throw error;
          });
          await page.locator('.post-music__play').click();
        }
        // A real delayed first request catches loading-message layout shifts.
        // Observe events as well as frames, so cached resumes cannot hide a
        // short-lived insertion/removal between screenshots.
        await page.route('**/*.mp3', async route => {
          await new Promise(r => setTimeout(r, 350));
          await route.continue();
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.evaluate(() => {
          const selectors = ['.post-music', '.post-music__cover', '.post-music__controls', '.markdown-body > p'];
          const measure = () => selectors.map(selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [r.x, r.y + scrollY, r.width, r.height];
          });
          const baseline = measure();
          const result = { maxMovement: 0, samples: 0, loadingSeen: false, cachedResumeFlashed: false, running: true };
          const sample = () => {
            const player = document.querySelector('[data-post-music]');
            result.loadingSeen ||= player.dataset.loading === 'true' || !player.querySelector('.post-music__status').hidden;
            measure().forEach((box, i) => box.forEach((n, j) => { result.maxMovement = Math.max(result.maxMovement, Math.abs(n - baseline[i][j])); }));
            result.samples++;
          };
          document.querySelector('.post-music__play').addEventListener('click', () => {
            sample();
            const audio = document.querySelector('audio');
            if (!audio.paused && audio.readyState >= 3 && document.querySelector('[data-post-music]').dataset.loading === 'true') result.cachedResumeFlashed = true;
          });
          ['waiting', 'playing', 'pause', 'loadedmetadata', 'timeupdate'].forEach(name => document.querySelector('audio').addEventListener(name, sample));
          const frame = () => { if (result.running) { sample(); requestAnimationFrame(frame); } };
          requestAnimationFrame(frame);
          window.musicLayoutCheck = result;
        });
        const button = page.locator('.post-music__play');
        await button.click();
        await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.15);
        await button.click();
        for (let cycle = 0; cycle < 3; cycle++) {
          const position = await page.locator('audio').evaluate(a => a.currentTime);
          await button.click();
          await page.waitForFunction(t => document.querySelector('audio').currentTime > t + 0.1, position);
          if (cycle === 0) {
            // Exercise the same handler for a later buffering notification.
            await page.locator('audio').evaluate(a => a.dispatchEvent(new Event('waiting')));
            await page.screenshot({ path: `${output}/${engine.name()}-${width}-${colorScheme}-buffering.png`, fullPage: true });
          }
          await button.click();
        }
        const layout = await page.evaluate(() => { window.musicLayoutCheck.running = false; return window.musicLayoutCheck; });
        assert.equal(layout.loadingSeen, true, 'The delayed load exercised the loading state');
        assert.ok(layout.samples > 10, 'Playback layout was observed over multiple frames');
        assert.ok(layout.maxMovement <= 0.5, `${engine.name()} ${width} ${colorScheme}: playback shifted layout by ${layout.maxMovement}px`);
        assert.equal(layout.cachedResumeFlashed, false, 'Cached resumes do not flash loading text');
        await page.unroute('**/*.mp3');
        assert.deepEqual(errors, []);
        await context.close();
      }
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(article);
      assert.equal(await page.locator('audio[controls]').isVisible(), true, 'Native fallback without JS');
      assert.equal(await page.locator('.post-music__controls').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await context.close();
      console.log(`${engine.name()}: 3 widths, 2 themes; stable playback layout, initial seek, keyboard, volume, end, retry and no-JS fallback passed.`);
    } finally { await browser.close(); }
  }
  const home = await fetch(base).then(r => r.text());
  assert.equal(home.includes('/js/post-music.js'), false, 'No player assets on pages without music');
} finally { await new Promise(r => server.close(r)); }
