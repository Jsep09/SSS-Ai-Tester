import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createWorkspace, findWorkspace, readWorkspace, bindWorkspace, runWorkspace } from '../skills/ssd-ai-tester/scripts/workspace.mjs';

async function temporary(t) {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'workspace-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
const options = { title: 'ระบบทดสอบ', url: 'http://127.0.0.1:45000', environment: 'DEMO' };
test('workspaces support arbitrary locations, nearest ancestor discovery and rebinding without touching tests', async t => {
  const parent = await temporary(t);
  const root = path.join(parent, 'ทีม QA', 'งาน รอบใหม่');
  await createWorkspace(root, options);
  await fs.mkdir(path.join(root, 'tests', 'search'));
  assert.equal(await findWorkspace(path.join(root, 'tests', 'search')), root);
  await fs.writeFile(path.join(root, 'tests', 'search.spec.mjs'), '// keep');
  await bindWorkspace(root);
  assert.equal(await fs.readFile(path.join(root, 'tests', 'search.spec.mjs'), 'utf8'), '// keep');
  assert.match(await fs.readFile(path.join(root, 'fixtures.mjs'), 'utf8'), /playwright-fixtures/);
  await assert.rejects(createWorkspace(root, options), /มีไฟล์/);
});
test('workspace rejects traversal, overlapping test/output directories and credential URLs', async t => {
  const root = await temporary(t);
  await createWorkspace(root, options);
  const file = path.join(root, 'ssd-workspace.json');
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  config.testsDir = '../outside'; await fs.writeFile(file, JSON.stringify(config));
  await assert.rejects(readWorkspace(root), /path ย่อย/);
  config.testsDir = 'tests'; config.runsDir = 'tests/runs'; await fs.writeFile(file, JSON.stringify(config));
  await assert.rejects(readWorkspace(root), /ไม่ซ้อนกัน/);
  const another = path.join(root, 'another');
  await assert.rejects(createWorkspace(another, { ...options, url: 'http://user:password@example.test' }), /credential/);
});
test('runner refuses an active workspace lock instead of starting another test run', async t => {
  const root = await temporary(t);
  await createWorkspace(root, options);
  const lock = path.join(root, '.ssd', 'run.lock');
  await fs.writeFile(lock, 'existing process');
  await assert.rejects(runWorkspace(root), /ห้ามรันซ้อน/);
  assert.equal(await fs.readFile(lock, 'utf8'), 'existing process');
  assert.deepEqual(await fs.readdir(path.join(root, 'runs')), []);
});
