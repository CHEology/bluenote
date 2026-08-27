(function() {
  var page = document.body;
  if (!page.classList.contains('home-page')) {
    return;
  }

  var ticking = false;

  var update = function() {
    page.classList.toggle('home-page--scrolled', window.scrollY > window.innerHeight * 0.28);
    ticking = false;
  };

  var requestUpdate = function() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
})();
