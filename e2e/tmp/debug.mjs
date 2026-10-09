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
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(4173, r));

const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { const t = m.text(); if (!/WebGL|GPU stall/.test(t)) console.log(`[${m.type()}]`, t.slice(0, 200)); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4173/?qa=1');
for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await page.evaluate(() => {
        const q = globalThis.__echoflux;
        return q ? { scene: q.scene, state: q._state ?? null, hasGame: !!q.game } : null;
    });
    console.log('tick', i, JSON.stringify(s));
    if (s?.state?.scene === 'MainMenu') break;
}
await page.screenshot({ path: '/home/user/project/e2e/tmp/debug-boot.png' });
await browser.close();
server.close();
