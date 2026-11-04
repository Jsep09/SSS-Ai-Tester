import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const localSkill = fileURLToPath(new URL('../', import.meta.url));
const marker = '.ssd-ai-tester-install.json';
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const validVersion = value => {
  const match = typeof value === 'string' && versionPattern.exec(value);
  return Boolean(match && !(match[4] || '').split('.').some(part => /^0\d+$/.test(part)));
};
export function compareVersions(left, right) {
  const a = versionPattern.exec(left);
  const b = versionPattern.exec(right);
  if (!validVersion(left) || !validVersion(right)) throw new Error('version ต้องเป็น Semantic Version เช่น 0.5.0');
  for (let i = 1; i <= 3; i++) {
    const difference = BigInt(a[i]) - BigInt(b[i]);
    if (difference) return difference > 0n ? 1 : -1;
  }
  if (a[4] === b[4]) return 0;
  if (!a[4]) return 1;
  if (!b[4]) return -1;
  const preA = a[4].split('.');
  const preB = b[4].split('.');
  for (let i = 0; i < Math.max(preA.length, preB.length); i++) {
    if (preA[i] === preB[i]) continue;
    if (preA[i] === undefined) return -1;
    if (preB[i] === undefined) return 1;
    const numericA = /^\d+$/.test(preA[i]);
    const numericB = /^\d+$/.test(preB[i]);
    if (numericA && numericB) return BigInt(preA[i]) > BigInt(preB[i]) ? 1 : -1;
    if (numericA !== numericB) return numericA ? -1 : 1;
    return preA[i] > preB[i] ? 1 : -1;
  }
  return 0;
}
async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const readMetadata = file => readJson(file).catch(error => {
  if (error instanceof SyntaxError) return null;
  throw error;
});
async function installedSkill(directory, name) {
  const root = path.join(directory, name);
  const manifest = await readJson(path.join(root, marker));
  if (!manifest) return { name, version: null, previousVersion: null, integrity: 'unmanaged-or-missing' };
  if (manifest.package !== 'ssd-ai-tester' || !validVersion(manifest.version) || !manifest.files || typeof manifest.files !== 'object') throw new Error('ข้อมูลติดตั้งไม่ถูกต้อง: ' + name);
  const modified = [];
  async function inspect(relative = '') {
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      if (!relative && entry.name === marker) continue;
      const key = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) { modified.push(key); continue; }
      if (entry.isDirectory()) await inspect(key);
      else {
        const hash = crypto.createHash('sha256').update(await fs.readFile(path.join(root, key))).digest('hex');
        if (hash !== manifest.files[key]) modified.push(key);
      }
    }
  }
  await inspect();
  for (const key of Object.keys(manifest.files)) {
    if (path.isAbsolute(key) || key.split(/[\\/]/).includes('..')) throw new Error('path ในข้อมูลติดตั้งไม่ถูกต้อง');
    try { await fs.access(path.join(root, key)); } catch (error) { if (error.code !== 'ENOENT') throw error; modified.push(key); }
  }
  return { name, version: manifest.version, previousVersion: manifest.previousVersion || null,
    integrity: modified.length ? 'modified' : 'verified', modifiedFiles: [...new Set(modified)] };
}

export async function getVersionInfo(directory, options = {}) {
  if (options.sessionVersion) compareVersions(options.sessionVersion, options.sessionVersion);
  if (options.from) compareVersions(options.from, options.from);
  const skills = await Promise.all(['ssd-ai-tester', 'ssd-get-started', 'ssd-skill-list'].map(name => installedSkill(directory, name)));
  const primary = skills[0];
  const installedVersion = primary.version;
  const sessionVersion = options.sessionVersion || null;
  const metadata = primary.integrity === 'verified' ? await readMetadata(path.join(directory, 'ssd-ai-tester/references/release.json')) : null;
  const helperMetadata = await readMetadata(path.join(localSkill, 'references/release.json'));
  const consistent = installedVersion !== null && skills.every(skill => skill.version === installedVersion && skill.integrity === 'verified');
  const sessionStatus = !sessionVersion || !installedVersion ? 'unknown'
    : compareVersions(sessionVersion, installedVersion) === 0 ? 'same-version-reported'
    : compareVersions(sessionVersion, installedVersion) < 0 ? 'older-session' : 'newer-session';
  const from = options.from || (sessionVersion && installedVersion && compareVersions(sessionVersion, installedVersion) < 0 ? sessionVersion : primary.previousVersion);
  const metadataMatches = primary.integrity === 'verified' && metadata?.version === installedVersion && Array.isArray(metadata.releases);
  const releases = metadataMatches ? metadata.releases.filter(release => {
    return compareVersions(release.version, installedVersion) <= 0 && (!from || compareVersions(release.version, from) > 0);
  }).sort((a, b) => compareVersions(b.version, a.version)) : [];
  // With no comparison baseline, show the installed release only rather than all history.
  const updates = from ? releases : releases.filter(release => compareVersions(release.version, installedVersion) === 0);
  return { installedVersion, previousVersion: primary.previousVersion, helperVersion: helperMetadata?.version || null,
    sessionVersion, sessionVersionSource: sessionVersion ? 'provided-by-caller' : 'unknown', sessionStatus,
    consistent, skills, fromVersion: from || null, updates,
    updateSummaryStatus: metadataMatches ? 'available' : 'unavailable',
    rangeNote: from && installedVersion && compareVersions(from, installedVersion) > 0 ? 'from-version-newer-than-installed' : null,
    action: !consistent ? 'ตรวจชุดติดตั้งด้วย doctor และติดตั้งซ้ำจากแพ็กเกจที่ต้องการ'
      : sessionStatus === 'older-session' || sessionStatus === 'newer-session' ? 'เปิดแชตใหม่เพื่อโหลด skill จากชุดติดตั้งปัจจุบัน'
      : sessionStatus === 'unknown' ? 'ยังยืนยันรุ่นที่แชตโหลดไม่ได้; เปิดแชตใหม่หากเพิ่งอัปเดต'
      : 'รุ่นที่แจ้งตรงกับชุดติดตั้ง; ไม่ใช่การรับรองว่า reference ทุกไฟล์ในแชตถูกโหลดใหม่' };
}

export function formatVersionInfo(info, showUpdates = false) {
  const lines = [
    'SSD AI Tester',
    'Installed: ' + (info.installedVersion || 'ไม่พบข้อมูลรุ่นติดตั้ง'),
    'Session (reported): ' + (info.sessionVersion || 'ไม่ทราบ'),
    'Previous installed: ' + (info.previousVersion || 'ไม่ทราบ/ติดตั้งครั้งแรก'),
    'ชุดติดตั้ง: ' + (info.consistent ? 'ครบและตรงกัน' : 'ไม่ครบ/ต่างรุ่น/มีไฟล์เปลี่ยน'),
  ];
  if (!info.consistent) for (const skill of info.skills) lines.push('  ' + skill.name + ': ' + (skill.version || 'ไม่ทราบ') + ' (' + skill.integrity + ')');
  lines.push('สถานะ session: ' + info.sessionStatus, 'คำแนะนำ: ' + info.action);
  if (showUpdates) {
    lines.push('', info.fromVersion ? 'อัปเดตจาก ' + info.fromVersion + ' ถึง ' + (info.installedVersion || 'ไม่ทราบ') : 'รายละเอียดรุ่นที่ติดตั้ง (ไม่ทราบรุ่นก่อนหน้า)');
    if (info.updateSummaryStatus === 'unavailable') lines.push('ชุดติดตั้งนี้ไม่มี release notes ที่ตรงกับรุ่น ให้ดู changelog จากแพ็กเกจต้นทาง');
    else if (info.rangeNote) lines.push('รุ่นเริ่มต้นใหม่กว่ารุ่นติดตั้ง จึงไม่สรุปเป็นการอัปเกรด');
    else if (!info.updates.length) lines.push('ไม่มีรายการอัปเดตในช่วงรุ่นที่เลือก');
    for (const release of info.updates) lines.push('', 'v' + release.version, ...release.notes);
  }
  return lines.join('\n');
}

export async function versionMain(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    'skills-dir': { type: 'string' }, 'session-version': { type: 'string' }, from: { type: 'string' }, json: { type: 'boolean' }, auto: { type: 'boolean' }
  } });
  const command = positionals[0] || 'version';
  if (positionals.length > 1 || !['version', 'update-info'].includes(command)) throw new Error('ใช้ version | update-info [--skills-dir PATH] [--session-version X.Y.Z] [--from X.Y.Z] [--json]');
  const directory = path.resolve(values['skills-dir'] || path.join(localSkill, '..'));
  if (values.auto) {
    const { checkVersionNotice } = await import('./version-notice.mjs');
    const result = await checkVersionNotice(directory, { sessionVersion: values['session-version'] });
    if (values.json) console.log(JSON.stringify(result, null, 2));
    else if (result.notification) console.log(result.notification);
    if (result.persistenceError) console.warn(result.persistenceError);
    return result;
  }
  const info = await getVersionInfo(directory, { sessionVersion: values['session-version'], from: values.from });
  console.log(values.json ? JSON.stringify(info, null, 2) : formatVersionInfo(info, command === 'update-info'));
  return info;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  versionMain().catch(error => { console.error(error.message); process.exitCode = 1; });
}
