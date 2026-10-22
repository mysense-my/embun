/* Pintu Pay — fictional hosted payment page, TEST MODE (Embun demo store).
   Reads the pending order the checkout saved, lets the shopper pick a method and simulates the outcome, then returns
   to /checkout/?pay=success|failed|cancelled. Card: only the published test numbers are accepted; anything else is
   refused and cleared from the field. Bank and e-wallet steps are simulated approvals, never sign-in forms.
   Nothing is stored or sent: card fields are read once on submit and never saved. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var P = '../';
  var APPROVE = '4242424242424242', DECLINE = '4000000000000002';
  var PANEL = { card: 'card', fpx: 'fpx', duitnow: 'qr', tng: 'qr', grabpay: 'qr' };
  var QRHINT = {
    duitnow: 'Scan with any banking or e-wallet app that supports DuitNow QR.',
    tng: "Scan with the Touch 'n Go eWallet app.",
    grabpay: 'Scan with the Grab app.'
  };
  var NAME = { fpx: 'FPX', card: 'Card', duitnow: 'DuitNow QR', tng: "Touch 'n Go eWallet", grabpay: 'GrabPay' };

  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function money(v) { return 'RM' + Number(v).toFixed(2); }

  var q = new URLSearchParams(location.search), id = q.get('order');
  var order = get('embun_pending_order');
  var card = $('[data-pp]');
  var back = function (status, extra) { location.href = P + 'checkout/?pay=' + status + '&order=' + encodeURIComponent(id || '') + (extra || ''); };

  if (!order || !id || order.id !== id) {
    $$('.pp-amount, .pp-tabs, .pp-panel, [data-pp-cancel]', card).forEach(function (e) { e.hidden = true; });
    $('[data-pp-gone]').hidden = false;
    return;
  }
  document.title = 'Pay ' + money(order.total) + ' · Pintu Pay (test mode)';
  $('[data-pp-ref]').textContent = 'Order ' + order.id;
  $('[data-pp-amount]').textContent = money(order.total);
  $('[data-pp-cancel]').addEventListener('click', function (ev) { ev.preventDefault(); back('cancelled'); });

  /* ---------------------------------------------------------------- method tabs */
  var method = PANEL[order.method] ? order.method : 'fpx';
  function select(m) {
    method = m;
    $$('.pp-tab').forEach(function (t) { var on = t.getAttribute('data-m') === m; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
    $$('.pp-panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== PANEL[m]; });
    $$('[data-pp-error]').forEach(function (e) { e.hidden = true; });
    if (PANEL[m] === 'qr') startQR();
    else stopQR();
    if (m === 'fpx') { $('[data-pp-fpx-1]').hidden = false; $('[data-pp-fpx-2]').hidden = true; }
  }
  $$('.pp-tab').forEach(function (t) { t.addEventListener('click', function () { select(t.getAttribute('data-m')); }); });

  function err(panel, msg) { var e = $('[data-pp-error]', panel); e.textContent = msg; e.hidden = !msg; }

  /* ---------------------------------------------------------------- processing -> result -> back to the shop */
  function ref() { return 'PP' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase(); }
  function process(outcome, onDecline) {
    var st = $('[data-pp-state]'), txt = $('[data-pp-statetext]');
    $$('.pp-tabs, .pp-panel, [data-pp-cancel]', card).forEach(function (e) { e.hidden = true; });
    st.hidden = false; st.className = 'pp-state'; txt.textContent = 'Processing payment';
    setTimeout(function () {
      if (outcome === 'approved') {
        var r = ref();
        order.gateway = { ref: r, method: method }; order.method = method; if (method !== 'fpx') order.bank = ''; put('embun_pending_order', order);
        st.classList.add('is-ok'); txt.innerHTML = 'Payment approved<br><small>Returning you to Embun</small>';
        setTimeout(function () { back('success', '&ref=' + r); }, 1300);
      } else if (outcome === 'rejected') {
        st.classList.add('is-bad'); txt.innerHTML = 'Payment rejected at the bank<br><small>No money was taken. Returning you to Embun</small>';
        setTimeout(function () { back('failed'); }, 1600);
      } else {
        st.hidden = true;
        $$('.pp-tabs, [data-pp-cancel]', card).forEach(function (e) { e.hidden = false; });
        select(method); onDecline && onDecline();
      }
    }, 1600);
  }

  /* ---------------------------------------------------------------- card (test numbers only) */
  var cf = $('[data-pp-card]');
  var num = cf.elements['pp-num'], exp = cf.elements['pp-exp'], cvc = cf.elements['pp-cvc'], nm = cf.elements['pp-name'];
  nm.value = (order.name.first + ' ' + order.name.last).trim();
  $('[data-pp-paybtn]').textContent = 'Pay ' + money(order.total);
  num.addEventListener('input', function () { var d = num.value.replace(/\D/g, '').slice(0, 19); num.value = d.replace(/(.{4})/g, '$1 ').trim(); });
  exp.addEventListener('input', function () { var d = exp.value.replace(/\D/g, '').slice(0, 4); exp.value = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d; });
  cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
  cf.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var panel = cf.parentNode; err(panel, '');
    $$('.pp-field', cf).forEach(function (f) { f.classList.remove('is-bad'); });
    var d = num.value.replace(/\D/g, ''), m = /^(\d{2}) \/ (\d{2})$/.exec(exp.value);
    if (d !== APPROVE && d !== DECLINE) {
      num.value = ''; num.closest('.pp-field').classList.add('is-bad'); num.focus();
      return err(panel, 'Test mode only accepts the test cards listed below. Real cards are refused.');
    }
    if (!m || +m[1] < 1 || +m[1] > 12) { exp.closest('.pp-field').classList.add('is-bad'); return err(panel, 'Enter the expiry as MM / YY.'); }
    if (!/^\d{3,4}$/.test(cvc.value)) { cvc.closest('.pp-field').classList.add('is-bad'); return err(panel, 'Enter the 3 digit security code.'); }
    if (!nm.value.trim()) { nm.closest('.pp-field').classList.add('is-bad'); return err(panel, 'Enter the name on the card.'); }
    process(d === APPROVE ? 'approved' : 'declined', function () {
      err($('[data-panel="card"]'), 'Your card was declined (test card 4000 0000 0000 0002). No money was taken. Try the approved test card or another method.');
    });
  });

  /* ---------------------------------------------------------------- FPX (simulated bank approval, no sign-in) */
  var bank = order.bank || '';
  function pickBank(b) { bank = b; $$('.pp-bank').forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-b') === b); }); }
  $$('.pp-bank').forEach(function (x) { x.addEventListener('click', function () { pickBank(x.getAttribute('data-b')); err($('[data-pp-fpx-1]'), ''); }); });
  if (bank) pickBank(bank);
  $('[data-pp-fpx-go]').addEventListener('click', function () {
    if (!bank) return err($('[data-pp-fpx-1]'), 'Choose your bank to continue.');
    order.bank = bank; put('embun_pending_order', order);
    $('[data-pp-bankname]').textContent = bank + ' (simulated)';
    $('[data-pp-fpx-1]').hidden = true; $('[data-pp-fpx-2]').hidden = false;
  });
  $('[data-pp-approve]').addEventListener('click', function () { process('approved'); });
  $('[data-pp-reject]').addEventListener('click', function () { process('rejected'); });

  /* ---------------------------------------------------------------- QR (DuitNow / Touch 'n Go / GrabPay): test QR, not scannable */
  function qrSVG(seed) {
    var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    var rnd = function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    var N = 25, cells = '';
    var finder = function (x, y) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="#16181d"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#16181d"/>'; };
    var inFinder = function (x, y) { return (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9); };
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) cells += 'M' + x + ' ' + y + 'h1v1h-1z';
    return '<svg viewBox="0 0 ' + N + ' ' + N + '" shape-rendering="crispEdges" role="img" aria-label="Test QR code"><rect width="' + N + '" height="' + N + '" fill="#fff"/>' +
      '<path d="' + cells + '" fill="#16181d"/>' + finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7) + '</svg>';
  }
  var timer = null, left = 300;
  function startQR() {
    stopQR(); left = 300;
    $('[data-pp-qr]').innerHTML = qrSVG(order.id + method);
    $('[data-pp-qrhint]').textContent = QRHINT[method] + ' This is a test QR, so scanning it does nothing.';
    var tick = function () {
      var m = Math.floor(left / 60), s = left % 60; $('[data-pp-timer]').textContent = m + ':' + ('0' + s).slice(-2);
      if (left-- <= 0) { stopQR(); err($('[data-panel="qr"]'), 'This QR code has expired. Choose the method again for a new one.'); }
    };
    tick(); timer = setInterval(tick, 1000);
  }
  function stopQR() { if (timer) clearInterval(timer); timer = null; }
  $('[data-pp-simulate]').addEventListener('click', function () { if (left < 0) return; stopQR(); process('approved'); });

  select(method);
})();
