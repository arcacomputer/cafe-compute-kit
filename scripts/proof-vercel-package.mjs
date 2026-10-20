import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
async function main(){
const require=createRequire(import.meta.url),sdk=require('@vercel/node'),utils=require('@vercel/build-utils');
const root=fileURLToPath(new URL('../',import.meta.url));
const files=await utils.glob('**',{cwd:root,ignore:['node_modules/**','.git/**','.proof/**','.vercel/**','**/node_modules/**']});
const report=[];
const endpoints=[{name:'main',entrypoint:'api/main.mjs',workPath:root,origin:'https://kit-proof.example.invalid',expected:200},{name:'sender',entrypoint:'api/magic.mjs',workPath:path.join(root,'vercel/sender-project'),origin:'https://sender-proof.example.invalid',expected:401}];
// The SDK dev protocol forwards x-forwarded-host to its inner Node server.
// Its node-to-Web bridge derives HTTPS only from an explicit :443 authority,
// not x-forwarded-proto. This is local SDK protocol metadata, not evidence
// that managed Vercel overwrites caller headers (the live acceptance gate).
function request(port,origin,pathname){return new Promise((done,reject)=>{const authority=new URL(origin).hostname+':443';const r=http.request({host:'127.0.0.1',port,path:pathname,headers:{host:authority,'x-forwarded-host':authority,'x-forwarded-proto':'https','x-real-ip':'192.0.2.99'}},response=>{const chunks=[];response.on('data',x=>chunks.push(x));response.on('end',()=>done({status:response.statusCode,body:Buffer.concat(chunks).toString()}));});r.on('error',reject);r.end();});}
for(const project of endpoints){
 const config=JSON.parse(await readFile(path.join(project.workPath,'vercel.json'),'utf8'));
 // Skip only the redundant dependency install: npm ci already installed the
 // exact committed lockfile. These are real unmodified Vercel SDK builders.
 const functions={...config.functions,[project.entrypoint]:{...config.functions?.[project.entrypoint],installCommand:''}};
 const relativePrefix=path.relative(root,project.workPath).split(path.sep).join('/');
 const projectFiles=relativePrefix?Object.fromEntries(Object.entries(files).filter(([key])=>key.startsWith(relativePrefix+'/')).map(([key,value])=>[key.slice(relativePrefix.length+1),value])):files;
 // Sources already exist in this checkout. Re-downloading FileFsRef entries
 // onto their own paths truncates them; use the SDK's materialized-tree mode.
 const sourcePackage=await readFile(path.join(root,'package.json'));
 const built=await sdk.build({files:projectFiles,entrypoint:project.entrypoint,workPath:project.workPath,repoRootPath:root,config:{...config,functions,includeFiles:project.name==='main'?'vercel/generated/public-assets.json':undefined,projectSettings:{nodeVersion:'22.x'}},meta:{isDev:false,skipDownload:true},considerBuildCommand:false});
 assert.deepEqual(await readFile(path.join(root,'package.json')),sourcePackage,'SDK proof must preserve the materialized source tree');
 const names=Object.keys(built.output.files);assert.ok(names.length);assert.equal(built.output.runtime,'nodejs22.x');
 assert.ok(names.some(x=>x.endsWith(project.name==='main'?'vercel/generated/public-assets.json':'apps/feedback/mailer/worker.js')),'Actual native trace must contain required runtime files');
 assert.ok(!names.some(x=>/(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|test-support|\.proof)(\/|$)/.test(x)),'Native function bundle must not contain private/proof files');
 const env={PUBLIC_ORIGIN:project.name==='main'?project.origin:endpoints[0].origin,SENDER_ORIGIN:endpoints[1].origin,MAILER_SERVICE_TOKEN:'a'.repeat(64),AUTH_ENABLED:'false',FEEDBACK_ENABLED:'false',MAGIC_EMAIL_ENABLED:'false',CREDIT_CLAIMS_ENABLED:'false',REAL_CREDIT_DISTRIBUTION:'false',MAIL_SEND_ENABLED:'false',PHOTOS_ENABLED:'false',PRIVATE_PHOTO_METADATA_ACK:'false'};
 let server;
 try{
  server=await sdk.startDevServer({files:projectFiles,entrypoint:project.entrypoint,workPath:project.workPath,config:{helpers:false},meta:{isDev:true,env}});assert.ok(server?.port);
  const paths=project.name==='main'?['/en/','/en/resources/','/feedback/','/en/feedback/sign-in/index.html','/.env','/package.json']:['/magic-link'];
  const responses=[];
  for(const pathname of paths){const response=await request(server.port,project.origin,pathname);const expected=project.name==='sender'?401:pathname==='/feedback/'?503:pathname.includes('sign-in')?302:pathname==='/en/'||pathname==='/en/resources/'?200:404;assert.equal(response.status,expected,`${project.name} ${pathname}: ${response.body.slice(0,180)}`);responses.push({pathname,status:response.status});}
  report.push({project:project.name,nativeBuilder:true,runtime:built.output.runtime,tracedFiles:names.length,nativeSDKServer:true,responses});
 }finally{await server?.shutdown();}
}
await mkdir(path.join(root,'.proof/vercel-package'),{recursive:true});await writeFile(path.join(root,'.proof/vercel-package/results.json'),JSON.stringify({passed:true,providerDeployment:false,report},null,2));console.log(JSON.stringify({passed:true,providerDeployment:false,report},null,2));
}
main().catch(error=>{console.error(error?.stack||String(error));process.exitCode=1;});
