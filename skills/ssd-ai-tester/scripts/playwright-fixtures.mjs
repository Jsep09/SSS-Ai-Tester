import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadRuntime } from './runtime.mjs';

const runtime = await loadRuntime();
const playwright = await import(pathToFileURL(runtime.module).href);
export const expect = playwright.expect;
export const test = playwright.test.extend({
  run: async ({}, use) => {
    const id = process.env.SSD_TESTER_RUN_ID;
    const directory = process.env.SSD_TESTER_RUN;
    if (!id || !directory) throw new Error('run fixture ต้องเรียกผ่าน workspace.mjs run');
    await use({ id, directory, dataDirectory: path.join(directory, 'data') });
  },
  business: async ({}, use, testInfo) => {
    await use(details => {
      if (!details || typeof details !== 'object') throw new Error('business ต้องรับข้อมูลกรณีทดสอบ');
      testInfo.annotations.push({ type: 'ssd-case', description: JSON.stringify(details) });
    });
  },
  _ssdEvidence: [async ({ page, headless }, use, testInfo) => {
    testInfo.annotations.push({ type: 'ssd-browser', description: JSON.stringify({ headless }) });
    await use();
    if (!page.isClosed()) {
      try {
        const bytes = await page.screenshot({ fullPage: process.env.SSD_TESTER_QUICK !== '1', timeout: 5000 });
        await testInfo.attach('ssd-result-' + new Date().toISOString(), { body: bytes, contentType: 'image/png' });
      } catch (error) {
        testInfo.annotations.push({ type: 'ssd-evidence-error', description: error.message });
      }
    }
  }, { auto: true }],
});
