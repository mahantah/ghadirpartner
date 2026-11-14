(() => {
    "use strict";
    const navigation = document.querySelector(".topnav");
    const sales = navigation?.querySelector('[data-tab="salesReports"]');
    const salesPage = document.getElementById("salesReports");
    const customerMenu = navigation?.querySelector("#gpCustomers .nav-submenu");
    if (!sales || !salesPage || !customerMenu) return;

    // Keep the original sales link and its permissions inside the reports group.
    const reports = document.createElement("div");
    reports.id = "gpPortalReportsMenu";
    reports.className = "nav-group";
    const toggle = sales.cloneNode(true);
    toggle.removeAttribute("data-tab");
    toggle.classList.remove("active", "adminOnly", "hidden");
    toggle.classList.add("nav-group-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "gpReportsItems");
    const label = toggle.querySelector(".gp-menu-text");
    if (label) label.textContent = "گزارش‌ها";
    else toggle.textContent = "گزارش‌ها";
    const arrow = document.createElement("span");
    arrow.className = "chev";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";
    toggle.append(arrow);
    const reportMenu = document.createElement("div");
    reportMenu.id = "gpReportsItems";
    reportMenu.className = "nav-submenu";
    toggle.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", String(reports.classList.toggle("open")));
    });
    sales.before(reports);
    reports.append(toggle, reportMenu);
    reportMenu.append(sales);

    const pages = [
        ["gpCustomerPurchaseReport", "gpCustomerReportPage", "خرید و اعتبار هر مشتری", reportMenu],
        ["gpPortalActivity", "gpPortalActivityPage", "فعالیت کاربران و سبدهای خرید", reportMenu],
        ["gpMembershipRequests", "gpMembershipPage", "درخواست‌های عضویت", customerMenu],
        ["gpPortalMessages", "gpPortalMessagesPage", "ارسال پیام به مشتریان", customerMenu],
    ];
    const adminLinks = [];
    for (const [panelId, pageId, title, menu] of pages) {
        const panel = document.getElementById(panelId);
        if (!panel) continue;
        const page = document.createElement("section");
        page.id = pageId;
        page.className = "tab hidden gp-report-page";
        const heading = document.createElement("h2");
        heading.textContent = title;
        salesPage.after(page);
        page.append(heading, panel);
        const link = document.createElement("button");
        link.type = "button";
        link.dataset.tab = pageId;
        link.textContent = title;
        const openPage = () => {
            if (!has("admin")) return;
            show(pageId);
            if (!panel.open) panel.querySelector("summary").click();
            if (typeof setSidebar === "function") setSidebar(false);
        };
        if (panelId === "gpMembershipRequests") window.reviewRegistration = openPage;
        link.addEventListener("click", openPage);
        menu.append(link);
        adminLinks.push(link);
    }
    const update = () => {
        const admin = has("admin");
        reports.hidden = !canViewTab("salesReports");
        for (const link of adminLinks) link.hidden = !admin;
    };
    new MutationObserver(update).observe(document.getElementById("app"), { attributeFilter: ["class"] });
    update();
})();
