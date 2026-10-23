// Simulated production DOM. No network, login, data store or customer payload.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div', classes = '') {
    this.tagName = tag;
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.dataset = {};
    this.hidden = false;
    this.listeners = {};
    const classNames = new Set(classes.split(/\s+/).filter(Boolean));
    this.classList = {
      contains: n => classNames.has(n),
      add: n => classNames.add(n),
      remove: n => classNames.delete(n),
      toggle: (n, force) => {
        const yes = force === undefined ? !classNames.has(n) : force;
        if (yes) classNames.add(n); else classNames.delete(n);
      }
    };
  }
  appendChild(child) {
    if (child.parentElement) child.remove();
    child.parentElement = this;
    this.children.push(child);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  querySelectorAll(selector) {
    const classes = selector.split(',').map(s => s.trim()).filter(s => s.startsWith('.')).map(s => s.slice(1));
    const result = [];
    const scan = node => {
      for (const child of node.children) {
        if (classes.some(c => child.classList.contains(c))) result.push(child);
        scan(child);
      }
    };
    scan(this);
    return result;
  }
  querySelector(selector) {
    if (selector === 'header') return this.children.find(c => c.tagName === 'header') || null;
    if (selector === '.nav-toggle.gp-nav-morph') {
      return this.querySelectorAll('.nav-toggle').find(e => e.classList.contains('gp-nav-morph')) || null;
    }
    return this.querySelectorAll(selector)[0] || null;
  }
  removeAttribute(key) { delete this.attributes[key]; }
  setAttribute(key, val) { this.attributes[key] = String(val); }
  getAttribute(key) { return this.attributes[key]; }
  click() { if (this.onclick) this.onclick(); if (this.listeners.click) this.listeners.click(); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

const app = new Element('div'); app.id = 'app';
const header = new Element('header');
const nav = new Element('nav', 'topnav');
const toggle = new Element('button', 'nav-toggle gp-nav-morph');
const oldX = new Element('button', 'sidebar-close');
const legacyX = new Element('button', 'gp-sidebar-legacy-close');
const host = new Element('div', 'userbox mobile-nav-userbox');
const wrapper = new Element('div', 'gp-profile-wrap');
const trigger = new Element('button'); trigger.id = 'gp-profile-trigger';
const actions = new Element('div'); actions.id = 'gp-profile-actions'; actions.hidden = true;
const who = new Element('span'); who.id = 'who';
const password = new Element('button'); password.id = 'changePasswordBtn';
const logout = new Element('button'); logout.id = 'logoutbtn';
let passwordClicks = 0, logoutClicks = 0, navClicks = 0;
password.onclick = () => passwordClicks++;
logout.onclick = () => logoutClicks++;
toggle.onclick = () => { navClicks++; nav.classList.toggle('sidebar-open'); toggle.setAttribute('aria-expanded', String(nav.classList.contains('sidebar-open'))); };
password.setAttribute('role', 'menuitem'); logout.setAttribute('role', 'menuitem');
trigger.appendChild(who); actions.appendChild(password); actions.appendChild(logout);
wrapper.appendChild(trigger); wrapper.appendChild(actions); host.appendChild(wrapper);
nav.appendChild(oldX); nav.appendChild(legacyX);
header.appendChild(toggle); header.appendChild(nav); header.appendChild(host);
app.appendChild(header);
const elements = [app, header, nav, toggle, host, who, password, logout, trigger, actions];
const document = {
  readyState: 'complete',
  getElementById: id => elements.find(e => e.id === id) || null,
  addEventListener() {}
};
const code = fs.readFileSync(path.join(__dirname, '../assets/prod-sidebar-controls-v1.js'), 'utf8');
const context = {document, console, MutationObserver: class {observe() {}}};
vm.runInNewContext(code, context);
vm.runInNewContext(code, context); // Idempotent.

assert.equal(nav.querySelectorAll('.sidebar-close, .gp-sidebar-legacy-close').length, 0);
assert.equal(host.parentElement, nav, 'account footer is inside navigation');
assert.equal(who.parentElement, host, 'user name remains visible');
assert.equal(password.parentElement, host, 'original password action is in footer');
assert.equal(logout.parentElement, host, 'original logout action is in footer');
assert.equal(password.getAttribute('role'), undefined);
assert.equal(trigger.hidden, true, 'empty legacy profile disclosure hidden');
assert.equal(actions.hidden, true);
assert.equal(host.classList.contains('gp-prod-account-footer'), true);
assert.equal(nav.querySelectorAll('.userbox').length, 1, 'no duplicate footer');
password.click(); logout.click(); toggle.click(); toggle.click();
assert.equal(passwordClicks, 1, 'password handler is unchanged');
assert.equal(logoutClicks, 1, 'logout handler is unchanged');
assert.equal(navClicks, 2, 'original menu toggle handler is unchanged');
assert.equal(nav.classList.contains('sidebar-open'), false);

const css = fs.readFileSync(path.join(__dirname, '../assets/prod-sidebar-controls-v1.css'), 'utf8');
assert.match(css, /rotate\(180deg\)/);
assert.match(css, /scaleX\(0\)/);
assert.match(css, /#changePasswordBtn/);
assert.match(css, /#logoutbtn/);
assert.match(css, /prefers-reduced-motion/);
console.log('production sidebar controls: PASS');
