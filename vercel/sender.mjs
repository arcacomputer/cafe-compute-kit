import {timingSafeEqual} from 'node:crypto';
import {sendMagic} from '../apps/feedback/mailer/worker.js';
import {httpsOrigin,projectSenderEnv,validServiceToken} from './environment.mjs';

const deny=(text,status)=>new Response(text,{status,headers:{'Cache-Control':'no-store','X-Magic-Delivery':'not-sent','X-Content-Type-Options':'nosniff'}});
export function createSender({env:source={},database,transport=fetch}) {
 const env=projectSenderEnv(source),secret=source.MAILER_SERVICE_TOKEN;
 if(database)env.TEST_DATABASE=database;
 return {async fetch(request) {
  let origin;
  try{origin=httpsOrigin(source.SENDER_ORIGIN);if(!validServiceToken(secret))throw Error();}catch{return deny('Unavailable',503);}
  const url=new URL(request.url);
  if(url.origin!==origin||request.headers.has('Host')&&request.headers.get('Host')!==url.host)return deny('Invalid host',421);
  const auth=request.headers.get('Authorization');
  if(typeof auth!=='string'||!/^Bearer [a-f0-9]{64}$/.test(auth)||!timingSafeEqual(Buffer.from(auth.slice(7)),Buffer.from(secret)))return deny('Unauthorized',401);
  if(request.method!=='POST'||url.pathname!=='/magic-link'||url.search)return deny('Not found',404);
  // The shared sender owns all template, recipient, token/fence and classification
  // checks. Never follow a redirect with its provider credential, either.
  return sendMagic(request,env,(url,options)=>transport(url,{...options,redirect:'error'}));
 }};
}
