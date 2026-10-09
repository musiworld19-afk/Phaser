import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const DIST = '/home/user/project/dist';
const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        const file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': path.extname(file) === '.js' ? 'text/javascript' : 'text/html' });
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(4177, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4177/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
    window.__frames = 0;
    const t0 = performance.now();
    const loop = () => { window.__frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
});
await new Promise(r => setTimeout(r, 5300));
const fps = await page.evaluate(() => window.__frames / 5);
console.log('RAF fps on blank game page:', fps.toFixed(1));
await browser.close();
server.close();
process.exit(0);
