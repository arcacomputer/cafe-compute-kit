import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuth} from './auth.js';
for(const eligible of [false,true])test(`mail budget eligible=${eligible}`,async()=>{
const limits=[],tasks=[];let sent=0,issued=0;
const store={rate:async(k,n)=>{limits.push(n);return true},recipient:async()=>eligible?{id:'qa',email:'qa@example.invalid'}:null,issue:async()=>{issued++}};
const request=new Request('https://feedback.example.test/api/auth/request',{method:'POST',headers:{Origin:'https://feedback.example.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({email:'qa@example.invalid'})});
const r=await handleAuth(request,{PUBLIC_ORIGIN:'https://feedback.example.test',AUTH_ENABLED:'true',DATABASE_URL:'synthetic',AUTH_SECRET:'synthetic-only'},{waitUntil:p=>tasks.push(p)},{store,mail:async()=>{sent++}});await Promise.all(tasks);
assert.equal(r.status,200);assert.deepEqual(limits,eligible?[10,3,12,300]:[10,3]);assert.equal(sent,eligible?1:0);assert.equal(issued,eligible?1:0);
});
