import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { installSkills, uninstallSkills, inspectInstall } from '../lib/install.mjs';
import { createRun, renderReport } from '../skills/ssd-ai-tester/scripts/report.mjs';
import { saveEvidence, saveEvidenceBytes } from '../skills/ssd-ai-tester/scripts/evidence.mjs';
import { getCatalog } from '../skills/ssd-skill-list/scripts/catalog.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
// A genuine 1x1 PNG used only for automated file-format tests, never as UI test evidence.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lL8AAAAASUVORK5CYII=';
async function workspace(t) {
  const base = path.join(packageRoot, '.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'ssd-ai-tester-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function fixture(t) {
  const root = await workspace(t);
  await createRun(root, { title: 'ระบบ <script>alert(1)</script>', url: 'http://localhost:3010', environment: 'UAT' });
  const run = JSON.parse(await fs.readFile(path.join(root, 'results.json'), 'utf8'));
  run.finishedAt = new Date().toISOString();
  const evidence = await saveEvidence(root, { url: png }, 'TC-001.png', 'ผลหน้าจอทดสอบ');
  const item = { id: 'TC-001', title: 'ค้นหาคำขอ', requirement: 'AC-01', priority: 'high', preconditions: 'มีข้อมูล', steps: [{ action: 'ค้นหา', expected: 'พบรายการ' }], expected: 'พบรายการ', actual: 'พบรายการ', status: 'passed', evidence: [evidence] };
  run.cases = [item];
  return { root, run, item, write: () => fs.writeFile(path.join(root, 'results.json'), JSON.stringify(run)) };
}

test('global installer is idempotent and detects user edits without overwriting them', async t => {
  const root = await workspace(t);
  await installSkills(packageRoot, root);
  assert.equal((await inspectInstall(packageRoot, root)).ok, true);
  assert.match(await installSkills(packageRoot, root), /รุ่นเดียวกัน/);
  const target = path.join(root, 'ssd-ai-tester', 'SKILL.md');
  await fs.appendFile(target, '\nuser edit');
  await assert.rejects(installSkills(packageRoot, root), /แก้ไขเอง/);
  assert.match(await fs.readFile(target, 'utf8'), /user edit/);
  await assert.rejects(uninstallSkills(root), /แก้ไข/);
  await installSkills(packageRoot, root, true);
  assert.equal((await inspectInstall(packageRoot, root)).ok, true);
  const backup = (await fs.readdir(root)).find(name => name.startsWith('.ssd-ai-tester-backup-'));
  assert.match(await fs.readFile(path.join(root, backup, 'SKILL.md'), 'utf8'), /user edit/);
});
test('installer refuses unrelated skills even with force and uninstall preserves a backup', async t => {
  const root = await workspace(t);
  await fs.mkdir(path.join(root, 'ssd-ai-tester'));
  await fs.writeFile(path.join(root, 'ssd-ai-tester', 'SKILL.md'), 'unrelated');
  await assert.rejects(installSkills(packageRoot, root, true), /ไม่ได้ติดตั้ง/);
  const managed = path.join(root, 'managed');
  await installSkills(packageRoot, managed);
  await uninstallSkills(managed);
  assert.equal((await inspectInstall(packageRoot, managed)).ok, false);
  const backup = (await fs.readdir(managed)).find(name => name.startsWith('.ssd-ai-tester-removed-'));
  assert.ok(await fs.readFile(path.join(managed, backup, 'SKILL.md')));
});
test('init refuses to overwrite existing evidence', async t => {
  const root = await workspace(t);
  await fs.writeFile(path.join(root, 'keep.txt'), 'keep');
  await assert.rejects(createRun(root, { title: 'test', url: 'http://localhost', environment: 'UAT' }), /ต้องว่าง/);
  assert.equal(await fs.readFile(path.join(root, 'keep.txt'), 'utf8'), 'keep');
});
test('reports embed evidence, escape HTML, and calculate pass rate independently of coverage', async t => {
  const f = await fixture(t);
  f.run.cases.push({ ...f.item, id: 'TC-002', status: 'failed', actual: 'ไม่พบ', defect: { severity: 'high', impact: 'ทำงานต่อไม่ได้', nextAction: 'แก้และทดสอบซ้ำ' } });
  f.run.cases.push({ ...f.item, id: 'TC-003', status: 'blocked', actual: '', reason: 'ไม่มีสิทธิ์', evidence: [] });
  f.run.cases.push({ ...f.item, id: 'TC-004', status: 'not-run', actual: '', reason: 'ยังไม่เริ่ม', evidence: [] });
  await f.write();
  await renderReport(f.root);
  const report = JSON.parse(await fs.readFile(path.join(f.root, 'report.json'), 'utf8'));
  assert.equal(report.metrics.passPercent, 50);
  assert.equal(report.metrics.executionPercent, 50);
  assert.equal(report.metrics.counts.blocked, 1);
  const html = await fs.readFile(path.join(f.root, 'report.html'), 'utf8');
  assert.ok(html.includes(png));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.match(html, /ทำงานต่อไม่ได้/);
  assert.match(await fs.readFile(path.join(f.root, 'report.md'), 'utf8'), /screenshots\/TC-001.png/);
});
test('reports retain incomplete rounds without claiming a pass', async t => {
  const f = await fixture(t);
  f.run.finishedAt = null;
  f.item.status = 'blocked'; f.item.reason = 'ไม่มี Computer Use'; f.item.evidence = [];
  await f.write(); await renderReport(f.root);
  const report = JSON.parse(await fs.readFile(path.join(f.root, 'report.json'), 'utf8'));
  assert.equal(report.metrics.passPercent, null);
  assert.equal(report.metrics.executionPercent, 0);
  assert.match(await fs.readFile(path.join(f.root, 'report.html'), 'utf8'), /ระหว่างดำเนินการ/);
  assert.match(report.recommendation, /ยังไม่ครอบคลุม/);
});
test('report rejects unsupported claims without evidence, missing evidence, or failure impact', async t => {
  const f = await fixture(t);
  f.item.evidence = []; await f.write();
  await assert.rejects(renderReport(f.root), /ภาพหลักฐาน/);
  f.item.evidence = [{ path: 'screenshots/missing.png', caption: 'ภาพ', capturedAt: new Date().toISOString() }]; await f.write();
  await assert.rejects(renderReport(f.root), /ENOENT/);
  f.item.status = 'failed'; await f.write();
  await assert.rejects(renderReport(f.root), /ระดับผลกระทบ/);
});
test('report rejects invalid status, duplicate IDs, empty blocked reason, and timestamp errors', async t => {
  const f = await fixture(t);
  f.item.status = 'pass'; await f.write(); await assert.rejects(renderReport(f.root), /สถานะ/);
  f.item.status = 'passed'; f.run.cases.push({ ...f.item }); await f.write(); await assert.rejects(renderReport(f.root), /รหัสกรณีซ้ำ/);
  f.run.cases.pop(); f.item.status = 'blocked'; await f.write(); await assert.rejects(renderReport(f.root), /reason/);
  f.item.reason = 'ไม่มีสิทธิ์'; f.run.finishedAt = '2001-01-01T00:00:00Z'; await f.write(); await assert.rejects(renderReport(f.root), /เวลาก่อน|ไม่ก่อน/);
});
test('report rejects traversal and non-image payloads', async t => {
  const f = await fixture(t);
  f.item.evidence[0].path = 'screenshots/../../outside.png'; await f.write();
  await assert.rejects(renderReport(f.root), /นอกโฟลเดอร์/);
  f.item.evidence[0].path = 'screenshots/bad.png';
  await fs.writeFile(path.join(f.root, 'screenshots', 'bad.png'), '<script>bad</script>'); await f.write();
  await assert.rejects(renderReport(f.root), /PNG\/JPEG/);
});
test('evidence saver refuses overwrite, traversal, and mismatched extension', async t => {
  const root = await workspace(t);
  await saveEvidence(root, { url: png }, 'first.png', 'ผลที่เห็น');
  await assert.rejects(saveEvidence(root, { url: png }, 'first.png', 'ซ้ำ'), /EEXIST/);
  await assert.rejects(saveEvidence(root, { url: png }, '../escape.png', 'ภาพ'), /ชื่อภาพ/);
  await assert.rejects(saveEvidence(root, { url: png }, 'photo.jpg', 'ภาพ'), /นามสกุล/);
});

test('catalog lists only suite skills and reports missing files separately from availability', async t => {
  const root = await workspace(t);
  const bundled = await getCatalog(path.join(packageRoot, 'skills'));
  assert.equal(bundled.length, 3);
  assert.ok(bundled.every(entry => entry.available && entry.example.includes('$' + entry.name)));
  const missing = await getCatalog(root);
  assert.ok(missing.every(entry => !entry.available));
  await installSkills(packageRoot, root);
  await fs.mkdir(path.join(root, 'unrelated-skill'));
  await fs.writeFile(path.join(root, 'unrelated-skill', 'SKILL.md'), 'unrelated');
  const installed = await getCatalog(root);
  assert.deepEqual(installed.map(entry => entry.name), bundled.map(entry => entry.name));
  assert.ok(installed.every(entry => entry.available));
  const output = execFileSync(process.execPath, [path.join(packageRoot, 'bin', 'cli.mjs'), 'list', '--skills-dir', root], { encoding: 'utf8' });
  for (const entry of installed) assert.ok(output.includes('$' + entry.name));
});

test('install repairs a partial suite and installed catalog works independently of npm CLI', async t => {
  const root = await workspace(t);
  await installSkills(packageRoot, root);
  await fs.rm(path.join(root, 'ssd-get-started'), { recursive: true });
  await fs.rm(path.join(root, 'ssd-skill-list'), { recursive: true });
  assert.equal((await inspectInstall(packageRoot, root)).ok, false);
  await installSkills(packageRoot, root);
  assert.equal((await inspectInstall(packageRoot, root)).ok, true);
  const output = execFileSync(process.execPath, [path.join(root, 'ssd-skill-list', 'scripts', 'catalog.mjs')], { encoding: 'utf8' });
  assert.ok(output.includes('3/3'));
  assert.ok(output.includes('$ssd-get-started'));
});

test('suite preflight prevents partial installation or removal on a conflicting skill', async t => {
  const root = await workspace(t);
  await fs.mkdir(path.join(root, 'ssd-ai-tester'));
  await fs.writeFile(path.join(root, 'ssd-ai-tester', 'SKILL.md'), 'unrelated');
  await assert.rejects(installSkills(packageRoot, root), /ไม่ได้ติดตั้ง/);
  assert.deepEqual(await fs.readdir(root), ['ssd-ai-tester']);
  const managed = path.join(root, 'managed');
  await installSkills(packageRoot, managed);
  await fs.appendFile(path.join(managed, 'ssd-ai-tester', 'SKILL.md'), '\nuser edit');
  await assert.rejects(uninstallSkills(managed), /แก้ไข/);
  assert.equal((await getCatalog(managed)).filter(entry => entry.available).length, 3);
});

test('Browser Use screenshot bytes are preserved and report embeds the exact image', async t => {
  const f = await fixture(t);
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  f.item.evidence = [await saveEvidenceBytes(f.root, new Uint8Array(bytes), 'browser-tab.png', 'ภาพผลในแท็บทดสอบ')];
  assert.deepEqual(await fs.readFile(path.join(f.root, 'screenshots', 'browser-tab.png')), bytes);
  f.run.execution = { engine: 'browser-use', isolation: 'browser-tab' };
  await f.write(); await renderReport(f.root);
  const html = await fs.readFile(path.join(f.root, 'report.html'), 'utf8');
  assert.ok(html.includes(png));
  assert.ok(html.includes('Browser Use'));
  assert.ok(html.includes('แท็บทดสอบแยก'));
  await assert.rejects(saveEvidenceBytes(f.root, new Uint8Array([1, 2, 3]), 'invalid.png', 'ภาพ'), /PNG\/JPEG/);
});

test('report distinguishes desktop from browser execution and accepts old reports without guessing', async t => {
  const f = await fixture(t);
  assert.deepEqual(f.run.execution, { engine: 'unselected', isolation: 'unverified' });
  f.run.execution = { engine: 'desktop-computer-use', isolation: 'shared-desktop' };
  await f.write(); await renderReport(f.root);
  assert.match(await fs.readFile(path.join(f.root, 'report.html'), 'utf8'), /ใช้งานเมาส์\/คีย์บอร์ดพร้อมกันไม่ได้/);
  f.run.execution.isolation = 'browser-tab'; await f.write();
  await assert.rejects(renderReport(f.root), /execution/);
  delete f.run.execution; await f.write(); await renderReport(f.root);
  assert.match(await fs.readFile(path.join(f.root, 'report.md'), 'utf8'), /ไม่ได้บันทึกวิธีและพื้นที่ทดสอบ/);
});

test('ZIP installer verifies the full suite, supports paths with spaces, and saves a success log', async t => {
  const root = await workspace(t);
  const installed = path.join(root, 'skills with spaces');
  const logs = path.join(root, 'installation logs');
  const output = execFileSync(process.execPath, [path.join(packageRoot, 'bin', 'install.mjs'), '--skills-only', '--skills-dir', installed, '--log-dir', logs], { encoding: 'utf8' });
  assert.match(output, /SUCCESS/);
  assert.equal((await inspectInstall(packageRoot, installed)).ok, true);
  const files = await fs.readdir(logs);
  assert.equal(files.length, 1);
  const log = await fs.readFile(path.join(logs, files[0]), 'utf8');
  assert.match(log, /SUCCESS/);
  for (const entry of await getCatalog(installed)) assert.ok(log.includes(entry.name));
});

test('ZIP installer returns failure and preserves the original diagnostic in its log', async t => {
  const root = await workspace(t);
  const installed = path.join(root, 'skills');
  const logs = path.join(root, 'logs');
  await fs.mkdir(path.join(installed, 'ssd-ai-tester'), { recursive: true });
  await fs.writeFile(path.join(installed, 'ssd-ai-tester', 'SKILL.md'), 'user-owned skill');
  assert.throws(() => execFileSync(process.execPath, [path.join(packageRoot, 'bin', 'install.mjs'), '--skills-only', '--skills-dir', installed, '--log-dir', logs], { encoding: 'utf8' }), error => {
    assert.equal(error.status, 1);
    assert.match(error.stdout, /FAILED/);
    assert.ok(!error.stdout.includes('SUCCESS:'));
    return true;
  });
  const [name] = await fs.readdir(logs);
  assert.match(await fs.readFile(path.join(logs, name), 'utf8'), /ไม่ได้ติดตั้งด้วยเครื่องมือนี้/);
  assert.equal(await fs.readFile(path.join(installed, 'ssd-ai-tester', 'SKILL.md'), 'utf8'), 'user-owned skill');
});
