/* Embun — checkout (MOCK store: no real payment is taken and nothing ships).
   Flow: bag -> /checkout/ (contact, delivery, shipping, payment) -> pending order saved -> /pay/ (Pintu Pay, test mode)
   -> back here with ?pay=success|failed|cancelled -> order confirmed, bag cleared, thank-you modal (the template's
   newsletter modal component with new content). Draft details persist between visits (localStorage, this browser only).
   Shipping follows the site's own copy: Standard RM8 (free over RM150), Sabah & Sarawak flat RM15, shop pick-up free. */
EMBUN.mod('checkout', function (E) {
  if (E.page !== 'checkout') return;
  var root = E.$('[data-ck]'); if (!root) return;
  var P = E.prefix || './';
  var LS = { draft: 'embun_checkout', pending: 'embun_pending_order', orders: 'embun_orders' };
  var EAST = ['Sabah', 'Sarawak', 'W.P. Labuan'];
  var CODES = { WELCOME10: 10 };            // the newsletter's "10% off your first order" (gift cards excluded)
  var METHOD = { fpx: 'FPX online banking', card: 'Credit or debit card', duitnow: 'DuitNow QR', tng: "Touch 'n Go eWallet", grabpay: 'GrabPay' };
  var SHOPS = {};
  E.$$('[name="shop"]', root).forEach(function (r) {
    var lab = r.closest('.ck-opt');
    SHOPS[r.value] = { name: E.$('.ck-opt-t', lab).textContent, addr: E.$('.ck-opt-m', lab).textContent };
  });
  var SOFT = E.tr(E.T.soft);
  root.style.setProperty('--ck-ease', SOFT.easing); root.style.setProperty('--ck-dur', Math.round(SOFT.duration) + 'ms');

  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var money = function (v) { return E.money(v); };
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  var form = E.$('[data-ck-form]', root), sum = E.$('[data-ck-summary]', root);
  var views = { form: E.$('[data-ck-view="form"]', root), done: E.$('[data-ck-view="done"]', root), empty: E.$('[data-ck-view="empty"]', root) };
  function view(v) { Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; }); }
  var h1 = E.$('[data-ck-h1]'), sub = E.$('[data-ck-sub]');

  /* ---------------------------------------------------------------- cart -> lines + totals */
  function lines() {
    return E.cart.items().map(function (it) {
      var p = E.product(it.slug); if (!p) return null;
      var unit = E.unitPrice(p, it.variant);
      return { slug: it.slug, name: p.name, variant: it.variant, qty: it.qty, unit: unit, line: r2(unit * it.qty), img: p.img,
        gift: !!(p.amounts && p.amounts.length) };
    }).filter(Boolean);
  }
  function val(name) { var el = form.elements[name]; if (!el) return ''; if (el.type === 'checkbox') return el.checked; return (el.value || '').trim(); }
  function radio(name) { var r = E.$('[name="' + name + '"]:checked', root); return r ? r.value : ''; }
  function shipping(ls, sub) {
    if (ls.length && ls.every(function (l) { return l.gift; })) return { cost: 0, label: 'Email delivery', eta: 'Gift cards arrive by email', key: 'email' };
    if (radio('mode') === 'pickup') return { cost: 0, label: 'Shop pick-up', eta: '1 to 3 working days', key: 'pickup' };
    var st = val('state');
    if (EAST.indexOf(st) >= 0) return { cost: 15, label: 'Sabah & Sarawak', eta: '4 to 7 working days', key: 'east' };
    return { cost: sub >= 150 ? 0 : 8, label: 'Standard', eta: '2 to 4 working days', key: 'std', pending: !st };
  }
  function totals(ls) {
    var subtotal = r2(ls.reduce(function (a, l) { return a + l.line; }, 0));
    var merch = r2(ls.reduce(function (a, l) { return a + (l.gift ? 0 : l.line); }, 0));
    var code = draft.code && CODES[draft.code] ? draft.code : '';
    var discount = code ? r2(merch * CODES[code] / 100) : 0;
    var ship = shipping(ls, subtotal);
    return { subtotal: subtotal, discount: discount, code: code, ship: ship, total: r2(subtotal - discount + ship.cost) };
  }

  /* ---------------------------------------------------------------- summary panel */
  function itemsHTML(ls) {
    return ls.map(function (l) {
      var meta = [l.variant && (l.gift ? 'Amount ' + l.variant : l.variant), 'Qty ' + l.qty].filter(Boolean).join(' · ');
      return '<li class="ck-item"><span class="ck-thumb"><img src="' + P + l.img + '" alt="" loading="lazy"></span>' +
        '<span class="ck-item-txt"><span class="framer-text framer-styles-preset-15x05lw">' + esc(l.name) + '</span>' +
        '<span class="framer-text framer-styles-preset-du009m ck-item-m">' + esc(meta) + '</span></span>' +
        '<span class="framer-text framer-styles-preset-15x05lw ck-item-p">' + money(l.line) + '</span></li>';
    }).join('');
  }
  function fillSummary(box, ls, t, frozen) {
    E.$('[data-ck-items]', box).innerHTML = itemsHTML(ls);
    E.$('[data-ck-subtotal]', box).textContent = money(t.subtotal);
    var dr = E.$('[data-ck-discount-row]', box);
    dr.hidden = !t.discount;
    if (t.discount) { E.$('[data-ck-discount]', box).textContent = '−' + money(t.discount); E.$('[data-ck-code-name]', box).textContent = '(' + t.code + ')'; }
    var sd = E.$('[data-ck-shipping]', box);
    sd.textContent = t.ship.pending ? 'Add your state' : t.ship.cost ? money(t.ship.cost) : 'Free';
    sd.classList.toggle('is-muted', !!t.ship.pending);
    E.$('[data-ck-grand]', box).textContent = money(t.total);
    var tt = E.$('[data-ck-total]', box); if (tt) tt.textContent = money(t.total);
    var codeForm = E.$('[data-ck-code]', box), rm = E.$('[data-ck-code-remove]', box);
    if (frozen) { if (codeForm) codeForm.remove(); if (rm) rm.remove(); }
  }

  /* ---------------------------------------------------------------- live form state */
  var draft = get(LS.draft, {});
  function rates(t) {
    var box = E.$('[data-ck-rates]', root), s = t.ship;
    E.$('[data-ck-shipsec]', root).hidden = s.key === 'pickup' || s.key === 'email';
    var meta = s.eta + (s.key === 'std' ? (s.pending ? '. Sabah, Sarawak and Labuan ship at a flat RM15' : t.subtotal >= 150 ? '. Free over RM150' : '. Free over RM150, add ' + money(150 - t.subtotal) + ' more') : '');
    box.innerHTML = '<label class="ck-opt is-on"><input type="radio" name="rate" checked><span class="ck-dot"></span><span class="ck-opt-txt">' +
      '<span class="framer-text framer-styles-preset-15x05lw ck-opt-t">' + s.label + '</span><span class="framer-text framer-styles-preset-du009m ck-opt-m">' + meta + '</span></span>' +
      '<span class="ck-opt-r framer-text framer-styles-preset-15x05lw">' + (s.cost ? money(s.cost) : 'Free') + '</span></label>';
  }
  function sync() {
    var ls = lines();
    if (!ls.length) return view('empty');
    view('form');
    var t = totals(ls);
    fillSummary(sum, ls, t);
    rates(t);
    E.$$('.ck-chip, .ck-opt', root).forEach(function (c) { var i = E.$('input', c); if (i && i.type === 'radio') c.classList.toggle('is-on', i.checked); });
    var mode = radio('mode'), allGift = ls.every(function (l) { return l.gift; });
    E.$('.ck-chips', root).hidden = allGift; E.$('[data-ck-giftnote]', root).hidden = !allGift;
    E.$$('[data-ck-mode]', root).forEach(function (b) { b.hidden = allGift || b.getAttribute('data-ck-mode') !== mode; });
    E.$('[data-ck-bank]', root).hidden = radio('method') !== 'fpx';
    var st = form.elements.state; st.classList.toggle('is-empty', !st.value);
    var bk = form.elements.bank; bk.classList.toggle('is-empty', !bk.value);
    E.$('.ck-btn-t', form).textContent = 'Pay ' + money(t.total);
  }
  function save() {
    var d = { code: draft.code || '' };
    ['email', 'phone', 'first', 'last', 'addr1', 'addr2', 'postcode', 'city', 'state', 'bank'].forEach(function (k) { d[k] = val(k); });
    d.news = val('news'); d.mode = radio('mode'); d.shop = radio('shop'); d.method = radio('method');
    draft = d; put(LS.draft, d);
  }
  function restore() {
    ['email', 'phone', 'first', 'last', 'addr1', 'addr2', 'postcode', 'city', 'state', 'bank'].forEach(function (k) { if (draft[k] && form.elements[k]) form.elements[k].value = draft[k]; });
    if (draft.news) form.elements.news.checked = true;
    ['mode', 'shop', 'method'].forEach(function (k) { var r = draft[k] && E.$('[name="' + k + '"][value="' + draft[k] + '"]', root); if (r) r.checked = true; });
  }

  /* Malaysian postcode -> state, only to pre-fill an empty State (the customer can change it) */
  var PC = [[1, 2, 'Perlis'], [5, 9, 'Kedah'], [10, 14, 'Pulau Pinang'], [15, 18, 'Kelantan'], [20, 24, 'Terengganu'], [25, 28, 'Pahang'],
    [30, 36, 'Perak'], [39, 39, 'Pahang'], [40, 48, 'Selangor'], [49, 49, 'Pahang'], [50, 60, 'W.P. Kuala Lumpur'], [62, 62, 'W.P. Putrajaya'],
    [63, 68, 'Selangor'], [69, 69, 'Pahang'], [70, 73, 'Negeri Sembilan'], [75, 78, 'Melaka'], [79, 86, 'Johor'], [87, 87, 'W.P. Labuan'],
    [88, 91, 'Sabah'], [93, 98, 'Sarawak']];
  function stateFor(pc) { var n = parseInt(pc.slice(0, 2), 10); for (var i = 0; i < PC.length; i++) if (n >= PC[i][0] && n <= PC[i][1]) return PC[i][2]; return ''; }
  function phoneDigits(v) { var d = v.replace(/\D/g, ''); if (d.indexOf('60') === 0) d = '0' + d.slice(2); return d; }
  function phoneFmt(v) { var d = phoneDigits(v); if (/^01\d{8}$/.test(d)) return d.slice(0, 3) + '-' + d.slice(3, 6) + ' ' + d.slice(6); if (/^01\d{9}$/.test(d)) return d.slice(0, 3) + '-' + d.slice(3, 7) + ' ' + d.slice(7); return v; }

  form.addEventListener('input', function (ev) {
    var f = ev.target.closest('.ck-field'); if (f) clearErr(f);
    if (ev.target.name === 'postcode') {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 5);
      if (ev.target.value.length === 5 && !form.elements.state.value) { var s = stateFor(ev.target.value); if (s) form.elements.state.value = s; }
    }
    save(); sync();
  });
  form.addEventListener('change', function () { save(); sync(); });
  form.elements.phone.addEventListener('blur', function () { this.value = phoneFmt(this.value); save(); });

  /* ---------------------------------------------------------------- validation */
  function setErr(name, msg) { var f = E.$('[data-f="' + name + '"]', root); if (!f) return null; f.classList.add('is-bad'); E.$('.ck-err', f).textContent = msg; return f; }
  function clearErr(f) { f.classList.remove('is-bad'); var e = E.$('.ck-err', f); if (e) e.textContent = ''; }
  function validate() {
    E.$$('.ck-field.is-bad', root).forEach(clearErr);
    var bad = [], ship = radio('mode') === 'ship' && !lines().every(function (l) { return l.gift; });
    var need = function (k, msg) { if (!val(k)) bad.push(setErr(k, msg)); };
    if (!val('email')) bad.push(setErr('email', 'Enter your email address'));
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) bad.push(setErr('email', 'Enter an email address like name@example.com'));
    var ph = phoneDigits(val('phone'));
    if (!ph) bad.push(setErr('phone', 'Enter your mobile number'));
    else if (!/^01\d{8,9}$/.test(ph)) bad.push(setErr('phone', 'Enter a Malaysian mobile number, like 012-345 6789'));
    need('first', 'Enter your first name'); need('last', 'Enter your last name');
    if (ship) {
      need('addr1', 'Enter your address');
      if (!val('postcode')) bad.push(setErr('postcode', 'Enter your postcode'));
      else if (!/^\d{5}$/.test(val('postcode'))) bad.push(setErr('postcode', 'Postcodes have 5 digits'));
      need('city', 'Enter your city'); need('state', 'Choose your state');
    }
    if (radio('method') === 'fpx') need('bank', 'Choose your bank');
    bad = bad.filter(Boolean);
    if (bad.length) {
      var y = bad[0].getBoundingClientRect().top + scrollY - 120;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      var inp = E.$('input, select', bad[0]); if (inp) inp.focus({ preventScroll: true });
    }
    return !bad.length;
  }

  /* ---------------------------------------------------------------- discount code */
  var codeForm = E.$('[data-ck-code]', sum);
  codeForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = E.$('.ck-field', codeForm), inp = codeForm.elements.code, c = inp.value.trim().toUpperCase();
    clearErr(f);
    if (!c) return;
    if (!CODES[c]) { f.classList.add('is-bad'); E.$('.ck-err', f).textContent = "That code isn't valid"; return; }
    if (lines().every(function (l) { return l.gift; })) { f.classList.add('is-bad'); E.$('.ck-err', f).textContent = "Discount codes don't apply to gift cards"; return; }
    draft.code = c; put(LS.draft, draft); inp.value = ''; sync();
  });
  E.$('[data-ck-code-remove]', sum).addEventListener('click', function () { draft.code = ''; put(LS.draft, draft); sync(); });

  /* ---------------------------------------------------------------- summary fold (tablet / phone) */
  var tog = E.$('.ck-sum-toggle', sum), body = E.$('.ck-sum-body', sum);
  tog.addEventListener('click', function () {
    var open = !sum.classList.contains('is-open'), from = body.getBoundingClientRect().height;
    sum.classList.toggle('is-open', open); tog.setAttribute('aria-expanded', open);
    E.$('span', tog).textContent = open ? 'Hide order summary' : 'Show order summary';
    var to = open ? E.$('.ck-sum-in', body).getBoundingClientRect().height : 0;
    var a = body.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: SOFT.duration, easing: SOFT.easing });
    a.onfinish = function () { body.style.height = ''; };
  });
  E.$('[data-ck-bag]', root).addEventListener('click', function () { if (E.openCart) E.openCart(); });
  document.addEventListener('embun:cart', function () { if (!views.form.hidden || !views.empty.hidden) sync(); });

  /* ---------------------------------------------------------------- pay -> gateway */
  var busy = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy || !validate()) return;
    save();
    var ls = lines(), t = totals(ls), now = new Date();
    var ymd = String(now.getFullYear()).slice(2) + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
    var order = {
      id: 'EMB-' + ymd + '-' + (1000 + Math.floor(Math.random() * 9000)), created: now.toISOString(), status: 'pending',
      items: ls, subtotal: t.subtotal, discount: t.discount, code: t.code, shipping: t.ship, total: t.total,
      method: radio('method'), bank: radio('method') === 'fpx' ? val('bank') : '',
      contact: { email: val('email'), phone: phoneFmt(val('phone')), news: val('news') },
      name: { first: val('first'), last: val('last') }, mode: t.ship.key === 'pickup' ? 'pickup' : t.ship.key === 'email' ? 'email' : 'ship',
      shop: radio('mode') === 'pickup' ? SHOPS[radio('shop')] : null,
      address: { addr1: val('addr1'), addr2: val('addr2'), postcode: val('postcode'), city: val('city'), state: val('state') }
    };
    put(LS.pending, order);
    busy = true;
    var btn = E.$('[data-ck-pay]', form); btn.disabled = true;
    btn.innerHTML = '<div class="em-spinner"></div>';
    setTimeout(function () { location.href = P + 'pay/?order=' + encodeURIComponent(order.id); }, 600);
  });

  /* ---------------------------------------------------------------- confirmation */
  function findOrder(id) { return get(LS.orders, []).filter(function (o) { return o.id === id; })[0]; }
  function payLabel(o) { return METHOD[o.method] + (o.bank ? ' (' + o.bank + ')' : ''); }
  function deliveryLine(o) {
    if (o.mode === 'pickup' && o.shop) return 'Pick up at ' + o.shop.name + ', ' + o.shop.addr + '. We\'ll message you when it\'s ready, usually in 1 to 3 working days.';
    if (o.mode === 'email') return 'Your gift card arrives by email at ' + o.contact.email + '.';
    var a = o.address;
    return [o.name.first + ' ' + o.name.last, a.addr1, a.addr2, a.postcode + ' ' + a.city, a.state].filter(Boolean).join(', ') + '. ' +
      o.shipping.label + ' delivery, ' + o.shipping.eta + '.';
  }
  function showDone(o) {
    view('done');
    h1.textContent = 'Thank you, ' + o.name.first;
    sub.textContent = 'Order ' + o.id + ' is confirmed. Demo store, so no real payment was taken and nothing will ship.';
    var paid = new Date(o.paidAt || o.created);
    var when = paid.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    views.done.innerHTML =
      '<div class="ck-grid"><div class="ck-main">' +
      '<section class="ck-sec"><h2 class="framer-text framer-styles-preset-1i8k81j">Order ' + esc(o.id) + '</h2>' +
      '<p class="framer-text framer-styles-preset-15x05lw ck-note">Paid ' + when + (o.ref ? ' · Pintu Pay reference ' + esc(o.ref) : '') + '</p></section>' +
      '<dl class="ck-facts">' +
      '<div><dt class="framer-text framer-styles-preset-du009m">Contact</dt><dd class="framer-text framer-styles-preset-15x05lw">' + esc(o.contact.email) + '<br>' + esc(o.contact.phone) + '</dd></div>' +
      '<div><dt class="framer-text framer-styles-preset-du009m">Payment</dt><dd class="framer-text framer-styles-preset-15x05lw">' + esc(payLabel(o)) + '<br>' + money(o.total) + '</dd></div>' +
      '<div style="grid-column:1/-1"><dt class="framer-text framer-styles-preset-du009m">Delivery</dt><dd class="framer-text framer-styles-preset-15x05lw">' + esc(deliveryLine(o)) + '</dd></div>' +
      '</dl>' +
      '<a class="ck-btn" href="' + P + 'all/">Continue shopping</a></div>' +
      sum.outerHTML.replace('data-ck-summary', 'data-ck-summary-done') + '</div>';
    var box = E.$('[data-ck-summary-done]', views.done);
    E.$('.ck-sum-h', box).textContent = 'Your order';
    fillSummary(box, o.items, { subtotal: o.subtotal, discount: o.discount, code: o.code, ship: o.shipping, total: o.total }, true);
    E.$('[data-ck-shipping]', box).textContent = o.shipping.cost ? money(o.shipping.cost) : 'Free';
    document.title = 'Order ' + o.id + ' — Embun';
  }

  /* thank-you: the newsletter modal (same card, image slot, close X, backdrop and motion) with new content */
  var MODAL_IN = { type: 'tween', duration: 0.8, delay: 0.2, ease: [0.25, 1, 0.5, 1] };   // template's card presence
  function thankYou(o) {
    E.frag('modal-newsletter-' + E.bp()).then(function (html) {
      var t = document.createElement('template'); t.innerHTML = html.trim();
      var src = t.content.firstElementChild, bd = src && src.firstElementChild;
      if (!bd) return;
      var wrap = bd.firstElementChild, card = wrap.querySelector('.framer-rO7dW, .framer-lvMJU');
      card.classList.add('ck-ty-card');
      var label = card.querySelector('.framer-qde0vz'); if (label) label.remove();   // no caps micro-label
      var head = card.querySelector('h1'); if (head) head.textContent = 'Thank you, ' + o.name.first;
      var img = card.querySelector('img');
      if (img) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = P + 'img/s/checkout-thanks.webp'; img.alt = 'The Full Ritual gift box'; }
      var f = card.querySelector('form');
      var box = document.createElement('div'); box.className = 'ck-ty';
      var how = o.mode === 'pickup' ? 'Ready to collect at ' + o.shop.name + ' in 1 to 3 working days.'
        : o.mode === 'email' ? 'Your gift card is on its way by email.' : o.shipping.label + ' delivery, ' + o.shipping.eta + '.';
      box.innerHTML = '<p class="framer-text framer-styles-preset-15x05lw ck-ty-b">Order ' + esc(o.id) + ' is confirmed and the receipt is on its way to ' +
        esc(o.contact.email) + '. ' + money(o.total) + ' paid with ' + esc(payLabel(o)) + '. ' + esc(how) + '</p>' +
        '<p class="framer-text framer-styles-preset-du009m ck-ty-s">Demo store: no real payment was taken and nothing will ship.</p>' +
        '<div class="ck-ty-a"><a class="ck-ty-btn" href="' + P + 'all/">Continue shopping</a><button type="button" class="ck-ty-x">View order</button></div>';
      if (f) f.replaceWith(box); else card.appendChild(box);
      var holder = E.$('.framer-7q70e4-container');
      if (!holder) { holder = document.createElement('div'); holder.className = 'framer-7q70e4-container'; (E.$('.framer-ipn91j') || document.body).appendChild(holder); }
      holder.innerHTML = ''; holder.appendChild(bd);
      bd.style.opacity = '0'; wrap.style.opacity = '0'; wrap.style.transform = 'translateY(20px)';
      card.style.opacity = '0.001'; card.style.transform = 'translateY(60px)';
      E.lock();
      var M = E.tr(E.T.modal), open = true;
      var fade = function (el, a, b) { var an = el.animate([{ opacity: a }, { opacity: b }], { duration: M.duration, easing: M.easing, fill: 'forwards' }); return an; };
      fade(bd, 0, 1); bd.style.pointerEvents = 'auto';
      E.animate(wrap, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, E.T.modal);
      E.animate(card, { opacity: 0.001, y: 60 }, { opacity: 1, y: 0 }, MODAL_IN);
      setTimeout(function () { bd.style.opacity = '1'; wrap.style.opacity = '1'; }, M.duration + 60);   // hidden-tab fallback
      function close() {
        if (!open) return; open = false;
        fade(bd, 1, 0); E.animate(wrap, { opacity: 1, y: 0 }, { opacity: 0, y: 20 }, E.T.modal);
        bd.style.pointerEvents = 'none'; E.unlock();
        setTimeout(function () { bd.remove(); }, M.duration + 40);
      }
      bd.addEventListener('click', close);
      wrap.addEventListener('click', function (ev) { ev.stopPropagation(); });
      E.$$('.framer-7dcBC', bd).forEach(function (x) {
        x.addEventListener('click', function (ev) { ev.preventDefault(); close(); });
        var b = E.$('.framer-dpiw86', x);
        if (b) {
          x.addEventListener('mouseenter', function () { E.animate(b, null, { rotate: 90 }, E.T.stiff); });
          x.addEventListener('mouseleave', function () { E.animate(b, null, { rotate: 0 }, E.T.stiff); });
        }
      });
      E.$('.ck-ty-x', bd).addEventListener('click', close);
      document.addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    });
  }

  /* ---------------------------------------------------------------- boot */
  var q = new URLSearchParams(location.search), pay = q.get('pay'), oid = q.get('order');
  if (pay === 'success' && oid) {
    var pend = get(LS.pending);
    if (pend && pend.id === oid) {
      pend.status = 'paid'; pend.ref = q.get('ref') || ''; pend.paidAt = new Date().toISOString();
      var orders = get(LS.orders, []).filter(function (o) { return o.id !== oid; }); orders.unshift(pend);
      put(LS.orders, orders.slice(0, 20)); del(LS.pending);
      E.cart.save([]); draft.code = ''; put(LS.draft, draft);
    }
    history.replaceState(null, '', location.pathname + '?order=' + encodeURIComponent(oid));
    var done = findOrder(oid);
    if (done) { showDone(done); thankYou(done); return; }
  } else if (oid && !pay) {
    var o = findOrder(oid);
    if (o) { showDone(o); return; }
  }
  restore(); sync();
  if (pay === 'failed' || pay === 'cancelled') {
    var n = E.$('[data-ck-notice]', root);
    n.hidden = false; n.classList.toggle('is-info', pay === 'cancelled');
    n.textContent = pay === 'failed'
      ? 'Your payment didn\'t go through, so you haven\'t been charged. Try again or choose another payment method.'
      : 'Payment cancelled. Your bag and details are still here when you\'re ready.';
    history.replaceState(null, '', location.pathname);
  }
});
