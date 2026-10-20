import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth } from './auth.js';
import { handleAdmin } from './admin.js';
import worker from './worker.js';
const origin='https://feedback.example.test';
const env={PUBLIC_ORIGIN:origin,OWNER_EMAILS:'owner@example.test',AUTH_ENABLED:'true',AUTH_SECRET:'synthetic-only',DATABASE_URL:'unused'};
test('real auth entrypoint accepts configured origin and sender uses configured origin',async()=>{
 const tasks=[],out=[];
 const req=new Request(origin+'/api/auth/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({email:'guest@example.test',lang:'en'})});
 const result=await handleAuth(req,env,{waitUntil:p=>tasks.push(p)},{store:{rate:async()=>true,recipient:async()=>({id:'synthetic',email:'guest@example.test'}),issue:async()=>{}},mail:async(to,link)=>out.push(link)});
 assert.equal(result.status,200);await Promise.all(tasks);assert.equal(new URL(out[0]).origin,origin);
});
test('disabled auth never exposes the static feedback form',async()=>{
 const result=await worker.fetch(new Request(origin+'/feedback/'),{...env,AUTH_ENABLED:'false',ASSETS:{fetch:async()=>new Response('private form')}},{});
 assert.equal(result.status,503);
});
test('owner allowlist is server-side and exact',async()=>{
 const deps={identity:async()=>({email:'owner@example.test'}),query:async()=>[]};
 assert.equal((await handleAdmin(new Request(origin+'/feedback/admin'),env,deps)).status,200);
 assert.equal((await handleAdmin(new Request(origin+'/feedback/admin'),env,{...deps,identity:async()=>({email:'other@example.test'})})).status,403);
});
