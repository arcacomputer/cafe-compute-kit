import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('./public/feedback/auth-client.js',import.meta.url),'utf8');
for(const lang of ['en','es'])for(const type of ['code','link'])test(`benefit receipt uses accurate generic copy for ${type} in ${lang}`,async()=>{
 const handlers={},children=[],status={dataset:{},focus(){}};
 const button={id:'claim',disabled:false,innerHTML:'Reveal',dataset:{csrf:'synthetic'},setAttribute(){},removeAttribute(){},addEventListener:(name,fn)=>handlers[name]=fn};
 const nodes={'#auth-status':status,'#claim':button,'#credit-link':{replaceChildren:(...x)=>children.push(...x)}};
 const value=type==='code'?'SYNTHETIC_CODE':'https://credits.example.invalid/synthetic';
 vm.runInNewContext(script,{location:{hash:'',pathname:'/feedback/credit',search:''},addEventListener(){},document:{documentElement:{lang},querySelector:key=>nodes[key]||null,querySelectorAll:()=>[],createElement:tag=>({tag})},fetch:async()=>({ok:true,json:async()=>({type,value})})});
 handlers.click({currentTarget:button});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(status.dataset.state,'success');assert.match(status.textContent,lang==='en'?/benefit is ready/:/beneficio está listo/);
 assert.equal(children[0].tag,type==='code'?'code':'a');if(type==='code')assert.equal(children[0].textContent,value);else assert.equal(children[0].href,value);
});
