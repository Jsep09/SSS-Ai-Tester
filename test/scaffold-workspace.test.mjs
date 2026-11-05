import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { scaffoldWorkspace } from '../skills/ssd-ai-tester/scripts/scaffold-workspace.mjs';

test('BA/QA starter creates only the requested structure, survives rename and never overwrites work', async () => {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const temp = await fs.mkdtemp(path.join(base, 'scaffold-'));
  try {
    const root = path.join(temp, 'พื้นที่ QA มีช่องว่าง');
    const system = await scaffoldWorkspace(root);
    assert.equal(path.basename(system), 'Telesale');
    assert.deepEqual((await fs.readdir(system)).sort(), ['.system', 'codebase', 'input', 'results', 'run', 'scripts', 'อ่านก่อน.txt'].sort());
    for (const folder of ['.system', 'codebase', 'input', 'results', 'run', 'scripts']) {
      assert.deepEqual(await fs.readdir(path.join(system, folder)), []);
    }
    const before = await fs.readFile(path.join(system, 'อ่านก่อน.txt'), 'utf8');
    assert.ok(!before.includes(temp));
    assert.match(before, /ยังไม่มีสคริปต์หรือผลทดสอบ/);
    await fs.writeFile(path.join(system, 'input', 'requirement.txt'), 'keep user work');
    await assert.rejects(scaffoldWorkspace(root), { code: 'EEXIST' });
    assert.equal(await fs.readFile(path.join(system, 'input', 'requirement.txt'), 'utf8'), 'keep user work');
    const moved = path.join(temp, 'ระบบ ใหม่');
    await fs.rename(system, moved);
    assert.equal(await fs.readFile(path.join(moved, 'อ่านก่อน.txt'), 'utf8'), before);
    for (const name of ['../escape', 'a/b', 'a\\b', 'CON', 'NUL.txt', 'bad.', 'bad ', '..', '']) {
      await assert.rejects(scaffoldWorkspace(root, { system: name }), /ชื่อระบบ/);
    }
    await assert.rejects(scaffoldWorkspace(root, { url: 'https://user:secret@example.test' }), /credential/);
    const named = await scaffoldWorkspace(root, { system: 'ระบบ ขาย', url: 'https://example.test', environment: 'UAT' });
    assert.match(await fs.readFile(path.join(named, 'อ่านก่อน.txt'), 'utf8'), /สภาพแวดล้อม: UAT/);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
