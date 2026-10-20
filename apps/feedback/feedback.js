import { getConfig } from './config.js';
import { databaseFor } from './database.js';
import { identity, validateRequired, storeFor } from './auth.js';
const MAX_BODY=64*1024;
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
const error=(status,message)=>json({error:message},status);
export function validateFields(form){
  const out={};
  for(const [name,max] of Object.entries({feedback:4000,improvements:4000,sponsorQuestion:4000,topics:2000,name:100,email:254,affiliation:160,role:120})){
    const value=form.get(name)??'';
    if(typeof value!=='string'||value.length>max||form.getAll(name).length>1)throw Error('Invalid field');
    out[name]=value.trim();
  }
  if(![out.feedback,out.improvements,out.sponsorQuestion,out.topics].some(Boolean))throw Error('Write at least one response');
  if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Error('Invalid email');
  if(![null,'true','false'].includes(form.get('photoConsent'))||form.getAll('photoConsent').length>1)throw Error('Invalid consent');
  out.photoConsent=form.get('photoConsent')==='true';
  out.privacyVersion='1';
  return out;
}
export function imageType(b){
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function readBounded(request,max=MAX_BODY){
 if(Number(request.headers.get('content-length'))>max)throw Error('Body too large');
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader(),chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Body too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;
}
async function hmac(secret,text){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
async function validToken(token,secret,ip){
 if(typeof token!=='string'||token.length>180)return null;
 const [id,time,signature,...rest]=token.split('.');
 if(rest.length||!/^[-a-f0-9]{36}$/.test(id)||!/^\d{13}$/.test(time)||!/^\w{64}$/.test(signature??''))return null;
 const age=Date.now()-Number(time);if(age<2000||age>30*60*1000)return null;
 const expected=await hmac(secret,`${id}.${time}.${ip}`);let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);return diff===0?id:null;
}
export async function handleFeedback(request,env,dependencies={}){
 const path=new URL(request.url).pathname;
 if(!((path==='/api/feedback/challenge'&&request.method==='GET')||(path==='/api/feedback'&&request.method==='POST')))return error(404,'Not found');
 if(env.FEEDBACK_ENABLED!=='true'||env.AUTH_ENABLED!=='true'||!env.DATABASE_URL||!env.AUTH_SECRET||!env.FEEDBACK_SIGNING_KEY||!env.FEEDBACK_RATE)return error(503,'Feedback is temporarily unavailable. Nothing was saved.');
 try{
  const origin=getConfig(env).origin,source=request.headers.get('Origin'),referer=request.headers.get('Referer');
  if(!(source===origin||(request.method==='GET'&&!source&&referer?.startsWith(origin+'/')))||request.headers.has('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')return error(403,'Invalid origin');
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return error(503,'Feedback is temporarily unavailable.');
  const person=await identity(request,env,dependencies.store);if(!person)return error(401,'Sign in required');
  const key=await hmac(env.FEEDBACK_SIGNING_KEY,`transport:${Math.floor(Date.now()/900000)}:${person.id}:${ip}`);
  if(!(await env.FEEDBACK_RATE.limit({key})).success)return error(429,'Please wait before trying again.');
  if(path.endsWith('/challenge')){const prefix=`${crypto.randomUUID()}.${Date.now()}`;return json({token:`${prefix}.${await hmac(env.FEEDBACK_SIGNING_KEY,`${prefix}.${ip}`)}`});}
  if(!/^multipart\/form-data; boundary=/i.test(request.headers.get('Content-Type')||''))return error(415,'Use the feedback form.');
  let form;try{form=await new Response(await readBounded(request),{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData();}catch{return error(413,'Invalid or oversized form (64 KiB maximum).');}
  let data;try{data=validateRequired(validateFields(form),person);}catch{return error(400,'Check your required answers and email.');}
  if(form.getAll('csrf').length!==1||form.get('csrf')!==person.csrf)return error(403,'Invalid CSRF');
  if(form.get('website')||form.getAll('photos').length)return error(400,'Use individual photo uploads after saving feedback.');
  const id=await validToken(form.get('token'),env.FEEDBACK_SIGNING_KEY,ip);if(!id)return error(400,'Form expired or submitted too quickly. Please try again.');
  const sql=dependencies.sql||databaseFor(env);
  const rows=await sql`SELECT cc_save_feedback(${id}::uuid,${person.id}::uuid,${JSON.stringify(data)}::jsonb) AS receipt`;
  const result=rows[0]?.receipt;if(!result?.saved)return error(503,'Could not confirm receipt. Keep your answers and retry.');
  return json({id:result.id,saved:true},result.created?201:200);
 }catch(e){
  if(e?.message?.includes('receipt payload mismatch'))return error(409,'This receipt already saved different answers. Renew the connection to submit changes.');
  if(e?.message?.includes('foreign receipt'))return error(403,'Submission belongs to another account');
  if(e?.message?.includes('capacity reached'))return error(429,'Daily capacity reached. Saved feedback and credit remain available.');
  return error(503,'Could not confirm receipt. Keep your answers and retry safely.');
 }
}
