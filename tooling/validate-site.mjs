import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  'archives/index.html',
  'design/index.html',
  'gallery/index.html',
  'css/gallery.css',
  'js/gallery.js',
  'private/posts.enc.json',
  'private/posts.public.json',
  'local-search.xml',
  '2023/07/31/小蓝本/index.html',
  '2023/09/26/布涅星/index.html',
  '2023/11/19/秋之纽约-2023-11/index.html',
  'css/home.css',
  'css/custom.css',
  'css/private.css',
  'css/search.css',
  'css/typography.css',
  'js/site.js',
  'js/private.js',
  'js/search.js',
  'js/home.js'
];

for (const path of required) {
  if (!existsSync(join(publicRoot, path))) fail(`Missing generated file: ${path}`);
}

if (existsSync(join(publicRoot, 'links', 'index.html'))) {
  fail('Links page must remain disabled');
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

  const externalImages = source.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g);
  for (const image of externalImages) {
    fail(`Externally hosted display image in ${post}: ${image[1]}`);
  }

  const externalHtmlImages = source.matchAll(/<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi);
  for (const image of externalHtmlImages) {
    fail(`Externally hosted HTML image in ${post}: ${image[1]}`);
  }
}

const home = readFileSync(join(publicRoot, 'index.html'), 'utf8');
if (!/<html\b[^>]*class="home-root"/.test(home) || !home.includes('<body class="home-page">')) {
  fail('Homepage must have its current layout before any JavaScript executes');
}
const homeCover = home.match(/<div id="banner"[^>]*style="background: url\(['"]?([^)'" ]+)['"]?\)/)?.[1];
if (!homeCover || !home.includes('rel="preload" as="image" fetchpriority="high" href="' + homeCover + '"')) {
  fail('Homepage must preload the same cover that its banner displays');
}
const preloadedCover = home.match(/<link rel="preload" as="image"[^>]*href="([^"]+)"/)?.[1];
if (!preloadedCover?.startsWith('/bluenote/images/')) {
  fail('Preloaded cover must be a site image URL without CSS quoting');
}
for (const [element] of home.matchAll(/<(?:link|script)\b[^>]*>/g)) {
  if ((element.startsWith('<script') || element.includes('rel="stylesheet"')) &&
      /(?:href|src)="(?:https?:)?\/\//.test(element)) {
    fail('Homepage CSS and JavaScript must be served by the site');
  }
}
for (const title of ['小蓝本', '布涅星', '秋之纽约_2023.11']) {
  if (!home.includes(title)) fail(`Home page does not contain post title: ${title}`);
}
for (const asset of ['/bluenote/css/home.css', '/bluenote/css/custom.css', '/bluenote/css/typography.css', '/bluenote/js/site.js']) {
  if (!home.includes(asset)) fail(`Home page does not load custom asset: ${asset}`);
}
if (home.includes('href="/bluenote/links/"')) fail('Home navigation still contains Links');
if (!home.includes('href="/bluenote/gallery/"')) fail('Home navigation is missing Gallery');
if (home.includes('/css/gallery.css') || home.includes('/js/gallery.js')) {
  fail('Gallery assets must not load on the article homepage');
}
if (!/<div id="banner" class="banner"[^>]*style="background: url/.test(home)) {
  fail('Home page no longer contains its visual cover');
}

const privateCss = readFileSync(join(publicRoot, 'css', 'private.css'), 'utf8');
if (!privateCss.includes('html:not(.private-reading-unlocked) body.home-page .index-card:has(a[data-private-link])')) {
  fail('Locked visitors can still see private posts on the homepage');
}

const siteScript = readFileSync(join(publicRoot, 'js', 'site.js'), 'utf8');
if (!siteScript.includes("matchMedia('(prefers-color-scheme: dark)')")) {
  fail('Site script does not listen for system color-scheme changes');
}

const searchScript = readFileSync(join(publicRoot, 'js', 'search.js'), 'utf8');
if (!searchScript.includes("entry.privatePost && !document.documentElement.classList.contains('private-reading-unlocked')")) {
  fail('Locked visitors can still discover private posts through search');
}

const archive = readFileSync(join(publicRoot, 'archives', 'index.html'), 'utf8');
if (!archive.includes('<body class="editorial-page listing-page">')) {
  fail('Archives page does not use the shared editorial layout');
}
if (archive.includes('posts in total')) fail('Archives page still contains the post total');
if (/<div id="banner" class="banner"[^>]*style=/.test(archive)) {
  fail('Archives page still contains an image masthead');
}
if (!archive.includes('href="/bluenote/design/"') || !archive.includes('Design Doc')) {
  fail('Archives page does not contain the Design Doc entry');
}

const design = readFileSync(join(publicRoot, 'design', 'index.html'), 'utf8');
if (!design.includes('<body class="editorial-page design-doc-page">')) {
  fail('Design Doc page does not use its editorial layout');
}
if (!design.includes('class="markdown-body design-document"')) {
  fail('Design Doc page does not contain the generated canonical document');
}
if (!design.includes('## 1. 设计目标') && !design.includes('1. 设计目标')) {
  fail('Design Doc page is missing its first design section');
}

const about = readFileSync(join(publicRoot, 'about', 'index.html'), 'utf8');
if (!about.includes('<body class="editorial-page about-page">')) {
  fail('About page does not use the shared editorial layout');
}
if (/<div id="banner" class="banner"[^>]*style=/.test(about)) {
  fail('About page still contains an image masthead');
}

const gallery = readFileSync(join(publicRoot, 'gallery', 'index.html'), 'utf8');
const galleryManifest = JSON.parse(readFileSync(join(projectRoot, 'source/_data/gallery.json'), 'utf8'));
if (!gallery.includes('<body class="editorial-page gallery-page">') ||
    !gallery.includes('class="gallery-collection"')) {
  fail('Gallery must be an independent editorial page');
}
for (const asset of ['css/gallery.css', 'js/gallery.js']) {
  if (!gallery.includes('/bluenote/' + asset)) fail('Gallery asset is missing: ' + asset);
}
const photoCount = (gallery.match(/data-gallery-open="/g) || []).length;
if (photoCount !== galleryManifest.photos.length) fail('Gallery must only contain explicitly selected photos');
if (photoCount === 0 && (!gallery.includes('尚未收录照片。') || gallery.includes('<dialog'))) {
  fail('Empty Gallery must have an honest empty state without inactive controls');
}
if (gallery.includes('article class="post-content') || (photoCount === 0 && gallery.includes('DSC_0034'))) {
  fail('Gallery must not import the New York blog article');
}
const galleryCss = readFileSync(join(publicRoot, 'css/gallery.css'), 'utf8');
if (galleryCss.includes('object-fit: cover') || !galleryCss.includes('object-fit: contain')) {
  fail('Gallery must preserve complete photo framing');
}

const htmlFiles = walk(publicRoot).filter((path) => extname(path) === '.html');
const assetVersions = new Map();
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  if (html.includes('id="scroll-top-button"')) {
    fail(`Scroll-to-top button is still generated: ${relative(publicRoot, htmlFile)}`);
  }
  for (const [, url, assetPath, version] of html.matchAll(/(?:href|src)="(\/bluenote\/([^"?#]+\.(?:css|js))(?:\?v=([^"#]+))?)"/g)) {
    const target = join(publicRoot, decodeURIComponent(assetPath));
    if (!existsSync(target)) continue; // Reported by the local reference check below.
    if (!assetVersions.has(target)) {
      assetVersions.set(target, createHash('sha256').update(readFileSync(target)).digest('hex').slice(0, 12));
    }
    if (version !== assetVersions.get(target)) {
      fail(`Stale or missing resource version in ${relative(publicRoot, htmlFile)}: ${url}`);
    }
  }
}

const customCss = readFileSync(join(publicRoot, 'css', 'custom.css'), 'utf8');
if (!customCss.includes('#color-toggle-btn .nav-link:hover #color-toggle-icon')) {
  fail('Color-scheme icon does not preserve its visibility on hover');
}
if (!customCss.includes('--masthead-background: #53616b')) {
  fail('Editorial masthead is no longer a stable solid color');
}
if (!customCss.includes('height: 216px !important')) {
  fail('Editorial masthead no longer uses its established height');
}
if (!customCss.includes('#mobile-grid-menu .mobile-grid-item > i')) {
  fail('Mobile navigation no longer suppresses decorative category icons');
}
if (!customCss.includes('--navbar-hover-color: #f3dca6')) {
  fail('Navigation hover state no longer contrasts with the blue masthead');
}
for (const icon of ['icon-home-fill', 'icon-archive-fill', 'icon-user-fill']) {
  if (home.includes(icon)) fail(`Desktop navigation still contains decorative icon: ${icon}`);
}

const generatedPosts = htmlFiles.filter((path) =>
  readFileSync(path, 'utf8').includes('<article class="post-content')
);
if (generatedPosts.length !== markdownPosts.length) {
  fail(`Generated ${generatedPosts.length} post pages from ${markdownPosts.length} Markdown posts`);
}
for (const generatedPost of generatedPosts) {
  const html = readFileSync(generatedPost, 'utf8');
  if (!/<body class="editorial-page post-page(?: [^"]+)?">/.test(html)) {
    fail(`Post does not use the shared editorial layout: ${relative(publicRoot, generatedPost)}`);
  }
  if (/<div id="banner" class="banner"[^>]*style=/.test(html)) {
    fail(`Post still contains an image masthead: ${relative(publicRoot, generatedPost)}`);
  }

  const galleryImages = html.match(/<img\b[^>]*\bsrc=["'][^"']*\/images\/galleries\/[^"']+["'][^>]*>/gi) || [];
  if (galleryImages.length >= 3 && !/<body class="[^"]*\bphoto-post\b/.test(html)) {
    fail(`Photo post must have its final layout before JavaScript: ${relative(publicRoot, generatedPost)}`);
  }
  galleryImages.forEach((image, index) => {
    for (const attribute of ['srcset=', 'sizes=', 'width=', 'height=', 'decoding="async"']) {
      if (!image.includes(attribute)) {
        fail(`Gallery image lacks ${attribute} in ${relative(publicRoot, generatedPost)}`);
      }
    }
    const expectedLoading = index === 0 ? 'loading="eager"' : 'loading="lazy"';
    if (!image.includes(expectedLoading)) {
      fail(`Gallery image has incorrect loading priority in ${relative(publicRoot, generatedPost)}`);
    }
  });
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
