/* Embun — core runtime. Replaces Framer's runtime for the static rebuild.
   Exposes window.EMBUN: breakpoint helpers, Framer-accurate spring/tween easing, WAAPI animate,
   appear-effect runner, cart / favourites / country stores, fragment loader, module registry.
   Modules (js/m-*.js) register with EMBUN.mod(name, fn) and run after the DOM is ready. */
(function () {
  'use strict';
  var E = window.EMBUN = window.EMBUN || {};
  var D = E.DATA = window.EMBUN_DATA || { products: [] };
  var P = E.prefix || './';

  /* ---------------------------------------------------------------- breakpoints */
  var MQ = { D: '(min-width: 1200px)', T: '(min-width: 810px) and (max-width: 1199.98px)', P: '(max-width: 809.98px)' };
  var HASH = { D: 'ipn91j', T: '1tkk731', P: 'f4scsy' };
  E.bp = function () { return matchMedia(MQ.D).matches ? 'D' : matchMedia(MQ.T).matches ? 'T' : 'P'; };
  E.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  E.visible = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
  E.$ = function (sel, root) { return (root || document).querySelector(sel); };
  E.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  E.named = function (name, root) { return E.$$('[data-framer-name="' + name + '"]', root); };
  E.vis = function (list) { return list.filter(E.visible); };

  /* ---------------------------------------------------------------- springs (Framer maths) */
  var REST = 0.001;
  function solveDurationSpring(duration, bounce, mass) {
    mass = mass || 1;
    var o = Math.min(Math.max(1 - bounce, 0.05), 1), e = Math.min(Math.max(duration, 0.01), 10), n = 0, f, df;
    if (o < 1) {
      var ct = function (t, z) { return t * Math.sqrt(1 - z * z); };
      f = function (t) { var r = t * o, i = r * e, a = r - n, s = ct(t, o); return REST - a / s * Math.exp(-i); };
      df = function (t) {
        var r = t * o * e, a = r * n + n, s = o * o * t * t * e, c = Math.exp(-r), l = ct(t * t, o);
        var sign = (-f(t) + REST > 0) ? -1 : 1; return sign * ((a - s) * c) / l;
      };
    } else {
      f = function (t) { var r = Math.exp(-t * e), i = (t - n) * e + 1; return -REST + r * i; };
      df = function (t) { return Math.exp(-t * e) * ((n - t) * (e * e)); };
    }
    var w = 5 / e;
    for (var k = 1; k < 12; k++) w -= f(w) / df(w);
    var stiffness = w * w * mass;
    return { stiffness: stiffness, damping: o * 2 * Math.sqrt(mass * stiffness), mass: mass };
  }
  function springFn(k, d, m) {
    m = m || 1; var z = d / (2 * Math.sqrt(k * m)), w0 = Math.sqrt(k / m), g = -1;
    if (z < 1) { var x = w0 * Math.sqrt(1 - z * z), S = (z * w0 * g) / x; return function (t) { return 1 + Math.exp(-z * w0 * t) * (S * Math.sin(x * t) + g * Math.cos(x * t)); }; }
    if (z === 1) return function (t) { return 1 + Math.exp(-w0 * t) * (g + (w0 * g) * t); };
    var e2 = w0 * Math.sqrt(z * z - 1);
    return function (t) { var r = Math.min(e2 * t, 300); return 1 + Math.exp(-z * w0 * t) * ((z * w0 * g) * Math.sinh(r) + e2 * g * Math.cosh(r)) / e2; };
  }
  function physicsDuration(fn) {
    for (var t = 0; t < 10; t += 0.004) {
      var v = (fn(t + 0.001) - fn(t)) / 0.001;
      if (Math.abs(v) * 100 <= 2 && Math.abs(1 - fn(t)) * 100 <= 0.5) return t;
    }
    return 10;
  }
  function linearEasing(fn, dur) {
    var n = Math.max(24, Math.round(dur * 60)), pts = [];
    for (var i = 0; i <= n; i++) pts.push(i === n ? 1 : +fn(dur * i / n).toFixed(4));
    return 'linear(' + pts.join(', ') + ')';
  }
  var cache = {};
  /* Framer transition object -> {duration(ms), delay(ms), easing} */
  E.tr = function (t) {
    t = t || {}; var key = JSON.stringify(t);
    if (cache[key]) return cache[key];
    var out;
    if (t.type === 'spring') {
      var k, d, m = t.mass || 1, dur;
      if (t.duration != null && t.bounce != null && t.stiffness == null) {
        var s = solveDurationSpring(t.duration, t.bounce, m); k = s.stiffness; d = s.damping; dur = t.duration;
      } else { k = t.stiffness || 100; d = t.damping || 10; dur = null; }
      var fn = springFn(k, d, m); if (dur == null) dur = physicsDuration(fn);
      out = { duration: dur * 1000, delay: (t.delay || 0) * 1000, easing: linearEasing(fn, dur) };
    } else {
      var ease = t.ease, easing = 'linear';
      if (Array.isArray(ease)) easing = 'cubic-bezier(' + ease.join(',') + ')';
      else if (ease === 'easeInOut') easing = 'cubic-bezier(.42,0,.58,1)';
      else if (ease === 'easeOut') easing = 'cubic-bezier(0,0,.58,1)';
      else if (ease === 'easeIn') easing = 'cubic-bezier(.42,0,1,1)';
      out = { duration: (t.duration != null ? t.duration : 0.3) * 1000, delay: (t.delay || 0) * 1000, easing: easing };
    }
    cache[key] = out; return out;
  };
  E.T = {  /* the transitions the template actually uses (counted in the source) */
    soft: { type: 'spring', duration: 0.4, bounce: 0.2 },             // 47 uses: variant changes
    stiff: { type: 'spring', stiffness: 500, damping: 60, mass: 1 },  // 25 uses: buttons, fills
    drawer: { type: 'tween', duration: 1, ease: [0.76, 0, 0.24, 1] }, // cart / search / mobile sheet
    slide: { type: 'spring', stiffness: 200, damping: 40, mass: 1 },  // slideshows
    out1: { type: 'tween', duration: 1, ease: [0.25, 1, 0.5, 1] },
    out08: { type: 'tween', duration: 0.8, ease: [0.25, 1, 0.5, 1] },
    modal: { type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  };

  /* ---------------------------------------------------------------- motion values -> CSS */
  function tf(v) {
    var x = v.x || 0, y = v.y || 0, s = v.scale != null ? v.scale : 1, r = v.rotate || 0;
    var parts = [];
    if (v.transformPerspective) parts.push('perspective(' + v.transformPerspective + 'px)');
    parts.push('translateX(' + x + 'px)', 'translateY(' + y + 'px)', 'scale(' + s + ')', 'rotate(' + r + 'deg)');
    if (v.rotateX) parts.push('rotateX(' + v.rotateX + 'deg)');
    if (v.rotateY) parts.push('rotateY(' + v.rotateY + 'deg)');
    if (v.skewX) parts.push('skewX(' + v.skewX + 'deg)');
    if (v.skewY) parts.push('skewY(' + v.skewY + 'deg)');
    return parts.join(' ');
  }
  E.frame = function (v) { var f = { transform: tf(v) }; if (v.opacity != null) f.opacity = v.opacity; return f; };
  /* animate el between two motion states with a Framer transition; resolves when done */
  E.animate = function (el, from, to, t, opts) {
    var tt = E.tr(t || E.T.soft);
    if (E.reduced) { Object.assign(el.style, E.frame(to)); return Promise.resolve(); }
    var kf = [from ? (from.transform !== undefined || from.opacity !== undefined && !('x' in from) ? from : E.frame(from)) : null,
      to.transform !== undefined || (to.opacity !== undefined && !('x' in to) && !('y' in to) && !('scale' in to)) ? to : E.frame(to)];
    if (!kf[0]) kf.shift();
    var a = el.animate(kf, { duration: tt.duration, delay: tt.delay, easing: tt.easing, fill: 'both' });
    return new Promise(function (res) {
      var done = function () { try { a.commitStyles(); a.cancel(); } catch (e) {} res(); };
      a.onfinish = done; a.oncancel = function () { res(); };
      /* rAF can be throttled in background tabs: never leave an element stuck at its start state */
      setTimeout(function () { if (a.playState !== 'finished') { a.finish(); } }, tt.duration + tt.delay + 1500);
    });
  };
  E.css = function (el, props) { for (var k in props) el.style.setProperty(k, props[k]); };

  /* ---------------------------------------------------------------- appear effects */
  var APPEAR = {};
  try { var ap = document.getElementById('__framer__appearAnimationsContent'); if (ap) APPEAR = JSON.parse(ap.textContent); } catch (e) {}
  E.appear = function (root) {
    var bp = E.bp(), h = HASH[bp];
    E.$$('[data-framer-appear-id]', root).forEach(function (el) {
      if (el.__appeared || !E.visible(el) && !el.closest('.ssr-variant')) return;
      var def = APPEAR[el.getAttribute('data-framer-appear-id')];
      if (!def) return;
      var v = def[h] !== undefined ? def[h] : def['default'];
      if (!v || !v.animate) { if (v === null) { el.style.opacity = ''; el.style.transform = ''; } return; }
      el.__appeared = true;
      var to = Object.assign({}, v.animate); var t = to.transition; delete to.transition;
      E.animate(el, E.frame(v.initial || {}), E.frame(to), t);
    });
  };

  /* ---------------------------------------------------------------- storage */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  E.ls = { get: lsGet, set: lsSet };
  E.product = function (slug) { for (var i = 0; i < D.products.length; i++) if (D.products[i].slug === slug) return D.products[i]; return null; };
  E.money = function (v) { var c = E.country(); return c.symbol + Number(v).toFixed(2); };
  /* gift card lines carry their amount in the variant ("RM100.00"); everything else uses the product price */
  E.unitPrice = function (p, variant) {
    var m = p.amounts && p.amounts.length && /(\d+(?:\.\d+)?)/.exec(variant || '');
    return m ? parseFloat(m[1]) : p.price;
  };
  E.country = function () { return lsGet('embun_country', { name: 'Malaysia', code: 'MY', currency: 'MYR', symbol: 'RM' }); };

  /* cart: [{slug, variant, qty}] */
  E.cart = {
    items: function () { return lsGet('embun_cart', []); },
    count: function () { return E.cart.items().reduce(function (a, b) { return a + b.qty; }, 0); },
    save: function (items) { lsSet('embun_cart', items); document.dispatchEvent(new CustomEvent('embun:cart')); },
    add: function (slug, variant, qty) {
      var items = E.cart.items(), f = items.filter(function (i) { return i.slug === slug && i.variant === (variant || ''); })[0];
      if (f) f.qty += qty || 1; else items.push({ slug: slug, variant: variant || '', qty: qty || 1 });
      E.cart.save(items);
    },
    set: function (idx, qty) { var items = E.cart.items(); if (!items[idx]) return; if (qty <= 0) items.splice(idx, 1); else items[idx].qty = qty; E.cart.save(items); },
    subtotal: function () {
      return E.cart.items().reduce(function (a, i) { var p = E.product(i.slug); return a + (p ? E.unitPrice(p, i.variant) * i.qty : 0); }, 0);
    }
  };
  /* favourites: same key as the template ("favorites"), array of slugs */
  E.fav = {
    list: function () { return lsGet('favorites', []); },
    has: function (slug) { return E.fav.list().indexOf(slug) >= 0; },
    toggle: function (slug) {
      var l = E.fav.list(), i = l.indexOf(slug);
      if (i >= 0) l.splice(i, 1); else l.push(slug);
      lsSet('favorites', l);
      document.dispatchEvent(new CustomEvent('embun:fav', { detail: { slug: slug, on: i < 0 } }));
      return i < 0;
    }
  };

  /* ---------------------------------------------------------------- fragments (captured runtime states) */
  var fragCache = {};
  E.frag = function (name) {
    if (!fragCache[name]) {
      fragCache[name] = fetch(P + 'frag/' + name + '.html').then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (t) { return t.replace(/\{\{P\}\}/g, P); });
    }
    return fragCache[name];
  };
  E.html = function (s) { var t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

  /* ---------------------------------------------------------------- lock scroll (modals, drawers, menus) */
  var lockY = 0, locks = 0;
  E.lock = function () {
    if (locks++ > 0) return; lockY = scrollY;
    E.css(document.body, { overflow: 'hidden', position: 'fixed', width: '100%', height: '100%', top: -lockY + 'px' });
  };
  E.unlock = function () {
    if (--locks > 0) return; locks = 0;
    ['overflow', 'position', 'width', 'height', 'top'].forEach(function (k) { document.body.style.removeProperty(k); });
    window.scrollTo(0, lockY);
  };

  /* ---------------------------------------------------------------- modules */
  var mods = [];
  E.mod = function (name, fn) { mods.push([name, fn]); if (E.ready) run(name, fn); };
  function run(name, fn) { try { fn(E); } catch (err) { console.error('[embun]', name, err); } }
  function boot() {
    E.ready = true;
    E.appear(document);
    mods.forEach(function (m) { run(m[0], m[1]); });
    document.documentElement.classList.add('embun-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
