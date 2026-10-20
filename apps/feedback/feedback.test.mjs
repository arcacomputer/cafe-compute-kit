import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleFeedback, validateFields, imageType, readBounded } from './feedback.js';
const req=(path, options={})=>new Request('https://feedback.example.test'+path, options);
test('unconfigured backend fails closed',async()=>assert.equal((await handleFeedback(req('/api/feedback/challenge'),{})).status,503));
test('no listing, admin, photo or export routes',async()=>{for(const path of ['/api/feedback','/api/feedback/export','/api/feedback/photos/x','/api/feedback/admin']) assert.equal((await handleFeedback(req(path),{})).status,404);});
test('validation permits anonymous feedback and explicit false consent',()=>{const f=new FormData();f.set('feedback','Synthetic QA');const x=validateFields(f);assert.equal(x.name,'');assert.equal(x.photoConsent,false);});
test('empty, oversized and invalid contact fields rejected',()=>{for(const fields of [{},{feedback:'a'.repeat(4001)},{feedback:'ok',email:'invalid'},{feedback:'ok',photoConsent:'yes'}]){const f=new FormData();for(const [k,v]of Object.entries(fields))f.set(k,v);assert.throws(()=>validateFields(f));}});
test('image signatures exclude HTML SVG and spoofed MIME',()=>{assert.equal(imageType(new TextEncoder().encode('<svg/>')),null);assert.equal(imageType(Uint8Array.of(255,216,255,224)),'image/jpeg');assert.equal(imageType(Uint8Array.of(137,80,78,71,13,10,26,10)),'image/png');});
test('stream body limit enforced without content length',async()=>{await assert.rejects(()=>readBounded(new Request('https://example.test',{method:'POST',body:'too much'}),3));});
const configured={PUBLIC_ORIGIN:'https://feedback.example.test',AUTH_ENABLED:'true',AUTH_SECRET:'synthetic',TEST_DATABASE:{query:async()=>[{id:'11111111-1111-4111-8111-111111111111',email:'guest@example.test'}]},FEEDBACK_ENABLED:'true',FEEDBACK_PHOTOS:{},DATABASE_URL:'postgresql://unused',FEEDBACK_SIGNING_KEY:'synthetic-test-secret',FEEDBACK_RATE:{limit:async()=>({success:true})}};
test('cross-origin and missing IP fail closed',async()=>{
 assert.equal((await handleFeedback(req('/api/feedback/challenge',{headers:{Origin:'https://evil.test'}}),configured)).status,403);
 assert.equal((await handleFeedback(req('/api/feedback/challenge',{headers:{Origin:'https://feedback.example.test'}}),configured)).status,503);
});
test('rate limit is enforced before issuing a challenge',async()=>{
 const response=await handleFeedback(req('/api/feedback/challenge',{headers:{Origin:'https://feedback.example.test','CF-Connecting-IP':'192.0.2.1',Cookie:'__Host-cc_session='+'a'.repeat(64)}}),{...configured,FEEDBACK_RATE:{limit:async()=>({success:false})}});assert.equal(response.status,429);
});
test('same-origin browser GET works without Origin header',async()=>{
 const response=await handleFeedback(req('/api/feedback/challenge',{headers:{Referer:'https://feedback.example.test/feedback/','CF-Connecting-IP':'192.0.2.1',Cookie:'__Host-cc_session='+'a'.repeat(64)}}),configured);assert.equal(response.status,200);assert.match((await response.json()).token,/^[a-f0-9-]{36}\.\d{13}\.[a-f0-9]{64}$/);
});
test('unsigned challenge never reaches storage',async()=>{
 const f=new FormData();for(const [k,v]of Object.entries({name:'Guest',affiliation:'Independent',role:'Developer',feedback:'Critical',improvements:'N/A',token:'forged'}))f.set(k,v);const {createHmac}=await import('node:crypto');f.set('csrf',createHmac('sha256','synthetic').update('csrf:'+'a'.repeat(64)).digest('hex'));
 const response=await handleFeedback(req('/api/feedback',{method:'POST',headers:{Origin:'https://feedback.example.test','CF-Connecting-IP':'192.0.2.1',Cookie:'__Host-cc_session='+'a'.repeat(64)},body:f}),configured);assert.equal(response.status,400);
});
test('malformed or missing multipart is rejected',async()=>{
 const response=await handleFeedback(req('/api/feedback',{method:'POST',headers:{Origin:'https://feedback.example.test','CF-Connecting-IP':'192.0.2.1',Cookie:'__Host-cc_session='+'a'.repeat(64)},body:'{}'}),configured);assert.equal(response.status,415);
});
