/* Navigation: solid bar after scrolling, full-screen menu on narrow screens. */
(function() {
  'use strict';
  var nav = document.querySelector('.site-nav');
  if (!nav) return;
  var toggle = nav.querySelector('.site-nav__toggle');
  var menu = nav.querySelector('.site-menu');
  var solidAfter = 50;
  var open = false;
  var ticking = false;

  function updateSolid() {
    nav.classList.toggle('site-nav--solid', window.scrollY > solidAfter || open);
    ticking = false;
  }
  function requestSolid() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateSolid);
  }

  function setOpen(value) {
    open = Boolean(value);
    nav.classList.toggle('site-nav--open', open);
    document.body.classList.toggle('mobile-menu-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menu && open) {
      Array.prototype.forEach.call(menu.children, function(entry, index) {
        entry.style.animationDelay = (index * 20) + 'ms';
      });
    }
    updateSolid();
  }

  if (toggle) {
    toggle.addEventListener('click', function() { setOpen(!open); });
  }
  if (menu) {
    menu.addEventListener('click', function(event) {
      var link = event.target.closest('a[href]');
      if (link && window.innerWidth < 992) setOpen(false);
    });
  }
  window.addEventListener('resize', function() {
    if (open && window.innerWidth >= 992) setOpen(false);
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  window.addEventListener('scroll', requestSolid, { passive: true });
  updateSolid();

  window.BlueNote = window.BlueNote || {};
  window.BlueNote.nav = {
    open: function() { setOpen(true); },
    close: function() { setOpen(false); },
    toggle: function() { setOpen(!open); },
    isOpen: function() { return open; }
  };
})();
