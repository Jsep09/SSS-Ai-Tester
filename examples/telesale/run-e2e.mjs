import { readFile, writeFile, open, unlink, mkdir, stat, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { workspace, readConfig, readBotConfig } from './support/config.mjs';
import { manualLogin, skillDirectory } from './support/login.mjs';

const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--reuse-login', '--login-only', '--headed', '--headless'].includes(flag))) throw new Error('รองรับ --reuse-login, --login-only, --headed และ --headless เท่านั้น');
if (flags.has('--headed') && flags.has('--headless')) throw new Error('เลือก --headed หรือ --headless อย่างใดอย่างหนึ่ง');
const bot = await readBotConfig();
if (flags.has('--headed')) bot.headless = false;
if (flags.has('--headless')) bot.headless = true;
await readConfig();
await mkdir(path.join(workspace, '.ssd'), { recursive: true });
const lockPath = path.join(workspace, '.ssd/bot.lock');
try {
  const old = JSON.parse(await readFile(lockPath, 'utf8'));
  let active = true;
  try { process.kill(old.pid, 0); } catch (error) { if (error.code === 'ESRCH') active = false; else throw error; }
  if (active) throw new Error('บอทรอบเดิมยังทำงานอยู่ PID ' + old.pid);
  await unlink(lockPath);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const lock = await open(lockPath, 'wx');
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
try {
  if (!flags.has('--reuse-login')) await manualLogin({ headed: !bot.headless });
  else await stat(path.join(workspace, 'playwright/.auth/storage-state.json'));
  const configPath = path.join(workspace, 'ssd-workspace.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.authFile = 'playwright/.auth/storage-state.json';
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  if (!flags.has('--login-only')) {
    const runsPath = path.join(workspace, config.runsDir);
    const previousRuns = new Set(await readdir(runsPath));
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(skillDirectory, 'scripts/workspace.mjs'), 'run', '--workspace', workspace], {
        cwd: workspace, stdio: 'inherit', windowsHide: true,
        env: { ...process.env, E2E_HEADED: bot.headless ? '0' : '1', E2E_SLOW_MO: String(bot.slowMo) },
      });
      child.on('error', reject);
      child.on('close', code => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
    if (!bot.headless) {
      const { renderReport } = await import(pathToFileURL(path.join(skillDirectory, 'scripts/report.mjs')).href);
      for (const name of await readdir(runsPath)) {
        if (previousRuns.has(name)) continue;
        const reportPath = path.join(runsPath, name, 'results.json');
        let result;
        try { result = JSON.parse(await readFile(reportPath, 'utf8')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        result.tester = 'Playwright Test / Chromium headed (visible browser)';
        result.execution.headless = false;
        result.scope.push('รันแบบเปิดหน้าต่าง Chromium ให้เห็นการทำงาน โดยหน่วง action ' + bot.slowMo + ' ms');
        await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');
        await renderReport(path.join(runsPath, name));
        for (const filename of ['report.html', 'report.md']) {
          const outputPath = path.join(runsPath, name, filename);
          const output = await readFile(outputPath, 'utf8');
          await writeFile(outputPath, output.replaceAll('Browser context แยกแบบ headless', 'Browser context แบบเปิดหน้าต่าง'), 'utf8');
        }
      }
    }
  }
} finally {
  await lock.close();
  await unlink(lockPath);
}
