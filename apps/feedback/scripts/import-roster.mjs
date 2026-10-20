import {createHash} from 'node:crypto';
import {planRoster} from './roster.mjs';
import {args,privateInput,enforcePrivatePath,operatorClient,transact,fail} from './operator.mjs';
try{
 const a=args(['--file','--mapping','--exceptions','--apply','--allow-held']);
 if(!a['--mapping'])throw Error('Explicit mapping required');
 const source=await privateInput(a['--file']),mapping=JSON.parse(await privateInput(a['--mapping']));
 const exceptions=a['--exceptions']?JSON.parse(await privateInput(a['--exceptions'])):[];
 const plan=planRoster(source,mapping,exceptions),sourceDigest=createHash('sha256').update(source).digest('hex');
 console.log(JSON.stringify({mode:a['--apply']?'apply':'dry-run',...plan.summary}));
 if(a['--apply']){
  enforcePrivatePath(a['--file']);if(a['--exceptions'])enforcePrivatePath(a['--exceptions']);
  if(plan.summary.held&&!a['--allow-held'])throw Error('Held records require review');
  const client=await operatorClient();try{
   await transact(client,async c=>{await c.query('LOCK TABLE cc_recipients IN SHARE ROW EXCLUSIVE MODE');for(const x of plan.rows){
    const old=(await c.query('SELECT * FROM cc_recipients WHERE email=$1 OR guest_id=$2',[x.email,x.guest_id])).rows;
    if(old.length){if(old.length!==1||old[0].email!==x.email||old[0].guest_id!==x.guest_id||old[0].name!==x.name||old[0].eligibility_basis!==x.eligibility_basis||!old[0].eligible||!old[0].claim_eligible||old[0].synthetic||old[0].provenance.sourceDigest!==sourceDigest||((old[0].checked_in_at?new Date(old[0].checked_in_at).toISOString():null)!==(x.checked_in_at?new Date(x.checked_in_at).toISOString():null)))throw Error('Existing identity conflict');continue;}
    await c.query('INSERT INTO cc_recipients(guest_id,email,name,eligible,claim_eligible,synthetic,eligibility_basis,checked_in_at,provenance) VALUES($1,$2,$3,true,true,false,$4,$5,$6)',[x.guest_id,x.email,x.name,x.eligibility_basis,x.checked_in_at,JSON.stringify({...x.provenance,sourceDigest})]);
   }});
   const n=(await client.query("SELECT count(*)::integer n FROM cc_recipients WHERE provenance->>'sourceDigest'=$1",[sourceDigest])).rows[0].n;if(n!==plan.rows.length)throw Error('Readback mismatch');console.log(JSON.stringify({verifiedSourceRows:n,release:'requires renewed review'}));
  }finally{await client.end();}
 }
}catch{fail();}
