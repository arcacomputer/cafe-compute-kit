# Guía práctica en español

**Planes gratuitos:** empieza por [Cloudflare Free + Neon Free + AgentMail Free](free-tier-setup.md#en-español), sin fotos, sin dominio comprado y con cuotas explícitas. [Vercel Hobby](vercel-static-setup.md#en-español) es solo para el sitio público personal no comercial; no asumas que un evento patrocinado está permitido ni que el backend de Cloudflare funciona allí.

Un kit independiente, no un producto oficial ni una promesa de beneficios. El código es MIT; eso **no** autoriza logos, marcas ni fotos de terceros. Trabajo asistido por IA, con custodia humana de **Luis Felipe Abarca**: [arca.computer](https://arca.computer/) · [felirami.com](https://felirami.com/). Los repositorios y registros originales siguen privados; no se incluyen asistentes, respuestas, fotos, testimonios ni códigos reales.

## 1. Elige el modo

Las exportaciones privadas verifican tipo, tamaño y SHA-256 de la identidad inmutable capturada. Una carpeta `.incomplete` no es una exportación completa. El borrado de contenido conserva metadatos mínimos de claves de fotos pendientes/listas para reconciliar objetos huérfanos; no elimina automáticamente esas marcas. Pausa y drena subidas antes de borrar objetos, revisa su ausencia y repite la reconciliación cuando una escritura externa sea incierta. Las fotos siguen desactivadas por defecto.

- **Solo sitio estático:** portada, recursos, slides y recap/galería EN/ES. Publica únicamente `apps/event-site/dist/`. Sin base de datos, autenticación, mail ni R2. Apunta `feedbackUrl` a una app privada separada desplegada deliberadamente, o usa `null` para ocultar todos esos enlaces al publicar sin backend. El build combinado acepta `npm run build -- --config config/mi-evento.json`; la configuración pública no define secretos ni propietarios del backend.
- **Combinado:** el build raíz une ambos `dist/` y Cloudflare ejecuta `apps/feedback/worker.js` con `ASSETS` apuntando al `dist/` raíz. Formularios privados renderizados por el Worker, nunca HTML autenticado público.
- **Solo feedback:** usa su build y configuración propios.

La arquitectura es Cloudflare Workers + Neon PostgreSQL + R2 privado opcional + un sender AgentMail privado separado. No requiere Supabase ni cambiar de framework. **Un evento, un despliegue y una base nueva aislada.** Staging y real van separados; no es un SaaS multi-tenant. Una rama Neon copiada de un evento real no es un entorno sintético.

## 2. Instalación y vista previa sin efectos externos

```bash
git clone https://github.com/arcacomputer/cafe-compute-kit.git
cd cafe-compute-kit
node --version
npm --version
npm ci
npm run build --workspace @cafe-compute-kit/event-site
npm run preview -- --dir apps/event-site/dist
```

Usa el Node aceptado por todos los paquetes; feedback fija `22.22.2`. Revisa manifests/lockfile; si falta el lockfile o falla engines, no fuerces la instalación. El preview solo escucha en loopback. Abre `http://127.0.0.1:4173/` y `/en/`; termina con Ctrl-C. No sirvas el repositorio, uses túneles públicos ni cargues secretos reales. Este preview estático HTTP **no prueba** autenticación/cookies HTTPS.

Personaliza `config/event.example.json` con información pública autorizada en ambos idiomas. Conserva TBA/null en fechas o lugares no confirmados; no inventes resultados, cifras ni testimonios. Confirma términos antes de agregar beneficios. La galería solo usa derivados públicos revisados con permisos y consentimiento; nunca originales privados. Ajusta aviso de privacidad y contacto real antes de recopilar datos.

```bash
# Une artefactos; no publica ni envía nada.
npm run build
npm run preview
```

El preview raíz necesita build previo, escucha en `127.0.0.1:4173` y rechaza APIs/login privados con 503 deliberadamente: no simula autenticación.

Para una configuración alternativa del sitio independiente: `npm run build --workspace @cafe-compute-kit/event-site -- --config "$PUBLIC_EVENT_CONFIG"`, con ruta absoluta a JSON público. El build raíz puede reconstruir el ejemplo por defecto: para combinado personaliza deliberadamente `config/event.example.json` en tu fork. Consulta [inicio](getting-started.md). Los comandos de instalación nunca deben desplegar, enviar mail ni activar beneficios.

## 3. Neon nuevo y roles separados

Sigue [deployment: Neon](deployment.md#3-fresh-neon-postgresql-and-least-privilege-roles). Crea una base vacía para tu evento, con TLS; nunca reutilices credenciales/datos de otro evento. Revisa el destino antes de aplicar `migrations/001_schema.sql`, `002_functions_grants.sql` y cualquier migración numerada posterior en orden.

```bash
# Escrituras en la base NUEVA; servicio libpq privado fuera de Git.
PGSERVICE=cafe_compute_migration psql -X -v ON_ERROR_STOP=1 \
  -f apps/feedback/migrations/001_schema.sql
PGSERVICE=cafe_compute_migration psql -X -v ON_ERROR_STOP=1 \
  -f apps/feedback/migrations/002_functions_grants.sql
```

Los grupos son NOLOGIN: `cc_owner` para migraciones/importaciones/revisión, `cc_runtime` para la app, `cc_admin` de lectura de feedback y `cc_sender` para autorización de envío. Crea logins SQL distintos, sin privilegios de propietario, y contraseñas privadas. Los roles creados por consola/API de Neon pueden heredar `neon_superuser`: no uses ese permiso para runtime/admin/sender. Verifica permisos efectivos entrando como cada login. No relajes grants ni ejecutes SQL histórico de repos privados para resolver un error.

## 4. Cloudflare, secretos y sender privado

1. Verifica cuenta y coste autorizado con `npx --no-install wrangler whoami`. Guarda copias privadas de configuración/DNS antes de cambios.
2. Copia la configuración de ejemplo a un archivo privado externo. Ajusta **todas** las rutas relativas al moverlo. Define `MAIN_CONFIG` y `SENDER_CONFIG` con esas rutas absolutas revisadas.
3. En combinado: entrypoint `apps/feedback/worker.js`, `ASSETS` al `dist/` raíz y `assets.run_worker_first=true`. Sin fallback SPA. Nunca publiques el árbol del repositorio.
4. Fija `PUBLIC_ORIGIN` al origen HTTPS canónico exacto, sin ruta/query/fragmento; el sender usa el mismo origen. Configura textos/allowlist de enlaces (`CREDIT_LINK_ORIGINS`) y el binding rate-limit `FEEDBACK_RATE` con namespace propio.
5. Deja **false** auth/feedback/mail/claims/distribución/fotos para la primera subida. Mantén `workers_dev=false` y `preview_urls=false` salvo preview aislado deliberado con su origen exacto.

Secretos de la app: runtime `DATABASE_URL`, lectura `FEEDBACK_ADMIN_DATABASE_URL`, `AUTH_SECRET`, otro `FEEDBACK_SIGNING_KEY` independiente y `OWNER_EMAILS` solo servidor. Nunca van en JSON público, `vars`, HTML, logs ni capturas.

```bash
# Cambios externos: confirma destino; cada comando pide el valor en privado.
npx --no-install wrangler secret put DATABASE_URL --config "$MAIN_CONFIG"
npx --no-install wrangler secret put FEEDBACK_ADMIN_DATABASE_URL --config "$MAIN_CONFIG"
npx --no-install wrangler secret put AUTH_SECRET --config "$MAIN_CONFIG"
npx --no-install wrangler secret put FEEDBACK_SIGNING_KEY --config "$MAIN_CONFIG"
npx --no-install wrangler secret put OWNER_EMAILS --config "$MAIN_CONFIG"
```

`wrangler secret put` puede crear/activar una versión: revisa flags apagados y lee de nuevo el estado. El sender usa `apps/feedback/mailer/wrangler.jsonc` como modelo, **sin rutas públicas**, `workers_dev=false`, `preview_urls=false`. La app solo recibe el service binding `MAGIC_MAILER`. Instala allí, y solo allí, `DATABASE_URL` del login `cc_sender`, `AGENTMAIL_SEND_KEY`, `APPROVED_INBOX` y `REPLY_TO` con `wrangler secret put … --config "$SENDER_CONFIG"`. La clave amplia de mail nunca llega al Worker principal. `MAIL_SEND_ENABLED=false` inicialmente.

**Fotos apagadas por defecto:** omite R2 y conserva `PHOTOS_ENABLED=false` / `PRIVATE_PHOTO_METADATA_ACK=false`. Solo activa ambas tras aceptar expresamente la retención de **originales con posible EXIF/GPS** y definir privacidad/limpieza. Crea un bucket privado nuevo, sin URL `r2.dev` ni dominio público, y añade `FEEDBACK_PHOTOS`. Validar firma/tamaño no descodifica, elimina metadatos ni garantiza fotos sanitizadas. El consentimiento de reutilización del participante es otro control, opcional y desmarcado.

## 5. Importaciones: primero dry-run

Guarda archivos reales en `PRIVATE_DIR`, un directorio restringido fuera de **todo** el repositorio. Carga `OPERATOR_DATABASE_URL` de un gestor privado; es de operador, no runtime.

Exporta check-ins de Luma. Copia el mapping de `examples/luma-columns.json` y adáptalo a encabezados reales: `email`, `name`, `guestId`, `status`, `checkedInAt`. Registro no es asistencia. Se requieren estado aprobado/going y check-in con zona horaria, o excepción confirmada con `guestId`, `reason`, `reviewedBy`, `reference`; no inventes timestamp. Duplicados/emails compartidos, estados desconocidos y datos ambiguos quedan retenidos para revisión.

```bash
node apps/feedback/scripts/import-roster.mjs \
  --file "$PRIVATE_DIR/luma-checkins.csv" --mapping "$PRIVATE_DIR/luma-columns.json"
node apps/feedback/scripts/import-inventory.mjs --file "$PRIVATE_DIR/inventory.csv"
```

Compara conteos con evidencia privada; solo después añade `--apply` para escribir. Las excepciones se pasan con `--exceptions`; `--allow-held` solo admite el subconjunto válido y requiere decisión explícita. No sobreescribas identidades para cuadrar cifras.

Stock: CSV `type,value,status,recipient_email`. Tipo `code` o `link` HTTPS con origen permitido; conserva el valor **exacto**, sin arreglarlo ni convertir tokens a URLs. Estados `unassigned`, `assigned` para entregas previas con destinatario ya conciliado y `withheld` para stock bloqueado. Revisa duplicados y entregas anteriores. **No abras, visites ni consultes URLs de canje.** Importar no libera códigos, y asignado no significa canjeado.

Para propietario, prepara JSON privado `email,name,note`, configura `OWNER_EMAILS` y ejecuta `scripts/bootstrap-owner.mjs --file …` primero sin `--apply`. Debe crear acceso (`eligible=true`) sin derechos de beneficio (`claim_eligible=false`) ni asistencia ficticia. Lee el registro exacto antes de entrar al panel `/feedback/admin`.

## 6. Puertas de revisión y publicación

Antes de beneficios reales, concilia versión positiva, conteos reales positivos, stock suficiente para pendientes, asignaciones previas, retenciones, valores exactos y nota/evidencia humana. Usa `scripts/review-release.mjs --expected-recipients … --expected-inventory … --note …` primero en dry-run; añade `--apply` solo tras aprobación. No copies placeholders literalmente. `scripts/preflight.mjs` es lectura: no asigna, envía ni visita URLs; verifica el shell/base, no los flags realmente desplegados.

Checklist antes de efectos externos:

- [ ] Candidato/checks sintéticos revisados; permisos Neon y recursos Cloudflare reales verificados por separado.
- [ ] Artefactos sin datos/secretos; sender sin entrada pública y R2 privado si corresponde.
- [ ] Propietario puede entrar, asistente no puede ver panel/fotos; no hay bypass de autenticación.
- [ ] Revisión de roster/stock vigente y rollback compatible; autorización expresa para publicar, revelar y enviar por separado.

Haz `wrangler deploy --dry-run --config …` antes de `wrangler deploy --config …`. Despliega oscuro primero; verifica versión, bindings, HTTPS y primera consulta real a la base en un entorno autorizado. Para beneficios se requieren `CREDIT_CLAIMS_ENABLED=true` y `REAL_CREDIT_DISTRIBUTION=true` más revisión DB válida. Para mail: `MAGIC_EMAIL_ENABLED=true` en app y `MAIL_SEND_ENABLED=true` en sender. Activar acceso no autoriza campañas masivas. Un 202/“accepted” no prueba entrega; un timeout exige conciliación, no reenvío ciego.

Para dominio: confirma zona/cuenta y respalda DNS autenticado, incluidos MX/TXT; añade un Worker Custom Domain con tu hostname autorizado. Si hay conflicto web A/CNAME, restaura el registro respaldado si falla la asociación. Verifica certificado, origen canónico, alias/redirección, rutas EN/ES y denegaciones. Para rollback pausa mail/escrituras/claims y usa una versión compatible: **conserva base, objetos e historial de asignaciones**. No restaures una DB antigua para revertir código y reemitir stock por accidente. Detalle: [despliegue](deployment.md#custom-domain-and-rollback).

## 7. Exportación, retención y ayuda

El panel/export son privados y paginados: sigue `nextCursor`; conteos/búsqueda del panel son por página. `scripts/export-private.mjs --cookie-file … --out …` necesita tu cookie en un archivo externo mode-0600; nunca pegues el secreto en comandos/chat. Una carpeta `.incomplete` no es un export completo. Fotos/texto libre siguen privados: revisa manualmente contexto, datos, derechos/consentimiento y derivados antes de compartir algo mínimo con un sponsor. No hay reenvío ni galería automática.

Define retención antes de recopilar. Pausa escrituras y genera el plan con `scripts/cleanup.mjs --before … --manifest …` (fecha pasada explícita). Revisa/autoriza, elimina manualmente solo objetos planificados y verifica ausencia; luego `--objects-deleted yes --apply` permite limpiar contenido/auth sin borrar destinatarios ni asignaciones. El helper no verifica R2, no borra backups ni anonimiza destinatarios; conserva evidencia mínima restringida para impedir reemisión. Revisa también exports y cookies. Procedimiento: [operación](operators.md#retention-and-cleanup).

Si falla: host 421 → compara `PUBLIC_ORIGIN`; feedback 503 → flags/secretos/binding rate-limit/consulta DB; beneficio bloqueado → revisión vigente/cobertura/flags; mail incierto → concilia intentos; fotos incompletas → reintenta mismo recibo/slot/contenido. No debilites permisos, resetees asignaciones ni compartas datos reales en issues.

`npm run check:source` y los scripts por workspace `test:unit`, `test:postgres` y `test:browser` son capas distintas: usa `npm run test:unit --workspace @cafe-compute-kit/event-site` y los checks privados con `--workspace @cafe-compute-kit/feedback`. Los dos checks nativos requieren `PROOF_DATABASE_URL` + `PROOF_DISPOSABLE=yes` en PostgreSQL local vacío/descartable, base con prefijo `cc_proof_` y permisos para crear roles; crean esquema/roles y truncan tablas de prueba. No compartas cluster con otro evento ni ejecutes pruebas concurrentes. Browser requiere Chromium y usa outbox/objetos sintéticos, no correo real. Un test local no certifica configuración Cloudflare/R2/mail del operador, canje del proveedor ni fotos sanitizadas. Registra lo realmente probado y los pendientes; el [README raíz](../README.md) fija el límite de verificación actual, sin dar por hechos resultados futuros. Consulta [seguridad](security.md) y [contribución](contributing.md).
