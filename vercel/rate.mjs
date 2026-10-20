import {storeFor} from '../apps/feedback/auth.js';

// Same cc_runtime privilege and atomic INSERT/ON CONFLICT as auth quotas.
// The shared handler supplies an HMAC of recipient/IP/15-minute bucket. Add the
// original transport's one-minute window without storing an address or identity.
export function createFeedbackRate(env,{now=Date.now}={}) {
 const store=storeFor(env);
 return {async limit({key}) {
  if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid rate key');
  return {success:await store.rate(`vercel-feedback:${Math.floor(now()/60000)}:${key}`,100)};
 }};
}
