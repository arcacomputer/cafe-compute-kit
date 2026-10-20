const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
// Canonical receipt + immutable slot/digest, never a mutable manifest index.
export function parsePhotoKey(expectedReceipt,key){
 if(!uuid.test(expectedReceipt)||typeof key!=='string')return null;
 const prefix=`feedback/${expectedReceipt}/photo-`;
 if(!key.startsWith(prefix))return null;
 const match=key.slice(prefix.length).match(/^([0-9]|1[0-9])-([a-f0-9]{64})\.(jpg|png|webp)$/);
 if(!match)return null;
 const [,slot,digest,extension]=match;
 return {slot:Number(slot),digest,extension,type:types[extension],path:`/feedback/admin/photo/${expectedReceipt}/${slot}-${digest}.${extension}`};
}
