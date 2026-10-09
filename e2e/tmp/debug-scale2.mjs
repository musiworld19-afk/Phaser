import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const DIST = '/home/user/project/dist';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        const file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(4184, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const mob = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
mob.on('pageerror', e => console.log('[pageerror]', e.message));
await mob.goto('http://localhost:4184/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
const info = await mob.evaluate(() => {
    const gc = document.getElementById('game-container');
    const canvas = document.querySelector('canvas');
    const g = globalThis.__echoflux?._game;
    return {
        inner: `${innerWidth}x${innerHeight}`,
        bodyMargin: getComputedStyle(document.body).margin,
        gcRect: gc.getBoundingClientRect().toJSON(),
        canvasRect: canvas.getBoundingClientRect().toJSON(),
        parentSize: g?.scale.parentSize ? { w: g.scale.parentSize.width, h: g.scale.parentSize.height } : null,
        displaySize: g ? { w: g.scale.displaySize.width, h: g.scale.displaySize.height } : null,
    };
});
console.log(JSON.stringify(info, null, 1));
// tap campaign with correct math
await mob.touchscreen.tap(422, 292);
await new Promise(r => setTimeout(r, 3000));
console.log('after tap:', await mob.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await browser.close();
server.close();
process.exit(0);
