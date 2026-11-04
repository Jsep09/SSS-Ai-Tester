// Integration verification uses local in-memory HTML, no external application or user session.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createWorkspace, runWorkspace } from '../skills/ssd-ai-tester/scripts/workspace.mjs';

const root = path.resolve('.test-tmp', 'playwright-integration-' + Date.now());
await createWorkspace(root, { title: 'สาธิตทดสอบฟอร์มในเครื่อง', url: 'http://127.0.0.1', environment: 'DEMO / integration verification' });
const configPath = path.join(root, 'ssd-workspace.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
config.mode = 'demo';
await fs.writeFile(configPath, JSON.stringify(config));
await fs.writeFile(path.join(root, 'tests', 'form.spec.mjs'), `
import { test, expect } from '../fixtures.mjs';
const details = {
  requirement: 'AC-01 กดค้นหาแล้วแสดงผลตามเกณฑ์', preconditions: 'ใช้ข้อมูลจำลองในเครื่อง', priority: 'high',
  steps: [{ action: 'กรอก TEST-001 แล้วกดค้นหา', expected: 'แสดงเลข TEST-001' }], expected: 'แสดงคำขอตรงเลขที่',
  defect: { severity: 'high', impact: 'ผู้ใช้พบผลค้นหาไม่ตรงตามเงื่อนไข', nextAction: 'QA ตรวจค่าที่คาดหวังและภาพผล ก่อนส่งให้ทีมแก้ไข' }
};
test('ค้นหาแล้วพบเลขคำขอที่ตรงกัน', async ({ page, business }) => {
  business(details);
  await page.setContent('<label>เลขคำขอ<input /></label><button>ค้นหา</button><output></output>');
  await page.locator('button').evaluate(button => button.addEventListener('click', () => { document.querySelector('output').textContent = document.querySelector('input').value; }));
  await page.getByRole('textbox', { name: 'เลขคำขอ' }).fill('TEST-001');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.locator('output')).toHaveText('TEST-001');
});
test('ตัวอย่าง assertion ไม่ผ่านที่ตั้งใจใช้ตรวจรายงาน', async ({ page, business }) => {
  business(details);
  await page.setContent('<h1>ผลค้นหาไม่ตรงเกณฑ์ (ข้อมูลสาธิต)</h1>');
  await expect(page.getByRole('heading')).toHaveText('ข้อความที่ควรพบ', { timeout: 300 });
});
test('ไม่มีข้อมูลธุรกิจต้องไม่เดาว่าผ่านสำหรับ BA', async ({ page }) => {
  await page.setContent('<h1>หน้าสาธิต</h1>');
  await expect(page.getByRole('heading')).toBeVisible();
});
`);
const result = await runWorkspace(root);
assert.equal(result.code, 1, 'The intentionally failing assertion must produce failure exit code');
const report = JSON.parse(await fs.readFile(path.join(result.runDirectory, 'report.json'), 'utf8'));
assert.deepEqual(report.metrics.counts, { passed: 1, failed: 1, blocked: 1, skipped: 0, 'not-run': 0 });
assert.ok(report.cases.every(item => item.evidence.length > 0));
assert.equal(report.execution.engine, 'playwright-test');
assert.ok((await fs.readFile(path.join(result.runDirectory, 'report.html'), 'utf8')).includes('data:image/png;base64,'));
const filtered = await runWorkspace(root, { grep: 'ค้นหาแล้วพบเลขคำขอที่ตรงกัน' });
assert.equal(filtered.code, 0);
assert.notEqual(filtered.runDirectory, result.runDirectory);
const filteredReport = JSON.parse(await fs.readFile(path.join(filtered.runDirectory, 'report.json'), 'utf8'));
assert.equal(filteredReport.metrics.total, 1);
assert.equal(filteredReport.metrics.counts.passed, 1);
console.log('INTEGRATION VERIFIED: pass/fail/blocked, screenshots, Thai report, filtering, separate run folders.\n' + result.runDirectory);
