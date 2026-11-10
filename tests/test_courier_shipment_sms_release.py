"""Exercise release safety with synthetic source files and an in-memory transport."""

from __future__ import annotations

import importlib.util
import os
import sys
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "reviewed_release", PROJECT / "scripts/release-courier-shipment-sms.py"
)
assert SPEC and SPEC.loader
RELEASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RELEASE
SPEC.loader.exec_module(RELEASE)


class FakeRemote:
    """Model exact-byte downloads, staging and rename failures without network I/O."""

    def __init__(self, files: dict[str, bytes]) -> None:
        """Keep independent file state and mutation history."""
        self.files = dict(files)
        self.writes: list[str] = []
        self.fail_once = ""
        self.corrupt_backup = False

    def download(self, path: str) -> bytes:
        """Return staged bytes, optionally simulating a corrupt backup readback."""
        result = self.files[path]
        return (
            result + b"bad"
            if self.corrupt_backup and "release-backups/" in path
            else result
        )

    def upload(self, path: str, data: bytes) -> None:
        """Record each synthetic write."""
        self.writes.append(path)
        self.files[path] = data

    def replace(self, source: str, destination: str) -> None:
        """Perform replacement, or fail once before the requested rename."""
        if destination == self.fail_once:
            self.fail_once = ""
            raise OSError("simulated rename failure")
        self.files[destination] = self.files.pop(source)

    def delete(self, path: str) -> None:
        """Remove only a disposable synthetic stage."""
        self.files.pop(path, None)

    def mkdir(self, path: str) -> None:
        """Record directory creation as a mutation."""
        self.writes.append(path)


class FakeValidator:
    """Record that candidates were validated before any production write."""

    def validate(self, candidates: dict[str, bytes]) -> None:
        """Require a complete single-file candidate set."""
        assert len(candidates) == 1


class FakeHealth:
    """Inject independent availability failures before or after publication."""

    def __init__(self, results: list[bool]) -> None:
        """Keep an ordered list of health outcomes."""
        self.results = results

    def healthy(self, url: str, timeout: int) -> bool:
        """Return the next synthetic endpoint result."""
        return self.results.pop(0)


class ReleaseTests(unittest.TestCase):
    """Verify publication, guarded refusal and automatic recovery."""

    def setUp(self) -> None:
        """Load real scope validation with non-secret fixture credentials."""
        with patch.dict(
            os.environ, {"FTP_USERNAME": "fixture", "FTP_PASSWORD": "fixture"}
        ):
            self.settings = RELEASE.Settings.load(
                PROJECT / "config/courier-shipment-sms-release.yaml"
            )
        targets = []
        self.before: dict[str, bytes] = {}
        self.after: dict[str, bytes] = {}
        for target in self.settings.targets:
            old, new = ("old " + target.path).encode(), ("new " + target.path).encode()
            self.before[target.path], self.after[target.path] = old, new
            targets.append(
                RELEASE.Target(
                    target.path,
                    RELEASE.digest(old),
                    RELEASE.digest(new),
                    (RELEASE.Edit(0, len(old), new),),
                )
            )
        self.settings = replace(self.settings, targets=tuple(targets))
        self.remote = FakeRemote(
            {
                **self.before,
                "assets/menu-live-v4.js": b"menu",
                "assets/menu-live-v3.js": b"menu",
                "assets/warehouse-ops-harden-v2.js": b"hardening",
            }
        )

    def release(self, health: list[bool] | None = None) -> object:
        """Construct the facade with fully isolated dependencies."""
        return RELEASE.Release(
            self.settings,
            self.remote,
            FakeValidator(),
            FakeHealth(health or [True, True]),
        )

    def test_inspection_has_zero_writes(self) -> None:
        """Read-only preflight must never create backup or stage files."""
        result = self.release().run(False)
        self.assertTrue(result["ok"])
        self.assertEqual(self.remote.writes, [])

    def test_success_backups_and_idempotence(self) -> None:
        """Publish the single target, protect backups and safely accept a rerun."""
        result = self.release().run(True)
        self.assertEqual(result["updated"][-1], "index.php")
        for path, expected in self.after.items():
            self.assertEqual(self.remote.files[path], expected)
        backups = [
            value
            for key, value in self.remote.files.items()
            if "release-backups/" in key
        ]
        self.assertEqual(len(backups), 1)
        self.assertTrue(
            all(value.startswith(RELEASE.Release.guard) for value in backups)
        )
        self.assertFalse(any(".gp-reviewed-" in key for key in self.remote.files))
        self.remote.writes.clear()
        self.release().run(True)
        self.assertEqual(self.remote.writes, [])

    def test_changed_live_source_refuses_before_writes(self) -> None:
        """A newer production file must never be overwritten."""
        self.remote.files["index.php"] += b"new user edit"
        with self.assertRaisesRegex(RuntimeError, "production_fingerprint_mismatch"):
            self.release().run(True)
        self.assertEqual(self.remote.writes, [])

    def test_rename_failure_rolls_back_prior_targets(self) -> None:
        """A failed replacement must preserve every original byte."""
        self.remote.fail_once = self.settings.targets[0].path
        with self.assertRaisesRegex(RuntimeError, "publication_reverted"):
            self.release().run(True)
        for path, expected in self.before.items():
            self.assertEqual(self.remote.files[path], expected)

    def test_health_failure_rolls_back_all_targets(self) -> None:
        """A failed post-deploy health check must restore the complete release."""
        with self.assertRaisesRegex(RuntimeError, "publication_reverted"):
            self.release([True, False]).run(True)
        for path, expected in self.before.items():
            self.assertEqual(self.remote.files[path], expected)

    def test_bad_backup_prevents_publication(self) -> None:
        """Do not install any target until its durable rollback copy is verified."""
        self.remote.corrupt_backup = True
        with self.assertRaisesRegex(RuntimeError, "publication_reverted"):
            self.release().run(True)
        for path, expected in self.before.items():
            self.assertEqual(self.remote.files[path], expected)


if __name__ == "__main__":
    unittest.main()
