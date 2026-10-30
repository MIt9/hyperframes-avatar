import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('component generator creates matching IDs and preserves existing files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sprite-component-'));
  try {
    const script = fileURLToPath(new URL('../scripts/create-component.js', import.meta.url));
    const run = (id) => spawnSync(process.execPath, [script, id], { cwd: dir });
    const result = run('second-presenter');
    assert.equal(result.status, 0, result.stderr?.toString());
    const path = join(dir, 'compositions/second-presenter.html');
    const content = await readFile(path, 'utf8');
    assert.ok(content.includes('data-composition-id="second-presenter"'));
    assert.ok(content.includes("window.__timelines['second-presenter']"));
    assert.ok(result.stdout.toString().includes('data-composition-src="compositions/second-presenter.html"'));
    assert.equal(run('second-presenter').status, 1);
    assert.equal(await readFile(path, 'utf8'), content);
    for (const invalid of ['../escape', 'BadId', 'bad id', '']) assert.equal(run(invalid).status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
