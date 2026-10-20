import test from 'node:test';
import assert from 'node:assert/strict';

test('main retains generic background login and uses server-only sender transport',async()=>{
 const {createMain}=await import('../vercel/main.mjs');
 const origin='https://event.example',env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'test-secret',DATABASE_URL:'unused',MAGIC_EMAIL_ENABLED:'true',SENDER_ORIGIN:'https://sender.example',MAILER_SERVICE_TOKEN:'a'.repeat(64)};
 const pending=[],sent=[],queries=[];
 let release;const held=new Promise(resolve=>{release=resolve});
 const database={query:async(q,p)=>{queries.push(q);if(q.startsWith('INSERT INTO cc_auth_rate'))return [{count:1}];if(q.includes('FROM cc_recipients'))return p[0]==='known@example.test'?[{id:'recipient',email:p[0]}]:[];return []}};
 const main=createMain({env,database,assets:{fetch:async()=>new Response('asset')},ipAddress:()=> '203.0.113.1',waitUntil:task=>pending.push(task),transport:async(url,options)=>{sent.push({url,options});await held;return new Response(null,{status:202,headers:{'X-Magic-Delivery':'accepted'}})}});
 const request=email=>new Request(origin+'/api/auth/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email})});
 const responses=[];for(const email of ['known@example.test','unknown@example.test'])responses.push(await (await main.fetch(request(email))).text());
 assert.equal(responses[0],responses[1]);assert.equal(pending.length,2);
 release();await Promise.all(pending);
 assert.equal(sent.length,1);assert.equal(sent[0].url,'https://sender.example/magic-link');
 assert.equal(sent[0].options.redirect,'manual');
 assert.match(new TextDecoder().decode(sent[0].options.body),/https:\/\/event.example\/feedback\/sign-in#[a-f0-9]{64}/);
 assert.ok(queries.some(q=>q.startsWith('INSERT INTO cc_magic_tokens')));
 assert.equal((await createMain({env:{...env,MAILER_SERVICE_TOKEN:'short'},database,assets:{fetch:async()=>new Response('asset')},ipAddress:()=> '203.0.113.1',waitUntil:()=>{}}).fetch(request('known@example.test'))).status,503);
});

test('code-only sender and storage capabilities work without environment binding deserialization',async()=>{
 const {createMain}=await import('../vercel/main.mjs');
 const pending=[],outbox=[];
 const env={PUBLIC_ORIGIN:'https://event.example',AUTH_ENABLED:'true',AUTH_SECRET:'secret',DATABASE_URL:'unused',MAGIC_EMAIL_ENABLED:'true',PHOTOS_ENABLED:'true',PRIVATE_PHOTO_METADATA_ACK:'true',MAGIC_MAILER:'evil',FEEDBACK_PHOTOS:'evil'};
 const database={query:async(q,p)=>q.startsWith('INSERT INTO cc_auth_rate')?[{count:1}]:q.includes('FROM cc_recipients')?[{id:'recipient',email:p[0]}]:[]};
 const app=createMain({env,database,sender:{fetch:async request=>{outbox.push(await request.json());return new Response(null,{status:202})}},storage:{put(){},get(){},delete(){}},assets:{fetch:async()=>new Response('asset')},ipAddress:()=> '203.0.113.1'});
 const response=await app.fetch(new Request(env.PUBLIC_ORIGIN+'/api/auth/request',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:'{"email":"known@example.test"}'}),{waitUntil:p=>pending.push(p)});
 assert.equal(response.status,200);await Promise.all(pending);assert.equal(outbox.length,1);
});
