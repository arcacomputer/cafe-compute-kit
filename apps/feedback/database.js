import { neon } from '@neondatabase/serverless';
// Non-HTTP dependency seam for isolated proof servers. Never derived from request
// parameters, cookies, headers or assets. Production Wrangler has no such binding.
export function databaseFor(env, admin = false) {
 const binding=admin?env.TEST_ADMIN_DATABASE:env.TEST_DATABASE;
 if(!binding)return neon(admin?env.FEEDBACK_ADMIN_DATABASE_URL:env.DATABASE_URL);
 const sql=(parts,...values)=>{
  const text=parts.reduce((q,s,i)=>q+(i?'$'+i:'')+s,'');
  const statement={text,values};let pending;
  return {...statement,then(resolve,reject){pending??=binding.query(text,values);return pending.then(resolve,reject);}};
 };
 sql.query=(q,p)=>binding.query(q,p);
 sql.transaction=statements=>binding.transaction(statements.map(({text,values})=>({text,values})));
 return sql;
}
