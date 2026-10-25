/* GP_COOP_MODEL_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpCoopModelV1) return;
  window.__gpCoopModelV1 = true;

  var STYLE_ID = 'gp-coop-model-v1-css';

  function $(id) { return document.getElementById(id); }

  function kindOf(c) {
    if (!c) return '';
    var ch = String(c.sales_channel || '').toLowerCase();
    if (ch === 'agent') return 'agent';
    if (ch === 'rep') {
      if (c.parent_marketer_id) return 'sub';
      return 'marketer';
    }
    if (c.is_marketer) return 'marketer';
    if (c.parent_marketer_id) return 'sub';
    return '';
  }

  function pricesFor(kind) {
    if (kind === 'agent') return ['agent', 'panel', 'serial'];
    if (kind === 'marketer' || kind === 'sub') return ['panel', 'serial'];
    return ['agent', 'panel', 'serial'];
  }

  function kindLabel(kind) {
    return kind === 'agent' ? 'عامل فروش' : kind === 'marketer' ? 'بازاریاب' : kind === 'sub' ? 'زیرمجموعه بازاریاب' : '';
  }

  function applyPriceChecks(prefix, kind) {
    var allowed = pricesFor(kind);
    ['agent', 'panel', 'serial'].forEach(function (k) {
      var el = $(prefix + '_' + k);
      if (!el) return;
      var on = allowed.indexOf(k) >= 0;
      el.checked = on;
      el.disabled = !on && k === 'agent' && (kind === 'marketer' || kind === 'sub');
      var lab = el.closest('label');
      if (lab) lab.style.opacity = el.disabled ? '.45' : '';
    });
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#ctbody tr.gp-coop-agent td{background:#d8f5e3!important}' +
      '#ctbody tr.gp-coop-marketer td{background:#ffe0bf!important}' +
      '#ctbody tr.gp-coop-sub td{background:#fff1dd!important}' +
      '#ctbody tr.gp-coop-agent td:first-child{border-right:5px solid #147a3d}' +
      '#ctbody tr.gp-coop-marketer td:first-child{border-right:5px solid #f58220}' +
      '#ctbody tr.gp-coop-sub td:first-child{border-right:5px solid #f5b57a}' +
      '.gp-coop-badge{display:inline-block;margin-right:6px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800}' +
      '.gp-coop-badge.agent{background:#147a3d;color:#fff}' +
      '.gp-coop-badge.marketer{background:#f58220;color:#fff}' +
      '.gp-coop-badge.sub{background:#f5b57a;color:#7a3e00}' +
      '#gpCoopLegend{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}' +
      '#gpCoopLegend span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#334155}' +
      '#gpCoopLegend i{width:14px;height:14px;border-radius:4px;display:inline-block}' +
      '#gpCoopLegend i.agent{background:#d8f5e3;border:1px solid #147a3d}' +
      '#gpCoopLegend i.marketer{background:#ffe0bf;border:1px solid #f58220}' +
      '#gpCoopLegend i.sub{background:#fff1dd;border:1px solid #f5b57a}' +
      '#gpEditCoopBox,#gpChannelBox{margin:0 0 12px;padding:14px 16px;border:2px solid #f58220;background:#fff7ef;border-radius:14px}' +
      '#gpEditCoopBox .gp-coop-title,#gpChannelBox .gp-channel-title{font-weight:900;color:#102a43;margin:0 0 8px}' +
      '#gpEditCoopBox .gp-channel-row{display:flex;flex-wrap:wrap;gap:8px 14px}' +
      '.gp-channel-legacy{display:none!important}';
    document.head.appendChild(css);
  }

  function ensureLegend() {
    var search = $('custSearch');
    if (!search || $('gpCoopLegend')) return;
    var box = document.createElement('div');
    box.id = 'gpCoopLegend';
    box.innerHTML =
      '<span><i class="agent"></i> عاملین فروش</span>' +
      '<span><i class="marketer"></i> بازاریاب</span>' +
      '<span><i class="sub"></i> زیرمجموعه بازاریاب</span>';
    search.parentNode.insertBefore(box, search);
  }

  function hideLegacy(prefix) {
    var isM = $(prefix === 'e' ? 'eIsMarketer' : 'isMarketer');
    var hasM = $(prefix === 'e' ? 'eHasMarketer' : 'hasMarketer');
    [isM, hasM].forEach(function (el) {
      var box = el && (el.closest('label') || el);
      if (box) box.classList.add('gp-channel-legacy');
    });
    var picker = $(prefix === 'e' ? 'eMarketerBox' : 'marketerPicker');
    if (picker) picker.classList.add('gp-channel-legacy');
    var wrap = isM && isM.closest('.mutedbox');
    if (wrap && !wrap.querySelector('#gpChannelBox') && !wrap.querySelector('#gpEditCoopBox')) {
      wrap.classList.add('gp-channel-legacy');
    }
  }

  function parentCandidates(exceptId) {
    return (window.CUST || []).filter(function (c) {
      if (!c || c.deleted || +c.id === +exceptId) return false;
      return !!(c.is_marketer || c.parent_marketer_id || String(c.sales_channel || '').toLowerCase() === 'rep');
    });
  }

  function parentLabel(c) {
    var kind = c.is_marketer ? 'بازاریاب' : 'زیرمجموعه بازاریاب';
    var bits = [c.code, c.name, c.company, c.mobile].filter(Boolean).join(' | ');
    return kind + ' — ' + bits;
  }

  function fillParents(selId, keep, exceptId) {
    var sel = $(selId);
    if (!sel) return;
    var rows = parentCandidates(exceptId).slice(0, 200);
    sel.innerHTML = '<option value="">انتخاب بازاریاب یا زیرمجموعه بازاریاب</option>' +
      rows.map(function (c) {
        return '<option value="' + c.id + '"' + (String(c.id) === String(keep) ? ' selected' : '') + '>' +
          (typeof esc === 'function' ? esc(parentLabel(c)) : parentLabel(c)) + '</option>';
      }).join('');
  }

  function readAddKind() {
    var on = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $('gpRepRole') ? $('gpRepRole').value : '';
    if (role === 'sub') return 'sub';
    if (role === 'marketer') return 'marketer';
    return 'marketer';
  }

  function readEditKind() {
    var on = document.querySelector('#gpEditCoopBox input[name="gpEditChannel"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $('gpEditRepRole') ? $('gpEditRepRole').value : '';
    if (role === 'sub') return 'sub';
    return 'marketer';
  }

  function syncAddPrices() {
    var kind = readAddKind();
    if (kind) applyPriceChecks('cp', kind);
  }

  function syncEditUi() {
    var kind = readEditKind();
    var repBox = $('gpEditRepBox');
    var parentBox = $('gpEditParentBox');
    if (repBox) repBox.classList.toggle('hidden', kind === 'agent' || !kind);
    if (parentBox) parentBox.classList.toggle('hidden', kind !== 'sub');
    if (kind === 'sub') fillParents('gpEditParent', $('gpEditParent') && $('gpEditParent').value, window.__gpEditCustomerId);
    if (kind) applyPriceChecks('ep', kind);
    if ($('eIsMarketer')) $('eIsMarketer').checked = kind === 'marketer';
    if ($('eHasMarketer')) $('eHasMarketer').checked = kind === 'sub';
  }

  function installEditBox(id) {
    if ($('gpEditCoopBox')) {
      syncEditUi();
      return;
    }
    var c = typeof customerById === 'function' ? customerById(id) : null;
    var kind = kindOf(c);
    window.__gpEditCustomerId = id;
    hideLegacy('e');
    var box = document.createElement('div');
    box.id = 'gpEditCoopBox';
    box.innerHTML =
      '<div class="gp-coop-title">مدل همکاری</div>' +
      '<div class="small" style="margin-bottom:8px">بعد از ثبت هم قابل تغییر است. با تغییر مدل، قیمت‌های قابل مشاهده مطابق همان مدل تنظیم می‌شود.</div>' +
      '<div class="gp-channel-row">' +
        '<label><input type="radio" name="gpEditChannel" value="agent" style="width:auto"' + (kind === 'agent' ? ' checked' : '') + '> عاملین فروش</label>' +
        '<label><input type="radio" name="gpEditChannel" value="rep" style="width:auto"' + (kind === 'marketer' || kind === 'sub' ? ' checked' : '') + '> نمایندگان</label>' +
      '</div>' +
      '<div id="gpEditRepBox" class="' + (kind === 'marketer' || kind === 'sub' ? '' : 'hidden') + '" style="margin-top:10px">' +
        '<div class="small" style="font-weight:800">نقش نمایندگی</div>' +
        '<select id="gpEditRepRole" style="width:100%;margin-top:8px">' +
          '<option value="marketer"' + (kind !== 'sub' ? ' selected' : '') + '>بازاریاب</option>' +
          '<option value="sub"' + (kind === 'sub' ? ' selected' : '') + '>زیرمجموعه بازاریاب</option>' +
        '</select>' +
        '<div id="gpEditParentBox" class="' + (kind === 'sub' ? '' : 'hidden') + '">' +
          '<select id="gpEditParent" style="width:100%;margin-top:8px"></select>' +
        '</div>' +
      '</div>';
    var title = document.querySelector('#modal h3');
    if (title && title.parentNode) title.parentNode.insertBefore(box, title.nextSibling);
    else document.getElementById('modalbody').insertBefore(box, document.getElementById('modalbody').firstChild);
    [].forEach.call(box.querySelectorAll('input[name="gpEditChannel"]'), function (r) {
      r.addEventListener('change', syncEditUi);
    });
    if ($('gpEditRepRole')) $('gpEditRepRole').addEventListener('change', syncEditUi);
    fillParents('gpEditParent', c && c.parent_marketer_id, id);
    syncEditUi();
  }

  function wrapAddPrices() {
    if (typeof window.syncChannelUi === 'function' && !window.syncChannelUi.__gpCoop1) {
      var base = window.syncChannelUi;
      /* v3 sync is local; we hook channel radios instead */
    }
    var box = $('gpChannelBox');
    if (box && !box.dataset.gpCoopBound) {
      box.dataset.gpCoopBound = '1';
      [].forEach.call(box.querySelectorAll('input[name="gpChannel"]'), function (r) {
        r.addEventListener('change', syncAddPrices);
      });
      if ($('gpRepRole')) $('gpRepRole').addEventListener('change', syncAddPrices);
    }
    syncAddPrices();
  }

  function wrapRender() {
    if (typeof window.renderCustomers !== 'function' || window.renderCustomers.__gpCoop1) return;
    window.renderCustomers = function () {
      var body = $('ctbody');
      if (!body) return;
      ensureLegend();
      var q = ($('custSearch') && $('custSearch').value || '').trim().toLowerCase();
      var rows = (window.CUST || []).filter(function (c) {
        if (!c || c.deleted) return false;
        if (!q) return true;
        var p = typeof marketerParent === 'function' ? marketerParent(c) : null;
        return [c.code, c.name, c.company, c.mobile, c.city, c.address, p && p.name].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7"><div class="small" style="text-align:center;padding:28px">مشتری‌ای با این جستجو پیدا نشد.</div></td></tr>';
        return;
      }
      body.innerHTML = rows.map(function (c) {
        var kind = kindOf(c);
        var p = typeof marketerParent === 'function' ? marketerParent(c) : null;
        var prices = typeof customerPriceGroups === 'function'
          ? customerPriceGroups(c).map(typeof priceGroupLabel === 'function' ? priceGroupLabel : String).join(' • ')
          : '';
        var badge = kind ? '<span class="gp-coop-badge ' + kind + '">' + kindLabel(kind) + '</span>' : '';
        return '<tr class="gp-coop-' + (kind || 'plain') + '"><td>' + (typeof esc === 'function' ? esc(c.code) : c.code) +
          '</td><td>' + badge + (typeof esc === 'function' ? esc(c.name) : c.name) +
          (p ? '<div class="small">زیرمجموعه: ' + (typeof esc === 'function' ? esc(p.name) : p.name) + '</div>' : '') +
          '<div class="small">' + (typeof esc === 'function' ? esc(prices || 'بدون دسترسی قیمت') : prices) + '</div>' +
          '<button type="button" class="btnlight" style="margin-top:6px;padding:6px 10px" onclick="event.stopPropagation();openCustomerPriceEdit(' + c.id + ')">ویرایش قیمت</button></td><td>' +
          (typeof esc === 'function' ? esc(c.company || '-') : (c.company || '-')) + '</td><td>' +
          (typeof esc === 'function' ? esc(c.mobile) : c.mobile) + '</td><td>' +
          (typeof esc === 'function' ? esc(c.city) : c.city) + '</td><td>' +
          (typeof esc === 'function' ? esc(c.address) : c.address) + '</td><td>' +
          (typeof has !== 'function' || has('sales') ? '<button class="dots-btn" onclick="toggleCustomerMenu(event,' + c.id + ')">⋮</button>' : '-') +
          '</td></tr>';
      }).join('');
    };
    window.renderCustomers.__gpCoop1 = true;
  }

  function wrapAdd() {
    window.addCustomer = async function () {
      try {
        var on = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
        if (!on) throw new Error('نوع مشتری را انتخاب کنید: عاملین فروش یا نمایندگان');
        var kind = readAddKind();
        var isMarketer = kind === 'marketer';
        var parent = 0;
        if (kind === 'sub') {
          parent = $('gpRepParent') ? +$('gpRepParent').value : 0;
          if (!parent) throw new Error('بازاریاب یا زیرمجموعه بازاریاب را از فهرست انتخاب کنید');
        }
        if (on.value === 'rep' && kind !== 'marketer' && kind !== 'sub') {
          throw new Error('نقش نمایندگی را انتخاب کنید');
        }
        applyPriceChecks('cp', kind);
        var c = await req('/api/customers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: $('cn').value,
            mobile: $('cm').value,
            code: $('cc') ? $('cc').value : '',
            company: $('cco').value,
            national_id: $('cnid').value,
            province: $('cp').value,
            city: $('cci').value,
            address: $('ca').value,
            notes: $('cno').value,
            is_marketer: isMarketer,
            parent_marketer_id: parent,
            sales_channel: on.value,
            visible_price_groups: pricesFor(kind)
          })
        });
        $('caddmsg').className = 'ok';
        $('caddmsg').textContent = 'مشتری ' + c.name + ' ثبت شد — کد مشتری: ' + (c.code || '-');
        ['cn', 'cm', 'cc', 'cco', 'cnid', 'cp', 'cci', 'ca', 'cno'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        document.querySelectorAll('#gpChannelBox input[name="gpChannel"]').forEach(function (r) { r.checked = false; });
        if ($('gpRepRole')) $('gpRepRole').value = '';
        if ($('gpRepParent')) $('gpRepParent').value = '';
        ['cp_agent', 'cp_panel', 'cp_serial'].forEach(function (id) {
          if ($(id)) { $(id).checked = true; $(id).disabled = false; }
        });
        await refresh();
      } catch (e) {
        if ($('caddmsg')) {
          $('caddmsg').className = 'msg';
          $('caddmsg').textContent = e.message;
        } else {
          alert(e.message);
        }
      }
    };
    window.addCustomer.__gpCoop1 = true;
    if ($('addCustomerBtn')) $('addCustomerBtn').onclick = window.addCustomer;
  }

  function wrapEdit() {
    if (typeof window.openCustomerEdit === 'function' && !window.openCustomerEdit.__gpCoop1) {
      var baseEdit = window.openCustomerEdit;
      window.openCustomerEdit = function (id) {
        baseEdit.apply(this, arguments);
        try { installEditBox(id); } catch (e) {}
      };
      window.openCustomerEdit.__gpCoop1 = true;
    }
    window.saveCustomer = async function (id) {
      try {
        var on = document.querySelector('#gpEditCoopBox input[name="gpEditChannel"]:checked');
        if (!on) throw new Error('مدل همکاری را انتخاب کنید: عاملین فروش یا نمایندگان');
        var kind = readEditKind();
        var isMarketer = kind === 'marketer';
        var parent = 0;
        if (kind === 'sub') {
          parent = $('gpEditParent') ? +$('gpEditParent').value : 0;
          if (!parent) throw new Error('بازاریاب یا زیرمجموعه بازاریاب را انتخاب کنید');
        }
        var body = {
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
          is_marketer: isMarketer,
          parent_marketer_id: parent,
          sales_channel: on.value,
          visible_price_groups: pricesFor(kind)
        };
        if ($('eCustomerActive')) body.active = $('eCustomerActive').checked;
        await req('/api/customers/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        closeModal();
        toast('مدل همکاری و مشخصات مشتری ذخیره شد');
        await refresh();
      } catch (e) {
        alert(e.message);
      }
    };
    window.saveCustomer.__gpCoop1 = true;
  }

  function wrapRefresh() {
    if (typeof window.refresh === 'function' && !window.refresh.__gpCoop1) {
      var base = window.refresh;
      window.refresh = async function () {
        var out = await base.apply(this, arguments);
        try { if (typeof renderCustomers === 'function') renderCustomers(); } catch (e) {}
        return out;
      };
      window.refresh.__gpCoop1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { hideLegacy(''); } catch (e) {}
    try { wrapAddPrices(); } catch (e) {}
    try { wrapRender(); } catch (e) {}
    try { wrapAdd(); } catch (e) {}
    try { wrapEdit(); } catch (e) {}
    try { wrapRefresh(); } catch (e) {}
    try {
      if ($('customers') && !$('customers').classList.contains('hidden') && typeof renderCustomers === 'function') {
        renderCustomers();
      }
    } catch (e) {}
  }

  apply();
  [250, 800, 1600, 2600].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 80); });
  }
})();
