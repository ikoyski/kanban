import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

const server = http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || '')) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end('Method not allowed');
        return;
    }

    try {
        const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
        const relativePath = pathname === '/' ? '/index.html' : pathname;
        const filePath = path.resolve(root, `.${relativePath}`);

        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        const body = await readFile(filePath);
        response.writeHead(200, {
            'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Content-Length': body.length,
            'Cache-Control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
        const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 500;
        response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(status === 404 ? 'Not found' : 'Internal server error');
        if (status === 500) console.error('Static server error:', error);
    }
});

server.listen(port, host, () => {
    console.log(`Serving Kanban at http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
