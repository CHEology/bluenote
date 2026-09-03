const test = require('node:test');
const assert = require('node:assert/strict');
const { groupRows, mountGallery } = require('../source/js/gallery.js');
const { validateGallery, renderGallery } = require('./lib/gallery.cjs');

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

test('ordered rows support fifty landscape, portrait, square and panoramic photographs', () => {
  const ratios = Array.from({ length: 50 }, (_, index) => [1.5, 2 / 3, 1, 3.2][index % 4]);
  for (const width of [720, 900, 1080, 1400]) {
    const rows = groupRows(ratios, width, false);
    assert.equal(rows.reduce((sum, count) => sum + count, 0), 50);
    let offset = 0;
    for (const count of rows) {
      assert.ok(count >= 1 && count <= 3);
      if (ratios.slice(offset, offset + count).some((ratio) => ratio >= 2.7)) assert.equal(count, 1);
      offset += count;
    }
  }
  assert.deepEqual(groupRows(ratios, 342, true), Array(50).fill(1));
  assert.deepEqual(groupRows([1.5, 1.5, 1.5, 1.5], 1080, false), [2, 2]);
  assert.deepEqual(groupRows([], 1080, false), []);
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
        toggle: (name, value) => value ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name)
      };
      elements.push(this);
    }
    set src(value) { this._src = value; requests.push(value); }
    get src() { return this._src; }
    querySelector(selector) {
      if (selector === 'img' && !this.map[selector]) return this.children.find((child) => child.tagName === 'IMG') || null;
      return this.map[selector] || null;
    }
    querySelectorAll(selector) { return this.map[selector] || []; }
    appendChild(element) { this.children.push(element); return element; }
    replaceChildren(...children) { this.children = children.flatMap((child) => child.tagName === 'FRAGMENT' ? child.children : [child]); }
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
    image: () => viewer.map['[data-gallery-zoom]'].children[0]
  };
}

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
