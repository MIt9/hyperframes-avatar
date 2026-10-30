#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const [id, ...extra] = process.argv.slice(2);
  if (!id || extra.length || !/^[a-z][a-z0-9-]*$/.test(id)) {
    throw new Error('Usage: npm run component -- presenter-id (lowercase letters, digits, hyphens)');
  }
  const template = await readFile(new URL('../compositions/sprite-avatar.html', import.meta.url), 'utf8');
  const content = template
    .replace('data-composition-id="sprite-avatar"', `data-composition-id="${id}"`)
    .replace("window.__timelines['sprite-avatar']", `window.__timelines['${id}']`);
  const directory = resolve('compositions');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${id}.html`), content, { flag: 'wx' });
  console.log(`Created compositions/${id}.html\n\n<div id="${id}" class="clip"\n  data-composition-id="${id}" data-composition-src="compositions/${id}.html"\n  data-start="0" data-duration="18" data-track-index="1" data-track-kind="graphics"\n  data-width="1920" data-height="1080"\n  data-variable-values='{"scale":4,"position":"bottom-left"}'></div>`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
