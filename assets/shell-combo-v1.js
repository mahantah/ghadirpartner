/* GP_SHELL_COMBO_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpShellComboV1) return;
  window.__gpShellComboV1 = true;

  var STYLE_ID = 'gp-shell-combo-v1-css';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function fold(s) {
    return String(s || '')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200c\s]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function liveCustomers() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list.filter(function (c) { return c && !c.deleted; });
  }

  function isMarketer(c) {
    return !!(c && c.is_marketer && !c.parent_marketer_id);
  }

  function kindLabel(c) {
    if (!c) return '';
    if (c.parent_marketer_id) return 'زیرمجموعه';
    if (c.is_marketer) return 'بازاریاب';
    var ch = String(c.sales_channel || '').toLowerCase();
    if (ch === 'agent') return 'عامل فروش';
    if (c.rep_role === 'rep' || ch === 'rep') return 'نماینده';
    return '';
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#customerAdd>.card,#customerAddCard,#customerImportCard,' +
      '#salesPlans>.card:first-child,#users>.card:first-child,' +
      '#settings>.card:first-child,#products>.card:first-child,' +
      '.gp-form-compact{' +
        'width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important' +
      '}' +
      '.card{' +
        'border:1px solid #e6edf5!important;border-radius:16px!important;' +
        'box-shadow:0 8px 22px rgba(16,42,67,.05)!important;padding:16px 18px!important' +
      '}' +
      '.card>h3,.card .section-title h3{margin:0 0 10px;font-size:16px}' +
      '.gp-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap;margin:0 0 12px}' +
      '.gp-card-head h3,.gp-card-head .section-title{margin:0!important;flex:1 1 auto}' +
      '.gp-card-search,.gp-card-head>input[type="text"],.gp-card-head>input[type="search"]{' +
        'flex:0 1 280px!important;width:280px!important;max-width:100%!important;margin:0!important;' +
        'min-height:38px!important;border:1px solid #d7e1ec!important;border-radius:10px!important;' +
        'background:#f7f9fc!important;padding:8px 12px!important' +
      '}' +
      '#gpChannelBox,#gpEditCoopBox{' +
        'width:100%!important;max-width:100%!important;padding:10px 12px!important;margin:0 0 12px!important;' +
        'display:flex;flex-direction:column;align-items:stretch;gap:8px' +
      '}' +
      '#customerAdd .mutedbox,#salesPlans>.card:first-child .mutedbox,' +
      '#users>.card:first-child .mutedbox,#products>.card:first-child .mutedbox,' +
      '#settings>.card:first-child .mutedbox,#modal .mutedbox{' +
        'width:100%!important;max-width:100%!important;padding:10px 12px!important' +
      '}' +
      '#customerAdd .grid,#neworder .grid,#salesPlans>.card:first-child .grid,' +
      '#users>.card:first-child .grid,#products>.card:first-child .grid,' +
      '#settings>.card:first-child .grid{' +
        'grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important;gap:10px!important' +
      '}' +
      '.customCheckBoxHolder{width:fit-content!important;display:inline-flex!important;flex-wrap:nowrap!important}' +
      '.gp-combo,.gp-typeahead{' +
        'position:relative;width:100%;max-width:100%;border:1px solid #d5deea;border-radius:12px;' +
        'background:#fff;overflow:hidden;margin:0' +
      '}' +
      '.gp-combo.is-open,.gp-typeahead:focus-within{box-shadow:0 8px 20px rgba(16,42,67,.08)}' +
      '.gp-combo>input,.gp-typeahead>input,' +
      '.gp-combo>input[type="text"],.gp-combo>input[type="search"],' +
      '.gp-typeahead>input[type="text"],.gp-typeahead>input[type="search"]{' +
        'width:100%!important;max-width:100%!important;border:0!important;box-shadow:none!important;' +
        'background:transparent!important;margin:0!important;min-height:40px!important;border-radius:0!important' +
      '}' +
      '.gp-combo>select,#gpRepParent,#gpEditParent,#eMarketerSelect,#marketerSelect,' +
      '#neworder #ocust.gp-combo-value{' +
        'position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;' +
        'pointer-events:none!important;margin:0!important;padding:0!important;border:0!important' +
      '}' +
      '.gp-combo .gp-suggest,.gp-typeahead .gp-suggest,' +
      '.gp-combo #gpPlanPickList{' +
        'position:static!important;display:none;border:0!important;border-top:1px solid #eef2f6!important;' +
        'border-radius:0!important;max-height:240px;overflow:auto;box-shadow:none!important;' +
        'background:#f8fafc!important;right:auto!important;left:auto!important;top:auto!important' +
      '}' +
      '.gp-combo.is-open .gp-suggest,.gp-combo .gp-suggest:not(.hidden),' +
      '.gp-typeahead:focus-within .gp-suggest:not(.hidden),' +
      '.gp-combo.is-open #gpPlanPickList,.gp-combo #gpPlanPickList:not(.hidden){display:block!important}' +
      '.gp-combo .gp-suggest button,.gp-typeahead .gp-suggest button,' +
      '#gpPlanPickList label{' +
        'display:block;width:100%;text-align:right;background:transparent;border:0;' +
        'border-bottom:1px solid #eef2f6;padding:9px 12px;font:inherit;cursor:pointer;color:#111' +
      '}' +
      '.gp-combo .gp-suggest button:hover,.gp-typeahead .gp-suggest button:hover,' +
      '#gpPlanPickList label:hover{background:#fff7ef}' +
      '.gp-combo .gp-suggest b,.gp-typeahead .gp-suggest b{display:block;color:#102a43}' +
      '.gp-combo .gp-suggest span,.gp-typeahead .gp-suggest span{display:block;color:#64748b;font-size:12px;margin-top:2px}' +
      '.gp-combo .gp-empty,.gp-typeahead .gp-empty{padding:12px;color:#64748b;text-align:center}' +
      '#gpChannelBox .gp-combo,#gpChannelBox .gp-typeahead,' +
      '#gpEditCoopBox .gp-combo,#gpEditCoopBox .gp-typeahead{max-width:420px}' +
      '#gpPlanPickWrap.gp-combo,#gpPlanPickWrap .gp-combo{margin-top:8px}' +
      '@media(max-width:720px){' +
        '.gp-card-search,.gp-card-head>input{flex:1 1 100%!important;width:100%!important}' +
        '#customerAdd .grid,#neworder .grid,#salesPlans>.card:first-child .grid,' +
        '#users>.card:first-child .grid,#products>.card:first-child .grid,' +
        '#settings>.card:first-child .grid{grid-template-columns:1fr!important}' +
        '#gpChannelBox .gp-combo,#gpChannelBox .gp-typeahead,' +
        '#gpEditCoopBox .gp-combo,#gpEditCoopBox .gp-typeahead{max-width:100%}' +
      '}';
    document.head.appendChild(css);
  }

  function hideSelect(sel) {
    if (!sel) return;
    sel.classList.add('gp-combo-value', 'hidden');
    sel.setAttribute('aria-hidden', 'true');
    sel.tabIndex = -1;
  }

  function ensureCombo(input, select) {
    if (!input) return null;
    var combo = input.closest('.gp-combo') || input.closest('.gp-typeahead');
    if (!combo) {
      combo = document.createElement('div');
      combo.className = 'gp-combo';
      input.parentNode.insertBefore(combo, input);
      combo.appendChild(input);
    } else {
      combo.classList.add('gp-combo');
    }
    if (select && select.parentNode !== combo) combo.appendChild(select);
    hideSelect(select);
    var list = combo.querySelector('.gp-suggest');
    if (!list) {
      list = document.createElement('div');
      list.className = 'gp-suggest hidden';
      combo.appendChild(list);
    }
    return combo;
  }

  function rowsFor(kind, q, exceptId) {
    q = fold(q);
    return liveCustomers().filter(function (c) {
      if (+c.id === +exceptId) return false;
      if (kind === 'marketer' && !isMarketer(c)) return false;
      if (!q) return true;
      return fold([c.code, c.name, c.company, c.mobile].join(' ')).indexOf(q) >= 0;
    }).slice(0, 12);
  }

  function setSelectValue(select, c) {
    if (!select || !c) return;
    var id = String(c.id);
    if (![].some.call(select.options, function (o) { return String(o.value) === id; })) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = c.name || id;
      select.appendChild(opt);
    }
    select.value = id;
    try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  function bindCombo(inputId, selectId, kind, exceptFn) {
    var input = $(inputId);
    var select = $(selectId);
    if (!input || !select) return;
    var combo = ensureCombo(input, select);
    if (!combo || input.dataset.gpShellCombo === '1') return;
    input.dataset.gpShellCombo = '1';
    input.setAttribute('autocomplete', 'off');
    if (kind === 'marketer') input.placeholder = 'نام بازاریاب را همین‌جا بنویسید';
    else input.placeholder = 'نام را بنویسید تا داخل همین کادر پیدا شود';
    var list = combo.querySelector('.gp-suggest');

    function exceptId() { return exceptFn ? exceptFn() : 0; }

    function hide() {
      list.classList.add('hidden');
      combo.classList.remove('is-open');
    }

    function paint() {
      var rows = rowsFor(kind, input.value, exceptId());
      if (!rows.length) {
        list.innerHTML = '<div class="gp-empty">موردی پیدا نشد</div>';
      } else {
        list.innerHTML = rows.map(function (c) {
          var bits = [c.code, c.company, c.mobile].filter(Boolean).join(' | ');
          var kindTxt = kindLabel(c);
          return '<button type="button" data-id="' + c.id + '"><b>' + esc(c.name || '-') +
            (kindTxt ? ' — ' + esc(kindTxt) : '') + '</b><span>' + esc(bits || 'بدون کد') + '</span></button>';
        }).join('');
      }
      list.classList.remove('hidden');
      combo.classList.add('is-open');
    }

    function pick(c) {
      setSelectValue(select, c);
      input.value = c.name || '';
      hide();
      if (select.id === 'ocust' && typeof orderCustomerChanged === 'function') {
        try { orderCustomerChanged(); } catch (e) {}
      }
      if (select.id === 'serialCustomerFilter' && typeof serialCustomerChanged === 'function') {
        try { serialCustomerChanged(); } catch (e) {}
      }
    }

    input.addEventListener('input', function () {
      if (select) select.value = '';
      paint();
    });
    input.addEventListener('focus', paint);
    list.addEventListener('mousedown', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('button[data-id]');
      if (!btn) return;
      ev.preventDefault();
      var c = liveCustomers().filter(function (x) { return String(x.id) === String(btn.getAttribute('data-id')); })[0];
      if (c) pick(c);
    });
    input.addEventListener('blur', function () { setTimeout(hide, 160); });
    if (select.value) {
      var cur = liveCustomers().filter(function (c) { return String(c.id) === String(select.value); })[0];
      if (cur && !input.value) input.value = cur.name || '';
    }
  }

  function hushNativeSearch(input) {
    if (!input || input.dataset.gpHushed === '1') return;
    input.dataset.gpHushed = '1';
    input.oninput = null;
    input.removeAttribute('oninput');
  }

  function nestPlanSearch() {
    var wrap = $('gpPlanPickWrap');
    var input = $('gpPlanCustSearch');
    var list = $('gpPlanPickList');
    if (!wrap || !input || !list) return;
    wrap.classList.add('gp-combo');
    if (input.parentNode !== wrap) wrap.insertBefore(input, wrap.firstChild);
    if (list.parentNode !== wrap) wrap.appendChild(list);
    list.classList.add('gp-suggest');
    if (!input.dataset.gpPlanCombo) {
      input.dataset.gpPlanCombo = '1';
      input.placeholder = 'نام مشتری را همین‌جا بنویسید';
      input.addEventListener('focus', function () { wrap.classList.add('is-open'); });
      input.addEventListener('input', function () { wrap.classList.add('is-open'); });
      input.addEventListener('blur', function () { setTimeout(function () { wrap.classList.remove('is-open'); }, 160); });
    }
  }

  function tuckSearch(input) {
    if (!input || input.dataset.gpTucked === '1') return;
    if (input.closest('.gp-combo, .gp-typeahead, .compact-filter, .dashboard-search, .gp-card-head')) return;
    var card = input.closest('.card');
    if (!card) return;
    var title = card.querySelector(':scope > h3, :scope > .section-title, :scope > .gp-card-head');
    if (!title) return;
    input.dataset.gpTucked = '1';
    input.classList.add('gp-card-search');
    var head = title.classList && title.classList.contains('gp-card-head') ? title : title.closest('.gp-card-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'gp-card-head';
      title.parentNode.insertBefore(head, title);
      head.appendChild(title);
    }
    head.appendChild(input);
  }

  function installCombos() {
    bindCombo('gpRepParentSearch', 'gpRepParent', 'marketer');
    bindCombo('gpEditParentSearch', 'gpEditParent', 'marketer', function () { return window.__gpEditCustomerId || 0; });
    bindCombo('marketerSearch', 'marketerSelect', 'marketer');
    if ($('csearch') && $('ocust')) {
      hushNativeSearch($('csearch'));
      bindCombo('csearch', 'ocust', 'customer');
    }
    if ($('serialCustomerSearch') && $('serialCustomerFilter')) {
      hushNativeSearch($('serialCustomerSearch'));
      bindCombo('serialCustomerSearch', 'serialCustomerFilter', 'customer');
    }
    nestPlanSearch();
  }

  function tuckAll() {
    ['custSearch', 'productSearch', 'gpAgentsListSearch', 'gpRepsListSearch', 'invSearch', 'customerSalesSearch'].forEach(function (id) {
      tuckSearch($(id));
    });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { installCombos(); } catch (e) {}
    try { tuckAll(); } catch (e) {}
  }

  apply();
  [200, 900, 1800, 3200, 5000].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
  if (!document.__gpShellComboWatch) {
    document.__gpShellComboWatch = true;
    var obs = new MutationObserver(function () {
      if (obs._q) return;
      obs._q = true;
      setTimeout(function () { obs._q = false; apply(); }, 50);
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }
})();
