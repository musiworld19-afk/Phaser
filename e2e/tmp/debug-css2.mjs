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
        res.writeHead(200, { 'content-type': path.extname(file) === '.js' ? 'text/javascript' : 'text/html', 'cache-control': 'no-store' });
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(4183, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await page.goto('http://localhost:4183/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
const info = await page.evaluate(async () => {
    const gc = document.getElementById('game-container');
    const app = document.getElementById('app');
    const cs = (el) => ({ pos: getComputedStyle(el).position, w: getComputedStyle(el).width, h: getComputedStyle(el).height, m: getComputedStyle(el).margin });
    const cssText = await (await fetch('./style.css')).text();
    return {
        inner: `${innerWidth}x${innerHeight}`,
        client: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
        meta: document.querySelector('meta[name=viewport]')?.content,
        gcRect: gc.getBoundingClientRect().toJSON(),
        appRect: app.getBoundingClientRect().toJSON(),
        gcCS: cs(gc),
        appCS: cs(app),
        bodyCS: { m: getComputedStyle(document.body).margin, w: getComputedStyle(document.body).width, h: getComputedStyle(document.body).height },
        cssHasAbsolute: cssText.includes('position: absolute'),
        cssHead: cssText.slice(0, 200),
    };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
server.close();
process.exit(0);
