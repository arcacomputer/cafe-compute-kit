import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,rm,chown} from 'node:fs/promises';
import {openSync,closeSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
const root=new URL('../',import.meta.url),cwd=new URL(root).pathname;
if(process.version!=='v22.22.2')throw Error('Proof requires Node 22.22.2');
if(process.env.PROOF_DATABASE_URL)throw Error('Full proof creates its own cluster. For an explicitly supplied disposable cluster run test:postgres/test:browser instead.');
const isRoot=process.getuid?.()===0;
if(isRoot&&!process.env.PROOF_TMPDIR)throw Error('Root proof requires PROOF_TMPDIR pointing to a scratch parent traversable by the postgres OS user (e.g. /var/lib/postgresql on the disposable worker). Never point it to a live cluster.');
const out=resolve(process.env.PROOF_OUTPUT_DIR||join(cwd,'.proof'));await mkdir(out,{recursive:true});
const parent=resolve(process.env.PROOF_TMPDIR||tmpdir()),dir=await mkdtemp(join(parent,'cc-proof-'));
let started=false,pgbin,proofPassed=false;
const postgres=(name,args,options={})=>{
 const binary=join(pgbin,name),command=isRoot?'runuser':binary,argv=isRoot?['-u','postgres','--',binary,...args]:args;
 return execFileSync(command,argv,{cwd:dir,encoding:'utf8',timeout:30000,stdio:'pipe',...options});
};
const freePort=()=>new Promise((done,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});
try{
 pgbin=process.env.PG_BINDIR||execFileSync('pg_config',['--bindir'],{encoding:'utf8'}).trim();
 execFileSync('openssl',['version'],{stdio:'pipe'});
 if(isRoot){const uid=Number(execFileSync('id',['-u','postgres'],{encoding:'utf8'})),gid=Number(execFileSync('id',['-g','postgres'],{encoding:'utf8'}));await chown(dir,uid,gid);}
 postgres('initdb',['-D',join(dir,'data'),'--auth=trust','--username=proof_operator','--no-locale','--encoding=UTF8']);
 const port=await freePort();started=true;postgres('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${dir}`,'-w','-t','20','start']);started=true;
 postgres('createdb',['-h','127.0.0.1','-p',String(port),'-U','proof_operator','cc_proof_local']);
 const env={...process.env,PROOF_DATABASE_URL:`postgresql://proof_operator@127.0.0.1:${port}/cc_proof_local`,PROOF_DISPOSABLE:'yes',PROOF_OUTPUT_DIR:out,PUBLIC_ORIGIN:'https://feedback.example.invalid',EVENT_NAME:'Synthetic proof event',NODE_OPTIONS:'--max-old-space-size=512'};
 function run(name,args,timeout){
  const log=join(out,name+'.log'),fd=openSync(log,'w',0o600);let result;try{result=spawnSync(process.execPath,args,{cwd,env,stdio:['ignore',fd,fd],timeout});}finally{closeSync(fd);}
  if(result.error||result.status!==0){console.error(readFileSync(log,'utf8').slice(-16000));throw Error(`${name} failed (${result.error?.message||result.status}); see ${log}`);}console.log(`${name}: passed (${log})`);
 }
 run('build',['scripts/build.mjs'],60000);
 run('unit',['--test','--test-concurrency=1',...readdirSync(cwd).filter(x=>x.endsWith('.test.mjs')).sort()],120000);
 run('postgres',['scripts/proof-postgres.mjs'],180000);
 run('browser',['scripts/proof-browser.mjs'],240000);
 proofPassed=true;
}finally{
 if(started){let running=false;try{postgres('pg_ctl',['-D',join(dir,'data'),'status']);running=true;}catch(e){if(e.status!==3)throw e;}if(running){try{postgres('pg_ctl',['-D',join(dir,'data'),'-m','immediate','-w','-t','20','stop']);started=false;}catch(e){console.error('CRITICAL: disposable PostgreSQL cleanup failed; inspect '+dir);throw e;}}}
 await rm(dir,{recursive:true,force:true});
}
if(proofPassed)console.log(JSON.stringify({passed:true,disposablePostgres:true,clusterRemoved:true,browser:'Chromium',mailSent:0,evidence:out,maximumStageBudgetSeconds:600}));
