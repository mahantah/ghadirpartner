"""Publish the privacy notice and update only its entry points in the live portal."""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import secrets
import ssl
import sys
from ftplib import FTP_TLS, error_perm
from pathlib import Path
from typing import TypedDict, cast
from urllib.request import Request, urlopen


class Change(TypedDict):
    """One exact edit in the live portal."""

    before: str
    after: str


class ReleaseConfig(TypedDict):
    """Validated publication scope and transport configuration."""

    ftp_host: str
    ftp_port: int
    ftp_timeout: int
    username: str
    password: str
    portal_url: str
    portal_before: str
    portal_after: str
    changes: list[Change]


class PortalPrivacyRelease:
    """Inspect or publish one reviewed portal edit and its privacy page."""

    portal = "partners/portal.html"
    policy = "partners/privacy.html"
    guard = b"<?php http_response_code(404); exit; ?>\n"

    def __init__(self, root: Path, ftp: FTP_TLS, config: ReleaseConfig) -> None:
        """Inject the repository, verified connection, and validated manifest."""
        self.root, self.ftp, self.config = root, ftp, config

    def read(self, path: str) -> bytes:
        """Fetch the specified publication file without logging its contents."""
        output = io.BytesIO()
        self.ftp.retrbinary("RETR /" + path, output.write)
        return output.getvalue()

    def write_verified(self, path: str, contents: bytes) -> None:
        """Stage a file and verify its bytes before renaming it."""
        self.ftp.storbinary("STOR /" + path, io.BytesIO(contents))
        if self.read(path) != contents:
            raise RuntimeError("staged_file_mismatch")

    def candidate(self, original: bytes) -> bytes:
        """Apply each reviewed edit once to the exact production fingerprint."""
        if hashlib.sha256(original).hexdigest() == self.config["portal_after"]:
            return original
        if hashlib.sha256(original).hexdigest() != self.config["portal_before"]:
            raise RuntimeError("portal_baseline_mismatch")
        for edit in self.config["changes"]:
            anchor = edit["before"].encode()
            if original.count(anchor) != 1:
                raise RuntimeError("portal_anchor_mismatch")
            original = original.replace(anchor, edit["after"].encode(), 1)
        if hashlib.sha256(original).hexdigest() != self.config["portal_after"]:
            raise RuntimeError("candidate_fingerprint_mismatch")
        return original

    def verify_public(self, candidate: bytes, policy: bytes) -> None:
        """Verify the public policy and both customer portal entry URLs."""
        for suffix, payload in (
            ("", candidate),
            ("portal.html", candidate),
            ("privacy.html", policy),
        ):
            request = Request(
                self.config["portal_url"] + suffix + "?verify=" + secrets.token_hex(5),
                headers={"Cache-Control": "no-cache"},
            )
            with urlopen(request, timeout=20) as response:
                if response.read() != payload:
                    raise RuntimeError("public_file_mismatch")

    def run(self, apply: bool) -> None:
        """Validate preflight or publish atomically with guarded rollback."""
        original = self.read(self.portal)
        candidate = self.candidate(original)
        policy = (self.root / self.policy).read_bytes()
        if (
            candidate.count(b'href="/partners/privacy.html"') != 3
            or b'dir="rtl"' not in policy
        ):
            raise RuntimeError("privacy_entry_points_missing")
        try:
            prior_policy = self.read(self.policy)
        except error_perm as error:
            if not str(error).startswith("550"):
                raise
            prior_policy = None
        if prior_policy is not None and prior_policy != policy:
            raise RuntimeError("existing_policy_mismatch")
        if not apply:
            print("Privacy policy and three private portal anchors validated.")
            return
        token = secrets.token_hex(12)
        backup = f"storage/.gp-privacy-{token}.php"
        stage = f"storage/.gp-privacy-{token}.stage"
        policy_added = False
        portal_replaced = False
        self.write_verified(backup, self.guard + original)
        try:
            if prior_policy is None:
                self.write_verified(stage, policy)
                self.ftp.rename("/" + stage, "/" + self.policy)
                policy_added = True
            if original != candidate:
                self.write_verified(stage, candidate)
                if self.read(self.portal) != original:
                    raise RuntimeError("portal_changed_during_release")
                self.ftp.rename("/" + stage, "/" + self.portal)
                portal_replaced = True
            self.verify_public(candidate, policy)
        except Exception:
            if portal_replaced and self.read(self.portal) == candidate:
                self.write_verified(stage, original)
                self.ftp.rename("/" + stage, "/" + self.portal)
            if policy_added and self.read(self.policy) == policy:
                self.ftp.delete("/" + self.policy)
            raise
        finally:
            try:
                self.ftp.delete("/" + stage)
            except error_perm:
                pass
        print("Published and verified the privacy policy and customer portal.")


def load_config(root: Path) -> ReleaseConfig:
    """Validate the fixed portal target, config types, and hash syntax."""
    raw: object = json.loads((root / "config/portal-privacy-release.yaml").read_text())
    if not isinstance(raw, dict):
        raise ValueError("invalid_manifest")
    for field in (
        "ftp_host",
        "username",
        "password",
        "portal_url",
        "portal_before",
        "portal_after",
    ):
        if not isinstance(raw.get(field), str):
            raise ValueError("invalid_string_field")
    if raw["portal_url"] != "https://ghadirpartner.ir/partners/":
        raise ValueError("invalid_portal_target")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", raw["ftp_host"]):
        raise ValueError("invalid_host")
    for key in ("ftp_port", "ftp_timeout"):
        if type(raw.get(key)) is not int or not 1 <= raw[key] <= 65535:
            raise ValueError("invalid_ftp_config")
    for key in ("portal_before", "portal_after"):
        if not re.fullmatch(r"[0-9a-f]{64}", raw[key]):
            raise ValueError("invalid_fingerprint")
    changes = raw.get("changes")
    if not isinstance(changes, list) or len(changes) != 3:
        raise ValueError("invalid_portal_changes")
    for edit in changes:
        if not isinstance(edit, dict) or not all(
            isinstance(edit.get(key), str) and edit[key] for key in ("before", "after")
        ):
            raise ValueError("invalid_portal_edit")
    return cast(ReleaseConfig, raw)


def secret(reference: str) -> str:
    """Resolve an approved credential environment reference."""
    match = re.fullmatch(r"\$\{(FTP_USERNAME|FTP_PASSWORD)\}", reference)
    if match is None:
        raise ValueError("invalid_secret_reference")
    return os.environ[match.group(1)]


def main() -> None:
    """Run the approved inspection or apply step without emitting private sources."""
    if sys.argv[1:] not in (["inspect"], ["apply"]):
        raise ValueError("invalid_mode")
    root = Path(__file__).resolve().parent.parent
    config = load_config(root)
    with FTP_TLS(
        context=ssl.create_default_context(), timeout=config["ftp_timeout"]
    ) as ftp:
        ftp.connect(config["ftp_host"], config["ftp_port"])
        ftp.login(secret(config["username"]), secret(config["password"]))
        ftp.prot_p()
        PortalPrivacyRelease(root, ftp, config).run(sys.argv[1] == "apply")


if __name__ == "__main__":
    main()
