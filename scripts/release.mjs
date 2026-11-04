import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { syncRelease } from './sync-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await syncRelease(root);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const out = path.join(root, 'dist');
const name = pkg.name + '-' + pkg.version;
const stageParent = path.join(out, '.staging', Date.now().toString());
const stage = path.join(stageParent, name);
await mkdir(stage, { recursive: true });
const excluded = new Set(['.git', 'node_modules', 'install-logs', 'runs', '.ssd', '.auth', 'playwright', 'context', 'dist', '.release-checks', '.test-tmp', '.test-temp']);
const filter = source => !excluded.has(path.basename(source)) && !/\.(zip|tgz|log|local\.json)$/i.test(source);
for (const entry of ['bin','lib','skills','examples','scripts','test','release.cmd','install.cmd','install.ps1','package.json','pnpm-lock.yaml','.release-it','.gitignore','.gitattributes','README.md','CHANGELOG.md','RELEASING.md']) {
  await cp(path.join(root, entry), path.join(stage, entry), { recursive: true, filter });
}
async function validate(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (excluded.has(entry.name)) throw new Error('พบไฟล์ส่วนตัวในชุดแจก: ' + target);
    if (entry.isDirectory()) await validate(target);
    else if (entry.name === 'ssd-workspace.json') {
      const config = JSON.parse(await readFile(target, 'utf8'));
      delete config.authFile;
      await writeFile(target, JSON.stringify(config, null, 2) + '\n');
    }
    else if (/\.(mjs|cmd)$/.test(entry.name)) {
      const text = await readFile(target, 'utf8');
      if (/C:[\\/]Users[\\/](User|NB-66)/i.test(text)) throw new Error('ยังมี path เฉพาะเครื่องในสคริปต์: ' + target);
    }
  }
}
await validate(stage);
const zip = path.join(out, name + '.zip');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const command = [
  '$ErrorActionPreference = "Stop"',
  '$ProgressPreference = "SilentlyContinue"',
  'Add-Type -AssemblyName System.IO.Compression',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem',
  '$stream = [System.IO.File]::Open(' + quote(zip) + ', [System.IO.FileMode]::Create)',
  '$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)',
  'try {',
  'foreach ($file in [System.IO.Directory]::EnumerateFiles(' + quote(stage) + ', "*", [System.IO.SearchOption]::AllDirectories)) {',
  '$name = $file.Substring(' + (stageParent.length + 1) + ').Replace("\\", "/")',
  '[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file, $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null',
  '}',
  '} finally { $archive.Dispose(); $stream.Dispose() }',
].join('\n');
const result = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command, 'utf16le').toString('base64')], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('สร้าง ZIP ไม่สำเร็จ');
// Both archives use the same sanitized stage; npm TGZ expects a package/ root.
const tarRoot = path.join(stageParent, 'package');
await cp(stage, tarRoot, { recursive: true });
const tgz = path.join(out, name + '.tgz');
const tarResult = spawnSync('tar.exe', ['-czf', tgz, '-C', stageParent, 'package'], { stdio: 'inherit', windowsHide: true });
if (tarResult.error) throw tarResult.error;
if (tarResult.status !== 0) throw new Error('สร้าง TGZ ไม่สำเร็จ');
console.log(JSON.stringify({ zip, tgz, bytes: (await stat(zip)).size, version: pkg.version }, null, 2));
