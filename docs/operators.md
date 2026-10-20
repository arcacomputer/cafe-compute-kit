# Operator runbook

Work from the repository root in a trusted shell. Commands below are deliberate actions, not installation hooks. Keep all real inputs and outputs in a restricted directory **outside the entire repository**, not just outside an app. Use fresh staging/live identities; never import real stock into a test fixture.

`PRIVATE_DIR` below means your external restricted directory; it is not a checked-in path. Load credentials from a trusted secret manager without printing them. `OPERATOR_DATABASE_URL` is for a trusted import/review operator, not the deployed runtime. Do not leave that credential in the main Worker, either Vercel project or CI. This SQL/operator runbook applies to both adapters: use [Cloudflare deployment](deployment.md) or [full Vercel setup](vercel-setup.md) / [español](vercel-setup-es.md) for platform-specific settings. Vercel private photos are unsupported/off.

## 1. Establish policy before importing

- Confirm the event and provider rules, authorized cohort, benefit description, terms and expiration. Access to a form is not benefit entitlement.
- Default eligibility is a reviewed approved/going record with actual check-in evidence. Registration or a positive comment is not attendance evidence.
- Establish who can approve exceptions, prior distributions and stock holds; record reasons privately. Do not invent check-in timestamps, sponsor authorization or attendance.
- Keep `CREDIT_CLAIMS_ENABLED`, `REAL_CREDIT_DISTRIBUTION`, `MAGIC_EMAIL_ENABLED` and sender `MAIL_SEND_ENABLED` false. Importing is not release or permission to email.

## 2. Luma CSV: inspect, map, dry-run, reconcile

Export the attendee/check-in CSV from your event in Luma. Review the actual headers and timestamp format privately. The example mapping is not a promise about every Luma export version:

| Mapping key | Example source header | Meaning |
| --- | --- | --- |
| `email` | `Email` | Login identity; normalized lowercase/trimmed by roster planner. |
| `name` | `Name` | Minimal participant display name. |
| `guestId` | `Guest ID` | Stable guest identifier, not the row number. |
| `status` | `Status` | Registration status, separate from check-in. |
| `checkedInAt` | `Checked In At` | Actual timestamp with timezone, or empty. |

Copy `apps/feedback/examples/luma-columns.json` to your private directory and change its values to the exact headers. The parser handles UTF-8 BOM, quoted commas/newlines and CRLF. It does not guess headers or convert ambiguous local timestamps. If your export uses another format, preserve the original and make a reviewed private derivative; never manufacture attendance.

```bash
# Dry-run: reads only explicit files; no database access or mail.
node apps/feedback/scripts/import-roster.mjs \
  --file "$PRIVATE_DIR/luma-checkins.csv" \
  --mapping "$PRIVATE_DIR/luma-columns.json"
```

Review aggregate `total`, `accepted`, `held`, `notCheckedIn`, `excluded`, status and reason counts against Luma and your private organizer records. The script does not log source emails. Approved/going records are candidates; pending/waitlisted/declined/cancelled/invited/not-going are excluded. Unknown statuses, invalid profiles, ambiguous duplicate/shared emails or guest IDs, and invalid check-in timezones are held. Do not silently merge shared inboxes into one person or delete duplicate evidence to make totals fit.

For a genuine organizer-confirmed attendance exception, create a private JSON list using the structure in `examples/exceptions.synthetic.json`: `guestId`, `reason`, `reviewedBy`, `reference`. Keep `checked_in_at` null when no real timestamp exists. An exception does not override unknown statuses, duplicate identities or malformed records. Dry-run again with `--exceptions "$PRIVATE_DIR/attendance-exceptions.json"`.

**Apply checklist:**

- [ ] Correct fresh event database/role verified; backup and source export preserved privately.
- [ ] Mapping and every held/excluded/exception category reviewed; intended accepted count reconciled.
- [ ] No inferred attendance or automatic benefit rights for owner/test records.
- [ ] Claims/send remain off; operator explicitly approves this import.

```bash
# Database write: explicit apply; real inputs must be outside the repository.
node apps/feedback/scripts/import-roster.mjs \
  --file "$PRIVATE_DIR/luma-checkins.csv" \
  --mapping "$PRIVATE_DIR/luma-columns.json" --apply
```

Add the same reviewed `--exceptions` argument if applicable. Default apply refuses held records. `--allow-held` means explicitly accept only the valid subset and leave held records unimported; it does not make them eligible. Use it only with a documented reconciliation. Existing identity conflicts cause refusal rather than overwrite. Re-running an identical import is not permission to change identities or reset claims. After apply, read back the exact affected rows privately and reconcile counts/provenance; aggregate source-digest counts alone are not identity review. Roster changes invalidate prior release review.

The importer grants both access and benefit eligibility only for its accepted reviewed attendance rows. It is not a registration-only access importer. Access-only owners or special access policy need a separate explicit operation.

## 3. Private inventory: exact values, prior assignments, withheld stock

Use CSV headers `type,value,status,recipient_email` as in `examples/inventory.synthetic.csv`:

- `type=code`: an exact short code, displayed as text. Supported syntax is 3–128 ASCII letters/digits/underscore/hyphen, starting with a letter/digit. If a provider uses another format, stop and adapt validation/tests intentionally; never “repair” a rejected token.
- `type=link`: an exact HTTPS URL. Set server/operator `CREDIT_LINK_ORIGINS` to the provider's approved exact origins, comma-separated without spaces. No wildcard, HTTP, userinfo or invented URL wrapping. Import/runtime must agree on the allowlist.
- `status=unassigned`: available stock; empty recipient field.
- `status=assigned`: previously distributed stock; exact canonical lowercase recipient email required and that recipient must already exist. Reconcile historical recipients explicitly, even if they are not eligible for a new allocation. Do not fabricate check-ins to import them.
- `status=withheld`: deliberately unavailable stock; empty recipient field. Record the private reason in your stock ledger. Unknown/possibly distributed stock stays withheld until resolved.

Values are validated without trimming, fetching or visiting them. Duplicate values and duplicate assigned recipients are refused. Never click, curl, preview, screenshot or send bearer redemption URLs to a link scanner to “test” stock. Spreadsheet auto-formatting can alter values; compare with the original privately.

```bash
# Dry-run; requires only explicit file and approved origin configuration.
node apps/feedback/scripts/import-inventory.mjs \
  --file "$PRIVATE_DIR/inventory.csv"

# Only after reviewing prior distributions, duplicates and stock holds:
node apps/feedback/scripts/import-inventory.mjs \
  --file "$PRIVATE_DIR/inventory.csv" --apply
```

Apply uses `OPERATOR_DATABASE_URL`. Read back exact assignments/statuses privately; refuse conflicts rather than clearing `recipient_id`, assignment/reveal timestamps or code values. The importer does not reconcile every possible historical status transition for you. Never treat a successful import or a matching row count as proof that all prior distributions are accounted for. Inventory changes require renewed release review.

## 4. Owner access without claim rights

Configure the canonical owner email(s) in server-only `OWNER_EMAILS` and create a matching access-only recipient through your reviewed bootstrap procedure. The recipient must have `eligible=true`, `claim_eligible=false`, `synthetic=false`, a documented owner-access basis and no invented guest/check-in evidence. Do not use the attendance importer to obtain owner access.

Create an external `owner-access.json` with `email` (exact canonical allowlisted owner), `name` and a nonempty private `note` documenting the access decision. Use real values only in that private file. Set `PUBLIC_ORIGIN` and server/operator `OWNER_EMAILS` consistently, then run:

```bash
node apps/feedback/scripts/bootstrap-owner.mjs \
  --file "$PRIVATE_DIR/owner-access.json"
# Explicit database write after reviewing the dry-run:
node apps/feedback/scripts/bootstrap-owner.mjs \
  --file "$PRIVATE_DIR/owner-access.json" --apply
```

Before login, read back that exact row and the server allowlist. A conflicting attendee identity needs manual reconciliation, not an upsert that overwrites attendance or assignments. Bootstrap changes invalidate release review, so do this before the final release review. The dashboard at `/feedback/admin` uses ordinary magic-link authentication; no backdoor, public demo cookie or special provider allocation is needed. An owner benefit, if actually authorized, is a separate documented eligibility decision, not part of bootstrap.

## 5. Review and release gates

Review this exact event database after the final imports. Use the trusted migration/review role to record the review in `cc_release`, **not** a runtime grant expansion. Keep the expected real cohort/inventory counts from independent reconciliation rather than setting them blindly to whatever is currently stored.

Required review state:

- A positive current `version` and `reviewed_version` equal to that version.
- `roster_reviewed`, `inventory_reviewed`, `prior_assignments_reviewed` all explicitly true, with a nonempty private `review_note` identifying the evidence/reviewer.
- Positive reviewed real recipient and inventory counts matching the exact accepted claim cohort and real stock. Synthetic recipients/stock do not satisfy real release.
- Prior assigned and withheld stock reconciled. Available, unassigned, non-withheld real stock covers every remaining eligible recipient without an assignment. Re-check after a hold, roster edit or inventory mutation.
- Exact typed values valid under the live origin allowlist; provider conditions confirmed without visiting redemption URLs.

Set `REVIEWED_RECIPIENTS` and `REVIEWED_INVENTORY` in your shell to the positive counts independently approved above. Use a non-sensitive review reference for the note; keep detailed evidence in your private ledger.

```bash
# Database read/locks only; does not approve release unless --apply is present.
node apps/feedback/scripts/review-release.mjs \
  --expected-recipients "$REVIEWED_RECIPIENTS" \
  --expected-inventory "$REVIEWED_INVENTORY" --note "operator-reviewed-ledger"

# Explicit DB review write, still no claims/send flag changes:
node apps/feedback/scripts/review-release.mjs \
  --expected-recipients "$REVIEWED_RECIPIENTS" \
  --expected-inventory "$REVIEWED_INVENTORY" --note "operator-reviewed-ledger" --apply

# Read-only database/configuration check: no allocation, send or URL visits.
node apps/feedback/scripts/preflight.mjs
```

This checks the local shell's flags/configuration against a consistent DB snapshot; it does not read the deployed Worker's settings. With flags off, a not-ready exit is expected. A ready result is one input, not authorization or proof of deployed readiness. Confirm positive counts/version, human policy and actual deployed configuration independently.

**Before any external side effect:**

- [ ] Synthetic/native proof and source scan for the exact candidate reviewed; unknowns recorded.
- [ ] Correct hosting/Neon resources and effective grants verified: Cloudflare private service binding/optional private R2, or Vercel canonical main + bearer-authenticated sender with outside-root trace and production-only credentials; Vercel photos remain off.
- [ ] Owner login/dashboard works; anonymous and ordinary attendee owner/photo denials verified.
- [ ] Review version/counts/coverage, prior stock and allowlists verified privately; compatible rollback recorded.
- [ ] Organizer explicitly authorizes real claims and separately authorizes real email; participant wording and privacy/retention policy reviewed.

Only then deliberately enable the approved flags. Real benefit reveal needs both `CREDIT_CLAIMS_ENABLED=true` and `REAL_CREDIT_DISTRIBUTION=true` plus valid DB review. Authentication/feedback can be available while benefit distribution stays off. Mail needs main `MAGIC_EMAIL_ENABLED=true` and private sender `MAIL_SEND_ENABLED=true`; neither flag authorizes unsolicited bulk invitations. Verify effective settings and read-only preflight again after deployment. Do not test live release by consuming a real participant's token or allocating their stock.

## Private export and manual sharing

Sign in as an allowlisted owner, open `/feedback/admin`, and paginate through the records. Search and totals in the dashboard are page-local; do not present them as whole-event totals. `/feedback/admin/export` returns one private JSON page with `nextCursor`. Follow all pages before calculating totals.

For the existing export CLI, place your own session cookie in a mode-0600 external file using a trusted local workflow; it is a bearer secret. The file contains only `__Host-cc_session=<your session value>`, not a whole browser cookie database. Do not paste it into a terminal command, issue, chat or screenshot. Set `PUBLIC_ORIGIN` to the exact authorized HTTPS origin.

```bash
# Authenticated private network reads, never automatic sponsor forwarding.
node apps/feedback/scripts/export-private.mjs \
  --cookie-file "$PRIVATE_DIR/owner-session.cookie" \
  --out "$PRIVATE_DIR/export-reviewed-date"
```

The exporter downloads only owned-manifest immutable slot/digest routes, checks MIME, byte count and the SHA-256 captured in the original manifest, and writes a private manifest/photo digests. A lower-numbered photo finishing later cannot change the captured object identity. A new final directory appears only on completion; a `.incomplete` directory means failure, not a shareable export. Do not merge it with a complete export or suppress its marker. Review it privately and remove it under your retention policy after resolving the failure. Remove the temporary cookie file when finished and sign out.

Raw free text and original photos remain **PRIVATE** even without explicit email columns. Manually prepare a separate minimal sponsor-sharing package: confirm purpose, strip contact/private details, inspect every quote, review consent/rights/bystanders and sanitize/redact inspected derivatives as needed. Never automatically forward all answers or publish the private export as a recap/gallery. Checked reuse consent is not proof that attribution succeeded or every depicted person consented.

## Retention and cleanup

Before collecting, publish an event-specific notice: controller/contact, purposes, access, sponsor-sharing choices, photo-original metadata risk, retention dates and deletion request process. Set separate policies for feedback/photos, auth/rate state, private exports/backups and minimal assignment evidence. Disabling uploads does not delete stored photos.

Cleanup is a privileged, separately authorized operation. Erasure is terminal for new/retried photo reservations and commits. The helper erases raw answers and manifests but deliberately retains lightweight photo-key tombstones (pending/ready key, MIME, size and slot) alongside receipt/assignment ownership. A late or ambiguous object write can therefore be rediscovered and deleted by a later reconciliation. Repeated dry-runs may continue to list these keys even when their objects are already absent; this is bookkeeping, not proof that raw content remains. Document the retention basis and restrict access to this metadata. The helper does not automatically expire these tombstones.

Pause and **drain in-flight uploads** before object planning/deletion. The database fences erasure independently of the temporary feature flag, but operator draining reduces ambiguous external writes:

1. Pause affected writes/claims before planning a consistent cleanup. Identify the exact isolated event database and bucket; preserve a restricted backup and minimum assignment ledger.
2. **Dry-run first:** list intended expired token/session/rate counts and content/photo targets privately, with a fixed cutoff. Review uploads whose object write may have succeeded before DB confirmation, incomplete exports and backup copies. Do not log raw answers or code values.
3. Review retention/legal holds and get explicit deletion approval for that plan. Check references: mail-attempt rows depend on magic tokens; upload reservations/manifests depend on submissions.
4. Delete only reviewed objects and selected content/auth state using compatible tooling or a reviewed operator transaction. Keep a retryable private object-deletion manifest; an R2 timeout is ambiguous. Reconcile object absence and database state before calling cleanup complete.
5. Preserve the minimal recipient/assignment relationship, exact-value or securely retained duplicate-detection ledger, assignment/reveal history and stock status needed to prevent reissue. Do not delete/reset codes or recipients merely to erase feedback. Restrict retained identifiers and document the retention basis.
6. Read back counts and specific affected records/objects; verify existing allocations remain stable. Remove private exports/cookies/backups according to their own policy. Re-run release review if cohort/inventory changes invalidated it.

Set `RETENTION_CUTOFF` to an explicitly reviewed **past ISO timestamp with timezone**, never an unreviewed relative date. The helper defaults to dry-run and can write a new private manifest; it refuses an existing manifest path rather than overwrite evidence.

```bash
# Database reads; creates only the private local deletion plan.
node apps/feedback/scripts/cleanup.mjs --before "$RETENTION_CUTOFF" \
  --manifest "$PRIVATE_DIR/cleanup-plan.json"
```

After the checklist above, manually delete only the planned objects from the exact private bucket and verify their absence. The helper does not connect to R2 and cannot verify your acknowledgement. Only after that verification and explicit approval:

```bash
# Destructive content/auth cleanup, not code/recipient deletion.
node apps/feedback/scripts/cleanup.mjs --before "$RETENTION_CUTOFF" \
  --manifest "$PRIVATE_DIR/cleanup-plan.json" --objects-deleted yes --apply
```

Apply checks that the current target manifest matches the reviewed plan, erases selected text/photo metadata while retaining the ownership spine, and removes expired auth/rate state. It preserves recipients and inventory assignments; it does not pseudonymize recipient identities, delete backups or prove R2 erasure. Manifest drift requires a renewed dry-run and review, not bypassing the check. If you have no photos, verify the plan has no object targets before acknowledging.

A database cleanup transaction alone cannot atomically delete R2 objects or local backups. Do not claim complete erasure from one successful command. Read back affected content/auth counts and assignment stability separately; the helper's summary is not a complete storage audit.

## Safe troubleshooting

| Symptom | Safe check | Do not do |
| --- | --- | --- |
| `421 Invalid host` | Compare actual HTTPS origin with `PUBLIC_ORIGIN`; verify preview origin and routes. | Disable host validation or trust arbitrary `Host`. |
| `503` on feedback | Check flag names, runtime/signing secrets, Cloudflare `FEEDBACK_RATE` binding or Vercel adapter SQL limiter, and a first DB query with synthetic staging data. | Install the migration-owner URL on the Worker. |
| Generic login message, no mail | Verify access row, exact Cloudflare service binding or Vercel sender origin/token, active sender flags/role and sanitized provider acceptance metadata. | Infer delivery, disclose membership or dump link/token logs. |
| Sender timeout | Reconcile private provider attempt metadata and consumed/fenced token state. | Retry the same send blindly or delete the one-attempt fence. |
| Saved text, failed photos | Retry the same submission/slot/content, then reconcile the private manifest. | Resubmit everything for another assignment or call originals sanitized. |
| Benefit unavailable | Compare reviewed version/counts/coverage and actual flags; check temporary row locks before declaring no stock. | Reset assignments, turn off review gates or visit bearer URLs. |
| Import refused | Inspect private mapping/conflict evidence and aggregate reasons; rerun dry-run. | Print real CSV rows into a public issue or silently repair values. |
| Owner forbidden | Verify canonical owner allowlist plus access-only row/session. | Grant benefit rights, add a public bypass or expose the admin DB key. |

Use fictional `example.invalid` hosts, synthetic IDs and aggregate counts in reports. Redact cookies, auth fragments, stock values and private records before sharing any diagnostic.
