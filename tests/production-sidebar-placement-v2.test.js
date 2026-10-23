'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const props = new Map();
const nav = {
  getBoundingClientRect() { return {left: 600, width: 280}; },
  addEventListener() {},
};
const app = {
  querySelector(selector) { assert.equal(selector, ':scope > header .topnav'); return nav; },
  classList: {contains(value) { return value === 'hidden' ? false : false; }},
};
const button = {
  dataset: {}, offsetWidth: 40,
  classList: {contains(value) { return value === 'is-open'; }},
  style: {setProperty(name, value) { props.set(name, value); }},
};
const old = {hidden: false, tabIndex: 0, setAttribute(key, val) {this[key] = val;}};
const observers = [];
const ctx = {
  document: {
    readyState: 'complete',
    getElementById(id) {
      return {app, gpSidebarSwitch:button, desktopSidebarCollapse:old}[id];
    },
  },
  window: {
    innerWidth: 900,
    requestAnimationFrame(callback) {callback();},
    addEventListener() {},
  },
  MutationObserver: class {
    constructor(callback) {this.callback = callback; observers.push(this);}
    observe() {}
  },
};
vm.runInNewContext(fs.readFileSync('assets/production-sidebar-placement-v2.js','utf8'), ctx);
assert.equal(old.hidden, true);
assert.equal(old.tabIndex, -1);
assert.equal(old['aria-hidden'], 'true');
assert.equal(button.dataset.gpPlacementV2, '1');
assert.equal(props.get('--gp-sidebar-v2-left'), '720px');
assert.equal(props.get('--gp-sidebar-v2-right'), 'auto');

button.classList.contains = () => false;
observers[0].callback();
assert.equal(props.get('--gp-sidebar-v2-left'), 'auto');
assert.equal(props.get('--gp-sidebar-v2-right'), '14px');
console.log('Production sidebar V2 responsive switch tests OK');
