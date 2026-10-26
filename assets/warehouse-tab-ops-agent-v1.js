/* GP_WAREHOUSE_TAB_OPS_AGENT_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpWarehouseTabOpsAgentV1) return;
  window.__gpWarehouseTabOpsAgentV1 = true;

  var STYLE_ID = 'gp-warehouse-tab-ops-agent-v1-css';
  var WH_TABS = ['warehouseDaily', 'reports', 'stocktake', 'warehouse', 'inventory', 'products'];
  var DAILY_LABEL = 'تاریخچه و موجودی کالا';
  var VAULT_LABEL = 'انبار سریال';
  var AGENT_LABEL = 'عاملین فروش';
  var locks = window.__gpCoopLock = window.__gpCoopLock || {};

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function liveList() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list;
  }

  function syncCust(list) {
    if (!Array.isArray(list)) return;
    list = applyLocks(list);
    try { CUST = list; } catch (e) {}
    window.CUST = list;
  }

  function remember(id, extra) {
    if (!id || !extra) return;
    locks[+id] = Object.assign({ at: Date.now() }, extra);
  }

  function applyLocks(list) {
    return (list || []).map(function (c) {
      if (!c) return c;
      var lock = locks[+c.id];
      if (!lock) return c;
      return Object.assign({}, c, {
        sales_channel: lock.sales_channel,
        is_marketer: lock.is_marketer,
        parent_marketer_id: lock.parent_marketer_id,
        rep_role: lock.rep_role,
        visible_price_groups: lock.visible_price_groups || c.visible_price_groups
      });
    });
  }

  function kindOf(c) {
    if (!c) return '';
    var lock = locks[+c.id];
    if (lock) c = Object.assign({}, c, lock);
    var ch = String(c.sales_channel || c.rep_role || '').toLowerCase();
    if (ch === 'agent' || ch === 'sales_agent') return 'agent';
    if (c.parent_marketer_id) return 'sub';
    if (c.rep_role === 'rep') return 'rep';
    if (c.is_marketer) return 'marketer';
    if (ch === 'rep') return 'rep';
    return '';
  }

  function payloadFromKind(kind, parent) {
    if (kind === 'agent') return { sales_channel: 'agent', is_marketer: false, parent_marketer_id: 0, rep_role: 'agent' };
    if (kind === 'sub') return { sales_channel: 'rep', is_marketer: false, parent_marketer_id: parent || 0, rep_role: 'sub' };
    if (kind === 'rep') return { sales_channel: 'rep', is_marketer: false, parent_marketer_id: 0, rep_role: 'rep' };
    return { sales_channel: 'rep', is_marketer: true, parent_marketer_id: 0, rep_role: 'marketer' };
  }

  function pricesFor(kind) {
    return kind === 'agent' ? ['agent', 'panel', 'serial'] : ['panel', 'serial'];
  }

  function customerOf(id) {
    if (typeof customerById === 'function') {
      try {
        var found = customerById(id);
        if (found && found.id) return found;
      } catch (e) {}
    }
    return liveList().filter(function (c) { return +c.id === +id; })[0] || { id: id };
  }

  function ensureStyle() {
    var css = $(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#warehouse.hidden,#warehouseDaily.hidden,#reports.hidden,#stocktake.hidden,' +
      '#inventory.hidden,#products.hidden{display:none!important}' +
      '#warehouse:not(.hidden),#warehouseDaily:not(.hidden),#reports:not(.hidden),' +
      '#stocktake:not(.hidden),#inventory:not(.hidden),#products:not(.hidden){display:block!important}' +
      '#warehouseNavGroup .nav-group-toggle{cursor:pointer}' +
      '#warehouseNavGroup .nav-submenu>.tab,' +
      '#warehouseNavGroup section.tab{display:none!important}' +
      '#warehouseNavGroup .nav-submenu [data-tab]{' +
        'max-height:52px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis' +
      '}' +
      '.customer-menu .gp-ops-quick{display:flex;gap:6px;padding:6px 8px}' +
      '.customer-menu .gp-ops-quick button{flex:1;min-height:36px;border-radius:8px;font-weight:800}' +
      '.customer-menu .gp-ops-agent{background:#d8f5e3!important;color:#147a3d!important}' +
      '.customer-menu .gp-ops-rep{background:#fff!important;color:#334155!important;border:1px solid #d7dee7}';
  }

  function ejectNavTabs() {
    var group = $('warehouseNavGroup');
    var host = document.querySelector('.wrap') || document.body;
    if (!group) return;
    Array.prototype.forEach.call(group.querySelectorAll('section.tab, #warehouse, #warehouseDaily, #reports, #stocktake, #inventory, #products'), function (sec) {
      if (!sec || !sec.id || !host) return;
      if (sec.parentNode === host) return;
      host.appendChild(sec);
    });
  }

  function setMenuText(sel, text) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (btn) {
      if (!btn || btn.closest('#gpSearchFabRoot')) return;
      var span = btn.querySelector('.gp-menu-text');
      if (span && span.textContent !== text) span.textContent = text;
    });
  }

  function cleanToggle() {
    var group = $('warehouseNavGroup');
    if (!group) return;
    var toggle = group.querySelector('.nav-group-toggle');
    if (!toggle) return;
    toggle.removeAttribute('data-tab');
    if (toggle.dataset) delete toggle.dataset.tab;
    toggle.removeAttribute('href');
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('aria-controls', (group.querySelector('.nav-submenu') || {}).id || 'warehouseNavGroup-items');
    setMenuText('#warehouseNavGroup [data-tab="warehouseDaily"]', DAILY_LABEL);
    setMenuText('#warehouseNavGroup [data-tab="warehouse"]', VAULT_LABEL);
  }

  function isolateWarehouse(tab) {
    if (WH_TABS.indexOf(tab) < 0) return;
    ejectNavTabs();
    document.querySelectorAll('.tab').forEach(function (sec) {
      var on = sec.id === tab;
      sec.classList.toggle('hidden', !on);
      if (on) sec.removeAttribute('hidden');
      else sec.setAttribute('hidden', 'hidden');
    });
    var el = $(tab);
    if (el) {
      el.classList.remove('hidden');
      el.removeAttribute('hidden');
    }
    WH_TABS.forEach(function (id) {
      if (id === tab) return;
      var other = $(id);
      if (!other) return;
      other.classList.add('hidden');
      other.setAttribute('hidden', 'hidden');
    });
    document.querySelectorAll('#warehouseNavGroup [data-tab], .topnav [data-tab]').forEach(function (b) {
      if (b.classList && b.classList.contains('nav-group-toggle')) {
        b.classList.remove('active');
        return;
      }
      b.classList.toggle('active', (b.getAttribute('data-tab') || (b.dataset && b.dataset.tab)) === tab);
    });
    var wg = $('warehouseNavGroup');
    if (wg) wg.classList.add('has-active');
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__gpWhOps1) return;
    var base = window.show;
    window.show = function (t) {
      var out = base.apply(this, arguments);
      try {
        if (WH_TABS.indexOf(t) >= 0) isolateWarehouse(t);
      } catch (e) {}
      return out;
    };
    window.show.__gpWhOps1 = true;
  }

  function openWhTab(tab, ev) {
    if (!tab || WH_TABS.indexOf(tab) < 0) return false;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
    if (typeof show === 'function') show(tab);
    isolateWarehouse(tab);
    if (typeof setSidebar === 'function') setSidebar(false);
    return true;
  }

  function onNavClick(ev) {
    var group = $('warehouseNavGroup');
    if (!group || !ev.target || !ev.target.closest) return;
    var toggle = ev.target.closest('.nav-group-toggle');
    if (toggle && group.contains(toggle)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      cleanToggle();
      group.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(group.classList.contains('open')));
      var shown = WH_TABS.filter(function (id) {
        var sec = $(id);
        return sec && !sec.classList.contains('hidden') && !sec.hasAttribute('hidden');
      });
      if (shown.length > 1) isolateWarehouse(shown[0]);
      return;
    }
    var item = ev.target.closest('#warehouseNavGroup [data-tab]');
    if (!item || item.classList.contains('nav-group-toggle')) return;
    var tab = item.getAttribute('data-tab') || (item.dataset && item.dataset.tab);
    if (WH_TABS.indexOf(tab) >= 0) openWhTab(tab, ev);
  }

  function watchNav() {
    if (document.__gpWhOpsNav) return;
    document.__gpWhOpsNav = true;
    document.addEventListener('click', onNavClick, true);
    if (typeof window.toggleWarehouseNav === 'function' && !window.toggleWarehouseNav.__gpWhOps1) {
      window.toggleWarehouseNav = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var group = $('warehouseNavGroup');
        if (!group) return;
        cleanToggle();
        group.classList.toggle('open');
        var shown = WH_TABS.filter(function (id) {
          var sec = $(id);
          return sec && !sec.classList.contains('hidden');
        });
        if (shown.length > 1) isolateWarehouse(shown[0]);
      };
      window.toggleWarehouseNav.__gpWhOps1 = true;
    }
  }

  function readOpsKind() {
    var root = document.querySelector('#modal:not(.hidden)') || document;
    var on = root.querySelector('input[name="gpOpsChannel"]:checked') ||
      document.querySelector('input[name="gpOpsChannel"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $('gpOpsRole');
    var choice = document.querySelector('input[name="gpOpsRole_choice"]:checked');
    var val = (choice && choice.value) || (role && role.value) || '';
    if (val === 'sub') return 'sub';
    if (val === 'rep') return 'rep';
    if (val === 'marketer') return 'marketer';
    return 'rep';
  }

  async function persistKind(id, kind, parent) {
    if (!id || !kind) return;
    var extra = payloadFromKind(kind, parent);
    extra.visible_price_groups = pricesFor(kind);
    remember(id, extra);
    var c = customerOf(id);
    syncCust(applyLocks(liveList().map(function (row) {
      return +row.id === +id ? Object.assign({}, row, extra) : row;
    })));
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
    try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
    extra.id = id;
    extra.name = c.name;
    extra.mobile = c.mobile;
    extra.code = c.code;
    extra.company = c.company;
    extra.address = c.address;
    extra.national_id = c.national_id;
    extra.province = c.province;
    extra.city = c.city;
    extra.notes = c.notes;
    if (Object.prototype.hasOwnProperty.call(c, 'active')) extra.active = c.active;
    var saved = await window.req('/api/customers/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra)
    });
    remember(id, Object.assign({}, extra, saved || {}));
    syncCust(applyLocks(liveList().map(function (row) {
      return +row.id === +id ? Object.assign({}, row, extra, saved || {}) : row;
    })));
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
    try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
    return saved;
  }

  window.gpApplyCoopKind = async function (id, kind) {
    try {
      if (!kind) throw new Error('مدل همکاری را انتخاب کنید');
      var c = customerOf(id);
      var parent = kind === 'sub' ? (c.parent_marketer_id || 0) : 0;
      await persistKind(id, kind, parent);
      if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
      if (typeof closeModal === 'function') closeModal();
      if (typeof toast === 'function') toast(kind === 'agent' ? AGENT_LABEL + ' ذخیره شد' : 'مدل همکاری ذخیره شد');
    } catch (e) { alert(e.message); }
  };

  window.gpSaveCoop = async function (id) {
    try {
      var kind = readOpsKind();
      if (!kind) throw new Error('مدل همکاری را انتخاب کنید');
      var c = customerOf(id);
      var parent = 0;
      if (kind === 'sub') {
        parent = ($('gpOpsParent') && +$('gpOpsParent').value) || c.parent_marketer_id || 0;
      }
      await persistKind(id, kind, parent);
      if (typeof closeModal === 'function') closeModal();
      if (typeof toast === 'function') toast(kind === 'agent' ? AGENT_LABEL + ' ذخیره شد' : 'مدل همکاری ذخیره شد');
    } catch (e) { alert(e.message); }
  };
  window.gpSaveCoop.__gpWhOps1 = true;
  window.gpSaveCoop.__gpStab1 = true;

  function bindOpsRadios(id) {
    var box = document.querySelector('#modal:not(.hidden)') || $('modalbody') || $('modal');
    if (!box || box.dataset.gpWhOpsBound === String(id)) return;
    box.dataset.gpWhOpsBound = String(id);
    box.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.name !== 'gpOpsChannel' && t.id !== 'gpOpsRole' && t.name !== 'gpOpsRole_choice') return;
      var kind = readOpsKind();
      var role = $('gpOpsRole');
      if (role) role.style.display = kind === 'agent' ? 'none' : '';
      var chips = document.querySelector('[data-gp-choice="gpOpsRole"]');
      if (chips) chips.style.display = kind === 'agent' ? 'none' : '';
    });
  }

  function wrapChangeCoop() {
    if (typeof window.gpChangeCoop !== 'function' || window.gpChangeCoop.__gpWhOps1) {
      if (typeof window.gpChangeCoop === 'function') window.gpChangeCoop.__gpWhOps1 = true;
      return;
    }
    var base = window.gpChangeCoop;
    window.gpChangeCoop = function (id) {
      var out = base.apply(this, arguments);
      setTimeout(function () { bindOpsRadios(id); }, 30);
      setTimeout(function () { bindOpsRadios(id); }, 160);
      return out;
    };
    window.gpChangeCoop.__gpWhOps1 = true;
  }

  function injectQuick(menu, id) {
    if (!menu || menu.querySelector('[data-gp-ops-agent]')) return;
    var coop = null;
    Array.prototype.forEach.call(menu.querySelectorAll('button'), function (b) {
      if (/همکاری|عاملین|نماینده/.test(b.textContent || '')) coop = b;
    });
    var row = document.createElement('div');
    row.className = 'gp-ops-quick';
    row.innerHTML =
      '<button type="button" class="gp-ops-agent" data-gp-ops-agent="1">' + AGENT_LABEL + '</button>' +
      '<button type="button" class="gp-ops-rep" data-gp-ops-rep="1">نماینده</button>';
    row.querySelector('[data-gp-ops-agent]').onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
      window.gpApplyCoopKind(id, 'agent');
    };
    row.querySelector('[data-gp-ops-rep]').onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
      window.gpApplyCoopKind(id, 'rep');
    };
    if (coop && coop.parentNode) coop.parentNode.insertBefore(row, coop);
    else menu.insertBefore(row, menu.firstChild);
  }

  function fillOpenMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.customer-menu.open, .customer-menu'), function (menu) {
      if (!menu.classList.contains('open') && menu.style.display === 'none') return;
      if (!menu.classList.contains('open')) return;
      var btn = menu.querySelector('button[onclick*="openCustomerEdit"], button[onclick*="gpChangeCoop"], button[onclick*="gpApplyCoopKind"]');
      var id = 0;
      if (btn) {
        var m = String(btn.getAttribute('onclick') || '').match(/(\d+)/);
        if (m) id = +m[1];
      }
      if (!id && menu.dataset && menu.dataset.id) id = +menu.dataset.id;
      if (id) injectQuick(menu, id);
    });
  }

  function wrapMenu() {
    if (typeof window.toggleCustomerMenu === 'function' && !window.toggleCustomerMenu.__gpWhOps1) {
      var base = window.toggleCustomerMenu;
      window.toggleCustomerMenu = function (ev, id) {
        var out = base.apply(this, arguments);
        setTimeout(function () { fillOpenMenus(); }, 0);
        setTimeout(function () { fillOpenMenus(); }, 80);
        return out;
      };
      window.toggleCustomerMenu.__gpWhOps1 = true;
    }
    fillOpenMenus();
  }

  function wrapRefresh() {
    if (typeof window.refresh === 'function' && !window.refresh.__gpWhOps1) {
      var base = window.refresh;
      window.refresh = async function () {
        var out = await base.apply(this, arguments);
        try { syncCust(applyLocks(liveList())); } catch (e) {}
        return out;
      };
      window.refresh.__gpWhOps1 = true;
    }
    if (typeof window.lightRefresh === 'function' && !window.lightRefresh.__gpWhOps1) {
      var light = window.lightRefresh;
      window.lightRefresh = async function () {
        var out = await light.apply(this, arguments);
        try { syncCust(applyLocks(liveList())); } catch (e) {}
        return out;
      };
      window.lightRefresh.__gpWhOps1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { ejectNavTabs(); } catch (e) {}
    try { cleanToggle(); } catch (e) {}
    try { wrapShow(); } catch (e) {}
    try { watchNav(); } catch (e) {}
    try { wrapChangeCoop(); } catch (e) {}
    try { wrapMenu(); } catch (e) {}
    try { wrapRefresh(); } catch (e) {}
  }

  apply();
  [180, 700, 1600, 2800, 4200].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
