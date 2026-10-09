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
await new Promise(r => server.listen(4174, r));
const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/WebGL|GPU|Cross-Origin/.test(t)) console.log('[err]', t.slice(0, 200)); });
await page.goto('http://localhost:4174/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
console.log('menu?', await page.evaluate(() => globalThis.__echoflux?._state?.scene));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 2000));
const st = () => page.evaluate(() => JSON.stringify(globalThis.__echoflux?._state));
console.log('after Enter:', await st());

// direct qa switch (bypasses input wiring)
console.log('qa switch:', await page.evaluate(() => { globalThis.__echoflux.game.switch(); return globalThis.__echoflux._state.phase; }));
await new Promise(r => setTimeout(r, 200));

// keyboard Space test
const before = await page.evaluate(() => globalThis.__echoflux._state.phase);
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 400));
const after = await page.evaluate(() => globalThis.__echoflux._state.phase);
console.log('Space key:', before, '->', after);

// where is focus?
console.log('focused el:', await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.id));
// click canvas then retry
await page.mouse.click(640, 360);
await new Promise(r => setTimeout(r, 1700)); // wait out cooldown
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 400));
console.log('after click+Space:', await page.evaluate(() => globalThis.__echoflux._state.phase));

// Escape test
await page.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 400));
console.log('after Escape ui:', await page.evaluate(() => globalThis.__echoflux._state?.ui));
await browser.close();
server.close();
