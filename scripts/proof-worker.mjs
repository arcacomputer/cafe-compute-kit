import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import https from 'node:https';
import net from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),out=path.join(root,'.proof/worker');await mkdir(out,{recursive:true});
const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});
const origin=`https://127.0.0.1:${port}`;
// Only this self-generated local Wrangler certificate is exempted. No global
// TLS override, live domain, account credential or provider endpoint is used.
function request(route){return new Promise((resolve,reject)=>{const req=https.get(origin+route,{rejectUnauthorized:false,timeout:3000},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Local Worker timeout')));});}
let logs='',worker,workerExit;
try{
 worker=spawn(process.platform==='win32'?'npx.cmd':'npx',['--no-install','wrangler','dev','--local','--ip','127.0.0.1','--port',String(port),'--local-protocol','https','--var',`PUBLIC_ORIGIN:${origin}`],{cwd:root,detached:process.platform!=='win32',env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 worker.on('error',e=>{workerExit=e.message;});worker.on('exit',code=>{workerExit=code;});for(const stream of[worker.stdout,worker.stderr])stream.on('data',chunk=>{logs=(logs+chunk).slice(-100000);});
 const deadline=Date.now()+60000;let ready=false,last;
 while(Date.now()<deadline&&workerExit===undefined){try{last=await request('/');if(last.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
 assert.ok(ready,`Local Worker did not become ready: status=${last?.status} exit=${workerExit}\n${logs}`);
 assert.match(last.headers['content-security-policy'],/script-src 'self'/);
 for(const prefix of ['/feedback','/en/feedback']){
  assert.equal((await request(prefix+'/')).status,503,'Private workflow is dark by default');
  for(const[alias,canonical]of[[prefix,prefix+'/'],[prefix+'/index.html',prefix+'/'],...['sign-in','credit'].flatMap(page=>[[prefix+'/'+page+'/',prefix+'/'+page],[prefix+'/'+page+'/index.html',prefix+'/'+page]])]){
   const response=await request(alias);assert.equal(response.status,302,alias);assert.equal(response.headers.location,canonical);assert.equal(response.headers['cache-control'],'no-store');
  }
 }
 for(const route of ['/not-a-real-page','/private/roster.csv','/package.json','/.dev.vars'])assert.equal((await request(route)).status,404,route);
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/proof-browser.mjs'],{cwd:root,env:{...process.env,SITE_PROOF_ORIGIN:origin},stdio:'inherit'});
  const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Worker browser proof timeout'));},180000);
  child.on('error',e=>{clearTimeout(timeout);reject(e);});child.on('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(Error('Worker browser proof failed: '+code));});
 });
 await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,runtime:'Wrangler local workerd',combinedWorker:true,defaultPrivateGatesOff:true,privateAliases:true,privateSource404:true,externalDeployment:false},null,2));
 console.log('Combined local Worker, private-route gates and real browser matrix passed. No deployment occurred.');
}finally{
 await writeFile(path.join(out,'wrangler.log'),logs);
 if(worker?.pid){
  try{process.platform==='win32'?worker.kill('SIGTERM'):process.kill(-worker.pid,'SIGTERM');}catch{}
  await new Promise(r=>setTimeout(r,1000));
  try{process.platform==='win32'?worker.kill('SIGKILL'):process.kill(-worker.pid,'SIGKILL');}catch{}
 }
}
