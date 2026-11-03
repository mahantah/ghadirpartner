"""Finite-memory tests for the guarded two-file production hotfix."""

from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

test_parent = Path(__file__).resolve().parent
sys.path.insert(
    0,
    str(test_parent.parent / "scripts" if test_parent.name == "tests" else test_parent),
)

from hotfix_mixed_order import (  # noqa: E402
    MixedSettlementHotfix,
    ReleaseSettings,
    TargetFile,
)


class FakeRemote:
    """Local in-memory FTPS fake; never transfers production source."""

    def __init__(self, initial: dict[str, bytes], fail_destination: str = "") -> None:
        """Initialize the fake file store and optional rename failure."""
        self.files = dict(initial)
        self.fail_destination = fail_destination
        self.live_replacements: list[str] = []

    def download(self, path: str) -> bytes:
        """Return a stored file's bytes."""
        return self.files[path]

    def upload(self, path: str, data: bytes) -> None:
        """Stage a file into fake remote storage."""
        self.files[path] = data

    def replace(self, source: str, destination: str) -> None:
        """Simulate atomic overwrite or fail before the replacement occurs."""
        if destination == self.fail_destination:
            raise RuntimeError("simulated_rename_failure")
        self.files[destination] = self.files.pop(source)
        if destination.endswith(".php"):
            self.live_replacements.append(destination)

    def delete(self, path: str) -> None:
        """Delete a temporary stage when it exists."""
        self.files.pop(path, None)


class FakeHealth:
    """Deterministic read-only health probe for rollback tests."""

    def __init__(self, results: tuple[bool, ...] = (True, True)) -> None:
        """Capture expected sequential health responses."""
        self.results = list(results)

    def is_healthy(self, url: str, timeout: int) -> bool:
        """Return the next health response."""
        return self.results.pop(0)


class MixedSettlementHotfixTests(unittest.TestCase):
    """Exercise fingerprint checks, idempotence, atomicity and rollback."""

    def setUp(self) -> None:
        """Build an isolated checkout and exact synthetic source fingerprints."""
        self.temporary = tempfile.TemporaryDirectory(prefix="gp-mixed-hotfix-test-")
        self.root = Path(self.temporary.name)
        (self.root / "lib").mkdir()
        self.old = {
            "lib/customer-credit.php": b"credit-old",
            "lib/native-order-flow.php": b"order-old",
        }
        self.new = {
            "lib/customer-credit.php": b"credit-new",
            "lib/native-order-flow.php": b"order-new",
        }
        targets = []
        for path, source in self.new.items():
            (self.root / path).write_bytes(source)
            targets.append(
                TargetFile(
                    path,
                    hashlib.sha256(self.old[path]).hexdigest(),
                    hashlib.sha256(source).hexdigest(),
                )
            )
        self.settings = ReleaseSettings(
            "ftp.example",
            "user",
            "secret",
            21,
            20,
            "https://example.test/healthz",
            20,
            tuple(targets),
        )

    def tearDown(self) -> None:
        """Remove all owned temporary test fixture files."""
        self.temporary.cleanup()

    def test_releases_only_the_two_allowlisted_files(self) -> None:
        """Publish credit before order and verify both exact target hashes."""
        remote = FakeRemote(self.old)
        result = MixedSettlementHotfix(
            remote, FakeHealth(), self.settings, self.root
        ).release()
        self.assertEqual(
            result, ("lib/customer-credit.php", "lib/native-order-flow.php")
        )
        self.assertEqual(remote.live_replacements, list(result))
        self.assertEqual({key: remote.files[key] for key in self.new}, self.new)
        self.assertEqual(set(remote.files), set(self.new))

    def test_idempotent_when_already_released(self) -> None:
        """Avoid touching production when both installed hashes are current."""
        remote = FakeRemote(self.new)
        result = MixedSettlementHotfix(
            remote, FakeHealth(()), self.settings, self.root
        ).release()
        self.assertEqual(result, ())
        self.assertEqual(remote.live_replacements, [])

    def test_refuses_unknown_live_source(self) -> None:
        """Do not overwrite a source that differs from both pinned versions."""
        remote = FakeRemote(
            {**self.old, "lib/native-order-flow.php": b"changed-elsewhere"}
        )
        with self.assertRaisesRegex(RuntimeError, "production_sha256_mismatch"):
            MixedSettlementHotfix(
                remote, FakeHealth(()), self.settings, self.root
            ).release()
        self.assertEqual(remote.live_replacements, [])

    def test_refuses_unhealthy_production_before_writes(self) -> None:
        """Abort without stage uploads when the live health endpoint is failing."""
        remote = FakeRemote(self.old)
        with self.assertRaisesRegex(
            RuntimeError, "production_unhealthy_before_release"
        ):
            MixedSettlementHotfix(
                remote, FakeHealth((False,)), self.settings, self.root
            ).release()
        self.assertEqual(remote.files, self.old)

    def test_rolls_back_credit_when_order_rename_fails(self) -> None:
        """Restore the original credit file if the second publication fails."""
        remote = FakeRemote(self.old, fail_destination="lib/native-order-flow.php")
        with self.assertRaisesRegex(RuntimeError, "release_aborted_and_rolled_back"):
            MixedSettlementHotfix(
                remote, FakeHealth(), self.settings, self.root
            ).release()
        self.assertEqual({key: remote.files[key] for key in self.old}, self.old)

    def test_rolls_back_when_server_renames_then_reply_is_lost(self) -> None:
        """Recover an ambiguous FTPS response after the server changed a live file."""
        remote = FakeRemote(self.old)
        original_replace = remote.replace

        def interrupted_response(source: str, destination: str) -> None:
            """Simulate RNTO succeeding before its reply is lost."""
            original_replace(source, destination)
            if destination == "lib/native-order-flow.php" and source.endswith(".stage"):
                raise OSError("simulated_lost_ftps_reply")

        with patch.object(remote, "replace", side_effect=interrupted_response):
            with self.assertRaisesRegex(
                RuntimeError, "release_aborted_and_rolled_back"
            ):
                MixedSettlementHotfix(
                    remote, FakeHealth(), self.settings, self.root
                ).release()
        self.assertEqual({key: remote.files[key] for key in self.old}, self.old)

    def test_rolls_back_both_when_health_fails(self) -> None:
        """Restore both exact prior versions on a failed post-release health check."""
        remote = FakeRemote(self.old)
        with self.assertRaisesRegex(RuntimeError, "release_aborted_and_rolled_back"):
            MixedSettlementHotfix(
                remote, FakeHealth((True, False)), self.settings, self.root
            ).release()
        self.assertEqual({key: remote.files[key] for key in self.old}, self.old)

    def test_atomic_rename_probe_prevents_unsafe_deployment(self) -> None:
        """Do not alter PHP if this FTP server cannot replace existing files."""
        remote = FakeRemote(self.old)
        original_replace = remote.replace

        def reject_probe(source: str, destination: str) -> None:
            """Reject replacement of the synthetic probe only."""
            if destination.endswith("-rename-old.probe"):
                raise RuntimeError("atomic_replace_unsupported")
            original_replace(source, destination)

        with patch.object(remote, "replace", side_effect=reject_probe):
            with self.assertRaisesRegex(
                RuntimeError, "release_aborted_and_rolled_back"
            ):
                MixedSettlementHotfix(
                    remote, FakeHealth(), self.settings, self.root
                ).release()
        self.assertEqual({key: remote.files[key] for key in self.old}, self.old)


if __name__ == "__main__":
    unittest.main()
