/* GP_CUSTOMER_OPS_STABILIZE_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpOpsStabilizeV1) return;
  window.__gpOpsStabilizeV1 = true;

  var STYLE_ID = 'gp-ops-stabilize-v1-css';
  var PLANS_LABEL = 'طرح‌ها و تخفیف‌ها';
  var OFFERS_ICON = 'M3 9h18v4H3ZM5 13v8h14v-8M12 9v12M12 9C2 9 5 0 9 4ZM12 9C22 9 19 0 15 4Z';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function liveCustomers() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list;
  }

  function syncCust(list) {
    if (!Array.isArray(list)) return;
    try { CUST = list; } catch (e) {}
    window.CUST = list;
  }

  function kindOf(c) {
    if (!c) return '';
    var ch = String(c.sales_channel || c.rep_role || '').toLowerCase();
    if (ch === 'agent' || ch === 'sales_agent') return 'agent';
    if (c.parent_marketer_id) return 'sub';
    if (c.rep_role === 'rep') return 'rep';
    if (c.is_marketer) return 'marketer';
    if (ch === 'rep') return 'rep';
    return '';
  }

  function kindLabel(kind) {
    return kind === 'agent' ? 'عامل فروش'
      : kind === 'marketer' ? 'بازاریاب'
      : kind === 'rep' ? 'نماینده'
      : kind === 'sub' ? 'زیرمجموعه بازاریاب'
      : '';
  }

  function pricesFor(kind) {
    return kind === 'agent' ? ['agent', 'panel', 'serial'] : ['panel', 'serial'];
  }

  function payloadFromKind(kind, parent) {
    if (kind === 'agent') {
      return { sales_channel: 'agent', is_marketer: false, parent_marketer_id: 0, rep_role: 'agent' };
    }
    if (kind === 'sub') {
      return { sales_channel: 'rep', is_marketer: false, parent_marketer_id: parent || 0, rep_role: 'sub' };
    }
    if (kind === 'rep') {
      return { sales_channel: 'rep', is_marketer: false, parent_marketer_id: 0, rep_role: 'rep' };
    }
    return { sales_channel: 'rep', is_marketer: true, parent_marketer_id: 0, rep_role: 'marketer' };
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#ctbody tr.gp-coop-rep td{background:#dbeafe!important}' +
      '#ctbody tr.gp-coop-rep td:first-child{border-right:5px solid #2563eb}' +
      '.gp-coop-badge.rep{background:#2563eb;color:#fff}' +
      '#gpCoopLegend i.rep{background:#dbeafe;border:1px solid #2563eb}' +
      '#gpNavPlans .gp-menu-icon{width:18px;height:18px;flex:0 0 18px}' +
      '#salesPlans h3{display:flex;align-items:center;gap:8px}';
    document.head.appendChild(css);
  }

  async function readBody(r) {
    var ct = r.headers.get('content-type') || '';
    return ct.indexOf('json') >= 0 ? r.json() : r.text();
  }

  async function rawFetch(url, opt) {
    var r = await fetch(url, opt);
    if (r.status === 401 && String(url).indexOf('/api/login') < 0) {
      var msg = await r.text();
      var err = new Error(msg || 'ورود الزامی است');
      err.status = 401;
      throw err;
    }
    if (!r.ok) throw new Error(await r.text());
    return readBody(r);
  }

  function hardenReq() {
    if (window.req && window.req.__gpStab1) return;
    window.req = async function (url, opt) {
      opt = Object.assign({ credentials: 'same-origin' }, opt || {});
      var notify = String(url || '').indexOf('/api/notifications') >= 0;
      var login = String(url || '').indexOf('/api/login') >= 0;
      try {
        return await rawFetch(url, opt);
      } catch (err) {
        if (login || notify || (err && err.status !== 401)) throw err;
        await sleep(320);
        try {
          restoreSessionUi();
          return await rawFetch(url, opt);
        } catch (err2) {
          if (!err2 || err2.status !== 401) throw err2;
          if (await sessionAlive()) {
            restoreSessionUi();
            throw new Error(err2.message || 'درخواست ناموفق بود؛ دوباره تلاش کنید');
          }
          showLoginExpired(err2.message);
          throw err2;
        }
      }
    };
    window.req.__gpStab1 = true;
  }

  function showLoginExpired(msg) {
    try { sessionExpiredHandled = true; } catch (e) {}
    window.sessionExpiredHandled = true;
    try { ME = null; } catch (e) {}
    if ($('app')) $('app').classList.add('hidden');
    if ($('login')) $('login').classList.remove('hidden');
    if ($('lmsg')) $('lmsg').textContent = msg || 'نشست شما منقضی شده است؛ دوباره وارد شوید.';
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function sessionAlive() {
    try {
      var r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      return r.ok;
    } catch (e) {
      return false;
    }
  }

  function restoreSessionUi() {
    try { sessionExpiredHandled = false; } catch (e) {}
    window.sessionExpiredHandled = false;
    if ($('app')) $('app').classList.remove('hidden');
    if ($('login')) $('login').classList.add('hidden');
    if ($('lmsg')) $('lmsg').textContent = '';
  }

  function hardenPoll() {
    if (typeof window.pollNotif !== 'function' || window.pollNotif.__gpStab1) return;
    var base = window.pollNotif;
    window.pollNotif = async function () {
      if (window.__gpBusy || document.hidden) return;
      try { await base.apply(this, arguments); } catch (e) {}
    };
    window.pollNotif.__gpStab1 = true;
  }

  function refreshUsesBootstrap(fn) {
    try {
      if (typeof window.applyBootstrapData === 'function') return true;
      return /\/api\/bootstrap/.test(String(fn || ''));
    } catch (e) {
      return false;
    }
  }

  function hardenRefresh() {
    if (typeof window.refresh !== 'function' || window.refresh.__gpStab1) return;
    var base = window.refresh;
    var bootstrapRefresh = refreshUsesBootstrap(base);
    window.refresh = async function () {
      if (window.__gpLightRefresh || arguments[0] === 'light') {
        return lightRefresh();
      }
      window.__gpBusy = true;
      try {
        if (bootstrapRefresh) {
          return await base.apply(this, arguments);
        }
        var rows = await Promise.allSettled([
          window.req('/api/customers'),
          window.req('/api/orders'),
          window.req('/api/products'),
          window.req('/api/inventory')
        ]);
        if (rows[0].status === 'fulfilled') syncCust(rows[0].value);
        try { if (rows[1].status === 'fulfilled') ORD = rows[1].value; } catch (e) {}
        try { if (rows[2].status === 'fulfilled') PROD = rows[2].value; } catch (e) {}
        try { if (rows[3].status === 'fulfilled') INV = rows[3].value; } catch (e) {}
        if (rows[0].status !== 'fulfilled' && rows[1].status !== 'fulfilled') {
          return base.apply(this, arguments);
        }
        try { if (typeof renderProductDatalist === 'function') renderProductDatalist(); } catch (e) {}
        try { if (typeof renderCustOptions === 'function') renderCustOptions(); } catch (e) {}
        try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
        try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
        try { if (typeof renderOrders === 'function') renderOrders(); } catch (e) {}
        try { if (typeof renderDash === 'function') renderDash(); } catch (e) {}
      } finally {
        window.__gpBusy = false;
      }
    };
    window.refresh.__gpStab1 = true;
  }

  async function lightRefresh() {
    window.__gpBusy = true;
    try {
      var list = await window.req('/api/customers');
      syncCust(list);
      try { if (typeof renderCustOptions === 'function') renderCustOptions(); } catch (e) {}
      try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
      try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
    } finally {
      window.__gpBusy = false;
    }
  }

  function mergeCustomer(saved) {
    if (!saved || !saved.id) return;
    var list = liveCustomers().slice();
    var i = -1;
    list.forEach(function (c, idx) { if (c && +c.id === +saved.id) i = idx; });
    if (i >= 0) list[i] = Object.assign({}, list[i], saved);
    else list.push(saved);
    syncCust(list);
    try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
    try { if (typeof renderPeople === 'function') renderPeople(); } catch (e) {}
  }

  function roleOptionsHtml(selected, blank) {
    var opts = [
      blank ? ['', 'انتخاب کنید'] : null,
      ['marketer', 'بازاریاب'],
      ['rep', 'نماینده'],
      ['sub', 'زیرمجموعه بازاریاب']
    ].filter(Boolean);
    return opts.map(function (pair) {
      return '<option value="' + pair[0] + '"' + (pair[0] === selected ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');
  }

  function fillRoleSelect(sel, kind, blank) {
    if (!sel) return;
    var want = kind === 'sub' || kind === 'rep' || kind === 'marketer' ? kind : (sel.value || '');
    sel.innerHTML = roleOptionsHtml(want, blank);
    if (want) sel.value = want;
  }

  function readKindFrom(channelName, roleId) {
    var on = document.querySelector('input[name="' + channelName + '"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $(roleId) ? $(roleId).value : '';
    if (role === 'sub') return 'sub';
    if (role === 'rep') return 'rep';
    if (role === 'marketer') return 'marketer';
    return 'rep';
  }

  function syncRepBoxes(kind, roleId, parentBoxId) {
    var role = $(roleId);
    if (role) role.style.display = kind === 'agent' || !kind ? 'none' : '';
    var box = $(parentBoxId);
    if (box) box.classList.toggle('hidden', kind !== 'sub');
    var addRep = $('gpRepBox');
    if (addRep && roleId === 'gpRepRole') addRep.classList.toggle('hidden', kind === 'agent' || !kind);
    var editRep = $('gpEditRepBox');
    if (editRep && roleId === 'gpEditRepRole') editRep.classList.toggle('hidden', kind === 'agent' || !kind);
  }

  function applyPrices(prefix, kind) {
    var allowed = pricesFor(kind);
    ['agent', 'panel', 'serial'].forEach(function (k) {
      var el = $(prefix + '_' + k);
      if (!el) return;
      el.checked = allowed.indexOf(k) >= 0;
      el.disabled = k === 'agent' && kind !== 'agent' && !!kind;
      var lab = el.closest('label');
      if (lab) lab.style.opacity = el.disabled ? '.45' : '';
    });
  }

  function installAddRoles() {
    fillRoleSelect($('gpRepRole'), readKindFrom('gpChannel', 'gpRepRole'), true);
    var box = $('gpChannelBox');
    if (box && !box.dataset.gpStabBound) {
      box.dataset.gpStabBound = '1';
      box.addEventListener('change', function () {
        var kind = readKindFrom('gpChannel', 'gpRepRole');
        syncRepBoxes(kind, 'gpRepRole', 'gpRepParentBox');
        if (kind) applyPrices('cp', kind);
      });
    }
  }

  function paintEditBox(id) {
    var c = typeof customerById === 'function' ? customerById(id) : null;
    var kind = kindOf(c);
    window.__gpEditCustomerId = id;
    var box = $('gpEditCoopBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gpEditCoopBox';
      var title = document.querySelector('#modal h3');
      if (title && title.parentNode) title.parentNode.insertBefore(box, title.nextSibling);
      else if ($('modalbody')) $('modalbody').insertBefore(box, $('modalbody').firstChild);
    }
    box.innerHTML =
      '<div class="gp-coop-title">مدل همکاری</div>' +
      '<div class="small" style="margin-bottom:8px">عاملین فروش جدا از نمایندگان است. نمایندگان می‌توانند بازاریاب، نماینده یا زیرمجموعه بازاریاب باشند.</div>' +
      '<div class="gp-channel-row">' +
        '<label><input type="radio" name="gpEditChannel" value="agent" style="width:auto"' + (kind === 'agent' ? ' checked' : '') + '> عاملین فروش</label>' +
        '<label><input type="radio" name="gpEditChannel" value="rep" style="width:auto"' + (kind === 'marketer' || kind === 'rep' || kind === 'sub' ? ' checked' : '') + '> نمایندگان</label>' +
      '</div>' +
      '<div id="gpEditRepBox" class="' + (kind === 'agent' || !kind ? 'hidden' : '') + '" style="margin-top:10px">' +
        '<div class="small" style="font-weight:800">نقش نمایندگی</div>' +
        '<select id="gpEditRepRole" style="width:100%;margin-top:8px">' +
          roleOptionsHtml(kind === 'sub' ? 'sub' : kind === 'rep' ? 'rep' : 'marketer', false) +
        '</select>' +
        '<div id="gpEditParentBox" class="' + (kind === 'sub' ? '' : 'hidden') + '">' +
          '<input id="gpEditParentSearch" style="width:100%;margin-top:8px" placeholder="نام بازاریاب را بنویسید">' +
          '<select id="gpEditParent" style="width:100%;margin-top:6px"></select>' +
        '</div>' +
      '</div>';
    fillParents('gpEditParent', c && c.parent_marketer_id, id);
    [].forEach.call(box.querySelectorAll('input[name="gpEditChannel"], #gpEditRepRole'), function (el) {
      el.addEventListener('change', function () {
        var next = readKindFrom('gpEditChannel', 'gpEditRepRole');
        syncRepBoxes(next, 'gpEditRepRole', 'gpEditParentBox');
        if (next === 'sub') fillParents('gpEditParent', $('gpEditParent') && $('gpEditParent').value, id);
        if (next) applyPrices('ep', next);
      });
    });
    if (kind) applyPrices('ep', kind);
  }

  function fillParents(selId, keep, exceptId) {
    var sel = $(selId);
    if (!sel) return;
    var rows = liveCustomers().filter(function (c) {
      if (!c || c.deleted || +c.id === +exceptId) return false;
      return kindOf(c) === 'marketer';
    }).slice(0, 200);
    sel.innerHTML = '<option value="">انتخاب بازاریاب</option>' + rows.map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(keep) ? ' selected' : '') + '>' +
        esc([c.code, c.name, c.company, c.mobile].filter(Boolean).join(' | ')) + '</option>';
    }).join('');
  }

  function wrapEditOpen() {
    if (typeof window.openCustomerEdit !== 'function' || window.openCustomerEdit.__gpStab1) return;
    var base = window.openCustomerEdit;
    window.openCustomerEdit = function (id) {
      var out = base.apply(this, arguments);
      setTimeout(function () { try { paintEditBox(id); } catch (e) {} }, 0);
      setTimeout(function () { try { paintEditBox(id); } catch (e) {} }, 80);
      return out;
    };
    window.openCustomerEdit.__gpStab1 = true;
  }

  function wrapSave() {
    window.saveCustomer = async function (id) {
      try {
        var kind = readKindFrom('gpEditChannel', 'gpEditRepRole');
        if (!kind) throw new Error('مدل همکاری را انتخاب کنید: عاملین فروش یا نمایندگان');
        var parent = 0;
        if (kind === 'sub') {
          parent = $('gpEditParent') ? +$('gpEditParent').value : 0;
          if (!parent) throw new Error('بازاریاب بالادست را انتخاب کنید');
        }
        applyPrices('ep', kind);
        var extra = payloadFromKind(kind, parent);
        var body = Object.assign({
          id: id,
          name: $('ecn').value,
          mobile: $('ecm').value,
          code: $('ecc') ? $('ecc').value : '',
          company: $('ecco').value,
          national_id: $('ecnid').value,
          province: $('ecp').value,
          city: $('ecci').value,
          address: $('eca').value,
          notes: $('ecno').value,
          visible_price_groups: pricesFor(kind)
        }, extra);
        if ($('eCustomerActive')) body.active = $('eCustomerActive').checked;
        var saved = await window.req('/api/customers/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        mergeCustomer(Object.assign({ id: id }, extra, saved || {}));
        if (typeof closeModal === 'function') closeModal();
        toast('مدل همکاری ذخیره شد');
        await lightRefresh();
      } catch (e) {
        alert(e.message);
      }
    };
    window.saveCustomer.__gpStab1 = true;
  }

  function wrapAdd() {
    window.addCustomer = async function () {
      try {
        var kind = readKindFrom('gpChannel', 'gpRepRole');
        if (!kind) throw new Error('مدل همکاری را انتخاب کنید: عاملین فروش یا نمایندگان');
        var channel = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
        if (channel && channel.value === 'rep' && $('gpRepRole') && !$('gpRepRole').value) {
          throw new Error('نقش نمایندگی را انتخاب کنید: بازاریاب، نماینده یا زیرمجموعه');
        }
        var parent = 0;
        if (kind === 'sub') {
          parent = $('gpRepParent') ? +$('gpRepParent').value : 0;
          if (!parent) throw new Error('از پیشنهادها، بازاریاب را انتخاب کنید');
        }
        applyPrices('cp', kind);
        var extra = payloadFromKind(kind, parent);
        var body = Object.assign({
          name: $('cn').value,
          mobile: $('cm').value,
          code: $('cc') ? $('cc').value : '',
          company: $('cco').value,
          national_id: $('cnid').value,
          province: $('cp').value,
          city: $('cci').value,
          address: $('ca').value,
          notes: $('cno').value,
          visible_price_groups: pricesFor(kind),
          active: $('customerActive') ? $('customerActive').checked !== false : true
        }, extra);
        var c = await window.req('/api/customers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if ($('caddmsg')) {
          $('caddmsg').className = 'ok';
          $('caddmsg').textContent = 'مشتری ' + (c && c.name || '') + ' ثبت شد — کد مشتری: ' + ((c && c.code) || '-');
        }
        ['cn', 'cm', 'cco', 'cnid', 'cp', 'cci', 'ca', 'cno', 'gpRepParentSearch'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        document.querySelectorAll('#gpChannelBox input[name="gpChannel"]').forEach(function (r) { r.checked = false; });
        if ($('gpRepRole')) $('gpRepRole').value = '';
        if ($('gpRepBox')) $('gpRepBox').classList.add('hidden');
        mergeCustomer(c);
        await lightRefresh();
      } catch (e) {
        if ($('caddmsg')) {
          $('caddmsg').className = 'msg';
          $('caddmsg').textContent = e.message;
        } else {
          alert(e.message);
        }
      }
    };
    window.addCustomer.__gpStab1 = true;
    if ($('addCustomerBtn')) $('addCustomerBtn').onclick = window.addCustomer;
  }

  function wrapCoopOps() {
    if (typeof window.gpChangeCoop === 'function' && !window.gpChangeCoop.__gpStab1) {
      var base = window.gpChangeCoop;
      window.gpChangeCoop = function (id) {
        base.apply(this, arguments);
        setTimeout(function () {
          var c = typeof customerById === 'function' ? customerById(id) : null;
          fillRoleSelect($('gpOpsRole'), kindOf(c), false);
          var role = $('gpOpsRole');
          var kind = kindOf(c);
          if (role) role.style.display = kind === 'agent' ? 'none' : '';
          [].forEach.call(document.querySelectorAll('input[name="gpOpsChannel"]'), function (r) {
            r.addEventListener('change', function () {
              if ($('gpOpsRole')) $('gpOpsRole').style.display = r.value === 'agent' && r.checked ? 'none' : '';
            });
          });
        }, 0);
      };
      window.gpChangeCoop.__gpStab1 = true;
    }
    window.gpSaveCoop = async function (id) {
      try {
        var kind = readKindFrom('gpOpsChannel', 'gpOpsRole');
        if (!kind) throw new Error('مدل همکاری را انتخاب کنید');
        var extra = payloadFromKind(kind, 0);
        var c = typeof customerById === 'function' ? customerById(id) : {};
        if (kind === 'sub') extra.parent_marketer_id = c.parent_marketer_id || 0;
        extra.visible_price_groups = pricesFor(kind);
        extra.id = id;
        extra.name = c.name;
        extra.mobile = c.mobile;
        var saved = await window.req('/api/customers/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extra)
        });
        mergeCustomer(Object.assign({ id: id }, extra, saved || {}));
        if (typeof closeModal === 'function') closeModal();
        toast('مدل همکاری ذخیره شد');
        await lightRefresh();
      } catch (e) { alert(e.message); }
    };
    window.gpSaveCoop.__gpStab1 = true;
  }

  function decoratePlans() {
    var btn = $('gpNavPlans');
    if (btn) {
      var text = btn.querySelector('.gp-menu-text');
      if (!btn.querySelector('.gp-menu-icon')) {
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
        if (text) btn.insertBefore(svg, text);
        else {
          btn.textContent = '';
          var span = document.createElement('span');
          span.className = 'gp-menu-text';
          span.textContent = PLANS_LABEL;
          btn.appendChild(svg);
          btn.appendChild(span);
          text = span;
        }
      }
      if (text) text.textContent = PLANS_LABEL;
      else if (!btn.querySelector('.gp-menu-text')) btn.textContent = PLANS_LABEL;
    }
    var h = $('salesPlans') && $('salesPlans').querySelector('h3');
    if (h) h.textContent = PLANS_LABEL;
  }

  function paintLegend() {
    var box = $('gpCoopLegend');
    if (!box || box.dataset.gpStab1 === '1') return;
    if (!box.querySelector('i.rep')) {
      var span = document.createElement('span');
      span.innerHTML = '<i class="rep"></i> نماینده';
      box.appendChild(span);
    }
    box.dataset.gpStab1 = '1';
  }

  function relabelKartabl() {
    var body = $('ctbody');
    if (!body) return;
    var byId = {};
    liveCustomers().forEach(function (c) { if (c) byId[c.id] = c; });
    [].forEach.call(body.querySelectorAll('tr'), function (tr) {
      var pick = tr.querySelector('.gp-plan-pick');
      var id = pick ? pick.getAttribute('data-id') : 0;
      var c = byId[id];
      if (!c) return;
      var kind = kindOf(c);
      tr.classList.remove('gp-coop-agent', 'gp-coop-marketer', 'gp-coop-sub', 'gp-coop-rep', 'gp-coop-plain');
      tr.classList.add('gp-coop-' + (kind || 'plain'));
      var badge = tr.querySelector('.gp-coop-badge');
      if (badge && kind) {
        badge.className = 'gp-coop-badge ' + kind;
        badge.textContent = kindLabel(kind);
      } else if (kind && tr.cells[2]) {
        var host = tr.cells[2];
        if (!host.querySelector('.gp-coop-badge')) {
          host.insertAdjacentHTML('afterbegin', '<span class="gp-coop-badge ' + kind + '">' + esc(kindLabel(kind)) + '</span>');
        }
      }
    });
  }

  function relabelReps() {
    var body = $('gpRepsListBody');
    if (!body) return;
    var byCode = {};
    liveCustomers().forEach(function (c) { if (c) byCode[String(c.code || '')] = c; });
    [].forEach.call(body.querySelectorAll('tr'), function (tr) {
      var code = tr.cells[0] ? tr.cells[0].innerText.replace(/\s+/g, '') : '';
      var c = byCode[code];
      if (!c || !tr.cells[2]) return;
      tr.cells[2].textContent = kindLabel(kindOf(c)) || 'نماینده';
    });
    var stats = $('gpRepsListStats');
    if (stats) {
      var reps = liveCustomers().filter(function (c) { return kindOf(c) === 'rep'; }).length;
      if (!stats.querySelector('[data-gp-repstat]')) {
        var node = document.createElement('div');
        node.className = 'gp-people-stat';
        node.setAttribute('data-gp-repstat', '1');
        node.innerHTML = '<span>نماینده</span><b>' + reps.toLocaleString('fa-IR') + '</b>';
        stats.insertBefore(node, stats.firstChild);
      } else {
        var b = stats.querySelector('[data-gp-repstat] b');
        if (b) b.textContent = reps.toLocaleString('fa-IR');
      }
    }
  }

  function wrapRenders() {
    if (typeof window.renderCustomers === 'function' && !window.renderCustomers.__gpStab1) {
      var base = window.renderCustomers;
      window.renderCustomers = function () {
        var out = base.apply(this, arguments);
        try { paintLegend(); relabelKartabl(); } catch (e) {}
        return out;
      };
      window.renderCustomers.__gpStab1 = true;
    }
    if (typeof window.renderPeople === 'function' && !window.renderPeople.__gpStab1) {
      var people = window.renderPeople;
      window.renderPeople = function () {
        var out = people.apply(this, arguments);
        try { relabelReps(); } catch (e) {}
        return out;
      };
      window.renderPeople.__gpStab1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { hardenReq(); } catch (e) {}
    try { hardenPoll(); } catch (e) {}
    try { hardenRefresh(); } catch (e) {}
    try { installAddRoles(); } catch (e) {}
    try { wrapEditOpen(); } catch (e) {}
    try { wrapSave(); } catch (e) {}
    try { wrapAdd(); } catch (e) {}
    try { wrapCoopOps(); } catch (e) {}
    try { decoratePlans(); } catch (e) {}
    try { wrapRenders(); } catch (e) {}
    try { paintLegend(); } catch (e) {}
    try { relabelKartabl(); } catch (e) {}
    try { relabelReps(); } catch (e) {}
  }

  apply();
  [180, 700, 1600, 2800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 50); });
  }
})();
