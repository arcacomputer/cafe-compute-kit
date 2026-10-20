# Cloudflare deployment walkthrough

Start with [getting started](getting-started.md). These steps are for **your own new event**. Provisioning, secret updates, uploads, domain changes, mail and real release are separate external side effects; execute each only after its checklist. No command belongs in an install hook.

For a free-tier-first deployment, start with [free-tier setup](free-tier-setup.md): provider-assigned hostnames, photos off, explicit CPU/database/email quotas and no automatic paid upgrades. For native Vercel login/feedback/admin/codes use the [full Vercel guide](vercel-setup.md) ([español](vercel-setup-es.md)); for public pages only use the [static alternative](vercel-static-setup.md). Hobby eligibility and live-provider proof gates apply. The walkthrough below remains the Cloudflare path; the fresh Neon role model is shared.

## 1. Freeze the target

Record privately: repository commit/candidate, intended Cloudflare account and billing owner, hostname/zone, new Worker names, new Neon project/database and optional new R2 bucket. Get approval for costs before provisioning. Verify the authenticated account rather than relying on a login or account display name:

```bash
npx --no-install wrangler whoami
```

If inherited Cloudflare environment credentials shadow the intended OAuth identity, resolve that before proceeding. Do not print tokens. A valid Worker upload credential need not have DNS-write permission.

Choose:

- **Static-only:** publish `apps/event-site/dist/`, no feedback Worker, database, sender or R2.
- **Combined:** publish root `dist/` through `apps/feedback/worker.js` and `ASSETS`.
- **Feedback-only:** use `apps/feedback/wrangler.jsonc` with app-local `dist/`.

Keep operator-specific configuration outside the public repository. In examples below, set `MAIN_CONFIG`, `SENDER_CONFIG` or `STATIC_CONFIG` to the absolute paths of your reviewed external Wrangler files. Copy the applicable checked-in sample; when moving a config outside its original directory, change **all relative paths**, especially `main`, `assets.directory` and `$schema`, to correct absolute paths. There is no universal private-config filename to copy/paste.

## 2. Static-only branch

1. Configure public content as described in [getting started](getting-started.md). Point `feedbackUrl` at an intentionally deployed separate feedback app, or set it to `null` for a no-backend publication. A static host cannot turn that link into authenticated feedback; never publish an authenticated form as a static preview.
2. Run the event-site workspace build and inspect only its `dist/`.
3. Copy `apps/event-site/wrangler.jsonc` to your external `STATIC_CONFIG`. Set a unique Worker name, preserve a reviewed compatibility date and point `assets.directory` to that app's absolute `dist/`. Do **not** add the feedback entrypoint, service/DB/R2 bindings or secrets. Disable `workers_dev`/`preview_urls` unless deliberately using an isolated public preview.
4. Review the account, public artifact contents and optional hostname. Then:

```bash
# Local bundle/config validation only; not proof of a live deployment.
npx --no-install wrangler deploy --dry-run --config "$STATIC_CONFIG"
# External publication: run only after explicit approval.
npx --no-install wrangler deploy --config "$STATIC_CONFIG"
```

Read back the exact uploaded/active version and live route content. For a custom hostname follow [domain setup](#custom-domain-and-rollback). Static hosting elsewhere is possible, but you must supply its own routing/headers proof; this guide does not imply another vendor integration.

## 3. Fresh Neon PostgreSQL and least-privilege roles

Skip this section for static-only. Create a **fresh empty** database/project for this event, not a copy of a real event. Use TLS and protect connection strings. Staging and live must be separate; the template is not multi-tenant.

### Apply the fresh migration chain

Use a trusted migration login with the provider permissions required to create roles and grant/set `cc_owner`. Never use a runtime login to apply migrations. Configure a private libpq service named `cafe_compute_migration` pointing at the exact fresh database; keep service/password files outside Git with restrictive permissions. Inspect the target identity interactively before writing.

```bash
# Database writes, only after confirming the fresh target.
PGSERVICE=cafe_compute_migration psql -X -v ON_ERROR_STOP=1 \
  -f apps/feedback/migrations/001_schema.sql
PGSERVICE=cafe_compute_migration psql -X -v ON_ERROR_STOP=1 \
  -f apps/feedback/migrations/002_functions_grants.sql
```

Read all files in `apps/feedback/migrations/` in lexical order and apply any later numbered migration deliberately as well. These are fresh-schema migrations, not a way to upgrade an unrelated historical event. If a migration fails or objects already exist, stop and inspect; do not blindly rerun, drop tables or weaken grants. Do not run legacy root SQL or scripts from a private original deployment.

The migrations create NOLOGIN capability groups:

| Group | Capability | Where its separate login is used |
| --- | --- | --- |
| `cc_owner` | Owns schema/functions; trusted import/review/cleanup authority. | Restricted migration/operator shell only. |
| `cc_runtime` | Auth/session operations, feedback admission/upload metadata and allocation function execution; no direct stock/release access. | Main `DATABASE_URL`. |
| `cc_admin` | Read-only feedback for owner views/exports. | Main `FEEDBACK_ADMIN_DATABASE_URL`, never browser config. |
| `cc_sender` | Execute constrained mail authorization. | Sender `DATABASE_URL` only. |

Neon Console/API-created roles can inherit `neon_superuser` rights. **Do not use those elevated defaults for runtime/admin/sender.** Create application logins through SQL with only their intended group membership, then inspect effective privileges. For example, as the trusted owner in the fresh database:

```sql
CREATE ROLE kit_runtime_login LOGIN INHERIT NOCREATEDB NOCREATEROLE;
CREATE ROLE kit_admin_login LOGIN INHERIT NOCREATEDB NOCREATEROLE;
CREATE ROLE kit_sender_login LOGIN INHERIT NOCREATEDB NOCREATEROLE;
GRANT cc_runtime TO kit_runtime_login;
GRANT cc_admin TO kit_admin_login;
GRANT cc_sender TO kit_sender_login;
```

Set separate strong passwords using your trusted secret manager/interactive `psql \password` workflow; do not embed passwords in SQL, shell history or documentation. Grant only needed CONNECT on this exact database if required by its connection policy. Do not grant these logins `cc_owner`, `neon_superuser`, broad data-reader/writer roles, schema CREATE or role-administration rights. Keep migrations/provider-admin credentials separate from them.

Connect as **each actual login** and verify allowed and denied operations, function execution, role inheritance, table grants and trusted function search paths. `cc_admin` is read-only, not an import/release operator. SQL-level `NOLOGIN` groups do not automatically create connection URLs. Native disposable PostgreSQL tests and this operator's Neon grant check are different evidence layers.

## 4. Main Worker settings, assets and secrets

For the combined config, preserve these relationships (an excerpt, not a complete config):

```jsonc
{
  "main": "apps/feedback/worker.js",
  "assets": {"directory": "./dist", "binding": "ASSETS", "run_worker_first": true},
  "workers_dev": false,
  "preview_urls": false
}
```

Those relative paths apply only to a config in the repository root; adapt them for the external `MAIN_CONFIG`. Feedback-only uses its own `worker.js` and `dist/`. `run_worker_first=true` is important: Cloudflare otherwise serves matching assets before your Worker. Keep APIs and private routes behind the Worker, use a real 404 rather than an SPA fallback, and never point assets at the repository root or private files.

Set nonsecret Worker vars deliberately:

- `PUBLIC_ORIGIN`: exact canonical HTTPS origin, no path/query/fragment/credentials; use the same value in the sender and build-time feedback configuration. Do not derive it from an incoming Host header. Configure event title/provider/benefit text consistently with authorized public facts.
- `CREDIT_LINK_ORIGINS`: approved exact HTTPS redemption origins; import/runtime must agree. These are origins, not stock values.
- All side-effect flags initially `false`: `AUTH_ENABLED`, `FEEDBACK_ENABLED`, `MAGIC_EMAIL_ENABLED`, `CREDIT_CLAIMS_ENABLED`, `REAL_CREDIT_DISTRIBUTION`, `PHOTOS_ENABLED`, `PRIVATE_PHOTO_METADATA_ACK`. Sender `MAIL_SEND_ENABLED=false`.
- A `FEEDBACK_RATE` rate-limit binding is required by the feedback handler. Choose an account-unique namespace ID and reviewed limits; retain schema-supported period values and test event/shared-network behavior. This edge limiter is separate from DB business quotas.

Main secrets are `DATABASE_URL` (runtime login), `FEEDBACK_ADMIN_DATABASE_URL` (read-only admin login), `AUTH_SECRET`, a different `FEEDBACK_SIGNING_KEY`, and `OWNER_EMAILS`. Generate independent high-entropy signing secrets in a trusted manager. Never put owner addresses or connection strings in public event JSON, `[vars]`, generated HTML or CI logs.

**Secret writes can activate a new Worker version.** Confirm the exact target/config/account and all send/claim gates are off before each mutation; read back secret names and deployment state without printing values.

```bash
# External encrypted secret writes; each prompts privately for its value.
npx --no-install wrangler secret put DATABASE_URL --config "$MAIN_CONFIG"
npx --no-install wrangler secret put FEEDBACK_ADMIN_DATABASE_URL --config "$MAIN_CONFIG"
npx --no-install wrangler secret put AUTH_SECRET --config "$MAIN_CONFIG"
npx --no-install wrangler secret put FEEDBACK_SIGNING_KEY --config "$MAIN_CONFIG"
npx --no-install wrangler secret put OWNER_EMAILS --config "$MAIN_CONFIG"
```

For local Wrangler, use an ignored, restricted `.dev.vars` next to its config, with **disposable** values only. Do not source live `.env` files to make a preview work. Inspect the example but do not treat placeholder strings as usable credentials.

## 5. Separate private mail sender

Copy `apps/feedback/mailer/wrangler.jsonc` into your external sender config and adapt paths. Use a unique sender identity, `workers_dev=false`, `preview_urls=false` and **no routes/custom domains**. The main Worker gets only a service binding named `MAGIC_MAILER` pointing at this exact private sender Worker. No public sender endpoint is needed.

Set the same canonical `PUBLIC_ORIGIN` and approved event text. Keep `MAIL_SEND_ENABLED=false`. Install only the sender's secrets:

```bash
npx --no-install wrangler secret put DATABASE_URL --config "$SENDER_CONFIG"
npx --no-install wrangler secret put AGENTMAIL_SEND_KEY --config "$SENDER_CONFIG"
npx --no-install wrangler secret put APPROVED_INBOX --config "$SENDER_CONFIG"
npx --no-install wrangler secret put REPLY_TO --config "$SENDER_CONFIG"
```

Use the `cc_sender` login here, not runtime/admin/owner credentials. The AgentMail key may be broad; confine it to this service and restrict who can deploy/call that service. It must never enter the main Worker, public config or fixtures. The fixed adapter validates template, language, exact origin/path and token/destination authorization and fences one attempt per token. Do not turn it into a generic mail relay.

An accepted provider response is not inbox delivery. A timeout is ambiguous; inspect private provider attempt metadata before any retry. Routine test/browser flows use an isolated no-send outbox, not a real provider key. Real delivery testing is a separately approved operator action to an authorized test recipient; it is not implied by deploying with gates off.

## 6. Optional private R2 photos

Leave both photo flags false and omit `FEEDBACK_PHOTOS` unless you explicitly accept [private-original metadata retention](security.md#photos-default-off-private-originals-only) and have a privacy/retention process. If accepted, create a new event-specific private bucket, verify both `r2.dev` access and public custom domains are disabled, then bind it to `FEEDBACK_PHOTOS` in the main config. Do not enable public hosting or bucket listing for a gallery.

Only after this acknowledgement may both `PHOTOS_ENABLED` and `PRIVATE_PHOTO_METADATA_ACK` become `true`. Upload acceptance is not evidence of EXIF removal, safe decoding or participant reuse consent. Test ownership and owner-only photo reads using synthetic staging objects; verify the actual bucket settings separately from an in-memory object adapter.

## 7. Deploy dark, then verify

Build from the reviewed candidate; scan the public artifact and run the applicable [checks](getting-started.md#checks). Keep all features disabled for the first upload. Confirm no live bindings, routes or config from another event were copied.

```bash
# Local bundle validation; does not exercise Neon/R2/provider delivery.
npx --no-install wrangler deploy --dry-run --config "$SENDER_CONFIG"
npx --no-install wrangler deploy --dry-run --config "$MAIN_CONFIG"
# External deployment, only after account/resource review and explicit approval.
npx --no-install wrangler deploy --config "$SENDER_CONFIG"
npx --no-install wrangler deploy --config "$MAIN_CONFIG"
```

Read back active version/configuration, exact service/bucket bindings and secrets **names**, then verify HTTPS/public routes and disabled private flows on the intended isolated hostname. A Worker with no custom route and `workers_dev=false` is not publicly reachable yet; that is expected. If using a provider preview, deliberately enable only that isolated hostname and configure it as the canonical origin; never weaken host checks to support arbitrary previews.

After migrations/grants are verified, synthetic staging proof may enable auth/feedback with fake outbox/object adapters only through the supported proof harness. A live operator can separately enable auth/feedback and magic-link delivery after approval; keep benefit claims/distribution off until the [roster/inventory/release checklist](operators.md) is complete. There is no public authentication bypass to preview a private form.

## Custom domain and rollback

Before hostname changes:

- [ ] Confirm the intended account has the exact active Cloudflare zone; export authenticated DNS records and existing Worker/custom-domain state privately, including MX/TXT and original web records.
- [ ] Record current code/version, bindings, schema compatibility and rollback target. Confirm the token can perform the exact route/DNS operations; upload authorization alone is insufficient.
- [ ] Choose one canonical HTTPS origin. A second alias needs an explicit edge redirect preserving path/query, not an extra accepted private origin. Review active tokens/sessions before changing canonical host.
- [ ] Obtain approval for public exposure/DNS mutation; keep mail/claims dark during cutover.

Add a Worker Custom Domain in **Workers & Pages → your Worker → Settings → Domains & Routes**, or add `routes: [{"pattern":"event.example.invalid","custom_domain":true}]` to your private config with **your actual authorized hostname** and deploy deliberately. The example hostname is not deployable. Cloudflare manages DNS/certificate issuance for the custom domain. If an existing web A/CNAME conflicts, back it up, remove only that confirmed web record and restore it immediately if attachment fails; do not touch MX/TXT or unrelated services.

Read back the domain/certificate and active version; verify HTTPS, canonical/alias behavior, `/`, `/en/`, resources/slides/recap, missing-route 404, headers, and feedback routes in both locales including slash variants. Verify a real first DB query and anonymous/attendee/owner denials in an authorized isolated test. Do not consume real attendee links or stock. Rebuild absolute/canonical public links if host configuration changed. Only then follow explicit operator release gates.

For rollback, pause new claims, writes/uploads and sending, then route traffic to a **schema-compatible** known-good Worker version/configuration. Restore backed-up DNS only if the domain move itself must be reversed, and read back provider and public state. Preserve the database, R2 objects, prior allocations, assignment/reveal timestamps and source ledger. Never restore an old DB snapshot merely to roll back code: that can erase assignments and cause duplicate distribution. Reconcile uncertain writes/mail before retrying. If old code requires a destructive schema rollback or weakens gates, keep the service dark and forward-fix instead.

## Provider references

Consult current official docs alongside the pinned Wrangler version; newer docs may describe features not in that CLI:

- [Workers assets bindings/routing](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Secrets and version activation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [R2 public-access settings](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Neon roles and elevated defaults](https://neon.com/docs/manage/roles)
