import {isIP} from 'node:net';
import worker from '../apps/feedback/worker.js';
import {getConfig} from '../apps/feedback/config.js';
import {reply} from '../apps/feedback/auth.js';
import {projectMainEnv,matchesHost} from './environment.mjs';
import {createFeedbackRate} from './rate.mjs';
import {createMagicMailer} from './mailer-client.mjs';

// Capabilities are supplied by the entrypoint, never from HTTP/environment strings.
export function createMain({env:source={},assets,ipAddress,waitUntil,database,adminDatabase,sender,storage,transport}) {
 const env=projectMainEnv(source);
 if(database)env.TEST_DATABASE=database;
 if(adminDatabase)env.TEST_ADMIN_DATABASE=adminDatabase;
 env.ASSETS=assets;
 if(storage)env.FEEDBACK_PHOTOS=storage;
 if(env.DATABASE_URL)env.FEEDBACK_RATE=createFeedbackRate(env);
 let invalidMailer=false;
 if(env.MAGIC_EMAIL_ENABLED==='true'){
  try{env.MAGIC_MAILER=sender||createMagicMailer(source,{transport});}catch{invalidMailer=true;}
 }
 return {async fetch(request,ctx) {
  try {
   const retain=waitUntil||ctx?.waitUntil?.bind(ctx);
   if(invalidMailer)return reply({error:'Unavailable'},503);
   if(env.PHOTOS_ENABLED==='true'&&!storage)return reply({error:'Private photo storage is not configured for Vercel'},503);
   const url=new URL(request.url),config=getConfig(env);
   if(url.origin!==config.origin||!matchesHost(request,url))return reply({error:'Invalid host'},421);
   const ip=ipAddress(request);
   if(typeof ip!=='string'||ip.includes('%')||!isIP(ip)||typeof retain!=='function')return reply({error:'Unavailable'},503);
   const headers=new Headers(request.headers);
   headers.set('CF-Connecting-IP',ip);
   return await worker.fetch(new Request(request,{headers}),env,{waitUntil:retain});
  }catch{return reply({error:'Unavailable'},503);}
 }};
}
