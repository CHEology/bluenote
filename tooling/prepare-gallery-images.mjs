import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const widths = [800, 1280, 1920];
const quality = 74;

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
if (existsSync(destination) && readdirSync(destination).length > 0) {
  fail(`Destination is not empty; refusing to overwrite: ${destination}`);
}

const sips = commandPath('sips');
const jpegtran = commandPath('jpegtran');
if (!sips) fail('The gallery preparation command currently requires macOS sips.');
if (!jpegtran) fail('jpegtran is required to strip metadata and create progressive JPEGs.');

mkdirSync(destination, { recursive: true });
const temporaryRoot = mkdtempSync(join(tmpdir(), 'bluenote-gallery-'));

try {
  for (const inputName of inputs) {
    const input = join(inputRoot, inputName);
    const stem = basename(inputName, extname(inputName));

    for (const width of widths) {
      const temporary = join(temporaryRoot, `${stem}-${width}.jpg`);
      const outputName = width === widths.at(-1) ? `${stem}.jpg` : `${stem}-${width}.jpg`;
      const output = join(destination, outputName);

      run(sips, [
        '--resampleHeightWidthMax', String(width),
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

    console.log(`Prepared ${inputName}`);
  }
} catch (error) {
  rmSync(destination, { recursive: true, force: true });
  rmSync(temporaryRoot, { recursive: true, force: true });
  fail(error.message);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log(`Created ${inputs.length * widths.length} responsive files in ${destination}`);
