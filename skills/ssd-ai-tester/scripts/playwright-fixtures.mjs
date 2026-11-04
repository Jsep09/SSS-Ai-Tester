import { pathToFileURL } from 'node:url';
import { loadRuntime } from './runtime.mjs';

const runtime = await loadRuntime();
const playwright = await import(pathToFileURL(runtime.module).href);
export const expect = playwright.expect;
export const test = playwright.test.extend({
  business: async ({}, use, testInfo) => {
    await use(details => {
      if (!details || typeof details !== 'object') throw new Error('business ต้องรับข้อมูลกรณีทดสอบ');
      testInfo.annotations.push({ type: 'ssd-case', description: JSON.stringify(details) });
    });
  },
  _ssdEvidence: [async ({ page }, use, testInfo) => {
    await use();
    if (!page.isClosed()) {
      try {
        const bytes = await page.screenshot({ fullPage: true, timeout: 5000 });
        await testInfo.attach('ssd-result-' + new Date().toISOString(), { body: bytes, contentType: 'image/png' });
      } catch (error) {
        testInfo.annotations.push({ type: 'ssd-evidence-error', description: error.message });
      }
    }
  }, { auto: true }],
});
