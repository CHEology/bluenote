/* Lightbox for article images: opens the largest available source in a native dialog. */
(function() {
  'use strict';
  var body = document.body;
  if (!body.classList.contains('post-page') || !('HTMLDialogElement' in window)) return;
  var images = Array.prototype.slice.call(document.querySelectorAll('.post-content .markdown-body img')).filter(function(image) {
    return !image.closest('a') && !image.hasAttribute('data-gallery-thumbnail') && !image.closest('.no-lightbox');
  });
  if (!images.length) return;

  var dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.innerHTML = [
    '<div class="lightbox__toolbar">',
    '  <p class="lightbox__count" aria-live="polite" aria-atomic="true"></p>',
    '  <div class="lightbox__controls">',
    '    <button type="button" data-lightbox-prev aria-label="Previous image"><span aria-hidden="true">←</span></button>',
    '    <button type="button" data-lightbox-next aria-label="Next image"><span aria-hidden="true">→</span></button>',
    '    <button type="button" data-lightbox-close aria-label="Close"><span aria-hidden="true">×</span></button>',
    '  </div>',
    '</div>',
    '<div class="lightbox__stage"><img alt=""></div>',
    '<p class="lightbox__caption" hidden></p>'
  ].join('\n');
  body.appendChild(dialog);

  var stageImage = dialog.querySelector('.lightbox__stage img');
  var count = dialog.querySelector('.lightbox__count');
  var caption = dialog.querySelector('.lightbox__caption');
  var previous = dialog.querySelector('[data-lightbox-prev]');
  var next = dialog.querySelector('[data-lightbox-next]');
  var close = dialog.querySelector('[data-lightbox-close]');
  var index = 0;
  var opener = null;

  function largestSource(image) {
    var srcset = image.getAttribute('srcset');
    if (srcset) {
      var best = srcset.split(',').map(function(candidate) {
        var parts = candidate.trim().split(/\s+/);
        return { url: parts[0], width: parseInt(parts[1], 10) || 0 };
      }).sort(function(a, b) { return b.width - a.width; })[0];
      if (best && best.url) return best.url;
    }
    return image.currentSrc || image.src;
  }

  function show(position) {
    if (position < 0 || position >= images.length) return;
    index = position;
    var image = images[index];
    stageImage.src = largestSource(image);
    stageImage.alt = image.alt || '';
    count.textContent = (index + 1) + ' / ' + images.length;
    previous.disabled = index === 0;
    next.disabled = index === images.length - 1;
    var figcaption = image.closest('figure') ? image.closest('figure').querySelector('figcaption') : null;
    var text = figcaption ? figcaption.textContent.trim() : (image.getAttribute('title') || '');
    caption.textContent = text;
    caption.hidden = !text;
  }

  function open(position, source) {
    opener = source;
    body.classList.add('lightbox-open');
    dialog.showModal();
    close.focus();
    show(position);
  }

  images.forEach(function(image, position) {
    image.style.cursor = 'zoom-in';
    image.addEventListener('click', function(event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(position, image);
    });
  });

  close.addEventListener('click', function() { dialog.close(); });
  previous.addEventListener('click', function() { show(index - 1); });
  next.addEventListener('click', function() { show(index + 1); });
  dialog.addEventListener('close', function() {
    body.classList.remove('lightbox-open');
    stageImage.removeAttribute('src');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', function(event) {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
})();
