import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

// Creates a BA/QA starter only. It does not install dependencies or run a test.
export async function scaffoldWorkspace(root, options = {}) {
  const system = options.system ?? 'Telesale';
  if (typeof system !== 'string' || !system.trim() || system !== system.trim()
    || /[<>:"/\\|?*\x00-\x1f]/.test(system) || /[. ]$/.test(system)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(system)
    || ['.', '..'].includes(system)) throw new Error('ชื่อระบบต้องเป็นชื่อโฟลเดอร์เดียวที่ใช้ได้บน Windows');
  if (!root) throw new Error('ต้องระบุ --root สำหรับพื้นที่งาน BA/QA');
  if (options.url) {
    const url = new URL(options.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL ต้องเป็น http/https และไม่มี credential');
  }
  const directory = path.resolve(root, system);
  await fs.mkdir(path.resolve(root), { recursive: true });
  // Deliberately refuse an existing directory, including a symlink: never merge user work.
  await fs.mkdir(directory);
  for (const folder of ['input', 'codebase', 'scripts', 'run', 'results', '.system']) {
    await fs.mkdir(path.join(directory, folder));
  }
  const text = [
    `ระบบ: ${system}`,
    `สภาพแวดล้อม: ${options.environment || 'ยังไม่ระบุ — แจ้ง AI ก่อนเตรียม Flow'}`,
    `URL: ${options.url || 'ยังไม่ระบุ — ไม่เดา URL จากตัวอย่าง'}`,
    '',
    'นี่คือโครง Workspace เริ่มต้น ยังไม่มีสคริปต์หรือผลทดสอบ',
    '1. ใส่ requirement และข้อมูลทดสอบจริงใน input/',
    '2. ใส่ XML/Repomix หน้าบ้านและหลังบ้านใน codebase/ (ใช้ชื่อไฟล์จริง ไม่ต้องสร้าง XML เปล่า)',
    '3. ให้ AI อ่านข้อมูลและเตรียม scripts/<ชื่อ Flow>/ พร้อมตัวเรียก run/<ชื่อ Flow>.cmd',
    '4. เมื่อ Flow พร้อม ให้เข้า run/ แล้วเลือก Flow เพื่อรันได้โดยไม่ต้องผ่าน AI',
    '5. ดู results/<ชื่อ Flow>/ล่าสุด.html และประวัติใน history/ การเปิดรายงานเดิมไม่รันใหม่',
    '',
    'โหมดดูบอตและโหมดเร็วใช้สคริปต์ชุดเดียวกัน ไม่ต้องแยก Workspace',
    '.system/ สำหรับ config, session/auth, cache และ context metadata ห้ามส่งต่อ session หรือ credential',
    'ก่อนรันให้ตรวจสภาพแวดล้อมและสิ่งที่ Flow จะสร้างหรือแก้ไข',
    'การสร้างโครงนี้ไม่เปิดเว็บ ไม่เข้าสู่ระบบ และไม่สร้างข้อมูลในระบบเป้าหมาย',
    ''
  ].join('\r\n');
  await fs.writeFile(path.join(directory, 'อ่านก่อน.txt'), '\ufeff' + text, { flag: 'wx' });
  return directory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: {
      root: { type: 'string' }, system: { type: 'string' },
      url: { type: 'string' }, environment: { type: 'string' }
    } });
    console.log('สร้างโครง Workspace แล้ว (ยังไม่รันทดสอบ): ' + await scaffoldWorkspace(values.root, values));
  } catch (error) {
    console.error('สร้าง Workspace ไม่ได้: ' + error.message);
    process.exitCode = 1;
  }
}
