// Run after npm run build. The vault, the posting token and GitHub are synthetic fixtures:
// no request leaves the machine. Screenshots go to the ignored tooling/audit/notes/.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { encryptPrivateArchive } from './private-posts.mjs';
import { sealNotesKey, vaultKey } from './lib/notes-key.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(root, 'public');
const auditRoot = join(root, 'tooling', 'audit', 'notes');
mkdirSync(auditRoot, { recursive: true });
const notesIndex = JSON.parse(readFileSync(join(publicRoot, 'notes/search.json'), 'utf8')).notes;
assert.ok(notesIndex.length >= 1, 'The browser test needs at least one note in the build');
const identity = JSON.parse(readFileSync(join(publicRoot, 'private/posts.public.json'), 'utf8')).posts[0];
const password = 'synthetic-notes-browser-fixture';
const archive = encryptPrivateArchive([{ ...identity, html: '<p>Synthetic.</p>' }], password);
const token = 'github_pat_SYNTHETICFIXTURE0123456789abcdefghij';
const sealed = sealNotesKey({ token, repo: 'CHEology/bluenote' }, vaultKey(archive, password), archive.kdf.salt);

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'text/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/bluenote\//, '');
  let path = join(publicRoot, pathname);
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const notesUrl = origin + '/bluenote/notes/';

const browser = await chromium.launch({
  executablePath: process.env.BLUE_NOTE_CHROMIUM || undefined,
  args: process.env.BLUE_NOTE_CHROMIUM ? ['--no-sandbox', '--disable-gpu'] : []
});

const github = [];
const editedFile = notesIndex[notesIndex.length - 1].file;
const editedSource = readFileSync(join(root, 'source/_notes', editedFile), 'utf8');
async function prepare(context) {
  await context.route('**/private/posts.enc.json*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(archive) }));
  await context.route('**/private/notes-key.enc.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sealed) }));
  let polls = 0;
  await context.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const entry = { method: request.method(), path: url.pathname, search: url.search, auth: request.headers().authorization, body: request.postData() ? JSON.parse(request.postData()) : null };
    github.push(entry);
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.pathname.includes('/actions/runs')) {
      polls += 1;
      const run = { id: 7, status: polls < 2 ? 'in_progress' : 'completed', conclusion: polls < 2 ? null : 'success', html_url: 'https://github.com/run/7' };
      return json(url.pathname.endsWith('/7') ? run : { workflow_runs: [run] });
    }
    if (entry.method === 'GET') return json({ sha: 'file-sha-1', content: Buffer.from(editedSource).toString('base64').replace(/(.{60})/g, '$1\n') });
    if (entry.method === 'PUT' || entry.method === 'DELETE') return json({ commit: { sha: 'commit-' + github.length } }, entry.method === 'PUT' ? 201 : 200);
    return json({ message: 'unexpected' }, 500);
  });
}

function watchConsole(page, sink) {
  page.on('console', (message) => { if (/Content Security Policy|Refused to/i.test(message.text())) sink.push(message.text()); });
  page.on('pageerror', (error) => sink.push('pageerror: ' + error.message));
}

try {
  // A visitor: read-only timeline, search, no composer and no edit controls.
  const visitor = await browser.newContext();
  await prepare(visitor);
  const page = await visitor.newPage();
  page.setDefaultTimeout(15000);
  const problems = [];
  watchConsole(page, problems);
  await page.goto(notesUrl, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('meta[name="robots"][content="noindex"]').count(), 1);
  assert.equal(await page.locator('.notes-compose').count(), 0, 'Locked visitors never see a composer');
  assert.equal(await page.locator('.note__action').count(), 0, 'Locked visitors never see edit controls');
  await page.locator('.notes-unlock').waitFor({ state: 'visible' });
  await page.screenshot({ path: join(auditRoot, 'locked-desktop.png'), fullPage: true });

  const needle = notesIndex[0].text.split(/\s+/)[0];
  await page.locator('#notes-search-input').fill(needle);
  await page.locator('[data-notes-results] article.note').first().waitFor();
  assert.ok(await page.locator('[data-notes-list]').isHidden(), 'Search results replace the timeline');
  await page.locator('#notes-search-input').fill('no-such-note-anywhere-1234');
  await page.waitForFunction(() => document.querySelector('.notes-search__status').textContent.length > 0 && !document.querySelector('[data-notes-results] article'));
  await page.locator('#notes-search-input').press('Escape');
  assert.ok(await page.locator('[data-notes-list]').isVisible(), 'Escape restores the timeline');

  // Unlock with the vault password through the existing dialog.
  await page.locator('.notes-unlock').click();
  await page.locator('#private-global-password').fill(password);
  await page.locator('[data-private-form] button').click();
  const composer = page.locator('[data-notes-composer] .notes-compose');
  await composer.waitFor({ state: 'visible' });
  assert.equal(await page.locator('article.note[data-note-file] .note__action').count(), notesIndex.slice(0, 30).length * 2);
  await page.screenshot({ path: join(auditRoot, 'composer-desktop.png'), fullPage: true });

  // Post: an existing tag, a new tag, Chinese text and a link.
  const text = 'QA 发一条短文\n\n第二段 https://example.com/x';
  await composer.locator('textarea').fill(text);
  const existingTag = JSON.parse(readFileSync(join(publicRoot, 'notes/tags.json'), 'utf8')).tags[0];
  const field = composer.locator('.notes-compose__new-tag');
  assert.equal(await composer.locator('.notes-compose__tag').count(), 0, 'Existing tags appear only while typing');
  assert.ok(await composer.locator('.notes-compose__bar .notes-compose__tags').isVisible(), 'Tags sit on the bar beside the buttons');
  if (existingTag) {
    await field.fill(existingTag.name.slice(0, 1));
    await composer.locator('.notes-compose__suggestions .notes-compose__tag', { hasText: '#' + existingTag.name }).click();
  }
  await field.fill('#新标签');
  await field.press('Enter');
  await field.fill('临时');
  await field.press('Enter');
  await composer.locator('.notes-compose__chip', { hasText: '#临时' }).click();
  assert.deepEqual(await composer.locator('.notes-compose__chip').evaluateAll((chips) => chips.map((chip) => chip.firstChild.textContent)),
    existingTag ? ['#' + existingTag.name, '#新标签'] : ['#新标签'], 'A chosen tag can be removed before posting');
  await field.fill(existingTag ? existingTag.name.slice(0, 1) : 'x');
  await composer.screenshot({ path: join(auditRoot, 'composer-tags.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await composer.screenshot({ path: join(auditRoot, 'composer-tags-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await field.fill('');
  await composer.locator('button[type="submit"]').click();
  await page.locator('.note--pending .note__state', { hasText: 'Live' }).waitFor({ timeout: 30000 });
  const put = github.find((entry) => entry.method === 'PUT');
  assert.equal(put.auth, 'Bearer ' + token);
  assert.match(put.path, /^\/repos\/CHEology\/bluenote\/contents\/source\/_notes\/\d{8}-\d{6}\.md$/);
  assert.equal(put.body.branch, 'master');
  const posted = Buffer.from(put.body.content, 'base64').toString('utf8');
  assert.match(posted, /^---\ndate: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\ntags:\n/);
  assert.ok(posted.includes('  - "新标签"\n'));
  if (existingTag) assert.ok(posted.includes(`  - ${JSON.stringify(existingTag.name)}\n`));
  assert.ok(posted.endsWith('---\n\n' + text + '\n'), 'The note body is committed exactly as written');
  assert.ok(!posted.includes('临时'), 'A removed tag is not committed');
  assert.equal(await composer.locator('textarea').inputValue(), '', 'The composer clears after posting');
  assert.equal(await composer.locator('.notes-compose__chip').count(), 0, 'No tag stays on the composer after posting');
  assert.equal(await composer.locator('.notes-compose__new-tag').inputValue(), '', 'The new-tag field clears after posting');

  // Edit an existing note in place; its date and other front matter are kept.
  const target = page.locator(`article.note[data-note-file="${editedFile}"]`);
  await target.locator('.note__action', { hasText: 'Edit' }).click();
  const edit = target.locator('.notes-compose');
  await edit.waitFor();
  await edit.locator('textarea').fill('QA edited body');
  const editedTags = (editedSource.match(/^\s+-\s*"?([^"\n]+)"?$/gm) || []).length;
  assert.equal(await edit.locator('.notes-compose__chip').count(), editedTags, 'Editing shows the note\'s tags');
  while (await edit.locator('.notes-compose__chip').count()) await edit.locator('.notes-compose__chip').first().click();
  await edit.locator('button[type="submit"]').click();
  await target.locator('.note__state', { hasText: 'Live' }).waitFor({ timeout: 30000 });
  const save = github.filter((entry) => entry.method === 'PUT').pop();
  assert.equal(save.body.sha, 'file-sha-1');
  const saved = Buffer.from(save.body.content, 'base64').toString('utf8');
  assert.ok(saved.includes(editedSource.match(/^date: .+$/m)[0]), 'Editing keeps the original date');
  assert.match(saved, /\nupdated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\n/);
  assert.ok(saved.endsWith('---\n\nQA edited body\n'));
  assert.ok(!/\ntags:/.test(saved), 'Removing every tag while editing drops them from the file');

  // Delete asks first.
  page.once('dialog', (dialog) => dialog.accept());
  await target.locator('.note__action', { hasText: 'Delete' }).click();
  await page.waitForFunction(() => document.querySelector('.note--deleted'));
  const removal = github.find((entry) => entry.method === 'DELETE');
  assert.equal(removal.body.sha, 'file-sha-1');

  // The unlocked state persists across a reload without asking again.
  await page.reload({ waitUntil: 'networkidle' });
  await composer.waitFor({ state: 'visible' });

  // Note pages and tag pages get edit controls but no composer.
  await page.goto(origin + notesIndex[0].url.replace(/^\/bluenote\//, '/bluenote/'), { waitUntil: 'networkidle' });
  await page.locator('.note__action').first().waitFor();
  assert.equal(await page.locator('.notes-compose').count(), 0);

  for (const scheme of ['light', 'dark']) {
    for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const shot = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 2 });
      await prepare(shot);
      const view = await shot.newPage();
      watchConsole(view, problems);
      await view.goto(notesUrl, { waitUntil: 'networkidle' });
      await view.evaluate(([key]) => key, ['']);
      await view.screenshot({ path: join(auditRoot, `timeline-${label}-${scheme}.png`), fullPage: true });
      const overflow = await view.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `No horizontal scroll on ${label}`);
      await shot.close();
    }
  }

  assert.deepEqual(problems, [], 'Notes pages run without script errors or security-policy violations');
  console.log(`Validated notes: locked view, search, unlock, post (${github.length} mocked GitHub calls), edit, delete, persistence and layouts. Screenshots: tooling/audit/notes/`);
} finally {
  await browser.close();
  server.close();
}
