# Verification

## Initial clean-room proof

On 2026-10-20, the curated source was installed, built and exercised in one isolated Linux Blaxel worker. All final gates passed and provider-side deletion/inventory checks confirmed teardown.

- Source-manifest SHA-256: `4d6e606e714c3fce31c65506511b3f435bb28558ab04521a739c3b8db469a7ba`.
- Source archive SHA-256: `4a87d8cce17e204fe22f04cee32eab396b9f25baddd21065ba78ae04f1084f87`.
- Node 22.22.2; dependencies installed from the generated, retained npm lockfile.
- Source privacy/production-identity guard and combined build passed.
- **104 unit tests passed** across root integration, public site and feedback app (7 + 7 + 90).
- Real PostgreSQL sessions proved overlapping admission/quota/token/claim/send-fence races, rollback, fresh-recipient stock contention/exhaustion, stable retry, foreign-owner receipt refusal, and effective runtime/admin/sender LOGIN grants.
- Photo SQL capabilities, terminal erasure after delayed upload, failed-delete orphan reconciliation and the actual HTTPS export CLI's equal-length manifest-drift/digest checks passed with synthetic objects.
- Authenticated Chromium flows passed in English/Spanish at 390/1280 px: request link, intentional consume, critical feedback and `N/A`, unchecked photo consent, lost-response retry, stable code after re-login, attendee admin denial and owner/private export. No external requests, uncaught browser errors, axe violations or incomplete checks were reported in these four flows.
- The combined app ran in actual local Wrangler/workerd. Its default private gates, private-page aliases and source-file 404 boundaries passed. Twelve public routes at 320/390/768/1440 px produced **48 passing route/viewport checks**, with zero document overflow, browser errors, external requests, axe violations or incomplete checks. Locale switching, keyboard/fullscreen slides, no-JS reading, print-mode visibility and PDF generation were exercised.
- Wrangler deployment dry-run passed. `npm audit --omit=dev` reported **0 vulnerabilities**; this is not a claim that every development dependency was audited.

The process used synthetic recipients, non-redeemable values, a no-send outbox and isolated object adapters. No production deployment, attendee mail, provider redemption, existing event migration or credential change occurred.

## Final source and CI

After that snapshot, visual inspection prompted a wording-only benefit receipt correction (accurate for both codes and links), four focused passing regression cases, and screenshot capture that finishes finite CSS animations. Documentation and this verification record were also finalized. These changes are not silently attributed to the earlier immutable snapshot.

The repository's [verification workflow](https://github.com/arcacomputer/cafe-compute-kit/actions/workflows/ci.yml) reruns installation, source checks, builds, units, real PostgreSQL, authenticated browser flows, actual local-workerd public-page checks, deployment dry-run and the production-dependency audit for the exact public commit. Inspect its head SHA and terminal result; a workflow declaration or old run is not a new pass.

## Vercel port: separate evidence boundary

The native Vercel main/sender adapters were added after the initial clean-room snapshot above. Its recorded unit totals, PostgreSQL/Chromium and local-workerd results remain historical evidence for that snapshot, not a Vercel pass. The setup guides ([English](vercel-setup.md), [español](vercel-setup-es.md)) describe the current source/configuration; they do not certify a deployed Vercel project.

Keep any later native adapter, installed SDK, disposable PostgreSQL and Chromium results bound to their exact candidate and executed commands. A real PostgreSQL/browser leg may still use a synthetic mail outbox or object adapter. Actual Vercel catch-all/original-URL behavior, trusted IP headers, sender outside-root source/traces and final package exclusions require actual target-provider evidence. Live Neon HTTP transport/grants and authorized inbox delivery remain separate checks. No Vercel Blob production adapter is implemented; private photo uploads must remain off, and code-only storage fixtures are not Blob proof. No Vercel deployment or real email send is claimed by this documentation update.

### Native Vercel acceptance proof, 2026-10-20

[CI run 39404774905](https://github.com/arcacomputer/cafe-compute-kit/actions/runs/39404774905) passed on immutable source [`4e7032ada6ab9fdebdc6acf7eb7e0c3db03c9f16`](https://github.com/arcacomputer/cafe-compute-kit/commit/4e7032ada6ab9fdebdc6acf7eb7e0c3db03c9f16):

- Clean pinned-lockfile install on Node 22.22.2; source guard, shared build and Vercel packaging passed. **125 unit tests passed**, none failed or skipped.
- Actual `@vercel/node@25.0.0` builders and native SDK request handlers exercised both projects. Required main asset manifest and sender outside-root shared modules were present in the respective 56-file and 17-file traces; forbidden secret/proof inputs were absent. Public routes, disabled private access, protected index aliases, source-file 404s and sender authentication passed. The proof uses an already-materialized tree and the SDK dev protocol's canonical authority metadata; it is not a managed deployment/router test.
- Real PostgreSQL role/grant, quota/receipt, stable-assignment, send-fence, export and erasure checks passed. A Vercel limiter proof overlapped **110 attempts over two independent blocked database sessions: 100 admitted, 10 denied**, with a stored count of 100.
- The same English/Spanish feedback flows passed at 390/1280 px on Cloudflare and Vercel adapters: intentional magic-link consumption, feedback without photo consent, committed lost-response retry, stable benefit after re-login, attendee admin denial and owner dashboard/private export. Vercel exercised a separately authenticated HTTPS sender and production authorization/reviewed-release policy with disposable dummy identities and non-redeemable `SYNTHETIC_` inventory. Only the final mail-provider hop was synthetic; no real email or benefit redemption occurred.
- The existing actual-local-workerd public matrix retained **48 passing route/viewport cases**, keyboard/no-JS/fullscreen/print/PDF checks. The public matrix reported no document overflow; it and both authenticated browser matrices reported no external requests, browser errors, axe violations or incomplete checks. Screenshots and JSON artifacts were downloaded and inspected, including Vercel mobile form, Spanish benefit and organizer views.
- Wrangler dry-run and the production-dependency audit passed (0 vulnerabilities). Neither is a deployment or a full development-dependency security audit.

These results establish native SDK packaging and adapter/database/browser behavior for the pinned candidate, not live Vercel routing, platform header overwrite, actual project source/env settings, Neon HTTP transport, inbox delivery, Blob storage or sponsor redemption. Subsequent workflow runs must be checked against their own exact SHA; the historical result above does not silently cover later code changes.

## Reproduce

```sh
npm ci
npx playwright install --with-deps chromium
npm run check:source
npm run build
npm run test:unit
# After separately provisioning the local PostgreSQL/OpenSSL prerequisites:
PROOF_TMPDIR=/var/lib/postgresql npm run proof --workspace @cafe-compute-kit/feedback
npm run test:worker
```

The root CI service supplies an empty disposable PostgreSQL database with `PROOF_DATABASE_URL` and `PROOF_DISPOSABLE=yes`, then runs the independently initialized `test:postgres` and `test:browser` commands. See [PROOF.md](../apps/feedback/PROOF.md) for the precise destructive-fixture boundary. Never point these tests at real event data.

For the added Vercel gates, after installing dependencies and setting up the **parent-provisioned disposable local PostgreSQL** described in PROOF.md, run these sequentially from the repository root. The browser variant still intercepts the final mail hop; it does not send email:

```sh
npm run build:vercel
node scripts/proof-vercel-package.mjs
node apps/feedback/scripts/proof-vercel-postgres.mjs
PROOF_PLATFORM=vercel PROOF_OUTPUT_DIR="$PWD/.proof/vercel-feedback" npm run test:browser --workspace @cafe-compute-kit/feedback
```

## Limits

- This is Linux/local workerd plus actual PostgreSQL/native-adapter evidence, not a deployed Cloudflare/Neon HTTP transport test.
- Actual account permissions, bindings, R2 public-access settings, real email delivery, sponsor redemption and consent-policy adequacy require the operator's separately authorized checks.
- Photo originals are not guaranteed server-decoded, metadata-stripped or malware-free. Photos default off; lightweight key tombstones remain after content cleanup for repeat orphan reconciliation.
- Attendee/public pages and deployment guides support English and Spanish. The owner dashboard currently uses Spanish labels; its export schema and operator guide are documented in English.
- The screenshot in the README is the actual public **example template**, not a confirmed event or an attendee record.

Keep private operational data and raw sensitive logs out of issues, source and public CI artifacts. Synthetic proof does not authorize testing someone else's deployment.
