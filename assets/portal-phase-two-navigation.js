(() => {
    "use strict";
    const navigation = document.querySelector(".topnav");
    const sales = navigation?.querySelector('[data-tab="salesReports"]');
    const salesPage = document.getElementById("salesReports");
    const customerMenu = navigation?.querySelector("#gpCustomers .nav-submenu");
    if (!sales || !salesPage || !customerMenu) return;

    const iconSample = sales.querySelector(".gp-menu-icon");
    const iconPaths = {
        gpCustomerReportPage: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm-2 5h20M6 15h4",
        gpPortalActivityPage: "M2 12h4l3-7 4 14 3-7h6",
        gpMembershipPage: "M12 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm4 7 2 2 5-5",
        gpPortalMessagesPage: "M21 4H3v13h5l4 4v-4h9zM7 8h10M7 12h7",
        salesPlans: "M3 4h8l10 10-7 7L3 10zM7 8h.01",
        changePasswordBtn: "M14 10a5 5 0 1 1 2 4l-6 6H6v-4l6-6zm4-3h.01",
        logoutbtn: "M11 4H4v16h7m3-12 4 4-4 4m-5-4h9",
    };
    /** Fill an empty icon slot with the sidebar's existing outline style. */
    function addIcon(link, key) {
        if (!link || !iconSample || link.querySelector("svg")) return;
        const icon = iconSample.cloneNode(true);
        icon.querySelector("path").setAttribute("d", iconPaths[key]);
        link.prepend(icon);
    }

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
        const linkLabel = document.createElement("span");
        linkLabel.className = "gp-menu-text";
        linkLabel.textContent = title;
        link.append(linkLabel);
        addIcon(link, pageId);
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
    addIcon(customerMenu.querySelector('[data-tab="salesPlans"]'), "salesPlans");
    for (const key of ["changePasswordBtn", "logoutbtn"]) {
        addIcon(document.getElementById(key), key);
    }
})();
