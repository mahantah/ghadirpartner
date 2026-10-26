/* GP_WAREHOUSE_OPS_HARDEN_V2_20261026 */
(function () {
  'use strict';
  if (window.__gpWarehouseOpsHardenV2) return;
  window.__gpWarehouseOpsHardenV2 = true;

  var STYLE_ID = 'gp-warehouse-ops-harden-v2-css';
  var WH_TABS = ['warehouseDaily', 'reports', 'stocktake', 'warehouse', 'inventory', 'products'];
  var DAILY = 'تاریخچه و موجودی کالا';
  var VAULT = 'انبار سریال';
  var AGENT = 'عاملین فروش';
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

  function customerOf(id) {
    if (typeof customerById === 'function') {
      try {
        var found = customerById(id);
        if (found && found.id) return found;
      } catch (e) {}
    }
    return liveList().filter(function (c) { return +c.id === +id; })[0] || { id: id };
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
      'section.tab[data-tab]{/* keep page sections out of nav */}' +
      '#warehouseNavGroup .nav-submenu section.tab,' +
      '#warehouseNavGroup > section.tab{display:none!important}' +
      '#warehouseNavGroup .nav-submenu [data-tab]{' +
        'max-height:48px!important;overflow:hidden!important;' +
        'white-space:nowrap!important;text-overflow:ellipsis' +
      '}' +
      'body.gp-modal-open #gpSearchFabRoot,' +
      'body.gp-modal-open #gpSearchFab{display:none!important;pointer-events:none!important}' +
      '#gpOpsHardenBox{display:flex;flex-direction:column;gap:12px}' +
      '#gpOpsHardenBox .gp-ops-row{display:flex;flex-wrap:wrap;gap:8px}' +
      '#gpOpsHardenBox .gp-ops-pick{' +
        'min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid #d7dee7;' +
        'background:#f7f9fc;color:#102a43;font-weight:800;cursor:pointer' +
      '}' +
      '#gpOpsHardenBox .gp-ops-pick.is-on{background:#147a3d;color:#fff;border-color:#147a3d}' +
      '#gpOpsHardenBox .gp-ops-pick[data-kind="rep"].is-on{background:#fff;color:#334155;border-color:#94a3b8}' +
      '#gpOpsHardenBox .gp-ops-actions{display:flex;gap:8px;margin-top:6px}' +
      '#gpOpsHardenBox .gp-ops-actions button{flex:1;min-height:44px;border-radius:12px;font-weight:800}' +
      '#gpOpsHardenBox .gp-ops-close{background:#edf2f7;color:#102a43;border:1px solid #d7e0ea}' +
      '#gpOpsHardenBox .gp-ops-save{background:#102a43;color:#fff;border:0}' +
      '#modal:not(.hidden){z-index:240!important}' +
      '#modal .modalbox{z-index:241!important}';
  }

  function hideFabForModal() {
    var modal = $('modal');
    var open = !!(modal && !modal.classList.contains('hidden'));
    document.body.classList.toggle('gp-modal-open', open);
  }

  function ejectPages() {
    var host = document.querySelector('.wrap') || document.body;
    var group = $('warehouseNavGroup');
    document.querySelectorAll('section.tab').forEach(function (sec) {
      sec.removeAttribute('data-tab');
      if (sec.dataset) delete sec.dataset.tab;
    });
    if (!group) return;
    Array.prototype.forEach.call(group.querySelectorAll('section.tab, #warehouse, #warehouseDaily, #reports, #stocktake, #inventory, #products'), function (sec) {
      if (sec && sec.id && host && sec.parentNode !== host) host.appendChild(sec);
    });
  }

  function setItemLabel(el, text) {
    if (!el) return;
    var span = el.querySelector('.gp-menu-text');
    if (!span) {
      span = document.createElement('span');
      span.className = 'gp-menu-text';
      el.appendChild(span);
    }
    if (span.textContent !== text) span.textContent = text;
  }

  function dedupeSubmenu() {
    var sub = document.querySelector('#warehouseNavGroup .nav-submenu');
    if (!sub) return sub;
    var seen = {};
    Array.prototype.slice.call(sub.querySelectorAll('[data-tab]')).forEach(function (el) {
      var tab = el.getAttribute('data-tab');
      if (!tab) return;
      if (el.tagName === 'SECTION') {
        el.removeAttribute('data-tab');
        return;
      }
      if (seen[tab]) {
        el.remove();
        return;
      }
      seen[tab] = el;
    });
    setItemLabel(sub.querySelector('[data-tab="warehouseDaily"]'), DAILY);
    setItemLabel(sub.querySelector('[data-tab="warehouse"]'), VAULT);
    var toggle = document.querySelector('#warehouseNavGroup .nav-group-toggle');
    if (toggle) {
      toggle.removeAttribute('data-tab');
      toggle.removeAttribute('href');
      if (toggle.dataset) delete toggle.dataset.tab;
    }
    return sub;
  }

  function isolateWarehouse(tab) {
    if (WH_TABS.indexOf(tab) < 0) return;
    ejectPages();
    document.querySelectorAll('.tab').forEach(function (sec) {
      var on = sec.id === tab;
      sec.classList.toggle('hidden', !on);
      if (on) sec.removeAttribute('hidden');
      else sec.setAttribute('hidden', 'hidden');
    });
    WH_TABS.forEach(function (id) {
      if (id === tab) return;
      var other = $(id);
      if (!other) return;
      other.classList.add('hidden');
      other.setAttribute('hidden', 'hidden');
    });
    var el = $(tab);
    if (el) {
      el.classList.remove('hidden');
      el.removeAttribute('hidden');
    }
    document.querySelectorAll('#warehouseNavGroup [data-tab]').forEach(function (b) {
      if (b.classList.contains('nav-group-toggle')) return;
      b.classList.toggle('active', (b.getAttribute('data-tab') || '') === tab);
    });
  }

  function visibleWarehouseTabs() {
    return WH_TABS.filter(function (id) {
      var sec = $(id);
      return sec && !sec.classList.contains('hidden') && !sec.hasAttribute('hidden');
    });
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__gpWhOps2) return;
    var base = window.show;
    window.show = function (t) {
      var out = base.apply(this, arguments);
      try {
        if (WH_TABS.indexOf(t) >= 0) isolateWarehouse(t);
        else {
          var piled = visibleWarehouseTabs();
          if (piled.length > 1) isolateWarehouse(piled[0]);
        }
      } catch (e) {}
      return out;
    };
    window.show.__gpWhOps2 = true;
    window.show.__gpFab1 = base.__gpFab1;
    window.show.__gpGuard1 = base.__gpGuard1;
    window.show.__gpWhOps1 = base.__gpWhOps1;
  }

  function onNavPointer(ev) {
    var group = $('warehouseNavGroup');
    if (!group || !ev.target || !ev.target.closest) return;
    var toggle = ev.target.closest('#warehouseNavGroup .nav-group-toggle');
    if (toggle) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      window.__gpWhNavToggling = true;
      dedupeSubmenu();
      group.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(group.classList.contains('open')));
      var piled = visibleWarehouseTabs();
      if (piled.length > 1) isolateWarehouse(piled[0]);
      setTimeout(function () { window.__gpWhNavToggling = false; }, 200);
      return;
    }
    var item = ev.target.closest('#warehouseNavGroup [data-tab]');
    if (!item || item.classList.contains('nav-group-toggle')) return;
    if (item.tagName === 'SECTION') return;
    var tab = item.getAttribute('data-tab');
    if (WH_TABS.indexOf(tab) < 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if (typeof show === 'function') show(tab);
    isolateWarehouse(tab);
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function watchNav() {
    if (document.__gpWhOps2Nav) return;
    document.__gpWhOps2Nav = true;
    document.addEventListener('click', onNavPointer, true);
    document.addEventListener('pointerdown', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#warehouseNavGroup .nav-group-toggle')) {
        dedupeSubmenu();
      }
    }, true);
    if (typeof window.toggleWarehouseNav === 'function') {
      window.toggleWarehouseNav = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var group = $('warehouseNavGroup');
        if (!group) return;
        window.__gpWhNavToggling = true;
        dedupeSubmenu();
        group.classList.toggle('open');
        var piled = visibleWarehouseTabs();
        if (piled.length > 1) isolateWarehouse(piled[0]);
        setTimeout(function () { window.__gpWhNavToggling = false; }, 200);
      };
      window.toggleWarehouseNav.__gpWhOps2 = true;
    }
  }

  function healSubmenu() {
    if (healSubmenu._busy) return;
    healSubmenu._busy = true;
    try {
      ejectPages();
      dedupeSubmenu();
    } catch (e) {}
    healSubmenu._busy = false;
  }

  function watchSubmenu() {
    var sub = document.querySelector('#warehouseNavGroup .nav-submenu');
    var nav = document.querySelector('.topnav');
    if (!sub || sub.__gpWhOps2Watch) return;
    sub.__gpWhOps2Watch = true;
    var obs = new MutationObserver(function () {
      if (healSubmenu._busy || window.__gpWhNavToggling) return;
      if (watchSubmenu._q) return;
      watchSubmenu._q = true;
      requestAnimationFrame(function () {
        watchSubmenu._q = false;
        healSubmenu();
      });
    });
    obs.observe(sub, { childList: true, subtree: true });
    if (nav && !nav.__gpWhOps2Watch) {
      nav.__gpWhOps2Watch = true;
      obs.observe(nav, { childList: true });
    }
  }

  function skipFabWhileToggling() {
    if (typeof window.show === 'function' && window.show.__gpFab1 && !window.show.__gpWhFabGate) {
      var base = window.show;
      window.show = function (t) {
        if (window.__gpWhNavToggling && WH_TABS.indexOf(t) < 0) return;
        return base.apply(this, arguments);
      };
      window.show.__gpWhFabGate = true;
      window.show.__gpFab1 = true;
      window.show.__gpWhOps2 = base.__gpWhOps2;
    }
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

  function paintOpsBox(kind) {
    var box = $('gpOpsHardenBox');
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('.gp-ops-pick'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-kind') === kind);
    });
    var roles = box.querySelector('[data-gp-ops-roles]');
    if (roles) roles.style.display = kind === 'agent' ? 'none' : 'flex';
  }

  function installOpsHandlers() {
    window.gpApplyCoopKind = async function (id, kind) {
      try {
        if (!kind) throw new Error('مدل همکاری را انتخاب کنید');
        var c = customerOf(id);
        await persistKind(id, kind, kind === 'sub' ? (c.parent_marketer_id || 0) : 0);
        if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
        if (typeof closeModal === 'function') closeModal();
        hideFabForModal();
        if (typeof toast === 'function') toast(kind === 'agent' ? AGENT + ' ذخیره شد' : 'مدل همکاری ذخیره شد');
      } catch (e) { alert(e.message); }
    };

    window.gpSaveCoop = async function (id) {
      var box = $('gpOpsHardenBox');
      var on = box && box.querySelector('.gp-ops-pick.is-on');
      var kind = (on && on.getAttribute('data-kind')) || window.__gpOpsKind || '';
      if (!kind) {
        var radio = document.querySelector('#modal input[name="gpOpsChannel"]:checked');
        if (radio && radio.value === 'agent') kind = 'agent';
        else if (radio) {
          var role = $('gpOpsRole');
          kind = (role && role.value) || 'rep';
        }
      }
      return window.gpApplyCoopKind(id, kind);
    };
    window.gpSaveCoop.__gpWhOps2 = true;
    window.gpSaveCoop.__gpWhOps1 = true;
    window.gpSaveCoop.__gpStab1 = true;

    window.gpChangeCoop = function (id) {
      var c = customerOf(id);
      var kind = kindOf(c) || 'rep';
      window.__gpOpsKind = kind;
      window.__gpOpsCustomerId = id;
      var html =
        '<div id="gpOpsHardenBox">' +
          '<h3 style="margin:0 0 4px">تغییر مدل همکاری — ' + esc(c.name || '') + '</h3>' +
          '<div class="gp-ops-row" data-gp-ops-channel="1">' +
            '<button type="button" class="gp-ops-pick" data-kind="agent">' + AGENT + '</button>' +
            '<button type="button" class="gp-ops-pick" data-kind="rep">نمایندگان</button>' +
          '</div>' +
          '<div class="gp-ops-row" data-gp-ops-roles="1">' +
            '<button type="button" class="gp-ops-pick" data-kind="marketer">بازاریاب</button>' +
            '<button type="button" class="gp-ops-pick" data-kind="rep">نماینده</button>' +
            '<button type="button" class="gp-ops-pick" data-kind="sub">زیرمجموعه بازاریاب</button>' +
          '</div>' +
          '<div class="gp-ops-actions">' +
            '<button type="button" class="gp-ops-close" data-gp-ops-close="1">بستن</button>' +
            '<button type="button" class="gp-ops-save" data-gp-ops-save="1">ذخیره مدل</button>' +
          '</div>' +
        '</div>';
      if (typeof modal === 'function') modal(html);
      else {
        var body = $('modalbody');
        if (body) body.innerHTML = html;
        if ($('modal')) $('modal').classList.remove('hidden');
      }
      hideFabForModal();
      var box = $('gpOpsHardenBox');
      if (!box) return;
      paintOpsBox(kind === 'agent' ? 'agent' : (kind === 'marketer' || kind === 'sub' ? kind : 'rep'));
      if (kind === 'agent') paintOpsBox('agent');
      box.onclick = function (ev) {
        var t = ev.target && ev.target.closest && ev.target.closest('[data-kind], [data-gp-ops-save], [data-gp-ops-close]');
        if (!t) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (t.getAttribute('data-gp-ops-close')) {
          if (typeof closeModal === 'function') closeModal();
          hideFabForModal();
          return;
        }
        if (t.getAttribute('data-gp-ops-save')) {
          window.gpApplyCoopKind(id, window.__gpOpsKind);
          return;
        }
        var next = t.getAttribute('data-kind');
        if (!next) return;
        window.__gpOpsKind = next;
        paintOpsBox(next);
        persistKind(id, next, next === 'sub' ? (c.parent_marketer_id || 0) : 0).catch(function (e) {
          alert(e.message);
        });
      };
    };
    window.gpChangeCoop.__gpWhOps2 = true;
    window.gpChangeCoop.__gpWhOps1 = true;
    window.gpChangeCoop.__gpStab1 = true;
  }

  function injectQuick() {
    Array.prototype.forEach.call(document.querySelectorAll('.customer-menu.open'), function (menu) {
      if (menu.querySelector('[data-gp-ops-agent]')) return;
      var id = 0;
      var hit = menu.querySelector('button[onclick*="openCustomerEdit"], button[onclick*="gpChangeCoop"], button[onclick*="gpApplyCoopKind"]');
      if (hit) {
        var m = String(hit.getAttribute('onclick') || '').match(/(\d+)/);
        if (m) id = +m[1];
      }
      if (!id) return;
      var row = document.createElement('div');
      row.className = 'gp-ops-quick';
      row.style.cssText = 'display:flex;gap:6px;padding:6px 8px';
      row.innerHTML =
        '<button type="button" data-gp-ops-agent="1" style="flex:1;min-height:36px;border-radius:8px;background:#d8f5e3;color:#147a3d;font-weight:800">' + AGENT + '</button>' +
        '<button type="button" data-gp-ops-rep="1" style="flex:1;min-height:36px;border-radius:8px;background:#fff;color:#334155;border:1px solid #d7dee7;font-weight:800">نماینده</button>';
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
      var coop = null;
      Array.prototype.forEach.call(menu.querySelectorAll('button'), function (b) {
        if (/همکاری|عاملین|نماینده/.test(b.textContent || '')) coop = coop || b;
      });
      if (coop && coop.parentNode) coop.parentNode.insertBefore(row, coop);
      else menu.insertBefore(row, menu.firstChild);
    });
  }

  function wrapMenu() {
    if (typeof window.toggleCustomerMenu === 'function' && !window.toggleCustomerMenu.__gpWhOps2) {
      var base = window.toggleCustomerMenu;
      window.toggleCustomerMenu = function () {
        var out = base.apply(this, arguments);
        setTimeout(injectQuick, 0);
        setTimeout(injectQuick, 80);
        return out;
      };
      window.toggleCustomerMenu.__gpWhOps2 = true;
    }
    injectQuick();
  }

  function wrapRefresh() {
    if (typeof window.refresh === 'function' && !window.refresh.__gpWhOps2) {
      var base = window.refresh;
      window.refresh = async function () {
        var out = await base.apply(this, arguments);
        try { syncCust(applyLocks(liveList())); } catch (e) {}
        return out;
      };
      window.refresh.__gpWhOps2 = true;
    }
    if (typeof window.lightRefresh === 'function' && !window.lightRefresh.__gpWhOps2) {
      var light = window.lightRefresh;
      window.lightRefresh = async function () {
        var out = await light.apply(this, arguments);
        try { syncCust(applyLocks(liveList())); } catch (e) {}
        return out;
      };
      window.lightRefresh.__gpWhOps2 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { ejectPages(); } catch (e) {}
    try { healSubmenu(); } catch (e) {}
    try { wrapShow(); } catch (e) {}
    try { skipFabWhileToggling(); } catch (e) {}
    try { watchNav(); } catch (e) {}
    try { watchSubmenu(); } catch (e) {}
    try { installOpsHandlers(); } catch (e) {}
    try { wrapMenu(); } catch (e) {}
    try { wrapRefresh(); } catch (e) {}
    try { hideFabForModal(); } catch (e) {}
  }

  apply();
  [80, 400, 900, 1600, 2800, 4500].forEach(function (ms) { setTimeout(apply, ms); });
  setInterval(function () {
    if (!window.gpSaveCoop || !window.gpSaveCoop.__gpWhOps2) installOpsHandlers();
    if (!window.gpChangeCoop || !window.gpChangeCoop.__gpWhOps2) installOpsHandlers();
    hideFabForModal();
  }, 400);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
