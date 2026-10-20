import test from 'node:test';import assert from 'node:assert/strict';
const mapping={email:'Email',name:'Name',guestId:'Guest ID',status:'Status',checkedInAt:'Checked In At'};
test('BOM CSV quoting, duplicate/shared addresses and unknown statuses are held without invented attendance',async()=>{
 const {planRoster}=await import('./scripts/roster.mjs');
 const csv='\uFEFFEmail,Name,Guest ID,Status,Checked In At\r\nfirst@example.test,"Alex,\nSynthetic",g1,approved,2026-01-02T10:00:00Z\r\ndup@example.test,One,g2,approved,2026-01-02T10:00:00Z\r\ndup@example.test,Two,g3,approved,2026-01-02T10:00:00Z\r\nunknown@example.test,U,g4,unexpected,2026-01-02T10:00:00Z\r\nregistered@example.test,R,g5,approved,\r\n';
 const plan=planRoster(csv,mapping);assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].name,'Alex,\nSynthetic');assert.equal(plan.rows[0].claim_eligible,true);assert.equal(plan.summary.held,3);assert.equal(plan.summary.notCheckedIn,1);assert.equal(plan.summary.total,5);assert.ok(!JSON.stringify(plan.summary).includes('@'));
});
test('exceptions need review evidence and never create check-in timestamps',async()=>{
 const {planRoster}=await import('./scripts/roster.mjs');const csv='Email,Name,Guest ID,Status,Checked In At\na@example.test,A,g1,approved,\n';
 assert.throws(()=>planRoster(csv,mapping,[{guestId:'g1',reason:'missed check-in'}]));
 const p=planRoster(csv,mapping,[{guestId:'g1',reason:'missed check-in',reviewedBy:'Synthetic steward',reference:'synthetic-review-1'}]);assert.equal(p.rows[0].eligibility_basis,'organizer-exception');assert.equal(p.rows[0].checked_in_at,null);
});
test('CSV malformed quotes and duplicate headers fail closed',async()=>{
 const {parseCSV}=await import('./scripts/csv.mjs');for(const csv of ['a,a\nx,y','a,b\n"unterminated,x','a,b\nx"y,z','a,b\n"x"junk,z'])assert.throws(()=>parseCSV(csv));
});
