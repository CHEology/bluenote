/* Home: fade the slogan once the reader scrolls towards the cards. */
(function() {
  'use strict';
  var page = document.body;
  if (!page.classList.contains('home-page')) return;
  var ticking = false;

  function update() {
    page.classList.toggle('home-page--scrolled', window.scrollY > window.innerHeight * 0.28);
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
