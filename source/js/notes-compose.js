// Notes composer. Loaded only on notes pages.
//
// Posting authority is the private vault: a device that has unlocked private posts holds
// the vault key (bluenote.private-key.v1). That key opens private/notes-key.enc.json, a
// fine-grained GitHub token limited to this repository's contents. The composer commits
// the note through GitHub's API and the normal Pages workflow publishes it. Visitors
// never see a composer, and anything sent without the token is refused by GitHub.
(function() {
  'use strict';
  var script = document.currentScript;
  var notes = document.querySelector('.notes');
  if (!script || !notes) return;

  var cfg = {
    repo: script.getAttribute('data-repo'),
    branch: script.getAttribute('data-branch') || 'main',
    dir: script.getAttribute('data-dir') || 'source/_notes',
    timezone: script.getAttribute('data-timezone') || 'UTC',
    keyUrl: script.getAttribute('data-key-url'),
    tagsUrl: script.getAttribute('data-tags-url')
  };
  var storageKey = 'bluenote.private-key.v1';
  var draftKey = 'bluenote.notes-draft.v1';
  var mount = document.querySelector('[data-notes-composer]');
  var token = null;
  var knownTags = [];
  var vaultUnlocked = false;
  var TAG = /^[^\/\\?#%<>"'`\s.][^\/\\?#%<>"'`\s]{0,39}$/;

  // ---------- small helpers ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key === 'hidden') node.hidden = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function(child) { if (child) node.appendChild(child); });
    return node;
  }

  function bytesFromBase64(value) {
    var binary = window.atob(value.replace(/\s+/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function base64FromText(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return window.btoa(binary);
  }

  function textFromBase64(value) {
    return new TextDecoder().decode(bytesFromBase64(value));
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // A plain preview until the built page replaces it: paragraphs, line breaks and links.
  function preview(text) {
    return text.trim().split(/\n{2,}/).map(function(block) {
      var html = escapeHTML(block).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>').replace(/\n/g, '<br>');
      return '<p>' + html + '</p>';
    }).join('');
  }

  function stamp(date) {
    var parts = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date || new Date()).forEach(function(part) { parts[part.type] = part.value; });
    return {
      id: parts.year + parts.month + parts.day + '-' + parts.hour + parts.minute + parts.second,
      date: parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute + ':' + parts.second,
      display: parts.year + '.' + parts.month + '.' + parts.day + ' ' + parts.hour + ':' + parts.minute
    };
  }

  function normalizeTag(value) {
    return String(value || '').trim().replace(/^#+/, '');
  }

  function tagBlock(tags) {
    return tags.length ? 'tags:\n' + tags.map(function(tag) { return '  - ' + JSON.stringify(tag); }).join('\n') + '\n' : '';
  }

  // Reads the parts of a note file the composer edits; other front matter lines are kept.
  function parseNote(raw) {
    var match = raw.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) throw new Error('This note has no front matter.');
    var lines = match[1].split(/\r?\n/);
    var kept = [];
    var tags = [];
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var inline = line.match(/^tags:\s*(.*)$/);
      if (inline) {
        var value = inline[1].trim();
        if (value && value !== '[]') {
          value.replace(/^\[|\]$/g, '').split(',').forEach(function(tag) {
            tag = tag.trim().replace(/^(['"])(.*)\1$/, '$2');
            if (tag) tags.push(tag);
          });
        }
        while (i + 1 < lines.length && /^\s+-\s*/.test(lines[i + 1])) {
          i += 1;
          tags.push(lines[i].replace(/^\s+-\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2'));
        }
        continue;
      }
      if (/^updated:/.test(line)) continue;
      kept.push(line);
    }
    return { kept: kept, tags: tags, body: match[2].replace(/^\r?\n/, '').replace(/\s+$/, '') };
  }

  // ---------- GitHub ----------
  function api(method, path, body) {
    var headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, {
      method: method, headers: headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined
    }).then(function(response) {
      return (response.status === 204 ? Promise.resolve(null) : response.json().catch(function() { return null; })).then(function(data) {
        if (response.ok) return data;
        var error = new Error((data && data.message) || ('HTTP ' + response.status));
        error.status = response.status;
        throw error;
      });
    });
  }

  function contentsPath(file) {
    return '/repos/' + cfg.repo + '/contents/' + (cfg.dir + '/' + file).split('/').map(encodeURIComponent).join('/');
  }

  function explain(error) {
    if (error.status === 401) return 'The posting token was refused or has expired. Run npm run notes:setup.';
    if (error.status === 403 || error.status === 404) return 'The posting token cannot write to ' + cfg.repo + '.';
    if (error.status === 409 || error.status === 422) return 'The note changed elsewhere. Reload and try again.';
    if (!navigator.onLine) return 'You are offline. Nothing was posted.';
    return 'GitHub did not accept it: ' + error.message;
  }

  // Follows the Pages build for a commit. A newer push may supersede it (the workflow
  // cancels a pending run), in which case the latest run on the branch is followed.
  function watch(sha, update) {
    var started = Date.now();
    var runId = null;
    function finish(state, link) { update(state, link); }
    function poll() {
      if (Date.now() - started > 15 * 60 * 1000) return finish('slow');
      var path = runId
        ? '/repos/' + cfg.repo + '/actions/runs/' + runId
        : '/repos/' + cfg.repo + '/actions/runs?head_sha=' + sha + '&per_page=5';
      api('GET', path).then(function(data) {
        var run = runId ? data : (data.workflow_runs || [])[0];
        if (!run) return window.setTimeout(poll, 6000);
        if (run.status !== 'completed') {
          update('building');
          runId = run.id;
          return window.setTimeout(poll, 8000);
        }
        if (run.conclusion === 'success') return finish('live');
        if (run.conclusion === 'cancelled') {
          return api('GET', '/repos/' + cfg.repo + '/actions/runs?branch=' + encodeURIComponent(cfg.branch) + '&event=push&per_page=1').then(function(latest) {
            var next = (latest.workflow_runs || [])[0];
            if (next && next.id !== run.id) { runId = next.id; return window.setTimeout(poll, 8000); }
            finish('failed', run.html_url);
          });
        }
        finish('failed', run.html_url);
      }).catch(function() { finish('saved'); });
    }
    update('building');
    window.setTimeout(poll, 5000);
  }

  var stateText = {
    building: 'Publishing…',
    live: 'Live',
    saved: 'Saved. It will be live in a few minutes.',
    slow: 'Still publishing. Check GitHub Actions.',
    failed: 'The site build failed; the note is saved but not live.'
  };

  function showState(node, state, link) {
    node.textContent = stateText[state] || '';
    if (state === 'failed' && link) {
      node.appendChild(document.createTextNode(' '));
      node.appendChild(el('a', { href: link, rel: 'noopener', text: 'Details' }));
    }
    if (state === 'live') {
      node.appendChild(document.createTextNode(' · '));
      node.appendChild(el('a', { href: window.location.pathname, text: 'Reload' }));
      if (window.BlueNoteNotes) window.BlueNoteNotes.reset();
    }
  }

  // ---------- editor ----------
  function editor(options) {
    var selected = (options.tags || []).slice();
    var form = el('form', { class: 'notes-compose', novalidate: '' });
    var id = 'notes-compose-' + Math.random().toString(36).slice(2, 8);
    var label = el('label', { class: 'visually-hidden', for: id, text: options.label });
    var area = el('textarea', { id: id, rows: '3', placeholder: options.placeholder || '', spellcheck: 'true' });
    area.value = options.text || '';
    // Tags attached to this note are listed as "#tag ×" (activate to remove). Existing tags
    // appear only as suggestions while typing in the "+ tag" field.
    var tags = el('div', { class: 'notes-compose__tags' });
    var chosen = el('ul', { class: 'notes-compose__chosen', 'aria-label': 'Tags on this note' });
    var newTag = el('input', { class: 'notes-compose__new-tag', type: 'text', placeholder: '+ tag', 'aria-label': 'Add a tag', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done' });
    var suggestions = el('div', { class: 'notes-compose__suggestions', role: 'group', 'aria-label': 'Existing tags', hidden: true });
    tags.appendChild(chosen);
    tags.appendChild(newTag);
    tags.appendChild(suggestions);
    var status = el('p', { class: 'notes-compose__status', 'aria-live': 'polite' });
    var cancel = options.onCancel ? el('button', { type: 'button', class: 'notes-compose__button', text: 'Cancel' }) : null;
    var submit = el('button', { type: 'submit', class: 'notes-compose__button notes-compose__button--primary', text: options.submit });
    // Tags sit on the bar below the text, to the left of the buttons; messages go underneath.
    var bar = el('div', { class: 'notes-compose__bar' }, [tags, el('div', { class: 'notes-compose__actions' }, [cancel, submit])]);

    function renderChosen() {
      chosen.textContent = '';
      chosen.hidden = !selected.length;
      selected.forEach(function(tag) {
        var remove = el('button', { type: 'button', class: 'notes-compose__chip', 'aria-label': 'Remove tag ' + tag, title: 'Remove' },
          [document.createTextNode('#' + tag), el('span', { class: 'notes-compose__remove', 'aria-hidden': 'true', text: '×' })]);
        remove.addEventListener('click', function() {
          selected.splice(selected.indexOf(tag), 1);
          renderChosen();
          renderSuggestions();
          newTag.focus();
        });
        chosen.appendChild(el('li', {}, [remove]));
      });
    }

    function renderSuggestions() {
      var query = normalizeTag(newTag.value).toLowerCase();
      suggestions.textContent = '';
      var matches = query ? knownTags.filter(function(tag) {
        return selected.indexOf(tag) === -1 && tag.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 8) : [];
      matches.forEach(function(tag) {
        var button = el('button', { type: 'button', class: 'notes-compose__tag', text: '#' + tag });
        button.addEventListener('click', function() { choose(tag); });
        suggestions.appendChild(button);
      });
      suggestions.hidden = !matches.length;
    }

    function choose(tag) {
      if (selected.indexOf(tag) === -1) selected.push(tag);
      newTag.value = '';
      status.textContent = '';
      renderChosen();
      renderSuggestions();
      newTag.focus();
    }

    function addTag() {
      var tag = normalizeTag(newTag.value);
      if (!tag) return true;
      if (!TAG.test(tag)) {
        status.textContent = 'Tags are one word, without spaces, slashes or quotes.';
        return false;
      }
      // Reuse an existing tag's spelling when only the letter case differs.
      var existing = knownTags.filter(function(known) { return known.toLowerCase() === tag.toLowerCase(); })[0];
      tag = existing || tag;
      if (!existing) knownTags.push(tag);
      choose(tag);
      return true;
    }

    newTag.addEventListener('input', renderSuggestions);
    newTag.addEventListener('keydown', function(event) {
      // Enter also confirms a Chinese or Japanese input-method candidate; leave that alone.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
        event.preventDefault();
        addTag();
      } else if (event.key === 'ArrowDown' && !suggestions.hidden) {
        event.preventDefault();
        suggestions.firstChild.focus();
      } else if (event.key === 'Escape' && newTag.value) {
        event.preventDefault();
        newTag.value = '';
        renderSuggestions();
      } else if (event.key === 'Backspace' && !newTag.value && selected.length) {
        selected.pop();
        renderChosen();
      }
    });
    suggestions.addEventListener('keydown', function(event) {
      var target = event.target;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (target.nextSibling) target.nextSibling.focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        (target.previousSibling || newTag).focus();
      } else if (event.key === 'Escape') {
        newTag.focus();
      }
    });
    area.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        form.requestSubmit ? form.requestSubmit() : submit.click();
      }
    });
    if (options.onInput) area.addEventListener('input', function() { options.onInput(area.value); });
    if (cancel) cancel.addEventListener('click', options.onCancel);
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (!addTag()) return;
      var text = area.value.replace(/\s+$/, '');
      if (!text.trim()) {
        status.textContent = 'Write something first.';
        area.focus();
        return;
      }
      submit.disabled = true;
      if (cancel) cancel.disabled = true;
      status.textContent = options.busy;
      options.onSubmit(text, selected.slice()).then(function(done) {
        status.textContent = done || '';
      }).catch(function(error) {
        status.textContent = explain(error);
      }).finally(function() {
        submit.disabled = false;
        if (cancel) cancel.disabled = false;
      });
    });

    form.appendChild(label);
    form.appendChild(area);
    form.appendChild(bar);
    form.appendChild(status);
    renderChosen();
    form.clear = function(text) {
      area.value = text || '';
      newTag.value = '';
      selected = [];
      renderChosen();
      renderSuggestions();
    };
    form.focusText = function() { area.focus(); };
    return form;
  }

  // ---------- timeline ----------
  function pendingNote(stampValue, text, tags) {
    var list = notes.querySelector('ol.notes-list[data-notes-list]');
    if (!list) {
      var empty = notes.querySelector('.notes-empty[data-notes-list]');
      list = el('ol', { class: 'notes-list', 'data-notes-list': '' });
      if (empty) empty.replaceWith(list); else notes.appendChild(list);
    }
    var state = el('span', { class: 'note__state' });
    var article = el('article', { class: 'note note--pending', 'data-note-id': stampValue.id });
    article.innerHTML = '<header class="note__meta"><span class="note__date">' + escapeHTML(stampValue.display) + '</span></header>' +
      '<div class="note__body markdown-body">' + preview(text) + '</div>' +
      (tags.length ? '<ul class="note__tags">' + tags.map(function(tag) { return '<li><span>#' + escapeHTML(tag) + '</span></li>'; }).join('') + '</ul>' : '');
    article.querySelector('.note__meta').appendChild(state);
    var item = el('li', {}, [article]);
    list.insertBefore(item, list.firstChild);
    return state;
  }

  function saveDraft(value) {
    try { if (value) window.localStorage.setItem(draftKey, value); else window.localStorage.removeItem(draftKey); } catch (error) {}
  }

  function loadDraft() {
    try { return window.localStorage.getItem(draftKey) || ''; } catch (error) { return ''; }
  }

  function showComposer() {
    if (!mount) return;
    mount.textContent = '';
    mount.classList.remove('notes-composer--locked');
    var composer = editor({
      label: 'New note',
      placeholder: 'Write a note…',
      submit: 'Post',
      busy: 'Posting…',
      text: loadDraft(),
      onInput: saveDraft,
      onSubmit: function(text, tags) {
        var s = stamp();
        var body = '---\ndate: ' + s.date + '\n' + tagBlock(tags) + '---\n\n' + text + '\n';
        return api('PUT', contentsPath(s.id + '.md'), {
          message: 'Add note ' + s.id,
          content: base64FromText(body),
          branch: cfg.branch
        }).then(function(result) {
          saveDraft('');
          composer.clear('');
          var state = pendingNote(s, text, tags);
          watch(result.commit.sha, function(value, link) { showState(state, value, link); });
          return '';
        });
      }
    });
    mount.appendChild(composer);
    mount.hidden = false;
  }

  function showLocked(message) {
    if (!mount) return;
    mount.textContent = '';
    mount.classList.add('notes-composer--locked');
    if (message) {
      mount.appendChild(el('p', { class: 'notes-composer__notice', text: message }));
    } else {
      var button = el('button', { type: 'button', class: 'notes-unlock', 'data-private-unlock': '', 'aria-label': 'Unlock to post', title: 'Unlock to post' },
        [el('span', { class: 'private-post-shell__lock', 'aria-hidden': 'true' })]);
      mount.appendChild(button);
    }
    mount.hidden = false;
  }

  // ---------- edit and delete ----------
  function decorate(article) {
    if (!token || article.dataset.noteActions || article.classList.contains('note--pending')) return;
    var file = article.getAttribute('data-note-file');
    var meta = article.querySelector('.note__meta');
    if (!file || !meta) return;
    article.dataset.noteActions = 'true';
    var state = el('span', { class: 'note__state' });
    var edit = el('button', { type: 'button', class: 'note__action', text: 'Edit' });
    var remove = el('button', { type: 'button', class: 'note__action', text: 'Delete' });
    meta.appendChild(el('span', { class: 'note__actions' }, [edit, remove]));
    meta.appendChild(state);

    edit.addEventListener('click', function() {
      if (article.querySelector('.notes-compose')) return;
      var body = article.querySelector('.note__body');
      var tagList = article.querySelector('.note__tags');
      state.textContent = 'Loading…';
      api('GET', contentsPath(file) + '?ref=' + encodeURIComponent(cfg.branch)).then(function(current) {
        var parsed = parseNote(textFromBase64(current.content));
        state.textContent = '';
        var form = editor({
          label: 'Edit note',
          submit: 'Save',
          busy: 'Saving…',
          text: parsed.body,
          tags: parsed.tags,
          onCancel: function() { form.remove(); body.hidden = false; if (tagList) tagList.hidden = false; edit.focus(); },
          onSubmit: function(text, tags) {
            var raw = '---\n' + parsed.kept.join('\n') + '\nupdated: ' + stamp().date + '\n' + tagBlock(tags) + '---\n\n' + text + '\n';
            return api('PUT', contentsPath(file), {
              message: 'Edit note ' + file.replace(/\.md$/, ''),
              content: base64FromText(raw),
              sha: current.sha,
              branch: cfg.branch
            }).then(function(result) {
              form.remove();
              body.innerHTML = preview(text);
              body.hidden = false;
              if (tagList) tagList.remove();
              if (tags.length) {
                body.insertAdjacentHTML('afterend', '<ul class="note__tags">' + tags.map(function(tag) { return '<li><span>#' + escapeHTML(tag) + '</span></li>'; }).join('') + '</ul>');
              }
              tagList = article.querySelector('.note__tags');
              watch(result.commit.sha, function(value, link) { showState(state, value, link); });
              return '';
            });
          }
        });
        body.hidden = true;
        if (tagList) tagList.hidden = true;
        body.insertAdjacentElement('afterend', form);
        form.focusText();
      }).catch(function(error) { state.textContent = explain(error); });
    });

    remove.addEventListener('click', function() {
      if (!window.confirm('Delete this note? It stays in the repository history.')) return;
      remove.disabled = true;
      state.textContent = 'Deleting…';
      api('GET', contentsPath(file) + '?ref=' + encodeURIComponent(cfg.branch)).then(function(current) {
        return api('DELETE', contentsPath(file), { message: 'Delete note ' + file.replace(/\.md$/, ''), sha: current.sha, branch: cfg.branch });
      }).then(function(result) {
        article.classList.add('note--deleted');
        var body = article.querySelector('.note__body');
        if (body) body.hidden = true;
        var actions = article.querySelector('.note__actions');
        if (actions) actions.remove();
        watch(result.commit.sha, function(value, link) { showState(state, value === 'live' ? 'deleted' : value, link); });
      }).catch(function(error) {
        remove.disabled = false;
        state.textContent = explain(error);
      });
    });
  }
  stateText.deleted = 'Deleted';

  function decorateAll() {
    Array.prototype.forEach.call(document.querySelectorAll('.notes article.note[data-note-file]'), decorate);
  }

  // ---------- unlocking ----------
  function savedKey() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(storageKey));
      return saved && typeof saved.key === 'string' ? saved.key : '';
    } catch (error) { return ''; }
  }

  function loadTags() {
    if (!cfg.tagsUrl) return Promise.resolve();
    return fetch(cfg.tagsUrl, { cache: 'no-cache' }).then(function(response) {
      return response.ok ? response.json() : { tags: [] };
    }).then(function(data) {
      knownTags = (data.tags || []).map(function(tag) { return tag.name; });
    }).catch(function() {});
  }

  function tryUnlock() {
    var key = savedKey();
    if (!key) { showLocked(); return Promise.resolve(); }
    return fetch(cfg.keyUrl, { cache: 'no-cache' }).then(function(response) {
      if (response.status === 404) throw new Error('missing');
      if (!response.ok) throw new Error('unavailable');
      return response.json();
    }).then(function(sealed) {
      return window.crypto.subtle.importKey('raw', bytesFromBase64(key), { name: 'AES-GCM' }, false, ['decrypt']).then(function(cryptoKey) {
        return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromBase64(sealed.cipher.iv) }, cryptoKey, bytesFromBase64(sealed.ciphertext));
      });
    }).then(function(plain) {
      var payload = JSON.parse(new TextDecoder().decode(plain));
      if (!payload.token) throw new Error('missing');
      token = payload.token;
      return loadTags().then(function() {
        showComposer();
        decorateAll();
        document.documentElement.classList.add('notes-can-post');
      });
    }).catch(function(error) {
      token = null;
      if (error.message === 'missing') showLocked(vaultUnlocked ? 'Posting is not set up yet. Run npm run notes:setup.' : '');
      else if (error.message === 'unavailable') showLocked('');
      // The saved key is valid for the vault but does not open this posting key.
      else showLocked(vaultUnlocked ? 'The posting key is out of date. Run npm run notes:setup.' : '');
    });
  }

  document.addEventListener('bluenote:private-unlocked', function() {
    vaultUnlocked = true;
    if (!token) tryUnlock();
  });
  document.addEventListener('bluenote:notes-rendered', decorateAll);
  tryUnlock();
})();
