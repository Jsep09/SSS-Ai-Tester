import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const manifestName = 'context/manifest.json';
// Resolve metadata through a real directory; never follow a workspace context symlink.
async function contextDirectory(root) {
  const directory = path.join(root, 'context');
  await fs.mkdir(directory, { recursive: true });
  if (await fs.realpath(directory) !== directory) throw new Error('context ต้องไม่เป็น symlink');
  return directory;
}
async function readManifest(root) {
  await contextDirectory(root);
  try { return JSON.parse(await fs.readFile(path.join(root, manifestName), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function writeManifest(root, manifest) {
  await contextDirectory(root);
  const file = path.join(root, manifestName);
  try { if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('manifest ต้องไม่เป็น symlink'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}
async function fingerprint(root, inputs) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error('ต้องระบุ context อย่างน้อยหนึ่งไฟล์');
  return Promise.all(inputs.map(async input => {
    const file = path.resolve(root, input);
    if (!(await fs.stat(file)).isFile()) throw new Error('context ต้องเป็นไฟล์: ' + input);
    return { path: input, sha256: digest(await fs.readFile(file)) };
  }));
}
const bundleHash = files => digest(JSON.stringify(files));

export async function configureContext(root, files) {
  const previous = await readManifest(root);
  const inputs = [...new Set(files.map(file => path.relative(root, path.resolve(root, file))))].sort();
  await fingerprint(root, inputs);
  const manifest = { schemaVersion: 1, inputs, configuredAt: new Date().toISOString(),
    reviewed: previous?.reviewed || null };
  await writeManifest(root, manifest);
  return contextStatus(root);
}

export async function contextStatus(root) {
  const manifest = await readManifest(root);
  if (!manifest) return { mode: 'black-box', status: 'unconfigured', reviewed: null };
  const files = await fingerprint(root, manifest.inputs);
  const hash = bundleHash(files);
  const previous = new Map((manifest.reviewed?.files || []).map(file => [file.path, file.sha256]));
  const current = new Map(files.map(file => [file.path, file.sha256]));
  const changedFiles = [...new Set([...previous.keys(), ...current.keys()])]
    .filter(file => previous.get(file) !== current.get(file));
  return { mode: 'code-first', status: manifest.reviewed?.hash === hash ? 'ready' : 'review-required',
    hash, files, changedFiles, reviewed: manifest.reviewed || null };
}

export async function reviewContext(root, reviewFile) {
  const manifest = await readManifest(root);
  if (!manifest) throw new Error('ใช้ context --context-file ก่อน');
  const status = await contextStatus(root);
  const review = JSON.parse(await fs.readFile(path.resolve(root, reviewFile), 'utf8'));
  // Bind the review to the snapshot AI actually read, not whatever is current at acknowledgement time.
  if (review.contextHash !== status.hash) throw new Error('contextHash ไม่ตรง ให้ตรวจ context และอ่านส่วนที่เปลี่ยนใหม่');
  for (const field of ['summary', 'impact', 'deployment']) {
    if (typeof review[field] !== 'string' || !review[field].trim()) throw new Error('review ต้องมี ' + field);
  }
  if (!Array.isArray(review.filesRead) || !review.filesRead.length || review.filesRead.some(file => typeof file !== 'string' || !file.trim())) throw new Error('review ต้องมี filesRead');
  if (!Array.isArray(review.assumptions) || review.assumptions.some(item => typeof item !== 'string')) throw new Error('review ต้องมี assumptions เป็น array');
  manifest.reviewed = { hash: status.hash, files: status.files, reviewedAt: new Date().toISOString(),
    summary: review.summary, impact: review.impact, deployment: review.deployment,
    filesRead: review.filesRead, assumptions: review.assumptions };
  await writeManifest(root, manifest);
  return contextStatus(root);
}

export async function requireCurrentContext(root) {
  const status = await contextStatus(root);
  if (status.status === 'review-required') throw new Error('Code context เปลี่ยนหรือยังไม่ได้อ่าน: ' + status.changedFiles.join(', ') + '. ให้ AI อ่าน วิเคราะห์ผลกระทบ และใช้ context-review ก่อน run');
  return status;
}
