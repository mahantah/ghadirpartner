#!/usr/bin/env python3
"""Reconnect the preserved production login design without altering authentication."""

from __future__ import annotations

import re
import sys
from pathlib import Path


class PreviousLoginLayout:
    """Restore the existing lobby theme around the original credential controls."""

    MARKER = "GP_PREVIOUS_LOGIN_LAYOUT_RESTORED_20261028"

    @staticmethod
    def replace(source: str, old: str, new: str) -> str:
        """Replace one known source anchor and reject unexpected drift."""
        if source.count(old) != 1:
            raise ValueError("Expected one login anchor: " + old[:70])
        return source.replace(old, new, 1)

    def patch(self, source: str) -> str:
        """Reconnect preserved styling while keeping credential/reset handlers intact.

        Args:
            source: Current production HTML with the standard login controls.

        Returns:
            Patched HTML preserving the existing API and shipping implementation.
        """
        if self.MARKER in source:
            return source
        start = source.index('<div id="login"')
        end = source.index("\n", start)
        login = source[start:end]
        for control in (
            "lu",
            "lp",
            "loginbtn",
            "lmsg",
            "staffLoginForm",
            "staffResetForm",
        ):
            if login.count('id="' + control + '"') != 1:
                raise ValueError("Missing or repeated original login control")
        login = self.replace(
            login,
            'class="automation-login"',
            'class="automation-login stg-fullscreen-login"',
        )
        login = self.replace(
            login,
            '<div class="automation-login-card">',
            '<div class="stg-stage-photo" aria-hidden="true"></div><div class="automation-login-card">',
        )
        login = self.replace(
            login,
            "/assets/ghadir-logo-transparent.svg",
            "/assets/production-login-brand.png",
        )
        login = self.replace(
            login,
            "<div><b>قدیر پارتنر</b>",
            '<div class="stg-brand-label"><b>قدیر پارتنر</b>',
        )
        login = self.replace(
            login,
            '<div id="staffLoginForm">',
            '<div class="stg-card-section-line"></div><div class="gp-tab-rail"><button type="button" class="gp-tab gp-tab-login" onclick="toggleStaffReset(false)">ورود به سامانه</button><button type="button" class="gp-tab gp-tab-reset" onclick="toggleStaffReset(true)">بازیابی رمز عبور</button></div><div id="staffLoginForm" class="gp-form">',
        )
        login = self.replace(
            login,
            "<h2>ورود به اتوماسیون</h2>",
            '<h2 class="gp-title">ورود به <span class="stg-head-accent">سامانه</span></h2>',
        )
        login = self.replace(login, 'class="auth-copy"', 'class="auth-copy gp-intro"')
        login = self.replace(
            login,
            'class="staff-reset-panel hidden"',
            'class="staff-reset-panel gp-form gp-reset-form hidden"',
        )
        labels = {
            "lu": "نام کاربری",
            "lp": "رمز عبور",
            "sri": "نام کاربری یا شماره موبایل",
            "sro": "کد یک‌بارمصرف",
            "srp": "رمز عبور جدید",
        }
        for control, label in labels.items():
            pattern = r'<input\b[^>]*\bid="' + control + r'"[^>]*>'
            matches = list(re.finditer(pattern, login))
            if len(matches) != 1:
                raise ValueError("Unexpected login input structure")
            original = matches[0].group()
            field = re.sub(r'placeholder="[^"]*"', 'placeholder=" "', original)
            field = field.replace("<input ", '<input class="gp-input" ', 1)
            toggle = (
                '<button id="stg-password-toggle" class="gp-pass-toggle" type="button" aria-label="نمایش رمز عبور" aria-pressed="false"><svg class="gp-mini-icon gp-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="gp-mini-icon gp-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10 5c7-1 12 7 12 7s-2 3-5 5M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-1 5-2"/></svg></button>'
                if control == "lp"
                else ""
            )
            wrapper = (
                '<div class="gp-control">'
                + field
                + '<label class="gp-label" for="'
                + control
                + '">'
                + label
                + "</label>"
                + toggle
                + "</div>"
            )
            login = self.replace(login, original, wrapper)
        login = self.replace(
            login, '<button id="loginbtn">', '<button id="loginbtn" class="gp-submit">'
        )
        login = self.replace(
            login,
            'id="staffOtpBtn" type="button"',
            'id="staffOtpBtn" class="gp-submit gp-reset-send" type="button"',
        )
        login = self.replace(
            login,
            'class="staff-forgot-btn" onclick="toggleStaffReset(true)"',
            'class="staff-forgot-btn gp-forgot" onclick="toggleStaffReset(true)"',
        )
        result = source[:start] + login + source[end:]
        result, removed_js = re.subn(
            r'<script src="/assets/staff-login-otp\.js\?[^\"]*"></script>\s*',
            "",
            result,
        )
        result, removed_css = re.subn(
            r'<link rel="stylesheet" href="/assets/staff-login-otp\.css\?[^\"]*">\s*',
            "",
            result,
        )
        if removed_js != 1 or removed_css != 1:
            raise ValueError("Expected the old automatic OTP skin exactly once")
        result = self.replace(
            result,
            "function applyPermissionVisibility(){",
            "function applyPermissionVisibility(){\n if(!ME)return;",
        )
        result = self.replace(
            result,
            "</head>",
            '<link rel="stylesheet" href="/assets/production-login-v1.css?v=restore20261028">\n</head>',
        )
        ready = """<script src="/assets/production-login-v1.js?v=restore20261028"></script>
<script>
(function(){
 const password=document.getElementById('lp');
 if(password)password.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();document.getElementById('loginbtn').click();}});
 if(typeof window.GP_LOGIN_STARTUP_READY==='function')window.GP_LOGIN_STARTUP_READY();
})();
</script>
"""
        return self.replace(
            result, "</body>", "<!-- " + self.MARKER + " -->\n" + ready + "</body>"
        )


if __name__ == "__main__":
    path = Path(sys.argv[1])
    path.write_text(
        PreviousLoginLayout().patch(path.read_text(encoding="utf-8")), encoding="utf-8"
    )
