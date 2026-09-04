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
  'tags/index.html',
  'design/index.html',
  'gallery/index.html',
  'gallery/all/index.html',
  'css/bluenote.css',
  'js/bluenote.js',
  'css/site.css',
  'css/design-doc.css',
  'css/thought-notes.css',
  'css/private.css',
  'css/gallery.css',
  'js/private.js',
  'js/gallery.js',
  'js/gallery-selection.js',
  'vendor/typed.js/2.0.12/typed.min.js',
  'private/posts.enc.json',
  'private/posts.public.json',
  'local-search.xml',
  '2023/07/31/小蓝本/index.html',
  '2023/09/26/布涅星/index.html',
  '2023/11/19/秋之纽约-2023-11/index.html'
];

for (const path of required) {
  if (!existsSync(join(publicRoot, path))) fail(`Missing generated file: ${path}`);
}

for (const path of ['links/index.html', 'categories/index.html', 'css/main.css', 'js/boot.js', 'js/utils.js', 'xml/local-search.xml',
  'vendor/bootstrap', 'vendor/jquery', 'vendor/iconfont', 'vendor/nprogress', 'css/custom.css', 'css/home.css', 'js/site.js']) {
  if (existsSync(join(publicRoot, path))) fail(`Retired output must not be generated: ${path}`);
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
const homeCover = home.match(/<div id="banner" class="home-cover"[^>]*style="background-image: url\(['"]?([^)'" ]+)['"]?\)/)?.[1];
if (!homeCover || !home.includes('rel="preload" as="image" fetchpriority="high" href="' + homeCover + '"')) {
  fail('Homepage must preload the same cover that its banner displays');
}
const preloadedCover = home.match(/<link rel="preload" as="image"[^>]*href="([^"]+)"/)?.[1];
if (!preloadedCover?.startsWith('/bluenote/images/')) {
  fail('Preloaded cover must be a site image URL without CSS quoting');
}
for (const title of ['小蓝本', '布涅星', '秋之纽约_2023.11']) {
  if (!home.includes(title)) fail(`Home page does not contain post title: ${title}`);
}
for (const asset of ['/bluenote/css/bluenote.css', '/bluenote/js/bluenote.js', '/bluenote/css/site.css', '/bluenote/js/private.js']) {
  if (!home.includes(asset)) fail(`Home page does not load asset: ${asset}`);
}
if (home.includes('href="/bluenote/links/"')) fail('Home navigation still contains Links');
if (!home.includes('href="/bluenote/gallery/"')) fail('Home navigation is missing Gallery');
if (home.includes('/css/gallery.css') || home.includes('/js/gallery.js')) {
  fail('Gallery assets must not load on the article homepage');
}
if (!home.includes('<style id="bluenote-tokens">') || !home.includes('--masthead:#53616b') || !home.includes('--accent:#f3dca6') ||
    !home.includes('--home-nav:#2f4154')) {
  fail('Design tokens (masthead #53616b, accent #f3dca6, home navigation #2f4154) are not emitted in the document head');
}
if (!home.includes('data-typed-text="Dream to be a tranquil spectator."')) {
  fail('Home slogan is missing');
}

const privateCss = readFileSync(join(publicRoot, 'css', 'private.css'), 'utf8');
if (!privateCss.includes('html:not(.private-reading-unlocked) body.home-page .index-card:has(a[data-private-link])')) {
  fail('Locked visitors can still see private posts on the homepage');
}

const themeScript = readFileSync(join(publicRoot, 'js', 'bluenote.js'), 'utf8');
if (!themeScript.includes("matchMedia('(prefers-color-scheme: dark)')")) {
  fail('Theme script does not listen for system color-scheme changes');
}
if (!themeScript.includes('entry.privatePost && !unlocked')) {
  fail('Locked visitors can still discover private posts through search');
}
if (!themeScript.includes('Fluid_Color_Scheme') && !home.includes('data-scheme-legacy="Fluid_Color_Scheme"')) {
  fail('Saved color-scheme preferences from the previous theme are not migrated');
}

const themeCss = readFileSync(join(publicRoot, 'css', 'bluenote.css'), 'utf8');
if (!themeCss.includes('--masthead-height: 216px') || !themeCss.includes('--masthead-height-mobile: 176px')) {
  fail('Editorial masthead no longer uses its established heights');
}
if (!themeCss.includes('--reading-width: 39.667rem')) {
  fail('Article reading column is not the agreed fixed width');
}
if (!/\.scheme-toggle__icon\s*\{/.test(themeCss)) {
  fail('Color-scheme toggle icon styles are missing');
}
const cssWithoutPrint = themeCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media print\s*\{[\s\S]*$/, '');
const importantRules = [...cssWithoutPrint.matchAll(/([^{}]+)\{[^{}]*!important[^{}]*\}/g)].map((match) => match[1].trim().replace(/\s+/g, ' '));
const allowedImportant = new Set(['[hidden]', '.markdown-body > :first-child', '.markdown-body > :last-child']);
const unexpectedImportant = importantRules.filter((selector) => !allowedImportant.has(selector));
if (unexpectedImportant.length || (cssWithoutPrint.match(/!important/g) || []).length !== 3) {
  fail(`Theme CSS uses !important outside the documented exceptions: ${unexpectedImportant.join('; ') || 'count mismatch'}`);
}

const archive = readFileSync(join(publicRoot, 'archives', 'index.html'), 'utf8');
if (!archive.includes('<body class="editorial-page listing-page">')) {
  fail('Archives page does not use the shared editorial layout');
}
if (archive.includes('posts in total')) fail('Archives page still contains the post total');
if (/<div class="masthead"[^>]*style=/.test(archive)) {
  fail('Archives page still contains an image masthead');
}
if (!archive.includes('href="/bluenote/design/"') || !archive.includes('Design Doc') || !archive.includes('listing__item--entry')) {
  fail('Archives page does not contain the Design Doc entry');
}

const tags = readFileSync(join(publicRoot, 'tags', 'index.html'), 'utf8');
if (!tags.includes('<body class="editorial-page listing-page tags-page">') || !tags.includes('href="/bluenote/tags/%E5%85%B6%E4%BB%96/"')) {
  fail('Tags index does not use the editorial listing layout');
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
if (/<div class="masthead"[^>]*style=/.test(about)) {
  fail('About page still contains an image masthead');
}

const notFound = readFileSync(join(publicRoot, '404.html'), 'utf8');
if (!notFound.includes('<body class="error-page">') || !notFound.includes('class="site-nav"') || !notFound.includes('href="/bluenote/"')) {
  fail('404 page does not use the theme navigation with a way home');
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
const allGallery = readFileSync(join(publicRoot, 'gallery/all/index.html'), 'utf8');
if (!allGallery.includes('<body class="editorial-page gallery-page">') ||
    !allGallery.includes('class="gallery-collection"')) {
  fail('Complete Gallery must share the independent editorial layout');
}
for (const asset of ['css/gallery.css', 'js/gallery.js']) {
  if (!allGallery.includes('/bluenote/' + asset)) fail('Complete Gallery asset is missing: ' + asset);
}
const photoCount = (allGallery.match(/data-gallery-open="/g) || []).length;
if (photoCount !== galleryManifest.photos.length) fail('Gallery must only contain explicitly selected photos');
const fullGalleryBayCount = (allGallery.match(/class="gallery-bay/g) || []).length;
if (photoCount && fullGalleryBayCount !== 39) {
  fail('Every authored Gallery spread must have its own exhibition bay');
}
if (photoCount && (!gallery.includes('gallery-grid--few') || !gallery.includes('data-gallery-reshuffle') ||
    !gallery.includes('data-gallery-model') || !gallery.includes('/js/gallery-selection.js'))) {
  fail('Gallery must default to the random small exhibition');
}
if (photoCount && ((gallery.match(/data-gallery-reshuffle(?=[\s>])/g) || []).length !== 2 ||
    !gallery.includes('data-gallery-reshuffle-position="bottom"'))) {
  fail('Small exhibition must provide both opening and closing reshuffle controls');
}
if (photoCount) {
  const model = JSON.parse(gallery.match(/data-gallery-model>([\s\S]*?)<\/script>/)[1]);
  if (JSON.stringify(model.rows.flatMap(row => row.photos.map(photo => photo.id))) !==
      JSON.stringify(galleryManifest.photos.map(photo => photo.id))) {
    fail('Small exhibition must draw from the same complete, ordered photo manifest');
  }
  if (/<img\b/.test(gallery.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''))) {
    fail('Small exhibition must not preload unselected photo elements');
  }
}
if (photoCount && (!allGallery.includes('All photographs') || allGallery.includes('data-gallery-model'))) {
  fail('Complete collection must keep its authored sequence independently');
}
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
if (!/\.gallery-bay\s*\{[^}]*min-height:\s*100svh/s.test(galleryCss)) {
  fail('Gallery spreads must retain a full-viewport exhibition space');
}

const htmlFiles = walk(publicRoot).filter((path) => extname(path) === '.html');
const assetVersions = new Map();
const retiredDependency = /iconfont|alicdn|baomitu|bootstrap|jquery/i;
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const name = relative(publicRoot, htmlFile);
  if (html.includes('id="scroll-top-button"')) {
    fail(`Scroll-to-top button is still generated: ${name}`);
  }
  for (const [element] of html.matchAll(/<(?:link|script)\b[^>]*>/g)) {
    if ((element.startsWith('<script') || element.includes('rel="stylesheet"')) &&
        /(?:href|src)="(?:https?:)?\/\//.test(element)) {
      fail(`CSS and JavaScript must be served by the site: ${name}`);
    }
  }
  // Only tags and class lists count: article text may legitimately mention old libraries,
  // and the image folder theme_fluid_bg keeps its historical name.
  const dependencySurface = [...html.matchAll(/<(?:link|script)\b[^>]*>/g), ...html.matchAll(/\b(?:class|id)="[^"]*"/g)]
    .map((match) => match[0]).join(' ').replace(/theme_fluid_bg/g, '');
  if (retiredDependency.test(dependencySurface) || /fluid|navbar-|mobile-grid|col-lg|nprogress|fancybox|tocbot|anchorjs/i.test(dependencySurface)) {
    fail(`Retired theme dependency referenced in ${name}`);
  }
  if (!html.includes('data-root="/bluenote/"')) fail(`Site root attribute missing in ${name}`);
  if (!html.includes('<meta name="theme-color"')) fail(`theme-color meta missing in ${name}`);
  if (!html.includes('id="bluenote-scheme-boot"')) fail(`Color-scheme boot script missing in ${name}`);
  if (!/\/bluenote\/css\/bluenote\.css\?v=[0-9a-f]{12}/.test(html) || !/\/bluenote\/js\/bluenote\.js\?v=[0-9a-f]{12}/.test(html)) {
    fail(`Theme assets are not referenced with content versions in ${name}`);
  }
  for (const [, url, assetPath, version] of html.matchAll(/(?:href|src)="(\/bluenote\/([^"?#]+\.(?:css|js))(?:\?v=([^"#]+))?)"/g)) {
    const target = join(publicRoot, decodeURIComponent(assetPath));
    if (!existsSync(target)) continue; // Reported by the local reference check below.
    if (!assetVersions.has(target)) {
      assetVersions.set(target, createHash('sha256').update(readFileSync(target)).digest('hex').slice(0, 12));
    }
    if (version !== assetVersions.get(target)) {
      fail(`Stale or missing resource version in ${name}: ${url}`);
    }
  }
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
  if (/<div class="masthead"[^>]*style=/.test(html)) {
    fail(`Post still contains an image masthead: ${relative(publicRoot, generatedPost)}`);
  }
  if (!/<h1 class="masthead__title">/.test(html)) {
    fail(`Post title is not the masthead heading: ${relative(publicRoot, generatedPost)}`);
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
