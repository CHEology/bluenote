(function() {
  'use strict';

  // Ordered rows; only row membership changes, never the photograph's framing.
  function groupRows(ratios, width, singleColumn) {
    if (singleColumn) return ratios.map(function() { return 1; });
    var gap = width < 900 ? 24 : 32;
    var target = Math.min(340, width / 2.8);
    var rows = [];
    var offset = 0;
    while (offset < ratios.length) {
      if (ratios[offset] >= 2.7) {
        rows.push(1);
        offset += 1;
        continue;
      }
      var sum = 0;
      var bestCount = 1;
      var bestScore = Infinity;
      for (var count = 1; count <= 3 && offset + count <= ratios.length; count += 1) {
        if (count > 1 && ratios[offset + count - 1] >= 2.7) break;
        sum += ratios[offset + count - 1];
        var height = (width - gap * (count - 1)) / sum;
        var score = Math.abs(Math.log(height / target)) + (count === 1 ? 0.28 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestCount = count;
        }
      }
      rows.push(bestCount);
      offset += bestCount;
    }
    return rows;
  }

  function mountGallery(doc, win) {
    var grid = doc.querySelector('[data-gallery-grid]');
    if (!grid) return;
    var figures = Array.from(grid.querySelectorAll('.gallery-item'));
    var links = figures.map(function(figure) { return figure.querySelector('[data-gallery-open]'); });
    var ratios = links.map(function(link) { return Number(link.dataset.width) / Number(link.dataset.height); });
    var rowSignature = '';

    function arrange() {
      var width = grid.clientWidth;
      if (!width) return;
      var mobile = win.matchMedia('(max-width: 767px)').matches;
      var rows = groupRows(ratios, width, mobile);
      var signature = String(mobile) + ':' + rows.join(',');
      if (signature !== rowSignature) {
        var fragment = doc.createDocumentFragment();
        var offset = 0;
        rows.forEach(function(count) {
          var row = doc.createElement('div');
          row.className = 'gallery-row';
          if (count === 1 && ratios[offset] < 2.7 && !mobile) row.classList.add('gallery-row--partial');
          figures.slice(offset, offset + count).forEach(function(figure) { row.appendChild(figure); });
          offset += count;
          fragment.appendChild(row);
        });
        grid.replaceChildren(fragment);
        rowSignature = signature;
      }
      // The browser selects a preview for the real rendered width, not a guess.
      links.forEach(function(link) {
        var image = link.querySelector('img');
        image.sizes = Math.ceil(link.clientWidth) + 'px';
      });
    }
    arrange();
    if (win.ResizeObserver) {
      new win.ResizeObserver(arrange).observe(grid);
    } else {
      win.addEventListener('resize', arrange);
    }

    var viewer = doc.querySelector('[data-gallery-viewer]');
    if (!viewer || typeof viewer.showModal !== 'function') return;
    doc.body.appendChild(viewer);
    var stage = viewer.querySelector('[data-gallery-stage]');
    var zoom = viewer.querySelector('[data-gallery-zoom]');
    var countLabel = viewer.querySelector('[data-gallery-count]');
    var previous = viewer.querySelector('[data-gallery-prev]');
    var next = viewer.querySelector('[data-gallery-next]');
    var close = viewer.querySelector('[data-gallery-close]');
    var caption = viewer.querySelector('[data-gallery-caption]');
    var status = viewer.querySelector('[data-gallery-status]');
    var message = viewer.querySelector('[data-gallery-message]');
    var original = viewer.querySelector('[data-gallery-original]');
    var index = 0;
    var opener = null;
    var serial = 0;
    var zoomed = false;
    var loaded = false;
    var currentAlt = '';
    var restoreBody = null;
    var touch = null;
    var suppressClickUntil = 0;

    function setZoom(value) {
      zoomed = value;
      stage.classList.toggle('is-zoomed', value);
      zoom.setAttribute('aria-pressed', String(value));
      zoom.setAttribute('aria-label', currentAlt + '。' + (value ? '还原完整画面' : '放大到原始尺寸'));
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }

    function showPhoto(position) {
      if (position < 0 || position >= links.length) return;
      index = position;
      var link = links[index];
      var token = ++serial;
      currentAlt = link.querySelector('img').alt;
      loaded = false;
      setZoom(false);
      zoom.hidden = true;
      zoom.replaceChildren();
      zoom.style.setProperty('--original-width', link.dataset.width + 'px');
      zoom.style.setProperty('--original-height', link.dataset.height + 'px');
      countLabel.textContent = (index + 1) + ' / ' + links.length;
      previous.disabled = index === 0;
      next.disabled = index === links.length - 1;
      var text = figures[index].querySelector('figcaption');
      caption.textContent = text ? text.textContent : '';
      caption.hidden = !caption.textContent;
      original.href = link.href;
      original.hidden = true;
      status.hidden = false;
      message.textContent = '正在加载原图…';

      var image = doc.createElement('img');
      image.alt = link.querySelector('img').alt;
      image.width = Number(link.dataset.width);
      image.height = Number(link.dataset.height);
      image.decoding = 'async';
      image.addEventListener('load', function() {
        if (token !== serial || !viewer.open) return;
        loaded = true;
        status.hidden = true;
        zoom.hidden = false;
      });
      image.addEventListener('error', function() {
        if (token !== serial || !viewer.open) return;
        message.textContent = '原图加载失败。';
        original.hidden = false;
        zoom.hidden = true;
      });
      zoom.appendChild(image);
      // No original requests are made until the reader opens or changes a photo.
      image.src = link.href;
    }

    function openPhoto(position, link) {
      var scrollY = win.scrollY;
      var body = doc.body;
      var properties = ['position', 'top', 'width', 'overflow', 'paddingRight'];
      var styles = {};
      properties.forEach(function(property) { styles[property] = body.style[property]; });
      var scrollbar = win.innerWidth - doc.documentElement.clientWidth;
      var padding = parseFloat(win.getComputedStyle(body).paddingRight) || 0;
      body.style.position = 'fixed';
      body.style.top = -scrollY + 'px';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.paddingRight = padding + Math.max(0, scrollbar) + 'px';
      restoreBody = function() {
        properties.forEach(function(property) { body.style[property] = styles[property]; });
        win.scrollTo(0, scrollY);
      };
      opener = link;
      viewer.showModal();
      close.focus();
      showPhoto(position);
    }

    links.forEach(function(link, position) {
      link.addEventListener('click', function(event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openPhoto(position, link);
      });
    });
    close.addEventListener('click', function() { viewer.close(); });
    previous.addEventListener('click', function() { showPhoto(index - 1); });
    next.addEventListener('click', function() { showPhoto(index + 1); });
    viewer.addEventListener('close', function() {
      serial += 1;
      zoom.replaceChildren();
      if (restoreBody) restoreBody();
      restoreBody = null;
      if (opener) opener.focus({ preventScroll: true });
    });
    viewer.addEventListener('keydown', function(event) {
      if (zoomed || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    zoom.addEventListener('click', function() {
      if (loaded && Date.now() > suppressClickUntil) setZoom(!zoomed);
    });
    stage.addEventListener('touchstart', function(event) {
      touch = !zoomed && event.touches.length === 1 ? {
        x: event.touches[0].clientX, y: event.touches[0].clientY
      } : null;
    }, { passive: true });
    stage.addEventListener('touchcancel', function() { touch = null; }, { passive: true });
    stage.addEventListener('touchend', function(event) {
      if (!touch || zoomed || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touch.x;
      var dy = event.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressClickUntil = Date.now() + 400;
        showPhoto(index + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { groupRows: groupRows, mountGallery: mountGallery };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { mountGallery(document, window); });
    } else {
      mountGallery(document, window);
    }
  }
})();
