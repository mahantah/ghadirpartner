# Staff OTP stabilization — 2026-10-16

## Baseline and production evidence

- Repository main at inspection: `2a8bea4`.
- PR #7 merged; release run `38951157245` succeeded at commit `727d87f`.
- That one-time release downloaded current production `app.html`, replaced only login CSS/JS and cache tags, and checked health. Its workflow was then removed. It explicitly did not perform real OTP attempts.
- Public production `app.html` has `20261016b2` login references. Downloaded public CSS and JS are byte-identical to repository files.
- Guest Chrome desktop observation: transparent logo, navy background and full-width orange login button visible; no initial login-required alert observed. This is not an iPhone/Safari certification.
- The normal `deploy-final-v53438.yml` rebuilds from `GhadirPartner-Web-V5.3.4.38-FINAL-TOMAN-SESSION24H-HOMA-SERVICE.zip`, applies embedded and subsequent patches, then the staff OTP patch. Root app/API files are not the operational baseline.

## Reproduced defect and minimal repair

Both mutable OTP loops used `foreach ($s['staff_login_otp_requests'] ?? [] as &$r)`. PHP iterates a temporary expression here: changes to delivery status, attempts, expiry and consumption are not persisted in `$s`. A delivered code therefore remains pending and fails verification. The original file fails the synthetic `delivery state persists` regression check; the repaired file passes all 28 checks.

The repair validates that the collection exists, then iterates the actual array by reference. It also keeps the previous session challenge until replacement delivery succeeds. Previously the session pointer was deleted before the account-level 60-second throttle; a resend after 30 seconds could strand the original code.

Preserved: 5-minute lifetime, session binding, single use, five attempts, existing session uid, active staff-role checks, generic account-enumeration-safe responses, 30-second session and 60-second account throttles, SMS provider contract, password login/reset, business data and permissions.

## Validation

- PHP syntax checks; JavaScript syntax check; diff whitespace check.
- 28 synthetic contract checks with an in-memory persistence adapter and stub SMS sender. Covers success, consumed code, persisted attempts/lock/expiry, wrong session/account, deactivated account, ambiguity, unknown/nonstaff accounts, SMS failure, resend throttles, successful replacement and unchanged business-state sentinel.
- Locally executed using WordPress PHP-WASM CLI. A native PHP CI job is included for the PR, with no secrets or deployment steps.
- No real SMS sent; no real credentials, OTPs, personal data, or production database loaded into tests or published.

## Still required before declaring login stable

- Confirm deployed PHP helper matches the reviewed baseline through authorized server access. Public JS/CSS equivalence does not prove deployed PHP equivalence.
- Staging/integration checks against the actual MySQL adapter and Homa service; actual delivery and session-cookie continuity; password login and recovery regression.
- Real iPhone Safari and Android checks, tablet/desktop dimensions, keyboard/OTP autofill and resend interaction. Cloud Chrome observation is not equivalent to real-device testing.
- Inspect the provider's existing SMS audit storage for OTP-text retention before real testing. The base provider stores the rendered message; no provider logging changes are included in this scoped fix.

## Release boundary and rollback

Do not run the full deployment workflow merely to ship this helper: that rebuild may omit later live-only patches. After explicit owner approval and a fresh authorized backup, use a reviewed targeted deployment of only `lib/staff-login-otp.php`, retaining the previous helper outside the public document root. Syntax-check before atomic replacement, perform controlled login checks, and restore the previous helper if validation fails. Do not replace app.html, API entrypoint, configuration, storage or MySQL state for this repair. No deployment workflow is added here.

Dashboard redesign remains next, after this login flow is stabilized; it is not part of this branch.
