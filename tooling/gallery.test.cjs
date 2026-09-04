const test = require('node:test');
const assert = require('node:assert/strict');
const { mountGallery, drawSelection } = require('../source/js/gallery.js');
const { pickSelection, composeSelection } = require('../source/js/gallery-selection.js');
const { validateGallery, renderGallery, curatedRows } = require('./lib/gallery.cjs');

function photo(id = 'photo-001', width = 6000, height = 4000) {
  return {
    id, alt: 'Photo ' + id,
    full: { src: '/images/test/' + id + '.jpg', width, height },
    previews: [
      { src: '/images/test/' + id + '-800.jpg', width: 800, height: Math.round(800 * height / width) },
      { src: '/images/test/' + id + '-1600.jpg', width: 1600, height: Math.round(1600 * height / width) }
    ]
  };
}

test('empty Gallery is intentional and contains no sample photos or inactive controls', () => {
  assert.deepEqual(validateGallery({ version: 1, photos: [] }), []);
  const html = renderGallery([], '/bluenote/');
  assert.match(html, /尚未收录照片。/);
  assert.doesNotMatch(html, /<img|<dialog|data-gallery-open|DSC_/);
});

test('curated spreads preserve fifty photos, diptychs, and continuous sequences', () => {
  const manifest = require('../source/_data/gallery.json');
  const selected = require('./gallery-selection.json').entries;
  const photos = validateGallery(manifest, require('node:path').join(__dirname, '..', 'source'));
  const rows = curatedRows(photos);
  assert.equal(photos.length, 50);
  assert.equal(rows.length, 39);
  assert.equal(rows.filter(row => row.photos.length === 2).length, 11);
  assert.deepEqual(rows.flatMap(row => row.photos.map(photo => photo.id)), selected.map(photo => photo.id));
  assert.deepEqual(rows.find(row => row.sequence === 'glass').photos.map(p => p.id), ['dsc-5180', 'dsc-5182']);
  assert.deepEqual(rows.find(row => row.sequence === 'field').photos.map(p => p.id), ['dsc-6549', 'dsc-6549-2']);
  assert.equal(rows.filter(row => row.sequence === 'snow').length, 12);
  assert.equal(rows.filter(row => row.continuation).length, 11);
  const html = renderGallery(photos, '/bluenote/');
  assert.equal((html.match(/data-gallery-spread=/g) || []).length, 39);
  assert.equal((html.match(/class="gallery-bay/g) || []).length, 39);
  assert.equal((html.match(/gallery-bay--continuation/g) || []).length, 11);
  assert.match(html, /<div class="gallery-bay[^\"]*"><div class="gallery-row/);
  assert.doesNotMatch(html, /<figcaption>|gallery-row--partial/);
});

test('invalid or fragmented spreads/sequences cannot silently separate related photographs', () => {
  const p = (id, spread, sequence) => ({ ...photo(id), spread, sequence });
  assert.throws(() => curatedRows([p('a', 'one'), p('b', 'two'), p('c', 'one')]), /contiguous/);
  assert.throws(() => curatedRows([p('a', 'one'), p('b', 'one'), p('c', 'one')]), /at most two/);
  assert.throws(() => curatedRows([p('a', 'one', 'snow'), p('b', 'two'), p('c', 'three', 'snow')]), /contiguous/);
  assert.throws(() => curatedRows([p('a', 'one', 'snow'), p('b', 'one')]), /split a sequence/);
  assert.throws(() => curatedRows([p('a', '<unsafe>')]), /Invalid/);
  assert.deepEqual(curatedRows([]), []);
});

test('photo order and full-frame dimensions survive rendering; srcset excludes originals', () => {
  const items = [photo('last-file'), photo('first-file', 4000, 6000), photo('wide', 6000, 2000)];
  const html = renderGallery(validateGallery({ version: 1, photos: items }), '/bluenote/');
  assert.ok(html.indexOf('data-gallery-open="last-file"') < html.indexOf('data-gallery-open="first-file"'));
  assert.match(html, /data-width="4000" data-height="6000"/);
  assert.match(html, /width="4000" height="6000"/);
  assert.match(html, /href="\/bluenote\/images\/test\/last-file.jpg"/);
  for (const [, srcset] of html.matchAll(/srcset="([^"]+)"/g)) {
    assert.doesNotMatch(srcset, /(?:last-file|first-file|wide)\.jpg/);
  }
  assert.equal((html.match(/loading="eager"/g) || []).length, 2);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 1);
  assert.doesNotMatch(html, /<figcaption>|fancybox|markdown-body/);
});

test('only author-supplied captions render, with safe literal text', () => {
  const item = photo();
  item.caption = '<script>alert("x")</script>\n&';
  item.alt = '" onerror="bad';
  const html = renderGallery(validateGallery({ version: 1, photos: [item] }), '/');
  assert.match(html, /<figcaption>&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert| onerror="bad/);
  assert.match(html, /&quot; onerror=&quot;bad/);
});

function seededRandom(seed = 42) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('a thousand successive selections contain 3–5 fresh photos and preserve complete diptychs', () => {
  const units = curatedRows(require('../source/_data/gallery.json').photos);
  const unchanged = JSON.stringify(units);
  const random = seededRandom();
  const counts = new Set();
  let previous = [];
  for (let i = 0; i < 1000; i++) {
    const selection = pickSelection(units, previous, random);
    const ids = selection.flatMap(unit => unit.photos.map(p => p.id));
    counts.add(ids.length);
    assert.ok(ids.length >= 3 && ids.length <= 5);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => !previous.includes(id)));
    const arranged = composeSelection(selection);
    assert.deepEqual(arranged.flatMap(row => row.photos.map(p => p.id)), ids);
    for (const unit of selection.filter(unit => unit.photos.length === 2)) {
      assert.ok(arranged.some(row => !row.counterpoint &&
        row.photos.map(p => p.id).join() === unit.photos.map(p => p.id).join()));
    }
    assert.ok(arranged.every(row => row.photos.length <= 2));
    previous = ids;
  }
  assert.deepEqual([...counts].sort(), [3, 4, 5]);
  assert.equal(JSON.stringify(units), unchanged);
});

test('selection composition protects a generous lead and avoids tiny mixed-ratio side images', () => {
  const unit = (id, width, height) => ({ photos: [photo(id, width, height)] });
  const rows = composeSelection([unit('lead', 4000, 6000), unit('a', 6000, 4000), unit('b', 6000, 4000)]);
  assert.equal(rows[0].lead, true);
  assert.deepEqual(rows[0].photos.map(p => p.id), ['lead']);
  assert.equal(rows[1].counterpoint, true);
  const mixed = composeSelection([unit('lead', 6000, 4000), unit('a', 4000, 6000), unit('b', 6000, 4000)]);
  assert.equal(mixed.length, 3);
  assert.equal(mixed[2].coda, true);
  assert.deepEqual(pickSelection([], [], seededRandom()), []);
  assert.equal(pickSelection([unit('only', 6000, 4000)], ['only'], seededRandom()).length, 1);
  const pair = { photos: [photo('a'), photo('b')] };
  assert.deepEqual(pickSelection([pair], [], seededRandom()), [pair]);
});

test('small-exhibition HTML loads no unselected photos and safely embeds its model', () => {
  const items = require('../source/_data/gallery.json').photos;
  const html = renderGallery(items, '/bluenote/', { mode: 'few' });
  const activeHTML = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  assert.doesNotMatch(activeHTML, /<img\b/);
  assert.match(activeHTML, /data-gallery-reshuffle hidden/);
  assert.match(activeHTML, /href="\/bluenote\/gallery\/" aria-current="page">A few/);
  assert.match(activeHTML, /href="\/bluenote\/gallery\/all\/">All photographs/);
  const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
  assert.equal((fallback.match(/class="gallery-bay/g) || []).length, 2);
  const model = JSON.parse(html.match(/data-gallery-model>([\s\S]*?)<\/script>/)[1]);
  assert.equal(model.rows.flatMap(row => row.photos).length, 50);
  const unsafe = photo();
  unsafe.caption = '</script><script>alert("bad")</script>&';
  const embedded = renderGallery([unsafe], '/', { mode: 'few' }).match(/data-gallery-model>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(embedded, /[<>&]/);
  assert.equal(JSON.parse(embedded).rows[0].photos[0].caption, unsafe.caption);
});

test('single portraits fill their centered row without a second flex shrink', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../source/css/gallery.css'), 'utf8');
  assert.match(css, /\.gallery-row > \.gallery-item:only-child\s*\{\s*flex: 1 1 0%;/);
});

test('every spread receives a full-height centered exhibition bay', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../source/css/gallery.css'), 'utf8');
  const bay = css.match(/\.gallery-bay\s*\{([^}]*)\}/)[1];
  assert.match(bay, /display: flex/);
  assert.match(bay, /align-items: center/);
  assert.match(bay, /min-height: 100vh/);
  assert.match(bay, /min-height: 100svh/);
  assert.match(css, /\.gallery-bay \+ \.gallery-bay\s*\{[^}]*margin-top:/);
});

test('loading feedback cannot paint a dark strip across a visible photograph', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../source/css/gallery.css'), 'utf8');
  const loading = css.match(/\.has-preview \.gallery-viewer-status\s*\{([^}]*)\}/)[1];
  const failure = css.match(/\.has-preview\.has-error \.gallery-viewer-status\s*\{([^}]*)\}/)[1];
  assert.match(loading, /width: max-content/);
  assert.match(loading, /background: transparent/);
  assert.doesNotMatch(loading, /inset:\s*auto 0 0/);
  assert.match(failure, /padding: 0\.45rem 0\.65rem/);
});

test('manifest rejects missing images, IDs, external paths, damaged ratios and false previews', () => {
  const check = (items) => validateGallery({ version: 1, photos: items });
  assert.throws(() => validateGallery({ photos: [] }), /version/);
  assert.throws(() => check([photo(), photo()]), /unique/);
  assert.throws(() => check([{ ...photo(), id: undefined }]), /unique/);
  assert.throws(() => check([{ ...photo(), alt: '' }]), /alt text/);
  assert.throws(() => check([{ ...photo(), previews: [] }]), /separate previews/);
  for (const src of ['https://example.com/photo.jpg', '/images/../secret.jpg', 'javascript:alert(1)']) {
    assert.throws(() => check([{ ...photo(), full: { ...photo().full, src } }]), /local/);
  }
  assert.throws(() => check([{ ...photo(), full: { ...photo().full, width: 0 } }]), /dimensions/);
  const wrong = photo();
  wrong.previews[0].height = 800;
  assert.throws(() => check([wrong]), /framing/);
  const originalPreview = photo();
  originalPreview.previews = [originalPreview.full];
  assert.throws(() => check([originalPreview]), /framing/);
  assert.throws(() => validateGallery({ version: 1, photos: [photo()] }, '/nonexistent'), /not found/);
});

test('real image dimensions are checked against the manifest without importing any photo', () => {
  const sourceRoot = require('node:path').join(__dirname, '..', 'source');
  const item = {
    id: 'dimension-check', alt: 'Test only',
    full: { src: '/images/galleries/2023/fall-new-york/DSC_0034.jpg', width: 5568, height: 3712 },
    previews: [{ src: '/images/galleries/2023/fall-new-york/DSC_0034-800.jpg', width: 800, height: 533 }]
  };
  assert.equal(validateGallery({ version: 1, photos: [item] }, sourceRoot).length, 1);
  item.full.width = 5567;
  assert.throws(() => validateGallery({ version: 1, photos: [item] }, sourceRoot), /actual image/);
});

// Minimal DOM fixture: exercises our state and handlers without a browser or network.
function fixture(count = 3) {
  const requests = [];
  const elements = [];
  let doc;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.dataset = {};
      this.children = [];
      this.map = {};
      this.events = {};
      this.attributes = {};
      this.hidden = false;
      this.disabled = false;
      this.clientWidth = 500;
      this.textContent = '';
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle: (name, value) => value ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name)
      };
      elements.push(this);
    }
    set src(value) { this._src = value; requests.push(value); }
    get src() { return this._src; }
    matches(selector) {
      if (selector.startsWith('.')) return (this.className || '').split(/\s+/).includes(selector.slice(1));
      const data = selector.match(/^\[data-([a-z-]+)\]$/);
      if (data) return data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) in this.dataset;
      return selector.toUpperCase() === this.tagName;
    }
    querySelector(selector) {
      return this.map[selector] || this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      if (this.map[selector]) return this.map[selector];
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    appendChild(element) { this.children.push(element); return element; }
    replaceChildren(...children) {
      this.children = children.flatMap((child) => child.tagName === 'FRAGMENT' ? child.children : [child]);
      this.map = {};
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, handler) { (this.events[type] ||= []).push(handler); }
    emit(type, values = {}) {
      const event = { button: 0, prevented: false, preventDefault() { this.prevented = true; }, ...values };
      (this.events[type] || []).forEach((handler) => handler(event));
      return event;
    }
    focus() { doc.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  const grid = new Element();
  grid.clientWidth = 1080;
  const figures = [];
  const links = [];
  for (let i = 0; i < count; i += 1) {
    const figure = new Element('figure');
    const link = new Element('a');
    const thumbnail = new Element('img');
    thumbnail.alt = 'Photo ' + i;
    link.href = '/full/' + i + '.jpg';
    link.dataset = { width: '6000', height: '4000' };
    link.map.img = thumbnail;
    figure.map['[data-gallery-open]'] = link;
    figures.push(figure);
    links.push(link);
  }
  grid.map['.gallery-item'] = figures;
  const viewer = new Element('dialog');
  for (const name of ['stage', 'zoom', 'count', 'prev', 'next', 'close', 'caption', 'status', 'message', 'original']) {
    viewer.map['[data-gallery-' + name + ']'] = new Element();
  }
  doc = {
    body: new Element('body'),
    documentElement: { clientWidth: 1280 },
    querySelector: (selector) => ({ '[data-gallery-grid]': grid, '[data-gallery-viewer]': viewer })[selector],
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment')
  };
  const win = {
    innerWidth: 1295, scrollY: 450,
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ paddingRight: '0px' }),
    addEventListener() {},
    scrollTo(x, y) { this.lastScroll = [x, y]; }
  };
  return {
    doc, win, grid, viewer, figures, links, requests,
    control: (name) => viewer.map['[data-gallery-' + name + ']'],
    image: () => viewer.map['[data-gallery-zoom]'].children.at(-1)
  };
}

function fewFixture() {
  const f = fixture(0);
  const nodes = {};
  for (const name of ['model', 'reshuffle', 'selection-status', 'fallback']) {
    nodes[name] = f.doc.createElement(name === 'reshuffle' ? 'button' : 'div');
  }
  nodes.model.textContent = JSON.stringify({ root: '/bluenote/', rows: curatedRows(require('../source/_data/gallery.json').photos) });
  nodes.reshuffle.hidden = true;
  const originalQuery = f.doc.querySelector;
  f.doc.querySelector = selector => {
    const name = selector.match(/^\[data-gallery-(.*)\]$/)?.[1];
    return nodes[name] || originalQuery(selector);
  };
  const random = seededRandom();
  f.win.BlueNoteSelection = { composeSelection, pickSelection: (units, previous) => pickSelection(units, previous, random) };
  f.nodes = nodes;
  f.currentLinks = () => f.grid.querySelectorAll('[data-gallery-open]');
  return f;
}

test('small exhibition requests only its previews; reshuffle rebinds scoped navigation and preserves focus', () => {
  const f = fewFixture();
  mountGallery(f.doc, f.win);
  const initial = f.currentLinks();
  assert.ok(initial.length >= 3 && initial.length <= 5);
  assert.ok(f.grid.children.every(bay => bay.className === 'gallery-bay'));
  assert.ok(f.grid.children.every(bay => bay.children.length === 1 && /gallery-row/.test(bay.children[0].className)));
  assert.equal(f.requests.length, initial.length);
  assert.ok(f.requests.every(src => /-800\.jpg$/.test(src)));
  assert.equal(f.nodes.reshuffle.hidden, false);
  assert.equal(f.nodes.fallback.hidden, true);
  initial[0].emit('click');
  assert.equal(f.viewer.open, true);
  assert.equal(f.control('count').textContent, '1 / ' + initial.length);
  assert.equal(f.requests.at(-1), initial[0].href);
  f.nodes.reshuffle.emit('click');
  assert.deepEqual(f.currentLinks(), initial, 'do not redraw beneath an open viewer');
  f.control('close').emit('click');
  f.nodes.reshuffle.focus();
  f.nodes.reshuffle.emit('click');
  const fresh = f.currentLinks();
  assert.ok(fresh.length >= 3 && fresh.length <= 5);
  assert.ok(fresh.every(link => !initial.some(old => old.dataset.galleryOpen === link.dataset.galleryOpen)));
  assert.equal(f.doc.activeElement, f.nodes.reshuffle);
  assert.match(f.nodes['selection-status'].textContent, /^[3-5] photographs/);
  fresh[0].emit('click');
  for (let i = 0; i < fresh.length; i++) {
    assert.equal(f.control('count').textContent, (i + 1) + ' / ' + fresh.length);
    assert.equal(f.control('zoom').children.at(-1).src, fresh[i].href);
    assert.equal(fresh[i].events.click.length, 1);
    if (i < fresh.length - 1) f.control('next').emit('click');
  }
  assert.equal(f.control('next').disabled, true);
  f.control('close').emit('click');
  assert.equal(f.doc.activeElement, fresh[0]);
});

test('reshuffle remains useful without native dialogs and failures keep the previous set', () => {
  const f = fewFixture();
  f.viewer.showModal = undefined;
  mountGallery(f.doc, f.win);
  assert.equal(f.currentLinks()[0].emit('click').prevented, false);
  const initial = f.currentLinks();
  f.nodes.reshuffle.emit('click');
  assert.notDeepEqual(f.currentLinks(), initial);
  const fresh = f.currentLinks();
  f.win.BlueNoteSelection.composeSelection = () => [{ photos: [photo('valid'), {}] }];
  f.nodes.reshuffle.emit('click');
  assert.deepEqual(f.currentLinks(), fresh);
  assert.match(f.nodes['selection-status'].textContent, /Unable to reshuffle/);
  assert.throws(() => drawSelection(f.doc, f.grid, { root: '/' }, [{ photos: [{}] }]));
  assert.deepEqual(f.currentLinks(), fresh);
  const broken = fewFixture();
  broken.nodes.model.textContent = '{broken';
  mountGallery(broken.doc, broken.win);
  assert.equal(broken.nodes.fallback.hidden, false);
  assert.equal(broken.nodes.reshuffle.hidden, true);
  assert.equal(broken.requests.length, 0);
});

test('opening is on-demand; switching ignores stale load events; errors offer the original', () => {
  const f = fixture();
  mountGallery(f.doc, f.win);
  assert.equal(f.requests.length, 0);
  assert.equal(f.links[0].emit('click', { metaKey: true }).prevented, false);
  assert.equal(f.requests.length, 0);
  assert.equal(f.links[0].emit('click').prevented, true);
  assert.equal(f.viewer.open, true);
  assert.deepEqual(f.requests, ['/full/0.jpg']);
  assert.equal(f.control('zoom').hidden, true);
  const stale = f.image();
  f.control('next').emit('click');
  assert.equal(f.control('count').textContent, '2 / 3');
  stale.emit('load');
  assert.equal(f.control('zoom').hidden, true);
  f.image().emit('error');
  assert.equal(f.control('message').textContent, '原图加载失败。');
  assert.equal(f.control('original').href, '/full/1.jpg');
  assert.equal(f.control('original').hidden, false);
  f.control('next').emit('click');
  assert.equal(f.control('next').disabled, true);
  f.image().emit('load');
  assert.equal(f.control('zoom').hidden, false);
  assert.equal(f.control('status').hidden, true);
});

test('zoom, keys, edge buttons and close preserve full dimensions, focus and scroll', () => {
  const f = fixture();
  mountGallery(f.doc, f.win);
  f.links[0].emit('click');
  assert.equal(f.control('prev').disabled, true);
  f.image().emit('load');
  f.control('zoom').emit('click');
  assert.equal(f.control('zoom').attributes['aria-pressed'], 'true');
  assert.equal(f.control('zoom').style['--original-width'], '6000px');
  assert.equal(f.control('zoom').style['--original-height'], '4000px');
  f.viewer.emit('keydown', { key: 'ArrowRight' });
  assert.equal(f.requests.length, 1);
  f.control('zoom').emit('click');
  f.viewer.emit('keydown', { key: 'ArrowRight' });
  assert.equal(f.requests.length, 2);
  f.viewer.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(f.control('count').textContent, '1 / 3');
  const pending = f.image();
  f.control('close').emit('click');
  assert.equal(f.viewer.open, false);
  assert.deepEqual(f.win.lastScroll, [0, 450]);
  assert.equal(f.doc.activeElement, f.links[0]);
  assert.equal(f.doc.body.style.position, undefined);
  assert.equal(f.control('zoom').children.length, 0);
  pending.emit('load');
  assert.equal(f.control('zoom').children.length, 0);
});

test('horizontal swipes change photo while vertical movement leaves it unchanged', () => {
  const f = fixture();
  mountGallery(f.doc, f.win);
  f.links[0].emit('click');
  f.control('stage').emit('touchstart', { touches: [{ clientX: 300, clientY: 50 }] });
  f.control('stage').emit('touchend', { changedTouches: [{ clientX: 100, clientY: 60 }] });
  assert.equal(f.control('count').textContent, '2 / 3');
  f.control('stage').emit('touchstart', { touches: [{ clientX: 300, clientY: 50 }] });
  f.control('stage').emit('touchend', { changedTouches: [{ clientX: 290, clientY: 200 }] });
  assert.equal(f.control('count').textContent, '2 / 3');
});

test('single-image collections and unsupported dialogs retain useful navigation', () => {
  const f = fixture(1);
  mountGallery(f.doc, f.win);
  f.links[0].emit('click');
  assert.equal(f.control('prev').disabled, true);
  assert.equal(f.control('next').disabled, true);
  const fallback = fixture();
  fallback.viewer.showModal = undefined;
  mountGallery(fallback.doc, fallback.win);
  assert.equal(fallback.links[0].emit('click').prevented, false);
  assert.equal(fallback.requests.length, 0);
});

test('a cached full-frame preview stays visible during loading and on full-image failure', () => {
  const f = fixture();
  f.links[0].map.img.currentSrc = '/preview/0-1600.jpg';
  mountGallery(f.doc, f.win);
  f.links[0].emit('click');
  assert.deepEqual(f.requests, ['/preview/0-1600.jpg', '/full/0.jpg']);
  assert.equal(f.control('zoom').hidden, true);
  f.control('zoom').children[0].emit('load');
  assert.equal(f.control('zoom').hidden, false);
  assert.equal(f.control('status').hidden, true);
  assert.equal(f.control('zoom').attributes['aria-busy'], 'true');
  f.control('zoom').emit('click');
  assert.equal(f.control('zoom').attributes['aria-pressed'], 'false');
  f.control('zoom').children.at(-1).emit('error');
  assert.equal(f.control('zoom').hidden, false);
  assert.equal(f.control('original').hidden, false);
  assert.equal(f.control('status').hidden, false);
  f.control('close').emit('click');
  f.links[0].emit('click');
  const full = f.control('zoom').children.at(-1);
  full.emit('load');
  assert.deepEqual(f.control('zoom').children, [full]);
  assert.equal(full.hidden, false);
  assert.equal(f.control('status').hidden, true);
});

test('photo changes retain the last frame and wait for decode before an atomic replacement', async () => {
  const f = fixture();
  for (const link of f.links) link.map.img.currentSrc = '/preview/' + link.href.match(/(\d+)\.jpg$/)[1] + '-1600.jpg';
  mountGallery(f.doc, f.win);
  f.links[0].emit('click');
  assert.deepEqual(f.requests.filter(src => src.startsWith('/full/')), ['/full/0.jpg']);
  const firstPreview = f.control('zoom').children[0];
  firstPreview.emit('load');
  const firstFull = f.image();
  firstFull.emit('load');
  assert.deepEqual(f.control('zoom').children, [firstFull]);

  f.control('next').emit('click');
  assert.deepEqual(f.requests.filter(src => src.startsWith('/full/')), ['/full/0.jpg', '/full/1.jpg']);
  const nextPreview = f.control('zoom').children.at(-2);
  const nextFull = f.control('zoom').children.at(-1);
  assert.equal(f.control('zoom').children[0], firstFull);
  assert.equal(f.control('zoom').hidden, false);
  assert.equal(f.control('count').textContent, '2 / 3');
  assert.equal(f.control('status').hidden, true);
  nextPreview.emit('load');
  assert.deepEqual(f.control('zoom').children, [nextPreview, nextFull]);
  assert.equal(nextPreview.hidden, false);

  let finishDecode;
  nextFull.decode = () => new Promise(resolve => { finishDecode = resolve; });
  nextFull.emit('load');
  assert.deepEqual(f.control('zoom').children, [nextPreview, nextFull]);
  assert.equal(f.control('status').hidden, true);
  finishDecode();
  await Promise.resolve();
  assert.deepEqual(f.control('zoom').children, [nextFull]);
  assert.equal(nextFull.hidden, false);
  assert.equal(f.control('status').hidden, true);

  f.control('prev').emit('click');
  const staleFull = f.control('zoom').children.at(-1);
  let finishStaleDecode;
  staleFull.decode = () => new Promise(resolve => { finishStaleDecode = resolve; });
  staleFull.emit('load');
  f.control('next').emit('click');
  const retained = f.control('zoom').children[0];
  finishStaleDecode();
  await Promise.resolve();
  assert.equal(f.control('zoom').children[0], retained, 'a stale decode cannot reinsert an earlier photo');
});

test('resize never reparents curated photos and the viewer visits all fifty in order', () => {
  const f = fixture(50), events = {};
  f.win.addEventListener = (name, handler) => { events[name] = handler; };
  const authoredRow = { id: 'keep-this-row' };
  f.grid.children = [authoredRow];
  mountGallery(f.doc, f.win);
  f.links[0].clientWidth = 342;
  events.resize();
  assert.deepEqual(f.grid.children, [authoredRow]);
  assert.equal(f.links[0].map.img.sizes, '342px');
  f.links[0].emit('click');
  for (let i = 0; i < 50; i++) {
    assert.equal(f.control('count').textContent, (i + 1) + ' / 50');
    assert.equal(f.image().src, '/full/' + i + '.jpg');
    f.image().emit('load');
    if (i < 49) f.control('next').emit('click');
  }
  assert.equal(f.control('next').disabled, true);
  assert.equal(f.requests.length, 50);
});

test('all 200 publication JPEGs retain ICC and contain no EXIF, IPTC or comment metadata', () => {
  const fs = require('node:fs'), path = require('node:path');
  const { hasPrivateMetadata, withICC } = require('./import-selected-gallery.cjs');
  const photos = require('../source/_data/gallery.json').photos;
  for (const photo of photos) for (const image of [photo.full, ...photo.previews]) {
    const data = fs.readFileSync(path.join(__dirname, '..', 'source', image.src));
    assert.equal(hasPrivateMetadata(data), false, image.src);
    assert.ok(data.includes(Buffer.from('ICC_PROFILE\0')), image.src);
  }
  // Large ICC profiles must be split without losing any bytes.
  const profile = Buffer.alloc(70000, 123);
  const jpeg = withICC(Buffer.from([255, 216, 255, 217]), profile);
  assert.equal(jpeg[19], 2);
  assert.equal(jpeg[2 + 18 + 65519 + 16], 2);
  assert.equal(hasPrivateMetadata(jpeg), false);
});
