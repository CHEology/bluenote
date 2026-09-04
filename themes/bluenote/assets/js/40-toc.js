/* Table of contents: highlight the heading currently being read. */
(function() {
  'use strict';
  var toc = document.querySelector('.post-toc');
  var content = document.querySelector('.post-content .markdown-body');
  if (!toc || !content) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-link[href^="#"]'));
  if (!links.length) return;

  var headings = links.map(function(link) {
    var id = decodeURIComponent(link.getAttribute('href').slice(1));
    return document.getElementById(id);
  });
  var ticking = false;

  function activate(index) {
    links.forEach(function(link, position) {
      var active = position === index;
      link.classList.toggle('is-active', active);
      var item = link.closest('.toc-item');
      if (item) item.classList.toggle('is-active', active);
    });
  }

  function update() {
    var offset = window.innerHeight * 0.25;
    var active = -1;
    headings.forEach(function(heading, index) {
      if (heading && heading.getBoundingClientRect().top <= offset) active = index;
    });
    activate(active);
    ticking = false;
  }
  function request() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();
