## I90 360-unit surplus investigation (2026-10-18)

Operator-observed values: **1,605** in wholesale before end-of-day **150** outbound devices on 2026-10-17; website now **1,815**, whereas physical stock reported is **1,455**. The difference is **exactly 360**. GitHub Actions run `39067294958` shows `protected repair released=360 restored_warehouse=360`, shortly after midnight Tehran time on 2026-10-18. The old release guard, now removed in PR #46, unassigned protected carton serials and changed `warehouse_id` from 0 to 1. These facts strongly suggest phantom stock; a quantity match alone does **not** prove which devices left or should be excluded.

Read-only local audit of protected I90 serials (all output consists only of aggregate counts):

```bash
python3 scripts/inspect-i90-preswitch-restore.py --current /secure/local/current.json --before /secure/local/preswitch-backup.json --expected 1455 --website-shows 1815
```

The `--before` file is optional but needed to verify a particular serial changed from outside to inside the wholesale warehouse, together with order unassignment. The historical preswitch backup was written to `storage/Backups/ghadir-mysql-pre-exact-v53438-*.json` **before** modifying the state; choose the backup associated with run `39067294958`. Review the number of matching original shipments, later legitimate returns and transfers, and the identities of the 150 outbound serials *locally*. The tool never writes or prints serials, orders, customers, or dumps. Do not upload backup or state files to GitHub/ChatGPT.

If the current 1,815 count includes 360 returned markers and prior snapshot confirms outside-to-wholesale transitions, prepare a separately approved, transactional, per-serial correction with backup, revision checks, audit trail and preservation of valid later movements. Avoid simply subtracting 360, removing cartons, clearing order history, changing retail warehouse counts, or re-registering the 150-device exit.

### Status
No production data was accessed, corrected, imported, or exported during this review. The target is **1,455 I90 units in wholesale only**. This is a diagnostic PR pending operational verification, not a production repair.
