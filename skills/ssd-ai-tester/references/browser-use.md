# ทดสอบเว็บในแท็บแยก

ใช้ Browser Use ของ Codex เป็นค่าเริ่มต้น เพื่อส่งการคลิก/กรอกข้อมูลผ่าน API ของแท็บและเก็บภาพแท็บ โดยไม่ส่ง mouse/keyboard input ไปยัง desktop ผู้ใช้ ใช้เฉพาะ API ที่เอกสาร runtime ปัจจุบันเปิดให้ใช้ ไม่ติดตั้ง browser automation runner หรือเปิด CDP port เอง

## เลือก session

1. ทำตาม browser ที่ผู้ใช้ระบุ หากไม่ได้ระบุให้เลือก built-in browser และสร้างแท็บใหม่เฉพาะรอบทดสอบ ไม่แตะ browser ส่วนตัว
2. ถ้ามี `cua_repl` ให้เริ่มตาม entry point ของเครื่องมือนั้น อ่านเอกสารที่คืนมา ตัวอย่างสำหรับสร้างแท็บใหม่: `let testTab = await cua.createBrowserTab('iab', targetUrl, { visible: false });` ให้แทน `targetUrl` ด้วย URL ที่ผู้ใช้อนุญาตก่อนใช้ ถ้ามี binding อยู่แล้วให้ใช้ต่อ ไม่สร้าง session ซ้ำโดยไม่จำเป็น
3. ต้องใช้ Chrome profile ที่ login ไว้ ให้เชื่อมผ่าน extension ตามเอกสาร runtime แล้วสร้างแท็บทดสอบใหม่ ไม่ควบคุม Chrome ผ่าน native Windows API การตั้ง `visible: false` เป็นเพียงความต้องการด้านการแสดงผล ต้องตรวจว่า backend รองรับจริง ไม่เดาว่าแค่ซ่อนหน้าต่างก็แยก native input แล้ว
4. built-in browser มี profile แยกจาก Chrome ปกติ จึงอาจต้อง login ใหม่ ใช้บัญชีทดสอบและให้ผู้ใช้เข้าระบบหาก runtime ต้อง handoff ระหว่างนี้ไม่แตะแอปอื่น เมื่อได้รับ session กลับมาให้สังเกตหน้าใหม่ก่อนรันต่อ
5. อย่าเปลี่ยน clipboard ของ desktop ผ่าน copy/paste ถ้าใช้ fill/type ภายในแท็บได้ อย่าเปิด OS file dialog; ใช้ upload/download API ของแท็บที่มีเอกสารรองรับตามสิทธิ์ที่ผู้ใช้ให้ หากทำไม่ได้ให้ blocked

## สังเกต → ทำ → ตรวจผล

อ่าน DOM/accessibility snapshot หรือภาพล่าสุดก่อนเลือกเป้าหมาย ใช้ locator/element ที่ได้จากสิ่งที่เห็นจริง ทำ action แล้วตรวจผลใหม่ ห้ามใช้ evaluate เพื่อแก้ DOM/ใส่ผลลัพธ์แทนการโต้ตอบของผู้ใช้ ห้ามเรียก API/ฐานข้อมูลแทนขั้นตอน UI แม้ page จะมี WebMCP ก็ตาม เพราะงานนี้ต้องพิสูจน์เส้นทางหน้าจอ

ถ้า runtime รองรับ `tab.playwright` สามารถใช้ `getByRole`, `getByLabel`, `fill`, `click`, `domSnapshot` ตามเอกสารที่โหลดจริงได้ โดยไม่ต้องติดตั้ง Playwright เพิ่ม หลีกเลี่ยง native input fallback ถ้า browser ถูกผู้ใช้ยึดคืนหรือเครื่องมือหยุด ให้หยุด input และบันทึกข้อจำกัด ไม่วนยึดแท็บกลับ

บันทึก `execution: { "engine": "browser-use", "isolation": "browser-tab" }` และ `tester` ที่บอก browser/backend จริงก่อนทดสอบ การแยกแท็บไม่แยกข้อมูลธุรกิจหรือ cookies ภายใน profile เดียวกัน ห้ามบอกว่าผู้ใช้ทำงานในบัญชีเดียวกันได้โดยไม่มีผลต่อกัน

## ภาพหลักฐาน

เก็บ screenshot จาก API ของแท็บ ณ จุดยืนยันผล ไม่ใช้ภาพ desktop หาก runtime คืน PNG/JPEG bytes และอนุญาตให้บันทึก artifact ใช้ helper `saveEvidenceBytes` จาก `scripts/evidence.mjs`; ถ้าคืน local file ให้คัดลอกตามวิธีที่ runtime อนุญาต ถ้าคืน data URL ให้ใช้ `saveEvidence` เดิม

```js
// Only after loading the actual browser runtime documentation.
// Replace module URL and directory with actual absolute paths.
const evidence = await import('file:///C:/actual/skill/scripts/evidence.mjs');
const imageBytes = await testTab.getScreenshot(); // when this method is documented by the current runtime
const record = await evidence.saveEvidenceBytes(
  'C:/actual/project/test-results/current-run', imageBytes,
  'TC-001-result.png', 'หลังค้นหา แสดงคำขอตรงเลขที่ที่กรอก'
);
```

ถ้า REPL ไม่รองรับ import/เขียนไฟล์ ให้ใช้วิธี export screenshot ที่ runtime รองรับ ไม่ใช้ shell จับภาพหน้าจอทดแทน ทุกภาพต้องมาจากการรันจริง ห้ามสร้างภาพจำลองหรือใช้ภาพรอบเก่า หากภาพมีความลับ/ข้อมูลส่วนบุคคลที่ส่งมอบไม่ได้ ให้หลีกเลี่ยงข้อมูลนั้นก่อน capture หรือบันทึก blocked เพราะขาดหลักฐานที่แชร์ได้ อย่าแต่งภาพเปลี่ยนผล

ใส่ path/caption/capturedAt ที่คืนมาใน evidence ของกรณี ภาพอย่างน้อยหนึ่งภาพต่อ passed/failed และตรวจว่าพิสูจน์ผลจริง บันทึกภาพทันทีหลัง capture และไม่แสดงซ้ำเพียงเพื่อดูถ้า runtime แสดงให้แล้ว

หลังจบให้ปิดเฉพาะแท็บชั่วคราวที่สร้างเองตามนโยบาย runtime เก็บรายงาน/ภาพเป็นไฟล์ ไม่ปิดแท็บของผู้ใช้ โหมดนี้ไม่รับรองทำงานต่อเมื่อ Codex ปิดหรือเครื่อง sleep/lock
