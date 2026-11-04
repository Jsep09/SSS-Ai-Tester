import { renameWithRetry } from './rename.mjs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { getCatalog } from '../skills/ssd-skill-list/scripts/catalog.mjs';

const packageName = 'ssd-ai-tester';
const marker = '.ssd-ai-tester-install.json';
export const defaultSkillsDir = () => path.join(os.homedir(), '.agents', 'skills');

async function exists(file) {
  try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function inventory(directory) {
  const result = {};
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === marker) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('ไม่รองรับ symlink ใน Skill: ' + file);
    if (entry.isDirectory()) {
      for (const [key, hash] of Object.entries(await inventory(file))) result[entry.name + '/' + key] = hash;
    } else result[entry.name] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  return result;
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function managedState(target) {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('ปลายทางต้องเป็นโฟลเดอร์จริง: ' + target);
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(target, marker), 'utf8')); } catch { throw new Error('มี Skill เดิมที่ไม่ได้ติดตั้งด้วยเครื่องมือนี้: ' + target); }
  if (manifest.package !== packageName || !manifest.files) throw new Error('ข้อมูลเจ้าของ Skill ไม่ถูกต้อง');
  return { manifest, modified: !equal(await inventory(target), manifest.files) };
}
async function installOne(root, directory, skillName, force) {
  const source = path.join(root, 'skills', skillName);
  const target = path.join(path.resolve(directory), skillName);
  const files = await inventory(source);
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  let previousVersion = null;
  await fs.mkdir(directory, { recursive: true });
  const realDirectory = await fs.realpath(directory);
  if (path.resolve(target) === path.resolve(source) || (await fs.realpath(source)) === path.join(realDirectory, skillName)) throw new Error('ปลายทางเป็นโฟลเดอร์ต้นฉบับ');
  if (await exists(target)) {
    const state = await managedState(target);
    previousVersion = state.manifest.version !== pkg.version ? state.manifest.version : state.manifest.previousVersion || null;
    if (state.modified && !force) throw new Error('Skill มีการแก้ไขเอง กรุณาสำรองก่อนใช้ install --force');
    if (!state.modified && state.manifest.version === pkg.version && equal(state.manifest.files, files)) return 'Skill เป็นรุ่นเดียวกันอยู่แล้ว: ' + target;
  }
  const stage = await fs.mkdtemp(path.join(directory, '.ssd-ai-tester-stage-'));
  const backup = path.join(directory, '.ssd-ai-tester-backup-' + crypto.randomUUID());
  let backedUp = false;
  try {
    await fs.cp(source, stage, { recursive: true });
    await fs.writeFile(path.join(stage, marker), JSON.stringify({ package: packageName, version: pkg.version, previousVersion, files }, null, 2));
    if (await exists(target)) { await renameWithRetry(target, backup); backedUp = true; }
    try { await renameWithRetry(stage, target); } catch (error) {
      if (backedUp) { await renameWithRetry(backup, target); backedUp = false; }
      throw error;
    }
    // Retain edited files when --force was used, so an update is recoverable.
    if (backedUp && !force) { await fs.rm(backup, { recursive: true }); backedUp = false; }
    return 'ติดตั้ง Skill สำหรับทุกโปรเจกต์แล้ว: ' + target + (backedUp ? '\nสำรองรุ่นเดิม: ' + backup : '');
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}
export async function installSkills(root, directory, force = false) {
  directory = path.resolve(directory);
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const entries = await getCatalog(path.join(root, 'skills'));
  if (entries.some(entry => !entry.available)) throw new Error('ไฟล์ Skill ในแพ็กเกจไม่ครบ');
  await fs.mkdir(directory, { recursive: true });
  const realDirectory = await fs.realpath(directory);
  // Check the entire suite before changing anything, including upgrades from the one-skill release.
  for (const entry of entries) {
    const releaseFile = path.join(root, 'skills', entry.name, 'references/release.json');
    if (await exists(releaseFile)) {
      const release = JSON.parse(await fs.readFile(releaseFile, 'utf8'));
      if (release.version !== pkg.version) throw new Error('release metadata ไม่ตรง package.json ให้รัน node scripts/sync-release.mjs ก่อน install');
    }
    const source = await fs.realpath(path.join(root, 'skills', entry.name));
    const target = path.join(directory, entry.name);
    if (source.toLowerCase() === path.join(realDirectory, entry.name).toLowerCase()) throw new Error('ปลายทางเป็นโฟลเดอร์ต้นฉบับ');
    if (await exists(target)) {
      const state = await managedState(target);
      if (state.modified && !force) throw new Error('Skill มีการแก้ไขเอง: ' + entry.name + ' กรุณาสำรองก่อนใช้ install --force');
    }
  }
  const messages = [];
  for (const entry of entries) messages.push(await installOne(root, directory, entry.name, force));
  return messages.join('\n') + '\nเริ่มใน Codex: $ssd-get-started | ดูรายการ: $ssd-skill-list\nหากยังไม่พบให้เปิด Codex ใหม่';
}
export async function uninstallSkills(directory) {
  const entries = await getCatalog(directory);
  // Preflight all owned folders, so a conflict never removes only part of the suite.
  for (const entry of entries) {
    const target = path.join(path.resolve(directory), entry.name);
    if (await exists(target)) {
      const state = await managedState(target);
      if (state.modified) throw new Error('Skill มีไฟล์แก้ไขหรือเพิ่มเอง กรุณาสำรองและนำออกเอง: ' + target);
    }
  }
  const messages = [];
  for (const entry of entries) messages.push(await uninstallOne(directory, entry.name));
  return messages.join('\n');
}
async function uninstallOne(directory, skillName) {
  const target = path.join(path.resolve(directory), skillName);
  if (!(await exists(target))) return 'ไม่พบ Skill ที่ ' + target;
  const state = await managedState(target);
  if (state.modified) throw new Error('Skill มีไฟล์แก้ไขหรือเพิ่มเอง กรุณาสำรองและนำออกเอง: ' + target);
  // Move only the exact owned folder to a backup; never delete a user-edited directory.
  const backup = path.join(path.resolve(directory), '.ssd-ai-tester-removed-' + crypto.randomUUID());
  await renameWithRetry(target, backup);
  return 'นำ Skill ออกจากรายการแล้ว สำรองไว้ที่: ' + backup;
}
async function inspectOne(root, directory, skillName) {
  const target = path.join(path.resolve(directory), skillName);
  let ok = false;
  let detail;
  try {
    const state = await managedState(target);
    ok = !state.modified && equal(state.manifest.files, await inventory(path.join(root, 'skills', skillName)));
    detail = ok ? 'Skill ครบและตรงกับแพ็กเกจ' : 'Skill ถูกแก้ไขหรือเป็นคนละรุ่นกับแพ็กเกจ';
  } catch (error) { detail = error.code === 'ENOENT' ? 'ยังไม่ได้ติดตั้ง Skill' : error.message; }
  return { ok, message: `${skillName}: ${detail}\nโฟลเดอร์: ${target}` };
}
export async function inspectInstall(root, directory) {
  const entries = await getCatalog(path.join(root, 'skills'));
  const results = await Promise.all(entries.map(entry => inspectOne(root, directory, entry.name)));
  return {
    ok: results.every(result => result.ok),
    message: results.map(result => result.message).join('\n') + `\nNode.js: ${process.version}\nตรวจ Playwright เพิ่มด้วย runtime-doctor; ถ้าไม่พร้อมเรียก setup\nBrowser Use / Computer Use: ต้องตรวจในแชต Codex (CLI ตรวจสิทธิ์ runtime ไม่ได้)\nมีสคริปต์พร้อม: รัน headless โดยตรง ไม่ควบคุม desktop ผู้ใช้\nเริ่มใช้งาน: $ssd-get-started | รายการ: $ssd-skill-list`,
  };
}
