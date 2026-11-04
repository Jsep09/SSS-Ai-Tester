# ตรวจรุ่นและสรุปอัปเดต

รองรับคำขอ “ใช้เวอร์ชันอะไร”, “อัปเดตแล้วหรือยัง”, “รุ่นใหม่มีอะไร” และโหมด version/update-info ไม่ต้องเปิด browser หรือเริ่มทดสอบเว็บ

## ตรวจอัตโนมัติก่อนเริ่มงานแต่ละครั้ง

ก่อนเริ่ม task ที่ใช้ Skill ทุกครั้ง ให้เรียก helper ด้วย --auto โดยไม่รอให้ผู้ใช้สั่ง version จำค่า metadata.version ของ SKILL.md ที่โหลดครั้งแรกไว้เป็นรุ่นที่ AI สังเกต อย่าอ่านไฟล์ปัจจุบันบนดิสก์แล้วย้อนอ้างว่าแชตเคยโหลดรุ่นนั้นก่อนติดตั้ง หากไม่มีค่าเดิม เช่น skill รุ่นเก่าไม่มี metadata.version ให้ไม่ส่ง --session-version และแสดง “ไม่ทราบ”

```text
node "<absolute ssd-ai-tester skill>/scripts/version.mjs" version --auto --session-version "<รุ่นที่สังเกตตอนโหลด Skill ครั้งแรก>"
node "<absolute ssd-ai-tester skill>/scripts/version.mjs" version --session-version "<รุ่นที่สังเกตตอนโหลด Skill>"
node "<absolute ssd-ai-tester skill>/scripts/version.mjs" update-info --session-version "<รุ่นที่สังเกตตอนโหลด Skill>"
node "<absolute ssd-ai-tester skill>/scripts/version.mjs" update-info --from 0.5.0
```

helper หา sibling Skills จากที่ตั้งตัวเอง ใช้ --skills-dir ได้เมื่อต้องตรวจอีกตำแหน่ง ไม่ต้องมี global CLI โหมดจากแพ็กเกจใช้ `node bin/cli.mjs version` หรือ `node bin/cli.mjs update-info` และรองรับ --json; --version/-v เป็น alias ของ version

เมื่อ helper ส่ง notification ให้แสดงข้อความนั้นต่อผู้ใช้ใน commentary ก่อนทำงานต่อ โดยคง 4 หัวข้อ **Installed version**, **Session version**, **Update summary**, **สิ่งที่ต้องทำต่อ** ไม่ใช้ข้อความจาก tool แล้วเงียบข้ามไปทำ test ถ้าไม่มี notification ให้ทำงานต่อโดยไม่แสดง banner ซ้ำ ไม่ต้องถามอนุมัติหรือบังคับเปิดแชตใหม่ หากผู้ใช้ต้องการใช้แชตเดิมให้ทำงานที่ได้รับอนุญาตต่อพร้อมข้อจำกัดที่แจ้งแล้ว

--auto จำประวัติแยกตาม CODEX_THREAD_ID (หรือ CODEX_SESSION_ID เมื่อมี) และตำแหน่งชุดติดตั้ง เก็บรุ่น session แรกที่มีหลักฐานและรุ่นติดตั้งที่เคยเห็นใน ~/.ssd-ai-tester/version-sessions/ ไม่เก็บ ID แชตแบบข้อความดิบ หากไม่มี ID หรือเขียนประวัติไม่ได้ อาจแจ้งซ้ำโดยต้องไม่หยุดการทดสอบ ตั้ง SSD_TESTER_VERSION_STATE เป็นโฟลเดอร์ที่เขียนได้เพื่อแยกพื้นที่เก็บประวัติได้

ตัว runner/helper ของ workspace และคำสั่ง install/list/doctor ตรวจให้ด้วย แม้แชตเก่าไม่ได้เรียก version เอง แต่การตรวจนี้เกิดเมื่อมีการเรียกเครื่องมือครั้งถัดไป ไม่ใช่ popup/push notification ในแชตที่หยุดทำงานหรือปิดอยู่ หากแชตเก่าไม่ได้เรียก skill/helper/runner ใดเลย จะตรวจการติดตั้งใหม่เองไม่ได้

สำหรับ session ก่อนมีระบบเก็บประวัติ อาจตรวจได้ว่าติดตั้งอัปเดตจาก previousVersion แต่ Session version ยังไม่ทราบ ต้องแสดงข้อจำกัดนี้ ไม่ใช้ previousVersion เป็นหลักฐานว่ารุ่น session เท่ากัน

## ความหมายและข้อจำกัด

- Installed มาจาก manifest ของ installer พร้อมเทียบ hash ไฟล์จริงครบทั้ง 3 Skills ไม่ใช้รุ่นของ ZIP/checkout แทนรุ่นที่ติดตั้ง
- Session (reported) เป็นข้อมูลที่ caller/AI ส่งให้ ไม่ใช่การตรวจหน่วยความจำของ Codex การตรงกันของเลขรุ่นไม่พิสูจน์ว่า references ทุกไฟล์ในแชตถูกโหลดใหม่
- Previous installed บันทึกการติดตั้งก่อนหน้าที่ version ต่างกัน ติดตั้งรุ่นเดิมซ้ำไม่เปลี่ยน baseline; ชุดเก่าที่ไม่มี manifest จะไม่เดารุ่น
- update-info ใช้ --from หากระบุ มิฉะนั้นใช้ session ที่เก่ากว่า installed หรือ previousVersion แล้วรวม release notes ของทุกรุ่นในช่วง หากไม่มี baseline จะแสดงเฉพาะรุ่นที่ติดตั้งพร้อมบอกข้อจำกัด
- release notes มาจาก changelog ที่แนบในชุดติดตั้ง ไม่เรียก GitHub และไม่อ้างว่าเป็นรุ่นล่าสุดบนอินเทอร์เน็ต หาก metadata ไม่ตรงหรือไม่มี ให้บอกว่าไม่มีสรุปที่เชื่อถือได้จากชุดนี้

สรุป features, fixes และประสิทธิภาพตาม release notes จริงเท่านั้น ไม่อ้างตัวเลขเร็วขึ้นหากไม่มีผลวัด ถ้าไฟล์ถูกแก้หรือชุดติดตั้งต่างรุ่น แสดงคำเตือนและแนะนำ doctor/ติดตั้งจากแพ็กเกจที่ต้องการ หาก session ต่างรุ่นหรือไม่ทราบหลังอัปเดต แนะนำเปิดแชตใหม่ แต่ไม่ปิดแชต รีสตาร์ต หรือติดตั้งเองเพียงเพราะเรียก version

version/update-info ปกติอ่านอย่างเดียว ส่วน --auto เขียนเฉพาะประวัติการแจ้ง ไม่ใช่ gate ที่หยุดงานทดสอบทั้งหมด ถ้าไม่มี Node/helper ให้แจ้งข้อจำกัดและใช้ข้อมูลไฟล์ที่อ่านได้โดยไม่ยืนยัน session เกินหลักฐาน
