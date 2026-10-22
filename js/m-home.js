/* Embun — home page behaviour (owned by the home agent).
   Hero slideshow, category tabs, Framer "Slideshow" (Featured + Testimonials), Our Shops image
   carousel, countdown, on-viewport video playback, spring easings for the home hover CSS.
   All timings / easings are the template's own (specs/home.md); selectors use framer classes and
   data-framer-name only, never visible text. */
(function () {
  'use strict';
  if (!window.EMBUN || !window.EMBUN.mod) return;

  EMBUN.mod('home', function (E) {
    if (E.page !== 'home') return;
    var $ = E.$, $$ = E.$$;
    var EASE_APPEAR = [0.23, 0.98, 0.56, 1], EASE_OUT_QUART = [0.25, 1, 0.5, 1];
    var MQP = matchMedia('(max-width: 809.98px)');

    /* motion-value helper: E.animate wants framed keyframes */
    function anim(el, from, to, t) { return E.animate(el, E.frame(from), E.frame(to), t); }
    function setV(el, cls, name) {
      if (!el) return;
      el.className.split(/\s+/).forEach(function (c) { if (c.indexOf('framer-v-') === 0) el.classList.remove(c); });
      el.classList.add(cls);
      if (name != null) el.setAttribute('data-framer-name', name);
    }
    function splitMap() {
      try { var s = document.getElementById('embun-split'); return s ? JSON.parse(s.textContent) : {}; } catch (e) { return {}; }
    }
    var SPLIT = splitMap();
    function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

    /* ---------------------------------------------------------------- spring easings for m-home.css */
    (function () {
      var st = document.documentElement.style;
      function v(name, t) { var x = E.tr(t); st.setProperty('--mh-' + name, Math.round(x.duration) + 'ms ' + x.easing); }
      v('soft', E.T.soft);                                              // spring .4 / bounce .2
      v('stiff', E.T.stiff);                                            // spring 500 / 60
      v('mini', { type: 'spring', stiffness: 253, damping: 30, mass: 1 }); // Featured Product mini card
    })();

    /* ---------------------------------------------------------------- on-viewport video (Framer Video, autoplay "on-viewport") */
    var vio = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      });
    }) : null;
    var pio = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting && en.target.preload === 'none') en.target.preload = 'metadata'; });
    }, { rootMargin: '10% 0px 10% 0px' }) : null;
    function prepVideo(v) {
      if (v.__mh) return; v.__mh = true;
      v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
      v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.setAttribute('loop', '');
      if (vio) { vio.observe(v); pio.observe(v); } else { v.autoplay = true; }
    }
    $$('main video').forEach(prepVideo);

    /* ================================================================ 1. HERO */
    (function hero() {
      var host = $('.framer-9xhxgd-container');
      if (!host) return;
      var wrapD = host.querySelector('.ssr-variant.hidden-3yezbh') || host;
      var wrapP = host.querySelector('.ssr-variant.hidden-72rtr7.hidden-gf41c5') || host;
      var CHAR0 = 'translateX(0px) translateY(30px) scale(1) rotate(0deg) skewX(0deg) skewY(0deg)';
      var TOKEN;
      try { TOKEN = new RegExp('\\p{Regional_Indicator}{2}|\\p{Emoji}\\p{Emoji_Modifier}?\\p{Variation_Selector}?(?:\\u{200d}\\p{Emoji}\\p{Emoji_Modifier}?\\p{Variation_Selector}?)*|.', 'gu'); }
      catch (e) { TOKEN = /[\s\S]/g; }
      var LINE = { loading: ['framer-v-1ivm8vk', 'Loading'], active: ['framer-v-zoxjzn', 'Active'],
        rest0: ['framer-v-ix94l7', 'Non-Active Resting'], rest1: ['framer-v-um2t3x', 'Active Resting'],
        mLoading: ['framer-v-1c01wag', 'Active Mobile Loading'], mActive: ['framer-v-1vsq4tv', 'Active Mobile'],
        mNon: ['framer-v-c43p91', 'Non-Active Mobile'] };
      var SLIDE = { D: [['framer-v-1q0qmuz', 'Slide 1'], ['framer-v-19usgxm', 'Slide 2'], ['framer-v-1gn3f0x', 'Slide 3']],
        P: [['framer-v-199xbi6', 'Slide 1 - Mobile'], ['framer-v-1d440b3', 'Slide 2 - Mobile'], ['framer-v-168yxga', 'Slide 3 - Mobile']] };
      var cur = 0, token = 0, timer = null, timers = [], set = curSet(), inView = true;

      function curSet() { return MQP.matches ? 'P' : 'D'; }
      function wrapFor(s) { return s === 'P' ? wrapP : wrapD; }
      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function clearTimers() { timers.forEach(clearTimeout); timers = []; }
      ['hero-s1', 'hero-s2', 'hero-s3'].forEach(function (n) { E.frag(n + '-' + E.bp()); });

      /* --- text appear effect (Framer "appear", tokenization line) */
      function splitText(el) {
        var t = norm(el.textContent);
        if (SPLIT[t] != null) t = SPLIT[t];
        el.textContent = '';
        var words = t.split(' '), chars = [];
        words.forEach(function (w, i) {
          var ws = document.createElement('span');
          ws.style.whiteSpace = w.length <= 12 ? 'nowrap' : 'unset';
          (w.match(TOKEN) || []).forEach(function (ch) {
            var c = document.createElement('span');
            c.style.cssText = 'display:inline-block;opacity:0.001;transform:' + CHAR0;
            c.textContent = ch; ws.appendChild(c); chars.push(c);
          });
          el.appendChild(ws);
          if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
        return chars;
      }
      function groupLines(chars) {   // chunk-LVOJWNT2 ej(): new line when offsetTop changes
        var out = [], line = [], top = null;
        chars.forEach(function (c) {
          var o = c.offsetTop, h = c.offsetHeight;
          if (!h || top === null || o === top) line.push(c); else { out.push(line); line = [c]; }
          if (h) top = o;
        });
        out.push(line); return out;
      }
      function playText(chars, startDelay) {
        groupLines(chars).forEach(function (line, li) {
          line.forEach(function (c) {
            anim(c, { opacity: 0.001, y: 30 }, { opacity: 1, y: 0 },
              { type: 'tween', duration: 2, delay: startDelay + li * 0.1, ease: EASE_APPEAR });
          });
        });
      }
      function texts(sec) {
        return [[sec.querySelector('[data-framer-name="Eyebrow"] p, [data-framer-name="Eyebrow"] .framer-text'), 0.2],
          [sec.querySelector('[data-framer-name="Title"] h1, [data-framer-name="Title"] .framer-text'), 0.3]];
      }

      /* --- prepare a freshly parsed slide (captured fragment) in its mount start state */
      function prepare(sec, i, s) {
        setV(sec, SLIDE[s][i][0], SLIDE[s][i][1]);
        texts(sec).forEach(function (x) { if (x[0]) splitText(x[0]); });
        $$('.framer-vnkgi2-container a p, .framer-vnkgi2-container a .framer-text', sec).forEach(function (p) {
          var t = norm(p.textContent); if (SPLIT[t] != null) p.textContent = SPLIT[t];
        });
        var media = sec.querySelector('.framer-1v6k9rf-container, .framer-14dpw9y');
        if (media) {
          var zoom = media.classList.contains('framer-14dpw9y') || (s === 'P' && i === 1);
          media.style.opacity = '0.001';
          media.style.transform = zoom ? 'scale(1.1)' : 'none';
          media.__zoom = zoom;
        }
        var btn = sec.querySelector('.framer-vnkgi2-container');
        if (btn) { btn.style.opacity = '0.001'; btn.style.transform = 'translateY(30px)'; }
        $$('.framer-1q43ixw', sec).forEach(function (l) { l.style.removeProperty('transform'); l.style.removeProperty('transform-origin'); l.style.removeProperty('opacity'); });
        $$('.framer-WzSTM, .framer-WzSTM > *', sec).forEach(function (a) { a.style.removeProperty('transform'); a.style.removeProperty('transform-origin'); });
        $$('video', sec).forEach(function (v) { v.removeAttribute('autoplay'); v.preload = 'auto'; });
      }

      /* --- indicator lines */
      function indicators(sec, i, s, my) {
        var comps = ['Tap Area 1', 'Tap Area 2', 'Tap Area 3'].map(function (n) {
          return sec.querySelector('[data-framer-name="' + n + '"] .framer-eTUtC');
        });
        comps.forEach(function (c, j) {
          if (!c) return;
          var line = c.querySelector('.framer-1la7rug'), fill = c.querySelector('.framer-1q43ixw');
          if (s === 'P') {
            if (fill) fill.remove();
            if (j === i) {
              setV(c, LINE.mLoading[0], LINE.mLoading[1]); if (line) line.style.opacity = '0.2';
              later(function () {
                if (my !== token) return;
                setV(c, LINE.mActive[0], LINE.mActive[1]);
                if (line) E.animate(line, { opacity: 0.2 }, { opacity: 1 }, { type: 'tween', duration: 0.5, ease: [0, 0, 1, 1] });
              }, 100);
            } else { setV(c, LINE.mNon[0], LINE.mNon[1]); if (line) line.style.opacity = '0.2'; }
            return;
          }
          if (line) line.style.opacity = '0.2';
          if (j < i) setV(c, LINE.rest1[0], LINE.rest1[1]);
          else if (j > i) setV(c, LINE.rest0[0], LINE.rest0[1]);
          else {
            setV(c, LINE.loading[0], LINE.loading[1]);
            later(function () {
              if (my !== token || !fill) return;
              /* Loading -> Active: Line-Active width 0% -> 100%, tween 6s linear (Framer layout animation = scaleX from the left) */
              fill.style.transformOrigin = '0% 50%';
              fill.style.transform = 'scaleX(0)';
              setV(c, LINE.active[0], LINE.active[1]);
              var a = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 6000, easing: 'linear', fill: 'forwards' });
              a.onfinish = function () { fill.style.transform = 'none'; a.cancel(); };
            }, 100);
          }
        });
      }

      /* --- Hero Arrow: Arrow 1 --900ms--> Arrow 2 (1s [.16,1,.3,1] layout move) --900ms--> Arrow 1 (instant) */
      function arrow(sec, my) {
        var root = sec.querySelector('.framer-WzSTM');
        if (!root) return;
        var glyphs = Array.prototype.slice.call(root.children), running = [];
        setV(root, 'framer-v-u6vdwg', 'Arrow 1');
        function toArrow2() {
          if (my !== token) return;
          var before = glyphs.map(function (g) { return g.offsetTop; });
          setV(root, 'framer-v-1fvux05', 'Arrow 2');
          running = glyphs.map(function (g, k) {
            var d = before[k] - g.offsetTop;
            return g.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)' });
          });
          later(toArrow1, 900);
        }
        function toArrow1() {
          if (my !== token) return;
          running.forEach(function (a) { a.cancel(); }); running = [];
          setV(root, 'framer-v-u6vdwg', 'Arrow 1');
          later(toArrow2, 900);
        }
        later(toArrow2, 900);
      }

      function setup(sec, i, s, first) {
        var my = token;
        texts(sec).forEach(function (x) { if (x[0]) playText(splitText(x[0]), x[1]); });
        if (!first) {
          var media = sec.querySelector('.framer-1v6k9rf-container, .framer-14dpw9y');
          if (media) anim(media, { opacity: 0.001, scale: media.__zoom ? 1.1 : 1 }, { opacity: 1, scale: 1 },
            { type: 'tween', duration: 2, delay: 0, ease: EASE_OUT_QUART });
          var btn = sec.querySelector('.framer-vnkgi2-container');
          if (btn) anim(btn, { opacity: 0.001, y: 30 }, { opacity: 1, y: 0 }, { type: 'tween', duration: 2, delay: 0.6, ease: EASE_APPEAR });
        }
        indicators(sec, i, s, my);
        arrow(sec, my);
        $$('video', sec).forEach(function (v) {
          prepVideo(v);
          if (inView) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        });
        timer = later(function () { if (my === token) mount((cur + 1) % 3); }, 6000);
      }

      function mount(i, first) {
        var s = curSet(), w = wrapFor(s), my = ++token;
        clearTimers(); cur = i; set = s;
        if (first) { var sec0 = w.querySelector('section'); if (sec0) setup(sec0, i, s, true); return; }
        E.frag('hero-s' + (i + 1) + '-' + E.bp()).then(function (html) {
          if (my !== token) return;
          var node = html ? E.html(html) : null;
          var sec = node && (node.tagName === 'SECTION' ? node : node.querySelector('section'));
          var old = w.querySelector('section');
          if (!sec) { if (old) setup(old, i, s, false); return; }
          prepare(sec, i, s);
          if (old) {
            $$('video', old).forEach(function (v) { v.pause(); if (vio) { vio.unobserve(v); pio.unobserve(v); } });
            old.replaceWith(sec);
          } else w.appendChild(sec);
          setup(sec, i, s, false);
        });
      }

      host.addEventListener('click', function (e) {
        var ta = e.target.closest('[data-framer-name^="Tap Area"]');
        if (ta && host.contains(ta)) {
          var j = parseInt(ta.getAttribute('data-framer-name').replace(/\D+/g, ''), 10) - 1;
          if (j >= 0 && j < 3 && j !== cur) mount(j);
          return;
        }
        if (e.target.closest('.framer-iul2s6-container')) {
          var next = host.nextElementSibling, top = host.getBoundingClientRect().bottom + scrollY;
          if (next) top = next.getBoundingClientRect().top + scrollY;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
      host.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-framer-name^="Tap Area"]')) { e.preventDefault(); e.target.click(); }
      });
      if ('IntersectionObserver' in window) new IntersectionObserver(function (ents) { inView = ents[0].isIntersecting; }).observe(host);
      var onBp = function () {
        ['hero-s1', 'hero-s2', 'hero-s3'].forEach(function (n) { E.frag(n + '-' + E.bp()); });
        if (curSet() !== set) mount(cur);
      };
      if (MQP.addEventListener) MQP.addEventListener('change', onBp); else MQP.addListener(onBp);
      mount(0, true);
      E.hero = { go: function (i) { mount(i); }, current: function () { return cur; } };
    })();

    /* ================================================================ 2. CATEGORY TABS */
    (function tabs() {
      var secs = $$('section.framer-lVFTB');
      if (!secs.length) return;
      var VC = { D: [['framer-v-1dyn2az', 'Section Category Tabs'], ['framer-v-1qdbp4w', 'Desktop Tab 2'], ['framer-v-opo2tj', 'Desktop Tab 3']],
        T: [['framer-v-15pz2kw', 'Tablet Tab 1'], ['framer-v-vq2n6d', 'Tablet Tab 2'], ['framer-v-iicwwi', 'Tablet Tab 3']],
        P: [['framer-v-1o59x17', 'Mobile Tab 1'], ['framer-v-ipvyvm', 'Mobile Tab 2'], ['framer-v-7hsu91', 'Mobile Tab 3']] };
      var TAB_ON = ['framer-v-146atc3', 'Tab - Active'];
      var TAB_OFF = { D: ['framer-v-ejt9fw', 'Tab - Non Active'], T: ['framer-v-1mgaqz4', ' Tab - Non Active Tablet/Mobile'] };
      TAB_OFF.P = TAB_OFF.T;
      var all = (E.DATA && E.DATA.products) || [];
      /* template: CMS products, limit 4, ordered by Price desc. Trending = all (the template's price
         field is a string, so its kits never reach the top 4 — single products only reproduces it),
         Bestsellers = tag "bestseller", Kits = category "Kits". Ties keep catalogue (relevance) order. */
      function priceDesc(list) {
        return list.map(function (p, i) { return [p, i]; })
          .sort(function (a, b) { return (b[0].price - a[0].price) || (a[1] - b[1]); })
          .map(function (x) { return x[0]; }).slice(0, 4);
      }
      var single = function (p) { return !/^(kits|giftcards?)$/i.test(p.cat || ''); };
      var LISTS = [
        priceDesc(all.filter(single)),
        priceDesc(all.filter(function (p) { return (p.tags || []).some(function (t) { return /bestseller/i.test(t); }); })),
        priceDesc(all.filter(function (p) { return /^kits?$/i.test(p.cat || ''); }))
      ];
      var newTagSample = $('.framer-STyoJ .framer-1x6zz0g');
      newTagSample = newTagSample ? newTagSample.cloneNode(true) : null;
      var active = 0, TABSEL = '[data-framer-name="Tab 1"],[data-framer-name="Tab 2"],[data-framer-name="Tab 3"]';

      function slugOf(cell) {
        var c = cell.querySelector('[data-embun-slug]');
        if (c) return c.getAttribute('data-embun-slug');
        var a = cell.querySelector('a[href*="shop/"]');
        var m = a && /shop\/([^\/?#]+)/.exec(a.getAttribute('href'));
        return m ? m[1] : null;
      }
      function setOf(sec) {
        for (var k in VC) for (var i = 0; i < 3; i++) if (sec.classList.contains(VC[k][i][0])) return k;
        return 'D';
      }
      var S = secs.map(function (sec) {
        var grid = sec.querySelector('.framer-1g5ezji');
        var first = grid && grid.querySelector('.framer-1yv6qj9');
        return { sec: sec, set: setOf(sec), grid: grid, tpl: first ? first.cloneNode(true) : null };
      });

      function setImg(box, src) {
        var img = box && box.querySelector('img');
        if (!img || !src) return;
        img.removeAttribute('srcset'); img.src = E.prefix + src;
      }
      /* Card content. EMBUN.fillCard(card, product) (commerce module) when present; otherwise the same
         markup the commerce build hook writes (hooks_commerce.fill_card): link, images, title/category,
         New tag, discount badge, compare + price with their appear (opacity .001 -> 1, .6s, delay .1). */
      var INK = 'var(--token-59993e6d-8382-4a43-944c-ec18ed6cd2a3, rgb(31, 43, 36))';
      var PAGE = 'var(--token-ec38428d-3a31-4b94-abff-9e09e67da8b6, rgb(252, 251, 247))';
      var SALE = 'var(--token-9eb64c71-b28d-4cdb-a396-9ece39bc3e51, rgb(196, 71, 45))';
      var FONT = 'font-family:Inter, &quot;Inter Placeholder&quot;, sans-serif;font-size:13px;font-style:normal;font-weight:500;letter-spacing:-0.6px;';
      var WRAP = '<div style="display:inline-block;max-width:100%;width:auto;white-space:nowrap;overflow:visible">';
      function fillCard(card, p) {
        if (typeof E.fillCard === 'function') { try { E.fillCard(card, p); return; } catch (e) { console.error('[embun] fillCard', e); } }
        card.setAttribute('data-embun-slug', p.slug);
        var link = card.querySelector('[data-framer-name="Slider Wrapper"]') || card.querySelector('a[href*="shop/"]');
        if (link) link.setAttribute('href', E.prefix + 'shop/' + p.slug + '/');
        setImg(card.querySelector('[data-framer-name="Image 1"]'), p.img);
        setImg(card.querySelector('[data-framer-name="Image 2"]'), p.img2 || p.img);
        var rts = $$('[data-framer-name="Title"] [data-framer-component-type="RichTextContainer"] p', card);
        if (rts[0]) rts[0].textContent = p.name;
        if (rts[1]) rts[1].textContent = p.cat || '';
        var tag = card.querySelector('.framer-1x6zz0g');
        if (!p.new && tag) tag.remove();
        if (p.new && !tag && newTagSample && link) {
          var t = newTagSample.cloneNode(true), img1 = link.querySelector('[data-framer-name="Image 1"]');
          if (img1 && img1.nextSibling) link.insertBefore(t, img1.nextSibling); else link.appendChild(t);
        }
        var badge = card.querySelector('.framer-1rp4uii-container');
        if (p.compare) {
          if (!badge && link) { badge = document.createElement('div'); badge.className = 'framer-1rp4uii-container'; link.appendChild(badge); }
          if (badge) badge.innerHTML = '<div style="display:flex;width:100%;height:100%;background-color:' + PAGE + ';padding:8px 16px;border-radius:7px;box-sizing:border-box;align-items:center;justify-content:center"><p style="font-family:Inter, &quot;Inter Placeholder&quot;, sans-serif;font-size:11px;font-style:normal;font-weight:500;letter-spacing:-0.5px;line-height:1em;color:' + SALE + ';margin:0;padding:0;white-space:nowrap">-' + Math.round(100 * (1 - p.price / p.compare)) + '%</p></div>';
        } else if (badge) badge.remove();
        var cont = card.querySelector('.framer-nvhn2h');
        if (!cont) return;
        var disc = cont.querySelector('.framer-1l4qhq9'), pr = cont.querySelector('.framer-1e5sxje-container');
        if (disc) disc.innerHTML = p.compare ? '<div class="framer-1y95de5-container" style="opacity:0.4">' + WRAP + '<p data-embun-compare="" style="' + FONT + 'line-height:1;color:' + INK + ';margin:0;padding:0;text-decoration-line:line-through;text-decoration-thickness:1px;text-decoration-style:solid;text-decoration-color:' + INK + ';white-space:nowrap;display:inline-block;width:auto">' + E.money(p.compare) + '</p></div></div>' : '';
        if (pr) pr.innerHTML = WRAP + '<p data-embun-price="" style="margin:0;padding:0;line-height:0.1px;white-space:nowrap;display:inline-block;width:auto;' + FONT + 'color:' + INK + '">' + E.money(p.price) + '</p></div>';
        [disc, pr].forEach(function (w) {
          if (!w) return;
          w.style.opacity = '0.001';
          E.animate(w, { opacity: 0.001 }, { opacity: 1 }, { type: 'tween', duration: 0.6, delay: 0.1, ease: EASE_OUT_QUART });
        });
      }
      function product(slug) { return E.product(slug); }

      function render(st, k, animateNew) {
        if (!st.grid || !st.tpl) return [];
        var cells = $$('.framer-1yv6qj9', st.grid), have = {}, created = [];
        cells.forEach(function (c) { var s = slugOf(c); if (s && !have[s]) have[s] = c; });
        var next = LISTS[k].map(function (p) {
          if (have[p.slug]) { var c = have[p.slug]; delete have[p.slug]; return c; }
          var n = st.tpl.cloneNode(true);
          fillCard(n.querySelector('.framer-STyoJ') || n, p);
          created.push(n); return n;
        });
        cells.forEach(function (c) { if (next.indexOf(c) < 0) c.remove(); });
        next.forEach(function (c) { st.grid.appendChild(c); });
        created.forEach(function (n) {
          if (typeof E.initCards === 'function') { try { E.initCards(n); } catch (e) { console.error('[embun] initCards', e); } }  // commerce: hover / heart / price appear
          var box = n.querySelector('.framer-dg7pan-container') || n;
          box.__appeared = true;
          box.style.opacity = '0.001';
          if (animateNew) E.animate(box, { opacity: 0.001 }, { opacity: 1 }, { type: 'tween', duration: 1.5, delay: 0, ease: EASE_OUT_QUART });
          else box.style.opacity = '1';
        });
        return created;
      }

      function select(k, animateNew) {
        active = k;
        var made = [];
        S.forEach(function (st) {
          var v = VC[st.set][k]; setV(st.sec, v[0], v[1]);
          for (var j = 0; j < 3; j++) {
            var w = st.sec.querySelector('[data-framer-name="Tab ' + (j + 1) + '"]');
            if (!w) continue;
            var comp = w.querySelector('.framer-GJl1o'), txt = w.querySelector('.framer-cclxn8');
            if (j === k) {
              setV(comp, TAB_ON[0], TAB_ON[1]); if (txt) txt.style.opacity = '1';
              w.removeAttribute('tabindex'); w.removeAttribute('data-highlight');
            } else {
              setV(comp, TAB_OFF[st.set][0], TAB_OFF[st.set][1]); if (txt) txt.style.opacity = '0.4';
              w.setAttribute('tabindex', '0'); w.setAttribute('data-highlight', 'true');
            }
          }
          made = made.concat(render(st, k, animateNew));
        });
        if (made.length) document.dispatchEvent(new CustomEvent('embun:cards', { detail: { cards: made.map(function (n) { return n.querySelector('.framer-STyoJ') || n; }) } }));
      }

      S.forEach(function (st) {
        var tabsRow = st.sec.querySelector('[data-framer-name="Tabs"]');
        if (!tabsRow) return;
        tabsRow.addEventListener('click', function (e) {
          var w = e.target.closest(TABSEL);
          if (!w || !tabsRow.contains(w)) return;
          var k = parseInt(w.getAttribute('data-framer-name').replace(/\D+/g, ''), 10) - 1;
          if (k >= 0 && k < 3 && k !== active) select(k, true);
        });
        tabsRow.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          var w = e.target.closest(TABSEL); if (!w) return;
          e.preventDefault(); w.click();
        });
      });
      /* initial tab: the SSR already shows tab 1; only re-render if the data disagrees */
      var ssr = S[0] && S[0].grid ? $$('.framer-1yv6qj9', S[0].grid).map(slugOf).join() : '';
      if (ssr !== LISTS[0].map(function (p) { return p.slug; }).join()) select(0, true);
      E.homeTabs = { select: function (k) { select(k, true); }, lists: LISTS, active: function () { return active; } };
    })();

    /* ================================================================ 3/5. FRAMER SLIDESHOW (Featured + Testimonials) */
    function springAt(A, t) {    // Framer spring (stiffness/damping/mass) from x0 with v0 (px/s) towards A.to
      var k = A.k, c = A.c, m = A.m, w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m)), d = A.x0 - A.to, v0 = A.v0;
      function x(tt) {
        if (z < 1) {
          var wd = w0 * Math.sqrt(1 - z * z);
          return A.to + Math.exp(-z * w0 * tt) * (d * Math.cos(wd * tt) + (v0 + z * w0 * d) / wd * Math.sin(wd * tt));
        }
        if (z === 1) return A.to + (d + (v0 + w0 * d) * tt) * Math.exp(-w0 * tt);
        var s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s), a = (v0 - r2 * d) / (r1 - r2), b = d - a;
        return A.to + a * Math.exp(r1 * tt) + b * Math.exp(r2 * tt);
      }
      var p = x(t);
      return [p, (x(t + 0.001) - p) / 0.001];
    }
    var SLIDE_T = { k: 200, c: 40, m: 1 };
    function wrap(min, max, v) { var n = max - min; return ((v - min) % n + n) % n + min; }
    function interp(v, inp, out) {
      if (v <= inp[0]) return out[0];
      for (var i = 1; i < inp.length; i++) {
        if (v <= inp[i]) { var a = inp[i - 1], b = inp[i]; return b === a ? out[i] : out[i - 1] + (out[i] - out[i - 1]) * (v - a) / (b - a); }
      }
      return out[out.length - 1];
    }

    function Slideshow(sec) {
      var clip = sec.firstElementChild, ul = clip && clip.querySelector('ul');
      if (!ul) return;
      var items = $$(':scope > li > *', ul);
      var copies = 4, n = Math.round(items.length / copies) || items.length;
      var gap = parseFloat(ul.style.gap) || 0;
      var drag = ul.style.touchAction === 'pan-y' || ul.style.cursor === 'grab';
      var fx = sec.closest('.framer-1rzmufm-container') ? 0.4 : (drag ? 1 : 0);   // effectsOpacity per instance (spec 5.2 / 14.1)
      var fs = sec.querySelector(':scope > fieldset');
      var groups = fs ? $$(':scope > div', fs) : [];
      var arrows = groups[0] ? $$('button', groups[0]) : [];
      var dots = groups[1] ? $$('button', groups[1]) : [];
      var V = null, Z = n, rt = 0, A = null, dragging = false, raf = 0, backstop = 0;

      function measure() {
        var first = items[0], last = items[n - 1];
        if (!first || !first.offsetWidth) { V = null; return false; }
        V = { parent: ul.offsetWidth, item: first.offsetWidth,
          children: last.offsetLeft + last.offsetWidth - first.offsetLeft + gap,
          vl: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, ul.offsetWidth) };
        V.It = V.item + gap;
        return true;
      }
      function target() { return -Z * V.It; }
      function render() {
        if (!V) return;
        var kt = wrap(-V.children, -V.children * 2, rt);
        if (isNaN(kt)) kt = 0;
        ul.style.transform = 'translateX(' + kt + 'px)';
        for (var f = 0; f < items.length; f++) {
          var B = V.It * f, P = [-V.item - B, -B, V.parent - V.item + gap - B, V.parent - B], el = items[f];
          var o = interp(kt, P, [fx, 1, 1, fx]);
          el.style.opacity = String(Math.round(o * 1e4) / 1e4);
          el.style.visibility = (kt > P[0] - V.vl && kt < P[3] + V.vl) ? 'visible' : 'hidden';
          el.setAttribute('aria-hidden', String(!(kt >= P[1] && kt <= P[2])));
        }
        if (dots.length) {
          var sel = wrap(0, n, Z);
          dots.forEach(function (b, i) { var d = b.firstElementChild; if (d) d.style.opacity = i === sel ? '1' : '0.2'; });
        }
      }
      function tick() {
        raf = 0;
        if (!A) return;
        var t = (performance.now() - A.t0) / 1000, s = springAt(A, t);
        var granular = Math.abs(A.x0 - A.to) < 5;
        if (Math.abs(s[1]) <= (granular ? 0.01 : 2) && Math.abs(A.to - s[0]) <= (granular ? 0.005 : 0.5) || t > 10) { rt = A.to; A = null; }
        else rt = s[0];
        render();
        if (A) { raf = requestAnimationFrame(tick); clearTimeout(backstop); backstop = setTimeout(tick, 250); }
      }
      function animateTo(to, v0) {
        var now = performance.now(), v = v0 || 0;
        if (A) { var s = springAt(A, (now - A.t0) / 1000); rt = s[0]; if (v0 == null) v = s[1]; }
        A = { x0: rt, v0: v, to: to, t0: now, k: SLIDE_T.k, c: SLIDE_T.c, m: SLIDE_T.m };
        if (!raf) raf = requestAnimationFrame(tick);
        clearTimeout(backstop); backstop = setTimeout(tick, 250);
      }
      function go(delta, v0) { if (!V) return; Z += delta; animateTo(target(), v0); }
      function stop() { if (A) { var s = springAt(A, (performance.now() - A.t0) / 1000); rt = s[0]; A = null; } }

      function layout() {
        var was = !!V;
        if (!measure()) return;
        sec.style.opacity = '1';
        if (!dragging) { stop(); rt = target(); }
        render();
        if (!was) sec.__ready = true;
      }

      arrows.forEach(function (b, i) {
        b.addEventListener('click', function (e) { e.preventDefault(); go(i === 0 ? -1 : 1); });
        /* whileTap {scale:.9}, tween .15s (CSS transition in m-home.css) */
        b.addEventListener('pointerdown', function () {
          b.style.transform = 'scale(0.9)';
          var up = function () { b.style.transform = 'none'; removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
          addEventListener('pointerup', up); addEventListener('pointercancel', up);
        });
      });
      dots.forEach(function (b, s) {
        b.addEventListener('click', function (e) { e.preventDefault(); if (!V) return; go(s - wrap(0, n, Z)); });
      });
      sec.addEventListener('mousedown', function (e) {
        e.preventDefault();
        if (drag) { ul.style.cursor = 'grabbing'; var up = function () { ul.style.cursor = 'grab'; removeEventListener('mouseup', up); }; addEventListener('mouseup', up); }
      });

      if (drag) {
        /* motion drag="x", dragDirectionLock, dragMomentum:false. Pan starts after 3px; the axis locks
           once one offset passes 10px; offsets are measured from the pointerdown point. */
        /* PanSession (framer-motion): history starts at pointerdown; while the pointer is down a keep-alive
           frame callback pushes the latest point every frame (so holding still drives velocity to 0);
           velocity = getVelocity(history, .1s). The spring after release starts from the motion value's
           own velocity (last two frame sets, 0 if the last set is older than 30ms). */
        var start = null, hist = [], lock = null, suppress = false, last = null, loop = 0, panning = false, origin = 0;
        var mv = { prev: 0, prevT: 0, t: 0 };
        function frame(ts) {
          loop = 0;
          if (!start || !last) return;
          var now = performance.now(), dx = last.x - start.x, dy = last.y - start.y;
          if (!panning && Math.sqrt(dx * dx + dy * dy) < 3) { loop = requestAnimationFrame(frame); return; }
          if (!panning) { panning = true; origin = rt; }
          hist.push([now, last.x]);
          if (hist.length > 120) hist.splice(1, 1);
          if (lock === null) {                                   // dragDirectionLock (threshold 10px)
            lock = Math.abs(dy) > 10 ? 'y' : Math.abs(dx) > 10 ? 'x' : null;
            if (lock === 'y') { start = null; return; }
            if (lock === 'x') { dragging = true; try { ul.setPointerCapture(start.id); } catch (err) {} }
          } else if (lock === 'x') {
            mv.prev = rt; mv.prevT = mv.t; rt = origin + dx; mv.t = now; render();
          }
          loop = requestAnimationFrame(frame);
        }
        ul.addEventListener('pointerdown', function (e) {
          if (e.button !== 0 || !V) return;
          stop();                                                // onSessionStart: stopAnimation()
          start = { x: e.clientX, y: e.clientY, id: e.pointerId }; lock = null; panning = false; last = null;
          hist = [[performance.now(), e.clientX]]; mv = { prev: rt, prevT: 0, t: 0 };
        });
        addEventListener('pointermove', function (e) {
          if (!start || e.pointerId !== start.id) return;
          last = { x: e.clientX, y: e.clientY };
          if (lock === 'x') e.preventDefault();
          if (!loop) loop = requestAnimationFrame(frame);
        });
        function velocity() {                                    // framer-motion getVelocity(history, .1)
          if (hist.length < 2) return 0;
          var lastP = hist[hist.length - 1], i = hist.length - 1, p = null;
          while (i >= 0) { p = hist[i]; if (lastP[0] - p[0] > 100) break; i--; }
          var dt = (lastP[0] - p[0]) / 1000;
          return dt ? (lastP[1] - p[1]) / dt : 0;
        }
        var end = function (e) {
          if (!start || e.pointerId !== start.id) {
            start = null;
            if (V && !A && !dragging && Math.abs(rt - target()) > 0.01) animateTo(target(), 0);   // re-render after a stopped press
            return;
          }
          if (loop) { cancelAnimationFrame(loop); loop = 0; }
          var wasDrag = dragging; dragging = false;
          var offset = e.clientX - start.x;
          start = null;
          if (!wasDrag) { if (Math.abs(rt - target()) > 0.01) animateTo(target(), 0); return; }
          suppress = Math.abs(offset) > 3;
          var vel = velocity(), now = performance.now();
          var v0 = mv.t && now - mv.t <= 30 && mv.prevT ? (rt - mv.prev) / (Math.min(mv.t - mv.prevT, 30) / 1000) : 0;
          /* chunk-KSPK366F Cn(): |velocity| > 200px/s -> move round(|offset|/item) items (min 1) that way;
             else |offset| > item/2 -> round(|offset|/item) items; else spring back */
          var item = V.item, st = Math.round(Math.abs(offset) / item), pe = st === 0 ? 1 : st;
          if (vel > 200) go(-pe, v0);
          else if (vel < -200) go(pe, v0);
          else if (offset < -item / 2) go(st, v0);
          else if (offset > item / 2) go(-st, v0);
          else animateTo(target(), v0);
        };
        addEventListener('pointerup', end);
        addEventListener('pointercancel', end);
        ul.addEventListener('click', function (e) { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; } }, true);
        ul.addEventListener('dragstart', function (e) { e.preventDefault(); });
      }

      if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); }).observe(sec);
      addEventListener('resize', layout);
      layout();
      sec.__slideshow = { go: go, state: function () { return { Z: Z, rt: rt, V: V, animating: !!A }; } };
    }
    $$('section').forEach(function (sec) {
      if (sec.querySelector(':scope > fieldset.framer--slideshow-controls') && sec.querySelector(':scope > div > ul')) Slideshow(sec);
    });

    /* ================================================================ 4. OUR SHOPS — Store Image Carousel */
    $$('.framer-bSC1Q').forEach(function (root) {
      var imgs = [root.querySelector('.framer-e82vey'), root.querySelector('.framer-1b456c7'), root.querySelector('.framer-1agvyes')];
      if (!imgs[0] || !imgs[1] || !imgs[2]) return;
      var STATES = [[1, 0, 0], [1, 1, 0], [0, 1, 1]];     // Image 1 / Image 2 / Image 3 variants
      var t0 = performance.now(), k = 0;
      function step() {
        k += 1;
        var s = STATES[k % 3];
        imgs.forEach(function (el, i) {
          var from = parseFloat(getComputedStyle(el).opacity);
          if (from === s[i]) return;
          E.animate(el, { opacity: from }, { opacity: s[i] }, { type: 'tween', duration: 1, ease: [0.5, 1, 0.89, 1] });
        });
        setTimeout(step, Math.max(0, t0 + (k + 1) * 2500 - performance.now()));   // wall clock, no drift
      }
      setTimeout(step, 2500);
    });

    /* ================================================================ 7. UNDERLINE BUTTONS in <main> ("Shop all" / "View all")
       Navigation Button -> mouseenter: Navigation Line IN (line right:0, width 102%), SPRING-B;
       mouseleave: Navigation Line OUT (right:-3px, width 1%), SPRING-B, +350ms -> resting (duration 0).
       Rendered as a Framer layout animation (FLIP on the line). Nav/footer copies belong to chrome. */
    function flipLine(line, mutate, t) {
      var pr = line.parentElement.getBoundingClientRect(), r = line.getBoundingClientRect();
      var b = { x: r.left - pr.left, w: r.width };
      if (line.__flip) { line.__flip.cancel(); line.__flip = null; }
      mutate();
      var x = E.tr(t);
      if (!x.duration) return;
      pr = line.parentElement.getBoundingClientRect(); r = line.getBoundingClientRect();
      if (!r.width) return;
      line.style.transformOrigin = '0 0';
      var a = line.__flip = line.animate([{ transform: 'translateX(' + (b.x - (r.left - pr.left)) + 'px) scaleX(' + (b.w / r.width) + ')' }, { transform: 'none' }],
        { duration: x.duration, easing: x.easing });
      a.onfinish = function () { if (line.__flip === a) line.__flip = null; };
    }
    $$('main .framer-KnRPa.framer-v-hpjb0n').forEach(function (b) {
      if (b.__en_ub) return; b.__en_ub = 1; b.setAttribute('data-en', 'ub');
      var line = b.querySelector('.framer-nsdj18'), state = 'rest';
      if (!line) return;
      b.addEventListener('mouseenter', function () {
        if (state !== 'rest') return;
        state = 'in'; flipLine(line, function () { setV(b, 'framer-v-436hcc', 'Navigation Line IN'); }, E.T.stiff);
      });
      b.addEventListener('mouseleave', function () {
        if (state !== 'in') return;
        state = 'out'; flipLine(line, function () { setV(b, 'framer-v-1bvg2rf', 'Navigation Line OUT'); }, E.T.stiff);
        setTimeout(function () { state = 'rest'; flipLine(line, function () { setV(b, 'framer-v-hpjb0n', 'Navigation Button'); }, { type: 'tween', duration: 0 }); }, 350);
      });
    });

    /* ================================================================ 6. COUNTDOWN */
    $$('.framer-1ggm4zi-container').forEach(function (c) {
      var box = c.querySelector('div') || c;
      var endMsg = norm(box.textContent) || "Time's up!";
      var end = Date.parse(c.getAttribute('data-embun-end') || '2026-12-31T23:59:59+08:00');
      var fs = parseFloat(box.style.fontSize) || 35;
      function tick() {
        var D = end - Date.now(), u = {};
        if (D > 0) u = { days: Math.floor(D / 864e5), hours: Math.floor(D / 36e5 % 24), minutes: Math.floor(D / 6e4 % 60), seconds: Math.floor(D / 1e3 % 60) };
        var html = '';
        Object.keys(u).forEach(function (k) {
          if (u[k]) html += '<span style="display:flex;align-items:center;flex-direction:column">' + u[k] + '<span style="font-size:' + (fs / 2.5) + 'px">' + k + '</span></span>';
        });
        if (!html) { var sp = document.createElement('span'); sp.textContent = endMsg; box.textContent = ''; box.appendChild(sp); }
        else box.innerHTML = html;
        if (D > 0) setTimeout(tick, (D % 1000 || 1000) + 5);
      }
      tick();
    });
  });
})();
