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
await new Promise(r => server.listen(4178, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/WebGL|GPU|Cross-Origin|net::ERR/.test(t)) console.log('[err]', t.slice(0, 200)); });
await page.goto('http://localhost:4178/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => { globalThis.__echoflux.game.god(true); globalThis.__echoflux.game.jumpWave(12); });
await new Promise(r => setTimeout(r, 3000));
console.log('intro?', await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await page.evaluate(() => globalThis.__echoflux.game.hurtBoss(99999));
for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state));
    const st = JSON.parse(s);
    if (st.ui === 'ended') { console.log('victory at i=' + i, s); break; }
    if (i % 10 === 0) console.log('wait victory', i, s);
}
await page.keyboard.press('Enter');
for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state));
    const st = JSON.parse(s);
    if (st.ui === 'playing' && st.mode === 'endless') { console.log('ENDLESS at i=' + i, s); break; }
    if (i % 6 === 0) console.log('wait endless', i, s);
}
await browser.close();
server.close();
process.exit(0);
