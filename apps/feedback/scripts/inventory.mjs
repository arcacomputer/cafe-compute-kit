import {parseCSV} from './csv.mjs';
import {creditValue} from '../config.js';
export function planInventory(source,env){
 const parsed=parseCSV(source);for(const key of ['type','value','status','recipient_email'])if(!parsed.headers.includes(key))throw Error('Missing inventory headers');
 const seen=new Set(),recipients=new Set(),rows=[],summary={total:parsed.rows.length,unassigned:0,assigned:0,withheld:0};
 for(const [i,x] of parsed.rows.entries()){
  if(!creditValue(x.value,x.type,env,false)||seen.has(x.value)||!['unassigned','assigned','withheld'].includes(x.status))throw Error('Invalid or duplicate exact inventory value');
  seen.add(x.value);
  if(x.status==='assigned'){
   if(x.recipient_email!==x.recipient_email.trim().toLowerCase()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.recipient_email)||recipients.has(x.recipient_email))throw Error('Invalid or duplicate assigned recipient');recipients.add(x.recipient_email);
  }else if(x.recipient_email)throw Error('Only assigned stock may name a recipient');
  summary[x.status]++;rows.push({value:x.value,type:x.type,status:x.status,recipientEmail:x.recipient_email||null,sourceIndex:i+1});
 }
 return {rows,summary};
}
