import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('guided form submits through the live next button after the original send control is removed',async()=>{
 const listeners={},requests=[],fields={disabled:true},next={disabled:false},status={dataset:{loading:'loading',unavailable:'offline',saved:'saved'},focus(){}},retry={hidden:true,addEventListener(){}};
 const values={feedback:'Critical',improvements:'N/A',sponsorQuestion:'',topics:'',csrf:'synthetic',photoConsent:null};
 const form={dataset:{auth:'true'},photoPicker:{getFiles:()=>[]},addEventListener:(name,fn)=>listeners[name]=fn};
 const nodes={'#feedback-form':form,'#fields':fields,'#status':status,'#retry':retry,'#next':next,'#photos':{files:[]}};let now=10000,redirect;
 class Data extends FormData{constructor(){super();for(const [k,v]of Object.entries(values))if(v!==null)this.set(k,v);}}
 const script=await readFile(new URL('./public/feedback/form.js',import.meta.url),'utf8');
 vm.runInNewContext(script,{document:{querySelector:k=>nodes[k]||null,documentElement:{lang:'en'}},FormData:Data,Date:{now:()=>now},AbortSignal,location:{assign:path=>redirect=path},fetch:async path=>{requests.push(path);return {ok:true,json:async()=>path.endsWith('challenge')?{token:'synthetic-token'}:{id:'synthetic-receipt',saved:true}};},setTimeout});
 await new Promise(r=>setImmediate(r));assert.equal(fields.disabled,false);now+=3000;
 await listeners['feedback-submit']({preventDefault(){}});assert.equal(requests.filter(x=>x==='/api/feedback').length,1);assert.equal(redirect,'/en/feedback/credit');
});
