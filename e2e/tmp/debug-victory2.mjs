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
await new Promise(r => server.listen(4179, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/WebGL|GPU|Cross-Origin|net::ERR/.test(t)) console.log('[err]', t.slice(0, 200)); });
await page.goto('http://localhost:4179/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => { globalThis.__echoflux.game.god(true); globalThis.__echoflux.game.jumpWave(12); });
// wait for boss live (like the smoke does)
for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => globalThis.__echoflux._state);
    if (st.ui === 'playing' && st.boss !== null) break;
    await new Promise(r => setTimeout(r, 500));
}
console.log('boss live:', await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await page.evaluate(() => globalThis.__echoflux.game.hurtBoss(99999));
for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => globalThis.__echoflux._state);
    if (st.ui === 'ended') break;
    await new Promise(r => setTimeout(r, 500));
}
console.log('ended:', await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await new Promise(r => setTimeout(r, 600));
await page.keyboard.press('Enter');
for (let i = 0; i < 50; i++) {
    const st = await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state));
    console.log('t+' + (i*500), st);
    const o = JSON.parse(st);
    if (o.ui === 'playing' && o.mode === 'endless') { console.log('SUCCESS'); break; }
    await new Promise(r => setTimeout(r, 500));
}
await browser.close();
server.close();
process.exit(0);
