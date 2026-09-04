/* Site search panel over the hexo-generator-search index. Private posts (an optional
   site feature) are hidden until the page announces `bluenote:private-unlocked`. */
(function() {
  'use strict';
  var trigger = document.querySelector('a[href$="#site-search"]');
  if (!trigger) return;
  var siteRoot = window.BlueNote.root;
  var searchPath = document.documentElement.getAttribute('data-search-path') || 'local-search.xml';
  var entries = [];
  var privateByUrl = new Map();
  var unlockedPrivatePosts = [];
  var loadingPromise;
  var previousFocus;

  function normalizedPath(value) {
    try {
      return new URL(value, window.location.origin).pathname.replace(/\/{2,}/g, '/');
    } catch (error) {
      return value;
    }
  }

  function cleanText(value) {
    var container = document.createElement('div');
    container.innerHTML = value || '';
    return (container.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function mergeUnlockedPrivatePosts() {
    unlockedPrivatePosts.forEach(function(post) {
      var publicPost = Array.from(privateByUrl.values()).find(function(item) { return item.id === post.id; });
      if (!publicPost) return;
      var entry = entries.find(function(item) { return normalizedPath(item.url) === normalizedPath(publicPost.url); });
      if (entry) entry.content = cleanText(post.html);
    });
  }

  function buildOverlay() {
    var element = document.createElement('div');
    element.className = 'site-search-overlay';
    element.dataset.searchOverlay = '';
    element.hidden = true;
    var placeholder = trigger.getAttribute('data-search-placeholder') || trigger.textContent.trim() || 'Search';
    element.innerHTML = [
      '<section class="site-search-dialog" role="dialog" aria-modal="true" aria-label="' + placeholder + '">',
      '  <div class="site-search-dialog__field">',
      '    <svg class="icon site-search-dialog__icon" aria-hidden="true" focusable="false"><use href="#icon-search"></use></svg>',
      '    <input id="site-search-input" type="search" autocomplete="off" placeholder="' + placeholder + '" aria-label="' + placeholder + '">',
      '    <button class="site-search-dialog__close" type="button" data-search-close aria-label="Close search"></button>',
      '  </div>',
      '  <div class="site-search-results" data-search-results aria-live="polite"></div>',
      '</section>'
    ].join('');
    document.body.appendChild(element);
    return element;
  }

  var overlay = buildOverlay();
  var input = overlay.querySelector('#site-search-input');
  var results = overlay.querySelector('[data-search-results]');

  function loadIndex() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = Promise.all([
      fetch(siteRoot + searchPath.replace(/^\//, ''), { cache: 'no-store' }).then(function(response) {
        if (!response.ok) throw new Error('search-index-unavailable');
        return response.text();
      }),
      fetch(siteRoot + 'private/posts.public.json', { cache: 'no-store' }).then(function(response) {
        if (!response.ok) return { posts: [] };
        return response.json();
      }).catch(function() { return { posts: [] }; })
    ]).then(function(values) {
      var xml = new DOMParser().parseFromString(values[0], 'application/xml');
      (values[1].posts || []).forEach(function(post) {
        privateByUrl.set(normalizedPath(post.url), post);
      });
      entries = Array.prototype.map.call(xml.querySelectorAll('entry'), function(entry) {
        var url = entry.querySelector('url') ? entry.querySelector('url').textContent : '';
        var privatePost = privateByUrl.get(normalizedPath(url));
        return {
          title: entry.querySelector('title') ? entry.querySelector('title').textContent.trim() : 'Untitled',
          content: cleanText(entry.querySelector('content') ? entry.querySelector('content').textContent : ''),
          url: privatePost ? privatePost.url : url,
          privatePost: privatePost
        };
      });
      mergeUnlockedPrivatePosts();
    }).catch(function() {
      entries = [];
    });
    return loadingPromise;
  }

  function excerptAround(content, query) {
    var lower = content.toLowerCase();
    var position = lower.indexOf(query.toLowerCase());
    if (position < 0) position = 0;
    var start = Math.max(0, position - 32);
    var end = Math.min(content.length, position + 96);
    return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  }

  function renderResults() {
    var query = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (!query) return;

    var unlocked = document.documentElement.classList.contains('private-reading-unlocked');
    var matches = entries.filter(function(entry) {
      if (entry.privatePost && !unlocked) return false;
      return entry.title.toLowerCase().includes(query) || entry.content.toLowerCase().includes(query);
    }).slice(0, 20);
    matches.forEach(function(entry) {
      var link = document.createElement('a');
      link.className = 'site-search-result';
      link.href = entry.url;
      if (entry.privatePost) link.classList.add('site-search-result--private');

      var heading = document.createElement('span');
      heading.className = 'site-search-result__title';
      heading.textContent = entry.title;
      link.appendChild(heading);

      if (entry.privatePost) {
        var lock = document.createElement('span');
        lock.className = 'site-search-result__privacy';
        var lockIcon = document.createElement('i');
        lockIcon.className = 'private-lock-icon';
        lockIcon.setAttribute('aria-hidden', 'true');
        lock.appendChild(lockIcon);
        lock.setAttribute('aria-label', unlocked ? 'Unlocked' : 'Locked');
        link.appendChild(lock);
      } else if (entry.content) {
        var excerpt = document.createElement('span');
        excerpt.className = 'site-search-result__excerpt';
        excerpt.textContent = excerptAround(entry.content, query);
        link.appendChild(excerpt);
      }
      results.appendChild(link);
    });
  }

  function openSearch() {
    previousFocus = document.activeElement;
    if (window.BlueNote.nav) window.BlueNote.nav.close();
    overlay.hidden = false;
    document.body.classList.add('search-dialog-open');
    loadIndex().then(renderResults);
    window.setTimeout(function() { input.focus(); }, 0);
  }

  function closeSearch() {
    overlay.hidden = true;
    document.body.classList.remove('search-dialog-open');
    input.value = '';
    results.replaceChildren();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  document.addEventListener('click', function(event) {
    var searchLink = event.target.closest('a[href$="#site-search"]');
    if (searchLink) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.target.closest('[data-search-close]') || event.target === overlay) closeSearch();
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !overlay.hidden) closeSearch();
  });

  input.addEventListener('input', renderResults);

  document.addEventListener('bluenote:private-unlocked', function(event) {
    if (!event.detail || !event.detail.posts) return;
    unlockedPrivatePosts = event.detail.posts;
    mergeUnlockedPrivatePosts();
    if (!overlay.hidden) renderResults();
  });

  window.BlueNote.search = { open: openSearch, close: closeSearch };
})();
