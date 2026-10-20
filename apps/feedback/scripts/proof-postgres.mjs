import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import {parsePhotoKey} from '../photo-reference.js';
import {proveExtra} from '../test-support/prove-extra.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// No silent skip: prerequisite discovery happens before importing pg.
if(!process.env.PROOF_DATABASE_URL||process.env.PROOF_DISPOSABLE!=='yes')throw Error('Native PostgreSQL proof requires PROOF_DATABASE_URL + PROOF_DISPOSABLE=yes; run npm run proof for a disposable local cluster');
const {fixture,answers}=await import('../test-support/postgres.mjs');
const {AuthStore,hash,randomToken}=await import('../auth.js');
const {sendMagic}=await import('../mailer/worker.js');
const f=await fixture(),evidence=[];
globalThis.fetch=()=>{throw Error('External HTTP forbidden in native proof');};
const query=(c,q,p=[])=>(c.query(q,p)).then(x=>x.rows);
const save=(c,id,who,data=answers)=>query(c,'SELECT cc_save_feedback($1,$2,$3) receipt',[id,who.id,data]);
async function race(label,n,fn,role='runtime'){
 const clients=await Promise.all(Array.from({length:n},()=>f.client(role)));
 try{
  const pids=(await Promise.all(clients.map(c=>query(c,'SELECT pg_backend_pid() pid')))).map(x=>x[0].pid);assert.equal(new Set(pids).size,n);
  // Every native connection blocks on a PostgreSQL advisory barrier before work.
  const barrier=941381;await f.operator.query('SELECT pg_advisory_lock($1)',[barrier]);
  let pending;
  try{
   pending=clients.map(async(c,i)=>{await c.query('BEGIN');try{await c.query('SELECT pg_advisory_xact_lock_shared($1) /* cc-proof-barrier */',[barrier]);const value=await fn(c,i);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}});
   const deadline=Date.now()+10000;let blocked=0;
   while(Date.now()<deadline){blocked=(await f.operator.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event='advisory'",[pids])).rows[0].n;if(blocked===n)break;await new Promise(r=>setTimeout(r,10));}
   assert.equal(blocked,n,'Every native session must overlap at the DB barrier');
  }finally{await f.operator.query('SELECT pg_advisory_unlock($1)',[barrier]);}
  const results=await Promise.allSettled(pending);
  evidence.push({label,independentBackendPids:pids,fulfilled:results.filter(x=>x.status==='fulfilled').length,rejected:results.filter(x=>x.status==='rejected').length});return results;
 }finally{await Promise.all(clients.map(c=>c.end()));}
}
async function denied(client,sql,params=[]){await assert.rejects(()=>client.query(sql,params),/permission denied/);}
try{
 const p=await f.person(),other=await f.person(),owner=await f.person({email:'owner@example.test',claim:false});await f.stock(10);
 // Same owned key, different ownership, response loss and rollback/retry.
 const receipt=randomUUID(),same=await race('same-key atomic admission',6,c=>save(c,receipt,p));
 assert.ok(same.every(x=>x.status==='fulfilled'));assert.equal(same.filter(x=>x.value[0].receipt.created).length,1);
 await assert.rejects(()=>save(f.operator,receipt,other),/foreign receipt/);
 await assert.rejects(()=>save(f.operator,receipt,p,{...answers,feedback:'Changed answer'}),/receipt payload mismatch/);
 const account=await query(f.operator,'SELECT total FROM cc_feedback_account_daily WHERE recipient_id=$1',[p.id]);assert.equal(account[0].total,1);
 const rolled=randomUUID();await f.operator.query('BEGIN');await save(f.operator,rolled,p);await f.operator.query('ROLLBACK');assert.equal((await query(f.operator,'SELECT id FROM event_feedback WHERE id=$1',[rolled])).length,0);assert.equal((await save(f.operator,rolled,p))[0].receipt.created,true);
 // One transaction owns both business quotas. Rejected attempts leave no rows/charges.
 const quota=await f.person(),attemptIds=Array.from({length:16},()=>randomUUID());
 const limited=await race('account ceiling independent sessions',16,(c,i)=>save(c,attemptIds[i],quota));assert.equal(limited.filter(x=>x.status==='fulfilled').length,10);assert.ok(limited.filter(x=>x.status==='rejected').every(x=>/account capacity reached/.test(x.reason.message)));
 assert.equal((await query(f.operator,"SELECT count(*)::int n FROM event_feedback WHERE payload->>'recipientId'=$1",[quota.id]))[0].n,10);
 assert.equal((await query(f.operator,'SELECT total FROM cc_feedback_account_daily WHERE recipient_id=$1',[quota.id]))[0].total,10);
 await f.operator.query('INSERT INTO feedback_daily(day,total) VALUES(CURRENT_DATE,299) ON CONFLICT(day) DO UPDATE SET total=299');
 const globalPeople=await Promise.all(Array.from({length:6},()=>f.person()));const globalIds=globalPeople.map(()=>randomUUID());
 const capped=await race('global ceiling rolls back account and receipt',6,(c,i)=>save(c,globalIds[i],globalPeople[i]));assert.equal(capped.filter(x=>x.status==='fulfilled').length,1);assert.ok(capped.filter(x=>x.status==='rejected').every(x=>/global capacity reached/.test(x.reason.message)));
 assert.equal((await query(f.operator,'SELECT total FROM feedback_daily WHERE day=CURRENT_DATE'))[0].total,300);
 assert.equal((await query(f.operator,'SELECT coalesce(sum(total),0)::int n FROM cc_feedback_account_daily WHERE recipient_id=ANY($1::uuid[])',[globalPeople.map(x=>x.id)]))[0].n,1);
 assert.equal((await query(f.operator,'SELECT count(*)::int n FROM event_feedback WHERE id=ANY($1::uuid[])',[globalIds]))[0].n,1);
 await f.operator.query('UPDATE feedback_daily SET total=20 WHERE day=CURRENT_DATE');
 // Native one-use token race and secure session storage.
 const token=randomToken(),digest=await hash(token);await new AuthStore((q,p)=>query(f.operator,q,p)).issue(p.id,digest);
 const consumes=await race('POST token consume',6,c=>new AuthStore((q,p)=>query(c,q,p)).consume(digest,randomToken()));assert.equal(consumes.filter(x=>x.status==='fulfilled'&&x.value).length,1);
 const unused=randomToken();await new AuthStore((q,p)=>query(f.operator,q,p)).issue(p.id,await hash(unused));await f.operator.query("UPDATE cc_magic_tokens SET expires_at=now()-interval '1 second' WHERE hash=$1",[await hash(unused)]);assert.equal(await new AuthStore((q,p)=>query(f.operator,q,p)).consume(await hash(unused),randomToken()),undefined);
 const expiring=await f.person(),rawLogin=randomToken(),rawSession=randomToken(),expiryStore=new AuthStore((q,p)=>f.runtime.query(q,p));
 await expiryStore.issue(expiring.id,await hash(rawLogin));await expiryStore.consume(await hash(rawLogin),await hash(rawSession));assert.equal((await expiryStore.session(await hash(rawSession))).id,expiring.id);
 await f.operator.query("UPDATE cc_sessions SET expires_at=now()-interval '1 second' WHERE hash=$1",[await hash(rawSession)]);assert.equal(await expiryStore.session(await hash(rawSession)),undefined);
 await f.operator.query("UPDATE cc_sessions SET expires_at=now()+interval '1 hour' WHERE hash=$1",[await hash(rawSession)]);await f.operator.query('UPDATE cc_recipients SET eligible=false,claim_eligible=false WHERE id=$1',[expiring.id]);assert.equal(await expiryStore.session(await hash(rawSession)),undefined);await expiryStore.logout(await hash(rawSession));assert.equal((await query(f.operator,'SELECT hash FROM cc_sessions WHERE hash=$1',[await hash(rawSession)])).length,0);
 const rates=await race('persistent rate ceiling',12,c=>new AuthStore((q,p)=>query(c,q,p)).rate('synthetic-race',3));assert.equal(rates.filter(x=>x.status==='fulfilled'&&x.value).length,3);
 // Stable same-recipient allocation and distinct recipients; no consent condition.
 const claims=await race('same recipient claim',6,c=>query(c,'SELECT cc_assign_credit($1,false) value',[p.id]));assert.ok(claims.every(x=>x.status==='fulfilled'));assert.equal(new Set(claims.map(x=>x.value[0].value.value)).size,1);
 await save(f.operator,randomUUID(),other);
 const two=await race('distinct recipients claim',2,(c,i)=>query(c,'SELECT cc_assign_credit($1,false) value',[[p,other][i].id]));assert.equal(new Set(two.map(x=>x.value[0].value.value)).size,2);
 await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,false)',[owner.id]),/not eligible/);
 const noFeedback=await f.person();await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,false)',[noFeedback.id]),/feedback required/);
 // Release gates: real flag alone, insufficient coverage, and post-review drift fail.
 const real=await f.person({synthetic:false});await save(f.operator,randomUUID(),real);
 await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,true)',[real.id]),/distribution disabled/);
 await f.operator.query("INSERT INTO cc_credit_codes(link,value_type,synthetic,withheld,source_sha256,source_index) VALUES('SYNTHETIC_REAL_POOL','code',false,true,$1,1)",['0'.repeat(64)]);
 async function approve(){const n=(await query(f.operator,'SELECT count(*)::int n FROM cc_recipients WHERE eligible AND claim_eligible AND NOT synthetic'))[0].n;const m=(await query(f.operator,'SELECT count(*)::int n FROM cc_credit_codes WHERE NOT synthetic'))[0].n;await f.operator.query("UPDATE cc_release SET roster_reviewed=true,inventory_reviewed=true,prior_assignments_reviewed=true,expected_recipients=$1,expected_inventory=$2,reviewed_version=version,review_note='Synthetic proof only' WHERE id=1",[n,m]);}
 await approve();await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,true)',[real.id]),/distribution disabled/);
 await f.operator.query('UPDATE cc_credit_codes SET withheld=false WHERE NOT synthetic');await approve();await f.operator.query('UPDATE cc_recipients SET name=name WHERE id=$1',[real.id]);await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,true)',[real.id]),/distribution disabled/);
 await approve();await assert.rejects(()=>query(f.operator,'SELECT cc_assign_credit($1,false)',[real.id]),/distribution disabled/);assert.equal((await query(f.operator,'SELECT cc_assign_credit($1,true) value',[real.id]))[0].value.type,'code');evidence.push({label:'positive release, coverage and drift guards',passed:true});
 // Actual Worker private-page aliases must never fall through to static assets.
 for(const prefix of ['/feedback','/en/feedback']){
  for(const [alias,canonical] of [[prefix,prefix+'/'],[prefix+'/index.html',prefix+'/'],...['sign-in','credit'].flatMap(page=>[[prefix+'/'+page+'/',prefix+'/'+page],[prefix+'/'+page+'/index.html',prefix+'/'+page]])]){
   const response=await f.invoke(alias);assert.equal(response.status,302);assert.equal(response.headers.get('Location'),canonical);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
 }
 // Actual Worker login + admission HTTP boundary, non-HTTP DB seam, no-send service.
 const login=await f.login(p),challenge=await f.invoke('/api/feedback/challenge',{cookie:login.cookie,headers:{Origin:f.env.PUBLIC_ORIGIN}});assert.equal(challenge.status,200);const challengeBody=await challenge.json();await new Promise(r=>setTimeout(r,2100));
 function form(){const x=new FormData();for(const [k,v] of Object.entries({...answers,email:'forged@example.test',photoConsent:'false',csrf:login.csrf,token:challengeBody.token}))x.set(k,String(v));return x;}
 const first=await f.invoke('/api/feedback',{method:'POST',cookie:login.cookie,body:form()});assert.equal(first.status,201);const saved=await first.json();
 const retry=await f.invoke('/api/feedback',{method:'POST',cookie:login.cookie,body:form()});assert.equal(retry.status,200);assert.deepEqual(await retry.json(),saved);
 const payload=(await query(f.operator,'SELECT payload FROM event_feedback WHERE id=$1',[saved.id]))[0].payload;assert.equal(payload.email,p.email);assert.equal(payload.photoConsent,false);assert.equal(payload.improvements,'N/A');
 const claim=await f.invoke('/api/auth/claim',{method:'POST',cookie:login.cookie,body:{csrf:login.csrf,recipientId:other.id}});assert.equal(claim.status,200);assert.equal((await claim.json()).status,'assigned');
 assert.equal((await f.invoke('/feedback/admin',{cookie:login.cookie})).status,403);
 // R2 adapter is isolated and bounded. Concurrent slots produce one current manifest.
 f.env.PHOTOS_ENABLED='true';f.env.PRIVATE_PHOTO_METADATA_ACK='true';const bytes=Uint8Array.of(255,216,255,224);
 const uploaded=await Promise.all(Array.from({length:20},(_,i)=>f.invoke('/api/feedback/photo?id='+saved.id+'&slot='+i,{method:'POST',cookie:login.cookie,body:bytes,headers:{'Content-Type':'image/jpeg','X-CSRF-Token':login.csrf}})));
 assert.ok(uploaded.every(x=>x.status===200));assert.equal(f.objects.size,20);
 const photo=(slot,data=bytes,cookie=login.cookie,csrf=login.csrf)=>f.invoke('/api/feedback/photo?id='+saved.id+'&slot='+slot,{method:'POST',cookie,body:data,headers:{'Content-Type':'image/jpeg','X-CSRF-Token':csrf}});
 assert.equal((await photo(0)).status,200);const slotRace=await Promise.all([photo(0),photo(0),photo(0,Uint8Array.of(255,216,255,225))]);assert.deepEqual(slotRace.map(x=>x.status).sort(),[200,200,409]);assert.equal(f.objects.size,20);assert.equal((await photo(0,Uint8Array.of(255,216,255,225))).status,409);assert.equal((await photo(20)).status,400);
 const outsider=await f.login(other);assert.equal((await photo(0,bytes,outsider.cookie,outsider.csrf)).status,404);
 const manifest=(await query(f.operator,'SELECT photos FROM event_feedback WHERE id=$1',[saved.id]))[0].photos;assert.equal(manifest.length,20);assert.equal(new Set(manifest.map(x=>x.key)).size,20);
 const ownerLogin=await f.login(owner);assert.equal((await f.invoke('/feedback/admin',{cookie:ownerLogin.cookie})).status,200);const exported=await f.invoke('/feedback/admin/export',{cookie:ownerLogin.cookie});assert.equal(exported.status,200);assert.equal((await exported.json()).rows.find(r=>r.id===saved.id).photos.length,20);
 const privatePhotoPath=parsePhotoKey(saved.id,manifest.find(x=>parsePhotoKey(saved.id,x.key).slot===19).key).path;
 const privatePhoto=await f.invoke(privatePhotoPath,{cookie:ownerLogin.cookie});assert.equal(privatePhoto.status,200);assert.deepEqual(new Uint8Array(await privatePhoto.arrayBuffer()),bytes);assert.equal((await f.invoke(privatePhotoPath,{cookie:login.cookie})).status,403);
 assert.equal((await f.invoke('/feedback/admin/photo/'+saved.id+'/19',{cookie:ownerLogin.cookie})).status,404,'Mutable index routes are retired');
 evidence.push({label:'actual Worker login/admission/retry/admin/private photo/export',passed:true,nativeRuntimeBackendPids:[...f.runtime.pids]});assert.ok(f.runtime.pids.size>1);
 // Actual main -> sender -> native authorization. Fake transport is the ONLY send.
 const mailPerson=await f.person({synthetic:false}),sent=[];let captured;
 const senderEnv={...f.env,TEST_DATABASE:f.sender,MAIL_SEND_ENABLED:'true',AGENTMAIL_SEND_KEY:'SYNTHETIC_NO_SEND',APPROVED_INBOX:'synthetic@example.test',REPLY_TO:'owner@example.test'};
 const service={async fetch(request){captured=await request.clone().json();return sendMagic(request,senderEnv,async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return new Response('Not sent; synthetic transport',{status:202});});}};
 assert.equal((await f.invoke('/api/auth/request',{method:'POST',body:{email:mailPerson.email,lang:'en'},flags:{MAGIC_MAILER:service}})).status,200);assert.equal(sent.length,1);assert.equal(sent[0].body.to[0],mailPerson.email);assert.ok(sent[0].body.html.includes('Synthetic &lt;Guest&gt;'));assert.equal(sent[0].body.track_opens,false);
 const senderRequest=()=>new Request('https://mailer.internal/magic-link',{method:'POST',body:JSON.stringify(captured)});
 assert.equal((await sendMagic(senderRequest(),senderEnv,()=>assert.fail('replayed send'))).status,403);
 const attemptToken=randomToken();await new AuthStore((q,p)=>query(f.operator,q,p)).issue(mailPerson.id,await hash(attemptToken));const attemptLink=f.env.PUBLIC_ORIGIN+'/en/feedback/sign-in#'+attemptToken;
 const authorizeRequest=(to=mailPerson.email)=>new Request('https://mailer.internal/magic-link',{method:'POST',body:JSON.stringify({...captured,to,link:attemptLink})});
 assert.equal((await sendMagic(authorizeRequest('wrong@example.test'),senderEnv,()=>assert.fail('wrong recipient'))).status,403);
 let attempts=0;const sends=await race('durable mail attempt reservation',6,async c=>sendMagic(authorizeRequest(),{...senderEnv,TEST_DATABASE:{query:(q,p)=>query(c,q,p)}},async()=>{attempts++;throw Error('Synthetic ambiguous provider acceptance');}),'sender');
 assert.equal(attempts,1);assert.equal(sends.filter(x=>x.status==='fulfilled'&&x.value.status===503).length,1);assert.equal(sends.filter(x=>x.status==='fulfilled'&&x.value.status===403).length,5);
 assert.equal((await sendMagic(authorizeRequest(),senderEnv,()=>assert.fail('ambiguous resend'))).status,403);
 evidence.push({label:'native main-to-sender authorization + ambiguous acceptance fence',actualExternalMailRequests:0});
 // Effective LOGIN privileges, not string inspections of grants.
 const runtime=await f.client(),admin=await f.client('admin'),sender=await f.client('sender');
 for(const c of [runtime,admin,sender]){
  await denied(c,'SELECT link FROM cc_credit_codes');await denied(c,"UPDATE cc_release SET roster_reviewed=true WHERE id=1");await denied(c,"UPDATE cc_recipients SET eligible=true WHERE id=$1",[p.id]);await denied(c,'CREATE TABLE public.escalation(id int)');
 }
 await denied(runtime,"INSERT INTO event_feedback(id,status,payload) VALUES($1,'saved','{}')",[randomUUID()]);await denied(runtime,'SELECT * FROM cc_authorize_mail($1,$2)',[digest,p.email]);
 await denied(admin,'SELECT cc_assign_credit($1,false)',[p.id]);await denied(sender,'SELECT payload FROM event_feedback');await denied(sender,'SELECT * FROM cc_magic_tokens');
 assert.ok((await query(admin,'SELECT id FROM event_feedback')).length);evidence.push({label:'runtime/admin/sender effective LOGIN grants',passed:true});
 await proveExtra({f,race,save,query,evidence});
 // Execute photo SQL as actual runtime LOGIN, including invalid input and foreign
 // ownership. The handler's preflight is not the authorization boundary.
 const nativePhotoKey=manifest[0].key,nativeSlot=parsePhotoKey(saved.id,nativePhotoKey).slot;
 const nativePhotoArgs=[saved.id,p.id,nativeSlot,nativePhotoKey,'image/jpeg',bytes.length];
 const reserveSQL='SELECT cc_reserve_photo($1,$2,$3,$4,$5,$6) reservation',commitSQL='SELECT cc_commit_photo($1,$2,$3,$4,$5,$6) committed';
 assert.equal((await query(runtime,reserveSQL,nativePhotoArgs))[0].reservation.ready,true);
 assert.equal((await query(runtime,commitSQL,nativePhotoArgs))[0].committed,true);
 assert.equal((await query(runtime,reserveSQL,[saved.id,other.id,...nativePhotoArgs.slice(2)]))[0].reservation.status,'denied');
 assert.equal((await query(runtime,commitSQL,[saved.id,other.id,...nativePhotoArgs.slice(2)]))[0].committed,false);
 for(const [index,value]of [[2,20],[2,-1],[3,nativePhotoKey+'/suffix'],[3,nativePhotoKey.replace(saved.id,receipt)],[4,'image/png'],[5,0],[5,4194305],[5,null]]){
  const invalid=[...nativePhotoArgs];invalid[index]=value;await assert.rejects(()=>query(runtime,reserveSQL,invalid),/invalid photo/);await assert.rejects(()=>query(runtime,commitSQL,invalid),/invalid photo/);
 }
 await denied(runtime,"UPDATE event_feedback SET photos='[]'::jsonb WHERE id=$1",[saved.id]);
 for(const c of [runtime,admin,sender]){
  await denied(c,'SELECT * FROM cc_feedback_uploads');await denied(c,'UPDATE cc_feedback_uploads SET ready=true');
  await denied(c,'INSERT INTO cc_feedback_uploads(submission_id,slot,object_key,content_type,bytes) VALUES($1,0,$2,$3,4)',[saved.id,nativePhotoKey,'image/jpeg']);
  if(c!==runtime){await denied(c,reserveSQL,nativePhotoArgs);await denied(c,commitSQL,nativePhotoArgs);}
 }
 evidence.push({label:'native photo function validation/ownership and effective least-privilege grants',passed:true});
 // Exercise real operator CLI apply paths against only this disposable database.
 const privateDir=await mkdtemp(join(tmpdir(),'cc-proof-operator-'));
 try{
  const cliEnv={...process.env,OPERATOR_DATABASE_URL:process.env.PROOF_DATABASE_URL,PUBLIC_ORIGIN:f.env.PUBLIC_ORIGIN,OWNER_EMAILS:'operator-owner@example.test',CREDIT_LINK_ORIGINS:'https://credits.example.invalid',CREDIT_CLAIMS_ENABLED:'true',REAL_CREDIT_DISTRIBUTION:'true'};
  function cli(script,args,expected=0){const r=spawnSync(process.execPath,[new URL('./'+script,import.meta.url).pathname,...args],{env:cliEnv,encoding:'utf8',timeout:20000});assert.equal(r.status,expected,script+': '+r.stderr);return r.stdout;}
  // Real HTTPS Worker/exporter path; the only photo object adapter is synthetic.
  // Finish slot 19 first, then complete lower slot 0 only AFTER the exporter has
  // captured that manifest and BEFORE the actual private-photo SELECT resolves.
  const driftId=randomUUID(),lowerBytes=Uint8Array.of(255,216,255,225);await save(runtime,driftId,p);
  const driftPhoto=(slot,data=bytes)=>f.invoke(`/api/feedback/photo?id=${driftId}&slot=${slot}`,{method:'POST',cookie:login.cookie,body:data,headers:{'Content-Type':'image/jpeg','X-CSRF-Token':login.csrf}});
  assert.equal((await driftPhoto(19)).status,200);
  const driftKey=(await query(f.operator,'SELECT photos FROM event_feedback WHERE id=$1',[driftId]))[0].photos[0].key;
  const {proofServer}=await import('../test-support/server.mjs');const previousOrigin=f.env.PUBLIC_ORIGIN,previousQuery=f.admin.query,previousGet=f.bucket.get;let httpsServer,manifestCaptured=false,lowerCompleted=false;
  async function exportCLI(destination,expected=0){
   const cookieFile=join(privateDir,'export-cookie');await writeFile(cookieFile,ownerLogin.cookie,{mode:0o600});
   const result=await new Promise((done,reject)=>{
    const child=spawn(process.execPath,['--max-old-space-size=384',new URL('./export-private.mjs',import.meta.url).pathname,'--cookie-file',cookieFile,'--out',destination],{env:{...process.env,PUBLIC_ORIGIN:httpsServer.origin,NODE_EXTRA_CA_CERTS:httpsServer.caFile},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Photo export CLI timeout'));},30000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);done({code,output});});
   });assert.equal(result.code,expected,result.output);
  }
  try{
   httpsServer=await proofServer(f);
   f.admin.query=async(text,values)=>{
    if(text.startsWith('SELECT photos')&&values[0]===driftId&&!lowerCompleted){
     assert.equal(manifestCaptured,true,'CLI must capture the slot-19-only manifest before slot 0 finishes');assert.equal((await driftPhoto(0,lowerBytes)).status,200);lowerCompleted=true;
    }
    const rows=await previousQuery(text,values);
    if(text.startsWith('SELECT id,created_at,payload,photos')){const row=rows.find(x=>x.id===driftId);if(row){assert.equal(row.photos.length,1);assert.equal(row.photos[0].key,driftKey);manifestCaptured=true;}}
    return rows;
   };
   const destination=join(privateDir,'photo-export');await exportCLI(destination);
   const artifact=JSON.parse(await readFile(join(destination,'feedback.PRIVATE.json'),'utf8')),exportedRow=artifact.rows.find(x=>x.id===driftId);
   assert.equal(artifact.complete,true);assert.equal(manifestCaptured,true);assert.equal(lowerCompleted,true);assert.deepEqual(exportedRow.photos.map(x=>x.key),[driftKey]);
   const ref=parsePhotoKey(driftId,driftKey),filename=`${driftId}-${ref.slot}-${ref.digest}.${ref.extension}`;
   assert.deepEqual(new Uint8Array(await readFile(join(destination,filename))),bytes);assert.equal(artifact.photos.find(x=>x.file===filename).sha256,ref.digest);
   const current=(await query(f.operator,'SELECT photos FROM event_feedback WHERE id=$1',[driftId]))[0].photos;assert.deepEqual(current.map(x=>parsePhotoKey(driftId,x.key).slot),[0,19]);
   // A corrupt equal-length object may never become a completed export either.
   f.admin.query=previousQuery;f.bucket.get=async key=>key===driftKey?{body:lowerBytes,httpMetadata:{contentType:'image/jpeg'}}:previousGet(key);
   const incomplete=join(privateDir,'corrupt-photo-export');await exportCLI(incomplete,1);assert.equal(JSON.parse(await readFile(incomplete+'.incomplete/INCOMPLETE.json','utf8')).complete,false);await assert.rejects(()=>readFile(incomplete+'/feedback.PRIVATE.json'),{code:'ENOENT'});
   evidence.push({label:'real export CLI + HTTPS Worker + native manifest drift',passed:true,capturedSlot:19,completedBeforeDownloadSlot:0,equalByteLengths:true,exactCapturedBytesExported:true,corruptionLeavesIncomplete:true});
  }finally{f.admin.query=previousQuery;f.bucket.get=previousGet;await httpsServer?.close();f.env.PUBLIC_ORIGIN=previousOrigin;}
  const roster=join(privateDir,'roster.csv'),mapping=join(privateDir,'mapping.json'),inventory=join(privateDir,'inventory.csv'),ownerFile=join(privateDir,'owner.json');
  await writeFile(roster,'\uFEFFEmail,Name,Guest ID,Status,Checked In At\r\nimported@example.test,"Synthetic,\nImported",synthetic-imported,approved,2020-01-02T10:00:00Z\r\n',{mode:0o600});
  await writeFile(mapping,JSON.stringify({email:'Email',name:'Name',guestId:'Guest ID',status:'Status',checkedInAt:'Checked In At'}),{mode:0o600});
  cli('import-roster.mjs',['--file',roster,'--mapping',mapping]);cli('import-roster.mjs',['--file',roster,'--mapping',mapping,'--apply']);cli('import-roster.mjs',['--file',roster,'--mapping',mapping,'--apply']);
  const imported=(await query(f.operator,"SELECT * FROM cc_recipients WHERE email='imported@example.test'"))[0];assert.equal(imported.claim_eligible,true);assert.equal(imported.eligibility_basis,'checked-in');
  await writeFile(inventory,'type,value,status,recipient_email\ncode,SYNTHETIC_OPERATOR_PRIOR,assigned,imported@example.test\ncode,SYNTHETIC_OPERATOR_STOCK,unassigned,\nlink,https://credits.example.invalid/synthetic-operator,unassigned,\n',{mode:0o600});
  cli('import-inventory.mjs',['--file',inventory]);cli('import-inventory.mjs',['--file',inventory,'--apply']);cli('import-inventory.mjs',['--file',inventory,'--apply']);
  const assignedBefore=(await query(f.operator,"SELECT recipient_id,assigned_at FROM cc_credit_codes WHERE link='SYNTHETIC_OPERATOR_PRIOR'"))[0];assert.equal(assignedBefore.recipient_id,imported.id);
  await writeFile(ownerFile,JSON.stringify({email:'operator-owner@example.test',name:'Synthetic Owner',note:'Synthetic CLI access-only proof'}),{mode:0o600});cli('bootstrap-owner.mjs',['--file',ownerFile]);cli('bootstrap-owner.mjs',['--file',ownerFile,'--apply']);
  const bootstrap=(await query(f.operator,"SELECT * FROM cc_recipients WHERE email='operator-owner@example.test'"))[0];assert.equal(bootstrap.eligible,true);assert.equal(bootstrap.claim_eligible,false);assert.equal(bootstrap.checked_in_at,null);
  const cohort=(await query(f.operator,'SELECT count(*)::int n FROM cc_recipients WHERE eligible AND claim_eligible AND NOT synthetic'))[0].n,inventoryCount=(await query(f.operator,'SELECT count(*)::int n FROM cc_credit_codes WHERE NOT synthetic'))[0].n;
  const reviewArgs=['--note','Synthetic native CLI review','--expected-recipients',String(cohort),'--expected-inventory',String(inventoryCount)];
  cli('review-release.mjs',reviewArgs);cli('review-release.mjs',[...reviewArgs,'--apply']);cli('preflight.mjs',[]);
  await f.operator.query('UPDATE cc_recipients SET name=name WHERE id=$1',[imported.id]);cli('preflight.mjs',[],1);
  const after=(await query(f.operator,"SELECT recipient_id,assigned_at FROM cc_credit_codes WHERE link='SYNTHETIC_OPERATOR_PRIOR'"))[0];assert.deepEqual(after,assignedBefore);
  // A real authorized upload reserves slot 18, then pauses at synthetic object
  // put while the actual cleanup CLI erases both receipts. Keep the pending key
  // forever discoverable even if the delayed write's compensating delete fails.
  const put=f.bucket.put,del=f.bucket.delete;let releasePut,enteredPut,lateWritten=false,lateKey;
  const heldPut=new Promise(resolve=>releasePut=resolve),putEntered=new Promise(resolve=>enteredPut=resolve);
  f.bucket.put=async(key,data,options)=>{lateKey=key;enteredPut();await heldPut;await put(key,data,options);lateWritten=true;};
  f.bucket.delete=async key=>{if(lateWritten&&key===lateKey)throw Error('Synthetic transient delete failure');return del(key);};
  const delayed=driftPhoto(18);assert.equal(await Promise.race([putEntered.then(()=>true),delayed.then(()=>false)]),true,'Upload must reserve before erasure');
  try{
   f.env.PHOTOS_ENABLED='false';await f.operator.query("UPDATE event_feedback SET created_at=now()-interval '100 days' WHERE id=ANY($1::uuid[])",[[saved.id,driftId]]);
   const before=new Date(Date.now()-86400000).toISOString(),manifestFile=join(privateDir,'deletion.json');cli('cleanup.mjs',['--before',before,'--manifest',manifestFile]);
   const deletion=JSON.parse(await readFile(manifestFile,'utf8'));assert.deepEqual(deletion.rows.map(x=>x.id).sort(),[saved.id,driftId].sort());assert.equal(deletion.rows.reduce((n,r)=>n+r.keys.length,0),23);assert.ok(deletion.rows.find(x=>x.id===driftId).keys.includes(lateKey));for(const r of deletion.rows)for(const key of r.keys)await f.bucket.delete(key);
   cli('cleanup.mjs',['--before',before,'--manifest',manifestFile,'--objects-deleted','yes','--apply']);
   const erased=(await query(f.operator,'SELECT payload,photos FROM event_feedback WHERE id=$1',[saved.id]))[0];assert.deepEqual(erased.payload,{recipientId:p.id,deleted:true,privacyVersion:'1'});assert.deepEqual(erased.photos,[]);assert.equal(f.objects.size,0);
   const pending=(await query(f.operator,'SELECT ready,object_key FROM cc_feedback_uploads WHERE submission_id=$1 AND slot=18',[driftId]))[0];assert.equal(pending.ready,false);assert.equal(pending.object_key,lateKey);
   // Resume collection before the old in-flight put returns. Commit must reject
   // the tombstone, independently of the operator's temporary feature flag.
   f.env.PHOTOS_ENABLED='true';releasePut();assert.equal((await delayed).status,404);assert.equal(f.objects.has(lateKey),true,'Failed compensation leaves a discoverable orphan');
   assert.deepEqual((await query(f.operator,'SELECT photos FROM event_feedback WHERE id=$1',[driftId]))[0].photos,[]);assert.equal((await query(f.operator,'SELECT ready FROM cc_feedback_uploads WHERE submission_id=$1 AND slot=18',[driftId]))[0].ready,false);
   assert.equal((await photo(0)).status,404);assert.equal((await driftPhoto(19)).status,404);
   assert.equal((await query(runtime,reserveSQL,nativePhotoArgs))[0].reservation.status,'denied');assert.equal((await query(runtime,commitSQL,nativePhotoArgs))[0].committed,false);
   assert.equal((await query(f.operator,'SELECT count(*)::int n FROM cc_feedback_uploads WHERE submission_id=ANY($1::uuid[])',[[saved.id,driftId]]))[0].n,23,'Erasure neither reopens slots nor discards tombstone keys');
   f.bucket.delete=del;
   const repeated=join(privateDir,'deletion-repeat.json');f.env.PHOTOS_ENABLED='false';cli('cleanup.mjs',['--before',before,'--manifest',repeated]);const repeat=JSON.parse(await readFile(repeated,'utf8'));assert.deepEqual(repeat,deletion);assert.ok(repeat.rows.find(x=>x.id===driftId).keys.includes(lateKey));for(const r of repeat.rows)for(const key of r.keys)await f.bucket.delete(key);
   cli('cleanup.mjs',['--before',before,'--manifest',repeated,'--objects-deleted','yes','--apply']);assert.equal(f.objects.size,0);
   f.env.PHOTOS_ENABLED='true';assert.equal((await driftPhoto(18)).status,404);assert.equal(f.objects.size,0);
   assert.equal((await query(f.operator,'SELECT count(*)::int n FROM cc_credit_codes WHERE recipient_id=$1',[p.id]))[0].n,1);
   await save(f.operator,saved.id,p);assert.equal((await query(f.operator,'SELECT payload FROM event_feedback WHERE id=$1',[saved.id]))[0].payload.deleted,true,'Retry cannot resurrect erased content');
   evidence.push({label:'terminal photo erasure with delayed put, resume replay and repeat orphan reconciliation',passed:true,retainedReadyAndPendingKeys:23,failedCompensatingDeleteReconciled:true,objectsRemaining:f.objects.size});
  }finally{releasePut();await delayed;f.bucket.put=put;f.bucket.delete=del;}
  evidence.push({label:'real operator import/bootstrap/review/preflight/drift/manual cleanup CLI paths',passed:true,assignmentsPreserved:true});
 }finally{await rm(privateDir,{recursive:true,force:true});}
 console.log(JSON.stringify({nativePostgres:true,serializedFake:false,passed:true,evidence},null,2));
}finally{await f.close();}
