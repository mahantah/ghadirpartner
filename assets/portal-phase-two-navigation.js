(() => {
    "use strict";
    const navigation = document.querySelector(".topnav");
    if (!navigation) return;
    const menu = document.createElement("details");
    menu.className = "gp-reports-menu";
    const heading = document.createElement("summary");
    heading.textContent = "گزارش‌ها و ارتباط با مشتریان";
    menu.append(heading);
    const pages = [
        ["gpCustomerPurchaseReport", "gpCustomerReportPage", "خرید و اعتبار هر مشتری"],
        ["gpMembershipRequests", "gpMembershipPage", "درخواست‌های عضویت"],
        ["gpPortalMessages", "gpPortalMessagesPage", "ارسال پیام به مشتریان"],
    ];
    for (const [panelId, pageId, label] of pages) {
        const panel = document.getElementById(panelId);
        if (!panel) continue;
        const page = document.createElement("section");
        page.id = pageId;
        page.className = "tab hidden gp-report-page";
        const title = document.createElement("h2");
        title.textContent = label;
        // Tab visibility is controlled by the automation shell.
        document.getElementById("salesReports").after(page);
        page.append(title, panel);
        const link = document.createElement("button");
        link.type = "button";
        link.textContent = label;
        link.addEventListener("click", () => {
            if (!has("admin")) return;
            show(pageId);
            if (!panel.open) panel.querySelector("summary").click();
        });
        menu.append(link);
    }
    const sales = navigation.querySelector('[data-tab="salesReports"]');
    if (sales) sales.after(menu);
    else navigation.append(menu);
    const update = () => { menu.hidden = !has("admin"); };
    new MutationObserver(update).observe(document.getElementById("app"), { attributes: true });
    update();
})();
