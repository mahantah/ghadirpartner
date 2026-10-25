/* GP_MENU_LIVE_V3_20261025 */
(function () {
  'use strict';
  if (window.__gpMenuLiveV3) return;
  window.__gpMenuLiveV3 = true;

  var STYLE_ID = 'gp-menu-live-v3-css';
  var APPLYING = false;

  function $(id) { return document.getElementById(id); }

  function showEl(el) {
    if (!el) return;
    el.classList.remove('hidden', 'gp-nav-retired');
    el.hidden = false;
    if (el.style && el.style.display === 'none') el.style.display = '';
  }

  function hideEl(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.hidden = true;
  }

  function setMenuText(el, text) {
    if (!el) return;
    var span = el.querySelector('.gp-menu-text');
    if (span) {
      if (span.textContent !== text) span.textContent = text;
      return;
    }
    if (el.textContent !== text) el.textContent = text;
  }

  function lockCatalogLabel() {
    document.querySelectorAll('.topnav [data-tab="portalAdmin"][data-gp-view="catalog"]').forEach(function (b) {
      setMenuText(b, 'قیمت و موجودی');
      showEl(b);
    });
    document.querySelectorAll('.topnav [data-tab="portalAdmin"]').forEach(function (b) {
      var t = (b.textContent || '').replace(/\s+/g, ' ');
      if (/لیست قیمت/.test(t)) setMenuText(b, 'قیمت و موجودی');
    });
    if (typeof window.setGpMenuLabel === 'function' && !window.setGpMenuLabel.__gpMenu3) {
      var base = window.setGpMenuLabel;
      window.setGpMenuLabel = function (btn, text) {
        if (btn && btn.getAttribute && btn.getAttribute('data-gp-view') === 'catalog') text = 'قیمت و موجودی';
        if (text === 'لیست قیمت') text = 'قیمت و موجودی';
        return base(btn, text);
      };
      window.setGpMenuLabel.__gpMenu3 = true;
    }
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#customers .card:has(#portalAccounts),' +
      '#customers .card:has(#portalRegistrations),' +
      '#portalAdmin .card:has(#portalAccounts),' +
      '#portalAdmin .card:has(#portalRegistrations),' +
      '#portalAdmin .card:has(#portalOffers){display:none!important}' +
      '#gpChannelBox{margin:0 0 14px;padding:14px 16px;border:2px solid #f58220;background:#fff7ef;border-radius:14px}' +
      '#gpChannelBox .gp-channel-title{font-weight:900;color:#102a43;margin:0 0 8px}' +
      '#gpChannelBox .gp-channel-row{display:flex;flex-wrap:wrap;gap:10px 18px}' +
      '#gpChannelBox label{display:flex;align-items:center;gap:8px;font-weight:800;margin:0;background:#fff;border:1px solid #f0d2b3;border-radius:10px;padding:8px 12px}' +
      '#gpRepBox{margin-top:12px;padding-top:10px;border-top:1px dashed #e2c19a}' +
      '#gpRepParentBox{margin-top:10px}' +
      '.gp-channel-legacy{display:none!important}' +
      '.gp-offers-page-head{margin-bottom:12px}' +
      '#salesAgents .gp-placeholder-card,#salesReps .gp-placeholder-card{display:none!important}' +
      '#gpAddProductBtn{margin:0 8px 0 0;white-space:nowrap}' +
      '#gpWarehouseProducts{margin-top:12px}' +
      '.gp-nav-retired{display:none!important}' +
      '.portal-subnav [data-portal-view="offers"],.portal-subnav [data-portal-view="accounts"]{display:none!important}';
    document.head.appendChild(css);
  }

  function grantTabs() {
    if (window.TAB_ACCESS) {
      window.TAB_ACCESS.customerAdd = window.TAB_ACCESS.customerAdd || window.TAB_ACCESS.customers || ['sales', 'viewer'];
      window.TAB_ACCESS.stocktake = window.TAB_ACCESS.stocktake || window.TAB_ACCESS.reports || ['prep', 'viewer'];
      window.TAB_ACCESS.salesAgents = window.TAB_ACCESS.salesAgents || window.TAB_ACCESS.customers || ['sales', 'viewer'];
      window.TAB_ACCESS.salesReps = window.TAB_ACCESS.salesReps || window.TAB_ACCESS.customers || ['sales', 'viewer'];
    }
    if (typeof window.canViewTab === 'function' && !window.canViewTab.__gpMenu3) {
      var base = window.canViewTab;
      window.canViewTab = function (tab) {
        if (tab === 'customerAdd') return base('customers') || base('customerAdd');
        if (tab === 'stocktake') return base('reports') || base('stocktake');
        if (tab === 'salesAgents' || tab === 'salesReps') return base('customers') || base(tab);
        return base(tab);
      };
      window.canViewTab.__gpMenu3 = true;
    }
    if (typeof window.applyPermissionVisibility === 'function' && !window.applyPermissionVisibility.__gpMenu3) {
      var vis = window.applyPermissionVisibility;
      window.applyPermissionVisibility = function () {
        vis.apply(this, arguments);
        ['gpNavAddCustomer', 'gpNavKartabl', 'gpNavAgents', 'gpNavReps', 'gpNavStocktake'].forEach(function (id) {
          var el = $(id);
          if (!el) return;
          var tab = el.getAttribute('data-tab');
          if (!tab || typeof canViewTab !== 'function' || canViewTab(tab)) showEl(el);
        });
        lockCatalogLabel();
      };
      window.applyPermissionVisibility.__gpMenu3 = true;
    }
  }

  function ensureSection(id, html) {
    var sec = $(id);
    if (sec) return sec;
    sec = document.createElement('section');
    sec.id = id;
    sec.className = 'tab hidden';
    sec.innerHTML = html || '';
    var customers = $('customers');
    if (customers && customers.parentNode) customers.parentNode.appendChild(sec);
    else (document.querySelector('.wrap') || document.body).appendChild(sec);
    return sec;
  }

  function installAddTab() {
    var customers = $('customers');
    var sec = ensureSection('customerAdd', '');
    var add = $('customerAddCard');
    var imp = $('customerImportCard');
    if (add && add.parentNode !== sec) sec.appendChild(add);
    if (imp && imp.parentNode !== sec) sec.appendChild(imp);
    if (add) {
      var h = add.querySelector('h3');
      if (h) h.textContent = 'افزودن مشتری جدید';
      showEl(add);
    }
    if (imp && typeof has === 'function') imp.classList.toggle('hidden', !has('admin'));
    if (customers && add && add.parentNode === customers) customers.removeChild(add);
  }

  function hideLegacyMarketer() {
    var isM = $('isMarketer');
    var hasM = $('hasMarketer');
    var picker = $('marketerPicker');
    [isM, hasM].forEach(function (el) {
      var box = el && (el.closest('label') || el);
      if (box) box.classList.add('gp-channel-legacy');
    });
    if (picker) picker.classList.add('gp-channel-legacy');
    var wrap = isM && isM.closest('.mutedbox');
    if (wrap && !wrap.querySelector('#gpChannelBox')) wrap.classList.add('gp-channel-legacy');
  }

  function readChannel() {
    var on = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
    return on ? on.value : '';
  }

  function parentCandidates(q) {
    q = String(q || '').trim().toLowerCase();
    var list = (window.CUST || []).filter(function (c) {
      if (!c || c.deleted) return false;
      return !!(c.is_marketer || c.parent_marketer_id);
    });
    return list.filter(function (c) {
      if (!q) return true;
      var parent = typeof marketerParent === 'function' ? marketerParent(c) : null;
      var blob = [c.code, c.name, c.company, c.mobile, parent && parent.name].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    }).slice(0, 150);
  }

  function parentLabel(c) {
    var kind = c.is_marketer ? 'بازاریاب' : 'زیرمجموعه بازاریاب';
    var parent = !c.is_marketer && typeof marketerParent === 'function' ? marketerParent(c) : null;
    var extra = parent ? ' — زیرمجموعه ' + (parent.name || parent.code || '') : '';
    var bits = [c.code, c.name, c.company, c.mobile].filter(Boolean).join(' | ');
    return kind + ' — ' + bits + extra;
  }

  function fillRepParents() {
    var sel = $('gpRepParent');
    if (!sel) return;
    var q = $('gpRepParentSearch') ? $('gpRepParentSearch').value : '';
    var keep = sel.value;
    var rows = parentCandidates(q);
    sel.innerHTML = '<option value="">انتخاب بازاریاب یا زیرمجموعه بازاریاب</option>' +
      rows.map(function (c) {
        return '<option value="' + c.id + '"' + (String(c.id) === String(keep) ? ' selected' : '') + '>' +
          (typeof esc === 'function' ? esc(parentLabel(c)) : parentLabel(c)) + '</option>';
      }).join('');
  }

  function syncChannelUi() {
    var channel = readChannel();
    var repBox = $('gpRepBox');
    var parentBox = $('gpRepParentBox');
    var role = $('gpRepRole') ? $('gpRepRole').value : '';
    if (repBox) repBox.classList.toggle('hidden', channel !== 'rep');
    if (parentBox) parentBox.classList.toggle('hidden', channel !== 'rep' || role !== 'sub');
    if (channel === 'rep' && role === 'sub') fillRepParents();
    if ($('isMarketer')) $('isMarketer').checked = channel === 'rep' && role === 'marketer';
    if ($('hasMarketer')) $('hasMarketer').checked = channel === 'rep' && role === 'sub';
  }

  function installChannelUi() {
    var add = $('customerAddCard');
    if (!add) return;
    hideLegacyMarketer();
    var box = $('gpChannelBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gpChannelBox';
      box.innerHTML =
        '<div class="gp-channel-title">این مشتری کدام کانال است؟</div>' +
        '<div class="gp-channel-row">' +
          '<label><input type="radio" name="gpChannel" value="agent" style="width:auto"> عاملین فروش</label>' +
          '<label><input type="radio" name="gpChannel" value="rep" style="width:auto"> نمایندگان</label>' +
        '</div>' +
        '<div id="gpRepBox" class="hidden">' +
          '<div class="small" style="font-weight:800">نقش نمایندگی</div>' +
          '<select id="gpRepRole" style="width:100%;margin-top:8px">' +
            '<option value="">انتخاب کنید</option>' +
            '<option value="marketer">بازاریاب</option>' +
            '<option value="sub">زیرمجموعه بازاریاب</option>' +
          '</select>' +
          '<div id="gpRepParentBox" class="hidden">' +
            '<input id="gpRepParentSearch" style="width:100%;margin-top:8px" placeholder="جستجوی بازاریاب یا زیرمجموعه بازاریاب">' +
            '<select id="gpRepParent" style="width:100%;margin-top:6px"><option value="">انتخاب بازاریاب یا زیرمجموعه بازاریاب</option></select>' +
          '</div>' +
        '</div>';
      var title = add.querySelector('h3');
      if (title && title.nextSibling) add.insertBefore(box, title.nextSibling);
      else add.insertBefore(box, add.firstChild);
    }
    if (!box.dataset.gpBound) {
      box.dataset.gpBound = '1';
      [].forEach.call(box.querySelectorAll('input[name="gpChannel"]'), function (r) {
        r.addEventListener('change', syncChannelUi);
      });
      if ($('gpRepRole')) $('gpRepRole').addEventListener('change', syncChannelUi);
      if ($('gpRepParentSearch')) $('gpRepParentSearch').addEventListener('input', fillRepParents);
    }
    syncChannelUi();
  }

  function readPrice(prefix) {
    if (typeof readPriceGroups === 'function') return readPriceGroups(prefix);
    return ['agent', 'panel', 'serial'].filter(function (k) {
      var el = $(prefix + '_' + k);
      return el && el.checked;
    });
  }

  function resetChannel() {
    [].forEach.call(document.querySelectorAll('#gpChannelBox input[name="gpChannel"]'), function (r) { r.checked = false; });
    if ($('gpRepRole')) $('gpRepRole').value = '';
    if ($('gpRepParent')) $('gpRepParent').value = '';
    if ($('gpRepParentSearch')) $('gpRepParentSearch').value = '';
    syncChannelUi();
  }

  function wrapAddCustomer() {
    if (window.addCustomer && window.addCustomer.__gpMenu3) return;
    window.addCustomer = async function () {
      try {
        var channel = readChannel();
        if (!channel) throw new Error('نوع مشتری را انتخاب کنید: عاملین فروش یا نمایندگان');
        var isMarketer = false;
        var parent = 0;
        if (channel === 'rep') {
          var role = $('gpRepRole') ? $('gpRepRole').value : '';
          if (role === 'marketer') isMarketer = true;
          else if (role === 'sub') {
            parent = $('gpRepParent') ? +$('gpRepParent').value : 0;
            if (!parent) throw new Error('بازاریاب یا زیرمجموعه بازاریاب را از فهرست انتخاب کنید');
          } else {
            throw new Error('نقش نمایندگی را انتخاب کنید');
          }
        }
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
            sales_channel: channel,
            visible_price_groups: readPrice('cp')
          })
        });
        $('caddmsg').className = 'ok';
        $('caddmsg').textContent = 'مشتری ' + c.name + ' ثبت شد — کد مشتری: ' + (c.code || '-');
        ['cn', 'cm', 'cc', 'cco', 'cnid', 'cp', 'cci', 'ca', 'cno'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        ['cp_agent', 'cp_panel', 'cp_serial'].forEach(function (id) {
          if ($(id)) $(id).checked = true;
        });
        resetChannel();
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
    window.addCustomer.__gpMenu3 = true;
    if ($('addCustomerBtn')) $('addCustomerBtn').onclick = window.addCustomer;
  }

  function hidePortalUsers() {
    ['portalAccounts', 'portalRegistrations'].forEach(function (id) {
      var node = $(id);
      var card = node && node.closest('.card');
      if (card) hideEl(card);
    });
    [].forEach.call(document.querySelectorAll('.topnav [data-gp-view="offers"], .topnav [data-gp-view="accounts"]'), hideEl);
    [].forEach.call(document.querySelectorAll('.portal-subnav [data-portal-view="offers"], .portal-subnav [data-portal-view="accounts"]'), hideEl);
  }

  function placeOffers(which) {
    var list = $('portalOffers');
    if (!list) return;
    var card = list.closest('.card');
    if (!card) return;
    var agents = ensureSection('salesAgents', '');
    var reps = ensureSection('salesReps', '');
    [agents, reps].forEach(function (sec) {
      [].forEach.call(sec.querySelectorAll('.gp-placeholder-card'), hideEl);
      if (!sec.querySelector('.gp-offers-page-head')) {
        var head = document.createElement('div');
        head.className = 'card gp-offers-page-head';
        head.innerHTML = sec.id === 'salesAgents'
          ? '<h3 style="margin:0">عاملین فروش</h3><div class="small">طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</div>'
          : '<h3 style="margin:0">نمایندگان فروش</h3><div class="small">طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</div>';
        sec.insertBefore(head, sec.firstChild);
      }
    });
    var host = which === 'reps' ? reps : agents;
    card.classList.remove('hidden', 'portal-admin-panel');
    if (card.dataset) delete card.dataset.portalPanel;
    if (card.parentNode !== host) host.appendChild(card);
    var title = card.querySelector('h3');
    if (title) title.textContent = 'طرح‌های فروش';
    if (typeof loadPortalAdmin === 'function' && !(window.PORTAL_CATALOG && window.PORTAL_CATALOG.length)) {
      loadPortalAdmin().then(function () {
        if (typeof loadPortalOffers === 'function') loadPortalOffers();
      });
    } else if (typeof loadPortalOffers === 'function') {
      loadPortalOffers();
    }
  }

  function splitStocktake() {
    var totals = $('stocktakeTotals') || $('stocktakeBody');
    if (!totals) return;
    var card = totals.closest('.card');
    if (!card) return;
    var sec = ensureSection('stocktake', '');
    if (card.parentNode !== sec) sec.appendChild(card);
  }

  function installWarehouseProducts() {
    var warehouse = $('warehouse');
    var products = $('products');
    if (!warehouse || !products) return;
    var panel = $('gpWarehouseProducts');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'gpWarehouseProducts';
      panel.className = 'hidden';
      warehouse.appendChild(panel);
    }
    while (products.firstChild) panel.appendChild(products.firstChild);
    var addBtn = $('gpAddProductBtn');
    if (!addBtn) {
      addBtn = document.createElement('button');
      addBtn.id = 'gpAddProductBtn';
      addBtn.type = 'button';
      addBtn.className = 'btn2 adminOnly';
      addBtn.textContent = 'اضافه کردن محصول جدید';
      addBtn.onclick = function (ev) {
        if (ev) ev.preventDefault();
        var p = $('gpWarehouseProducts');
        if (p) p.classList.remove('hidden');
        if (typeof renderProducts === 'function') renderProducts();
        var name = $('productName');
        if (name) {
          try { name.focus(); } catch (e) {}
          name.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      var title = warehouse.querySelector('.card .section-title') || warehouse.querySelector('.gp-page-head') || warehouse.querySelector('.card');
      if (title) title.appendChild(addBtn);
      else warehouse.insertBefore(addBtn, warehouse.firstChild);
    }
    if (typeof has === 'function') addBtn.classList.toggle('hidden', !has('admin'));
    var formAdd = panel.querySelector('button[onclick*="addProduct"]');
    if (formAdd) formAdd.textContent = 'اضافه کردن محصول جدید';
  }

  function openCatalog() {
    window.PORTAL_ADMIN_VIEW = 'catalog';
    if (typeof show === 'function') show('portalAdmin');
    if (typeof portalAdminView === 'function') portalAdminView('catalog');
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function interceptNavClick(ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('#gpNavAddCustomer, #gpNavKartabl, #gpNavAgents, #gpNavReps, #gpNavStocktake, [data-gp-cview], .topnav [data-tab="portalAdmin"][data-gp-view="catalog"]');
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    var cview = t.getAttribute('data-gp-cview') || '';
    if (t.id === 'gpNavAddCustomer' || cview === 'add' || t.getAttribute('data-tab') === 'customerAdd') {
      if (typeof show === 'function') show('customerAdd');
    } else if (t.id === 'gpNavKartabl' || cview === 'kartabl') {
      if (typeof show === 'function') show('customers');
    } else if (t.id === 'gpNavAgents' || t.getAttribute('data-tab') === 'salesAgents') {
      if (typeof show === 'function') show('salesAgents');
    } else if (t.id === 'gpNavReps' || t.getAttribute('data-tab') === 'salesReps') {
      if (typeof show === 'function') show('salesReps');
    } else if (t.id === 'gpNavStocktake' || t.getAttribute('data-tab') === 'stocktake') {
      if (typeof show === 'function') show('stocktake');
    } else if (t.getAttribute('data-gp-view') === 'catalog') {
      openCatalog();
    }
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function wrapViews() {
    if (!document.__gpMenu3NavClick) {
      document.__gpMenu3NavClick = true;
      document.addEventListener('click', interceptNavClick, true);
    }
    if (typeof window.show === 'function' && !window.show.__gpMenu3) {
      var baseShow = window.show;
      window.show = function (t) {
        if (t === 'customerAdd' && !$('customerAdd')) installAddTab();
        if ((t === 'salesAgents' || t === 'salesReps') && !$(t)) ensureSection(t, '');
        if (t === 'stocktake' && !$('stocktake')) splitStocktake();
        var result = baseShow.apply(this, arguments);
        try {
          hidePortalUsers();
          lockCatalogLabel();
          if (t === 'customerAdd') {
            if ($('customerAddCard')) showEl($('customerAddCard'));
            if ($('gpNavAddCustomer')) $('gpNavAddCustomer').classList.add('active');
            if ($('gpCustomers')) $('gpCustomers').classList.add('has-active', 'open');
          }
          if (t === 'customers') hidePortalUsers();
          if (t === 'salesAgents') placeOffers('agents');
          if (t === 'salesReps') placeOffers('reps');
          if (t === 'stocktake' && typeof loadStocktake === 'function') loadStocktake();
          if (t === 'warehouse') {
            if (typeof renderProducts === 'function' && (typeof has !== 'function' || has('admin'))) renderProducts();
          }
          if (t === 'portalAdmin') {
            window.PORTAL_ADMIN_VIEW = window.PORTAL_ADMIN_VIEW === 'offers' || window.PORTAL_ADMIN_VIEW === 'accounts'
              ? 'catalog'
              : (window.PORTAL_ADMIN_VIEW || 'catalog');
            if (typeof portalAdminView === 'function') portalAdminView(window.PORTAL_ADMIN_VIEW);
          }
        } catch (e) {}
        return result;
      };
      window.show.__gpMenu3 = true;
    }
  }

  function apply() {
    if (APPLYING) return;
    APPLYING = true;
    try { ensureStyle(); } catch (e) {}
    try { grantTabs(); } catch (e) {}
    try { installAddTab(); } catch (e) {}
    try { hideLegacyMarketer(); } catch (e) {}
    try { installChannelUi(); } catch (e) {}
    try { wrapAddCustomer(); } catch (e) {}
    try { hidePortalUsers(); } catch (e) {}
    try { splitStocktake(); } catch (e) {}
    try { installWarehouseProducts(); } catch (e) {}
    try { wrapViews(); } catch (e) {}
    try { lockCatalogLabel(); } catch (e) {}
    try {
      if ($('salesAgents') && !$('salesAgents').classList.contains('hidden')) placeOffers('agents');
      if ($('salesReps') && !$('salesReps').classList.contains('hidden')) placeOffers('reps');
    } catch (e) {}
    APPLYING = false;
  }

  apply();
  [200, 600, 1200, 2200, 4000].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 80); });
  }
  setInterval(lockCatalogLabel, 400);
  var queued = false;
  if (document.body) {
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        apply();
      }, 180);
    }).observe(document.body, { subtree: true, childList: true });
  }
})();
