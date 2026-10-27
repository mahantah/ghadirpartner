#!/usr/bin/env python3
"""Verify restored login controls preserve original auth callbacks and shipping."""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text()
with tempfile.TemporaryDirectory() as directory:
    target = Path(directory) / "app.html"
    target.write_text(source)
    subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/restore-previous-login-layout.py"),
            str(target),
        ],
        check=True,
    )
    result = target.read_text()
    assert "stg-fullscreen-login" in result and "production-login-v1.css" in result
    assert "production-login-v1.js" in result and "stg-password-toggle" in result
    assert '<script src="/assets/staff-login-otp.js' not in result
    for control in (
        "lu",
        "lp",
        "loginbtn",
        "lmsg",
        "staffLoginForm",
        "staffResetForm",
        "sri",
        "sro",
        "srp",
    ):
        assert result.count('id="' + control + '"') == 1
    start = source.index("function toggleStaffReset(")
    end = source.index("async function doLogout(", start)
    assert source[start:end] in result, "Auth and password reset callbacks changed"
    assert "GP_SHIPPING_METHODS_V1_20261027" in result
    for index, script in enumerate(
        re.findall(r"<script[^>]*>(.*?)</script>", result, re.DOTALL)
    ):
        temporary = Path(directory) / f"script-{index}.js"
        temporary.write_text(script)
        subprocess.run(
            ["node", "--check", str(temporary)], check=True, capture_output=True
        )
    subprocess.run(
        [
            sys.executable,
            str(repo / "scripts/restore-previous-login-layout.py"),
            str(target),
        ],
        check=True,
    )
    assert result == target.read_text(), "Repeated patch must be a no-op"
print(
    "PASS: previous theme, unique login controls, unchanged auth/reset handlers, shipping and JavaScript syntax"
)
