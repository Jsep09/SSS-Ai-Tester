import { fileURLToPath } from 'node:url';
import { installSkills, defaultSkillsDir } from '../lib/install.mjs';
import { setupRuntime } from '../skills/ssd-ai-tester/scripts/runtime.mjs';

if (process.env.npm_config_global === 'true') {
  try {
    console.log(await installSkills(fileURLToPath(new URL('../', import.meta.url)), defaultSkillsDir()));
    await setupRuntime();
  } catch (error) {
    console.error('ติดตั้งยังไม่ครบ: ' + error.message);
    console.error('ตรวจด้วย ssd-ai-tester doctor และ runtime-doctor; ซ่อมด้วย install หรือ setup ตามขั้นตอนที่ขาด');
    process.exitCode = 1;
  }
} else console.log('ลง Skill แบบ global ด้วย: ssd-ai-tester install (หรือ node bin/cli.mjs install)');
