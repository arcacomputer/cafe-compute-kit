import {writeFile} from 'node:fs/promises';
import {args,privateInput,enforcePrivatePath,operatorClient,transact,fail} from './operator.mjs';
import {cleanupDate,erasedPayload} from './lifecycle.mjs';
try{
 const a=args(['--before','--manifest','--apply','--objects-deleted']),before=cleanupDate(a['--before']);
 if(a['--apply']&&(!a['--manifest']||a['--objects-deleted']!=='yes'))throw Error('Manual object deletion acknowledgement required');
 if(a['--manifest'])enforcePrivatePath(a['--manifest']);
 const prior=a['--apply']?JSON.parse(await privateInput(a['--manifest'])):null;
 const client=await operatorClient();try{
  const summary=await transact(client,async c=>{
   if(a['--apply'])await c.query('LOCK TABLE event_feedback,cc_feedback_uploads IN SHARE ROW EXCLUSIVE MODE');
   // Retain key-only reservations after erasure: a put may finish after manual
   // deletion, or its result may be ambiguous. Both ready and pending keys must
   // remain discoverable on every later reconciliation, including erased rows.
   const rows=(await c.query("SELECT f.id,f.payload,coalesce((SELECT jsonb_agg(k ORDER BY k) FROM (SELECT object_key AS k FROM cc_feedback_uploads u WHERE u.submission_id=f.id UNION SELECT p->>'key' AS k FROM jsonb_array_elements(f.photos) p) owned_keys WHERE k IS NOT NULL),'[]'::jsonb) AS keys FROM event_feedback f WHERE created_at<$1 AND (NOT (payload @> '{\"deleted\":true}') OR EXISTS (SELECT 1 FROM cc_feedback_uploads u WHERE u.submission_id=f.id) OR photos<>'[]'::jsonb) ORDER BY f.id",[before])).rows;
   const manifest={classification:'PRIVATE deletion manifest; not a public export',before,rows:rows.map(r=>({id:r.id,keys:r.keys}))};
   if(a['--apply']){
    if(JSON.stringify(prior)!==JSON.stringify(manifest))throw Error('Manifest drift; renew dry-run and manual deletion');
    for(const r of rows)await c.query("UPDATE event_feedback SET payload=$2,photos='[]'::jsonb WHERE id=$1",[r.id,erasedPayload(r.payload)]);
    await c.query('DELETE FROM cc_mail_attempts WHERE token_hash IN (SELECT hash FROM cc_magic_tokens WHERE expires_at<now())');
    await c.query('DELETE FROM cc_magic_tokens WHERE expires_at<now()');await c.query('DELETE FROM cc_sessions WHERE expires_at<now()');await c.query('DELETE FROM cc_auth_rate WHERE expires_at<now()');
   }else if(a['--manifest'])await writeFile(a['--manifest'],JSON.stringify(manifest),{mode:0o600,flag:'wx'});
   return {responses:rows.length,objects:rows.reduce((n,r)=>n+r.keys.length,0)};
  });
  if(a['--apply']){const count=(await client.query("SELECT count(*)::int n FROM event_feedback WHERE created_at<$1 AND NOT (payload @> '{\"deleted\":true}')",[before])).rows[0].n;if(count)throw Error('Readback drift');}
  console.log(JSON.stringify({mode:a['--apply']?'apply':'dry-run',...summary,assignments:'preserved',recipients:'preserved',policy:'manual only; pause and drain photo uploads before planning/deleting objects; retain photo-key tombstones for repeat orphan reconciliation'}));
 }finally{await client.end();}
}catch{fail();}
