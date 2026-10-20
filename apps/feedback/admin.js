import {databaseFor} from './database.js';
import {identity} from './auth.js';
import {parsePhotoKey} from './photo-reference.js';
import { getConfig } from './config.js';
const headers={'Cache-Control':'no-store, no-transform','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const respond=(text,status=200,type='text/html; charset=utf-8')=>new Response(text,{status,headers:{...headers,'Content-Type':type}});
export async function handleAdmin(request,env,deps={}){
 if(request.method!=='GET')return respond('Method not allowed',405);
 if(env.AUTH_ENABLED!=='true'||!env.AUTH_SECRET)return respond('Unavailable',503);
 let person;try{person=await (deps.identity||identity)(request,env);}catch{return respond('Unavailable',503);}
 if(!person)return respond('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/feedback/admin.css"><main><h1>Panel privado</h1><p>Inicia sesión con tu cuenta de organizador y vuelve a esta página.</p><a class="button" href="/feedback/">Iniciar sesión</a></main></html>',401);
 if(!getConfig(env).owners.includes(person.email))return respond('Forbidden',403);
 if(!env.FEEDBACK_ADMIN_DATABASE_URL&&!deps.query)return respond('Unavailable',503);
 const sql=deps.query||databaseFor(env,true),url=new URL(request.url);
 try{
 const photoMatch=url.pathname.match(/^\/feedback\/admin\/photo\/([a-f0-9-]{36})\/((?:[0-9]|1[0-9])-[a-f0-9]{64}\.(?:jpg|png|webp))$/);
 if(photoMatch){
  const key=`feedback/${photoMatch[1]}/photo-${photoMatch[2]}`,reference=parsePhotoKey(photoMatch[1],key);
  if(!reference||reference.path!==url.pathname)return respond('Not found',404);
  const rows=await sql`SELECT photos FROM event_feedback WHERE status='saved' AND id=${photoMatch[1]} AND payload->>'deleted' IS DISTINCT FROM 'true'`;
  const photo=rows[0]?.photos?.find(p=>p.key===key);
  if(!photo||photo.type!==reference.type||!Number.isInteger(photo.bytes)||photo.bytes<1||photo.bytes>4194304)return respond('Not found',404);
  const object=await env.FEEDBACK_PHOTOS.get(key);if(!object)return respond('Not found',404);
  const type=object.httpMetadata?.contentType;if(type!==photo.type)return respond('Unsupported image',415);
  return new Response(object.body,{headers:{...headers,'Content-Type':type,'Content-Disposition':'inline'}});
 }
 if(!['/feedback/admin','/feedback/admin/','/feedback/admin/export'].includes(url.pathname))return respond('Not found',404);
 const cursor=url.searchParams.get('cursor')||'00000000-0000-0000-0000-000000000000';
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(cursor))return respond('Invalid cursor',400);
 const rows=await sql`SELECT id,created_at,payload,photos FROM event_feedback WHERE status='saved' AND id>${cursor}::uuid ORDER BY id LIMIT 101`;
 const hasMore=rows.length>100;if(hasMore)rows.pop();const nextCursor=hasMore?rows.at(-1).id:null;
 if(url.pathname.endsWith('/export'))return respond(JSON.stringify({classification:'PRIVATE: raw answers and photo metadata require manual review before any sharing',rows,nextCursor}),200,'application/json; charset=utf-8');
 const visible=rows; // Never let attendee-controlled text hide a response.
 const q=(url.searchParams.get('q')||'').slice(0,200),needle=q.toLocaleLowerCase();const filtered=visible.filter(r=>!needle||JSON.stringify(r.payload).toLocaleLowerCase().includes(needle));
 const cards=filtered.map(r=>{const p=r.payload;return `<article><div class="row"><h2>${esc(p.name||'Sin nombre')}</h2><span class="badge ${p.photoConsent?'yes':''}">${p.photoConsent?'Publicación autorizada · dar crédito':'Sin autorización para publicar fotos'}</span></div><p class="meta">${esc(p.email)} · ${esc(p.affiliation)} · ${esc(p.role)}</p><p class="meta">${esc(new Date(r.created_at).toISOString())}</p>${[['feedback','Experiencia'],['improvements','Mejoras'],['sponsorQuestion','Preguntas para el patrocinador'],['topics','Próximos temas']].map(([k,label])=>`<section><h3>${label}</h3><p class="answer">${esc(p[k]||'Sin respuesta')}</p></section>`).join('')}<div class="photos">${(r.photos||[]).map((photo,i)=>{const ref=parsePhotoKey(r.id,photo.key);return ref&&ref.type===photo.type?`<a href="${esc(ref.path)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(ref.path)}" alt="Foto ${i+1} compartida por ${esc(p.name||'asistente')}"></a>`:'';}).join('')}</div><small>Recibo: ${esc(r.id)}</small></article>`}).join('');
 return respond(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Respuestas privadas · Cafe Compute</title><link rel="stylesheet" href="/feedback/admin.css"></head><body><main><header><div class="brand">Cafe Compute </div><span class="badge">SOLO ORGANIZADOR</span></header><p class="eyebrow">FEEDBACK · PRIVADO</p><h1>Lo que dejó el Café.</h1><p><a href="/feedback/admin/export">Exportar página JSON privada</a> · <a href="/feedback/credit">Mi beneficio (si corresponde)</a></p><p>Comentarios, preguntas y fotos. Solo accesible con la cuenta organizadora autorizada. Nada se publica ni se reenvía automáticamente.</p><div class="stats"><div><b>${visible.length}</b> respuestas</div><div><b>${visible.filter(r=>r.payload.sponsorQuestion?.trim()).length}</b> con preguntas</div><div><b>${visible.reduce((n,r)=>n+(r.photos?.length||0),0)}</b> fotos</div></div><form method="get"><label for="q">Buscar por nombre, email o contenido</label><div class="row"><input id="q" name="q" value="${esc(q)}" placeholder="Ej.: API, próximos eventos o nombre"><button>Buscar</button><a href="/feedback/admin">Actualizar</a></div></form><p class="meta">${filtered.length} resultados. Incluye todos los registros guardados, también pruebas. ${nextCursor?`<a href="/feedback/admin?cursor=${esc(nextCursor)}">Siguiente página</a>`:''} Esta página muestra hasta 100 respuestas; la búsqueda se limita a la página.</p>${cards||'<article><h2>No hay respuestas que mostrar.</h2><p>Prueba otra búsqueda o vuelve más tarde.</p></article>'}<footer>Información privada. Publica fotos solo con autorización y crédito a su autor/a.</footer></main></body></html>`);
 }catch{return respond('No se pudieron cargar las respuestas. Inténtalo de nuevo.',503);}
}
