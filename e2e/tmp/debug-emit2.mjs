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
await new Promise(r => server.listen(4175, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4175/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
    window.__log = [];
    window.addEventListener('keydown', e => window.__log.push('raw:' + e.key + ':' + e.defaultPrevented), true);
    const kb = globalThis.__echoflux._game.scene.getScene('Game').input.keyboard;
    kb.on('keydown-SPACE', () => window.__log.push('PHASER:SPACE'));
    kb.on('keydown', (e) => window.__log.push('PHASER:any:' + e.key));
});
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 300));
console.log('log:', await page.evaluate(() => JSON.stringify(window.__log)));
console.log('phase:', await page.evaluate(() => globalThis.__echoflux._state.phase));
await browser.close();
server.close();
process.exit(0);
