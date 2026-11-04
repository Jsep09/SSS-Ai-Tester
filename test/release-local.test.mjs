import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseLocal, nextVersion, releaseChangelog } from '../scripts/release-local.mjs';
const project = fileURLToPath(new URL('../', import.meta.url));
async function fixture() {
  const base = path.join(project, '.test-tmp/local-release-tests');
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'run-'));
  await fs.mkdir(path.join(root, 'skills/ssd-skill-list/references'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'ssd-ai-tester', version: '0.6.1' }));
  await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n- New command\n\n## [0.6.1]\n- Previous release\n');
  await fs.writeFile(path.join(root, 'skills/ssd-skill-list/references/catalog.json'), '[]');
  return root;
}
test('local release accepts increments and rejects duplicate/lower versions', () => {
  assert.equal(nextVersion('0.6.1'), '0.6.2');
  assert.equal(nextVersion('0.6.1', 'minor'), '0.7.0');
  assert.equal(nextVersion('0.6.1', 'major'), '1.0.0');
  assert.equal(nextVersion('0.6.1', '0.8.0'), '0.8.0');
  for (const value of ['0.6.1','0.5.9','bad']) assert.throws(() => nextVersion('0.6.1', value));
});
test('local release moves notes to dated release and preserves history', () => {
  const output = releaseChangelog('# Changelog\n\n## [Unreleased]\n- Feature\n\n## [0.6.1]\n- Old\n', '0.6.2', '2026-11-04');
  assert.match(output, /## Unreleased\r\n\r\n## \[0.6.2\] - 2026-11-04\r\n\r\n- Feature/);
  assert.match(output, /## \[0.6.1\]\r\n- Old/);
});
test('dry-run never changes files or executes checks', async () => {
  const root = await fixture();
  const original = await fs.readFile(path.join(root, 'package.json'), 'utf8');
  const result = await releaseLocal(root, { dryRun: true, run() { throw new Error('must not run'); } });
  assert.equal(result.version, '0.6.2');
  assert.equal(await fs.readFile(path.join(root, 'package.json'), 'utf8'), original);
});
test('one run checks before bump then verifies archives with Bangkok date', async () => {
  const root = await fixture();
  const steps = [];
  const result = await releaseLocal(root, { now: new Date('2026-11-03T18:00:00Z'), async run(directory, script) {
    steps.push(script);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'package.json'))).version, script === 'scripts/check-release.mjs' ? '0.6.1' : '0.6.2');
    if (script === 'scripts/release.mjs') {
      await fs.mkdir(path.join(directory, 'dist'));
      for (const extension of ['zip','tgz']) await fs.writeFile(path.join(directory, 'dist/ssd-ai-tester-0.6.2.' + extension), 'fixture archive');
    }
  } });
  assert.deepEqual(steps, ['scripts/check-release.mjs','scripts/release.mjs']);
  assert.equal(result.version, '0.6.2');
  assert.match(await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8'), /2026-11-04/);
  await assert.rejects(fs.access(path.join(root, '.test-tmp/local-release.lock')));
});
test('packing failure restores source and removes only incomplete new archives', async () => {
  const root = await fixture();
  const skill = path.join(root, 'skills/ssd-ai-tester');
  await fs.mkdir(path.join(skill, 'references'), { recursive: true });
  await fs.writeFile(path.join(root, 'skills/ssd-skill-list/references/catalog.json'), '[{"name":"ssd-ai-tester"}]');
  await fs.writeFile(path.join(skill, 'SKILL.md'), 'old instructions');
  await fs.writeFile(path.join(skill, 'references/release.json'), '{"version":"0.6.1"}');
  const original = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
  await assert.rejects(releaseLocal(root, { async run(directory, script) {
    if (script === 'scripts/release.mjs') {
      await fs.mkdir(path.join(directory, 'dist'));
      await fs.writeFile(path.join(directory, 'dist/ssd-ai-tester-0.6.2.zip'), 'incomplete');
      await fs.writeFile(path.join(skill, 'SKILL.md'), 'changed');
      throw new Error('packing failed');
    }
  } }), /packing failed/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version, '0.6.1');
  assert.equal(await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8'), original);
  assert.equal(await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8'), 'old instructions');
  await assert.rejects(fs.access(path.join(root, 'dist/ssd-ai-tester-0.6.2.zip')));
});
test('failed checks keep version and existing archives are not overwritten', async () => {
  const root = await fixture();
  await assert.rejects(releaseLocal(root, { run() { throw new Error('checks failed'); } }), /checks failed/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version, '0.6.1');
  await fs.mkdir(path.join(root, 'dist'));
  const archive = path.join(root, 'dist/ssd-ai-tester-0.6.2.zip');
  await fs.writeFile(archive, 'existing');
  await assert.rejects(releaseLocal(root), /มีแพ็กเกจ/);
  assert.equal(await fs.readFile(archive, 'utf8'), 'existing');
});
