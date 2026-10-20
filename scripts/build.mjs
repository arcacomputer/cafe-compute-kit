import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export async function mergeOutputs(inputs, output) {
  const destination = path.resolve(output);
  const files = new Map();
  for (const input of inputs) {
    const source = path.resolve(input);
    if (destination === source || destination.startsWith(source + path.sep)) throw Error('Output must not overlap an input');
    async function collect(directory, prefix = '') {
      const entries = await readdir(directory, {withFileTypes:true});
      entries.sort((a,b) => a.name.localeCompare(b.name, 'en'));
      for (const entry of entries) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw Error(`Symlinks are not deployable assets: ${relative}`);
        if (entry.isDirectory()) { await collect(path.join(directory, entry.name), relative); continue; }
        if (!entry.isFile()) throw Error(`Unsupported asset: ${relative}`);
        if (/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|node_modules|\.git)(?:\/|$)/.test(relative)) throw Error(`Private asset rejected: ${relative}`);
        const bytes = await readFile(path.join(directory, entry.name));
        if (files.has(relative)) {
          if (relative !== '_headers') throw Error(`Asset collision: ${relative}`);
          files.set(relative, Buffer.concat([files.get(relative), Buffer.from('\n'), bytes]));
        } else files.set(relative, bytes);
      }
    }
    await collect(source);
  }
  await mkdir(destination, {recursive:true});
  for (const [name, bytes] of files) {
    const target = path.join(destination, ...name.split('/'));
    await mkdir(path.dirname(target), {recursive:true});
    await writeFile(target, bytes);
  }
  return [...files.keys()].sort();
}

export function parseBuildArgs(args){
  if(args.length===0)return [];
  if(args.length===2&&args[0]==='--config'&&args[1]&&!args[1].startsWith('-'))return ['--','--config',path.resolve(args[1])];
  throw Error('Usage: npm run build -- [--config path/to/public-event.json]');
}
async function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const publicOptions=parseBuildArgs(process.argv.slice(2));
  for (const workspace of ['@cafe-compute-kit/event-site', '@cafe-compute-kit/feedback']) {
    const options=workspace.endsWith('/event-site')?publicOptions:[];
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','build','--workspace',workspace,...options], {cwd:root,stdio:'inherit'});
    if (result.status !== 0) throw Error(`Workspace build failed: ${workspace}`);
  }
  const output = path.join(root, 'dist');
  await rm(output, {recursive:true,force:true});
  const files = await mergeOutputs([path.join(root,'apps/event-site/dist'),path.join(root,'apps/feedback/dist')],output);
  console.log(`Combined site: ${files.length} static assets. Personalized feedback remains Worker-rendered.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
