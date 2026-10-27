/* GP_NAV_RESTRUCTURE_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpNavRestructureV1) return;
  window.__gpNavRestructureV1 = true;

  var STYLE_ID = 'gp-nav-restructure-v1-css';
  var APPLYING = false;
  // Other overlays replace function properties; installation belongs to this module.
  var installedNavigationHooks = Object.create(null);

  function $(id) { return document.getElementById(id); }

  function textOf(el) {
    return String(el && (el.textContent || '')).replace(/\s+/g, ' ').trim();
  }

  function isHidden(el) {
    if (!el) return true;
    if (el.hidden) return true;
    if (el.classList && el.classList.contains('hidden')) return true;
    return el.style && el.style.display === 'none';
  }

  function hideNav(el) {
    if (!el || el.dataset.gpNavKeep === '1') return;
    if (el.classList.contains('gp-nav-retired')) return;
    el.classList.add('hidden', 'gp-nav-retired');
    el.hidden = true;
    el.style.display = 'none';
  }

  function setChildrenOrder(parent, items) {
    if (!parent) return;
    items = items.filter(Boolean);
    var current = [];
    for (var i = 0; i < parent.children.length; i++) {
      if (items.indexOf(parent.children[i]) >= 0) current.push(parent.children[i]);
    }
    var same = current.length === items.length;
    if (same) {
      for (var j = 0; j < items.length; j++) {
        if (current[j] !== items[j]) { same = false; break; }
      }
    }
    if (same) return;
    items.forEach(function (el) { parent.appendChild(el); });
  }

  function hideCard(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.hidden = true;
  }

  function showEl(el) {
    if (!el) return;
    el.classList.remove('hidden', 'gp-nav-retired');
    el.hidden = false;
    if (el.style && el.style.display === 'none') el.style.display = '';
  }

  function setLabel(el, text) {
    if (!el) return;
    var span = el.querySelector('.gp-menu-text');
    if (span) {
      if (span.textContent !== text) span.textContent = text;
      return;
    }
    var icon = el.querySelector('.gp-menu-icon');
    if (icon) {
      var extra = [];
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i] !== icon) extra.push(el.childNodes[i]);
      }
      extra.forEach(function (n) { n.parentNode && n.parentNode.removeChild(n); });
      span = document.createElement('span');
      span.className = 'gp-menu-text';
      span.textContent = text;
      el.appendChild(span);
      return;
    }
    if (el.textContent !== text) el.textContent = text;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.gp-nav-retired{display:none!important}' +
      '#gpAddProductBtn{margin:0 8px 0 0;white-space:nowrap}' +
      '#gpWarehouseProducts{margin-top:12px}' +
      '.gp-placeholder-card{text-align:center;padding:46px 22px}' +
      '.gp-placeholder-card h3{margin:0 0 10px;color:#102a43}' +
      '.gp-placeholder-card p{margin:0;color:#64748b;line-height:1.8}' +
      '.portal-subnav [data-portal-view="offers"],.portal-subnav [data-portal-view="accounts"]{display:none!important}' +
      '#gpCustomers .nav-submenu [data-tab="customers"]:not([data-gp-cview]),' +
      '#gpCustomers .nav-submenu [data-gp-view="accounts"],' +
      '#gpCustomers .nav-submenu [data-gp-view="offers"]{display:none!important}';
    document.head.appendChild(css);
  }

  function grantTabs() {
    if (window.TAB_ACCESS) {
      window.TAB_ACCESS.stocktake = window.TAB_ACCESS.stocktake || window.TAB_ACCESS.reports || ['prep', 'viewer'];
      window.TAB_ACCESS.salesAgents = window.TAB_ACCESS.salesAgents || window.TAB_ACCESS.customers || ['sales', 'viewer'];
      window.TAB_ACCESS.salesReps = window.TAB_ACCESS.salesReps || window.TAB_ACCESS.customers || ['sales', 'viewer'];
    }
    if (typeof window.canViewTab === 'function' && !installedNavigationHooks.canViewTab) {
      var base = window.canViewTab;
      window.canViewTab = function (tab) {
        if (tab === 'stocktake') return base('reports') || base('stocktake');
        if (tab === 'salesAgents' || tab === 'salesReps') return base('customers') || base(tab);
        return base(tab);
      };
      installedNavigationHooks.canViewTab = true;
      window.canViewTab.__gpNavV1 = true;
    }
  }

  function ensureSection(id, html) {
    var sec = $(id);
    if (sec) return sec;
    sec = document.createElement('section');
    sec.id = id;
    sec.className = 'tab hidden';
    sec.innerHTML = html;
    var wrap = document.querySelector('.wrap') || document.getElementById('app') || document.body;
    wrap.appendChild(sec);
    return sec;
  }

  function splitStocktake() {
    var totals = $('stocktakeTotals') || $('stocktakeBody');
    if (!totals) return;
    var card = totals.closest('.card');
    if (!card) return;
    var sec = ensureSection('stocktake', '');
    if (card.parentNode !== sec) sec.appendChild(card);
  }

  function mergePortalIntoKartabl() {
    var customers = $('customers');
    if (!customers) return;
    ['portalAccounts', 'portalRegistrations'].forEach(function (id) {
      var node = $(id);
      if (!node) return;
      var card = node.closest('.card');
      if (!card) return;
      card.classList.remove('portal-admin-panel', 'hidden');
      if (card.dataset) delete card.dataset.portalPanel;
      card.dataset.gpKartabl = '1';
      if (card.parentNode !== customers) customers.appendChild(card);
    });
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
        openNewProduct();
      };
      var title = warehouse.querySelector('.card .section-title') || warehouse.querySelector('.card');
      if (title) title.appendChild(addBtn);
      else warehouse.insertBefore(addBtn, warehouse.firstChild);
    }
    if (typeof has === 'function') addBtn.classList.toggle('hidden', !has('admin'));
    var formAdd = panel.querySelector('button[onclick*="addProduct"]');
    if (formAdd) formAdd.textContent = 'اضافه کردن محصول جدید';
  }

  function openNewProduct() {
    var panel = $('gpWarehouseProducts');
    if (panel) panel.classList.remove('hidden');
    if (typeof renderProducts === 'function') renderProducts();
    var name = $('productName');
    if (name) {
      try { name.focus(); } catch (e) {}
      name.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  window.gpOpenNewProduct = openNewProduct;

  function findCatalog() {
    var exact = document.querySelector('.topnav [data-tab="portalAdmin"][data-gp-view="catalog"]');
    if (exact) return exact;
    var all = document.querySelectorAll('.topnav [data-tab="portalAdmin"]');
    for (var i = 0; i < all.length; i++) {
      var view = all[i].getAttribute('data-gp-view') || '';
      if (view === 'catalog' || /قیمت|موجودی|لیست قیمت/.test(textOf(all[i]))) return all[i];
    }
    return null;
  }

  function ensureCatalog() {
    var btn = findCatalog();
    if (btn) return btn;
    var nav = document.querySelector('.topnav');
    if (!nav) return null;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tab = 'portalAdmin';
    btn.dataset.gpView = 'catalog';
    btn.className = 'adminOnly';
    setLabel(btn, 'قیمت و موجودی');
    btn.onclick = function (ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      openCatalog();
    };
    nav.appendChild(btn);
    return btn;
  }

  function openCatalog() {
    if (typeof canViewTab === 'function' && !canViewTab('portalAdmin')) return;
    window.PORTAL_ADMIN_VIEW = 'catalog';
    if (typeof show === 'function') show('portalAdmin');
    if (typeof portalAdminView === 'function') portalAdminView('catalog');
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function cloneIcon(from) {
    var icon = from && from.querySelector && from.querySelector('.gp-menu-icon');
    return icon ? icon.cloneNode(true) : null;
  }

  function makeItem(id, text, sample) {
    var b = $(id);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      var icon = cloneIcon(sample);
      if (icon) {
        b.appendChild(icon);
        var span = document.createElement('span');
        span.className = 'gp-menu-text';
        span.textContent = text;
        b.appendChild(span);
      } else {
        b.textContent = text;
      }
    } else {
      setLabel(b, text);
    }
    b.dataset.gpNavKeep = '1';
    b.classList.remove('hidden', 'gp-nav-retired');
    b.hidden = false;
    b.style.display = '';
    return b;
  }

  function bindOnce(el, fn) {
    if (!el || el.dataset.gpNavBound === '1') return;
    el.dataset.gpNavBound = '1';
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      fn();
      if (typeof setSidebar === 'function') setSidebar(false);
    });
  }

  function ensureCustomerGroup() {
    var nav = document.querySelector('.topnav');
    if (!nav) return null;
    var g = $('gpCustomers');
    if (!g) {
      g = document.createElement('div');
      g.id = 'gpCustomers';
      g.className = 'nav-group gp-group';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-group-toggle';
      setLabel(toggle, 'مشتریان');
      var chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = '⌄';
      toggle.appendChild(chev);
      var sub = document.createElement('div');
      sub.className = 'nav-submenu';
      sub.id = 'gpCustomers-items';
      toggle.onclick = function (e) {
        e.stopPropagation();
        g.classList.toggle('open');
      };
      g.appendChild(toggle);
      g.appendChild(sub);
      nav.appendChild(g);
    }
    var title = g.querySelector('.nav-group-toggle');
    if (title) setLabel(title, 'مشتریان');
    return g;
  }

  function customerListCard() {
    var body = $('ctbody');
    return body ? body.closest('.card') : null;
  }

  function applyCustomerView() {
    var view = window.GP_CUSTOMER_VIEW || 'kartabl';
    var add = $('customerAddCard');
    var imp = $('customerImportCard');
    var list = customerListCard();
    var accounts = $('portalAccounts') && $('portalAccounts').closest('.card');
    var regs = $('portalRegistrations') && $('portalRegistrations').closest('.card');
    var isAdd = view === 'add';
    if (add) {
      if (isAdd && (typeof has !== 'function' || has('sales'))) showEl(add);
      else hideCard(add);
    }
    if (imp) {
      if (isAdd && (typeof has !== 'function' || has('admin'))) showEl(imp);
      else hideCard(imp);
    }
    if (list) {
      if (isAdd) hideCard(list);
      else showEl(list);
    }
    if (accounts) {
      if (isAdd) hideCard(accounts);
      else showEl(accounts);
    }
    if (regs) {
      if (isAdd) hideCard(regs);
      else showEl(regs);
    }
    if (!isAdd) {
      if (typeof renderCustomers === 'function') renderCustomers();
      if (typeof loadPortalAdmin === 'function' && (typeof has !== 'function' || has('admin'))) loadPortalAdmin();
      if (typeof loadRegistrationRequests === 'function' && (typeof has !== 'function' || has('admin'))) loadRegistrationRequests();
    }
  }

  function showCustomerView(view) {
    window.GP_CUSTOMER_VIEW = view;
    if (view === 'agents') {
      if (typeof show === 'function') show('salesAgents');
      return;
    }
    if (view === 'reps') {
      if (typeof show === 'function') show('salesReps');
      return;
    }
    if (typeof show === 'function') show('customers');
    applyCustomerView();
  }
  window.gpShowCustomerView = showCustomerView;

  function fillCustomerNav() {
    var g = ensureCustomerGroup();
    if (!g) return;
    var sub = g.querySelector('.nav-submenu');
    if (!sub) return;
    var sample = sub.querySelector('[data-tab], [data-gp-view]') || document.querySelector('#warehouseNavGroup .nav-submenu [data-tab]');
    [].forEach.call(sub.querySelectorAll('[data-tab="customers"]:not([data-gp-cview]), [data-gp-view="accounts"], [data-gp-view="offers"]'), hideNav);

    var add = makeItem('gpNavAddCustomer', 'افزودن مشتری جدید', sample);
    add.dataset.tab = 'customers';
    add.dataset.gpCview = 'add';
    bindOnce(add, function () { showCustomerView('add'); });

    var kartabl = makeItem('gpNavKartabl', 'کارتابل مشتریان', sample);
    kartabl.dataset.tab = 'customers';
    kartabl.dataset.gpCview = 'kartabl';
    bindOnce(kartabl, function () { showCustomerView('kartabl'); });

    var agents = makeItem('gpNavAgents', 'عاملین فروش', sample);
    agents.dataset.tab = 'salesAgents';
    bindOnce(agents, function () { showCustomerView('agents'); });

    var reps = makeItem('gpNavReps', 'نمایندگان فروش', sample);
    reps.dataset.tab = 'salesReps';
    bindOnce(reps, function () { showCustomerView('reps'); });

    setChildrenOrder(sub, [add, kartabl, agents, reps].concat(
      [].filter.call(sub.children, function (el) {
        return [add, kartabl, agents, reps].indexOf(el) < 0 && !el.classList.contains('gp-nav-retired');
      })
    ));
  }

  function fillWarehouseNav() {
    var g = $('warehouseNavGroup');
    if (!g) return;
    var sub = g.querySelector('.nav-submenu');
    if (!sub) return;
    var sample = sub.querySelector('[data-tab]');
    var daily = sub.querySelector('[data-tab="warehouseDaily"]');
    var reports = sub.querySelector('[data-tab="reports"]');
    var vault = sub.querySelector('[data-tab="warehouse"]');
    var inventory = sub.querySelector('[data-tab="inventory"]');
    var scan = $('mobileScanBtn');
    var stocktake = $('gpNavStocktake') || sub.querySelector('[data-tab="stocktake"]');
    if (!stocktake) {
      stocktake = makeItem('gpNavStocktake', 'انبارگردانی', sample);
      stocktake.dataset.tab = 'stocktake';
    } else {
      setLabel(stocktake, 'انبارگردانی');
      stocktake.dataset.gpNavKeep = '1';
    }
    bindOnce(stocktake, function () {
      if (typeof show === 'function') show('stocktake');
    });
    if (daily) setLabel(daily, 'تاریخچه و موجودی کالا');
    if (reports) setLabel(reports, 'گزارش خروج');
    if (vault) setLabel(vault, 'انبار سریال');
    [].forEach.call(sub.querySelectorAll('[data-tab="products"]'), hideNav);
    setChildrenOrder(sub, [daily, reports, stocktake, vault, inventory, scan]);
  }

  function hideOffersAndPortalUsers() {
    [].forEach.call(document.querySelectorAll('.topnav [data-gp-view="offers"], .topnav [data-gp-view="accounts"]'), hideNav);
    [].forEach.call(document.querySelectorAll('.portal-subnav [data-portal-view="offers"], .portal-subnav [data-portal-view="accounts"]'), hideNav);
    [].forEach.call(document.querySelectorAll('.topnav [data-tab="products"]'), hideNav);
  }

  function orderTopNav() {
    var nav = document.querySelector('.topnav');
    if (!nav) return;
    var catalog = ensureCatalog();
    if (catalog) {
      catalog.dataset.gpView = 'catalog';
      catalog.dataset.gpNavKeep = '1';
      setLabel(catalog, 'قیمت و موجودی');
      bindOnce(catalog, openCatalog);
    }
    var seq = [
      nav.querySelector('.sidebar-head'),
      nav.querySelector('[data-tab="dashboard"]'),
      $('gpOrders'),
      catalog,
      $('warehouseNavGroup'),
      $('gpCustomers'),
      nav.querySelector('[data-tab="salesReports"]'),
      $('gpSystem'),
      nav.querySelector('.sidebar-footer')
    ].filter(Boolean);
    setChildrenOrder(nav, seq);
  }

  function markActive(t) {
    var catalog = findCatalog();
    if (catalog) catalog.classList.toggle('active', t === 'portalAdmin' && (window.PORTAL_ADMIN_VIEW || 'catalog') === 'catalog');
    var add = $('gpNavAddCustomer');
    var kartabl = $('gpNavKartabl');
    var agents = $('gpNavAgents');
    var reps = $('gpNavReps');
    var view = window.GP_CUSTOMER_VIEW || 'kartabl';
    if (add) add.classList.toggle('active', t === 'customers' && view === 'add');
    if (kartabl) kartabl.classList.toggle('active', t === 'customers' && view !== 'add');
    if (agents) agents.classList.toggle('active', t === 'salesAgents');
    if (reps) reps.classList.toggle('active', t === 'salesReps');
    var stocktake = $('gpNavStocktake');
    if (stocktake) stocktake.classList.toggle('active', t === 'stocktake');
    var wg = $('warehouseNavGroup');
    if (wg) {
      var inWh = ['inventory', 'warehouse', 'reports', 'warehouseDaily', 'stocktake'].indexOf(t) >= 0;
      wg.classList.toggle('has-active', inWh);
    }
    var cg = $('gpCustomers');
    if (cg) cg.classList.toggle('has-active', t === 'customers' || t === 'salesAgents' || t === 'salesReps');
  }

  function afterShow(t) {
    if (t === 'stocktake' && typeof loadStocktake === 'function') loadStocktake();
    if (t === 'warehouse') {
      if (typeof renderProducts === 'function' && (typeof has !== 'function' || has('admin'))) renderProducts();
    }
    if (t === 'customers') applyCustomerView();
    if (t === 'portalAdmin') {
      if (!window.PORTAL_ADMIN_VIEW || window.PORTAL_ADMIN_VIEW === 'accounts' || window.PORTAL_ADMIN_VIEW === 'offers') {
        window.PORTAL_ADMIN_VIEW = 'catalog';
      }
      if (typeof portalAdminView === 'function') portalAdminView(window.PORTAL_ADMIN_VIEW);
    }
    markActive(t);
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || installedNavigationHooks.show) return;
    var base = window.show;
    window.show = function (t) {
      if (t === 'customers' && !window.GP_CUSTOMER_VIEW) window.GP_CUSTOMER_VIEW = 'kartabl';
      var result = base.apply(this, arguments);
      try { afterShow(t); } catch (e) {}
      return result;
    };
    installedNavigationHooks.show = true;
    window.show.__gpNavV1 = true;
  }

  function ensurePlaceholders() {
    ensureSection('salesAgents',
      '<div class="card gp-placeholder-card"><h3>عاملین فروش</h3><p>محتوای این صفحه در ویرایش بعدی اضافه می‌شود.</p></div>');
    ensureSection('salesReps',
      '<div class="card gp-placeholder-card"><h3>نمایندگان فروش</h3><p>محتوای این صفحه در ویرایش بعدی اضافه می‌شود.</p></div>');
  }

  function apply() {
    if (APPLYING) return;
    APPLYING = true;
    try {
      ensureStyle();
      grantTabs();
      ensurePlaceholders();
      splitStocktake();
      mergePortalIntoKartabl();
      installWarehouseProducts();
      hideOffersAndPortalUsers();
      fillWarehouseNav();
      fillCustomerNav();
      orderTopNav();
      wrapShow();
      var open = document.querySelector('.tab:not(.hidden)');
      if (open) markActive(open.id);
    } catch (e) {
    } finally {
      APPLYING = false;
    }
  }

  apply();
  setTimeout(apply, 250);
  setTimeout(apply, 800);
  setTimeout(apply, 1600);
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
