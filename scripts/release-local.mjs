import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function nextVersion(current, increment = 'patch') {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const parts = pattern.exec(current)?.slice(1).map(BigInt);
  if (!parts) throw new Error('รุ่นปัจจุบันต้องเป็น X.Y.Z');
  if (['patch', 'minor', 'major'].includes(increment)) {
    const index = { major: 0, minor: 1, patch: 2 }[increment];
    parts[index]++;
    for (let i = index + 1; i < 3; i++) parts[i] = 0n;
    return parts.join('.');
  }
  const target = pattern.exec(increment)?.slice(1).map(BigInt);
  if (!target) throw new Error('ใช้ patch | minor | major | X.Y.Z');
  const difference = target.findIndex((part, index) => part !== parts[index]);
  if (difference < 0 || target[difference] < parts[difference]) throw new Error('รุ่นใหม่ต้องมากกว่ารุ่นปัจจุบัน');
  return increment;
}
export function releaseChangelog(text, version, date) {
  const normalized = text.replace(/\r\n/g, '\n');
  const heading = /^##\s+\[?Unreleased\]?(?:\([^)]*\))?[^\n]*\n/im.exec(normalized);
  let prefix, notes, rest;
  if (heading) {
    prefix = normalized.slice(0, heading.index).trimEnd();
    const following = normalized.slice(heading.index + heading[0].length);
    const next = /^##\s/m.exec(following);
    notes = (next ? following.slice(0, next.index) : following).trim();
    rest = next ? following.slice(next.index).trim() : '';
  } else {
    const title = /^#\s+[^\n]+\n/.exec(normalized);
    prefix = title ? title[0].trim() : '# Changelog';
    notes = '';
    rest = (title ? normalized.slice(title[0].length) : normalized).trim();
  }
  if (!notes) notes = '- สร้างแพ็กเกจจาก source ปัจจุบัน; ยังไม่ได้ระบุรายการเปลี่ยนแปลงใน Unreleased';
  return [prefix, '## Unreleased', '## [' + version + '] - ' + date, notes, rest].filter(Boolean).join('\n\n').replace(/\n/g, '\r\n') + '\r\n';
}
function runStep(root, script) {
  const result = spawnSync(process.execPath, [path.join(root, script)], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(script + ' ไม่ผ่าน หยุด release');
}
const exists = async file => { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
export async function releaseLocal(directory, options = {}) {
  const root = await fs.realpath(directory);
  const run = options.run || runStep;
  const pkgFile = path.join(root, 'package.json');
  const changelogFile = path.join(root, 'CHANGELOG.md');
  async function plan() {
    const pkg = JSON.parse(await fs.readFile(pkgFile, 'utf8'));
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(pkg.name)) throw new Error('ชื่อ package ไม่รองรับ');
    const version = nextVersion(pkg.version, options.increment || 'patch');
    const base = path.join(root, 'dist', pkg.name + '-' + version);
    const zip = base + '.zip', tgz = base + '.tgz';
    if (await exists(zip) || await exists(tgz)) throw new Error('มีแพ็กเกจรุ่น ' + version + ' แล้ว กรุณาเลือกรุ่นใหม่');
    return { pkg, version, zip, tgz };
  }
  if (options.dryRun) {
    const { pkg, version, zip, tgz } = await plan();
    return { previousVersion: pkg.version, version, zip, tgz, dryRun: true };
  }
  const temporary = path.join(root, '.test-tmp');
  await fs.mkdir(temporary, { recursive: true });
  if (await fs.realpath(temporary) !== temporary) throw new Error('.test-tmp ต้องไม่เป็น symlink');
  const lockFile = path.join(temporary, 'local-release.lock');
  let lock;
  try { lock = await fs.open(lockFile, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('มี release.lock อยู่ ให้ตรวจ process ก่อนเริ่มรอบใหม่'); throw error; }
  const snapshots = new Map();
  let planned, changed = false;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    planned = await plan();
    await run(root, 'scripts/check-release.mjs');
    const catalog = JSON.parse(await fs.readFile(path.join(root, 'skills/ssd-skill-list/references/catalog.json'), 'utf8'));
    const files = [pkgFile, changelogFile];
    for (const { name } of catalog) {
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error('ชื่อ Skill ไม่ถูกต้อง');
      files.push(path.join(root, 'skills', name, 'SKILL.md'), path.join(root, 'skills', name, 'references/release.json'));
    }
    for (const file of files) snapshots.set(file, await fs.readFile(file));
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(options.now || new Date());
    const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    changed = true;
    await fs.writeFile(pkgFile, JSON.stringify({ ...planned.pkg, version: planned.version }, null, 2).replace(/\n/g, '\r\n') + '\r\n');
    await fs.writeFile(changelogFile, releaseChangelog(snapshots.get(changelogFile).toString('utf8'), planned.version, date));
    await run(root, 'scripts/release.mjs');
    for (const archive of [planned.zip, planned.tgz]) if ((await fs.stat(archive)).size === 0) throw new Error('ไฟล์แพ็กเกจว่าง');
    return { previousVersion: planned.pkg.version, version: planned.version, zip: planned.zip, tgz: planned.tgz, dryRun: false };
  } catch (error) {
    if (changed) {
      for (const [file, bytes] of snapshots) await fs.writeFile(file, bytes);
      // plan rejected existing archives; these exact paths belong to this attempt.
      for (const file of [planned.zip, planned.tgz]) await fs.unlink(file).catch(failure => { if (failure.code !== 'ENOENT') throw failure; });
    }
    throw error;
  } finally { await lock.close(); await fs.unlink(lockFile); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'dry-run': { type: 'boolean' } } });
  if (positionals.length > 1) throw new Error('ใช้ release-local.mjs [patch|minor|major|X.Y.Z] [--dry-run]');
  releaseLocal(fileURLToPath(new URL('../', import.meta.url)), { increment: positionals[0], dryRun: values['dry-run'] })
    .then(result => console.log((result.dryRun ? 'Preview: ' : 'Release พร้อมแล้ว: ') + result.previousVersion + ' -> ' + result.version + '\nZIP: ' + result.zip + '\nTGZ: ' + result.tgz))
    .catch(error => { console.error('Release ไม่สำเร็จ: ' + error.message); process.exitCode = 1; });
}
