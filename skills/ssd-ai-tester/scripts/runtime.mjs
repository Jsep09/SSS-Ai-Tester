import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream } from 'node:fs';

// Pin the browser/runtime pair so one installation is reused across workspaces.
export const playwrightVersion = '1.64.1';
export const runtimeDirectory = () => path.resolve(process.env.SSD_TESTER_RUNTIME || path.join(os.homedir(), '.ssd-ai-tester', 'runtime', playwrightVersion));
export function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { logFile, logAppend = false, ...spawnOptions } = options;
    const log = logFile ? createWriteStream(logFile, { flags: logAppend ? 'a' : 'wx' }) : null;
    const child = spawn(command, args, { stdio: log ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true, ...spawnOptions });
    if (log) {
      log.on('error', error => { child.kill(); reject(error); });
      child.stdout.on('data', bytes => { process.stdout.write(bytes); log.write(bytes); });
      child.stderr.on('data', bytes => { process.stderr.write(bytes); log.write(bytes); });
    }
    child.on('error', error => { log?.end(); reject(error); });
    child.on('close', (code, signal) => {
      if (log) log.end(() => resolve({ code: code ?? 1, signal }));
      else resolve({ code: code ?? 1, signal });
    });
  });
}
export async function loadRuntime() {
  const directory = runtimeDirectory();
  // A fixed cache keeps Codex sandbox sessions and the interactive installer on the same binaries.
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(directory, 'browsers');
  const require = createRequire(path.join(directory, 'package.json'));
  const pkgPath = require.resolve('@playwright/test/package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  if (pkg.version !== playwrightVersion) throw new Error('Playwright version ไม่ตรงกับชุดติดตั้ง');
  return { directory, cli: path.join(path.dirname(pkgPath), 'cli.js'), module: path.join(path.dirname(pkgPath), 'index.mjs'), require };
}
export async function checkRuntime(launch = false) {
  try {
    const runtime = await loadRuntime();
    const { chromium } = runtime.require('@playwright/test');
    await fs.access(chromium.executablePath());
    if (launch) {
      const browser = await chromium.launch({ channel: 'chromium', headless: true });
      await browser.close();
    }
    return { ok: true, message: `Playwright ${playwrightVersion} + Chromium พร้อมใช้: ${runtime.directory}` };
  } catch (error) { return { ok: false, message: 'Playwright ยังไม่พร้อม: ' + error.message + '\nเรียก setup เพื่อดาวน์โหลด/ซ่อม runtime' }; }
}
export async function setupRuntime() {
  const existing = await checkRuntime(true);
  if (existing.ok) {
    console.log(existing.message);
    return;
  }
  const directory = runtimeDirectory();
  await fs.mkdir(directory, { recursive: true });
  const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), path.join(process.env.APPDATA || os.homedir(), 'npm/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  let npmCli;
  for (const candidate of candidates) { try { await fs.access(candidate); npmCli = candidate; break; } catch {} }
  if (!npmCli) throw new Error('ไม่พบ npm-cli.js กรุณาติดตั้ง Node.js พร้อม npm แล้วเปิดตัวติดตั้งใหม่');
  const ready = await checkRuntime();
  if (!ready.ok) {
    console.log('กำลังเตรียม Playwright ครั้งแรก ต้องเชื่อมต่ออินเทอร์เน็ต...');
    const result = await runProcess(process.execPath, [npmCli, 'install', '--prefix', directory, '--no-audit', '--no-fund', '--ignore-scripts', `@playwright/test@${playwrightVersion}`]);
    if (result.code) throw new Error('ดาวน์โหลด Playwright ไม่สำเร็จ ตรวจอินเทอร์เน็ต/proxy แล้วเรียก setup ซ้ำ');
  }
  const runtime = await loadRuntime();
  const result = await runProcess(process.execPath, [runtime.cli, 'install', 'chromium', '--no-shell']);
  if (result.code) throw new Error('ดาวน์โหลด Chromium ไม่สำเร็จ เรียก setup ซ้ำได้โดยไม่ลบ Skill');
  const verification = await checkRuntime(true);
  if (!verification.ok) throw new Error(verification.message);
  console.log(verification.message);
}
