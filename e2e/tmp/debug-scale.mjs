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
await new Promise(r => server.listen(4181, r));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const mob = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await mob.goto('http://localhost:4181/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
const info = await mob.evaluate(() => {
    const gc = document.getElementById('game-container');
    const app = document.getElementById('app');
    const canvas = document.querySelector('canvas');
    const g = globalThis.__echoflux?._game;
    return {
        gcRect: gc.getBoundingClientRect().toJSON(),
        gcComputed: { w: getComputedStyle(gc).width, h: getComputedStyle(gc).height },
        appRect: app.getBoundingClientRect().toJSON(),
        canvasRect: canvas.getBoundingClientRect().toJSON(),
        phaser: g ? {
            scaleMode: g.scale.scaleMode,
            parentSize: g.scale.parentSize ? { w: g.scale.parentSize.width, h: g.scale.parentSize.height } : null,
            displaySize: { w: g.scale.displaySize.width, h: g.scale.displaySize.height },
            gameSize: { w: g.scale.gameSize.width, h: g.scale.gameSize.height },
        } : null,
    };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
server.close();
process.exit(0);
