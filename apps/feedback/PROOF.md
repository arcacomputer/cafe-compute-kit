# Credential-free native proof

No account, mail-provider, object-store, attendee or real-code credential is needed. There is **no fallback to a deployed host**, PGlite or a serialized concurrency fake. `test:postgres` and `test:browser` each initialize/reset their own disposable fixtures and are independently runnable, in either order; neither relies on the other's in-process state. Run one proof process at a time against the selected cluster.

## Prerequisites

- Node **22.22.2**, root workspace dependencies/lockfile installed on the proof worker.
- PostgreSQL **15+** server/client binaries (`initdb`, `pg_ctl`, `createdb`, `psql`, `pg_config`), OpenSSL and Chromium OS libraries. On Debian/Ubuntu the operator can install `postgresql postgresql-contrib openssl` and run `npx playwright install --with-deps chromium` from the workspace root. This is explicit dependency provisioning, not part of either test command.
- At least 100 available PostgreSQL connections (the local disposable default suffices). Test concurrency is bounded; native connection/query timeouts are 5/15 seconds.
- The local proof operator must be a superuser, or have both `CREATEROLE` and `pg_read_all_stats` (needed to verify the independent-session barrier). This is a disposable proof operator, never a deployed Worker login. Use an **isolated disposable cluster**, not another application's local PostgreSQL instance: migrations create cluster-wide `cc_owner`, `cc_runtime`, `cc_admin`, `cc_sender` groups and three proof-only LOGINs. Reusing a cluster with those role names fails rather than modifying its roles.

## One-command self-contained proof

From the monorepo root after provisioning dependencies, as a non-root user with server binaries on PATH:

```sh
npm run proof --workspace @cafe-compute-kit/feedback
```

The runner records app build/unit/native/browser logs under ignored `apps/feedback/.proof/`, starts a fresh trust-authenticated **127.0.0.1-only** PostgreSQL cluster with an ephemeral port, and stops/removes it in `finally`. Trust auth is for this disposable local proof only, never deployment. `PG_BINDIR` can locate non-PATH binaries. `PROOF_OUTPUT_DIR` can move evidence outside the repository.

If the disposable worker runs as root, PostgreSQL must run as the `postgres` OS user. Use an explicitly selected scratch parent traversable by that user (the Debian/Ubuntu PostgreSQL package creates the example directory):

```sh
PROOF_TMPDIR=/var/lib/postgresql npm run proof --workspace @cafe-compute-kit/feedback
```

This creates only a fresh `cc-proof-*` child directory and never uses an existing cluster/data directory. Root requires `runuser` and the `postgres` OS account. Each stage is hard-bounded: build 60s, unit 120s, native PG 180s, browser 240s. Setup/teardown have separate 20–30s process bounds. A clean provisioned worker should complete in minutes; dependency installation is separate. A failure is nonzero and logs remain for diagnosis.

## Parent-provisioned disposable PostgreSQL

The root CI/integration parent may start **one** disposable local cluster and create an empty database with name matching `cc_proof_[a-z0-9_]+`. Supply these two variables to each command:

```sh
export PROOF_DATABASE_URL='postgresql://proof_operator@127.0.0.1:5432/cc_proof_ci'
export PROOF_DISPOSABLE=yes
npm run test:postgres --workspace @cafe-compute-kit/feedback
npm run test:browser --workspace @cafe-compute-kit/feedback
```

The URL above is an illustrative local trust-authenticated proof login, not a supplied service. Use the parent's actual port/user. `DATABASE_URL` is **not** a proof prerequisite and is never used to select the proof database. Only a local PostgreSQL URL, no query parameters, an explicit `cc_proof_*` DB name and the disposal acknowledgement are accepted. An existing application schema without the proof marker is refused. Both commands initialize migrations and LOGIN roles when the database is empty, and reset synthetic tables if their own proof marker exists. This is destructive to that proof database by design. The parent owns cluster teardown in this mode. Missing prerequisites fail clearly; CI must not use `|| true` or skip native tests.

## What executes

- Independent native LOGIN connections, distinct `pg_backend_pid()` values, and a PostgreSQL advisory start barrier verified through `pg_stat_activity` prove overlapping sessions. Account/global quota, owned receipt, claim, token, rate and mail-attempt races are actual PostgreSQL transactions.
- Both schema files execute under the intended owner; effective runtime/admin/sender read/write/execute denials are exercised with separate LOGINs. Native tests run actual Worker entrypoints through a non-HTTP, in-process DB binding. Canonical HTTPS origin, session/CSRF and handlers remain active.
- Text admission/quotas, rollback/retry, foreign key ownership, exact same-payload idempotency, positive release/coverage/drift checks, stable allocation, main-to-sender native authorization, send-attempt ambiguity fencing, and no-send transport are asserted. Real importer/bootstrap/review/preflight/cleanup CLIs run only on disposable synthetic data.
- An isolated R2-shaped memory adapter exercises 20 concurrent owned photo slots, conflict/retry, current manifest and private owner reads. It is not evidence about Cloudflare bucket configuration or server image decoding.
- Chromium uses a real local HTTPS server invoking `worker.fetch`; each run generates a temporary TLS certificate/private key and deletes it on cleanup. Never commit generated keys. English/Spanish and 390/1280 widths exercise request-link → in-memory no-send outbox → intentional consume → private form → critical feedback/`N/A` with unchecked consent → lost-response retry → same private code over logout/login. Attendees are denied admin; the owner dashboard/export and actual complete-export CLI are exercised. External browser requests and server-side external fetch are blocked. No sponsor URL is opened.
- Screenshots, machine-readable browser results and axe violations/incomplete checks are retained as synthetic evidence. Incomplete accessibility checks are reported for human review, not called automated passes.

This harness does **not** prove deployed Cloudflare bindings, Neon HTTP transport, R2 privacy/settings, real email delivery, provider redemption or legal adequacy of consent. Those remain separately authorized operator checks. Authenticated forms are never provided as public static assets or as a production bypass.
