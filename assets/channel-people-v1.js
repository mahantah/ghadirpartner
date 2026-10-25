/* GP_CHANNEL_PEOPLE_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpChannelPeopleV1) return;
  window.__gpChannelPeopleV1 = true;

  var STYLE_ID = 'gp-channel-people-v1-css';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function customers() {
    return (window.CUST || []).filter(function (c) { return c && !c.deleted; });
  }

  function channelOf(c) {
    if (!c) return '';
    var ch = String(c.sales_channel || '').toLowerCase();
    if (ch === 'agent' || ch === 'rep' || ch === 'none') return ch;
    if (c.is_marketer || c.parent_marketer_id) return 'rep-inferred';
    return '';
  }

  function parentOf(c) {
    if (typeof marketerParent === 'function') return marketerParent(c);
    var id = c && c.parent_marketer_id;
    return id ? customers().filter(function (x) { return +x.id === +id; })[0] || null : null;
  }

  function roleOf(c) {
    if (c && c.is_marketer) return 'marketer';
    if (c && c.parent_marketer_id) return 'sub';
    return '';
  }

  function roleLabel(c) {
    if (c && c.is_marketer) return 'بازاریاب';
    if (c && c.parent_marketer_id) return 'زیرمجموعه بازاریاب';
    return 'نماینده';
  }

  function matchQ(c, q) {
    if (!q) return true;
    var p = parentOf(c);
    return [c.code, c.name, c.company, c.mobile, c.city, p && p.name].join(' ').toLowerCase().indexOf(q) >= 0;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.gp-ch-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}' +
      '.gp-ch-stat{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:12px;padding:10px 12px}' +
      '.gp-ch-stat span{display:block;color:#64748b;font-size:12px;font-weight:700}' +
      '.gp-ch-stat b{display:block;margin-top:3px;font-size:22px;color:#102a43}' +
      '.gp-ch-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}' +
      '.gp-ch-toolbar input,.gp-ch-toolbar select{flex:1;min-width:160px}' +
      '.gp-ch-empty{text-align:center;padding:36px 16px;color:#64748b;line-height:1.8}' +
      '.gp-ch-empty b{display:block;color:#102a43;margin-bottom:6px}' +
      '.gp-ch-msg{margin-top:8px;font-size:12px}' +
      '.gp-ch-inferred{background:#fff7ed;color:#9a3412;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800}' +
      '.gp-ch-role{background:#eef4fb;color:#173a59;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800}' +
      '#gpEditChannelBox{margin:0 0 10px;padding:12px 14px;border:2px solid #f58220;background:#fff7ef;border-radius:14px}' +
      '#gpEditChannelBox .gp-channel-row{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px}' +
      '@media(max-width:720px){.gp-ch-stats{grid-template-columns:1fr}.gp-ch-toolbar{flex-direction:column;align-items:stretch}}';
    document.head.appendChild(css);
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

  function ensureCard(secId, cardId, title, hint) {
    var sec = ensureSection(secId);
    var card = $(cardId);
    if (!card) {
      card = document.createElement('div');
      card.id = cardId;
      card.className = 'card';
      var head = sec.querySelector('.gp-offers-page-head');
      if (head && head.nextSibling) sec.insertBefore(card, head.nextSibling);
      else if (head) head.after(card);
      else sec.insertBefore(card, sec.firstChild);
    }
    if (!card.dataset.gpReady) {
      card.dataset.gpReady = '1';
      card.innerHTML =
        '<div class="section-title"><div><h3 style="margin:0">' + title + '</h3>' +
        '<div class="small">' + hint + '</div></div></div>' +
        '<div class="gp-ch-stats" id="' + cardId + 'Stats"></div>' +
        '<div class="gp-ch-toolbar" id="' + cardId + 'Tools"></div>' +
        '<div class="tablewrap"><table><thead id="' + cardId + 'Head"></thead>' +
        '<tbody id="' + cardId + 'Body"></tbody></table></div>' +
        '<div class="gp-ch-msg small" id="' + cardId + 'Msg"></div>';
    }
    return card;
  }

  function unassigned() {
    return customers().filter(function (c) {
      var ch = channelOf(c);
      return !ch || ch === 'none';
    });
  }

  function fillUnassignedSelect(sel, keep) {
    if (!sel) return;
    var q = (sel.dataset.q || '').toLowerCase();
    var rows = unassigned().filter(function (c) { return matchQ(c, q); }).slice(0, 200);
    sel.innerHTML = '<option value="">انتخاب مشتری از کارتابل</option>' + rows.map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(keep) ? ' selected' : '') + '>' +
        esc([c.code, c.name, c.company, c.mobile].filter(Boolean).join(' | ')) + '</option>';
    }).join('');
  }

  function fillParentSelect(sel, keep, exceptId) {
    if (!sel) return;
    var rows = customers().filter(function (c) {
      if (+c.id === +exceptId) return false;
      return !!(c.is_marketer || c.parent_marketer_id || channelOf(c) === 'rep' || channelOf(c) === 'rep-inferred');
    }).slice(0, 200);
    sel.innerHTML = '<option value="">انتخاب بازاریاب یا زیرمجموعه</option>' + rows.map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(keep) ? ' selected' : '') + '>' +
        esc(roleLabel(c) + ' — ' + [c.code, c.name, c.mobile].filter(Boolean).join(' | ')) + '</option>';
    }).join('');
  }

  function setMsg(id, text, ok) {
    var el = $(id);
    if (!el) return;
    el.className = 'gp-ch-msg small ' + (ok ? 'ok' : 'msg');
    el.textContent = text || '';
  }

  async function saveChannel(id, payload) {
    var body = Object.assign({ id: id }, payload);
    await req('/api/customers/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (typeof refresh === 'function') await refresh();
    else renderAll();
  }

  window.gpAssignAgent = async function () {
    try {
      var id = $('gpAgentPick') ? +$('gpAgentPick').value : 0;
      if (!id) throw new Error('مشتری را از فهرست انتخاب کنید');
      await saveChannel(id, { sales_channel: 'agent', is_marketer: false, parent_marketer_id: 0 });
      setMsg('gpAgentsPeopleMsg', 'به عاملین فروش اضافه شد', true);
    } catch (e) {
      setMsg('gpAgentsPeopleMsg', e.message, false);
    }
  };

  window.gpAssignRep = async function () {
    try {
      var id = $('gpRepPick') ? +$('gpRepPick').value : 0;
      if (!id) throw new Error('مشتری را از فهرست انتخاب کنید');
      var role = $('gpRepAssignRole') ? $('gpRepAssignRole').value : '';
      var isMarketer = role === 'marketer';
      var parent = 0;
      if (role === 'sub') {
        parent = $('gpRepAssignParent') ? +$('gpRepAssignParent').value : 0;
        if (!parent) throw new Error('بازاریاب یا زیرمجموعه بازاریاب را انتخاب کنید');
      } else if (role !== 'marketer') {
        throw new Error('نقش نمایندگی را انتخاب کنید');
      }
      await saveChannel(id, { sales_channel: 'rep', is_marketer: isMarketer, parent_marketer_id: parent });
      setMsg('gpRepsPeopleMsg', 'به نمایندگان اضافه شد', true);
    } catch (e) {
      setMsg('gpRepsPeopleMsg', e.message, false);
    }
  };

  window.gpConfirmRep = async function (id) {
    try {
      var c = typeof customerById === 'function' ? customerById(id) : null;
      await saveChannel(id, {
        sales_channel: 'rep',
        is_marketer: !!(c && c.is_marketer),
        parent_marketer_id: c && c.parent_marketer_id ? +c.parent_marketer_id : 0
      });
      toast('کانال نماینده ثبت شد');
    } catch (e) { alert(e.message); }
  };

  window.gpRemoveChannel = async function (id) {
    var c = typeof customerById === 'function' ? customerById(id) : {};
    if (!confirm('«' + (c.name || '') + '» از این کانال خارج شود و به کارتابل برگردد؟')) return;
    try {
      await saveChannel(id, { sales_channel: 'none' });
      toast('از کانال خارج شد');
    } catch (e) { alert(e.message); }
  };

  function actions(c, kind) {
    var bits = [];
    if (typeof has !== 'function' || has('sales')) {
      if (kind === 'rep' && channelOf(c) === 'rep-inferred') {
        bits.push('<button class="btn2" onclick="gpConfirmRep(' + c.id + ')">ثبت به‌عنوان نماینده</button>');
      }
      bits.push('<button class="btnlight" onclick="openCustomerEdit(' + c.id + ')">ویرایش</button>');
      bits.push('<button class="btnlight" onclick="gpRemoveChannel(' + c.id + ')">خروج از کانال</button>');
    }
    return bits.join(' ') || '-';
  }

  function renderAgents() {
    ensureCard('salesAgents', 'gpAgentsPeople', 'فهرست عاملین فروش',
      'مشتریانی که کانال آن‌ها عاملین فروش است. مشتری جدید را از کارتابل به این کانال اضافه کنید.');
    var list = customers().filter(function (c) { return channelOf(c) === 'agent'; });
    var q = ($('gpAgentSearch') && $('gpAgentSearch').value || '').trim().toLowerCase();
    var shown = list.filter(function (c) { return matchQ(c, q); });
    var stats = $('gpAgentsPeopleStats');
    if (stats) {
      stats.innerHTML =
        '<div class="gp-ch-stat"><span>عاملین فروش</span><b>' + list.length.toLocaleString('fa-IR') + '</b></div>' +
        '<div class="gp-ch-stat"><span>بدون کانال</span><b>' + unassigned().length.toLocaleString('fa-IR') + '</b></div>' +
        '<div class="gp-ch-stat"><span>نمایش فعلی</span><b>' + shown.length.toLocaleString('fa-IR') + '</b></div>';
    }
    var tools = $('gpAgentsPeopleTools');
    if (tools && !tools.dataset.ready) {
      tools.dataset.ready = '1';
      tools.innerHTML =
        '<input id="gpAgentSearch" placeholder="جستجو در عاملین: نام، کد، موبایل، شرکت">' +
        '<select id="gpAgentPick"></select>' +
        (typeof has !== 'function' || has('sales') ? '<button class="btn2" type="button" onclick="gpAssignAgent()">افزودن به عاملین</button>' : '');
      if ($('gpAgentSearch')) $('gpAgentSearch').addEventListener('input', renderAgents);
    }
    fillUnassignedSelect($('gpAgentPick'), $('gpAgentPick') && $('gpAgentPick').value);
    var head = $('gpAgentsPeopleHead');
    if (head) head.innerHTML = '<tr><th>کد</th><th>نام</th><th>شرکت</th><th>موبایل</th><th>شهر</th><th>قیمت‌ها</th><th>عملیات</th></tr>';
    var body = $('gpAgentsPeopleBody');
    if (!body) return;
    if (!shown.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="gp-ch-empty"><b>عاملی در این فهرست نیست</b>از کارتابل مشتری را انتخاب کنید و به عاملین فروش اضافه کنید. مشتری تازه‌وارد با انتخاب «عاملین فروش» همین‌جا می‌آید.</div></td></tr>';
      return;
    }
    body.innerHTML = shown.map(function (c) {
      var prices = typeof customerPriceGroups === 'function'
        ? customerPriceGroups(c).map(typeof priceGroupLabel === 'function' ? priceGroupLabel : String).join(' • ')
        : '';
      return '<tr><td>' + esc(c.code || '-') + '</td><td><b>' + esc(c.name || '-') + '</b></td><td>' +
        esc(c.company || '-') + '</td><td>' + esc(c.mobile || '-') + '</td><td>' + esc(c.city || '-') +
        '</td><td class="small">' + esc(prices || '—') + '</td><td>' + actions(c, 'agent') + '</td></tr>';
    }).join('');
  }

  function renderReps() {
    ensureCard('salesReps', 'gpRepsPeople', 'فهرست نمایندگان فروش',
      'بازاریاب‌ها و زیرمجموعه‌هایشان در این کانال مدیریت می‌شوند. طرح فروش همین صفحه باقی می‌ماند.');
    var all = customers().filter(function (c) {
      var ch = channelOf(c);
      return ch === 'rep' || ch === 'rep-inferred';
    });
    var filter = $('gpRepFilter') ? $('gpRepFilter').value : '';
    var q = ($('gpRepSearch') && $('gpRepSearch').value || '').trim().toLowerCase();
    var shown = all.filter(function (c) {
      if (filter === 'marketer' && !c.is_marketer) return false;
      if (filter === 'sub' && !c.parent_marketer_id) return false;
      if (filter === 'inferred' && channelOf(c) !== 'rep-inferred') return false;
      return matchQ(c, q);
    });
    var stats = $('gpRepsPeopleStats');
    if (stats) {
      stats.innerHTML =
        '<div class="gp-ch-stat"><span>بازاریاب</span><b>' + all.filter(function (c) { return c.is_marketer; }).length.toLocaleString('fa-IR') + '</b></div>' +
        '<div class="gp-ch-stat"><span>زیرمجموعه</span><b>' + all.filter(function (c) { return c.parent_marketer_id; }).length.toLocaleString('fa-IR') + '</b></div>' +
        '<div class="gp-ch-stat"><span>بدون کانال</span><b>' + unassigned().length.toLocaleString('fa-IR') + '</b></div>';
    }
    var tools = $('gpRepsPeopleTools');
    if (tools && !tools.dataset.ready) {
      tools.dataset.ready = '1';
      tools.innerHTML =
        '<input id="gpRepSearch" placeholder="جستجو در نمایندگان: نام، کد، موبایل، بازاریاب">' +
        '<select id="gpRepFilter"><option value="">همه نقش‌ها</option><option value="marketer">بازاریاب</option><option value="sub">زیرمجموعه بازاریاب</option><option value="inferred">تشخیص‌داده‌شده</option></select>' +
        '<select id="gpRepPick"></select>' +
        '<select id="gpRepAssignRole"><option value="">نقش نمایندگی</option><option value="marketer">بازاریاب</option><option value="sub">زیرمجموعه بازاریاب</option></select>' +
        '<select id="gpRepAssignParent" class="hidden"></select>' +
        (typeof has !== 'function' || has('sales') ? '<button class="btn2" type="button" onclick="gpAssignRep()">افزودن به نمایندگان</button>' : '');
      if ($('gpRepSearch')) $('gpRepSearch').addEventListener('input', renderReps);
      if ($('gpRepFilter')) $('gpRepFilter').addEventListener('change', renderReps);
      if ($('gpRepAssignRole')) $('gpRepAssignRole').addEventListener('change', function () {
        var box = $('gpRepAssignParent');
        if (box) box.classList.toggle('hidden', this.value !== 'sub');
        if (this.value === 'sub') fillParentSelect(box, box.value);
      });
    }
    fillUnassignedSelect($('gpRepPick'), $('gpRepPick') && $('gpRepPick').value);
    if ($('gpRepAssignRole') && $('gpRepAssignRole').value === 'sub') {
      fillParentSelect($('gpRepAssignParent'), $('gpRepAssignParent') && $('gpRepAssignParent').value);
    }
    var head = $('gpRepsPeopleHead');
    if (head) head.innerHTML = '<tr><th>کد</th><th>نام</th><th>نقش</th><th>بازاریاب بالادست</th><th>موبایل</th><th>شهر</th><th>عملیات</th></tr>';
    var body = $('gpRepsPeopleBody');
    if (!body) return;
    if (!shown.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="gp-ch-empty"><b>نماینده‌ای در این فهرست نیست</b>مشتری را از کارتابل انتخاب کنید، نقش بازاریاب یا زیرمجموعه را بگذارید و اضافه کنید. مشتریانی که از قبل بازاریاب بوده‌اند اینجا با برچسب تشخیص‌داده‌شده دیده می‌شوند.</div></td></tr>';
      return;
    }
    body.innerHTML = shown.map(function (c) {
      var p = parentOf(c);
      var inferred = channelOf(c) === 'rep-inferred'
        ? ' <span class="gp-ch-inferred">تشخیص‌داده‌شده</span>'
        : '';
      return '<tr><td>' + esc(c.code || '-') + '</td><td><b>' + esc(c.name || '-') + '</b>' + inferred +
        '</td><td><span class="gp-ch-role">' + esc(roleLabel(c)) + '</span></td><td>' +
        esc(p ? ((p.code || '') + ' ' + (p.name || '')).trim() : '—') + '</td><td>' +
        esc(c.mobile || '-') + '</td><td>' + esc(c.city || '-') + '</td><td>' + actions(c, 'rep') + '</td></tr>';
    }).join('');
  }

  function renderAll() {
    renderAgents();
    renderReps();
  }

  function injectEditChannel(id) {
    if ($('gpEditChannelBox')) return;
    var c = typeof customerById === 'function' ? customerById(id) : null;
    var ch = channelOf(c);
    if (ch === 'rep-inferred') ch = 'rep';
    var box = document.createElement('div');
    box.id = 'gpEditChannelBox';
    box.innerHTML =
      '<div class="small" style="font-weight:800">کانال فروش</div>' +
      '<div class="gp-channel-row">' +
        '<label><input type="radio" name="gpEditChannel" value="agent" style="width:auto"' + (ch === 'agent' ? ' checked' : '') + '> عاملین فروش</label>' +
        '<label><input type="radio" name="gpEditChannel" value="rep" style="width:auto"' + (ch === 'rep' ? ' checked' : '') + '> نمایندگان</label>' +
        '<label><input type="radio" name="gpEditChannel" value="none" style="width:auto"' + (!ch || ch === 'none' ? ' checked' : '') + '> فقط کارتابل</label>' +
      '</div>';
    var title = document.querySelector('#modal h3');
    if (title && title.parentNode) title.parentNode.insertBefore(box, title.nextSibling);
  }

  function wrapHooks() {
    if (typeof window.openCustomerEdit === 'function' && !window.openCustomerEdit.__gpPeople1) {
      var baseEdit = window.openCustomerEdit;
      window.openCustomerEdit = function (id) {
        baseEdit.apply(this, arguments);
        try { injectEditChannel(id); } catch (e) {}
      };
      window.openCustomerEdit.__gpPeople1 = true;
    }
    if (typeof window.saveCustomer === 'function' && !window.saveCustomer.__gpPeople1) {
      var baseSave = window.saveCustomer;
      window.saveCustomer = async function (id) {
        var on = document.querySelector('#gpEditChannelBox input[name="gpEditChannel"]:checked');
        if (!on) return baseSave.apply(this, arguments);
        try {
          var parent = $('eHasMarketer') && $('eHasMarketer').checked ? +$('eMarketerSelect').value : 0;
          if ($('eHasMarketer') && $('eHasMarketer').checked && !parent) throw new Error('بازاریاب را انتخاب کنید');
          var groups = typeof readPriceGroups === 'function' ? readPriceGroups('ep') : ['agent', 'panel', 'serial'];
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
            is_marketer: $('eIsMarketer') ? $('eIsMarketer').checked : false,
            parent_marketer_id: parent,
            sales_channel: on.value,
            visible_price_groups: groups
          };
          if ($('eCustomerActive')) body.active = $('eCustomerActive').checked;
          await req('/api/customers/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          closeModal();
          toast('مشتری ویرایش شد');
          await refresh();
        } catch (e) {
          alert(e.message);
        }
      };
      window.saveCustomer.__gpPeople1 = true;
    }
    if (typeof window.refresh === 'function' && !window.refresh.__gpPeople1) {
      var baseRefresh = window.refresh;
      window.refresh = async function () {
        var out = await baseRefresh.apply(this, arguments);
        try { renderAll(); } catch (e) {}
        return out;
      };
      window.refresh.__gpPeople1 = true;
    }
    if (typeof window.show === 'function' && !window.show.__gpPeople1) {
      var baseShow = window.show;
      window.show = function (t) {
        var result = baseShow.apply(this, arguments);
        try {
          if (t === 'salesAgents' || t === 'salesReps') renderAll();
        } catch (e) {}
        return result;
      };
      window.show.__gpPeople1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { wrapHooks(); } catch (e) {}
    try {
      if ($('salesAgents') || $('salesReps')) renderAll();
    } catch (e) {}
  }

  apply();
  [300, 900, 1800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 80); });
  }
})();
