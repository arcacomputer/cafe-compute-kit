import {getConfig,creditValue} from '../config.js';
import {operatorClient,args,fail} from './operator.mjs';
// Read-only by design: never enables gates, claims stock, sends or visits URLs.
try{
 args([]);getConfig(process.env);const client=await operatorClient();try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const r=(await client.query('SELECT * FROM cc_release WHERE id=1')).rows[0];
  const cohort=(await client.query('SELECT count(*)::integer n FROM cc_recipients WHERE eligible AND claim_eligible AND NOT synthetic')).rows[0].n;
  const codes=(await client.query('SELECT link,value_type,recipient_id,withheld FROM cc_credit_codes WHERE NOT synthetic')).rows;
  const remaining=(await client.query('SELECT count(*)::integer n FROM cc_recipients r WHERE eligible AND claim_eligible AND NOT synthetic AND NOT EXISTS(SELECT 1 FROM cc_credit_codes c WHERE c.recipient_id=r.id)')).rows[0].n;
  const checks={rosterReviewed:r.roster_reviewed,inventoryReviewed:r.inventory_reviewed,priorAssignmentsReviewed:r.prior_assignments_reviewed,versionMatches:r.reviewed_version===r.version,reviewNote:!!r.review_note.trim(),positiveCounts:r.expected_recipients>0&&r.expected_inventory>0,rosterCount:r.expected_recipients===cohort,inventoryCount:r.expected_inventory===codes.length,coverage:codes.filter(c=>!c.recipient_id&&!c.withheld).length>=remaining,exactValuesValid:codes.every(c=>creditValue(c.link,c.value_type,process.env)),claimsFlag:process.env.CREDIT_CLAIMS_ENABLED==='true',realReleaseFlag:process.env.REAL_CREDIT_DISTRIBUTION==='true'};
  await client.query('COMMIT');const ready=Object.values(checks).every(Boolean);console.log(JSON.stringify({ready,checks,counts:{cohort,inventory:codes.length,remaining},action:'read-only; no send, allocation or redemption'}));if(!ready)process.exitCode=1;
 }finally{await client.end();}
}catch{fail();}
