import { test, expect } from '../fixtures.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { workspace, readConfig, readBotConfig } from '../support/config.mjs';

const bot = await readBotConfig();
test.use({
  headless: process.env.E2E_HEADED === undefined ? bot.headless : process.env.E2E_HEADED !== '1',
  launchOptions: { slowMo: Number(process.env.E2E_SLOW_MO ?? bot.slowMo) },
});

const progressFile = path.join(workspace, '.ssd/progress.json');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const thaiDigits = value => value.replace(/\d/g, digit => '๐๑๒๓๔๕๖๗๘๙'[Number(digit)]);

async function saveProgress(progress) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await writeFile(progressFile, JSON.stringify(progress, null, 2), 'utf8');
}

async function success(page) {
  const heading = page.getByRole('heading', { name: 'Success', exact: true });
  await expect(heading).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^(Ok|OK|ตกลง)$/ }).click();
  await expect(heading).toBeHidden();
}

async function evidence(page, testInfo, stage) {
  await testInfo.attach('ssd-result-' + new Date().toISOString(), { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  console.log('STEP_OK: ' + stage);
}

function sectionEdit(page, title, heading = false) {
  const label = heading ? page.getByRole('heading', { name: title, exact: true }) : page.getByText(title, { exact: true });
  return label.locator('xpath=ancestor::div[.//button[contains(normalize-space(.),"แก้ไข")]][1]').getByRole('button', { name: /แก้ไข/ });
}

async function saveDialog(page, dialog) {
  await expect(dialog.getByRole('button', { name: 'บันทึก', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await success(page);
  await expect(dialog).toBeHidden();
}

function documentRow(page, title) {
  return page.getByText(new RegExp('^' + escapeRegex(title) + '\\s*\\*?$'))
    .locator('xpath=ancestor::div[.//button][1]');
}

test('สร้างหลีดใหม่ แล้วสร้างใบคำขอและแนบเอกสารครบ 3 ประเภท', async ({ page, context, business }, testInfo) => {
  test.setTimeout(480_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(45_000);
  const { scenario, uploadFile, baseURL } = await readConfig();
  business({
    requirement: 'ตามสคริปต์ผู้ใช้: สร้างหลีดก่อน คัดลอก PH Application 8100002 เลือก Silver รายเดือน เงินสด กรอกข้อมูลและแนบเอกสาร 3 ประเภท',
    priority: 'high',
    preconditions: 'ผู้ใช้ Login เองผ่าน run-e2e.mjs ใน UAT; Application และไฟล์จำลองพร้อม; ใช้ชื่อผู้เอาประกัน E2E TEST ตามผู้ใช้เลือก และที่อยู่ทำงาน/ติดต่อตามบัตรประชาชนของข้อมูลทดสอบ',
    steps: [
      { action: 'สร้างหลีดชื่อทดสอบเฉพาะรอบ', expected: 'พบหลีดและเปิดรายละเอียดได้' },
      { action: 'คัดลอก Application PH เลือกแผนและวิธีชำระ', expected: 'สร้างเลขใบคำขอใหม่ผูกกับหลีดนี้' },
      { action: 'กรอกผู้เอาประกัน ผู้รับผลประโยชน์ ผู้ติดต่อฉุกเฉิน และแถลงสุขภาพของข้อมูลทดสอบ', expected: 'บันทึกแต่ละส่วนสำเร็จ' },
      { action: 'แนบเอกสารทดสอบ 3 ประเภท แล้วโหลดใบคำขอใหม่', expected: 'พบข้อมูลที่บันทึกและลิงก์เอกสารครบ 3 ประเภท' },
    ],
    expected: 'หลีดและใบคำขอใหม่มีข้อมูลตามที่กรอกและเอกสารครบ หลังโหลดหน้าใหม่ยังคงอยู่',
    defect: { severity: 'high', impact: 'ผู้ใช้สร้างข้อมูลหลีดและใบคำขอให้ครบตามขั้นตอนไม่ได้', nextAction: 'ตรวจภาพและ Playwright trace เพื่อแยกปัญหาข้อมูล/locator จากปัญหาระบบ แล้วทดสอบขั้นที่หยุดซ้ำโดยใช้ checkpoint เดิม' },
  });

  const auth = JSON.parse(await readFile(path.join(workspace, 'playwright/.auth/session-storage.json'), 'utf8'));
  await context.addInitScript(({ origin, values }) => {
    if (location.origin === origin) for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value);
  }, auth);

  let progress;
  try { progress = JSON.parse(await readFile(progressFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!progress || progress.complete) {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
    progress = { runKey: stamp, firstName: scenario.leadFirstName, lastName: scenario.leadLastNamePrefix + thaiDigits(stamp), steps: {}, uploads: {} };
    await saveProgress(progress);
  }
  const leadName = progress.firstName + ' ' + progress.lastName;
  console.log('DATA: ' + leadName);

  await test.step('สร้างหลีดใหม่หรือเปิดหลีดที่สร้างสำเร็จในรอบค้าง', async () => {
    if (!progress.leadUrl) {
      await page.goto(baseURL + '/lead');
      await page.getByRole('button', { name: 'เพิ่มหลีด', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
      if (!progress.leadConfirmationAttempted) {
        await page.getByRole('button', { name: 'เพิ่มหลีด', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('textbox', { name: 'ชื่อ', exact: true }).fill(progress.firstName);
        await dialog.getByRole('textbox', { name: 'นามสกุล', exact: true }).fill(progress.lastName);
        await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์', exact: true }).fill(scenario.leadPhone);
        await dialog.getByRole('textbox', { name: 'หมายเหตุ', exact: true }).fill('E2E TEST ONLY / run ' + progress.runKey);
        progress.leadAttempted = true;
        await saveProgress(progress);
        await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: 'Confirm', exact: true });
        await expect(confirmation.getByText('ยืนยันการเพิ่มหลีด', { exact: true })).toBeVisible();
        progress.leadConfirmationAttempted = true;
        await saveProgress(progress);
        await confirmation.getByRole('button', { name: 'ตกลง', exact: true }).click();
        await success(page);
      }
      // ค้นหาชื่อเฉพาะรอบผ่าน UI แทนการส่งสร้างซ้ำเมื่อสถานะไม่แน่ชัด
      if (!/\/lead\/[0-9a-f-]+$/.test(new URL(page.url()).pathname)) {
        await page.locator('#customerName-formik-text-field').fill(leadName);
        await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
        const leadLink = page.getByRole('link', { name: leadName, exact: true });
        await expect(leadLink).toHaveCount(1, { timeout: 30_000 });
        await leadLink.click();
      }
      await expect(page).toHaveURL(/\/lead\/[0-9a-f-]+$/);
      progress.leadUrl = page.url();
      await saveProgress(progress);
    }
    // เปิดรายการที่บันทึกจริงอีกครั้ง ให้หน้ารายละเอียดพร้อมหลัง modal เปลี่ยน route
    await page.goto(progress.leadUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(leadName, { exact: true }).first()).toBeVisible();
    await evidence(page, testInfo, 'สร้างหลีดและเปิดรายละเอียด');
  });

  await test.step('คัดลอก Application เป็นใบคำขอของหลีดที่สร้างใหม่', async () => {
    if (!progress.quotationUrl) {
      await page.getByRole('tab', { name: 'ใบคำขอ' }).click();
      await expect(page.getByRole('button', { name: 'คัดลอก App', exact: true })).toBeVisible();
      if (progress.quotationAttempted) {
        const edit = page.getByRole('button', { name: 'แก้ไข', exact: true });
        await expect(edit).toHaveCount(1, { timeout: 30_000 });
        await edit.click();
      } else {
        await page.getByRole('button', { name: 'คัดลอก App', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('combobox').click();
        await page.getByRole('option', { name: scenario.applicationType, exact: true }).click();
        await dialog.getByRole('textbox', { name: 'เลข Application', exact: true }).fill(scenario.applicationNumber);
        await dialog.getByRole('button', { name: 'ค้นหา', exact: true }).click();
        await expect(dialog.getByText('Application ' + scenario.applicationNumber + ':', { exact: true })).toBeVisible({ timeout: 60_000 });
        await dialog.locator('#mui-component-select-planId').click();
        await page.getByRole('option', { name: scenario.plan, exact: true }).click();
        await page.waitForLoadState('networkidle');
        await dialog.locator('#mui-component-select-paymentTypeId').click();
        await page.getByRole('option', { name: scenario.paymentPeriod, exact: true }).click();
        await dialog.getByRole('combobox', { name: 'วิธีชำระเงิน', exact: true }).click();
        await page.getByRole('option', { name: scenario.paymentChannel, exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'คัดลอก', exact: true })).toBeEnabled();
        progress.quotationAttempted = true;
        await saveProgress(progress);
        await dialog.getByRole('button', { name: 'คัดลอก', exact: true }).click();
        await success(page);
      }
      await expect(page).toHaveURL(/\/quotation\/[0-9a-f-]+$/, { timeout: 60_000 });
      progress.quotationUrl = page.url();
      await saveProgress(progress);
    }
    await page.goto(progress.quotationUrl);
    await page.waitForLoadState('networkidle');
    const title = page.getByText(/ใบคำขอ\s*:\s*QO\d+/).first();
    await expect(title).toBeVisible({ timeout: 30_000 });
    progress.quotationNumber = (await title.innerText()).match(/QO\d+/)?.[0];
    await saveProgress(progress);
    const attachedLead = page.locator('a[href="' + new URL(progress.leadUrl).pathname + '"]').first();
    await expect(attachedLead).toBeVisible({ timeout: 30_000 });
    await expect(attachedLead).toContainText(leadName);
    expect(new URL(progress.quotationUrl).pathname).toMatch(new RegExp('^' + escapeRegex(new URL(progress.leadUrl).pathname) + '/quotation/'));
    await expect(page.getByText(scenario.plan, { exact: true }).first()).toBeVisible();
    await evidence(page, testInfo, 'สร้างใบคำขอ ' + progress.quotationNumber);
  });

  async function stage(key, title, action) {
    await test.step(title, async () => {
      if (!progress.steps[key]) {
        await action();
        progress.steps[key] = true;
        await saveProgress(progress);
      }
      await evidence(page, testInfo, title);
    });
  }

  await stage('insured', 'ตรวจและกรอกข้อมูลผู้เอาประกัน', async () => {
    await sectionEdit(page, 'ผู้เอาประกัน', true).click();
    const dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    await expect(dialog.getByRole('combobox', { name: 'คำนำหน้า', exact: true })).toHaveValue(/\S/, { timeout: 15_000 });
    await expect(dialog.getByRole('combobox', { name: 'ตำบล', exact: true })).toHaveValue(/\S/, { timeout: 15_000 });
    const phone = dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์บ้าน', exact: true });
    const email = dialog.getByRole('textbox', { name: 'Email', exact: true });
    const firstName = dialog.getByRole('textbox', { name: 'ชื่อ', exact: true });
    const lastName = dialog.getByRole('textbox', { name: 'นามสกุล', exact: true });
    const namesMatch = !scenario.insuredNameOverride || (await firstName.inputValue() === scenario.insuredNameOverride.firstName && await lastName.inputValue() === scenario.insuredNameOverride.lastName);
    if (namesMatch && (await phone.inputValue()).replace(/\D/g, '') === scenario.insuredHomePhone && await email.inputValue() === scenario.insuredEmail) {
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      return;
    }
    if (scenario.insuredNameOverride) {
      await firstName.fill(scenario.insuredNameOverride.firstName);
      await lastName.fill(scenario.insuredNameOverride.lastName);
    }
    await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์บ้าน', exact: true }).fill(scenario.insuredHomePhone);
    await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill(scenario.insuredEmail);
    await email.press('Tab');
    for (const addressTab of ['ที่ทำงาน', 'ติดต่อ']) {
      await dialog.getByRole('tab', { name: addressTab, exact: true }).click();
      await dialog.getByText('ตามบัตรประชาชน', { exact: true }).click();
      await page.waitForLoadState('networkidle');
    }
    await expect(dialog.locator('input:invalid')).toHaveCount(0);
    await saveDialog(page, dialog);
  });

  await stage('beneficiary', 'บันทึกผู้รับผลประโยชน์ 100 เปอร์เซ็นต์', async () => {
    await sectionEdit(page, 'ผู้รับผลประโยชน์', true).click();
    const dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    if (await dialog.getByRole('combobox', { name: 'ความสัมพันธ์', exact: true }).inputValue() === scenario.beneficiaryRelationship && await dialog.getByRole('spinbutton', { name: 'ส่วนแบ่ง', exact: true }).inputValue() === scenario.beneficiaryShare) {
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      await expect(page.getByRole('row').filter({ hasText: scenario.beneficiaryRelationship })).toContainText('100');
      return;
    }
    await dialog.getByRole('combobox', { name: 'ความสัมพันธ์', exact: true }).click();
    await page.getByRole('option', { name: scenario.beneficiaryRelationship, exact: true }).click();
    await dialog.getByRole('spinbutton', { name: 'ส่วนแบ่ง', exact: true }).fill(scenario.beneficiaryShare);
    await saveDialog(page, dialog);
    await expect(page.getByRole('row').filter({ hasText: scenario.beneficiaryRelationship })).toContainText('100');
  });

  await stage('emergency', 'บันทึกผู้ติดต่อฉุกเฉินของข้อมูลทดสอบ', async () => {
    await sectionEdit(page, 'ผู้ติดต่อฉุกเฉิน').click();
    const dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    if (await dialog.getByRole('textbox', { name: 'ชื่อ', exact: true }).inputValue() === scenario.emergency.firstName && await dialog.getByRole('textbox', { name: 'นามสกุล', exact: true }).inputValue() === scenario.emergency.lastName && (await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์', exact: true }).inputValue()).replace(/\D/g, '') === scenario.emergency.phone) {
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      return;
    }
    await dialog.getByRole('combobox', { name: 'คำนำหน้า', exact: true }).click();
    await page.getByRole('option', { name: scenario.emergency.prefix, exact: true }).click();
    await dialog.getByRole('textbox', { name: 'ชื่อ', exact: true }).fill(scenario.emergency.firstName);
    await dialog.getByRole('textbox', { name: 'นามสกุล', exact: true }).fill(scenario.emergency.lastName);
    await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์', exact: true }).fill(scenario.emergency.phone);
    await saveDialog(page, dialog);
  });

  await stage('health', 'บันทึกแถลงสุขภาพของข้อมูลทดสอบ', async () => {
    await sectionEdit(page, 'แถลงสุขภาพ').click();
    const dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    // เฉพาะ fixture UAT นี้: ขยายคำตอบเชิงลบจากสคริปต์เดิมให้ครบคำถามที่แสดงจริง
    const negativeAnswers = dialog.getByRole('radio', { name: /^(ไม่มี|ไม่สูบ|ไม่ดื่ม|ไม่เคย)$/ });
    const radios = await negativeAnswers.all();
    if (radios.length < 5) throw new Error('คำถามสุขภาพเปลี่ยนไป ต้องตรวจ UI ก่อนรันต่อ');
    const alreadySelected = await Promise.all(radios.map(radio => radio.isChecked()));
    if (alreadySelected.every(Boolean)) {
      await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
      return;
    }
    for (const radio of radios) await radio.check();
    for (const radio of radios) await expect(radio).toBeChecked();
    await saveDialog(page, dialog);
  });

  for (const title of scenario.documents) {
    await test.step('แนบเอกสาร ' + title, async () => {
      const row = documentRow(page, title);
      const preview = row.locator('a').filter({ hasText: title });
      // ตรวจผลที่มีอยู่ก่อนอัปโหลดเสมอ รวมกรณีรอบก่อนหยุดหลังส่งไฟล์แล้ว
      if (await preview.count() === 0) {
        await row.getByRole('button', { name: 'อัปโหลด', exact: true }).click();
        const dialog = page.getByRole('dialog').filter({ has: page.getByText('อัปโหลดเอกสาร', { exact: true }) });
        await expect(dialog.getByText(title, { exact: true })).toBeVisible();
        await dialog.locator('input[type="file"]').setInputFiles(uploadFile);
        await expect(dialog.getByText('1 จาก 1 ไฟล์', { exact: true })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'อัปโหลด', exact: true })).toBeEnabled();
        await dialog.getByRole('button', { name: 'อัปโหลด', exact: true }).click();
        await success(page);
        await expect(dialog).toBeHidden();
      }
      await expect(preview).toHaveAttribute('href', /\/document\/[^/]+\/preview/, { timeout: 60_000 });
      await expect(row.getByText('แนบไฟล์', { exact: true })).toBeVisible();
      progress.uploads[title] = true;
      await saveProgress(progress);
      await evidence(page, testInfo, 'แนบ ' + title);
    });
  }

  await test.step('โหลดใบคำขอใหม่แล้วตรวจข้อมูลและเอกสารคงอยู่', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(new RegExp('ใบคำขอ\\s*:\\s*' + progress.quotationNumber)).first()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: scenario.beneficiaryRelationship })).toContainText('100');
    for (const title of scenario.documents) {
      await expect(documentRow(page, title).locator('a').filter({ hasText: title })).toHaveAttribute('href', /\/document\/[^/]+\/preview/);
    }
    // เปิดฟอร์มเพื่อยืนยันค่าที่บันทึกจริง แล้วปิดโดยไม่ส่งข้อมูลซ้ำ
    await sectionEdit(page, 'ผู้เอาประกัน', true).click();
    let dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    const insuredPhone = await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์บ้าน', exact: true }).inputValue();
    expect(insuredPhone.replace(/\D/g, '')).toBe(scenario.insuredHomePhone);
    await expect(dialog.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(scenario.insuredEmail);
    if (scenario.insuredNameOverride) {
      await expect(dialog.getByRole('textbox', { name: 'ชื่อ', exact: true })).toHaveValue(scenario.insuredNameOverride.firstName);
      await expect(dialog.getByRole('textbox', { name: 'นามสกุล', exact: true })).toHaveValue(scenario.insuredNameOverride.lastName);
    }
    await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await sectionEdit(page, 'ผู้ติดต่อฉุกเฉิน').click();
    dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    await expect(dialog.getByRole('textbox', { name: 'ชื่อ', exact: true })).toHaveValue(scenario.emergency.firstName);
    await expect(dialog.getByRole('textbox', { name: 'นามสกุล', exact: true })).toHaveValue(scenario.emergency.lastName);
    expect((await dialog.getByRole('textbox', { name: 'เบอร์โทรศัพท์', exact: true }).inputValue()).replace(/\D/g, '')).toBe(scenario.emergency.phone);
    await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await sectionEdit(page, 'แถลงสุขภาพ').click();
    dialog = page.getByRole('dialog');
    await page.waitForLoadState('networkidle');
    const persistedHealth = await dialog.getByRole('radio', { name: /^(ไม่มี|ไม่สูบ|ไม่ดื่ม|ไม่เคย)$/ }).all();
    expect(persistedHealth.length).toBeGreaterThanOrEqual(5);
    for (const radio of persistedHealth) await expect(radio).toBeChecked();
    await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await evidence(page, testInfo, 'ยืนยันข้อมูลและเอกสารหลังโหลดใหม่');
    await page.getByRole('heading', { name: 'เอกสารประกอบใบคำขอเอาประกันภัย', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(process.env.SSD_TESTER_RUN, 'quotation-proof.png') });
    progress.complete = true;
    progress.completedAt = new Date().toISOString();
    await saveProgress(progress);
    await testInfo.attach('created-records', { body: Buffer.from(JSON.stringify({ leadName, leadUrl: progress.leadUrl, quotationNumber: progress.quotationNumber, quotationUrl: progress.quotationUrl }, null, 2)), contentType: 'application/json' });
    console.log('CREATED: ' + progress.quotationNumber + ' / ' + progress.quotationUrl);
  });
});
