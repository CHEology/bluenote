import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decryptPrivateArchive,
  encryptPrivateArchive,
  serializePrivatePost
} from './private-posts.mjs';

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

const generatedPrivatePage = readFileSync(join(publicRoot, 'private', 'index.html'), 'utf8');
const generatedBundle = readFileSync(join(publicRoot, 'private', 'posts.enc.json'), 'utf8');
if (!generatedPrivatePage.includes('data-private-vault')) {
  throw new Error('Generated private reading page is missing.');
}
if (generatedPrivatePage.includes(secretTitle) || generatedPrivatePage.includes(secretBody)) {
  throw new Error('Private fixture leaked into the generated reading page.');
}
if (generatedBundle.includes(secretTitle) || generatedBundle.includes(secretBody)) {
  throw new Error('Private fixture leaked into the generated archive.');
}

console.log('Validated encrypted private archive, wrong-password rejection, and no plaintext leakage.');
