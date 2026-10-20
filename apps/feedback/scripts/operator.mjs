import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname,join,basename} from 'node:path';
import {realpathSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const appRoot=fileURLToPath(new URL('../',import.meta.url));
const possibleMonorepo=fileURLToPath(new URL('../../../',import.meta.url));
const repositoryRoot=existsSync(join(possibleMonorepo,'apps','feedback'))?possibleMonorepo:appRoot;
function physicalPath(path){let current=resolve(path),tail=[];while(!existsSync(current)){const parent=dirname(current);if(parent===current)throw Error('Unresolvable private path');tail.unshift(basename(current));current=parent;}return resolve(realpathSync(current),...tail);}
export function args(allowed){const out={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(!allowed.includes(k)||out[k]!==undefined)throw Error('Unknown or duplicate option');out[k]=k==='--apply'||k==='--allow-held'?true:process.argv[++i];if(out[k]===undefined)throw Error('Missing option value');}return out;}
export async function privateInput(path){if(!path)throw Error('Explicit --file path is required');return readFile(resolve(path),'utf8');}
export function enforcePrivatePath(path){const rel=relative(realpathSync(repositoryRoot),physicalPath(path));if(rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(rel))throw Error('Private input/output must live outside the repository');}
export async function operatorClient(){if(!process.env.OPERATOR_DATABASE_URL)throw Error('OPERATOR_DATABASE_URL is required for apply/database checks');const {Client}=await import('pg');const client=new Client({connectionString:process.env.OPERATOR_DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:15000,idle_in_transaction_session_timeout:30000});await client.connect();return client;}
export async function transact(client,fn){await client.query('BEGIN');try{const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}}
export function fail(){console.error('Operation refused. Check input format, reviewed conflicts and private database configuration; no source values are logged.');process.exitCode=1;}
