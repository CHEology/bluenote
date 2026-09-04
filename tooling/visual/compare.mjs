// Compare tooling/visual/current against tooling/visual/baseline: screenshot pixel
// difference, computed-style differences and visible-text differences.
// Usage: node tooling/visual/compare.mjs [--threshold 0.5] [--only page-key]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const visualRoot = join(projectRoot, 'tooling', 'visual');
const config = JSON.parse(readFileSync(join(visualRoot, 'pages.json'), 'utf8'));
const baselineRoot = join(visualRoot, 'baseline');
const currentRoot = join(visualRoot, 'current');
const diffRoot = join(visualRoot, 'diff');
mkdirSync(diffRoot, { recursive: true });

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}
const threshold = Number(option('--threshold', '0.5'));
const only = option('--only', '');

const baseline = JSON.parse(readFileSync(join(baselineRoot, 'snapshot.json'), 'utf8'));
const current = JSON.parse(readFileSync(join(currentRoot, 'snapshot.json'), 'utf8'));
const allowed = JSON.parse(readFileSync(join(visualRoot, 'allowed-differences.json'), 'utf8'));

function padTo(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height, fill: true });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const from = (png.width * y + x) << 2;
      const to = (width * y + x) << 2;
      out.data[to] = png.data[from]; out.data[to + 1] = png.data[from + 1];
      out.data[to + 2] = png.data[from + 2]; out.data[to + 3] = png.data[from + 3];
    }
  }
  return out;
}

function compareShot(file) {
  const a = PNG.sync.read(readFileSync(join(baselineRoot, file)));
  const b = PNG.sync.read(readFileSync(join(currentRoot, file)));
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pa = padTo(a, width, height);
  const pb = padTo(b, width, height);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(pa.data, pb.data, diff.data, width, height, { threshold: 0.1, includeAA: false });
  writeFileSync(join(diffRoot, file), PNG.sync.write(diff));
  return { mismatched, ratio: (100 * mismatched) / (width * height), sizeA: `${a.width}x${a.height}`, sizeB: `${b.width}x${b.height}` };
}

const numeric = /^-?\d+(\.\d+)?px$/;
function normalize(value) {
  return typeof value === 'string' ? value.replace(/url\("?https?:\/\/[^/]+\//g, 'url("/') : value;
}
function stylesEqual(rawA, rawB) {
  const a = normalize(rawA);
  const b = normalize(rawB);
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1;
  if (typeof a === 'string' && typeof b === 'string' && numeric.test(a) && numeric.test(b)) {
    return Math.abs(parseFloat(a) - parseFloat(b)) <= 1;
  }
  return false;
}

function isAllowed(pageKey, viewport, key, prop) {
  return allowed.some((rule) =>
    (rule.page === '*' || rule.page === pageKey || (rule.pageStartsWith && pageKey.startsWith(rule.pageStartsWith))) &&
    (!rule.viewport || rule.viewport === viewport) &&
    (rule.key === '*' || rule.key === key) &&
    (rule.prop === '*' || rule.prop === prop)
  );
}

const report = ['# Visual comparison report', '', `Baseline: ${baseline.capturedAt}  Current: ${current.capturedAt}`, ''];
let failures = 0;
const shotRows = [];
const styleRows = [];
const textRows = [];

for (const pageConfig of config.pages) {
  if (only && pageConfig.key !== only) continue;
  if (pageConfig.newOnly) continue;
  const viewports = pageConfig.viewports || Object.keys(config.viewports);
  for (const viewportName of viewports) {
    for (const scheme of config.schemes) {
      const id = `${pageConfig.key}--${viewportName}--${scheme}`;
      const a = baseline.pages[id];
      const b = current.pages[id];
      if (!a || !b || a.missing || b.missing) { shotRows.push(`| ${id} | missing | | |`); failures++; continue; }

      for (const file of a.shots) {
        if (pageConfig.compareShots === false) { shotRows.push(`| ${file} | skipped (${pageConfig.skipReason || 'not comparable'}) | | |`); continue; }
        if (!existsSync(join(currentRoot, file))) { shotRows.push(`| ${file} | missing current | | |`); failures++; continue; }
        const result = compareShot(file);
        const limit = pageConfig.shotThreshold !== undefined ? Number(pageConfig.shotThreshold) : threshold;
        const ok = result.ratio <= limit;
        if (!ok) failures++;
        shotRows.push(`| ${file} | ${result.ratio.toFixed(3)}% | ${result.sizeA} → ${result.sizeB} | ${ok ? 'ok' : 'CHECK'} |`);
      }

      for (const key of Object.keys(a.styles)) {
        const sa = a.styles[key];
        const sb = b.styles[key];
        if (!sa && !sb) continue;
        if (!sa || !sb) {
          if (!isAllowed(pageConfig.key, viewportName, key, '*')) { styleRows.push(`| ${id} | ${key} | (element) | ${sa ? 'present' : 'absent'} | ${sb ? 'present' : 'absent'} |`); failures++; }
          continue;
        }
        for (const prop of Object.keys(sa)) {
          if (stylesEqual(sa[prop], sb[prop])) continue;
          if (isAllowed(pageConfig.key, viewportName, key, prop)) continue;
          styleRows.push(`| ${id} | ${key} | ${prop} | ${sa[prop]} | ${sb[prop]} |`);
          failures++;
        }
      }

      if (pageConfig.markdown && pageConfig.compareText !== false) {
        const ignore = allowed.filter((rule) => rule.textIgnore && (rule.page === '*' || rule.page === pageConfig.key)).flatMap((rule) => rule.textIgnore);
        const strip = (text) => ignore.reduce((value, word) => value.split(` ${word} `).join(' ').split(` ${word}`).join(''), text);
        if (strip(a.text.markdownText) !== strip(b.text.markdownText)) {
          textRows.push(`| ${id} | markdown text differs (${a.text.markdownText.length} → ${b.text.markdownText.length} chars) |`);
          failures++;
        }
      }
      if (b.text.externalAssets.length) {
        textRows.push(`| ${id} | external assets: ${b.text.externalAssets.join(', ')} |`);
        failures++;
      }
    }
  }
}

report.push('## Screenshots', '', '| Shot | Diff | Size | Status |', '| --- | --- | --- | --- |', ...shotRows, '');
report.push('## Computed style differences (not in allowed list)', '', '| Page | Element | Property | Baseline | Current |', '| --- | --- | --- | --- | --- |', ...(styleRows.length ? styleRows : ['| (none) | | | | |']), '');
report.push('## Text and asset checks', '', '| Page | Finding |', '| --- | --- |', ...(textRows.length ? textRows : ['| (none) | |']), '');
writeFileSync(join(visualRoot, 'report.md'), report.join('\n'));
console.log(report.join('\n'));
console.log(`\n${failures} item(s) need attention. Report: tooling/visual/report.md`);
process.exitCode = failures ? 1 : 0;
