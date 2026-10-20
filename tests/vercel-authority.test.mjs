import test from 'node:test';
import assert from 'node:assert/strict';

// HTTPS authority may explicitly include its default port. The native SDK's
// node-to-Web bridge needs that port to preserve HTTPS in local request URLs.
test('main accepts canonical explicit HTTPS port without admitting another authority',async()=>{
 const {createMain}=await import('../vercel/main.mjs');
 const main=createMain({env:{PUBLIC_ORIGIN:'https://event.example'},ipAddress:()=> '192.0.2.1',waitUntil:()=>{},assets:{fetch:async()=>new Response('public')}});
 for(const host of ['event.example','event.example:443'])assert.equal((await main.fetch(new Request('https://event.example/en/',{headers:{host}}))).status,200,host);
 for(const host of ['event.example:80','event.example:444','evil.example:443','event.example:443@evil.example'])assert.equal((await main.fetch(new Request('https://event.example/en/',{headers:{host,'x-forwarded-host':'event.example'}}))).status,421,host);
});
test('sender accepts canonical explicit HTTPS port but rejects another authority before authentication',async()=>{
 const {createSender}=await import('../vercel/sender.mjs');
 const sender=createSender({env:{PUBLIC_ORIGIN:'https://event.example',SENDER_ORIGIN:'https://sender.example',MAILER_SERVICE_TOKEN:'a'.repeat(64)}});
 for(const host of ['sender.example','sender.example:443'])assert.equal((await sender.fetch(new Request('https://sender.example/magic-link',{headers:{host}}))).status,401,host);
 for(const host of ['sender.example:80','sender.example:444','evil.example:443','sender.example:443@evil.example'])assert.equal((await sender.fetch(new Request('https://sender.example/magic-link',{headers:{host,'x-forwarded-host':'sender.example'}}))).status,421,host);
});
