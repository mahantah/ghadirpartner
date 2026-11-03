"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MockElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.styles = new Map();
    this.style = { setProperty: (name, value) => this.styles.set(name, value) };
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      contains: (name) => classes.has(name),
    };
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(
        (child) => child !== this,
      );
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }
}

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(
  path.join(root, "assets/login-enamad-v2.js"),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "assets/login-enamad-v2.css"),
  "utf8",
);
const login = new MockElement("div");
const card = new MockElement("div");
login.querySelector = (selector) =>
  selector === ".automation-login-card" ? card : null;
login.appendChild(card);

class MockScript {}
const scriptElement = new MockScript();
scriptElement.dataset = {
  enamadTrustUrl:
    "https://trustseal.enamad.ir/?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn",
  enamadLogoUrl:
    "https://trustseal.enamad.ir/logo.aspx?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn",
  enamadDesktopWidth: "64",
  enamadMobileWidth: "54",
};
const document = {
  currentScript: scriptElement,
  getElementById: (id) => (id === "login" ? login : null),
  createElement: (tag) => new MockElement(tag),
  body: new MockElement("body"),
};

vm.runInNewContext(script, { document, HTMLScriptElement: MockScript, URL });

assert.equal(
  card.children.length,
  1,
  "badge belongs at the bottom of the login card",
);
assert.equal(
  document.body.children.length,
  0,
  "badge must not overlay the viewport",
);
const badge = card.children[0];
assert.equal(badge.tag, "a");
assert.equal(badge.target, "_blank");
assert.equal(badge.rel, "noopener");
assert.equal(badge.referrerPolicy, "origin");
assert.equal(badge.styles.get("--gp-enamad-desktop-width"), "64px");
assert.equal(badge.styles.get("--gp-enamad-mobile-width"), "54px");
assert.equal(
  badge.href,
  "https://trustseal.enamad.ir/?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn",
);
assert.equal(
  badge.children[0].src,
  "https://trustseal.enamad.ir/logo.aspx?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn",
);
badge.children[0].listeners.get("error")();
assert.equal(badge.children[0].hidden, true);
assert.equal(badge.classList.contains("gp-login-enamad-image-failed"), true);
assert.match(css, /position:\s*relative\s*!important/);
assert.match(css, /margin-right:\s*auto\s*!important/);
assert.match(css, /width:\s*var\(--gp-enamad-desktop-width\)\s*!important/);
assert.match(css, /width:\s*var\(--gp-enamad-mobile-width\)\s*!important/);
assert.match(css, /img\[hidden\]\s*\{\s*display:\s*none\s*!important/);
console.log(
  "PASS: compact linked seal, form-relative position, fallback and official URL",
);
