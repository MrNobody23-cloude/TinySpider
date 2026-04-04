import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.DEMO_PORT || 8080);

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.gif': 'image/gif'
};

function serveFile(res, filePath) {
    if (!existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
}

const PAGES = {
    '/': 'pages/index.html',
    '/pricing': 'pages/pricing.html',
    '/features': 'pages/features.html',
    '/contact': 'pages/contact.html',
    '/blog': 'pages/blog.html'
};

const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Serve tracker script
    if (pathname === '/tracker.js' || pathname === '/insight.min.js') {
        const trackerPath = join(__dirname, '..', 'tracker', 'dist', 'insight.min.js');
        if (existsSync(trackerPath)) {
            serveFile(res, trackerPath);
        } else {
            // Serve unminified version as fallback
            const srcPath = join(__dirname, '..', 'tracker', 'src', 'insight.js');
            serveFile(res, srcPath);
        }
        return;
    }

    // Serve static assets
    if (pathname.startsWith('/assets/')) {
        serveFile(res, join(__dirname, 'public', pathname));
        return;
    }

    // Serve page routes
    const pagePath = PAGES[pathname];
    if (pagePath) {
        serveFile(res, join(__dirname, pagePath));
        return;
    }

    // Serve CSS
    if (pathname === '/styles.css') {
        serveFile(res, join(__dirname, 'public', 'styles.css'));
        return;
    }

    // Serve app JS
    if (pathname === '/app.js') {
        serveFile(res, join(__dirname, 'public', 'app.js'));
        return;
    }

    // 1x1 transparent gif for honeypot
    if (pathname === '/insight-honeypot.gif') {
        const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, { 'Content-Type': 'image/gif' });
        res.end(buf);
        return;
    }

    // Fallback to index
    serveFile(res, join(__dirname, 'pages', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`\n  🕸️  TinySpider Demo Site`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  🌐  http://localhost:${PORT}`);
    console.log(`  📊  Dashboard: http://localhost:5173`);
    console.log(`  🔌  API:       http://localhost:3000`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
