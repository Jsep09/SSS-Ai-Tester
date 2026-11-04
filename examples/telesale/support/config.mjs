import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function readBotConfig() {
  const bot = JSON.parse(await readFile(path.join(workspace, 'bot.config.json'), 'utf8'));
  if (typeof bot.headless !== 'boolean' || !Number.isInteger(bot.slowMo) || bot.slowMo < 0) {
    throw new Error('bot.config.json: headless ต้องเป็น true/false และ slowMo ต้องเป็นจำนวนเต็มตั้งแต่ 0 (มิลลิวินาที)');
  }
  return bot;
}
export async function readConfig() {
  const settings = JSON.parse(await readFile(path.join(workspace, 'ssd-workspace.json'), 'utf8'));
  let scenarioText;
  try { scenarioText = await readFile(path.join(workspace, 'test-data/scenario.local.json'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; scenarioText = await readFile(path.join(workspace, 'test-data/scenario.json'), 'utf8'); }
  const scenario = JSON.parse(scenarioText);
  const url = new URL(settings.url);
  if (url.origin !== 'https://telesale.uatsiamsmile.com' || settings.environment !== 'UAT') {
    throw new Error('สคริปต์นี้อนุญาตเฉพาะ Telesale UAT ที่กำหนดไว้');
  }
  const uploadFile = path.resolve(workspace, process.env.E2E_UPLOAD_FILE || scenario.uploadFile);
  const file = await stat(uploadFile).catch(() => { throw new Error('ไม่พบเอกสารทดสอบ: ' + uploadFile); });
  if (!file.isFile() || file.size === 0 || file.size > 20 * 1024 * 1024 || !/\.(pdf|png|jpe?g)$/i.test(uploadFile)) {
    throw new Error('เอกสารต้องเป็น PDF/PNG/JPG/JPEG มีข้อมูลและไม่เกิน 20 MB');
  }
  for (const phone of [scenario.leadPhone, scenario.insuredHomePhone, scenario.emergency.phone]) {
    if (!/^\d{10}$/.test(phone)) throw new Error('กำหนดเบอร์โทรทดสอบเป็นตัวเลข 10 หลัก');
  }
  return { settings, scenario, uploadFile, baseURL: url.origin };
}
