import { cp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../skills/hyperframes-avatar/', import.meta.url));
const target = join(process.env.CODEX_HOME ?? join(homedir(),'.codex'),'skills/hyperframes-avatar');
await cp(source,target,{recursive:true,force:true,filter:path=>!path.includes('__pycache__')&&!path.endsWith('.pyc')});
console.log(`Updated ${target}`);
