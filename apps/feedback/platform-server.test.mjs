import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import https from 'node:https';

function request(origin,path='/',options={}){
 return new Promise((done,reject)=>{
  const r=https.request(origin+path,options,res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>done({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});r.on('error',reject);r.end(options.body);
 });
}
test('native platform proof server forwards real requests and retains background lifetime',async()=>{
 const moduleURL=new URL('./test-support/platform-server.mjs',import.meta.url);
 assert.equal(await access(moduleURL).then(()=>true,()=>false),true,'Native platform proof server is missing');
 const {platformServer}=await import(moduleURL);let origin,completed=false;
 const s=await platformServer({onOrigin(value){origin=value;},headerForIP:'x-forwarded-for',async fetch(req,ctx){assert.equal(new URL(req.url).origin,origin);assert.equal(req.headers.get('x-forwarded-for'),'192.0.2.1');ctx.waitUntil(new Promise(r=>setTimeout(()=>{completed=true;r();},30)));return new Response(await req.text(),{headers:{'Set-Cookie':'__Host-synthetic=yes; Path=/; Secure; HttpOnly','Content-Type':'text/plain'}});}});
 try{await assert.rejects(request(s.origin,'/untrusted'),{code:'DEPTH_ZERO_SELF_SIGNED_CERT'});const r=await request(s.origin,'/private?test=1',{ca:await readFile(s.caFile),method:'POST',headers:{'x-forwarded-for':'198.51.100.1'},body:'synthetic-body'});assert.equal(r.status,200);assert.equal(r.body,'synthetic-body');assert.match(r.headers['set-cookie'][0],/__Host-synthetic/);await s.drain();assert.equal(completed,true);}finally{await s.close();}
});
