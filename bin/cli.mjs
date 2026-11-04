#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSkills, uninstallSkills, inspectInstall, defaultSkillsDir } from '../lib/install.mjs';
import { createRun, renderReport } from '../skills/ssd-ai-tester/scripts/report.mjs';
import { getCatalog, formatCatalog } from '../skills/ssd-skill-list/scripts/catalog.mjs';
import { workspaceMain } from '../skills/ssd-ai-tester/scripts/workspace.mjs';
import { getVersionInfo, formatVersionInfo } from '../skills/ssd-ai-tester/scripts/version.mjs';
import { emitVersionNotice, checkVersionNotice } from '../skills/ssd-ai-tester/scripts/version-notice.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
try {
  if (['setup', 'workspace', 'context', 'context-review', 'run', 'bind', 'runtime-doctor'].includes(process.argv[2])) {
    await emitVersionNotice(defaultSkillsDir());
    const args = process.argv.slice(2);
    if (args[0] === 'runtime-doctor') args[0] = 'doctor';
    await workspaceMain(args);
  } else {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    'skills-dir': { type: 'string' }, out: { type: 'string' }, title: { type: 'string' },
    url: { type: 'string' }, environment: { type: 'string' }, force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' }, 'session-version': { type: 'string' }, from: { type: 'string' }, json: { type: 'boolean' },
    auto: { type: 'boolean' },
  } });
  const [positionalCommand, ...rest] = positionals;
  const command = values.version ? 'version' : positionalCommand;
  if (rest.length) throw new Error('มี argument เกิน: ' + rest.join(' '));
  const directory = path.resolve(values['skills-dir'] || defaultSkillsDir());
  if (values.help || !command || command === 'help') {
    console.log(`SSD AI Tester — Codex E2E สำหรับ BA/QA

ssd-ai-tester install [--skills-dir PATH] [--force]
ssd-ai-tester doctor [--skills-dir PATH]
ssd-ai-tester list [--skills-dir PATH]
ssd-ai-tester version [--auto] [--session-version X.Y.Z] [--skills-dir PATH] [--json]
ssd-ai-tester update-info [--from X.Y.Z] [--session-version X.Y.Z] [--skills-dir PATH] [--json]
ssd-ai-tester uninstall [--skills-dir PATH]
ssd-ai-tester init --out RUN_DIR --title "ชื่อระบบ" --url https://example.test --environment UAT
ssd-ai-tester report --out RUN_DIR
ssd-ai-tester setup
ssd-ai-tester workspace --workspace PATH --title NAME --url URL --environment UAT
ssd-ai-tester run [--workspace PATH] [--grep TEXT] [--list]
ssd-ai-tester context [--workspace PATH] [--context-file PATH (repeatable)]
ssd-ai-tester context-review [--workspace PATH] --review PATH
ssd-ai-tester runtime-doctor

install ลงแบบ user-global ทุกโปรเจกต์ที่ ${defaultSkillsDir()}
เริ่มใน Codex ด้วย $ssd-get-started | ดูรายการด้วย $ssd-skill-list
ใช้ $ssd-ai-tester เพื่อวางแผน ทดสอบ และออกรายงาน; หากยังไม่พบให้เปิด Codex ใหม่
มีสคริปต์แล้ว: run เรียก Playwright โดยตรงแบบ headless; setup ติดตั้ง Playwright/Chromium ครั้งแรก
Browser Use สำหรับสำรวจ ต้องเปิดใช้ใน Codex แยก ไม่ fallback ไปควบคุม desktop ผู้ใช้
report สร้าง report.html, report.md และ report.json จาก results.json กับภาพหลักฐาน`);
  } else if (command === 'install') {
    console.log(await installSkills(packageRoot, directory, values.force));
    await emitVersionNotice(directory);
  } else if (command === 'version' || command === 'update-info') {
    if (values.auto) {
      const result = await checkVersionNotice(directory, { sessionVersion: values['session-version'] });
      if (values.json) console.log(JSON.stringify(result, null, 2));
      else if (result.notification) console.log(result.notification);
      if (result.persistenceError) console.warn(result.persistenceError);
    } else {
    const info = await getVersionInfo(directory, { sessionVersion: values['session-version'], from: values.from });
    console.log(values.json ? JSON.stringify(info, null, 2) : formatVersionInfo(info, command === 'update-info'));
    }
  } else if (command === 'uninstall') {
    console.log(await uninstallSkills(directory));
  } else if (command === 'list') {
    await emitVersionNotice(directory);
    console.log(formatCatalog(await getCatalog(directory)));
  } else if (command === 'doctor') {
    await emitVersionNotice(directory);
    const result = await inspectInstall(packageRoot, directory);
    console.log(result.message);
    process.exitCode = result.ok ? 0 : 1;
  } else if (command === 'init') {
    if (!values.out || !values.title || !values.url || !values.environment) throw new Error('init ต้องระบุ --out, --title, --url, --environment');
    console.log(await createRun(values.out, values));
  } else if (command === 'report') {
    if (!values.out) throw new Error('report ต้องระบุ --out RUN_DIR');
    console.log(await renderReport(values.out));
  } else throw new Error('ไม่รู้จักคำสั่ง: ' + command);
  }
} catch (error) {
  console.error('ดำเนินการไม่ได้: ' + error.message);
  process.exitCode = 1;
}
