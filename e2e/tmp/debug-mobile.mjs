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
await new Promise(r => server.listen(4180, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const mob = await browser.newPage({
    viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile',
});
mob.on('pageerror', e => console.log('[pageerror]', e.message));
await mob.goto('http://localhost:4180/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
console.log('menu:', await mob.evaluate(() => JSON.stringify(globalThis.__echoflux?._state)));
const rect = await mob.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('canvas rect:', JSON.stringify(rect));
await mob.touchscreen.tap(422, 292);
await new Promise(r => setTimeout(r, 3000));
console.log('after tap:', await mob.evaluate(() => JSON.stringify(globalThis.__echoflux?._state)));
await mob.screenshot({ path: '/home/user/project/e2e/tmp/debug-mobile.png' });
// try CDP touch instead
const cdp = await mob.context().newCDPSession(mob);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 422, y: 292, id: 1 }] });
await new Promise(r => setTimeout(r, 80));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await new Promise(r => setTimeout(r, 3000));
console.log('after cdp tap:', await mob.evaluate(() => JSON.stringify(globalThis.__echoflux?._state)));
await browser.close();
server.close();
process.exit(0);
