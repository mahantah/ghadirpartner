/* GP_OPS_UI_FIX_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpOpsUiFixV1) return;
  window.__gpOpsUiFixV1 = true;

  var STYLE_ID = 'gp-ops-ui-fix-v1-css';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function fold(s) {
    return String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, ' ').trim().toLowerCase();
  }

  function liveCustomers() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list.filter(function (c) { return c && !c.deleted; });
  }

  function customerByIdSafe(id) {
    if (typeof customerById === 'function') {
      try {
        var found = customerById(id);
        if (found && found.id) return found;
      } catch (e) {}
    }
    return liveCustomers().filter(function (c) { return +c.id === +id; })[0] || { id: id, name: 'مشتری', mobile: '' };
  }

  function isMarketer(c) {
    if (!c) return false;
    if (c.parent_marketer_id) return false;
    var ch = String(c.sales_channel || '').toLowerCase();
    return !!(c.is_marketer || ch === 'rep');
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#modal .modalbox,#modal #modalbody,.modalbox,#modalbody{' +
        'background:#fff!important;color:#111!important;}' +
      '#modal h3,#modal label,#modal p,#modal .small,#modal b,#modal td,#modal th{' +
        'color:#111!important;}' +
      '#modal input,#modal select,#modal textarea{' +
        'background:#fff!important;color:#111!important;border:1px solid #d7e1ec!important;' +
        'caret-color:#111!important;}' +
      '#modal input::placeholder,#modal textarea::placeholder{color:#667085!important;}' +
      '.gp-suggest,.gp-typeahead .gp-suggest,.customer-menu,.order-menu.customer-menu{' +
        'background:#fff!important;color:#111!important;border:1px solid #d7e1ec!important;}' +
      '.gp-suggest button,.gp-suggest b,.gp-suggest span,.customer-menu button,.customer-menu .small{' +
        'background:#fff!important;color:#111!important;}' +
      '.gp-suggest button:hover,.customer-menu button:hover{background:#f4f7fb!important;color:#111!important;}' +
      '.portal-subnav [data-portal-view="catalog"],' +
      '.portal-subnav [data-portal-view="offers"]{display:none!important}';
    document.head.appendChild(css);
  }

  function hideSmsExtras() {
    [].forEach.call(document.querySelectorAll('.portal-subnav [data-portal-view="catalog"], .portal-subnav [data-portal-view="offers"]'), function (el) {
      el.style.display = 'none';
      el.hidden = true;
      el.classList.add('hidden');
    });
  }

  function wrapPortalView() {
    if (typeof window.portalAdminView === 'function' && !window.portalAdminView.__gpOps1) {
      var base = window.portalAdminView;
      window.portalAdminView = function (key) {
        var out = base.apply(this, arguments);
        hideSmsExtras();
        return out;
      };
      window.portalAdminView.__gpOps1 = true;
    }
    hideSmsExtras();
  }

  function marketerRows(q, exceptId) {
    q = fold(q);
    return liveCustomers().filter(function (c) {
      if (+c.id === +exceptId) return false;
      if (!isMarketer(c)) return false;
      if (!q) return true;
      return fold([c.code, c.name, c.company, c.mobile].join(' ')).indexOf(q) >= 0;
    }).slice(0, 12);
  }

  function bindMarketerBox(searchId, valueId, exceptId) {
    var input = $(searchId);
    var value = $(valueId);
    if (!input || !value) return;
    if (input.dataset.gpMarketerOnly === '1') return;
    var fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);
    input = fresh;
    input.dataset.gpMarketerOnly = '1';
    input.dataset.gpTypeahead = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('placeholder', 'نام بازاریاب را بنویسید');
    var wrap = input.closest('.gp-typeahead');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gp-typeahead';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var list = wrap.querySelector('.gp-suggest');
    if (!list) {
      list = document.createElement('div');
      list.className = 'gp-suggest hidden';
      wrap.appendChild(list);
    }
    value.classList.add('hidden');

    function hide() { list.classList.add('hidden'); list.innerHTML = ''; }

    function paint() {
      var rows = marketerRows(input.value, exceptId);
      if (!rows.length) {
        list.innerHTML = '<div class="gp-empty">بازاریابی با این نام پیدا نشد</div>';
        list.classList.remove('hidden');
        value.value = '';
        return;
      }
      list.innerHTML = rows.map(function (c) {
        var bits = [c.code, c.company, c.mobile].filter(Boolean).join(' | ');
        return '<button type="button" data-id="' + c.id + '"><b>' + esc(c.name || '-') +
          ' — بازاریاب</b><span>' + esc(bits || 'بدون کد') + '</span></button>';
      }).join('');
      list.classList.remove('hidden');
    }

    input.addEventListener('input', paint);
    input.addEventListener('focus', paint);
    list.addEventListener('mousedown', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('button[data-id]');
      if (!btn) return;
      ev.preventDefault();
      var c = liveCustomers().filter(function (x) { return String(x.id) === String(btn.getAttribute('data-id')); })[0];
      if (!c) return;
      value.value = c.id;
      input.value = c.name || '';
      hide();
    });
    input.addEventListener('blur', function () { setTimeout(hide, 160); });
  }

  function installMarketerPickers() {
    if ($('gpRepRole') && $('gpRepRole').value === 'sub') {
      bindMarketerBox('gpRepParentSearch', 'gpRepParent');
    }
    if ($('gpEditRepRole') && $('gpEditRepRole').value === 'sub') {
      var sel = $('gpEditParent') || $('eMarketerSelect');
      if (sel) bindMarketerBox('gpEditParentSearch', sel.id, window.__gpEditCustomerId);
    }
  }

  function wrapPassword() {
    window.gpResetCustomerPassword = function (id) {
      var c = customerByIdSafe(id);
      modal(
        '<h3>بازیابی رمز مشتری — ' + esc(c.name || '') + '</h3>' +
        '<div class="small" id="gpResetHint">شماره ورود و رمز جدید را وارد کنید.</div>' +
        '<input id="gpResetMobile" value="' + esc(c.mobile || '') + '" inputmode="tel" placeholder="شماره ورود / موبایل" style="width:100%;margin-top:8px">' +
        '<input id="gpResetPw" type="password" placeholder="رمز جدید — حداقل ۸ کاراکتر" style="width:100%;margin-top:8px">' +
        '<div class="toolbar" style="margin-top:10px">' +
          '<button type="button" onclick="gpSaveCustomerPassword(' + id + ')">ثبت رمز</button>' +
          '<button class="btnlight" type="button" onclick="closeModal()">بستن</button>' +
        '</div>'
      );
      Promise.resolve()
        .then(function () {
          if (window.PORTAL_ACCOUNTS && window.PORTAL_ACCOUNTS.length) return window.PORTAL_ACCOUNTS;
          return req('/api/customer-accounts');
        })
        .then(function (rows) {
          window.PORTAL_ACCOUNTS = rows || [];
          var acc = (window.PORTAL_ACCOUNTS || []).filter(function (a) { return +a.customer_id === +id; })[0];
          if (!$('gpResetMobile')) return;
          if (acc) {
            $('gpResetMobile').value = acc.login_mobile || c.mobile || '';
            if ($('gpResetHint')) $('gpResetHint').textContent = 'شماره ورود فعلی: ' + (acc.login_mobile || '-');
          } else if ($('gpResetHint')) {
            $('gpResetHint').textContent = 'این مشتری حساب پرتال ندارد؛ با ثبت رمز، حساب ساخته می‌شود.';
          }
        })
        .catch(function () {
          if ($('gpResetHint')) $('gpResetHint').textContent = 'حساب پرتال خوانده نشد؛ می‌توانید همین‌جا شماره و رمز جدید را بگذارید.';
        });
    };
  }

  function wrapContactLabel() {
    window.gpChangeCustomerContact = function (id) {
      var c = customerByIdSafe(id);
      modal(
        '<h3>تغییر شماره تماس — ' + esc(c.name || '') + '</h3>' +
        '<input id="gpContactMobile" value="' + esc(c.mobile || '') + '" inputmode="tel" placeholder="شماره تماس" style="width:100%">' +
        '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="gpSaveCustomerContact(' + id + ')">ذخیره شماره تماس</button>' +
        '<button class="btnlight" type="button" onclick="closeModal()">بستن</button></div>'
      );
    };
  }

  function wrapOpsMenu() {
    if (typeof window.toggleCustomerMenu !== 'function' || window.toggleCustomerMenu.__gpOps1) return;
    var base = window.toggleCustomerMenu;
    window.toggleCustomerMenu = function (ev, id) {
      base.apply(this, arguments);
      [].forEach.call(document.querySelectorAll('.customer-menu.open button'), function (btn) {
        var t = (btn.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.indexOf('تغییر تماس') >= 0 && t.indexOf('شماره') < 0) {
          btn.textContent = t.replace('تغییر تماس', 'تغییر شماره تماس');
        }
      });
    };
    window.toggleCustomerMenu.__gpOps1 = true;
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { wrapPortalView(); } catch (e) {}
    try { installMarketerPickers(); } catch (e) {}
    try { wrapPassword(); } catch (e) {}
    try { wrapContactLabel(); } catch (e) {}
    try { wrapOpsMenu(); } catch (e) {}
    var box = $('gpChannelBox');
    if (box && !box.dataset.gpOpsBound) {
      box.dataset.gpOpsBound = '1';
      box.addEventListener('change', function () { setTimeout(installMarketerPickers, 30); });
    }
    if (typeof window.openCustomerEdit === 'function' && !window.openCustomerEdit.__gpOps1) {
      var baseEdit = window.openCustomerEdit;
      window.openCustomerEdit = function () {
        var out = baseEdit.apply(this, arguments);
        setTimeout(installMarketerPickers, 40);
        return out;
      };
      window.openCustomerEdit.__gpOps1 = true;
    }
    if (!document.__gpOpsChange) {
      document.__gpOpsChange = true;
      document.addEventListener('change', function (ev) {
        var t = ev.target;
        if (t && (t.id === 'gpRepRole' || t.id === 'gpEditRepRole')) {
          setTimeout(installMarketerPickers, 20);
        }
      });
    }
  }

  apply();
  [200, 800, 1600, 2800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 60); });
  }
})();
