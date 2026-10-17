# Production deployment attempts — 2026-10-17

The user explicitly requested a run of the latest code after organizing GitHub Actions. A narrow one-time `push` trigger was temporarily added for `.github/deploy/run-once-20261017.txt`. It is removed after the attempts below; production deployment defaults to manual `workflow_dispatch` again.

## Results

1. [Run 39030408795](https://github.com/mahantah/ghadirpartner/actions/runs/39030408795): failed **before deployment** due to incorrectly indented Python heredoc in the build step.
2. [Run 39030599678](https://github.com/mahantah/ghadirpartner/actions/runs/39030599678): failed **before deployment** because a legacy carton QR CSS rule was absent.
3. [Run 39030797511](https://github.com/mahantah/ghadirpartner/actions/runs/39030797511): failed **before deployment** because sequential patches removed / misplaced version contract markers.
4. [Run 39031685602](https://github.com/mahantah/ghadirpartner/actions/runs/39031685602): complete build and live-file backup succeeded. The required MySQL backup/verification endpoint returned **HTTP 500**. Core deployment and final verification were skipped; rollback guard ran. No newly built site code was uploaded by this run.

## Verified

- All 36 retired workflows were archived intact.
- Four active workflow definitions remain in `.github/workflows/`.
- All original 14 web regression jobs were centralized; additional production build preflight checks were added.
- The full release-build integration job passed before the final run.

## Next action before a new production deployment

Diagnose the MySQL pre-deployment snapshot endpoint on the server. Do **not** remove its guard or lower data-integrity checks simply to force deployment. The snapshot logic depends on `config.php`, the `ghadir_state` table, filesystem write permissions for `storage/Backups`, and historic carton/count assertions. Determine the actual failure before changing any of these checks.

The release workflow remains manually runnable after the root cause is fixed.
