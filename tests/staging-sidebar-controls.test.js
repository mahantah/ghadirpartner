// Lightweight DOM fixture for the staging-only sidebar adapter. No server or data access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
  constructor(tag = 'div', classes = '') {
    this.tagName = tag;
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.listeners = {};
    const values = new Set(classes.split(/\s+/).filter(Boolean));
    this.classList = {
      contains: name => values.has(name),
      add: name => values.add(name),
      remove: name => values.delete(name),
      toggle: (name, force) => {
        const next = force === undefined ? !values.has(name) : force;
        if (next) values.add(name);
        else values.delete(name);
        return next;
      }
    };
  }
  appendChild(child) {
    if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1);
    this.children.push(child);
    child.parentElement = this;
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  querySelector(selector) {
    if (selector === ':scope > header') return this.children.find(el => el.tagName === 'header') || null;
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const result = [];
    const visit = node => {
      for (const el of node.children) {
        if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) result.push(el);
        visit(el);
      }
    };
    visit(this);
    return result;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  click() { if (this.listeners.click) this.listeners.click({ preventDefault() {} }); if (this.onclick) this.onclick(); }
}

let width = 800;
const app = new Element('div');
const header = new Element('header');
const nav = new Element('nav', 'topnav');
const oldClose = new Element('button', 'sidebar-close');
const extraClose = new Element('button', 'sidebar-close');
const mobileButton = new Element('button', 'nav-toggle');
const desktopClose = new Element('button');
const desktopOpen = new Element('button');
const userbox = new Element('div', 'userbox');
const password = new Element('button');
const logout = new Element('button');
let passwordClicks = 0;
let logoutClicks = 0;
password.onclick = () => passwordClicks++;
logout.onclick = () => logoutClicks++;
userbox.appendChild(password);
userbox.appendChild(logout);
nav.appendChild(oldClose);
nav.appendChild(extraClose);
header.appendChild(mobileButton);
header.appendChild(nav);
header.appendChild(userbox);
app.appendChild(header);
app.id = 'app';
desktopClose.id = 'desktopSidebarCollapse';
desktopOpen.id = 'desktopSidebarOpen';
app.appendChild(desktopClose);
app.appendChild(desktopOpen);
mobileButton.onclick = () => nav.classList.toggle('sidebar-open');
desktopClose.onclick = () => app.classList.add('sidebar-collapsed');
desktopOpen.onclick = () => app.classList.remove('sidebar-collapsed');

const byId = id => {
  if (id === 'app') return app;
  const descendants = [app];
  for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
  return descendants.find(el => el.id === id) || null;
};
const document = {
  readyState: 'complete',
  getElementById: byId,
  createElement: tag => new Element(tag),
  addEventListener() {}
};
const window = {
  matchMedia: query => ({ matches: query === '(max-width:820px)' && width <= 820 }),
  addEventListener() {}
};
const source = fs.readFileSync(path.join(__dirname, '../assets/staging-sidebar-controls-v1.js'), 'utf8');
vm.runInNewContext(source, {
  document, window, console,
  MutationObserver: class { observe() {} },
  requestAnimationFrame: callback => callback()
});

const toggle = byId('gpSidebarSwitch');
assert.ok(toggle, 'animated switch is mounted');
assert.equal(nav.querySelectorAll('.sidebar-close').length, 0, 'obsolete X buttons removed');
assert.equal(userbox.parentElement, nav, 'account actions moved into nav footer');
password.click();
logout.click();
assert.equal(passwordClicks, 1, 'change-password handler retained');
assert.equal(logoutClicks, 1, 'logout handler retained');

toggle.click();
assert.equal(nav.classList.contains('sidebar-open'), true, '800px opens the drawer');
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
toggle.click();
assert.equal(nav.classList.contains('sidebar-open'), false, '800px closes the drawer');

width = 1024;
toggle.click();
assert.equal(app.classList.contains('sidebar-collapsed'), true, 'desktop switch collapses sidebar');
toggle.click();
assert.equal(app.classList.contains('sidebar-collapsed'), false, 'desktop switch expands sidebar');
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
console.log('staging sidebar controls: PASS');
