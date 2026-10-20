# Security and privacy

## What must stay private

Keep rosters, check-in evidence, exception notes, raw feedback, photos and metadata, login/session/CSRF tokens, code stock and assignment ledgers outside Git, `dist/`, public buckets and CI artifacts. Removing contact columns does not anonymize free text. Do not paste a real failing request, database URL or redemption link into an issue.

For a suspected vulnerability, do not file sensitive details publicly. Use the private reporting route listed by the repository's current security policy; if none is available, ask a maintainer for a private channel without disclosing the exploit or data. Use only synthetic reproductions until an explicit investigation scope is agreed.

## Controls and their limits

| Boundary | Required control | Limit / operator responsibility |
| --- | --- | --- |
| Host and assets | Exact configured HTTPS `PUBLIC_ORIGIN`; Cloudflare Worker-first or Vercel function-before-filesystem routing; public-only asset directory/manifest. | An alternate hostname is not another supported app origin. `noindex` is not access control. |
| Authentication | Hashed expiring tokens and sessions; POST consumption; Secure, HttpOnly, host-only SameSite cookie. | Anyone controlling an eligible mailbox or a valid bearer link can act as that user. Do not log links. |
| Mutations | Session-derived identity, exact origin, CSRF and request limits. | Origin headers do not authenticate a direct client. Shared event Wi-Fi can hit limits; test capacity with synthetic traffic. |
| Text admission | Receipt ownership and atomic database admission/quota function. | Network response loss is not proof of rollback. Reconcile/retry the same receipt; do not mint a new identity or assignment. |
| Allocation | Benefit eligibility, reviewed version/counts, pool separation, row locks, unique recipient and exact stock values. | Bearer codes can be shared after reveal. No provider redemption API is verified by an assignment. |
| Database | Separate migration owner, runtime, read-only admin and sender capability roles; restricted function execution and trusted search paths. | A credential with inherited owner rights defeats least privilege. Verify effective permissions, not just role names. |
| Sender | Cloudflare private service binding or Vercel separate HTTPS project with fixed origin, strong shared service token and no-follow redirects; fixed template/path/language and DB-authorized one-attempt fence. | Broad AgentMail key stays only in the sender. Provider timeout may mean accepted mail; do not blindly resend. Accepted is not delivered. |
| Photos | Session/CSRF/ownership checks, bounded bytes and slots, private reads and bucket. | File signature checks do not decode images, strip EXIF/GPS or bound decoded pixel dimensions. |
| Owner export | Server-side allowlist and private paginated export. | Raw text, photos and metadata require human review. An owner account is sensitive; protect its mailbox and local export files. |

A main Worker/function compromise still exposes its runtime capabilities and admin read credential, plus private photos where supported on Cloudflare. Splitting credentials limits database authority; it does not sandbox one handler from another inside the same Worker/function. Restrict deployment access accordingly.

### Vercel deployment boundaries

Follow [full Vercel setup](vercel-setup.md) / [español](vercel-setup-es.md). Keep live variables project-scoped to Production, never Preview/Development or team-wide. Main must not receive sender/provider/operator credentials; sender must not receive runtime/admin/auth/owner secrets. Explicit environment projections are not a sandbox against someone with deployment access. Sender ingress is public HTTP but bearer-authenticated, not a private Cloudflare binding; verify app-level unauthenticated refusal before DB/provider access and no Vercel SSO/redirect barrier on its authorized server-to-server leg. Verify actual routing/original URL, trusted platform IP and outside-root source traces separately from native proof.

**Vercel private photo uploads are unsupported, not an opt-in feature.** No production Blob adapter exists. Keep `PHOTOS_ENABLED=false` and `PRIVATE_PHOTO_METADATA_ACK=false`; setting the first true without storage makes production fail closed with 503. The photo opt-in instructions below apply only to Cloudflare/R2. Public consent-cleared gallery assets are a separate reviewed build input.

## Photos: default off, private originals only

Do not enable photos until the operator explicitly accepts private-original metadata retention. Both `PHOTOS_ENABLED` and `PRIVATE_PHOTO_METADATA_ACK` must be exactly `true`; otherwise leave both `false` and omit the R2 binding. This acknowledgement is an operator risk decision, **not participant consent to publication**.

The current mode does not promise server-side re-encoding, EXIF stripping or fully sanitized images. Originals may include location, device, author, bystander or other identifying information. Client-side conversion is bypassable. Size/type checks are not a malware-free guarantee. Keep the R2 bucket private, with public development URLs, website hosting and public custom domains disabled. Do not publish object keys or signed URLs as a gallery.

The separate participant reuse checkbox must start unchecked. Preserve its wording/version and selection with exports. Review subjects' rights, bystanders, intended use and attribution before sharing an independently inspected derivative. Consent does not guarantee complete rights or correct attribution; seek clarification when needed. See [retention and export](operators.md#private-export-and-manual-sharing).

Erased receipts cannot accept new or delayed photo commits. Cleanup retains lightweight pending/ready photo-key tombstones so repeat orphan reconciliation remains possible after an ambiguous external write; it does not claim this bookkeeping metadata was erased. Private downloads use immutable slot/digest identities, and the exporter verifies bytes against the digest captured in its original manifest before completion. Pause/drain, repeated object reconciliation and a stated metadata-retention policy remain necessary operator duties.

## Release evidence checklist

Before allowing real use, record privately the exact candidate/version and results for:

- Synthetic application flow: login confirmation, feedback, retry, claim, optional photos and owner export; no live mail or real stock in tests.
- Native disposable PostgreSQL independent-session admission, token and claim races; rollback, capacity/exhaustion, stable retries and effective runtime/admin/sender grants.
- Build/artifact scan: no private inputs, authenticated static form, secrets, live identifiers or unlicensed assets; no install-triggered deploy/send/release.
- Operator deployment: correct account and resources; no shared production preview bindings; actual runtime first database query; private bucket/public URL settings; Cloudflare sender has no public ingress or Vercel sender has authenticated-only ingress with correct canonical origin/token and no-follow routing; anonymous and ordinary attendee admin/photo denials.
- Both locales and mobile/keyboard paths, preserved answers, optional consent and complete/incomplete export behavior.

Record unknowns as unknown. A passing isolated suite is not proof of the operator's R2 configuration or email delivery, and an HTTP 200 is not authenticated-flow proof. Re-check after changing code, flags, grants, provider settings or domains.

## Incident containment

1. Pause real claims/distribution, feedback writes and mail through explicit flags in the affected deployment. Disable photo writes if relevant; do not erase the database.
2. Preserve a private timestamped incident log, active Worker versions/configuration, DB backup and minimal assignment history. Never put raw sensitive logs into public tickets.
3. Reconcile uncertain writes, allocations and provider send attempts before any retry. Do not reset assignments or return revealed stock to the pool.
4. Rotate/revoke only affected credentials under an explicit recovery plan; changing auth signing material can invalidate sessions. Verify containment by reading back actual flags/bindings and denial paths.
5. Review notification obligations and a compatible forward fix or [rollback](deployment.md#custom-domain-and-rollback). Treat data deletion, provider notification and public disclosure as separately authorized actions.

No automatic retention schedule is implied. Choose a policy before collecting data and execute reviewed [cleanup](operators.md#retention-and-cleanup) deliberately, including private exports and backups.
