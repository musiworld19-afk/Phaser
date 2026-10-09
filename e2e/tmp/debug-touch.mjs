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
await new Promise(r => server.listen(4185, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const mob = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
mob.on('pageerror', e => console.log('[pageerror]', e.message));
await mob.goto('http://localhost:4185/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
await mob.evaluate(() => {
    window.__log = [];
    document.addEventListener('touchstart', e => window.__log.push('dom-touchstart ' + e.touches.length), { passive: false });
    const scene = globalThis.__echoflux._game.scene.getScene('MainMenu');
    scene.input.on('pointerdown', (p) => window.__log.push('phaser-pointerdown ' + Math.round(p.x) + ',' + Math.round(p.y) + ' touch=' + p.wasTouch));
    scene.input.on('gameobjectdown', (p, go) => window.__log.push('gameobjectdown depth=' + go.depth));
    scene.input.on('gameobjectup', (p, go) => window.__log.push('gameobjectup'));
});
await mob.touchscreen.tap(422, 292);
await new Promise(r => setTimeout(r, 1500));
console.log('log:', await mob.evaluate(() => JSON.stringify(window.__log)));
console.log('state:', await mob.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await browser.close();
server.close();
process.exit(0);
