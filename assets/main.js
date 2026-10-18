/* X-3306 lab site. No dependencies, no network requests, no tracking. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 2. Quadrant: built from the project cards (data-x, data-y, data-status) ---------- */
  function quadrant() {
    var host = document.getElementById('quadrant');
    if (!host) return;
    var cards = [].slice.call(document.querySelectorAll('[data-x][data-status]'));
    var W = 640, H = 440, L = 58, R = 26, T = 30, B = 56, pw = W - L - R, ph = H - T - B;
    function rng(seed) {
      var s = 0; for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function contour(cx, cy, rx, ry, random) {
      var pts = [];
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4, wobble = .86 + random() * .28;
        pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
      }
      function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
      var first = mid(pts[7], pts[0]), d = 'M' + first[0].toFixed(1) + ' ' + first[1].toFixed(1);
      for (var j = 0; j < 8; j++) {
        var end = mid(pts[j], pts[(j + 1) % 8]);
        d += ' Q' + pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1) + ' ' + end[0].toFixed(1) + ' ' + end[1].toFixed(1);
      }
      return d + ' Z';
    }
    var dots = '', desc = [];
    cards.forEach(function (c) {
      var name = c.getAttribute('data-name'), st = c.getAttribute('data-status');
      var x = L + parseFloat(c.getAttribute('data-x')) * pw;
      var y = T + (1 - parseFloat(c.getAttribute('data-y'))) * ph;
      var r = rng(name), rot = Math.round(r() * 180);
      var left = parseFloat(c.getAttribute('data-x')) > 0.66;
      desc.push(name + ' (' + st + ')');
      dots += '<g><g class="q-mark ' + st + '" transform="rotate(' + rot + ' ' + x + ' ' + y + ')">' + (st === 'live' ? '<circle class="q-pulse" cx="' + x + '" cy="' + y + '" r="16"/>' : '') +
        '<path class="q-contour outer ' + st + '" d="' + contour(x, y, 18, 13, r) + '"/><path class="q-contour inner ' + st + '" d="' + contour(x, y, 10, 7, r) + '"/>' +
        (st === 'closed' ? '<path class="q-x" d="M' + (x - 5) + ' ' + (y - 5) + 'L' + (x + 5) + ' ' + (y + 5) + 'M' + (x + 5) + ' ' + (y - 5) + 'L' + (x - 5) + ' ' + (y + 5) + '"/>' : '') +
        '<circle class="q-center ' + st + '" cx="' + x + '" cy="' + y + '" r="2.4"/></g>' +
        '<text class="q-name" x="' + (left ? x - 15 : x + 15) + '" y="' + (y + 4) + '" text-anchor="' + (left ? 'end' : 'start') + '">' + name + '</text></g>';
    });
    var mx = L + pw / 2, my = T + ph / 2;
    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="qt qd"><title id="qt">Map of lab projects</title>' +
      '<desc id="qd">Projects placed from concept to deployed and from offensive to defensive research: ' + desc.join(', ') + '.</desc>' +
      '<defs><filter id="ink" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></defs>' +
      '<g filter="url(#ink)"><path class="q-axis" d="M' + L + ' ' + (T - 6) + 'V' + (T + ph) + 'H' + (W - R + 6) + '"/>' +
      '<path class="q-mid" d="M' + mx + ' ' + T + 'V' + (T + ph) + 'M' + L + ' ' + my + 'H' + (W - R) + '"/></g>' +
      '<text class="q-hand" x="' + (L + 12) + '" y="' + (T + 20) + '">defense, still an idea</text>' +
      '<text class="q-hand" x="' + (W - R - 12) + '" y="' + (T + 20) + '" text-anchor="end">defense that runs</text>' +
      '<text class="q-hand" x="' + (L + 12) + '" y="' + (T + ph - 12) + '">offense on paper</text>' +
      '<text class="q-hand" x="' + (W - R - 12) + '" y="' + (T + ph - 12) + '" text-anchor="end">offense, built</text>' +
      '<text class="q-lab" x="' + L + '" y="' + (H - 22) + '">CONCEPT</text>' +
      '<text class="q-lab" x="' + (W - R) + '" y="' + (H - 22) + '" text-anchor="end">DEPLOYED</text>' +
      '<text class="q-lab" x="' + mx + '" y="' + (H - 8) + '" text-anchor="middle">maturity</text>' +
      '<text class="q-lab" transform="translate(18 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">OFFENSE  /  DEFENSE</text>' +
      dots + '</svg>';
  }

  /* ---------- 3. Tally marks by status (hand-drawn, counted from the cards) ---------- */
  function statusTally() {
    var host = document.getElementById('status-tally');
    if (!host) return;
    var cards = [].slice.call(document.querySelectorAll('.proj[data-status], .card[data-status]'));
    var order = [['released', 'released'], ['building', 'in progress'], ['planned', 'planned'], ['private', 'own use'], ['closed', 'closed']];
    var rowH = 62, out = '', seed = 5;
    function r() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000 - 0.5; }
    order.forEach(function (o, i) {
      var n = cards.filter(function (c) { return c.getAttribute('data-status') === o[0]; }).length;
      var y = 30 + i * rowH, x = 150, g = '';
      for (var k = 0; k < n; k++) {
        var grp = Math.floor(k / 5), pos = k % 5, gx = x + grp * 64;
        if (pos < 4) {
          var lx = gx + pos * 12 + r() * 2;
          g += '<path class="tk" d="M' + lx.toFixed(1) + ' ' + (y - 20 + r() * 3).toFixed(1) + 'Q' + (lx + r() * 3).toFixed(1) + ' ' + y + ' ' + (lx + r() * 2).toFixed(1) + ' ' + (y + 20 + r() * 3).toFixed(1) + '"/>';
        } else {
          g += '<path class="tk" d="M' + (gx - 8) + ' ' + (y + 14 + r() * 3).toFixed(1) + 'L' + (gx + 54) + ' ' + (y - 16 + r() * 3).toFixed(1) + '"/>';
        }
      }
      out += '<text class="tk-row" x="0" y="' + (y + 8) + '">' + o[1] + '</text>' + g;
    });
    host.innerHTML = '<svg viewBox="0 0 420 ' + (order.length * rowH + 10) + '" role="img" aria-label="Project count by status, as tally marks"><defs><filter id="tkw"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2"/></filter></defs><g filter="url(#tkw)">' + out + '</g></svg>';
  }

  /* Let the hand-drawn project plates arrive like ink on graph paper. */
  function chartInk() {
    var lines = [].slice.call(document.querySelectorAll('#quadrant svg path:not(.q-mid), #status-tally svg path'));
    lines.forEach(function (p, i) {
      p.setAttribute('pathLength', '1');
      p.classList.add('etch');
      p.style.setProperty('--ink-delay', Math.min(i * 18, 520) + 'ms');
    });
    [].slice.call(document.querySelectorAll('#quadrant .q-center')).forEach(function (p, i) {
      p.style.setProperty('--ink-delay', Math.min(180 + i * 75, 700) + 'ms');
    });
  }

  function figureInk() {
    [].slice.call(document.querySelectorAll('.fig svg path, .checks svg path')).forEach(function (p, i) {
      if (p.closest('#quadrant, #status-tally')) return;
      if (!p.hasAttribute('pathLength')) p.setAttribute('pathLength', '1');
      p.classList.add('etch');
      p.style.setProperty('--ink-delay', Math.min(i * 12, 420) + 'ms');
    });
    [].slice.call(document.querySelectorAll('.trail .wp')).forEach(function (p, i) {
      p.style.setProperty('--ink-delay', Math.min(i * 85, 595) + 'ms');
    });
  }

  /* ---------- 3b. Floor plan notes, project filters, "today" marker ---------- */
  function walls() {
    [].slice.call(document.querySelectorAll('.wall')).forEach(function (w) {
      try { w.style.setProperty('--len', Math.ceil(w.getTotalLength()) + 2); } catch (e) {}
    });
  }
  function planNotes() {
    var out = document.getElementById('plan-note');
    var rooms = [].slice.call(document.querySelectorAll('.room[data-note]'));
    if (!out || !rooms.length) return;
    var def = out.textContent;
    rooms.forEach(function (r) {
      var on = function () { out.textContent = r.getAttribute('data-note'); };
      var off = function () { out.textContent = def; };
      r.addEventListener('mouseenter', on); r.addEventListener('focus', on);
      r.addEventListener('mouseleave', off); r.addEventListener('blur', off);
    });
  }
  function filters() {
    var bar = document.getElementById('filters');
    if (!bar) return;
    var cards = [].slice.call(document.querySelectorAll('.card[data-status]'));
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var f = b.getAttribute('data-f');
      [].slice.call(bar.querySelectorAll('button')).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cards.forEach(function (c) { c.hidden = !(f === 'all' || c.getAttribute('data-status') === f); });
    });
  }
  function todayMarker() {
    var g = document.getElementById('today-mark');
    if (!g) return;
    var n = new Date(), start = new Date(n.getFullYear(), 0, 0), next = new Date(n.getFullYear() + 1, 0, 1);
    var day = Math.floor((n - start) / 864e5), daysInYear = (next - start) / 864e5;
    var x = 40 + (day / daysInYear) * 820;
    g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' 0)');
    g.removeAttribute('display');
  }

  /* ---------- 3c. Make diagrams usable on narrow screens and by keyboard ---------- */
  function diagramScrollRegions() {
    [].slice.call(document.querySelectorAll('.plan, .trail, .plate-body')).forEach(function (host) {
      var svg = host.querySelector('svg');
      if (!svg) return;
      var needsScroll = host.scrollWidth > host.clientWidth + 4;
      if (needsScroll) {
        host.setAttribute('tabindex', '0');
        host.setAttribute('role', 'region');
        if (!host.hasAttribute('aria-label')) {
          var caption = host.closest('figure') && host.closest('figure').querySelector('figcaption .t');
          host.setAttribute('aria-label', svg.getAttribute('aria-label') || (caption ? caption.textContent : 'Scrollable diagram'));
        }
      } else {
        host.removeAttribute('tabindex');
        if (host.getAttribute('role') === 'region') host.removeAttribute('role');
      }
    });
  }

  /* ---------- 3d. Graceful fallback for a missing Medium thumbnail ---------- */
  function articleImages() {
    [].slice.call(document.querySelectorAll('.post-img img')).forEach(function (img) {
      img.addEventListener('error', function () {
        var host = img.closest('.post-img');
        if (!host || host.classList.contains('ph')) return;
        var heading = img.closest('.post') && img.closest('.post').querySelector('h3');
        var title = heading ? heading.textContent.trim() : '';
        host.classList.add('ph');
        host.setAttribute('aria-hidden', 'true');
        img.remove();
        host.textContent = title ? title.charAt(0).toUpperCase() : '✳';
      }, { once: true });
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
    });
  }

  /* ---------- 4. Reveal on scroll + nav highlight ---------- */
  function reveal() {
    var els = [].slice.call(document.querySelectorAll('.rv, main > .sec'));
    els.forEach(function (e) { e.classList.add('rv'); });
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () { els.forEach(function (e) { e.classList.add('in'); }); }, 6000);
  }
  function navSpy() {
    var links = [].slice.call(document.querySelectorAll('.top nav a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) map[s.id] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        if (map[e.target.id]) map[e.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  walls(); quadrant(); statusTally(); chartInk(); figureInk(); planNotes(); filters(); todayMarker(); diagramScrollRegions(); articleImages(); reveal(); navSpy();
  window.addEventListener('resize', diagramScrollRegions, { passive: true });
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
