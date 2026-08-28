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

const generatedHome = readFileSync(join(publicRoot, 'index.html'), 'utf8');
const generatedPrivatePost = readFileSync(join(publicRoot, '2023', '07', '31', '小蓝本', 'index.html'), 'utf8');
const generatedBundle = readFileSync(join(publicRoot, 'private', 'posts.enc.json'), 'utf8');
const generatedManifest = readFileSync(join(publicRoot, 'private', 'posts.public.json'), 'utf8');
const generatedPrivateScript = readFileSync(join(publicRoot, 'js', 'private.js'), 'utf8');
if (!generatedHome.includes('data-private-link="eeddfa74ef298a0c"')) {
  throw new Error('Private post is not marked on the generated home page.');
}
if (!generatedPrivatePost.includes('data-private-post-id="eeddfa74ef298a0c"')) {
  throw new Error('Generated private post shell is missing.');
}
if (generatedBundle.includes(secretTitle) || generatedBundle.includes(secretBody)) {
  throw new Error('Private fixture leaked into the generated archive.');
}
if (!generatedManifest.includes('小蓝本') || generatedManifest.includes(secretBody)) {
  throw new Error('Public private-post manifest is missing its title or leaks protected content.');
}
if (!generatedPrivateScript.includes('是否退出解锁状态？') ||
    !generatedPrivateScript.includes('data-private-lock-control') ||
    !generatedPrivateScript.includes('window.localStorage.removeItem(storageKey)')) {
  throw new Error('Archive unlock-exit control is missing or does not clear the saved site key.');
}

console.log('Validated encrypted private archive, normal-page markers, wrong-password rejection, and no protected-content leakage.');
