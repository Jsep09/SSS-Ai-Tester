# ใช้ Computer Use และเก็บหลักฐาน

ใช้เอกสารนี้เฉพาะเมื่อผู้ใช้เลือก desktop Computer Use ไว้ชัดเจน ค่าเริ่มต้นของการทดสอบเว็บอยู่ใน [browser-use.md](browser-use.md)

บน Windows runtime นี้ใช้ foreground และเมาส์/คีย์บอร์ดของ session เดียวกัน ซ่อนหรือ minimize หน้าต่างไม่ได้ทำให้ทำงานเบื้องหลัง ผู้ใช้ที่ต้องทำงานพร้อมกันต้องรัน Codex และ browser ใน VM/เครื่องทดสอบเฉพาะที่เตรียมไว้แล้ว ไม่สร้าง VM หรือตั้งค่า remote access เพิ่มเองนอกขอบเขต

บันทึก `execution.engine: desktop-computer-use` กับ `isolation: dedicated-machine` เมื่อยืนยันว่าเป็นเครื่อง/VM ทดสอบเฉพาะจริง ถ้าใช้ desktop เดียวกับผู้ใช้ต้องระบุ `shared-desktop` และแจ้งผลกระทบ ห้ามอ้างว่าเป็น background หรือสลับจาก Browser Use มาใช้โดยเงียบ ๆ

โหลด Skill `computer-use` ที่มีอยู่ใน session รวมทั้งเอกสารที่ Skill นั้นบังคับให้อ่านก่อนควบคุมแอป ให้เอกสาร runtime ที่โหลดจริงเป็นหลัก หากไม่มี Skill แต่มีเครื่องมือ Computer Use ให้เปิดและอ่านคำแนะนำเครื่องมือนั้น อย่าเดา API หรือค้นหา executable ภายในมาเรียกเอง

ทดสอบผ่านหน้าจอและระบุวิธีที่ใช้ในรายงาน ไม่ตรวจ API/ฐานข้อมูลเพื่ออ้างว่าเส้นทางหน้าจอผ่าน หาก Computer Use ใช้งานไม่ได้ ให้บันทึก blocked ห้ามเปลี่ยนไปควบคุม desktop หลักของผู้ใช้แทนเครื่องทดสอบ

## Windows runtime ที่ใช้ @oai/sky

ใช้ `node_repl` และ initialization ตาม Skill ที่ติดตั้งจริง ไม่ติดตั้ง `@oai/sky` จาก npm เพราะเป็น runtime ที่ Codex จัดเตรียมให้ อย่าสั่งคำสั่ง shell ผ่าน terminal UI, Run dialog หรือช่อง URL ห้าม automate ตัว Codex เอง

เลือกแอปและหน้าต่างจาก object ที่ runtime คืนมาให้ได้หนึ่งหน้าต่างแน่นอนก่อน input ใช้ loop สอง cell: cell แรกสังเกตแล้วหยุดอ่าน screenshot/tree; cell ถัดไปทำหนึ่ง action แล้ว refresh ทันที ไม่วนคลิกด้วย coordinates ที่จำมาจากสถานะเก่า ตรวจ focus ก่อนพิมพ์ รีเฟรชหลัง navigation/modal ทุกครั้ง

Screenshots จาก `sky.get_window_state` แสดงให้อ่านอัตโนมัติแล้ว ห้าม decode/emit ซ้ำเพียงเพื่อดูภาพ แต่ผู้ใช้ขอไฟล์หลักฐาน จึงบันทึกข้อมูลภาพที่ runtime คืนมาเป็น deliverable ได้ ใช้ helper นี้จาก node_repl หลังสังเกตผลแล้ว:

```js
// Replace the skill path and run directory with actual absolute paths.
// On Windows use file:///C:/... for the import URL.
globalThis.evidenceTools = await import('file:///C:/actual/skill/scripts/evidence.mjs');
// state must be a fresh result returned by the current Computer Use runtime.
globalThis.evidenceRecord = await evidenceTools.saveEvidence(
  'C:/actual/project/test-results/current-run',
  state.screenshots[0],
  'TC-001-result.png',
  'หลังค้นหา ระบบแสดงคำขอเลขที่ที่ระบุ'
);
nodeRepl.write(JSON.stringify(evidenceRecord));
```

เพิ่ม object ที่คืนมาใน `cases[].evidence` เลือกภาพที่แสดงผลตามเกณฑ์จริง ถ้าต้องใช้ภาพก่อน/หลัง ให้ตั้งชื่อแยกกัน ถ้า runtime อื่นส่ง local path ให้ copy ภาพตามวิธีที่ runtime อนุญาตและใส่ path/caption/capturedAt ตาม schema โดยไม่เดาว่า screenshot มี `.url` เหมือน sky

## ความน่าเชื่อถือของหลักฐาน

- เก็บภาพหน้าจอจริงจากรอบทดสอบ ห้ามใช้ ImageGen, วาดภาพเลียนแบบ, ภาพรอบเก่า หรือภาพตัวอย่างแทนผลจริง
- อย่างน้อยหนึ่งภาพต่อกรณี passed/failed; ภาพต้องแสดงจุดยืนยัน ไม่ใช่เพียงหน้าเริ่มต้น บันทึกคำอธิบายว่าภาพพิสูจน์เรื่องใด
- หลีกเลี่ยงการแสดงข้อมูลส่วนบุคคล/ความลับในหน้าจอก่อนจับภาพ หากภาพไม่สามารถแชร์ได้อย่างเหมาะสม ให้หยุดบันทึกภาพนั้นและระบุ blocked เพราะไม่มีหลักฐานที่ส่งมอบได้ อย่าลบข้อความผิดพลาดหรือแต่งภาพให้ผลเปลี่ยน
- capturedAt คือเวลาบันทึกภาพในรอบปัจจุบัน เก็บหลัง capture ทันที ไม่ใส่เวลาจำลอง
- หากไม่สามารถบันทึกภาพจาก runtime ได้ ให้แจ้งข้อจำกัดและเก็บผลเป็น blocked ไม่สร้างไฟล์ปลอมเพื่อให้ validator ผ่าน
- ถ้าการยืนยันตัวตนหรือข้อห้าม runtime ขวาง ให้ผู้ใช้ทำขั้นตอนนั้นเอง แล้วสังเกตใหม่เมื่อผู้ใช้ส่งกลับ ไม่ข้าม barrier หรือเรียก API แทน
