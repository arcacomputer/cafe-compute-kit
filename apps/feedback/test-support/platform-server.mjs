import https from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

// Disposable loopback-only proof transport, never a deployed app/debug endpoint.
export async function platformServer({fetch:handler,onOrigin=()=>{},headerForIP='CF-Connecting-IP',maxBody=5*1024*1024}){
 const directory=await mkdtemp(join(tmpdir(),'cc-platform-tls-'));
 const tasks=new Set(),failures=[];let server,origin,ip='192.0.2.1';
 const context={waitUntil(value){const task=Promise.resolve(value);tasks.add(task);task.then(()=>tasks.delete(task),error=>{tasks.delete(task);failures.push(error);});}};
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'pipe',timeout:15000});
  server=https.createServer({key:await readFile(join(directory,'key.pem')),cert:await readFile(join(directory,'cert.pem'))},async(req,res)=>{
   try{
    if(req.headers.host!==new URL(origin).host){res.writeHead(421);return res.end();}
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>maxBody){res.writeHead(413);return res.end();}chunks.push(chunk);}
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
    // Emulate only the platform-owned header. Preserve other caller headers so
    // adapter tests can prove they are ignored, not sanitized away by a harness.
    headers.set(headerForIP,ip);
    const request=new Request(origin+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const response=await handler(request,context);
    const outgoing=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie();if(cookies.length)outgoing['set-cookie']=cookies;
    res.writeHead(response.status,outgoing);res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
   }catch{res.writeHead(500);res.end('Isolated platform proof error');}
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});origin='https://127.0.0.1:'+server.address().port;onOrigin(origin);
  return {origin,caFile:join(directory,'cert.pem'),setIP(value){ip=value;},async drain(){while(tasks.size)await Promise.allSettled([...tasks]);if(failures.length)throw new AggregateError(failures.splice(0),'Proof background task failed');},async close(){await Promise.allSettled([...tasks]);server.closeAllConnections();await new Promise(done=>server.close(done));await rm(directory,{recursive:true,force:true});}};
 }catch(error){server?.close();await rm(directory,{recursive:true,force:true});throw error;}
}
