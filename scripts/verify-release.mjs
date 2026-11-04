import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { runProcess } from '../skills/ssd-ai-tester/scripts/runtime.mjs';

const root = path.resolve('.test-tmp', 'release-verify-' + Date.now());
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const archive = path.join(projectRoot, 'dist', 'ssd-ai-tester-' + pkg.version + '.zip');
const extracted = path.join(root, 'extracted');
await fs.mkdir(root, { recursive: true });
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:SSD_VERIFY_ZIP, $env:SSD_VERIFY_DEST)'], { env: { ...process.env, SSD_VERIFY_ZIP: archive, SSD_VERIFY_DEST: extracted }, windowsHide: true });
const packageRoot = path.join(extracted, 'ssd-ai-tester-' + pkg.version);
const skills = path.join(root, 'installed skills');
const install = await runProcess(process.execPath, [path.join(packageRoot, 'bin/install.mjs'), '--skills-dir', skills]);
assert.equal(install.code, 0);
const helper = path.join(skills, 'ssd-ai-tester/scripts/workspace.mjs');
const workspace = path.join(root, 'QA งานตัวอย่าง');
assert.equal((await runProcess(process.execPath, [helper, 'workspace', '--workspace', workspace, '--title', 'ตรวจชุดแจก ZIP', '--url', 'http://127.0.0.1', '--environment', 'DEMO'])).code, 0);
const configFile = path.join(workspace, 'ssd-workspace.json');
const config = JSON.parse(await fs.readFile(configFile, 'utf8')); config.mode = 'demo'; await fs.writeFile(configFile, JSON.stringify(config));
await fs.writeFile(path.join(workspace, 'tests', 'zip.spec.mjs'), `
import { test, expect } from '../fixtures.mjs';
test('เปิดหน้าจำลองแล้วเห็นข้อความพร้อมใช้งาน', async ({ page, business }) => {
  business({ requirement: 'หน้าจำลองต้องแสดงพร้อมใช้งาน', preconditions: 'ใช้ข้อมูลจำลอง', expected: 'แสดงพร้อมใช้งาน', steps: [{ action: 'เปิดหน้าจำลอง', expected: 'แสดงข้อความ' }] });
  await page.setContent('<h1>พร้อมใช้งาน</h1>');
  await expect(page.getByRole('heading')).toHaveText('พร้อมใช้งาน');
});`);
assert.equal((await runProcess(process.execPath, [helper, 'run'], { cwd: workspace })).code, 0);
const [runName] = await fs.readdir(path.join(workspace, 'runs'));
const directory = path.join(workspace, 'runs', runName);
const report = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
assert.equal(report.metrics.counts.passed, 1);
assert.equal(report.cases[0].evidence.length, 1);
const { loadRuntime } = await import(pathToFileURL(path.join(skills, 'ssd-ai-tester/scripts/runtime.mjs')).href);
const runtime = await loadRuntime();
const { chromium } = runtime.require('@playwright/test');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(path.join(directory, 'report.html')).href);
  assert.equal(await page.locator('article').count(), 1);
  assert.ok(await page.getByText('ภาพรวมที่ใช้ตัดสินใจ', { exact: true }).isVisible());
  await page.screenshot({ path: path.join(root, 'report-preview.png'), fullPage: true });
} finally { await browser.close(); }
console.log('RELEASE VERIFIED: ZIP -> install + browser check -> installed Skill helper -> arbitrary workspace -> real headless test -> screenshot -> Thai report.\n' + directory + '\nPreview: ' + path.join(root, 'report-preview.png'));
