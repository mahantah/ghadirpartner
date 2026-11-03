"""Read-only FTPS fingerprints for the automation staff-role UI release."""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import ssl
from ftplib import FTP_TLS, error_perm


class StaffPermissionsBaseline:
    """Inspect only the public UI files using the configured production FTPS account."""

    def __init__(self) -> None:
        """Resolve connection settings from existing GitHub Actions secrets."""
        configured_host = self._secret("FTP_SERVER")
        certificate_host = os.environ.get("FTPS_CERT_HOST", "").strip()
        if certificate_host and not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", certificate_host):
            raise RuntimeError("invalid_certificate_hostname")
        self.host = certificate_host or configured_host
        self.username = self._secret("FTP_USERNAME")
        self.password = self._secret("FTP_PASSWORD")
        self.phase = "connect"

    @staticmethod
    def _secret(name: str) -> str:
        """Require a configured secret without printing its contents."""
        value = os.environ.get(name, "")
        if not value:
            raise RuntimeError("missing_ftp_configuration")
        return value

    def inspect(self) -> dict[str, object]:
        """Return hashes and approved HTML/JS markers; never return source content."""
        ftp = FTP_TLS(context=ssl.create_default_context(), timeout=45)
        try:
            ftp.connect(self.host, 21)
            self.phase = "login"
            ftp.login(self.username, self.password)
            self.phase = "data_protection"
            ftp.prot_p()
            self.phase = "asset_read"
            asset = self._read(ftp, "assets/kartabl-sync-v1.js")
            self.phase = "app_read"
            app = self._read(ftp, "app.html")
        finally:
            ftp.close()
        tag = re.findall(rb"/assets/kartabl-sync-v1[.]js[?][A-Za-z0-9&=_-]+", app)
        return {
            "asset_sha256": hashlib.sha256(asset).hexdigest(),
            "app_sha256": hashlib.sha256(app).hexdigest(),
            "script_refs": [item.decode("ascii") for item in tag],
            "hide_role_css_count": asset.count(b"#users .checks"),
            "hide_edit_count": asset.count(b"#modal .checks"),
            "reset_role_count": asset.count(b"el.checked = (u.roles"),
        }

    @staticmethod
    def _read(ftp: FTP_TLS, path: str) -> bytes:
        """Read a strictly named non-secret presentation file into volatile memory."""
        payload = io.BytesIO()
        ftp.retrbinary("RETR /" + path, payload.write)
        return payload.getvalue()


if __name__ == "__main__":
    inspector = StaffPermissionsBaseline()
    try:
        print(json.dumps(inspector.inspect(), ensure_ascii=False))
    except error_perm as error:
        response = str(error)
        category = "ftp_auth_rejected" if response.startswith("530") else (
            "ftp_path_not_found" if response.startswith("550") else "ftp_permission_rejected"
        )
        print(json.dumps({"ok": False, "error": category}))
        raise SystemExit(1)
    except ssl.SSLCertVerificationError as error:
        print(json.dumps({"ok": False, "error": "certificate_not_verified", "verify_code": error.verify_code, "phase": inspector.phase}))
        raise SystemExit(1)
    except ssl.SSLError:
        print(json.dumps({"ok": False, "error": "ftps_tls_failure", "phase": inspector.phase}))
        raise SystemExit(1)
    except OSError:
        print(json.dumps({"ok": False, "error": "ftps_connection_failure"}))
        raise SystemExit(1)
    except Exception:
        print(json.dumps({"ok": False, "error": "unclassified_baseline_failure"}))
        raise SystemExit(1)
