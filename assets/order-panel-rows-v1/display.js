"use strict";
/** Distinguish entire order rows using the existing panel selection. */
class OrderPanelRowPresentation {
    constructor(policy) {
        this.policy = policy;
        for (const color of [policy.border]) {
            if (!/^#[0-9a-f]{6}$/i.test(color))
                throw new Error("invalid_panel_color");
        }
        if (policy.label !== "ثبت در پنل")
            throw new Error("invalid_panel_label");
        if (!Number.isInteger(policy.width) || policy.width < 1 || policy.width > 4)
            throw new Error("invalid_panel_border_width");
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
    /** Outline the complete row without overriding status backgrounds or text colors. */
    start(dom) {
        const style = dom.createElement("style");
        style.id = "gp-panel-order-colors-v1";
        const edge = this.policy.width;
        const color = this.policy.border;
        const horizontal = `inset 0 ${edge}px 0 ${color},inset 0 -${edge}px 0 ${color}`;
        style.textContent = `#otbody>tr[data-gp-panel-order="true"]>td{box-shadow:${horizontal}!important}#otbody>tr[data-gp-panel-order="true"]>td:first-child{box-shadow:${horizontal},inset -${edge}px 0 0 ${color}!important}#otbody>tr[data-gp-panel-order="true"]>td:last-child{box-shadow:${horizontal},inset ${edge}px 0 0 ${color}!important}`;
        dom.head.appendChild(style);
    }
}
(() => {
    const view = window;
    const raw = view.GP_PANEL_ORDER_POLICY;
    if (typeof raw !== "object" || raw === null)
        throw new Error("invalid_panel_policy");
    const policy = raw;
    const border = policy["border"];
    const width = policy["width"];
    const label = policy["label"];
    if (typeof border !== "string" ||
        typeof width !== "number" ||
        typeof label !== "string")
        throw new Error("invalid_panel_policy");
    const presentation = new OrderPanelRowPresentation({
        border,
        width,
        label,
    });
    presentation.start(document);
    view.gpPanelOrderPresentation = presentation;
})();
