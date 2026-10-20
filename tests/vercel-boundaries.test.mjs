import test from 'node:test';
import assert from 'node:assert/strict';

test('native main preserves owner-only admin credentials and private alias routing',async()=>{
 const {createMain}=await import('../vercel/main.mjs');
 const origin='https://event.example',env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'secret',DATABASE_URL:'unused',FEEDBACK_ADMIN_DATABASE_URL:'unused-admin',OWNER_EMAILS:'owner@example.test'};
 let email='attendee@example.test',adminReads=0,assetReads=0;
 const database={query:async()=>[{id:'recipient',email}]},adminDatabase={query:async()=>{adminReads++;return []}};
 const main=createMain({env,database,adminDatabase,ipAddress:()=> '203.0.113.1',waitUntil:()=>{},assets:{fetch:async()=>{assetReads++;return new Response('public only')}}});
 const request=route=>new Request(origin+route,{headers:{Cookie:'__Host-cc_session='+'a'.repeat(64),'X-Original-URL':'/feedback/admin/export'}});
 assert.equal((await main.fetch(request('/feedback/admin/export'))).status,403);assert.equal(adminReads,0);
 email='owner@example.test';const response=await main.fetch(request('/feedback/admin/export'));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).rows,[]);assert.equal(adminReads,1);
 for(const route of ['/feedback/index.html','/en/feedback/index.html','/feedback/credit/','/en/feedback/sign-in/index.html']){
  const response=await main.fetch(request(route));assert.equal(response.status,302,route);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 assert.equal(assetReads,0);
 const forged=new Request('https://evil.example/feedback/admin/export',{headers:{Host:'event.example','X-Forwarded-Host':'event.example','X-Original-URL':origin+'/feedback/admin/export'}});
 assert.equal((await main.fetch(forged)).status,421);assert.equal(adminReads,1);
});
