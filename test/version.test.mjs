import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installSkills } from '../lib/install.mjs';
import { getVersionInfo, formatVersionInfo, compareVersions } from '../skills/ssd-ai-tester/scripts/version.mjs';
import { parseReleaseNotes, syncRelease } from '../scripts/sync-release.mjs';
import { getCatalog, formatCatalog } from '../skills/ssd-skill-list/scripts/catalog.mjs';
import { checkVersionNotice } from '../skills/ssd-ai-tester/scripts/version-notice.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = path.join(root, '.test-tmp/release-checks');
await fs.mkdir(checks, { recursive: true });
async function fixture() {
  const directory = await fs.mkdtemp(path.join(checks, 'version-'));
  const source = path.join(directory, 'package');
  const installed = path.join(directory, 'installed');
  await fs.mkdir(source);
  await fs.cp(path.join(root, 'skills'), path.join(source, 'skills'), { recursive: true });
  async function prepare(version) {
    await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'ssd-ai-tester', version }));
    await fs.writeFile(path.join(source, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n- Not released\n\n## 0.6.1\n- Automatic update notices\n\n## [0.6.0](https://example.test/compare) - 2026-11-04\n### Features\n- Version commands\n\n## 0.5.1\n- Fix context\n\n## [0.5.0]\n- Code-first\n');
    await syncRelease(source);
  }
  return { source, installed, prepare, stateDirectory: path.join(directory, 'notice-state') };
}
function cli(args) {
  return spawnSync(process.execPath, [path.join(root, 'bin/cli.mjs'), ...args], { encoding: 'utf8', windowsHide: true });
}

test('first install does not fabricate session or previous version; CLI aliases and catalog expose commands', async () => {
  const f = await fixture();
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const info = await getVersionInfo(f.installed);
  assert.equal(info.installedVersion, '0.6.0');
  assert.equal(info.previousVersion, null);
  assert.equal(info.sessionVersion, null);
  assert.equal(info.sessionStatus, 'unknown');
  assert.equal(info.consistent, true);
  assert.deepEqual(info.updates.map(item => item.version), ['0.6.0']);
  for (const command of ['version', '--version', '-v']) {
    const output = cli([command, '--skills-dir', f.installed, '--json']);
    assert.equal(output.status, 0, output.stderr);
    assert.equal(JSON.parse(output.stdout).sessionVersion, null);
  }
  const catalog = formatCatalog(await getCatalog(path.join(f.source, 'skills')));
  assert.match(catalog, /\$ssd-ai-tester version/);
  assert.match(catalog, /\$ssd-ai-tester update-info/);
});

test('upgrade remembers previous install, includes all intervening releases and survives reinstall', async () => {
  const f = await fixture();
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const info = await getVersionInfo(f.installed, { sessionVersion: '0.5.0' });
  assert.equal(info.previousVersion, '0.5.0');
  assert.equal(info.sessionStatus, 'older-session');
  assert.deepEqual(info.updates.map(item => item.version), ['0.6.0', '0.5.1']);
  assert.match(formatVersionInfo(info, true), /Version commands/);
  assert.doesNotMatch(formatVersionInfo(info, true), /Not released/);
  await installSkills(f.source, f.installed);
  assert.equal((await getVersionInfo(f.installed)).previousVersion, '0.5.0');
  // Installed helper remains usable after the source package is moved away.
  await fs.rename(f.source, f.source + '-moved');
  const helper = path.join(f.installed, 'ssd-ai-tester/scripts/version.mjs');
  const output = spawnSync(process.execPath, [helper, 'update-info', '--json'], { encoding: 'utf8', windowsHide: true });
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout).updates.map(item => item.version), ['0.6.0', '0.5.1']);
});

test('caller session is reported explicitly, from override narrows notes, and downgrade is identified', async () => {
  const f = await fixture();
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const equal = await getVersionInfo(f.installed, { sessionVersion: '0.6.0' });
  assert.equal(equal.sessionStatus, 'same-version-reported');
  assert.equal(equal.sessionVersionSource, 'provided-by-caller');
  const from = await getVersionInfo(f.installed, { sessionVersion: '0.5.0', from: '0.5.1' });
  assert.deepEqual(from.updates.map(item => item.version), ['0.6.0']);
  assert.equal((await getVersionInfo(f.installed, { sessionVersion: '0.7.0' })).sessionStatus, 'newer-session');
  const reversed = await getVersionInfo(f.installed, { from: '0.7.0' });
  assert.equal(reversed.rangeNote, 'from-version-newer-than-installed');
  assert.deepEqual(reversed.updates, []);
  assert.deepEqual((await getVersionInfo(f.installed, { from: '0.6.0' })).updates, []);
  const output = cli(['update-info', '--skills-dir', f.installed, '--from', '0.5.1', '--json']);
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout).updates.map(item => item.version), ['0.6.0']);
});

test('mixed suite versions, extra/missing/modified files are not reported as a healthy installation', async () => {
  const f = await fixture();
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const marker = path.join(f.installed, 'ssd-get-started/.ssd-ai-tester-install.json');
  const manifest = JSON.parse(await fs.readFile(marker, 'utf8'));
  manifest.version = '0.5.0';
  await fs.writeFile(marker, JSON.stringify(manifest));
  assert.equal((await getVersionInfo(f.installed)).consistent, false);
  await fs.writeFile(path.join(f.installed, 'ssd-ai-tester/extra.txt'), 'local edit');
  await fs.unlink(path.join(f.installed, 'ssd-ai-tester/references/version.md'));
  const info = await getVersionInfo(f.installed);
  assert.equal(info.skills[0].integrity, 'modified');
  assert.ok(info.skills[0].modifiedFiles.includes('extra.txt'));
  assert.ok(info.skills[0].modifiedFiles.includes('references/version.md'));
  assert.equal(info.updateSummaryStatus, 'unavailable');
  await fs.writeFile(path.join(f.installed, 'ssd-ai-tester/references/release.json'), 'invalid JSON');
  assert.equal((await getVersionInfo(f.installed)).updateSummaryStatus, 'unavailable');
});

test('legacy install without bundled notes can show known installed version but unknown session/summary', async () => {
  const f = await fixture();
  await f.prepare('0.5.0');
  for (const name of ['ssd-ai-tester', 'ssd-get-started', 'ssd-skill-list']) await fs.unlink(path.join(f.source, 'skills', name, 'references/release.json'));
  await installSkills(f.source, f.installed);
  const info = await getVersionInfo(f.installed);
  assert.equal(info.installedVersion, '0.5.0');
  assert.equal(info.sessionStatus, 'unknown');
  assert.equal(info.updateSummaryStatus, 'unavailable');
  assert.equal(info.consistent, true);
});

test('uninstalled and invalid version requests do not fabricate success', async () => {
  const f = await fixture();
  const info = await getVersionInfo(f.installed);
  assert.equal(info.installedVersion, null);
  assert.equal(info.consistent, false);
  const output = cli(['version', '--skills-dir', f.installed, '--session-version', 'not-a-version']);
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /Semantic Version/);
});

test('installer rejects stale release metadata before modifying any installed skill', async () => {
  const f = await fixture();
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  await fs.writeFile(path.join(f.source, 'package.json'), JSON.stringify({ name: 'ssd-ai-tester', version: '0.6.0' }));
  await assert.rejects(installSkills(f.source, f.installed), /release metadata/);
  assert.equal((await getVersionInfo(f.installed)).installedVersion, '0.5.0');
});

test('release notes parser excludes Unreleased and supports dated and linked conventional headings', () => {
  assert.deepEqual(parseReleaseNotes('# Changelog\n## Unreleased\n- pending\n## [1.1.0](url) - today\n### Features\n- new\n# 1.0.0 — old\n- old'), [
    { version: '1.1.0', notes: ['### Features', '- new'] }, { version: '1.0.0', notes: ['- old'] }
  ]);
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.ok(compareVersions('1.0.0-rc.10', '1.0.0-rc.2') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0-rc.10') > 0);
  assert.equal(compareVersions('1.0.0+build.1', '1.0.0+build.2'), 0);
  assert.throws(() => compareVersions('1.0.0-01', '1.0.0'), /Semantic Version/);
});

test('old chat detects upgrade once, retains first observed session version and detects a later upgrade', async () => {
  const f = await fixture();
  const options = { stateDirectory: f.stateDirectory, sessionId: 'old-chat', sessionVersion: '0.5.0' };
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  assert.equal((await checkVersionNotice(f.installed, options)).notified, false);
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const update = await checkVersionNotice(f.installed, { ...options, sessionVersion: '0.6.0' });
  assert.equal(update.notified, true);
  assert.equal(update.info.sessionVersion, '0.5.0');
  for (const heading of ['Installed version', 'Session version', 'Update summary', 'สิ่งที่ต้องทำต่อ']) assert.ok(update.notification.includes('**' + heading + '**'));
  assert.match(update.notification, /Version commands/);
  assert.match(update.notification, /เปิดแชตใหม่/);
  assert.equal((await checkVersionNotice(f.installed, options)).notified, false);
  assert.equal((await checkVersionNotice(f.installed, { ...options, sessionId: 'new-chat', sessionVersion: '0.6.0' })).notified, false);
  await f.prepare('0.6.1');
  await installSkills(f.source, f.installed);
  const next = await checkVersionNotice(f.installed, options);
  assert.equal(next.notified, true);
  assert.equal(next.info.sessionVersion, '0.5.0');
  assert.match(next.notification, /Automatic update notices/);
});

test('legacy and unobserved sessions report unknown instead of using previous installed version as session evidence', async () => {
  const f = await fixture();
  const options = { stateDirectory: f.stateDirectory, sessionId: 'legacy-chat' };
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  assert.equal((await checkVersionNotice(f.installed, { ...options, sessionId: 'observed-unknown-chat' })).notified, false);
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  for (const sessionId of ['legacy-chat', 'observed-unknown-chat']) {
    const notice = await checkVersionNotice(f.installed, { ...options, sessionId });
    assert.equal(notice.notified, true);
    assert.equal(notice.info.sessionVersion, null);
    assert.equal(notice.info.fromVersion, '0.5.0');
    assert.match(notice.notification, /\*\*Session version\*\* — ไม่ทราบ/);
    assert.equal((await checkVersionNotice(f.installed, { ...options, sessionId })).notified, false);
  }
});

test('installed workspace helper emits update notice before starting next task without an explicit version call', async () => {
  const f = await fixture();
  const sessionId = 'old-runner-chat';
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  await checkVersionNotice(f.installed, { stateDirectory: f.stateDirectory, sessionId, sessionVersion: '0.5.0' });
  const helper = path.join(f.installed, 'ssd-ai-tester/scripts/workspace.mjs');
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  function runWorkspaceHelper(suffix) {
    return spawnSync(process.execPath, [helper, 'workspace', '--workspace', path.join(f.stateDirectory, 'qa-' + suffix),
      '--title', 'Version fixture', '--url', 'http://localhost:1', '--environment', 'fixture'], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, CODEX_THREAD_ID: sessionId, SSD_TESTER_VERSION_STATE: f.stateDirectory }
    });
  }
  const first = runWorkspaceHelper('first');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /\*\*Session version\*\* — 0.5.0/);
  assert.ok(first.stdout.indexOf('**Installed version**') < first.stdout.indexOf('สร้าง workspace'));
  const second = runWorkspaceHelper('second');
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(second.stdout, /\*\*Installed version\*\*/);
});

test('missing chat identity or unwritable state does not invent tracking or block work', async () => {
  const f = await fixture();
  await f.prepare('0.5.0');
  await installSkills(f.source, f.installed);
  await f.prepare('0.6.0');
  await installSkills(f.source, f.installed);
  const noId = await checkVersionNotice(f.installed, { sessionId: null, stateDirectory: f.stateDirectory });
  assert.equal(noId.sessionTracking, 'unavailable');
  assert.equal(noId.notified, true);
  await fs.writeFile(f.stateDirectory, 'not a directory');
  const blockedState = await checkVersionNotice(f.installed, { sessionId: 'state-error-chat', stateDirectory: f.stateDirectory });
  assert.equal(blockedState.notified, true);
  assert.ok(blockedState.persistenceError);
});
