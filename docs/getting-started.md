# Getting started

Cafe Compute Kit has two independent apps: a bilingual public event site and an optional authenticated feedback/private-benefit app. Start **static-only** unless you need the private workflow. See [architecture](architecture.md) before provisioning anything.

## 1. Get a clean checkout

```bash
git clone https://github.com/arcacomputer/cafe-compute-kit.git
cd cafe-compute-kit
node --version
npm --version
```

Use the Node version accepted by **both** root and app `engines` (the feedback app pins Node `22.22.2`). Inspect the package manifests and root lockfile before installing; do not work around an engine rejection with a forced install.

```bash
# Dependency install only; not permission to deploy, import, send or release.
npm ci
```

Use the released checkout's lockfile. If it is absent or inconsistent, stop and report the checkout/version rather than invent a successful install. No production environment file, credentials or private source repository is needed to render the public example.

## 2. Build and preview the public example

```bash
npm run build --workspace @cafe-compute-kit/event-site
# Loopback-only public preview; does not start private backend services.
npm run preview -- --dir apps/event-site/dist
```

Open `http://127.0.0.1:4173/` and `/en/`. Review resources, slides, recap/gallery and privacy pages in both languages. Stop the server with Ctrl-C. This serves only generated public files, never a repository directory or private env files. Do not use `--bind 0.0.0.0`, a public tunnel, a provider remote-development mode or a shared server for a private preview.

A static HTTP server is **not** authenticated Worker proof. Point `feedbackUrl` to your intentionally deployed separate backend, or set it to `null` to hide all feedback calls to action when publishing without a backend. Never generate a real signed-in form as static HTML to make the link work.

## 3. Customize public content

Start from `config/event.example.json`, the fictional checked-in public example. Copy it to your own public JSON. Both root and standalone builds accept `--config`; root paths are resolved from the invocation directory, while workspace commands should use an absolute path:

```bash
# PUBLIC_EVENT_CONFIG is the path to your reviewed public-only JSON.
npm run build --workspace @cafe-compute-kit/event-site -- \
  --config "$PUBLIC_EVENT_CONFIG"
```

For the combined build use `npm run build -- --config config/my-event.json`. The root forwards the explicitly selected public config to the event-site build only; private feedback branding/origin/secrets remain separate server settings. Without `--config`, the checked-in example is selected. Only public information belongs in event JSON.

- Replace the example title, location, registration/contact links and authorized copy in **both** locales.
- Keep unknown dates/venue TBA and empty outcomes rather than guessing. Mark an event confirmed/completed only from real confirmed facts; leave benefits empty until their provider terms are confirmed.
- Review resource links and API examples before each event. Attendees keep their own keys; do not collect or demonstrate them in public assets.
- Gallery items require explicit permission and subject-consent decisions, reviewed local public derivatives, captions, credit and source. Do not point a gallery at private R2 originals.
- Adapt the public privacy notice and provide a real contact route before collecting personal information. The static site's notice is not a complete policy for the authenticated app.

Rebuild and inspect the actual generated output after changing content. The example's public provider documentation links do not imply official endorsement. MIT does not license provider logos or trademarks; see [provenance](provenance.md).

## 4. Add the optional private app

The combined build merges public app outputs into root `dist/`; it must reject unexpected collisions. It does not deploy:

```bash
npm run build
# Loopback public preview of the merged output; requires the completed build.
npm run preview
```

The root preview opens on `http://127.0.0.1:4173` and intentionally refuses private APIs/login rather than simulating authentication. It is not the Worker runtime.

For the real private flow, follow [deployment](deployment.md) in order: fresh Neon database and roles, canonical HTTPS origin, server-only secrets, optional private R2, private sender, dark deployment, owner bootstrap and reviewed imports/release. One event per deployment/database; no shared multi-tenant mode is implied.

Do not point local preview at existing live databases/buckets or install a real mail key to obtain a demo. The authenticated app uses HTTPS and Secure host-only cookies; ordinary HTTP static preview cannot prove sign-in. Use its disposable native/browser proof harness for authenticated local verification, never a public auth bypass.

## Checks

The source guard and app checks are separate commands. The root integration also exposes `npm run test:unit`, `npm run test:postgres` and `npm run test:browser`; inspect their prerequisite instructions and use the workspace commands below when checking only one app:

```bash
npm run check:source
npm run test:unit --workspace @cafe-compute-kit/event-site
npm run test:unit --workspace @cafe-compute-kit/feedback
npm run test:postgres --workspace @cafe-compute-kit/feedback
npm run test:browser --workspace @cafe-compute-kit/feedback
```

Inspect each script and its prerequisite instructions in the exact checkout before running. Unit/source checks do not prove PostgreSQL locking, role grants or browser behavior. Feedback `test:postgres` and `test:browser` require `PROOF_DATABASE_URL` and `PROOF_DISPOSABLE=yes`: an **empty disposable local PostgreSQL cluster/database**, with a `cc_proof_`-prefixed database name and the role-creation permissions needed by the fixture. The fixture applies schema, creates fixed proof roles and truncates its test tables; do not share the cluster with another event or concurrent proof. It refuses non-local targets and must fail clearly rather than skip when prerequisites are missing. Never supply a real event connection string. Browser proof also needs Playwright Chromium and the supported local TLS/runtime prerequisites, using synthetic outbox/object adapters, not an actual mail account or code stock. Supply prerequisites explicitly; installation must not silently launch proof or external sends.

Record only checks actually run, against the exact source/version. See the [root README](../README.md) for the release's current verification boundary; do not infer prospective test totals from this guide. No guide or example output is a test result. The operator must independently verify actual Cloudflare bindings, Neon memberships, R2 exposure and private sender settings. Provider email delivery/redemption remain separate approvals and evidence.

## Next

- [Deploy static-only or combined](deployment.md)
- [Import Luma check-ins, reconcile stock and review release](operators.md)
- [Prepare event resources, slides and recap](event-checklist.md)
- [Guía práctica en español](guia-es.md)
