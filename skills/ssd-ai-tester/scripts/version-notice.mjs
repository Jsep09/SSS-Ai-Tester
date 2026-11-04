import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getVersionInfo, compareVersions } from './version.mjs';

const defaultSkills = fileURLToPath(new URL('../../', import.meta.url));
export function formatUpdateNotice(info, title = 'ตรวจพบ Version ใหม่ที่ติดตั้งแล้ว') {
  const lines = [title, '', '**Installed version** — ' + info.installedVersion,
    '**Session version** — ' + (info.sessionVersion || 'ไม่ทราบ (ไม่มีหลักฐานรุ่นที่แชตโหลดไว้)'),
    '**Update summary** — ' + (info.fromVersion ? 'จาก ' + info.fromVersion + ' ถึง ' + info.installedVersion : 'รายละเอียดรุ่นติดตั้ง; ไม่ทราบรุ่นก่อนหน้า')];
  if (info.updateSummaryStatus !== 'available') lines.push('- ไม่มี release notes ที่ยืนยันได้จากชุดติดตั้งนี้');
  else if (info.rangeNote) lines.push('- เป็นการเปลี่ยนกลับไปรุ่นเก่า จึงไม่สรุปเป็นการอัปเกรด');
  else if (!info.updates.length) lines.push('- ไม่มีรายการเปลี่ยนแปลงในช่วงรุ่นนี้');
  for (const release of info.updates) lines.push('v' + release.version, ...release.notes);
  lines.push('**สิ่งที่ต้องทำต่อ** — ' + info.action);
  return lines.join('\n');
}

export async function checkVersionNotice(directory = defaultSkills, options = {}) {
  const sessionId = Object.hasOwn(options, 'sessionId') ? options.sessionId : process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID;
  const stateDirectory = path.resolve(options.stateDirectory || process.env.SSD_TESTER_VERSION_STATE || path.join(os.homedir(), '.ssd-ai-tester/version-sessions'));
  const stateFile = sessionId ? path.join(stateDirectory, crypto.createHash('sha256').update(JSON.stringify([sessionId, path.resolve(directory)])).digest('hex') + '.json') : null;
  let state = null;
  let persistenceError = null;
  if (stateFile) {
    try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') persistenceError = 'อ่านประวัติการแจ้งของแชตไม่ได้'; }
  }
  // Preserve the first known loaded version. Installing files must not silently upgrade session evidence.
  const sessionVersion = state?.sessionVersion || options.sessionVersion || null;
  const info = await getVersionInfo(directory, { sessionVersion, from: !sessionVersion ? state?.lastInstalledVersion : undefined });
  if (!info.installedVersion) return { notified: false, reason: 'not-installed', info };
  const changed = Boolean(state?.lastInstalledVersion && state.lastInstalledVersion !== info.installedVersion);
  const mismatch = ['older-session', 'newer-session'].includes(info.sessionStatus);
  const legacyUpdate = !state && !sessionVersion && info.previousVersion && info.previousVersion !== info.installedVersion;
  const shouldNotify = changed || mismatch || legacyUpdate || !info.consistent;
  const key = JSON.stringify([info.installedVersion, sessionVersion, info.skills.map(skill => [skill.version, skill.integrity, skill.modifiedFiles])]);
  const notified = Boolean(shouldNotify && state?.lastNotificationKey !== key);
  let title = 'ตรวจพบ Version ใหม่ที่ติดตั้งแล้ว';
  if (!info.consistent) title = 'ตรวจพบปัญหาชุดติดตั้ง SSD AI Tester';
  else if (info.sessionStatus === 'newer-session' || (changed && compareVersions(info.installedVersion, state.lastInstalledVersion) < 0)) title = 'ตรวจพบเวอร์ชันติดตั้งเปลี่ยนกลับเป็นรุ่นเก่า';
  else if (!sessionVersion) title += ' (ยังไม่ทราบรุ่น session)';
  if (stateFile) {
    let temporary;
    try {
      await fs.mkdir(stateDirectory, { recursive: true });
      if (await fs.realpath(stateDirectory) !== stateDirectory) throw new Error('state directory is a symlink');
      temporary = stateFile + '.' + crypto.randomUUID() + '.tmp';
      await fs.writeFile(temporary, JSON.stringify({ sessionVersion, lastInstalledVersion: info.installedVersion,
        lastNotificationKey: notified ? key : state?.lastNotificationKey || null }, null, 2));
      await fs.rename(temporary, stateFile);
    } catch {
      persistenceError = 'เก็บประวัติการแจ้งไม่ได้ อาจแสดงข้อความซ้ำในงานถัดไป';
      if (temporary) await fs.unlink(temporary).catch(() => {});
    }
  }
  return { notified, notification: notified ? formatUpdateNotice(info, title) : null, info,
    persistenceError, sessionTracking: stateFile ? 'per-chat' : 'unavailable' };
}

export async function emitVersionNotice(directory = defaultSkills, options = {}) {
  try {
    const result = await checkVersionNotice(directory, options);
    if (result.notification) console.log(result.notification);
    if (result.persistenceError) console.warn(result.persistenceError);
    return result;
  } catch (error) {
    console.warn('ตรวจเวอร์ชันอัตโนมัติไม่ได้: ' + error.message);
    return { notified: false, error: error.message };
  }
}
