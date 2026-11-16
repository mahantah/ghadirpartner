(() => {
    "use strict";
    const navigation = document.querySelector(".topnav");
    const sales = navigation?.querySelector('[data-tab="salesReports"]');
    const salesPage = document.getElementById("salesReports");
    const customerMenu = navigation?.querySelector("#gpCustomers .nav-submenu");
    const app = document.getElementById("app");
    if (!sales || !salesPage || !app) return;

    const iconSample = sales.querySelector(".gp-menu-icon");
    const iconPaths = {
        gpPortalWalletPage: "M3 6h18v13H3zM21 10h-6v5h6m-4-2.5h.01",
        gpCustomerReportPage: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm-2 5h20M6 15h4",
        gpPortalActivityPage: "M2 12h4l3-7 4 14 3-7h6",
        gpMembershipPage: "M12 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm4 7 2 2 5-5",
        gpPortalMessagesPage: "M21 4H3v13h5l4 4v-4h9zM7 8h10M7 12h7",
        accounts: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m10-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0m5 2v6m-3-3h6",
        catalog: "M3 5h18v14H3zM3 10h18m-12 0v9",
        offers: "M3 4h8l10 10-7 7L3 10zM7 8h.01",
        resets: "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3",
        sms: "M3 5h18v13H8l-5 3zM7 9h10M7 13h7",
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

    const portal = document.createElement("div");
    portal.id = "gpCustomerPortalMenu";
    portal.className = "nav-group";
    const portalToggle = toggle.cloneNode(true);
    portalToggle.setAttribute("aria-controls", "gpCustomerPortalItems");
    const portalLabel = portalToggle.querySelector(".gp-menu-text");
    if (portalLabel) portalLabel.textContent = "پرتال مشتریان";
    else portalToggle.firstChild.textContent = "پرتال مشتریان";
    portalToggle.querySelector(".gp-menu-icon path")?.setAttribute("d", iconPaths.accounts);
    const portalItems = document.createElement("div");
    portalItems.id = "gpCustomerPortalItems";
    portalItems.className = "nav-submenu";
    portalToggle.addEventListener("click", () => {
        portalToggle.setAttribute("aria-expanded", String(portal.classList.toggle("open")));
    });
    reports.after(portal);
    portal.append(portalToggle, portalItems);
    // The legacy sidebar still tracks the catalog control to keep its existing handlers.
    navigation.querySelector(":scope > #gpNavCatalog")?.setAttribute("hidden", "");

    const pages = [
        ["gpCustomerPurchaseReport", "gpCustomerReportPage", "خرید و اعتبار هر مشتری"],
        ["gpPortalActivity", "gpPortalActivityPage", "فعالیت کاربران و سبدهای خرید"],
        ["gpPortalWallet", "gpPortalWalletPage", "کیف پول مشتریان"],
        ["gpMembershipRequests", "gpMembershipPage", "درخواست‌های عضویت"],
        ["gpPortalMessages", "gpPortalMessagesPage", "ارسال پیام به مشتریان"],
    ];
    const portalLinks = [];
    for (const [panelId, pageId, title] of pages) {
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
            if (!canViewTab(pageId)) return;
            show(pageId);
            for (const sibling of portalItems.querySelectorAll("[data-portal-admin-view]")) {
                sibling.classList.remove("active");
            }
            if (!panel.open) panel.querySelector("summary").click();
            if (typeof setSidebar === "function") setSidebar(false);
        };
        if (panelId === "gpMembershipRequests") window.reviewRegistration = openPage;
        link.addEventListener("click", openPage);
        portalItems.append(link);
        portalLinks.push(link);
    }
    for (const [view, title] of [
        ["accounts", "حساب‌های پرتال"],
        ["catalog", "قیمت و موجودی پرتال"],
        ["offers", "طرح‌ها و آفرهای پرتال"],
        ["resets", "بازیابی رمز پرتال"],
        ["sms", "پیامک هما"],
    ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.portalAdminView = view;
        const label = document.createElement("span");
        label.className = "gp-menu-text";
        label.textContent = title;
        button.append(label);
        addIcon(button, view);
        button.addEventListener("click", () => {
            if (!canViewTab("portalAdmin")) return;
            show("portalAdmin");
            portalAdminView(view);
            for (const sibling of portalItems.querySelectorAll("[data-portal-admin-view]")) {
                sibling.classList.toggle("active", sibling === button);
            }
            if (typeof setSidebar === "function") setSidebar(false);
        });
        portalItems.append(button);
        portalLinks.push(button);
    }
    const update = () => {
        portal.hidden = !(has("admin") || has("finance"));
        reports.hidden = !canViewTab("salesReports");
        for (const link of portalLinks) link.hidden = !canViewTab(link.dataset.tab ?? "portalAdmin");
    };
    new MutationObserver(update).observe(app, { attributeFilter: ["class"] });
    update();
    const railControls = navigation.querySelectorAll(":scope > [data-tab], :scope > .nav-group > .nav-group-toggle");
    for (const control of railControls) {
        const name = (control.querySelector(".gp-menu-text") || control).textContent.trim();
        if (!name) continue;
        control.title = name;
        control.setAttribute("aria-label", name);
    }
    // Group icons open their original submenus in the full sidebar.
    navigation.addEventListener("click", (event) => {
        const group = event.target.closest(".nav-group-toggle")?.parentElement;
        if (!group || group.parentElement !== navigation || !app.classList.contains("sidebar-collapsed")) return;
        document.getElementById("desktopSidebarOpen")?.click();
        requestAnimationFrame(() => {
            group.classList.add("open");
            group.querySelector(".nav-group-toggle")?.setAttribute("aria-expanded", "true");
        });
    }, true);
    addIcon(customerMenu?.querySelector('[data-tab="salesPlans"]'), "salesPlans");
    for (const [key, name] of [["changePasswordBtn", "تغییر رمز"], ["logoutbtn", "خروج از حساب"]]) {
        const button = document.getElementById(key);
        if (!button) continue;
        if (key === "logoutbtn" && button.textContent.trim() === "خروج") {
            button.textContent = name;
        }
        addIcon(button, key);
        button.title = name;
        button.setAttribute("aria-label", name);
    }
})();
