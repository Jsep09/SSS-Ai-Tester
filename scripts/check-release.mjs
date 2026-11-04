import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = path.join(root, '.test-temp');
mkdirSync(temp, { recursive: true });
const result = spawnSync(process.execPath, ['--test', 'test/*.test.mjs'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, TEMP: temp, TMP: temp }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
