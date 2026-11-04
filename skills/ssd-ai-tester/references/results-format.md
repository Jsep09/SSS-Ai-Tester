# รูปแบบผลและรายงาน

เขียน `results.json` เป็น UTF-8 ใช้โครงนี้ (ตัวอย่างเป็นกรณีที่ยังไม่ได้ทดสอบ):

```json
{
  "schemaVersion": 1,
  "runId": "ใช้ค่าจาก init",
  "title": "ระบบคำขอ",
  "url": "https://example.test",
  "environment": "UAT",
  "startedAt": "2026-11-03T14:30:00+07:00",
  "finishedAt": null,
  "tester": "Codex / Browser Use (built-in browser)",
  "execution": { "engine": "browser-use", "isolation": "browser-tab" },
  "mode": "real",
  "scope": ["การค้นหาคำขอด้วยเลขที่"],
  "limitations": ["ยังไม่ตรวจบทบาทผู้อนุมัติ"],
  "cases": [{
    "id": "TC-001",
    "title": "ค้นหาเลขคำขอแล้วพบรายการตรงกัน",
    "requirement": "AC-01: ผู้ใช้ต้องค้นหาเลขคำขอที่มีอยู่ได้",
    "priority": "high",
    "preconditions": "เข้าสู่ระบบแล้ว และมีคำขอ TEST-001 ใน UAT",
    "steps": [{
      "action": "กรอก TEST-001 ในช่องเลขคำขอ แล้วกดค้นหา",
      "expected": "แสดงรายการเลขที่ TEST-001"
    }],
    "expected": "แสดงรายการตรงเลขที่และเปิดรายละเอียดได้",
    "actual": "",
    "status": "not-run",
    "reason": "ยังไม่เริ่มทดสอบ",
    "evidence": []
  }]
}
```

เมื่อได้ผล ให้เปลี่ยนสถานะและเขียน actual ที่เป็นสิ่งที่เห็นจริง ลบ reason เดิมเมื่อไม่เกี่ยวข้อง:

- `passed` / `failed` ต้องมี actual และภาพหลักฐานอย่างน้อยหนึ่งภาพ
- `blocked` / `skipped` / `not-run` ต้องมี reason; หลักฐานภาพเป็น optional
- priority คือความสำคัญของกรณี: `high`, `medium`, `low`
- `failed` เพิ่ม `defect: { "severity": "high", "impact": "ผู้ใช้ไม่สามารถส่งคำขอได้", "nextAction": "ทีมพัฒนาตรวจการบันทึก แล้ว QA ทดสอบกรณีนี้ซ้ำ" }` ระดับ severity = critical/high/medium/low พิจารณาจากผลกระทบธุรกิจ ไม่เดาสาเหตุในโค้ด
- ภาพใช้ `{ "path": "screenshots/TC-001-result.png", "caption": "ผลค้นหาตรงเลขคำขอที่กรอก", "capturedAt": "เวลาจริง ISO 8601 พร้อม timezone" }` ใช้ `/` ใน path ทุกระบบ ไม่ใส่ absolute path, URL หรือ `..`
- finishedAt เป็น null ระหว่างดำเนินการ ใส่เวลาจริงเมื่อจบรอบ; `mode: demo` เฉพาะรอบสาธิตที่ต้องแสดงป้ายว่าไม่ใช่ผลรับรองระบบจริง
- scope และ limitations เป็น array ของข้อความ ห้ามบันทึก password, OTP, token, cookie หรือ URL ที่มี secret
- `execution` บอกวิธีที่ใช้จริง: Browser Use ใช้ `engine: browser-use, isolation: browser-tab`; desktop Computer Use ใช้ `engine: desktop-computer-use` กับ `isolation: dedicated-machine` สำหรับ VM/เครื่องเฉพาะ หรือ `shared-desktop` สำหรับ desktop ที่ผู้ใช้ใช้ร่วมกัน ค่า init เป็น `unselected / unverified` จนเลือก runtime จริง รายงานรุ่นเก่าที่ไม่มี execution ยังอ่านได้ โดยแสดงว่าไม่ได้บันทึกวิธีทดสอบ ไม่เดาว่าเป็น background
- โหมดรันสคริปต์ใช้ `engine: playwright-test, isolation: browser-context` ผ่าน reporter อัตโนมัติ ไม่ต้องแปลงผลเอง อ่าน [playwright.md](playwright.md) สำหรับ schema ของ business metadata และตำแหน่งผลแต่ละรอบ

สร้างรายงาน:

```text
node "<absolute skill path>/scripts/report.mjs" report "<run directory>"
```

ได้ `report.html`, `report.md`, `report.json` ตัว generator ตรวจโครงสร้าง สถานะ และไฟล์ภาพ PNG/JPEG ภายในรอบนั้น แต่ยืนยันไม่ได้ว่าข้อความสรุปตรงกับภาพหรือไม่ ผู้ทดสอบต้องตรวจความสอดคล้องนี้เองก่อนส่งมอบ

HTML ไม่มี remote font, script หรือภาพภายนอก เปิดออฟไลน์ได้ และใช้เมนู Print / Save as PDF ของ browser ได้ Markdown อ้างอิงภาพแยกใน screenshots JSON มีผลต้นฉบับพร้อมตัวเลขสรุปที่คำนวณใหม่เสมอ ไม่ใช้ตัวเลขสรุปที่กรอกเอง

อัตราผ่าน = ผ่าน / (ผ่าน + ไม่ผ่าน) แสดงควบคู่จำนวนตรวจสอบได้เทียบทุกกรณีเสมอ กรณี blocked/skipped/not-run ไม่ถูกนับเป็นผ่าน และกรณีทดสอบได้ 1 จาก 10 แม้ผ่าน 100% ก็ห้ามสรุปว่าเสร็จครบแล้ว
