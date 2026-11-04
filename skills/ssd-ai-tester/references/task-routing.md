# เลือกเส้นทางก่อนเริ่มงาน

ใช้คำขอภาษาปกติเลือกงาน ไม่ต้องให้ผู้ใช้พิมพ์ชื่อโหมดหรือเรียก skill เพิ่ม อ่านไฟล์ที่จำเป็นตามลำดับด้านล่าง ไฟล์ที่อ่านแล้วในแชตและยังไม่เปลี่ยนไม่ต้องโหลดซ้ำทั้งหมด แต่ตรวจสถานะ context ใหม่ก่อนสร้าง/แก้/รันสคริปต์

## ระบุงานและพื้นที่

หา workspace จาก path ที่ผู้ใช้ระบุหรือ ssd-workspace.json ใกล้ที่สุดตาม [playwright.md](playwright.md) ยืนยันระบบ/URL/environment, ขอบเขตเคส, บทบาท/session และ AC จากข้อมูลที่มี ถ้าจำเป็นจริงและหาไม่ได้ให้ถามรวมกัน ระหว่างรอทำส่วนที่ไม่ขึ้นกับคำตอบต่อได้ ไม่เดา URL หรือใช้ workspace ของอีกระบบ

งาน report-only ใช้ผลรันเดิมเป็นหลัก ไม่ต้องตั้ง session ใหม่หรือขอ source/ข้อมูลที่ไม่จำเป็น งาน plan-only ไม่เปิด browser หรือรันทดสอบ งานเตรียม workspace อย่างเดียวไม่เริ่มทดสอบระบบเอง

## Reference ที่ต้องอ่านตามงาน

| เจตนาจากคำขอ | ลำดับอ่านและดำเนินการ |
| --- | --- |
| เช็กเวอร์ชัน/ติดตั้งแล้วแชตใช้รุ่นไหน/มีอะไรอัปเดต | [version.md](version.md); ใช้ version หรือ update-info ไม่เปิด browser/รันทดสอบ |
| ออกแบบเคส/เพิ่ม AC | [planning.md](planning.md); ถ้าต้องออกแบบจากโค้ด ให้อ่าน [code-context.md](code-context.md) เพิ่ม; จบที่แผนเมื่อผู้ใช้ขอแผนอย่างเดียว |
| เตรียม workspace | [playwright.md](playwright.md); ถ้ามี source/Repomix ให้ใช้ [code-context.md](code-context.md) ลงทะเบียนชุดที่เกี่ยวข้อง |
| สร้าง/เพิ่ม/แก้สคริปต์ | [code-context.md](code-context.md) เมื่อมี source; [planning.md](planning.md) เฉพาะเคส/AC ใหม่; [test-data.md](test-data.md); [playwright.md](playwright.md) แล้วสร้างและรันจริงเมื่ออยู่ในขอบเขตคำขอ |
| รัน/smoke/regression ที่มีสคริปต์ | [playwright.md](playwright.md); ตรวจ source/Repomix ตาม [code-context.md](code-context.md) เมื่อมี; [test-data.md](test-data.md); [results-format.md](results-format.md) แล้วรันเฉพาะเคสที่สั่ง ไม่สร้างแผน/สคริปต์หรือสำรวจทุกคลิกใหม่โดยไม่มีเหตุ |
| ส่ง Repomix/source ชุดใหม่ | [code-context.md](code-context.md); เปรียบเทียบและวิเคราะห์ผลกระทบก่อนแก้สคริปต์ การอัปเดต context อย่างเดียวไม่อนุญาตให้รัน flow ที่เขียนข้อมูลเอง |
| สำรวจหน้าใหม่/ไม่มี source หรือข้อมูลจาก code ไม่พอ | [planning.md](planning.md) เฉพาะเคสใหม่; [test-data.md](test-data.md); [browser-use.md](browser-use.md) และ [results-format.md](results-format.md); ใช้แท็บแยก ถ้าผู้ใช้เลือก desktop ชัดเจนจึงอ่าน [computer-use.md](computer-use.md) |
| วิเคราะห์ failure/รันแล้วติดอุปสรรค | [failure-analysis.md](failure-analysis.md) ก่อนแก้/รันซ้ำ แล้วอ่าน reference ของสาเหตุที่พบเพิ่ม |
| สรุปผล/สร้างรายงาน | [results-format.md](results-format.md); ใช้ผลจริงเดิม เมื่อหลักฐานไม่ครบให้ระบุข้อจำกัด ไม่รันซ้ำเองเพียงเพื่อเติมภาพ |

ถ้าคำขอครอบคลุมหลายช่วง ให้ดำเนินการต่อเนื่องตามขอบเขต ไม่หยุดให้ผู้ใช้เลือกโหมดทีละขั้น เมื่อมีโค้ดให้สร้าง locator จากหลักฐานใน source แล้วรันจริงก่อนเลือกสำรวจ browser

คำถามเรื่องการออกเวอร์ชันของโปรเจกต์ SSD AI Tester เองให้ใช้ RELEASING.md ที่ root repository เป็นหลัก ไม่ตีความว่าให้ release ระบบที่กำลังทดสอบ และไม่บังคับให้ workspace ของผู้ใช้มีไฟล์นี้

## บันทึกการตัดสินใจ

แจ้งสั้น ๆ ว่ากำลังใช้ workspace/ระบบใด และใช้ code-first, script เดิม หรือ black-box เพราะอะไร ไม่ต้องแสดง routing table ให้ผู้ใช้ทุกครั้ง บันทึก source fingerprint ใน run.json ตาม runner เดิม; ไม่สร้างบันทึกพิธีการเพิ่มหากไม่มีข้อมูลที่ช่วยตรวจสอบงาน

เส้นทางอ่าน reference เป็นข้อกำหนดของ AI ไม่ใช่การตรวจด้วย runner การมีไฟล์หรือบันทึกว่าอ่านแล้วไม่แทนการเข้าใจโค้ดและตรวจผลจริง
