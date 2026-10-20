# Instalación y operación completas en Vercel

[English: full guide](vercel-setup.md) · [Índice](README.md) · [Alternativa solo estática](vercel-static-setup.md#en-español) · [Cloudflare](guia-es.md)

Esta ruta ejecuta sitio público, login por correo, feedback privado, panel/export del propietario y asignaciones estables de códigos/enlaces con **Vercel Functions + Neon PostgreSQL + otro proyecto Vercel para el sender AgentMail**. No necesitas cuenta Cloudflare para este flujo principal **sin fotos**. Cloudflare sigue disponible por separado; no mezcles sus bindings ni comandos Wrangler con este procedimiento.

**Implementado no significa verificado en el proveedor real.** Los adaptadores nativos comparten handlers y SQL existentes; no son una simulación estática ni otro sistema de autenticación. Esta guía no registra un despliegue Vercel, transporte Neon real, entrega a una bandeja ni canje del proveedor. Consulta [verificación](verification.md), incluido su límite Vercel. El routing/URL original, IP confiable e inclusión/trazado de fuentes externas del sender son condiciones pendientes de aceptación en el proveedor. No actives recopilación real solo porque pase una prueba local de adaptador/navegador.

## 1. Elegibilidad, alcance y costes

Vercel Hobby se limita al uso **personal no comercial**. Que el evento sea gratuito no demuestra que una actividad de empresa, patrocinada o promocional de embajadores cumpla sus reglas. Verifica el scope/cuenta real; consulta a Vercel si hay dudas o elige [Cloudflare Free](free-tier-setup.md). No actives Pro, un trial, equipo de pago, integraciones pagadas ni almacenamiento para seguir estos pasos.[1][2]

Usa tu repositorio/cuenta y registra privadamente candidato exacto, proyectos, responsable de facturación, base y hosts canónicos. Un evento requiere una base nueva aislada y dos proyectos Vercel. Staging necesita otro par, base, credenciales y datos sintéticos: no copies una rama Neon de un evento real para probar. Aprovisionar, desplegar, cambiar DNS/secretos, importar, enviar correo y liberar beneficios son autorizaciones separadas, nunca hooks de instalación.

Neon y AgentMail tienen cuotas independientes; selecciona Free solo si corresponde. Vigila solicitudes/invocaciones/CPU/memoria/transferencia Vercel, cómputo/espacio/transferencia Neon y correo diario/mensual. **Todas las rutas principales, incluso assets públicos, invocan la función**; el sender añade invocaciones. Galerías grandes también consumen bundle/memoria/tamaño de respuesta. La capacidad incluida no es ilimitada ni una garantía de coste cero por asistente. Consulta [cuotas](free-tier-setup.md#limits-that-matter) y las consolas reales. Si no alcanza, pausa: no actualices de plan automáticamente ni evadas límites.[1][2]

El empaquetador Vercel exige **4 MiB por asset público compilado** y **32 MiB totales para el manifest JSON codificado**, dejando margen para el bundle y las respuestas en proyectos estándar. Son límites conservadores del kit, no cuotas del plan Vercel. Reduce/comprime medios públicos aprobados o usa la alternativa estática si el build rechaza una galería. Las fotos privadas de asistentes siguen sin soporte y desactivadas en Vercel.

## 2. Prepara código revisado y base nueva

Usa Node **22.22.2** para reproducir checks locales. Raíz/feedback aceptan `>=22.22.2 <23`; selecciona **Node 22.x** en Vercel e inspecciona el patch resuelto y engines. Aquí solo se identifica 22.22.2 como base ejercitada, no todos los patches administrados.

```bash
node --version
npm --version
npm ci
npm run check:source
npm run build:vercel
```

Son comandos de preparación local, no resultados ejecutados ni un despliegue. Edita JSON público en ambos idiomas con `feedbackUrl:"/feedback/"`. Por defecto se usa `config/event.example.json`: personalízalo en tu fork o cambia deliberadamente el build principal a `npm run build:vercel -- --config config/mi-evento.json`. Propietarios, roster, stock y secretos nunca van allí. El branding servidor se configura aparte.

Aplica todas las migraciones nuevas en orden y crea LOGINs SQL distintos siguiendo [Neon y mínimo privilegio](deployment.md#3-fresh-neon-postgresql-and-least-privilege-roles); esa sección de base es independiente del hosting. Detente antes de la configuración Worker. Usa URLs TLS y comprueba operaciones permitidas **y denegadas** entrando como cada login real:

| Autoridad | Destino |
| --- | --- |
| Migración/operador, `cc_owner` | Solo shell externo confiable: migraciones, importaciones, bootstrap, revisión y limpieza. Nunca Vercel ni CI. |
| Login `cc_runtime` | Solo `DATABASE_URL` de la app principal. |
| Login de lectura `cc_admin` | Solo `FEEDBACK_ADMIN_DATABASE_URL` principal; no permite importar. |
| Login `cc_sender` | Solo `DATABASE_URL` del sender; autorización de correo limitada. |

Son credenciales distintas hacia la misma base del evento, no tres copias del esquema. Roles elevados creados por Neon pueden heredar `neon_superuser`; no los uses para la app. Nunca sustituyas una consulta fallida por la URL del propietario de migraciones.

## 3. Dos proyectos con raíces distintas

Importa el mismo repositorio revisado **dos veces**, con nombres claramente diferentes en el scope elegido. Usa **Framework Preset: Other**, Node 22.x y lockfile/workspaces raíz. Vercel permite un proyecto por directorio del monorepo.[3][6]

| Ajuste | Principal | Sender |
| --- | --- | --- |
| Root Directory | Raíz del repositorio, `.` | `vercel/sender-project` |
| Configuración | [`vercel.json` raíz](../vercel.json) | [`vercel/sender-project/vercel.json`](../vercel/sender-project/vercel.json) |
| Entrypoint | `api/main.mjs` | `api/magic.mjs` relativo a su raíz |
| Build | `npm run build:vercel` | `node build.mjs` |
| Output Directory | `vercel/empty-public` | `public` relativo a su raíz |
| Duración máxima configurada | 60 segundos | 30 segundos |

No uses `installCommand:node --version` de la alternativa estática: las funciones necesitan dependencias del lockfile raíz. Revisa logs de instalación/build para workspaces y versiones fijadas, incluido `@vercel/functions@3.10.1` y la versión Neon del lockfile. No ejecutes migraciones/seeds durante build. Confirma que ajustes y archivo seleccionado coincidan: `vercel.json` sobrescribe ajustes relevantes del dashboard.[3][8]

**Fuentes fuera de la raíz del sender: obligatorio.** En sus ajustes Root Directory activa **Include source files outside of the Root Directory in the Build Step** o el ajuste equivalente de inclusión de fuentes monorepo. El API importa `../../sender.mjs` y este usa módulos compartidos `apps/feedback` y Neon. Lee de nuevo el ajuste e inspecciona el trace/bundle final: guardar el checkbox no prueba inclusión. Desactiva el salto de proyectos no afectados si pudiera ignorar cambios compartidos fuera del paquete sender. Si faltan imports, detente; no copies la clave de correo al principal para resolverlo. Esta guía no ha probado inclusión/trazado en un build real Vercel.

Ambas salidas son **vacías deliberadamente**. El build principal empaqueta solo assets públicos compilados/revisados en `vercel/generated/public-assets.json`, incluido explícitamente en el bundle privado de la función. El helper sender crea su salida vacía. Conserva catch-all a la función **antes del filesystem**: no añadas fallback SPA, no cambies salida a `dist`/`.` ni expongas HTML privado de ejemplo. Comprueba módulos/manifest necesarios y ausencia de archivos privados en el trace final. `.vercelignore` raíz es defensa adicional, no permiso para guardar inputs privados dentro del checkout.

## 4. Orígenes canónicos y variables solo Production

Una vez identificados ambos proyectos, usa sus orígenes `vercel.app` **estables de producción reales** o dominios propios autorizados; no necesitas comprar uno. Registra un origen HTTPS exacto para principal y otro para sender, sin ruta, credenciales, query ni fragmento; conserva la misma escritura sin barra final. `PUBLIC_ORIGIN` significa **principal en ambos proyectos**. `SENDER_ORIGIN` significa **sender en ambos**. Son orígenes distintos. Nunca los derives de headers ni del `VERCEL_URL` efímero.

Instala estas variables a nivel **proyecto, solo Production**. No selecciones Preview/Development ni compartas secretos a nivel equipo. No uses `NEXT_PUBLIC_*`, JSON navegador, HTML público ni un `.env` real descargado para ellas. Los cambios solo se aplican a **nuevos despliegues**; tras cada cambio aprobado redespliega el proyecto exacto y verifica estado activo sin mostrar valores.[7]

### Proyección principal de producción

| Variable | Uso / valor inicial |
| --- | --- |
| `PUBLIC_ORIGIN` | Origen HTTPS canónico principal. |
| `SENDER_ORIGIN` | Origen HTTPS canónico sender; destino fijo de `/magic-link`. |
| `EVENT_NAME`, `PROVIDER_NAME`, `BENEFIT_DESCRIPTION` | Texto autorizado del servidor, consistente con el sitio público. |
| `DATABASE_URL` | URL TLS secreta del login `cc_runtime`. |
| `FEEDBACK_ADMIN_DATABASE_URL` | URL TLS secreta del login distinto `cc_admin`. |
| `OWNER_EMAILS` | Allowlist privada de emails canónicos de propietarios, separados por coma; aún requiere bootstrap. |
| `AUTH_SECRET` | Secreto servidor independiente de alta entropía. |
| `FEEDBACK_SIGNING_KEY` | Otro secreto independiente, distinto del anterior. |
| `MAILER_SERVICE_TOKEN` | Token compartido descrito abajo. |
| `CREDIT_LINK_ORIGINS` | Orígenes HTTPS exactos aprobados de canje, separados por coma sin espacios e iguales al importar; nunca stock. |
| `AUTH_ENABLED`, `FEEDBACK_ENABLED`, `MAGIC_EMAIL_ENABLED` | Cada uno exactamente `false` inicialmente. |
| `CREDIT_CLAIMS_ENABLED`, `REAL_CREDIT_DISTRIBUTION` | Cada uno exactamente `false` inicialmente. |
| `PHOTOS_ENABLED`, `PRIVATE_PHOTO_METADATA_ACK` | Cada uno exactamente `false`; deben permanecer así en Vercel. |

### Proyección sender de producción

| Variable | Uso / valor inicial |
| --- | --- |
| `PUBLIC_ORIGIN` | El mismo origen **principal**, no el del sender; restringe enlaces de login. |
| `SENDER_ORIGIN` | Su propio origen HTTPS canónico exacto. |
| `EVENT_NAME`, `PROVIDER_NAME`, `BENEFIT_DESCRIPTION` | Mismos textos autorizados que principal. |
| `DATABASE_URL` | URL TLS secreta del login distinto `cc_sender`. |
| `MAILER_SERVICE_TOKEN` | Exactamente el mismo token que principal. |
| `AGENTMAIL_SEND_KEY` | Clave amplia del proveedor: **solo sender**. |
| `APPROVED_INBOX` | Identificador autorizado de tu bandeja AgentMail. |
| `REPLY_TO` | Tu dirección autorizada de respuesta. |
| `MAIL_SEND_ENABLED` | Exactamente `false` inicialmente. |

Genera **32 bytes aleatorios codificados como exactamente 64 caracteres hexadecimales minúsculos** para `MAILER_SERVICE_TOKEN`. Sin prefijo, comillas, espacios ni salto de línea al instalarlo. Genera secretos auth/firma independientes; no reutilices el token. Ejemplo para shell local confiable, con `PRIVATE_DIR` ya definido como directorio restringido existente fuera del repositorio:

```bash
# Crea archivos privados nuevos; no imprime ni instala secretos.
# noclobber rechaza archivos existentes. Usa tu interfaz segura para leerlos.
(
  set -eu
  set -C
  umask 077
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/mailer-service-token.txt"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/auth-secret.txt"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$PRIVATE_DIR/feedback-signing-key.txt"
)
```

Instala privadamente cada valor en Production del proyecto exacto; confirma nombres/scope e igualdad del token sin registrar valores. Principal **no debe contener** `AGENTMAIL_SEND_KEY`, `APPROVED_INBOX`, `REPLY_TO`, URL DB del sender ni credenciales de operador. Sender no debe contener URLs runtime/admin, `AUTH_SECRET`, `FEEDBACK_SIGNING_KEY` ni `OWNER_EMAILS`. Los adaptadores proyectan allowlists explícitas de strings, pero acceso al proyecto/despliegue aún expone secretos instalados: una allowlist no corrige sobreaprovisionamiento.

No crees variables string `TEST_DATABASE`, `TEST_ADMIN_DATABASE`, `MAGIC_MAILER`, `FEEDBACK_RATE`, `FEEDBACK_PHOTOS` ni `ASSETS`: son capacidades de código, no secretos Vercel. El adaptador instala limiter durable PostgreSQL de feedback (100/minuto por clave derivada), cliente HTTPS sender restringido y assets. No necesita bindings Cloudflare. Principal usa IP helper y `waitUntil` reales del SDK; reemplaza headers IP de Cloudflare del cliente y rechaza IP confiable ausente/inválida. `waitUntil` comparte el plazo de la función; no es cola durable.[4][5]

## 5. Despliega desactivado y verifica el proveedor real

Solo con autorización expresa de publicación/recursos, despliega **sender primero y principal después**, con todas las puertas apagadas. Importar desde dashboard puede desplegar: confirma variables desactivadas antes de aceptarlo. Pushes de Git pueden redesplegar ambos proyectos. No descargues entornos reales a pruebas locales; deja Preview/Development sin configurar/desactivados. Un ensayo sintético alojado necesita proyectos/recursos aislados y orígenes propios explícitos, no credenciales production en previews.

Lee de nuevo proyecto exacto, fuente/despliegue activo, Node, nombres/scope de variables y rutas. Verifica:

- `/`, `/en/`, recursos, slides, recap/galería, MIME y headers; rutas inexistentes/de código/secretos deben ser 404 real, no portada. Ambos idiomas funcionan en móvil/teclado.
- `/feedback/`, `/en/feedback/`, sign-in/credit y variantes con barra, `.html`/`index.html` nunca exponen formularios autenticados estáticos. Acciones privadas desactivadas no están disponibles; redirecciones canónicas no evitan autenticación.
- Vercel preserva **URL/ruta solicitada original** al enrutar a `/api/main` o `/api/magic`. Prueba el proveedor, no hints de query/headers aportados por cliente. Si el adaptador solo ve ruta destino, detente: no debilites controles de host/ruta privada ni inventes un workaround de headers.
- Orígenes no canónicos se rechazan (`421`) salvo redirección edge deliberada anterior. La IP confiable debe venir de Vercel; falsificar `CF-Connecting-IP` no selecciona identidad de rate-limit. IP/lifecycle ausente o inválido falla cerrado (`503`).
- En origen canónico sender, petición inocua **sin Authorization** a `/magic-link` devuelve `401` de la app antes de DB/proveedor. HTML/redirección de login Vercel no equivale a eso. No pongas el token en historial curl ni envíes correo falso autenticado como health check. Solo admite `POST /magic-link` autorizado, sin query, templates fijos y token/destinatario autorizado por DB con fence durable de un intento.
- Trace final sender incluye fuentes compartidas externas y dependencias fijadas. Manifest/bundle principal contiene solo assets públicos aprobados, nunca inputs privados. Build correcto no prueba routing desplegado ni exclusión de secretos.

**Deployment Protection no es autenticación de la app.** Principal debe ser público en origen del evento. Sender tiene entrada HTTP pública **autenticada por bearer**, a diferencia del binding privado Cloudflare. Debe ser accesible servidor-a-servidor sin desafío SSO Vercel ni redirects; el cliente no sigue redirecciones. Cambia solo protección production de los proyectos exactos después de revisar exposición; conserva protección preview y nunca añadas relay público/bypass. El kit no implementa credenciales de bypass de protección Vercel. Un `401`/redirect HTML inesperado bloquea el lanzamiento; no es salud del sender.

Para dominio propio, asocia cada host al proyecto correcto, confirma certificado y registros DNS pedidos por proveedor; conserva servicio DNS/nameservers existentes salvo autorización expresa. Respalda DNS incluido MX/TXT y modifica solo registros web revisados. Alias deben redirigir en edge al único origen canónico conservando ruta/query; no admitas alias arbitrarios en app. Mantén mail/claims apagados durante cambio, actualiza ambos orígenes y URLs absolutas públicas, redespliega y verifica host canónico y rechazo/redirect de alternativos antes de enviar enlaces. Cookies son host-only y enlaces anteriores pueden quedar inválidos.

## 6. Propietario, feedback y liberación controlada

El [runbook de operación](operators.md) y el [resumen español de importaciones](guia-es.md#5-importaciones-primero-dry-run) conservan reglas SQL/negocio. Ejecuta CLI desde shell confiable con `OPERATOR_DATABASE_URL`, nunca URL runtime para importar. Orden:

1. Define allowlist y sigue [bootstrap de propietario sin beneficio](operators.md#4-owner-access-without-claim-rights), dry-run y luego `--apply` autorizado. Lee la fila exacta: `eligible=true`, `claim_eligible=false`, sin asistencia inventada. Allowlist sola no crea acceso ni derechos de beneficio.
2. Revisa roster/check-ins, excepciones, valores exactos de stock, asignaciones previas y retenciones; dry-run y aprobación explícita antes de importar. Acceso (`eligible`) y derecho de claim (`claim_eligible`) siguen separados. Nunca visites enlaces bearer de canje para probar stock.
3. Con autorización separada de recopilación/login real, activa principal `AUTH_ENABLED=true` y `FEEDBACK_ENABLED=true`; activa sender `MAIL_SEND_ENABLED=true` y despliega sender, luego principal `MAGIC_EMAIL_ENABLED=true` y despliega principal. Conserva ambos claims y fotos `false`. Solo un destinatario controlado autorizado para prueba real de mail aprobada aparte. Respuesta genérica de login no prueba elegibilidad ni entrega.
4. Verifica primera consulta Neon real por este despliegue, confirmación intencional de enlace single-use, cookie Secure/HttpOnly/host-only, feedback crítico/`N/A` guardado, retry del recibo, denegación anónima/asistente al panel y export del propietario. No pegues cookies/tokens/respuestas en reportes. Fotos/consentimiento promocional son opcionales, nunca requisitos de beneficio.
5. Completa [revisión de release](operators.md#5-review-and-release-gates) después de imports/bootstrap. Solo con liberación real aprobada y revisión DB válida activa **ambas** `CREDIT_CLAIMS_ENABLED=true` y `REAL_CREDIT_DISTRIBUTION=true`, redespliega principal y lee estado efectivo. Auth/feedback pueden seguir disponibles con claims apagados. Importar invalida revisión previa. La asignación es estable tras retries/re-login; asignación/revelación no prueba canje.

Panel `/feedback/admin` (etiquetas actualmente en español); consulta [export privado/revisión manual](operators.md#private-export-and-manual-sharing). Sigue paginación; carpeta `.incomplete` no es export final. Revisa texto libre y derechos antes de compartir incluso sin columnas de contacto. No hay reenvío automático a sponsors.

## 7. Fotos, retención, incidentes y rollback

**Subidas privadas de fotos de participantes no están soportadas en Vercel. Aún no existe adaptador production Vercel Blob.** Mantén `PHOTOS_ENABLED=false` y `PRIVATE_PHOTO_METADATA_ACK=false`; no crees tokens Blob, buckets públicos ni workarounds R2. `PHOTOS_ENABLED=true` sin storage inyectado por código produce **503 para el despliegue**, no uploads correctos. Adaptador sintético nativo solo prueba su límite ejercitado. Galería pública autorizada es otra función: derivados locales públicos revisados pueden compilarse al manifest, nunca un bucket de uploads.

Sigue [retención/limpieza](operators.md#retention-and-cleanup) con plan aprobado, dry-run y lectura exacta posterior. Sin fotos, verifica que no haya objetos previstos antes de reconocer `--objects-deleted yes`. Conserva historial mínimo de destinatarios/asignaciones contra reemisión; exports, cookies y backups tienen política propia. Limpiar DB no borra automáticamente todas las copias.

Para contener incidentes apaga claims/distribución/feedback/mail principal y sender `MAIL_SEND_ENABLED`, redespliega proyectos exactos y verifica denegaciones; apaga también `AUTH_ENABLED` si pausas autenticación. **Guardar variables no detiene el despliegue activo.** Concilia escrituras/mail inciertos antes de reintentar. Conserva DB, asignaciones, revelaciones y evidencia privada. Rota credenciales afectadas bajo recuperación aprobada; cambia token en ambos proyectos con mail apagado. Revierte principal **y** sender a versiones/configuración conocidas compatibles con esquema, revisando variables capturadas: promocionar un despliegue anterior puede reactivar puertas antiguas. No restaures DB antigua para revertir código, borres fences ni reemitas stock. Si no hay compatibilidad segura, mantén apagado y corrige hacia delante.

## 8. Diagnóstico y registro de evidencia

| Síntoma | Comprobación segura |
| --- | --- |
| `421 Invalid host` | Compara URL/Host real con `PUBLIC_ORIGIN` principal o `SENDER_ORIGIN` sender; revisa alias/routing. No desactives el control. |
| `503` general | Orígenes/config exactos, fotos apagadas, IP/lifecycle SDK, trace manifest y engines. Con mail activo, origen/token inválido puede dejar principal indisponible. |
| Feedback `503` | URL runtime/grants, secretos de firma y flags; limiter es SQL del adaptador, no namespace Cloudflare ni string env. |
| Login genérico sin correo | Fila de acceso, flags activos, token idéntico, sender sin SSO/redirect, rol sender y metadatos privados mínimos de intento. No infieras entrega ni reenvíes a ciegas. |
| Imports sender no resuelven | Ajuste de fuentes externas y trace completo; no unas proyectos ni entregues clave mail al principal. |
| Propietario prohibido / claim bloqueado | Bootstrap/allowlist/sesión separados de claim, revisión vigente, cobertura y ambos flags. No amplíes grants ni resetees asignaciones. |
| UI funciona pero filtra rutas/alias | Pausa recopilación real; inspecciona routing Vercel y artefactos. Un fallback estático no es solución. |

Registra candidato, runtime, comandos/resultados y cada capa aparte: fuente/unit; SDK nativo instalado; PostgreSQL descartable real; Chromium; build/routing/trace Vercel real; privilegios/transporte Neon live; aceptación de mail autorizada **y entrega a bandeja**. Pruebas reales de DB/browser pueden usar outbox/storage sintéticos. Ningún pass local demuestra privacidad/storage del proveedor, entrega, canje, elegibilidad Hobby ni suficiencia legal. Evidencia operativa queda privada; [verificación](verification.md) conserva historia sin adjudicarla a otro candidato Vercel posterior.

## Sources

[1] https://vercel.com/docs/plans/hobby
[2] https://vercel.com/docs/limits/fair-use-guidelines
[3] https://vercel.com/docs/builds/configure-a-build
[4] https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
[5] https://vercel.com/docs/functions/functions-api-reference
[6] https://vercel.com/docs/monorepos
[7] https://vercel.com/docs/environment-variables
[8] https://vercel.com/docs/project-configuration/vercel-json
