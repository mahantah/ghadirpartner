(() => {
    "use strict";
    const navigation = document.querySelector(".topnav");
    if (!navigation) return;
    const menu = document.createElement("details");
    menu.id = "gpPortalReportsMenu";
    menu.className = "gp-reports-menu";
    const heading = document.createElement("summary");
    heading.textContent = "گزارش‌ها و ارتباط با مشتریان";
    menu.append(heading);
    const pages = [
        ["gpCustomerPurchaseReport", "gpCustomerReportPage", "خرید و اعتبار هر مشتری"],
        ["gpPortalActivity", "gpPortalActivityPage", "فعالیت کاربران و سبدهای خرید"],
        ["gpMembershipRequests", "gpMembershipPage", "درخواست‌های عضویت"],
        ["gpPortalMessages", "gpPortalMessagesPage", "ارسال پیام به مشتریان"],
    ];
    let openMembership = null;
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
        const openPage = () => {
            if (!has("admin")) return;
            show(pageId);
            if (!panel.open) panel.querySelector("summary").click();
            if (typeof setSidebar === "function") setSidebar(false);
        };
        if (panelId === "gpMembershipRequests") openMembership = openPage;
        link.addEventListener("click", openPage);
        menu.append(link);
    }
    const sales = navigation.querySelector('[data-tab="salesReports"]');
    if (sales) sales.after(menu);
    else navigation.append(menu);
    // Older customer tabs still reference this handler after their cards move.
    if (openMembership) window.reviewRegistration = openMembership;
    const update = () => { menu.hidden = !has("admin"); };
    new MutationObserver(update).observe(document.getElementById("app"), { attributes: true });
    update();
})();
