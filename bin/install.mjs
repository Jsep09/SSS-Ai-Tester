#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { runProcess } from '../skills/ssd-ai-tester/scripts/runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let logPath;
async function log(message) {
  console.log(message);
  if (logPath) await fs.appendFile(logPath, message + '\n', 'utf8');
}
try {
  const { values } = parseArgs({ options: {
    'skills-dir': { type: 'string' }, 'log-dir': { type: 'string' },
    force: { type: 'boolean', default: false },
    'skills-only': { type: 'boolean', default: false },
  } });
  const logName = 'install-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8) + '.log';
  const logDirectories = values['log-dir'] ? [path.resolve(values['log-dir'])] : [path.join(root, 'install-logs'), path.join(os.tmpdir(), 'ssd-ai-tester-logs')];
  for (const directory of logDirectories) {
    try {
      await fs.mkdir(directory, { recursive: true });
      const candidate = path.join(directory, logName);
      await fs.writeFile(candidate, '', { flag: 'wx' });
      logPath = candidate;
      break;
    } catch (error) {
      if (directory === logDirectories.at(-1)) throw error;
    }
  }
  await log('SSD AI Tester Installer\nNode.js: ' + process.version + '\nแพ็กเกจ: ' + root + '\nLog: ' + logPath);
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('ต้องใช้ Node.js 20 ขึ้นไป กรุณาอัปเดตแล้วเปิดตัวติดตั้งใหม่');
  await fs.access(path.join(root, 'skills', 'ssd-ai-tester', 'SKILL.md'));
  const cli = path.join(root, 'bin', 'cli.mjs');
  async function run(command) {
    const args = [cli, command];
    if (values['skills-dir']) args.push('--skills-dir', values['skills-dir']);
    if (command === 'install' && values.force) args.push('--force');
    await log('\n--- ' + command + ' ---');
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.stdout) await log(result.stdout.trimEnd());
    if (result.stderr) await log(result.stderr.trimEnd());
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('ขั้นตอน ' + command + ' ไม่สำเร็จ (exit code ' + result.status + ')');
  }
  await run('install');
  await run('doctor');
  if (!values['skills-only']) {
    // Setup output is captured in the same log; browser installation can take several minutes.
    await log('\nกำลังติดตั้ง Playwright + Chromium ครั้งแรก อาจใช้เวลาหลายนาที กรุณารอ...');
    const result = await runProcess(process.execPath, [cli, 'setup'], { logFile: logPath, logAppend: true });
    if (result.code !== 0) throw new Error('ติดตั้ง Skill แล้ว แต่ Playwright ยังไม่พร้อม ให้ตรวจ log แล้วเรียก setup ซ้ำ');
  }
  await log('\nSUCCESS: ติดตั้งและตรวจสอบครบทั้ง 3 Skill แล้ว' + (values['skills-only'] ? '\nข้าม Playwright ตาม --skills-only; ยังรันสคริปต์ไม่ได้จนกว่าจะ setup' : '\nPlaywright + Chromium พร้อมรันสคริปต์แล้ว') + '\nเปิด Codex ใหม่ แล้วพิมพ์ $ssd-get-started หรือค้นหา SSD ในเมนู Skills');
} catch (error) {
  await log('\nFAILED: ติดตั้งไม่สำเร็จ\n' + error.message + '\nกรุณาแตก ZIP ทั้งโฟลเดอร์ก่อนเปิด install.cmd และเก็บข้อความนี้ไว้เพื่อตรวจสอบ');
  process.exitCode = 1;
}
if (logPath) console.log('\nไฟล์บันทึกผล: ' + logPath);
