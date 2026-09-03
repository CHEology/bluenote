import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const derivativeLongEdges = [800, 1600, 2880];
const quality = 84;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

function commandPath(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error([`Image command failed: ${command} ${args.join(' ')}`, result.stderr, result.stdout]
      .filter(Boolean)
      .join('\n'));
  }
}

const inputOption = option('--input');
const year = option('--year');
const slug = option('--slug');
const force = process.argv.includes('--force');

if (!inputOption || !/^\d{4}$/.test(year) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  fail('Usage: npm run gallery:prepare -- --input "/path/to/photos" --year 2026 --slug gallery-name');
}

const inputRoot = resolve(inputOption);
if (!existsSync(inputRoot) || !statSync(inputRoot).isDirectory()) {
  fail(`Input directory does not exist: ${inputRoot}`);
}

const inputs = readdirSync(inputRoot)
  .filter((name) => /\.(?:jpe?g)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'));

if (inputs.length === 0) fail(`No JPEG files found in: ${inputRoot}`);

const destination = join(projectRoot, 'source', 'images', 'galleries', year, slug);
if (existsSync(destination) && readdirSync(destination).length > 0 && !force) {
  fail(`Destination is not empty; refusing to overwrite: ${destination}`);
}

const sips = commandPath('sips');
const jpegtran = commandPath('jpegtran');
if (!sips) fail('The gallery preparation command currently requires macOS sips.');
if (!jpegtran) fail('jpegtran is required to strip metadata and create progressive JPEGs.');

mkdirSync(dirname(destination), { recursive: true });
const stagingRoot = mkdtempSync(join(dirname(destination), `.${slug}-staging-`));
const temporaryRoot = mkdtempSync(join(tmpdir(), 'bluenote-gallery-'));

try {
  for (const inputName of inputs) {
    const input = join(inputRoot, inputName);
    const stem = basename(inputName, extname(inputName));

    for (const longEdge of derivativeLongEdges) {
      const temporary = join(temporaryRoot, `${stem}-${longEdge}.jpg`);
      const output = join(stagingRoot, `${stem}-${longEdge}.jpg`);

      run(sips, [
        '--resampleHeightWidthMax', String(longEdge),
        '--setProperty', 'format', 'jpeg',
        '--setProperty', 'formatOptions', String(quality),
        input,
        '--out', temporary
      ]);
      run(jpegtran, [
        '-copy', 'none',
        '-optimize',
        '-progressive',
        '-outfile', output,
        temporary
      ]);
    }

    run(jpegtran, [
      '-copy', 'none',
      '-optimize',
      '-progressive',
      '-outfile', join(stagingRoot, `${stem}.jpg`),
      input
    ]);

    console.log(`Prepared ${inputName}`);
  }

  if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
  renameSync(stagingRoot, destination);
} catch (error) {
  rmSync(stagingRoot, { recursive: true, force: true });
  rmSync(temporaryRoot, { recursive: true, force: true });
  fail(error.message);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log(`Created ${inputs.length * (derivativeLongEdges.length + 1)} responsive files in ${destination}`);
