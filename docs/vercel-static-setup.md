# Vercel Hobby: public website only

This recipe deploys **only `apps/event-site`**, without functions or backend secrets. For Vercel-native login, private feedback, organizer admin and codes use the separate [full Vercel guide](vercel-setup.md) ([español](vercel-setup-es.md)). This static alternative deliberately opts out of the checked-in root function configuration.

**Free-plan eligibility comes first.** Vercel Hobby is for **personal, non-commercial** use. A free-to-attend event is not automatically non-commercial. For company, sponsored, promotional or paid work, do not assume Hobby qualifies; use the [Cloudflare free-tier path](free-tier-setup.md) or clarify eligibility with Vercel. Do not start a Pro trial or paid team just to follow this guide. Provider docs checked **2026-10-20**.

## 1. Prepare your own repository

Use GitHub **Use this template** and create your own repository. For the personal Hobby path, use your own personal GitHub identity rather than assuming company-organization collaboration is included. Clone your copy. The public builder is dependency-free and accepts Node 22 or newer; this recipe uses Node 22.x and does not install the unrelated feedback workspace or change the lockfile.

Edit `config/event.example.json` in **your copy** with public details in both languages. Set:

- `feedbackUrl:null` for a fully static website, or
- `feedbackUrl` to the absolute HTTPS `/feedback/` URL of your separately deployed Cloudflare or Vercel main app.

The second option is a normal top-level link to the backend's canonical origin. Keep magic-link login, session cookies, feedback submission, admin and code reveals on that backend origin. **Do not add Vercel proxy rewrites for `/feedback` or `/api`**: origin checks and host-only cookies depend on the canonical backend hostname.

Never place owner addresses, secrets, private answers or benefit stock in public JSON. Review rights to every gallery image.

## 2. Configure Vercel static hosting

**The repository now ships a root `vercel.json` for the full authenticated Vercel runtime. Dashboard build/output overrides alone do not select static mode:** that file overrides relevant project settings. In a separate static-only fork/checkout, preserve the original runtime configuration privately, then **replace the entire root `vercel.json`** with the configuration below (do not merge its headers into the runtime catch-all). Use a separately named static project so an update cannot silently repurpose a live private app. Alternatively use a separately selected project configuration only if you have verified which file the provider actually loads.

Also exclude the root **`api/`** directory from the static deployment source: append a root-anchored `/api` entry to that fork's existing `.vercelignore`, preserving its other exclusions, or remove that directory from the dedicated static-only source copy. Vercel detects native `api/` functions independently of the static output folder; merely setting `apps/event-site/dist` is not enough to guarantee no backend functions. Do not point this static project at sender's root or import sender as another project. These are operator changes to your own static fork, not changes required for the full runtime.

The replacement configuration selects the standalone public build, never the combined root build or repository root as the upload directory:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "node --version",
  "buildCommand": "node apps/event-site/scripts/build.mjs",
  "outputDirectory": "apps/event-site/dist",
  "trailingSlash": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "Content-Security-Policy", "value": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"},
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "DENY"},
        {"key": "Referrer-Policy", "value": "no-referrer"},
        {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)"}
      ]
    }
  ]
}
```

Cloudflare-style `_headers` files are **not** Vercel configuration; the explicit `headers` above reproduce the event site's current static policy. Reconcile them against `apps/event-site/src/headers.mjs` if you update that policy. They intentionally do not allow a browser feedback API: the site links to the separate app instead. Avoid analytics or extra inline scripts that would require changing the policy without review.

The install override only reports the runtime: no dependency installation is needed for this public builder. This avoids installing the feedback workspace, whose supported Node range and exercised baseline are documented separately. If using a different public config filename, append `--config "$PWD/config/my-event.json"` to the direct Node build command. The default command intentionally uses the checked-in example filename that you edited in your own copy.

## 3. Import and deploy

1. Sign in to your **eligible personal Hobby** scope. Choose **Add New → Project** and import your own repository. Do not accept a paid upgrade to unblock a company/team import.
2. Keep **Root Directory** at the repository root (`.`), because the workspace uses the root lockfile and shared `config/`. Do not select only `apps/event-site` and then rely on access to files outside that root.
3. Select **Framework Preset: Other**. Confirm install override `node --version`, build `node apps/event-site/scripts/build.mjs` and output `apps/event-site/dist` agree with `vercel.json`. Select **Node 22.x** and inspect its resolved version. This is the dependency-free public app, not a proof of the private backend on a different managed patch. Confirm the resolved replacement configuration and that the root API sources are excluded.
4. No backend secrets or provider credentials are needed in Vercel. Keep automatic paid integrations, image optimization and optional analytics disabled.
5. Review the public artifact and provider build/function inventory: **no `api/main` or sender/backend function may be deployed by this static project**. If function detection or a separate dependency-install step appears, stop and resolve the API source exclusion before publication. Then select **Deploy**. Vercel supplies a `vercel.app` URL, so a purchased domain is unnecessary. Git-connected future pushes can trigger new deployments: inspect changes before pushing.

Never leave Output Directory blank: the `Other` preset can otherwise serve an unintended root directory. There is no SPA catch-all rewrite; a missing page should remain a real 404.

## 4. Verify the actual returned URL

Use the real URL returned by Vercel, not a guessed hostname. Check:

- `/` and `/en/` load the intended event; resource, slide, recap, gallery and privacy routes work with their expected trailing slashes.
- `/assets/slides.mjs` has a JavaScript MIME type and slide navigation/fullscreen/print work.
- A nonexistent path returns 404, not a home page fallback. `/feedback/admin` and private API paths must not expose static copies or data.
- Security response headers match the configured policy. There are no unexpected external requests or CSP errors on normal pages.
- At mobile and desktop widths, content fits and controls work. Check real HTML text, not only the deployment's `Ready` label.
- A `null` feedback URL hides feedback calls to action; an absolute backend URL opens that app on its own origin. Verify organizer/attendee denials on the backend separately.

If the public production URL redirects visitors to Vercel Authentication, inspect **Deployment Protection** for the exact project. Change only the intended public website's protection after confirming ownership and exposure; never disable the backend's own authentication. Preview protection and app admin authentication are unrelated.

This guide has not provisioned or live-tested a Vercel project. The kit's existing native/local-workerd/browser proof is not evidence of Vercel routing, MIME, header or free-plan performance. Perform this live checklist after your authorized deployment.

## 5. Stay within the free plan

The checked official Hobby/fair-use pages list up to 1 million Edge Requests and 100 GB Fast Data Transfer per month, plus separate build and other feature limits. Those are shared allowances, not a per-attendee promise. Check actual scope usage; if a feature hits its free limit it may be unavailable until its reset window. Do not treat a time-limited Pro trial as a permanent free tier, or upgrade silently.

For the whole private workflow, prefer **Cloudflare Free + Neon Free + AgentMail Free with photos disabled**, subject to [their explicit limits](free-tier-setup.md#limits-that-matter). Alternatively follow [full Vercel setup](vercel-setup.md) / [español](vercel-setup-es.md) with two projects, server-only secrets and photos unsupported/off; it is a different configuration, not this static recipe.

## En español

Vercel Hobby sirve aquí para **solo el sitio público personal no comercial**. Importa tu copia, deja la raíz en `.`, usa preset **Other**, override de instalación `node --version`, build `node apps/event-site/scripts/build.mjs` y salida `apps/event-site/dist`. El generador público no requiere instalar dependencias ni el backend. **Reemplaza íntegramente el `vercel.json` raíz existente**, que ahora configura el backend completo: cambiar solo el dashboard no lo anula. En un fork/copia separado solo-estático añade `/api` a `.vercelignore` preservando otras exclusiones, o elimina `api/` de esa copia; confirma en inventario del build que no se despliega ninguna función backend. No mezcles el catch-all runtime con esta receta ni reutilices un proyecto privado live. Configura los headers con el archivo reemplazado: Vercel no aplica `_headers` de Cloudflare.

Un evento gratuito no equivale automáticamente a uso no comercial. Para actividades de empresa o patrocinadas, no supongas que Hobby está permitido. Esta receta no ejecuta login/admin/feedback/códigos; enlaza a una app separada Cloudflare o Vercel. Para ejecutarlos en Vercel usa la [guía completa](vercel-setup-es.md), con dos proyectos y fotos apagadas. Usa `feedbackUrl:null` o un enlace HTTPS absoluto al backend, no un proxy que rompa cookies/origin. No se necesita dominio comprado ni secretos del backend en Vercel.

## Official references

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).
- [Fair use and commercial restrictions](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage).
- [Build settings, root and output directories](https://vercel.com/docs/builds/configure-a-build).
- [vercel.json properties and headers](https://vercel.com/docs/project-configuration/vercel-json).
