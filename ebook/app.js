/* El primer pacto · lector digital
   - Pagina el manuscrito en el navegador, midiendo el texto real: ninguna página
     necesita scroll y no se pierde ni se altera ninguna palabra.
   - Coloca las nueve ilustraciones completas junto a su pasaje; admite pliegos de texto + texto, nunca dos ilustraciones enfrentadas.
   - Libro con StPageFlip si la librería carga; si no, modo alternativo con la misma navegación.
   - Modo lectura continua y vista de impresión para guardar en PDF. */
(function () {
  'use strict';
  const D = window.CUENTO;
  if (!D) throw new Error('Falta contenido/contenido.js');

  const $ = (id) => document.getElementById(id);
  const mount = $('book'), statusEl = $('pageStatus'), prevBtn = $('prevPage'), nextBtn = $('nextPage');
  const modeBtn = $('switchMode'), coverBtn = $('goCover'), pdfBtn = $('savePdf');
  const flipStage = $('flipStage'), readStage = $('continuousStage'), pager = $('pager');
  const loadingEl = $('loading'), noticeEl = $('notice'), printStage = $('printStage');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const CROSSES = '<svg viewBox="0 0 44 20" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 7v12M4.6 10.4h6.8"/><path d="M22 2v17M17.4 6.4h9.2"/><path d="M36 7v12M32.6 10.4h6.8"/></g></svg>';
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  const report = { overflowFixed: [], fontLoaded: null, engine: 'pendiente' };
  const state = { pages: [], index: 0, flip: null, landscape: true, mode: 'book', ready: false };

  /* ---------------- Texto: palabras con cursiva preservada ---------------- */
  // Divide un párrafo en palabras (separadas por un espacio) y conserva las cursivas (*…*)
  // aunque un fragmento empiece o termine dentro de ellas. Unir los fragmentos con ' '
  // reproduce exactamente el párrafo original.
  function tokenize(par) {
    let em = false;
    return par.split(' ').map((word) => {
      let html = '', run = '';
      const flush = () => { if (run) { html += em ? '<em>' + esc(run) + '</em>' : esc(run); run = ''; } };
      for (const ch of word) { if (ch === '*') { flush(); em = !em; } else run += ch; }
      flush();
      return html;
    });
  }
  const TOK = D.chapters.map((c) => c.paragraphs.map(tokenize));
  const chapterParts = (title) => { const m = /^([IVX]+)\.\s*(.*)$/.exec(title); return m ? { num: m[1], name: m[2] } : { num: '', name: title }; };

  /* ---------------- HTML de cada tipo de página ---------------- */
  function textSheet(pg, num) {
    const cp = chapterParts(D.chapters[pg.chapter].title);
    const head = pg.opener
      ? `<div class="opener"><span class="ch-num">Capítulo ${cp.num}</span><h2>${esc(cp.name)}</h2><span class="rule"></span></div>`
      : `<div class="running-head">${esc(cp.name)}</div>`;
    const body = pg.segs.map((s) => `<p class="${s.cls}">${TOK[pg.chapter][s.p].slice(s.from, s.to).join(' ')}</p>`).join('');
    return `<div class="sheet text-sheet">${head}<div class="prose">${body}</div><div class="folio">${CROSSES}<span class="num">${num}</span></div></div>`;
  }
  // Ilustración a página completa, una sola vez. V6: las tres de otra proporción (desaparicion, regreso, cada_dia) también van a sangre, igual que las demás.
  function plateSheet(pl, eager) {
    const im = D.illustrations[pl.image];
    const ar = im.width / im.height, loading = eager ? 'eager' : 'lazy';
    const credit = `<p class="ai-credit">${esc(D.aiCredit)}</p>`;
    const img = `<img src="${im.src}" alt="${esc(pl.alt)}" loading="${loading}" decoding="async" draggable="false">`;
    if (true) return `<div class="sheet plate-sheet bleed">${img}${credit}</div>`;
    return `<div class="sheet plate-sheet mat"><div class="frame whole" style="--ar:${ar.toFixed(4)}">${img}</div>${credit}</div>`;
  }
  function coverSheet(eager) {
    const im = D.illustrations.portada;
    return `<div class="sheet cover-sheet"><img src="${im.src}" alt="${esc(im.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false"></div>`;
  }
  function dedicationParts() {
    // Bloques: título, nombres, párrafos…, fórmula de cierre, firma.
    const L = D.dedication.trim().split(/\n\n+/);
    return { title: L[0], names: L[1], paras: L.slice(2, L.length - 2), closing: L[L.length - 2], signature: L[L.length - 1] };
  }
  function dedicationSheet() {
    const d = dedicationParts();
    return `<div class="sheet matter-sheet"><h2 class="ded-title">${esc(d.title)}</h2><p class="ded-names">${esc(d.names)}</p>${d.paras.map((p) => `<p class="ded-p">${inline(p)}</p>`).join('')}<p class="ded-sign">${esc(d.closing)}<span>${esc(d.signature)}</span></p></div>`;
  }
  function tocEntries() {
    const out = [];
    D.chapters.forEach((c, ci) => { const i = state.pages.findIndex((p) => p.type === 'text' && p.chapter === ci); const cp = chapterParts(c.title); out.push({ num: cp.num, name: cp.name, index: i }); });
    out.push({ num: '', name: 'Créditos', index: state.pages.findIndex((p) => p.type === 'credits') });
    return out;
  }
  function tocSheet() {
    const li = tocEntries().map((e) => `<li><button type="button" data-goto="${e.index}"><span class="t">${e.num ? `<b>${e.num}.</b>` : ''}${esc(e.name)}</span><span class="dots"></span><span class="n">${e.index + 1}</span></button></li>`).join('');
    return `<div class="sheet matter-sheet toc-sheet"><h2 class="toc-title">Índice</h2><ol class="toc">${li}</ol></div>`;
  }
  function creditsSheet() {
    const items = D.credits.map((c) => (c.label ? `<dt>${esc(c.label)}</dt>` : '') + `<dd>${inline(c.text)}</dd>`).join('');
    return `<div class="sheet matter-sheet credits-sheet"><h2 class="credits-title">${esc(D.title)}</h2><dl>${items}</dl>${CROSSES.replace('<svg ', '<svg class="crosses" ')}</div>`;
  }
  // Contraportada exterior: misma ilustración de la portada sin título ni autores, con la sinopsis.
  function backCoverSheet(eager) {
    const im = D.illustrations.contraportada;
    return `<div class="sheet backcover-sheet"><img src="${im.src}" alt="${esc(im.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false"><div class="synopsis"><p>${inline(D.synopsis)}</p></div><p class="ai-credit">${esc(D.aiCredit)}</p></div>`;
  }
  // Guarda: página en blanco que solo aparece si hace falta para que la contraportada quede sola al cerrar el libro.
  function endpaperSheet() { return `<div class="sheet endpaper-sheet">${CROSSES.replace('<svg ', '<svg class="crosses" ')}</div>`; }
  function sheetFor(pg, i, eager) {
    switch (pg.type) {
      case 'cover': return coverSheet(eager);
      case 'dedication': return dedicationSheet();
      case 'toc': return tocSheet();
      case 'text': return textSheet(pg, i + 1);
      case 'plate': return plateSheet(pg.plate, eager);
      case 'backcover': return backCoverSheet(true);
      case 'endpaper': return endpaperSheet();
      default: return creditsSheet();
    }
  }
  function labelFor(pg) {
    if (pg.type === 'text') return chapterParts(D.chapters[pg.chapter].title).name;
    if (pg.type === 'plate') return 'Ilustración';
    return { cover: 'Portada', dedication: 'Dedicatoria', toc: 'Índice', credits: 'Créditos', endpaper: 'Guarda', backcover: 'Contraportada' }[pg.type];
  }

  /* ---------------- Paginación medida ---------------- */
  // Mide el texto real en una página de prueba (las medidas internas son proporcionales,
  // así que el resultado vale para cualquier tamaño de pantalla y para la impresión).
  function makeProbe() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;pointer-events:none';
    const probe = document.createElement('div');
    probe.className = 'page';
    probe.style.cssText = 'width:600px;height:900px';
    host.appendChild(probe); document.body.appendChild(host);
    return { host, probe };
  }
  const MIN_TAIL = 9; // palabras mínimas que pasan a la página siguiente (evita una línea viuda)

  // Pagina un capítulo llenando cada caja de texto hasta la fracción `fill` de su altura.
  // Los cortes dentro de un párrafo caen siempre al final de una línea completa.
  // `fillAt(i)` permite llenar menos una página concreta (se usa para equilibrar el final del capítulo).
  function paginateChapter(probe, ci, fillAt) {
    let prose = null, limit = 0;
    const pages = [];
    const open = (pg) => { probe.innerHTML = textSheet({ ...pg, segs: [] }, 99); prose = probe.querySelector('.prose'); limit = prose.clientHeight * fillAt(pages.length); };
    const bottom = () => { const last = prose.lastElementChild; return last ? last.getBoundingClientRect().bottom - prose.getBoundingClientRect().top : 0; };
    const fits = () => bottom() <= limit;
    let pg = { type: 'text', chapter: ci, opener: true, segs: [] }; open(pg);
    TOK[ci].forEach((toks, pi) => {
      let start = 0;
      while (start < toks.length) {
        const cls = pi === 0 || start > 0 ? 'noindent' : 'indent';
        const p = document.createElement('p'); p.className = cls + ' split';
        p.innerHTML = toks.slice(start).join(' ');
        prose.appendChild(p);
        if (fits()) { p.className = cls; pg.segs.push({ p: pi, from: start, to: toks.length, cls }); break; }
        // Mayor cantidad de palabras que cabe…
        let lo = start, hi = toks.length - 1;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); p.innerHTML = toks.slice(start, mid).join(' '); if (fits()) lo = mid; else hi = mid - 1; }
        // …y comienzos de línea dentro de ese tramo (más la palabra siguiente para saber si la última línea quedó llena).
        const upto = Math.min(lo + 1, toks.length);
        p.innerHTML = toks.slice(start, upto).map((t, k) => `<span data-k="${start + k}">${t}</span>`).join(' ');
        const starts = []; let prevBottom = -Infinity;
        p.querySelectorAll('span').forEach((sp) => {
          const rs = sp.getClientRects(); if (!rs.length) return;
          if (rs[0].top >= prevBottom - 1) starts.push(+sp.dataset.k);
          prevBottom = rs[rs.length - 1].bottom;
        });
        // Corte = comienzo de la última línea que entra completa, dejando al menos dos líneas aquí y MIN_TAIL palabras después.
        const candidates = starts.filter((k) => k <= lo && k > start && toks.length - k >= MIN_TAIL);
        const cut = candidates.length >= 2 || (candidates.length === 1 && starts.indexOf(candidates[0]) >= 2) ? candidates[candidates.length - 1] : -1;
        if (cut < 0) {
          prose.removeChild(p);
          if (!pg.segs.length) throw new Error('Un párrafo no cabe en una página vacía');
        } else {
          p.innerHTML = toks.slice(start, cut).join(' ');
          pg.segs.push({ p: pi, from: start, to: cut, cls: cls + ' split' });
          start = cut;
        }
        pages.push(pg); pg = { type: 'text', chapter: ci, opener: false, segs: [] }; open(pg);
      }
    });
    // Re-dibuja la última página para medir cuánto se llenó.
    probe.innerHTML = textSheet(pg, 99); prose = probe.querySelector('.prose');
    const lastFill = bottom() / prose.clientHeight;
    pages.push(pg);
    return { pages, lastFill };
  }

  function paginate() {
    const { host, probe } = makeProbe();
    const all = [];
    D.chapters.forEach((c, ci) => {
      const FULL = 0.975;
      let res = paginateChapter(probe, ci, () => FULL);
      const raw = res.lastFill;
      // Si la última página del capítulo quedaría casi vacía, se pasan líneas de la penúltima
      // a la última para que ambas queden parejas (las demás páginas no cambian).
      if (res.pages.length > 1 && res.lastFill < 0.35) {
        const k = res.pages.length, target = (FULL + res.lastFill) / 2;
        const r = paginateChapter(probe, ci, (i) => (i === k - 2 ? target : FULL));
        if (r.pages.length === k) res = r;
      }
      report.chapterBalance = report.chapterBalance || [];
      report.chapterBalance.push({ chapter: ci + 1, pages: res.pages.length, lastFillBefore: +raw.toFixed(2), lastFill: +res.lastFill.toFixed(2) });
      all.push(...res.pages);
    });
    host.remove();
    return all.map((pg) => ({ ...pg, first: pg.segs[0].p, last: pg.segs[pg.segs.length - 1].p }));
  }

  // Cada ilustración va justo después de la página de texto que contiene su pasaje (anchor).
  // Nunca dos ilustraciones seguidas: así no quedan enfrentadas y se admiten pliegos de texto + texto.
  function buildModel() {
    const texts = paginate();
    const pages = [{ type: 'cover' }, { type: 'dedication' }, { type: 'toc' }];
    D.chapters.forEach((c, ci) => {
      const tp = texts.filter((p) => p.chapter === ci);
      const pending = D.plates.filter((p) => p.chapter === ci).sort((a, b) => a.anchor - b.anchor);
      tp.forEach((p, i) => {
        pages.push(p);
        if (pending.length && (pending[0].anchor <= p.last || i === tp.length - 1)) pages.push({ type: 'plate', chapter: ci, plate: pending.shift() });
      });
      // Reserva: si quedaran ilustraciones del capítulo, se intercalan entre sus páginas de texto sin juntar dos láminas.
      while (pending.length) {
        const pl = pending.shift();
        for (let k = pages.length - 1; k > 3; k--) {
          if (pages[k].type === 'text' && pages[k].chapter === ci && (!pages[k + 1] || pages[k + 1].type !== 'plate')) { pages.splice(k + 1, 0, { type: 'plate', chapter: ci, plate: pl }); break; }
        }
      }
    });
    pages.push({ type: 'credits' });
    // La contraportada debe quedar sola al cerrar el libro: el total de páginas ha de ser par.
    if ((pages.length + 1) % 2 === 1) pages.push({ type: 'endpaper' });
    pages.push({ type: 'backcover' });
    return pages;
  }

  /* ---------------- Ajuste de seguridad: nunca texto oculto ---------------- */
  function fitPage(el) {
    const prose = el && el.querySelector('.prose, .synopsis');
    if (!prose || !prose.clientHeight) return;
    let f = 1; prose.style.removeProperty('--fit');
    while (prose.scrollHeight > prose.clientHeight + 1 && f > 0.84) { f -= 0.02; prose.style.setProperty('--fit', f.toFixed(2)); }
    if (f < 1) report.overflowFixed.push({ page: el.dataset.page, fit: +f.toFixed(2) });
  }

  /* ---------------- Construcción del libro ---------------- */
  function buildPageEls(target, eagerAll, skip) {
    const frag = document.createDocumentFragment();
    state.pages.forEach((pg, i) => {
      if (skip && skip.includes(pg.type)) return;
      const el = document.createElement('div');
      el.className = 'page page-' + pg.type;
      el.dataset.page = i + 1;
      if (i === 0 || i === state.pages.length - 1) el.dataset.density = 'hard';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', `Página ${i + 1}: ${labelFor(pg)}`);
      el.innerHTML = sheetFor(pg, i, eagerAll || i < 6);
      frag.appendChild(el);
    });
    target.appendChild(frag);
    return [...target.querySelectorAll(':scope > .page')];
  }

  const count = () => state.pages.length;
  function current() {
    if (state.flip) { try { return state.flip.getCurrentPageIndex(); } catch (e) { /* sin cambios */ } }
    return state.index;
  }
  function isLandscape() {
    if (state.flip) { try { return state.flip.getOrientation() === 'landscape'; } catch (e) { /* sin cambios */ } }
    return state.landscape;
  }
  // Páginas visibles a la vez: portada sola; después pliegos (1,2), (3,4)…; última página sola si queda impar.
  function spreadOf(i) {
    if (!isLandscape() || i === 0) return [i];
    const L = i % 2 === 1 ? i : i - 1;
    return L + 1 < count() ? [L, L + 1] : [L];
  }
  const canPrev = () => current() > 0;
  const canNext = () => { const s = spreadOf(current()); return s[s.length - 1] < count() - 1; };

  function update() {
    const s = spreadOf(current()), n = count();
    let label;
    if (s[0] === 0) label = `Portada · 1 de ${n}`;
    else if (state.pages[s[0]].type === 'backcover') label = `Contraportada · ${n} de ${n}`;
    else if (s.length === 2) label = `Páginas ${s[0] + 1}–${s[1] + 1} de ${n}`;
    else label = `Página ${s[0] + 1} de ${n}`;
    statusEl.textContent = label;
    prevBtn.disabled = !canPrev();
    nextBtn.disabled = !canNext();
    s.forEach((i) => fitPage(mount.querySelector(`.page[data-page="${i + 1}"]`)));
    centerCovers();
  }
  // StPageFlip muestra la portada en la mitad derecha del libro y la contraportada en la izquierda.
  // Con el libro cerrado se desplaza medio ancho de página para que la cubierta quede centrada.
  function centerCovers(leaving) {
    if (!state.flip) return;
    let shift = 0;
    const s = spreadOf(current());
    if (!leaving && isLandscape() && s.length === 1) {
      const w = state.flip.getBoundsRect().pageWidth;
      shift = s[0] === 0 ? -w / 2 : w / 2;
    }
    mount.style.transform = shift ? `translateX(${shift.toFixed(1)}px) translateZ(0)` : '';
  }

  function next() { if (!state.ready || !canNext()) return; if (state.flip) state.flip.flipNext(); else showFallback(spreadOf(current()).slice(-1)[0] + 1, 1); }
  function prev() { if (!state.ready || !canPrev()) return; if (state.flip) state.flip.flipPrev(); else showFallback(spreadOf(current())[0] - 1, -1); }
  function goTo(i) {
    i = Math.max(0, Math.min(count() - 1, i));
    if (state.flip) { state.flip.turnToPage(i); update(); } else showFallback(i, i >= state.index ? 1 : -1);
  }

  /* ----- Modo alternativo ----- */
  function layoutFallback() {
    const r = mount.getBoundingClientRect();
    state.landscape = r.width >= 600 && r.width >= r.height * 0.98;
    let h = r.height, w = h * 2 / 3;
    const cols = state.landscape ? 2 : 1;
    if (w * cols > r.width) { w = r.width / cols; h = w * 1.5; }
    mount.querySelectorAll('.page').forEach((el) => { el.style.width = w + 'px'; el.style.height = h + 'px'; });
    showFallback(state.index, 0);
  }
  function showFallback(i, dir) {
    i = Math.max(0, Math.min(count() - 1, i));
    const s = spreadOf(i);
    state.index = s[0];
    mount.querySelectorAll('.page').forEach((el, j) => {
      const on = s.includes(j);
      el.classList.toggle('shown', on);
      el.classList.toggle('back', on && dir < 0);
      el.classList.toggle('left', on && s.length === 2 && j === s[0]);
      el.classList.toggle('right', on && s.length === 2 && j === s[1]);
    });
    update();
  }
  function enableFallback() {
    state.flip = null; report.engine = 'alternativo';
    mount.classList.add('fallback');
    layoutFallback();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layoutFallback, 120); });
    // Clic o toque en la hoja: derecha avanza, izquierda retrocede (igual que las flechas).
    mount.addEventListener('click', (e) => {
      if (e.target.closest('button,a') || String(window.getSelection() || '').trim()) return;
      const pageEl = e.target.closest('.page'); if (!pageEl) return;
      const j = +pageEl.dataset.page - 1, s = spreadOf(state.index);
      let forward;
      if (s.length === 2) forward = j === s[1];
      else { const r = pageEl.getBoundingClientRect(); forward = j === 0 || e.clientX > r.left + r.width * 0.4; }
      forward ? next() : prev();
    });
    let down = null;
    mount.addEventListener('touchstart', (e) => { if (e.touches.length === 1) down = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
    mount.addEventListener('touchend', (e) => {
      if (!down) return;
      const dx = e.changedTouches[0].clientX - down.x, dy = e.changedTouches[0].clientY - down.y; down = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) { e.preventDefault(); dx < 0 ? next() : prev(); }
    });
  }

  /* ----- StPageFlip ----- */
  function enableFlip(els) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flip = new window.St.PageFlip(mount, {
      width: 460, height: 690, size: 'stretch', minWidth: 240, maxWidth: 620, minHeight: 360, maxHeight: 930,
      drawShadow: !reduce, maxShadowOpacity: 0.4, flippingTime: reduce ? 250 : 760, usePortrait: true,
      // autoSize: false — con true, la librería calcula la altura solo con el ancho y deja una capa invisible
      // (.stf__wrapper) que se desborda sobre las flechas inferiores y les roba los clics en pantallas anchas.
      showCover: true, autoSize: false, mobileScrollSupport: true, showPageCorners: true,
      swipeDistance: 30, useMouseEvents: true, clickEventForward: true, disableFlipByClick: false
    });
    flip.loadFromHTML(els);
    state.flip = flip; report.engine = 'StPageFlip';
    flip.on('flip', update);
    flip.on('changeOrientation', update);
    flip.on('changeState', (e) => { if (e.data === 'read') update(); else if (e.data === 'flipping') centerCovers(true); });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => centerCovers(), 150); });
  }

  /* ---------------- Modo lectura ---------------- */
  function buildReading() {
    const d = dedicationParts();
    let html = `<article class="reading"><figure class="r-cover">${coverSheet(false).replace(/^<div[^>]*>|<\/div>$/g, '')}</figure>`;
    html += `<h1>${esc(D.title)}</h1><p class="r-sub">${inline(D.subtitle)}</p><p class="r-authors">${D.authors.map(esc).join(' · ')}</p>`;
    html += `<section class="r-block r-dedication"><h2 class="ded-title">${esc(d.title)}</h2><p class="ded-names">${esc(d.names)}</p>${d.paras.map((p) => `<p>${inline(p)}</p>`).join('')}<p>${esc(d.closing)}<br>${esc(d.signature)}</p></section>`;
    html += `<nav class="r-block r-toc" aria-label="Índice"><h2>Índice</h2><ol>${D.chapters.map((c, ci) => `<li><button type="button" data-cap="${ci}">${esc(c.title)}</button></li>`).join('')}<li><button type="button" data-cap="creditos">Créditos</button></li></ol></nav>`;
    D.chapters.forEach((c, ci) => {
      const cp = chapterParts(c.title);
      const figs = D.plates.filter((p) => p.chapter === ci);
      html += `<section class="r-block r-chapter" id="lectura-cap-${ci + 1}"><h2><span>Capítulo ${cp.num}</span>${esc(cp.name)}</h2>`;
      TOK[ci].forEach((toks, pi) => {
        html += `<p>${toks.join(' ')}</p>`;
        figs.filter((f) => f.anchor === pi).forEach((f) => {
          const im = D.illustrations[f.image];
          html += `<figure><img src="${im.src}" alt="${esc(f.alt)}" loading="lazy" width="${im.width}" height="${im.height}"><figcaption>${esc(D.aiCredit)}</figcaption></figure>`;
        });
      });
      html += '</section>';
    });
    html += `<section class="r-block r-credits" id="lectura-creditos"><h2>Créditos</h2><dl>${D.credits.map((c) => (c.label ? `<dt>${esc(c.label)}</dt>` : '') + `<dd>${inline(c.text)}</dd>`).join('')}</dl></section></article>`;
    readStage.innerHTML = html;
    readStage.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cap]'); if (!b) return;
      const id = b.dataset.cap === 'creditos' ? 'lectura-creditos' : 'lectura-cap-' + (+b.dataset.cap + 1);
      document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function setMode(mode) {
    state.mode = mode;
    const reading = mode === 'reading';
    flipStage.hidden = reading; pager.hidden = reading; readStage.hidden = !reading;
    modeBtn.querySelector('.lbl-long').textContent = reading ? 'Volver al libro' : 'Modo lectura';
    modeBtn.querySelector('.lbl-short').textContent = reading ? 'Libro' : 'Lectura';
    modeBtn.setAttribute('aria-pressed', String(reading));
    if (reading) { window.scrollTo(0, 0); readStage.focus({ preventScroll: true }); }
    else { window.dispatchEvent(new Event('resize')); requestAnimationFrame(update); }
  }

  /* ---------------- Vista de impresión (Guardar PDF) ---------------- */
  let printBuilt = null;
  function buildPrint() {
    if (printBuilt) return printBuilt;
    const els = buildPageEls(printStage, true, ['endpaper']);
    const imgs = [...printStage.querySelectorAll('img')];
    printBuilt = Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))))
      .then(() => { els.forEach(fitPage); return els; });
    return printBuilt;
  }
  function notify(msg) { noticeEl.textContent = msg; noticeEl.hidden = false; clearTimeout(notify.t); notify.t = setTimeout(() => { noticeEl.hidden = true; }, 9000); }

  /* ---------------- Eventos ---------------- */
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  modeBtn.addEventListener('click', () => setMode(state.mode === 'reading' ? 'book' : 'reading'));
  coverBtn.addEventListener('click', () => { if (state.mode !== 'book') setMode('book'); requestAnimationFrame(() => goTo(0)); });
  pdfBtn.addEventListener('click', () => {
    if (!state.ready) return;
    pdfBtn.disabled = true;
    notify('Preparando la vista de impresión… En el diálogo, elige «Guardar como PDF» como destino.');
    buildPrint().then(() => { pdfBtn.disabled = false; window.print(); });
  });
  mount.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-goto]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); goTo(+b.dataset.goto);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'book' || e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,textarea,select,[contenteditable]')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(count() - 1); }
  });

  /* ---------------- Arranque ---------------- */
  function waitFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
    const load = Promise.all(['400 1em "EB Garamond"', 'italic 400 1em "EB Garamond"', '500 1em "EB Garamond"'].map((f) => document.fonts.load(f)))
      .then((r) => r.every((x) => x.length > 0)).catch(() => false);
    return Promise.race([load, new Promise((r) => setTimeout(() => r(false), 4000))]);
  }
  waitFonts().then((ok) => {
    report.fontLoaded = ok;
    state.pages = buildModel();
    const els = buildPageEls(mount, false);
    buildReading();
    loadingEl.remove();
    state.ready = true;
    if (window.St && window.St.PageFlip) {
      try { enableFlip(els); } catch (err) { console.warn('Modo alternativo:', err); mount.innerHTML = ''; buildPageEls(mount, false); enableFallback(); }
    } else enableFallback();
    update();
  });

  // Acceso para pruebas e integración en la web transmedia.
  window.EL_PRIMER_PACTO = { state, report, goTo, next, prev, current, spreadOf, setMode, buildPrint, fitPage };
})();
