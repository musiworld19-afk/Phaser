import { chromium } from 'playwright-core';
const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/WebGL|GPU|Cross-Origin/.test(t)) console.log('[err]', t.slice(0, 250)); });
await page.addInitScript(() => {
    window.addEventListener('keydown', (e) => {
        window.__lastKey = e.key + ':' + e.keyCode;
    }, true);
});
await page.goto('http://127.0.0.1:8082/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 2000));
const probe = await page.evaluate(() => {
    const q = globalThis.__echoflux;
    const game = q._game;
    const scene = game.scene.getScene('Game');
    const kb = scene.input.keyboard;
    return {
        state: q._state,
        lastKey: window.__lastKey,
        kbEnabled: kb?.enabled,
        listeners: kb ? {
            keydown: kb.listenerCount('keydown'),
            keydownSpace: kb.listenerCount('keydown-SPACE'),
            keydownESC: kb.listenerCount('keydown-ESC'),
        } : null,
        gamepads: game.input.keyboard === kb,
    };
});
console.log(JSON.stringify(probe, null, 1));
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 300));
console.log('after Space:', await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await browser.close();
process.exit(0);
