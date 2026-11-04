import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { configureContext, contextStatus, reviewContext, requireCurrentContext } from '../skills/ssd-ai-tester/scripts/context.mjs';
import { createWorkspace, readWorkspace, runWorkspace } from '../skills/ssd-ai-tester/scripts/workspace.mjs';

const checks = fileURLToPath(new URL('../../.release-checks/', import.meta.url));
await fs.mkdir(checks, { recursive: true });
async function workspace() {
  const directory = await fs.mkdtemp(path.join(checks, 'context-'));
  await createWorkspace(directory, { title: 'Context test', url: 'http://localhost:1', environment: 'fixture' });
  return (await readWorkspace(directory)).root;
}
async function writeReview(root, hash, overrides = {}) {
  const file = path.join(root, 'context/review.json');
  await fs.writeFile(file, JSON.stringify({ contextHash: hash, summary: 'Form validation',
    filesRead: ['src/form.tsx'], impact: 'Update amount validation test',
    deployment: 'Unknown revision; localhost fixture only', assumptions: [], ...overrides }));
  return file;
}

test('legacy workspace remains black-box; new context directory is ignored by git', async () => {
  const root = await workspace();
  assert.equal((await requireCurrentContext(root)).mode, 'black-box');
  assert.match(await fs.readFile(path.join(root, '.gitignore'), 'utf8'), /context\//);
});

test('same filename and same length with new content blocks runner before browser/runtime launch', async () => {
  const root = await workspace();
  const bundle = path.join(root, 'context/bundle.xml');
  await fs.writeFile(bundle, '<file>AAA</file>');
  const initial = await configureContext(root, [bundle]);
  assert.equal(initial.status, 'review-required');
  await assert.rejects(runWorkspace(root), /Code context/);
  const reviewFile = await writeReview(root, initial.hash);
  await reviewContext(root, reviewFile);
  assert.equal((await requireCurrentContext(root)).status, 'ready');
  await fs.writeFile(bundle, '<file>BBB</file>');
  const next = await contextStatus(root);
  assert.notEqual(next.hash, initial.hash);
  assert.deepEqual(next.changedFiles, [path.relative(root, bundle)]);
  await assert.rejects(runWorkspace(root), /Code context/);
  assert.deepEqual(await fs.readdir(path.join(root, 'runs')), []);
  await assert.rejects(fs.access(path.join(root, '.ssd/run.lock')));
  await assert.rejects(reviewContext(root, reviewFile), /contextHash/);
  await reviewContext(root, await writeReview(root, next.hash));
  assert.equal((await requireCurrentContext(root)).hash, next.hash);
});

test('re-registering unchanged inputs reuses review; replacement and removed inputs require review', async () => {
  const root = await workspace();
  const first = path.join(root, 'first.json');
  const second = path.join(root, 'second.md');
  await fs.writeFile(first, '{"code":"v1"}');
  await fs.writeFile(second, '# v2');
  const initial = await configureContext(root, [first]);
  await reviewContext(root, await writeReview(root, initial.hash));
  assert.equal((await configureContext(root, [first, first])).status, 'ready');
  const replacement = await configureContext(root, [second]);
  assert.equal(replacement.status, 'review-required');
  assert.deepEqual(replacement.changedFiles.sort(), ['first.json', 'second.md']);
  assert.equal((await fs.readFile(first, 'utf8')), '{"code":"v1"}');
});

test('multiple source files detect dependency change, preserve review for unchanged files', async () => {
  const root = await workspace();
  const page = path.join(root, 'page.tsx');
  const validation = path.join(root, 'validation.ts');
  await fs.writeFile(page, 'export const Page = 1;');
  await fs.writeFile(validation, 'export const max = 100;');
  const initial = await configureContext(root, [page, validation]);
  await reviewContext(root, await writeReview(root, initial.hash));
  await fs.writeFile(validation, 'export const max = 200;');
  assert.deepEqual((await contextStatus(root)).changedFiles, ['validation.ts']);
  await fs.unlink(validation);
  await assert.rejects(requireCurrentContext(root), /ENOENT/);
});

test('invalid review cannot mark context ready or override authoritative snapshot', async () => {
  const root = await workspace();
  const input = path.join(root, 'bundle.txt');
  await fs.writeFile(input, 'source');
  const status = await configureContext(root, [input]);
  await assert.rejects(reviewContext(root, await writeReview(root, status.hash, { filesRead: [] })), /filesRead/);
  await assert.rejects(reviewContext(root, await writeReview(root, status.hash, { impact: '' })), /impact/);
  assert.equal((await contextStatus(root)).status, 'review-required');
  const ready = await reviewContext(root, await writeReview(root, status.hash, { hash: 'forged', files: [], reviewedAt: 'forged' }));
  assert.equal(ready.reviewed.hash, status.hash);
  assert.equal(ready.reviewed.files.length, 1);
  assert.notEqual(ready.reviewed.reviewedAt, 'forged');
});

test('empty or missing context input fails instead of silently becoming black-box', async () => {
  const root = await workspace();
  await assert.rejects(configureContext(root, []), /อย่างน้อยหนึ่งไฟล์/);
  await assert.rejects(configureContext(root, [path.join(root, 'missing.xml')]), /ENOENT/);
});

test('reviewed context runs a real headless fixture and records the exact context in run.json', async () => {
  const root = await workspace();
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<h1>Context fixture</h1><label>Amount<input type="number" max="100"></label>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const marker = path.join(root, 'ssd-workspace.json');
    const config = JSON.parse(await fs.readFile(marker, 'utf8'));
    config.url = 'http://127.0.0.1:' + server.address().port;
    config.mode = 'demo';
    await fs.writeFile(marker, JSON.stringify(config));
    const source = path.join(root, 'context/fixture.txt');
    await fs.writeFile(source, 'Amount input has max=100');
    const status = await configureContext(root, [source]);
    await reviewContext(root, await writeReview(root, status.hash));
    await fs.writeFile(path.join(root, 'tests/amount.spec.mjs'), `
import { test, expect } from '../fixtures.mjs';
test('amount limit from reviewed fixture code', async ({ page, business }) => {
  business({ requirement: 'Fixture amount maximum is 100', priority: 'low', preconditions: 'Local demo server',
    steps: [{ action: 'Enter 101', expected: 'Amount exceeds the maximum' }], expected: 'Browser reports range overflow' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Context fixture' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('101');
  await expect(page.getByRole('spinbutton', { name: 'Amount' })).toHaveAttribute('max', '100');
  expect(await page.getByRole('spinbutton', { name: 'Amount' }).evaluate(element => element.validity.rangeOverflow)).toBe(true);
});
`);
    const result = await runWorkspace(root);
    assert.equal(result.code, 0);
    const recorded = JSON.parse(await fs.readFile(path.join(result.runDirectory, 'run.json'), 'utf8'));
    assert.equal(recorded.context.hash, status.hash);
    assert.equal(recorded.context.status, 'ready');
    assert.equal(recorded.context.reviewed.summary, 'Form validation');
    await fs.access(path.join(result.runDirectory, 'report.html'));
    assert.ok((await fs.readdir(path.join(result.runDirectory, 'screenshots'))).length > 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
