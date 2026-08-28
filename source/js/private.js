(function() {
  var vault = document.querySelector('[data-private-vault]');
  if (!vault) return;

  var locked = vault.querySelector('[data-private-locked]');
  var empty = vault.querySelector('[data-private-empty]');
  var unlocked = vault.querySelector('[data-private-unlocked]');
  var form = vault.querySelector('[data-private-form]');
  var passwordInput = vault.querySelector('#private-vault-password');
  var status = vault.querySelector('[data-private-status]');
  var index = vault.querySelector('[data-private-index]');
  var article = vault.querySelector('[data-private-article]');
  var lockButton = vault.querySelector('[data-private-lock]');

  document.body.classList.add('private-page');

  function bytesFromBase64(value) {
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function decryptArchive(bundle, password) {
    var encoder = new TextEncoder();
    var material = await window.crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    var key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: bundle.kdf.hash,
        salt: bytesFromBase64(bundle.kdf.salt),
        iterations: bundle.kdf.iterations
      },
      material,
      { name: 'AES-GCM', length: 256 },
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

  function text(value) {
    return document.createTextNode(value || '');
  }

  function renderPost(post) {
    article.replaceChildren();
    var header = document.createElement('header');
    header.className = 'private-vault__article-header';
    var date = document.createElement('time');
    date.dateTime = post.date;
    date.appendChild(text(post.date));
    var title = document.createElement('h1');
    title.appendChild(text(post.title));
    header.append(date, title);

    var body = document.createElement('div');
    body.className = 'private-vault__article-body';
    body.innerHTML = post.html;
    article.append(header, body);

    index.querySelectorAll('button').forEach(function(button) {
      button.setAttribute('aria-current', button.dataset.postId === post.id ? 'page' : 'false');
    });
    window.history.replaceState(null, '', '#private-' + post.id);
  }

  function renderArchive(payload) {
    index.replaceChildren();
    article.replaceChildren();
    payload.posts.forEach(function(post) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.postId = post.id;
      var date = document.createElement('time');
      date.dateTime = post.date;
      date.appendChild(text(post.date));
      var title = document.createElement('span');
      title.appendChild(text(post.title));
      button.append(date, title);
      button.addEventListener('click', function() { renderPost(post); });
      index.appendChild(button);
    });

    locked.hidden = true;
    empty.hidden = true;
    unlocked.hidden = false;
    var requestedId = window.location.hash.replace(/^#private-/, '');
    var requested = payload.posts.find(function(post) { return post.id === requestedId; });
    renderPost(requested || payload.posts[0]);
  }

  function lockVault() {
    index.replaceChildren();
    article.replaceChildren();
    passwordInput.value = '';
    status.textContent = '';
    unlocked.hidden = true;
    empty.hidden = true;
    locked.hidden = false;
    window.history.replaceState(null, '', window.location.pathname);
    passwordInput.focus();
  }

  fetch('posts.enc.json', { cache: 'no-store' })
    .then(function(response) {
      if (!response.ok) throw new Error('archive-unavailable');
      return response.json();
    })
    .then(function(bundle) {
      if (bundle.empty) {
        locked.hidden = true;
        empty.hidden = false;
        return;
      }

      form.addEventListener('submit', async function(event) {
        event.preventDefault();
        status.textContent = '正在解锁…';
        form.querySelector('button').disabled = true;
        try {
          var payload = await decryptArchive(bundle, passwordInput.value);
          if (!payload.posts || payload.posts.length === 0) throw new Error('empty-archive');
          renderArchive(payload);
          passwordInput.value = '';
        } catch (error) {
          status.textContent = '密码不正确，或加密内容已损坏。';
          passwordInput.select();
        } finally {
          form.querySelector('button').disabled = false;
        }
      });
    })
    .catch(function() {
      status.textContent = '私人文章暂时无法读取。';
    });

  lockButton.addEventListener('click', lockVault);
})();
