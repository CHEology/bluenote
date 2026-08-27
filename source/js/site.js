(function() {
  function isoDate(value) {
    return (value || '').split(/[ T]/)[0];
  }

  function prepareEditorialPage() {
    var post = document.querySelector('article.post-content');
    var listing = document.querySelector('#board .list-group');
    var page = document.querySelector('#board .page-content');

    if (!post && !listing && !page) return;

    document.body.classList.add('editorial-page');

    if (listing) {
      document.body.classList.add('listing-page');

      var total = listing.querySelector('.h4');
      if (total && total.parentElement === listing) {
        var divider = total.nextElementSibling;
        if (divider && divider.tagName === 'HR') divider.remove();
        total.remove();
      }
    }

    if (document.querySelector('.about-info')) {
      document.body.classList.add('about-page');
    }
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

  function removePostFooterMetadata() {
    var post = document.querySelector('article.post-content');
    if (!post) return;

    var tags = post.querySelector('.post-metas.my-3');
    var markdown = post.querySelector('.markdown-body');
    var divider = markdown ? markdown.nextElementSibling : null;

    if (tags) tags.remove();

    post.querySelectorAll('.post-end-card, .license-box').forEach(function(metadata) {
      metadata.remove();
    });

    if (divider && divider.tagName === 'HR') divider.remove();
  }

  document.addEventListener('DOMContentLoaded', function() {
    prepareEditorialPage();
    removePostFooterMetadata();
    preparePostPage();
  });
})();
