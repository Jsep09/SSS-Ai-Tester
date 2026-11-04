import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function parseReleaseNotes(text) {
  const releases = [];
  let current;
  for (const line of text.split(/\r?\n/)) {
    const match = /^#{1,2}\s+\[?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)\]?(?:\([^)]*\))?(?=\s|$)/.exec(line);
    if (match) { current = { version: match[1], notes: [] }; releases.push(current); }
    else if (/^#{1,2}\s/.test(line)) current = null;
    else if (current && line.trim()) current.notes.push(line);
  }
  return releases;
}
export async function syncRelease(root) {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const releases = parseReleaseNotes(await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8'));
  if (!releases.some(release => release.version === pkg.version)) throw new Error('CHANGELOG ต้องมีรุ่น ' + pkg.version + ' ก่อนสร้าง release metadata');
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'skills/ssd-skill-list/references/catalog.json'), 'utf8'));
  for (const { name } of catalog) {
    const skill = path.join(root, 'skills', name);
    const file = path.join(skill, 'SKILL.md');
    const content = await fs.readFile(file, 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!front) throw new Error('Skill ไม่มี frontmatter: ' + name);
    let header = front[1];
    if (/^metadata:\s*$/m.test(header)) {
      if (!/^  version: /m.test(header)) throw new Error('ต้องมี metadata.version ใน ' + name);
      header = header.replace(/^  version: .*$/m, '  version: "' + pkg.version + '"');
    } else header += '\nmetadata:\n  version: "' + pkg.version + '"';
    const next = ('---\n' + header + '\n---' + content.slice(front[0].length)).replace(/\r?\n/g, '\r\n');
    await fs.writeFile(file, next);
    await fs.mkdir(path.join(skill, 'references'), { recursive: true });
    await fs.writeFile(path.join(skill, 'references/release.json'), JSON.stringify({ version: pkg.version, releases }, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  syncRelease(fileURLToPath(new URL('../', import.meta.url))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
