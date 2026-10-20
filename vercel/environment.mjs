const common=['PUBLIC_ORIGIN','EVENT_NAME','PROVIDER_NAME','BENEFIT_DESCRIPTION'];
const main=[...common,'OWNER_EMAILS','AUTH_ENABLED','AUTH_SECRET','DATABASE_URL','FEEDBACK_ADMIN_DATABASE_URL','FEEDBACK_ENABLED','FEEDBACK_SIGNING_KEY','MAGIC_EMAIL_ENABLED','SENDER_ORIGIN','MAILER_SERVICE_TOKEN','CREDIT_CLAIMS_ENABLED','REAL_CREDIT_DISTRIBUTION','CREDIT_LINK_ORIGINS','PHOTOS_ENABLED','PRIVATE_PHOTO_METADATA_ACK'];
const project=(source,keys)=>Object.fromEntries(keys.filter(key=>typeof source[key]==='string').map(key=>[key,source[key]]));
export const projectMainEnv=source=>project(source,main);
export const projectSenderEnv=source=>project(source,[...common,'SENDER_ORIGIN','MAILER_SERVICE_TOKEN','DATABASE_URL','MAIL_SEND_ENABLED','AGENTMAIL_SEND_KEY','APPROVED_INBOX','REPLY_TO']);
export function httpsOrigin(value) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.href!==url.origin+'/')throw Error('Canonical HTTPS origin required');
 return url.origin;
}
export const validServiceToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
