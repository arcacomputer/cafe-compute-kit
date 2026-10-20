import { databaseFor } from './database.js';
import { formView } from './form-view.js';
import { loginView } from './login-view.js';
import { authView } from './auth-view.js';
import { readBounded } from './feedback.js';
import { getConfig, creditValue } from './config.js';
const COOKIE='__Host-cc_session';
const headers={'Cache-Control':'no-store, no-transform','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
export const reply=(body,status=200)=>Response.json(body,{status,headers});
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
async function keyed(secret,value){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export function cookieToken(request){const values=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));return values.length===1&&/^[a-f0-9]{64}$/.test(values[0].slice(COOKIE.length+1))?values[0].slice(COOKIE.length+1):null;}
export function storeFor(env){const sql=databaseFor(env);return new AuthStore((q,p)=>sql.query(q,p));}
export class AuthStore {
 constructor(query){this.query=query;}
 async rate(key,limit){const rows=await this.query('INSERT INTO cc_auth_rate(key,count) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET count=cc_auth_rate.count+1 WHERE cc_auth_rate.count<$2 RETURNING count',[key,limit]);return rows.length>0;}
 async recipient(email){return (await this.query('SELECT * FROM cc_recipients WHERE email=$1 AND eligible',[email]))[0];}
 async issue(recipient,tokenHash){await this.query("INSERT INTO cc_magic_tokens(hash,recipient_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[tokenHash,recipient]);}
 async consume(tokenHash,sessionHash){return (await this.query(`WITH consumed AS (UPDATE cc_magic_tokens t SET consumed_at=now() WHERE hash=$1 AND consumed_at IS NULL AND expires_at>now() AND EXISTS(SELECT 1 FROM cc_recipients r WHERE r.id=t.recipient_id AND eligible) RETURNING recipient_id) INSERT INTO cc_sessions(hash,recipient_id,expires_at) SELECT $2,recipient_id,now()+interval '8 hours' FROM consumed RETURNING recipient_id`,[tokenHash,sessionHash]))[0];}
 async session(tokenHash){return (await this.query('SELECT r.* FROM cc_sessions s JOIN cc_recipients r ON r.id=s.recipient_id WHERE s.hash=$1 AND s.expires_at>now() AND r.eligible',[tokenHash]))[0];}
 async logout(tokenHash){await this.query('DELETE FROM cc_sessions WHERE hash=$1',[tokenHash]);}
 async claim(id,allowReal){return (await this.query('SELECT cc_assign_credit($1,$2) AS link',[id,allowReal]))[0].link;}
}
export async function identity(request,env,store=storeFor(env)){
 const token=cookieToken(request);if(!token)return null;
 const person=await store.session(await hash(token));return person?{...person,csrf:await keyed(env.AUTH_SECRET,'csrf:'+token)}:null;
}
export function validOrigin(request,env){return request.headers.get('Origin')===getConfig(env).origin&&(!request.headers.has('Sec-Fetch-Site')||request.headers.get('Sec-Fetch-Site')==='same-origin');}
export function validateRequired(data,person){
 for(const key of ['name','affiliation','role','feedback','improvements'])if(typeof data[key]!=='string'||!data[key].trim())throw Error('Required field');
 if(data.name.length>100||data.affiliation.length>160||data.role.length>120)throw Error('Field too long');
 return {...data,email:person.email,recipientId:person.id};
}
export function allowedCredit(link,env,synthetic){return creditValue(link,'link',env,synthetic);}
// Only a private service binding can deliver mail. No broad email API key is
// installed on this Worker. Local tests inject an in-memory outbox, never HTTP.
async function deliver(env,email,link,lang){if(env.MAGIC_EMAIL_ENABLED!=='true'||!env.MAGIC_MAILER)throw Error('Mail disabled');const r=await env.MAGIC_MAILER.fetch(new Request('https://mailer.internal/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:email,template:'cafe-compute-magic-link',link,lang})}));if(!r.ok){const error=Error('Delivery failed');error.definitelyNotSent=r.headers.get('X-Magic-Delivery')==='not-sent';throw error;}}
export async function handleAuth(request,env,ctx,dependencies={}){
 if(env.AUTH_ENABLED!=='true'||!env.DATABASE_URL||!env.AUTH_SECRET)return reply({error:'Unavailable'},503);
 const store=dependencies.store||storeFor(env),mail=dependencies.mail||((email,link,lang)=>deliver(env,email,link,lang));
 const path=new URL(request.url).pathname;
 try{
  if(request.method!=='POST')return reply({error:'Not found'},404);
  if(!validOrigin(request,env))return reply({error:'Invalid origin'},403);
  if(request.headers.get('Content-Type')!=='application/json')return reply({error:'JSON required'},415);
  let body;try{body=JSON.parse(new TextDecoder().decode(await readBounded(request,8192)));if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return reply({error:'Invalid request'},400);}
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'Unavailable'},503);
  const bucket=Math.floor(Date.now()/900000);
  const ipKey=await keyed(env.AUTH_SECRET,`ip:${bucket}:${ip}`);
  if(!['/api/auth/request','/api/auth/consume','/api/auth/claim','/api/auth/logout'].includes(path))return reply({error:'Not found'},404);
  if(['/api/auth/request','/api/auth/consume'].includes(path)&&!await store.rate(ipKey,10))return reply({error:'Please wait'},429);
  if(path==='/api/auth/request'){
   if(body.lang!==undefined&&!['es','en'].includes(body.lang))return reply({error:'Invalid language'},400);
   const lang=body.lang||'es';
   const generic=reply({ok:true,message:'If this email is authorized, a sign-in link will arrive shortly.'});
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';

   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return generic;
   // Eligibility and delivery run after the identical response; no membership oracle.
   ctx.waitUntil((async()=>{
    if(!await store.rate(await keyed(env.AUTH_SECRET,`email:${bucket}:${email}`),3))return;
    const person=await store.recipient(email);if(!person)return;
    // Bound repeat mail requests across IPs and 15-minute buckets.
    if(!await store.rate(await keyed(env.AUTH_SECRET,`email-day:${Math.floor(Date.now()/86400000)}:${email}`),12))return;
    // Unknown addresses cannot exhaust the delivery budget for attendees.
    if(!await store.rate(await keyed(env.AUTH_SECRET,`global:${Math.floor(Date.now()/86400000)}`),300))return;
    if(!dependencies.mail&&(env.MAGIC_EMAIL_ENABLED!=='true'||!env.MAGIC_MAILER))return;
    const token=randomToken(), tokenHash=await hash(token);await store.issue(person.id,tokenHash);
    try {
     await mail(person.email,`${getConfig(env).origin}/${lang==='en'?'en/':''}feedback/sign-in#${token}`,lang);
     console.info(JSON.stringify({event:'cc_magic_mail',status:'accepted',count:1}));
    } catch (error) {
     console.info(JSON.stringify({event:'cc_magic_mail',status:'failed',count:1}));
     // A provider/service timeout can follow acceptance. Preserve the short-lived
     // issued token in that case; the sender's durable attempt fence forbids resend.
     if(error?.definitelyNotSent===true)await store.query('UPDATE cc_magic_tokens SET consumed_at=now() WHERE hash=$1 AND consumed_at IS NULL',[tokenHash]);
    }
   })().catch(()=>{console.info(JSON.stringify({event:'cc_magic_mail',status:'background_failed',count:1}));}));
   return generic;
  }
  if(path==='/api/auth/consume'){
   if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Invalid or expired link'},400);

   const session=randomToken();if(!await store.consume(await hash(body.token),await hash(session)))return reply({error:'Invalid or expired link'},400);
   const response=reply({ok:true});response.headers.set('Set-Cookie',`${COOKIE}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`);return response;
  }
  const person=await identity(request,env,store);if(!person)return reply({error:'Sign in required'},401);
  if(body.csrf!==person.csrf)return reply({error:'Invalid CSRF'},403);
  if(path==='/api/auth/logout'){await store.logout(await hash(cookieToken(request)));const r=reply({ok:true});r.headers.set('Set-Cookie',`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);return r;}
  if(path==='/api/auth/claim'&&!await store.rate(await keyed(env.AUTH_SECRET,`claim:${bucket}:${person.id}`),60))return reply({error:'Please wait'},429);
  if(path==='/api/auth/claim'){
   if(person.claim_eligible!==true)return reply({error:'Benefit eligibility requires organizer review'},403);
   if(env.CREDIT_CLAIMS_ENABLED!=='true')return reply({error:'Credit distribution is not active. Your feedback remains saved.'},503);
   if(!person.synthetic&&env.REAL_CREDIT_DISTRIBUTION!=='true')return reply({error:'Credit distribution is not active.'},503);
   const allocation=await store.claim(person.id,env.REAL_CREDIT_DISTRIBUTION==='true');
   if(!creditValue(allocation?.value,allocation?.type,env,person.synthetic))return reply({error:'Benefit value requires organizer review'},503);
   return reply({...allocation,...(allocation.type==='link'?{link:allocation.value}:{}),status:'assigned',note:'Assignment is not proof of provider redemption.'});
  }
  return reply({error:'Not found'},404);
 }catch{return reply({error:'Could not complete request. Please retry.'},503);}
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function authPage(request,env,store){
 const c=getConfig(env),url=new URL(request.url),es=!url.pathname.startsWith('/en/');
 const pageHeaders={...headers,'Content-Type':'text/html; charset=utf-8'};
 const shell=content=>new Response(authView(es,content,url.pathname.endsWith('/credit')?'credit':'sign-in',c),{headers:pageHeaders});
 if(url.pathname.endsWith('/sign-in'))return shell(`<h1 id="auth-title">${es?'Confirma tu acceso':'Confirm your sign-in'}</h1><p class="auth-copy">${es?'Ya casi estás. Gracias por compartir tu perspectiva.':'You’re almost there. Thank you for sharing your perspective.'}</p><button class="button login-submit" id="consume" type="button">${es?'Entrar al feedback':'Continue to feedback'}</button><p class="login-security">${es?'Enlace privado de un solo uso. Solo se activa al pulsar el botón.':'Private, single-use link. Activated only when you press the button.'}</p>`);
 let person;try{person=await identity(request,env,store);}catch{return shell('<p>Sign-in is temporarily unavailable. Please try later.</p>');}
 if(!person)return new Response(loginView(es,c),{headers:pageHeaders});
 if(url.pathname.endsWith('/credit'))return shell(`<h1 id="auth-title">${es?'Tu beneficio privado':'Your private benefit'}</h1><p class="auth-copy">${esc(c.benefit)}</p><p>${es?'Después del feedback, las personas elegibles pueden ver su código o enlace privado. Volver muestra la misma asignación. El proveedor controla el canje.':'After feedback, eligible recipients can reveal their private code or link. Returning shows the same assignment. The provider controls redemption.'}</p><button class="button login-submit" type="button" id="claim" data-csrf="${esc(person.csrf)}">${es?'Mostrar mi beneficio':'Reveal my benefit'}</button><p id="credit-link"></p>`);
 return new Response(formView(es,c,person),{headers:pageHeaders});
}
