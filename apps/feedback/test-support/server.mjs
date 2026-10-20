import https from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import worker from '../worker.js';
// Test-only adapter. No magic-link HTTP lookup/debug endpoint is exposed.
export async function proofServer(f){
 const dir=await mkdtemp(join(tmpdir(),'cc-proof-tls-'));let server;
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'pipe',timeout:15000});
  const root=resolve(new URL('../public/',import.meta.url).pathname),tasks=new Set();let ip='192.0.2.1';
  f.env.ASSETS={async fetch(request){
   const pathname=new URL(request.url).pathname,target=resolve(root,'.'+pathname),rel=relative(root,target);
   if(rel.startsWith('..')||!pathname.startsWith('/feedback/'))return new Response('Not found',{status:404});
   const mime={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};const ext=Object.keys(mime).find(x=>pathname.endsWith(x));if(!ext)return new Response('Not found',{status:404});
   try{return new Response(await readFile(target),{headers:{'Content-Type':mime[ext]}});}catch{return new Response('Not found',{status:404});}
  }};
  server=https.createServer({key:await readFile(join(dir,'key.pem')),cert:await readFile(join(dir,'cert.pem'))},async(req,res)=>{
   try{
    if(req.headers.host!==new URL(f.env.PUBLIC_ORIGIN).host){res.writeHead(421);return res.end();}
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024){res.writeHead(413);return res.end();}chunks.push(chunk);}
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);headers.set('CF-Connecting-IP',ip);
    const request=new Request(f.env.PUBLIC_ORIGIN+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const response=await worker.fetch(request,f.env,{waitUntil(p){tasks.add(p);p.finally(()=>tasks.delete(p));}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch{res.writeHead(500);res.end('Isolated proof server error');}
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});f.env.PUBLIC_ORIGIN='https://127.0.0.1:'+server.address().port;
  return {origin:f.env.PUBLIC_ORIGIN,caFile:join(dir,'cert.pem'),setIP(value){ip=value;},async drain(){await Promise.all([...tasks]);},async close(){await Promise.all([...tasks]);server.closeAllConnections();await new Promise(done=>server.close(done));await rm(dir,{recursive:true,force:true});}};
 }catch(e){server?.close();await rm(dir,{recursive:true,force:true});throw e;}
}
