(function () {
  'use strict';
  var S = window.SITE, P = window.Player, root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view'), byKey = {}, order = S.items.map(function (i) { byKey[i.key] = i; return i.key; });

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function ext(href, text) { return el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', text: text }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function names(it) { return it.team ? S.teams[it.team].names : it.teamText; }
  function href(to) { return to.charAt(0) === '/' ? '#' + to : '#/objeto/' + to; }

  /* ---------- Modo simple ---------- */
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, simpleBtn = $('#simpleBtn'), live = $('#liveMsg');
  function setSimple(on, say) {
    root.classList.toggle('simple', on); simpleBtn.setAttribute('aria-pressed', String(on));
    simpleBtn.textContent = on ? 'Modo simple activado' : 'Modo simple';
    store('simple', on ? '1' : '0'); var bar = $('#simpleBar'); if (bar) bar.hidden = !on; if (say) live.textContent = on ? 'Modo simple activado. Se quitaron animaciones, texturas y sombras.' : 'Modo simple desactivado.';
  }
  setSimple(reduced || store('simple') === '1', false);
  $('#simpleOff').addEventListener('click', function () { setSimple(false, true); simpleBtn.focus(); });
  simpleBtn.addEventListener('click', function () { setSimple(!root.classList.contains('simple'), true); });

  /* ---------- Menú móvil ---------- */
  var menu = $('#mobileMenu'), menuBtn = $('#menuBtn');
  function setMenu(o) { menu.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', String(o)); }
  menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });

  /* ---------- Lector inmersivo (e-book y cómic originales en iframe) ---------- */
  var reader = $('#reader'), rFrame = $('#readerFrame'), rOpener = null, retryTimer = null;
  function openReader(app) {
    rOpener = document.activeElement; $('#readerTitle').textContent = app.title; rFrame.title = app.title;
    $('#readerOpen').href = app.src;
    // Calienta la caché de las ilustraciones y reintenta las que fallen por red, sin tocar el código del libro
    (app.warm || []).forEach(function (u) { new Image().src = u; });
    clearInterval(retryTimer); var tries = 0;
    rFrame.onload = function () {
      retryTimer = setInterval(function () {
        tries++; var d; try { d = rFrame.contentDocument; } catch (e) { return; }
        if (!d || tries > 40) return clearInterval(retryTimer);
        d.querySelectorAll('img').forEach(function (im) {
          if (!im.complete) im.loading = 'eager'; // pide ya las ilustraciones diferidas del libro
          else if (!im.naturalWidth && im.getAttribute('src')) { var b = im.getAttribute('src').split('?')[0]; im.src = b + '?r=' + tries; }
        });
      }, 700);
    };
    rFrame.src = app.src; reader.hidden = false; document.body.style.overflow = 'hidden'; $('#readerClose').focus();
  }
  function closeReader() { clearInterval(retryTimer); reader.hidden = true; rFrame.removeAttribute('src'); document.body.style.overflow = ''; if (rOpener) rOpener.focus(); }
  $('#readerClose').addEventListener('click', closeReader);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !reader.hidden && !$('#lightbox').open) closeReader(); });

  /* ---------- Visor de imágenes ---------- */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbList = [], lbI = 0;
  function lbShow(i) {
    lbI = (i + lbList.length) % lbList.length; lbImg.src = lbList[lbI].src; lbImg.alt = lbList[lbI].alt;
    $('#lbPrev').hidden = $('#lbNext').hidden = lbList.length < 2;
  }
  function openLightbox(list, i) { lbList = list; lbShow(i); if (!lb.open) lb.showModal(); }
  $('#lbPrev').addEventListener('click', function () { lbShow(lbI - 1); });
  $('#lbNext').addEventListener('click', function () { lbShow(lbI + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('[data-close]')) lb.close(); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') lbShow(lbI - 1); if (e.key === 'ArrowRight') lbShow(lbI + 1); });

  /* ---------- Lupa (modo inspección): acerca el detalle real de la imagen ---------- */
  var ZOOM = 2.6;
  function addLupa(host) {
    var on = false, btn = el('button', { type: 'button', 'class': 'tool', 'aria-pressed': 'false', text: 'Lupa apagada' });
    var bar = el('div', { 'class': 'lupa-bar' }, [btn, el('span', { 'class': 'piece-note', text: 'Enciende la lupa y pasa el cursor o arrastra el dedo sobre una imagen para ver el detalle. Con teclado, enfoca la imagen y usa las flechas.' })]);
    btn.addEventListener('click', function () {
      on = !on; btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Lupa encendida' : 'Lupa apagada'; host.classList.toggle('lupa-on', on);
      if (!on) host.querySelectorAll('.lens').forEach(function (l) { l.remove(); });
    });
    function show(b, x, y) {
      var r = b.getBoundingClientRect(), l = b.querySelector('.lens'), D = 150;
      if (!l) { l = el('div', { 'class': 'lens', 'aria-hidden': 'true' }); b.appendChild(l); }
      x = Math.max(0, Math.min(r.width, x)); y = Math.max(0, Math.min(r.height, y));
      l.style.backgroundImage = 'url("' + b.dataset.full + '")'; l.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
      l.style.left = (x - D / 2) + 'px'; l.style.top = (y - D / 2) + 'px'; l.style.backgroundPosition = (-(x * ZOOM - D / 2)) + 'px ' + (-(y * ZOOM - D / 2)) + 'px';
      b._lx = x; b._ly = y;
    }
    host.addEventListener('pointermove', function (e) { var b = e.target.closest('button[data-full]'); if (!on || !b) return; var r = b.getBoundingClientRect(); show(b, e.clientX - r.left, e.clientY - r.top); });
    host.addEventListener('pointerdown', function (e) { var b = e.target.closest('button[data-full]'); if (!on || !b) return; var r = b.getBoundingClientRect(); show(b, e.clientX - r.left, e.clientY - r.top); });
    host.addEventListener('pointerleave', function () { host.querySelectorAll('.lens').forEach(function (l) { l.remove(); }); }, true);
    host.addEventListener('focusin', function (e) { var b = e.target.closest('button[data-full]'); if (on && b) { var r = b.getBoundingClientRect(); show(b, b._lx || r.width / 2, b._ly || r.height / 2); } });
    host.addEventListener('keydown', function (e) {
      var b = e.target.closest('button[data-full]'); if (!on || !b) return; var st = 24, k = e.key, r = b.getBoundingClientRect(), x = b._lx || r.width / 2, y = b._ly || r.height / 2;
      if (k === 'ArrowLeft') x -= st; else if (k === 'ArrowRight') x += st; else if (k === 'ArrowUp') y -= st; else if (k === 'ArrowDown') y += st; else return;
      e.preventDefault(); show(b, x, y);
    });
    return bar;
  }
  function zoomBtn(im, label, list, i) {
    var b = el('button', { type: 'button', 'data-full': im.src, 'aria-label': label }, [el('img', { src: im.thumb || im.src, alt: im.alt, loading: 'lazy', decoding: 'async' })]);
    b.addEventListener('click', function () { openLightbox(list, i); }); return b;
  }

  /* ---------- Piezas ---------- */
  function ytSrc(kind, id) {
    var b = 'https://www.youtube-nocookie.com/embed/';
    return kind === 'list' ? b + 'videoseries?rel=0&autoplay=1&list=' + id : b + id + '?rel=0&autoplay=1';
  }
  function facade(title, label, thumb, build, film) {
    var box = el('div', { 'class': 'embed' + (film ? ' film' : '') });
    var b = el('button', { type: 'button', 'class': 'facade', 'aria-label': 'Reproducir ' + title }, [el('i', { 'aria-hidden': 'true', text: '▶' }), el('span', { 'class': 'facade-label', text: label })]);
    if (thumb) { b.classList.add('has-thumb'); b.insertBefore(typeof thumb === 'string' ? el('img', { src: thumb, alt: '', loading: 'lazy' }) : thumb, b.firstChild); }
    b.addEventListener('click', function () { P.pause(); box.replaceChildren(build()); });
    box.appendChild(b); return box;
  }
  function frame(src, title) {
    return el('iframe', { src: src, title: title, loading: 'lazy', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen' });
  }
  function noteAviso(text) { var p = el('p', { 'class': 'piece-note' }); p.appendChild(el('strong', { 'class': 'aviso-tag', text: 'Aviso' })); p.appendChild(document.createTextNode(' ' + text)); return p; }
  function plCover() {
    return el('div', { 'class': 'pl-cover', role: 'img', 'aria-label': 'Portada editorial de la playlist con las tres cruces, un sticker del universo y el título Playlist del Buziraco' }, [
      el('img', { 'class': 'pl-bg', src: 'assets/portadas/hero.webp', alt: '', 'aria-hidden': 'true' }), el('div', { 'class': 'pl-shade', 'aria-hidden': 'true' }),
      el('img', { 'class': 'pl-sticker', src: S.stickersWall[0].src, alt: '', 'aria-hidden': 'true' }),
      el('div', { 'class': 'pl-text', 'aria-hidden': 'true' }, [el('span', { 'class': 'pl-k', text: 'Playlist' }), el('strong', { text: 'del Buziraco' }), el('span', { 'class': 'pl-s', text: 'Salsa y otros ritmos de Cali' })])]);
  }

  function pieceYT(it) {
    var y = S.yt[it.yt], w = el('div');
    w.appendChild(facade(y.title, it.key === 'bts' ? 'Ver el rodaje' : 'Dale play', y.thumb, function () { return frame(ytSrc('video', y.id), y.title); }, it.film));
    w.appendChild(el('div', { 'class': 'piece-links' }, [ext(y.url, 'Verlo en YouTube'), el('span', { 'class': 'piece-note', text: 'Si no carga aquí, ábrelo directamente en YouTube.' })]));
    return w;
  }
  function piecePlaylist() {
    var w = el('div'), host = el('div'), tabs = el('div', { 'class': 'tabs', role: 'group', 'aria-label': 'Plataforma' }), y = S.yt.playlist, sp = S.yt.spotify;
    function show(k) {
      tabs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.w === k)); });
      host.replaceChildren(k === 'yt' ? facade(y.title, 'Escuchar en YouTube', 'assets/portadas/playlist.webp', function () { return frame(ytSrc('list', y.id), y.title); })
        : el('iframe', { 'class': 'spotify', src: 'https://open.spotify.com/embed/playlist/' + sp.id + '?theme=0', title: sp.title, loading: 'lazy', allow: 'encrypted-media; clipboard-write; fullscreen' }));
    }
    [['yt', 'En YouTube'], ['sp', 'En Spotify']].forEach(function (t) { var b = el('button', { type: 'button', 'data-w': t[0], text: t[1] }); b.addEventListener('click', function () { show(t[0]); }); tabs.appendChild(b); });
    w.appendChild(tabs); w.appendChild(host); show('yt');
    w.appendChild(el('div', { 'class': 'piece-links' }, [ext(y.url, 'Abrir en YouTube'), ext(sp.url, 'Abrir en Spotify')]));
    w.appendChild(el('p', { 'class': 'piece-note', text: 'Elige la plataforma que prefieras. Las canciones pertenecen a sus artistas y se escuchan desde YouTube o Spotify, que aplican sus propias condiciones de privacidad.' }));
    return w;
  }
  function pieceVideo(it) {
    var v = el('video', { controls: '', playsinline: '', preload: 'metadata', poster: it.video.poster, 'aria-label': it.title });
    v.appendChild(el('source', { src: it.video.src, type: 'video/mp4' }));
    return el('div', {}, [el('div', { 'class': 'embed' }, [v])]);
  }
  function pieceApp(it) {
    var a = it.app, b = el('button', { type: 'button', 'class': 'btn primary', text: a.open });
    b.addEventListener('click', function () { openReader(a); });
    return el('div', {}, [el('div', { 'class': 'actions' }, [b, ext(a.src, 'Abrir en otra pestaña')]), el('p', { 'class': 'piece-note', text: a.note })]);
  }
  function piecePending() {
    return el('div', { 'class': 'pending-box' }, [el('strong', { text: 'Próximamente' }),
      el('span', { text: 'El cortometraje todavía no se ha publicado. Cuando esté listo, podrás verlo en este mismo lugar.' }),
      el('div', { 'class': 'actions center' }, [el('a', { 'class': 'btn primary', href: '#/objeto/ebook', text: 'Conoce a Lucas antes del cortometraje' }), el('a', { 'class': 'btn', href: '#/objeto/bts', text: 'Conoce cómo se hizo' })])]);
  }
  function piecePosters(it) {
    var list = S.posters, wrap = el('div'), g = el('div', { 'class': 'gallery posters' });
    list.forEach(function (im, i) {
      var fig = el('figure', { 'class': 'poster-fig' }, [zoomBtn(im, 'Ampliar ' + im.cap, list, i),
        el('figcaption', {}, [el('h3', { text: im.cap }), el('p', { 'class': 'just', text: im.desc }), el('p', { 'class': 'just interp', text: im.interp }),
          el('p', { 'class': 'piece-note', text: 'Autoría de Juan Román y Sebastián Camacho.' }), el('a', { 'class': 'btn small', href: im.file, download: im.file.split('/').pop(), text: 'Descargar original (' + im.size + ')' })])]);
      g.appendChild(fig);
    });
    wrap.appendChild(addLupa(g)); wrap.appendChild(g); return wrap;
  }
  function pieceAlbum() {
    var w = el('div', { 'class': 'album-box' }), ul = el('ol', { 'class': 'tracks' });
    S.tracks.forEach(function (t, i) {
      var b = el('button', { type: 'button', 'aria-label': 'Reproducir pista ' + t.n + ', ' + t.title }, [el('span', { 'class': 'n', text: String(t.n).padStart(2, '0') }), el('b', { text: t.title }), el('em', { text: P.fmt(t.dur) })]);
      b.addEventListener('click', function () { P.current() === i ? P.toggle() : P.load(i, true); });
      var dl = el('a', { 'class': 'trk-dl', href: t.src, download: t.n + ' ' + t.title + '.mp3', 'aria-label': 'Descargar ' + t.title + ' en MP3', text: 'MP3 · ' + t.size });
      ul.appendChild(el('li', {}, [b, dl]));
    });
    function mark() { ul.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-current', String(i === P.current())); }); }
    document.addEventListener('player:change', mark); mark();
    w.appendChild(el('img', { 'class': 'album-cover', src: S.album.cover, alt: 'Portada de La Suite del Buziraco', width: 573, height: 574 }));
    w.appendChild(el('div', {}, [ul, el('p', { 'class': 'piece-note', text: 'La música sigue sonando mientras recorres el archivo. Se pausa si reproduces un video. El reproductor de abajo la controla desde cualquier página.' })]));
    return w;
  }

  /* Merchandising: familias de diseño, fotografías ampliables, packs y muro */
  function pieceMerch() {
    var w = el('div'), host = el('div', { 'class': 'merch-host' });
    S.merchFamilies.forEach(function (f) {
      var g = el('div', { 'class': 'gallery merch', style: '--cols:' + f.photos.length }), sec = el('section', { 'class': 'family' }, [el('h3', { text: f.title }), el('p', { 'class': 'family-k', text: f.shape }), el('p', { 'class': 'just', text: f.desc }), g]);
      var list = f.photos.map(function (n) { return { src: 'assets/merch/sticker-' + n + '.webp', thumb: 'assets/merch/sticker-' + n + '-thumb.webp', alt: S.merchPhotos[n] + '.', n: n }; });
      list.forEach(function (im, i) {
        var fig = el('figure', {}, [zoomBtn(im, 'Ampliar fotografía ' + im.n + '. ' + S.merchPhotos[im.n], list, i),
          el('figcaption', {}, [el('span', { text: S.merchPhotos[im.n] }), el('a', { href: 'descargas/stickers/Stickers-Las-cruces-que-cargamos-' + im.n + '.jpg', download: 'Stickers-Las-cruces-que-cargamos-' + im.n + '.jpg', text: 'Descargar' })])]);
        g.appendChild(fig);
      });
      host.appendChild(sec);
    });
    w.appendChild(addLupa(host)); w.appendChild(host);
    w.appendChild(pieceAttrib('Fotografías y diseños de ' + S.teams.found.names + '.'));
    w.appendChild(packs()); w.appendChild(pieceWall());
    return w;
  }
  function pieceAttrib(t) { return el('p', { 'class': 'piece-note', text: t }); }
  function packs() {
    var sec = el('section', { 'class': 'packs' }, [el('h2', { 'class': 'sub', text: 'Colecciones' }),
      el('p', { 'class': 'piece-note just', text: 'Los dos diseños se agrupan en tres colecciones. Por ahora se disfrutan como galería visual y como descarga. Si te interesa tener alguno, deja constancia con el botón de cada colección.' })]);
    var grid = el('div', { 'class': 'pack-grid' }), msg = el('p', { 'class': 'pack-msg', role: 'status', 'aria-live': 'polite' });
    [['Colección Las Tres Cruces', 'El sticker circular con las tres cruces y la figura alada.', 'assets/merch/sticker-cut.webp'], ['Colección El baile', 'El sticker rectangular con los tacones rojos y las patas con pezuñas.', 'assets/merch/sticker-rect-cut.webp'], ['Pack de los dos diseños', 'Un sticker circular y uno rectangular, cada uno con su diseño completo.', ['assets/merch/sticker-cut.webp', 'assets/merch/sticker-rect-cut.webp']]].forEach(function (p) {
      var act;
      if (S.contact) act = el('a', { 'class': 'btn', href: S.contact, text: 'Consultar disponibilidad' });
      else { act = el('button', { type: 'button', 'class': 'btn', text: 'Me interesa esta colección' }); act.addEventListener('click', function () { msg.textContent = 'Gracias por tu interés en «' + p[0] + '». Esta web aún no tiene un canal para pedir los stickers, así que este botón no envía datos. Cuando el equipo habilite una forma de contacto, aparecerá aquí.'; }); }
      grid.appendChild(el('div', { 'class': 'pack' }, [el('div', { 'class': 'pack-img' }, [].concat(p[2]).map(function (s) { return el('img', { src: s, alt: '', loading: 'lazy' }); })), el('h3', { text: p[0] }), el('p', { text: p[1] }), act]));
    });
    sec.appendChild(grid); sec.appendChild(msg); return sec;
  }
  /* Muro: elegir diseño, añadir, mover (puntero o dedo), girar, duplicar, eliminar, limpiar y guardar imagen */
  function pieceWall() {
    var w = el('div', { 'class': 'wall-wrap' }), board = el('div', { 'class': 'board', role: 'group', 'aria-label': 'Muro de stickers', tabindex: '-1' });
    var z = 1, n = 0, design = S.stickersWall[0], sel = null, palette = el('div', { 'class': 'palette', role: 'radiogroup', 'aria-label': 'Diseño del sticker' });
    var rotB, dupB, delB;
    S.stickersWall.forEach(function (d, i) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(i === 0), 'class': 'pal' }, [el('img', { src: d.src, alt: '' }), el('span', { text: d.name })]);
      b.addEventListener('click', function () { design = d; palette.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); }); }); palette.appendChild(b);
    });
    function select(s) { if (sel) sel.classList.remove('sel'); sel = s; if (s) { s.classList.add('sel'); s.style.zIndex = ++z; } [rotB, dupB, delB].forEach(function (b) { if (b) b.disabled = !s; }); }
    function make(d, left, top, rot) {
      n++; var s = el('div', { 'class': 'stk ' + d.cls, tabindex: '0', role: 'button', 'data-d': d.id, 'aria-label': 'Sticker ' + d.name + ' número ' + n + '. Flechas para mover, R para girar, D para duplicar, Supr para quitar.' }, [el('img', { src: d.src, alt: '', draggable: 'false' })]);
      s.style.left = left + 'px'; s.style.top = top + 'px'; s.dataset.rot = String(rot); s.style.transform = 'rotate(' + rot + 'deg)'; board.appendChild(s); select(s);
      var dx, dy;
      function move(x, y) { s.style.left = Math.max(0, Math.min(board.clientWidth - s.offsetWidth, x)) + 'px'; s.style.top = Math.max(0, Math.min(board.clientHeight - s.offsetHeight, y)) + 'px'; }
      s.addEventListener('pointerdown', function (e) { s.setPointerCapture(e.pointerId); select(s); dx = e.clientX - s.offsetLeft; dy = e.clientY - s.offsetTop; s.classList.add('drag'); });
      s.addEventListener('pointermove', function (e) { if (s.hasPointerCapture(e.pointerId)) move(e.clientX - dx, e.clientY - dy); });
      s.addEventListener('pointerup', function () { s.classList.remove('drag'); });
      s.addEventListener('focus', function () { select(s); });
      s.addEventListener('keydown', function (e) {
        var st = e.shiftKey ? 48 : 12, k = e.key;
        if (k === 'ArrowLeft') move(s.offsetLeft - st, s.offsetTop); else if (k === 'ArrowRight') move(s.offsetLeft + st, s.offsetTop);
        else if (k === 'ArrowUp') move(s.offsetLeft, s.offsetTop - st); else if (k === 'ArrowDown') move(s.offsetLeft, s.offsetTop + st);
        else if (k === 'r' || k === 'R') rotate(); else if (k === 'd' || k === 'D') dup(); else if (k === 'Delete' || k === 'Backspace') del(); else return;
        e.preventDefault();
      });
      return s;
    }
    function add() {
      var bw = board.clientWidth, bh = board.clientHeight; var s = make(design, Math.max(0, bw * (0.08 + Math.random() * 0.6)), Math.max(0, bh * (0.08 + Math.random() * 0.5)), Math.round((Math.random() - .5) * 40)); s.focus({ preventScroll: true });
    }
    function rotate() { if (!sel) return; sel.dataset.rot = String(+sel.dataset.rot + 15); sel.style.transform = 'rotate(' + sel.dataset.rot + 'deg)'; }
    function dup() { if (!sel) return; var d = S.stickersWall.filter(function (x) { return x.id === sel.dataset.d; })[0]; var s = make(d, Math.min(board.clientWidth - sel.offsetWidth, sel.offsetLeft + 28), Math.min(board.clientHeight - sel.offsetHeight, sel.offsetTop + 28), +sel.dataset.rot + 8); s.focus({ preventScroll: true }); }
    function del() { if (!sel) return; var s = sel; select(null); s.remove(); board.focus(); }
    function clear() { board.querySelectorAll('.stk').forEach(function (s) { s.remove(); }); n = 0; select(null); }
    function save() {
      var sc = 2, c = document.createElement('canvas'); c.width = board.clientWidth * sc; c.height = board.clientHeight * sc; var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, '#2a2f2c'); g.addColorStop(1, '#1b201d'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      [].slice.call(board.querySelectorAll('.stk')).forEach(function (s) {
        var im = s.querySelector('img'), cx = (s.offsetLeft + s.offsetWidth / 2) * sc, cy = (s.offsetTop + s.offsetHeight / 2) * sc;
        x.save(); x.translate(cx, cy); x.rotate(+s.dataset.rot * Math.PI / 180); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 10 * sc; x.drawImage(im, -s.offsetWidth * sc / 2, -s.offsetHeight * sc / 2, s.offsetWidth * sc, s.offsetHeight * sc); x.restore();
      });
      x.fillStyle = 'rgba(233,225,208,.85)'; x.font = (13 * sc) + 'px sans-serif'; x.fillText('Diseños de ' + S.teams.found.names + ' · Las cruces que cargamos, 2026', 14 * sc, c.height - 14 * sc);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'Mi-muro-Las-cruces-que-cargamos.png'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); });
    }
    function tb(label, fn, cls) { var b = el('button', { type: 'button', 'class': 'btn small' + (cls ? ' ' + cls : ''), text: label }); b.addEventListener('click', fn); return b; }
    var addB = tb('Pegar en el muro', add, 'primary'), clrB = tb('Limpiar el muro', clear), saveB = tb('Guardar imagen', save);
    rotB = tb('Girar', rotate); dupB = tb('Duplicar', dup); delB = tb('Quitar', del);
    [rotB, dupB, delB].forEach(function (b) { b.disabled = true; });
    board.addEventListener('pointerdown', function (e) { if (e.target === board) select(null); });
    w.appendChild(el('h2', { 'class': 'sub', text: 'Arma tu muro' }));
    w.appendChild(el('p', { 'class': 'piece-note just', text: 'Elige un diseño, pégalo en el muro y muévelo con el dedo o el ratón. Con teclado, enfoca un sticker y usa las flechas para moverlo, R para girarlo, D para duplicarlo y Supr para quitarlo. Puedes guardar tu composición como imagen y compartirla.' }));
    w.appendChild(palette); w.appendChild(el('div', { 'class': 'actions tight' }, [addB, rotB, dupB, delB, clrB, saveB])); w.appendChild(board);
    w.appendChild(pieceAttrib('Los diseños de los stickers son de ' + S.teams.found.names + '. La imagen guardada incluye esa atribución.'));
    return w;
  }
  function piece(it) {
    var k = it.kind;
    if (k === 'yt') return pieceYT(it); if (k === 'video') return pieceVideo(it); if (k === 'app') return pieceApp(it);
    if (k === 'pending') return piecePending(); if (k === 'gallery') return piecePosters(it); if (k === 'album') return pieceAlbum();
    if (k === 'playlist') return piecePlaylist(); if (k === 'merch') return pieceMerch();
    return el('div');
  }
  function downloads(it) {
    if (!it.downloads) return null;
    var ul = el('ul', { 'class': 'dl-list' });
    it.downloads.forEach(function (d) { ul.appendChild(el('li', {}, [el('a', { 'class': 'btn dl', href: d[1], download: d[2], text: d[0] }), el('span', { 'class': 'dl-size', text: d[3] })])); });
    return el('section', { 'class': 'downloads' }, [el('h2', { 'class': 'sub', text: 'Descargas' }), ul,
      el('p', { 'class': 'piece-note just', text: 'Autoría de ' + names(it) + '. Los autores autorizan la descarga con la condición de que se reconozca su autoría. No incluye redistribución comercial ni modificación por terceros. Los paquetes traen un documento de créditos y derechos.' })]);
  }
  function crew() {
    var d = el('details', { 'class': 'crew', open: '' }, [el('summary', { text: 'Ficha técnica y equipo' })]), grid = el('div', { 'class': 'crew-grid' });
    S.crew.forEach(function (dep) {
      var dl = el('dl'); dep.roles.forEach(function (r) { if (r[0]) dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1].join(', ') })); });
      grid.appendChild(el('div', { 'class': 'dept' }, [el('h3', { text: dep.dept }), dl]));
    });
    d.appendChild(grid); return d;
  }

  /* ---------- Vistas ---------- */
  function card(it) {
    var art = el('div', { 'class': 'art' + (it.fit === 'contain' ? ' contain' : '') });
    if (it.playlistCover) art.appendChild(plCover());
    else if (it.fit === 'contain') { art.appendChild(el('img', { 'class': 'bg', src: it.cover, alt: '', loading: 'lazy', 'aria-hidden': 'true' })); art.appendChild(el('img', { 'class': 'fg', src: it.cover, alt: '', loading: 'lazy', decoding: 'async' })); }
    else if (it.cover) art.appendChild(el('img', { src: it.cover, alt: '', loading: 'lazy', decoding: 'async', style: 'object-position:' + it.pos }));
    var row = el('div', { 'class': 'row' }, [el('span', { 'class': 'card-type', text: it.type }), el('span', { 'class': it.kind === 'pending' ? 'chip' : 'n', text: it.kind === 'pending' ? 'Próximamente' : it.num })]);
    return el('article', { 'class': 'obj', 'data-group': it.group, style: '--w:' + it.w + ';--h:' + it.h + 'px' }, [art,
      el('div', { 'class': 'obj-body' }, [row, el('h3', {}, [el('a', { href: '#/objeto/' + it.key, text: it.title })]), el('p', { 'class': 'hook', text: it.hook }), el('span', { 'class': 'go', 'aria-hidden': 'true', text: it.cta })])]);
  }
  var views = {};
  views.home = function () {
    var d = el('div');
    d.innerHTML = '<section class="hero"><div class="visual" aria-hidden="true"><img src="assets/portadas/hero.webp" alt="" fetchpriority="high" decoding="async"><div class="shadow"></div></div>' +
      '<div class="hero-content"><p class="kicker micro">Una ficción de Cali</p><h1>Las cruces<br>que <em>cargamos</em></h1>' +
      '<p class="hero-summary">Desde la ciudad se ven tres cruces sobre el cerro. Lo que se cuenta de ellas cambia con cada voz. Aquí encuentras un cuento, un cómic, un pódcast, una grabación, música y objetos del universo del Buziraco.</p>' +
      '<div class="actions"><a class="btn primary arr" href="#/archivo">Abrir el archivo</a><a class="btn" href="#/universo">Conocer la leyenda</a></div>' +
      '<p class="status">El cortometraje todavía no se estrena</p></div></section>' +
      '<section class="section"><div class="wrap narrow"><p class="micro eyebrow">La leyenda</p><h2>Sobre el cerro, <em>tres cruces</em></h2><p class="lead">Bajo la rutina de Cali hay una historia que cambia con cada voz.</p>' +
      '<p class="bodycopy just">El Buziraco es una figura del folclore caleño y las Tres Cruces son el monumento que vigila la ciudad. Con ambos, varios equipos construyeron una ficción de terror. Hay un libro que empieza en la voz de una abuela, un pódcast con alguien que no sabe explicar lo que vivió, una grabación de tres amigas en un parque, un cómic, una suite musical y unos cuantos objetos. Puedes entrar por la pieza que quieras.</p></div></section>' +
      '<section class="section alt"><div class="wrap"><p class="micro eyebrow">Cuatro piezas para entrar</p><h2>Por dónde <em>empezar</em></h2><div class="obj-grid" id="featGrid"></div>' +
      '<p class="center-link"><a class="btn arr" href="#/archivo">Ver las diez piezas</a></p></div></section>';
    var g = d.querySelector('#featGrid'); ['corto', 'ebook', 'album', 'comic'].forEach(function (k) { var c = card(byKey[k]); c.style.setProperty('--w', 6); c.style.setProperty('--h', '320px'); g.appendChild(c); });
    return { node: d, title: 'Inicio' };
  };
  function archive(filter, heading, eyebrow, intro) {
    var d = el('div'); d.innerHTML = '<section class="section"><div class="wrap"><p class="micro eyebrow">' + eyebrow + '</p><h1 class="h-xl">' + heading + '</h1><p class="bodycopy">' + intro + '</p>' +
      '<div class="archive-controls" role="group" aria-label="Filtrar piezas"></div><p class="sr-only" id="fstat" role="status" aria-live="polite"></p><div class="obj-grid" id="grid"></div></div></section>';
    var ctl = d.querySelector('.archive-controls'), grid = d.querySelector('#grid');
    S.items.forEach(function (it) { grid.appendChild(card(it)); });
    [['archivo', 'Todo'], ['historias', 'Las historias'], ['detras', 'Detrás del universo']].forEach(function (f) { ctl.appendChild(el('a', { href: '#/' + f[0], 'aria-current': String(f[0] === filter), text: f[1] })); });
    var n = 0; grid.querySelectorAll('.obj').forEach(function (c) { var h = filter !== 'archivo' && c.dataset.group !== filter; c.hidden = h; if (!h) n++; });
    d.querySelector('#fstat').textContent = n + ' piezas mostradas';
    return d;
  }
  views.archivo = function () { return { node: archive('archivo', 'Todo lo que <em>cargamos</em>', 'El archivo', 'Diez piezas, ninguna obligatoria. Cada una se puede leer, ver o escuchar sin salir de la página.'), title: 'Archivo' }; };
  views.historias = function () { return { node: archive('historias', 'Las <em>historias</em>', 'Seis maneras de entrar', 'La obra central y las voces que la rodean. Un libro, un pódcast, un metraje, un cómic y una suite.'), title: 'Historias' }; };
  views.detras = function () { return { node: archive('detras', 'Detrás <em>del universo</em>', 'Lo que quedó fuera de cuadro', 'Cómo se hizo el cortometraje, los afiches, los stickers y la música que suena en la ciudad donde todo ocurre.'), title: 'Detrás del universo' }; };
  views.universo = function () {
    var d = el('div'); d.innerHTML = '<section class="section"><div class="wrap"><p class="micro eyebrow">El universo</p><h1 class="h-xl">La leyenda <em>persiste</em></h1><div class="intro-grid"><div>' +
      '<p class="lead">Sobre el cerro, tres cruces. Bajo la rutina de Cali, una historia que cambia con cada voz.</p>' +
      '<p class="bodycopy just">Todo parte del mito caleño del Buziraco y de las Tres Cruces. De ahí nace una ficción de terror urbano donde caben la fe, la memoria oral, la vida cotidiana y esas cosas que nadie sabe explicar del todo. Lo que ves aquí es una obra inventada, no un documento histórico, y cada pieza la cuenta a su manera.</p>' +
      '<div class="actions"><a class="btn primary arr" href="#/archivo">Abrir el archivo</a></div></div>' +
      '<dl class="facts side"><dt>Obra central</dt><dd>Las cruces que cargamos</dd><dt>Género</dt><dd>Terror sobrenatural y folclore urbano</dd><dt>Para recorrer</dt><dd>Un libro, un pódcast, un metraje, un cómic, una suite y objetos del universo</dd><dt>Cómo</dt><dd>En el orden que quieras</dd></dl></div></div></section>' +
      '<section class="section alt"><div class="wrap"><p class="micro eyebrow">Caminos posibles</p><h2>Una pieza lleva <em>a otra</em></h2><div class="bridge-grid">' +
      '<div class="bridge"><small>Por la memoria</small><h3>La abuela que contaba</h3><p>Empieza con Lucas de niño y las historias que Elvira no terminó.</p><a class="arrow-link" href="#/objeto/ebook">Leer El primer pacto</a></div>' +
      '<div class="bridge"><small>Por el misterio</small><h3>Lo que no se explica</h3><p>Una conversación, una grabación y un cómic. Tres miradas que no tienen por qué coincidir.</p><a class="arrow-link" href="#/objeto/podcast">Ver Cali en tinieblas</a></div>' +
      '<div class="bridge"><small>Por el oído</small><h3>La ciudad suena</h3><p>La música original del Buziraco y las canciones que acompañan la noche caleña.</p><a class="arrow-link" href="#/objeto/album">Escuchar La Suite del Buziraco</a></div>' +
      '<div class="bridge"><small>Por el rodaje</small><h3>Detrás de la cámara</h3><p>Del set a los afiches y a los stickers que salieron de la pantalla.</p><a class="arrow-link" href="#/objeto/bts">Ver cómo se hizo</a></div></div></div></section>';
    return { node: d, title: 'El universo' };
  };
  var ext_blocks = [['pod', 'Videopodcast y detrás de cámaras', ['podcast', 'bts'], 'b-wide'], ['found', 'Found footage y merchandising', ['found', 'merch'], ''], ['comic', 'Cómic y pósters', ['comic', 'posters'], 'r'],
    ['ebook', 'E-book e integración web', ['ebook'], 'b-wide'], ['album', 'Álbum musical y playlist', ['album', 'playlist'], '']];
  views.creditos = function () {
    var d = el('div'), h = '';
    ext_blocks.forEach(function (b) {
      var links = b[2].map(function (k) { return '<a href="#/objeto/' + k + '">' + byKey[k].title + '</a>'; }).join('') + (b[0] === 'ebook' ? '<span>Página web e integración transmedia</span>' : '');
      h += '<div class="cr ' + b[3] + '"><p class="micro">' + b[1] + '</p><p class="cr-names">' + S.teams[b[0]].names + '</p><p class="cr-works">' + links + '</p>' +
        (b[0] === 'ebook' ? '<p class="cr-note">Ilustraciones generadas con IA, orquestadas por Juan José Arango y Carlos Escobar.</p>' : '') + '</div>';
    });
    d.innerHTML = '<section class="section"><div class="wrap"><p class="micro eyebrow">Créditos</p><h1 class="h-xl">Quiénes cargaron <em>las cruces</em></h1>' +
      '<p class="bodycopy just">Cada pieza tiene a su equipo. Estas son las personas que hicieron posible la obra central y cada una de sus extensiones.</p>' +
      '<h2 class="sub cr-head">La obra central, <em>Las cruces que cargamos</em></h2><div id="crewHost"></div>' +
      '<h2 class="sub cr-head">Las extensiones transmedia</h2><div class="cr-grid">' + h + '</div>' +
      '<div class="cr-extra"><h2 class="sub">Créditos y notas</h2><dl class="facts"><dt>Música de la playlist</dt><dd>Pertenece a sus artistas y se escucha desde las plataformas oficiales.</dd><dt>Tipografías</dt><dd>Lora e Inter, con licencia libre SIL OFL.</dd><dt>Ficción</dt><dd>Todo lo que ves en esta web es una obra inventada.</dd></dl></div></div></section>';
    d.querySelector('#crewHost').appendChild(crew());
    return { node: d, title: 'Créditos' };
  };
  function facts(it) {
    var rows = [['Formato', it.format], ['Autoría', names(it)]].concat(it.extra || []).concat([['Estado', it.state]]);
    return '<dl class="facts">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl><a class="small-link" href="#/creditos">Ver todos los créditos</a>';
  }
  views.objeto = function (key) {
    var it = byKey[key]; if (!it) return views.archivo();
    var i = order.indexOf(key), prev = byKey[order[(i + 9) % 10]], next = byKey[order[(i + 1) % 10]], L = it.layout;
    var head = '<p class="micro">' + it.type + '</p><h1 class="h-xl" tabindex="-1">' + it.title + '</h1><p class="subtitle">' + it.sub + '</p><p class="hook-lead">' + it.hook + '</p>' + (it.find ? '<p class="find"><strong>Qué vas a encontrar.</strong> ' + it.find + '</p>' : '');
    var syn = '<div class="syn"><p class="just">' + it.synopsis + '</p></div>';
    var coverInner = it.playlistCover ? '<div id="plc"></div>' : (it.cover ? '<img src="' + it.cover + '" alt="Portada de ' + it.title + '" decoding="async">' : '');
    var cover = '<figure class="obj-cover' + (it.playlistCover ? ' pl' : '') + '">' + coverInner + '</figure>';
    var pieceSec = '<section class="obj-piece"><h2 class="sub">' + it.pieceTitle + '</h2><div id="piece"></div></section>';
    var body, crewSec = it.key === 'corto' ? '<div id="crewSlot"></div>' : '';
    if (L === 'video') body = '<header class="obj-head">' + head + '</header><section class="obj-piece wide"><div id="piece"></div></section><div class="two-col">' + syn + '<div>' + facts(it) + '</div></div><div id="dl"></div>';
    else if (L === 'visual') body = '<header class="obj-head">' + head + '</header>' + pieceSec.replace('obj-piece', 'obj-piece wide') + '<div id="preview"></div><div class="two-col">' + syn + '<div>' + facts(it) + '</div></div><div id="dl"></div>';
    else if (L === 'music') body = '<div class="music"><div class="music-info">' + head + syn + facts(it) + '</div><div class="music-play" id="piece"></div></div><div id="dl"></div>';
    else if (it.mergeSyn) body = '<div class="obj-hero merge' + (it.key === 'playlist' ? ' keep' : '') + '">' + cover + '<div>' + head + facts(it) + '</div></div>' + pieceSec + '<div id="preview"></div><div id="dl"></div>';
    else body = '<div class="obj-hero">' + cover + '<div>' + head + facts(it) + '</div></div>' + syn + pieceSec + '<div id="preview"></div>' + crewSec + '<div id="dl"></div>';
    var also = (it.also || []).map(function (a) { return '<a class="arrow-link also" href="' + href(a.to) + '">' + a.label + '</a>'; }).join('');
    var d = el('div'); d.innerHTML = '<article class="section obj-page lay-' + L + '"><div class="wrap"><a class="back" href="#/archivo">Volver al archivo</a>' + body +
      '<div class="cta"><p class="micro">Sigue por aquí</p><a class="cta-link" href="' + href(it.next.to) + '">' + it.next.label + '</a>' + also + '</div>' +
      '<nav class="obj-nav" aria-label="Otras piezas"><a href="#/objeto/' + prev.key + '"><small>Anterior</small>' + prev.title + '</a><a href="#/objeto/' + next.key + '"><small>Siguiente</small>' + next.title + '</a></nav></div></article>';
    var pc = d.querySelector('#piece'); pc.appendChild(piece(it));
    if (it.fiction) pc.appendChild(noteAviso(it.fiction));
    var plc = d.querySelector('#plc'); if (plc) plc.replaceWith(plCover());
    var slot = d.querySelector('#crewSlot'); if (slot) slot.appendChild(crew());
    var dl = downloads(it); if (dl) d.querySelector('#dl').appendChild(dl);
    if (it.preview) {
      var list = it.preview.map(function (s, n) { return { src: s, alt: it.previewAlt + ' ' + (n + 1) + ' de ' + it.preview.length }; });
      var g = el('div', { 'class': 'gallery strip' }); list.forEach(function (im, n) { g.appendChild(zoomBtn(im, 'Ampliar vista previa ' + (n + 1), list, n)); });
      d.querySelector('#preview').append(el('h2', { 'class': 'sub', text: it.previewTitle }), addLupa(g), g);
    }
    return { node: d, title: it.title, focus: 'h1' };
  };

  /* ---------- Router por hash ---------- */
  function route() {
    var h = (location.hash || '#/').replace(/^#\/?/, ''), p = h.split('/'), name = p[0] || 'home', r;
    if (lb.open) lb.close(); if (!reader.hidden) closeReader(); setMenu(false);
    r = (views[name] || views.home)(p[1]);
    view.replaceChildren(r.node);
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    document.title = (name === 'home' ? '' : r.title + ' · ') + 'Las cruces que cargamos';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.setAttribute('aria-current', String(a.dataset.nav === name)); });
    window.scrollTo(0, 0);
    var f = r.focus && view.querySelector(r.focus); (f || view).focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  route();
})();
