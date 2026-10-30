#!/usr/bin/env node
import { access, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';

const source = fileURLToPath(new URL('../skills/hyperframes-avatar/', import.meta.url));
const destination = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'skills/hyperframes-avatar');
let exists = false;
try { await access(destination); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (exists) throw new Error(`Skill already exists; refusing to overwrite: ${destination}`);
await cp(source, destination, { recursive: true, errorOnExist: true, force: false,
  filter: (path) => !path.includes('__pycache__') && !path.endsWith('.pyc') });
console.log(`Installed ${destination}`);
