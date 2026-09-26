(function () {
  'use strict';
  var players = Array.from(document.querySelectorAll('[data-post-music]'));
  function format(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  players.forEach(function (player) {
    var audio = player.querySelector('audio');
    var controls = player.querySelector('.post-music__controls');
    var play = player.querySelector('.post-music__play');
    var seek = player.querySelector('.post-music__seek');
    var mute = player.querySelector('.post-music__mute');
    var volume = player.querySelector('.post-music__volume');
    var current = player.querySelector('[data-music-current]');
    var total = player.querySelector('[data-music-duration]');
    var status = player.querySelector('.post-music__status');
    var statusText = player.querySelector('[data-music-status]');
    var fallback = player.querySelector('[data-music-fallback]');
    var pendingSeek = null;
    function message(text, failed) {
      statusText.textContent = text;
      status.hidden = !text;
      fallback.hidden = !failed;
    }
    function duration() {
      return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(player.dataset.duration);
    }
    function update() {
      var length = duration();
      var position = pendingSeek === null ? audio.currentTime : pendingSeek;
      player.dataset.playing = String(!audio.paused && !audio.ended && !audio.error);
      player.dataset.muted = String(audio.muted || audio.volume === 0);
      play.setAttribute('aria-label', audio.paused || audio.ended || audio.error ? '播放' : '暂停');
      mute.setAttribute('aria-label', audio.muted || audio.volume === 0 ? '取消静音' : '静音');
      mute.setAttribute('aria-pressed', String(audio.muted || audio.volume === 0));
      seek.max = length;
      seek.value = position;
      seek.style.setProperty('--progress', Math.min(100, position / length * 100) + '%');
      seek.setAttribute('aria-valuetext', format(position) + ' / ' + format(length));
      current.textContent = format(position);
      total.textContent = format(length);
      volume.value = audio.muted ? 0 : audio.volume;
    }
    play.addEventListener('click', function () {
      // WebKit may report paused=false even after media loading fails.
      // Handle the error before interpreting a click as a pause request.
      if (!audio.paused && !audio.error) { audio.pause(); return; }
      if (audio.error) audio.load();
      message('正在加载音频…', false);
      audio.play().catch(function (error) {
        if (error.name !== 'AbortError') message('音频暂时无法播放，请重试，或', true);
        else message('', false);
        update();
      });
    });
    seek.addEventListener('input', function () {
      var target = Number(seek.value);
      if (audio.readyState === 0) { pendingSeek = target; audio.load(); }
      else audio.currentTime = target;
      update();
    });
    mute.addEventListener('click', function () {
      if (audio.volume === 0) { audio.volume = 0.7; audio.muted = false; }
      else audio.muted = !audio.muted;
    });
    volume.addEventListener('input', function () { audio.volume = Number(volume.value); audio.muted = false; });
    audio.addEventListener('loadedmetadata', function () {
      if (pendingSeek !== null) { audio.currentTime = Math.min(pendingSeek, duration()); pendingSeek = null; }
      update();
    });
    audio.addEventListener('play', function () {
      players.forEach(function (other) { if (other !== player) other.querySelector('audio').pause(); });
      update();
    });
    audio.addEventListener('playing', function () { message('', false); });
    audio.addEventListener('waiting', function () { if (!audio.paused) message('正在加载音频…', false); });
    audio.addEventListener('pause', function () { if (!audio.error) message('', false); update(); });
    audio.addEventListener('error', function () { pendingSeek = null; message('音频暂时无法加载，请重试，或', true); update(); });
    ['timeupdate', 'durationchange', 'seeked', 'ended', 'volumechange'].forEach(function (event) { audio.addEventListener(event, update); });
    audio.volume = 0.7;
    update();
    controls.hidden = false;
    audio.hidden = true;
  });
})();
