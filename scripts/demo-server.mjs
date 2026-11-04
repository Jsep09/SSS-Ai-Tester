import http from 'node:http';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
const demo = fileURLToPath(new URL('../examples/demo.html', import.meta.url));
const report = fileURLToPath(new URL('../examples/demo-report/report.html', import.meta.url));
http.createServer(async (request, response) => {
  const file = request.url === '/' ? demo : request.url === '/report' ? report : null;
  if (!file) { response.writeHead(404); response.end(); return; }
  try { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(await fs.readFile(file)); }
  catch { response.writeHead(404); response.end('Not found'); }
}).listen(43127, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:43127'));
