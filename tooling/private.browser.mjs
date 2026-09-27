// Run after npm run build. All decrypted content below is a synthetic fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
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
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/bluenote\//, '');
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
  await context.route('**/private/posts.enc.json', route => {
    requests++;
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
  await page.reload({ waitUntil: 'networkidle' });
  await fixture.waitFor({ state: 'visible' });
  assert.equal(requests, 3, 'Saved access restores the archive once');
  failDownload = true;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await fixture.count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('bluenote.private-key.v1')), stored, 'A temporary network error must not forget saved access');
  failDownload = false;
  await page.reload({ waitUntil: 'networkidle' });
  await fixture.waitFor({ state: 'visible' });
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
  await context.close();
  console.log('Private reading verified: lazy loading, retry, wrong password, anchors, saved access, stale key and logout.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
