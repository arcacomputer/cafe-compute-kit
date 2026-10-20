import test from 'node:test';import assert from 'node:assert/strict';import {handleAdmin} from './admin.js';
const env={PUBLIC_ORIGIN:'https://feedback.example.test',OWNER_EMAILS:'owner@example.test',AUTH_ENABLED:'true',AUTH_SECRET:'test'},req=p=>new Request('https://feedback.example.test'+p);
const photoPath='/feedback/admin/photo/00000000-0000-0000-0000-000000000001/0-'+'a'.repeat(64)+'.jpg';
for(const path of ['/feedback/admin',photoPath]){
 test('anonymous blocked '+path,async()=>{const r=await handleAdmin(req(path),env,{identity:async()=>null});assert.equal(r.status,401)});
 test('attendee blocked '+path,async()=>{const r=await handleAdmin(req(path),env,{identity:async()=>({email:'other@example.invalid'})});assert.equal(r.status,403)});
}
test('owner reads escaped private feedback, optional consent',async()=>{const r=await handleAdmin(req('/feedback/admin'),env,{identity:async()=>({email:'owner@example.test'}),query:async()=>[{id:'00000000-0000-0000-0000-000000000001',created_at:new Date(),payload:{name:'<script>bad</script>',feedback:'Hello',photoConsent:false},photos:[]}]});const h=await r.text();assert.equal(r.status,200);assert.ok(h.includes('&lt;script&gt;'));assert.ok(!h.includes('<script>'));assert.ok(h.includes('Sin autorización'));assert.match(r.headers.get('Cache-Control'),/no-store/)});
test('owner photo key outside matching submission rejected',async()=>{const r=await handleAdmin(req(photoPath),env,{identity:async()=>({email:'owner@example.test'}),query:async()=>[{photos:[{key:'other/secret'}]}]});assert.equal(r.status,404)});
