/* GP_SEARCH_FILTER_FAB_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpSearchFilterFabV1) return;
  window.__gpSearchFilterFabV1 = true;

  var STYLE_ID = 'gp-search-filter-fab-v1-css';
  var ROOT_ID = 'gpSearchFabRoot';
  var SKIP_IDS = {
    csearch: 1,
    marketerSearch: 1,
    gpRepParentSearch: 1,
    gpEditParentSearch: 1,
    serialCustomerSearch: 1,
    serialCustomerFilter: 1,
    serialOrderFilter: 1,
    gpPlanCustSearch: 1,
    offerCustomerSearch: 1,
    offerCustomers: 1,
    whScan: 1,
    warehouseTransferCode: 1,
    warehouseTransferNote: 1,
    productName: 1,
    productManufacturer: 1,
    productPattern: 1,
    productExample: 1,
    lu: 1,
    lp: 1
  };
  var ID_HINT = /search|filter|ofilter|opayfilter|invfilter|repfrom|repto|repship|warehouseledgermonth|dashsearch|custsearch|productsearch|osearch|invsearch|customersalessearch|portalpricesearch|gpagent|gprep/i;
  var TEXT_HINT = /جستجو|فیلتر/;

  function $(id) { return document.getElementById(id); }

  function norm(v) {
    return String(v || '').normalize('NFKC')
      .replace(/[ك]/g, 'ک').replace(/[يى]/g, 'ی')
      .replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function toLatin(v) {
    return String(v || '')
      .replace(/[۰-۹]/g, function (x) { return String(x.charCodeAt(0) - 1776); })
      .replace(/[٠-٩]/g, function (x) { return String(x.charCodeAt(0) - 1632); });
  }

  function normDate(v) {
    var m = toLatin(v).trim().replace(/-/g, '/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '';
    return m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0');
  }

  function jalali(v) {
    if (!v) return '';
    try { if (typeof jalaliDate === 'function') return normDate(jalaliDate(v)); } catch (e) {}
    return normDate(v);
  }

  function stamp(v) {
    var t = Date.parse(String(v || '').replace(' ', 'T'));
    return Number.isFinite(t) ? t : 0;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (x) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x];
    });
  }

  function currentTab() {
    var tabs = document.querySelectorAll('section.tab');
    for (var i = 0; i < tabs.length; i++) {
      if (!tabs[i].classList.contains('hidden') && !tabs[i].hasAttribute('hidden')) return tabs[i];
    }
    return document.querySelector('section.tab:not(.hidden)') || null;
  }

  function isAuthed() {
    var app = $('app');
    var login = $('login');
    if (login && !login.classList.contains('hidden')) return false;
    if (app && app.classList.contains('hidden')) return false;
    return true;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gp-warehouse-filter-box,#gp-inventory-filter-box,.gp-warehouse-filters{display:none!important}' +
      '#gpSearchFabRoot{position:fixed;left:18px;bottom:18px;z-index:88;font-family:Tahoma,Arial}' +
      '#gpSearchFabRoot.hidden{display:none!important}' +
      '.gp-fab-btn{width:58px;height:58px;border:0;border-radius:50%;background:linear-gradient(160deg,#16324d,#102a43);color:#fff;box-shadow:0 10px 28px #102a4355,0 0 0 3px #ffffffcc;cursor:pointer;display:grid;place-items:center;position:relative;padding:0}' +
      '.gp-fab-btn:hover{transform:translateY(-1px);filter:brightness(1.06)}' +
      '.gp-fab-btn svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}' +
      '.gp-fab-btn.is-active{background:linear-gradient(160deg,#f58220,#d96a12);box-shadow:0 10px 28px #f5822040,0 0 0 3px #fff6}' +
      '.gp-fab-badge{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#fff;color:#b42318;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;box-shadow:0 2px 8px #0002}' +
      '.gp-fab-btn.is-active .gp-fab-badge{display:flex}' +
      '.gp-fab-back{position:fixed;inset:0;background:#102a4322;opacity:0;pointer-events:none;transition:.18s;z-index:87}' +
      '#gpSearchFabRoot.is-open .gp-fab-back{opacity:1;pointer-events:auto}' +
      '.gp-fab-sheet{position:absolute;left:0;bottom:70px;width:min(420px,calc(100vw - 28px));max-height:min(74vh,640px);background:#fff;color:#111;border:1px solid #e4ebf2;border-radius:18px;box-shadow:0 22px 60px #102a4338;display:none;overflow:hidden}' +
      '#gpSearchFabRoot.is-open .gp-fab-sheet{display:flex;flex-direction:column}' +
      '.gp-fab-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #edf1f5;background:#f8fafc}' +
      '.gp-fab-head b{font-size:14px;color:#102a43}' +
      '.gp-fab-head span{display:block;font-size:11px;color:#667085;font-weight:400;margin-top:2px}' +
      '.gp-fab-close{width:34px;height:34px;padding:0;border:0;border-radius:10px;background:#edf2f7;color:#102a43;font-size:20px;line-height:1}' +
      '.gp-fab-body{padding:12px 14px 14px;overflow:auto;display:grid;gap:10px}' +
      '.gp-fab-pane{display:none;grid-template-columns:1fr;gap:10px}' +
      '.gp-fab-pane.is-on{display:grid}' +
      '.gp-fab-field{display:grid;gap:5px}' +
      '.gp-fab-label{font-size:11px;color:#667085;font-weight:700}' +
      '.gp-fab-field input,.gp-fab-field select{width:100%;min-width:0;background:#fff;color:#111}' +
      '.gp-fab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}' +
      '.gp-fab-actions button{flex:1;min-width:120px}' +
      '.gp-fab-summary{font-size:12px;color:#344054;background:#f3f7fb;border:1px solid #e1e8f0;border-radius:10px;padding:8px 10px}' +
      '.gp-fab-empty{font-size:12px;color:#667085;text-align:center;padding:18px 8px}' +
      '.toastwrap{bottom:92px!important}' +
      '@media(max-width:700px){.gp-fab-sheet{width:calc(100vw - 24px);max-height:78vh}}';
    document.head.appendChild(css);
  }

  function iconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="10.2" cy="10.2" r="6.2"></circle>' +
      '<path d="M14.8 14.8 20 20"></path>' +
      '<path d="M18.2 5.2v3.4M16.5 6.9h3.4"></path>' +
      '</svg>';
  }

  function ensureRoot() {
    var root = $(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'hidden';
    root.innerHTML =
      '<div class="gp-fab-back" data-gp-fab-back="1"></div>' +
      '<div class="gp-fab-sheet" id="gpFabSheet">' +
        '<div class="gp-fab-head">' +
          '<div><b>جستجو و فیلتر</b><span id="gpFabSub">همه شرط‌های این صفحه</span></div>' +
          '<button type="button" class="gp-fab-close" data-gp-fab-close="1" aria-label="بستن">×</button>' +
        '</div>' +
        '<div class="gp-fab-body" id="gpFabBody"></div>' +
      '</div>' +
      '<button type="button" class="gp-fab-btn" id="gpSearchFab" title="جستجو و فیلتر" aria-label="جستجو و فیلتر">' +
        iconSvg() + '<span class="gp-fab-badge" id="gpFabBadge">0</span>' +
      '</button>';
    document.body.appendChild(root);
    root.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-gp-fab-back], [data-gp-fab-close]')) closeFab();
    });
    $('gpSearchFab').addEventListener('click', function () {
      if (root.classList.contains('is-open')) closeFab();
      else openFab();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeFab();
    });
    return root;
  }

  function paneId(tabId) { return 'gpFabPane_' + tabId; }

  function ensurePane(tabId) {
    var body = $('gpFabBody');
    var id = paneId(tabId);
    var pane = $(id);
    if (pane) return pane;
    pane = document.createElement('div');
    pane.id = id;
    pane.className = 'gp-fab-pane';
    pane.setAttribute('data-fab-tab', tabId);
    body.appendChild(pane);
    return pane;
  }

  function fieldLabel(el) {
    var ph = String(el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    if (ph) return ph.replace(/^جستجو[:：]?\s*/, 'جستجو: ');
    var map = {
      ofilter: 'وضعیت سفارش',
      opayfilter: 'وضعیت تسویه',
      invFilter: 'وضعیت سریال',
      repFrom: 'از تاریخ خروج',
      repTo: 'تا تاریخ خروج',
      repShip: 'روش ارسال',
      warehouseLedgerMonth: 'ماه دفتر روزانه'
    };
    return map[el.id] || 'فیلتر';
  }

  function shouldAdopt(el) {
    if (!el || !el.id || SKIP_IDS[el.id]) return false;
    if (el.closest('#' + ROOT_ID)) return false;
    if (el.closest('.gp-combo, .gp-typeahead')) return false;
    if (el.type === 'file' || el.type === 'hidden' || el.type === 'password' || el.type === 'checkbox' || el.type === 'radio') return false;
    if (el.dataset.gpFabAdopted === '1') return true;
    if (ID_HINT.test(el.id)) return true;
    var ph = (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('title') || '');
    return TEXT_HINT.test(ph);
  }

  function adoptNode(el, pane) {
    if (!el || !pane || el.closest('#' + ROOT_ID)) return;
    if (el.dataset.gpFabAdopted === '1' && el.closest('.gp-fab-field')) return;
    var host = el.closest('.jdate-wrap') || el;
    var field = document.createElement('div');
    field.className = 'gp-fab-field';
    field.setAttribute('data-gp-fab-src', el.id);
    var lab = document.createElement('span');
    lab.className = 'gp-fab-label';
    lab.textContent = fieldLabel(el);
    field.appendChild(lab);
    field.appendChild(host);
    pane.appendChild(field);
    el.dataset.gpFabAdopted = '1';
    el.style.minWidth = '0';
    el.style.width = '100%';
  }

  function discover(tab) {
    if (!tab) return [];
    return Array.prototype.filter.call(tab.querySelectorAll('input, select'), shouldAdopt);
  }

  function hideHollow(tab) {
    if (!tab) return;
    Array.prototype.forEach.call(tab.querySelectorAll('.dashboard-search, .compact-filter .toolbar, .gp-card-head, #inventoryWriteTools'), function (box) {
      var leftover = box.querySelector('input, select');
      if (!leftover) box.classList.add('hidden');
    });
  }

  function optionList(select, values, empty) {
    var cur = select.value;
    var arr = [];
    var seen = {};
    (values || []).forEach(function (v) {
      var raw = String(v || '').replace(/\s+/g, ' ').trim();
      var k = norm(raw);
      if (!k || seen[k]) return;
      seen[k] = 1;
      arr.push(raw);
    });
    arr.sort(function (a, b) { return a.localeCompare(b, 'fa'); });
    select.innerHTML = '<option value="">' + esc(empty) + '</option>' +
      arr.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    if (arr.some(function (v) { return v === cur; })) select.value = cur;
  }

  function addSelect(pane, id, label, html) {
    if ($(id)) return $(id);
    var wrap = document.createElement('div');
    wrap.className = 'gp-fab-field';
    wrap.innerHTML = '<span class="gp-fab-label">' + label + '</span>' + html;
    pane.appendChild(wrap);
    return $(id);
  }

  function addInput(pane, id, label, placeholder) {
    if ($(id)) return $(id);
    var wrap = document.createElement('div');
    wrap.className = 'gp-fab-field';
    wrap.innerHTML = '<span class="gp-fab-label">' + label + '</span>' +
      '<input id="' + id + '" placeholder="' + placeholder + '">';
    pane.appendChild(wrap);
    return $(id);
  }

  function bindApply(el, fn) {
    if (!el || el.dataset.gpFabBound === '1') return;
    el.dataset.gpFabBound = '1';
    el.addEventListener('input', fn);
    el.addEventListener('change', fn);
  }

  function cartonBits(c, items) {
    var serials = (c.serials || []).concat((items || []).map(function (x) { return x && x.serial; }));
    return [
      c.code, c.product, c.color, c.supplier, c.incomplete_reason,
      warehouseName(c.warehouse_id), serials.join(' ')
    ].join(' ');
  }

  function warehouseName(id) {
    try {
      if (typeof window.warehouseName === 'function') return window.warehouseName(id);
    } catch (e) {}
    if (+id === 1) return 'انبار عمده';
    if (+id === 2) return 'انبار خرده تهرانپارس';
    return 'خارج از انبار';
  }

  function cartonStats(c) {
    var inv = (typeof WH !== 'undefined' && WH && Array.isArray(WH.inventory)) ? WH.inventory : [];
    var items = inv.filter(function (x) {
      return Number(x.carton_id || 0) === Number(c.id) || String(x.carton_code || '') === String(c.code || '');
    });
    var free = 0, reserved = 0, out = 0, wids = {}, levels = {};
    items.forEach(function (x) {
      var wid = Number(x.warehouse_id || 0);
      if (wid > 0 && !x.order_id) {
        free += 1;
        if (x.shelf_level) levels[x.shelf_level] = 1;
        wids[wid] = 1;
      } else if (wid > 0) {
        reserved += 1;
        wids[wid] = 1;
      } else out += 1;
    });
    var serialCount = (c.serials || []).length;
    var status = (out === serialCount && serialCount) ? 'out'
      : (reserved && !free) ? 'reserved'
      : (reserved && free) ? 'mixed'
      : (Object.keys(levels).length || serialCount < Number(c.capacity || 0)) ? 'open'
      : 'full';
    return { items: items, free: free, reserved: reserved, out: out, wids: wids, levels: levels, status: status, serialCount: serialCount };
  }

  function fillWarehouseChoices() {
    var cartons = (typeof WH !== 'undefined' && WH && Array.isArray(WH.cartons)) ? WH.cartons : [];
    if ($('gpFabWhProduct')) optionList($('gpFabWhProduct'), cartons.map(function (c) { return c.product; }), 'همه مدل‌ها');
    if ($('gpFabWhColor')) optionList($('gpFabWhColor'), cartons.map(function (c) { return c.color; }), 'همه رنگ‌ها');
    if ($('gpFabWhSupplier')) optionList($('gpFabWhSupplier'), cartons.map(function (c) { return c.supplier; }), 'همه تامین‌کننده‌ها');
  }

  function applyWarehouse() {
    var body = $('warehouseBody');
    if (!body) return;
    fillWarehouseChoices();
    var q = norm($('gpFabWhQ') && $('gpFabWhQ').value);
    var loc = $('gpFabWhLoc') ? $('gpFabWhLoc').value : '';
    var product = norm($('gpFabWhProduct') && $('gpFabWhProduct').value);
    var color = norm($('gpFabWhColor') && $('gpFabWhColor').value);
    var supplier = norm($('gpFabWhSupplier') && $('gpFabWhSupplier').value);
    var status = $('gpFabWhStatus') ? $('gpFabWhStatus').value : '';
    var shelf = $('gpFabWhShelf') ? $('gpFabWhShelf').value : '';
    var stock = $('gpFabWhStock') ? $('gpFabWhStock').value : '';
    var from = normDate($('gpFabWhFrom') && $('gpFabWhFrom').value);
    var to = normDate($('gpFabWhTo') && $('gpFabWhTo').value);
    var order = $('gpFabWhOrder') ? $('gpFabWhOrder').value : 'new';
    var cartons = (typeof WH !== 'undefined' && WH && Array.isArray(WH.cartons)) ? WH.cartons : [];
    var byCode = {};
    cartons.forEach(function (c) { byCode[String(c.code || '')] = c; });
    var rows = Array.prototype.slice.call(body.querySelectorAll('tr'));
    var ranked = [];
    var visible = 0;
    rows.forEach(function (row, idx) {
      var code = ((row.querySelector('td:first-child') || {}).textContent || '').trim();
      var c = byCode[code];
      if (!c) {
        row.style.display = cartons.length ? 'none' : '';
        ranked.push({ row: row, idx: idx, stamp: 0 });
        return;
      }
      var st = cartonStats(c);
      var date = jalali(c.created_at || c.added_at || (st.items[0] && (st.items[0].added_at || st.items[0].created_at)));
      var ok = true;
      if (q && norm(cartonBits(c, st.items) + ' ' + row.textContent).indexOf(q) < 0) ok = false;
      if (product && norm(c.product) !== product) ok = false;
      if (color && norm(c.color) !== color) ok = false;
      if (supplier && norm(c.supplier) !== supplier) ok = false;
      if (loc === '1' && !st.wids[1] && Number(c.warehouse_id) !== 1) ok = false;
      if (loc === '2' && !st.wids[2] && Number(c.warehouse_id) !== 2) ok = false;
      if (loc === 'out' && st.out === 0) ok = false;
      if (status && st.status !== status) ok = false;
      if (shelf && !st.levels[shelf]) ok = false;
      if (stock === 'free' && st.free === 0) ok = false;
      if (stock === 'reserved' && st.reserved === 0) ok = false;
      if (stock === 'out' && st.out === 0) ok = false;
      if (stock === 'incomplete' && !c.incomplete_reason && st.status !== 'open') ok = false;
      if (from && (!date || date < from)) ok = false;
      if (to && (!date || date > to)) ok = false;
      row.style.display = ok ? '' : 'none';
      if (ok) visible += 1;
      ranked.push({ row: row, idx: idx, stamp: stamp(c.created_at || c.added_at) });
    });
    ranked.sort(function (a, b) {
      return (order === 'old' ? a.stamp - b.stamp : b.stamp - a.stamp) || a.idx - b.idx;
    });
    var frag = document.createDocumentFragment();
    ranked.forEach(function (x) { frag.appendChild(x.row); });
    body.appendChild(frag);
    var sum = $('gpFabWhSummary');
    if (sum) {
      sum.textContent = visible.toLocaleString('fa-IR') + ' کارتن از ' +
        cartons.length.toLocaleString('fa-IR') + ' کارتن';
    }
    paintBadge();
  }

  function applyInventoryExtra() {
    var groups = $('inventoryGroups');
    if (!groups) return;
    var model = norm($('gpFabInvModel') && $('gpFabInvModel').value);
    var from = normDate($('gpFabInvFrom') && $('gpFabInvFrom').value);
    var to = normDate($('gpFabInvTo') && $('gpFabInvTo').value);
    var active = !!(model || from || to);
    var inv = (typeof INV !== 'undefined' && Array.isArray(INV)) ? INV : [];
    var bySerial = {};
    inv.forEach(function (iv) {
      var s = String(iv.serial || '').trim().toUpperCase();
      if (s && !bySerial[s]) bySerial[s] = iv;
    });
    var names = [];
    inv.forEach(function (iv) { if (iv && iv.product) names.push(iv.product); });
    if (typeof PROD !== 'undefined' && Array.isArray(PROD)) {
      PROD.forEach(function (p) { if (p && p.serial_required && p.name) names.push(p.name); });
    }
    if ($('gpFabInvModel')) optionList($('gpFabInvModel'), names, 'همه مدل‌ها');
    Array.prototype.forEach.call(groups.querySelectorAll('details.inv-group'), function (group) {
      var rows = group.querySelectorAll('.inv-serial-row');
      var shown = 0;
      Array.prototype.forEach.call(rows, function (row) {
        if (!active) {
          row.style.removeProperty('display');
          shown += 1;
          return;
        }
        var codeText = ((row.querySelector('.inv-code') || {}).textContent || '');
        var m = codeText.match(/SN\s*:\s*([^\s]+)/i);
        var iv = m ? bySerial[m[1].trim().toUpperCase()] : null;
        var product = (iv && iv.product) || ((row.querySelector('.inv-product') || {}).textContent || '');
        var date = jalali(iv && (iv.added_at || iv.created_at));
        var ok = (!model || norm(product) === model) && (!from || (date && date >= from)) && (!to || (date && date <= to));
        row.style.display = ok ? '' : 'none';
        if (ok) shown += 1;
      });
      if (!active || rows.length === 0 || shown) group.style.removeProperty('display');
      else group.style.display = 'none';
    });
    paintBadge();
  }

  function applyCustomerExtra() {
    var body = $('ctbody');
    if (!body) return;
    var kind = $('gpFabCustKind') ? $('gpFabCustKind').value : '';
    var active = $('gpFabCustActive') ? $('gpFabCustActive').value : '';
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      var cls = tr.className || '';
      var ok = true;
      if (kind && cls.indexOf('gp-coop-' + kind) < 0) ok = false;
      if (active === 'on' && cls.indexOf('customer-inactive-row') >= 0) ok = false;
      if (active === 'off' && cls.indexOf('customer-inactive-row') < 0) ok = false;
      tr.style.display = ok ? '' : 'none';
    });
    paintBadge();
  }

  function applyTextTable(inputId, bodyId) {
    var q = norm($(inputId) && $(inputId).value);
    var body = $(bodyId);
    if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      tr.style.display = !q || norm(tr.textContent).indexOf(q) >= 0 ? '' : 'none';
    });
    paintBadge();
  }

  function applyDaily() {
    var q = norm($('gpFabDailyQ') && $('gpFabDailyQ').value);
    var wrap = $('warehouseLedgerWrap');
    if (!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll('tbody tr'), function (tr) {
      var model = ((tr.querySelector('.model-col, .model-cell, td:first-child') || {}).textContent || '');
      tr.style.display = !q || norm(model).indexOf(q) >= 0 ? '' : 'none';
    });
    paintBadge();
  }

  function ensureWarehouseFields(pane) {
    if (pane.dataset.gpWhExtra === '1') return;
    pane.dataset.gpWhExtra = '1';
    addInput(pane, 'gpFabWhQ', 'جستجوی آزاد مخزن', 'شماره باکس، سریال، مدل، رنگ، تامین‌کننده، وضعیت');
    addSelect(pane, 'gpFabWhLoc', 'انبار',
      '<select id="gpFabWhLoc"><option value="">همه انبارها</option><option value="1">انبار عمده</option><option value="2">انبار خرده تهرانپارس</option><option value="out">خارج از انبار</option></select>');
    addSelect(pane, 'gpFabWhProduct', 'مدل دستگاه', '<select id="gpFabWhProduct"><option value="">همه مدل‌ها</option></select>');
    addSelect(pane, 'gpFabWhColor', 'رنگ', '<select id="gpFabWhColor"><option value="">همه رنگ‌ها</option></select>');
    addSelect(pane, 'gpFabWhSupplier', 'تامین‌کننده', '<select id="gpFabWhSupplier"><option value="">همه تامین‌کننده‌ها</option></select>');
    addSelect(pane, 'gpFabWhStatus', 'وضعیت کارتن',
      '<select id="gpFabWhStatus"><option value="">همه وضعیت‌ها</option><option value="full">کارتن کامل</option><option value="open">خُرد / کارتن باز</option><option value="reserved">رزرو کامل</option><option value="mixed">رزرو جزئی</option><option value="out">خارج کامل</option></select>');
    addSelect(pane, 'gpFabWhShelf', 'طبقه قفسه',
      '<select id="gpFabWhShelf"><option value="">همه طبقات</option><option value="1">طبقه ۱</option><option value="2">طبقه ۲</option><option value="3">طبقه ۳</option><option value="4">طبقه ۴</option><option value="5">طبقه ۵</option></select>');
    addSelect(pane, 'gpFabWhStock', 'وضعیت موجودی',
      '<select id="gpFabWhStock"><option value="">همه</option><option value="free">دارای موجودی آزاد</option><option value="reserved">دارای رزرو</option><option value="out">دارای خروج</option><option value="incomplete">ناقص / باز</option></select>');
    addInput(pane, 'gpFabWhFrom', 'از تاریخ ثبت (شمسی)', '۱۴۰۵/۰۷/۰۱');
    addInput(pane, 'gpFabWhTo', 'تا تاریخ ثبت (شمسی)', '۱۴۰۵/۰۷/۳۰');
    addSelect(pane, 'gpFabWhOrder', 'مرتب‌سازی',
      '<select id="gpFabWhOrder"><option value="new">جدیدترین ابتدا</option><option value="old">قدیمی‌ترین ابتدا</option></select>');
    var sum = document.createElement('div');
    sum.id = 'gpFabWhSummary';
    sum.className = 'gp-fab-summary';
    sum.textContent = 'فیلتر مخزن آماده است';
    pane.appendChild(sum);
    ['gpFabWhQ', 'gpFabWhFrom', 'gpFabWhTo'].forEach(function (id) { bindApply($(id), applyWarehouse); });
    ['gpFabWhLoc', 'gpFabWhProduct', 'gpFabWhColor', 'gpFabWhSupplier', 'gpFabWhStatus', 'gpFabWhShelf', 'gpFabWhStock', 'gpFabWhOrder']
      .forEach(function (id) { bindApply($(id), applyWarehouse); });
  }

  function ensureInventoryFields(pane) {
    if (pane.dataset.gpInvExtra === '1') return;
    pane.dataset.gpInvExtra = '1';
    addSelect(pane, 'gpFabInvModel', 'مدل دستگاه', '<select id="gpFabInvModel"><option value="">همه مدل‌ها</option></select>');
    addInput(pane, 'gpFabInvFrom', 'از تاریخ ثبت (شمسی)', '۱۴۰۵/۰۷/۰۱');
    addInput(pane, 'gpFabInvTo', 'تا تاریخ ثبت (شمسی)', '۱۴۰۵/۰۷/۳۰');
    bindApply($('gpFabInvModel'), applyInventoryExtra);
    bindApply($('gpFabInvFrom'), applyInventoryExtra);
    bindApply($('gpFabInvTo'), applyInventoryExtra);
  }

  function ensureCustomerFields(pane) {
    if (pane.dataset.gpCustExtra === '1') return;
    pane.dataset.gpCustExtra = '1';
    addSelect(pane, 'gpFabCustKind', 'نوع همکاری',
      '<select id="gpFabCustKind"><option value="">همه انواع</option><option value="agent">عامل فروش</option><option value="marketer">بازاریاب</option><option value="rep">نماینده</option><option value="sub">زیرمجموعه بازاریاب</option></select>');
    addSelect(pane, 'gpFabCustActive', 'وضعیت مشتری',
      '<select id="gpFabCustActive"><option value="">فعال و غیرفعال</option><option value="on">فقط فعال</option><option value="off">فقط غیرفعال</option></select>');
    bindApply($('gpFabCustKind'), applyCustomerExtra);
    bindApply($('gpFabCustActive'), applyCustomerExtra);
  }

  function ensureStocktakeFields(pane) {
    if (pane.dataset.gpStExtra === '1') return;
    pane.dataset.gpStExtra = '1';
    addInput(pane, 'gpFabStockQ', 'جستجوی کالا در انبارگردانی', 'نام مدل یا نوع موجودی');
    bindApply($('gpFabStockQ'), function () { applyTextTable('gpFabStockQ', 'stocktakeBody'); });
  }

  function ensureDailyFields(pane) {
    if (pane.dataset.gpDailyExtra === '1') return;
    pane.dataset.gpDailyExtra = '1';
    addInput(pane, 'gpFabDailyQ', 'جستجوی مدل در دفتر روزانه', 'نام مدل دستگاه');
    bindApply($('gpFabDailyQ'), applyDaily);
  }

  function ensureReportsFields(pane) {
    if (pane.dataset.gpRepExtra === '1') return;
    pane.dataset.gpRepExtra = '1';
    addInput(pane, 'gpFabRepQ', 'جستجو در گزارش خروج', 'سفارش، مشتری، مدل، ارسال‌کننده');
    bindApply($('gpFabRepQ'), function () { applyTextTable('gpFabRepQ', 'repBody'); });
  }

  function ensureProductsFields(pane) {
    if ($('productSearch') || pane.dataset.gpProdExtra === '1') return;
    pane.dataset.gpProdExtra = '1';
    addInput(pane, 'gpFabProdQ', 'جستجوی محصول', 'نام محصول یا شرکت سازنده');
    bindApply($('gpFabProdQ'), function () { applyTextTable('gpFabProdQ', 'productBody'); });
  }

  function extrasFor(tabId, pane) {
    if (tabId === 'warehouse') ensureWarehouseFields(pane);
    if (tabId === 'inventory') ensureInventoryFields(pane);
    if (tabId === 'customers') ensureCustomerFields(pane);
    if (tabId === 'stocktake' || tabId === 'reports') {
      ensureStocktakeFields(pane);
      if (tabId === 'reports') ensureReportsFields(pane);
    }
    if (tabId === 'warehouseDaily') ensureDailyFields(pane);
    if (tabId === 'products') ensureProductsFields(pane);
  }

  function paneHasFields(pane) {
    return !!(pane && pane.querySelector('input, select'));
  }

  function collectTab(tab) {
    if (!tab || !tab.id) return null;
    var pane = ensurePane(tab.id);
    discover(tab).forEach(function (el) { adoptNode(el, pane); });
    extrasFor(tab.id, pane);
    hideHollow(tab);
    var tools = $('gpKartablTools');
    if (tools && tools.closest('#' + ROOT_ID)) tools.classList.add('hidden');
    return pane;
  }

  function titles(tabId) {
    var map = {
      warehouse: ['جستجو و فیلتر مخزن انبار', 'باکس، سریال، مدل، انبار، رنگ، وضعیت'],
      inventory: ['جستجو در سریال مشتریان', 'سریال، مشتری، مدل و تاریخ'],
      customers: ['جستجو در کارتابل مشتریان', 'نام، کد، موبایل، نوع همکاری'],
      orders: ['جستجو و فیلتر سفارش‌ها', 'شماره، مشتری، وضعیت، تسویه'],
      dashboard: ['جستجوی داشبورد', 'سفارش یا مشتری'],
      products: ['جستجوی محصولات', 'نام محصول یا سازنده'],
      reports: ['فیلتر گزارش خروج', 'تاریخ، ارسال، کالا'],
      warehouseDaily: ['جستجوی دفتر روزانه', 'ماه و مدل دستگاه'],
      stocktake: ['جستجوی انبارگردانی', 'مدل و نوع موجودی'],
      salesAgents: ['جستجوی عاملین فروش', 'نام، کد، موبایل، شرکت'],
      salesReps: ['جستجوی نمایندگان', 'نام، کد، نقش، بازاریاب'],
      portalAdmin: ['جستجوی پرتال', 'کالا یا طرح']
    };
    return map[tabId] || ['جستجو و فیلتر', 'همه شرط‌های این صفحه'];
  }

  function activeCount(pane) {
    if (!pane) return 0;
    var n = 0;
    Array.prototype.forEach.call(pane.querySelectorAll('input, select'), function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') return;
      if (String(el.value || '').trim()) n += 1;
    });
    return n;
  }

  function paintBadge() {
    var tab = currentTab();
    var pane = tab ? $(paneId(tab.id)) : null;
    var n = activeCount(pane);
    var btn = $('gpSearchFab');
    var badge = $('gpFabBadge');
    if (btn) btn.classList.toggle('is-active', n > 0);
    if (badge) badge.textContent = String(n);
  }

  function clearPane(pane) {
    if (!pane) return;
    Array.prototype.forEach.call(pane.querySelectorAll('input'), function (el) { el.value = ''; });
    Array.prototype.forEach.call(pane.querySelectorAll('select'), function (el) { el.selectedIndex = 0; });
    Array.prototype.forEach.call(pane.querySelectorAll('input, select'), function (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (pane.id === paneId('warehouse')) applyWarehouse();
    if (pane.id === paneId('inventory')) applyInventoryExtra();
    if (pane.id === paneId('customers')) applyCustomerExtra();
    if (pane.id === paneId('warehouseDaily')) applyDaily();
    paintBadge();
  }

  function ensureActions(pane) {
    if (!pane || pane.querySelector('.gp-fab-actions')) return;
    var box = document.createElement('div');
    box.className = 'gp-fab-actions';
    box.innerHTML = '<button type="button" class="btnlight" data-gp-fab-clear="1">پاک‌کردن فیلترها</button>';
    pane.appendChild(box);
    box.querySelector('[data-gp-fab-clear]').addEventListener('click', function () { clearPane(pane); });
  }

  function sync() {
    ensureStyle();
    var root = ensureRoot();
    var tab = currentTab();
    var authed = isAuthed();
    if (!authed || !tab) {
      root.classList.add('hidden');
      root.classList.remove('is-open');
      return;
    }
    var pane = collectTab(tab);
    Array.prototype.forEach.call(document.querySelectorAll('.gp-fab-pane'), function (p) {
      p.classList.toggle('is-on', p === pane);
    });
    var has = paneHasFields(pane);
    root.classList.toggle('hidden', !has);
    if (!has) root.classList.remove('is-open');
    else {
      ensureActions(pane);
      var t = titles(tab.id);
      var sub = $('gpFabSub');
      var title = root.querySelector('.gp-fab-head b');
      if (title) title.textContent = t[0];
      if (sub) sub.textContent = t[1];
    }
    paintBadge();
    if (tab.id === 'warehouse') applyWarehouse();
    if (tab.id === 'inventory') applyInventoryExtra();
    if (tab.id === 'customers') applyCustomerExtra();
    if (tab.id === 'warehouseDaily') applyDaily();
  }

  function openFab() {
    var root = ensureRoot();
    if (root.classList.contains('hidden')) return;
    root.classList.add('is-open');
    var tab = currentTab();
    var pane = tab ? $(paneId(tab.id)) : null;
    var first = pane && pane.querySelector('input, select');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 40);
  }

  function closeFab() {
    var root = $(ROOT_ID);
    if (root) root.classList.remove('is-open');
  }

  function wrapFn(name, after) {
    if (typeof window[name] !== 'function' || window[name]['__gpFab1']) return;
    var prev = window[name];
    window[name] = function () {
      var r = prev.apply(this, arguments);
      try { after(); } catch (e) {}
      return r;
    };
    window[name]['__gpFab1'] = true;
  }

  function wrapFns() {
    wrapFn('show', function () { setTimeout(sync, 20); });
    wrapFn('renderWarehouse', applyWarehouse);
    wrapFn('loadWarehouse', function () { setTimeout(applyWarehouse, 30); });
    wrapFn('renderCustomers', function () { setTimeout(applyCustomerExtra, 20); });
    wrapFn('loadInventory', function () { setTimeout(applyInventoryExtra, 40); });
    wrapFn('renderInventory', function () { setTimeout(applyInventoryExtra, 40); });
    wrapFn('renderWarehouseLedger', applyDaily);
    wrapFn('loadStocktake', function () { setTimeout(function () { applyTextTable('gpFabStockQ', 'stocktakeBody'); }, 20); });
    wrapFn('renderExitReport', function () { setTimeout(function () { applyTextTable('gpFabRepQ', 'repBody'); }, 20); });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { ensureRoot(); } catch (e) {}
    try { wrapFns(); } catch (e) {}
    try { sync(); } catch (e) {}
  }

  apply();
  [160, 700, 1600, 2800, 4500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-tab], .topnav button')) setTimeout(sync, 30);
  });
  if (!document.__gpFabWatch) {
    document.__gpFabWatch = true;
    var obs = new MutationObserver(function () {
      if (obs._q) return;
      obs._q = true;
      setTimeout(function () { obs._q = false; apply(); }, 80);
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
})();
