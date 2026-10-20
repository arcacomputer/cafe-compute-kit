# Private feedback / benefits app

Cloudflare Worker + Neon PostgreSQL, optional **private** R2 originals, and a separate private AgentMail sender. One event per **fresh isolated PostgreSQL project/cluster**. The migrations create cluster-wide capability roles; do not reuse a production cluster or replay historical migrations. This is not a sponsor redemption API. Assigned means assigned, not redeemed.

## Deployment prerequisites

- Node 22.22.2 and the root workspace lockfile/dependencies.
- A canonical HTTPS origin you control. `PUBLIC_ORIGIN` must be an origin only (no path/query/credentials).
- A new Neon project/database and trusted migration/operator credential with role-creation authority. This credential is never a Worker secret.
- A Cloudflare account, a separately deployed private sender Worker and approved sender inbox/API credential. R2 is optional and disabled by default.
- Reviewed roster/check-in evidence, typed inventory and sponsor terms. Do not invent attendance or send test invitations to real attendees.

### 1. Fresh schema and separated logins

Using the trusted operator connection, apply **only** `migrations/001_schema.sql`, then `migrations/002_functions_grants.sql`, with `psql -v ON_ERROR_STOP=1`. Each migration is transactional. Run once in a fresh isolated project. Create three distinct `LOGIN INHERIT` users, then grant `cc_runtime`, `cc_admin`, and `cc_sender` respectively. Use `psql`'s interactive `\password` or your provider's protected credential UI, not passwords in committed SQL or shell history. No login receives `cc_owner` except your private operator, if needed.

| Secret | Worker | Capability |
| --- | --- | --- |
| `DATABASE_URL` | main | unique login inheriting `cc_runtime` |
| `FEEDBACK_ADMIN_DATABASE_URL` | main | different login inheriting read-only `cc_admin` |
| `AUTH_SECRET` | main | independently generated random 32+ bytes |
| `FEEDBACK_SIGNING_KEY` | main | a different random 32+ bytes |
| `OWNER_EMAILS` | main | exact lowercase organizer allowlist, comma-separated |
| `DATABASE_URL` | sender | third login inheriting `cc_sender` |
| `AGENTMAIL_SEND_KEY`, `APPROVED_INBOX`, `REPLY_TO` | sender only | approved mail destination identity / credential |

Generate secrets privately, e.g. `openssl rand -hex 32`. Never place a sender credential or operator DB URL on the public Worker. `.dev.vars.example` and `mailer/.dev.vars.example` show **different** local private files. Production secrets belong in Cloudflare's secret store. Public event-site config is not a secret store.

### 2. Configure infrastructure, still disabled

From this directory, `npm run build` creates only `dist/feedback/*` and `dist/en/feedback/*`. Forms containing session identity/CSRF are always rendered by `worker.js`. Standalone assets live under `/feedback/`; no event homepage, root icon or root stylesheet is overwritten.

Edit `wrangler.jsonc` and `mailer/wrangler.jsonc`: canonical origin, event/provider/benefit text, your Worker names and main route. Defaults have `workers_dev:false`, no public routes and **all rollout flags false**. Keep the sender route-less with `workers_dev:false` and `preview_urls:false`; connect it only through the main Worker's `MAGIC_MAILER` service binding. Add the commented binding with your actual sender name. Deploy sender/main separately only after authorized configuration; `npx wrangler deploy --config mailer/wrangler.jsonc` and `npx wrangler deploy --config wrangler.jsonc` are the standalone commands. Root combined deployment uses the root config instead.

Keep the `FEEDBACK_RATE` rate-limit binding. It is transport protection, not the authoritative PostgreSQL business quota. For photos, add a private `FEEDBACK_PHOTOS` R2 binding; leave both R2 public access and public bucket domains disabled.

### 3. Review imports (default dry-run)

Keep raw CSV, mappings, exceptions, code inventory, cookies and exports **outside the entire repository**, including symlink targets. None are public assets. Operator commands read `OPERATOR_DATABASE_URL` only from the private shell environment and do not log source values.

```sh
npm run import:roster -- --file "$PRIVATE_DIR/roster.csv" --mapping "$PRIVATE_DIR/mapping.json"
# Add --exceptions "$PRIVATE_DIR/exceptions.json" only for documented exceptions.
# Review summary and held records privately, then rerun with --apply.
npm run import:inventory -- --file "$PRIVATE_DIR/inventory.csv"
```

See `examples/` for explicitly synthetic **formats**, not verified people or benefits. CSV supports a BOM, quoting, commas and multiline cells. Map the check-in timestamp column explicitly. Approved/going registrations alone are not attendance. Unknown status, shared/duplicate email/guest IDs and malformed timestamps are held; pending/waitlist/declined/cancelled rows are excluded. Default eligibility requires checked-in evidence. Document exceptions with guest ID, reason, reviewer and reference; no timestamp is fabricated. `--allow-held` applies only the accepted rows after explicit review; it does not grant access to held rows. Changed identities/evidence conflict rather than being silently overwritten.

Inventory CSV uses `type,value,status,recipient_email`. Type is exactly `code` or `link`; status is `unassigned`, `assigned`, or `withheld`. Values are preserved exactly. Short codes are text, never repaired into URLs. HTTPS links must match the exact configured comma-separated `CREDIT_LINK_ORIGINS`; no values are visited. Prior assignments name an already-imported exact lowercase email. Reimport never clears/reassigns assigned stock or resets withheld stock. New rows invalidate release review. Corrections require a deliberate private operator reconciliation, not a destructive importer flag.

For owner-only login, prepare private JSON `{ "email": "organizer@example.invalid", "name": "Organizer", "note": "Documented stewardship authorization" }`, configure that exact owner address, and run `npm run bootstrap:owner -- --file "$PRIVATE_DIR/owner.json"` before the reviewed `--apply`. This grants access only: `claim_eligible=false`, no check-in, no fabricated benefit eligibility. Existing attendee identities are not downgraded or repurposed.

### 4. Proof and release review

Run the synthetic native/browser proof in [PROOF.md](PROOF.md) **before** real invitations. Operator provider setup and real email delivery are separate authorization gates; proof sends nothing.

Once counts, prior stock, exact values and sponsor eligibility are reconciled:

```sh
npm run review:release -- --expected-recipients 10 --expected-inventory 12 --note "EXAMPLE ONLY: replace with your reviewed record"
# The numbers above are illustrative, never a fixed cohort or suggested approval.
# Repeat your own reconciled command with --apply only after manual review.
npm run preflight
```

`review:release` defaults to a no-write reconciliation. `--apply` records counts/version/note atomically. `preflight` is read-only and exits nonzero unless **all** gates, exact values, positive counts, remaining coverage and runtime flag settings agree. Set `AUTH_ENABLED`, `FEEDBACK_ENABLED`, `MAGIC_EMAIL_ENABLED`, and sender `MAIL_SEND_ENABLED` deliberately for authorized invitation delivery. Benefit reveal additionally requires `CREDIT_CLAIMS_ENABLED=true`; non-synthetic stock additionally requires `REAL_CREDIT_DISTRIBUTION=true` **and** reviewed SQL gates. Review is invalidated by roster/inventory edits. Assignment-only updates preserve it. Flags alone cannot override the SQL gate. No command sends a bulk invitation or redeems a benefit.

## User / organizer routes

- `/feedback/`, `/en/feedback/`: private magic-link login or authenticated form.
- `/feedback/sign-in`, `/en/feedback/sign-in`: GET is confirmation only; explicit user POST consumes the token. Fragments are stripped before requests/storage.
- `/feedback/credit`, `/en/feedback/credit`: explicit private reveal; stable assignment over retry/login.
- `/feedback/admin`, `/feedback/admin/export`, `/feedback/admin/photo/<receipt>/<index>`: exact server-side owner only. Dashboard copy is Spanish; attendee flows are English/Spanish. Search is limited to the current 100-row page. Export pagination must be followed to completion.

Required feedback accepts criticism and `N/A`. Sponsor questions, topics, photos and separate unchecked publication permission are optional. No photo permission is a benefit condition. No automatic sharing/forwarding or sponsor reply is promised.

## Private export and manual retention

`npm run export:private -- --cookie-file "$PRIVATE_DIR/owner-cookie.txt" --out "$PRIVATE_DIR/export"` uses `PUBLIC_ORIGIN`. The cookie file contains only `__Host-cc_session=<private value>`. The tool follows paginated JSON, downloads current manifest-owned photos, checks lengths, hashes files and atomically renames a completed private export directory. Failure leaves an explicitly incomplete directory, never a completed export. Raw answers may contain personal information even if names/emails are removed. Review text/photos and consent manually before sharing; this tool does not anonymize or publish.

Choose and communicate your event's retention period. No cleanup runs automatically. `npm run cleanup -- --before '<explicit past ISO timestamp>' --manifest "$PRIVATE_DIR/deletion.json"` is a dry-run. **Pause photo uploads first**, generate/review the private deletion manifest, manually delete its exact object keys in your private bucket (including incomplete uploads), then rerun with the same cutoff/manifest plus `--objects-deleted yes --apply`. Current rows/keys must still match the reviewed manifest. This erases answer/profile copies in feedback and photo manifests/reservations, and prunes expired auth/rate/send-attempt records. It retains receipt ownership/tombstones, recipient identity and minimal benefit assignments so retries cannot resurrect content or allocate twice. Recipient/assignment retention and any ultimate event teardown need a separate manual privacy/legal decision; they are not silently deleted by content cleanup.

See [SECURITY.md](SECURITY.md) for limits and residual risks.
