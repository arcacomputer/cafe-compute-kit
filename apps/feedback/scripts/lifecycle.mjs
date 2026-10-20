import {getConfig} from '../config.js';
export function ownerAccess(input,env){
 if(!input||typeof input.email!=='string'||!getConfig(env).owners.includes(input.email)||input.email!==input.email.trim().toLowerCase()||typeof input.name!=='string'||input.name.length>100||typeof input.note!=='string'||!input.note.trim()||input.note.length>2000)throw Error('Documented configured owner required');
 return {email:input.email,name:input.name,eligible:true,claim_eligible:false,synthetic:false,checked_in_at:null,eligibility_basis:'owner-access',provenance:{note:input.note}};
}
// Erasure removes all raw text/manifest data but keeps the ownership spine.
// cc_feedback_uploads key tombstones are intentionally retained separately so
// repeat cleanup can find late/ambiguous object puts; never reopen those slots.
export function erasedPayload(payload){if(typeof payload.recipientId!=='string')throw Error('Missing ownership spine');return {recipientId:payload.recipientId,deleted:true,privacyVersion:'1'};}
export function cleanupDate(value){const d=new Date(value);if(!value||!Number.isFinite(d.getTime())||d.getTime()>=Date.now())throw Error('Explicit past cutoff required');return d.toISOString();}
