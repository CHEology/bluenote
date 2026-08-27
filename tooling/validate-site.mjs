import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = join(projectRoot, 'public');
const sourcePosts = join(projectRoot, 'source', '_posts');
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const required = [
  'index.html',
  '404.html',
  'about/index.html',
  'links/index.html',
  'archives/index.html',
  'local-search.xml',
  '2023/07/31/小蓝本/index.html',
  '2023/09/26/布涅星/index.html',
  '2023/11/19/秋之纽约-2023-11/index.html',
  'css/home.css',
  'css/custom.css',
  'js/site.js',
  'js/home.js'
];

for (const path of required) {
  if (!existsSync(join(publicRoot, path))) fail(`Missing generated file: ${path}`);
}

const markdownPosts = readdirSync(sourcePosts).filter((name) => name.endsWith('.md'));
for (const post of markdownPosts) {
  const source = readFileSync(join(sourcePosts, post), 'utf8');
  const frontMatter = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontMatter) {
    fail(`Missing YAML front matter: ${post}`);
    continue;
  }
  for (const field of ['title', 'date', 'description']) {
    if (!new RegExp(`^${field}:\\s*\\S`, 'm').test(frontMatter[1])) {
      fail(`Missing required front matter field "${field}": ${post}`);
    }
  }
}

const home = readFileSync(join(publicRoot, 'index.html'), 'utf8');
for (const title of ['小蓝本', '布涅星', '秋之纽约_2023.11']) {
  if (!home.includes(title)) fail(`Home page does not contain post title: ${title}`);
}
for (const asset of ['/bluenote/css/home.css', '/bluenote/css/custom.css', '/bluenote/js/site.js']) {
  if (!home.includes(asset)) fail(`Home page does not load custom asset: ${asset}`);
}

const htmlFiles = walk(publicRoot).filter((path) => extname(path) === '.html');
const generatedPosts = htmlFiles.filter((path) =>
  readFileSync(path, 'utf8').includes('<article class="post-content')
);
if (generatedPosts.length !== markdownPosts.length) {
  fail(`Generated ${generatedPosts.length} post pages from ${markdownPosts.length} Markdown posts`);
}

const localReference = /(?:href|src)=["'](\/bluenote\/[^"'#?]*)/g;

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  let match;
  while ((match = localReference.exec(html))) {
    let decoded;
    try {
      decoded = decodeURIComponent(match[1]);
    } catch {
      fail(`Invalid encoded URL in ${relative(publicRoot, htmlFile)}: ${match[1]}`);
      continue;
    }

    let target = join(publicRoot, decoded.slice('/bluenote/'.length));
    if (decoded.endsWith('/')) target = join(target, 'index.html');
    if (!existsSync(target)) {
      fail(`Broken local reference in ${relative(publicRoot, htmlFile)}: ${match[1]}`);
    }
  }
}

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} error(s):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Validated ${markdownPosts.length} Markdown posts and ${htmlFiles.length} generated HTML pages.`);
