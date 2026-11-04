# SSD AI Tester

ชุด Skill สำหรับ Codex ช่วย BA/QA อ่าน requirement และ source code/Repomix สร้างสคริปต์ Playwright ทดสอบเว็บจริง เก็บภาพหลักฐาน และสรุปรายงานภาษาไทย

ความสามารถหลัก:

- ใช้ code-first เมื่อมี source/Repomix แล้วสำรวจ browser เฉพาะส่วนที่จำเป็น
- ตรวจ context ที่เปลี่ยนก่อนรัน และให้ AI วิเคราะห์ผลกระทบต่อ test
- รันสคริปต์แบบ headless พร้อมภาพ trace และรายงาน HTML
- มีมาตรฐานเลือกงาน เตรียมข้อมูล และวิเคราะห์ failure
- ตรวจรุ่นที่ติดตั้ง สรุปอัปเดต และแจ้งเมื่อแชตเดิมพบชุดติดตั้งเปลี่ยน

## เลือกวิธีใช้งาน

| คุณต้องการ | เริ่มจากตรงไหน |
| --- | --- |
| พัฒนาโปรเจกต์และสร้าง ZIP ส่งให้ผู้ใช้ | โฟลเดอร์ Git `skill-ssd-ai-tester` และหัวข้อ Release ด้านล่าง |
| ได้รับ ZIP มาแล้ว ต้องการติดตั้ง | แตก ZIP แล้วทำตามหัวข้อ “ติดตั้งบนเครื่องผู้ใช้” |
| ติดตั้งแล้ว ต้องการให้ AI ทดสอบ | เปิด Codex ในโฟลเดอร์งาน แล้วดูหัวข้อ “เริ่มใช้ใน Codex” |

โฟลเดอร์ที่ใช้รันคำสั่งต้องมี `package.json`, `release.cmd`, `install.cmd`, `bin/` และ `skills/` อยู่ด้วยกัน

## 1. เตรียมเครื่องสำหรับพัฒนาและ Release

ใช้ Windows ที่มี **Node.js 20+ พร้อม npm**, PowerShell และ `tar` โดย Playwright/Chromium ต้องพร้อมสำหรับ tests ก่อน Release

เปิด PowerShell ที่ root โปรเจกต์ ตัวอย่างสำหรับโฟลเดอร์บน Desktop:

```powershell
Set-Location "$env:USERPROFILE\Desktop\skill-ssd-ai-tester"
node --version
npm --version
node .\bin\cli.mjs setup
```

ถ้าเก็บโปรเจกต์ไว้ที่อื่น ให้เปลี่ยน path บรรทัดแรกตามจริง `setup` เตรียม Playwright/Chromium ครั้งแรกและต้องใช้อินเทอร์เน็ต จากนั้นใช้ runtime ร่วมกันได้

การสร้าง ZIP แบบง่ายใช้ Node โดยตรงได้ ส่วน GitHub Release workflow ใช้ pnpm/Git/GitHub CLI เพิ่มตาม [RELEASING.md](RELEASING.md)

## 2. สร้าง Release เป็น ZIP ในคำสั่งเดียว

**วิธีง่ายที่สุด:** ดับเบิลคลิก `release.cmd` ที่ root โปรเจกต์ หรือเปิด PowerShell ที่ root แล้วรัน:

```powershell
.\release.cmd
```

ค่าเริ่มต้นเพิ่มเลข **patch** เช่น `0.6.2` เป็น `0.6.3` โดยทำงานดังนี้:

1. ตรวจว่าเลขรุ่นใหม่ยังไม่มีแพ็กเกจ และป้องกันการ Release ซ้อน
2. รัน tests ของโปรเจกต์
3. อัปเดต `package.json` และย้ายรายการ `Unreleased` ใน changelog ไปหัวข้อรุ่นใหม่
4. อัปเดตเวอร์ชันและ release notes ของทั้ง 3 Skills
5. สร้าง ZIP/TGZ ใน `dist/` แล้วแสดงตำแหน่งไฟล์

ก่อน Release ให้เพิ่มสิ่งที่แก้หรือ feature ใหม่ใต้ `## Unreleased` ใน [CHANGELOG.md](CHANGELOG.md) เพื่อให้ผู้รับดูสรุปอัปเดตได้ ถ้ายังไม่มีรายการ ระบบจะระบุว่ายังไม่ได้บันทึกการเปลี่ยนแปลง

| คำสั่งจาก root โปรเจกต์ | ผลลัพธ์ |
| --- | --- |
| `.\release.cmd` | เพิ่ม patch แล้วทดสอบและสร้างแพ็กเกจ |
| `.\release.cmd minor` | เพิ่ม minor เช่น 0.6.2 เป็น 0.7.0 |
| `.\release.cmd major` | เพิ่ม major เช่น 0.6.2 เป็น 1.0.0 |
| `.\release.cmd 1.2.0` | กำหนดรุ่นใหม่เอง ต้องมากกว่ารุ่นปัจจุบัน |
| `.\release.cmd --dry-run` | แสดงรุ่นถัดไปและ path ไฟล์ โดยยังไม่แก้ไฟล์หรือรัน tests |
| `pnpm release` | เรียก workflow เดียวกับ release.cmd |
| `node .\scripts\release.mjs` | แพ็กรุ่นปัจจุบันโดยไม่ bump จึงใช้ชื่อไฟล์เดิม |

ไฟล์ที่ได้:

```text
dist/
  ssd-ai-tester-X.Y.Z.zip    ส่งให้ผู้ใช้ Windows ติดตั้ง
  ssd-ai-tester-X.Y.Z.tgz    แพ็กเกจสำหรับ npm
```

หาก tests ไม่ผ่านจะหยุดก่อนเพิ่มเวอร์ชัน หากแพ็กไม่สำเร็จจะคืนเวอร์ชัน/changelog/Skill metadata และลบ output ที่ไม่สมบูรณ์ของรอบนั้น คำสั่ง Release รุ่นใหม่จะไม่เขียนทับแพ็กเกจรุ่นที่มีอยู่แล้ว

วิธีนี้สร้างแพ็กเกจในเครื่อง ส่วนการ commit, tag, push และ GitHub Draft Release ดู [GitHub Release workflow](RELEASING.md#github-release-workflow)

## 3. ติดตั้งบนเครื่องผู้ใช้จาก ZIP

ส่งไฟล์ `dist/ssd-ai-tester-X.Y.Z.zip` ให้ผู้ใช้ แล้วทำตามนี้:

1. ติดตั้ง **Node.js 20+ พร้อม npm** และเปิด terminal ใหม่หากเพิ่งติดตั้ง
2. แตก ZIP **ทั้งโฟลเดอร์** ก่อน ไม่รันจากในหน้าต่าง ZIP
3. เข้าโฟลเดอร์ที่มี `package.json` และ `install.cmd`
4. ดับเบิลคลิก `install.cmd`
5. รอจนเห็น **SUCCESS** ครั้งแรกต้องใช้อินเทอร์เน็ตดาวน์โหลด Playwright/Chromium
6. เปิด Codex ใหม่ แล้วพิมพ์ `$ssd-get-started` หรือ `$ssd-skill-list`

หรือเปิด PowerShell **ในโฟลเดอร์ที่แตก ZIP** แล้วรัน:

```powershell
.\install.cmd
```

ทางเลือกที่ให้ผลเดียวกันผ่าน Node:

```powershell
node .\bin\install.mjs
```

ติดตั้ง Skills สำหรับ Windows user ปัจจุบันไว้ที่ `%USERPROFILE%\.agents\skills` และเตรียม runtime ร่วมกัน ไม่ต้อง npm install ในแต่ละ test workspace

หลังติดตั้ง ตรวจจากโฟลเดอร์ที่แตก ZIP:

```powershell
node .\bin\cli.mjs doctor
node .\bin\cli.mjs runtime-doctor
node .\bin\cli.mjs version
```

`doctor` ตรวจไฟล์ Skill ส่วน `runtime-doctor` ตรวจ Playwright/Chromium ถ้าติดตั้งไม่สำเร็จ ดู log ที่ `install-logs/` หรือตำแหน่งจริงที่ installer แสดงท้ายหน้าต่าง

## 4. อัปเดตเครื่องที่ติดตั้งรุ่นเก่าอยู่แล้ว

แตก ZIP รุ่นใหม่ในโฟลเดอร์ใหม่ แล้วรัน `install.cmd` จากชุดใหม่นั้น ตัวติดตั้งจำรุ่นก่อนหน้าให้ และจะหยุดเมื่อพบ Skill ที่ผู้ใช้แก้ไขเองแทนการเขียนทับเงียบ ๆ

ตรวจรุ่นและสิ่งที่เปลี่ยนจากโฟลเดอร์ชุดใหม่:

```powershell
node .\bin\cli.mjs version
node .\bin\cli.mjs update-info
node .\bin\cli.mjs update-info --from 0.6.1
```

เปิด Codex แชตใหม่เพื่อโหลดคำแนะนำชุดปัจจุบันครบถ้วน หรือใช้แชตเดิมต่อได้ โดยเมื่อมีการเรียก Skill/helper/runner ที่รองรับ ระบบจะตรวจอัปเดตและแจ้ง:

- **Installed version** — รุ่นที่ติดตั้งจริง
- **Session version** — รุ่นที่ AI เคยสังเกตตอนโหลด หรือ “ไม่ทราบ”
- **Update summary** — สรุป changelog ในช่วงรุ่นนั้น
- **สิ่งที่ต้องทำต่อ** — คำแนะนำตามสถานะ

การตรวจเกิดเมื่องานหรือเครื่องมือทำงาน ไม่เด้ง popup ในแชตที่หยุดอยู่ เลขรุ่นบนดิสก์อย่างเดียวไม่ยืนยันว่าแชตโหลดรุ่นใหม่แล้ว ดูรายละเอียด [version.md](skills/ssd-ai-tester/references/version.md)

## 5. เริ่มใช้ใน Codex

| Skill | ใช้ทำอะไร |
| --- | --- |
| `$ssd-get-started` | แนะนำสิ่งที่ต้องเตรียมและวิธีเริ่ม |
| `$ssd-skill-list` | แสดง Skills และคำสั่ง รวม version/update-info |
| `$ssd-ai-tester` | อ่านโค้ด วางแผน สร้าง/รัน Playwright และสรุปรายงาน |

ตัวอย่างคำขอ เปลี่ยน URL และ path ให้ตรงกับงานจริง:

```text
$ssd-ai-tester เตรียม workspace ทดสอบระบบคำขอในโฟลเดอร์นี้
URL https://uat.example.test สภาพแวดล้อม UAT
อ่าน requirement และ Repomix ที่แนบก่อนสร้าง Playwright script
ทดสอบการค้นหา เก็บภาพ และสรุปรายงานภาษาไทย
```

เมื่อมีสคริปต์แล้ว:

```text
$ssd-ai-tester run-script รันเฉพาะเคสค้นหาใน workspace นี้
$ssd-ai-tester version
$ssd-ai-tester update-info
```

AI เลือก reference ตามประเภทงานเอง ใช้ source/Repomix ก่อนสร้างสคริปต์เมื่อมีโค้ด และเปิด Browser Use เฉพาะเมื่อจำเป็น หากส่ง Repomix ชุดใหม่ AI ต้องตรวจ hash และทบทวน test ที่กระทบก่อนรัน

Browser Use ต้องมีในแชตแยกจากการติดตั้งชุดนี้ สคริปต์ที่พร้อมใช้จะรัน headless โดยตรง; desktop Computer Use ใช้เมื่อผู้ใช้เลือกชัดเจน

## 6. Workspace และผลทดสอบอยู่ที่ไหน

test workspace แยกจากโฟลเดอร์ติดตั้ง Skill และเลือกตามงานได้:

```text
qa-workspace/
  ssd-workspace.json
  requirements/
  test-data/
  context/               source fingerprint และ review
  tests/                 Playwright scripts
  playwright/.auth/      session เฉพาะเครื่อง
  runs/<run-id>/         report.html / report.md / report.json
                         results.json / run.json / screenshots/
                         runner.log / technical-results.json
                         playwright-report/ / artifacts/
```

`report.html` เป็นรายงานไทยหลัก มีภาพฝังและส่งต่อเป็นไฟล์เดียวได้ ส่วน `run.json` ระบุ context ที่อ้างอิงในรอบนั้น เก็บ auth/session และ trace ที่มีข้อมูลลับตามขอบเขตงาน ไม่แนบข้อมูลเหล่านี้ในชุดแจก

ตัวอย่าง CLI ให้รันจาก root โปรเจกต์หรือโฟลเดอร์ที่แตก ZIP:

```powershell
node .\bin\cli.mjs workspace --workspace "C:\QA\claims-uat" --title "ระบบคำขอ" --url "https://uat.example.test" --environment UAT
node .\bin\cli.mjs run --workspace "C:\QA\claims-uat" --list
node .\bin\cli.mjs run --workspace "C:\QA\claims-uat" --grep "ค้นหา"
```

ถ้ามี source/Repomix ให้ AI ลงทะเบียน context และทำ review ตาม [Code Context](skills/ssd-ai-tester/references/code-context.md) ก่อน run ค่า exit code ต้องอ่านร่วมกับรายงาน ไม่ใช่การรับรองระบบทั้งหมด

## 7. คำสั่งสำหรับผู้พัฒนา

รันจาก root โปรเจกต์:

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `node .\scripts\check-release.mjs` | ตรวจ tests ก่อน Release |
| `node .\scripts\verify-playwright.mjs` | ตรวจ integration ผ่านเว็บจำลอง รวมผลผ่าน/ไม่ผ่านที่ตั้งใจใช้ตรวจรายงาน |
| `node .\scripts\verify-release.mjs` | ตรวจ ZIP ของรุ่นใน package.json ตั้งแต่แตกไฟล์ ติดตั้ง รัน headless และรายงาน |
| `node .\scripts\sync-release.mjs` | ทำ Skill metadata/release notes ให้ตรง package.json และ changelog |
| `node .\bin\cli.mjs --help` | ดูคำสั่ง CLI ทั้งหมด |

ตัวอย่าง Telesale ที่ผูกกับระบบ UAT เฉพาะอยู่ใน [examples/telesale](examples/telesale/README.md) อ่านและเตรียมข้อมูลทดสอบให้ตรงขอบเขตก่อนรัน

เอกสารเพิ่มเติม: [Release workflow](RELEASING.md), [Changelog](CHANGELOG.md), [Playwright](skills/ssd-ai-tester/references/playwright.md), [Task routing](skills/ssd-ai-tester/references/task-routing.md), [Failure analysis](skills/ssd-ai-tester/references/failure-analysis.md), [Test data](skills/ssd-ai-tester/references/test-data.md)
