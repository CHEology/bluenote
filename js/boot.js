/* global Fluid */

Fluid.boot = {};

Fluid.boot.registerEvents = function() {
  Fluid.events.billboard();
  Fluid.events.registerNavbarEvent();
  Fluid.events.registerParallaxEvent();
  Fluid.events.registerScrollDownArrowEvent();
  Fluid.events.registerScrollTopArrowEvent();
  Fluid.events.registerImageLoadedEvent();
};

Fluid.boot.refresh = function() {
  Fluid.plugins.fancyBox();
  Fluid.plugins.codeWidget();
  Fluid.events.refresh();
};

Fluid.boot.simplifyPostFooter = function() {
  var post = document.querySelector('article.post-content');
  if (!post) return;

  var tags = post.querySelector('.post-metas.my-3');
  var license = post.querySelector('.license-box');
  var footer = license ? license.parentElement : (tags ? tags.parentElement : null);

  if (tags) tags.remove();

  if (license) {
    var titleSource = license.querySelector('.license-title > div:first-child');
    var dateSource = license.querySelector('.license-meta-date > div:last-child');
    var publishedTime = document.querySelector('.banner-text time[datetime]');
    var title = document.createElement('div');
    var date = document.createElement('time');

    title.className = 'post-end-title';
    title.textContent = titleSource ? titleSource.textContent.trim() : '';
    date.className = 'post-end-date';
    date.textContent = dateSource ? dateSource.textContent.trim() : '';

    if (publishedTime) {
      date.setAttribute('datetime', publishedTime.getAttribute('datetime'));
    }

    license.replaceChildren(title, date);
    license.className = 'post-end-card my-3';
  }

  if (footer) {
    var divider = footer.previousElementSibling;
    if (divider && divider.tagName === 'HR') divider.remove();
  }
};

Fluid.boot.removeTagNavigation = function() {
  var tagLink = document.querySelector('.navbar-nav a[href="/bluenote/tags/"]');
  var navItem = tagLink ? tagLink.closest('li') : null;

  if (navItem) navItem.remove();
};

Fluid.boot.removeSiteFooter = function() {
  var footer = document.querySelector('body > footer');

  if (footer) footer.remove();
};

document.addEventListener('DOMContentLoaded', function() {
  Fluid.boot.registerEvents();
  Fluid.boot.simplifyPostFooter();
  Fluid.boot.removeTagNavigation();
  Fluid.boot.removeSiteFooter();
});
