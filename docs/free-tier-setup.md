# Free-tier setup: Cloudflare first

Start here if you want to run a small community event without subscribing to a paid hosting plan. Provider terms checked **2026-10-20**; check the linked official pages and your own account before launch. Included usage is not unlimited capacity or a promise that every deployment will cost zero.

## Choose the smallest setup

- **Public website only:** Cloudflare Workers Static Assets on its Free plan, using the assigned `workers.dev` address. No database, email account, purchased domain or R2 required.
- **Website + private feedback, organizer login and codes:** Cloudflare Workers Free + Neon Free + AgentMail Free, with photos disabled. This is a free-tier-first deployment recipe, subject to CPU, request, database and email quotas. It is not a certified live Free-plan performance result.
- **Vercel:** the [Vercel guide](vercel-static-setup.md) covers the public static website only. Hobby is limited to personal, non-commercial use. Do not assume a sponsored, company or promotional ambassador event qualifies.

The full private backend remains on Cloudflare. Do not upload it as static HTML or substitute a public client-side admin password.

## A. Publish just the website on Cloudflare Free

### 1. Copy and customize

Use GitHub **Use this template** to create your own repository. Clone your copy. Use the supported Node release (`22.22.2`) and the checked-in lockfile:

```bash
npm ci
```

Copy `config/event.example.json` to `config/my-event.json`. Edit public event details in both languages and set **`feedbackUrl` to `null`** unless you already operate an intentionally deployed separate feedback app. No attendee data, owner email, database URL, email key or code stock belongs in this JSON.

Build from the repository root:

```bash
npm run build --workspace @cafe-compute-kit/event-site -- \
  --config "$PWD/config/my-event.json"
npm run preview -- --dir apps/event-site/dist
```

Open `/` and `/en/`, check resources/slides/recap/gallery and stop the preview with Ctrl-C. Only `apps/event-site/dist/` is the deployable public artifact.

### 2. Select the free account and exposure deliberately

Create/sign in to your own Cloudflare account. Stay on **Workers Free**, not a Paid plan or trial. Authenticate the pinned CLI and inspect its account identity:

```bash
npx --no-install wrangler login
npx --no-install wrangler whoami
```

Create a private Wrangler JSON file outside the repository. Use this shape, replacing the Worker name and the absolute build path:

```json
{
  "name": "your-event-site",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,
  "preview_urls": false,
  "assets": {
    "directory": "/ABSOLUTE/PATH/cafe-compute-kit/apps/event-site/dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  }
}
```

There is deliberately no `main`, binding or secret: this is assets-only. `workers_dev:true` intentionally publishes the provider hostname, unlike the dark checked-in samples. Set `STATIC_CONFIG` in your local shell to this external file's absolute path. Do not use a live event's existing Worker name.

### 3. Validate, then publish

```bash
npx --no-install wrangler deploy --dry-run --config "$STATIC_CONFIG"
# This next command publishes the reviewed static artifact to your account.
npx --no-install wrangler deploy --config "$STATIC_CONFIG"
```

Wrangler reports your actual `https://<worker>.<account-subdomain>.workers.dev` URL and may ask you to establish the account subdomain. Use the returned URL, not a guessed hostname. There is no need to buy a domain. An existing custom domain is optional; follow [domain setup](deployment.md#custom-domain-and-rollback) before changing DNS.

Read back the deployed version and test `/`, `/en/`, resources, slides, gallery and a nonexistent route. Confirm the latter returns **404**, not the homepage with status 200. Check the security headers, mobile layout and browser console. Static pages cannot authenticate an organizer; `/feedback/` must not become a pretend public form.

## B. Add private feedback, admin and code distribution

Use the [full Cloudflare + Neon walkthrough](deployment.md), with these free-tier choices:

1. **Neon:** choose Free and a fresh project/database for this event. Apply the fresh migrations, create separate least-privilege runtime/admin/sender logins, and verify their effective privileges. Do not use provider-admin credentials in the app. Leave scale-to-zero enabled; cold starts can add latency. The kit uses its own email/session authentication, not Neon's separate managed-auth product.
2. **Main Worker:** stay on Workers Free. Use the combined or feedback-only config, with all send/claim/photo gates initially off. Use your actual assigned `workers.dev` hostname as the exact HTTPS `PUBLIC_ORIGIN`, deliberately enable `workers_dev:true` on the **main** Worker and keep `preview_urls:false`. Confirm the hostname before enabling auth or sending links. A purchased domain is not required.
3. **Private sender:** create the separate sender Worker and bind it as `MAGIC_MAILER`. It must retain `workers_dev:false`, `preview_urls:false` and no public routes. Use your own AgentMail Free inbox at its provider-assigned address; a custom email domain is not required. Keep its API key only on this private service.
4. **Private configuration:** install the server-only secrets as described in the deployment guide. Public event JSON and Vercel environment settings never need those credentials. If a separate static website links here, use an absolute feedback URL, then let attendees navigate to the backend's own origin.
5. **Owner access:** follow [owner bootstrap](operators.md#4-owner-access-without-claim-rights). Configure your own `OWNER_EMAILS` and create the matching access-only owner record. Sign in by email, then open `/feedback/admin`. Bootstrap does not fabricate attendance or grant benefit rights.
6. **Attendees and inventory:** follow the [operator runbook](operators.md) to review roster evidence, import private stock and approve a release. Keep claim/distribution gates off until those checks pass. Do not use real attendee links or stock for a smoke test.
7. **Photos:** leave `PHOTOS_ENABLED=false` and `PRIVATE_PHOTO_METADATA_ACK=false`; omit the R2 binding. Optional R2 has an included allowance but is a separate metered product, not a no-billing guarantee. Its privacy and metadata limitations still apply.
8. **Launch check:** with authorization, verify an actual first Neon query, owner/attendee/anonymous access denials and one controlled email login using an authorized test account. Observe Cloudflare CPU and provider quotas before collecting attendee data. Never auto-upgrade if a free limit is insufficient.

### Limits that matter

At the check date, official provider pages list:

- **Cloudflare Workers Free:** 100,000 dynamic requests/day and **10 ms CPU per invocation**. Network waiting is not CPU, but rendering, cryptography and parsing are. Service-binding calls share the overall CPU accounting. Native PostgreSQL/local-workerd CI does not certify the production Free-plan CPU limit.
- **Static Assets:** asset requests are free and unlimited without a script invocation. The **combined kit uses `run_worker_first:true`**, so even matching assets first invoke the Worker and consume the Free request allowance. Do not remove this security boundary to save quota. Use the separate assets-only site if you want public traffic isolated from private-app capacity.
- **Neon Free:** 100 CU-hours/month and 1 GB database storage per project; included public network transfer is 5 GB/project. Keep the endpoint suspend setting, watch storage/compute/transfer and check the console for your actual entitlement. One event's fixtures or private data must not be cloned into another.
- **AgentMail Free:** 3 inboxes, 3,000 emails/month and **100 emails/day**. Budget attendee logins, organizer logins, repeats and other applications sharing the account. This is an email count, not an attendee allowance. The kit's internal 300/day send-attempt ceiling does **not** raise the provider's lower quota. No custom email domain is necessary.

When a quota is reached, expect denied/failed requests or unavailable logins, not seamless operation. Pause or use the static-only site if needed. Do not create extra accounts to evade limits, enable paid add-ons or treat budget alerts as guaranteed hard spending caps. Custom domains, separately hosted event media, sponsor benefits and attendee API/model usage are outside this hosting recipe.

## En español

**Recomendado: Cloudflare Free + Neon Free + AgentMail Free, sin fotos.** Para solo el sitio, publica `apps/event-site/dist/` en una dirección gratuita `workers.dev`, con `feedbackUrl:null`; no necesitas dominio comprado, base de datos ni correo. Para feedback/admin/códigos sigue la [guía completa en español](guia-es.md) y el procedimiento de propietario. El sender permanece privado; solo la app principal expone su hostname canónico.

No prometemos un backend ilimitado a costo cero: Workers Free limita CPU/solicitudes y AgentMail Free tiene un máximo de **100 emails diarios** compartido por la cuenta. Prueba tu despliegue real y no actives planes de pago automáticamente. Vercel Hobby sirve como alternativa para el **sitio público personal no comercial**, no como reemplazo del backend ni como permiso automático para eventos patrocinados.

## Official references and proof boundary

- [Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing and Worker-first caveat](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
- [Neon Free pricing](https://neon.com/pricing).
- [AgentMail Free pricing and daily/monthly limits](https://www.agentmail.to/pricing).
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [commercial-use rules](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage).

These are setup instructions based on the current source and official terms, not a record of provisioning or a live Free-plan deployment. No new hosting plan, domain, mail send or database was created to write this guide. See [verification](verification.md) for the executed release proof; verify provider bindings, delivery, free-tier CPU and account entitlements on your own authorized deployment.
