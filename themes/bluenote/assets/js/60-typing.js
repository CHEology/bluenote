/* Home slogan typing effect, driven by the bundled typed.js when present. */
(function() {
  'use strict';
  var subtitle = document.getElementById('subtitle');
  if (!subtitle || !subtitle.hasAttribute('data-typed-text')) return;
  var text = subtitle.getAttribute('data-typed-text') || '';
  if (!text) return;
  if (!('Typed' in window) || window.BlueNote.reduceMotion()) {
    subtitle.textContent = text;
    return;
  }
  subtitle.textContent = '';
  /* Construct once the document is parsed; typed.js starts typing by itself.
     Do not call stop()/start() around construction: start() before the first
     tick launches a second, backspacing loop. */
  window.BlueNote.ready(function() {
    new window.Typed('#subtitle', {
      strings: ['  ', text],
      cursorChar: subtitle.getAttribute('data-typed-cursor') || '_',
      typeSpeed: parseInt(subtitle.getAttribute('data-typed-speed'), 10) || 70,
      loop: false
    });
  });
})();
