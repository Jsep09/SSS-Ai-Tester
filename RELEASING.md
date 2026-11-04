# Release

Repository: https://github.com/Jsep09/SSS-Ai-Tester

ใช้ Conventional Commits เช่น `feat: add code context`, `fix: detect updated bundle` และ Semantic Versioning: patch แก้บั๊ก, minor เพิ่ม feature, major เปลี่ยนแบบเข้ากันไม่ได้

## เตรียมเครื่องครั้งแรก

ต้องมี Node.js 20+, pnpm, Git, GitHub CLI และ Playwright runtime ที่ setup แล้ว

```powershell
pnpm install --frozen-lockfile --ignore-scripts
gh auth login
node bin/cli.mjs setup
```

ใช้ --ignore-scripts เพื่อไม่ให้ postinstall ของโปรเจกต์ติดตั้ง user-global Skills ระหว่างเตรียมเครื่องพัฒนา หากต้องการติดตั้ง Skills เรียก node bin/cli.mjs install โดยตรง

## ออกเวอร์ชันใหม่

Commit งานให้ครบและเริ่มจาก develop ที่อัปเดตแล้ว ใช้ PowerShell:

```powershell
git switch develop
git pull --ff-only
$env:GITHUB_TOKEN = gh auth token
try {
  pnpm release:dry-run patch --no-github.web
  pnpm release patch --no-github.web
} finally {
  Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
}
```

ใช้ `minor` หรือ `major` แทน `patch` ตามงาน ตรวจผล dry-run ก่อนรันจริง ห้ามพิมพ์ token หรือเก็บในไฟล์ คำสั่งแบบ API ใช้ --no-github.web เพื่อสร้าง GitHub Draft Release และแนบ ZIP อัตโนมัติ; ค่าเริ่มต้นใน .release-it ใช้ browser ตามมาตรฐาน SSD

Release จะตรวจ tests, สร้าง branch release/vX.Y.Z, อัปเดต package.json และ CHANGELOG.md จาก commits ตั้งแต่ tag ล่าสุด, สร้าง ZIP, commit, tag และ push พร้อม Draft Release โดยไม่ publish npm หรือเผยแพร่ release สู่สาธารณะอัตโนมัติ Source ที่ push ไปจะมองเห็นได้ตาม visibility ของ repository

ZIP อยู่ที่ ../dist/ssd-ai-tester-X.Y.Z.zip ไม่รวม session, local config, code context หรือผลรันทดสอบ

หลังตรวจ Draft Release แล้ว merge release branch กลับ develop ก่อนพัฒนารอบถัดไป เช่นสร้าง PR ด้วย `gh pr create --base develop --head release/vX.Y.Z` ห้าม bump เวอร์ชันด้วยมือแล้วเรียก release-it ซ้ำ

## Release แรก

v0.5.0 เป็น baseline แรกของ Git repo เก็บบันทึก v0.4.1 เดิมไว้ใน changelog แต่ไม่มี tag/commit เก่าย้อนหลัง เพราะไม่มี source snapshot ยืนยัน
