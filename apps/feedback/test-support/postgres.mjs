import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {Client,Pool} from 'pg';
import worker from '../worker.js';
import {createOutbox} from './outbox.mjs';
export function proofURL(){
 const raw=process.env.PROOF_DATABASE_URL;
 if(!raw||process.env.PROOF_DISPOSABLE!=='yes')throw Error('Proof requires PROOF_DATABASE_URL and PROOF_DISPOSABLE=yes for an EMPTY disposable local cluster; or run npm run proof');
 const u=new URL(raw);
 if(u.protocol!=='postgresql:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||!/^\/cc_proof_[a-z0-9_]+$/.test(u.pathname)||u.search)throw Error('Proof refuses non-local/non-disposable database URL');
 return u;
}
export async function fixture(){
 const url=proofURL(),operator=new Client({connectionString:url.href,connectionTimeoutMillis:5000,statement_timeout:15000});await operator.connect();
 const resources=[];
 try{
  const authority=(await operator.query("SELECT rolsuper,rolcreaterole,pg_has_role(current_user,'pg_read_all_stats','MEMBER') AS monitor FROM pg_roles WHERE rolname=current_user")).rows[0];
  assert.ok(authority.rolsuper||(authority.rolcreaterole&&authority.monitor),'Disposable proof operator must be a local superuser, or have CREATEROLE + pg_read_all_stats for barrier evidence');
  const existing=(await operator.query("SELECT to_regclass('public.cc_proof_marker') AS marker,to_regclass('public.cc_recipients') AS recipients")).rows[0];
  if(!existing.marker){
   assert.equal(existing.recipients,null,'Refusing existing application database');
   assert.equal((await operator.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0,'Proof database must be empty');
   for(const name of ['001_schema.sql','002_functions_grants.sql'])await operator.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
   await operator.query('CREATE TABLE cc_proof_marker(id integer PRIMARY KEY); INSERT INTO cc_proof_marker VALUES(1)');
   for(const role of ['runtime','admin','sender'])await operator.query(`CREATE ROLE cc_proof_${role} LOGIN INHERIT; GRANT cc_${role} TO cc_proof_${role}`);
  }
  // One proof process at a time. No real database URL is accepted by this harness.
  await operator.query('TRUNCATE cc_mail_attempts,cc_magic_tokens,cc_sessions,cc_auth_rate,cc_feedback_uploads,event_feedback,cc_feedback_account_daily,feedback_daily,cc_credit_codes,cc_recipients,cc_release CASCADE');
  await operator.query('INSERT INTO cc_release(id) VALUES(1)');
  function connection(role){const u=new URL(url);u.username='cc_proof_'+role;u.password='';return u.href;}
  async function client(role='runtime'){
   const c=new Client({connectionString:connection(role),connectionTimeoutMillis:5000,statement_timeout:15000});await c.connect();resources.push(c);c.once('end',()=>{const i=resources.indexOf(c);if(i>=0)resources.splice(i,1);});return c;
  }
  function adapter(role){
   const pool=new Pool({connectionString:connection(role),max:8,connectionTimeoutMillis:5000,statement_timeout:15000});resources.push(pool);const pids=new Set();
   async function use(fn){const c=await pool.connect();try{pids.add((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);return await fn(c);}finally{c.release();}}
   return {pids,query:(text,values=[])=>use(async c=>(await c.query(text,values)).rows),transaction:statements=>use(async c=>{await c.query('BEGIN');try{const results=[];for(const x of statements)results.push((await c.query(x.text,x.values)).rows);await c.query('COMMIT');return results;}catch(e){await c.query('ROLLBACK');throw e;}})};
  }
  const runtime=adapter('runtime'),admin=adapter('admin'),sender=adapter('sender');
  const objects=new Map(),bucket={
   async put(key,bytes,options){objects.set(key,{bytes:new Uint8Array(bytes),httpMetadata:options.httpMetadata});},
   async get(key){const x=objects.get(key);return x?{body:x.bytes,httpMetadata:x.httpMetadata}:null;},
   async delete(key){objects.delete(key);}
  };
  const env={PUBLIC_ORIGIN:'https://feedback.example.test',OWNER_EMAILS:'owner@example.test',EVENT_NAME:'Synthetic proof event',PROVIDER_NAME:'Example sponsor',BENEFIT_DESCRIPTION:'Synthetic non-redeemable test code',AUTH_ENABLED:'true',AUTH_SECRET:randomUUID()+randomUUID(),DATABASE_URL:'in-process-proof-only',FEEDBACK_ADMIN_DATABASE_URL:'in-process-proof-only',TEST_DATABASE:runtime,TEST_ADMIN_DATABASE:admin,FEEDBACK_ENABLED:'true',FEEDBACK_SIGNING_KEY:randomUUID()+randomUUID(),FEEDBACK_RATE:{limit:async()=>({success:true})},MAGIC_EMAIL_ENABLED:'true',CREDIT_CLAIMS_ENABLED:'true',REAL_CREDIT_DISTRIBUTION:'false',PHOTOS_ENABLED:'false',PRIVATE_PHOTO_METADATA_ACK:'false',FEEDBACK_PHOTOS:bucket};
  const outbox=createOutbox(env);env.MAGIC_MAILER=outbox.service;
  async function person({email='guest-'+randomUUID()+'@example.test',claim=true,synthetic=true,name='Synthetic <Guest>'}={}){
   return (await operator.query("INSERT INTO cc_recipients(email,name,affiliation,role,eligible,claim_eligible,synthetic,eligibility_basis,provenance) VALUES($1,$2,'Independent','Developer',true,$3,$4,$5,$6) RETURNING *",[email,name,claim,synthetic,claim?'organizer-exception':'owner-access',{note:'SYNTHETIC isolated proof; no actual attendance evidence'}])).rows[0];
  }
  async function stock(n=8){for(let i=0;i<n;i++)await operator.query("INSERT INTO cc_credit_codes(link,value_type,synthetic,source_sha256,source_index) VALUES($1,'code',true,$2,$3)",['SYNTHETIC_'+randomUUID(),'0'.repeat(64),i]);}
  async function invoke(path,{method='GET',cookie,body,headers={},flags={}}={}){
   const tasks=[];const h={'CF-Connecting-IP':'192.0.2.1',...headers};if(cookie)h.Cookie=cookie;if(method!=='GET')h.Origin=env.PUBLIC_ORIGIN;
   if(body&&!(body instanceof FormData)&&!(body instanceof Uint8Array)){h['Content-Type']='application/json';body=JSON.stringify(body);}
   const request=new Request(env.PUBLIC_ORIGIN+path,{method,headers:h,body});
   const response=await worker.fetch(request,{...env,...flags},{waitUntil:p=>tasks.push(p)});await Promise.all(tasks);return response;
  }
  async function login(p,lang='en'){
   const before=outbox.messages.length;assert.equal((await invoke('/api/auth/request',{method:'POST',body:{email:p.email,lang}})).status,200);
   assert.equal(outbox.messages.length,before+1);const link=outbox.messages.at(-1).link,token=new URL(link).hash.slice(1);
   const scan=await invoke(new URL(link).pathname);assert.equal(scan.status,200);assert.ok((await scan.text()).includes('id="consume"'));
   const consumed=await invoke('/api/auth/consume',{method:'POST',body:{token}});assert.equal(consumed.status,200);
   const cookie=consumed.headers.get('Set-Cookie').split(';')[0];const {identity}=await import('../auth.js');const me=await identity(new Request(env.PUBLIC_ORIGIN,{headers:{Cookie:cookie}}),env);
   return {cookie,csrf:me.csrf,link,token};
  }
  return {operator,runtime,admin,sender,client,env,outbox,objects,bucket,person,stock,invoke,login,async close(){await Promise.all(resources.map(x=>x.end()));await operator.end();}};
 }catch(e){await Promise.allSettled(resources.map(x=>x.end()));await operator.end();throw e;}
}
export const answers={name:'Synthetic Guest',affiliation:'Independent',role:'Developer',feedback:'The event was disappointing; less pitching please.',improvements:'N/A',photoConsent:false};
