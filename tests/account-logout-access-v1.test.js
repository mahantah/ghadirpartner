'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const js = fs.readFileSync('assets/account-logout-access-v1.js', 'utf8');
assert.match(js, /GP_ACCOUNT_LOGOUT_ACCESS_V1_20261026/);

const css = fs.readFileSync('assets/account-logout-access-v1.css', 'utf8');
assert.match(css, /gp-account-docked/);
assert.match(css, /#logoutbtn/);

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    classList: {
      _c: new Set(),
      add(n) {
        this._c.add(n);
        el.className = [...this._c].join(' ');
      },
      remove(n) {
        this._c.delete(n);
        el.className = [...this._c].join(' ');
      },
      contains(n) {
        return this._c.has(n);
      },
    },
    children: [],
    parentElement: null,
    textContent: '',
    hidden: false,
    appendChild(c) {
      c.parentElement = el;
      el.children.push(c);
    },
    removeChild(c) {
      el.children = el.children.filter((x) => x !== c);
      c.parentElement = null;
    },
    closest(sel) {
      if (sel === '.userbox' && el.tagName === 'BUTTON') return userbox;
      return null;
    },
  };
  return el;
}

const nav = makeEl('div');
const header = { querySelector(sel) { return sel === '.topnav' ? nav : null; } };
const app = makeEl('div');
app.id = 'app';
app.classList.add('sidebar-collapsed');
app.querySelector = () => header;
app.appendChild = function (el) {
  if (el.parentElement) el.parentElement.removeChild(el);
  el.parentElement = app;
  app.children.push(el);
};
nav.appendChild = function (el) {
  if (el.parentElement) el.parentElement.removeChild(el);
  el.parentElement = nav;
  nav.children.push(el);
};

const userbox = makeEl('div');
userbox.className = 'userbox';
const logout = makeEl('button');
logout.id = 'logoutbtn';
logout.textContent = 'خروج';
const password = makeEl('button');
password.id = 'changePasswordBtn';
userbox.appendChild(logout);
userbox.appendChild(password);
nav.appendChild(userbox);

const document = {
  documentElement: { dataset: {} },
  getElementById(id) {
    if (id === 'app') return app;
    if (id === 'logoutbtn') return logout;
    if (id === 'changePasswordBtn') return password;
    return null;
  },
  readyState: 'complete',
  addEventListener() {},
  createElement: makeEl,
};

const window = {
  matchMedia(q) {
    return { matches: q.includes('821px') };
  },
  addEventListener() {},
  setTimeout(fn) {
    fn();
  },
};

vm.runInNewContext(js, {
  document,
  window,
  console,
  setTimeout(fn) {
    fn();
  },
  MutationObserver: function Obs() {
    this.observe = () => {};
  },
});

assert.equal(userbox.classList.contains('gp-account-docked'), true);
assert.equal(userbox.parentElement, app);
assert.equal(logout.textContent, 'خروج از حساب');

console.log('account-logout-access-v1.test.js: OK');
