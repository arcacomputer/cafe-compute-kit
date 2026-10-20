import {ownerAccess} from './lifecycle.mjs';
import {args,privateInput,enforcePrivatePath,operatorClient,transact,fail} from './operator.mjs';
try{
 const a=args(['--file','--apply']),r=ownerAccess(JSON.parse(await privateInput(a['--file'])),process.env);
 console.log(JSON.stringify({mode:a['--apply']?'apply':'dry-run',access:true,benefitEligible:false,checkIn:false}));
 if(a['--apply']){enforcePrivatePath(a['--file']);const client=await operatorClient();try{
  await transact(client,async c=>{
   await c.query('LOCK TABLE cc_recipients IN SHARE ROW EXCLUSIVE MODE');
   const old=(await c.query('SELECT * FROM cc_recipients WHERE email=$1',[r.email])).rows[0];
   if(old){if(!old.eligible||old.claim_eligible||old.synthetic||old.checked_in_at||old.eligibility_basis!=='owner-access')throw Error('Existing identity conflict');return;}
   await c.query("INSERT INTO cc_recipients(email,name,eligible,claim_eligible,synthetic,eligibility_basis,provenance) VALUES($1,$2,true,false,false,'owner-access',$3)",[r.email,r.name,r.provenance]);
  });
  const row=(await client.query('SELECT eligible,claim_eligible,checked_in_at,eligibility_basis FROM cc_recipients WHERE email=$1',[r.email])).rows[0];
  if(!row.eligible||row.claim_eligible||row.checked_in_at||row.eligibility_basis!=='owner-access')throw Error('Readback failed');console.log(JSON.stringify({verified:true,benefitEligible:false}));
 }finally{await client.end();}}
}catch{fail();}
