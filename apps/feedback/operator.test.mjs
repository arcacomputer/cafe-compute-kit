import test from 'node:test';import assert from 'node:assert/strict';
test('owner bootstrap grants access only and requires documented exact configured identity',async()=>{
 const {ownerAccess}=await import('./scripts/lifecycle.mjs');const env={PUBLIC_ORIGIN:'https://feedback.example.test',OWNER_EMAILS:'owner@example.test'};
 const r=ownerAccess({email:'owner@example.test',name:'Synthetic Owner',note:'Event stewardship'},env);assert.equal(r.eligible,true);assert.equal(r.claim_eligible,false);assert.equal(r.synthetic,false);assert.equal(r.checked_in_at,null);assert.equal(r.eligibility_basis,'owner-access');
 for(const input of [{email:'attendee@example.test',note:'x'},{email:'OWNER@example.test',note:'x'},{email:'owner@example.test',note:''}])assert.throws(()=>ownerAccess(input,env));
});
test('content erasure retains ownership/idempotency spine but no answers, contacts or photos',async()=>{
 const {erasedPayload,cleanupDate}=await import('./scripts/lifecycle.mjs');assert.deepEqual(erasedPayload({recipientId:'synthetic-id',email:'private@example.test',feedback:'private'}),{recipientId:'synthetic-id',deleted:true,privacyVersion:'1'});
 assert.equal(cleanupDate('2020-01-01T00:00:00Z'),'2020-01-01T00:00:00.000Z');for(const v of ['', 'nonsense','2999-01-01T00:00:00Z'])assert.throws(()=>cleanupDate(v));
});
