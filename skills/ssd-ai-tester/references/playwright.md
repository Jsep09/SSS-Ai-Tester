# Playwright: สร้างครั้งแรก แล้วรันโดยตรง

งานใหม่ใช้ [มาตรฐาน Workspace BA/QA](qa-workspace.md): input/, codebase/, scripts/, run/, results/, .system/ สร้างโครงด้วย scaffold-workspace.mjs ส่วนคำสั่ง workspace/bind โครงไฟล์และ import ด้านล่างเป็น helper เดิมสำหรับ workspace เดิม ไม่ใช้เป็น template งานใหม่และไม่ถือว่า scaffold พร้อมรัน ต้องเตรียมตัวเชื่อม Flow และตรวจตาม qa-workspace.md ก่อนส่งมอบ

เมื่อสคริปต์/คำสั่ง/ขอบเขตพร้อมในแชตแล้ว ใช้ [ready-script.md](ready-script.md) ไม่ทำขั้นเตรียมใน reference นี้ซ้ำ `run --quick` เก็บผล JSON/ภาพสุดท้ายและเลื่อนการทำรายงานเต็ม; `--headed` เปิด browser ตามคำขอ ไม่ต้องเขียน `test.use` เพิ่มเอง

ใช้ helper `scripts/workspace.mjs` ที่อยู่ใน Skill นี้ ไม่ต้องมี global CLI หรือ Playwright MCP การสั่งผ่าน Codex คือสั่ง process runner ครั้งเดียวแล้วรอผล ไม่ให้โมเดลตีความ/คลิกทีละคำสั่งของสคริปต์

## เลือก workspace ตามงาน

1. หากผู้ใช้ระบุ path ให้ใช้ path นั้น ภายใต้สิทธิ์ filesystem ของ session
2. ไม่ระบุ path ให้หา `ssd-workspace.json` ในโฟลเดอร์งานปัจจุบันและบรรพบุรุษ เลือกตัวใกล้ที่สุด `run` ทำการค้นนี้ให้ได้ ห้ามเดา path จากการทดสอบครั้งก่อน
3. ถ้าไม่มี ให้ตรวจโครงสร้างโปรเจกต์ก่อน เลือกโฟลเดอร์ใหม่เช่น `qa-workspace`, `qa/claims-uat` หรือชื่อที่สื่อถึงงาน บอกตำแหน่งที่จะใช้ใน progress แล้วดำเนินการถ้าอยู่ในพื้นที่ที่ได้รับอนุญาต ไม่ต้องถามเลือก path สำหรับการตัดสินใจธรรมดา ถ้ามีหลายระบบที่เลือกผิดแล้วจะทดสอบคนละระบบ ค่อยถามผู้ใช้
4. ห้ามสร้างสคริปต์ในโฟลเดอร์ติดตั้ง Skill/runtime หรือเขียนทับ tests/config เดิม ใช้ workspace เดิมเมื่อมีอยู่แล้ว `workspace` จะปฏิเสธชื่อไฟล์/โฟลเดอร์ที่ชนกับงานเดิม ให้เลือกโฟลเดอร์ย่อยใหม่แทน

คำสั่งจาก Skill โดยตรง (แทน path ด้วยค่าจริงและ quote path):

```text
node "<skill>/scripts/workspace.mjs" doctor
node "<skill>/scripts/workspace.mjs" setup
node "<skill>/scripts/workspace.mjs" workspace --workspace "<งานใดก็ได้>/qa-claims" --title "ระบบคำขอ" --url "https://uat.example.test" --environment UAT
node "<skill>/scripts/workspace.mjs" run --workspace "<workspace>"
node "<skill>/scripts/workspace.mjs" run --workspace "<workspace>" --grep "ค้นหา"
node "<skill>/scripts/workspace.mjs" run --workspace "<workspace>" --grep "ค้นหา" --quick --headed --session-version "<รุ่นที่โหลด>"
node "<skill>/scripts/workspace.mjs" run --workspace "<workspace>" --list
```

`setup` ติดตั้ง Playwright/Chromium ที่ pin รุ่นไว้และตรวจ launch จริง ตัว ZIP installer ทำให้ตั้งแต่ครั้งแรกแล้ว ถ้าพร้อมไม่ต้องติดตั้งซ้ำ การดาวน์โหลดต้องใช้อินเทอร์เน็ตและอาจติด proxy/ข้อจำกัด sandbox ให้แสดง error ตามจริง ไม่ปิด TLS หรือเปลี่ยนนโยบายความปลอดภัย การติดตั้งไม่ได้ให้สิทธิ์รันนอก filesystem ที่ session อนุญาต

โครงที่สร้าง (workspace อยู่ที่ใดก็ได้):

```text
ssd-workspace.json       ชื่อระบบ URL สภาพแวดล้อม testsDir runsDir และ optional authFile
tests/                  *.spec.mjs / *.spec.ts / *.spec.js ที่รันจริง
fixtures.mjs            เชื่อม Playwright/runtime บนเครื่องนี้
requirements/           เกณฑ์ธุรกิจ
test-data/              ข้อมูลทดสอบที่ไม่เป็นความลับ
playwright/.auth/       session เฉพาะเครื่อง ไม่แชร์/ไม่ commit
runs/<รอบไม่ซ้ำ>/        report.html / report.md / report.json / results.json
                        screenshots/ / runner.log / technical-results.json
                        playwright-report/ / artifacts/ (รวม trace เมื่อผิดพลาด)
.ssd/                   run.lock ป้องกันรันซ้อน
run-tests.cmd           ทางเลือกสำหรับดับเบิลคลิกรันทดสอบทั้งหมด
```

เปลี่ยนชื่อ testsDir/runsDir ใน ssd-workspace.json ได้ เป็น path ย่อย workspace ที่ไม่ซ้อนกัน หากย้ายเครื่องหรือเปลี่ยนโฟลเดอร์ติดตั้ง Skill ใช้ `bind --workspace PATH` เพื่อสร้าง fixtures.mjs และ run-tests.cmd ใหม่ โดยไม่แตะ tests/results

## สร้างสคริปต์ที่รันได้และมีความหมายทางธุรกิจ

เมื่อมี source/Repomix ให้ทำ [Code-first](code-context.md) ก่อน: ตรวจ context อ่าน requirement และโค้ดที่เกี่ยวข้อง แล้วสร้างสคริปต์ด้วย locator ที่มีหลักฐานจาก source หรือหน้าเว็บได้ ไม่เดาชื่อ element ไม่บังคับเปิด Browser Use สำรวจก่อน ให้รันจริงเป็นตัวตรวจ locator และสำรวจเฉพาะจุดที่จำเป็น ทุกกรณีต้องมี assertion ตรวจผลธุรกิจ ไม่ใช่เพียงคลิกสำเร็จ ห้ามใช้ evaluate/setContent หรือ mock เพื่อแกล้งทำให้ระบบเป้าหมายผ่าน ใช้ได้เฉพาะ fixture/demo ที่ระบุว่าเป็นข้อมูลจำลองเท่านั้น

สคริปต์ภายใต้ tests/ ใช้ `import { test, expect } from '../fixtures.mjs'` ถ้าเป็นโฟลเดอร์ซ้อนให้ปรับ relative path fixture นี้ใช้ runtime กลาง ไม่ต้อง npm install ซ้ำแต่ละ workspace สคริปต์เดิมที่ import `@playwright/test` ไม่ได้เปลี่ยนมาใช้ runtime กลางเอง: ให้ตรวจ dependencies เดิมและปรับ import มาใช้ fixture ของชุดเมื่อเหมาะสม ห้ามเปลี่ยนสคริปต์ที่ผู้ใช้แก้ไว้โดยไม่ตรวจ diff

ตัวอย่างโครงสำหรับ UI ที่สำรวจแล้ว ต้องปรับข้อมูล/locator ให้ตรงเว็บจริง:

```js
import { test, expect } from '../fixtures.mjs';

test('ค้นหาเลขคำขอแล้วพบรายการตรงกัน', async ({ page, business }) => {
  business({
    requirement: 'AC-01 ค้นหาเลขคำขอที่มีอยู่ได้', priority: 'high',
    preconditions: 'มีคำขอ TEST-001 ใน UAT และใช้บัญชีทดสอบที่มีสิทธิ์',
    steps: [{ action: 'กรอก TEST-001 แล้วกดค้นหา', expected: 'พบรายการ TEST-001' }],
    expected: 'แสดงคำขอตรงเลขที่',
    defect: { severity: 'high', impact: 'ผู้ใช้ค้นหาคำขอที่มีอยู่ไม่พบ', nextAction: 'QA ตรวจข้อมูลและภาพ แล้วประสานทีมแก้ไขและทดสอบซ้ำ' }
  });
  await page.goto('/requests');
  await page.getByRole('textbox', { name: 'เลขคำขอ' }).fill('TEST-001');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'TEST-001', exact: true })).toBeVisible();
});
```

business metadata ใช้ข้อมูลตามเกณฑ์จริง ห้ามเดาผลกระทบทุกข้อเป็น high โดยอัตโนมัติ ให้กำหนดตามบริบทธุรกิจ ถ้าไม่มี metadata หรือภาพ รายงานไทยจัดเป็น blocked แม้ process จบผ่าน ไม่อ้างว่า BA/QA รับรองแล้ว

## รันและอ่านผล

ก่อนสร้างข้อมูลหรือรันจริง อ่าน [test-data.md](test-data.md) ถ้ารอบล้มเหลวให้อ่าน [failure-analysis.md](failure-analysis.md) ก่อนแก้หรือ rerun ไม่เริ่มจากการส่ง action ซ้ำ

Workspace ใหม่มี context/ สำหรับ manifest และ review ใช้ `workspace --context-file "<absolute path>"` ตอนสร้าง หรือ `context --workspace "<workspace>" --context-file "<absolute path>"` ภายหลัง ระบุ --context-file ซ้ำได้หลายไฟล์ ก่อน run ตรวจด้วย `context` ถ้า review-required ทำตาม code-context.md โดยไม่ขอผู้ใช้อนุมัติ routine review เมื่อพร้อม runner จะบันทึก fingerprint/review ใน run.json ส่วน workspace ไม่มี context ยังรันแบบ black-box ได้

เมื่อผู้ใช้สั่งทดสอบ ให้ตรวจ workspace/URL/สภาพแวดล้อม/ขอบเขตที่อนุญาต และอ่าน scripts ที่จะรันเพื่อไม่ให้มีคำสั่งนอกงาน โดยเฉพาะ script จากแหล่งภายนอก จากนั้นเรียก `run` ครั้งเดียว ใช้ `--grep` เป็น regular expression ของชื่อกรณีถ้าต้องการบางงาน escape อักขระ regex หากต้องการค้นหาแบบข้อความตรง อย่ารันทุกกรณีหากผู้ใช้สั่งเฉพาะบางกรณี

รัน headless, worker เดียว, ไม่ retry อัตโนมัติเพื่อลดการส่งข้อมูลซ้ำ รอ process จริงจนจบ เก็บแต่ละรอบแยกกัน หากมี run.lock ให้ตรวจ process ก่อนลบ lock ห้ามลบเพื่อรันแข่งกับรอบเดิม

exit code 0 หมายถึงสคริปต์ที่เลือกไม่ล้มเหลว ไม่ได้ยืนยันว่า metadata/ภาพครบ ต้องอ่าน report.json ประกอบ exit code 1 อาจเป็น assertion ผิดหรือเครื่องมือโหลดไม่ได้ ต้องตรวจ technical-results.json และ runner.log แยกกัน ไม่แก้ expected เพียงเพื่อให้ผ่าน ไม่ rerun action ที่มีผลข้างเคียงถ้ายังไม่ทราบว่ารอบก่อนส่งสำเร็จหรือไม่

ภาพเก็บจาก headless browser ของสคริปต์ทุกกรณีเมื่อทำได้ ไม่จับ desktop ผู้ใช้ หากหน้าแสดงข้อมูลลับให้เลือกข้อมูล/บัญชีทดสอบที่ส่งมอบภาพได้ก่อนรัน ไม่แชร์ auth หรือ trace ที่มีความลับกับบุคคลนอกขอบเขต Session ของ built-in browser/Chrome ไม่โอนมา headless โดยอัตโนมัติ ถ้ามี storageState ที่ผู้ใช้เตรียมไว้ ให้ตั้ง `authFile: playwright/.auth/user.json` ใน workspace ห้ามขอ password/OTP ในรายงาน

ส่ง report.html เป็นรายงานไทยหลัก เสริมผลรวมและรายการสิ่งที่ต้องทำต่อให้ BA/QA ถ้ารันผ่านทุกกรณีก็อ่านผลแล้วส่งมอบ ไม่ต้องเปิด Browser Use ตรวจซ้ำทุกคลิก หากล้มเหลวจึงวิเคราะห์ trace/ภาพและสำรวจเฉพาะจุดที่จำเป็น
