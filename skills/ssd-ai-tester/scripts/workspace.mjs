import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { runtimeDirectory, loadRuntime, setupRuntime, checkRuntime, runProcess } from './runtime.mjs';
import { configureContext, contextStatus, reviewContext, requireCurrentContext } from './context.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const marker = 'ssd-workspace.json';
export async function findWorkspace(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    try { await fs.access(path.join(current, marker)); return current; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) throw new Error('ไม่พบ ssd-workspace.json ให้ Codex เตรียม workspace หรือระบุ --workspace PATH');
    current = parent;
  }
}
export async function readWorkspace(directory) {
  const root = await fs.realpath(directory);
  const config = JSON.parse(await fs.readFile(path.join(root, marker), 'utf8'));
  if (config.schemaVersion !== 1 || !config.title || !config.environment) throw new Error('ข้อมูล workspace ไม่ครบ');
  const url = new URL(config.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL workspace ต้องเป็น http/https ไม่มี credential');
  for (const field of ['testsDir', 'runsDir']) {
    const relative = config[field];
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error(field + ' ต้องเป็น path ย่อยภายใน workspace');
    const resolved = path.resolve(root, relative);
    if (resolved === root) throw new Error(field + ' ต้องเป็นโฟลเดอร์ย่อย');
    await fs.mkdir(resolved, { recursive: true });
    if (await fs.realpath(resolved) !== resolved) throw new Error(field + ' ต้องไม่เป็น symlink');
  }
  const tests = path.resolve(root, config.testsDir);
  const runs = path.resolve(root, config.runsDir);
  if (tests === runs || tests.startsWith(runs + path.sep) || runs.startsWith(tests + path.sep)) throw new Error('testsDir และ runsDir ต้องแยกกันและไม่ซ้อนกัน');
  if (config.authFile) {
    if (typeof config.authFile !== 'string' || path.isAbsolute(config.authFile) || config.authFile.split(/[\\/]/).includes('..')) throw new Error('authFile ต้องอยู่ภายใน workspace');
    const authFile = path.resolve(root, config.authFile);
    if (!(await fs.realpath(authFile)).startsWith(root + path.sep)) throw new Error('authFile อยู่นอก workspace');
  }
  return { root, config };
}
export async function createWorkspace(directory, options) {
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !options.title || !options.environment) throw new Error('ต้องมี title, environment และ URL http/https ที่ไม่มี credential');
  const root = path.resolve(directory);
  await fs.mkdir(root, { recursive: true });
  const reserved = [marker, 'tests', 'runs', 'context', 'fixtures.mjs', 'run-tests.cmd', '.ssd', '.gitignore'];
  for (const name of reserved) {
    try { await fs.lstat(path.join(root, name)); throw new Error('มีไฟล์/โฟลเดอร์เดิม: ' + name + ' กรุณาเลือกโฟลเดอร์ย่อยใหม่ หรือใช้ workspace เดิม'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const folder of ['tests', 'runs', 'context', '.ssd', 'requirements', 'test-data', 'playwright/.auth']) await fs.mkdir(path.join(root, folder), { recursive: true });
  await fs.writeFile(path.join(root, marker), JSON.stringify({ schemaVersion: 1, title: options.title, url: options.url, environment: options.environment, testsDir: 'tests', runsDir: 'runs' }, null, 2));
  await fs.writeFile(path.join(root, '.gitignore'), 'runs/\n.ssd/\nplaywright/.auth/\ncontext/\n');
  const fixtureUrl = pathToFileURL(path.join(path.dirname(scriptPath), 'playwright-fixtures.mjs')).href;
  await fs.writeFile(path.join(root, 'fixtures.mjs'), `// Generated for this machine. Re-run workspace command 'bind' after moving machines.\nexport { test, expect } from ${JSON.stringify(fixtureUrl)};\n`);
  await fs.writeFile(path.join(root, 'run-tests.cmd'), `@echo off\r\nsetlocal\r\nnode "${scriptPath}" run --workspace "%~dp0."\r\nset "ssd_run_exit=%errorlevel%"\r\nif not defined SSD_TESTER_NO_PAUSE pause\r\nexit /b %ssd_run_exit%\r\n`);
  console.log('สร้าง workspace แล้ว: ' + root + '\nเก็บสคริปต์ใน tests/ แล้วสั่ง Codex รันได้เลย');
  return root;
}
export async function bindWorkspace(directory) {
  const { root } = await readWorkspace(directory);
  const fixtureUrl = pathToFileURL(path.join(path.dirname(scriptPath), 'playwright-fixtures.mjs')).href;
  await fs.writeFile(path.join(root, 'fixtures.mjs'), `export { test, expect } from ${JSON.stringify(fixtureUrl)};\n`);
  await fs.writeFile(path.join(root, 'run-tests.cmd'), `@echo off\r\nsetlocal\r\nnode "${scriptPath}" run --workspace "%~dp0."\r\nset "ssd_run_exit=%errorlevel%"\r\nif not defined SSD_TESTER_NO_PAUSE pause\r\nexit /b %ssd_run_exit%\r\n`);
  console.log('เชื่อม workspace กับเครื่องนี้แล้ว: ' + root);
}
export async function runWorkspace(directory, options = {}) {
  const { root } = await readWorkspace(directory);
  await fs.mkdir(path.join(root, '.ssd'), { recursive: true });
  const lock = path.join(root, '.ssd', 'run.lock');
  let handle;
  try { handle = await fs.open(lock, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('workspace นี้มี run.lock อยู่ ห้ามรันซ้อน ให้ตรวจว่าไม่มีรอบที่กำลังทำงานก่อนนำ lock เก่าออก'); throw error; }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await executeWorkspace(root, options); }
  finally { await handle.close(); await fs.unlink(lock); }
}
async function executeWorkspace(directory, options = {}) {
  const { root, config } = await readWorkspace(directory);
  const context = options.list ? await contextStatus(root) : await requireCurrentContext(root);
  const runtime = await loadRuntime();
  const runDirectory = path.join(root, config.runsDir, new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8));
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.mkdir(path.join(runDirectory, 'screenshots'));
  const runInfo = { startedAt: new Date().toISOString(), workspace: root, grep: options.grep || null, status: 'running', context };
  await fs.writeFile(path.join(runDirectory, 'run.json'), JSON.stringify(runInfo, null, 2));
  const reporter = path.join(path.dirname(scriptPath), 'playwright-reporter.mjs');
  const configFile = path.join(runDirectory, 'playwright.config.mjs');
  const generated = { testDir: path.resolve(root, config.testsDir), testMatch: '**/*.spec.{ts,js,mjs}', outputDir: path.join(runDirectory, 'artifacts'), retries: 0, workers: 1, forbidOnly: true, timeout: 30000, globalTimeout: 600000, reporter: [['list'], [reporter], ['html', { outputFolder: path.join(runDirectory, 'playwright-report'), open: 'never' }]], use: { baseURL: config.url, channel: 'chromium', headless: true, screenshot: 'on', trace: 'retain-on-failure' } };
  if (config.authFile) generated.use.storageState = path.resolve(root, config.authFile);
  await fs.writeFile(configFile, 'export default ' + JSON.stringify(generated, null, 2) + ';\n');
  const args = [runtime.cli, 'test', '--config', configFile];
  if (options.grep) args.push('--grep', options.grep);
  if (options.list) args.push('--list');
  console.log('Workspace: ' + root + '\nผลรอบนี้: ' + runDirectory);
  const result = await runProcess(process.execPath, args, { cwd: root, logFile: path.join(runDirectory, 'runner.log'), env: { ...process.env, SSD_TESTER_RUNTIME: runtimeDirectory(), SSD_TESTER_RUN: runDirectory, SSD_TESTER_WORKSPACE: root, SSD_TESTER_LIST: options.list ? '1' : '' } });
  await fs.writeFile(path.join(runDirectory, 'run.json'), JSON.stringify({ ...runInfo, finishedAt: new Date().toISOString(), status: options.list ? 'listed' : result.code ? 'failed' : 'finished', exitCode: result.code }, null, 2));
  let hasReport = false;
  try { await fs.access(path.join(runDirectory, 'report.html')); hasReport = true; } catch {}
  console.log('ผลลัพธ์: ' + runDirectory + (hasReport ? '\nเปิด report.html เพื่อดูรายงานไทย หรือ playwright-report/index.html เพื่อดูรายละเอียดทางเทคนิค' : '\nยังไม่มีรายงานผลธุรกิจ: ดู runner.log เพื่อแก้ไขการโหลดสคริปต์/การเริ่มทดสอบ (หรือใช้ --list ซึ่งไม่รันทดสอบ)'));
  return { ...result, runDirectory };
}
export async function workspaceMain(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { workspace: { type: 'string' }, url: { type: 'string' }, title: { type: 'string' }, environment: { type: 'string' }, grep: { type: 'string' }, list: { type: 'boolean' }, 'context-file': { type: 'string', multiple: true }, review: { type: 'string' } } });
  const [command, ...rest] = positionals;
  if (rest.length) throw new Error('มี argument เกิน');
  if (command === 'setup') return setupRuntime();
  if (command === 'doctor') { const status = await checkRuntime(true); console.log(status.message); if (!status.ok) process.exitCode = 1; return; }
  if (command === 'workspace') {
    if (!values.url || !values.title || !values.environment) throw new Error('workspace ต้องมี --url --title --environment');
    const created = await createWorkspace(values.workspace || path.join(process.cwd(), 'qa-workspace'), values);
    if (values['context-file']) console.log(JSON.stringify(await configureContext(await fs.realpath(created), values['context-file'].map(file => path.resolve(file))), null, 2));
    return created;
  }
  const directory = values.workspace ? path.resolve(values.workspace) : await findWorkspace();
  if (command === 'context' || command === 'context-review') {
    const { root } = await readWorkspace(directory);
    if (command === 'context-review') {
      if (!values.review) throw new Error('context-review ต้องมี --review PATH');
      return console.log(JSON.stringify(await reviewContext(root, path.resolve(values.review)), null, 2));
    }
    const status = values['context-file']
      ? await configureContext(root, values['context-file'].map(file => path.resolve(file)))
      : await contextStatus(root);
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  if (command === 'bind') return bindWorkspace(directory);
  if (command === 'run') { const result = await runWorkspace(directory, values); process.exitCode = result.code; return; }
  throw new Error('ใช้ setup | doctor | workspace --workspace PATH --title NAME --url URL --environment UAT [--context-file PATH] | context [--context-file PATH] | context-review --review PATH | run [--workspace PATH] [--grep TEXT] [--list] | bind --workspace PATH');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  workspaceMain().catch(error => { console.error('ดำเนินการไม่ได้: ' + error.message); process.exitCode = 1; });
}
