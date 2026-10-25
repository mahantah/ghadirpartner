/* GP_CUSTOMER_PRICE_ACCESS_LIVE_V3_20261025 */
(function () {
  'use strict';
  if (window.__gpPriceAccessLiveV3) return;
  window.__gpPriceAccessLiveV3 = true;

  function groupsOf(c) {
    var raw = c && (c.visible_price_groups || c.price_groups || c.allowed_price_groups);
    if (raw == null) return ['agent', 'panel', 'serial'];
    if (typeof raw === 'string') raw = raw.split(/[,|]/);
    if (!Array.isArray(raw)) return [];
    var map = { agent: 'agent', sales_agent: 'agent', 'عامل فروش': 'agent', panel: 'panel', 'ثبت در پنل': 'panel', serial: 'serial', 'سریال آزاد': 'serial' };
    var out = [];
    raw.forEach(function (x) {
      var k = map[String(x).trim()] || map[String(x).trim().toLowerCase()];
      if (k && out.indexOf(k) < 0) out.push(k);
    });
    return out;
  }
  function groupLabel(k) {
    return ({ agent: 'عامل فروش', panel: 'ثبت در پنل', serial: 'سریال آزاد' })[k] || k;
  }
  function readGroups(prefix) {
    return ['agent', 'panel', 'serial'].filter(function (k) {
      var el = $(prefix + '_' + k);
      return el && el.checked;
    });
  }
  function groupChecks(prefix, selected) {
    return [['agent', 'عامل فروش'], ['panel', 'ثبت در پنل'], ['serial', 'سریال آزاد']].map(function (pair) {
      var k = pair[0], l = pair[1];
      return '<label style="display:flex;gap:8px;align-items:center;font-weight:700;margin-top:6px"><input id="' + prefix + '_' + k + '" type="checkbox" style="width:auto" ' + (selected.indexOf(k) >= 0 ? 'checked' : '') + '> ' + l + '</label>';
    }).join('');
  }
  function isActive(c) {
    if (typeof window.gpCustomerActive === 'function') return window.gpCustomerActive(c);
    return !c || !Object.prototype.hasOwnProperty.call(c, 'active') || !!c.active;
  }

  window.openCustomerPriceEdit = function (id) {
    var c = customerById(id);
    if (!c || !c.id) { alert('مشتری پیدا نشد'); return; }
    modal('<h3>ویرایش قیمت ' + esc(c.name) + '</h3><div class="mutedbox"><div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>' + groupChecks('ep', groupsOf(c)) + '</div><div class="toolbar" style="margin-top:10px"><button onclick="saveCustomerPrices(' + id + ')">ذخیره قیمت</button><button class="btnlight" onclick="openCustomerEdit(' + id + ')">سایر مشخصات</button><button class="btnlight" onclick="closeModal()">بستن</button></div>');
  };
  window.saveCustomerPrices = async function (id) {
    try {
      await req('/api/customers/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, visible_price_groups: readGroups('ep') }) });
      closeModal();
      toast('دسترسی قیمت ذخیره شد');
      await refresh();
    } catch (e) { alert(e.message); }
  };

  var baseRender = window.renderCustomers;
  window.renderCustomers = function () {
    if (typeof baseRender === 'function') baseRender();
    var q = ($('custSearch') && $('custSearch').value || '').trim().toLowerCase();
    if (!$('ctbody')) return;
    $('ctbody').innerHTML = CUST.filter(function (c) {
      return !q || [c.code, c.name, c.company, c.mobile, c.city, c.address, (marketerParent(c) || {}).name, isActive(c) ? 'فعال' : 'غیرفعال'].join(' ').toLowerCase().includes(q);
    }).map(function (c) {
      var p = marketerParent(c), active = isActive(c);
      var prices = groupsOf(c).map(groupLabel).join(' • ') || 'بدون دسترسی قیمت';
      return '<tr class="' + (active ? '' : 'customer-inactive-row') + '"><td><b>' + esc(c.code || '-') + '</b></td><td>' + esc(c.name) + (c.is_marketer ? '<span class="detail-badge" style="margin-right:5px">بازاریاب</span>' : '') + (p ? '<div class="small">زیرمجموعه: ' + esc(p.name) + '</div>' : '') + '<div class="small">' + esc(prices) + '</div><button type="button" class="btnlight" style="margin-top:6px;padding:6px 10px" onclick="event.stopPropagation();openCustomerPriceEdit(' + c.id + ')">ویرایش قیمت</button></td><td>' + esc(c.company || '-') + '</td><td>' + esc(c.mobile || '-') + '</td><td>' + esc(c.city || '-') + '</td><td>' + esc(c.address || '-') + '</td><td><span class="badge ' + (active ? 'customer-active-badge' : 'customer-inactive-badge') + '">' + (active ? 'فعال' : 'غیرفعال') + '</span></td><td>' + (has('sales') ? '<button class="dots-btn" onclick="toggleCustomerMenu(event,' + c.id + ')">⋮</button>' : '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="8">مشتری‌ای پیدا نشد.</td></tr>';
  };

  var baseEdit = window.openCustomerEdit;
  window.openCustomerEdit = function (id) {
    if (typeof baseEdit === 'function') baseEdit(id);
    var box = document.querySelector('#modal .mutedbox');
    if (!box || document.getElementById('ep_agent')) return;
    var c = customerById(id);
    var wrap = document.createElement('div');
    wrap.className = 'mutedbox';
    wrap.style.margin = '0 0 8px';
    wrap.innerHTML = '<div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>' + groupChecks('ep', groupsOf(c));
    var title = document.querySelector('#modal h3');
    if (title && title.parentNode) title.parentNode.insertBefore(wrap, title.nextSibling);
  };

  var baseSave = window.saveCustomer;
  window.saveCustomer = async function (id) {
    try {
      var parent = $('eHasMarketer').checked ? +$('eMarketerSelect').value : 0;
      if ($('eHasMarketer').checked && !parent) throw new Error('بازاریاب را انتخاب کنید');
      var body = { id: id, name: $('ecn').value, mobile: $('ecm').value, company: $('ecco').value, national_id: $('ecnid').value, province: $('ecp').value, city: $('ecci').value, address: $('eca').value, notes: $('ecno').value, is_marketer: $('eIsMarketer').checked, parent_marketer_id: parent, visible_price_groups: readGroups('ep') };
      if ($('eCustomerActive')) body.active = $('eCustomerActive').checked;
      await req('/api/customers/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      closeModal();
      toast('مشتری ویرایش شد');
      await refresh();
    } catch (e) {
      if (typeof baseSave === 'function' && !document.getElementById('ep_agent')) return baseSave(id);
      alert(e.message);
    }
  };

  var baseMenu = window.toggleCustomerMenu;
  window.toggleCustomerMenu = function (ev, id) {
    if (typeof baseMenu === 'function') baseMenu(ev, id);
    var menus = document.querySelectorAll('.customer-menu.open');
    var menu = menus.length ? menus[menus.length - 1] : null;
    if (!menu || menu.querySelector('.customer-price-edit')) return;
    var btn = document.createElement('button');
    btn.className = 'customer-price-edit';
    btn.type = 'button';
    btn.textContent = 'ویرایش قیمت';
    btn.onclick = function () {
      if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
      window.openCustomerPriceEdit(id);
    };
    var sep = menu.querySelector('.order-menu-sep');
    if (sep) menu.insertBefore(btn, sep);
    else menu.insertBefore(btn, menu.firstChild);
  };

  var baseAdd = window.addCustomer;
  window.addCustomer = async function () {
    try {
      var parent = $('hasMarketer').checked ? +$('marketerSelect').value : 0;
      if ($('hasMarketer').checked && !parent) throw new Error('بازاریاب را انتخاب کنید');
      var c = await req('/api/customers/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('cn').value, mobile: $('cm').value, company: $('cco').value, national_id: $('cnid').value, province: $('cp').value, city: $('cci').value, address: $('ca').value, notes: $('cno').value, is_marketer: $('isMarketer').checked, parent_marketer_id: parent, active: $('customerActive') ? $('customerActive').checked !== false : true, visible_price_groups: readGroups('cp') }) });
      $('caddmsg').className = 'ok';
      $('caddmsg').textContent = 'مشتری ' + c.name + ' ثبت شد — کد مشتری: ' + (c.code || '-');
      ['cn', 'cm', 'cco', 'cnid', 'cp', 'cci', 'ca', 'cno', 'marketerSearch'].forEach(function (id) { if ($(id)) $(id).value = ''; });
      if ($('cc')) $('cc').value = '';
      $('isMarketer').checked = false;
      $('hasMarketer').checked = false;
      if ($('customerActive')) $('customerActive').checked = true;
      ['cp_agent', 'cp_panel', 'cp_serial'].forEach(function (id) { if ($(id)) $(id).checked = true; });
      if (typeof toggleMarketerPicker === 'function') toggleMarketerPicker();
      await refresh();
    } catch (e) {
      if (typeof baseAdd === 'function' && !$('cp_agent')) return baseAdd();
      $('caddmsg').className = 'msg';
      $('caddmsg').textContent = e.message;
    }
  };

  function bind() {
    if ($('addCustomerBtn')) $('addCustomerBtn').onclick = window.addCustomer;
    var tab = document.querySelector('.tab:not(.hidden)');
    if (tab && tab.id === 'customers') window.renderCustomers();
  }
  setTimeout(bind, 400);
  setTimeout(bind, 1200);
})();
