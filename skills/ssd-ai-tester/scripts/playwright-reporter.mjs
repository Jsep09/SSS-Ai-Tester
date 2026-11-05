import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { renderReport, validateRun } from './report.mjs';

export default class BusinessReporter {
  constructor() { this.errors = []; this.results = new Map(); this.steps = new Map(); }
  onBegin(config, suite) { this.tests = suite.allTests(); this.startedAt = new Date().toISOString(); }
  onError(error) { this.errors.push(error.message || String(error)); }
  onTestEnd(test, result) { this.results.set(test.id, result); }
  onStepEnd(test, result, step) {
    if (step.category !== 'test.step') return;
    const steps = this.steps.get(test.id) || [];
    steps.push({ title: step.title, durationMs: step.duration, status: step.error ? 'failed' : 'passed' });
    this.steps.set(test.id, steps);
  }
  async onEnd(fullResult) {
    if (process.env.SSD_TESTER_LIST === '1') return;
    const directory = process.env.SSD_TESTER_RUN;
    if (!directory) throw new Error('ไม่มี SSD_TESTER_RUN ให้ใช้คำสั่ง run ผ่าน workspace.mjs');
    const config = JSON.parse(await fs.readFile(path.join(process.env.SSD_TESTER_WORKSPACE, 'ssd-workspace.json'), 'utf8'));
    const quick = process.env.SSD_TESTER_QUICK === '1';
    const browserModes = new Set();
    const cases = [];
    const raw = [];
    for (const [index, test] of (this.tests || []).entries()) {
      const result = this.results.get(test.id);
      const annotations = test.annotations || [];
      try {
        const browser = JSON.parse(annotations.find(annotation => annotation.type === 'ssd-browser')?.description || 'null');
        if (typeof browser?.headless === 'boolean') browserModes.add(browser.headless);
      } catch {}
      let business;
      try { business = JSON.parse(annotations.find(annotation => annotation.type === 'ssd-case')?.description || 'null'); } catch {}
      const metadataOk = business && ['requirement', 'preconditions', 'expected'].every(field => typeof business[field] === 'string' && business[field].trim()) && Array.isArray(business.steps) && business.steps.length && business.steps.every(step => step.action && step.expected);
      const item = {
        id: 'TC-' + String(index + 1).padStart(3, '0'), title: test.title,
        requirement: business?.requirement || 'ยังไม่ได้เชื่อมโยงเงื่อนไขธุรกิจ',
        preconditions: business?.preconditions || 'ยังไม่ได้บันทึกเงื่อนไขก่อนทดสอบ',
        priority: ['high', 'medium', 'low'].includes(business?.priority) ? business.priority : 'medium',
        steps: metadataOk ? business.steps : [{ action: 'เรียกสคริปต์ ' + path.basename(test.location.file), expected: 'ตรวจผลตามเกณฑ์ธุรกิจที่ระบุในสคริปต์' }],
        expected: business?.expected || 'ยังไม่ได้บันทึกผลที่คาดหวัง',
        actual: '', status: 'blocked', reason: '', evidence: [],
        automation: { status: result?.status || 'not-run', file: test.location.file, line: test.location.line },
      };
      const attachments = result?.attachments || [];
      const resultImages = attachments.filter(attachment => attachment.name.startsWith('ssd-result-') && ['image/png', 'image/jpeg'].includes(attachment.contentType));
      for (const [imageIndex, attachment] of (resultImages.length ? resultImages : attachments).entries()) {
        if (!['image/png', 'image/jpeg'].includes(attachment.contentType)) continue;
        let bytes = attachment.body;
        if (!bytes && attachment.path) {
          const real = await fs.realpath(attachment.path);
          const relative = path.relative(directory, real);
          if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
          bytes = await fs.readFile(real);
        }
        if (!bytes || bytes.length > 10 * 1024 * 1024) continue;
        const filename = item.id + '-' + imageIndex + (attachment.contentType === 'image/png' ? '.png' : '.jpg');
        await fs.writeFile(path.join(directory, 'screenshots', filename), bytes, { flag: 'wx' });
        const timestamp = attachment.name.startsWith('ssd-result-') ? attachment.name.slice('ssd-result-'.length) : attachment.path ? (await fs.stat(attachment.path)).mtime.toISOString() : new Date().toISOString();
        item.evidence.push({ path: 'screenshots/' + filename, caption: 'ภาพผลจากสคริปต์: ' + test.title, capturedAt: timestamp });
      }
      if (!result || !result.status) { item.status = 'not-run'; item.reason = 'ไม่ได้เริ่มกรณีนี้ก่อนรอบทดสอบสิ้นสุด'; }
      else if (result.status === 'skipped') { item.status = 'skipped'; item.reason = annotations.find(annotation => ['skip', 'fixme'].includes(annotation.type))?.description || 'สคริปต์กำหนดให้ข้ามกรณีนี้'; }
      else if (!metadataOk) item.reason = 'สคริปต์ทำงานแล้ว แต่ยังขาดคำอธิบายเกณฑ์และขั้นตอนทดสอบสำหรับสรุป BA/QA ให้ Codex เพิ่มข้อมูลและตรวจจุดยืนยันผลในสคริปต์';
      else if (!item.evidence.length) item.reason = 'ไม่มีภาพยืนยันผลจากรอบนี้ ตรวจรายละเอียดทางเทคนิคก่อนสรุปผลธุรกิจ';
      else if (result.status === 'passed' && test.expectedStatus === 'passed') {
        item.status = 'passed'; item.actual = 'จุดตรวจผลอัตโนมัติในสคริปต์ผ่านตามเงื่อนไขที่เขียนไว้ ผลนี้ครอบคลุมเฉพาะสิ่งที่สคริปต์ตรวจสอบ';
      } else if (test.expectedStatus !== 'passed') item.reason = 'สคริปต์กำหนด expected failure ต้องให้ QA ตรวจสอบก่อนสรุปผลธุรกิจ';
      else {
        const assertionFailure = result.status === 'failed' && (result.errors || []).some(error => /expect\(|expect\.|AssertionError/.test(error.message || ''));
        if (assertionFailure && business.defect && ['critical', 'high', 'medium', 'low'].includes(business.defect.severity) && business.defect.impact && business.defect.nextAction) {
          item.status = 'failed'; item.actual = 'ผลตรวจสอบในสคริปต์ไม่ตรงกับค่าที่คาดหวัง ดูภาพและรายละเอียด Playwright เพื่อยืนยันจุดผิดพลาด'; item.defect = business.defect;
        } else item.reason = 'สคริปต์หยุดหรือมีข้อผิดพลาดที่ยังยืนยันเป็นปัญหาธุรกิจไม่ได้ ให้ QA ตรวจรายงาน Playwright และทดสอบจุดนี้ซ้ำ';
      }
      raw.push({ id: item.id, title: test.title, status: result?.status, errors: result?.errors || [], duration: result?.duration, steps: this.steps.get(test.id) || [] });
      cases.push(item);
    }
    if (!cases.length) cases.push({ id: 'RUN-ERROR', title: 'ไม่สามารถเริ่มกรณีทดสอบได้', requirement: 'เตรียมสคริปต์ให้พร้อมก่อนตรวจระบบ', priority: 'high', preconditions: 'Playwright และสคริปต์ต้องโหลดได้', steps: [{ action: 'เริ่มรันทดสอบ', expected: 'พบและรันกรณีทดสอบได้' }], expected: 'พบกรณีทดสอบอย่างน้อยหนึ่งรายการ', actual: '', status: 'blocked', reason: 'ไม่พบกรณีทดสอบหรือโหลดสคริปต์ไม่สำเร็จ ดู runner.log และ technical-results.json', evidence: [] });
    const headless = browserModes.size > 1 ? null : browserModes.size ? [...browserModes][0] : process.env.SSD_TESTER_HEADLESS !== '0';
    const browserLabel = headless === null ? 'headed/headless (mixed)' : headless ? 'headless' : 'headed';
    const run = { schemaVersion: 1, runId: process.env.SSD_TESTER_RUN_ID || crypto.randomUUID(), title: config.title, url: config.url, environment: config.environment, startedAt: this.startedAt || new Date().toISOString(), finishedAt: fullResult.status === 'interrupted' ? null : new Date().toISOString(), tester: 'Playwright Test / Chromium ' + browserLabel, execution: { engine: 'playwright-test', isolation: 'browser-context', headless }, mode: config.mode === 'demo' ? 'demo' : 'real', scope: ['กรณีที่ Playwright เลือกรันในรอบนี้'], limitations: ['รายงานอัตโนมัติอ้างอิงจุดตรวจผลและข้อมูลธุรกิจในสคริปต์ ยังไม่ใช่การรับรองจากผู้ตรวจด้วยสายตา', ...(quick ? ['quick: เก็บภาพสุดท้ายและผล JSON; ไม่เก็บ trace หรือสร้างรายงาน HTML/Markdown อัตโนมัติ'] : []), ...(this.errors.length ? ['มีข้อผิดพลาดระดับการรัน ให้ตรวจ technical-results.json'] : [])], cases };
    await fs.writeFile(path.join(directory, 'technical-results.json'), JSON.stringify({ status: fullResult.status, errors: this.errors, tests: raw }, null, 2));
    await fs.writeFile(path.join(directory, 'results.json'), JSON.stringify(run, null, 2));
    await fs.writeFile(path.join(directory, 'test-plan.md'), '# ขอบเขตจากสคริปต์ในรอบนี้\n\n' + cases.map(item => '- ' + item.id + ' ' + item.title + ': ' + item.requirement).join('\n'));
    if (!quick) {
      await renderReport(directory);
      console.log('รายงานภาษาไทย: ' + path.join(directory, 'report.html'));
    }
    const { counts } = await validateRun(directory, run, { embedImages: false });
    const status = counts.failed ? 'failed' : counts.blocked || counts['not-run'] || this.errors.length || fullResult.status !== 'passed' ? 'blocked' : counts.skipped ? 'incomplete' : 'passed';
    const summary = { schemaVersion: 1, runId: run.runId, status, automationStatus: fullResult.status, counts, total: cases.length, quick, headless, timings: { testsMs: raw.reduce((sum, item) => sum + (item.duration || 0), 0), playwrightMs: Date.now() - Date.parse(run.startedAt) }, tests: raw.map(({ id, title, steps }) => ({ id, title, steps })), resultsFile: 'results.json', reportFile: quick ? null : 'report.html' };
    await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
  }
}
