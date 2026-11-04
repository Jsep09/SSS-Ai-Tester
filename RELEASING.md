# Release

Repository: https://github.com/Jsep09/SSS-Ai-Tester

ใช้ Conventional Commits เช่น `feat: add code context`, `fix: detect updated bundle` และ Semantic Versioning: patch แก้บั๊ก, minor เพิ่ม feature, major เปลี่ยนแบบเข้ากันไม่ได้

## สร้าง ZIP รุ่นใหม่แบบง่าย

ดับเบิลคลิก release.cmd ในโฟลเดอร์โปรเจกต์ หรือรันคำสั่งเดียว:

```powershell
.\release.cmd
```

ค่าเริ่มต้นเพิ่ม patch เช่น 0.6.1 เป็น 0.6.2 แล้วรัน tests, ย้ายรายการ Unreleased ใน CHANGELOG.md ไปหัวข้อรุ่นใหม่, อัปเดต package.json/Skill metadata และสร้าง ZIP/TGZ ใน dist/ ต้องมี Node.js, PowerShell, tar และ Playwright runtime ที่พร้อมรันทดสอบ ไม่ต้องมี npm/pnpm สำหรับวิธีนี้

ตัวเลือก:

```powershell
.\release.cmd minor
.\release.cmd major
.\release.cmd 1.0.0
.\release.cmd --dry-run
pnpm release
```

เพิ่มบันทึก feature/fix ใน Unreleased ก่อนรัน หากไม่มีรายการ ระบบจะระบุว่ายังไม่ได้บันทึกการเปลี่ยนแปลง ไม่เดา feature หรือประสิทธิภาพ หาก tests/pack ไม่ผ่านจะคืนเวอร์ชันเดิม และไม่เขียนทับ ZIP/TGZ รุ่นที่มีอยู่แล้ว

คำสั่งนี้สร้างแพ็กเกจในเครื่อง ไม่ commit/tag/push หรือสร้าง GitHub Release อัตโนมัติ หลังตรวจ ZIP แล้วค่อย commit งานตามปกติ ถ้าต้องแพ็กรุ่นปัจจุบันโดยไม่ bump ใช้ node scripts/release.mjs

## เตรียมเครื่องครั้งแรก

ต้องมี Node.js 20+, pnpm, Git, GitHub CLI และ Playwright runtime ที่ setup แล้ว

```powershell
pnpm install --frozen-lockfile --ignore-scripts
gh auth login
node bin/cli.mjs setup
```

ใช้ --ignore-scripts เพื่อไม่ให้ postinstall ของโปรเจกต์ติดตั้ง user-global Skills ระหว่างเตรียมเครื่องพัฒนา หากต้องการติดตั้ง Skills เรียก node bin/cli.mjs install โดยตรง

## GitHub Release workflow

Commit งานให้ครบและเริ่มจาก develop ที่อัปเดตแล้ว ใช้ PowerShell:

```powershell
git switch develop
git pull --ff-only
$env:GITHUB_TOKEN = gh auth token
try {
  pnpm release:github:dry-run patch --no-github.web
  pnpm release:github patch --no-github.web
} finally {
  Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
}
```

ใช้ `minor` หรือ `major` แทน `patch` ตามงาน ตรวจผล dry-run ก่อนรันจริง ห้ามพิมพ์ token หรือเก็บในไฟล์ คำสั่งแบบ API ใช้ --no-github.web เพื่อสร้าง GitHub Draft Release และแนบ ZIP อัตโนมัติ; ค่าเริ่มต้นใน .release-it ใช้ browser ตามมาตรฐาน SSD

Release จะตรวจ tests, สร้าง branch release/vX.Y.Z, อัปเดต package.json และ CHANGELOG.md จาก commits ตั้งแต่ tag ล่าสุด, สร้าง ZIP, commit, tag และ push พร้อม Draft Release โดยไม่ publish npm หรือเผยแพร่ release สู่สาธารณะอัตโนมัติ Source ที่ push ไปจะมองเห็นได้ตาม visibility ของ repository

ZIP อยู่ที่ dist/ssd-ai-tester-X.Y.Z.zip และ TGZ อยู่ที่ dist/ssd-ai-tester-X.Y.Z.tgz ไม่รวม session, local config, code context หรือผลรันทดสอบ

ขั้นตอนแพ็กจะเรียก sync-release.mjs เพื่อปรับ metadata.version ในทั้ง 3 Skills และแนบ references/release.json จาก CHANGELOG.md ให้ตรง package.json โดยทำหลัง conventional-changelog อัปเดต notes แล้ว หากแก้เวอร์ชันเองเพื่อเตรียมงาน ให้เพิ่มหัวข้อรุ่นนั้นใน changelog และรัน `pnpm sync:release` ก่อน install; ไม่ทำ release ซ้ำบน tag เดิม

ตรวจหลังติดตั้งด้วย `node bin/cli.mjs version` และ `node bin/cli.mjs update-info --from X.Y.Z` การติดตั้งจะจำ previousVersion; ไม่สามารถตรวจหน่วยความจำ session ของ Codex โดยตรง ต้องใช้รุ่นที่ AI สังเกตตอนโหลดหรือแสดงว่าไม่ทราบ

หลังตรวจ Draft Release แล้ว merge release branch กลับ develop ก่อนพัฒนารอบถัดไป เช่นสร้าง PR ด้วย `gh pr create --base develop --head release/vX.Y.Z` ห้าม bump เวอร์ชันด้วยมือแล้วเรียก release-it ซ้ำ

## Release แรก

v0.5.0 เป็น baseline แรกของ Git repo เก็บบันทึก v0.4.1 เดิมไว้ใน changelog แต่ไม่มี tag/commit เก่าย้อนหลัง เพราะไม่มี source snapshot ยืนยัน
