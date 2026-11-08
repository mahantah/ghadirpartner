"use strict";
/** Distinguish entire order rows using the existing panel selection. */
class OrderPanelRowPresentation {
    constructor(policy) {
        this.policy = policy;
        for (const color of [policy.background, policy.border, policy.foreground]) {
            if (!/^#[0-9a-f]{6}$/i.test(color))
                throw new Error("invalid_panel_color");
        }
        if (policy.label !== "ثبت در پنل")
            throw new Error("invalid_panel_label");
    }
    /** Mark only orders with a selected PSP; never infer registration completion. */
    attributes(order) {
        if (typeof order !== "object" || order === null)
            return "";
        const item = order;
        const panels = item["panels"];
        const legacy = item["psp"];
        const selected = (Array.isArray(panels) &&
            panels.some((value) => typeof value === "string" && !!value.trim())) ||
            (typeof legacy === "string" && !!legacy.trim());
        return selected
            ? ` data-gp-panel-order="true" title="${this.policy.label}"`
            : "";
    }
    /** Color every cell of the marked order row while preserving badges and actions. */
    start(dom) {
        const style = dom.createElement("style");
        style.id = "gp-panel-order-colors-v1";
        style.textContent = `tr[data-gp-panel-order="true"]>td{background:${this.policy.background}!important}tr[data-gp-panel-order="true"]>td:first-child{border-right:4px solid ${this.policy.border}!important}tr[data-gp-panel-order="true"] .order-no{color:${this.policy.foreground}!important}`;
        dom.head.appendChild(style);
    }
}
(() => {
    const view = window;
    const raw = view.GP_PANEL_SERIAL_POLICY;
    if (typeof raw !== "object" || raw === null)
        throw new Error("invalid_panel_policy");
    const policy = raw;
    const background = policy["background"];
    const border = policy["border"];
    const foreground = policy["foreground"];
    const label = policy["label"];
    if (typeof background !== "string" ||
        typeof border !== "string" ||
        typeof foreground !== "string" ||
        typeof label !== "string")
        throw new Error("invalid_panel_policy");
    const presentation = new OrderPanelRowPresentation({
        background,
        border,
        foreground,
        label,
    });
    presentation.start(document);
    view.gpPanelOrderPresentation = presentation;
})();
