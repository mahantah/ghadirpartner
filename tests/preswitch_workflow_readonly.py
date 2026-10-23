#!/usr/bin/env python3
"""Regression: a pre-switch carton guard must not edit MySQL or deployed code."""
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
workflow = (ROOT / ".github/workflows/deploy-final-v53438.yml").read_text(encoding="utf-8")

start = '          cat > "/tmp/$FILE" <<\'PHP\'\n'
end = '\n          PHP\n'
assert workflow.count(start) == 1, "Pre-switch PHP probe heredoc not found uniquely"
probe = workflow.split(start, 1)[1].split(end, 1)[0]
assert probe.startswith("          <?php"), "Unexpected probe format"
spec = importlib.util.spec_from_file_location('inline_integrity', ROOT/'scripts/inline-preswitch-integrity.py')
inline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inline)
probe = inline.inline_probe(probe)

# Only read the live JSON snapshot; reject accidental in-guard modifications.
lower = probe.lower()
for forbidden in (
    "ghadir_protected_unassign_reserved",
    "update ghadir_state",
    "insert into ghadir_state_audit",
    "for update",
    "->begintransaction(",
    "->commit(",
    "->rollback(",
    "delete from ",
    "truncate ",
):
    assert forbidden not in lower, f"Pre-switch probe must remain read-only: {forbidden}"

assert "SELECT state_json,revision FROM ghadir_state WHERE id=1" in probe
assert "ghadir-mysql-pre-exact-v53438-" in probe, "Preserve the backup"
assert "file_put_contents(" in probe, "Preserve the pre-switch backup"
assert "target mismatch " in probe, "Keep the protected carton checks"
assert "protected_carton_state_mismatch" in probe, "Keep blocking error classification"
assert "gp_preswitch_allocated_carton_integrity($s,$code)" in probe, "Allocation-aware guard must run"
assert "if(!$integrity['ok'])" in probe
for reason in ('count_mismatch','invalid_links','duplicate_or_missing_serial',
               'invalid_allocation_order','allocation_serial_mismatch','exit_without_shipment',
               'allocation_not_complete'):
    assert reason in probe, reason

preflight = workflow.split("      - name: Snapshot and verify MySQL before deployment", 1)[1]
preflight = preflight.split("      - name: Deploy exact V5.3.4.38 core + add-on", 1)[0]
assert 'put "$GITHUB_WORKSPACE/lib/protected-cartons.php"' not in preflight, (
    "Do not overwrite production core modules ahead of the guard"
)
assert "preswitch_safety.py\" classify" in preflight, "Retain fail-closed classifier"
assert "HTTP_STATUS=" in preflight, "Retain HTTP response verification"
print("preswitch workflow is read-only and fail-closed")
