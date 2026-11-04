import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = path.resolve(root, '../.release-checks/' + Date.now());
await mkdir(checks, { recursive: true });
function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, SSD_TESTER_VERSION_STATE: path.join(checks, 'version-sessions') } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

test('ทุกโมดูล JavaScript ในชุดแจก parse ได้', async () => {
  async function check(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (['node_modules','runs','.ssd','playwright','install-logs'].includes(item.name)) continue;
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await check(file);
      else if (item.name.endsWith('.mjs')) run(['--check', file]);
    }
  }
  await check(root);
});

test('installer ติดตั้งและ doctor ผ่านในพื้นที่แยกโดยไม่แตะ user Skills', async () => {
  const destination = path.join(checks, 'installed-skills');
  const cli = path.join(root, 'bin/cli.mjs');
  run([cli, 'install', '--skills-dir', destination]);
  run([cli, 'doctor', '--skills-dir', destination]);
  const dirs = await readdir(destination);
  assert.ok(dirs.includes('ssd-ai-tester') && dirs.includes('ssd-get-started') && dirs.includes('ssd-skill-list'));
});

test('ตัวอย่าง Telesale ย้ายโฟลเดอร์แล้วยังโหลดกรณีทดสอบได้โดยไม่ Login หรือสร้างรายการ', async () => {
  const relocatedPackage = path.join(checks, 'relocated-package');
  await cp(path.join(root, 'skills'), path.join(relocatedPackage, 'skills'), { recursive: true });
  const example = path.join(relocatedPackage, 'examples/telesale');
  await cp(path.join(root, 'examples/telesale'), example, { recursive: true });
  const settings = JSON.parse(await readFile(path.join(example, 'ssd-workspace.json'), 'utf8'));
  // The source example may have a user's local login configured. Relocation uses no credentials.
  delete settings.authFile;
  await writeFile(path.join(example, 'ssd-workspace.json'), JSON.stringify(settings, null, 2));
  const { readBotConfig } = await import(pathToFileURL(path.join(example, 'support/config.mjs')).href);
  assert.deepEqual(await readBotConfig(), { headless: false, slowMo: 0 });
  const output = run([path.join(relocatedPackage, 'skills/ssd-ai-tester/scripts/workspace.mjs'), 'run', '--workspace', example, '--list']);
  assert.match(output, /Total: 1 test in 1 file/);
  await writeFile(path.join(example, 'bot.config.json'), JSON.stringify({ headless: true, slowMo: 350 }));
  assert.deepEqual(await readBotConfig(), { headless: true, slowMo: 350 });
  await writeFile(path.join(example, 'bot.config.json'), JSON.stringify({ headless: 'false', slowMo: -1 }));
  await assert.rejects(readBotConfig(), /bot.config.json/);
});
