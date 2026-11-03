"""Memory-only regression checks for the guarded staff-permissions release."""

from __future__ import annotations

import hashlib
import runpy
import unittest
from pathlib import Path

MODULE = runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "scripts/release-staff-permissions.py")
)
RolePatch = MODULE["RolePatch"]
Settings = MODULE["Settings"]
Target = MODULE["Target"]
StaffPermissionsRelease = MODULE["StaffPermissionsRelease"]


def sha(value: bytes) -> str:
    """Fingerprint a synthetic UI fixture."""
    return hashlib.sha256(value).hexdigest()


class FakeRemote:
    """Deterministic replacement and rollback without real FTP or user records."""

    def __init__(self, files: dict[str, bytes], failing_path: str = "") -> None:
        """Initialize synthetic original bytes and optional RNTO failure."""
        self.files = dict(files)
        self.failing_path = failing_path
        self.replaced: list[str] = []

    def download(self, path: str) -> bytes:
        """Return the bytes of a synthetic remote file."""
        return self.files[path]

    def upload(self, path: str, data: bytes) -> None:
        """Stage a random-path file in memory."""
        self.files[path] = data

    def replace(self, source: str, destination: str) -> None:
        """Implement atomic rename, or a simulated failure before RNTO."""
        if destination == self.failing_path:
            raise RuntimeError("synthetic_ftp_failure")
        self.files[destination] = self.files.pop(source)
        if destination.endswith((".js", ".html")):
            self.replaced.append(destination)

    def delete(self, path: str) -> None:
        """Delete an owned stage, when present."""
        self.files.pop(path, None)


class FakeHealth:
    """Finite response sequence for preflight and rollback tests."""

    def __init__(self, replies: tuple[bool, ...] = (True, True)) -> None:
        """Capture the health probe results in chronological order."""
        self.replies = list(replies)

    def healthy(self, url: str, timeout: int) -> bool:
        """Return the next synthetic status."""
        return self.replies.pop(0)


class RolePatchTests(unittest.TestCase):
    """Verify that only anchored edits are applied to the live asset."""

    def test_preserves_unrelated_live_changes(self) -> None:
        """Apply three grouped edits without replacing live-only changes."""
        old_lines = [f"line-{number}\n" for number in range(40)]
        new_lines = old_lines.copy()
        for number in (4, 17, 31):
            new_lines[number] = f"fixed-{number}\n"
        live_lines = old_lines.copy()
        live_lines[39] = "customized-footer\n"
        result, count = RolePatch().apply(
            "".join(old_lines).encode(),
            "".join(new_lines).encode(),
            "".join(live_lines).encode(),
        )
        self.assertEqual(count, 3)
        self.assertTrue(result.endswith(b"customized-footer\n"))
        for number in (4, 17, 31):
            self.assertIn(f"fixed-{number}\n".encode(), result)

    def test_refuses_changed_patch_context(self) -> None:
        """Stop when another deployment changed an affected code block."""
        old = "".join(f"line-{number}\n" for number in range(40))
        new = (
            old.replace("line-4", "fixed-4")
            .replace("line-17", "fixed-17")
            .replace("line-31", "fixed-31")
        )
        live = old.replace("line-4", "changed-by-another-deployer")
        with self.assertRaisesRegex(RuntimeError, "production_patch_anchor_mismatch"):
            RolePatch().apply(old.encode(), new.encode(), live.encode())


class StaffPermissionsReleaseTests(unittest.TestCase):
    """Exercise the two-target publication, no-op and rollback guards."""

    def setUp(self) -> None:
        """Construct a fixed two-file release using only synthetic bytes."""
        self.before = {
            "assets/kartabl-sync-v1.js": b"asset-before",
            "app.html": b"app-before",
        }
        self.after = {
            "assets/kartabl-sync-v1.js": b"asset-after",
            "app.html": b"app-after",
        }
        self.settings = Settings(
            "ftp.example",
            21,
            45,
            "user",
            "secret",
            "https://example.test/healthz",
            30,
            "a" * 40,
            "b" * 64,
            (
                Target(
                    "assets/kartabl-sync-v1.js",
                    sha(self.before["assets/kartabl-sync-v1.js"]),
                    sha(self.after["assets/kartabl-sync-v1.js"]),
                ),
                Target(
                    "app.html",
                    sha(self.before["app.html"]),
                    sha(self.after["app.html"]),
                ),
            ),
            "old-ref",
            "new-ref",
        )

    def service(self, remote: FakeRemote, health: FakeHealth) -> object:
        """Return a release facade with a guarded synthetic preflight."""
        service = StaffPermissionsRelease(self.settings, remote, health, Path("."))
        service.prepare = lambda: (self.before, self.after, 3)
        return service

    def test_updates_only_the_two_approved_files(self) -> None:
        """Both exact asset and app bytes are installed after verified staging."""
        remote = FakeRemote(self.before)
        result = self.service(remote, FakeHealth()).release()
        self.assertEqual(result["updated"], list(self.before))
        self.assertEqual(remote.files, self.after)

    def test_rolls_back_when_second_rename_fails(self) -> None:
        """Restore the original asset if the HTML switch is refused."""
        remote = FakeRemote(self.before, failing_path="app.html")
        with self.assertRaisesRegex(RuntimeError, "publication_reverted"):
            self.service(remote, FakeHealth()).release()
        self.assertEqual({key: remote.files[key] for key in self.before}, self.before)

    def test_rolls_back_after_failed_health_check(self) -> None:
        """Recover both originals when the new page fails the health probe."""
        remote = FakeRemote(self.before)
        with self.assertRaisesRegex(RuntimeError, "publication_reverted"):
            self.service(remote, FakeHealth((True, False))).release()
        self.assertEqual({key: remote.files[key] for key in self.before}, self.before)


if __name__ == "__main__":
    unittest.main()
