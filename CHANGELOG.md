# Changelog

## [0.6.1] - 2026-11-04

- ตรวจรุ่นก่อนเริ่มงานแต่ละครั้งและก่อน runner ทำงาน เพื่อแจ้งแชตเดิมเมื่อชุดติดตั้งเปลี่ยน
- เพิ่ม version --auto และประวัติรายแชต ป้องกันการแจ้งรุ่นเดิมซ้ำโดยไม่เปลี่ยน Session version ให้เท่ารุ่นติดตั้งเอง
- ใช้ข้อความ Installed version, Session version, Update summary และสิ่งที่ต้องทำต่อ; session ที่ไม่มีหลักฐานรุ่นเดิมแสดงไม่ทราบ
- แจ้งเมื่อมีการเรียกงาน/เครื่องมือครั้งถัดไป ไม่รองรับ popup ในแชตที่ไม่มีการทำงาน

## [0.6.0] - 2026-11-04

- เพิ่ม version/--version และ update-info ตรวจรุ่นติดตั้งเทียบกับรุ่น session ที่แจ้ง โดยแสดงไม่ทราบเมื่อไม่มีข้อมูล session
- เก็บ previousVersion ตอนติดตั้งและแนบ release notes ในแต่ละ Skill เพื่อสรุปการอัปเดตได้แม้ไม่ได้เก็บ ZIP ต้นทาง
- เพิ่มคำสั่งตรวจเวอร์ชันใน skill-list และให้ AI ตรวจแบบสั้นเมื่อเริ่มใช้งาน Skill ในแชต
- ตรวจชุดติดตั้งต่างรุ่น/ไฟล์แก้ไข และสร้าง metadata.version/release notes ให้ตรง package.json ตอนแพ็ก release

- เพิ่ม task-routing ให้ AI อ่าน reference ตามเจตนางานโดยผู้ใช้ไม่ต้องเรียกเอง
- เพิ่มมาตรฐาน failure-analysis และ test-data สำหรับแยกสาเหตุ เตรียมข้อมูล และป้องกันการส่งรายการซ้ำ
- เชื่อม workflow ใน SKILL.md, Playwright และ Code Context โดยไม่เพิ่ม runner gate หรือเปลี่ยน schema ผลทดสอบ

## [0.5.0] - 2026-11-04

- Code-first: สร้าง locator/script จาก source แล้วรันจริง ใช้ Browser Use เฉพาะเมื่อจำเป็น
- เพิ่ม context/context-review รองรับหลาย source file หรือ Repomix ทุก format ตรวจ SHA-256 ก่อน run และหยุดเมื่อยังไม่ review ชุดปัจจุบัน
- รองรับการเขียนทับ input เดิม/ลงทะเบียนชุดใหม่ เก็บ fingerprint และการวิเคราะห์ใน run.json; workspace ไม่มี context ยังใช้แบบ black-box ได้
- เพิ่ม context/ ที่ gitignore ใน workspace ใหม่และคู่มือวิเคราะห์ผลกระทบโดยไม่สร้าง tests ใหม่ทั้งหมด

- เพิ่ม Git, release-it, lockfile และขั้นตอนสร้าง changelog/ZIP/Git tag สำหรับแต่ละเวอร์ชัน

## [0.4.1] - 2026-11-03

- เพิ่มตัวอย่าง Telesale: สร้างหลีด คัดลอก PH Application กรอกใบคำขอ และแนบเอกสาร 3 ประเภท
- Login โดยผู้ใช้เอง รองรับ headed/headless และรันต่อจาก checkpoint
- แยก bot.config.json ให้ BA/QA แก้ headless และ slowMo เอง ค่าเริ่มต้น false และ 0
- ใช้ชื่อจำลอง E2E TEST และเอกสาร PNG จำลองสำหรับ UAT ตามรอบที่ทดสอบแล้ว
- ปรับตัวอย่างให้ใช้ path สัมพันธ์กับแพ็กเกจ สามารถแตก ZIP ไปเครื่องอื่นหลังติดตั้ง runtime
- ชุดแจกไม่รวม session, auth, checkpoint, trace หรือผลรันของเครื่องผู้พัฒนา
