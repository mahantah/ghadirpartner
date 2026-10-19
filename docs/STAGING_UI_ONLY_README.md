# Ghadir Partner — staging-only UI release

**Do not merge this branch into `main` or run any production deploy.**

Branch: `staging/ui-only-safe-20261019`.

This branch replaces the **entire `app.html` file** with the validated staging build (derived from the recovered October 16 baseline), instead of adding partial, cumulative override patches. All application logic and auth control identifiers are retained. Supporting CSS, JS and WebP files are shipped only for the login UI.

The `.github/workflows/deploy-staging-ui.yml` workflow uploads **only** four UI files to the FTP root. It never uploads or deletes `config.php`, `.htaccess`, `index.php`, `index.html`, database, storage, or backups. It requires the isolated staging FTP user's root to be **`/home/ghadirpartner/staging_site`** and checks for the static sentinel `GHADIR_STAGING_UI_ONLY.marker` before any upload. If the marker is absent or credentials are not configured, deployment does not proceed.

## One-time setup (cPanel and GitHub)

1. Create a dedicated cPanel FTP account with its home directory restricted to `/home/ghadirpartner/staging_site`. **Do not use the production FTP account or root FTP account.** Require FTP over TLS (FTPS).
2. In the isolated staging folder only, create an empty file called `GHADIR_STAGING_UI_ONLY.marker` (not in `public_html`). Keep cPanel Directory Privacy enabled.
3. In GitHub Settings → Secrets and variables → Actions, preferably under the `staging` environment, set: `GHADIR_STAGING_FTP_HOST`, `GHADIR_STAGING_FTP_USER`, `GHADIR_STAGING_FTP_PASSWORD`. Never commit or paste secrets into chat.
4. Trigger a new commit to this branch to deploy, or run the workflow once available. First confirm only staging was updated and the protected login, test DB, and API still work.

**Warning:** The repository `main` may contain a stale root app and is not the source of truth for production. `staging` changes must not be merged or deployed to production without a separate reviewed release package and database safety checks.
