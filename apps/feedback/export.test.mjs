import test from 'node:test';import assert from 'node:assert/strict';import {handleAdmin} from './admin.js';
const origin='https://feedback.example.test',env={PUBLIC_ORIGIN:origin,OWNER_EMAILS:'owner@example.test',AUTH_ENABLED:'true',AUTH_SECRET:'synthetic'};
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const aBytes=Uint8Array.of(255,216,255,224),bBytes=Uint8Array.of(255,216,255,225);
const photo=(slot,bytes)=>({key:`feedback/${id}/photo-${slot}-${sha(bytes)}.jpg`,type:'image/jpeg',bytes:bytes.length});
test('captured slot/digest download and dashboard link survive a lower-slot completion',async()=>{
 const a=photo(19,aBytes),b=photo(0,bBytes);let manifest=[a],gets=[];
 const deps={identity:async()=>({email:'owner@example.test'}),query:async parts=>parts.join('').includes('SELECT photos')?[{photos:manifest}]:[{id,created_at:new Date(),payload:{name:'Synthetic'},photos:structuredClone(manifest)}]};
 const ownerEnv={...env,FEEDBACK_PHOTOS:{async get(key){gets.push(key);return {body:key===a.key?aBytes:bBytes,httpMetadata:{contentType:'image/jpeg'}};}}};
 const exported=await handleAdmin(new Request(origin+'/feedback/admin/export'),ownerEnv,deps);const captured=(await exported.json()).rows[0].photos[0];assert.equal(captured.key,a.key);
 manifest=[b,a];const path=`/feedback/admin/photo/${id}/19-${sha(aBytes)}.jpg`;
 const result=await handleAdmin(new Request(origin+path),ownerEnv,deps);assert.equal(result.status,200);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),aBytes);assert.deepEqual(gets,[a.key]);
 const page=await handleAdmin(new Request(origin+'/feedback/admin'),ownerEnv,deps);assert.ok((await page.text()).includes(path));
 assert.equal((await handleAdmin(new Request(origin+`/feedback/admin/photo/${id}/0`),ownerEnv,deps)).status,404);
});
test('stable photo identity must match exact owned current key and content type',async()=>{
 const a=photo(19,aBytes),path=`/feedback/admin/photo/${id}/19-${sha(aBytes)}.jpg`;let gets=0;
 for(const bad of [{...a,key:a.key.replace(id,'11111111-1111-4111-8111-111111111111')},{...a,type:'image/png'}, {...a,key:a.key+'/suffix'}]){
  const result=await handleAdmin(new Request(origin+path),{...env,FEEDBACK_PHOTOS:{get(){gets++;throw Error('Must not read');}}},{identity:async()=>({email:'owner@example.test'}),query:async()=>[{photos:[bad]}]});assert.equal(result.status,404);
 }assert.equal(gets,0);
});
const id='22222222-2222-4222-8222-222222222222';
test('private paginated export includes current photo manifests and never code stock',async()=>{
 const r=await handleAdmin(new Request(origin+'/feedback/admin/export'),env,{identity:async()=>({email:'owner@example.test'}),query:async()=>[{id,created_at:new Date(),payload:{feedback:'May include sensitive prose',photoConsent:false},photos:[{key:`feedback/${id}/photo-19-${'a'.repeat(64)}.jpg`,type:'image/jpeg',bytes:4}]}]});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/application\/json/);const x=await r.json();assert.match(x.classification,/PRIVATE/);assert.equal(x.rows[0].photos.length,1);assert.equal(x.nextCursor,null);assert.equal(x.inventory,undefined);
});
test('export auth is checked before database reads',async()=>{for(const [email,status]of [[null,401],['guest@example.test',403]]){let reads=0;const r=await handleAdmin(new Request(origin+'/feedback/admin/export'),env,{identity:async()=>email?{email}:null,query:async()=>{reads++;return []}});assert.equal(r.status,status);assert.equal(reads,0);}});
