# Full Vercel setup and operations

[Español: guía completa](vercel-setup-es.md) · [Guide index](README.md) · [Static-only alternative](vercel-static-setup.md) · [Cloudflare deployment](deployment.md)

This path runs the public site, email sign-in, private feedback, owner dashboard/export and stable code/link allocation on **Vercel Functions + Neon PostgreSQL + a separate Vercel sender project using AgentMail**. No Cloudflare account is needed for this core, no-photo path. Cloudflare remains supported separately; do not mix its bindings or Wrangler deployment commands into this recipe.

**Implemented is not live-provider verified.** The native adapters share the existing business handlers and SQL; they are not a static mock or a new authentication system. This guide does not record a Vercel deployment, real Neon transport, inbox delivery or provider redemption. See [verification](verification.md), especially its Vercel boundary. Actual routing/original-URL behavior, trusted IP handling and sender outside-root tracing remain deployment acceptance gates. Do not enable real collection solely because a local adapter/browser proof passes.

## 1. Eligibility, scope and costs

Vercel Hobby is limited to **personal, non-commercial** use. Free attendance does not automatically qualify a company, sponsored or promotional ambassador event. Check the actual account scope and Vercel's rules; clarify uncertainty with Vercel or choose the [Cloudflare free-tier path](free-tier-setup.md). Do **not** activate Pro, a trial, a paid team, paid integrations or storage to complete these steps.[1][2]

Use your own repository/account and record the exact candidate, project identities, billing scope, database and canonical hostnames privately. One event gets one fresh isolated database and two Vercel projects. Staging needs its own pair, database, credentials and synthetic data; never copy a real-event Neon branch for tests. Provisioning, deployment, DNS, secret changes, imports, mail and benefit release are separate authorized actions, not installation hooks.

Neon and AgentMail have separate quotas; use their Free options only if suitable. Monitor Vercel requests/invocations/CPU/memory/transfer, database compute/storage/transfer and mail daily/monthly limits. **All main routes, including public assets, invoke the function**; sender calls add invocations. Large galleries also consume function bundle/memory/response capacity. Included usage is neither unlimited nor a zero-cost/per-attendee guarantee. See [provider quotas](free-tier-setup.md#limits-that-matter) and your actual consoles. Pause when limits are inadequate; never upgrade automatically or evade quotas.[1][2]

The Vercel packager enforces **4 MiB per compiled public asset** and **32 MiB total for the encoded JSON asset manifest**, leaving function-bundle and response headroom for standard projects. These are conservative kit limits, not Vercel plan quotas. Resize/compress approved public media or choose the static-only alternative if the build rejects a gallery. Private attendee photos remain unsupported and off on Vercel.

## 2. Prepare the reviewed source and database

Use Node **22.22.2** for reproducible local checks. Root/feedback accept `>=22.22.2 <23`; Vercel should select **Node 22.x**, and you must inspect the managed resolved patch and engine compatibility. Only 22.22.2 is identified here as the exercised baseline, not every managed patch.

```bash
node --version
npm --version
npm ci
npm run check:source
npm run build:vercel
```

These are local preparation commands, not a reported execution result or deployment. Customize public event JSON in both languages, with `feedbackUrl:"/feedback/"`. The default build uses `config/event.example.json`; edit that public file in your fork or deliberately set main's build to `npm run build:vercel -- --config config/my-event.json`. Never put owners, roster, stock or secrets there. Server branding is separate.

Apply the complete fresh migration chain and create separate SQL LOGINs as in [fresh Neon and least privilege](deployment.md#3-fresh-neon-postgresql-and-least-privilege-roles). That database section is provider-independent; stop before its Worker configuration. Use TLS URLs and verify effective allowed **and denied** operations as each actual login:

| Authority | Use |
| --- | --- |
| Migration/operator, `cc_owner` | Trusted external shell only: migrations, imports, bootstrap, review and cleanup. Never Vercel or CI. |
| `cc_runtime` login | Main `DATABASE_URL` only. |
| Read-only `cc_admin` login | Main `FEEDBACK_ADMIN_DATABASE_URL` only. Not an import credential. |
| `cc_sender` login | Sender `DATABASE_URL` only; constrained mail authorization. |

These are different credentials into the same event database, not three copies of its schema. Neon-created elevated roles can inherit `neon_superuser`; do not use them as application logins. Never replace a failed runtime query with the migration-owner URL.

## 3. Two projects, two roots

Import the same reviewed repository **twice**, as two distinctly named projects in the intended scope. Choose **Framework Preset: Other**, Node 22.x and the root lockfile/workspaces. Vercel supports a separate project per monorepo directory.[3][6]

| Setting | Main project | Sender project |
| --- | --- | --- |
| Root Directory | Repository root, `.` | `vercel/sender-project` |
| Project configuration | Root [`vercel.json`](../vercel.json) | [`vercel/sender-project/vercel.json`](../vercel/sender-project/vercel.json) |
| Entrypoint | `api/main.mjs` | `api/magic.mjs` relative to sender root |
| Build command | `npm run build:vercel` | `node build.mjs` |
| Output Directory | `vercel/empty-public` | `public` relative to sender root |
| Configured maximum duration | 60 seconds | 30 seconds |

Do not use the static guide's `installCommand:node --version`: these functions need dependencies installed from the checked-in root lockfile. Inspect install/build logs for the workspace and pinned packages, including `@vercel/functions@3.10.1` and the checked-in Neon version. Do not run migrations/seeding in builds. Confirm the project settings and selected configuration actually agree; file-level `vercel.json` overrides relevant dashboard settings.[3][8]

**Sender outside-root source is mandatory:** in the sender project's Root Directory settings enable **Include source files outside of the Root Directory in the Build Step** (or the equivalent monorepo source-inclusion setting). The sender imports `../../sender.mjs` from its API file, then shared `apps/feedback` modules and Neon. Verify this setting by reading it back and inspecting the produced function trace/bundle, not just saving the checkbox. Disable unaffected-project skipping if it could miss changes to shared files outside the sender package. A build that omits those imports is a blocker; never copy provider credentials into main to work around it. Exact source inclusion/tracing has not been proven on an actual Vercel build by this guide.

Both output directories are **intentionally empty**. Main's build packages only checked public compiled assets into `vercel/generated/public-assets.json`, explicitly included in its private function bundle. Sender's helper creates its empty output. Keep the ordered catch-all function routes **before filesystem**; do not add SPA fallbacks, change output to `dist`/`.` or expose authenticated HTML placeholders. Verify the final trace contains needed modules/manifest and no private files. Root `.vercelignore` is defense in depth, not permission to keep private inputs anywhere in the checkout.

## 4. Canonical origins and production-only environment

After creating the project identities, use their **actual stable production** `vercel.app` origins or authorized custom domains. No purchased domain is required. Record one exact HTTPS origin for main and one for sender, without a path, credentials, query or fragment; use the no-trailing-slash spelling consistently. `PUBLIC_ORIGIN` means **main** in both projects. `SENDER_ORIGIN` means **sender** in both. They are different origins. Never derive them from request headers or ephemeral `VERCEL_URL`.

Install the following as **project-level, Production only** environment variables. Do not select Preview/Development or team-wide shared secrets. Never use `NEXT_PUBLIC_*`, browser JSON, public HTML or a downloaded real `.env` for them. Environment changes apply to **new deployments**, not existing ones; after every approved change redeploy the intended project and verify the active deployment's state without exposing values.[7]

### Main production projection

| Variable | Exact purpose / initial value |
| --- | --- |
| `PUBLIC_ORIGIN` | Main canonical HTTPS origin. |
| `SENDER_ORIGIN` | Sender canonical HTTPS origin, fixed destination for `/magic-link`. |
| `EVENT_NAME`, `PROVIDER_NAME`, `BENEFIT_DESCRIPTION` | Authorized server-side text, consistent with public copy. |
| `DATABASE_URL` | Secret TLS URL of the `cc_runtime` login. |
| `FEEDBACK_ADMIN_DATABASE_URL` | Secret TLS URL of the distinct `cc_admin` login. |
| `OWNER_EMAILS` | Private comma-separated canonical owner email allowlist; bootstrap still required. |
| `AUTH_SECRET` | Independent high-entropy server secret. |
| `FEEDBACK_SIGNING_KEY` | A different independent high-entropy server secret. |
| `MAILER_SERVICE_TOKEN` | The shared sender token described below. |
| `CREDIT_LINK_ORIGINS` | Approved exact HTTPS redemption origins, comma-separated without spaces, consistent with imports; never stock values. |
| `AUTH_ENABLED`, `FEEDBACK_ENABLED`, `MAGIC_EMAIL_ENABLED` | Each exactly `false` initially. |
| `CREDIT_CLAIMS_ENABLED`, `REAL_CREDIT_DISTRIBUTION` | Each exactly `false` initially. |
| `PHOTOS_ENABLED`, `PRIVATE_PHOTO_METADATA_ACK` | Each exactly `false`, and must remain so on Vercel. |

### Sender production projection

| Variable | Exact purpose / initial value |
| --- | --- |
| `PUBLIC_ORIGIN` | The same **main** origin, not sender's origin; constrains login links. |
| `SENDER_ORIGIN` | Sender's own exact canonical HTTPS origin. |
| `EVENT_NAME`, `PROVIDER_NAME`, `BENEFIT_DESCRIPTION` | Same authorized text as main. |
| `DATABASE_URL` | Secret TLS URL of the distinct `cc_sender` login. |
| `MAILER_SERVICE_TOKEN` | Exactly the same token as main. |
| `AGENTMAIL_SEND_KEY` | Broad provider key: **sender only**. |
| `APPROVED_INBOX` | Your approved AgentMail inbox identifier. |
| `REPLY_TO` | Your authorized reply address. |
| `MAIL_SEND_ENABLED` | Exactly `false` initially. |

Generate a random **32-byte value encoded as exactly 64 lowercase hexadecimal characters** for `MAILER_SERVICE_TOKEN`. No prefix, quotes, whitespace or newline in the installed value. Generate independent auth/signing secrets too; never reuse this token. For example, in a trusted local shell, with `PRIVATE_DIR` already set to an existing restricted directory outside the repository:

```bash
# Writes new private files; does not print secrets or install them anywhere.
# noclobber refuses existing files. Read values only through your trusted secret UI.
(
  set -eu
  set -C
  umask 077
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/mailer-service-token.txt"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/auth-secret.txt"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/feedback-signing-key.txt"
)
```

Install values privately in the exact project's Production settings; verify names/scope and token equality without logging values. The main environment **must not contain** `AGENTMAIL_SEND_KEY`, `APPROVED_INBOX`, `REPLY_TO`, sender's DB URL or operator credentials. Sender must not contain runtime/admin DB URLs, `AUTH_SECRET`, `FEEDBACK_SIGNING_KEY` or `OWNER_EMAILS`. The adapters project explicit string allowlists, but project/deployment access still exposes installed secrets: allowlists do not fix overprovisioning.

Do **not** create environment strings named `TEST_DATABASE`, `TEST_ADMIN_DATABASE`, `MAGIC_MAILER`, `FEEDBACK_RATE`, `FEEDBACK_PHOTOS` or `ASSETS`. Those are code-level capabilities, not configurable Vercel secrets. The Vercel adapter supplies a durable PostgreSQL-backed feedback rate limiter (100/minute per derived key), the constrained HTTPS sender client and asset adapter. No Cloudflare binding is required. Main uses the real SDK IP helper and `waitUntil`; supplied Cloudflare IP headers are replaced, invalid/missing trusted IPs fail closed. `waitUntil` shares the invocation deadline, not a durable queue.[4][5]

## 5. Deploy dark and verify the actual provider

Only after explicit publication/resource approval, deploy **sender first, then main**, with every gate above off. Dashboard import can itself deploy; verify dark settings before confirming it. Git-linked pushes may redeploy both projects. Never use a real production env download in local proof; keep Preview/Development unconfigured/dark. A synthetic hosted rehearsal requires separate isolated projects/resources and its own explicitly configured origins, not production preview credentials.

Read back each exact project, active source/deployment, Node version, environment names/scope and configured routes. Verify:

- Main `/`, `/en/`, resources, slides, recap/gallery, public asset MIME and security headers; missing paths and source/secret paths return real 404, not a homepage. Both locales work on mobile/keyboard.
- Private `/feedback/`, `/en/feedback/`, sign-in/credit routes, slash and `.html`/`index.html` aliases never expose static authenticated forms. Disabled private actions are unavailable; canonical redirects are not an authentication bypass.
- Vercel preserves the **original requested URL/path** when routing to `/api/main` or `/api/magic`. Test actual provider behavior, not request-supplied original-route headers or query hints. If the adapter sees only the destination route, stop: do not weaken host/private-route checks or invent a header workaround.
- Noncanonical origins are denied (`421`) unless an intentionally configured edge alias redirects first. Trusted IP metadata comes from Vercel; forging a `CF-Connecting-IP` header cannot select a rate identity. Missing/invalid trusted IP or lifecycle support fails closed (`503`).
- On sender's canonical origin, a harmless request **without Authorization** to `/magic-link` returns `401` from the app, before database/provider access. Vercel login HTML/redirect is not this result. Do not put the service token in curl history or send an authenticated fake mail as a health probe. Sender accepts only authorized `POST /magic-link`, no query, fixed templates and DB-authorized token/recipient with a durable one-attempt fence.
- Sender's final trace includes the shared outside-root modules and pinned dependencies. Main's manifest/bundle has only approved public assets, never private inputs. Build success alone does not verify deployed routing or secret exclusion.

**Deployment Protection is separate from app authentication.** Main must be publicly reachable on its intended event origin. Sender's HTTP ingress is public but **bearer-authenticated**, unlike Cloudflare's private service binding. It must be reachable server-to-server without a Vercel SSO challenge or redirect; the client follows no redirects. Change only the exact intended production project's protection after exposure review, retain preview protection, and never add a public relay/bypass. This kit does not implement Vercel protection-bypass credentials. Unexpected `401`/redirect HTML is a blocker, not proof of sender health.

For custom domains, attach each hostname to its correct project, confirm certificate and provider-requested DNS records, and keep existing DNS service/nameservers unless a change is expressly approved. Back up DNS including MX/TXT; modify only reviewed web records. Make aliases deliberate edge redirects to one canonical origin, preserving path/query; do not accept arbitrary aliases in the application. Keep mail/claims dark during host changes. Update both projects' origin values and public absolute URLs, redeploy, and verify the canonical host plus alternate-host denial/redirect before sending links. Existing cookies are host-only and old links can become invalid.

## 6. Owner bootstrap, feedback and controlled release

The [operator runbook](operators.md) applies unchanged to this SQL/business flow. Run its CLI tools from a trusted external operator shell using `OPERATOR_DATABASE_URL`, never main's runtime URL for imports. In order:

1. Set the owner allowlist and follow [access-only bootstrap](operators.md#4-owner-access-without-claim-rights), dry-run then approved `--apply`. Read back the exact row: `eligible=true`, `claim_eligible=false`, no fabricated attendance. Owner allowlisting alone does not create login access or benefit rights.
2. Review roster/check-ins, exceptions, exact stock values/prior allocations and holds; dry-run then explicitly approve imports. Login access (`eligible`) and claim rights (`claim_eligible`) remain separate. Never visit bearer redemption URLs to test stock.
3. With separate authorization for actual collection/login delivery, set main `AUTH_ENABLED=true` and `FEEDBACK_ENABLED=true`; enable sender `MAIL_SEND_ENABLED=true` and deploy it, then main `MAGIC_EMAIL_ENABLED=true` and deploy main. Keep both claim flags and both photo flags `false`. Use only an authorized controlled recipient for the separately approved real-mail check. A generic login response is not evidence of eligibility or inbox delivery.
4. Verify an actual first Neon query through this deployment, intentional single-use login confirmation, Secure/HttpOnly/host-only cookie, saved critical feedback/`N/A`, receipt retry, anonymous/attendee owner denials and owner export. Do not paste cookies/tokens/answers into reports. Photos and promotional consent are optional, never benefit prerequisites.
5. Complete [release review](operators.md#5-review-and-release-gates) after all imports/bootstrap. Only with approved real release and valid database review set main **both** `CREDIT_CLAIMS_ENABLED=true` and `REAL_CREDIT_DISTRIBUTION=true`, redeploy and read back effective settings. Authentication/feedback can stay available while claims are off. Imports invalidate previous review. Assignment remains stable across retry/re-login; assignment/reveal is not provider redemption.

The owner dashboard is `/feedback/admin` (currently Spanish labels); use the runbook for paginated [private export/manual sharing](operators.md#private-export-and-manual-sharing). A `.incomplete` directory is not a finished export. Review free text/rights before any sharing, even without contact columns. No automatic sponsor forwarding is provided.

## 7. Photos, retention, incidents and rollback

**Private participant photo uploads are unsupported on Vercel. There is no production Vercel Blob adapter yet.** Keep `PHOTOS_ENABLED=false` and `PRIVATE_PHOTO_METADATA_ACK=false`; do not create Blob tokens, public buckets or R2 workarounds. Setting `PHOTOS_ENABLED=true` without code-injected storage makes the production adapter return **503 for the deployment**, not successful uploads. A synthetic native object adapter proves only its exercised test boundary. The public consent-cleared gallery is separate: reviewed local public derivatives may be built into the asset manifest; it is not an upload bucket.

Follow [retention/cleanup](operators.md#retention-and-cleanup) with an approved plan, dry-run and exact readback. With no photos, verify there are no planned object targets before any `--objects-deleted yes` acknowledgement. Preserve minimal recipient/allocation history to prevent reissue; remove private exports, cookies and backups under their own policy. Database cleanup is not automatic erasure of every copy.

For containment, disable main claim/distribution/feedback/mail gates and sender `MAIL_SEND_ENABLED`, redeploy the intended projects and verify denial paths; disable `AUTH_ENABLED` too when pausing authentication. **Saving env values alone does not stop the active deployment.** Reconcile uncertain writes/mail before retrying. Preserve DB, allocations, reveal history and private incident evidence. Rotate affected credentials only under an approved recovery plan; token rotation must update both projects while mail is dark. Roll back to schema-compatible known-good main **and** sender deployments/configuration, verifying the env captured by each: promoting an old deployment can restore old gates. Do not restore an old database to undo code, clear send fences or reissue stock. If compatibility is uncertain, keep the app dark and forward-fix.

## 8. Troubleshooting and evidence ledger

| Symptom | Safe check |
| --- | --- |
| `421 Invalid host` | Compare actual canonical request URL/Host with main `PUBLIC_ORIGIN` or sender `SENDER_ORIGIN`; inspect aliases and provider routing. Never disable the check. |
| Widespread `503` | Check exact origin/config, both photo flags off, SDK IP/lifecycle, manifest trace and Node engines. With mail enabled, malformed sender origin/token can make main unavailable. |
| Feedback `503` | Check runtime URL/grants, signing secrets and enabled flags; limiter is adapter-supplied SQL, not a Cloudflare namespace/env string. |
| Generic login, no email | Verify access row, active sender/main flags, identical service token, sender reachability without SSO/redirect, sender role and private sanitized attempt metadata. Never infer delivery or blindly resend. |
| Sender build cannot resolve imports | Read back outside-root source setting and full function trace; do not consolidate the projects or grant main the provider key. |
| Owner forbidden / claim blocked | Verify access-only bootstrap/allowlist/session separately from claim eligibility, current release review, coverage and both claim flags. Never expand grants or reset assignments. |
| UI works but wrong path/aliases leak | Stop real collection, inspect actual Vercel routing and artifact contents; static fallback is not an acceptable fix. |

Record exact candidate, runtime, check commands/results and each boundary separately: source/unit; installed native SDK adapter; real disposable PostgreSQL; Chromium; actual Vercel build/routing/source trace; live Neon privileges/transport; authorized email acceptance **and inbox delivery**. Real database/browser proof may still use synthetic outbox/storage. No local pass proves live provider storage/privacy, delivery, redemption, eligibility for Hobby or legal sufficiency. Keep operational evidence private; [verification](verification.md) preserves historical results without applying them to a later Vercel candidate.

## Sources

[1] https://vercel.com/docs/plans/hobby
[2] https://vercel.com/docs/limits/fair-use-guidelines
[3] https://vercel.com/docs/builds/configure-a-build
[4] https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
[5] https://vercel.com/docs/functions/functions-api-reference
[6] https://vercel.com/docs/monorepos
[7] https://vercel.com/docs/environment-variables
[8] https://vercel.com/docs/project-configuration/vercel-json
