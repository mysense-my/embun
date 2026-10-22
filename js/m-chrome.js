/* Embun — global chrome (every page).
   Navigation (desktop scroll-variant switching, mega-menus, underline hovers; tablet/phone menu sheet with
   drill-in sub-menus), "Bag (n)" counters, cart drawer (empty state with Popular Items slideshow, line items,
   Checkout -> /checkout/), search drawer, the modal queue (newsletter -> country), footer, Instagram tiles /
   ticker and the newsletter CTA. Timings and transitions are the template's own (see _teardown/specs/global-chrome.md
   and the live measurements noted inline).

   Public API (on window.EMBUN):
     openCart() / closeCart() / toggleCart()     cart drawer
     openSearch() / closeSearch()                search drawer
     openCountry()                               country modal (same as the footer trigger)
     underline.in(el) / .out(el) / .rest(el)     Underline Button hover (nav / footer link line)
   Events: dispatch document 'embun:cart' with {detail:{open:true}} to open the drawer after an add-to-cart;
   a plain 'embun:cart' that increases the item count (EMBUN.cart.add) also opens it.
   Fires document 'embun:country' {detail: country} when the visitor picks a country. */
(function () {
  'use strict';
  var E = window.EMBUN;
  if (!E || !E.mod) return;

  E.mod('chrome', function (E) {
    var P = E.prefix || './';
    var PAGE_NAME = E.page || '';
    var $ = E.$, $$ = E.$$;
    var INKc = [31, 43, 36], PAGEc = [252, 251, 247];
    function rgb(c, a) { return a == null ? 'rgb(' + c.join(', ') + ')' : 'rgba(' + c.join(', ') + ', ' + a + ')'; }
    function ramp(v) { var t = v / 255; return rgb([0, 1, 2].map(function (i) { return Math.round(INKc[i] + t * (PAGEc[i] - INKc[i])); })); }
    var INK = rgb(INKc), PAGE = rgb(PAGEc), PAGE0 = rgb(PAGEc, 0), DEEP = 'rgb(51, 68, 58)';

    /* transitions used by the chrome (template values) */
    var T = {
      stiff: E.T.stiff,                                                     // spring 500/60
      soft: E.T.soft,                                                       // spring .4 / bounce .2
      drawer: E.T.drawer,                                                   // tween 1s [.76,0,.24,1]
      sheet: { type: 'tween', duration: 1, ease: [0.83, 0, 0.17, 1] },      // mobile menu reveal
      roll: { type: 'tween', duration: 0.7, ease: [0.25, 1, 0.5, 1] },      // Menu <-> Close label
      card: { type: 'tween', duration: 0.8, ease: [0.25, 1, 0.5, 1] },      // nav card image zoom
      price: { type: 'tween', duration: 0.6, delay: 0.1, ease: [0.25, 1, 0.5, 1] },
      tile: { type: 'tween', duration: 0.4, ease: [0, 0, 1, 1] },           // Instagram overlay
      search: { type: 'spring', stiffness: 357, damping: 40, mass: 1 },     // search card image swap
      slide: E.T.slide,                                                     // slideshow spring 200/40
      cta: { type: 'tween', duration: 0.2, ease: [0.44, 0, 0.56, 1] },      // newsletter arrow nudge
      modalIn: { type: 'tween', duration: 0.8, delay: 0.2, ease: [0.25, 1, 0.5, 1] }
    };

    /* ------------------------------------------------------------------ helpers */
    var RUN = new WeakMap();
    function setStyle(el, o) { for (var k in o) el.style[k] = o[k]; }
    function stopAnim(el, key) {
      var m = RUN.get(el); if (!m || !m[key]) return;
      var a = m[key]; delete m[key];
      try { a.commitStyles(); } catch (e) {}
      a.cancel();
    }
    /* animate CSS props of `el` with a Framer transition; `from` null = current computed values.
       A newer call with the same key interrupts from wherever the old one is. */
    function anim(el, key, from, to, t, extraDelay) {
      if (!el) return Promise.resolve(false);
      stopAnim(el, key);
      if (!from) {
        var cs = getComputedStyle(el); from = {};
        for (var k in to) from[k] = cs[k];
      }
      var tt = E.tr(t);
      if (E.reduced || tt.duration <= 0) { setStyle(el, to); return Promise.resolve(true); }
      var a;
      try { a = el.animate([from, to], { duration: tt.duration, delay: tt.delay + (extraDelay || 0), easing: tt.easing, fill: 'both' }); }
      catch (e) { setStyle(el, to); return Promise.resolve(true); }
      var m = RUN.get(el); if (!m) { m = {}; RUN.set(el, m); }
      m[key] = a;
      return new Promise(function (res) {
        a.onfinish = function () {
          if (m[key] === a) delete m[key];
          try { a.commitStyles(); } catch (e) { setStyle(el, to); }
          a.cancel(); res(true);
        };
        a.oncancel = function () { res(false); };
      });
    }
    function after(ms, fn) { return setTimeout(fn, ms); }
    function tpl(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content; }
    function frag(name) { return E.frag(name).then(tpl); }
    function bpFrag(base) { return frag(base + '-' + E.bp()); }
    function visibleOne(list) { for (var i = 0; i < list.length; i++) if (E.visible(list[i])) return list[i]; return null; }
    function docTop(el) { var y = 0; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; }
    function textOf(el, v) { if (el) el.textContent = v; }
    function isMouse(ev) { return !ev.pointerType || ev.pointerType === 'mouse' || ev.pointerType === 'pen'; }
    /* enter / leave on a delegated root (pointerover/out) without double firing inside */
    function hover(root, sel, enter, leave, filter) {
      root.addEventListener('pointerover', function (ev) {
        if (!isMouse(ev)) return;
        var el = ev.target.closest && ev.target.closest(sel);
        if (!el || (filter && !filter(el))) return;
        if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
        enter(el, ev);
      });
      root.addEventListener('pointerout', function (ev) {
        if (!isMouse(ev)) return;
        var el = ev.target.closest && ev.target.closest(sel);
        if (!el || (filter && !filter(el))) return;
        if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
        leave && leave(el, ev);
      });
    }
    function setImg(img, src, alt) {
      if (!img) return;
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
      img.src = src; if (alt != null) img.alt = alt;
    }
    function productUrl(p) { return P + 'shop/' + p.slug + '/'; }
    function appearPrice(els) {
      els.forEach(function (el) { if (el) { el.style.opacity = '0.001'; anim(el, 'appear', { opacity: 0.001 }, { opacity: 1 }, T.price); } });
    }
    function idle(fn) { (window.requestIdleCallback || function (f) { return setTimeout(f, 600); })(fn); }
    /* run callbacks after the page's layout height changes (images, fonts, other modules) */
    var layoutCbs = [];
    function onLayout(fn) { layoutCbs.push(fn); }
    if ('ResizeObserver' in window) {
      var lastH = 0;
      new ResizeObserver(function () {
        var h = document.body.scrollHeight;
        if (h === lastH) return; lastH = h;
        layoutCbs.forEach(function (f) { try { f(); } catch (e) {} });
      }).observe(document.body);
    }

    /* ------------------------------------------------------------------ Underline Button (nav / footer links)
       rest: left -3px, width 1%  ->  IN: right 0, width 102% (cart counter: 102px)  ->  OUT: right -3px, width 1%;
       spring 500/60 for IN / OUT; 350ms after OUT starts it snaps back to rest (measured live). */
    var UL = { 'framer-KnRPa': '.framer-nsdj18', 'framer-DUmBR': '.framer-mt28h2', 'framer-HPdyd': '.framer-1gnnbst' };
    var UL_SEL = '.framer-KnRPa, .framer-DUmBR, .framer-HPdyd';
    function ulLine(btn) {
      for (var c in UL) if (btn.classList.contains(c)) return { line: $(UL[c], btn), px: c === 'framer-HPdyd' };
      return null;
    }
    function ulGeom(btn, state) {
      var u = ulLine(btn); if (!u || !u.line) return null;
      var W = u.line.parentElement.clientWidth;
      if (state === 'in') { var w = u.px ? 102 : W * 1.02; return { line: u.line, left: W - w, width: w }; }
      if (state === 'out') return { line: u.line, left: W + 3 - W * 0.01, width: W * 0.01 };
      return { line: u.line, left: -3, width: W * 0.01 };
    }
    function ulIn(btn) {
      clearTimeout(btn.__ulT);
      var g = ulGeom(btn, 'in'); if (!g) return;
      g.line.style.right = 'auto';
      anim(g.line, 'ul', null, { left: g.left + 'px', width: g.width + 'px' }, T.stiff);
    }
    function ulOut(btn) {
      var g = ulGeom(btn, 'out'); if (!g) return;
      g.line.style.right = 'auto';
      anim(g.line, 'ul', null, { left: g.left + 'px', width: g.width + 'px' }, T.stiff);
      clearTimeout(btn.__ulT);
      btn.__ulT = after(350, function () { ulRest(btn); });
    }
    function ulRest(btn) {
      clearTimeout(btn.__ulT);
      var u = ulLine(btn); if (!u || !u.line) return;
      stopAnim(u.line, 'ul');
      u.line.style.removeProperty('left'); u.line.style.removeProperty('width'); u.line.style.removeProperty('right');
    }
    E.underline = { in: ulIn, out: ulOut, rest: ulRest };
    function ulEligible(el) {
      var n = el.getAttribute('data-framer-name') || '';
      if (el.classList.contains('framer-KnRPa') && !/^Navigation (Button|Line IN|Line OUT)$/.test(n)) return false;
      return !!el.closest('.framer-siulff-container, footer, #template-overlay');
    }
    hover(document, UL_SEL, ulIn, ulOut, ulEligible);

    /* ------------------------------------------------------------------ navigation: find the three SSR copies */
    var navs = $$('.framer-siulff-container nav.framer-UAYK2');
    var dNav = null, mNavs = [];
    navs.forEach(function (n) {
      var w = n.closest('.ssr-variant'), c = w ? w.className : '';
      var isD = w ? (/hidden-1tkk731/.test(c) && /hidden-f4scsy/.test(c)) : /framer-v-(1xyw2fz|1cvobkw)/.test(n.className);
      if (isD) dNav = n; else mNavs.push({ nav: n, bp: /hidden-1tkk731/.test(c) ? 'P' : 'T' });
    });

    /* ------------------------------------------------------------------ cart counters: "Bag (n)" */
    function updateCounts() {
      var n = E.cart.count();
      $$('.framer-HPdyd .framer-5xjkw0-container p').forEach(function (p) { if (p.textContent !== String(n)) p.textContent = n; });
    }
    updateCounts();

    /* ================================================================== DESKTOP NAV */
    var DV = { fill: ['framer-v-1xyw2fz', 'Desktop Navigation Fill'], tr: ['framer-v-1cvobkw', 'Desktop Navigation Transparent'] };
    var DARK = {
      fill: { collections: ['framer-v-1xcp1ji', 'Dark Desktop Collections'], products: ['framer-v-1k14mi4', 'Dark Desktop Products'], brand: ['framer-v-1hc0aio', 'Dark Desktop Products'] },
      tr: { collections: ['framer-v-1cdgbg6', 'Dark Desktop Collections'], products: ['framer-v-1kk6p5m', 'Dark Desktop Products'], brand: ['framer-v-18rs9s8', 'Dark Desktop Products'] }
    };
    var MV = {
      closed: ['framer-v-gf9x79', 'Tablet / Mobile Navigation Fill'], options: ['framer-v-jswzl9', 'Tablet / Mobile Navigation Options'],
      collections: ['framer-v-1468x06', 'Tablet / Mobile Navigation Collections'], products: ['framer-v-1impph', 'Tablet / Mobile Navigation Products'],
      brand: ['framer-v-1cbaxy6', 'Tablet / Mobile Navigation Brand']
    };
    var ALLV = [];
    [DV, DARK.fill, DARK.tr, MV].forEach(function (o) { for (var k in o) ALLV.push(o[k][0]); });
    function setVariant(nav, v) {
      ALLV.forEach(function (c) { nav.classList.remove(c); });
      nav.classList.add(v[0]); nav.setAttribute('data-framer-name', v[1]);
    }
    /* scroll targets per route (template "Bp" props): [element id, variant] */
    var TARGETS = {
      home: [['trigger', 'fill'], ['full-bleed', 'tr'], ['section-info', 'fill']],
      contact: [['intro', 'fill']], values: [['intro', 'fill']], ingredients: [['ingredients', 'fill']],
      environment: [['intro', 'fill'], ['full-bleed', 'tr'], ['cards', 'fill']]
    };
    var MEGA_TABS = { collections: '.framer-g7jodt', products: '.framer-1f06o80', brand: '.framer-1mlv3um' };
    var JOURNAL_TAB = '.framer-7fyb4t';
    /* staggered appear of each panel's contents (opacity .001 -> 1, linear): appear-id -> [delay, duration] */
    var STAGGER = {
      '1xfgzo9': [0.1, 0.4], '1nggb1f': [0.2, 0.4], '67xu0a': [0.3, 0.4], '10qqmbp': [0.4, 0.5], 'ev9muq': [0.5, 0.5],
      '1hcolua': [0.1, 0.6], '84bd1x': [0.2, 0.6], '17wg9rz': [0.3, 0.6], '1wy7tr4': [0.4, 0.6],
      '33n4xd': [0.1, 0.5], 'b7pjhc': [0.2, 0.5], 'e6w6sh': [0.3, 0.5], '13onioj': [0.4, 0.5], 'zx5kdr': [0.5, 0.4]
    };
    var D = null;
    if (dNav) D = initDesktopNav(dNav);

    function initDesktopNav(nav) {
      var cont = $('.framer-1vjbnnu', nav);
      var stopHolder = $('.framer-cp1pdb-container', nav);
      var base = nav.classList.contains('framer-v-1cvobkw') ? 'tr' : 'fill';
      var look = base, open = null, family = null, wanted = null;
      var overlay = null, content = null, stopStyle = null;
      var targets = (TARGETS[PAGE_NAME] || []).slice();
      var darkCache = {};
      var trGraphic = $('.framer-8z6qxp .framer-1f84asf', nav), inkGraphic = null;

      function darkFrag(fam, tab) {
        var k = (fam === 'tr' ? 'nav-transparent-' : 'nav-fill-') + tab + '-D';
        if (!darkCache[k]) darkCache[k] = frag(k);
        return darkCache[k];
      }
      function prefetch() { ['fill', 'tr'].forEach(function (f) { for (var t in MEGA_TABS) darkFrag(f, t); }); }
      if (E.bp() === 'D') idle(prefetch);

      /* logo: transparent pages ship the light data-URI wordmark; the fill look uses the ink symbol */
      function makeInkGraphic() {
        if (inkGraphic || !trGraphic) return inkGraphic;
        var g = trGraphic.cloneNode(false);
        if (document.getElementById('svg12759815631')) {
          g.style.removeProperty('background-image'); g.style.removeProperty('background-size');
          g.innerHTML = '<div class="svgContainer" style="width:100%;height:100%;aspect-ratio:inherit"><svg style="width:100%;height:100%;"><use href="#svg12759815631"></use></svg></div>';
        } else {
          g.style.backgroundImage = (trGraphic.style.backgroundImage || '').replace(/rgb\(\s*252,\s*251,\s*247\s*\)|rgb\(\s*255,\s*255,\s*255\s*\)/g, INK);
        }
        inkGraphic = g; return g;
      }
      function setInk(on) {
        if (base !== 'tr') return;
        nav.classList.toggle('em-ink', on);
        var cur = $('.framer-8z6qxp .framer-1f84asf', nav), want = on ? makeInkGraphic() : trGraphic;
        if (cur && want && cur !== want) cur.parentNode.replaceChild(want, cur);
      }

      /* fill <-> transparent: labels / logo swap instantly, the bar's background animates (spring 500/60) */
      function applyLook(l, animate) {
        look = l;
        if (open) return;
        setVariant(nav, DV[l]);
        setInk(l === 'fill');
        var bg = l === 'fill' ? PAGE : PAGE0;
        if (animate) anim(cont, 'bg', null, { backgroundColor: bg }, T.stiff);
        else { stopAnim(cont, 'bg'); cont.style.backgroundColor = bg; }
      }
      /* Framer's variant-scroll: active target = last one whose (offsetTop - 1) <= scrollY; before the first: base.
         Target offsets are measured off the scroll path (layout reads only after layout changes: resize / load /
         ResizeObserver), so scrolling itself never forces a layout. */
      var tops = null;
      function measureTops() {
        tops = targets.map(function (t) { var el = visibleOne($$('[id="' + t[0] + '"]')); return el ? docTop(el) - 1 : null; });
      }
      function scrollLook() {
        if (!targets.length || E.bp() !== 'D') return base;
        if (!tops) measureTops();
        var y = window.scrollY, idx = -1;
        for (var i = 0; i < targets.length; i++) {
          var s = tops[i];
          if (s == null) continue;
          if (i === 0 && s <= 1) idx = 0;
          if (y >= s) idx = i;
        }
        return idx < 0 ? base : targets[idx][1];
      }
      function onScroll() { var l = scrollLook(); if (l !== look) applyLook(l, true); }
      function remeasure() { tops = null; onScroll(); }
      if (targets.length) {
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', remeasure);
        window.addEventListener('load', remeasure);
        onLayout(remeasure);
        applyLook(scrollLook(), false);
      }

      /* panel height: the white Container grows / shrinks with spring 500/60 (measured 62.5 -> 439.5 at 1440) */
      function animHeight(h0) {
        stopAnim(cont, 'h');
        cont.style.removeProperty('height');
        var h1 = cont.getBoundingClientRect().height;
        if (Math.abs(h1 - h0) < 0.5) return;
        anim(cont, 'h', { height: h0 + 'px' }, { height: h1 + 'px' }, T.stiff).then(function (done) {
          if (done) cont.style.removeProperty('height');
        });
      }
      function tabBtn(tab) { var w = $(MEGA_TABS[tab], nav); return w && $(UL_SEL, w); }

      function openMega(tab) {
        if (E.bp() !== 'D' || open === tab) return;
        wanted = tab;
        var fam = open ? family : look;
        darkFrag(fam, tab).then(function (fr) {
          if (wanted !== tab || open === tab || E.bp() !== 'D') return;
          var h0 = cont.getBoundingClientRect().height;
          var first = !open;
          if (open) { var pb = tabBtn(open); if (pb) ulRest(pb); }
          family = fam; open = tab;
          setVariant(nav, DARK[fam][tab]);
          if (first) {
            overlay = fr.querySelector('.framer-1fh87at').cloneNode(true);
            overlay.style.opacity = '1';
            nav.insertBefore(overlay, cont);
            var st = fr.querySelector('.framer-cp1pdb-container style');
            stopStyle = st ? st.cloneNode(true) : tpl('<style data-frameruni-stop-scroll>body { overflow: hidden !important; }</style>').firstChild;
            (stopHolder || nav).appendChild(stopStyle);
            if (fam === 'tr') { setInk(true); anim(cont, 'bg', null, { backgroundColor: PAGE }, T.stiff); }
          }
          if (content) content.remove();
          content = fr.querySelector('.framer-dvhj2g').cloneNode(true);
          var st2 = [];
          $$('[data-framer-appear-id]', content).forEach(function (el) {
            var s = STAGGER[el.getAttribute('data-framer-appear-id')];
            if (s) { el.style.opacity = '0.001'; st2.push([el, s]); }
          });
          cont.appendChild(content);
          bindMegaContent(content);
          animHeight(h0);
          st2.forEach(function (x) {
            anim(x[0], 'appear', { opacity: 0.001 }, { opacity: 1 }, { type: 'tween', duration: x[1][1], delay: x[1][0], ease: [0, 0, 1, 1] });
          });
        });
      }
      function closeMega() {
        wanted = null;
        if (!open) return;
        var h0 = cont.getBoundingClientRect().height;
        var b = tabBtn(open); if (b && !b.matches(':hover')) ulRest(b);
        var fam = family;
        open = null; family = null;
        if (overlay) { overlay.remove(); overlay = null; }
        if (stopStyle) { stopStyle.remove(); stopStyle = null; }
        if (content) { content.remove(); content = null; }
        setVariant(nav, DV[look]);
        if (fam === 'tr' || base === 'tr') {
          setInk(look === 'fill');
          anim(cont, 'bg', null, { backgroundColor: look === 'fill' ? PAGE : PAGE0 }, T.stiff);
        }
        animHeight(h0);
      }
      function bindMegaContent(root) {
        root.addEventListener('click', function (ev) { if (ev.target.closest('a')) closeMega(); });
        /* Nav Collection Card: image 1.06 -> 1.01 on hover; Nav Brand Card: 1 -> 1.05 (tween .8s [.25,1,.5,1]) */
        $$('a.framer-wuKU4, a.framer-FY4zm', root).forEach(function (a) {
          var img = $('[data-framer-name="Image Wrapper"] > div', a); if (!img) return;
          var col = a.classList.contains('framer-wuKU4');
          a.addEventListener('mouseenter', function () { anim(img, 'zoom', null, { transform: 'scale(' + (col ? 1.01 : 1.05) + ')' }, T.card); });
          a.addEventListener('mouseleave', function () { anim(img, 'zoom', null, { transform: 'scale(' + (col ? 1.06 : 1) + ')' }, T.card); });
        });
      }
      Object.keys(MEGA_TABS).forEach(function (tab) {
        var w = $(MEGA_TABS[tab], nav); if (!w) return;
        w.addEventListener('mouseenter', function () { openMega(tab); });
        w.addEventListener('click', function () { if (open === tab) closeMega(); });
      });
      var j = $(JOURNAL_TAB, nav);
      if (j) j.addEventListener('mouseenter', closeMega);
      nav.addEventListener('mouseleave', closeMega);
      window.addEventListener('resize', function () { if (E.bp() !== 'D') closeMega(); else onScroll(); });
      return { close: closeMega, open: openMega, state: function () { return { look: look, open: open, family: family, base: base }; } };
    }

    /* ================================================================== TABLET / PHONE NAV */
    var M = mNavs.map(function (o) { return initMobileNav(o.nav, o.bp); });
    function initMobileNav(nav, bp) {
      var cont = $('.framer-1vjbnnu', nav);
      var mc = $('.framer-13u8erc', nav);
      var options = mc && $('.framer-1iuul2k', mc);
      var btnWrap = $('.framer-1wl8oj7', nav);
      var btn = $('.framer-FiBYU', nav);
      var stopHolder = $('.framer-cp1pdb-container', nav);
      var state = 'closed', panel = null, stopStyle = null, cache = {};
      var PANEL = { collections: '.framer-pecyx3', products: '.framer-9lu340', brand: '.framer-bk0lc8' };
      var ROWS = { collections: '.framer-1uor647', products: '.framer-nilv4c', brand: '.framer-jpoy9n' };
      if (!cont || !mc || !btnWrap) return null;

      function sub(name) {
        var k = 'mnav-' + name + '-' + bp;
        if (!cache[k]) cache[k] = frag(k);
        return cache[k];
      }
      function stop(on) {
        if (on && !stopStyle) {
          stopStyle = tpl('<style data-frameruni-stop-scroll>body { overflow: hidden !important; }</style>').firstChild;
          (stopHolder || nav).appendChild(stopStyle);
        } else if (!on && stopStyle) { stopStyle.remove(); stopStyle = null; }
      }
      /* Mobile Menu Button: "Menu" / "Close" stacked in an 18px window; justify-content flips and the labels
         roll by layout animation, tween .7s [.25,1,.5,1] */
      function roll(toClose) {
        if (!btn) return;
        var labels = $$('.framer-1bvsuig > *', btn);
        var y0 = labels.map(function (l) { return l.getBoundingClientRect().top; });
        btn.classList.toggle('framer-v-8rkpbo', toClose); btn.classList.toggle('framer-v-1x5uwdb', !toClose);
        btn.setAttribute('data-framer-name', toClose ? 'Close' : 'Open');
        labels.forEach(function (l, i) {
          stopAnim(l, 'roll'); l.style.removeProperty('transform');
          var dy = y0[i] - l.getBoundingClientRect().top;
          if (Math.abs(dy) > 0.1) anim(l, 'roll', { transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0px)' }, T.roll);
        });
      }
      /* Options content: the closed bar ships the SSR copy (h2 / hover link variants); the open variants render
         h1 (preset 1rp77z5) + "Navigation Button Mobile" links, so the open state uses the captured copy */
      var optClosed = options, optOpen = null;
      function bindOptions(o) {
        Object.keys(ROWS).forEach(function (name) {
          var r = $(ROWS[name], o);
          if (r) { r.style.cursor = 'pointer'; r.addEventListener('click', function (ev) { ev.preventDefault(); enterSub(name); }); }
        });
        o.addEventListener('click', function (ev) { if (ev.target.closest('a')) after(100, closeSheet); });
      }
      function loadOpen() {
        return sub('open').then(function (fr) {
          if (!optOpen) { var o = fr.querySelector('.framer-1iuul2k'); if (o) { optOpen = o.cloneNode(true); bindOptions(optOpen); } }
          return optOpen;
        });
      }
      function showOptions(which) {
        var want = which === 'open' && optOpen ? optOpen : optClosed;
        [optClosed, optOpen].forEach(function (o) { if (o && o !== want && o.parentNode) o.remove(); });
        if (want && want.parentNode !== mc) mc.appendChild(want);
        options = want;
      }
      function removePanel(which) { if (panel) { panel.remove(); panel = null; } showOptions(which); }

      function openSheet() {
        if (state !== 'closed') return;
        state = 'options';
        setVariant(nav, MV.options);
        showOptions('open');
        if (!optOpen) loadOpen().then(function () { if (state === 'options') showOptions('open'); });
        roll(true); stop(true);
        /* the sheet is clipped by the nav root, which grows 65 -> 100vh with a 1s tween [.83,0,.17,1] */
        var h1 = cont.getBoundingClientRect().height;
        anim(nav, 'sheet', { height: '65px' }, { height: h1 + 'px' }, T.sheet).then(function (done) {
          if (done) nav.style.removeProperty('height');
        });
        ['collections', 'products', 'brand'].forEach(sub);
      }
      function closeSheet() {
        if (state === 'closed') return;
        state = 'closed';
        stopAnim(nav, 'sheet'); nav.style.removeProperty('height');
        stopAnim(mc, 'layout'); mc.style.removeProperty('transform');
        removePanel('closed');
        setVariant(nav, MV.closed);   // instant: the sheet snaps shut
        stop(false); roll(false);
      }
      function enterSub(name) {
        if (state !== 'options') return;
        sub(name).then(function (fr) {
          if (state !== 'options') return;
          var src = fr.querySelector(PANEL[name]); if (!src) return;
          state = name;
          panel = src.cloneNode(true);
          if (options && options.parentNode) options.remove();
          mc.appendChild(panel);
          setVariant(nav, MV[name]);
          stop(name === 'collections');       // the template locks the page only for Options + Collections
          anim(panel, 'in', { opacity: 0.001, transform: 'translateX(29px)' }, { opacity: 1, transform: 'translateX(0px)' }, T.stiff);
          bindPanel(panel);
        });
      }
      function back() {
        if (state === 'closed' || state === 'options') return;
        var h0 = mc.getBoundingClientRect().height;
        removePanel('open');
        state = 'options';
        setVariant(nav, MV.options);
        stop(true);
        /* Menu Content Mobile's own layout animation (measured: scaleY old/new -> 1, spring 500/60) */
        var h1 = mc.getBoundingClientRect().height;
        if (h1 > 0 && Math.abs(h1 - h0) > 1) {
          mc.style.transformOrigin = '50% 0';
          anim(mc, 'layout', { transform: 'scaleY(' + (h0 / h1) + ')' }, { transform: 'none' }, T.stiff);
        }
      }
      function bindPanel(p) {
        /* back row ("< Title"): Collections .dypy74 (left half of its title row), Products .llpdqz, Brand .1a2omuy */
        var backRow = $('.framer-dypy74, .framer-llpdqz, .framer-1a2omuy', p);
        if (backRow) {
          backRow.style.cursor = 'pointer';
          backRow.addEventListener('click', function (ev) { if (!ev.target.closest('a')) { ev.preventDefault(); back(); } });
        }
        p.addEventListener('click', function (ev) { if (ev.target.closest('a')) after(100, closeSheet); });
      }
      btnWrap.style.cursor = 'pointer';
      btnWrap.addEventListener('click', function (ev) { ev.preventDefault(); if (state === 'closed') openSheet(); else closeSheet(); });
      if (optClosed) bindOptions(optClosed);
      if (E.bp() !== 'D') idle(loadOpen);
      /* in the open states, the logo closes the menu (after 100ms; immediately from Brand) */
      var logo = $('.framer-1i12zpq', nav);
      if (logo) logo.addEventListener('click', function () { if (state !== 'closed') after(state === 'brand' ? 0 : 100, closeSheet); });
      window.addEventListener('resize', function () { if (E.bp() === 'D') closeSheet(); });
      return { nav: nav, bp: bp, close: closeSheet, open: openSheet, enter: enterSub, back: back, state: function () { return state; } };
    }
    function closeMobileMenus(delay) { M.forEach(function (m) { if (m && m.state() !== 'closed') after(delay || 0, m.close); }); }

    /* ================================================================== DRAWERS (cart, search) */
    var overlayRoot = document.getElementById('template-overlay');
    if (!overlayRoot) {
      overlayRoot = document.createElement('div'); overlayRoot.id = 'template-overlay';
      ($('.framer-ipn91j') || document.body).appendChild(overlayRoot);
    }
    var htmlLocks = 0;
    function lockHtml(on) {
      htmlLocks = Math.max(0, htmlLocks + (on ? 1 : -1));
      if (htmlLocks) document.documentElement.style.overflow = 'hidden';
      else document.documentElement.style.removeProperty('overflow');
    }
    /* a right-hand drawer: backdrop rgba(ink,.3) fades, panel slides x 451 -> 0, both tween 1s [.76,0,.24,1] */
    function Drawer(bdSel, panelSel) {
      var d = { root: null, open: false, bd: null, panel: null };
      d.mount = function (rootEl) {
        d.root = rootEl;
        d.bd = $(bdSel, rootEl); d.panel = $(panelSel, rootEl);
        d.bd.style.opacity = '0'; d.panel.style.transform = 'translateX(451px)';
        d.bd.addEventListener('click', function () { d.hide(); });
        overlayRoot.appendChild(rootEl);
      };
      d.show = function () {
        if (d.open) return; d.open = true;
        lockHtml(true);
        anim(d.bd, 'o', null, { opacity: 1 }, T.drawer);
        anim(d.panel, 'x', null, { transform: 'translateX(0px)' }, T.drawer);
        d.onshow && d.onshow();
      };
      d.hide = function () {
        if (!d.open) return; d.open = false;
        lockHtml(false);
        d.onhide && d.onhide();
        anim(d.bd, 'o', null, { opacity: 0 }, T.drawer);
        anim(d.panel, 'x', null, { transform: 'translateX(451px)' }, T.drawer).then(function (done) {
          if (done && !d.open && d.root) { d.root.remove(); d.root = null; d.removed && d.removed(); }
        });
      };
      return d;
    }

    /* ------------------------------------------------------------------ cart */
    var cart = Drawer('.framer-1d9lyun', '.framer-10smc2w-container');
    var cartTpl = null, cartBp = null, slider = null, internalCart = false, lastCount = E.cart.count();
    function cartTemplates() {
      var bp = E.bp();
      if (!cartTpl || cartBp !== bp) {
        cartBp = bp;
        cartTpl = Promise.all([frag('cart-empty-' + bp), frag('cart-item-' + bp)]).then(function (r) { return { empty: r[0], item: r[1] }; });
      }
      return cartTpl;
    }
    function cartItems() {
      return E.cart.items().map(function (it, i) { return { it: it, i: i, p: E.product(it.slug) }; }).filter(function (x) { return x.p; });
    }
    function openCart() {
      if (cart.open) { renderCart(); return Promise.resolve(); }
      return cartTemplates().then(function (t) {
        if (cart.open) return;
        if (!cart.root) {
          var root = t.empty.firstElementChild.cloneNode(true);   // wrapper: backdrop + panel container
          var h = $('.framer-79ux7l-container > div', root); if (h) h.innerHTML = '';
          cart.mount(root);
        }
        renderCart();
        cart.show();
      });
    }
    function closeCart() { cart.hide(); }
    function toggleCart() { return cart.open ? closeCart() : openCart(); }
    cart.onhide = function () { if (slider) slider.stop(); };
    cart.onshow = function () { if (slider) slider.start(); };
    cart.removed = function () { slider = null; };
    E.openCart = openCart; E.closeCart = closeCart; E.toggleCart = toggleCart;

    function renderCart() {
      if (!cart.root) return;
      cartTemplates().then(function (t) {
        if (!cart.root) return;
        var holder = $('.framer-79ux7l-container > div', cart.root);
        var items = cartItems();
        var cur = holder.firstElementChild;
        var wantEmpty = !items.length;
        var isEmpty = cur && cur.classList.contains('framer-z8mo5y');
        if (!cur || wantEmpty !== isEmpty || !wantEmpty) {
          var next = (wantEmpty ? t.empty.querySelector('.framer-z8mo5y') : t.item.querySelector('.framer-hh2ydx')).cloneNode(true);
          if (cur) cur.replaceWith(next); else holder.appendChild(next);
          if (slider) { slider.stop(); slider = null; }
          if (wantEmpty) fillEmpty(next); else fillCart(next, items, t.item);
          bindCloseButton($('.framer-cBU43', next), closeCart);
        }
      });
    }
    function bindCloseButton(btn, fn) {
      if (!btn) return;
      var x = $('.framer-1t50f4n', btn) || btn.firstElementChild;
      btn.addEventListener('click', function (ev) { ev.preventDefault(); fn(); });
      btn.addEventListener('mouseenter', function () { anim(x, 'r', null, { transform: 'rotate(90deg)' }, T.stiff); });
      btn.addEventListener('mouseleave', function () { btn.classList.remove('pressed'); anim(x, 'r', null, { transform: 'rotate(0deg)' }, T.stiff); });
      btn.addEventListener('pointerdown', function () { btn.classList.add('pressed'); });
      btn.addEventListener('pointerup', function () { btn.classList.remove('pressed'); });
    }
    function fillCart(root, items, itemFrag) {
      var count = items.reduce(function (a, x) { return a + x.it.qty; }, 0);
      textOf($('.framer-633e9x-container p', root), count);
      var list = $('.framer-f03e8w-container > div', root);
      var rowTpl = itemFrag.querySelector('.framer-f03e8w-container > div > div');
      var err = list.querySelector(':scope > p');
      list.innerHTML = ''; if (err) list.appendChild(err);
      items.forEach(function (x, n) {
        if (n > 0) {
          var dv = document.createElement('div');
          dv.style.cssText = 'width:100%;margin-top:24px;margin-bottom:24px;border-top:1px solid ' + rgb(INKc, 0.08);
          list.appendChild(dv);
        }
        list.appendChild(cartRow(rowTpl.cloneNode(true), x));
      });
      textOf($('.framer-1sz7l5k-container p', root), E.money(E.cart.subtotal()));
      /* Checkout (MOCK): WhatsApp with the order summary */
      var co = $('.framer-7t05l9', root), coBg = $('.framer-FZmwE', root);
      if (co) {
        co.style.cursor = 'pointer';
        co.addEventListener('click', function (ev) { ev.preventDefault(); checkout(); });
        co.addEventListener('mouseenter', function () { anim(coBg, 'bg', null, { backgroundColor: ramp(33) }, T.soft); });
        co.addEventListener('mouseleave', function () { anim(coBg, 'bg', null, { backgroundColor: INK }, T.soft); });
      }
    }
    function cartRow(row, x) {
      var p = x.p, it = x.it;
      var img = $('img', row);
      setImg(img, P + p.img, p.name);
      textOf(row.querySelector('p[style*="110%"]'), p.name);   // title (Inter 14 / 110%)
      var spans = $$('span', row);
      var vline = spans.length >= 2 ? spans[0].parentElement : null;
      if (vline) {
        if (it.variant) {
          if ((p.amounts || []).indexOf(it.variant) >= 0) textOf(spans[0], 'Amount:');      // gift card
          else if ((p.sizes || []).indexOf(it.variant) < 0) spans[0].style.display = 'none';
          textOf(spans[1], it.variant);
        } else vline.style.display = 'none';
      }
      var priceP = $$('p', row).filter(function (q) { return /^\s*\S*\d/.test(q.textContent) && q.style.whiteSpace === 'nowrap'; })[0];
      if (priceP) {
        textOf(priceP, E.money(E.unitPrice(p, it.variant) * it.qty));
        if (p.compare && p.compare > p.price) {
          var cp = priceP.cloneNode(true);
          cp.textContent = E.money(p.compare * it.qty);
          cp.style.color = rgb(INKc, 0.4); cp.style.textDecoration = 'line-through';
          priceP.parentNode.appendChild(cp);
        }
      }
      var btns = $$('button', row), qty = null;
      $$('span', row).forEach(function (s) { if (/^\s*\d+\s*$/.test(s.textContent) && s.parentElement.querySelector('button')) qty = s; });
      textOf(qty, it.qty);
      function set(q) { internalCart = true; E.cart.set(x.i, q); internalCart = false; }
      if (btns[0]) btns[0].addEventListener('click', function (ev) { ev.stopPropagation(); set(it.qty - 1); });
      if (btns[1]) btns[1].addEventListener('click', function (ev) { ev.stopPropagation(); set(it.qty + 1); });
      if (btns[2]) btns[2].addEventListener('click', function (ev) { ev.stopPropagation(); set(0); });
      var link = row.firstElementChild || row;
      link.addEventListener('mouseenter', function (ev) { if (img && !ev.target.closest('button')) img.style.opacity = '0.75'; });
      link.addEventListener('mouseleave', function () { if (img) img.style.opacity = ''; });
      link.addEventListener('click', function (ev) { if (!ev.target.closest('button')) location.href = productUrl(p); });
      return row;
    }
    /* the checkout page (js/m-checkout.js) takes it from here; on the checkout page itself just close */
    function checkout() {
      if (!cartItems().length) return;
      if (E.page === 'checkout') { closeCart(); return; }
      location.href = P + 'checkout/';
    }
    /* empty state: "Popular Items" slideshow (4 cards, bestsellers first; 2.5 per view, gap 16, arrows,
       autoplay every 2s, spring 200/40, loops; tapping a card closes the drawer) */
    function popular() {
      var all = (E.DATA.products || []).filter(function (p) { return p.price > 0; });
      var best = all.filter(function (p) { return (p.tags || []).indexOf('bestseller') >= 0; });
      var rest = all.filter(function (p) { return best.indexOf(p) < 0; });
      return best.concat(rest).slice(0, 4);
    }
    function fillEmpty(root) {
      var ul = $('.framer-5uq45a-container ul', root);
      if (!ul) return;
      var lis = $$(':scope > li', ul);
      var tpls = lis.slice(0, 4).map(function (li) { return li.cloneNode(true); });
      var prods = popular();
      ul.innerHTML = '';
      var setLis = prods.map(function (p, i) { return fillPopular(tpls[i % tpls.length].cloneNode(true), p); });
      /* four copies of the set (as the live slideshow renders), starting at the second */
      for (var c = 0; c < 4; c++) setLis.forEach(function (li) {
        var n = li.cloneNode(true);
        var slide = n.firstElementChild; if (slide) slide.style.visibility = 'visible';
        ul.appendChild(n);
      });
      appearPrice($$('.framer-1l4qhq9, .framer-1e5sxje-container', ul));
      ul.addEventListener('click', function (ev) { if (ev.target.closest('a')) after(0, closeCart); });
      slider = Slider(ul, prods.length, $('button[aria-label="Previous"]', root), $('button[aria-label="Next"]', root));
    }
    function fillPopular(li, p) {
      var a = $('a', li); if (a) a.href = productUrl(p);
      var sw = $('[data-framer-name="Slider Wrapper"]', li); if (sw) sw.setAttribute('href', productUrl(p));
      setImg($('[data-framer-name="Image 1"] img', li), P + p.img, p.name);
      setImg($('[data-framer-name="Image 2"] img', li), P + (p.img2 || p.img), '');
      var ps = $$('[data-framer-name="Title"] p', li);
      textOf(ps[0], p.name); textOf(ps[1], p.cat || p.type || '');
      var pr = $('.framer-1e5sxje-container p', li); textOf(pr, E.money(p.price));
      var disc = $('.framer-1l4qhq9', li);
      if (disc) {
        disc.innerHTML = '';
        if (p.compare && p.compare > p.price && pr) {
          var cp = pr.parentElement.cloneNode(true), q = $('p', cp);
          q.textContent = E.money(p.compare); q.style.textDecoration = 'line-through 1px ' + INK;
          var w = document.createElement('div'); w.style.opacity = '0.4'; w.appendChild(cp); disc.appendChild(w);
        }
      }
      return li;
    }
    /* Framer Slideshow, measured live: one card per step (card + gap = 174px at 450 wide), autoplay every
       2s from the last move, spring 200/40; a full set later it jumps back one set (invisible) */
    function Slider(ul, n, prevBtn, nextBtn) {
      var idx = n, timer = null;
      function step() {
        var a = ul.children[0], b = ul.children[1];
        if (!a || !b || !a.firstElementChild || !b.firstElementChild) return 174;
        return b.firstElementChild.getBoundingClientRect().left - a.firstElementChild.getBoundingClientRect().left || 174;
      }
      function curX() { try { return new DOMMatrix(getComputedStyle(ul).transform).m41; } catch (e) { return -idx * step(); } }
      function go(dir) {
        if (!n) return;
        stopAnim(ul, 'x');
        var s = step(), x = curX();
        if (dir > 0 && idx + 1 > 2 * n) { idx -= n; x += n * s; }
        if (dir < 0 && idx - 1 < n) { idx += n; x -= n * s; }
        ul.style.transform = 'translateX(' + x + 'px)';
        idx += dir;
        anim(ul, 'x', { transform: 'translateX(' + x + 'px)' }, { transform: 'translateX(' + (-idx * step()) + 'px)' }, T.slide);
        arm();
      }
      function arm() { clearInterval(timer); timer = setInterval(function () { if (cart.open && ul.isConnected) go(1); }, 2000); }
      ul.style.transform = 'translateX(' + (-idx * step()) + 'px)';
      arm();
      if (prevBtn) prevBtn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); go(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); go(1); });
      return { stop: function () { clearInterval(timer); }, start: arm, go: go, index: function () { return idx; } };
    }
    /* cart changes: re-render, keep counters in sync, open after an add-to-cart */
    document.addEventListener('embun:cart', function (ev) {
      updateCounts();
      var n = E.cart.count();
      var grew = n > lastCount; lastCount = n;
      var wantOpen = ev.detail && ev.detail.open === true;
      if (wantOpen || (grew && !internalCart && !(ev.detail && ev.detail.open === false))) openCart();
      else if (cart.open) renderCart();
    });
    document.addEventListener('checkout__changed', function (ev) { if (!ev.detail || ev.detail.__triggerCartModal !== false) openCart(); });
    window.addEventListener('storage', function (ev) { if (ev.key === 'embun_cart') { updateCounts(); lastCount = E.cart.count(); if (cart.open) renderCart(); } });

    /* ------------------------------------------------------------------ search */
    var search = Drawer('.framer-job1ua', '.framer-gq5k1x-container');
    var searchTpl = null, searchBp = null, searchTimer = null;
    function searchTemplates() {
      var bp = E.bp();
      if (!searchTpl || searchBp !== bp) {
        searchBp = bp;
        searchTpl = Promise.all([frag('search-empty-' + bp), frag('search-typed-' + bp)]).then(function (r) { return { empty: r[0], typed: r[1] }; });
      }
      return searchTpl;
    }
    function openSearch() {
      if (search.open) return Promise.resolve();
      return searchTemplates().then(function (t) {
        if (search.open) return;
        if (!search.root) {
          var src = t.empty.querySelector('#template-overlay') || t.empty;
          var root = document.createElement('div');
          $$(':scope > *', src).forEach(function (c) { root.appendChild(c.cloneNode(true)); });
          search.mount(root);
          bindSearch(root, t.typed);
        }
        search.show();
      });
    }
    function closeSearch() { search.hide(); }
    E.openSearch = openSearch; E.closeSearch = closeSearch;
    function matches(p, q) {
      q = q.toLowerCase();
      return [p.name, p.cat, p.type].some(function (f) { return f && String(f).toLowerCase().indexOf(q) >= 0; });
    }
    function bindSearch(root, typed) {
      var input = $('input', root), clear = $('button[aria-label="Clear search"]', root) || $('button', root);
      var list = $('.framer-1r8g5xl', root) || $('[data-framer-name="All"]', root);
      var items = $('.framer-rkdj5d', root);
      var cardTpl = typed.querySelector('.framer-1p8c2jy-container');
      var compareTpl = null;
      $$('.framer-awyi5b-container', typed).some(function (c) { if (c.textContent.trim()) { compareTpl = c.cloneNode(true); return true; } return false; });
      input.classList.add('em-search-input');
      function showClear() { if (clear) clear.style.display = input.value ? 'flex' : 'none'; }
      function render(q) {
        list.innerHTML = '';
        if (!q) return;
        var res = (E.DATA.products || []).filter(function (p) { return matches(p, q); });
        res.forEach(function (p) { list.appendChild(searchCard(cardTpl.cloneNode(true), p, compareTpl)); });
        appearPrice($$('.framer-kozr9k, .framer-1vgshar-container', list));
      }
      function fire(q) {
        try {
          var u = new URL(location.href);
          if (q) u.searchParams.set('search', q); else u.searchParams.delete('search');
          history.replaceState(history.state, '', u.toString());
        } catch (e) {}
        document.dispatchEvent(new CustomEvent('product-search-change', { detail: { term: q, componentId: 'embun-search' } }));
        render(q);
      }
      input.addEventListener('input', function () {
        showClear();
        clearTimeout(searchTimer);
        searchTimer = after(300, function () { fire(input.value.trim()); });
      });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault(); clearTimeout(searchTimer);
          var q = input.value.trim();
          if (q) location.href = P + 'all/?search=' + encodeURIComponent(q); else fire('');
        } else if (ev.key === 'Escape') {
          clearTimeout(searchTimer); input.value = ''; showClear(); fire(''); input.blur();
        }
      });
      if (clear) clear.addEventListener('click', function (ev) {
        ev.preventDefault(); clearTimeout(searchTimer); input.value = ''; showClear(); fire(''); input.focus();
      });
      if (items) items.addEventListener('click', function () { closeSearch(); });
      var q0 = '';
      try { q0 = new URL(location.href).searchParams.get('search') || ''; } catch (e) {}
      if (q0) { input.value = q0; render(q0); }
      showClear();
    }
    function searchCard(c, p, compareTpl) {
      var a = $('a', c); if (a) a.href = productUrl(p);
      var i1 = $('[data-framer-name="Image 1"]', c), i2 = $('[data-framer-name="Image 2"]', c);
      setImg(i1 && $('img', i1), P + p.img, p.name);
      setImg(i2 && $('img', i2), P + (p.img2 || p.img), '');
      var ps = $$('[data-framer-name="Title"] p', c);
      textOf(ps[0], p.name); textOf(ps[1], p.type || p.cat || '');
      var price = $('.framer-1vgshar-container p', c);
      var code = ' ' + (E.country().currency || 'MYR');
      textOf(price, E.money(p.price) + code);
      var disc = $('.framer-kozr9k', c);
      if (disc) {
        disc.innerHTML = '';
        if (p.compare && p.compare > p.price && compareTpl) {
          var ct = compareTpl.cloneNode(true); textOf($('p', ct), E.money(p.compare) + code); disc.appendChild(ct);
        }
      }
      /* hover: Image 1 hides, Image 2 box 101% -> 100% (spring 357/40) */
      var card = $('.framer-cnv41', c) || c;
      card.addEventListener('mouseenter', function () {
        if (i1) anim(i1, 'o', null, { opacity: 0 }, { type: 'tween', duration: 0 });
        if (i2) anim(i2, 'box', null, { width: '100%', height: '100%', left: '0px' }, T.search);
      });
      card.addEventListener('mouseleave', function () {
        if (i1) anim(i1, 'o', null, { opacity: 1 }, { type: 'tween', duration: 0 });
        if (i2) anim(i2, 'box', null, { width: '101%', height: '101%', left: '-0.688679%' }, T.search)
          .then(function (d) { if (d) { i2.style.removeProperty('width'); i2.style.removeProperty('height'); i2.style.removeProperty('left'); } });
      });
      return c;
    }

    /* ------------------------------------------------------------------ triggers (nav) */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t.closest) return;
      if (!t.closest('.framer-siulff-container')) return;
      if (t.closest('.framer-341hly')) { ev.preventDefault(); toggleCart(); return; }
      if (t.closest('.framer-DUmBR')) { ev.preventDefault(); if (search.open) closeSearch(); else openSearch(); return; }
      if (t.closest('.framer-1ev6h3k')) { ev.preventDefault(); openSearch(); closeMobileMenus(100); return; }
    });
    $$('.framer-341hly, .framer-DUmBR, .framer-1ev6h3k').forEach(function (el) { el.style.cursor = 'pointer'; });
    idle(function () { cartTemplates(); searchTemplates(); });

    /* ================================================================== MODALS (queue: newsletter -> countryA) */
    var MODALS = {
      newsletter: { frag: 'modal-newsletter', holder: '.framer-7q70e4-container', key: 'modal_dismissed_newsletter', days: 1 },
      countryA: { frag: 'modal-country', holder: '.framer-1uwvc4l-container', key: 'modal_dismissed_countryA', days: 30 }
    };
    var ORDER = ['newsletter', 'countryA'];
    var openModals = {};
    function dismissedRecently(name) {
      var m = MODALS[name], v;
      try { v = localStorage.getItem(m.key); } catch (e) { return false; }
      if (!v) return false;
      var t = Date.parse(v); if (isNaN(t)) return false;
      return (Date.now() - t) < m.days * 864e5;
    }
    function dismiss(name) { try { localStorage.setItem(MODALS[name].key, new Date().toISOString()); } catch (e) {} }
    function showModal(name) {
      if (openModals[name]) return;
      var m = MODALS[name];
      var holder = $(m.holder);
      if (!holder) { holder = document.createElement('div'); holder.className = m.holder.slice(1); ($('.framer-ipn91j') || document.body).appendChild(holder); }
      openModals[name] = { opening: true };
      bpFrag(m.frag).then(function (fr) {
        var src = fr.firstElementChild;
        var bd = src && src.firstElementChild;
        if (!bd) { delete openModals[name]; return; }
        bd = bd.cloneNode(true);
        var wrap = bd.firstElementChild;
        var card = wrap.querySelector('.framer-rO7dW, .framer-lvMJU');
        /* start state: backdrop transparent, wrapper translateY(20) + transparent, card presence y 60 / .001 */
        bd.style.opacity = '0'; bd.style.pointerEvents = 'none';
        wrap.style.opacity = '0'; wrap.style.transform = 'translateY(20px)';
        if (card) { card.style.opacity = '0.001'; card.style.transform = 'translateY(60px)'; }
        holder.innerHTML = ''; holder.appendChild(bd);
        E.lock();
        var st = openModals[name] = { bd: bd, wrap: wrap, card: card };
        bd.addEventListener('click', function () { closeModal(name, 'backdrop'); });
        wrap.addEventListener('click', function (ev) { ev.stopPropagation(); });
        $$('.framer-7dcBC', bd).forEach(function (x) {
          x.addEventListener('click', function (ev) { ev.preventDefault(); closeModal(name, 'x'); });
          var box = $('.framer-dpiw86', x);
          x.addEventListener('mouseenter', function () { anim(box, 'r', null, { transform: 'rotate(90deg)' }, T.stiff); });
          x.addEventListener('mouseleave', function () { anim(box, 'r', null, { transform: 'rotate(0deg)' }, T.stiff); });
        });
        if (name === 'newsletter') bindNewsletterModal(bd); else bindCountryModal(bd, name);
        void bd.offsetWidth;
        requestAnimationFrame(function () {
          bd.style.opacity = '1'; bd.style.pointerEvents = 'auto';
          wrap.style.opacity = '1'; wrap.style.transform = 'translateY(0px)';
        });
        /* fallback when rAF is throttled (hidden tab) */
        after(60, function () { if (st.bd && bd.style.opacity === '0') { bd.style.opacity = '1'; bd.style.pointerEvents = 'auto'; wrap.style.opacity = '1'; wrap.style.transform = 'translateY(0px)'; } });
        if (card) anim(card, 'in', { opacity: 0.001, transform: 'translateY(60px)' }, { opacity: 1, transform: 'translateY(0px)' }, T.modalIn);
        window.dispatchEvent(new CustomEvent('modal_opened', { detail: { key: name } }));
      });
    }
    function closeModal(name, how) {
      var st = openModals[name];
      if (!st || !st.bd) return;
      delete openModals[name];
      dismiss(name);
      st.bd.style.opacity = '0'; st.bd.style.pointerEvents = 'none';
      st.wrap.style.opacity = '0'; st.wrap.style.transform = 'translateY(20px)';
      E.unlock();
      window.dispatchEvent(new CustomEvent('modal_closed', { detail: { key: name } }));
      after(300, function () { if (st.bd.parentNode) st.bd.remove(); });
      /* advance the queue: the next undismissed modal (backdrop: after the .3s fade; X / continue: after 100ms) */
      var i = ORDER.indexOf(name);
      for (var k = i + 1; k < ORDER.length; k++) {
        if (!dismissedRecently(ORDER[k])) { var nx = ORDER[k]; after(how === 'backdrop' ? 300 : 100, function () { showModal(nx); }); break; }
      }
    }
    /* newsletter: opens at 30% of the page's scrollable height (re-shows after 1 day) */
    if (!dismissedRecently('newsletter') && E.page !== 'checkout') {   // never interrupt a checkout
      var nlThr = null;
      var nlMeasure = function () {
        var de = document.documentElement, b = document.body;
        var H = Math.max(de.scrollHeight, b.scrollHeight, de.offsetHeight, b.offsetHeight, de.clientHeight);
        nlThr = 0.3 * (H - window.innerHeight);
      };
      onLayout(function () { nlThr = null; });
      window.addEventListener('resize', function () { nlThr = null; });
      var nlScroll = function () {
        if (nlThr == null) nlMeasure();
        if (window.scrollY >= nlThr && nlThr > 0) { window.removeEventListener('scroll', nlScroll); showModal('newsletter'); }
      };
      window.addEventListener('scroll', nlScroll, { passive: true });
    }
    E.openCountry = function () { showModal('countryA'); };
    window.addEventListener('force_show_modal', function (ev) { if (ev.detail && MODALS[ev.detail.key]) showModal(ev.detail.key); });
    document.addEventListener('global_modal_close', function () { Object.keys(openModals).forEach(function (n) { closeModal(n, 'x'); }); });

    /* form buttons: Loading (spinner) -> Success (check), mock - nothing is sent */
    var CHECK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:24px;height:24px;display:block;fill:' + PAGE + '"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>';
    function mockSubmit(form, btn, inner, size) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (form.__done || form.__busy) return;
        if (form.checkValidity && !form.checkValidity()) { form.reportValidity && form.reportValidity(); return; }
        form.__busy = true;
        if (btn) { btn.disabled = true; btn.style.cursor = 'default'; }
        var box = inner || btn;
        var keep = box ? box.innerHTML : '';
        if (box) box.innerHTML = '<div class="em-spinner" style="width:' + (size || 20) + 'px;height:' + (size || 20) + 'px"></div>';
        after(900, function () {
          form.__busy = false; form.__done = true;
          if (box) box.innerHTML = CHECK;
          var input = $('input[type="email"], input', form); if (input) input.blur();
          void keep;
        });
      });
    }
    function bindNewsletterModal(bd) {
      var form = $('form', bd), btn = $('button[type="submit"], .framer-DYTrb', bd);
      if (!form) return;
      if (btn) {
        btn.addEventListener('mouseenter', function () { if (!form.__busy && !form.__done) anim(btn, 'bg', null, { backgroundColor: DEEP }, T.stiff); });
        btn.addEventListener('mouseleave', function () { anim(btn, 'bg', null, { backgroundColor: INK }, T.stiff); });
        btn.addEventListener('pointerdown', function () { if (!form.__done) anim(btn, 'bg', null, { backgroundColor: ramp(51) }, T.stiff); });
      }
      mockSubmit(form, btn, btn, 20);
    }

    /* ------------------------------------------------------------------ country (MOCK store: prices stay in RM) */
    var COUNTRIES = [
      { name: 'Malaysia', code: 'MY', currency: 'MYR', symbol: 'RM' },
      { name: 'Singapore', code: 'SG', currency: 'MYR', symbol: 'RM' },
      { name: 'Brunei', code: 'BN', currency: 'MYR', symbol: 'RM' }
    ];
    var FLAGS = {
      MY: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" preserveAspectRatio="none" style="display:block;width:100%;height:100%"><path fill="#c00" d="M0 0h640v480H0z"/><path fill="#fff" d="M0 34.3h640v34.3H0zm0 68.6h640V137H0zm0 68.5h640v34.3H0zm0 68.6h640v34.3H0zm0 68.6h640v34.3H0zm0 68.6h640V377H0zm0 68.5h640v34.3H0z"/><path fill="#006" d="M0 .5h320v274.3H0z"/><path fill="#fc0" d="m207.5 73.8l6 40.7l23-34l-12.4 39.2l35.5-20.8l-28.1 30l41-3.2l-38.3 14.8l38.3 14.8l-41-3.2l28.1 30l-35.5-20.8l12.3 39.3l-23-34.1l-6 40.7l-5.9-40.7l-23 34l12.4-39.2l-35.5 20.8l28-30l-41 3.2l38.4-14.8l-38.3-14.8l41 3.2l-28.1-30l35.5 20.8l-12.4-39.3l23 34.1zm-33.3 1.7a71 71 0 0 0-100 65a71 71 0 0 0 100 65a80 80 0 0 1-83.2 6.2a80 80 0 0 1-43.4-71.2a80 80 0 0 1 126.6-65"/></svg>',
      SG: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" preserveAspectRatio="none" style="display:block;width:100%;height:100%"><g fill-rule="evenodd"><path fill="#fff" d="M0 0h640v480H0z"/><path fill="#df0000" d="M0 0h640v240H0z"/><path fill="#fff" d="M146 40.2a84.4 84.4 0 0 0 .8 165.2a86 86 0 0 1-106.6-59a86 86 0 0 1 59-106c16-4.6 30.8-4.7 46.9-.2z"/><path fill="#fff" d="m133 110l4.9 15l-13-9.2l-12.8 9.4l4.7-15.2l-12.8-9.3l15.9-.2l5-15l5 15h15.8zm17.5 52l5 15.1l-13-9.2l-12.9 9.3l4.8-15.1l-12.8-9.4l15.9-.1l4.9-15.1l5 15h16zm58.5-.4l4.9 15.2l-13-9.3l-12.8 9.3l4.7-15.1l-12.8-9.3l15.9-.2l5-15l5 15h15.8zm17.4-51.6l4.9 15.1l-13-9.2l-12.8 9.3l4.8-15.1l-12.9-9.4l16-.1l4.8-15.1l5 15h16zm-46.3-34.3l5 15.2l-13-9.3l-12.9 9.4l4.8-15.2l-12.8-9.4l15.8-.1l5-15.1l5 15h16z"/></g></svg>'
    };
    /* Brunei is fetched like the template fetches every flag (Iconify), cached; grey box while loading */
    function flagSvg(code) {
      if (FLAGS[code]) return Promise.resolve(FLAGS[code]);
      var k = 'embun_flag_' + code, c = null;
      try { c = localStorage.getItem(k); } catch (e) {}
      if (c) return Promise.resolve(c);
      return fetch('https://api.iconify.design/flag/' + code.toLowerCase() + '-4x3.svg').then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (s) {
          if (!s) return '';
          s = s.replace(/<svg([^>]*)>/, function (m, a) { return '<svg' + a.replace(/\s(width|height)="[^"]*"/g, '') + ' preserveAspectRatio="none" style="display:block;width:100%;height:100%">'; });
          try { localStorage.setItem(k, s); } catch (e) {}
          return s;
        }).catch(function () { return ''; });
    }
    function currentCountry() {
      var c = E.country();
      for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].code === c.code) return COUNTRIES[i];
      return COUNTRIES[0];
    }
    function putFlag(box, code) {
      if (!box) return;
      box.style.position = box.style.position || 'relative';
      flagSvg(code).then(function (s) {
        var el = box.querySelector('.em-flag');
        if (!el) { el = document.createElement('div'); el.className = 'em-flag'; box.appendChild(el); }
        el.innerHTML = s || '';
      });
    }
    function updateFooterTriggers() {
      var c = currentCountry();
      $$('.framer-0exQF').forEach(function (t) {
        var f = $('.framer-qg7043-container', t);
        if (f) { f.innerHTML = ''; putFlag(f, c.code); }
        var code = $('.framer-ptdurg-container div div', t);
        textOf(code, c.code);
      });
    }
    function bindCountryModal(bd, name) {
      var c = currentCountry();
      var sel = $('select', bd);
      var nameEl = $('.framer-wskwpu-container div div', bd), curEl = $('.framer-1l5l73v-container div div', bd);
      var active = $('.framer-1koc2wq-container div div', bd);
      var capturedName = nameEl ? nameEl.textContent.trim() : '';
      var activeTpl = active ? active.textContent : '';
      var flagBox = $('.framer-s72zy4-container > div', bd);
      var homeBlock = $('.framer-o49acb [data-framer-name^="content-"]', bd);
      function paint(cc) {
        textOf(nameEl, cc.name); textOf(curEl, '(' + cc.currency + ')');
        if (active) active.textContent = capturedName && activeTpl.indexOf(capturedName) >= 0 ? activeTpl.replace(capturedName, cc.name) : activeTpl.replace(/\S+$/, cc.name);
        if (flagBox) putFlag(flagBox, cc.code);
        if (homeBlock) homeBlock.style.display = cc.code === 'MY' ? '' : 'none';
      }
      if (sel) {
        sel.innerHTML = '';
        COUNTRIES.forEach(function (cc) {
          var o = document.createElement('option');
          o.value = cc.currency + '-' + cc.name; o.textContent = cc.name + ' (' + cc.currency + ')';
          if (cc.code === c.code) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () {
          var cc = COUNTRIES[sel.selectedIndex] || COUNTRIES[0];
          E.ls.set('embun_country', { name: cc.name, code: cc.code, currency: cc.currency, symbol: cc.symbol });
          paint(cc); updateFooterTriggers();
          document.dispatchEvent(new CustomEvent('embun:country', { detail: cc }));
        });
      }
      paint(c);
      var dd = $('.framer-QF82u', bd);
      if (dd) {
        dd.addEventListener('mouseenter', function () { anim(dd, 'bg', null, { backgroundColor: ramp(242) }, T.soft); });
        dd.addEventListener('mouseleave', function () { anim(dd, 'bg', null, { backgroundColor: PAGE }, T.soft); });
      }
      var cont = $('.framer-WW9z2', bd);
      if (cont) {
        cont.addEventListener('click', function (ev) { ev.preventDefault(); closeModal(name, 'x'); });
        cont.addEventListener('mouseenter', function () { anim(cont, 'bg', null, { backgroundColor: DEEP }, T.stiff); });
        cont.addEventListener('mouseleave', function () { anim(cont, 'bg', null, { backgroundColor: INK }, T.stiff); });
      }
    }

    /* ================================================================== FOOTER / INSTAGRAM / NEWSLETTER CTA */
    /* footer wordmark symbol: the redrawn mark has no fill of its own but kept the template root's fill="none",
       so it painted nothing; let it inherit the footer's ink fill like the template's mark did */
    var footSym = document.getElementById('svg-699134298_3630');
    if (footSym && footSym.getAttribute('fill') === 'none' && !footSym.querySelector('[fill]:not([fill="none"]), [stroke]')) footSym.removeAttribute('fill');
    /* © year */
    $$('footer .framer-15udh19 > :not(.framer-629nyp-container) p, footer .framer-15udh19 > :not(.framer-629nyp-container)').forEach(function (el) {
      if (el.children.length) return;
      var y = String(new Date().getFullYear());
      if (/(19|20)\d\d|YYYY/.test(el.textContent)) el.textContent = el.textContent.replace(/(19|20)\d\d|YYYY/, y);
    });
    /* country trigger */
    updateFooterTriggers();
    $$('.framer-1l5b1js-container').forEach(function (b) {
      b.style.cursor = 'pointer';
      b.addEventListener('click', function (ev) { ev.preventDefault(); showModal('countryA'); });
      b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showModal('countryA'); } });
    });
    /* Social Link: opacity -> .5 (spring .4/.2); Footer Link Small: .4 -> 1 (spring 500/60) */
    hover(document, '.framer-z2Lwy', function (a) { anim($('.framer-4be8y', a), 'o', null, { opacity: 0.5 }, T.soft); },
      function (a) { anim($('.framer-4be8y', a), 'o', null, { opacity: 1 }, T.soft); });
    hover(document, '.framer-0zoDL', function (a) { anim($('.framer-yk27a5', a), 'o', null, { opacity: 1 }, T.stiff); },
      function (a) { anim($('.framer-yk27a5', a), 'o', null, { opacity: 0.4 }, T.stiff); });
    /* Instagram handle (desktop variant): text 1 -> .4 */
    hover(document, '.framer-wml3D.framer-v-1bmmvrc', function (a) { anim($('.framer-t39cga', a), 'o', null, { opacity: 0.4 }, T.stiff); },
      function (a) { anim($('.framer-t39cga', a), 'o', null, { opacity: 1 }, T.stiff); });
    /* Instagram tile (desktop variant): 20% overlay 0 -> 1, tween .4s linear */
    hover(document, '.framer-mHR1C.framer-v-1mc16af', function (a) { anim($('.framer-1kz0lgl', a), 'o', null, { opacity: 1 }, T.tile); },
      function (a) { anim($('.framer-1kz0lgl', a), 'o', null, { opacity: 0 }, T.tile); });
    /* tile videos autoplay muted while on screen */
    var vids = $$('.framer-mHR1C video');
    if (vids.length && 'IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target; v.muted = true;
          if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
        });
      });
      vids.forEach(function (v) { v.muted = true; v.setAttribute('playsinline', ''); vio.observe(v); });
    }
    /* Instagram marquee card: handle .4 -> .8 (spring .4/.2) */
    hover(document, '.framer-iBiSO', function (a) { anim($('.framer-u8vcz', a), 'o', null, { opacity: 0.8 }, T.soft); },
      function (a) { anim($('.framer-u8vcz', a), 'o', null, { opacity: 0.4 }, T.soft); });
    /* Instagram ticker: 40px/s to the left, seamless, gap 40, pauses off-screen / hidden tab */
    $$('.framer-yFCBh').forEach(initTicker);
    function initTicker(w) {
      var sec = $('section', w), ul = sec && $('ul', sec);
      if (!ul) return;
      var orig = $$(':scope > li', ul), anm = null, built = 0;
      function build() {
        var cw = sec.getBoundingClientRect().width;
        if (!cw) return;
        $$(':scope > li[aria-hidden="true"]', ul).forEach(function (li) { li.remove(); });
        var gap = parseFloat(getComputedStyle(ul).columnGap || getComputedStyle(ul).gap) || 40;
        var first = orig[0].getBoundingClientRect(), last = orig[orig.length - 1].getBoundingClientRect();
        var setW = (last.right - first.left) + gap;
        if (setW <= gap) return;
        var copies = Math.max(1, Math.ceil(cw / setW));
        for (var c = 0; c < copies; c++) orig.forEach(function (li) { var n = li.cloneNode(true); n.setAttribute('aria-hidden', 'true'); ul.appendChild(n); });
        if (anm) anm.cancel();
        anm = ul.animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(' + (-setW) + 'px)' }],
          { duration: setW / 40 * 1000, iterations: Infinity, easing: 'linear' });
        sec.style.opacity = '1';
        built = cw;
      }
      build();
      window.addEventListener('resize', function () { var cw = sec.getBoundingClientRect().width; if (cw && Math.abs(cw - built) > 1) build(); });
      if (!built) window.addEventListener('load', build);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { es.forEach(function (e) { if (!anm) return; if (e.isIntersecting) anm.play(); else anm.pause(); }); }).observe(sec);
      }
      document.addEventListener('visibilitychange', function () { if (anm) { if (document.hidden) anm.pause(); else anm.play(); } });
    }
    /* newsletter CTA: arrow nudges 4px on hover (tween .2s [.44,0,.56,1]); mock submit */
    $$('.framer-0ruLH form').forEach(function (form) {
      var btn = $('button', form);
      if (btn) {
        btn.addEventListener('mouseenter', function () { if (!form.__done && !form.__busy) anim(btn, 'pad', null, { paddingLeft: '4px' }, T.cta); });
        btn.addEventListener('mouseleave', function () { anim(btn, 'pad', null, { paddingLeft: '0px' }, T.cta); });
      }
      var inner = btn && $('.framer-l8vjxn', btn);
      mockSubmit(form, btn, inner, 20);
    });

    /* breakpoint change: close what does not exist at the new breakpoint */
    var lastBp = E.bp();
    window.addEventListener('resize', function () {
      var bp = E.bp(); if (bp === lastBp) return; lastBp = bp;
      if (cart.open) closeCart();
      if (search.open) closeSearch();
      if (bp === 'D') closeMobileMenus(0); else if (D) D.close();
    });

    E.chrome = { desktop: D, mobile: M, cart: cart, search: search, modals: openModals, showModal: showModal, closeModal: closeModal };
  });
})();
