# Event site / sitio del encuentro

`@cafe-compute-kit/event-site` is a dependency-free static app for **one event**. It is not a ticketing service, CMS or attendee database. It builds Spanish and English homepage, resources, slides, recap, gallery and privacy/contact pages. All graphics, CSS and scripts are self-hosted; no analytics or remote fonts are included.

## English: local use

Requires Node.js 22 or newer. No app dependency installation is needed. From the **monorepo root**:

```sh
node apps/event-site/scripts/build.mjs
node apps/event-site/scripts/preview.mjs
# Open http://127.0.0.1:4173 — Ctrl+C stops the localhost-only server.
```

The default build reads **root `config/event.example.json`**, never an environment variable, and writes only `apps/event-site/dist/`. The default is conspicuously an example; no event is confirmed and no credits or results are promised. Filesystem output is deterministic for the same config, assets and Node/ICU version. The build reads no credentials and makes no network calls.

For an ambassador clone, copy the example to a **public-only** config, edit both languages and select it explicitly:

```sh
cp config/event.example.json config/event.public.json
node apps/event-site/scripts/build.mjs --config config/event.public.json
# Alternative, when using the monorepo's npm workspaces:
npm run build --workspace @cafe-compute-kit/event-site -- --config ../../config/event.public.json
```

`--config` paths are relative to the calling process's working directory; the default example path is resolved relative to the app source. **Combined builds must pass the same selected config** to this app (or use the root build's documented config option). There is no implicit `EVENT_CONFIG` environment override. Do not edit a private production config in place or copy `.env` into this project.

### Routes

| Spanish | English | Purpose |
| --- | --- | --- |
| `/` | `/en/` | Invitation, certainty, preparation, public links |
| `/resources/` | `/en/resources/` | Safe local key setup and first request |
| `/slides/` | `/en/slides/` | Browser deck with presenter notes |
| `/recap/` | `/en/recap/` | Empty-by-default learning journal |
| `/gallery/` | `/en/gallery/` | Optional, permission-cleared images |
| `/privacy/` | `/en/privacy/` | Editable privacy notice and contact route |

`404.html` is a real not-found fallback, not an SPA redirect. HTML content works without JS. Only slide controls require JavaScript: Left/Right, Up/Down, Page Up/Down, Space, Home/End; F toggles fullscreen, Esc exits. Buttons expose the same actions. Keyboard shortcuts do not hijack links, buttons, form fields or modified keystrokes. The URL hash selects `#slide-N`. Browser Print / Save as PDF shows every slide without presenter notes; no PDF generation SDK is needed. Check the actual printed layout on your target paper/browser. Offline use: serve the built directory on localhost; no external presentation SDK or fonts are fetched.

## Public configuration contract

`src/config.mjs` is the executable schema and public projection. Unknown fields are rejected, including nested extras; every published field is reconstructed explicitly. HTML escapes all configurable text. The builder never serializes the config wholesale or reads owner/environment settings. **All accepted text and URLs are public:** do not put attendee details, private permission evidence, API keys, passwords, org IDs, mail configuration or owner allowlists here. Validation cannot determine whether a name in prose has permission to be published.

- `version`: `1`. `status`: `example`, `planning`, `confirmed` or `completed`. Changing this is an operator assertion, not an external verification.
- `title`, `location`, `audience`, `intro`, `privacy`: nonempty `{ "es": "…", "en": "…" }` strings. `venue`: the same pair or `null`. UI labels are paired in `src/locales.mjs`.
- `date`: `{ "certainty": "tba", "start": null, "timezone": null }`, or `tentative` / `confirmed` with an ISO timestamp including offset and a valid IANA timezone. Confirmed/completed status requires confirmed date certainty. Example of format only: `"2028-01-01T10:00:00Z"`, `"UTC"`. Do not use it as a real event date. Tentative dates stay labelled tentative.
- `rsvpUrl`, `contactUrl`: `null` or an HTTPS URL / clean local route. Registration is only a link; approval/admission policy belongs to the organizer. Contact should lead to a **public** help/accessibility channel; there is no built-in mail sender.
- `privacyUrl`: defaults to `/privacy/`; its English link maps to `/en/privacy/`. `feedbackUrl`: use `/feedback/` for the combined kit, a separately deployed HTTPS feedback app, or `null` to hide feedback calls to action entirely. Static event-site deployment alone does not provide private feedback, auth, benefits or mail. It does not generate placeholder authenticated forms.
- `resources`, `social`: arrays of `{ "label": { "es": "…", "en": "…" }, "url": "https://…" }`. External URLs require HTTPS without embedded credentials; `javascript:`, `data:`, protocol-relative and HTTP URLs fail. Clean local navigation routes have only alphanumerics, `_`, `-` and slashes; no dot segments, escapes, queries or fragments. Operators must provide destinations for any custom local routes.
- `preparation`: array of `{ "title": bilingualText, "body": bilingualText }`. Advice, not an implied confirmed agenda.
- `slides`: 1–100 `{ "title": bilingualText, "body": bilingualText, "notes": bilingualText }` entries. Keep slides concise (roughly 25–60 words) and test projector/mobile/print layouts after edits. Notes are **public source**, not private organizer notes.
- `recap`: `{ "summary": null, "takeaways": [], "nextSteps": [] }` by default. Use bilingual text for summary and each array entry only when there are verified, permission-cleared learnings. No event statistics or testimonials are supplied.
- `benefits`: empty by default. Each entry is a per-provider tuple: `provider` (public name), `offer` (bilingual exact benefit), `eligibility` (bilingual exact conditions), `termsUrl` (HTTPS), `confirmed` (must be `true`). There is **no generic shared credit amount** and no inferred eligibility/sponsorship. Publish a tuple only after the operator has checked that provider's terms; leave `[]` otherwise.
- `gallery`: empty by default; see below. Arrays are limited to 100 items and prose to 5,000 characters per string.

### Add a permission-cleared gallery image

Place an original, metadata-sanitized raster image in `apps/event-site/public/media/`. Only referenced gallery files are copied; arbitrary public directories are not swept into the build. Supported filenames: letters/digits/`_`/`-`, one of `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`; maximum 10 MiB per file. No remote image URLs, SVG uploads, path traversal or symlinked image files. Example structure (replace every value, and set permission booleans only after review):

```json
{
  "imagePath": "/media/your-cleared-image.webp",
  "alt": { "es": "Descripción útil de tu imagen", "en": "A useful description of your image" },
  "caption": { "es": "Contexto verificado", "en": "Verified context" },
  "credit": { "es": "Autoría y licencia con permiso", "en": "Creator and permitted license" },
  "sourceUrl": "https://example.invalid/replace-with-public-source",
  "permissionGranted": true,
  "subjectConsentConfirmed": true
}
```

The booleans are operator assertions, not consent collection or a legal determination. Confirm the image license and recognizable subjects' consent; remove EXIF/GPS, inspect originals and keep permission receipts **outside this repository**. Review minors and sensitive contexts separately. No media is included in the template, and the MIT license for the kit does not grant rights to future operator images.

## Standalone deployment: Cloudflare Workers Static Assets

The app's `wrangler.jsonc` is static-only: no `main`, database, R2, account IDs, secrets, production domains or routes. It has `workers_dev: false` and `preview_urls: false`, so it is **not publicly exposed by default**. Deployment still creates/updates a Worker and may use account resources: only do it with authorization.

1. Configure public copy, privacy/contact, confirmed facts and the separate feedback URL. Build and preview locally.
2. Use the monorepo's installed/pinned Wrangler (or install a reviewed version in your own checkout). Authenticate to **your own** Cloudflare account. This app requires no API key or database credentials.
3. Change `name` to your own new Worker name. To expose it deliberately, enable `workers_dev` or configure your own custom domain using Cloudflare's guide. Do not reuse another event's identity.
4. From the monorepo root, review an upload plan before deployment:

   ```sh
   node apps/event-site/scripts/build.mjs --config config/event.public.json
   npx --no-install wrangler deploy --config apps/event-site/wrangler.jsonc --dry-run
   # Only after approval and exposure/account review:
   npx --no-install wrangler deploy --config apps/event-site/wrangler.jsonc
   ```

5. Read back the exact deployment and test both locales, all routes, keyboard/fullscreen, 404s, links and the headers in a browser. Do not call a successful upload a working-site proof. Remove a disposable deployment after verification if it was only a test.

The generated `_headers` file scopes a strict self-hosted CSP to **event-owned paths**, not `/feedback/` or `/en/feedback/`. No inline scripts/styles or event handlers, no remote fonts, and no runtime API connections are needed. In combined deployment, the root build merges this app's `dist/` with the separate feedback app's output; its Worker still owns authenticated pages. Do not replace the root Worker with the standalone static config. If another host ignores `_headers`, configure equivalent security headers yourself; the built pages remain plain files. Publish the **contents** of `dist/` at the origin root, not a subpath, because asset/navigation URLs are root-relative.

Official hosting references: [static site setup](https://developers.cloudflare.com/workers/static-assets/get-started/), [asset binding](https://developers.cloudflare.com/workers/static-assets/binding/), [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [custom headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Español: personalizar y desplegar

Necesitas Node.js 22 o posterior. El sitio no requiere instalar dependencias propias, claves de API ni una base de datos. Desde la **raíz del monorepo**:

```sh
cp config/event.example.json config/event.public.json
# Edita solo datos públicos, en español e inglés.
node apps/event-site/scripts/build.mjs --config config/event.public.json
node apps/event-site/scripts/preview.mjs
# Abre http://127.0.0.1:4173; Ctrl+C detiene el servidor.
```

- El archivo de ejemplo vive en `config/`, no dentro de la aplicación. Se selecciona con `--config`; no se lee una variable de entorno para elegirlo. Las rutas explícitas son relativas al directorio desde donde ejecutas el comando.
- Mantén `status: "example"` o `"planning"` mientras no haya confirmación. `date.certainty: "tba"` requiere `start` y `timezone` en `null`. Una fecha tentativa necesita timestamp con zona/offset y zona IANA válida; se mostrará como tentativa. No conviertas una sugerencia en una confirmación.
- Personaliza título, comunidad, público, descripción, preparación y diapositivas en **ambos idiomas**. Cambia el aviso de privacidad y la vía de contacto según tu despliegue. El sitio no cobra entradas ni gestiona aprobaciones.
- `feedbackUrl: "/feedback/"` es para el despliegue combinado. Si publicas únicamente este sitio estático, usa la URL HTTPS de tu aplicación de feedback independiente o `null` para ocultar los enlaces. Sin esa aplicación, el sitio estático no ofrece formularios privados ni beneficios.
- `benefits: []` no promete créditos. Para cada proveedor necesitas nombre, oferta exacta, elegibilidad, enlace de condiciones y confirmación explícita. Una asignación no significa un canje.
- `recap` y `gallery` empiezan vacíos. No rellenes con cifras, citas o fotos inventadas. Para cada imagen confirma autoría/licencia y consentimiento, elimina metadatos sensibles, añade texto alternativo, pie, crédito y fuente pública en ambos idiomas. Guarda comprobantes de permisos en privado, no en este archivo.
- Nunca añadas listas de asistentes, correos privados, códigos de beneficio, claves, propietarios ni variables de servidor. El validador rechaza campos desconocidos; no puede juzgar si un texto aparentemente público contiene información personal.

Para Cloudflare, edita `apps/event-site/wrangler.jsonc` con un **nombre propio y nuevo**. No hay cuenta, dominio ni ruta de producción predeterminada. `workers_dev` y `preview_urls` están desactivados: elige explícitamente cómo se hará público. Usa Wrangler instalado en tu copia del monorepo, autentica tu propia cuenta y revisa primero:

```sh
npx --no-install wrangler deploy --config apps/event-site/wrangler.jsonc --dry-run
# Solo con autorización y tras revisar cuenta, nombre y exposición:
npx --no-install wrangler deploy --config apps/event-site/wrangler.jsonc
```

Comprueba después la URL exacta, ambas lenguas, navegación, móvil, teclado, pantalla completa, impresión y políticas CSP. Una carga exitosa no demuestra esas funciones. Para desplegar también feedback usa la guía de la raíz: el Worker y los secretos de esa aplicación son independientes. No sustituyas la configuración combinada por la configuración estática de esta carpeta.

## Verification and source provenance

Portable focused checks (from monorepo root):

```sh
node --max-old-space-size=384 --test --test-name-pattern='public schema' apps/event-site/test/config.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='public links' apps/event-site/test/config.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='bilingual route' apps/event-site/test/render.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='deck navigation' apps/event-site/test/slides.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='build plan' apps/event-site/test/build.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='gallery filesystem' apps/event-site/test/build.test.mjs
node --max-old-space-size=384 --test --test-name-pattern='localhost preview' apps/event-site/test/preview.test.mjs
```

Full suite on a suitable verification worker: `npm run test:unit --workspace @cafe-compute-kit/event-site`. Unit tests cover public certainty/privacy/link validation, locale/route/resource contracts, pure slide navigation and a real synthetic localhost preview lifecycle. They do not establish browser, fullscreen, visual, accessibility or PDF compatibility. Run the monorepo's broader browser/integration matrix before publication and again after changes.

The resource example uses the officially documented `https://api.cerebras.ai/v1/chat/completions` endpoint and Bearer authentication: [quickstart](https://inference-docs.cerebras.ai/quickstart), [machine-readable quickstart](https://inference-docs.cerebras.ai/quickstart.md), [API reference](https://inference-docs.cerebras.ai/api-reference/chat-completions). These were read during template authoring. The HTML and Markdown quickstarts listed different example models, so **no model ID is pinned or promised**: the visitor chooses `MODEL_ID` from the current catalog and checks their own account. Documentation-checked examples are not authenticated calls; no paid model request was made.

The app uses general preparation/FAQ and static-template patterns inspected from the existing site, not its event facts or assets. No private recap/media was read. The neutral text mark and notebook/cup SVGs are original MIT assets. No provider logos, official fonts or media are redistributed. See `DESIGN.md` and the repository license.
