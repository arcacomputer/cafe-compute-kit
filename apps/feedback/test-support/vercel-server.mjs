import assert from 'node:assert/strict';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {ipAddress} from '@vercel/functions';
import {createMain} from '../../../vercel/main.mjs';
import {createSender} from '../../../vercel/sender.mjs';
import {createAssets} from '../../../vercel/assets.mjs';
import {platformServer} from './platform-server.mjs';

// Actual main/sender adapters with two native HTTPS servers and independent DB
// roles. Only the final AgentMail network hop is a synthetic no-send transport.
export async function proofServer(f){
 let mainServer,senderServer,main,sender;const calls={provider:0,denied:0};
 const serviceToken=randomBytes(32).toString('hex');
 try{
  senderServer=await platformServer({onOrigin(){},fetch:(request)=>sender.fetch(request)});
  mainServer=await platformServer({headerForIP:'x-real-ip',onOrigin(value){f.env.PUBLIC_ORIGIN=value;},fetch:(request,ctx)=>main.fetch(request,ctx)});
  const assets=createAssets(JSON.parse(await readFile(new URL('../../../vercel/generated/public-assets.json',import.meta.url),'utf8')));
  const env={...f.env,SENDER_ORIGIN:senderServer.origin,MAILER_SERVICE_TOKEN:serviceToken};
  sender=createSender({env:{PUBLIC_ORIGIN:mainServer.origin,SENDER_ORIGIN:senderServer.origin,MAILER_SERVICE_TOKEN:serviceToken,DATABASE_URL:'in-process-sender-proof',MAIL_SEND_ENABLED:'true',AGENTMAIL_SEND_KEY:'synthetic-not-a-provider-key',APPROVED_INBOX:'synthetic-proof-inbox',REPLY_TO:'organizer@example.test',EVENT_NAME:env.EVENT_NAME},database:f.sender,transport:async(url,options)=>{
   assert.equal(url,'https://api.agentmail.to/v0/inboxes/synthetic-proof-inbox/messages/send');
   assert.equal(options.redirect,'error');const body=JSON.parse(options.body);
   const link=body.text.match(/https:\/\/127\.0\.0\.1:\d+\/(?:en\/)?feedback\/sign-in#[a-f0-9]{64}/)?.[0];assert.ok(link,'Constrained synthetic email contains a sign-in link');
   assert.equal(new URL(link).origin,mainServer.origin);calls.provider++;
   f.outbox.messages.push({email:body.to[0],link,lang:new URL(link).pathname.startsWith('/en/')?'en':'es'});
   return new Response('{}',{status:202});
  }});
  const ca=await readFile(senderServer.caFile);
  async function transport(url,options){
   assert.equal(url,senderServer.origin+'/magic-link');assert.equal(options.redirect,'manual');
   return new Promise((done,reject)=>{
    const request=https.request(url,{method:options.method,headers:options.headers,ca,signal:options.signal},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>done(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));});request.on('error',reject);request.end(options.body);
   });
  }
  main=createMain({env,assets,database:f.runtime,adminDatabase:f.admin,ipAddress,transport});
  const forbidden=await sender.fetch(new Request(senderServer.origin+'/magic-link',{method:'POST',body:'{}'}));assert.equal(forbidden.status,401);assert.equal(calls.provider,0);calls.denied++;
  return {...mainServer,platform:'vercel',calls,senderOrigin:senderServer.origin,async close(){await mainServer.close();await senderServer.close();}};
 }catch(error){await mainServer?.close();await senderServer?.close();throw error;}
}
