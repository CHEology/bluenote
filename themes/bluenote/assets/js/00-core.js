(function() {
  'use strict';
  var root = document.documentElement;
  var BlueNote = window.BlueNote || {};
  BlueNote.root = root.getAttribute('data-root') || '/';
  if (!BlueNote.root.endsWith('/')) BlueNote.root += '/';
  BlueNote.ready = function(callback) {
    if (document.readyState !== 'loading') callback();
    else document.addEventListener('DOMContentLoaded', callback);
  };
  BlueNote.reduceMotion = function() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  window.BlueNote = BlueNote;
})();
