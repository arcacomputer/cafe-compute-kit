import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from '../auth.js';
import {sendMagic} from '../mailer/worker.js';

// Additional acceptance cases requested by the independent review. These run
// only from the disposable native suite, using its real independent-session barrier.
export async function proveExtra({f,race,save,query,evidence}){
 const runtime=await f.client('runtime');
 const held=(await query(f.operator,'SELECT id FROM cc_credit_codes WHERE synthetic AND recipient_id IS NULL AND NOT withheld')).map(x=>x.id);
 try{
  await f.operator.query('UPDATE cc_credit_codes SET withheld=true WHERE id=ANY($1::uuid[])',[held]);
  let index=0;
  async function addStock(){const value='SYNTHETIC_EXTRA_'+randomUUID();await f.operator.query("INSERT INTO cc_credit_codes(link,value_type,synthetic,source_sha256,source_index) VALUES($1,'code',true,$2,$3)",[value,'1'.repeat(64),index++]);return value;}
  const a=await f.person(),b=await f.person();await save(f.operator,randomUUID(),a);await save(f.operator,randomUUID(),b);await addStock();await addStock();
  const fresh=await race('two fresh claimants compete for unassigned stock',2,(c,i)=>query(c,'SELECT cc_assign_credit($1,false) value',[[a,b][i].id]));
  assert.ok(fresh.every(x=>x.status==='fulfilled'));assert.equal(new Set(fresh.map(x=>x.value[0].value.value)).size,2);
  for(const [i,person]of[a,b].entries())assert.equal((await query(runtime,'SELECT cc_assign_credit($1,false) value',[person.id]))[0].value.value,fresh[i].value[0].value.value);
  const one=await f.person(),two=await f.person();await save(f.operator,randomUUID(),one);await save(f.operator,randomUUID(),two);const only=await addStock();
  const exhausted=await race('two fresh claimants contend for one remaining value',2,(c,i)=>query(c,'SELECT cc_assign_credit($1,false) value',[[one,two][i].id]));
  assert.equal(exhausted.filter(x=>x.status==='fulfilled').length,1);assert.ok(exhausted.filter(x=>x.status==='rejected').every(x=>/inventory temporarily unavailable/.test(x.reason.message)));
  const winner=exhausted.findIndex(x=>x.status==='fulfilled'),loser=[one,two][1-winner];assert.equal(exhausted[winner].value[0].value.value,only);
  await assert.rejects(()=>query(runtime,'SELECT cc_assign_credit($1,false) value',[loser.id]),/inventory temporarily unavailable/);
  const replacement=await addStock();assert.equal((await query(runtime,'SELECT cc_assign_credit($1,false) value',[loser.id]))[0].value.value,replacement);
  assert.equal((await query(runtime,'SELECT cc_assign_credit($1,false) value',[loser.id]))[0].value.value,replacement);
  evidence.push({label:'fresh/fresh claim contention, true exhaustion and stable retry',passed:true});

  const owners=[await f.person(),await f.person()],receipt=randomUUID();
  const before=(await query(f.operator,'SELECT total FROM feedback_daily WHERE day=CURRENT_DATE'))[0].total;
  const ownership=await race('foreign owners race for same new receipt through runtime logins',2,(c,i)=>save(c,receipt,owners[i]));
  assert.equal(ownership.filter(x=>x.status==='fulfilled').length,1);assert.equal(ownership.filter(x=>x.status==='rejected'&&/foreign receipt/.test(x.reason.message)).length,1);
  const saved=(await query(f.operator,'SELECT payload FROM event_feedback WHERE id=$1',[receipt]))[0];assert.equal(saved.payload.recipientId,owners[ownership.findIndex(x=>x.status==='fulfilled')].id);
  const charges=await query(f.operator,'SELECT total FROM cc_feedback_account_daily WHERE recipient_id=ANY($1::uuid[])',[owners.map(x=>x.id)]);assert.equal(charges.length,1);assert.equal(charges[0].total,1);
  assert.equal((await query(f.operator,'SELECT total FROM feedback_daily WHERE day=CURRENT_DATE'))[0].total,before+1);
  evidence.push({label:'foreign-owner same-receipt native race has one owner and exactly one charge',passed:true});
 }finally{
  await f.operator.query('UPDATE cc_credit_codes SET withheld=false WHERE id=ANY($1::uuid[])',[held]);await runtime.end();
 }

 const person=await f.person({synthetic:false,claim:false}),senderEnv={...f.env,TEST_DATABASE:f.sender,MAIL_SEND_ENABLED:'true',AGENTMAIL_SEND_KEY:'SYNTHETIC_NO_SEND',APPROVED_INBOX:'synthetic@example.test',REPLY_TO:'organizer@example.test'};
 let captured,attempts=0;
 const service={async fetch(request){captured=await request.clone().json();return sendMagic(request,senderEnv,async()=>{attempts++;throw Error('Synthetic provider acceptance followed by response loss');});}};
 const headers={'CF-Connecting-IP':'192.0.2.177'};
 assert.equal((await f.invoke('/api/auth/request',{method:'POST',headers,body:{email:person.email,lang:'en'},flags:{MAGIC_MAILER:service}})).status,200);assert.equal(attempts,1);assert.ok(captured?.link);
 const token=new URL(captured.link).hash.slice(1),digest=await hash(token);
 assert.equal((await query(f.operator,'SELECT consumed_at FROM cc_magic_tokens WHERE hash=$1',[digest]))[0].consumed_at,null,'Ambiguous delivery cannot consume potentially delivered link');
 const replay=new Request('https://mailer.internal/magic-link',{method:'POST',body:JSON.stringify(captured)});
 assert.equal((await sendMagic(replay,senderEnv,()=>assert.fail('No ambiguous resend'))).status,403);
 assert.equal((await f.invoke('/api/auth/consume',{method:'POST',headers,body:{token}})).status,200);
 assert.equal((await f.invoke('/api/auth/consume',{method:'POST',headers,body:{token}})).status,400);
 assert.equal((await query(f.operator,'SELECT count(*)::int n FROM cc_mail_attempts WHERE token_hash=$1',[digest]))[0].n,1);assert.equal(attempts,1);
 evidence.push({label:'actual main-to-sender accepted-then-timeout retains one consumable link without resend',passed:true,providerAttempts:1,actualMailSent:0});
}
