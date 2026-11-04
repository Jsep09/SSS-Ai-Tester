## รุ่น 0.6.0: ตรวจเวอร์ชันและสรุปอัปเดต

ถาม Codex ว่า `$ssd-ai-tester version` หรือ `$ssd-ai-tester update-info` ได้เลย คำสั่งนี้แสดงใน `$ssd-skill-list` ด้วย

```text
node bin/cli.mjs version
node bin/cli.mjs update-info --from 0.5.0
node bin/cli.mjs version --session-version 0.5.0
```

Installed ตรวจจาก manifest และไฟล์จริง Session เป็นรุ่นที่ AI/caller แจ้งจากข้อมูลที่โหลดไว้ หากไม่มีหลักฐานจะแสดงไม่ทราบ ไม่ใช้รุ่นในดิสก์ยืนยันรุ่นของแชต update-info ใช้ประวัติการติดตั้งหรือ --from และ changelog ที่แนบใน Skill โดยไม่ต้องเก็บ ZIP ต้นทาง ไม่ได้เช็กรุ่นล่าสุดออนไลน์

## Code-first และ Repomix ที่อัปเดตได้

ขั้นตอน upversion, changelog อัตโนมัติ, Git tag และ GitHub Draft Release ดู [RELEASING.md](RELEASING.md)

เมื่อมี source/Repomix ให้ AI อ่าน flow ที่เกี่ยวข้อง สร้าง Playwright script แล้วรันจริง สำรวจ browser เฉพาะเมื่อจำเป็น ไม่ต้องคลิกสำรวจก่อนทุกเคสใหม่

```text
node bin/cli.mjs context --workspace "<workspace>" --context-file "<absolute Repomix path>"
node bin/cli.mjs context --workspace "<workspace>"
node bin/cli.mjs context-review --workspace "<workspace>" --review "<absolute review.json>"
node bin/cli.mjs run --workspace "<workspace>"
```

เมื่อส่งไฟล์ชุดใหม่ ให้ลงทะเบียน --context-file ใหม่ทั้งรายการ เมื่อเขียนทับไฟล์เดิม runner จะตรวจพบจาก SHA-256 โดยอัตโนมัติและหยุดให้ AI อ่าน/วิเคราะห์ก่อนรัน เก็บ fingerprint และ review ใน run.json ไม่ regenerate tests ทั้งหมด ไม่รับรองว่า source ตรงกับ deployment หากยังไม่ทราบ revision ดูรูปแบบ review และข้อจำกัดใน skills/ssd-ai-tester/references/code-context.md

## ตัวอย่าง Telesale เดิม

1. แตก ZIP ทั้งโฟลเดอร์ แล้วเปิด `install.cmd` (ต้องมี Node.js 20+ และอินเทอร์เน็ตสำหรับ runtime ครั้งแรก)
2. เปิด `examples/telesale/run-bot.cmd` ผู้ใช้ Login เอง แล้วบอทสร้างข้อมูลทดสอบใน UAT
3. BA/QA แก้ `examples/telesale/bot.config.json` เพื่อเลือกโหมดและความเร็ว:

```json
{ "headless": false, "slowMo": 0 }
```

`headless: false` เปิดหน้าต่าง, `true` ซ่อนหน้าต่าง; `slowMo` คือเวลาหน่วงต่อ action หน่วยมิลลิวินาที เช่น 0 หรือ 350 ข้อมูลทดสอบแก้แยกที่ test-data/scenario.json เอกสารแนบเป็นภาพจำลอง ไม่รวมข้อมูลล็อกอินของผู้พัฒนา

# SSD AI Tester

ชุด Skill สำหรับ Codex สร้างและรันสคริปต์ Playwright E2E ใน workspace ตามงาน และสำรวจเว็บผ่าน Browser Use ในแท็บแยก พร้อมภาพหลักฐานและรายงานภาษาไทยที่ BA/QA อ่านแล้วทำตามได้ ติดตั้งครั้งเดียวครบทั้ง 3 Skill

## เริ่มต้นด้วย ZIP บน Windows (แนะนำ)

1. ติดตั้ง Node.js 20 ขึ้นไป ถ้าเพิ่งติดตั้งให้เปิด terminal ใหม่
2. แตกไฟล์ `ssd-ai-tester-0.4.1.zip` **ทั้งโฟลเดอร์** ไม่เปิด installer จากในหน้าต่าง ZIP และไม่คัดลอกแค่ install.cmd ออกมา
3. เข้าโฟลเดอร์ที่มี `package.json` แล้วดับเบิลคลิก `install.cmd`
4. รอดาวน์โหลด Playwright + Chromium ครั้งแรก (ต้องใช้อินเทอร์เน็ต) จนเห็น **SUCCESS** พร้อมผลตรวจ Skill และ browser หน้าต่างจะรอให้กดปุ่มก่อนปิด ถ้าเห็น **FAILED** แปลว่ายังติดตั้งไม่สำเร็จ
5. เปิด Codex ใหม่ แล้วเรียก `$ssd-get-started` หรือค้นหา SSD จากเมนู Skills

ตัวติดตั้งเก็บ log ใน `install-logs/` ข้างตัวติดตั้ง ถ้าโฟลเดอร์นั้นเขียนไม่ได้จะใช้ `%TEMP%\ssd-ai-tester-logs` แทน โดยแสดงตำแหน่งไฟล์จริงท้ายหน้าต่าง ถ้าติดปัญหาให้ส่งข้อความผิดพลาดหรือไฟล์ log เพื่อตรวจสอบ ไม่ต้องเดาจากอาการหน้าต่างปิด

ไฟล์ `.tgz` เป็นแพ็กเกจสำหรับคำสั่ง `npm install` ไม่ใช่ตัวติดตั้งแบบดับเบิลคลิก สำหรับผู้รับที่ต้องการติดตั้งง่ายให้ส่ง ZIP

ถ้าไม่ต้องการดับเบิลคลิก ให้เปิด PowerShell ในโฟลเดอร์ที่แตกแล้วรัน `node .\bin\install.mjs` หน้าต่างจะคงอยู่เพราะเปิดจาก terminal เดิม สำหรับ automation ใช้ Node โดยตรง หรือกำหนด `SSD_TESTER_NO_PAUSE=1` ก่อนเรียก install.cmd

## Skill ในชุดนี้

| เรียกใช้ | ทำอะไรได้ | เหมาะกับใคร/เมื่อไหร่ |
|---|---|---|
| `$ssd-get-started` | แนะนำชุดทดสอบ สิ่งที่ต้องเตรียม และคำสั่งเริ่มต้น | ผู้ใช้ใหม่หรือยังไม่รู้ว่าจะเริ่มจากอะไร |
| `$ssd-skill-list` | แสดงรายการ Skill พร้อมคำอธิบาย วิธีเลือกใช้ และตัวอย่าง | ต้องการดูว่ามีอะไรให้ใช้บ้าง |
| `$ssd-ai-tester` | วางแผน ทดสอบหน้าบ้าน เก็บภาพ และสร้างรายงานภาษาไทย | BA/QA ที่ต้องการตรวจระบบและสรุปผล |

`workspace`, `plan`, `script`, `run-script`, `report` เป็นโหมดของ `$ssd-ai-tester` ไม่ใช่ Skill แยก ถ้ามีสคริปต์ให้รัน Playwright Test โดยตรง Browser Use ใช้สำรวจเว็บ ส่วน desktop Computer Use ใช้เฉพาะเมื่อเลือกไว้อย่างชัดเจน

ครั้งแรกพิมพ์ `$ssd-get-started` ใน Codex ได้เลย หรือใช้ `$ssd-skill-list` เพื่อดูรายการ แหล่งรายการที่ใช้ร่วมกันอยู่ใน `skills/ssd-skill-list/references/catalog.json` และ helper ตรวจว่าพบไฟล์ Skill จริงก่อนแสดงสถานะ

## สั่งผ่าน Codex: เลือก workspace ตามงาน แล้วรันสคริปต์จริง

เริ่มต้นด้วยข้อความนี้ โดยแทน URL และชื่องานให้ตรงระบบจริง:

```text
$ssd-ai-tester เตรียม workspace สำหรับทดสอบระบบคำขอในโฟลเดอร์งานนี้
URL https://uat.example.test สภาพแวดล้อม UAT
วางแผนจาก requirement ที่แนบ แล้วสร้างสคริปต์ Playwright ตรวจการค้นหา
เก็บภาพและรายงานภาษาไทยสำหรับ BA/QA ไม่ควบคุม desktop ของผม
```

ครั้งต่อไปมีสคริปต์พร้อมแล้ว สั่งสั้น ๆ:

```text
$ssd-ai-tester run-script รันทดสอบทั้งหมดใน workspace นี้

$ssd-ai-tester run-script รันเฉพาะกรณีค้นหาใน C:/QA/claims-uat แล้วสรุปผลไทย
```

Codex เลือก path ที่ผู้ใช้ระบุหรือหา `ssd-workspace.json` ใกล้โฟลเดอร์งานที่สุด ถ้าไม่มีจะเลือกโฟลเดอร์ใหม่ที่เหมาะกับงาน เช่น qa-workspace หรือ qa/claims-uat โดยไม่เขียนทับโปรเจกต์เดิม ไม่จำเป็นต้องเก็บทุกงานใน path เดียว testsDir/runsDir เปลี่ยนเป็นโฟลเดอร์ย่อยอื่นใน config ได้

```text
<workspace ที่เลือก>/
  ssd-workspace.json       ชื่อระบบ URL สภาพแวดล้อม ตำแหน่งสคริปต์/ผล
  tests/                  สคริปต์ *.spec.mjs / *.spec.ts / *.spec.js
  fixtures.mjs            เชื่อม runtime ที่ติดตั้งครั้งเดียว
  requirements/           เกณฑ์ธุรกิจ
  test-data/              ข้อมูลทดสอบ
  playwright/.auth/       session เฉพาะเครื่อง ไม่แชร์/ไม่ commit
  runs/<รอบไม่ซ้ำ>/        report.html, report.md, report.json, screenshots/
                          runner.log, technical-results.json, playwright-report/, artifacts/
  run-tests.cmd           ดับเบิลคลิกรันทั้งหมดได้ด้วย
```

ถ้ามีสคริปต์ Codex จะเรียก Playwright runner ครั้งเดียว แล้วอ่านผลจริงหลังจบ ไม่สั่ง AI กดทุก element จึงลดรอบรอโมเดล ไม่มีการรับรองตัวเลขความเร็วตายตัว หากไม่มีสคริปต์ต้องสำรวจและสร้างก่อน สคริปต์ต้องมี assertions ของเกณฑ์ธุรกิจและ metadata รายกรณี ดู [คู่มือสร้างสคริปต์](skills/ssd-ai-tester/references/playwright.md)

ทางเลือกสำหรับ terminal (CLI ใน ZIP ใช้ได้โดยไม่ลง global):

```powershell
node "<โฟลเดอร์แพ็กเกจ>/bin/cli.mjs" workspace --workspace "C:/QA/claims-uat" --title "ระบบคำขอ" --url https://uat.example.test --environment UAT
node "<โฟลเดอร์แพ็กเกจ>/bin/cli.mjs" run --workspace "C:/QA/claims-uat"
node "<โฟลเดอร์แพ็กเกจ>/bin/cli.mjs" run --workspace "C:/QA/claims-uat" --grep "ค้นหา"
```

ถ้ามี global CLI ใช้ `ssd-ai-tester run --workspace PATH` ได้ สคริปต์ใน tests/ import จาก `../fixtures.mjs` เพื่อใช้ Playwright กลาง ไม่ต้องเพิ่ม node_modules ในงาน สคริปต์เดิมที่ import @playwright/test ต้องให้ Codex ตรวจและปรับ import หรือใช้ dependencies ของโปรเจกต์เดิมตามความเหมาะสม

ย้าย workspace ไปอีกเครื่องแล้วใช้ `bind --workspace PATH` เพื่อเชื่อม fixtures.mjs/run-tests.cmd กับ Skill บนเครื่องใหม่ ไม่แตะสคริปต์หรือผลเก่า รูปและรายงานแยกรอบเสมอ ไม่ retry การบันทึกข้อมูลซ้ำโดยอัตโนมัติ และป้องกันการรัน workspace เดียวซ้อนกัน

ถ้าติดตั้ง browser ไม่สำเร็จ ใช้ `node "<แพ็กเกจ>/bin/cli.mjs" setup` เพื่อซ่อม แล้ว `runtime-doctor` เพื่อตรวจ browser launch จริง ไม่ต้องลบ Skill ก่อน ผลติดตั้งที่ผ่านเฉพาะ Skill ไม่ใช่ผลตรวจ Playwright พร้อมใช้

รายงาน HTML ภาษาไทยสร้างอัตโนมัติ พร้อมภาพและผลจาก assertions ข้อผิดพลาด infrastructure หรือขาด metadata/ภาพจะเป็นทดสอบไม่ได้ ไม่สรุปเป็นบั๊กธุรกิจเอง ไม่ต้องใช้ AI เพื่อสร้างรายงานพื้นฐาน แต่ Codex ช่วยวิเคราะห์และอธิบายเพิ่มเติมได้ Session ของ Chrome/Browser Use ไม่ถูกโอนมายัง headless เอง ให้ใช้บัญชีทดสอบและ authFile ที่เตรียมไว้ตามคู่มือ

ครั้งแรก installer ต้องเข้าถึง npm/CDN; ZIP ไม่รวม browser binary ขนาดใหญ่ จึงไม่ใช่ตัวติดตั้ง offline ไม่ติดตั้ง Playwright MCP เพราะการรันสคริปต์โดยตรงไม่จำเป็นต้องมี MCP

## ผู้ใช้ทำงานอย่างอื่นพร้อมทดสอบได้อย่างไร

ตั้งแต่รุ่น 0.4.1 ถ้ามีสคริปต์จะรัน **Playwright Test แบบ headless โดยตรง** ไม่รอ AI คลิกทีละจุด ส่วนการสำรวจเว็บใช้ **Browser Use ในแท็บทดสอบแยก** ใช้การคลิกและกรอกข้อมูลภายในแท็บ ไม่ส่งเมาส์/คีย์บอร์ดเข้า desktop หลัก และไม่สลับไปใช้ desktop Computer Use เองเมื่อ Browser Use ทำงานไม่ได้ ภาพหลักฐานเก็บจาก browser ของสคริปต์หรือแท็บทดสอบ รายงานระบุวิธีและพื้นที่ทดสอบตามจริง

| วิธี | ผู้ใช้ทำงานอื่นได้หรือไม่ | ข้อจำกัด |
|---|---|---|
| Playwright Test แบบ headless | ทำงานในแอปอื่นได้ | ใช้ browser context แยก แต่ข้อมูลบน UAT อาจแชร์กับผู้ใช้คนอื่น |
| Browser Use ใน built-in browser | ทำงานในแอปอื่นได้ โดยไม่แก้แท็บทดสอบ | session แยกจาก Chrome ปกติ อาจต้อง login ใหม่ |
| Browser Use ผ่าน extension | ใช้แท็บทดสอบเฉพาะและทำงานในแท็บ/แอปอื่น | profile เดียวกันยังแชร์ cookies/login และข้อมูลธุรกิจ |
| Desktop Computer Use บน Windows | ใช้เมาส์/คีย์บอร์ดร่วมใน session เดียวกันไม่ได้ | ต้องใช้ VM หรือเครื่องทดสอบเฉพาะหากต้องทำงานไปด้วย |

การเปิด browser อีกหน้าต่าง, อีก profile หรือซ่อนหน้าต่างไม่ได้แยก native keyboard/mouse ให้ Computer Use โหมดแท็บไม่รับรองการทำงานต่อหลังปิด Codex, sleep หรือ lock เครื่อง หากไม่มี Browser Use จะบันทึกทดสอบไม่ได้และแนะนำวิธีเตรียมเครื่องมือ โดยไม่ยึด desktop ผู้ใช้

ถ้าจำเป็นต้องตรวจ native desktop จริง ให้เตรียม VM/เครื่องทดสอบ แล้วเปิด Codex และระบบทดสอบข้างใน ระบุให้ Skill ใช้ desktop Computer Use บนเครื่องนั้น ไม่จำเป็นต้องสร้าง Skill อีกตัว

ข้อจำกัด Windows อ้างอิง [OpenAI: Computer Use](https://learn.chatgpt.com/docs/computer-use) และการเลือก browser/session อ้างอิง [OpenAI: Browser](https://learn.chatgpt.com/docs/browser) ความสามารถที่ใช้ได้จริงขึ้นกับรุ่นแอปและเครื่องมือในแชต

## ต้องมีอะไรบ้าง

- Node.js 20 ขึ้นไปพร้อม npm และอินเทอร์เน็ตในครั้งแรกเพื่อติดตั้ง Playwright/Chromium
- Codex ที่รองรับ local Skills; Browser Use จำเป็นเมื่อต้องสำรวจเว็บใหม่ แต่การรันสคริปต์เดิมใช้ Playwright Test โดยตรง
- Browser และสิทธิ์เข้าเว็บที่ต้องทดสอบ โดยผู้ใช้เข้าสู่ระบบเองหาก runtime ไม่อนุญาตให้จัดการหน้าจอ login

ตัวติดตั้งเตรียม Playwright Test และ Chromium ให้โดยดาวน์โหลดรุ่นที่กำหนดจาก npm/CDN ไว้ใน ~/.ssd-ai-tester/runtime/1.64.1/ ใช้ร่วมหลาย workspace ได้ ไม่ต้องติดตั้งซ้ำแต่ละงาน Runtime Browser Use / Computer Use ของ OpenAI ต้องเปิดใช้ใน Codex แยก ชุดนี้ไม่เรียก OpenAI API และไม่ต้องมี API key เพิ่ม

## ติดตั้งแบบ global ผ่าน npm (ทางเลือก)

แพ็กเกจนี้ยังไม่ได้เผยแพร่ขึ้น npm registry ให้ติดตั้งจากไฟล์ `.tgz` ที่ส่งให้:

```powershell
npm install --global .\ssd-ai-tester-0.4.1.tgz
ssd-ai-tester doctor
```

global npm install จะคัดลอกทั้ง 3 Skill ไปยังโฟลเดอร์ชื่อตรงกันใน `~/.agents/skills/` ผ่าน postinstall ใช้ได้ทุกโปรเจกต์ของผู้ใช้ปัจจุบัน ไม่ใช่การติดตั้งให้ทุกบัญชีในเครื่อง หาก npm ปิด lifecycle scripts ให้เรียก `ssd-ai-tester install` และ `ssd-ai-tester setup` เพิ่มด้วยตนเอง ตัว `doctor` ตรวจครบทั้ง 3 Skill แต่ตรวจสิทธิ์ Browser Use / Computer Use ในแชตไม่ได้ การติดตั้งทับรุ่น 0.1.0 จะเพิ่ม Skill แนะนำและรายการให้ด้วย

หาก npm global bin ไม่อยู่ใน PATH ใช้ `node "<โฟลเดอร์แพ็กเกจ>/bin/cli.mjs" install` หรือวิธี ZIP ด้านล่าง

## ติดตั้งจาก ZIP / โฟลเดอร์

แตก `ssd-ai-tester-0.4.1.zip` แล้วเปิด terminal ในโฟลเดอร์ที่แตก เรียก:

```powershell
node .\bin\cli.mjs install
node .\bin\cli.mjs doctor
```

Windows ใช้ `install.cmd` หรือ `./install.ps1` ได้เช่นกัน ไม่ต้องเปลี่ยน execution policy หาก PowerShell ไม่ให้รัน .ps1 ให้ใช้ Node หรือ .cmd การติดตั้งจาก ZIP ไม่จำเป็นต้องติดตั้ง global CLI; Skill มีตัวสร้างรายงานครบในตัวแล้ว

หากต้องการทั้ง global CLI และ Skill จากโฟลเดอร์ ให้ใช้ `npm install --global .` แล้ว `ssd-ai-tester install` และ `ssd-ai-tester setup` (บาง npm version ใช้ symlink สำหรับการติดตั้งจากโฟลเดอร์ จึงต้องเก็บโฟลเดอร์ต้นฉบับไว้) วิธี `.tgz` เหมาะกับการแจกจ่ายมากกว่า

## เรียกใน Codex

พิมพ์ `$ssd-ai-tester` เพื่อเรียกตรง ๆ หรือเปิดเมนู Skills จาก slash command ที่รุ่นนั้นรองรับ เช่น `/skills` แล้วค้นหา **SSD AI Tester** หากยังไม่พบให้เปิด Codex ใหม่ การใส่ Skill ไม่ได้ลงทะเบียน custom slash command `/ssd-ai-tester` ให้ทุกเวอร์ชันโดยอัตโนมัติ

ตัวอย่างข้อความสำหรับ BA/QA:

```text
$ssd-get-started แนะนำว่าชุดนี้ทำอะไรได้และต้องเตรียมอะไรบ้าง

$ssd-skill-list แสดงรายการ Skill พร้อมตัวอย่าง

$ssd-ai-tester plan ออกแบบกรณีทดสอบการค้นหาคำขอจาก requirement ในโฟลเดอร์นี้

$ssd-ai-tester run background ทดสอบ https://uat.example.test เฉพาะค้นหาและเปิดรายละเอียด
ใช้แท็บทดสอบแยก ไม่ควบคุม desktop ผม เก็บภาพและสรุปภาษาไทย ห้ามบันทึกข้อมูลจริง

$ssd-ai-tester report สร้างรายงานจาก test-results/รอบล่าสุด
```

Skill จะหา URL/เกณฑ์ยอมรับจากบริบทก่อน ถ้าขาดข้อมูลสำคัญจะขอเฉพาะสิ่งที่จำเป็น กรณี login, CAPTCHA หรือการกระทำที่ runtime ห้าม/ต้องยืนยัน จะปฏิบัติตามข้อกำหนดของ runtime

## ผลที่ได้รับ

```text
test-results/<รอบทดสอบ>/
  test-plan.md       แผนและเกณฑ์ธุรกิจ
  results.json       ผลที่บันทึกระหว่างทดสอบ
  screenshots/       ภาพหลักฐานจริง
  report.html        รายงานไทยพร้อมภาพในไฟล์เดียว ส่งต่อได้
  report.md          รายงาน Markdown (ส่ง screenshots คู่กัน)
  report.json        ผลพร้อมตัวเลขสรุปสำหรับนำไปใช้ต่อ
```

รายงานมีจำนวนผ่าน/ไม่ผ่าน/ทดสอบไม่ได้/ข้าม/ยังไม่ได้ทดสอบ ผลที่คาดหวังเทียบสิ่งที่พบ ขั้นตอนทำซ้ำ ผลกระทบต่อผู้ใช้ และสิ่งที่ควรทำต่อ ภาพต้องเป็นหลักฐานจากรอบทดสอบนั้น ตัว generator ไม่ยอมให้กรณีผ่าน/ไม่ผ่านไม่มีภาพ แต่ผู้ทดสอบยังต้องตรวจว่าภาพสนับสนุนข้อสรุปจริง

เปิด `report.html` ใน browser ได้แบบ offline ใช้ Print เพื่อบันทึก PDF ได้หากต้องการ ไม่ได้สร้าง PDF อัตโนมัติ

## คำสั่งช่วย

```powershell
ssd-ai-tester list
ssd-ai-tester init --out ./test-results/uat-001 --title "ระบบคำขอ" --url https://uat.example.test --environment UAT
ssd-ai-tester report --out ./test-results/uat-001
ssd-ai-tester install --skills-dir "C:\custom\skills"
ssd-ai-tester uninstall
```

`init` สร้างรอบใหม่เท่านั้น แล้วให้ Codex บันทึกกรณี/ผลตาม [schema](skills/ssd-ai-tester/references/results-format.md) ก่อนสร้างรายงาน `--skills-dir` เป็นตัวเลือกสำหรับจัดวางไฟล์เอง ไม่ได้แก้ config ให้ Codex ค้นหา path นอกมาตรฐาน

อัปเดต: ติดตั้ง `.tgz` รุ่นใหม่ซ้ำ ไฟล์ที่แก้ไขเองจะไม่ถูกเขียนทับโดยปริยาย ถ้าสำรองแล้วและต้องการแทนที่ให้ใช้ `install --force` ซึ่งเก็บโฟลเดอร์เก่าเป็น backup ไม่เขียนทับ Skill ที่ไม่ได้ติดตั้งโดยเครื่องมือนี้

ถอน Skill: `ssd-ai-tester uninstall` จะย้ายเฉพาะโฟลเดอร์ที่เครื่องมือนี้เป็นเจ้าของไป backup; ถ้ามีการแก้ไขจะไม่แตะไฟล์ จากนั้น `npm uninstall --global ssd-ai-tester` เพื่อนำ CLI ออก การลบ npm อย่างเดียวจะไม่ลบ Skill/ผลทดสอบ

## พัฒนาและสร้างชุดแจก

```powershell
npm test
npm run pack:release
```

คำสั่ง release สร้าง `.tgz` และ `.zip` ใน `dist/` รวมตัว CLI, Skill, installer และคู่มือ โดยไม่รวมผลทดสอบ/ข้อมูลส่วนตัว ขั้นตอนสร้าง ZIP ใช้ PowerShell บน Windows; ผู้รับ ZIP ใช้เพียง Node.js และไม่ต้องเข้าถึง npm registry

ยังไม่ได้จองชื่อหรือ publish แพ็กเกจ `ssd-ai-tester` บน npm การ publish จริงต้องตรวจสิทธิ์ชื่อและบัญชีผู้เผยแพร่ก่อน

## เอกสารอ้างอิง

ตำแหน่ง user Skills และการเรียก `$ชื่อ-skill` อ้างอิง [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) หากรุ่นแอปของทีมมี UI ต่างกัน ให้ตรวจเมนู Skills ของรุ่นนั้น วิธีควบคุมหน้าจอใช้เอกสาร Browser Use / Computer Use ของ runtime ที่ติดตั้งจริง ไม่คัดลอก runtime ภายในมาแจก
