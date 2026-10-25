/* GP_PLANS_ICON_AGENT_LOCK_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpPlansIconAgentLockV1) return;
  window.__gpPlansIconAgentLockV1 = true;

  var STYLE_ID = 'gp-plans-icon-agent-lock-v1-css';
  var PLANS_LABEL = 'طرح‌ها و تخفیف‌ها';
  var OFFERS_ICON = 'M3 9h18v4H3ZM5 13v8h14v-8M12 9v12M12 9C2 9 5 0 9 4ZM12 9C22 9 19 0 15 4Z';
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
        rep_role: lock.rep_role
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

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gpNavPlans{display:flex!important;align-items:center;gap:8px;width:100%;text-align:right}' +
      '#gpNavPlans .gp-menu-icon{width:18px;height:18px;flex:0 0 18px;display:block!important}' +
      '#gpNavPlans .gp-menu-text{display:inline}' +
      '#ctbody tr.gp-coop-agent td{background:#d8f5e3!important}';
    document.head.appendChild(css);
  }

  function makeIcon() {
    var sample = document.querySelector('#gpNavReps .gp-menu-icon, #gpNavAgents .gp-menu-icon, #gpNavKartabl .gp-menu-icon');
    if (sample) return sample.cloneNode(true);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'gp-menu-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', OFFERS_ICON);
    svg.appendChild(path);
    return svg;
  }

  function decoratePlans() {
    var btn = $('gpNavPlans');
    if (!btn) return;
    var label = btn.querySelector('.gp-menu-text');
    var icon = btn.querySelector('.gp-menu-icon');
    if (icon && label && label.textContent === PLANS_LABEL) {
      btn.setAttribute('data-tab', 'salesPlans');
      return;
    }
    btn.setAttribute('data-tab', 'salesPlans');
    btn.innerHTML = '';
    btn.appendChild(makeIcon());
    var span = document.createElement('span');
    span.className = 'gp-menu-text';
    span.textContent = PLANS_LABEL;
    btn.appendChild(span);
    var h = $('salesPlans') && $('salesPlans').querySelector('.card h3');
    if (h) h.textContent = PLANS_LABEL;
  }

  function watchPlans() {
    if (document.__gpPlansIconWatch) return;
    document.__gpPlansIconWatch = true;
    var sub = document.querySelector('#gpCustomers .nav-submenu') || document.querySelector('#gpCustomers-items');
    if (!sub || typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () { decoratePlans(); });
    obs.observe(sub, { childList: true, subtree: true, characterData: true });
  }

  function hardenReqCache() {
    if (typeof window.req !== 'function' || window.req.__gpLockCache1) {
      if (typeof window.req === 'function') window.req.__gpLockCache1 = window.req.__gpLockCache1 || true;
      return;
    }
    var base = window.req;
    window.req = async function (url, opt) {
      opt = Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opt || {});
      opt.headers = Object.assign({ 'Cache-Control': 'no-cache' }, opt.headers || {});
      if (/^\/api\/customers(\?|$)/.test(String(url)) && (!opt.method || opt.method === 'GET')) {
        url += (String(url).indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      }
      var out = await base.call(window, url, opt);
      if (/\/api\/customers/.test(String(url)) && Array.isArray(out) && (!opt.method || opt.method === 'GET')) {
        out = applyLocks(out);
        syncCust(out);
      }
      return out;
    };
    window.req.__gpStab1 = base.__gpStab1;
    window.req.__gpLockCache1 = true;
  }

  function readKind(channelName, roleId) {
    var on = document.querySelector('input[name="' + channelName + '"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $(roleId) ? $(roleId).value : '';
    if (role === 'sub') return 'sub';
    if (role === 'rep') return 'rep';
    if (role === 'marketer') return 'marketer';
    return 'rep';
  }

  function pricesFor(kind) {
    return kind === 'agent' ? ['agent', 'panel', 'serial'] : ['panel', 'serial'];
  }

  async function persistChannel(id, kind, parent) {
    if (!id || !kind) return;
    var extra = payloadFromKind(kind, parent);
    extra.visible_price_groups = pricesFor(kind);
    remember(id, extra);
    var c = (typeof customerById === 'function' ? customerById(id) : null) || {};
    var list = applyLocks(liveList().map(function (row) {
      return +row.id === +id ? Object.assign({}, row, extra) : row;
    }));
    syncCust(list);
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
    try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
    extra.id = id;
    extra.name = $('ecn') ? $('ecn').value : c.name;
    extra.mobile = $('ecm') ? $('ecm').value : c.mobile;
    var saved = await window.req('/api/customers/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra)
    });
    remember(id, Object.assign({}, extra, saved || {}));
    if (saved && saved.id) {
      var next = liveList().map(function (row) {
        return +row.id === +saved.id ? Object.assign({}, row, extra, saved) : row;
      });
      syncCust(next);
    }
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
    try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
  }

  function bindEditRadios(id) {
    if (id) window.__gpEditCustomerId = id;
    var box = $('gpEditCoopBox');
    if (!box || box.dataset.gpLockBound === '1') return;
    box.dataset.gpLockBound = '1';
    box.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || (t.name !== 'gpEditChannel' && t.id !== 'gpEditRepRole' && t.id !== 'gpEditParent')) return;
      var current = window.__gpEditCustomerId;
      var kind = readKind('gpEditChannel', 'gpEditRepRole');
      var parent = $('gpEditParent') ? +$('gpEditParent').value : 0;
      persistChannel(current, kind, parent).catch(function (e) { console.warn(e); });
    });
  }

  function wrapEdit() {
    if (typeof window.openCustomerEdit === 'function' && !window.openCustomerEdit.__gpLock1) {
      var base = window.openCustomerEdit;
      window.openCustomerEdit = function (id) {
        var out = base.apply(this, arguments);
        setTimeout(function () { bindEditRadios(id); decoratePlans(); }, 30);
        setTimeout(function () { bindEditRadios(id); }, 120);
        return out;
      };
      window.openCustomerEdit.__gpLock1 = true;
    }
    window.saveCustomer = async function (id) {
      var kind = readKind('gpEditChannel', 'gpEditRepRole') || kindOf(typeof customerById === 'function' ? customerById(id) : null);
      var parent = $('gpEditParent') ? +$('gpEditParent').value : 0;
      try {
        await persistChannel(id, kind, parent);
        var extra = payloadFromKind(kind, parent);
        extra.id = id;
        extra.name = $('ecn') ? $('ecn').value : '';
        extra.mobile = $('ecm') ? $('ecm').value : '';
        extra.code = $('ecc') ? $('ecc').value : '';
        extra.company = $('ecco') ? $('ecco').value : '';
        extra.national_id = $('ecnid') ? $('ecnid').value : '';
        extra.province = $('ecp') ? $('ecp').value : '';
        extra.city = $('ecci') ? $('ecci').value : '';
        extra.address = $('eca') ? $('eca').value : '';
        extra.notes = $('ecno') ? $('ecno').value : '';
        extra.visible_price_groups = pricesFor(kind);
        if ($('eCustomerActive')) extra.active = $('eCustomerActive').checked;
        var saved = await window.req('/api/customers/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extra)
        });
        remember(id, extra);
        if (saved) syncCust(liveList().map(function (row) {
          return +row.id === +id ? Object.assign({}, row, extra, saved) : row;
        }));
        if (typeof closeModal === 'function') closeModal();
        toast('مدل همکاری ذخیره شد');
        try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
        try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
      } catch (e) { alert(e.message); }
    };
    window.saveCustomer.__gpStab1 = true;
    window.saveCustomer.__gpLock1 = true;
  }

  function wrapRefresh() {
    if (typeof window.refresh !== 'function' || window.refresh.__gpLock1) return;
    var base = window.refresh;
    window.refresh = async function () {
      var out = await base.apply(this, arguments);
      try {
        syncCust(applyLocks(liveList()));
        if (typeof renderCustomers === 'function') renderCustomers();
      } catch (e) {}
      return out;
    };
    window.refresh.__gpLock1 = true;
  }

  function wrapRender() {
    if (typeof window.renderCustomers === 'function' && !window.renderCustomers.__gpLock1) {
      var base = window.renderCustomers;
      window.renderCustomers = function () {
        try { syncCust(applyLocks(liveList())); } catch (e) {}
        return base.apply(this, arguments);
      };
      window.renderCustomers.__gpLock1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { decoratePlans(); } catch (e) {}
    try { watchPlans(); } catch (e) {}
    try { hardenReqCache(); } catch (e) {}
    try { wrapEdit(); } catch (e) {}
    try { wrapRefresh(); } catch (e) {}
    try { wrapRender(); } catch (e) {}
    try { bindEditRadios(window.__gpEditCustomerId); } catch (e) {}
  }

  apply();
  [200, 900, 1800, 2800, 3600, 4500, 6000].forEach(function (ms) { setTimeout(apply, ms); });
  setInterval(decoratePlans, 1500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
