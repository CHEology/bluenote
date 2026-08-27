(function() {
  var page = document.body;
  if (!document.querySelector('.index-card')) {
    return;
  }

  page.classList.add('home-page');
  document.documentElement.classList.add('home-root');

  var scrollPrompt = document.querySelector('.scroll-down-bar');
  if (scrollPrompt) scrollPrompt.remove();

  var cards = Array.prototype.slice.call(document.querySelectorAll('.index-card'));

  cards.slice(12).forEach(function(card) {
    card.hidden = true;
  });

  Array.prototype.slice.call(document.querySelectorAll('.index-card .post-meta')).forEach(function(meta) {
    if (meta.querySelector('.icon-tags')) {
      meta.remove();
    }
  });

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
