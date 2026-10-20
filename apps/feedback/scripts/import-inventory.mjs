import {createHash} from 'node:crypto';
import {planInventory} from './inventory.mjs';
import {args,privateInput,enforcePrivatePath,operatorClient,transact,fail} from './operator.mjs';
try{
 const a=args(['--file','--apply']),source=await privateInput(a['--file']),plan=planInventory(source,process.env),digest=createHash('sha256').update(source).digest('hex');
 console.log(JSON.stringify({mode:a['--apply']?'apply':'dry-run',...plan.summary}));
 if(a['--apply']){
  enforcePrivatePath(a['--file']);const client=await operatorClient();try{
   await transact(client,async c=>{await c.query('LOCK TABLE cc_credit_codes IN SHARE ROW EXCLUSIVE MODE');for(const x of plan.rows){
    const recipient=x.recipientEmail?(await c.query('SELECT id FROM cc_recipients WHERE email=$1',[x.recipientEmail])).rows[0]?.id:null;
    if(x.recipientEmail&&!recipient)throw Error('Prior assignment recipient must be explicitly imported first');
    const old=(await c.query('SELECT value_type,recipient_id,synthetic,withheld FROM cc_credit_codes WHERE link=$1',[x.value])).rows[0];
    if(old){if(old.value_type!==x.type||old.synthetic||x.status==='assigned'&&old.recipient_id!==recipient||x.status==='withheld'&&!old.withheld)throw Error('Existing inventory conflict');continue;}
    await c.query('INSERT INTO cc_credit_codes(link,value_type,synthetic,withheld,recipient_id,assigned_at,source_sha256,source_index) VALUES($1,$2,false,$3,$4,CASE WHEN $4::uuid IS NULL THEN NULL ELSE now() END,$5,$6)',[x.value,x.type,x.status==='withheld',recipient,digest,x.sourceIndex]);
   }});
   const verified=(await client.query('SELECT count(*)::integer n FROM cc_credit_codes WHERE link=ANY($1::text[])',[plan.rows.map(x=>x.value)])).rows[0].n;if(verified!==plan.rows.length)throw Error('Readback mismatch');const n=(await client.query('SELECT count(*)::integer n FROM cc_credit_codes WHERE source_sha256=$1',[digest])).rows[0].n;console.log(JSON.stringify({verifiedPlannedRows:verified,verifiedSourceRows:n,release:'requires renewed review'}));
  }finally{await client.end();}
 }
}catch{fail();}
