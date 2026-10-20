import test from 'node:test';
import assert from 'node:assert/strict';

test('feedback transport uses the shared atomic PostgreSQL rate statement across instances and fails closed', async () => {
 const {createFeedbackRate}=await import('../vercel/rate.mjs');
 const counts=new Map(),calls=[];
 const database={query:async(q,p)=>{calls.push(q);await Promise.resolve();const count=counts.get(p[0])||0;if(count>=p[1])return [];counts.set(p[0],count+1);return [{count:count+1}];}};
 const env={TEST_DATABASE:database};
 const a=createFeedbackRate(env,{now:()=>120000}),b=createFeedbackRate(env,{now:()=>120000});
 const results=await Promise.all(Array.from({length:125},(_,i)=>(i%2?a:b).limit({key:'a'.repeat(64)})));
 assert.equal(results.filter(x=>x.success).length,100);
 assert.equal(counts.size,1);
 assert.match(calls[0],/ON CONFLICT\(key\) DO UPDATE SET count=cc_auth_rate.count\+1 WHERE cc_auth_rate.count<\$2 RETURNING count/);
 assert.equal((await createFeedbackRate(env,{now:()=>180000}).limit({key:'a'.repeat(64)})).success,true);
 await assert.rejects(()=>createFeedbackRate({TEST_DATABASE:{query:async()=>{throw Error('database offline');}}}).limit({key:'a'.repeat(64)}));
 await assert.rejects(()=>a.limit({key:'untrusted plaintext'}));
});
