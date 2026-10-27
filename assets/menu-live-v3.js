/* GP_MENU_LIVE_V3_20261025 */
(function () {
  'use strict';
  if (window.__gpMenuLiveV3) return;
  window.__gpMenuLiveV3 = true;

  var STYLE_ID = 'gp-menu-live-v3-css';
  var APPLYING = false;
  // Other overlays replace function properties; installation belongs to this module.
  var installedNavigationHooks = Object.create(null);

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
    });
    document.querySelectorAll('.topnav [data-tab="portalAdmin"]').forEach(function (b) {
      var t = (b.textContent || '').replace(/\s+/g, ' ');
      if (/لیست قیمت/.test(t)) setMenuText(b, 'قیمت و موجودی');
    });
    if (typeof window.setGpMenuLabel === 'function' && !installedNavigationHooks.setGpMenuLabel) {
      var base = window.setGpMenuLabel;
      window.setGpMenuLabel = function (btn, text) {
        if (btn && btn.getAttribute && btn.getAttribute('data-gp-view') === 'catalog') text = 'قیمت و موجودی';
        if (text === 'لیست قیمت') text = 'قیمت و موجودی';
        return base(btn, text);
      };
      installedNavigationHooks.setGpMenuLabel = true;
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
    if (typeof window.canViewTab === 'function' && !installedNavigationHooks.canViewTab) {
      var base = window.canViewTab;
      window.canViewTab = function (tab) {
        if (tab === 'customerAdd') return base('customers') || base('customerAdd');
        if (tab === 'stocktake') return base('reports') || base('stocktake');
        if (tab === 'salesAgents' || tab === 'salesReps') return base('customers') || base(tab);
        return base(tab);
      };
      installedNavigationHooks.canViewTab = true;
      window.canViewTab.__gpMenu3 = true;
    }
    if (typeof window.applyPermissionVisibility === 'function' && !installedNavigationHooks.applyPermissionVisibility) {
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
      installedNavigationHooks.applyPermissionVisibility = true;
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
    if (typeof window.show === 'function' && !installedNavigationHooks.show) {
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
      installedNavigationHooks.show = true;
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
  // Label is pinned once; a timer here made «قیمت و موجودی» flick…4565 tokens truncated…run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=3500 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/customer-serial-model-dropdown-v3.html" > /tmp/customer-model-dropdown.html 2>/tmp/chrome.log
            if ! grep -Fq 'CUSTOMER_MODELS_V3_PASS' /tmp/customer-model-dropdown.html; then
              grep -o 'CUSTOMER_MODELS_V3_FAIL[^<]*' /tmp/customer-model-dropdown.html || true
              tail -c 1300 /tmp/customer-model-dropdown.html
              exit 1
            fi
            echo "Live model selector updates after async loading at $size"
          done
  # Previously: .github/workflows/test-live-desktop-sidebar-shell-v1.yml
  live-desktop-sidebar-shell-v1:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - name: Validate CSS and repeatable production patch
        shell: bash
        run: |
          set -euo pipefail
          python3 -m py_compile scripts/patch-remove-legacy-desktop-sidebar-shell-v1.py
          python3 -m py_compile scripts/test-live-desktop-sidebar-shell-v1.py
          python3 - <<'PY'
          from pathlib import Path
          css=Path('assets/remove-legacy-desktop-sidebar-shell-v1.css').read_text()
          assert css.count('{')==css.count('}')
          for marker in ('min-width:761px','position:static!important','background:transparent!important',
                         'max-width:0!important','margin:0!important','sidebar-open'):
              assert marker in css,marker
          print("Desktop shell CSS and navigation preservation checks OK")
          PY
          mkdir -p /tmp/built-web
          cp app.html /tmp/built-web/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/built-web
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/built-web
          python3 scripts/patch-nav-morph-v1.py /tmp/built-web
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/built-web
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/built-web
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/built-web
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/built-web
          python3 scripts/patch-warehouse-serial-filters-v1.py /tmp/built-web
          python3 scripts/patch-warehouse-serial-filters-v2.py /tmp/built-web
          python3 scripts/patch-warehouse-serial-filters-v3.py /tmp/built-web
          python3 scripts/patch-customer-serial-counts-v4.py /tmp/built-web
          python3 scripts/patch-customer-model-catalog-v5.py /tmp/built-web
          python3 scripts/patch-remove-legacy-desktop-sidebar-shell-v1.py /tmp/built-web
          cp /tmp/built-web/app.html /tmp/once.html
          python3 scripts/patch-remove-legacy-desktop-sidebar-shell-v1.py /tmp/built-web
          cmp /tmp/once.html /tmp/built-web/app.html
          grep -Fq 'GHADIR_REMOVE_LEGACY_DESKTOP_SIDEBAR_SHELL_V1_20261017' /tmp/once.html
          for marker in 'data-tab="orders"' 'data-tab="inventory"' 'id="logoutbtn"' 'id="inventoryGroups"' 'id="warehouseBody"'; do
            grep -Fq "$marker" /tmp/once.html
          done
      - name: Reproduce screenshot issue using live CSS and verify actual browser geometry
        shell: bash
        run: |
          set -euo pipefail
          curl --retry 3 -fsSL --max-time 30 'https://ghadirpartner.ir/app.html?check=282px' -o /tmp/live-app.html
          python3 scripts/test-live-desktop-sidebar-shell-v1.py /tmp/live-app.html "$GITHUB_WORKSPACE" /tmp/real-live-sidebar-fixture.html
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '900,850' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=3000 \
              --dump-dom file:///tmp/real-live-sidebar-fixture.html > /tmp/live-shell-dom.html 2>/tmp/chrome.log
            if ! grep -Fq 'LEGACY_SHELL_FIXED_PASS' /tmp/live-shell-dom.html; then
              grep -o 'LEGACY_SHELL_FIXED_FAIL[^<]*' /tmp/live-shell-dom.html || true
              tail -c 1400 /tmp/live-shell-dom.html
              exit 1
            fi
            echo "Live deployed CSS: 282px permanent navy shell eliminated at $size, menu retained"
          done
  # Previously: .github/workflows/test-nav-morph-v1.yml
  nav-morph-v1:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Check JS and patch syntax
        run: |
          set -euo pipefail
          node --check assets/nav-morph-v1.js
          python3 -m py_compile scripts/patch-nav-morph-v1.py
          node --check assets/prod-sidebar-controls-v1.js
          node tests/prod-sidebar-controls.test.js
          python3 tests/prod-sidebar-build.py
      - name: Apply and repeat patch without changing existing routes
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p /tmp/menu-ui-test
          cp app.html /tmp/menu-ui-test/app.html
          sha256sum /tmp/menu-ui-test/app.html > /tmp/menu-base.sha
          python3 scripts/patch-nav-morph-v1.py /tmp/menu-ui-test
          cp /tmp/menu-ui-test/app.html /tmp/menu-after.html
          python3 scripts/patch-nav-morph-v1.py /tmp/menu-ui-test
          cmp /tmp/menu-ui-test/app.html /tmp/menu-after.html
          grep -q 'GHADIR_NAV_MORPH_V1_20261017' /tmp/menu-after.html
          grep -q 'nav-morph-v1.css?v=20261017a1' /tmp/menu-after.html
          grep -q 'nav-morph-v1.js?v=20261017a1' /tmp/menu-after.html
          grep -q 'data-tab="orders"' /tmp/menu-after.html
          grep -q 'data-tab="warehouse"' /tmp/menu-after.html
          grep -q 'data-tab="customers"' /tmp/menu-after.html
          grep -q 'id="login"' /tmp/menu-after.html
          grep -q 'navToggle.onclick' /tmp/menu-after.html
          python3 - <<'PY'
          from pathlib import Path
          from html.parser import HTMLParser
          text=Path('/tmp/menu-after.html').read_text()
          assert text.count('GHADIR_NAV_MORPH_V1_20261017')==1
          assert text.count('<script src="/assets/nav-morph-v1.js')==1
          css=Path('assets/nav-morph-v1.css').read_text()
          js=Path('assets/nav-morph-v1.js').read_text()
          assert 'aria-expanded="true"' in css
          assert 'rotate(45deg)' in css and 'rotate(-45deg)' in css
          assert 'sidebar-open' in js and "oldClose.remove()" in js
          print('Navigation morph contract OK')
          PY
  # Previously: .github/workflows/test-order-action-burger-v1.yml
  order-action-burger-v1:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Validate JavaScript CSS and production build
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/order-action-burger-v1.js
          python3 -m py_compile scripts/patch-order-action-burger-v1.py
          python3 - <<'PY'
          from pathlib import Path
          css=Path('assets/order-action-burger-v1.css').read_text()
          js=Path('assets/order-action-burger-v1.js').read_text()
          assert css.count('{')==css.count('}')
          for part in ['#orders .gp-order-burger-wrap .burger','transform:rotate(405deg)',
                       'transform:rotate(-405deg)','visibility:hidden!important']:
            assert part in css,part
          for part in ['toggleOrderMenu','button.click()',"document.getElementById('orders')",
                       "document.body,{childList:true}","new MutationObserver"]:
            assert part in js,part
          assert 'toggleCustomerMenu' not in js
          print('Order action burger is scoped and preserves native order handler')
          PY
          mkdir -p /tmp/order-build
          cp app.html /tmp/order-build/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/order-build
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/order-build
          python3 scripts/patch-nav-morph-v1.py /tmp/order-build
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/order-build
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/order-build
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/order-build
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/order-build
          python3 scripts/patch-warehouse-serial-filters-v1.py /tmp/order-build
          python3 scripts/patch-warehouse-serial-filters-v2.py /tmp/order-build
          python3 scripts/patch-warehouse-serial-filters-v3.py /tmp/order-build
          python3 scripts/patch-customer-serial-counts-v4.py /tmp/order-build
          python3 scripts/patch-customer-model-catalog-v5.py /tmp/order-build
          python3 scripts/patch-remove-legacy-desktop-sidebar-shell-v1.py /tmp/order-build
          python3 scripts/patch-order-action-burger-v1.py /tmp/order-build
          cp /tmp/order-build/app.html /tmp/once.html
          python3 scripts/patch-order-action-burger-v1.py /tmp/order-build
          cmp /tmp/order-build/app.html /tmp/once.html
          grep -Fq 'GHADIR_ORDER_ACTION_BURGER_V1_20261017' /tmp/once.html
          grep -Fq '/assets/order-action-burger-v1.js?v=20261017c2' /tmp/once.html
          grep -Fq '/assets/order-action-burger-v1.css?v=20261017c2' /tmp/once.html
          for marker in 'toggleOrderMenu' 'closeOrderMenus' 'data-tab="orders"' 'data-tab="inventory"' 'id="logoutbtn"'; do
            grep -Fq "$marker" /tmp/once.html
          done
      - name: Browser test action menus in phone and desktop viewports
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for viewport in '390,844' '414,896' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$viewport" --virtual-time-budget=5500 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/order-action-burger-v1.html" > /tmp/order-burger-result.html 2>/tmp/chrome.log
            if ! grep -Fq 'ORDER_ACTION_BURGER_PASS' /tmp/order-burger-result.html; then
              grep -o 'ORDER_ACTION_BURGER_FAIL[^<]*' /tmp/order-burger-result.html || true
              tail -c 1700 /tmp/order-burger-result.html
              exit 1
            fi
            echo "Original order actions + burger-to-X animation, close and paging passed at $viewport"
          done
  # Previously: .github/workflows/test-restore-customer-serials-v2.yml
  restore-customer-serials-v2:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Static validation and compiled production entrypoint
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/warehouse-serial-filters-v2.js
          python3 -m py_compile scripts/patch-warehouse-serial-filters-v2.py
          python3 - <<'PY'
          from pathlib import Path
          css=Path('assets/warehouse-serial-filters-v2.css').read_text()
          js=Path('assets/warehouse-serial-filters-v2.js').read_text()
          assert css.count('{')==css.count('}')
          assert '.gp-nav-fully-closed' in css
          assert 'display:none!important' in css
          assert "invObserver.observe(groups,{childList:true})" in js
          assert "shown=!active || matches(" in js
          assert "new MutationObserver(sync).observe(nav" in js
          print('Customer serial visibility and browser compositor safety rules validated')
          PY
          mkdir -p /tmp/compiled-ui
          cp app.html /tmp/compiled-ui/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/compiled-ui
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/compiled-ui
          python3 scripts/patch-nav-morph-v1.py /tmp/compiled-ui
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/compiled-ui
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/compiled-ui
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/compiled-ui
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/compiled-ui
          python3 scripts/patch-warehouse-serial-filters-v1.py /tmp/compiled-ui
          python3 scripts/patch-warehouse-serial-filters-v2.py /tmp/compiled-ui
          cp /tmp/compiled-ui/app.html /tmp/compiled-once.html
          python3 scripts/patch-warehouse-serial-filters-v2.py /tmp/compiled-ui
          cmp /tmp/compiled-once.html /tmp/compiled-ui/app.html
          for mark in 'id="inventoryGroups"' 'id="warehouseBody"' 'data-tab="customers"' 'id="changePasswordBtn"' 'id="logoutbtn"' 'GHADIR_CUSTOMER_SERIAL_RESTORE_NAV_GHOST_V2_20261017'; do
            grep -Fq "$mark" /tmp/compiled-ui/app.html
          done
          grep -Fq '/assets/warehouse-serial-filters-v2.js?v=20261017f2' /tmp/compiled-ui/app.html
          ! grep -Fq '/assets/warehouse-serial-filters-v1.js?v=20261017f1' /tmp/compiled-ui/app.html
          grep -Fq '/print/warehouse-label?id=' /tmp/compiled-ui/app.html
      - name: "Real browser - customer serial recovery and no dark menu residue"
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,844' '414,896' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=6000 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/restore-customer-serials-v2.html" > /tmp/inventory-nav-v2.html 2>/tmp/chrome.log
            if ! grep -Fq 'SERIALS_NAV_V2_PASS' /tmp/inventory-nav-v2.html; then
              grep -o 'SERIALS_NAV_V2_FAIL[^<]*' /tmp/inventory-nav-v2.html || true
              tail -c 1400 /tmp/inventory-nav-v2.html
              exit 1
            fi
            echo "Customer serials with supplier badges and actual closed sidebar passed at $size"
          done
  # Previously: .github/workflows/test-sidebar-collapse-v3.yml
  sidebar-collapse-v3:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Syntax, CSS specificity, legacy routes and repeatable build
        shell: bash
        run: |
          set -euo pipefail
          python3 -m py_compile scripts/patch-sidebar-collapse-v3.py
          python3 - <<'PY'
          from pathlib import Path
          css=Path("assets/sidebar-collapse-v3.css").read_text()
          assert css.count("{")==css.count("}")
          assert "#app > header .topnav:not(.sidebar-open)" in css
          assert "#app > header .topnav.sidebar-open" in css
          assert "visibility:hidden!important" in css
          assert "visibility:visible!important" in css
          assert "translate3d(110%,0,0)!important" in css
          assert "translate3d(0,0,0)!important" in css
          print("CSS state contract OK")
          PY
          mkdir -p /tmp/built-web
          cp app.html /tmp/built-web/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/built-web
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/built-web
          python3 scripts/patch-nav-morph-v1.py /tmp/built-web
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/built-web
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/built-web
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/built-web
          cp /tmp/built-web/app.html /tmp/collapse-built.html
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/built-web
          cmp /tmp/collapse-built.html /tmp/built-web/app.html
          for marker in 'data-tab="orders"' 'data-tab="warehouse"' 'data-tab="customers"' 'id="changePasswordBtn"' 'id="logoutbtn"' 'GHADIR_LOGIN_STARTUP_SPLASH_V1_20261017'; do
            if [[ "$marker" == 'GHADIR_LOGIN_STARTUP_SPLASH_V1_20261017' ]]; then continue; fi
            grep -Fq "$marker" /tmp/collapse-built.html
          done
          grep -Fq 'GHADIR_DESKTOP_SIDEBAR_COLLAPSE_V3_20261017' /tmp/collapse-built.html
      - name: Regression against intentionally conflicting CSS, real browser
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,844' '390,680' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=6500 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/sidebar-collapse-v3.html" > /tmp/nav-collapse-result.html 2>/tmp/nav-collapse-chrome.log
            if ! grep -Fq 'COLLAPSE_V3_PASS' /tmp/nav-collapse-result.html; then
              grep -o 'COLLAPSE_V3_FAIL[^<]*' /tmp/nav-collapse-result.html || true
              tail -c 1700 /tmp/nav-collapse-result.html
              exit 1
            fi
            echo "Actual panel collapse/expand and animated icon passed at $size"
          done
  # Previously: .github/workflows/test-sidebar-edge-profile-v2.yml
  sidebar-edge-profile-v2:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - name: Check syntax and repeatable compiled-app patch
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/sidebar-edge-profile-v2.js
          python3 -m py_compile scripts/patch-sidebar-edge-profile-v2.py
          python3 - <<'PY'
          from pathlib import Path
          c=Path('assets/sidebar-edge-profile-v2.css').read_text()
          assert c.count('{')==c.count('}')
          assert 'right:calc(min(310px,88vw) - 22px)' in c
          assert 'right:calc(min(330px,88vw) - 22px)' in c
          assert 'position:static!important' in c
          assert '.nav-group.open > .nav-submenu' in c
          assert 'clipped by .topnav{overflow-y:auto}' in c
          print('CSS syntax and profile layout contracts OK')
          PY
          mkdir -p /tmp/sidebar-compiled
          cp app.html /tmp/sidebar-compiled/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/sidebar-compiled
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/sidebar-compiled
          python3 scripts/patch-nav-morph-v1.py /tmp/sidebar-compiled
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/sidebar-compiled
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/sidebar-compiled
          cp /tmp/sidebar-compiled/app.html /tmp/first-build.html
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/sidebar-compiled
          cmp /tmp/sidebar-compiled/app.html /tmp/first-build.html
          grep -Fq 'GHADIR_SIDEBAR_EDGE_PROFILE_USERBOX_V2_20261017' /tmp/first-build.html
          grep -Fq 'data-tab="warehouse"' /tmp/first-build.html
          grep -Fq 'data-tab="orders"' /tmp/first-build.html
          grep -Fq 'id="changePasswordBtn"' /tmp/first-build.html
          grep -Fq 'id="logoutbtn"' /tmp/first-build.html
          grep -Fq '/assets/sidebar-edge-profile-v2.js?v=20261017e1' /tmp/first-build.html
          grep -Fq '/assets/sidebar-edge-profile-v2.css?v=20261017e2' /tmp/first-build.html
      - name: Test real browser interaction at desktop and small mobile sizes
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,844' '390,680' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=5500 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/sidebar-edge-profile-v2.html" > /tmp/sidebar-result.html 2>/tmp/sidebar-chrome.log
            if ! grep -Fq 'RESULT:PASS' /tmp/sidebar-result.html; then
              grep -o 'RESULT:FAIL[^<]*' /tmp/sidebar-result.html || true
              tail -c 1500 /tmp/sidebar-result.html
              exit 1
            fi
            echo "Sidebar edge, removed label, and visible profile actions passed at $size"
          done
  # Previously: .github/workflows/test-sidebar-profile-polish-v1.yml
  sidebar-profile-polish-v1:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
      - name: Static syntax and CSS validation
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/sidebar-profile-polish-v1.js
          python3 -m py_compile scripts/patch-sidebar-profile-polish-v1.py
          python3 - <<'PY'
          from pathlib import Path
          css=Path('assets/sidebar-profile-polish-v1.css').read_text()
          assert css.count('{')==css.count('}')
          assert 'gp-orange-logo' in css and 'gp-profile-trigger' in css
          svg=Path('assets/ghadir-logo-transparent.svg').read_text()
          assert '<rect' not in svg and '<path' in svg
          print('Scoped CSS and transparent orange SVG passed')
          PY
      - name: Verify repeatable patch and all original page sections
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p /tmp/nav-build
          cp app.html /tmp/nav-build/app.html
          python3 scripts/patch-nav-morph-v1.py /tmp/nav-build
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/nav-build
          cp /tmp/nav-build/app.html /tmp/nav-expected.html
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/nav-build
          cmp /tmp/nav-expected.html /tmp/nav-build/app.html
          grep -Fq 'data-tab="orders"' /tmp/nav-build/app.html
          grep -Fq 'data-tab="warehouse"' /tmp/nav-build/app.html
          grep -Fq 'data-tab="customers"' /tmp/nav-build/app.html
          grep -Fq 'id="changePasswordBtn"' /tmp/nav-build/app.html
          grep -Fq 'id="logoutbtn"' /tmp/nav-build/app.html
          grep -Fq 'GHADIR_SIDEBAR_PROFILE_POLISH_V1_20261017' /tmp/nav-build/app.html
      - name: Browser interaction and mobile overlap checks
        shell: bash
        run: |
          set -euo pipefail
          command -v google-chrome || command -v chromium
          mkdir -p /tmp/nav-browser
          python3 - <<'PY'
          from pathlib import Path
          root=Path.cwd().as_uri()
          html="""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
          <style>
          body{margin:0;background:#f5f6f8;font:14px Tahoma}
          #app>header{display:block}
          #app>.nav-overlay{position:fixed;inset:0;background:#0004}
          #app>header .topnav{position:fixed;inset:0 0 0 auto;z-index:135;width:310px;height:100vh;box-sizing:border-box;padding:12px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;background:#0b2948;transform:translateX(105%);transition:transform .24s ease}
          #app>header .topnav.sidebar-open{transform:translateX(0)}
          #app>header .nav-toggle{position:fixed;right:10px;top:10px;z-index:140}
          #app>header .topnav .sidebar-head{display:flex;align-items:center;gap:10px}
          #app>header .topnav .sidebar-head img{width:50px;height:50px;padding:7px;background:#173c65;border:2px solid #e48133;box-shadow:0 2px 9px #0009;border-radius:20px}
          #app>header .topnav button{padding:8px}
          #app>header .topnav .userbox{margin-top:auto}
          </style>
          <link rel="stylesheet" href="ASSETS/nav-morph-v1.css">
          <link rel="stylesheet" href="ASSETS/sidebar-profile-polish-v1.css"></head>
          <body>
          <div id="app"><header><button class="nav-toggle" type="button">☰</button>
          <div class="topnav"><div class="sidebar-head"><div class="logo-frame"><img src="ASSETS/ghadir-logo-transparent.svg"></div><b>قدیر پارتنر</b><button class="sidebar-close" type="button">×</button></div>
          <button type="button">جمع کردن منو</button><button data-tab="dashboard">پیشخوان</button><button data-tab="orders">سفارش‌ها</button>
          <div class="userbox"><span id="who">کاربر آزمایشی</span><button id="changePasswordBtn">تغییر رمز</button><button id="logoutbtn">خروج</button></div></div></header>
          <div class="nav-overlay"></div></div>
          <script>window.passwordEvents=0;window.logoutEvents=0;
          document.getElementById('changePasswordBtn').addEventListener('click',function(){window.passwordEvents++});
          document.getElementById('logoutbtn').addEventListener('click',function(){window.logoutEvents++});</script>
          <script src="ASSETS/nav-morph-v1.js"></script>
          <script src="ASSETS/sidebar-profile-polish-v1.js"></script>
          <div id="contract"></div>
          <script>
          window.addEventListener('load',function(){
            setTimeout(function(){
              try{
                function expect(x,detail){if(!x)throw Error(detail)}
                const nav=document.querySelector('.topnav'),toggle=document.querySelector('.nav-toggle');
                toggle.click();
                expect(nav.classList.contains('sidebar-open'),'Nav does not open');
                expect(toggle.getAttribute('aria-expanded')==='true','Missing open ARIA state');
                expect(document.querySelectorAll('.gp-nav-line').length===3,'Morph icon missing');
                expect(!nav.querySelector('button.gp-sidebar-legacy-close:not([hidden])'),'Duplicate close button visible');
                const head=nav.querySelector('.sidebar-head').getBoundingClientRect();
                const close=toggle.getBoundingClientRect();
                expect(close.bottom<head.top,'Close X overlaps header title/logo');
                const logo=nav.querySelector('.gp-orange-logo');
                expect(logo&&logo.getAttribute('src')==='/assets/ghadir-logo-transparent.svg','Wrong brand mark');
                expect(getComputedStyle(logo).backgroundColor==='rgba(0, 0, 0, 0)','Logo has a background');
                expect(getComputedStyle(logo).borderTopWidth==='0px','Logo has a frame');
                const prof=document.getElementById('gp-profile-trigger');
                expect(prof,'Profile trigger missing');
                expect(document.querySelectorAll('.gp-profile-trigger').length===1,'Multiple profile triggers');
                prof.click();
                expect(prof.getAttribute('aria-expanded')==='true','Profile menu not expanded');
                expect(!document.getElementById('gp-profile-actions').hidden,'Profile actions hidden');
                document.getElementById('changePasswordBtn').click();
                expect(window.passwordEvents===1,'Password handler lost');
                expect(nav.classList.contains('sidebar-open')===false,'Navigation did not close after password');
                toggle.click();prof.click();
                document.getElementById('logoutbtn').click();
                expect(window.logoutEvents===1,'Logout handler lost');
                document.getElementById('contract').textContent='RESULT:PASS';
              }catch(e){document.getElementById('contract').textContent='RESULT:FAIL '+e.message;}
            },150);
          });
          </script></body></html>"""
          Path('/tmp/nav-browser/fixture.html').write_text(html.replace('ASSETS',root+'/assets'))
          PY
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,850' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=5000 \
              --dump-dom "file:///tmp/nav-browser/fixture.html" > /tmp/nav-browser/result.html 2>/tmp/nav-browser/chrome.log
            grep -q 'RESULT:PASS' /tmp/nav-browser/result.html || { tail -c 1200 /tmp/nav-browser/result.html; exit 1; }
            echo "Browser layout + profile actions passed at $size"
          done
  # Previously: .github/workflows/test-sidebar-real-edge-v4.yml
  sidebar-real-edge-v4:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Syntax + safe patch integration
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/sidebar-real-edge-v4.js
          python3 -m py_compile scripts/patch-sidebar-real-edge-v4.py
          python3 - <<'PY'
          from pathlib import Path
          x=Path("assets/sidebar-real-edge-v4.css").read_text()
          assert x.count("{")==x.count("}")
          assert "var(--gp-actual-sidebar-width" in x
          assert "background-color:transparent!important" in x
          y=Path("assets/sidebar-real-edge-v4.js").read_text()
          assert "getBoundingClientRect().width" in y
          assert "ResizeObserver" in y
          print("New CSS/JS interface contract OK")
          PY
          mkdir -p /tmp/web-build
          cp app.html /tmp/web-build/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/web-build
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/web-build
          python3 scripts/patch-nav-morph-v1.py /tmp/web-build
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/web-build
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/web-build
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/web-build
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/web-build
          cp /tmp/web-build/app.html /tmp/once.html
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/web-build
          cmp /tmp/once.html /tmp/web-build/app.html
          for m in 'data-tab="orders"' 'data-tab="warehouse"' 'data-tab="customers"' 'id="changePasswordBtn"' 'id="logoutbtn"' 'GHADIR_SIDEBAR_REAL_EDGE_V4_20261017'; do
            grep -Fq "$m" /tmp/once.html
          done
      - name: Browser geometry at unpredictable drawer widths, mobile and desktop
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,844' '414,896' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=6000 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/sidebar-real-edge-v4.html" > /tmp/real-edge.html 2>/tmp/chrome.log
            if ! grep -Fq 'REAL_EDGE_PASS' /tmp/real-edge.html; then
              grep -o 'REAL_EDGE_FAIL[^<]*' /tmp/real-edge.html || true
              tail -c 1200 /tmp/real-edge.html
              exit 1
            fi
            echo "Real edge docking, no backing plate, and clean close passed at $size"
          done
  # Previously: .github/workflows/test-staff-login-otp.yml
  staff-login-otp:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: Syntax and isolated OTP lifecycle tests
        run: |
          php -l lib/staff-login-otp.php
          php -l tests/staff-login-otp.php
          php tests/staff-login-otp.php
          node --check assets/staff-login-otp.js
  warehouse-ledger-anchor:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: Daily ledger current-anchor and carton serial hydrate
        run: |
          set -euo pipefail
          node --check assets/warehouse-ui-refine-v53438.js
          node tests/warehouse-ledger-anchor.js
          grep -Fq 'GP_LEDGER_CURRENT_ANCHOR_V2_20261017' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'gpRewriteLedgerGridToCurrent' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'gpHydrateCartonSerialsFromInventory' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'warehouse-ui-refine-v53438.js?v=53438ui8' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'GP_WAREHOUSE_SERIALS_FROM_INVENTORY_V3_20261018' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'GP_WHOLESALE_LEDGER_REPORTS_V4_20261018' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'GP_I90_LEDGER_FAMILY_V5_20261018' assets/warehouse-ui-refine-v53438.js
          grep -Fq 'GP_LEDGER_CURRENT_ANCHOR_V2_20261017' .github/workflows/deploy-final-v53438.yml
  # Previously: .github/workflows/test-warehouse-carton-label-restore.yml
  warehouse-carton-label-restore:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Check restored production delivery and JavaScript
        run: |
          set -euo pipefail
          node --check assets/warehouse-carton-multilabel-v53438.js
          python3 - <<'PY'
          from pathlib import Path
          yml=Path('.github/workflows/deploy-final-v53438.yml').read_text()
          script=Path('assets/warehouse-carton-multilabel-v53438.js').read_text()
          assert 'python3 "$GITHUB_WORKSPACE/scripts/patch-remove-selective-carton-label-v1.py"' not in yml
          for marker in (
              '<script src="/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint4"></script>',
              'put "$ROOT/assets/warehouse-carton-multilabel-v53438.js" -o /assets/warehouse-carton-multilabel-v53438.js',
              'get /assets/warehouse-carton-multilabel-v53438.js -o /tmp/livecheck/assets/warehouse-carton-multilabel-v53438.js',
              'node --check /tmp/livecheck/assets/warehouse-carton-multilabel-v53438.js',
              "grep -q 'warehouse-carton-multilabel-v53438.js?v=53438whprint4' /tmp/livecheck/app.html",
          ):
              assert marker in yml, marker
          assert 'GHADIR_WAREHOUSE_LABEL_RESTORE_V2_20261017' in script
          assert '/print/warehouse-label?id=' in script
          print('Warehouse label restoration and deployment integration passed')
          PY
      - name: Test carton label buttons and selections in browser
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for viewport in '390,844' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
              --allow-file-access-from-files --no-first-run --window-size="$viewport" --virtual-time-budget=3000 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/warehouse-carton-label-restore.html" \
              > /tmp/warehouse-print-test.html 2>/tmp/warehouse-print-chrome.log
            if ! grep -Fq 'WAREHOUSE_CARTON_LABEL_RESTORE_PASS' /tmp/warehouse-print-test.html; then
              grep -o 'WAREHOUSE_CARTON_LABEL_RESTORE_FAIL[^<]*' /tmp/warehouse-print-test.html || true
              tail -c 2000 /tmp/warehouse-print-test.html
              exit 1
            fi
            echo "Warehouse carton print regression passed at $viewport"
          done
  # Previously: .github/workflows/test-warehouse-serial-filters-v1.yml
  warehouse-serial-filters-v1:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v5
      - name: Syntax, idempotent build, preserved operations
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/warehouse-serial-filters-v1.js
          python3 -m py_compile scripts/patch-warehouse-serial-filters-v1.py
          python3 - <<'PY'
          from pathlib import Path
          s=Path('assets/warehouse-serial-filters-v1.css').read_text()
          assert s.count('{')==s.count('}')
          assert '#app .nav-overlay:not(.visible)' in s
          assert 'display:none!important' in s
          print('CSS contract OK')
          PY
          mkdir -p /tmp/built
          cp app.html /tmp/built/app.html
          python3 scripts/patch-mobile-ui-v1.py /tmp/built
          python3 scripts/patch-mobile-menu-overlay-v2.py /tmp/built
          python3 scripts/patch-nav-morph-v1.py /tmp/built
          python3 scripts/patch-sidebar-profile-polish-v1.py /tmp/built
          python3 scripts/patch-sidebar-edge-profile-v2.py /tmp/built
          python3 scripts/patch-sidebar-collapse-v3.py /tmp/built
          python3 scripts/patch-sidebar-real-edge-v4.py /tmp/built
          python3 scripts/patch-warehouse-serial-filters-v1.py /tmp/built
          cp /tmp/built/app.html /tmp/before-second-run.html
          python3 scripts/patch-warehouse-serial-filters-v1.py /tmp/built
          cmp /tmp/built/app.html /tmp/before-second-run.html
          for marker in 'id="warehouseBody"' 'id="inventoryGroups"' 'id="changePasswordBtn"' 'id="logoutbtn"' 'data-tab="orders"' 'data-tab="warehouse"' 'چاپ و دانلود یکجای لیبل سریال‌ها' 'GHADIR_WAREHOUSE_SERIAL_FILTERS_GHOST_V1_20261017'; do
            grep -Fq "$marker" /tmp/built/app.html
          done
          grep -Fq '/print/warehouse-label?id=' /tmp/built/app.html
          ! grep -Fq 'GHADIR_WAREHOUSE_SERIAL_FILTERS_GHOST_V1_20261017' index.php
      - name: Browser end-to-end UI filters in desktop and mobile
        shell: bash
        run: |
          set -euo pipefail
          browser="$(command -v google-chrome || command -v chromium)"
          for size in '390,844' '414,896' '1440,900'; do
            "$browser" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run \
              --allow-file-access-from-files --window-size="$size" --virtual-time-budget=5000 \
              --dump-dom "file://$GITHUB_WORKSPACE/tests/warehouse-serial-filters-v1.html" > /tmp/warehouse-filter-result.html 2>/tmp/chrome.log
            if ! grep -Fq 'WAREHOUSE_FILTERS_PASS' /tmp/warehouse-filter-result.html; then
              grep -o 'WAREHOUSE_FILTERS_FAIL[^<]*' /tmp/warehouse-filter-result.html || true
              tail -c 1400 /tmp/warehouse-filter-result.html
              exit 1
            fi
            echo "Warehouse model/date sorting, serial grouping and closed overlay passed at $size"
          done

  production-build-shell-syntax:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: Validate deploy build shell and heredocs
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          src=Path('.github/workflows/deploy-final-v53438.yml').read_text()
          start=src.index('      - name: Build exact V5.3.4.38 + warehouse/returns patch')
          block=src.index('        run: |',start)+len('        run: |')
          end=src.index('\n      - name: Backup live core files',block)
          raw=src[block:end].strip('\n').splitlines()
          assert raw and all(line.startswith('          ') or not line.strip() for line in raw)
          shell='\n'.join(line[10:] if line.strip() else '' for line in raw)+'\n'
          Path('/tmp/production-build-shell.sh').write_text(shell)
          PY
          bash -n /tmp/production-build-shell.sh
          echo 'Production build shell syntax and heredoc delimiters validated'

  warehouse-carton-qr-css-compat:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: Test warehouse label layout CSS variants
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          import tempfile, subprocess, sys
          script=Path('scripts/patch-carton-label-layout-v2.py').resolve()
          for center in ('', '.t-center{height:12mm;}'):
              with tempfile.TemporaryDirectory() as temp:
                  path=Path(temp)/'lib'/'labels-v5348.php'
                  path.parent.mkdir(parents=True)
                  path.write_text('<?php\n'
                    'function gp_carton_ticket_html($c)\n{\n'
                    ' return \'<article class="ticket">old</article>\';\n}\n'
                    'function gp_print_carton_labels_three_up($cartons,$profile)\n{\n'
                    " echo '<style>.qr-mini{width:12mm}.qr-mini img{width:12mm}"
                    +center+"</style>';\n}\n")
                  subprocess.run([sys.executable,str(script),temp],check=True)
                  output=path.read_text()
                  assert 'WAREHOUSE_CARTON_QR_CONTACT_V3_20261012' in output
                  assert output.count('.t-center{')==1,output.count('.t-center{')
                  assert '.t-center{height:32mm;' in output
                  assert '.qr-mini .qr-static{width:32mm;' in output
                  assert 'QR = اطلاعات تماس قدیر پرداخت | بارکد = شماره کارتن' in output
                  assert 'QR و بارکد این لیبل مربوط به شماره کارتن هستند' not in output
                  assert 'width:21mm;height:21mm' not in output
                  subprocess.run([sys.executable,str(script),temp],check=True)
                  assert path.read_text()==output,'rerun modified label template'
          PY


  preswitch-safety-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: Sanitized protected-carton pre-switch classifier and fixtures
        shell: bash
        run: |
          set -euo pipefail
          python3 -m py_compile scripts/preswitch_safety.py scripts/patch-protected-carton-ops-v1.py scripts/patch-retail-transfer-detach-carton-v1.py
          python3 scripts/preswitch_safety.py self-test
          python3 tests/preswitch_workflow_readonly.py
          python3 tests/preswitch_probe_errors.py
          python3 tests/i90_wholesale_audit.py
          python3 tests/i90_preswitch_restore.py
          php -l scripts/i90-preswitch-restore-once.php
          php tests/i90-preswitch-restore-guard.php
          python3 tests/physical-stock-count.py
          python3 scripts/preswitch_safety.py check-fixture tests/fixtures/preswitch_protected_ok.json
          if python3 scripts/preswitch_safety.py check-fixture tests/fixtures/preswitch_protected_mismatch.json; then
            echo 'expected mismatch fixture to fail' >&2
            exit 1
          fi
          python3 scripts/preswitch_safety.py diagnose tests/fixtures/preswitch_protected_ok.json >/tmp/preswitch-diagnose.json
          sudo apt-get update -qq
          sudo apt-get install -y -qq php-cli
          php -l lib/protected-cartons.php
          php tests/protected-carton-ops.php
          php -l lib/preswitch-carton-integrity.php
          php tests/preswitch-carton-integrity.php
          php -l lib/legacy-shipment-reconciliation.php
          php -l scripts/legacy-shipment-reconcile-once.php
          php tests/legacy-shipment-reconciliation.php
          python3 -m py_compile scripts/inline-legacy-shipment-reconciliation.py
          python3 -m py_compile scripts/inline-preswitch-integrity.py
          # Deploy workflow must keep the guard and use the shared classifier (no bypass).
          grep -Fq 'protected_carton_state_mismatch' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'gp_preswitch_allocated_carton_integrity' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'scripts/preswitch_safety.py' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'preswitch_safety.py" classify' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'patch-protected-carton-ops-v1.py' .github/workflows/deploy-final-v53438.yml
          grep -Fq 'ghadir_is_protected_carton_code' scripts/patch-retail-transfer-detach-carton-v1.py
          grep -Fq 'ghadir_protected_should_detach_retail' scripts/patch-protected-carton-ops-v1.py
          ! grep -Fq 'treat a 500 response as pass' .github/workflows/deploy-final-v53438.yml
          echo 'Pre-switch safety classifier and fixtures verified'

  production-build-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v5
      - name: Install release build prerequisites
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq php-cli unzip patch nodejs
      - name: Execute complete production build without touching the server
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          src=Path('.github/workflows/deploy-final-v53438.yml').read_text()
          start=src.index('      - name: Build exact V5.3.4.38 + warehouse/returns patch')
          block=src.index('        run: |',start)+len('        run: |')
          end=src.index('\n      - name: Backup live core files',block)
          lines=src[block:end].strip('\n').splitlines()
          assert all(line.startswith('          ') or not line.strip() for line in lines)
          shell='\n'.join(line[10:] if line.strip() else '' for line in lines)+'\n'
          for name in ('patch-serial-continuation-location.py','patch-order-serial-carton-display.py',
            'patch-warehouse-supplier-qr.py','patch-supplier-canonical-v8.py',
            'patch-purchase-supplier-v9.py','patch-performance-v1.py','patch-staff-login-otp-v1.py'):
              command='python3 "$GITHUB_WORKSPACE/scripts/'+name+'" "$ROOT"'
              diagnostic='\nif grep -Fq SERIAL_CONTINUATION_WAREHOUSE_FIX_20261011 "$ROOT/index.php"; then echo "PRESENT after '+name+'"; else echo "MISSING after '+name+'"; fi'
              assert command in shell,name
              shell=shell.replace(command,command+diagnostic,1)
          Path('/tmp/release-build-integration.sh').write_text(shell)
          PY
          mkdir -p /tmp/release-build-output
          export GITHUB_OUTPUT=/tmp/release-build-output/output
          bash -Eeuo pipefail /tmp/release-build-integration.sh
          grep -q 'GHADIR_PROD_SIDEBAR_CONTROLS_V1_20261023' /tmp/v53438/*/app.html 2>/dev/null || grep -q 'GHADIR_PROD_SIDEBAR_CONTROLS_V1_20261023' /tmp/v53438/app.html
          python3 tests/order-details-v2-patch.py /tmp/v53438
          echo 'Full release build completed without FTP, database, or server access'
