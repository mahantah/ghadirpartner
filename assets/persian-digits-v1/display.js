"use strict";
/** Validate the presentation policy before inspecting any application elements. */
class PersianDigitPolicy {
    /** Parse untrusted release configuration before the display starts. */
    load(value) {
        if (typeof value !== "object" || value === null)
            throw new Error("invalid_digit_policy");
        const item = value;
        const family = item["font_family"];
        const selector = item["serial_selector"];
        const fields = item["serial_field_ids"];
        const header = item["serial_header_pattern"];
        const counts = item["count_header_pattern"];
        if (family !== "GP Persian Digits" ||
            typeof selector !== "string" ||
            !selector ||
            !Array.isArray(fields) ||
            !fields.every((field) => typeof field === "string") ||
            typeof header !== "string" ||
            typeof counts !== "string")
            throw new Error("invalid_digit_policy");
        document.querySelector(selector);
        return {
            fontFamily: family,
            serialSelector: selector,
            serialFieldIds: new Set(fields),
            serialHeader: new RegExp(header, "i"),
            countHeader: new RegExp(counts, "i"),
        };
    }
}
/** Identify device serials independently from invoice numbers, amounts and counts. */
class SerialDigitContext {
    constructor(policy) {
        this.policy = policy;
    }
    /** Protect existing serial elements, serial form fields and actual serial table columns. */
    isRaw(element) {
        var _a;
        if (element.closest(this.policy.serialSelector))
            return true;
        if (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement) {
            if (this.policy.serialFieldIds.has(element.id))
                return true;
            const label = [
                element.name,
                element.getAttribute("data-field"),
                element.getAttribute("placeholder"),
            ].join(" ");
            if (/serial|imei|سریال|بارکد/i.test(label) && !/جستجو.*مشتری/.test(label))
                return true;
        }
        const cell = element.closest("td");
        const table = cell === null || cell === void 0 ? void 0 : cell.closest("table");
        const headerRow = table === null || table === void 0 ? void 0 : table.querySelector("thead tr:last-child");
        const header = cell && headerRow
            ? ((_a = headerRow.children.item(cell.cellIndex)) === null || _a === void 0 ? void 0 : _a.textContent) || ""
            : "";
        return (this.policy.serialHeader.test(header) &&
            !this.policy.countHeader.test(header));
    }
}
/** Apply digit-only glyphs while retaining the existing font for every other character. */
class PersianDigitFont {
    constructor(view, policy, context) {
        this.view = view;
        this.policy = policy;
        this.context = context;
        this.states = new WeakMap();
    }
    /** Batch style reads before writes and leave DOM text, input values and data attributes intact. */
    apply(elements) {
        const plans = [];
        for (const element of elements) {
            if (!(element instanceof HTMLElement || element instanceof SVGElement))
                continue;
            if (element.closest("script,style,noscript,template"))
                continue;
            const raw = this.context.isRaw(element);
            const state = this.states.get(element);
            if ((state === null || state === void 0 ? void 0 : state.raw) === raw &&
                state.family === element.style.fontFamily &&
                element.style.getPropertyPriority("font-family") === "important")
                continue;
            const original = this.view
                .getComputedStyle(element)
                .fontFamily.replace(/(?:["']?GP Persian Digits["']?\s*,?\s*)/g, "")
                .trim() || "Tahoma,Arial,sans-serif";
            plans.push({
                element,
                raw,
                family: raw ? original : `'${this.policy.fontFamily}',${original}`,
            });
        }
        for (const plan of plans) {
            plan.element.style.setProperty("font-family", plan.family, "important");
            this.states.set(plan.element, {
                raw: plan.raw,
                family: plan.element.style.fontFamily,
            });
        }
    }
}
/** Facade for initial rendering, new content and form controls throughout the application. */
class PersianDigitDisplay {
    constructor(dom, font) {
        this.dom = dom;
        this.font = font;
        this.pending = new Set();
        this.scheduled = false;
        this.observer = new MutationObserver((records) => this.queue(records));
    }
    /** Start without changing numbers that application code reads or submits. */
    start() {
        this.refresh(this.dom.body);
        this.observer.observe(this.dom.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }
    /** Inspect only the supplied subtree and apply presentation styles to numeric content. */
    refresh(root) {
        const elements = new Set();
        if (root instanceof Element &&
            root.matches("input:not([type=hidden]):not([type=password]),select,textarea"))
            elements.add(root);
        if (root instanceof Element || root instanceof Document) {
            root
                .querySelectorAll("input:not([type=hidden]):not([type=password]),select,textarea")
                .forEach((el) => elements.add(el));
        }
        const addText = (node) => {
            if (/[0-9\u0660-\u0669\u06f0-\u06f9]/.test(node.textContent || "") &&
                node.parentElement)
                elements.add(node.parentElement);
        };
        if (root.nodeType === Node.TEXT_NODE)
            addText(root);
        else {
            const walker = this.dom.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode())
                addText(walker.currentNode);
        }
        this.font.apply(elements);
    }
    /** Coalesce only changed content; font style updates cannot retrigger this observer. */
    queue(records) {
        for (const record of records) {
            if (record.type === "characterData")
                this.pending.add(record.target);
            else
                record.addedNodes.forEach((node) => this.pending.add(node));
        }
        if (this.scheduled || !this.pending.size)
            return;
        this.scheduled = true;
        void Promise.resolve().then(() => {
            this.scheduled = false;
            const roots = Array.from(this.pending);
            this.pending.clear();
            roots
                .filter((node) => node.isConnected)
                .forEach((node) => this.refresh(node));
        });
    }
}
(() => {
    if (window.__gpPersianDigitsV1)
        return;
    const policy = new PersianDigitPolicy().load(window.GP_PERSIAN_DIGITS_POLICY);
    const display = new PersianDigitDisplay(document, new PersianDigitFont(window, policy, new SerialDigitContext(policy)));
    display.start();
    window.__gpPersianDigitsV1 = true;
    window.gpRefreshPersianDigits = (root) => display.refresh(root || document.body);
})();
