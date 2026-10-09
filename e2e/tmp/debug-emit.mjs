import { chromium } from 'playwright-core';
const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8082/?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
    const kb = globalThis.__echoflux._game.scene.getScene('Game').input.keyboard;
    window.__log = [];
    kb.on('keydown', (e) => window.__log.push('ANY:' + e.key));
    kb.on('keydown-SPACE', () => window.__log.push('SPACE'));
    kb.on('keydown-ESC', () => window.__log.push('ESC'));
    kb.on('keydown-W', () => window.__log.push('W'));
});
for (const key of ['Space', 'Escape', 'KeyW']) {
    await page.keyboard.press(key);
    await new Promise(r => setTimeout(r, 250));
}
console.log('emitted:', await page.evaluate(() => JSON.stringify(window.__log)));
console.log('state:', await page.evaluate(() => JSON.stringify(globalThis.__echoflux._state)));
await browser.close();
process.exit(0);
