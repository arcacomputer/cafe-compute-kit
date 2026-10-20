import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
export function createPreviewServer(directory){
  const root=path.resolve(directory);
  return http.createServer(async(req,res)=>{
    const respond=(status,body,type='text/plain; charset=utf-8')=>{
      res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'self'; font-src 'self'; script-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
      res.end(req.method==='HEAD'?undefined:body);
    };
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return respond(400,'Malformed path');}
    if(pathname.includes('\0')||pathname.includes('\\'))return respond(400,'Malformed path');
    if(pathname.split('/').some(part=>part.startsWith('.'))||['/_headers','/_redirects'].includes(pathname))return respond(404,'Not found');
    if(pathname.startsWith('/api/')||/^\/(?:en\/)?feedback\/?$/.test(pathname))return respond(503,'Static preview only. Sign-in, feedback, photos and codes require the configured Worker and database. See the repository deployment guide.');
    if(!['GET','HEAD'].includes(req.method))return respond(405,'Method not allowed');
    const target=path.resolve(root,`.${pathname}`);
    if(target!==root&&!target.startsWith(root+path.sep))return respond(403,'Forbidden');
    try{
      let file=target;
      if((await stat(file)).isDirectory())file=path.join(file,'index.html');
      const actual=await realpath(file);
      if(actual!==root&&!actual.startsWith(root+path.sep))return respond(403,'Forbidden');
      const bytes=await readFile(actual);
      return respond(200,bytes,types[path.extname(actual)]||'application/octet-stream');
    }catch{return respond(404,'Not found');}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {values}=parseArgs({options:{dir:{type:'string'},port:{type:'string',default:'4173'}}});
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const directory=values.dir?path.resolve(values.dir):path.join(root,'dist');
  if(path.basename(directory)!=='dist')throw Error('Preview only a generated dist directory, never a repository or private-data directory');
  const port=Number(values.port);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port must be 1..65535');
  await stat(path.join(directory,'index.html')).catch(()=>{throw Error('Build the site first: npm run build');});
  const server=createPreviewServer(directory);
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Static-only preview: http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
}
