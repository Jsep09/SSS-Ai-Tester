import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const catalogPath = fileURLToPath(new URL('../references/catalog.json', import.meta.url));
export async function getCatalog(skillsDirectory) {
  const entries = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const names = new Set();
  const result = [];
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) || names.has(entry.name)) throw new Error('ชื่อ Skill ใน catalog ไม่ถูกต้องหรือซ้ำ');
    names.add(entry.name);
    for (const field of ['description', 'whenToUse', 'example']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error('Catalog ต้องมี ' + field);
    }
    if (entry.commands !== undefined && (!Array.isArray(entry.commands) || entry.commands.some(command =>
      !['name', 'description', 'example'].every(field => typeof command[field] === 'string' && command[field].trim())))) throw new Error('commands ใน catalog ไม่ถูกต้อง');
    const file = path.resolve(skillsDirectory, entry.name, 'SKILL.md');
    let available = false;
    let reason = '';
    try {
      const content = await fs.readFile(file, 'utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
      available = Boolean(frontmatter && new RegExp('^name: ' + entry.name + '\\s*$', 'm').test(frontmatter));
      if (!available) reason = 'ไฟล์ Skill มีชื่อไม่ตรงกับรายการหรือไม่มี frontmatter';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      reason = 'ไม่พบไฟล์ Skill ในตำแหน่งนี้';
    }
    result.push({ ...entry, available, reason, file });
  }
  return result;
}

export function formatCatalog(entries) {
  return [
    'Skill ของชุด SSD AI Tester (' + entries.filter(entry => entry.available).length + '/' + entries.length + ' พบไฟล์)', '',
    ...entries.flatMap(entry => [
      '$' + entry.name + ' — ' + entry.description,
      'เหมาะกับ: ' + entry.whenToUse,
      'ตัวอย่าง: ' + entry.example,
      'สถานะ: ' + (entry.available ? 'พบไฟล์ Skill' : entry.reason), '',
      ...(entry.commands || []).flatMap(command => ['  ' + command.name + ' — ' + command.description, '  ตัวอย่าง: ' + command.example]),
    ]),
    'ssd-ai-tester: workspace = เตรียมพื้นที่ / plan = วางแผน / script = สร้างสคริปต์ / run-script = รันตรง / report = สรุปผล / version = ตรวจรุ่น / update-info = สรุปอัปเดต',
    'เริ่มครั้งแรก: $ssd-get-started',
    'รายการนี้ครอบคลุมเฉพาะชุด SSD AI Tester; Browser Use / Computer Use ต้องเปิดใช้ใน Codex แยก',
    'มีสคริปต์พร้อม: รัน Playwright โดยตรงแบบ headless; Browser Use สำหรับสำรวจ ไม่ fallback ไปยึด desktop ผู้ใช้',
    'การพบไฟล์ไม่ได้ยืนยันว่าแชตนี้โหลด Skill แล้วหรือมีสิทธิ์ใช้ browser runtime',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3) throw new Error('ใช้ node catalog.mjs [SKILLS_DIRECTORY]');
    console.log(formatCatalog(await getCatalog(process.argv[2] || fileURLToPath(new URL('../../', import.meta.url)))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
