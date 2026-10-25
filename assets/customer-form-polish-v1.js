/* GP_CUSTOMER_FORM_POLISH_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpFormPolishV1Boot) return;
  window.__gpFormPolishV1Boot = true;

  var STYLE_ID = 'gp-form-polish-v1-css';
  var PRICE_TITLE = 'تنظیمات مشاهده قیمت‌ها';
  var APPLYING = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function fold(s) {
    return String(s || '')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200c\s]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function customers() {
    return (window.CUST || []).filter(function (c) { return c && !c.deleted; });
  }

  function channelOf(c) {
    if (!c) return '';
    var ch = String(c.sales_channel || '').toLowerCase();
    if (ch === 'agent' || ch === 'rep') return ch;
    if (c.is_marketer || c.parent_marketer_id) return 'rep';
    return '';
  }

  function kindOf(c) {
    var ch = channelOf(c);
    if (ch === 'agent') return 'agent';
    if (c && c.parent_marketer_id) return 'sub';
    if (c && (c.is_marketer || ch === 'rep')) return 'marketer';
    return '';
  }

  function kindLabel(kind) {
    return kind === 'agent' ? 'عامل فروش' : kind === 'marketer' ? 'بازاریاب' : kind === 'sub' ? 'زیرمجموعه بازاریاب' : '';
  }

  function parentOf(c) {
    if (typeof marketerParent === 'function') return marketerParent(c);
    var id = c && c.parent_marketer_id;
    if (!id) return null;
    return customers().filter(function (x) { return +x.id === +id; })[0] || null;
  }

  function pricesFor(kind) {
    if (kind === 'agent') return ['agent', 'panel', 'serial'];
    if (kind === 'marketer' || kind === 'sub') return ['panel', 'serial'];
    return ['agent', 'panel', 'serial'];
  }

  function customerOffers(id) {
    return (window.PORTAL_OFFERS || []).filter(function (o) {
      if (!o) return false;
      if ((o.audience || 'all') === 'all') return true;
      return (o.customer_ids || []).map(Number).indexOf(+id) >= 0;
    });
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gpChannelBox .gp-channel-title,#gpChannelBox .gp-q-hide{display:none!important}' +
      '#gpChannelBox{padding-top:12px}' +
      '#gpRepParent,#eMarketerSelect,#gpEditParent{display:none!important}' +
      '.gp-typeahead{position:relative;margin-top:8px}' +
      '.gp-typeahead input[type="search"],.gp-typeahead input[type="text"]{width:100%}' +
      '.gp-suggest{position:absolute;right:0;left:0;top:calc(100% + 4px);z-index:80;background:#fff;border:1px solid #e2c19a;border-radius:12px;max-height:240px;overflow:auto;box-shadow:0 10px 28px rgba(16,42,67,.14)}' +
      '.gp-suggest button{display:block;width:100%;text-align:right;background:none;border:0;border-bottom:1px solid #f3efe8;padding:9px 12px;font:inherit;cursor:pointer}' +
      '.gp-suggest button:last-child{border-bottom:0}' +
      '.gp-suggest button:hover,.gp-suggest button.active{background:#fff7ef}' +
      '.gp-suggest b{display:block;color:#102a43}' +
      '.gp-suggest span{display:block;color:#64748b;font-size:12px;margin-top:2px}' +
      '.gp-suggest .gp-empty{padding:12px;color:#64748b;text-align:center}' +
      '#cc,#ecc{background:#f4f8fb;font-weight:800;letter-spacing:.3px}' +
      '.gp-people-card{margin-bottom:12px}' +
      '.gp-people-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}' +
      '.gp-people-stat{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:12px;padding:10px 12px}' +
      '.gp-people-stat span{display:block;color:#64748b;font-size:12px;font-weight:700}' +
      '.gp-people-stat b{display:block;margin-top:3px;font-size:22px;color:#102a43}' +
      '.gp-people-empty{text-align:center;padding:36px 16px;color:#64748b;line-height:1.9}' +
      '.gp-people-empty b{display:block;color:#102a43;margin-bottom:6px}' +
      '.gp-offer-chip{display:inline-block;margin:2px 0 0 4px;padding:2px 8px;border-radius:999px;background:#eef4fb;color:#173a59;font-size:11px;font-weight:800}' +
      '.gp-offer-list label{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:10px 12px;border:1px solid #e5ebf2;border-radius:12px;background:#f8fafc}' +
      '#salesAgents .gp-placeholder-card,#salesReps .gp-placeholder-card{display:none!important}' +
      '@media(max-width:720px){.gp-people-stats{grid-template-columns:1fr}}';
    document.head.appendChild(css);
  }

  function stripQuestions() {
    var box = $('gpChannelBox');
    if (!box) return;
    [].forEach.call(box.querySelectorAll('.gp-channel-title, .small, p, h4'), function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/[؟?]/.test(t) || /کدام|سوال|بپرس/.test(t)) el.classList.add('gp-q-hide');
    });
    var title = box.querySelector('.gp-channel-title');
    if (title) title.classList.add('gp-q-hide');
  }

  function renamePriceLabels() {
    var nodes = document.querySelectorAll('#customerAddCard .small, #modal .small, .customer-price-box .small');
    [].forEach.call(nodes, function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === 'قیمت‌های قابل مشاهده در پرتال' || t === 'قیمت‌های قابل مشاهده' || t === 'قیمت های قابل مشاهده در پرتال') {
        el.textContent = PRICE_TITLE;
      }
    });
  }

  function parseCodeNum(code) {
    var s = String(code || '').trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return { prefix: '', n: +s, pad: s.length };
    var m = s.match(/^(.*?)(\d+)$/);
    if (!m) return null;
    return { prefix: m[1], n: +m[2], pad: m[2].length };
  }

  function nextCustomerCode(parentId) {
    var list = customers();
    if (parentId) {
      var parent = list.filter(function (c) { return +c.id === +parentId; })[0];
      if (parent && parent.code) {
        var base = String(parent.code).trim();
        var safe = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('^' + safe + '[-\\/]?(\\d+)$', 'i');
        var max = 0;
        var pad = 2;
        list.forEach(function (c) {
          if (+c.parent_marketer_id !== +parentId) return;
          var m = String(c.code || '').match(re);
          if (m) {
            max = Math.max(max, +m[1]);
            pad = Math.max(pad, m[1].length);
          }
        });
        return base + '-' + String(max + 1).padStart(pad, '0');
      }
    }
    var best = null;
    list.forEach(function (c) {
      var parsed = parseCodeNum(c.code);
      if (!parsed) return;
      if (String(parsed.prefix).toUpperCase() === 'WEB-') return;
      if (!best || parsed.n > best.n) best = parsed;
    });
    if (best) return best.prefix + String(best.n + 1).padStart(best.pad, '0');
    var maxId = 0;
    list.forEach(function (c) { if (+c.id > maxId) maxId = +c.id; });
    return String(maxId + 1);
  }

  function selectedAddParent() {
    return $('gpRepParent') ? String($('gpRepParent').value || '') : '';
  }

  function fillNextCode() {
    var code = $('cc');
    if (!code) return;
    code.readOnly = true;
    var kind = readAddKind();
    var parent = kind === 'sub' ? selectedAddParent() : '';
    var next = nextCustomerCode(parent);
    if (!next) return;
    code.value = next;
    code.placeholder = next;
    code.title = 'کد مشتری جدید: ' + next;
  }

  function matchCustomer(c, q) {
    if (!q) return true;
    var p = parentOf(c);
    var blob = fold([c.code, c.name, c.company, c.mobile, c.city, p && p.name].join(' '));
    return blob.indexOf(q) >= 0;
  }

  function suggestRows(q, exceptId) {
    q = fold(q);
    var rows = customers().filter(function (c) {
      if (+c.id === +exceptId) return false;
      return matchCustomer(c, q);
    });
    rows.sort(function (a, b) {
      var an = fold(a.name || '');
      var bn = fold(b.name || '');
      var aHit = q && an.indexOf(q) === 0 ? 0 : 1;
      var bHit = q && bn.indexOf(q) === 0 ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      var am = a.is_marketer || channelOf(a) === 'rep' ? 0 : 1;
      var bm = b.is_marketer || channelOf(b) === 'rep' ? 0 : 1;
      if (am !== bm) return am - bm;
      return an.localeCompare(bn, 'fa');
    });
    return rows.slice(0, 12);
  }

  function bindTypeahead(searchId, valueId, exceptId) {
    var input = $(searchId);
    var value = $(valueId);
    if (!input || !value) return;
    if (input.dataset.gpTypeahead === '1') return;
    input.dataset.gpTypeahead = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('placeholder', 'نام مشتری را بنویسید تا همان لحظه پیدا شود');
    var wrap = input.closest('.gp-typeahead');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gp-typeahead';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var list = wrap.querySelector('.gp-suggest');
    if (!list) {
      list = document.createElement('div');
      list.className = 'gp-suggest hidden';
      wrap.appendChild(list);
    }
    value.classList.add('hidden');
    value.setAttribute('aria-hidden', 'true');

    function hide() { list.classList.add('hidden'); list.innerHTML = ''; }

    function pick(c) {
      value.value = c.id;
      input.value = c.name || '';
      hide();
      fillNextCode();
    }

    function paint() {
      var rows = suggestRows(input.value, exceptId);
      if (!rows.length) {
        list.innerHTML = '<div class="gp-empty">مشتری هم‌نام پیدا نشد</div>';
        list.classList.remove('hidden');
        value.value = '';
        return;
      }
      list.innerHTML = rows.map(function (c) {
        var bits = [c.code, c.company, c.mobile].filter(Boolean).join(' | ');
        var kind = kindLabel(kindOf(c));
        return '<button type="button" data-id="' + c.id + '"><b>' + esc(c.name || '-') +
          (kind ? ' — ' + esc(kind) : '') + '</b><span>' + esc(bits || 'بدون کد') + '</span></button>';
      }).join('');
      list.classList.remove('hidden');
    }

    input.addEventListener('input', function () {
      value.value = '';
      paint();
      fillNextCode();
    });
    input.addEventListener('focus', function () {
      paint();
    });
    list.addEventListener('mousedown', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('button[data-id]');
      if (!btn) return;
      ev.preventDefault();
      var c = customers().filter(function (x) { return String(x.id) === String(btn.getAttribute('data-id')); })[0];
      if (c) pick(c);
    });
    input.addEventListener('blur', function () {
      setTimeout(hide, 150);
    });
    if (value.value) {
      var cur = customers().filter(function (c) { return String(c.id) === String(value.value); })[0];
      if (cur && !input.value) input.value = cur.name || '';
    }
  }

  function installAddTypeahead() {
    var parentBox = $('gpRepParentBox');
    var sel = $('gpRepParent');
    var search = $('gpRepParentSearch');
    if (!parentBox || !sel) return;
    if (!search) {
      search = document.createElement('input');
      search.id = 'gpRepParentSearch';
      parentBox.insertBefore(search, sel);
    }
    bindTypeahead('gpRepParentSearch', 'gpRepParent');
  }

  function installEditTypeahead(id) {
    var box = $('gpEditParentBox') || $('eMarketerBox');
    if (!box) return;
    var sel = $('gpEditParent') || $('eMarketerSelect');
    if (!sel) return;
    if (!sel.id) sel.id = 'gpEditParent';
    var search = $('gpEditParentSearch');
    if (!search) {
      search = document.createElement('input');
      search.id = 'gpEditParentSearch';
      search.style.width = '100%';
      box.insertBefore(search, sel);
    }
    bindTypeahead('gpEditParentSearch', sel.id, id);
    var c = typeof customerById === 'function' ? customerById(id) : null;
    var p = c && parentOf(c);
    if (p) {
      sel.value = p.id;
      search.value = p.name || '';
    }
  }

  function readAddKind() {
    var on = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
    if (!on) return '';
    if (on.value === 'agent') return 'agent';
    var role = $('gpRepRole') ? $('gpRepRole').value : '';
    if (role === 'sub') return 'sub';
    return 'marketer';
  }

  function applyPriceChecks(prefix, kind) {
    var allowed = pricesFor(kind);
    ['agent', 'panel', 'serial'].forEach(function (k) {
      var el = $(prefix + '_' + k);
      if (!el) return;
      el.checked = allowed.indexOf(k) >= 0;
    });
  }

  function wrapAdd() {
    window.addCustomer = async function () {
      try {
        var on = document.querySelector('#gpChannelBox input[name="gpChannel"]:checked');
        if (!on) throw new Error('مدل همکاری را انتخاب کنید');
        var kind = readAddKind();
        var isMarketer = kind === 'marketer';
        var parent = 0;
        if (kind === 'sub') {
          parent = $('gpRepParent') ? +$('gpRepParent').value : 0;
          if (!parent) throw new Error('از پیشنهادهای همان کادر، نام مشتری را انتخاب کنید');
        }
        if (on.value === 'rep' && $('gpRepRole') && !$('gpRepRole').value) {
          throw new Error('نقش نمایندگی را انتخاب کنید');
        }
        applyPriceChecks('cp', kind);
        fillNextCode();
        var c = await req('/api/customers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: $('cn').value,
            mobile: $('cm').value,
            code: $('cc') ? $('cc').value : nextCustomerCode(parent),
            company: $('cco').value,
            national_id: $('cnid').value,
            province: $('cp').value,
            city: $('cci').value,
            address: $('ca').value,
            notes: $('cno').value,
            is_marketer: isMarketer,
            parent_marketer_id: parent,
            sales_channel: on.value,
            visible_price_groups: pricesFor(kind),
            active: $('customerActive') ? $('customerActive').checked !== false : true
          })
        });
        $('caddmsg').className = 'ok';
        $('caddmsg').textContent = 'مشتری ' + c.name + ' ثبت شد — کد مشتری: ' + (c.code || '-');
        ['cn', 'cm', 'cco', 'cnid', 'cp', 'cci', 'ca', 'cno', 'gpRepParentSearch'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        if ($('gpRepParent')) $('gpRepParent').value = '';
        document.querySelectorAll('#gpChannelBox input[name="gpChannel"]').forEach(function (r) { r.checked = false; });
        if ($('gpRepRole')) $('gpRepRole').value = '';
        if ($('gpRepBox')) $('gpRepBox').classList.add('hidden');
        if ($('gpRepParentBox')) $('gpRepParentBox').classList.add('hidden');
        await refresh();
        fillNextCode();
        renderPeople();
      } catch (e) {
        if ($('caddmsg')) {
          $('caddmsg').className = 'msg';
          $('caddmsg').textContent = e.message;
        } else {
          alert(e.message);
        }
      }
    };
    window.addCustomer.__gpPolish1 = true;
    if ($('addCustomerBtn')) $('addCustomerBtn').onclick = window.addCustomer;
  }

  function wrapEdit() {
    if (typeof window.openCustomerEdit === 'function' && !window.openCustomerEdit.__gpPolish1) {
      var base = window.openCustomerEdit;
      window.openCustomerEdit = function (id) {
        base.apply(this, arguments);
        try {
          renamePriceLabels();
          installEditTypeahead(id);
        } catch (e) {}
      };
      window.openCustomerEdit.__gpPolish1 = true;
    }
    if (typeof window.saveCustomer === 'function' && !window.saveCustomer.__gpPolish1) {
      var baseSave = window.saveCustomer;
      window.saveCustomer = async function (id) {
        var parentSel = $('gpEditParent') || $('eMarketerSelect');
        if (parentSel && $('gpEditParentSearch') && !parentSel.value && $('gpEditRepRole') && $('gpEditRepRole').value === 'sub') {
          alert('از پیشنهادهای همان کادر، نام مشتری را انتخاب کنید');
          return;
        }
        return baseSave.apply(this, arguments);
      };
      window.saveCustomer.__gpPolish1 = true;
    }
  }

  function ensureSection(id) {
    var sec = $(id);
    if (sec) return sec;
    sec = document.createElement('section');
    sec.id = id;
    sec.className = 'tab hidden';
    var customersSec = $('customers');
    if (customersSec && customersSec.parentNode) customersSec.parentNode.appendChild(sec);
    else (document.querySelector('.wrap') || document.body).appendChild(sec);
    return sec;
  }

  function ensurePeopleCard(secId, cardId, title, hint) {
    var sec = ensureSection(secId);
    var card = $(cardId);
    if (!card) {
      card = document.createElement('div');
      card.id = cardId;
      card.className = 'card gp-people-card';
      var head = sec.querySelector('.gp-offers-page-head');
      if (head && head.nextSibling) sec.insertBefore(card, head.nextSibling);
      else if (head) head.after(card);
      else sec.insertBefore(card, sec.firstChild);
    }
    if (!card.dataset.gpPolish) {
      card.dataset.gpPolish = '1';
      card.innerHTML =
        '<div class="section-title"><div><h3 style="margin:0">' + title + '</h3>' +
        '<div class="small">' + hint + '</div></div></div>' +
        '<div class="gp-people-stats" id="' + cardId + 'Stats"></div>' +
        '<input id="' + cardId + 'Search" placeholder="جستجو با نام، کد، موبایل یا شرکت" style="width:100%;margin-bottom:10px">' +
        '<div class="tablewrap"><table><thead id="' + cardId + 'Head"></thead>' +
        '<tbody id="' + cardId + 'Body"></tbody></table></div>';
      var search = $(cardId + 'Search');
      if (search) search.addEventListener('input', renderPeople);
    }
    return card;
  }

  function offerText(id) {
    var rows = customerOffers(id);
    if (!rows.length) return '<span class="small">بدون طرح اختصاصی</span>';
    return rows.slice(0, 4).map(function (o) {
      return '<span class="gp-offer-chip">' + esc(o.title || 'طرح') + '</span>';
    }).join('');
  }

  function rowActions(c) {
    if (typeof has === 'function' && !has('sales') && !has('admin')) return '-';
    return '<button class="btnlight" type="button" onclick="openCustomerEdit(' + c.id + ')">ویرایش</button> ' +
      '<button class="btn2" type="button" onclick="gpAssignCustomerOffers(' + c.id + ')">تخصیص طرح و آفر</button>';
  }

  function renderTable(kind) {
    var isAgent = kind === 'agent';
    var cardId = isAgent ? 'gpAgentsList' : 'gpRepsList';
    ensurePeopleCard(
      isAgent ? 'salesAgents' : 'salesReps',
      cardId,
      isAgent ? 'مشتری‌های عامل فروش' : 'مشتری‌های نمایندگان فروش',
      isAgent
        ? 'همین‌جا ویرایش کنید و طرح یا آفر را به هر عامل بدهید.'
        : 'بازاریاب‌ها و زیرمجموعه‌ها اینجا ویرایش و به طرح یا آفر وصل می‌شوند.'
    );
    var all = customers().filter(function (c) { return channelOf(c) === kind; });
    if (!isAgent) {
      all = customers().filter(function (c) { return channelOf(c) === 'rep'; });
    }
    var q = fold($(cardId + 'Search') && $(cardId + 'Search').value);
    var shown = all.filter(function (c) { return matchCustomer(c, q); });
    var stats = $(cardId + 'Stats');
    if (stats) {
      if (isAgent) {
        stats.innerHTML =
          '<div class="gp-people-stat"><span>عاملین</span><b>' + all.length.toLocaleString('fa-IR') + '</b></div>' +
          '<div class="gp-people-stat"><span>نمایش فعلی</span><b>' + shown.length.toLocaleString('fa-IR') + '</b></div>' +
          '<div class="gp-people-stat"><span>طرح‌های فعال</span><b>' + ((window.PORTAL_OFFERS || []).filter(function (o) { return o.active; }).length).toLocaleString('fa-IR') + '</b></div>';
      } else {
        stats.innerHTML =
          '<div class="gp-people-stat"><span>بازاریاب</span><b>' + all.filter(function (c) { return !c.parent_marketer_id; }).length.toLocaleString('fa-IR') + '</b></div>' +
          '<div class="gp-people-stat"><span>زیرمجموعه</span><b>' + all.filter(function (c) { return !!c.parent_marketer_id; }).length.toLocaleString('fa-IR') + '</b></div>' +
          '<div class="gp-people-stat"><span>نمایش فعلی</span><b>' + shown.length.toLocaleString('fa-IR') + '</b></div>';
      }
    }
    var head = $(cardId + 'Head');
    if (head) {
      head.innerHTML = isAgent
        ? '<tr><th>کد</th><th>نام</th><th>شرکت</th><th>موبایل</th><th>طرح و آفر</th><th>عملیات</th></tr>'
        : '<tr><th>کد</th><th>نام</th><th>نقش</th><th>بالادست</th><th>طرح و آفر</th><th>عملیات</th></tr>';
    }
    var body = $(cardId + 'Body');
    if (!body) return;
    if (!shown.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="gp-people-empty"><b>' +
        (isAgent ? 'عامل فروشی در این فهرست نیست' : 'نماینده‌ای در این فهرست نیست') +
        '</b>از «افزودن مشتری جدید» مدل همکاری را انتخاب کنید. بعد از ثبت، همان مشتری اینجا می‌آید.</div></td></tr>';
      return;
    }
    body.innerHTML = shown.map(function (c) {
      if (isAgent) {
        return '<tr><td><b>' + esc(c.code || '-') + '</b></td><td>' + esc(c.name || '-') +
          '</td><td>' + esc(c.company || '-') + '</td><td>' + esc(c.mobile || '-') +
          '</td><td>' + offerText(c.id) + '</td><td>' + rowActions(c) + '</td></tr>';
      }
      var p = parentOf(c);
      return '<tr><td><b>' + esc(c.code || '-') + '</b></td><td>' + esc(c.name || '-') +
        '</td><td>' + esc(kindLabel(kindOf(c)) || 'نماینده') + '</td><td>' +
        esc(p ? ((p.code || '') + ' ' + (p.name || '')).trim() : '—') +
        '</td><td>' + offerText(c.id) + '</td><td>' + rowActions(c) + '</td></tr>';
    }).join('');
  }

  function renderPeople() {
    renderTable('agent');
    renderTable('rep');
  }

  async function ensureOffers() {
    if (window.PORTAL_OFFERS && window.PORTAL_OFFERS.length) return window.PORTAL_OFFERS;
    if (typeof loadPortalOffers === 'function') {
      try { await loadPortalOffers(); } catch (e) {}
    } else {
      try { window.PORTAL_OFFERS = await req('/api/offers'); } catch (e) { window.PORTAL_OFFERS = []; }
    }
    return window.PORTAL_OFFERS || [];
  }

  window.gpAssignCustomerOffers = async function (id) {
    var c = typeof customerById === 'function' ? customerById(id) : null;
    if (!c) return alert('مشتری پیدا نشد');
    var offers = await ensureOffers();
    var rows = (offers || []).map(function (o) {
      var all = (o.audience || 'all') === 'all';
      var on = all || (o.customer_ids || []).map(Number).indexOf(+id) >= 0;
      return '<label><input type="checkbox" data-offer-id="' + o.id + '" style="width:auto;margin-top:3px" ' +
        (on ? ' checked' : '') + (all ? ' disabled' : '') + '> <span><b>' + esc(o.title || 'طرح') + '</b>' +
        '<div class="small">' + (all ? 'برای همه مشتریان نمایش داده می‌شود' : (o.active ? 'فعال — مشتریان منتخب' : 'غیرفعال')) +
        '</div></span></label>';
    }).join('');
    modal(
      '<h3>تخصیص طرح و آفر — ' + esc(c.name) + '</h3>' +
      '<div class="small" style="margin-bottom:10px">طرح عمومی برای همه است. طرح‌های منتخب را از همین فهرست به این مشتری بدهید یا بردارید.</div>' +
      '<div class="gp-offer-list">' + (rows || '<div class="gp-people-empty"><b>طرحی ثبت نشده</b>اول از همین صفحه یک طرح بسازید.</div>') + '</div>' +
      '<div class="toolbar" style="margin-top:12px">' +
        '<button type="button" onclick="gpSaveCustomerOffers(' + id + ')">ذخیره تخصیص</button>' +
        '<button class="btnlight" type="button" onclick="gpFocusOfferForm(' + id + ')">ساخت طرح برای این مشتری</button>' +
        '<button class="btnlight" type="button" onclick="closeModal()">بستن</button>' +
      '</div>'
    );
  };

  window.gpSaveCustomerOffers = async function (id) {
    try {
      var offers = window.PORTAL_OFFERS || [];
      var boxes = document.querySelectorAll('#modal [data-offer-id]');
      for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        var offer = offers.filter(function (o) { return String(o.id) === String(box.getAttribute('data-offer-id')); })[0];
        if (!offer || (offer.audience || 'all') === 'all') continue;
        var ids = (offer.customer_ids || []).map(Number).filter(function (n) { return n > 0 && n !== +id; });
        if (box.checked) ids.push(+id);
        if (!ids.length) throw new Error('طرح «' + (offer.title || '') + '» باید حداقل یک مشتری داشته باشد');
        await req('/api/offers/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: offer.id,
            title: offer.title,
            badge: offer.badge,
            description: offer.description,
            product: offer.product,
            start_date: offer.start_date,
            end_date: offer.end_date,
            active: !!offer.active,
            audience: 'selected',
            customer_ids: ids
          })
        });
      }
      closeModal();
      toast('طرح و آفر این مشتری ذخیره شد');
      await ensureOffers();
      if (typeof loadPortalOffers === 'function') loadPortalOffers();
      renderPeople();
    } catch (e) {
      alert(e.message);
    }
  };

  window.gpFocusOfferForm = function (id) {
    closeModal();
    if ($('offerAudience')) {
      $('offerAudience').value = 'selected';
      if (typeof portalToggleOfferAudience === 'function') portalToggleOfferAudience();
    }
    if ($('offerCustomers')) {
      [].forEach.call($('offerCustomers').options, function (opt) {
        opt.selected = +opt.value === +id;
      });
    }
    var card = $('portalOffers') && $('portalOffers').closest('.card');
    if (card) {
      try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }
    if ($('offerTitle')) {
      try { $('offerTitle').focus(); } catch (e) {}
    }
  };

  function wrapViews() {
    if (typeof window.show === 'function' && !window.show.__gpPolish1) {
      var base = window.show;
      window.show = function (t) {
        var out = base.apply(this, arguments);
        try {
          if (t === 'customerAdd') {
            stripQuestions();
            installAddTypeahead();
            fillNextCode();
            renamePriceLabels();
          }
          if (t === 'salesAgents' || t === 'salesReps') {
            ensureOffers();
            renderPeople();
          }
        } catch (e) {}
        return out;
      };
      window.show.__gpPolish1 = true;
    }
    if (typeof window.refresh === 'function' && !window.refresh.__gpPolish1) {
      var baseR = window.refresh;
      window.refresh = async function () {
        var out = await baseR.apply(this, arguments);
        try {
          fillNextCode();
          renderPeople();
        } catch (e) {}
        return out;
      };
      window.refresh.__gpPolish1 = true;
    }
    var box = $('gpChannelBox');
    if (box && !box.dataset.gpPolishBound) {
      box.dataset.gpPolishBound = '1';
      box.addEventListener('change', function () {
        fillNextCode();
        installAddTypeahead();
      });
    }
  }

  function apply() {
    if (APPLYING) return;
    APPLYING = true;
    try { ensureStyle(); } catch (e) {}
    try { stripQuestions(); } catch (e) {}
    try { renamePriceLabels(); } catch (e) {}
    try { installAddTypeahead(); } catch (e) {}
    try { fillNextCode(); } catch (e) {}
    try { wrapAdd(); } catch (e) {}
    try { wrapEdit(); } catch (e) {}
    try { wrapViews(); } catch (e) {}
    try {
      if ($('salesAgents') || $('salesReps')) renderPeople();
    } catch (e) {}
    APPLYING = false;
  }

  apply();
  [200, 700, 1400, 2200, 3200, 4800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 80); });
  }
})();
