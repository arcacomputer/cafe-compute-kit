import {args,operatorClient,transact,fail} from './operator.mjs';
import {creditValue,getConfig} from '../config.js';
try{
 const a=args(['--apply','--note','--expected-recipients','--expected-inventory']);getConfig(process.env);
 const n=Number(a['--expected-recipients']),m=Number(a['--expected-inventory']);
 if(!Number.isSafeInteger(n)||n<=0||!Number.isSafeInteger(m)||m<=0||!a['--note']?.trim())throw Error('Positive reviewed counts and note required');
 const client=await operatorClient();try{
  const version=await transact(client,async c=>{
   await c.query('LOCK TABLE cc_recipients,cc_credit_codes IN SHARE ROW EXCLUSIVE MODE');
   const recipients=(await c.query('SELECT id FROM cc_recipients WHERE eligible AND claim_eligible AND NOT synthetic')).rows;
   const codes=(await c.query('SELECT c.*,r.synthetic AS recipient_synthetic FROM cc_credit_codes c LEFT JOIN cc_recipients r ON r.id=c.recipient_id WHERE NOT c.synthetic')).rows;
   if(recipients.length!==n||codes.length!==m||!codes.every(x=>creditValue(x.link,x.value_type,process.env))||codes.some(x=>x.recipient_id&&x.recipient_synthetic))throw Error('Reconciliation mismatch');
   const remaining=recipients.filter(r=>!codes.some(x=>x.recipient_id===r.id)).length;
   if(codes.filter(x=>!x.recipient_id&&!x.withheld).length<remaining)throw Error('Insufficient unassigned coverage');
   const r=(await c.query('SELECT version FROM cc_release WHERE id=1 FOR UPDATE')).rows[0];
   if(a['--apply'])await c.query('UPDATE cc_release SET roster_reviewed=true,inventory_reviewed=true,prior_assignments_reviewed=true,expected_recipients=$1,expected_inventory=$2,reviewed_version=version,review_note=$3 WHERE id=1',[n,m,a['--note']]);
   return r.version;
  });
  if(a['--apply']){const r=(await client.query('SELECT * FROM cc_release WHERE id=1')).rows[0];if(r.reviewed_version!==version||r.version!==version||!r.roster_reviewed||!r.inventory_reviewed||!r.prior_assignments_reviewed)throw Error('Readback drift');}
  console.log(JSON.stringify({mode:a['--apply']?'apply':'dry-run',reconciled:true,version,flags:'Enable runtime flags only after preflight; no send or allocation performed'}));
 }finally{await client.end();}
}catch{fail();}
