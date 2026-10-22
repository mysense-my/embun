/* Embun — commerce module: product cards (hover / heart / quick add), listing filters + sort,
   product page (gallery, slideshow, variants, quantity, add to cart, shipping drawer, accordion,
   ingredient tabs), favourites page, /collections cards.
   Markup comes from the template's SSR (+ build/hooks_commerce.py); timings are the template's own
   transition objects (see _teardown/specs/commerce.md §9). Public: EMBUN.fillCard(card, product),
   EMBUN.initCards(root). */
(function () {
  'use strict';
  var E = window.EMBUN;
  if (!E) return;
  var P = E.prefix || './';

  /* ---------------------------------------------------------------- palette (Embun) */
  var INK = [31, 43, 36], PG = [252, 251, 247];
  var C = {
    ink: 'rgb(31, 43, 36)', page: 'rgb(252, 251, 247)', deep: 'rgb(51, 68, 58)', sale: 'rgb(196, 71, 45)',
    a: function (x) { return 'rgba(31, 43, 36, ' + x + ')'; },
    ramp: function (v, al) {  /* template grey v -> same spot on the ink->page ramp (build/lib.py ramp) */
      var t = v / 255, c = [0, 1, 2].map(function (i) { return Math.round(INK[i] + t * (PG[i] - INK[i])); });
      return al == null ? 'rgb(' + c.join(', ') + ')' : 'rgba(' + c.join(', ') + ', ' + al + ')';
    }
  };
  var TR = {
    card: { type: 'spring', stiffness: 357, damping: 40, mass: 1 },
    hoverIn: { type: 'tween', duration: 0.8, ease: [0.25, 1, 0.5, 1] },
    appear: { type: 'tween', duration: 0.6, delay: 0.1, ease: [0.25, 1, 0.5, 1] },
    tap: { type: 'spring', duration: 0.45, bounce: 0.25 },
    qline: { type: 'tween', duration: 0.7, ease: [0.25, 1, 0.5, 1] },
    ship: { type: 'tween', duration: 0.7, ease: [0.76, 0, 0.24, 1] },
    plus: { type: 'tween', duration: 1, ease: [0.16, 1, 0.3, 1] },
    tab: { type: 'tween', duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    ing: { type: 'tween', duration: 0.9, ease: [0.25, 1, 0.5, 1] },
    seeall: { type: 'tween', duration: 0.8, ease: [0.25, 1, 0.5, 1] }
  };
  var STR = {};
  try { STR = JSON.parse((document.getElementById('embun-commerce-strings') || {}).textContent || '{}'); } catch (e) {}
  function S(k) { return STR[k] || k; }

  /* ---------------------------------------------------------------- animation helpers */
  /* animate el's inline style to `to` (CSS keyframe props) from its current (or given) values.
     The final values are written inline and the animation runs with fill:backwards, so nothing can
     get stuck at a start state; a new call on the same property interrupts from where it is. */
  function go(el, to, t, from) {
    if (!el) return null;
    var tt = E.tr(t || E.T.soft), cs = getComputedStyle(el), f = {}, k, run = el.__go || (el.__go = {});
    for (k in to) f[k] = from && from[k] != null ? from[k] : cs[k];
    for (k in to) if (run[k]) { try { run[k].cancel(); } catch (e) {} delete run[k]; }
    for (k in to) el.style[k] = to[k];
    if (E.reduced || tt.duration <= 0) return null;
    var a;
    try { a = el.animate([f, to], { duration: tt.duration, delay: tt.delay, easing: tt.easing, fill: 'backwards' }); } catch (e) { return null; }
    for (k in to) run[k] = a;
    a.onfinish = function () { for (var q in run) if (run[q] === a) delete run[q]; };
    return a;
  }
  function animH(el, h0, h1, t, done) {
    if (el.__ha) { try { el.__ha.cancel(); } catch (e) {} }
    var tt = E.tr(t);
    el.style.height = h1 + 'px';
    if (E.reduced) { el.style.height = ''; if (done) done(); return; }
    var a = el.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: tt.duration, easing: tt.easing });
    el.__ha = a;
    a.onfinish = function () { if (el.__ha === a) { el.style.height = ''; el.__ha = null; if (done) done(); } };
  }
  function fadeIn(el) { if (el) go(el, { opacity: '1' }, TR.appear, { opacity: '0.001' }); }
  function hasHover() { return matchMedia('(hover: hover)').matches; }

  /* ---------------------------------------------------------------- product card */
  var HEART = 'M 14.158 11.907 C 13.142 12.929 11.854 14.148 10.291 15.566 C 10.29 15.566 10.29 15.566 10.29 15.567 L 9.314 16.448 L 8.337 15.567 C 8.337 15.566 8.337 15.566 8.337 15.566 C 6.773 14.148 5.485 12.929 4.47 11.907 C 3.457 10.888 2.662 9.983 2.078 9.192 C 1.494 8.4 1.104 7.696 0.888 7.079 C 0.668 6.45 0.559 5.81 0.559 5.156 C 0.559 3.828 0.995 2.747 1.862 1.874 C 2.729 1.002 3.803 0.563 5.123 0.563 C 5.848 0.563 6.536 0.716 7.191 1.025 C 7.847 1.334 8.411 1.769 8.888 2.333 L 9.314 2.837 L 9.74 2.333 C 10.216 1.769 10.781 1.334 11.437 1.025 C 12.092 0.716 12.779 0.563 13.505 0.563 C 14.825 0.563 15.899 1.002 16.765 1.874 C 17.632 2.747 18.069 3.828 18.069 5.156 C 18.069 5.81 17.959 6.45 17.74 7.079 C 17.523 7.696 17.133 8.4 16.549 9.192 C 15.965 9.983 15.17 10.888 14.158 11.907 Z';
  function heartBg(fill, stroke) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 19 18"><path d="' + HEART +
      '" fill="' + fill + '" stroke-width="1.12" stroke="' + stroke + '" stroke-miterlimit="10"></path></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function priceP(v, size, lh) {
    return '<div style="display:inline-block;max-width:100%;width:auto;white-space:nowrap;overflow:visible"><p data-embun-price="" style="margin:0;padding:0;line-height:' + lh +
      ';white-space:nowrap;display:inline-block;width:auto;font-family:Inter, &quot;Inter Placeholder&quot;, sans-serif;font-size:' + size +
      'px;font-style:normal;font-weight:500;letter-spacing:-0.6px;color:' + C.ink + '">' + E.money(v) + '</p></div>';
  }
  function compareP(v, size) {
    return '<div style="display:inline-block;max-width:100%;width:auto;white-space:nowrap;overflow:visible"><p data-embun-compare="" style="font-family:Inter, &quot;Inter Placeholder&quot;, sans-serif;font-size:' + size +
      'px;font-style:normal;font-weight:500;letter-spacing:-0.6px;line-height:1;color:' + C.ink + ';margin:0;padding:0;text-decoration-line:line-through;text-decoration-thickness:1px;text-decoration-style:solid;text-decoration-color:' +
      C.ink + ';white-space:nowrap;display:inline-block;width:auto">' + E.money(v) + '</p></div>';
  }
  function badgeText(p) { return '-' + Math.round((p.compare - p.price) / p.compare * 100) + '%'; }
  function variants(p) { return (p.sizes && p.sizes.length ? p.sizes : p.amounts) || []; }
  function setImg(img, src) { if (!img) return; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = src; }

  /* re-render any product card (any variant) for product p (object or slug) */
  E.fillCard = function (card, p) {
    if (typeof p === 'string') p = E.product(p);
    if (!card || !p) return;
    card.setAttribute('data-embun-slug', p.slug);
    var a = card.querySelector('[data-framer-name="Slider Wrapper"]');
    if (a) a.setAttribute('href', P + 'shop/' + p.slug + '/');
    setImg(card.querySelector('[data-framer-name="Image 1"] img'), P + p.img);
    setImg(card.querySelector('[data-framer-name="Image 2"] img'), P + p.img2);
    var ps = card.querySelectorAll('[data-framer-name="Title"] [data-framer-component-type="RichTextContainer"] p');
    if (ps[0]) ps[0].textContent = p.name;
    if (ps[1]) ps[1].textContent = p.cat;
    var tag = card.querySelector('.framer-1x6zz0g');
    if (p.new && !tag && a) {
      tag = E.html('<div class="framer-1x6zz0g" data-framer-name="New Tag" style="background-color:' + C.page + ';border-radius:7px"><div class="framer-1xsu0qw" data-framer-component-type="RichTextContainer" style="outline:none;display:flex;flex-direction:column;justify-content:center;flex-shrink:0;--framer-paragraph-spacing:0px;transform:none"><p class="framer-text framer-styles-preset-wzd2pi">' + S('New') + '</p></div></div>');
      var i1 = a.querySelector('[data-framer-name="Image 1"]');
      if (i1 && i1.nextSibling) a.insertBefore(tag, i1.nextSibling); else a.appendChild(tag);
    } else if (tag && !p.new) tag.remove();
    var badge = card.querySelector('.framer-1rp4uii-container');
    if (p.compare) {
      if (!badge && a) { badge = document.createElement('div'); badge.className = 'framer-1rp4uii-container'; a.appendChild(badge); }
      if (badge) badge.innerHTML = '<div style="display:flex;width:100%;height:100%;background-color:' + C.page + ';padding:8px 16px;border-radius:7px;box-sizing:border-box;align-items:center;justify-content:center"><p style="font-family:Inter, &quot;Inter Placeholder&quot;, sans-serif;font-size:11px;font-style:normal;font-weight:500;letter-spacing:-0.5px;line-height:1em;color:' + C.sale + ';margin:0;padding:0;white-space:nowrap">' + badgeText(p) + '</p></div>';
    } else if (badge) badge.remove();
    var cont = card.querySelector('.framer-nvhn2h');
    if (cont) {
      var disc = cont.querySelector('.framer-1l4qhq9'), pr = cont.querySelector('.framer-1e5sxje-container');
      if (!disc) { disc = document.createElement('div'); disc.className = 'framer-1l4qhq9'; disc.setAttribute('data-framer-name', 'Discounted Price'); cont.insertBefore(disc, cont.firstChild); }
      if (!pr) { pr = document.createElement('div'); pr.className = 'framer-1e5sxje-container'; cont.appendChild(pr); }
      disc.innerHTML = p.compare ? '<div class="framer-1y95de5-container" style="opacity:0.4">' + compareP(p.compare, 13) + '</div>' : '';
      pr.innerHTML = priceP(p.price, 13, '0.1px');
      [disc, pr].forEach(function (w) { w.removeAttribute('data-framer-appear-id'); w.setAttribute('data-embun-appear', ''); });
    }
    var heart = card.querySelector('.framer-1521gi0-container');
    if (heart) { heart.setAttribute('data-embun-heart', p.slug); if (heart.__heart) paintHeart(heart, E.fav.has(p.slug), false); }
  };

  /* ---- heart (Favorites component) + "Added to Favorites" tooltip */
  var tipEl = null, tipFor = null;
  function showTip(wrap) {
    var r = wrap.getBoundingClientRect();
    if (!tipEl) {
      tipEl = E.html('<div class="framer-zXWxP" data-embun-tip="" style="position:absolute;z-index:11;pointer-events:none;left:0;top:0">' +
        '<div class="framer-3pay9u" role="dialog" style="background-color:' + C.page + ';border-radius:5px;box-shadow:' + C.a(0.05) + ' 0px 10px 20px 0px;transform-origin:50% 0%">' +
        '<div class="framer-rb4zz6" data-framer-component-type="RichTextContainer" style="outline:none;display:flex;flex-direction:column;justify-content:center;flex-shrink:0;--framer-paragraph-spacing:0px">' +
        '<p class="framer-text framer-styles-preset-kav5go">' + S('Added to Favorites') + '</p></div></div></div>');
    }
    document.body.appendChild(tipEl);
    var w = tipEl.offsetWidth, x = r.left + r.width / 2 - w / 2;
    x = Math.max(20, Math.min(x, document.documentElement.clientWidth - 20 - w));  /* collision padding 20 */
    tipEl.style.left = (x + scrollX) + 'px';
    tipEl.style.top = (r.bottom + 10 + scrollY) + 'px';
    tipFor = wrap;
    go(tipEl, { opacity: '1' }, E.T.soft, tipEl.style.opacity === '' ? { opacity: '0' } : null);
  }
  function hideTip(wrap) {
    if (!tipEl || (wrap && tipFor !== wrap)) return;
    tipFor = null;
    var a = go(tipEl, { opacity: '0' }, E.T.soft), el = tipEl;
    var rm = function () { if (!tipFor && el.parentNode && el.style.opacity === '0') el.remove(); };
    if (a) a.addEventListener('finish', rm); else rm();
  }
  function tipAllowed(wrap) {
    var card = wrap.closest('.framer-in5igc');
    if (card) return card.classList.contains('framer-v-in5igc') || card.classList.contains('framer-v-xqtxu1');
    return E.bp() === 'D';   /* PDP: desktop variant only */
  }
  function paintHeart(wrap, on, anim) {
    /* a PDP heart container holds one heart per breakpoint variant: paint them all */
    E.$$('.framer-NVjZ8', wrap).forEach(function (inner) {
      var svg = inner.querySelector('[data-framer-name="favorite"]');
      if (!svg) return;
      inner.classList.toggle('framer-v-i00r8f', on);
      inner.classList.toggle('framer-v-gezba', !on);
      inner.setAttribute('data-framer-name', on ? 'Active' : 'Default');
      inner.style.backgroundColor = on ? C.a(0) : 'rgba(158, 158, 158, 0)';
      svg.style.backgroundImage = on ? heartBg(C.sale, C.sale) : heartBg(C.a(0), C.ink);
      var op = on || wrap.__hov ? '1' : '0.4';
      if (anim) go(svg, { opacity: op }, E.T.stiff); else svg.style.opacity = op;
    });
  }
  function initHeart(wrap) {
    if (!wrap || wrap.__heart) return;
    wrap.__heart = true;
    var slug = function () { return wrap.getAttribute('data-embun-heart'); };
    var up = function () { if (wrap.__down) { wrap.__down = false; go(wrap, { transform: 'scale(1)' }, TR.tap); } };
    wrap.addEventListener('pointerdown', function () { wrap.__down = true; go(wrap, { transform: 'scale(0.7)' }, TR.tap); });
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var on = E.fav.toggle(slug());
      if (on && wrap.__hov && tipAllowed(wrap)) showTip(wrap);
      if (!on) hideTip(wrap);
    }, true);
    wrap.addEventListener('mouseenter', function () {
      wrap.__hov = true;
      var on = E.fav.has(slug());
      if (on) { if (tipAllowed(wrap)) showTip(wrap); } else paintHeart(wrap, false, true);
    });
    wrap.addEventListener('mouseleave', function () {
      wrap.__hov = false; up(); hideTip(wrap);
      if (!E.fav.has(slug())) paintHeart(wrap, false, true);
    });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wrap.click(); } });
    paintHeart(wrap, E.fav.has(slug()), false);
  }
  document.addEventListener('embun:fav', function (e) {
    var d = e.detail || {};
    E.$$('[data-embun-heart]').forEach(function (w) {
      if (w.getAttribute('data-embun-heart') === d.slug && w.__heart) paintHeart(w, !!d.on, true);
    });
  });

  /* ---- quick add */
  function quickAdd(card) {
    var el = E.html('<div class="framer-12lr1b8-container" data-framer-name="Quick View Button" name="Quick View Button" style="opacity:0.001">' +
      '<div name="Quick View Button" class="framer-SP7DI framer-l364os framer-v-l364os" data-framer-name="Button"><div class="framer-l3w5nj-container">' +
      '<div class="fc-quick-add-button-container" role="button" tabindex="0" aria-label="Add to Cart" style="width:100%;height:100%">' +
      '<div class="framer-1dgjfbl-container" data-framer-name="Quick Add" name="Quick Add"><div name="Quick Add" class="framer-0qVmJ framer-y3Bt7 framer-11uyzdc framer-v-11uyzdc" data-highlight="true" tabindex="0">' +
      '<div class="framer-1qkeonw" data-framer-component-type="RichTextContainer" style="outline:none;display:flex;flex-direction:column;justify-content:flex-start;flex-shrink:0;transform:none">' +
      '<p class="framer-text framer-styles-preset-1twz7tr">' + S('Quick add') + '</p></div>' +
      '<div class="framer-13ao7mu" data-framer-name="Line" style="background-color:' + C.ink + '"></div></div></div></div></div></div></div>');
    var btn = el.querySelector('.fc-quick-add-button-container'), qa = el.querySelector('.framer-11uyzdc'), line = el.querySelector('.framer-13ao7mu');
    qa.addEventListener('mouseenter', function () { go(line, { transform: 'translateX(' + qa.offsetWidth + 'px)' }, TR.qline); });
    qa.addEventListener('mouseleave', function () { go(line, { transform: 'translateX(0px)' }, TR.qline); });
    var add = function (e) {
      e.preventDefault(); e.stopPropagation();
      var p = E.product(card.getAttribute('data-embun-slug'));
      if (!p) return;
      E.cart.add(p.slug, variants(p)[0] || '', 1);
      if (typeof E.openCart === 'function') E.openCart();
    };
    btn.addEventListener('click', add);
    btn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') add(e); });
    return el;
  }

  /* ---- card init: appear, heart, desktop hover variant */
  function initCard(card) {
    if (!card || card.__embun) return;
    if (!card.getAttribute('data-embun-slug')) {  /* injected later (e.g. captured fragments): fill from its link */
      var a = card.querySelector('[data-framer-name="Slider Wrapper"]'), m = a && /shop\/([^/?#]+)/.exec(a.getAttribute('href') || '');
      if (m && E.product(m[1])) E.fillCard(card, m[1]);
    }
    if (!card.getAttribute('data-embun-slug')) return;
    card.__embun = true;
    E.$$('[data-embun-appear]', card).forEach(function (w) { if (parseFloat(getComputedStyle(w).opacity) < 0.5) fadeIn(w); });
    initHeart(card.querySelector('[data-embun-heart]'));
    if (!card.classList.contains('framer-v-in5igc')) return;   /* Mobile / Empty Basket variants: no hover */
    var qa = null;
    card.addEventListener('mouseenter', function () {
      if (!hasHover()) return;
      var img1 = card.querySelector('[data-framer-name="Image 1"]'), img2 = card.querySelector('[data-framer-name="Image 2"]'), cont = card.querySelector('.framer-nvhn2h');
      card.classList.remove('framer-v-in5igc'); card.classList.add('framer-v-xqtxu1');
      card.setAttribute('data-framer-name', 'Product Card - Hover');
      if (img1) img1.style.display = 'none';                       /* Image 1 unmounts, no fade */
      go(img2, { transform: 'scale(1)' }, TR.hoverIn);
      E.$$('.framer-1l4qhq9, .framer-1e5sxje-container', cont).forEach(function (w) { w.style.display = 'none'; });
      if (qa) qa.remove();
      qa = quickAdd(card);
      if (cont) { cont.appendChild(qa); fadeIn(qa); }
    });
    card.addEventListener('mouseleave', function () {
      if (!card.classList.contains('framer-v-xqtxu1')) return;
      var img1 = card.querySelector('[data-framer-name="Image 1"]'), img2 = card.querySelector('[data-framer-name="Image 2"]'), cont = card.querySelector('.framer-nvhn2h');
      card.classList.remove('framer-v-xqtxu1'); card.classList.add('framer-v-in5igc');
      card.setAttribute('data-framer-name', 'Product Card');
      if (img1) img1.style.display = '';
      go(img2, { transform: 'scale(1.06)' }, TR.card);
      if (qa) { qa.remove(); qa = null; }
      E.$$('.framer-1l4qhq9, .framer-1e5sxje-container', cont).forEach(function (w) { w.style.display = ''; fadeIn(w); });
    });
  }
  E.initCards = function (root) { E.$$('.framer-in5igc', root).forEach(initCard); };

  /* ---------------------------------------------------------------- listing + favourites grids */
  var ORDER = (E.DATA.products || []).map(function (p) { return p.slug; });
  var FS = { collection: [], product_type: [], product_tag: [], variant: [], price: [], sort: 'relevance', sortSet: false };
  var gridMode = null, lastUpd = 0;
  function list(q, k) { var v = q.get(k); return v ? v.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; }
  function readURL() {
    var q = new URLSearchParams(location.search);
    FS.collection = list(q, 'collection');
    FS.product_type = list(q, 'product_type').concat(list(q, 'product-type'));
    FS.product_tag = list(q, 'product_tag').concat(list(q, 'product-tag'));
    FS.variant = list(q, 'variant_Size');
    FS.price = list(q, 'price').map(function (r) { return 'range:' + r; });
    if (q.get('price_max')) FS.price.push('max:' + q.get('price_max'));
    if (q.get('price_min')) FS.price.push('min:' + q.get('price_min'));
    var s = q.get('sort'), ss = null;
    try { ss = sessionStorage.getItem('sortBy'); } catch (e) {}
    FS.sort = s || ss || 'relevance';
    FS.sortSet = !!s;
  }
  function writeURL() {
    var q = new URLSearchParams(location.search);
    ['collection', 'product_type', 'product-type', 'product_tag', 'product-tag', 'variant_Size', 'price', 'price_max', 'price_min', 'sort'].forEach(function (k) { q.delete(k); });
    if (FS.collection.length) q.set('collection', FS.collection.join(','));
    if (FS.product_type.length) q.set('product_type', FS.product_type.join(','));
    if (FS.product_tag.length) q.set('product_tag', FS.product_tag.join(','));
    if (FS.variant.length) q.set('variant_Size', FS.variant.join(','));
    var ranges = FS.price.filter(function (v) { return v.indexOf('range:') === 0; }).map(function (v) { return v.slice(6); });
    if (ranges.length) q.set('price', ranges.join(','));
    FS.price.forEach(function (v) {
      if (v.indexOf('max:') === 0) q.set('price_max', v.slice(4));
      if (v.indexOf('min:') === 0) q.set('price_min', v.slice(4));
    });
    if (FS.sortSet) q.set('sort', FS.sort);
    var qs = q.toString();
    history.pushState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  var GROUP = { collection: 'collection', product_type: 'product_type', product_tag: 'product_tag', price: 'price', variant: 'variant' };
  function inColl(p, v) {
    v = v.toLowerCase();
    if (v === 'new') return !!p.new;
    if (v === 'bestsellers') return (p.tags || []).indexOf('bestseller') >= 0;
    if (v === 'on sale' || v === 'sale') return !!p.compare;
    if (v === 'kits') return p.cat === 'Kits';
    if (v === 'giftcards') return p.cat === 'Giftcards';
    return false;
  }
  function inPrice(x, v) {
    var k = v.split(':')[0], n = v.slice(k.length + 1);
    if (k === 'max') return x <= parseFloat(n);
    if (k === 'min') return x >= parseFloat(n);
    var r = n.split('-'); return x >= parseFloat(r[0]) && x <= parseFloat(r[1]);
  }
  function matches(p) {
    if (!p) return false;
    if (gridMode === 'favorites') return E.fav.has(p.slug);
    var lc = function (s) { return (s || '').toLowerCase(); };
    if (FS.collection.length && !FS.collection.some(function (v) { return inColl(p, v); })) return false;
    if (FS.product_type.length && !FS.product_type.some(function (v) { return lc(p.cat) === lc(v); })) return false;
    if (FS.product_tag.length && !FS.product_tag.some(function (v) { return lc(p.type) === lc(v); })) return false;
    if (FS.variant.length && !FS.variant.some(function (v) { return (p.sizes || []).some(function (s) { return lc(s) === lc(v); }); })) return false;
    if (FS.price.length && !FS.price.some(function (v) { return inPrice(p.price, v); })) return false;
    return true;
  }
  function cmp(a, b) {
    var ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
    switch (FS.sort) {
      case 'title_asc': return a.name.localeCompare(b.name) || ia - ib;
      case 'title_desc': return b.name.localeCompare(a.name) || ia - ib;
      case 'price_asc': return a.price - b.price || ia - ib;
      case 'price_desc': return b.price - a.price || ia - ib;
      default: return ia - ib;
    }
  }
  function items(grid) { return Array.prototype.filter.call(grid.children, function (c) { return c.hasAttribute('data-embun-item'); }); }
  function renderGrids() {
    E.$$('[data-embun-grid]').forEach(function (grid) {
      var all = items(grid), empty = grid.querySelector(':scope > [data-embun-empty]');
      var vis = all.filter(function (it) { return matches(E.product(it.getAttribute('data-embun-item'))); });
      vis.sort(function (x, y) { return cmp(E.product(x.getAttribute('data-embun-item')), E.product(y.getAttribute('data-embun-item'))); });
      all.forEach(function (it) { if (vis.indexOf(it) < 0) it.style.display = 'none'; });
      vis.forEach(function (it) { it.style.display = ''; grid.insertBefore(it, empty); });
      if (empty) empty.style.display = vis.length ? 'none' : 'flex';
    });
  }
  /* ProductSort's update cycle: cards fade to 0 (.3s, .5s for rapid updates), list replaced, back to 1 after 200 ms */
  function updateGrids() {
    var now = Date.now(), dur = now - lastUpd < 100 ? '0.5s' : '0.3s';
    lastUpd = now;
    var its = [];
    E.$$('[data-embun-grid]').forEach(function (g) { its = its.concat(items(g)); });
    its.forEach(function (it) { it.style.transition = 'opacity ' + dur + ' ease-in-out'; it.style.opacity = '0'; });
    renderGrids();
    clearTimeout(updateGrids.t);
    updateGrids.t = setTimeout(function () { its.forEach(function (it) { it.style.opacity = '1'; }); }, 200);
  }
  function revealGrids() {
    setTimeout(function () {
      E.$$('[data-embun-grid]').forEach(function (g) { g.style.opacity = '1'; g.style.visibility = 'visible'; });
    }, 150);
  }

  /* ---- filter checkbox (code component "FilterCheckbox") */
  function cbGroup(cb) { return GROUP[cb.getAttribute('data-filter-type')]; }
  function cbOn(cb) { var g = cbGroup(cb); return !!g && FS[g].indexOf(cb.getAttribute('data-embun-value')) >= 0; }
  function paintCb(cb) {
    var on = cbOn(cb), hov = !!cb.__hov, p = cb.querySelector('p');
    cb.setAttribute('aria-checked', on ? 'true' : 'false');
    if (p) p.style.color = hov && !on ? C.ramp(51) : C.ink;
    if (cb.getAttribute('data-filter-type') === 'variant') {   /* button style (Size) */
      cb.style.border = '1px solid ' + (on || hov ? C.ink : C.a(0.1));
      cb.style.background = on ? C.a(0) : C.page;
      return;
    }
    var box = cb.firstElementChild;
    if (!box || box === p) return;
    box.style.border = '1px solid ' + (on || hov ? C.ink : C.a(0.1));
    box.style.background = on ? C.ink : C.page;
    if (on && !box.firstElementChild) {
      box.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="shape-rendering:crispedges;stroke-width:1.5px"><path d="M10 3L4.5 8.5L2 6" stroke="' + C.ink + '" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"></path></svg>';
    } else if (!on) box.innerHTML = '';
  }
  function paintCount() {
    var n = FS.collection.length + FS.product_type.length + FS.product_tag.length + FS.variant.length + FS.price.length;
    E.$$('.framer-gxrqp [data-framer-name="Filter Title"] span, .framer-Zf8GF [data-framer-name="Filter Title"] span').forEach(function (s) { s.textContent = '(' + n + ')'; });
  }
  function initFilters() {
    var cbs = E.$$('[role="checkbox"][data-filter-type]');
    cbs.forEach(function (cb) {
      var toggle = function () {
        var g = cbGroup(cb), v = cb.getAttribute('data-embun-value');
        if (!g || !v) return;
        var i = FS[g].indexOf(v);
        if (i >= 0) FS[g].splice(i, 1); else FS[g].push(v);
        writeURL();
        cbs.forEach(paintCb); paintCount();
        updateGrids();
      };
      cb.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      cb.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      cb.addEventListener('mouseenter', function () { cb.__hov = true; paintCb(cb); });
      cb.addEventListener('mouseleave', function () { cb.__hov = false; paintCb(cb); });
      cb.addEventListener('touchstart', function () { cb.__hov = true; paintCb(cb); }, { passive: true });
      cb.addEventListener('touchend', function () { cb.__hov = false; paintCb(cb); }, { passive: true });
      paintCb(cb);
    });
    paintCount();
  }

  /* ---- collapsible sections of the desktop/tablet panel: [base(closed), open] variant ids */
  var SECT = { 'framer-zTnNY': ['telkq1', '1ci1jy6'], 'framer-0qwKj': ['1mkpysb', '71q1g1'], 'framer-6E2Vf': ['1xo2si4', '1suz11f'],
    'framer-YIR1S': ['1q1yb55', 'niw8ia'], 'framer-zMfUV': ['hdwcz1', 'qykwt1'] };
  function initSections() {
    E.$$('.framer-gxrqp').forEach(function (panel) {
      Object.keys(SECT).forEach(function (cls) {
        E.$$('.' + cls, panel).forEach(function (root) {
          var ids = SECT[cls], title = root.querySelector('[data-framer-name="Filter Title"]'), btns = root.querySelector('[data-framer-name="Filter Buttons"]');
          var arrow = root.querySelector('[data-framer-name="Arrow"]');
          if (!title || !btns) return;
          var isOpen = function () { return root.classList.contains('framer-v-' + ids[1]); };
          root.__rot = isOpen() ? 180 : 0;
          var set = function (open) {
            var h0 = btns.getBoundingClientRect().height;
            root.classList.toggle('framer-v-' + ids[1], open);
            root.classList.toggle('framer-v-' + ids[0], !open);
            root.setAttribute('data-framer-name', open ? 'Filter Dropdown - Open' : 'Filter Dropdown - Closed');
            var h1 = btns.getBoundingClientRect().height;
            var ov = btns.style.overflow; btns.style.overflow = 'hidden';
            animH(btns, h0, h1, E.T.soft, function () { btns.style.overflow = ov; });
            if (arrow) { var r0 = root.__rot; root.__rot = open ? 180 : 0; go(arrow, { transform: 'rotate(' + root.__rot + 'deg)' }, E.T.soft, { transform: 'rotate(' + r0 + 'deg)' }); }
          };
          root.addEventListener('click', function (e) {
            if (isOpen()) { if (title.contains(e.target)) set(false); }
            else set(true);
          });
        });
      });
    });
  }

  /* ---- Accordion Plus Icon (Plus <-> Minus) */
  function plusIcon(ic, minus) {
    if (!ic) return;
    ic.classList.toggle('framer-v-1wco9yj', minus); ic.classList.toggle('framer-v-s42fl', !minus);
    ic.setAttribute('data-framer-name', minus ? 'Minus' : 'Plus');
    var h = ic.querySelector('.framer-rr4e0p'), v = ic.querySelector('.framer-r49v1o'), t = minus ? TR.plus : E.T.stiff;
    if (ic.__h == null) { ic.__h = 0; ic.__v = 90; }
    var h0 = ic.__h, v0 = ic.__v;
    ic.__h = minus ? 180 : 0; ic.__v = minus ? 180 : 90;
    go(h, { transform: 'rotate(' + ic.__h + 'deg)' }, t, { transform: 'rotate(' + h0 + 'deg)' });
    go(v, { transform: 'rotate(' + ic.__v + 'deg)' }, t, { transform: 'rotate(' + v0 + 'deg)' });
  }

  /* ---- phone filter panel ("Filter Dropdown - Collections Mobile", instant) */
  function initMobilePanel() {
    E.$$('.framer-Zf8GF').forEach(function (root) {
      var title = root.querySelector('[data-framer-name="Filter Title"]');
      if (!title) return;
      title.addEventListener('click', function () {
        var open = !root.classList.contains('framer-v-8upeun');
        root.classList.toggle('framer-v-8upeun', open); root.classList.toggle('framer-v-1r0wd78', !open);
        root.setAttribute('data-framer-name', open ? 'Mobile - Open' : 'Mobile - Closed');
        var w = title.querySelector('[data-framer-name="Wrapper"]');
        if (w) w.style.opacity = open ? '0.5' : '1';
        plusIcon(title.querySelector('.framer-l45Ii'), open);
      });
    });
  }

  /* ---- sort ("sort by" / "sort by - Favorites") */
  function initSort() {
    var roots = E.$$('[data-framer-name="sort by"]');
    var paint = function () {
      roots.forEach(function (root) {
        var sel = root.querySelector('select'), labels = root.querySelectorAll('[data-framer-name="Title"] p');
        if (!sel) return;
        sel.value = FS.sort;
        if (sel.selectedIndex < 0) sel.selectedIndex = 0;
        if (labels.length) labels[labels.length - 1].textContent = sel.options[sel.selectedIndex].text;
      });
    };
    roots.forEach(function (root) {
      var sel = root.querySelector('select'), inner = root.firstElementChild;
      if (!sel) return;
      sel.addEventListener('change', function () {
        FS.sort = sel.value; FS.sortSet = true;
        paint(); writeURL(); updateGrids();
      });
      root.addEventListener('mouseenter', function () { go(inner, { opacity: '0.4' }, E.T.soft); });
      root.addEventListener('mouseleave', function () { go(inner, { opacity: '1' }, E.T.soft); });
    });
    paint();
  }

  function initListing() {
    gridMode = 'listing';
    readURL();
    initFilters(); initSections(); initMobilePanel(); initSort();
    renderGrids(); revealGrids();
    window.addEventListener('popstate', function () { location.reload(); });
  }
  function initFavorites() {
    gridMode = 'favorites';
    readURL();
    initSort();
    renderGrids(); revealGrids();
    document.addEventListener('embun:fav', function () { updateGrids(); });
    window.addEventListener('popstate', function () { location.reload(); });
  }

  /* ---------------------------------------------------------------- product page */
  function initPDP(main) {
    var p = E.product(main.getAttribute('data-embun-product'));
    if (!p) return;
    var vals = variants(p), selV = vals[0] || '', qty = 1;
    var amountPrice = function (v) { var m = /(\d+(?:\.\d+)?)/.exec(v || ''); return m ? parseFloat(m[1]) : p.price; };

    /* variant chips */
    var chips = E.$$('[data-embun-variant]');
    var paintChip = function (b) {
      var sel = b.getAttribute('data-embun-variant') === selV, on = sel || b.__hov;
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
      b.style.backgroundColor = on ? C.ramp(233) : C.ramp(237, 0);
      b.style.border = '1px solid ' + (on ? C.ink : C.a(0.08));
      b.style.color = on ? C.ink : C.a(0.8);
      b.parentElement.style.zIndex = b.__hov ? '2' : '';
    };
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        selV = b.getAttribute('data-embun-variant');
        chips.forEach(paintChip);
        if (p.amounts && p.amounts.length) E.$$('.framer-1ghd0a4-container [data-embun-price]').forEach(function (el) { el.textContent = E.money(amountPrice(selV)); });
        setQty(1);
      });
      b.addEventListener('mouseenter', function () { b.__hov = true; paintChip(b); });
      b.addEventListener('mouseleave', function () { b.__hov = false; paintChip(b); });
      paintChip(b);
    });

    /* quantity */
    var setQty = function (n) {
      qty = Math.max(1, Math.min(100, n));
      E.$$('.framer-1ulxgt6-container p').forEach(function (el) { el.textContent = qty; });
      E.$$('.framer-10n2ukh-container [role="button"]').forEach(function (b) {
        var dis = qty <= 1, svg = b.querySelector('svg');
        b.setAttribute('aria-disabled', dis ? 'true' : 'false');
        b.setAttribute('aria-label', dis ? 'Button disabled' : 'Button active');
        b.style.cursor = dis ? 'not-allowed' : 'pointer';
        if (svg) svg.style.fill = dis ? C.a(0.16) : C.ink;
      });
    };
    E.$$('.framer-10n2ukh-container [role="button"]').forEach(function (b) { b.addEventListener('click', function () { setQty(qty - 1); }); });
    E.$$('.framer-z4bi3s-container [role="button"]').forEach(function (b) { b.addEventListener('click', function () { setQty(qty + 1); }); });
    setQty(1);

    /* purchase button: data is local, so the "Available" state shows at once (no Loading) */
    E.$$('.fc-purchase-button-container').forEach(function (pb) {
      ['Available', 'Out of stock', 'Select', 'Loading'].forEach(function (n) {
        var el = pb.querySelector('[data-framer-name="' + n + '"]');
        if (!el) return;
        var on = n === 'Available';
        el.style.transition = 'opacity 0.3s ease-in-out';
        el.style.opacity = on ? '1' : '0';
        el.style.visibility = on ? 'visible' : 'hidden';
        el.style.pointerEvents = on ? 'auto' : 'none';
        el.style.zIndex = on ? '2' : '0';
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        el.setAttribute('tabindex', on ? '0' : '-1');
      });
      var av = pb.querySelector('[data-framer-name="Available"]'), face = av && av.querySelector('.framer-gASox');
      if (!av) return;
      var add = function (e) {
        e.preventDefault();
        E.cart.add(p.slug, selV, qty);
        if (typeof E.openCart === 'function') E.openCart();
      };
      av.addEventListener('click', add);
      av.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') add(e); });
      av.addEventListener('mouseenter', function () { go(face, { backgroundColor: C.deep }, E.T.stiff); });
      av.addEventListener('mouseleave', function () { go(face, { backgroundColor: C.ink }, E.T.stiff); });
    });

    /* heart (bound to this product — the template bound it to an empty id) */
    E.$$('[data-embun-heart]', main).forEach(function (w) { if (!w.closest('.framer-in5igc')) initHeart(w); });

    /* desktop/tablet gallery: hover (or click) a thumbnail -> main image swaps instantly */
    var gal = [];
    try { gal = JSON.parse(main.getAttribute('data-embun-gallery') || '[]'); } catch (e) {}
    var thumbs = E.$$('[data-embun-thumb]'), active = 1;
    var paintThumb = function (w) {
      var on = +w.getAttribute('data-embun-thumb') === active, hl = on || w.__hov, d = w.querySelector('.framer-DVECF');
      if (!d) return;
      d.classList.toggle('framer-v-25q7ot', on); d.classList.toggle('framer-v-i8nvvf', !on);
      d.setAttribute('data-framer-name', on ? 'Active' : 'Inactive');
      d.style.setProperty('--border-color', hl ? C.a(0.2) : C.a(0));
      go(d.querySelector('.framer-1xvugsa-container'), { opacity: hl ? '1' : '0.5' }, E.T.stiff);
      var img = d.querySelector('.framer-1xvugsa-container > div');
      if (img) img.style.cursor = on ? 'unset' : 'pointer';
    };
    var setImage = function (i) {
      active = i;
      var main1 = document.querySelector('[data-framer-name="main"] img');
      if (main1 && gal[i - 1]) { main1.removeAttribute('srcset'); main1.removeAttribute('sizes'); main1.src = gal[i - 1]; }
      thumbs.forEach(paintThumb);
    };
    thumbs.forEach(function (w) {
      var i = +w.getAttribute('data-embun-thumb');
      w.addEventListener('mouseenter', function () { w.__hov = true; setImage(i); });
      w.addEventListener('mouseleave', function () { w.__hov = false; paintThumb(w); });
      w.addEventListener('click', function () { setImage(i); });
    });

    /* phone slideshow: swipe / drag, dots */
    E.$$('[data-framer-name="FC Slideshow Mobile"]').forEach(function (ss) {
      var box = ss.querySelector('.framer-oe1wif-container > div');
      if (!box || box.__ss) return;
      box.__ss = true;
      var track = box.firstElementChild, dots = E.$$('button[aria-label]', box), n = track.children.length, idx = 0, dx = 0, x0 = 0, drag = false, pid = null;
      var pos = function (anim) {
        track.style.transition = anim ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
        track.style.transform = 'translateX(calc(' + (-idx * 100) + '% + ' + (-idx * 5 + dx) + 'px)) translateZ(0)';
      };
      var paintDots = function () {
        dots.forEach(function (d, i) {
          var on = i === idx;
          d.style.width = on ? '20px' : '5px'; d.style.height = '5px';
          d.style.borderRadius = on ? '8px' : '6px';
          d.style.backgroundColor = on || d.__hov ? C.ink : C.ramp(186);
        });
      };
      var goTo = function (i) { idx = Math.max(0, Math.min(n - 1, i)); dx = 0; pos(true); paintDots(); };
      dots.forEach(function (d, i) {
        d.addEventListener('click', function (e) { e.stopPropagation(); goTo(i); });
        d.addEventListener('mouseenter', function () { d.__hov = true; paintDots(); });
        d.addEventListener('mouseleave', function () { d.__hov = false; paintDots(); });
        d.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      });
      box.style.cursor = 'grab';
      box.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        drag = true; pid = e.pointerId; x0 = e.clientX; dx = 0;
        box.style.cursor = 'grabbing';
        try { box.setPointerCapture(pid); } catch (er) {}
        pos(false);
      });
      box.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== pid) return;
        var d = e.clientX - x0;
        if ((idx === 0 && d > 0) || (idx === n - 1 && d < 0)) d = (d < 0 ? -1 : 1) * Math.pow(Math.abs(d), 0.75) * 1.5;  /* rubber band */
        dx = d; pos(false);
      });
      var end = function () {
        if (!drag) return;
        drag = false; box.style.cursor = 'grab';
        var d = dx, w = box.getBoundingClientRect().width || 1;
        if (Math.abs(d) > 50 || Math.abs(d) / 100 > 0.5 || Math.abs(d) / w > 0.5) goTo(idx + (d < 0 ? 1 : -1)); else goTo(idx);
      };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', end);
      box.addEventListener('dragstart', function (e) { e.preventDefault(); });
      paintDots();
    });

    /* "Shipping, Exchange and Returns" link + right drawer */
    var shipOpen = false;
    E.$$('.framer-cAO1u').forEach(function (btn) {
      var line = btn.querySelector('[data-framer-name="Line"]');
      var out = function (o) { go(line, { transform: o ? 'translateX(177px)' : 'translateX(0px)' }, TR.ship); };
      btn.addEventListener('mouseenter', function () { out(true); });
      btn.addEventListener('mouseleave', function () { if (!shipOpen) out(false); });
      btn.addEventListener('click', function () {
        if (shipOpen) return;
        shipOpen = true; out(true);
        E.frag('shipping-' + E.bp()).then(function (html) {
          if (!html) { shipOpen = false; return; }
          var wrap = E.html(html);
          wrap.removeAttribute('id'); wrap.setAttribute('data-embun-shipping', '');
          document.body.appendChild(wrap);
          var back = wrap.querySelector('.framer-1oh0286'), drawer = wrap.querySelector('.framer-s3zhx2-container');
          go(back, { opacity: '1' }, E.T.drawer, { opacity: '0' });
          go(drawer, { transform: 'translateX(0px)' }, E.T.drawer, { transform: 'translateX(451px)' });
          E.lock();
          var close = function () {
            if (wrap.__closing) return;
            wrap.__closing = true;
            go(back, { opacity: '0' }, E.T.drawer);
            var a = go(drawer, { transform: 'translateX(451px)' }, E.T.drawer);
            var done = function () { wrap.remove(); };
            if (a) a.addEventListener('finish', done); else done();
            E.unlock();
            shipOpen = false;
            if (!btn.matches(':hover')) out(false);
          };
          back.addEventListener('click', close);
          var cb = wrap.querySelector('.framer-cBU43'), x = cb && cb.querySelector('[data-framer-name="x"]');
          if (cb) {
            cb.addEventListener('click', close);
            cb.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') close(); });
            cb.addEventListener('mouseenter', function () { go(x, { transform: 'rotate(90deg)' }, E.T.stiff, { transform: 'rotate(0deg)' }); });
            cb.addEventListener('mouseleave', function () { go(x, { transform: 'rotate(0deg)' }, E.T.stiff, { transform: 'rotate(90deg)' }); });
          }
        });
      });
    });

    /* product info accordion (single open) */
    E.$$('.framer-qoQEP').forEach(function (acc) {
      var wraps = Array.prototype.filter.call(acc.children, function (c) { return c.querySelector('.framer-ILWyj'); });
      var lines = Array.prototype.filter.call(acc.children, function (c) { return c.getAttribute('data-framer-name') === 'Line'; });
      acc.__open = -1;
      var hoverRow = function (row, on) {
        go(row.querySelector('.framer-ckgsvz'), { opacity: on ? '0.5' : '1' }, E.T.stiff);
        go(row.querySelector('.framer-1yejm3g-container'), { opacity: on ? '0.5' : '1' }, E.T.stiff);
      };
      var setRow = function (row, open) {
        var h0 = row.getBoundingClientRect().height;
        row.classList.toggle('framer-v-1se14im', open); row.classList.toggle('framer-v-na9fgw', !open);
        row.setAttribute('data-framer-name', open ? 'Desktop - Open' : 'Desktop -  Closed');
        row.style.height = '';
        var h1 = row.getBoundingClientRect().height;
        animH(row, h0, h1, E.T.stiff);
        plusIcon(row.querySelector('.framer-l45Ii'), open);
        if (open) hoverRow(row, false);
      };
      wraps.forEach(function (w, i) {
        var row = w.querySelector('.framer-ILWyj');
        w.addEventListener('click', function () {
          var idx = acc.__open === i ? -1 : i;
          wraps.forEach(function (w2, j) {
            var r2 = w2.querySelector('.framer-ILWyj'), want = j === idx;
            if (want !== r2.classList.contains('framer-v-1se14im')) setRow(r2, want);
          });
          acc.__open = idx;
          acc.setAttribute('data-framer-name', idx < 0 ? 'Closed' : 'Question ' + (idx + 1));
          if (lines[0]) go(lines[0], { opacity: idx === 1 ? '0.5' : '0.2' }, TR.plus);
        });
        w.addEventListener('mouseenter', function () { if (acc.__open !== i) hoverRow(row, true); });
        w.addEventListener('mouseleave', function () { hoverRow(row, false); });
      });
    });

    /* key ingredients: hover a tab on desktop, tap on tablet / phone */
    var desc = [];
    try { desc = JSON.parse((document.getElementById('embun-ingredients') || {}).textContent || '[]'); } catch (e) {}
    var ZS = { 1: [5, 4, 3, 2], 2: [4, 5, 3, 2], 3: [3, 4, 5, 2], 4: [3, 4, 3, 5] };
    E.$$('.framer-S5YAy').forEach(function (sec) {
      var desk = sec.classList.contains('framer-v-1v0g5vm');
      sec.__ing = 1;
      var setIng = function (n) {
        if (sec.__ing === n) return;
        sec.__ing = n;
        sec.setAttribute('data-framer-name', 'Ingredient ' + n + (desk ? '' : sec.classList.contains('framer-v-1gzu8e8') ? ' Tablet' : ' Mobile'));
        [1, 2, 3, 4].forEach(function (i) {
          var row = sec.querySelector('[data-framer-name="' + i + '"]'), tab = row && row.querySelector('.framer-p8W1R'), on = i === n;
          if (tab) {
            var lb = tab.querySelector('[data-framer-name="Line Black"]'), lw = lb ? lb.getBoundingClientRect().width : 0, tw = tab.getBoundingClientRect().width || 1;
            tab.classList.toggle('framer-v-1m5ydfw', on); tab.classList.toggle('framer-v-gkh8na', !on);
            tab.setAttribute('data-framer-name', on ? 'Ingredient Tab - Active' : 'Ingredient Tab');
            go(tab.querySelector('[data-framer-component-type="RichTextContainer"]'), { opacity: on ? '1' : '0.4' }, TR.tab);
            go(lb, { width: on ? '100%' : '0%' }, TR.tab, { width: (lw / tw * 100) + '%' });
          }
          var img = sec.querySelector('[data-framer-name="Image ' + i + '"]');
          if (img) {
            img.style.zIndex = ZS[n][i - 1];
            if (on) go(img, { transform: 'scale(1)' }, TR.ing, { transform: 'scale(1.06)' });
            else go(img, { transform: 'scale(1.06)' }, TR.ing);
          }
        });
        var d = sec.querySelector('[data-framer-name="Descriptor"] p');   /* instant swap (also on tablet: template bug kept #1) */
        if (d && desc[n - 1]) d.textContent = desc[n - 1];
      };
      [1, 2, 3, 4].forEach(function (i) {
        var row = sec.querySelector('[data-framer-name="' + i + '"]');
        if (!row) return;
        row.addEventListener(desk ? 'mouseenter' : 'click', function () { setIng(i); });
        if (desk) row.addEventListener('click', function () { setIng(i); });
      });
    });
    /* "see all ingredients" */
    E.$$('.framer-7snpu').forEach(function (b) {
      var t = b.querySelector('.framer-qzskgd'), g = b.querySelector('.framer-o99qgv');
      b.addEventListener('mouseenter', function () { go(t, { opacity: '1' }, TR.seeall); go(g, { opacity: '1', transform: 'rotate(90deg)' }, TR.seeall, { transform: 'rotate(0deg)' }); });
      b.addEventListener('mouseleave', function () { go(t, { opacity: '0.4' }, TR.seeall); go(g, { opacity: '0.4', transform: 'rotate(0deg)' }, TR.seeall, { transform: 'rotate(90deg)' }); });
    });
  }

  /* ---------------------------------------------------------------- /collections */
  function initCollections() {
    E.$$('[data-embun-type-card]').forEach(function (card) {
      var v = card.querySelector('video'), ov = card.querySelector('[data-framer-name="Overlay"]');
      if (!v) return;
      v.muted = true;
      if (card.getAttribute('data-embun-type-card') === 'P') {   /* Mobile variant: always playing */
        var pl = v.play(); if (pl && pl.catch) pl.catch(function () {});
        return;
      }
      card.addEventListener('mouseenter', function () {
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
        go(ov, { backgroundColor: C.a(0.1) }, E.T.out1);
      });
      card.addEventListener('mouseleave', function () { v.pause(); go(ov, { backgroundColor: C.a(0.05) }, E.T.out1); });
    });
    /* "Collections - Card": glass button fills on hover (desktop/tablet variants; Mobile variants are always filled) */
    E.$$('.framer-O5grK.framer-v-1pp623, .framer-O5grK.framer-v-9ki90z').forEach(function (card) {
      var btn = card.querySelector('[data-framer-name="Button"]'), p = btn && btn.querySelector('p');
      if (!btn) return;
      if (p) p.style.transition = 'color ' + E.tr(E.T.soft).duration + 'ms ' + E.tr(E.T.soft).easing;
      card.addEventListener('mouseenter', function () {
        btn.style.setProperty('--border-color', C.page);
        go(btn, { backgroundColor: C.page }, E.T.soft);
        if (p) p.style.color = C.ink;
      });
      card.addEventListener('mouseleave', function () {
        btn.style.setProperty('--border-color', 'rgba(252, 251, 247, 0.4)');
        go(btn, { backgroundColor: 'rgba(252, 251, 247, 0)' }, E.T.soft);
        if (p) p.style.color = C.page;
      });
    });
  }

  /* ---------------------------------------------------------------- boot */
  E.mod('commerce', function () {
    E.initCards(document);
    var main = document.querySelector('[data-embun-listing], [data-embun-favorites], [data-embun-product]');
    if (main && main.hasAttribute('data-embun-listing')) initListing();
    else if (main && main.hasAttribute('data-embun-favorites')) initFavorites();
    else if (main && main.hasAttribute('data-embun-product')) initPDP(main);
    if (E.page === 'collections') initCollections();
    /* cards injected later by other modules (cart drawer recommendations, cloned slides) */
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType !== 1) return;
            if (n.classList.contains('framer-in5igc')) initCard(n); else if (n.querySelector('.framer-in5igc')) E.initCards(n);
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  });
})();
