/* GP_CUSTOMER_PRICE_ACCESS_LIVE_V4_20261025 */
(function () {
  'use strict';
  if (window.__gpPriceAccessLiveV4) return;
  window.__gpPriceAccessLiveV4 = true;

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

  window.saveCustomerMenuPrices = async function (id) {
    try {
      await req('/api/customers/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, visible_price_groups: readGroups('mp') }) });
      if (typeof closeCustomerMenus === 'function') closeCustomerMenus();
      toast('دسترسی قیمت ذخیره شد');
      await refresh();
    } catch (e) { alert(e.message); }
  };

  var baseMenu = window.toggleCustomerMenu;
  window.toggleCustomerMenu = function (ev, id) {
    if (typeof baseMenu === 'function') baseMenu(ev, id);
    var menus = document.querySelectorAll('.customer-menu.open');
    var menu = menus.length ? menus[menus.length - 1] : null;
    if (!menu || menu.querySelector('.customer-price-box')) return;
    var extra = menu.querySelector('.customer-price-edit');
    if (extra) extra.remove();
    var c = customerById(id);
    var box = document.createElement('div');
    box.className = 'customer-price-box';
    box.style.cssText = 'padding:8px 10px 10px;margin:6px 0;border:1px solid #edf1f5;border-radius:12px;background:#f8fafc';
    box.innerHTML = '<div class="small" style="font-weight:800">قیمت‌های قابل مشاهده</div>' + groupChecks('mp', groupsOf(c)) + '<button type="button" style="width:100%;margin-top:10px;padding:8px 10px;font-weight:800" onclick="saveCustomerMenuPrices(' + id + ')">ذخیره قیمت</button>';
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    var sep = menu.querySelector('.order-menu-sep');
    if (sep) menu.insertBefore(box, sep);
    else menu.appendChild(box);
    var h = menu.offsetHeight;
    var top = parseFloat(menu.style.top) || 0;
    if (top + h > innerHeight - 8) menu.style.top = Math.max(8, innerHeight - h - 8) + 'px';
  };

  var baseEdit = window.openCustomerEdit;
  window.openCustomerEdit = function (id) {
    if (typeof baseEdit === 'function') baseEdit(id);
    if (document.getElementById('ep_agent')) return;
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
  }
  setTimeout(bind, 400);
  setTimeout(bind, 1200);
})();
