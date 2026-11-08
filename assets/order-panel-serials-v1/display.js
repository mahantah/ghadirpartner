"use strict";
/** Keep the order's existing panel choice separate from serial allocation status. */
class OrderPanelSerialPresentation {
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
            ? ` data-gp-panel-serial="true" title="${this.policy.label}"`
            : "";
    }
    /** Apply reviewed accessible colors to the marked serials, including added content. */
    start(dom) {
        const style = dom.createElement("style");
        style.id = "gp-panel-serial-colors-v1";
        style.textContent = `[data-gp-panel-serial="true"]{background:${this.policy.background}!important;border:1px solid ${this.policy.border}!important;color:${this.policy.foreground}!important;border-radius:8px;padding:6px 9px}[data-gp-panel-serial="true"]>span,[data-gp-panel-serial="true"]>small{color:inherit!important}`;
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
    const presentation = new OrderPanelSerialPresentation({
        background,
        border,
        foreground,
        label,
    });
    presentation.start(document);
    view.gpPanelSerialPresentation = presentation;
})();
