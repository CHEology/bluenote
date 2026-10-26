// Notes tooling.
//   npm run note -- "text"      create source/_notes/<timestamp>.md (text optional)
//   npm run notes:setup         seal a GitHub token so unlocked devices can post
//   npm run notes:status        check that the posting key matches the vault
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { decryptPrivateArchive } from './private-posts.mjs';
import { notesKeyPath, openNotesKey, readNotesKey, sealNotesKey, vaultKey, writeNotesKey } from './lib/notes-key.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const archivePath = join(projectRoot, 'source', 'private', 'posts.enc.json');
const notesRoot = join(projectRoot, 'source', '_notes');

function siteSettings() {
  const site = yaml.load(readFileSync(join(projectRoot, '_config.yml'), 'utf8'));
  const theme = yaml.load(readFileSync(join(projectRoot, '_config.bluenote.yml'), 'utf8'));
  const compose = (theme.notes && theme.notes.compose) || {};
  return { timezone: site.timezone || 'UTC', repo: compose.repo, branch: compose.branch || 'main' };
}

function hiddenInput(message, envName) {
  if (process.env[envName]) return Promise.resolve(process.env[envName]);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(new Error(`Set ${envName} when running without an interactive terminal.`));
  }
  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolveInput, rejectInput) => {
    let value = '';
    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) rejectInput(error);
      else resolveInput(value);
    }
    function onData(chunk) {
      // Pasted text arrives as one chunk; typed text one character at a time.
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f') value = value.slice(0, -1);
        else value += character;
      }
    }
    process.stdin.on('data', onData);
  });
}

function stamp(timezone, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    id: `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`,
    date: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
  };
}

async function newNote(text) {
  const { timezone } = siteSettings();
  const { id, date } = stamp(timezone);
  mkdirSync(notesRoot, { recursive: true });
  const path = join(notesRoot, `${id}.md`);
  if (existsSync(path)) throw new Error(`A note already exists for this second: ${id}.md`);
  writeFileSync(path, `---\ndate: ${date}\ntags: []\n---\n\n${text ? `${text}\n` : ''}`);
  console.log(`Created source/_notes/${id}.md`);
}

async function setup() {
  const { repo } = siteSettings();
  if (!repo) throw new Error('Set notes.compose.repo in _config.bluenote.yml first.');
  const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
  if (archive.empty) throw new Error('The private vault is empty. Posting uses the vault password, so it needs at least one private post.');
  const password = await hiddenInput('Private password: ', 'BLUENOTE_PRIVATE_PASSWORD');
  try {
    decryptPrivateArchive(archive, password);
  } catch {
    throw new Error('That password does not open the private vault.');
  }
  const token = (await hiddenInput('GitHub fine-grained token: ', 'BLUENOTE_NOTES_TOKEN')).trim();
  if (/^(ghp|gho|ghu|ghs)_/.test(token)) {
    throw new Error('Use a fine-grained token (it starts with github_pat_) limited to this one repository, not a classic token.');
  }
  if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(token)) throw new Error('That does not look like a fine-grained GitHub token (github_pat_…).');

  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!response.ok) throw new Error(`GitHub refused the token for ${repo} (HTTP ${response.status}). Check that it is limited to that repository and not expired.`);
  const expires = response.headers.get('github-authentication-token-expiration') || '';

  writeNotesKey(sealNotesKey({ token, repo, expires, created: new Date().toISOString() }, vaultKey(archive, password), archive.kdf.salt));
  console.log(`Sealed the posting key in source/private/notes-key.enc.json${expires ? ` (token expires ${expires})` : ''}.`);
  console.log('Commit and push that file. Any device unlocked with the vault password can then post on /notes/.');
}

async function status() {
  const sealed = readNotesKey();
  if (!sealed) {
    console.log('No posting key yet. Run npm run notes:setup.');
    return;
  }
  const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
  if (archive.empty || sealed.archive !== archive.kdf.salt) {
    console.log('The posting key belongs to an older vault key. Run npm run notes:setup again.');
    process.exitCode = 1;
    return;
  }
  if (process.env.BLUENOTE_PRIVATE_PASSWORD || process.stdin.isTTY) {
    const password = await hiddenInput('Private password (to read the expiry date): ', 'BLUENOTE_PRIVATE_PASSWORD');
    const payload = openNotesKey(sealed, vaultKey(archive, password));
    console.log(`Posting key matches the vault. Repository ${payload.repo}${payload.expires ? `, token expires ${payload.expires}` : ''}.`);
  } else {
    console.log('Posting key matches the vault.');
  }
}

const [command, ...rest] = process.argv.slice(2);
const commands = { new: () => newNote(rest.join(' ').trim()), setup, status };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (commands[command] || (() => Promise.reject(new Error('Use one of: new, setup, status.'))))().catch((error) => {
    console.error(`Notes: ${error.message}`);
    process.exitCode = 1;
  });
}

export { stamp, notesKeyPath };
