// Inlined in the head so saved access is recognized before the first paint.
(function () {
  var boot = window.BlueNotePrivateBoot = {};
  boot.url = document.currentScript.getAttribute('data-archive-url');
  boot.finish = function () {
    window.clearTimeout(boot.timer);
    document.documentElement.classList.remove('private-reading-restoring');
  };
  try {
    boot.saved = JSON.parse(window.localStorage.getItem('bluenote.private-key.v1'));
    if (!boot.saved || typeof boot.saved.key !== 'string' || typeof boot.saved.fingerprint !== 'string') return;
    document.documentElement.classList.add('private-reading-restoring');
    // A failed or blocked main script must never leave the unlock control hidden.
    boot.timer = window.setTimeout(boot.finish, 10000);
    // Cache ciphertext only. The content hash changes whenever the vault changes.
    boot.archivePromise = fetch(boot.url, { cache: 'force-cache' }).then(function (response) {
      if (!response.ok) throw new Error('archive-unavailable');
      return response.json();
    }).catch(function () { return null; });
  } catch (error) { boot.finish(); }
})();
