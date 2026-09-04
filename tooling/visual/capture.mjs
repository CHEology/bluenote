// Capture screenshots, computed-style snapshots and visible-text snapshots of the
// generated site in public/. Usage:
//   node tooling/visual/capture.mjs --out baseline   (run on the pre-migration build)
//   node tooling/visual/capture.mjs --out current
// The script serves public/ itself under the site root, so no dev server is needed.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const publicRoot = join(projectRoot, 'public');
const visualRoot = join(projectRoot, 'tooling', 'visual');
const config = JSON.parse(readFileSync(join(visualRoot, 'pages.json'), 'utf8'));
const siteRoot = (readFileSync(join(projectRoot, '_config.yml'), 'utf8').match(/^root:\s*(\S+)/m) || [, '/'])[1];

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}
const outName = option('--out', 'current');
const only = option('--only', '');
const outRoot = join(visualRoot, outName);
mkdirSync(outRoot, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.gif': 'image/gif' };

const server = createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (!pathname.startsWith(siteRoot)) { response.writeHead(404); response.end(); return; }
  pathname = pathname.slice(siteRoot.length);
  let file = join(publicRoot, pathname);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { response.writeHead(404); response.end('not found'); return; }
  response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const results = { site: outName, capturedAt: new Date().toISOString(), pages: {} };

function seededRandomScript() {
  return `(() => { let seed = 42; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); })();`;
}

for (const pageConfig of config.pages) {
  if (only && pageConfig.key !== only) continue;
  const viewports = pageConfig.viewports || Object.keys(config.viewports);
  for (const viewportName of viewports) {
    for (const scheme of config.schemes) {
      const id = `${pageConfig.key}--${viewportName}--${scheme}`;
      const context = await browser.newContext({
        viewport: config.viewports[viewportName],
        colorScheme: scheme,
        deviceScaleFactor: 1,
        isMobile: viewportName === 'mobile',
        hasTouch: viewportName === 'mobile'
      });
      await context.addInitScript(seededRandomScript());
      const page = await context.newPage();
      const response = await page.goto(origin + siteRoot + pageConfig.path.replace(/^\//, ''), { waitUntil: 'load' });
      if (!response || !response.ok()) {
        results.pages[id] = { missing: true, status: response && response.status() };
        await context.close();
        continue;
      }
      await page.addStyleTag({ content: '*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; caret-color: transparent !important; } html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }' });
      await page.evaluate(() => document.fonts.ready);
      if (pageConfig.waitTyped) {
        // Wait until the typed slogan is complete and has stayed complete for a moment.
        const deadline = Date.now() + 20000;
        let stable = 0;
        while (Date.now() < deadline && stable < 3) {
          const done = await page.evaluate(() => {
            const subtitle = document.getElementById('subtitle');
            return !subtitle || subtitle.textContent.trim() === (subtitle.getAttribute('data-typed-text') || '').trim();
          });
          stable = done ? stable + 1 : 0;
          await page.waitForTimeout(500);
        }
      }
      await page.waitForTimeout(400);
      if (pageConfig.openMenu) {
        const toggle = await page.$('.site-nav__toggle, #navbar-toggler-btn');
        if (toggle) { await toggle.click(); await page.waitForTimeout(500); }
      }

      const side = await page.evaluate(() => document.querySelector('.site-nav') ? 'new' : 'old');
      const keys = [...(pageConfig.editorial ? config.editorialKeys : []), ...(pageConfig.keys || [])];
      const selectorMap = Object.fromEntries(keys.map((key) => [key, config.selectors[key][side]]));
      const styles = await page.evaluate(({ selectorMap, props }) => {
        const out = {};
        for (const [key, selector] of Object.entries(selectorMap)) {
          const element = document.querySelector(selector);
          if (!element) { out[key] = null; continue; }
          const computed = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const entry = { x: Math.round(rect.left + window.scrollX), y: Math.round(rect.top + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) };
          for (const prop of props) entry[prop] = computed[prop];
          out[key] = entry;
        }
        return out;
      }, { selectorMap, props: config.styleProps });

      const text = await page.evaluate((withMarkdown) => {
        const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
        const body = normalize(document.body.innerText);
        const markdown = document.querySelector('.markdown-body');
        return {
          body,
          markdownText: withMarkdown && markdown ? normalize(markdown.innerText) : null,
          markdownHtml: withMarkdown && markdown ? markdown.innerHTML.replace(/\s+/g, ' ').trim() : null,
          title: document.title,
          bodyClass: document.body.className,
          externalAssets: [...document.querySelectorAll('link[rel=stylesheet], script[src]')]
            .map((node) => node.getAttribute('href') || node.getAttribute('src'))
            .filter((url) => /^(https?:)?\/\//.test(url))
        };
      }, Boolean(pageConfig.markdown));

      const shots = [];
      for (const shot of pageConfig.shots || [{ name: 'top' }]) {
        if (shot.scrollTo !== undefined) {
          await page.evaluate((target) => {
            if (typeof target === 'number') window.scrollTo(0, target);
            else if (target === 'bottom') window.scrollTo(0, document.documentElement.scrollHeight);
            else { const element = document.querySelector(target); if (element) element.scrollIntoView({ block: 'start' }); }
          }, shot.scrollTo);
          await page.waitForTimeout(600);
        }
        const file = `${id}--${shot.name}.png`;
        await page.screenshot({ path: join(outRoot, file), fullPage: Boolean(shot.full), animations: 'disabled' });
        shots.push(file);
      }

      results.pages[id] = { side, styles, text, shots, scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight) };
      await context.close();
      process.stdout.write(`captured ${id}\n`);
    }
  }
}

await browser.close();
server.close();
writeFileSync(join(outRoot, 'snapshot.json'), JSON.stringify(results, null, 2));
console.log(`Wrote ${Object.keys(results.pages).length} page snapshots to tooling/visual/${outName}/`);
