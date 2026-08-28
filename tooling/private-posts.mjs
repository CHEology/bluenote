import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import frontMatter from 'hexo-front-matter';
import { marked } from 'marked';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicPostsRoot = join(projectRoot, 'source', '_posts');
const privatePostsRoot = join(projectRoot, '.private-posts');
const encryptedArchivePath = join(projectRoot, 'source', 'private', 'posts.enc.json');
const publicManifestPath = join(projectRoot, 'source', 'private', 'posts.public.json');
const iterations = 600000;
const siteRoot = '/bluenote/';

function base64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64');
}

function normalizedDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split(/[ T]/)[0];
}

function rawFrontMatterValue(raw, field) {
  var match = raw.match(new RegExp('^' + field + ':\\s*(.+)$', 'm'));
  return match ? match[1].trim() : '';
}

function postId(filename) {
  return createHash('sha256').update(filename).digest('hex').slice(0, 16);
}

export function serializePrivatePost(filename, raw) {
  const parsed = frontMatter.parse(raw);
  if (!parsed.title || !parsed.date || !parsed.description) {
    throw new Error(`${filename} must include title, date, and description in its front matter.`);
  }

  const dateValue = rawFrontMatterValue(raw, 'date');
  const updatedValue = rawFrontMatterValue(raw, 'updated') || dateValue;
  const date = dateValue ? dateValue.split(/[ T]/)[0] : normalizedDate(parsed.date);
  const permalink = parsed.permalink
    ? String(parsed.permalink).replace(/^\/+|\/+$/g, '') + '/'
    : [date.replace(/-/g, '/'), String(parsed.slug || filename.replace(/\.md$/, ''))].join('/') + '/';

  return {
    id: postId(filename),
    filename,
    title: String(parsed.title),
    date,
    dateSource: dateValue,
    updated: updatedValue ? updatedValue.split(/[ T]/)[0] : normalizedDate(parsed.updated || parsed.date),
    updatedSource: updatedValue,
    description: String(parsed.description),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : parsed.tags ? [String(parsed.tags)] : [],
    permalink,
    url: encodeURI(siteRoot + permalink),
    html: marked.parse(parsed._content || '', { gfm: true }),
    source: raw
  };
}

function privateStub(post) {
  const tags = post.tags.length
    ? `tags:\n${post.tags.map((tag) => `  - ${tag}`).join('\n')}`
    : 'tags:';
  return `---
title: ${post.title}
permalink: ${post.permalink}
date: ${post.dateSource || post.date}
updated: ${post.updatedSource || post.updated}
${tags}
description: Private reading.
index_img:
private_post: true
private_id: ${post.id}
---

<section class="private-post-shell" data-private-post-id="${post.id}">
  <div class="private-post-shell__locked" data-private-post-locked>
    <span class="private-post-shell__lock" aria-hidden="true"></span>
    <p class="private-post-shell__label">PRIVATE READING</p>
    <p class="private-post-shell__message">这篇文章需要先解锁私人阅读。</p>
    <button type="button" data-private-unlock>输入密码</button>
  </div>
  <div class="private-post-shell__content" data-private-post-content hidden></div>
</section>
`;
}

function syncPublicPrivateFiles(posts) {
  const filenames = new Set(posts.map((post) => post.filename));
  readdirSync(publicPostsRoot).filter((name) => name.endsWith('.md')).forEach((filename) => {
    const path = join(publicPostsRoot, filename);
    if (!filenames.has(filename) && /^private_post:\s*true$/m.test(readFileSync(path, 'utf8'))) {
      unlinkSync(path);
    }
  });

  posts.forEach((post) => {
    const path = join(publicPostsRoot, post.filename);
    if (!existsSync(path) || /^private_post:\s*true$/m.test(readFileSync(path, 'utf8'))) {
      writeFileSync(path, privateStub(post));
    }
  });

  writeFileSync(publicManifestPath, `${JSON.stringify({
    version: 1,
    posts: posts.map(({ id, filename, title, date, url }) => ({ id, filename, title, date, url }))
  }, null, 2)}\n`);
}

export function encryptPrivateArchive(posts, password) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('Private password must contain at least 16 characters.');
  }

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.from(JSON.stringify({ version: 1, posts }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: base64(salt)
    },
    cipher: {
      name: 'AES-256-GCM',
      iv: base64(iv)
    },
    ciphertext: base64(Buffer.concat([ciphertext, authenticationTag]))
  };
}

export function decryptPrivateArchive(bundle, password) {
  if (!bundle || bundle.empty) return { version: 1, posts: [] };
  const salt = fromBase64(bundle.kdf.salt);
  const iv = fromBase64(bundle.cipher.iv);
  const encrypted = fromBase64(bundle.ciphertext);
  const ciphertext = encrypted.subarray(0, -16);
  const authenticationTag = encrypted.subarray(-16);
  const key = pbkdf2Sync(password, salt, bundle.kdf.iterations, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authenticationTag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

function readBundle() {
  return JSON.parse(readFileSync(encryptedArchivePath, 'utf8'));
}

function privateMarkdownFiles() {
  if (!existsSync(privatePostsRoot)) return [];
  return readdirSync(privatePostsRoot).filter((name) => name.endsWith('.md')).sort();
}

async function hiddenPassword(message = 'Private password: ') {
  if (process.env.BLUENOTE_PRIVATE_PASSWORD) return process.env.BLUENOTE_PRIVATE_PASSWORD;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Set BLUENOTE_PRIVATE_PASSWORD when running without an interactive terminal.');
  }

  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolvePassword, rejectPassword) => {
    let value = '';
    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) rejectPassword(error);
      else resolvePassword(value);
    }
    function onData(character) {
      if (character === '\u0003') return finish(new Error('Cancelled.'));
      if (character === '\r' || character === '\n') return finish();
      if (character === '\u007f') {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    }
    process.stdin.on('data', onData);
  });
}

function requireSafeFilename(input) {
  if (!input) throw new Error('Provide a Markdown filename, for example: npm run private:hide -- "文章.md"');
  const name = basename(input);
  if (name !== input && resolve(input) !== resolve(publicPostsRoot, name)) {
    throw new Error('Use a filename from source/_posts, not an arbitrary path.');
  }
  if (!name.endsWith('.md')) throw new Error('Private posts must be Markdown files.');
  return name;
}

async function syncArchive(password, { allowEmpty = false } = {}) {
  const files = privateMarkdownFiles();
  if (files.length === 0) {
    const current = readBundle();
    if (!current.empty && !allowEmpty) {
      throw new Error('Private source folder is empty. Run private:restore before syncing, so the encrypted archive is not erased.');
    }
    writeFileSync(encryptedArchivePath, `${JSON.stringify({
      version: 1,
      empty: true,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations },
      cipher: { name: 'AES-256-GCM' }
    }, null, 2)}\n`);
    syncPublicPrivateFiles([]);
    return 0;
  }

  const current = readBundle();
  if (!current.empty) decryptPrivateArchive(current, password);
  const posts = files.map((filename) =>
    serializePrivatePost(filename, readFileSync(join(privatePostsRoot, filename), 'utf8'))
  );
  const encrypted = encryptPrivateArchive(posts, password);
  writeFileSync(encryptedArchivePath, `${JSON.stringify(encrypted, null, 2)}\n`);
  syncPublicPrivateFiles(posts);
  return posts.length;
}

async function hidePost(input) {
  const filename = requireSafeFilename(input);
  const source = join(publicPostsRoot, filename);
  const destination = join(privatePostsRoot, filename);
  if (!existsSync(source)) throw new Error(`Public post not found: ${filename}`);
  if (existsSync(destination)) throw new Error(`Private post already exists: ${filename}`);

  const password = await hiddenPassword();
  if (password.length < 16) throw new Error('Private password must contain at least 16 characters.');
  const current = readBundle();
  if (!current.empty) decryptPrivateArchive(current, password);
  if (current.empty && !process.env.BLUENOTE_PRIVATE_PASSWORD) {
    const confirmation = await hiddenPassword('Repeat private password: ');
    if (confirmation !== password) throw new Error('The two passwords did not match.');
  }

  mkdirSync(privatePostsRoot, { recursive: true });
  renameSync(source, destination);
  try {
    const count = await syncArchive(password);
    console.log(`Hidden ${filename}. Encrypted archive now contains ${count} post(s).`);
  } catch (error) {
    renameSync(destination, source);
    throw error;
  }
}

async function publishPost(input) {
  const filename = requireSafeFilename(input);
  const source = join(privatePostsRoot, filename);
  const destination = join(publicPostsRoot, filename);
  if (!existsSync(source)) throw new Error(`Private source not found: ${filename}. Run private:restore first on a fresh clone.`);
  if (existsSync(destination) && !/^private_post:\s*true$/m.test(readFileSync(destination, 'utf8'))) {
    throw new Error(`Public post already exists: ${filename}`);
  }

  const password = await hiddenPassword();
  decryptPrivateArchive(readBundle(), password);
  renameSync(source, destination);
  try {
    const count = await syncArchive(password, { allowEmpty: true });
    console.log(`Published ${filename}. Encrypted archive now contains ${count} post(s).`);
  } catch (error) {
    renameSync(destination, source);
    throw error;
  }
}

async function restorePrivateSources() {
  const bundle = readBundle();
  if (bundle.empty) {
    console.log('The encrypted archive is empty.');
    return;
  }
  const password = await hiddenPassword();
  const payload = decryptPrivateArchive(bundle, password);
  mkdirSync(privatePostsRoot, { recursive: true });
  for (const post of payload.posts) {
    const destination = join(privatePostsRoot, basename(post.filename));
    if (existsSync(destination) && readFileSync(destination, 'utf8') !== post.source) {
      throw new Error(`Refusing to overwrite a changed private source: ${post.filename}`);
    }
    writeFileSync(destination, post.source);
  }
  console.log(`Restored ${payload.posts.length} private source file(s) into .private-posts/.`);
}

async function listPrivatePosts() {
  const local = privateMarkdownFiles();
  if (local.length > 0) {
    local.forEach((filename) => console.log(filename));
    return;
  }
  const bundle = readBundle();
  if (bundle.empty) {
    console.log('No private posts.');
    return;
  }
  const password = await hiddenPassword();
  decryptPrivateArchive(bundle, password).posts.forEach((post) => console.log(post.filename));
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case 'hide':
      await hidePost(argument);
      break;
    case 'publish':
      await publishPost(argument);
      break;
    case 'sync': {
      const password = await hiddenPassword();
      const current = readBundle();
      if (current.empty && privateMarkdownFiles().length > 0 && !process.env.BLUENOTE_PRIVATE_PASSWORD) {
        const confirmation = await hiddenPassword('Repeat private password: ');
        if (confirmation !== password) throw new Error('The two passwords did not match.');
      }
      const count = await syncArchive(password);
      console.log(`Encrypted ${count} private post(s).`);
      break;
    }
    case 'restore':
      await restorePrivateSources();
      break;
    case 'list':
      await listPrivatePosts();
      break;
    default:
      throw new Error('Use one of: hide, publish, sync, restore, list.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Private post operation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
