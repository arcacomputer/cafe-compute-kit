import assert from 'node:assert/strict';
import {fixture} from '../test-support/postgres.mjs';
import {createFeedbackRate} from '../../../vercel/rate.mjs';

const f=await fixture();let locked=false;
try{
 const a=await f.client('runtime'),b=await f.client('runtime');
 const binding=client=>({query:async(text,values)=>(await client.query(text,values)).rows});
 const key='a'.repeat(64),now=()=>600000;
 const first=createFeedbackRate({...f.env,TEST_DATABASE:binding(a)},{now});
 const second=createFeedbackRate({...f.env,TEST_DATABASE:binding(b)},{now});
 await f.operator.query('BEGIN');await f.operator.query('LOCK TABLE cc_auth_rate IN SHARE MODE');locked=true;
 const calls=Array.from({length:110},(_,i)=>(i%2?first:second).limit({key}));
 let waiting=[];
 for(let i=0;i<100;i++){
  await f.operator.query('SELECT pg_stat_clear_snapshot()');
  waiting=(await f.operator.query("SELECT DISTINCT pid FROM pg_stat_activity WHERE usename='cc_proof_runtime' AND wait_event_type='Lock' AND query LIKE 'INSERT INTO cc_auth_rate%'")).rows;
  if(waiting.length>=2)break;
  await new Promise(done=>setTimeout(done,20));
 }
 assert.ok(waiting.length>=2,'Two real independent runtime sessions must overlap before releasing the barrier');
 await f.operator.query('COMMIT');locked=false;
 const results=await Promise.all(calls);assert.equal(results.filter(x=>x.success).length,100);assert.equal(results.filter(x=>!x.success).length,10);
 const row=(await f.operator.query('SELECT count FROM cc_auth_rate WHERE key=$1',['vercel-feedback:10:'+key])).rows[0];assert.equal(row.count,100);
 console.log(JSON.stringify({passed:true,platform:'vercel',nativePostgres:true,independentBlockedSessions:waiting.length,overlappingAttempts:results.length,allowed:results.filter(x=>x.success).length,denied:results.filter(x=>!x.success).length,storedCount:row.count}));
}finally{if(locked)await f.operator.query('ROLLBACK');await f.close();}
