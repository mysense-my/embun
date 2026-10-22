/* Embun — content pages module.
   Pages: about, values, ingredients, environment, stockists, stores, contact, faq, journal,
   journal/<slug>, privacy-policy, return-policy, terms-of-service, 404.
   Re-creates every component behaviour of these pages from _teardown/specs/content-pages.md
   (variant classes, transition objects and triggers are the template's own). Selectors use framer
   classes / data-framer-name / structure only, never visible text. Nav, footer, newsletter and the
   Instagram blocks belong to the chrome module: everything here is scoped to the page's <main>
   (ingredients: section "Main"), plus the article reading-progress bar. */
(function () {
  'use strict';
  var PAGES = /^(about|values|ingredients|environment|stockists|stores|contact|faq|journal|journal__.+|privacy-policy|return-policy|terms-of-service|404)$/;

  EMBUN.mod('content', function (E) {
    if (!PAGES.test(E.page || '')) return;

    /* build.py currently rewrites stylesheet hrefs like a page route ("css/m-content.css/?v=…"),
       which the server answers with HTML. Load our sheet directly when the linked one is missing. */
    var sheetOk = [].some.call(document.styleSheets, function (s) {
      try { return /m-content\.css/.test(s.href || '') && s.cssRules.length > 0; } catch (e) { return false; }
    });
    if (!sheetOk) {
      var ln = document.createElement('link');
      ln.rel = 'stylesheet'; ln.href = (E.prefix || './') + 'css/m-content.css';
      document.head.appendChild(ln);
    }

    /* ------------------------------------------------------------ transitions (spec 0.5) */
    var T = {
      soft: E.T.soft,                                                   // spring .4 / bounce .2
      stiff: E.T.stiff,                                                 // spring 500 / 60 / 1
      mini: { type: 'spring', stiffness: 253, damping: 30, mass: 1 },   // featured mini card
      slow: E.T.out1,                                                   // 1s [.25,1,.5,1]
      expo1: { type: 'tween', duration: 1, ease: [0.16, 1, 0.3, 1] },
      expo09: { type: 'tween', duration: 0.9, ease: [0.16, 1, 0.3, 1] },
      line: { type: 'tween', duration: 0.3, ease: [0.12, 0.23, 0.5, 1] },
      btn: { type: 'tween', duration: 0.2, ease: [0.44, 0, 0.56, 1] },
      snap: { type: 'tween', duration: 0 }
    };
    function tstr(t) { var x = E.tr(t); return x.duration + 'ms ' + x.easing + (x.delay ? ' ' + x.delay + 'ms' : ''); }

    /* colour tokens (values recoloured by the build) */
    var TK = function (id, v) { return 'var(--token-' + id + ', ' + v + ')'; };
    var C = {
      ink: TK('59993e6d-8382-4a43-944c-ec18ed6cd2a3', 'rgb(31, 43, 36)'),
      page: TK('ec38428d-3a31-4b94-abff-9e09e67da8b6', 'rgb(252, 251, 247)'),
      page0: TK('fc9b014d-92ea-47c0-9f1c-f3932f7d9651', 'rgba(252, 251, 247, 0)'),
      ink0: TK('12a37729-6656-4c59-bdfb-59bc401d17bd', 'rgba(31, 43, 36, 0)'),
      page10: TK('01b16fd3-9c24-4b7e-9b9c-1f60faa9647f', 'rgba(252, 251, 247, .1)'),
      page15: 'rgba(252, 251, 247, 0.15)',
      page40: TK('1e614ed9-978e-4fff-abe3-0240f8e6ccb3', 'rgba(252, 251, 247, .4)'),
      page50: TK('24ecfcad-64c2-45bc-b496-b71c8b9107e5', 'rgba(252, 251, 247, .5)'),
      ink30: TK('28850694-9e59-42c0-a7d6-e3c3d942447a', 'rgba(31, 43, 36, .3)'),
      ink40: TK('762528df-c311-4664-8444-addd914c9753', 'rgba(31, 43, 36, .4)'),
      surf: TK('d9611ea7-f867-4794-ae6b-8a3b85dc954c', 'rgb(240, 239, 231)'),
      muted: TK('4e14d7f0-0df5-4d38-b9ad-ea8c870dff4e', 'rgb(199, 201, 188)'),
      deep: TK('533abd80-be95-4bda-96e4-9cdb40d87f9a', 'rgb(51, 68, 58)')
    };

    /* ------------------------------------------------------------ helpers */
    var ROOTS = E.$$('main, section[data-framer-name="Main"]');
    function all(sel) {
      var out = [];
      ROOTS.forEach(function (r) { E.$$(sel, r).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); }); });
      return out;
    }
    function once(el, key) { if (!el || el['__en_' + key]) return false; el['__en_' + key] = 1; el.setAttribute('data-en', key); return true; }
    function vOf(el) {
      for (var i = 0; i < el.classList.length; i++) if (el.classList[i].indexOf('framer-v-') === 0) return el.classList[i];
      return '';
    }
    function setV(el, cls, name) {
      if (!el) return;
      var c = vOf(el);
      if (c !== cls) { if (c) el.classList.remove(c); el.classList.add(cls); }
      if (name) el.setAttribute('data-framer-name', name);
    }
    /* set inline values with a Framer transition. props: {cssProp: value | null (transition only)}.
       Custom properties are set but not listed (they are not interpolable); CSS transitions on the
       properties that read them (color, ::after border) come from m-content.css via --en-bt. */
    function trans(el, props, t) {
      if (!el) return;
      var s = tstr(t), list = [];
      for (var p in props) if (p.indexOf('--') !== 0) list.push(p + ' ' + s);
      el.style.transition = list.join(', ');
      el.style.setProperty('--en-bt', s);
      for (var q in props) if (props[q] != null) el.style.setProperty(q, props[q]);
    }
    function hover(el, fn) {
      el.addEventListener('mouseenter', function () { fn(true); });
      el.addEventListener('mouseleave', function () { fn(false); });
    }
    /* Framer layout animation (FLIP): measure the visual boxes relative to each parent, apply the
       variant change, then animate translate/scale from the old box to the new one. */
    function flip(els, mutate, t) {
      els = els.filter(Boolean);
      var before = els.map(function (el) {
        var pr = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect();
        return { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
      });
      els.forEach(function (el) { if (el.__flip) { el.__flip.cancel(); el.__flip = null; } });
      mutate();
      var x = E.tr(t);
      if (!x.duration || E.reduced) return;
      els.forEach(function (el, i) {
        var pr = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect(), b = before[i];
        var a = { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
        if (!a.w || !a.h) return;
        var sx = b.w / a.w, sy = b.h / a.h, dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) return;
        el.style.transformOrigin = '0 0';
        var an = el.__flip = el.animate(
          [{ transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')' }, { transform: 'none' }],
          { duration: x.duration, delay: x.delay, easing: x.easing });
        an.onfinish = function () { if (el.__flip === an) el.__flip = null; };
      });
    }

    /* ============================================================ 1.1 Page Link Card */
    /* hover-capable variant only (lrex1nuDp); "Page Link Card - Mobile" has no handlers */
    all('.framer-7Yg5D.framer-v-1vvfn8e').forEach(function (a) {
      if (!once(a, 'plc')) return;
      var img = E.$('.framer-19sldy6', a), arrow = E.$('.framer-9k4u1v', a);
      hover(a, function (on) {
        setV(a, on ? 'framer-v-1szu74z' : 'framer-v-1vvfn8e', on ? 'Page Link Card - Hover' : 'Page Link Card');
        trans(img, { transform: on ? 'none' : 'scale(1.04)' }, T.slow);
        trans(arrow, { opacity: on ? '1' : '0', left: null }, T.slow);   // left -20px -> 0 comes from the variant class
      });
    });

    /* ============================================================ 1.3 Featured Product mini card */
    all('.framer-0MDYg.framer-v-w3rkpj').forEach(function (m) {
      if (!once(m, 'fpm')) return;
      hover(m, function (on) {
        setV(m, on ? 'framer-v-rfvmgn' : 'framer-v-w3rkpj', on ? 'Featured Product Mini - Hover' : 'Featured Product Mini');
        trans(m, { 'background-color': on ? C.page15 : C.page10 }, T.mini);
      });
      /* price from the catalogue (RM via EMBUN.money's country symbol) */
      var a = E.$('a[href*="shop/"]', m), slug = a && (a.getAttribute('href').split('shop/')[1] || '').split('/')[0];
      var p = slug && E.product(slug), price = E.$('[data-framer-name="Price"]', m);
      if (p && price) {
        var t = E.$$('p', price);
        if (t.length >= 2) { t[0].textContent = E.country().symbol; t[1].textContent = Number(p.price).toFixed(2); }
      }
    });

    /* ============================================================ 1.4 Underline Button */
    var UB = {  // resting variant -> [IN, OUT, transition]   (OUT +350ms -> resting, T-snap)
      'framer-v-vqers5': ['framer-v-2hnazx', 'framer-v-114litv', T.line, 'Line IN', 'Line OUT'],                // Default
      'framer-v-hpjb0n': ['framer-v-436hcc', 'framer-v-1bvg2rf', T.stiff, 'Navigation Line IN', 'Navigation Line OUT'],   // Navigation Button
      'framer-v-1h0t8vo': ['framer-v-436hcc', 'framer-v-1bvg2rf', T.stiff, 'Navigation Line IN', 'Navigation Line OUT'],  // Navigation Link
      'framer-v-60n25g': ['framer-v-6omz2n', 'framer-v-12ri6yp', T.stiff, 'Underline Link - Uppercase In', 'Underline Link - Uppercase Out'],
      'framer-v-182kxrq': ['framer-v-1y8v8j1', 'framer-v-10pxyew', T.stiff, 'Navigation Line IN', 'Navigation Line OUT']  // Link Small
    };
    all('.framer-KnRPa').forEach(function (b) {
      var rest = vOf(b), m = UB[rest];
      if (!m || !once(b, 'ub')) return;          // Navigation Button Mobile: no hover handlers
      var line = E.$('.framer-nsdj18', b), state = 'rest', rname = b.getAttribute('data-framer-name');
      b.addEventListener('mouseenter', function () {
        if (state !== 'rest') return;           // OUT variants have onMouseEnter: undefined
        state = 'in'; flip([line], function () { setV(b, m[0], m[3]); }, m[2]);
      });
      b.addEventListener('mouseleave', function () {
        if (state !== 'in') return;
        state = 'out'; flip([line], function () { setV(b, m[1], m[4]); }, m[2]);
        setTimeout(function () { state = 'rest'; flip([line], function () { setV(b, rest, rname); }, T.snap); }, 350);
      });
    });

    /* ============================================================ 1.5 Button */
    var BTN = {  // variant -> [hover variant, base {border,bg,text}, hover {border,bg,text}]
      'framer-v-3ua7h2': ['framer-v-1vdng7d', [C.page50, C.page0, C.page], [C.page, C.page, C.ink], 'Primary Button - Hover'],
      'framer-v-16j8pvb': ['framer-v-ffh1q8', [C.page40, C.ink0, C.page], [C.page, C.ink0, C.page], 'Outline Active'],
      'framer-v-12s4k9s': ['framer-v-fxq87', [C.ink30, C.ink0, C.ink], [C.ink, C.ink0, C.ink], 'Outline Black - Active'],
      'framer-v-1886bfo': ['framer-v-sqruz7', [C.ink30, C.ink0, C.ink], [C.ink, C.ink, C.page], 'Outline Black - Active']   // Outline Black to Fill
    };
    all('.framer-8THQX').forEach(function (b) {
      var base = vOf(b), m = BTN[base];
      if (!m || !once(b, 'btn')) return;        // Primary Button - Tablet/Mobile: no hover
      var tx = E.$('.framer-a3dhqf', b), bname = b.getAttribute('data-framer-name');
      b.classList.add('en-bdr'); if (tx) tx.classList.add('en-col');
      hover(b, function (on) {
        var s = on ? m[2] : m[1];
        setV(b, on ? m[0] : base, on ? m[3] : bname);
        trans(b, { '--border-color': s[0], 'background-color': s[1] }, T.stiff);
        if (tx) trans(tx, { '--extracted-r6o4lv': s[2] }, T.stiff);
      });
    });

    /* ============================================================ 1.7 Collections - Card */
    var CC = { 'framer-v-1pp623': 'framer-v-10ry613', 'framer-v-9ki90z': 'framer-v-fpir73' };  // "- Mobile" variants: none
    all('.framer-O5grK').forEach(function (card) {
      var base = vOf(card), hv = CC[base];
      if (!hv || !once(card, 'cc')) return;
      var btn = E.$('.framer-15nduyp', card), tx = E.$('.framer-1o5rh0i', card), cname = card.getAttribute('data-framer-name');
      if (btn) btn.classList.add('en-bdr'); if (tx) tx.classList.add('en-col');
      hover(card, function (on) {
        setV(card, on ? hv : base, on ? cname + ' - Hover' : cname);
        trans(btn, { '--border-color': on ? C.page : C.page40, 'background-color': on ? C.page : C.page0 }, T.soft);
        trans(tx, { '--extracted-r6o4lv': on ? C.ink : C.page }, T.soft);
      });
    });

    /* ============================================================ 1.8 Article Card + Link - Article */
    all('.framer-SChft.framer-v-clgwn6').forEach(function (card) {   // Tablet/Mobile variant has no handlers
      if (!once(card, 'ac')) return;
      var th = E.$('.framer-6z0nx2', card), link = E.$('.framer-qGWhq', card);
      var ln = link && E.$('.framer-2v92af', link), lt = link && E.$('.framer-lmhryy', link);
      hover(card, function (on) {
        setV(card, on ? 'framer-v-ob6glq' : 'framer-v-clgwn6', on ? 'Article Card - Hover' : 'Article Card');
        trans(th, { transform: on ? 'none' : 'scale(1.03)' }, T.slow);
        if (link) flip([ln, lt], function () { setV(link, on ? 'framer-v-jrua2g' : 'framer-v-tpvik9'); }, T.slow);
      });
    });

    /* ============================================================ videos: Framer "on-viewport" autoplay */
    /* muted + loop + playsinline + no controls -> plays while in view, pauses outside. The Video Reel's
       main video (playing:false) is excluded until it is activated. */
    var vids = all('video').filter(function (v) {
      return v.hasAttribute('loop') && (v.muted || v.hasAttribute('muted')) && !v.controls && !v.closest('.framer-1t7j3gw-container');
    });
    if (vids.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) { v.muted = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else v.pause();
        });
      }, { threshold: 0 });
      vids.forEach(function (v) { v.muted = true; io.observe(v); });
    }

    /* ============================================================ 2.1 About: Product Outline */
    var PO_H = { 'framer-v-1j3xmdf': 'framer-v-flnq5r', 'framer-v-qvcblg': 'framer-v-c3zdt', 'framer-v-16fhe4': 'framer-v-d1d46m',
      'framer-v-x4vy2u': 'framer-v-jvbfrl', 'framer-v-1g19dsd': 'framer-v-1lfr76g', 'framer-v-1wurch4': 'framer-v-byff33' };
    var PO_T = { 'framer-v-1xot812': 'framer-v-1ry7e6n', 'framer-v-1om7dcs': 'framer-v-1i6le80', 'framer-v-ppfhbk': 'framer-v-n86v92',
      'framer-v-vrzg9i': 'framer-v-689lrf', 'framer-v-mula2t': 'framer-v-bj2sjj', 'framer-v-10wb3tj': 'framer-v-30cefe' };
    all('.framer-tF6Xn').forEach(function (a) {
      var base = vOf(a), hv = PO_H[base], tp = PO_T[base];
      if ((!hv && !tp) || !once(a, 'po')) return;
      var outline = E.$('.framer-zpiel0', a), fill = E.$('.framer-1nr9d8t', a), on = false;
      var name = a.getAttribute('data-framer-name') || '', hname = name === 'Dispenser' ? 'Dispenser - Hover' : name + ' Hover';
      function go(v) {
        if (v === on) return; on = v;
        setV(a, v ? (hv || tp) : base, v ? hname : name);
        if (tp) a.style.cursor = v ? 'pointer' : '';
        if (outline) outline.style.display = v ? 'none' : '';      // outline is unmounted in the hover variants
        trans(fill, { opacity: v ? '1' : '0' }, T.soft);
      }
      if (hv) hover(a, go);
      else {  // Tablet/Mobile: onTap -> "... Tablet/Mobile Hover"; that variant reverts on mouse leave
        a.addEventListener('click', function () { go(true); });
        a.addEventListener('mouseleave', function () { go(false); });
      }
    });

    /* ============================================================ 2.2 Values: Video Reel */
    all('.framer-XW3hL.framer-v-pvtb1k').forEach(function (reel) {
      if (!once(reel, 'reel')) return;
      reel.addEventListener('click', function () {
        if (vOf(reel) !== 'framer-v-pvtb1k') return;           // one-way: Active has no tap handler
        setV(reel, 'framer-v-17u3xuo', 'Video Reel - Active');
        ['.framer-lxi63v', '.framer-eiurtq', '.framer-ca0jnx-container'].forEach(function (s) {
          var e = E.$(s, reel); if (e) { var v = E.$('video', e); if (v) v.pause(); e.parentNode.removeChild(e); }
        });
        var v = E.$('.framer-1t7j3gw-container video', reel);
        if (v) {
          v.controls = true; v.muted = true; v.preload = 'auto';
          var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
        }
      });
    });

    /* ============================================================ 3.2 Stockists */
    var CITY = [  // row wrapper, component variant, image
      ['framer-o9wu3g', 'framer-v-y91gk8', 'framer-qx63wd'],     // London (default)
      ['framer-374hqq', 'framer-v-1swk6kx', 'framer-1rota3c'],   // Seoul
      ['framer-1c06uk8', 'framer-v-luddif', 'framer-14i9jfe'],   // Vancouver
      ['framer-19t35j6', 'framer-v-q9t2jp', 'framer-kege1q'],    // New York
      ['framer-ugtls', 'framer-v-3tzaas', 'framer-1p4fhw3']      // Los Angeles
    ];
    all('.framer-L6SK7').forEach(function (st) {
      if (vOf(st) === 'framer-v-1jl88ph' || !once(st, 'stk')) return;   // "Tablet / Mobile": no interaction
      var cur = 0;
      function select(i) {
        if (i === cur) return;
        cur = i;
        setV(st, CITY[i][1]);
        CITY.forEach(function (c, k) {
          trans(E.$('.' + c[2], st), { opacity: k === i ? '1' : '0' }, T.stiff);
          var row = E.$('.' + c[0] + ' .framer-i6MZ1', st);
          if (!row) return;
          var on = k === i;
          setV(row, on ? (k === 0 ? 'framer-v-1k8spms' : 'framer-v-1k9mjvy') : 'framer-v-1kxk7j3',
            on ? (k === 0 ? 'Inital State' : 'Stockist Active') : 'Stockist');
          /* dark line draws left -> right; collapsing to width 0 is not layout-animated by Framer (snaps) */
          var dl = E.$('.framer-97ubwm', row);
          if (on) trans(dl, { left: null, width: null }, T.expo09); else if (dl) dl.style.transition = 'none';
          trans(E.$('.framer-3vada1', row), { opacity: on ? '1' : '0.5' }, T.expo09);
        });
      }
      CITY.forEach(function (c, i) {
        var w = E.$('.' + c[0], st);
        if (!w) return;
        /* London's wrapper only has a handler in the Seoul / New York states (mouse enter) and in the
           Los Angeles state (tap); in the Vancouver state it has none (template quirk, kept 1:1) */
        w.addEventListener('mouseenter', function () { if (i === 0 && cur !== 1 && cur !== 3) return; select(i); });
        if (i === 0) w.addEventListener('click', function () { if (cur === 4) select(0); });
      });
      /* no reset on leaving the component: the last hovered city stays selected */
    });

    /* ============================================================ 3.4 Contact */
    all('.framer-ILMJM').forEach(function (a) {          // Social Link - Large
      if (!once(a, 'sll')) return;
      var t = E.$('.framer-14xrq2t', a);
      hover(a, function (on) { setV(a, on ? 'framer-v-ddmayk' : 'framer-v-155gujs', on ? 'Social Link Large - Hover' : 'Social Link Large'); trans(t, { opacity: on ? '0.4' : '1' }, T.stiff); });
    });
    all('form').forEach(function (form) {
      var btn = E.$('.framer-BX7Bz', form);
      if (!btn || !once(form, 'form')) return;
      var label = E.$('.framer-pbauki', btn), p = label && E.$('p', label), submitHTML = p ? p.innerHTML : '';
      var pStyle = p ? p.getAttribute('style') || '' : '';
      var state = 'incomplete', variant = 'default', hov = false, press = false, spinner = null;
      btn.classList.add('en-bdr'); if (label) label.classList.add('en-col');
      function paint() {
        var g = variant === 'default' ? (press ? 'pressed' : hov ? 'hover' : '') : '';
        var bw = g ? '0px' : '1px';
        trans(btn, {
          '--border-top-width': bw, '--border-right-width': bw, '--border-bottom-width': bw, '--border-left-width': bw,
          'background-color': g === 'pressed' ? C.deep : g === 'hover' ? C.ink : 'rgba(31, 43, 36, 0)'
        }, T.btn);
        if (label) trans(label, { '--extracted-r6o4lv': g ? C.page : C.ink }, T.btn);
      }
      function setVariant(v) {
        variant = v;
        setV(btn, { 'default': 'framer-v-wm46l6', loading: 'framer-v-1r9b6vo', success: 'framer-v-5ecixp' }[v],
          { 'default': 'Default', loading: 'Loading', success: 'Success' }[v]);
        if (label) label.style.display = v === 'loading' ? 'none' : '';
        if (p) {
          if (v === 'success') {
            p.textContent = 'Thank you';
            p.setAttribute('style', pStyle.replace(/--framer-font-weight:\s*\d+/, '--framer-font-weight:600')
              .replace(/--framer-text-color:[^;]+;?/, '') + ';--framer-text-color:' + C.ink);
          } else if (v === 'default') { p.innerHTML = submitHTML; p.setAttribute('style', pStyle); }
        }
        if (v === 'loading') {
          if (!spinner) spinner = E.html(SPINNER);
          btn.appendChild(spinner);
        } else if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
        paint();
      }
      btn.addEventListener('mouseenter', function () { hov = true; paint(); });
      btn.addEventListener('mouseleave', function () { hov = false; press = false; paint(); });
      btn.addEventListener('pointerdown', function () { press = true; paint(); });
      document.addEventListener('pointerup', function () { if (press) { press = false; paint(); } });
      E.$$('.framer-form-input', form).forEach(function (inp) {
        function empty() { inp.classList.toggle('framer-form-input-empty', !inp.value); }
        inp.addEventListener('input', empty); empty();
      });
      form.addEventListener('input', function () {
        /* FormContainer reducer: any change -> "complete" (no field is required), which also
           takes the button out of "Thank you" back to "Submit" */
        if (state === 'pending') return;
        state = 'complete';
        if (variant !== 'default') setVariant('default');
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (state !== 'incomplete' && state !== 'complete') return;   // pending / success: submit is a no-op
        state = 'pending'; setVariant('loading');
        /* MOCK: the template POSTs to Framer Forms; nothing is sent here */
        setTimeout(function () { state = 'success'; setVariant('success'); }, 1000);
      });
    });
    var MASK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath fill='%23CCC' d='M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0M2 10a8 8 0 1 0 16 0 8 8 0 0 0-16 0'/%3E%3C/svg%3E\") alpha no-repeat center / cover add";
    var SPINNER = '<div class="framer-ykhuih" data-framer-name="Spinner" style="mask:' + MASK.replace(/"/g, '&quot;') + ';-webkit-mask:' + MASK.replace(/"/g, '&quot;') + '">' +
      '<div class="framer-yhqe0c en-spin" data-framer-name="Conic" style="background:conic-gradient(from 0deg at 50% 50%, rgba(252, 251, 247, 0) 7.2deg, ' + C.ink + ' 342deg);mask:' + MASK.replace(/"/g, '&quot;') + ';-webkit-mask:' + MASK.replace(/"/g, '&quot;') + '">' +
      '<div class="framer-f1uf7p" data-framer-name="Rounding" style="background-color:' + C.ink + ';border-radius:1px;transform:translateX(-50%)"></div></div></div>';

    /* ============================================================ 4.1 FAQ accordion rows */
    var FAQ = {  // closed variant -> [open variant, breakpoint, closed name, open name]
      'framer-v-b25efo': ['framer-v-w0fae7', 'D', 'Question - Desktop', 'Question Desktop - Open'],
      'framer-v-1nszuiz': ['framer-v-a2l22u', 'T', 'Question - Tablet', 'Question - Tablet Open'],
      'framer-v-17y3rq8': ['framer-v-qxfwql', 'P', 'Question - Mobile', 'Question - Mobile Open']
    };
    all('.framer-PA306').forEach(function (row) {
      var base = vOf(row), m = FAQ[base];
      if (!m || !once(row, 'faq')) return;
      var head = E.$('.framer-14phdln', row), ans = E.$('.framer-1ja1cad', row), ic = E.$('.framer-hoi1gp-container', row);
      var icon = E.$('.framer-l45Ii', row), hl = E.$('.framer-rr4e0p', row), vl = E.$('.framer-r49v1o', row);
      var open = false, hov = false;
      function icOpacity() { return open || (hov && m[1] === 'D') ? '0.5' : '1'; }   // hover gesture: Desktop closed only
      function toggle(to) {
        open = to;
        var from = ans.getBoundingClientRect().height;
        if (ans.__a) { ans.__a.cancel(); ans.__a = null; }
        setV(row, open ? m[0] : base, open ? m[3] : m[2]);
        setV(icon, open ? 'framer-v-1wco9yj' : 'framer-v-s42fl', open ? 'Minus' : 'Plus');
        var target = ans.getBoundingClientRect().height, x = E.tr(T.stiff);
        if (!E.reduced) {
          var an = ans.__a = ans.animate([{ height: from + 'px', overflow: 'hidden' }, { height: target + 'px', overflow: 'hidden' }],
            { duration: x.duration, easing: x.easing });
          an.onfinish = function () { if (ans.__a === an) ans.__a = null; };
        }
        var it = open ? T.expo1 : T.stiff;          // to Minus: 1s expo; back to Plus: stiff spring
        trans(hl, { transform: open ? 'rotate(180deg)' : 'none' }, it);
        trans(vl, { transform: open ? 'rotate(180deg)' : 'rotate(90deg)' }, it);
        trans(ic, { opacity: icOpacity() }, T.stiff);
      }
      row.addEventListener('click', function (e) {
        if (!open) toggle(true);                     // closed: the whole row is the tap target
        else if (head.contains(e.target)) toggle(false);   // open: only the question header closes it
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target === row) { e.preventDefault(); toggle(!open); }   // rows are tabindex=0
      });
      if (m[1] === 'D') hover(row, function (on) { hov = on; trans(ic, { opacity: icOpacity() }, T.stiff); });
    });

    /* ============================================================ 4.3 Terms of service: sticky menu + scroll-spy */
    var items = all('.framer-oveda');
    if (items.length) {
      var ids = [], byId = {};
      items.forEach(function (a) {
        var id = decodeURIComponent((a.getAttribute('href') || '').split('#')[1] || '');
        a.__id = id;
        if (id && ids.indexOf(id) < 0) ids.push(id);
        var line = E.$('.framer-655wno', a), label = E.$('.framer-j33h5l', a);
        a.__on = vOf(a) === 'framer-v-1j6larm';
        a.addEventListener('mouseenter', function () { a.__hov = true; paintItem(a); });
        a.addEventListener('mouseleave', function () { a.__hov = false; paintItem(a); });
        a.addEventListener('click', function (e) {
          var t = document.getElementById(id);
          if (!t) return;
          e.preventDefault();
          /* Framer router: scrollIntoView smooth; the chapter's scroll-margin-top:100px lands it 100px down */
          t.scrollIntoView({ behavior: E.reduced ? 'auto' : 'smooth', block: 'start' });
          try { history.pushState(history.state, '', '#' + id); } catch (err) {}
        });
        a.__line = line; a.__label = label;
      });
      var chapters = ids.map(function (id) { return document.getElementById(id); });
      var docTop = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };   // Framer sums offsetTop
      var paintItem = function (a) {
        var on = a.__on;
        setV(a, on ? 'framer-v-1j6larm' : 'framer-v-2vnamd', on ? 'Active' : 'Non-Active');
        trans(a, { gap: null }, T.stiff);
        trans(a.__line, { opacity: on ? '1' : '0', width: null }, T.stiff);
        trans(a.__label, { opacity: on ? '1' : a.__hov ? '0.8' : '0.4' }, T.stiff);   // Non-Active hover .8
      };
      var spy = function () {
        /* item k is Active while top(chapter k) - 101 <= scrollY < top(chapter k+1) - 101;
           before the first threshold every item shows its default (Overview = Active) */
        var y = window.scrollY, act = 0;
        for (var k = 0; k < chapters.length; k++) if (chapters[k] && docTop(chapters[k]) - 101 <= y) act = k;
        var aid = ids[act];
        items.forEach(function (a) {
          var on = a.__id === aid;
          if (on !== a.__on) { a.__on = on; paintItem(a); }
        });
      };
      var ticking = false;
      var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; spy(); }); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      window.addEventListener('load', spy);
      spy();
    }

    /* ============================================================ 5.2 Article: progress bar + share */
    var bar = E.$('.framer-qqkdtf-container > div');
    if (bar) {
      var prog = function () {
        var de = document.documentElement, max = de.scrollHeight - de.clientHeight;
        var v = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        bar.style.transform = 'scaleX(' + v + ')';
      };
      window.addEventListener('scroll', prog, { passive: true });
      window.addEventListener('resize', prog);
      window.addEventListener('load', prog);
      prog();
    }
    all('.framer-2xJkR').forEach(function (b) {
      if (!once(b, 'share')) return;
      hover(b, function (on) {
        setV(b, on ? 'framer-v-ms4426' : 'framer-v-1skz04i', on ? 'Share Article - Hover' : 'Share Article');
        trans(b, { 'background-color': on ? C.muted : C.surf }, T.soft);
      });
      b.addEventListener('click', function () {
        /* template code override: hidden textarea + execCommand('copy') + alert */
        var t = document.createElement('textarea');
        t.value = location.href;
        t.setAttribute('readonly', ''); t.style.position = 'absolute'; t.style.left = '-9999px';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(t);
        alert('URL copied to clipboard!');
      });
    });
  });
})();
