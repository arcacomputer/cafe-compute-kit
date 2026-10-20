# Architecture

## Choose the smallest deployment

| Mode | What runs | What it cannot do |
| --- | --- | --- |
| Static-only | `apps/event-site` builds bilingual public homepage, resources, slides and recap templates. Publish only its `dist/`. | No private feedback, authentication, roster, photo store or code allocation. Hide or clearly disable feedback calls to action. |
| Combined | Root build merges both app outputs. Cloudflare runs `apps/feedback/worker.js` with `ASSETS` over root `dist/`; Vercel packages allowlisted compiled assets in a private manifest and runs the same handler behind `api/main.mjs`. | Not a ticketing platform, mail campaign tool, provider redemption tracker or shared multi-tenant SaaS. |
| Feedback-only | `apps/feedback` uses its own build and Worker configuration. | Does not provide the full public event site. |

The two app workspaces are `@cafe-compute-kit/event-site` and `@cafe-compute-kit/feedback`; the separate Vercel sender workspace is `@cafe-compute-kit/vercel-sender`. No framework migration is required. The backend supports Cloudflare Workers or native Vercel Functions with shared handlers and Neon PostgreSQL. Cloudflare has optional private R2 and a private service-binding sender. Vercel has a separate bearer-authenticated HTTPS sender project and no production private photo adapter/Blob yet; both photo flags must remain false. See [Vercel setup](vercel-setup.md) / [español](vercel-setup-es.md). It does not require Supabase.

**One event, one deployment, one fresh isolated database.** Use separate Worker identities or Vercel project pairs, credentials and supported storage for staging and live use. Never point a preview at an existing event database or bucket. A Neon branch copied from a real event contains real data; it is not a clean synthetic fixture. Multiple events in one database are unsupported: sessions, uniqueness, quotas and inventory are not tenant-scoped.

## Public and private boundaries

Cloudflare topology (the Vercel variation is described below):

```text
public event config -> event-site build -> public static assets
                                           |
browser -> canonical HTTPS Worker -------- ASSETS (root dist only)
                   |
                   +-> Neon: runtime role -> auth / feedback / stable allocation
                   +-> Neon: read-only admin role -> owner-only feedback export
                   +-> R2: private optional photo originals
                   +-> MAGIC_MAILER service binding
                              |
                              +-> Neon: sender role -> one-attempt authorization
                              +-> AgentMail credential -> fixed magic-link template
```

Public configuration contains only information safe to publish: event name, authorized branding, confirmed links and facts, or explicit examples/TBA. Owner allowlists, database URLs, mail settings, roster evidence and inventory never belong there. Do not serialize the Worker environment into a page.

The root assets directory is the merged `dist/`, not the repository or an app source directory. Build merging must reject unexpected collisions. The event site owns `/`, `/en/`, resources, slides and recap routes; feedback static assets own `/feedback/` paths. Authenticated forms are rendered by the Worker after session checks, not written as publicly readable HTML. Force Worker-first routing on Cloudflare and function-before-filesystem routing on Vercel so assets cannot bypass host checks or private route handling. Do not configure an SPA fallback for private routes.

### Vercel boundary

Main uses repository root config, `api/main.mjs` and `vercel/main.mjs`; sender uses its own project root `vercel/sender-project` and must include/trace shared source outside that root. Both share a server-only random 64-lowercase-hex `MAILER_SERVICE_TOKEN` and fixed HTTPS `SENDER_ORIGIN`; both use the main `PUBLIC_ORIGIN`. Main has runtime/admin DB logins but no broad mail key; sender has only its separate sender DB login and mail settings. `vercel/environment.mjs` projects explicit allowlists. Capability/test bindings cannot be enabled by HTTP or env strings. Main supplies SQL-backed rate limiting, validated SDK IP and `waitUntil`. The constrained sender HTTP leg never follows redirects; public HTTP ingress is not a Cloudflare private service binding. Native adapter proof does not establish Vercel routing, trusted headers or outside-root function traces.

## Identity, feedback and allocation

1. A reviewed roster grants login access (`eligible`). Benefit eligibility (`claim_eligible`) is a separate decision with attendance evidence or an organizer-confirmed exception.
2. A login request returns a generic response. The private sender may issue a single-use, short-lived magic link for an authorized recipient. Opening a GET does not consume it; the user confirms with POST.
3. The server derives recipient identity from the session. Same-origin checks and session-bound CSRF protect mutations. Browser-submitted email or recipient IDs do not grant authority.
4. Required honest text is saved with an identity-owned receipt/idempotency key. The database admission function combines text persistence and business quota accounting in one transaction. Photos are separate operations; text saved does not mean all photos uploaded.
5. A claim requires benefit eligibility, required saved feedback, explicit flags and reviewed database release gates. Row locks and uniqueness support one stable allocation per recipient. A retry must not create a second assignment.
6. The configured owner can read the dashboard and private export. Owner access alone never grants benefit rights.

Criticism and truthful “not applicable” answers are valid. Photos and reuse consent are optional and are not benefit conditions. A code assignment or reveal is **not** provider redemption, value received, email delivery, attribution or sponsor approval.

## Proof has layers

See the [root README](../README.md) for the current release verification boundary; this guide does not assert a test total or native/browser pass.

Synthetic unit tests establish only the paths they exercise. Native tests with disposable PostgreSQL sessions can establish database races, rollback and grants for their exact candidate. Local/browser object and outbox adapters do not attest to Cloudflare account permissions, R2 public exposure, sender ingress, email delivery or provider redemption.

The operator must separately verify the actual deployed configuration, effective role memberships, private bucket settings, canonical domain, denial paths and resource identities. See [deployment](deployment.md) and [security](security.md). Neither the source nor this document is a production-readiness attestation.
