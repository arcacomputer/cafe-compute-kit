import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {handleAuth} from './auth.js';
const session='a'.repeat(64),origin='https://feedback.example.test',env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'synthetic',DATABASE_URL:'unused',CREDIT_CLAIMS_ENABLED:'true',REAL_CREDIT_DISTRIBUTION:'false'};
function request(){return new Request(origin+'/api/auth/claim',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json',Cookie:'__Host-cc_session='+session},body:JSON.stringify({csrf:createHmac('sha256','synthetic').update('csrf:'+session).digest('hex')})});}
test('access-only owner has no benefit claim rights',async()=>{
 const r=await handleAuth(request(),env,{}, {store:{session:async()=>({id:'owner',email:'owner@example.test',eligible:true,claim_eligible:false,synthetic:true}),rate:async()=>true,claim:async()=>assert.fail('claim called')}});assert.equal(r.status,403);
});
test('short-code allocation is revealed as text with explicit type, not a fabricated URL',async()=>{
 const r=await handleAuth(request(),env,{}, {store:{session:async()=>({id:'guest',email:'guest@example.test',claim_eligible:true,synthetic:true}),rate:async()=>true,claim:async()=>({value:'SYNTHETIC_ABC-123',type:'code'})}});assert.equal(r.status,200);const x=await r.json();assert.equal(x.type,'code');assert.equal(x.value,'SYNTHETIC_ABC-123');assert.equal(x.link,undefined);
});
