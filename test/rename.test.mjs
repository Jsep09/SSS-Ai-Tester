import test from 'node:test';
import assert from 'node:assert/strict';
import { renameWithRetry } from '../lib/rename.mjs';

test('Windows transient lock retries the same atomic rename and then succeeds', async () => {
  let calls = 0;
  const waits = [];
  await renameWithRetry('stage', 'installed', {
    platform: 'win32', pause: async ms => waits.push(ms),
    operation: async (from, to) => {
      assert.equal(from, 'stage'); assert.equal(to, 'installed');
      if (++calls < 3) throw Object.assign(new Error('locked'), { code: 'EPERM' });
    }
  });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [50, 100]);
});
test('permanent locks stop after bounded retries and unrelated errors are never retried', async () => {
  let calls = 0;
  await assert.rejects(renameWithRetry('a', 'b', {
    platform: 'win32', pause: async () => {},
    operation: async () => { calls++; throw Object.assign(new Error('locked'), { code: 'EBUSY' }); }
  }), /locked/);
  assert.equal(calls, 6);
  calls = 0;
  await assert.rejects(renameWithRetry('a', 'b', {
    platform: 'win32', pause: async () => {},
    operation: async () => { calls++; throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }
  }), /missing/);
  assert.equal(calls, 1);
});
