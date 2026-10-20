import test from 'node:test';
import assert from 'node:assert/strict';
const env={SENDER_ORIGIN:'https://sender.example',MAILER_SERVICE_TOKEN:'a'.repeat(64)};
const request=()=>new Request('https://mailer.internal/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"to":"guest@example.test"}'});

test('main sender binding pins HTTPS origin and refuses redirect/ambiguous success',async()=>{
 const {createMagicMailer}=await import('../vercel/mailer-client.mjs');
 const seen=[];
 const mailer=createMagicMailer(env,{transport:async(url,options)=>{seen.push({url,options});return new Response(null,{status:202,headers:{'X-Magic-Delivery':'accepted'}})}});
 assert.equal((await mailer.fetch(request())).status,202);
 assert.equal(seen[0].url,'https://sender.example/magic-link');
 assert.equal(seen[0].options.redirect,'manual');
 assert.equal(seen[0].options.headers.Authorization,'Bearer '+env.MAILER_SERVICE_TOKEN);
 for(const origin of ['http://sender.example','https://sender.example/relay','https://user:pass@sender.example','https://sender.example/?debug=true'])assert.throws(()=>createMagicMailer({...env,SENDER_ORIGIN:origin}));
 assert.throws(()=>createMagicMailer({...env,MAILER_SERVICE_TOKEN:'short'}));
 for(const response of [new Response(null,{status:302,headers:{Location:'https://evil.example','X-Magic-Delivery':'not-sent'}}),new Response(null,{status:200})]){
  const result=await createMagicMailer(env,{transport:async()=>response}).fetch(request());
  assert.equal(result.status,503);assert.equal(result.headers.get('X-Magic-Delivery'),'ambiguous');
 }
 const denied=await createMagicMailer(env,{transport:async()=>new Response(null,{status:401,headers:{'X-Magic-Delivery':'not-sent'}})}).fetch(request());
 assert.equal(denied.headers.get('X-Magic-Delivery'),'not-sent');
 await assert.rejects(()=>createMagicMailer(env,{transport:async()=>{throw Error('timeout')}}).fetch(request()));
});
