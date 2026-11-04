import { promises as fs } from 'node:fs';
import path from 'node:path';

// Save screenshot artifacts returned by the documented Browser Use / Computer Use API.
// This saves a deliverable requested by the user; it does not capture or inspect the desktop.
export async function saveEvidence(runDirectory, screenshot, filename, caption) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpg|jpeg)$/.test(filename)) throw new Error('ชื่อภาพต้องเป็นตัวอักษรอังกฤษ ตัวเลข - หรือ _ และนามสกุล png/jpg/jpeg');
  if (typeof caption !== 'string' || !caption.trim()) throw new Error('ต้องมีคำอธิบายภาพ');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(screenshot?.url || '');
  if (!match) throw new Error('ต้องใช้ screenshot.url แบบ PNG/JPEG data URL จากเครื่องมือทดสอบ');
  if ((match[1] === 'png') !== filename.endsWith('.png')) throw new Error('นามสกุลภาพไม่ตรงกับข้อมูล');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('ภาพต้องมีข้อมูลและไม่เกิน 10 MB');
  const root = await fs.realpath(runDirectory);
  const directory = path.join(root, 'screenshots');
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.realpath(directory)) !== directory) throw new Error('ไม่รองรับโฟลเดอร์ภาพที่เป็น symlink');
  await fs.writeFile(path.join(directory, filename), bytes, { flag: 'wx' });
  return { path: 'screenshots/' + filename, caption, capturedAt: new Date().toISOString() };
}

export async function saveEvidenceBytes(runDirectory, screenshotBytes, filename, caption) {
  if (!(screenshotBytes instanceof Uint8Array)) throw new Error('ต้องใช้ screenshot bytes แบบ Uint8Array จาก Browser Use');
  const bytes = Buffer.from(screenshotBytes);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg) throw new Error('รองรับภาพ PNG/JPEG จริงเท่านั้น');
  return saveEvidence(runDirectory, { url: `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}` }, filename, caption);
}
