import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const labels = { passed: 'ผ่าน', failed: 'ไม่ผ่าน', blocked: 'ทดสอบไม่ได้', skipped: 'ข้ามตามขอบเขต', 'not-run': 'ยังไม่ได้ทดสอบ' };
const severityLabels = { critical: 'วิกฤต', high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };
const engineLabels = { 'playwright-test': 'Playwright Test — รันสคริปต์โดยตรง', 'browser-use': 'Browser Use — ควบคุมเฉพาะแท็บทดสอบ', 'desktop-computer-use': 'Computer Use — ควบคุม desktop', unselected: 'ยังไม่ได้เลือกวิธีทดสอบ' };
const isolationLabels = { 'browser-context': 'Browser context แยกแบบ headless (ข้อมูลบนระบบปลายทางอาจใช้ร่วมกัน)', 'browser-tab': 'แท็บทดสอบแยก (อาจแชร์บัญชีและข้อมูลใน profile เดียวกัน)', 'dedicated-machine': 'VM หรือเครื่องทดสอบเฉพาะ', 'shared-desktop': 'desktop ร่วมกับผู้ใช้ — ใช้งานเมาส์/คีย์บอร์ดพร้อมกันไม่ได้บน Windows', unverified: 'ยังไม่ได้ยืนยันพื้นที่ทดสอบ' };
function executionText(run) {
  if (!run.execution) return 'ไม่ได้บันทึกวิธีและพื้นที่ทดสอบ';
  const headed = run.execution.isolation === 'browser-context' && run.execution.headless === false;
  const isolation = headed ? 'Browser context แยกแบบเปิดหน้าต่าง (headed; ข้อมูลบนระบบปลายทางอาจใช้ร่วมกัน)' : run.execution.headless === null ? 'Browser context แบบผสม headed/headless (ข้อมูลบนระบบปลายทางอาจใช้ร่วมกัน)' : isolationLabels[run.execution.isolation];
  return engineLabels[run.execution.engine] + ' / ' + isolation;
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const escapeMd = value => String(value ?? '').replace(/[\\`*_[\]<>|#]/g, '\\$&').replace(/\r?\n/g, ' / ');
function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('ต้องระบุ ' + label);
}
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function validDate(value) { return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)); }
function formatTime(value) {
  return value ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) + ' (เวลาไทย)' : 'ยังไม่สิ้นสุด';
}

export async function createRun(directory, options) {
  for (const field of ['title', 'url', 'environment']) requireText(options[field], field);
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL ต้องเป็น http/https และไม่มีข้อมูลเข้าสู่ระบบ');
  const root = path.resolve(directory);
  await fs.mkdir(root, { recursive: true });
  if ((await fs.readdir(root)).length) throw new Error('โฟลเดอร์รอบทดสอบต้องว่าง เพื่อไม่เขียนทับหลักฐานเดิม');
  const run = {
    schemaVersion: 1, runId: crypto.randomUUID(), title: options.title, url: options.url,
    environment: options.environment, startedAt: new Date().toISOString(), finishedAt: null,
    tester: 'Codex (ยังไม่เริ่มทดสอบ)', execution: { engine: 'unselected', isolation: 'unverified' },
    mode: 'real', scope: [], limitations: [], cases: [],
  };
  await fs.mkdir(path.join(root, 'screenshots'));
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(root, 'test-plan.md'), '# แผนทดสอบ ' + options.title + '\n\nระบุเงื่อนไขธุรกิจ ขอบเขต กรณีทดสอบ และผลที่คาดหวังก่อนเริ่มทดสอบ\n', { flag: 'wx' });
  return 'สร้างรอบทดสอบ: ' + root;
}

export async function validateRun(directory, run, options = {}) {
  const root = await fs.realpath(directory);
  if (run.schemaVersion !== 1) throw new Error('รองรับ schemaVersion 1 เท่านั้น');
  for (const field of ['runId', 'title', 'url', 'environment', 'tester']) requireText(run[field], field);
  if (!validDate(run.startedAt) || (run.finishedAt !== null && !validDate(run.finishedAt))) throw new Error('วันเวลาต้องเป็น ISO 8601 พร้อม timezone และ finishedAt เป็น null ได้');
  if (run.finishedAt && Date.parse(run.finishedAt) < Date.parse(run.startedAt)) throw new Error('เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม');
  if (!['real', 'demo'].includes(run.mode)) throw new Error('mode ต้องเป็น real หรือ demo');
  if (run.execution !== undefined) {
    const allowed = {
      'playwright-test': ['browser-context'],
      'browser-use': ['browser-tab', 'unverified'],
      'desktop-computer-use': ['dedicated-machine', 'shared-desktop', 'unverified'],
      unselected: ['unverified'],
    };
    if (!run.execution || !Object.hasOwn(allowed, run.execution.engine) || !allowed[run.execution.engine].includes(run.execution.isolation)) {
      throw new Error('execution.engine/isolation ไม่ถูกต้องหรือไม่สอดคล้องกัน');
    }
  }
  if (!Array.isArray(run.cases) || !run.cases.length) throw new Error('ต้องมีกรณีทดสอบอย่างน้อย 1 รายการ');
  for (const field of ['scope', 'limitations']) {
    if (!Array.isArray(run[field]) || run[field].some(item => typeof item !== 'string')) throw new Error(field + ' ต้องเป็นรายการข้อความ');
  }
  const ids = new Set();
  const images = new Map();
  const counts = Object.fromEntries(Object.keys(labels).map(key => [key, 0]));
  for (const item of run.cases) {
    for (const field of ['id', 'title', 'requirement', 'priority', 'preconditions', 'expected']) requireText(item[field], item.id + '.' + field);
    if (ids.has(item.id)) throw new Error('รหัสกรณีซ้ำ: ' + item.id);
    ids.add(item.id);
    if (!Object.hasOwn(labels, item.status)) throw new Error('สถานะไม่ถูกต้อง: ' + item.id);
    if (!['high', 'medium', 'low'].includes(item.priority)) throw new Error('priority ไม่ถูกต้อง: ' + item.id);
    counts[item.status]++;
    if (!Array.isArray(item.steps) || !item.steps.length) throw new Error('ต้องมี steps: ' + item.id);
    for (const step of item.steps) { requireText(step.action, 'step.action'); requireText(step.expected, 'step.expected'); }
    if (['passed', 'failed'].includes(item.status)) requireText(item.actual, item.id + '.actual');
    else requireText(item.reason, item.id + '.reason');
    if (item.status === 'failed') {
      if (!item.defect || !Object.hasOwn(severityLabels, item.defect.severity)) throw new Error('กรณีไม่ผ่านต้องระบุระดับผลกระทบ: ' + item.id);
      requireText(item.defect.impact, item.id + '.defect.impact');
      requireText(item.defect.nextAction, item.id + '.defect.nextAction');
    }
    if (!Array.isArray(item.evidence)) throw new Error('evidence ต้องเป็นรายการ: ' + item.id);
    if (['passed', 'failed'].includes(item.status) && !item.evidence.length) throw new Error('กรณีผ่าน/ไม่ผ่านต้องมีภาพหลักฐาน: ' + item.id);
    for (const evidence of item.evidence) {
      requireText(evidence.path, 'evidence.path'); requireText(evidence.caption, 'evidence.caption');
      if (!validDate(evidence.capturedAt)) throw new Error('ภาพต้องระบุ capturedAt พร้อม timezone');
      if (path.isAbsolute(evidence.path) || evidence.path.includes('\\') || !evidence.path.startsWith('screenshots/')) throw new Error('ภาพต้องใช้ path แบบ screenshots/name.png');
      const candidate = path.resolve(root, evidence.path);
      if (!inside(path.join(root, 'screenshots'), candidate)) throw new Error('ภาพอยู่นอกโฟลเดอร์ screenshots');
      const real = await fs.realpath(candidate);
      if (!inside(root, real) || !inside(path.join(root, 'screenshots'), real)) throw new Error('ภาพ symlink อยู่นอกโฟลเดอร์');
      if (!images.has(evidence.path)) {
        const stat = await fs.stat(real);
        if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('ภาพต้องเป็นไฟล์ขนาดไม่เกิน 10 MB');
        const bytes = await fs.readFile(real);
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!png && !jpeg) throw new Error('รองรับภาพ PNG/JPEG จริงเท่านั้น: ' + evidence.path);
        images.set(evidence.path, options.embedImages === false ? null : 'data:image/' + (png ? 'png' : 'jpeg') + ';base64,' + bytes.toString('base64'));
      }
    }
  }
  return { counts, images };
}

export async function renderReport(directory) {
  const root = path.resolve(directory);
  const source = path.join(root, 'results.json');
  const run = JSON.parse((await fs.readFile(source, 'utf8')).replace(/^\uFEFF/, ''));
  const { counts, images } = await validateRun(root, run);
  const attempted = counts.passed + counts.failed;
  const metrics = { total: run.cases.length, counts, attempted, executionPercent: Math.round(attempted / run.cases.length * 100), passPercent: attempted ? Math.round(counts.passed / attempted * 100) : null };
  const incomplete = counts.blocked + counts['not-run'] + counts.skipped;
  const recommendation = counts.failed ? 'พบปัญหาที่ต้องแก้ไขและทดสอบซ้ำก่อนพิจารณารับงาน' : incomplete || !run.finishedAt ? 'ผลยังไม่ครอบคลุมทั้งหมด ควรจัดการรายการคงค้างก่อนพิจารณารับงาน' : 'กรณีที่ระบุผ่านทั้งหมด ให้ BA/QA พิจารณารับงานตามขอบเขตที่ทดสอบ';
  const partial = !run.finishedAt ? 'รายงานระหว่างดำเนินการ' : 'รายงานสิ้นสุดรอบทดสอบ';
  const demo = run.mode === 'demo' ? 'ตัวอย่างสาธิต — ไม่ใช่ผลรับรองระบบจริง' : 'ผลจากรอบทดสอบจริงตามขอบเขตที่ระบุ';
  const cards = Object.entries(counts).map(([key, value]) => `<div class="metric ${key}"><strong>${value}</strong><span>${labels[key]}</span></div>`).join('');
  const cases = run.cases.map(item => `<article id="case-${encodeURIComponent(item.id)}">
    <div class="case-heading"><h3>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</h3><span class="badge ${item.status}">${labels[item.status]}</span></div>
    <p><b>เงื่อนไขธุรกิจ:</b> ${escapeHtml(item.requirement)}</p><p><b>ความสำคัญ:</b> ${severityLabels[item.priority]}</p>
    <p><b>ก่อนทดสอบ:</b> ${escapeHtml(item.preconditions)}</p>
    <ol>${item.steps.map(step => `<li>${escapeHtml(step.action)}<small>ผลที่คาดหวัง: ${escapeHtml(step.expected)}</small></li>`).join('')}</ol>
    <div class="comparison"><div><b>ผลที่คาดหวัง</b><p>${escapeHtml(item.expected)}</p></div><div><b>ผลที่พบจริง</b><p>${escapeHtml(item.actual || 'ยังไม่มีผลตรวจสอบ')}</p></div></div>
    ${item.reason ? `<p><b>เหตุผล:</b> ${escapeHtml(item.reason)}</p>` : ''}
    ${item.status === 'failed' ? `<div class="defect"><b>ผลกระทบ ${severityLabels[item.defect.severity]}</b><p>${escapeHtml(item.defect.impact)}</p><p>สิ่งที่ควรทำต่อ: ${escapeHtml(item.defect.nextAction)}</p></div>` : ''}
    ${item.evidence.map(evidence => `<figure><img src="${images.get(evidence.path)}" alt="${escapeHtml(evidence.caption)}" loading="lazy"><figcaption>${escapeHtml(evidence.caption)} · ${escapeHtml(formatTime(evidence.capturedAt))}</figcaption></figure>`).join('')}
    </article>`).join('');
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(run.title)} — รายงานทดสอบ</title>
    <style>body{font:16px/1.7 Tahoma,"Noto Sans Thai",sans-serif;margin:0;background:#f3f6fa;color:#17283d}main{max-width:1120px;margin:auto;padding:32px}header,article,.summary{background:white;padding:28px;border-radius:14px;margin-bottom:22px;border:1px solid #dbe3ed}h1{font-size:30px;margin:8px 0}h2{font-size:23px}h3{font-size:20px;margin:0}p{overflow-wrap:anywhere}.eyebrow{color:#315ba0}small,figcaption{display:block;color:#52637a}.metrics{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.metric{flex:1;min-width:125px;background:white;border-radius:12px;border-top:5px solid #7b8797;padding:16px}.metric strong{display:block;font-size:30px}.metric span{display:block}.passed{border-color:#16805c;color:#126447}.failed{border-color:#c53e4c;color:#a52331}.blocked{border-color:#b47d16;color:#825800}.case-heading{display:flex;justify-content:space-between;gap:12px;align-items:start}.badge{padding:3px 12px;border:1px solid;border-radius:30px;white-space:nowrap}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f3f6fa;padding:18px;border-radius:10px}.defect{background:#fff0f0;border-left:4px solid #c53e4c;padding:16px;margin-top:16px}figure{margin:22px 0}img{max-width:100%;height:auto;border:1px solid #cdd7e3;border-radius:8px}li{margin-bottom:12px}a{color:#2458a0}.notice{padding:10px 16px;background:#fff3cd;border-radius:8px}@media(max-width:640px){main{padding:14px}header,article,.summary{padding:18px}.comparison{grid-template-columns:1fr}.case-heading{display:block}}@media print{body{background:white}main{padding:0}article{break-inside:avoid}img{max-height:550px;object-fit:contain}a{color:inherit}}</style></head><body><main>
    <header><span class="eyebrow">SSD · รายงานสำหรับ BA / QA</span><h1>${escapeHtml(run.title)}</h1><p class="notice">${demo} · ${partial}</p><p><b>สภาพแวดล้อม:</b> ${escapeHtml(run.environment)}<br><b>ระบบ:</b> ${escapeHtml(run.url)}<br><b>ผู้ทดสอบ:</b> ${escapeHtml(run.tester)}<br><b>วิธีและพื้นที่ทดสอบ:</b> ${escapeHtml(executionText(run))}<br><b>เริ่ม:</b> ${escapeHtml(formatTime(run.startedAt))}<br><b>สิ้นสุด:</b> ${escapeHtml(formatTime(run.finishedAt))}<br><b>รหัสรอบ:</b> ${escapeHtml(run.runId)}</p></header>
    <section class="summary"><h2>ภาพรวมที่ใช้ตัดสินใจ</h2><p>${recommendation}</p><p>ตรวจสอบได้ ${attempted} จาก ${metrics.total} กรณี (${metrics.executionPercent}%) · อัตราผ่านจากกรณีที่ตรวจสอบได้: ${metrics.passPercent === null ? 'ยังคำนวณไม่ได้' : metrics.passPercent + '%'}</p><p>อัตราผ่าน = ผ่าน ÷ (ผ่าน + ไม่ผ่าน) โดยรายการทดสอบไม่ได้ ข้าม และยังไม่ได้ทดสอบแสดงแยกต่างหาก</p><h3>ขอบเขต</h3><ul>${run.scope.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>ไม่ได้ระบุ</li>'}</ul><h3>ข้อจำกัด</h3><ul>${run.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>ไม่มีข้อจำกัดที่บันทึกไว้</li>'}</ul></section>
    <div class="metrics">${cards}</div><nav class="summary"><h2>รายการทดสอบ</h2><ul>${run.cases.map(item => `<li><a href="#case-${encodeURIComponent(item.id)}">${escapeHtml(item.id)} ${escapeHtml(item.title)}</a> — ${labels[item.status]}</li>`).join('')}</ul></nav>${cases}
    <footer>รายงานอ้างอิงสิ่งที่สังเกตได้ผ่านหน้าจอในรอบนี้ การรับงานหรือเปิดใช้งานจริงให้ผู้รับผิดชอบพิจารณา · ภาพทั้งหมดฝังอยู่ในไฟล์ HTML</footer></main></body></html>`;
  const md = [
    '# รายงานทดสอบ ' + escapeMd(run.title), '', demo + ' · ' + partial, '',
    '- สภาพแวดล้อม: ' + escapeMd(run.environment), '- ระบบ: ' + escapeMd(run.url),
    '- ผู้ทดสอบ: ' + escapeMd(run.tester), '- วิธีและพื้นที่ทดสอบ: ' + escapeMd(executionText(run)), '- รหัสรอบ: ' + escapeMd(run.runId),
    '- เริ่ม: ' + formatTime(run.startedAt), '- สิ้นสุด: ' + formatTime(run.finishedAt), '',
    '## ภาพรวม', '', recommendation, '',
    ...Object.entries(counts).map(([key, value]) => '- ' + labels[key] + ': ' + value), '',
    `ตรวจสอบได้ ${attempted}/${metrics.total} (${metrics.executionPercent}%) · อัตราผ่าน ${metrics.passPercent === null ? 'ยังคำนวณไม่ได้' : metrics.passPercent + '%'} = ผ่าน ÷ (ผ่าน + ไม่ผ่าน)`, '',
    '## ขอบเขต', '', ...run.scope.map(item => '- ' + escapeMd(item)), '',
    '## ข้อจำกัด', '', ...(run.limitations.length ? run.limitations.map(item => '- ' + escapeMd(item)) : ['ไม่มีข้อจำกัดที่บันทึกไว้']), '',
    ...run.cases.flatMap(item => [
      '## ' + escapeMd(item.id + ' ' + item.title), '', '**ผล: ' + labels[item.status] + '**', '',
      'เงื่อนไขธุรกิจ: ' + escapeMd(item.requirement), '', 'ความสำคัญ: ' + severityLabels[item.priority], '', 'ก่อนทดสอบ: ' + escapeMd(item.preconditions), '',
      ...item.steps.map((step, index) => `${index + 1}. ${escapeMd(step.action)} — คาดหวัง: ${escapeMd(step.expected)}`), '',
      '- ผลที่คาดหวัง: ' + escapeMd(item.expected), '- ผลที่พบจริง: ' + escapeMd(item.actual || 'ยังไม่มีผลตรวจสอบ'),
      ...(item.reason ? ['- เหตุผล: ' + escapeMd(item.reason)] : []),
      ...(item.status === 'failed' ? ['- ระดับผลกระทบ: ' + severityLabels[item.defect.severity], '- ผลกระทบต่อผู้ใช้: ' + escapeMd(item.defect.impact), '- สิ่งที่ควรทำต่อ: ' + escapeMd(item.defect.nextAction)] : []), '',
      ...item.evidence.map(evidence => `![${escapeMd(evidence.caption)}](${evidence.path.split('/').map(encodeURIComponent).join('/')})\n\nบันทึกภาพ: ${formatTime(evidence.capturedAt)}\n`),
    ]),
  ].join('\n');
  for (const [name, content] of [['report.html', html], ['report.md', md], ['report.json', JSON.stringify({ ...run, metrics, recommendation, generatedAt: new Date().toISOString() }, null, 2) + '\n']]) {
    const target = path.join(root, name);
    try { if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('ไม่เขียนทับ report ที่เป็น symlink'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.writeFile(target, content, 'utf8');
  }
  return 'สร้าง report.html, report.md, report.json แล้วที่ ' + root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command, directory, ...args] = process.argv.slice(2);
    if (command === 'report' && directory && !args.length) console.log(await renderReport(directory));
    else if (command === 'init' && directory && args.length === 3) console.log(await createRun(directory, { title: args[0], url: args[1], environment: args[2] }));
    else throw new Error('ใช้: node report.mjs report RUN_DIR หรือ init RUN_DIR TITLE URL ENVIRONMENT');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
