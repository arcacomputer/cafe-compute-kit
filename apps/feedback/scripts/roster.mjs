import {parseCSV} from './csv.mjs';
const approved=new Set(['approved','going']);
const known=new Set([...approved,'pending','waitlisted','declined','cancelled','canceled','invited','not_going']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function timestamp(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return null;
 const [y,m,d]=value.slice(0,10).split('-').map(Number);if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate())return null;
 return value;
}
export function planRoster(source,mapping,exceptions=[]){
 const parsed=parseCSV(source);
 for(const k of ['email','name','guestId','status','checkedInAt'])if(typeof mapping[k]!=='string'||!parsed.headers.includes(mapping[k]))throw Error('Explicit column mapping does not match CSV headers');
 const ex=new Map();for(const x of exceptions){if(!x.guestId||!x.reason?.trim()||!x.reviewedBy?.trim()||!x.reference?.trim()||ex.has(x.guestId))throw Error('Exception requires unique guest ID, reason, reviewer and reference');ex.set(x.guestId,x);}
 const raw=parsed.rows.map(row=>({email:row[mapping.email].trim().toLowerCase(),name:row[mapping.name],guestId:row[mapping.guestId].trim(),status:row[mapping.status].trim().toLowerCase(),check:row[mapping.checkedInAt].trim()}));
 const emails=new Map(),ids=new Map();for(const x of raw){emails.set(x.email,(emails.get(x.email)||0)+1);ids.set(x.guestId,(ids.get(x.guestId)||0)+1);}
 const summary={total:raw.length,accepted:0,held:0,notCheckedIn:0,excluded:0,statuses:{},reasons:{}};const rows=[];
 const hold=reason=>{summary.held++;summary.reasons[reason]=(summary.reasons[reason]||0)+1;};
 for(const x of raw){
  const statusBucket=known.has(x.status)?x.status:'unknown';summary.statuses[statusBucket]=(summary.statuses[statusBucket]||0)+1;
  if(!emailPattern.test(x.email)||x.email.length>254||!x.guestId||x.guestId.length>200||x.name.length>100){hold('invalid-profile');continue;}
  if(emails.get(x.email)>1||ids.get(x.guestId)>1){hold('ambiguous-duplicate');continue;}
  if(!known.has(x.status)){hold('unknown-status');continue;}
  if(!approved.has(x.status)){summary.excluded++;continue;}
  if(x.check&&!timestamp(x.check)){hold('invalid-check-in-timezone');continue;}
  const exception=ex.get(x.guestId);
  if(!x.check&&!exception){summary.notCheckedIn++;continue;}
  rows.push({guest_id:x.guestId,email:x.email,name:x.name,affiliation:'',role:'',eligible:true,claim_eligible:true,synthetic:false,eligibility_basis:x.check?'checked-in':'organizer-exception',checked_in_at:x.check||null,provenance:exception?{reason:exception.reason,reviewedBy:exception.reviewedBy,reference:exception.reference}:{source:'explicit-csv-check-in'}});summary.accepted++;
 }
 if([...ex.keys()].some(id=>!raw.some(x=>x.guestId===id)))throw Error('Exception references absent guest ID');
 return {rows,summary};
}
