/* AudioManager: un único <audio> montado en el shell, así la música sigue al cambiar de vista. */
window.Player = (function () {
  'use strict';
  var T = window.SITE.tracks, $ = function (s) { return document.getElementById(s); };
  var au = $('audio'), bar = $('player'), play = $('pPlay'), seek = $('pSeek'), cur = -1;
  function fmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function emit() { document.dispatchEvent(new CustomEvent('player:change')); }
  function show() { bar.hidden = false; document.body.classList.add('has-player'); }
  function hide() { bar.hidden = true; document.body.classList.remove('has-player'); }
  function fail() { $('pSub').textContent = 'No se pudo reproducir esta pista. Inténtalo de nuevo.'; }
  function load(i, autoplay) {
    cur = (i + T.length) % T.length; var t = T[cur];
    au.src = t.src; $('pTitle').textContent = String(t.n).padStart(2, '0') + ' · ' + t.title; $('pSub').textContent = 'La Suite del Buziraco';
    $('pDur').textContent = fmt(t.dur); $('pCur').textContent = '0:00'; seek.value = 0; show(); emit();
    if (autoplay) au.play().catch(fail);
  }
  function toggle() { if (cur < 0) load(0, true); else if (au.paused) au.play().catch(fail); else au.pause(); }
  function pause() { if (!au.paused) au.pause(); }
  play.addEventListener('click', toggle);
  $('pPrev').addEventListener('click', function () { load(cur < 0 ? 0 : cur - 1, !au.paused || cur < 0); });
  $('pNext').addEventListener('click', function () { load(cur + 1, !au.paused || cur < 0); });
  $('pClose').addEventListener('click', function () { au.pause(); au.removeAttribute('src'); cur = -1; hide(); emit(); });
  au.addEventListener('play', function () { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pausar'); emit(); });
  ['pause', 'ended'].forEach(function (ev) { au.addEventListener(ev, function () { play.textContent = '▶'; play.setAttribute('aria-label', 'Reproducir'); emit(); }); });
  au.addEventListener('ended', function () { if (cur < T.length - 1) load(cur + 1, true); });
  au.addEventListener('timeupdate', function () { if (au.duration) { seek.value = au.currentTime / au.duration * 100; $('pCur').textContent = fmt(au.currentTime); } });
  au.addEventListener('loadedmetadata', function () { $('pDur').textContent = fmt(au.duration); });
  au.addEventListener('error', function () { if (au.getAttribute('src')) fail(); });
  seek.addEventListener('input', function () { if (au.duration) au.currentTime = seek.value / 100 * au.duration; });
  au.volume = 0.8; $('pVol').addEventListener('input', function (e) { au.volume = e.target.value; });
  // Un solo medio a la vez: si arranca un video propio, la música se pausa
  document.addEventListener('play', function (e) { if (e.target !== au) pause(); }, true);
  return { load: load, toggle: toggle, pause: pause, fmt: fmt, current: function () { return cur; }, playing: function () { return !au.paused; } };
})();
