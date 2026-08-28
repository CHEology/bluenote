(function() {
  var storageKey = 'bluenote.private-key.v1';
  var rootLink = document.querySelector('.navbar-brand');
  var siteRoot = rootLink ? new URL(rootLink.href, window.location.href).pathname : '/';
  if (!siteRoot.endsWith('/')) siteRoot += '/';

  var archive;
  var manifest = { posts: [] };
  var unlockedPayload;
  var activeKeyBytes;
  var previousFocus;

  function bytesFromBase64(value) {
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function base64FromBytes(value) {
    var binary = '';
    for (var i = 0; i < value.length; i += 1) binary += String.fromCharCode(value[i]);
    return window.btoa(binary);
  }

  function archiveFingerprint(bundle) {
    return [bundle.kdf.salt, bundle.cipher.iv, bundle.ciphertext.length].join('.');
  }

  async function deriveKeyBytes(password, bundle) {
    var material = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    var bits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: bundle.kdf.hash,
        salt: bytesFromBase64(bundle.kdf.salt),
        iterations: bundle.kdf.iterations
      },
      material,
      256
    );
    return new Uint8Array(bits);
  }

  async function decryptWithKeyBytes(bundle, keyBytes) {
    var key = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    var plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesFromBase64(bundle.cipher.iv) },
      key,
      bytesFromBase64(bundle.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function normalizedPath(value) {
    try {
      return new URL(value, window.location.origin).pathname;
    } catch (error) {
      return value;
    }
  }

  function markPrivateLinks() {
    manifest.posts.forEach(function(post) {
      document.querySelectorAll('a[href]').forEach(function(link) {
        var rawHref = link.getAttribute('href') || '';
        if (rawHref.charAt(0) === '#' || rawHref.indexOf('javascript:') === 0) return;
        if (normalizedPath(link.href) !== normalizedPath(post.url)) return;
        link.dataset.privateLink = post.id;
        link.setAttribute('aria-label', post.title + '，Private reading');
        var card = link.closest('.index-card');
        if (card) card.classList.add('private-entry');
        var listing = link.closest('.list-group-item');
        if (listing) listing.classList.add('private-entry');
        var lockTarget = listing ? link.querySelector('.list-group-item-title') : null;
        if (!lockTarget && (link.closest('.index-header') || link.closest('.post-prevnext'))) lockTarget = link;
        if (lockTarget && !lockTarget.querySelector('.private-link-lock')) {
          var lock = document.createElement('span');
          lock.className = 'private-lock-icon private-link-lock';
          lock.setAttribute('aria-hidden', 'true');
          if (listing) lockTarget.appendChild(lock);
          else lockTarget.insertBefore(lock, lockTarget.firstChild);
        }
      });
    });
  }

  function renderCurrentPrivatePost() {
    var shell = document.querySelector('[data-private-post-id]');
    if (!shell || !unlockedPayload) return;
    var id = shell.getAttribute('data-private-post-id');
    var post = unlockedPayload.posts.find(function(item) { return item.id === id; });
    if (!post) return;

    var locked = shell.querySelector('[data-private-post-locked]');
    var content = shell.querySelector('[data-private-post-content]');
    content.innerHTML = post.html;
    content.hidden = false;
    locked.hidden = true;
    document.body.classList.add('private-post-unlocked');
  }

  function announceUnlocked() {
    document.documentElement.classList.add('private-reading-unlocked');
    renderCurrentPrivatePost();
    document.dispatchEvent(new CustomEvent('bluenote:private-unlocked', {
      detail: { posts: unlockedPayload.posts }
    }));
  }

  function closeMobileMenu() {
    var menu = document.querySelector('#mobile-grid-menu');
    var icon = document.querySelector('.animated-icon');
    if (menu) menu.classList.remove('show');
    if (icon) icon.classList.remove('open');
    document.body.classList.remove('mobile-menu-open');
  }

  function buildDialog() {
    var overlay = document.createElement('div');
    overlay.className = 'private-unlock-overlay';
    overlay.dataset.privateOverlay = '';
    overlay.hidden = true;
    overlay.innerHTML = [
      '<section class="private-unlock-dialog" role="dialog" aria-modal="true" aria-labelledby="private-unlock-title">',
      '  <button class="private-unlock-dialog__close" type="button" data-private-close aria-label="关闭">×</button>',
      '  <div class="private-unlock-dialog__title">',
      '    <span class="private-post-shell__lock" aria-hidden="true"></span>',
      '    <h2 id="private-unlock-title">Locked</h2>',
      '  </div>',
      '  <form data-private-form>',
      '    <input id="private-global-password" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required>',
      '    <button class="private-unlock-dialog__submit" type="submit">Unlock</button>',
      '  </form>',
      '  <p class="private-unlock-dialog__status" data-private-status role="status" aria-live="polite"></p>',
      '</section>'
    ].join('');
    document.body.appendChild(overlay);
    return overlay;
  }

  var overlay = buildDialog();
  var form = overlay.querySelector('[data-private-form]');
  var passwordInput = overlay.querySelector('#private-global-password');
  var status = overlay.querySelector('[data-private-status]');

  function openDialog() {
    previousFocus = document.activeElement;
    closeMobileMenu();
    overlay.hidden = false;
    document.body.classList.add('private-dialog-open');
    form.hidden = Boolean(unlockedPayload);
    status.textContent = '';
    if (!unlockedPayload) window.setTimeout(function() { passwordInput.focus(); }, 0);
  }

  function closeDialog() {
    overlay.hidden = true;
    document.body.classList.remove('private-dialog-open');
    passwordInput.value = '';
    status.textContent = '';
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  document.addEventListener('click', function(event) {
    var accessLink = event.target.closest('a[href$="#private-unlock"], [data-private-unlock]');
    if (accessLink) {
      event.preventDefault();
      openDialog();
      return;
    }
    if (event.target.closest('[data-private-close]') || event.target === overlay) closeDialog();
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !overlay.hidden) closeDialog();
  });

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!archive || !archive.ciphertext) {
      status.textContent = 'Unavailable';
      return;
    }
    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Checking…';
    try {
      var keyBytes = await deriveKeyBytes(passwordInput.value, archive);
      var payload = await decryptWithKeyBytes(archive, keyBytes);
      activeKeyBytes = keyBytes;
      unlockedPayload = payload;
      window.localStorage.setItem(storageKey, JSON.stringify({
        fingerprint: archiveFingerprint(archive),
        key: base64FromBytes(keyBytes)
      }));
      passwordInput.value = '';
      announceUnlocked();
      closeDialog();
    } catch (error) {
      status.textContent = 'Incorrect password';
      passwordInput.select();
    } finally {
      submit.disabled = false;
    }
  });

  Promise.all([
    fetch(siteRoot + 'private/posts.enc.json', { cache: 'no-store' }).then(function(response) {
      if (!response.ok) throw new Error('archive-unavailable');
      return response.json();
    }),
    fetch(siteRoot + 'private/posts.public.json', { cache: 'no-store' }).then(function(response) {
      if (!response.ok) return { posts: [] };
      return response.json();
    })
  ]).then(async function(results) {
    archive = results[0];
    manifest = results[1];
    markPrivateLinks();

    var saved;
    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey));
    } catch (error) {}
    if (!saved || saved.fingerprint !== archiveFingerprint(archive)) return;

    try {
      activeKeyBytes = bytesFromBase64(saved.key);
      unlockedPayload = await decryptWithKeyBytes(archive, activeKeyBytes);
      announceUnlocked();
    } catch (error) {
      window.localStorage.removeItem(storageKey);
      activeKeyBytes = undefined;
      unlockedPayload = undefined;
    }
  }).catch(function() {});
})();
