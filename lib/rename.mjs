import { promises as fs } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

// Windows scanners may briefly hold a newly copied directory open.
export async function renameWithRetry(from, to, options = {}) {
  const operation = options.operation || fs.rename;
  const pause = options.pause || setTimeout;
  const platform = options.platform || process.platform;
  for (let attempt = 0; ; attempt++) {
    try { return await operation(from, to); }
    catch (error) {
      if (platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await pause(Math.min(50 * 2 ** attempt, 800));
    }
  }
}
