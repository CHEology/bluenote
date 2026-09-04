/* Colour scheme: follows the system by default, remembers a manual choice, and
   returns to automatic when the choice matches the system again. */
(function() {
  'use strict';
  var root = document.documentElement;
  var storageKey = root.getAttribute('data-scheme-storage') || 'bluenote.color-scheme';
  var preset = root.getAttribute('data-scheme-default') || 'auto';
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var meta = document.querySelector('meta[name="theme-color"]');

  function read() {
    try { return window.localStorage.getItem(storageKey); } catch (error) { return null; }
  }
  function write(value) {
    try {
      if (value) window.localStorage.setItem(storageKey, value);
      else window.localStorage.removeItem(storageKey);
    } catch (error) { /* storage unavailable */ }
  }
  function systemScheme() {
    if (preset === 'dark' || preset === 'light') return preset;
    return media && media.matches ? 'dark' : 'light';
  }
  function current() {
    return root.getAttribute('data-scheme') || systemScheme();
  }
  function apply(scheme, persist) {
    if (scheme === systemScheme()) {
      root.removeAttribute('data-scheme');
      if (persist) write(null);
    } else {
      root.setAttribute('data-scheme', scheme);
      if (persist) write(scheme);
    }
    render();
  }
  function iconFor(scheme) {
    return scheme === 'dark' ? '#icon-moon' : '#icon-sun';
  }
  function render() {
    var scheme = current();
    var toggles = document.querySelectorAll('.scheme-toggle');
    Array.prototype.forEach.call(toggles, function(toggle) {
      var use = toggle.querySelector('use');
      if (use && !toggle.classList.contains('is-hovered')) use.setAttribute('href', iconFor(scheme));
      var label = toggle.querySelector('.scheme-toggle__label');
      var target = scheme === 'dark' ? 'light' : 'dark';
      if (label) label.textContent = toggle.getAttribute('data-label-' + target) || target;
      toggle.setAttribute('aria-pressed', scheme === 'dark' ? 'true' : 'false');
    });
    if (meta) {
      var color = getComputedStyle(root).getPropertyValue('--theme-color').trim();
      if (color) meta.setAttribute('content', color);
    }
    document.dispatchEvent(new CustomEvent('bluenote:scheme', { detail: { scheme: scheme } }));
  }

  window.BlueNote = window.BlueNote || {};
  window.BlueNote.scheme = { current: current, apply: apply, system: systemScheme };

  document.addEventListener('click', function(event) {
    var toggle = event.target.closest('.scheme-toggle');
    if (!toggle) return;
    event.preventDefault();
    apply(current() === 'dark' ? 'light' : 'dark', true);
  });

  /* Hovering the desktop toggle previews the icon of the scheme it switches to. */
  document.addEventListener('mouseover', function(event) {
    var toggle = event.target.closest('.scheme-toggle');
    if (!toggle || toggle.classList.contains('is-hovered')) return;
    toggle.classList.add('is-hovered');
    var use = toggle.querySelector('use');
    if (use) use.setAttribute('href', iconFor(current() === 'dark' ? 'light' : 'dark'));
  });
  document.addEventListener('mouseout', function(event) {
    var toggle = event.target.closest('.scheme-toggle');
    if (!toggle || (event.relatedTarget && toggle.contains(event.relatedTarget))) return;
    toggle.classList.remove('is-hovered');
    var use = toggle.querySelector('use');
    if (use) use.setAttribute('href', iconFor(current()));
  });

  if (media) {
    var onChange = function() {
      var saved = read();
      if (saved && saved === systemScheme()) {
        write(null);
        root.removeAttribute('data-scheme');
      }
      render();
    };
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else if (typeof media.addListener === 'function') media.addListener(onChange);
  }

  window.BlueNote.ready(function() {
    var saved = read();
    if (saved === systemScheme()) {
      write(null);
      root.removeAttribute('data-scheme');
    }
    render();
  });
})();
