/* GP_SESSION_KEEP_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpSessionKeepV1) return;
  window.__gpSessionKeepV1 = true;

  function $(id) { return document.getElementById(id); }

  function liveMe() {
    try { if (typeof ME !== 'undefined' && ME) return ME; } catch (e) {}
    return window.ME || null;
  }

  function quietGuestMessage() {
    var box = $('lmsg');
    if (box && /ورود الزامی/.test(box.textContent || '')) box.textContent = '';
  }

  function restoreApp(me) {
    if (me) {
      try { ME = me; } catch (e) {}
      window.ME = me;
      window.__gpWasAuthed = true;
    }
    window.__gpLoginKicked = false;
    try { SESSION_EXPIRED_HANDLED = false; } catch (e) {}
    window.sessionExpiredHandled = false;
    if ($('app')) $('app').classList.remove('hidden');
    if ($('login')) $('login').classList.add('hidden');
    if ($('lmsg')) $('lmsg').textContent = '';
  }

  function emptyFor(url) {
    var u = String(url || '');
    if (/\/api\/(customers|orders|products|inventory|notifications|offers|users)(\?|$)/.test(u)) return [];
    if (/\/api\/warehouse/.test(u)) return { cartons: [], inventory: [], warehouses: [], connected: false };
    return {};
  }

  function isAuthFail(err) {
    if (!err) return false;
    if (err.status === 401) return true;
    return /ورود الزامی|نشست نامعتبر|نشست شما/.test(String(err.message || ''));
  }

  async function peekMe() {
    try {
      var r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  function kickOnce() {
    if (window.__gpLoginKicked) return;
    window.__gpLoginKicked = true;
    try { ME = null; } catch (e) {}
    window.ME = null;
    if ($('app')) $('app').classList.add('hidden');
    if ($('login')) $('login').classList.remove('hidden');
    if ($('lmsg') && !$('lmsg').textContent) {
      $('lmsg').textContent = 'نشست شما منقضی شده است؛ دوباره وارد شوید.';
    }
  }

  function wrapAlert() {
    if (window.alert && window.alert.__gpKeep1) return;
    var prev = window.alert.bind(window);
    window.alert = function () {
      var txt = String(arguments[0] == null ? '' : arguments[0]).trim();
      if (!liveMe() && /ورود الزامی/.test(txt)) return;
      return prev.apply(window, arguments);
    };
    window.alert.__gpKeep1 = true;
  }

  function wrapToast() {
    if (typeof window.toast !== 'function' || window.toast.__gpKeep1) return;
    var prev = window.toast;
    window.toast = function (m) {
      if (!liveMe() && /ورود الزامی/.test(String(m || ''))) return;
      return prev.apply(this, arguments);
    };
    window.toast.__gpKeep1 = true;
  }

  function wrapExpire() {
    if (typeof window.showSessionExpired === 'function' && !window.showSessionExpired.__gpKeep1) {
      var prev = window.showSessionExpired;
      window.showSessionExpired = function () {
        if (!liveMe() && !window.__gpWasAuthed) {
          quietGuestMessage();
          return;
        }
        if (window.__gpLoginKicked) return;
        return prev.apply(this, arguments);
      };
      window.showSessionExpired.__gpKeep1 = true;
    }
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__gpKeep1) return;
    var prev = window.show;
    window.show = function (t) {
      if (!liveMe()) return;
      return prev.apply(this, arguments);
    };
    window.show.__gpKeep1 = true;
  }

  function wrapBootData() {
    if (typeof window.applyBootstrapData !== 'function' || window.applyBootstrapData.__gpKeep1) return;
    var prev = window.applyBootstrapData;
    window.applyBootstrapData = function () {
      var out = prev.apply(this, arguments);
      if (liveMe()) {
        window.__gpWasAuthed = true;
        window.__gpLoginKicked = false;
      }
      return out;
    };
    window.applyBootstrapData.__gpKeep1 = true;
  }

  function wrapReq() {
    if (typeof window.req !== 'function' || window.req.__gpKeep1) return;
    var base = window.req;
    window.req = async function (url, opt) {
      opt = Object.assign({ credentials: 'same-origin' }, opt || {});
      var login = String(url || '').indexOf('/api/login') >= 0;
      var notify = String(url || '').indexOf('/api/notifications') >= 0;
      try {
        var out = await base.call(window, url, opt);
        if (liveMe()) window.__gpWasAuthed = true;
        return out;
      } catch (err) {
        if (login || !isAuthFail(err)) throw err;
        if (!liveMe() && !window.__gpWasAuthed) {
          quietGuestMessage();
          if (notify) return [];
          if (/\/api\/bootstrap/.test(String(url))) throw err;
          return emptyFor(url);
        }
        var me = await peekMe();
        if (me && me.id) {
          restoreApp(me);
          if (notify) return [];
          throw new Error('درخواست ناموفق بود؛ دوباره تلاش کنید');
        }
        if (notify) return [];
        kickOnce();
        throw err;
      }
    };
    window.req.__gpKeep1 = true;
    window.req.__gpStab1 = base.__gpStab1;
    window.req.__gpLockCache1 = base.__gpLockCache1;
  }

  function apply() {
    try { wrapAlert(); } catch (e) {}
    try { wrapToast(); } catch (e) {}
    try { wrapExpire(); } catch (e) {}
    try { wrapShow(); } catch (e) {}
    try { wrapBootData(); } catch (e) {}
    try { wrapReq(); } catch (e) {}
    if (liveMe()) window.__gpWasAuthed = true;
    if (!liveMe() && !window.__gpWasAuthed) quietGuestMessage();
  }

  apply();
  [80, 400, 1200, 2500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 20); });
  }
})();
