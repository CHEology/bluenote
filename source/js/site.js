(function() {
  function isoDate(value) {
    return (value || '').split(/[ T]/)[0];
  }

  function preparePostPage() {
    var post = document.querySelector('article.post-content');
    if (!post) return;

    document.body.classList.add('post-page');

    if (post.querySelectorAll('.markdown-body img').length >= 3) {
      document.body.classList.add('photo-post');
    }

    var details = document.querySelector('.banner-text > .mt-1, .banner-text > .mt-3');
    if (details) details.remove();

    document.querySelectorAll('.banner-text time[datetime]').forEach(function(time) {
      var date = isoDate(time.getAttribute('datetime'));
      if (date) time.textContent = date;
    });

    document.querySelectorAll('figcaption.image-caption').forEach(function(caption) {
      if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(caption.textContent.trim())) {
        caption.remove();
      }
    });

    document.querySelectorAll('a.fancybox[data-caption]').forEach(function(link) {
      if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(link.getAttribute('data-caption').trim())) {
        link.removeAttribute('data-caption');
        link.removeAttribute('title');
      }
    });
  }

  function simplifyPostFooter() {
    var post = document.querySelector('article.post-content');
    if (!post) return;

    var tags = post.querySelector('.post-metas.my-3');
    var license = post.querySelector('.license-box');
    var markdown = post.querySelector('.markdown-body');
    var divider = markdown ? markdown.nextElementSibling : null;

    if (tags) tags.remove();

    if (!license && markdown) {
      license = document.createElement('div');
      markdown.insertAdjacentElement('afterend', license);
    }

    if (license) {
      var titleSource = license.querySelector('.license-title > div:first-child');
      var dateSource = license.querySelector('.license-meta-date > div:last-child');
      var publishedTime = document.querySelector('.banner-text time[datetime]');
      var title = document.createElement('div');
      var date = document.createElement('time');

      title.className = 'post-end-title';
      title.textContent = titleSource ? titleSource.textContent.trim() : document.title.split(' - ')[0];
      date.className = 'post-end-date';
      date.textContent = isoDate(
        publishedTime ? publishedTime.getAttribute('datetime') : (dateSource ? dateSource.textContent.trim() : '')
      );

      if (publishedTime) {
        date.setAttribute('datetime', publishedTime.getAttribute('datetime'));
      }

      license.replaceChildren(title, date);
      license.className = 'post-end-card my-3';
    }

    if (divider && divider.tagName === 'HR') divider.remove();
  }

  document.addEventListener('DOMContentLoaded', function() {
    simplifyPostFooter();
    preparePostPage();
  });
})();
