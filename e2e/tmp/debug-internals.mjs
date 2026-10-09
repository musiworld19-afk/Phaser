import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (/POKI/.test(t)) console.log('[poki]', t.replace(/%c|\x1b/g, '').slice(0, 80)); });
await page.goto('http://127.0.0.1:8082/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1800));
const dump = () => page.evaluate(() => {
    const g = globalThis.__echoflux._game.scene.getScene('Game');
    return {
        phase: g.run.phase,
        ui: g.uiState,
        enabled: g.inputSystem.gameplayEnabled,
        switchReadyAt: g.run.switchReadyAt,
        runTime: g.run.runTime,
        firstFired: g.inputSystem.firstInputFired,
    };
});
console.log('before W:', JSON.stringify(await dump()));
await page.keyboard.down('KeyW');
await new Promise(r => setTimeout(r, 600));
await page.keyboard.up('KeyW');
console.log('after W:', JSON.stringify(await dump()));
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 300));
console.log('after Space:', JSON.stringify(await dump()));
await browser.close();
process.exit(0);
