import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decryptPrivateArchive,
  encryptPrivateArchive,
  serializePrivatePost
} from './private-posts.mjs';
import { openNotesKey, readNotesKey, sealNotesKey, vaultKey } from './lib/notes-key.mjs';
import { existsSync } from 'node:fs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(projectRoot, 'public');
const password = 'correct horse battery staple 2026';
const secretTitle = 'QA-PRIVATE-TITLE-7d68c4';
const secretBody = 'QA-PRIVATE-BODY-cd03d2';
const raw = `---\ntitle: ${secretTitle}\ndate: 2026-08-27 22:00:00\ndescription: encrypted fixture\n---\n\n${secretBody}\n`;
const post = serializePrivatePost('qa-private.md', raw);
const bundle = encryptPrivateArchive([post], password);
const serialized = JSON.stringify(bundle);

if (serialized.includes(secretTitle) || serialized.includes(secretBody) || serialized.includes('qa-private.md')) {
  throw new Error('Encrypted archive leaks private title, body, or filename.');
}

const decrypted = decryptPrivateArchive(bundle, password);
if (decrypted.posts[0].title !== secretTitle || !decrypted.posts[0].source.includes(secretBody)) {
  throw new Error('Correct password did not restore the private article.');
}

let wrongPasswordRejected = false;
try {
  decryptPrivateArchive(bundle, 'this password is definitely wrong');
} catch {
  wrongPasswordRejected = true;
}
if (!wrongPasswordRejected) throw new Error('Wrong password unexpectedly decrypted the private archive.');

const generatedHome = readFileSync(join(publicRoot, 'index.html'), 'utf8');
const generatedBundle = readFileSync(join(publicRoot, 'private', 'posts.enc.json'), 'utf8');
const generatedManifest = readFileSync(join(publicRoot, 'private', 'posts.public.json'), 'utf8');
const generatedPrivateScript = readFileSync(join(publicRoot, 'js', 'private.js'), 'utf8');
const identities = JSON.parse(generatedManifest).posts;
for (const field of ['id', 'filename', 'url']) {
  if (new Set(identities.map(post => post[field])).size !== identities.length) {
    throw new Error(`Private articles must have distinct ${field} values.`);
  }
}
for (const identity of identities) {
  const path = decodeURIComponent(identity.url).replace(/^\/bluenote\//, '');
  const page = readFileSync(join(publicRoot, path, 'index.html'), 'utf8');
  if (!page.includes(`data-private-post-id="${identity.id}"`)) {
    throw new Error('Generated private post shell is missing or has the wrong identity.');
  }
  if (generatedHome.includes(`href="${identity.url}"`) &&
      !generatedHome.includes(`data-private-link="${identity.id}"`)) {
    throw new Error('Private post is not marked on the generated home page.');
  }
}
if (generatedBundle.includes(secretTitle) || generatedBundle.includes(secretBody)) {
  throw new Error('Private fixture leaked into the generated archive.');
}
if (generatedManifest.includes(secretBody)) {
  throw new Error('Public private-post manifest leaks protected content.');
}
if (!generatedPrivateScript.includes('是否退出解锁状态？') ||
    !generatedPrivateScript.includes('data-private-lock-control') ||
    !generatedPrivateScript.includes('window.localStorage.removeItem(storageKey)')) {
  throw new Error('Archive unlock-exit control is missing or does not clear the saved site key.');
}

// Notes posting key (PUBLISHING.md §13): sealed with the vault key, never in plain text.
const fixtureToken = 'github_pat_QAFIXTURE0123456789abcdefghijklmn';
const sealedFixture = sealNotesKey({ token: fixtureToken }, vaultKey(bundle, password), bundle.kdf.salt);
if (JSON.stringify(sealedFixture).includes(fixtureToken)) throw new Error('Sealed posting key leaks the token.');
if (openNotesKey(sealedFixture, vaultKey(bundle, password)).token !== fixtureToken) throw new Error('The vault key did not open the posting key.');
let wrongKeyRejected = false;
try { openNotesKey(sealedFixture, vaultKey(bundle, 'this password is definitely wrong')); } catch { wrongKeyRejected = true; }
if (!wrongKeyRejected) throw new Error('A wrong password unexpectedly opened the posting key.');
const sealedKey = readNotesKey();
if (sealedKey) {
  const current = JSON.parse(readFileSync(join(projectRoot, 'source', 'private', 'posts.enc.json'), 'utf8'));
  const serializedKey = JSON.stringify(sealedKey);
  if (/github_pat_|gh[pousr]_[A-Za-z0-9]/.test(serializedKey)) throw new Error('notes-key.enc.json contains a plain-text token.');
  if (sealedKey.version !== 1 || !sealedKey.cipher || !sealedKey.cipher.iv || !sealedKey.ciphertext) throw new Error('notes-key.enc.json is malformed.');
  if (current.empty || sealedKey.archive !== current.kdf.salt) {
    throw new Error('The notes posting key belongs to an older vault key. Run npm run notes:setup again.');
  }
  if (!existsSync(join(publicRoot, 'private', 'notes-key.enc.json'))) throw new Error('The sealed posting key is not published.');
}

console.log('Validated encrypted private archive, normal-page markers, wrong-password rejection, and no protected-content leakage.');
