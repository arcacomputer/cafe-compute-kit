import test from 'node:test';
import assert from 'node:assert/strict';

test('native feedback challenge installs durable limiter and unsupported photos fail closed', async () => {
 const {createMain}=await import('../vercel/main.mjs');
 const env={PUBLIC_ORIGIN:'https://event.example',AUTH_ENABLED:'true',AUTH_SECRET:'test-secret',DATABASE_URL:'unused',FEEDBACK_ENABLED:'true',FEEDBACK_SIGNING_KEY:'test-signing-key'};
 let count=0;
 const database={query:async(q)=>q.includes('FROM cc_sessions')?[{id:'11111111-1111-4111-8111-111111111111',email:'guest@example.test'}]:q.startsWith('INSERT INTO cc_auth_rate')&&++count<=100?[{count}]:[]};
 const options={env,database,assets:{fetch:async()=>new Response('asset')},ipAddress:()=> '203.0.113.1',waitUntil:()=>{}};
 const a=createMain(options),b=createMain(options);
 const request=()=>new Request(env.PUBLIC_ORIGIN+'/api/feedback/challenge',{headers:{Origin:env.PUBLIC_ORIGIN,Cookie:'__Host-cc_session='+'a'.repeat(64)}});
 const responses=await Promise.all(Array.from({length:102},(_,i)=>(i%2?a:b).fetch(request())));
 assert.equal(responses.filter(r=>r.status===200).length,100);
 assert.equal(responses.filter(r=>r.status===429).length,2);
 assert.equal((await createMain({...options,database:{query:async()=>{throw Error('offline')}}}).fetch(request())).status,503);
 assert.equal((await createMain({...options,env:{...env,PHOTOS_ENABLED:'true',PRIVATE_PHOTO_METADATA_ACK:'true'}}).fetch(new Request(env.PUBLIC_ORIGIN+'/'))).status,503);
});

test('native main denies noncanonical hosts and serves through shared worker', async () => {
 const {createMain}=await import('../vercel/main.mjs');
 const main=createMain({env:{PUBLIC_ORIGIN:'https://event.example'},assets:{fetch:async()=>new Response('public asset')},ipAddress:()=> '203.0.113.1',waitUntil:()=>{}});
 assert.equal((await main.fetch(new Request('https://evil.example/'))).status,421);
 const response=await main.fetch(new Request('https://event.example/'));
 assert.equal(response.status,200);
 assert.equal(await response.text(),'public asset');
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
});

test('main projects env, rejects ambiguous platform IPs and replaces spoofed CF identity', async () => {
 const {createMain}=await import('../vercel/main.mjs');
 const {projectMainEnv}=await import('../vercel/environment.mjs');
 const env={PUBLIC_ORIGIN:'https://event.example',AUTH_ENABLED:'true',AUTH_SECRET:'test-secret',DATABASE_URL:'unused',TEST_DATABASE:'evil',TEST_ADMIN_DATABASE:'evil',FEEDBACK_RATE:'evil',ASSETS:'evil',AGENTMAIL_SEND_KEY:'must-not-reach-main',PHOTOS_ENABLED:'false'};
 const projected=projectMainEnv(env);
 for(const field of ['TEST_DATABASE','TEST_ADMIN_DATABASE','FEEDBACK_RATE','ASSETS','AGENTMAIL_SEND_KEY'])assert.equal(projected[field],undefined);
 const queries=[],database={query:async(q,p)=>{queries.push([q,p]);return q.startsWith('INSERT INTO cc_auth_rate')?[{count:1}]:[]}};
 const request=()=>new Request(env.PUBLIC_ORIGIN+'/api/auth/consume',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.66','X-Forwarded-For':'198.51.100.99','X-Forwarded-Host':'event.example'},body:JSON.stringify({token:'a'.repeat(64)})});
 const options={env,assets:{fetch:async()=>new Response('asset')},waitUntil:()=>{},database};
 for(const ip of [undefined,'','203.0.113.1, 203.0.113.2','not-ip','fe80::1%eth0'])assert.equal((await createMain({...options,ipAddress:()=>ip}).fetch(request())).status,503);
 assert.equal(queries.length,0);
 assert.equal((await createMain({...options,ipAddress:()=> '203.0.113.1'}).fetch(request())).status,400);
 assert.equal(queries.length,2);
 const firstKey=queries[0][1][0];queries.length=0;
 assert.equal((await createMain({...options,ipAddress:()=> '203.0.113.1'}).fetch(request())).status,400);
 assert.equal(queries[0][1][0],firstKey);
 queries.length=0;
 await createMain({...options,ipAddress:()=> '203.0.113.2'}).fetch(request());
 assert.notEqual(queries[0][1][0],firstKey);
 const hostMismatch=new Request(env.PUBLIC_ORIGIN+'/',{headers:{Host:'evil.example','X-Forwarded-Host':'event.example'}});
 assert.equal((await createMain({...options,ipAddress:()=> '203.0.113.1'}).fetch(hostMismatch)).status,421);
});
