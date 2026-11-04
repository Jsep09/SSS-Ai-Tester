import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { workspace } from './config.mjs';
import { skillDirectory } from './login.mjs';

const directory = await realpath(process.argv[2]);
const allowedRoot = await realpath(path.join(workspace, 'runs'));
if (!directory.startsWith(allowedRoot + path.sep)) throw new Error('ตรวจได้เฉพาะรายงานภายใน runs ของ workspace นี้');
const { loadRuntime } = await import(pathToFileURL(path.join(skillDirectory, 'scripts/runtime.mjs')).href);
const runtime = await loadRuntime();
const { chromium, expect } = runtime.require('@playwright/test');
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.goto(pathToFileURL(path.join(directory, 'report.html')).href);
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toContainText('Telesale');
  const images = await page.getByRole('img').all();
  for (const image of images) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await title.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(directory, 'report-preview.png') });
  console.log('REPORT_RENDER_OK: embedded images=' + images.length);
} finally {
  await browser.close();
}
