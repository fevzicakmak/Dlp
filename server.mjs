import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 8889);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = normalize(join(root, relativePath));
  const safePath = filePath === root || filePath.startsWith(`${root}${sep}`);
  const resolvedPath = safePath && existsSync(filePath) && statSync(filePath).isFile()
    ? filePath
    : join(root, 'index.html');

  if (!existsSync(resolvedPath)) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('dist klasoru bulunamadi. Once npm run build komutunu calistirin.');
    return;
  }

  response.setHeader('Cache-Control', resolvedPath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(resolvedPath)] || 'application/octet-stream' });
  response.end(readFileSync(resolvedPath));
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces())
    .flatMap((items) => items || [])
    .filter((item) => item.family === 'IPv4' && !item.internal)
    .map((item) => `http://${item.address}:${port}`);

  console.log(`ModuCAD yerel sunucusu http://localhost:${port} adresinde calisiyor`);
  if (addresses.length > 0) {
    console.log('iPhone Safari icin ayni Wi-Fi agindaki adresler:');
    addresses.forEach((address) => console.log(`  ${address}`));
  } else {
    console.log('LAN adresi bulunamadi; bilgisayarin IP adresini kontrol edin.');
  }
});