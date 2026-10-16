# Staff OTP sign-in, redesigned login and first-visit alert guard

This change is for the **currently deployed V5.3.4.38 family**, not the stale root `app.html`/`index.php` files.

## Integration

The manually-dispatched `.github/workflows/deploy-final-v53438.yml` builds the existing ZIP and applies the supplier/warehouse patches before applying `scripts/patch-staff-login-otp-v1.py` to that build output. It then copies `lib/staff-login-otp.php`, `assets/staff-login-otp.css`, `assets/staff-login-otp.js` and `assets/ghadir-logo-transparent.svg` during the deployment, along with the existing files.

**No production deployment is triggered by this PR.** The workflow runs only when manually dispatched.

## Existing behavior preserved

- `POST /api/login` and `staffLoginForm` — password-based login fallback
- `POST /api/staff-password-reset/request` and `/confirm` — password recovery, never used for sign-in
- `/api/bootstrap`, session identity `$_SESSION['uid']`, authorization checks, staff roles, all orders/inventory/customer data
- Current Homa SMS provider configuration, no hardcoded token and no additional credentials

## New flow

- `POST /api/staff-login-otp/request`: accepts `identity` (staff username or registered mobile); sends a six-digit code to the account's registered mobile
- `POST /api/staff-login-otp/verify`: accepts `identity` and `otp`; on success creates the same staff session as the password login and reloads the app
- Short-lived hashed OTP (five minutes), single-use, 5 verify attempts, session-bound, throttled requests and generic request responses
- Existing MySQL state is used; no destructive migration
- The previous password form stays as a fallback for staff without valid registered mobile numbers
- Branding: transparent user-supplied logo redrawn as an SVG, navy backdrop, centered auth card, Uiverse-inspired pill buttons, mobile layout, and animated loader
- Suppress the specific unauthenticated first-visit alert “ورود الزامی است” without hiding valid later authorization/expiration errors

## Pre-release checklist

1. On staging, test a verified Homa SMS recipient with a registered staff phone, a wrong code, expired code, resend throttling and a consumed code. Validate login sessions and all staff role permissions.
2. Test old password login and password reset, including SMS disabled or unavailable.
3. Test initial guest visit with a clean browser: **no “ورود الزامی است” alert**; test session expiration after a logged-in session separately.
4. Check desktop/mobile rendering, OTP and fallback toggle, and focus/keyboard operation.
5. Confirm previous deployment rollback backup is intact; take a fresh full cPanel/MySQL backup before manual production deployment.

## Local verification

The patch script was applied to the complete live-backup `app.html` and `index.php` (not real customer data). Passed `php -l` for both affected PHP files, `node --check` for the new JavaScript and inline app scripts, structure/marker checks, and PHP role/mobile ambiguity helper cases. **Homa delivery and live/staging browser integration tests have not yet been performed.**
