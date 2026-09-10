const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const frontMatter = require('hexo-front-matter');
const { renderFeed, xml } = require('./lib/rss.cjs');

const config = { title: 'Blue Note', description: 'Public notes', url: 'https://example.com/bluenote' };
const manifest = { version: 1, posts: [{ id: 'private-id', filename: 'private.md', url: '/bluenote/private/' }] };
const publicPost = { title: '公开文章', description: '已有摘要', source: '_posts/public.md',
  date: new Date('2026-09-05T12:00:00Z'), permalink: config.url + '/public/' };
const privatePost = { ...publicPost, title: 'SECRET TITLE', description: 'SECRET SUMMARY',
  private_post: true, private_id: 'private-id', source: '_posts/private.md',
  permalink: config.url + '/private/', date: new Date('2099-01-01T00:00:00Z') };

test('private additions, edits and removals leave the entire RSS byte-identical', () => {
  const original = renderFeed([publicPost], config, { version: 1, posts: [] });
  const changed = { ...privatePost, title: 'CHANGED SECRET', description: 'CHANGED BODY', updated: new Date() };
  assert.equal(renderFeed([publicPost, privatePost], config, manifest), original);
  assert.equal(renderFeed([changed, publicPost], config, manifest), original);
  assert.equal(renderFeed([publicPost], config, manifest), original);
  assert.doesNotMatch(original, /SECRET|private-id|lastBuildDate|content:encoded/);
});

test('each private marker and manifest identity independently excludes an article', () => {
  const empty = renderFeed([], config, manifest);
  for (const identity of [
    { private_post: true }, { private_post: 'true' }, { private_id: 'another-id' },
    { source: '_posts/private.md' }, { permalink: config.url + '/private/' }
  ]) assert.equal(renderFeed([{ ...publicPost, ...identity }], config, manifest), empty);
  const unicode = { version: 1, posts: [{ id: 'id', filename: '另一个.md', url: '/bluenote/私密/' }] };
  assert.equal(renderFeed([{ ...publicPost, permalink: config.url + '/%E7%A7%81%E5%AF%86/' }], config, unicode),
    renderFeed([], config, unicode));
});

test('missing or malformed private manifest fails closed', () => {
  for (const bad of [undefined, {}, { version: 1 }, { version: 1, posts: [{}] }, { version: 2, posts: [] }]) {
    assert.throws(() => renderFeed([publicPost], config, bad), /valid private-post manifest/);
  }
});

test('drafts and non-article pages never enter the feed', () => {
  const candidates = [{ ...publicPost, published: false }, { ...publicPost, source: '_drafts/draft.md' },
    { ...publicPost, source: 'about/index.md' }, { ...publicPost, source: 'gallery/index.md' }];
  assert.equal(renderFeed(candidates, config, manifest), renderFeed([], config, manifest));
});

test('RSS never reads full text or excerpts and ignores modification times', () => {
  const post = { ...publicPost, updated: new Date('2099-01-01T00:00:00Z'),
    get content() { throw new Error('Full text accessed'); },
    get excerpt() { throw new Error('Excerpt accessed'); } };
  assert.equal(renderFeed([post], config, manifest), renderFeed([publicPost], config, manifest));
  post.description = '';
  assert.doesNotMatch(renderFeed([post], config, manifest), /已有摘要/);
});

test('stable links identify items; sorting and XML escaping are deterministic', () => {
  const other = { ...publicPost, title: 'A & B < C', description: '正文 & <em>摘要</em>',
    permalink: config.url + '/another/?a=1&b=2' };
  const feed = renderFeed([publicPost, other], config, manifest);
  assert.equal(feed, renderFeed([other, publicPost], config, manifest));
  assert.match(feed, /<title>A &amp; B &lt; C<\/title>/);
  assert.match(feed, /<description>正文 &amp; 摘要<\/description>/);
  assert.match(feed, /<pubDate>Sat, 05 Sep 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(feed, /<guid isPermaLink="true">https:\/\/example\.com\/bluenote\/public\/<\/guid>/);
});

test('generated RSS includes every public article, excludes private identities and is discoverable', () => {
  const root = join(__dirname, '..');
  const feed = readFileSync(join(root, 'public/rss.xml'), 'utf8');
  const posts = readdirSync(join(root, 'source/_posts')).filter(f => f.endsWith('.md'))
    .map(f => frontMatter.parse(readFileSync(join(root, 'source/_posts', f), 'utf8')));
  const visible = posts.filter(p => !p.private_post && !p.private_id);
  assert.equal((feed.match(/<item>/g) || []).length, visible.length);
  for (const post of visible) assert.ok(feed.includes('<title>' + xml(post.title) + '</title>'));
  const privateManifest = JSON.parse(readFileSync(join(root, 'source/private/posts.public.json'), 'utf8'));
  for (const post of privateManifest.posts) {
    for (const secret of [post.title, post.id, post.filename, post.url, decodeURIComponent(post.url)]) {
      assert.ok(!feed.includes(secret), 'Private metadata entered RSS');
    }
  }
  assert.doesNotMatch(feed, /private-post|posts\.enc|posts\.public|<script|<enclosure|<content:encoded/);
  const about = readFileSync(join(root, 'public/about/index.html'), 'utf8');
  assert.match(about, /<footer class="about-rss">/);
  assert.match(about, /class="about-rss__link" href="\/bluenote\/rss\.xml"/);
  assert.match(about, /<span>RSS<\/span>/);
  assert.match(about, /rel="alternate" type="application\/rss\+xml"/);
});
