import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWorkspace, runWorkspace } from '../skills/ssd-ai-tester/scripts/workspace.mjs';
import { renderReport } from '../skills/ssd-ai-tester/scripts/report.mjs';
import { configureContext } from '../skills/ssd-ai-tester/scripts/context.mjs';

test('quick executes unchanged scripts with unique run data, final evidence, truthful results and deferred reports', async t => {
  const base = path.resolve('.test-tmp');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'quick-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await createWorkspace(root, { title: 'Quick integration', url: 'http://127.0.0.1', environment: 'DEMO' });
  const configPath = path.join(root, 'ssd-workspace.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  config.mode = 'demo';
  await fs.writeFile(configPath, JSON.stringify(config));
  const spec = path.join(root, 'tests/ready.spec.mjs');
  await fs.writeFile(spec, `
import { test, expect } from '../fixtures.mjs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const details = { requirement: 'Demo order confirmation must match its reference', preconditions: 'Local simulated data only', expected: 'Confirmation matches the generated reference', steps: [{ action: 'Confirm simulated order', expected: 'Show matching reference' }], defect: { severity: 'medium', impact: 'Incorrect confirmation', nextAction: 'Inspect assertion' } };
test('ready order', async ({ page, business, run }) => {
  business(details);
  await test.step('Confirm demo order', async () => {
    await page.setContent('<label>Reference<input /></label><button>Confirm</button><output></output>');
    await page.locator('button').evaluate(button => button.onclick = () => document.querySelector('output').textContent = document.querySelector('input').value);
    await page.getByLabel('Reference').fill(run.id);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('output')).toHaveText(run.id);
    await writeFile(path.join(run.dataDirectory, 'reference.json'), JSON.stringify({ id: run.id }));
  });
});
test('wrong order', async ({ page, business }) => {
  business(details);
  await page.setContent('<h1>Wrong reference</h1>');
  await expect(page.getByRole('heading')).toHaveText('Correct reference', { timeout: 150 });
});
test('unverified order', async ({ page }) => {
  await page.setContent('<h1>No business metadata</h1>');
});
`);
  const original = await fs.readFile(spec, 'utf8');
  const first = await runWorkspace(root, { quick: true, grep: 'ready order$' });
  const second = await runWorkspace(root, { quick: true, grep: 'ready order$' });
  assert.equal(first.code, 0);
  assert.equal(second.code, 0);
  assert.equal(second.summary.status, 'passed');
  assert.notEqual(first.summary.runId, second.summary.runId);
  assert.notEqual(first.runDirectory, second.runDirectory);
  assert.equal(await fs.readFile(spec, 'utf8'), original, 'No source editing is needed between runs');
  for (const result of [first, second]) {
    const directory = result.runDirectory;
    const state = JSON.parse(await fs.readFile(path.join(directory, 'data/reference.json'), 'utf8'));
    const runInfo = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
    const results = JSON.parse(await fs.readFile(path.join(directory, 'results.json'), 'utf8'));
    assert.equal(state.id, result.summary.runId);
    assert.equal(runInfo.runId, result.summary.runId);
    assert.equal(results.runId, result.summary.runId);
    assert.equal(results.cases[0].evidence.length, 1);
    assert.equal(result.summary.tests[0].steps[0].title, 'Confirm demo order');
    assert.ok(result.summary.timings.runnerMs >= result.summary.timings.testsMs);
    await assert.rejects(fs.access(path.join(directory, 'report.html')));
    await assert.rejects(fs.access(path.join(directory, 'playwright-report')));
    const generated = await import(pathToFileURL(path.join(directory, 'playwright.config.mjs')).href);
    assert.equal(generated.default.workers, 1);
    assert.equal(generated.default.retries, 0);
    assert.equal(generated.default.use.trace, 'off');
    assert.equal(generated.default.use.headless, true);
    assert.equal((await fs.readdir(path.join(directory, 'artifacts'), { recursive: true })).some(name => name.endsWith('trace.zip')), false);
  }
  await renderReport(first.runDirectory);
  const deferred = JSON.parse(await fs.readFile(path.join(first.runDirectory, 'report.json'), 'utf8'));
  assert.equal(deferred.metrics.counts.passed, 1);
  assert.match(await fs.readFile(path.join(first.runDirectory, 'report.html'), 'utf8'), /data:image\/png;base64,/);
  const wrong = await runWorkspace(root, { quick: true, grep: 'wrong order$' });
  assert.equal(wrong.code, 1);
  assert.equal(wrong.summary.status, 'failed');
  assert.equal(wrong.summary.counts.failed, 1);
  const unverified = await runWorkspace(root, { quick: true, grep: 'unverified order$' });
  assert.equal(unverified.code, 0);
  assert.equal(unverified.summary.status, 'blocked', 'A zero process exit does not fabricate a business pass');
  await fs.writeFile(path.join(root, '.ssd/run.lock'), 'existing');
  await assert.rejects(runWorkspace(root, { quick: true }), /ห้ามรันซ้อน/);
  await fs.unlink(path.join(root, '.ssd/run.lock'));
  await assert.rejects(runWorkspace(root, { headed: true, headless: true }), /อย่างใดอย่างหนึ่ง/);
  await fs.writeFile(path.join(root, 'source.txt'), 'unreviewed');
  await configureContext(root, [path.join(root, 'source.txt')]);
  await assert.rejects(runWorkspace(root, { quick: true }), /Code context/);
});

