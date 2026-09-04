(function() {
  'use strict';

  function drawSelection(doc, grid, model, rows) {
    var fragment = doc.createDocumentFragment();
    var position = 0;
    function url(src) { return model.root + src.replace(/^\//, ''); }
    rows.forEach(function(arrangement) {
      var row = doc.createElement('div');
      row.className = 'gallery-row' + (arrangement.photos.length === 2 ? ' gallery-row--paired' : '') +
        (arrangement.lead ? ' gallery-row--lead' : '') +
        (arrangement.counterpoint ? ' gallery-row--counterpoint' : '') +
        (arrangement.coda ? ' gallery-row--coda' : '');
      var ratio = arrangement.photos.reduce(function(sum, photo) { return sum + photo.full.width / photo.full.height; }, 0);
      row.style.setProperty('--gallery-row-ratio', ratio);
      row.style.setProperty('--gallery-row-gutter', arrangement.photos.length === 2 ? '32px' : '0px');
      arrangement.photos.forEach(function(photo) {
        var figure = doc.createElement('figure');
        figure.className = 'gallery-item';
        figure.style.setProperty('--gallery-ratio', photo.full.width / photo.full.height);
        var link = doc.createElement('a');
        link.className = 'gallery-photo';
        link.href = url(photo.full.src);
        link.dataset.galleryOpen = photo.id;
        link.dataset.width = String(photo.full.width);
        link.dataset.height = String(photo.full.height);
        link.setAttribute('aria-label', photo.alt);
        var image = doc.createElement('img');
        image.dataset.galleryThumbnail = '';
        image.alt = photo.alt;
        image.width = photo.full.width;
        image.height = photo.full.height;
        image.loading = position++ < 2 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.sizes = Math.ceil((grid.clientWidth || 1160) * (photo.full.width / photo.full.height) / ratio) + 'px';
        image.srcset = photo.previews.map(function(preview) { return url(preview.src) + ' ' + preview.width + 'w'; }).join(', ');
        image.src = url(photo.previews[0].src);
        link.appendChild(image);
        figure.appendChild(link);
        if (photo.caption) {
          var caption = doc.createElement('figcaption');
          caption.textContent = photo.caption;
          figure.appendChild(caption);
        }
        row.appendChild(figure);
      });
      fragment.appendChild(row);
    });
    // Construct everything first: a failed redraw never discards the previous set.
    grid.replaceChildren(fragment);
  }

  function mountGallery(doc, win) {
    var grid = doc.querySelector('[data-gallery-grid]');
    if (!grid) return;
    var modelElement = doc.querySelector('[data-gallery-model]');
    var reshuffle = doc.querySelector('[data-gallery-reshuffle]');
    var announcement = doc.querySelector('[data-gallery-selection-status]');
    var selection = win.BlueNoteSelection;
    var model = null;
    var selectedIds = [];
    function selectAgain() {
      var units = selection.pickSelection(model.rows, selectedIds);
      var rows = selection.composeSelection(units);
      drawSelection(doc, grid, model, rows);
      selectedIds = units.flatMap(function(unit) { return unit.photos.map(function(photo) { return photo.id; }); });
      if (announcement) announcement.textContent = selectedIds.length + ' photographs. New selection.';
    }
    if (modelElement && selection) {
      try {
        model = JSON.parse(modelElement.textContent);
        selectAgain();
        var fallback = doc.querySelector('[data-gallery-fallback]');
        if (fallback) fallback.hidden = true;
        if (reshuffle) reshuffle.hidden = false;
      } catch (error) { model = null; }
    }
    var figures = Array.from(grid.querySelectorAll('.gallery-item'));
    var links = figures.map(function(figure) { return figure.querySelector('[data-gallery-open]'); });

    // CSS adapts the authored spreads; resize must never move photographs or focus.
    function sizePreviews() {
      links.forEach(function(link) {
        if (link.clientWidth) link.querySelector('img').sizes = Math.ceil(link.clientWidth) + 'px';
      });
    }
    sizePreviews();
    if (win.ResizeObserver) new win.ResizeObserver(sizePreviews).observe(grid);
    win.addEventListener('resize', sizePreviews);

    if (reshuffle && model) reshuffle.addEventListener('click', function() {
      if (viewer && viewer.open) return;
      try {
        selectAgain();
        bindPhotos();
        sizePreviews();
      } catch (error) {
        if (announcement) announcement.textContent = 'Unable to reshuffle. Please try again.';
      }
    });

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
    var warmingPreviews = new Map();

    function setZoom(value) {
      zoomed = value;
      stage.classList.toggle('is-zoomed', value);
      zoom.setAttribute('aria-pressed', String(value));
      zoom.setAttribute('aria-label', currentAlt + '。' + (value ? '还原完整画面' : '放大到原始尺寸'));
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }

    function afterDecode(image, callback) {
      var decoding = null;
      try {
        if (typeof image.decode === 'function') decoding = image.decode();
      } catch (error) { decoding = null; }
      if (decoding && typeof decoding.then === 'function') {
        decoding.then(callback, callback);
      } else {
        callback();
      }
    }

    function warmPreview(position) {
      if (position < 0 || position >= links.length) return;
      var thumbnail = links[position].querySelector('img');
      var source = thumbnail.currentSrc || thumbnail.src;
      if (!source || warmingPreviews.has(source)) return;
      var preload = doc.createElement('img');
      preload.decoding = 'async';
      preload.fetchPriority = 'low';
      warmingPreviews.set(source, preload);
      function release() { warmingPreviews.delete(source); }
      preload.addEventListener('load', release);
      preload.addEventListener('error', release);
      preload.src = source;
    }

    function showPhoto(position) {
      if (position < 0 || position >= links.length) return;
      index = position;
      var link = links[index];
      var token = ++serial;
      currentAlt = link.querySelector('img').alt;
      loaded = false;
      setZoom(false);
      // Preserve the last complete frame while the next one loads. Removing it
      // first creates a visible blank/preview/full jump on slower connections.
      var heldImage = Array.from(zoom.querySelectorAll('img')).find(function(candidate) {
        return !candidate.hidden;
      });
      zoom.replaceChildren.apply(zoom, heldImage ? [heldImage] : []);
      zoom.hidden = !heldImage;
      stage.classList.remove('has-error');
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
      status.hidden = !!heldImage;
      message.textContent = '正在加载照片…';

      // Decode each candidate before it replaces the held frame. Both preview
      // and original receive the original dimensions for stable provisional geometry.
      var thumbnail = link.querySelector('img');
      var previewSource = thumbnail.currentSrc || thumbnail.src;
      var previewReady = false;
      var previewFailed = !previewSource;
      var fullReady = false;
      var fullFailed = false;
      stage.classList.toggle('has-preview', !!heldImage);
      zoom.setAttribute('aria-busy', 'true');
      function clearIfUnavailable() {
        if (token !== serial || !viewer.open || !previewFailed || !fullFailed) return;
        zoom.replaceChildren();
        zoom.hidden = true;
        stage.classList.remove('has-preview');
      }
      var preview = null;
      if (previewSource) {
        preview = doc.createElement('img');
        preview.alt = currentAlt;
        preview.width = Number(link.dataset.width);
        preview.height = Number(link.dataset.height);
        preview.decoding = 'async';
        preview.hidden = true;
        preview.addEventListener('load', function() {
          afterDecode(preview, function() {
            if (token !== serial || !viewer.open || fullReady) return;
            previewReady = true;
            preview.hidden = false;
            zoom.replaceChildren.apply(zoom, fullFailed ? [preview] : [preview, image]);
            zoom.hidden = false;
            stage.classList.add('has-preview');
            status.hidden = !fullFailed;
          });
        });
        preview.addEventListener('error', function() {
          if (token !== serial || !viewer.open) return;
          previewFailed = true;
          clearIfUnavailable();
        });
        preview.src = previewSource;
        zoom.appendChild(preview);
      }

      var image = doc.createElement('img');
      image.alt = link.querySelector('img').alt;
      image.width = Number(link.dataset.width);
      image.height = Number(link.dataset.height);
      image.decoding = 'async';
      image.hidden = true;
      image.addEventListener('load', function() {
        afterDecode(image, function() {
          if (token !== serial || !viewer.open) return;
          loaded = true;
          fullReady = true;
          image.hidden = false;
          zoom.replaceChildren(image);
          zoom.setAttribute('aria-busy', 'false');
          status.hidden = true;
          zoom.hidden = false;
          stage.classList.add('has-preview');
          stage.classList.remove('has-error');
        });
      });
      image.addEventListener('error', function() {
        if (token !== serial || !viewer.open) return;
        fullFailed = true;
        message.textContent = '原图加载失败。';
        original.hidden = false;
        status.hidden = false;
        stage.classList.add('has-error');
        if (previewReady) zoom.replaceChildren(preview);
        zoom.setAttribute('aria-busy', 'false');
        clearIfUnavailable();
      });
      // Only warm the two neighboring previews, never their full originals.
      warmPreview(index - 1);
      warmPreview(index + 1);
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

    function bindPhotos() {
      figures = Array.from(grid.querySelectorAll('.gallery-item'));
      links = figures.map(function(figure) { return figure.querySelector('[data-gallery-open]'); });
      if (!viewer || typeof viewer.showModal !== 'function') return;
      links.forEach(function(link, position) {
        link.addEventListener('click', function(event) {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          openPhoto(position, link);
        });
      });
    }
    bindPhotos();
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
    module.exports = { mountGallery: mountGallery, drawSelection: drawSelection };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { mountGallery(document, window); });
    } else {
      mountGallery(document, window);
    }
  }
})();
