import {databaseFor} from './database.js';
import {identity,validOrigin,hash,reply,storeFor} from './auth.js';
import {readBounded,imageType} from './feedback.js';
// One request buffers at most 4 MiB. Per-submission slots bound retained storage.
export async function handlePhoto(request,env,dependencies={}){
 if(request.method!=='POST')return reply({error:'Not found'},404);
 if(env.PHOTOS_ENABLED!=='true'||env.PRIVATE_PHOTO_METADATA_ACK!=='true'||env.AUTH_ENABLED!=='true'||env.FEEDBACK_ENABLED!=='true'||!env.AUTH_SECRET||!env.FEEDBACK_PHOTOS||!env.DATABASE_URL)return reply({error:'Unavailable'},503);
 if(!validOrigin(request,env))return reply({error:'Invalid origin'},403);
 try{
  const person=await identity(request,env,dependencies.store);if(!person)return reply({error:'Sign in required'},401);
  if(request.headers.get('X-CSRF-Token')!==person.csrf)return reply({error:'Invalid CSRF'},403);
  const u=new URL(request.url),id=u.searchParams.get('id'),slot=u.searchParams.get('slot');
  if(!/^[a-f0-9-]{36}$/.test(id||'')||! /^(?:[0-9]|1[0-9])$/.test(slot||''))return reply({error:'Invalid slot'},400);
  const quotaStore=dependencies.store||storeFor(env);
  if(!await quotaStore.rate(`photo-account:${Math.floor(Date.now()/86400000)}:${person.id}`,60))return reply({error:'Daily photo request limit reached'},429);
  const sql=dependencies.sql||databaseFor(env);
  const rows=await sql`SELECT id FROM event_feedback WHERE id=${id} AND status='saved' AND payload->>'recipientId'=${person.id} AND payload->>'deleted' IS DISTINCT FROM 'true'`;
  if(!rows.length)return reply({error:'Submission not found'},404);
  let bytes;try{bytes=await readBounded(request,4194304);}catch{return reply({error:'Maximum 4 MB per photo'},413);}
  const type=imageType(bytes);if(!type||type!==request.headers.get('Content-Type'))return reply({error:'Invalid image'},400);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const key=`feedback/${id}/photo-${slot}-${digest}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type]}`;
  const reserved=await sql`SELECT cc_reserve_photo(${id}::uuid,${person.id}::uuid,${Number(slot)},${key},${type},${bytes.length}) AS reservation`;
  const reservation=reserved[0]?.reservation;
  if(reservation?.status==='denied')return reply({error:'Submission not found'},404);
  if(reservation?.status==='conflict')return reply({error:'Slot already contains another photo'},409);
  if(reservation?.status!=='reserved')throw Error('Reservation unavailable');
  if(!reservation.ready)await env.FEEDBACK_PHOTOS.put(key,bytes,{httpMetadata:{contentType:type},customMetadata:{submission:id}});
  // The DB locks the receipt again after the object write. Cleanup is terminal,
  // even if a previously authorized put finishes after erasure and flags resume.
  const committed=await sql`SELECT cc_commit_photo(${id}::uuid,${person.id}::uuid,${Number(slot)},${key},${type},${bytes.length}) AS committed`;
  if(committed[0]?.committed===false){
   try{await env.FEEDBACK_PHOTOS.delete(key);}catch{/* Retained reservation lets repeat cleanup reconcile this exact key. */}
   return reply({error:'Submission not found'},404);
  }
  if(committed[0]?.committed!==true)throw Error('Commit unavailable');
  return reply({saved:true,slot:Number(slot)});
 }catch{return reply({error:'Could not confirm photo. Retry safely.'},503);}
}
