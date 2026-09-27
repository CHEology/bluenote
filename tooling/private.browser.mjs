// Run after npm run build. All decrypted content below is a synthetic fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { encryptPrivateArchive } from './private-posts.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(root, 'public');
const identity = JSON.parse(readFileSync(join(publicRoot, 'private/posts.public.json'), 'utf8')).posts[0];
const password = 'synthetic-private-browser-fixture';
const bundle = encryptPrivateArchive([{
  ...identity,
  html: '<div data-fixture><a href="#fixture-section">Contents</a><p style="height:1200px">Synthetic prose.</p><h2 id="fixture-section">Synthetic section</h2><p style="height:1200px">Synthetic ending.</p></div>'
}], password);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'text/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let serveFixture = false;
let servedCiphertexts = 0;
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/bluenote\//, '');
  if (serveFixture && pathname === 'private/posts.enc.json') {
    servedCiphertexts++;
    response.writeHead(200, {'content-type':'application/json', 'cache-control':'public, max-age=31536000'});
    response.end(JSON.stringify(bundle)); return;
  }
  let path = join(publicRoot, pathname);
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  let requests = 0;
  let failDownload = false;
  let downloadGate;
  let failManifest = false;
  await context.route('**/private/posts.public.json', route => failManifest ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
  await context.route('**/private/posts.enc.json*', async route => {
    requests++;
    if (downloadGate) await downloadGate;
    return route.fulfill({ status: failDownload ? 503 : 200, contentType: 'application/json', body: failDownload ? '{}' : JSON.stringify(bundle) });
  });
  const fixture = page.locator('[data-fixture]');
  async function submit(value) {
    await page.locator('#private-global-password').fill(value);
    await page.locator('[data-private-form] button').click();
  }
  async function expectStatus(value) {
    await page.waitForFunction(value => document.querySelector('[data-private-status]').textContent === value, value);
  }
  await page.goto(origin + identity.url + '#fixture-section', { waitUntil: 'networkidle' });
  assert.equal(requests, 0, 'Locked readers must not download the archive');
  assert.equal(await fixture.count(), 0);
  await page.locator('[data-private-unlock]').click();
  assert.equal(requests, 0, 'Opening the dialog must not download the archive');
  failDownload = true;
  await submit(password);
  await expectStatus('Unavailable');
  assert.equal(await fixture.count(), 0);
  failDownload = false;
  await submit('incorrect-fixture-password');
  await expectStatus('Incorrect password');
  assert.equal(requests, 2, 'A failed download must be retried');
  assert.equal(await fixture.count(), 0);
  await submit(password);
  await fixture.waitFor({ state: 'visible' });
  assert.equal(requests, 2, 'Password retries reuse the downloaded ciphertext');
  const anchored = await page.locator('#fixture-section').evaluate(el => el.getBoundingClientRect().top);
  assert(Math.abs(anchored) < 2, 'A chapter fragment must resolve after decryption');
  const stored = await page.evaluate(() => localStorage.getItem('bluenote.private-key.v1'));
  assert(stored && !stored.includes(password), 'Only a derived key may be saved');
  await context.addInitScript(() => {
    window.lockedFrames = 0;
    function sample() {
      const locked = document.querySelector('[data-private-post-locked]');
      if (locked && !locked.hidden && getComputedStyle(locked).visibility !== 'hidden' && locked.getBoundingClientRect().height > 0) window.lockedFrames++;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  let releaseDownload;
  downloadGate = new Promise(resolve => { releaseDownload = resolve; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('private-reading-restoring'));
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-private-post-locked]').isVisible(), false, 'Saved access must hide the password panel before the first paint');
  assert.equal(await page.evaluate(() => window.lockedFrames), 0);
  releaseDownload(); downloadGate = undefined;
  await fixture.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.lockedFrames), 0, 'No locked frame may appear while saved access is restored');
  assert.equal(requests, 3, 'Saved access restores the archive once');
  failDownload = true;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await fixture.count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('bluenote.private-key.v1')), stored, 'A temporary network error must not forget saved access');
  assert(await page.locator('[data-private-post-locked]').isVisible(), 'A restore failure must reveal the unlock entry');
  failDownload = false;
  failManifest = true;
  await page.reload({ waitUntil: 'networkidle' });
  await fixture.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.lockedFrames), 0, 'Manifest failure must not delay or block saved access');
  failManifest = false;
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('bluenote.private-key.v1'));
    saved.fingerprint = 'stale-fixture';
    localStorage.setItem('bluenote.private-key.v1', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !localStorage.getItem('bluenote.private-key.v1'));
  assert.equal(await fixture.count(), 0);
  const requestsAfterStale = requests;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(requests, requestsAfterStale, 'Expired access must not repeatedly download the archive');
  await page.locator('[data-private-unlock]').click();
  await submit(password);
  await fixture.waitFor({ state: 'visible' });
  await page.goto(origin + '/bluenote/archives/' + identity.date.slice(0, 4) + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-private-lock-control][role="button"]').first().click();
  await page.locator('[data-private-lock-confirm-action]').click();
  await page.waitForFunction(() => !localStorage.getItem('bluenote.private-key.v1'));
  await page.goto(origin + identity.url, { waitUntil: 'networkidle' });
  assert.equal(await fixture.count(), 0);
  // Arrows stay outside the title and its status in both navigation directions.
  for (const viewport of [{width:390,height:844},{width:1280,height:900}]) {
    await page.setViewportSize(viewport);
    for (const privatePost of JSON.parse(readFileSync(join(publicRoot, 'private/posts.public.json'), 'utf8')).posts) {
    await page.goto(origin + privatePost.url, {waitUntil:'networkidle'});
    await page.waitForFunction(() => !!document.querySelector('.post-nav a[data-private-link]'));
    for (const scheme of ['light','dark']) {
      await page.emulateMedia({colorScheme:scheme});
      for (const state of [false, true]) {
        await page.evaluate(unlocked => document.documentElement.classList.toggle('private-reading-unlocked', unlocked),state);
        const geometry = await page.locator('.post-nav a[data-private-link]').evaluate(link => {
          const arrow = link.querySelector('.icon').getBoundingClientRect();
          const label = [...link.querySelectorAll('.post-nav__title,.post-nav__label')].find(el => getComputedStyle(el).display !== 'none');
          const text = label.getBoundingClientRect();
          return {before:getComputedStyle(link,'::before').content,status:getComputedStyle(label,'::after').content,correct:link.classList.contains('post-nav__prev') ? arrow.right <= text.left + 1 : text.right <= arrow.left + 1};
        });
        assert.equal(geometry.before, 'none');
        assert.equal(geometry.status, state ? '"UNLOCKED"' : '"LOCKED"');
        assert(geometry.correct, 'Status and title must stay inside the directional arrow');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.PRIVATE_QA_DIR && state) {
          mkdirSync(process.env.PRIVATE_QA_DIR, {recursive:true});
          await page.locator('.post-nav').screenshot({path:join(process.env.PRIVATE_QA_DIR, `${privatePost.id}-${viewport.width}-${scheme}.png`)});
        }
      }
    }
  }
  }
  await context.close();

  // Exercise real HTTP caching without route interception (which disables it).
  serveFixture = true;
  const cacheContext = await browser.newContext();
  await cacheContext.addInitScript(saved => localStorage.setItem('bluenote.private-key.v1', saved), stored);
  const cachePage = await cacheContext.newPage();
  await cachePage.goto(origin + identity.url, {waitUntil:'networkidle'});
  await cachePage.locator('[data-fixture]').waitFor({state:'visible'});
  await cachePage.goto(origin + '/bluenote/archives/', {waitUntil:'networkidle'});
  await cachePage.goto(origin + identity.url, {waitUntil:'networkidle'});
  await cachePage.locator('[data-fixture]').waitFor({state:'visible'});
  assert.equal(servedCiphertexts, 1, 'Page navigation must reuse cached ciphertext');
  const storage = await cachePage.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].join(' '));
  assert(!storage.includes('Synthetic prose'), 'Plaintext must not be stored');
  await cacheContext.close();

  const failedScriptContext = await browser.newContext();
  await failedScriptContext.addInitScript(saved => {
    localStorage.setItem('bluenote.private-key.v1', saved);
    const timeout = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 10000 ? 200 : ms, ...args);
  }, stored);
  await failedScriptContext.route('**/js/private.js*', route => route.abort());
  const failedScriptPage = await failedScriptContext.newPage();
  await failedScriptPage.goto(origin + identity.url, {waitUntil:'networkidle'});
  assert(await failedScriptPage.locator('[data-private-post-locked]').isVisible(), 'A missing main script must not hide the lock panel indefinitely');
  await failedScriptContext.close();
  console.log('Private reading verified: cached ciphertext across pages, missing-script fallback, no locked frames during delayed restore, manifest independence, failure recovery, navigation status, lazy loading, retry, wrong password, anchors, stale key and logout.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
