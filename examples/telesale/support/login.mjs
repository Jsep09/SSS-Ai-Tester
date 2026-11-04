import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { workspace, readConfig } from './config.mjs';

export const skillDirectory = process.env.SSD_TESTER_SKILL || fileURLToPath(new URL('../../../skills/ssd-ai-tester/', import.meta.url));
export async function manualLogin({ headed = false } = {}) {
  const { baseURL } = await readConfig();
  const { loadRuntime } = await import(pathToFileURL(path.join(skillDirectory, 'scripts/runtime.mjs')).href);
  const runtime = await loadRuntime();
  const { chromium } = runtime.require('@playwright/test');
  const browser = await chromium.launch({ channel: 'chromium', headless: false });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(baseURL + '/lead', { waitUntil: 'domcontentloaded' });
    console.log('LOGIN_WAIT: กรุณา Login ในหน้าต่าง Chromium ที่เปิดอยู่ บอทจะรอไม่เกิน 10 นาที ไม่ต้องส่งรหัสผ่านในแชต');
    await page.getByRole('button', { name: 'เพิ่มหลีด', exact: true }).waitFor({ state: 'visible', timeout: 600_000 });
    await page.waitForURL(url => url.origin === baseURL && url.pathname === '/lead');
    const authDirectory = path.join(workspace, 'playwright/.auth');
    await mkdir(authDirectory, { recursive: true });
    await context.storageState({ path: path.join(authDirectory, 'storage-state.json') });
    // OIDC บางระบบเก็บ session ใน sessionStorage ซึ่ง storageState ไม่รวมให้
    // เก็บเฉพาะในโฟลเดอร์ .auth ของเครื่อง ไม่พิมพ์ค่าและไม่แนบรายงาน
    const values = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    await writeFile(path.join(authDirectory, 'session-storage.json'), JSON.stringify({ origin: baseURL, values }), 'utf8');
    console.log('LOGIN_READY: เข้าถึงหน้าหลีดแล้ว บอทจะทำงานต่อแบบ ' + (headed ? 'เปิดหน้าต่างให้เห็นการทำงาน' : 'headless'));
  } finally {
    await browser.close();
  }
}
