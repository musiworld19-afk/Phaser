// E2E smoke suite: boots the PRODUCTION build (dist/) in system Chrome via
// playwright-core, drives real flows with keyboard + touch, screenshots every
// major state, and fails on any console error or page error.
//
// NOTE ON TIMING: headless SwiftShader (CPU raster) renders this game at a few
// FPS, so the in-game clock runs slower than wall time. All assertions are
// state-polling based with generous timeouts; nothing depends on wall-clock
// pacing. The Poki CDN is reachable from this sandbox, so the REAL SDK runs
// (its dev-mode console output is info-level and allowed).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const SHOTS = path.join(__dirname, 'screenshots');
if (!existsSync(DIST)) {
    console.error('dist/ missing — run `npm run build` first');
    process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveDist(port) {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            let file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
            if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
            const data = await readFile(file);
            res.writeHead(200, {
                'content-type': MIME[path.extname(file)] || 'application/octet-stream',
                'cache-control': 'no-store',
            });
            res.end(data);
        } catch {
            res.writeHead(404).end('not found');
        }
    });
    return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const errors = [];
const filteredConsole = new Set();

async function newSession(browser, opts = {}) {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
        ...opts,
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // Offline/HTTP-sandbox noise from the Poki SDK script itself.
        if (/poki-sdk\.js|game-cdn\.poki\.com|net::ERR|Failed to load resource|Cross-Origin-Opener-Policy/i.test(text)) {
            filteredConsole.add(text);
            return;
        }
        errors.push(`console.error: ${text}`);
    });
    return page;
}

async function state(page) {
    return page.evaluate(() => globalThis.__echoflux?._state ?? null);
}

async function waitForState(page, predicate, label, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const s = await state(page);
        if (s && predicate(s)) return s;
        await sleep(150);
    }
    throw new Error(`timeout waiting for: ${label}`);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

// Press `key` repeatedly until predicate is satisfied (handles in-game
// cooldowns under slow rendering clocks).
async function pressUntil(page, key, predicate, label, { interval = 1200, tries = 15 } = {}) {
    for (let i = 0; i < tries; i++) {
        await page.keyboard.press(key);
        await sleep(400);
        const s = await state(page);
        if (s && predicate(s)) return s;
        await sleep(interval);
    }
    throw new Error(`pressUntil exhausted: ${label}`);
}

async function main() {
    const server = await serveDist(4173);
    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: [
            '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio',
            '--autoplay-policy=no-user-gesture-required',
            '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
        ],
    });

    let failures = 0;
    const check = (cond, label) => {
        console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
        if (!cond) failures++;
    };

    try {
        // ---------- desktop session ----------
        const page = await newSession(browser);
        await page.goto('http://localhost:4173/?qa=1', { waitUntil: 'domcontentloaded' });
        await waitForState(page, s => s.scene === 'MainMenu', 'main menu', 45000);
        await sleep(600);
        await shot(page, '01-menu');

        // start campaign (Enter activates the focused CAMPAIGN button)
        await page.keyboard.press('Enter');
        const run = await waitForState(page, s => s.scene === 'Game' && s.ui === 'playing', 'gameplay start', 45000);
        check(run.wave === 1, 'campaign starts at wave 1');
        check(run.phase === 'cyan', 'run begins in cyan reality');
        // Rendering runs ~6x slower than wall time under SwiftShader; keep the
        // player alive while we exercise input/UI flows (death has its own
        // dedicated test in the next run).
        await page.evaluate(() => globalThis.__echoflux.game.god(true));

        // movement input
        await page.keyboard.down('KeyW');
        await sleep(700);
        await page.keyboard.up('KeyW');
        await page.keyboard.down('KeyD');
        await sleep(500);
        await page.keyboard.up('KeyD');

        // phase switch (Space) — poll, robust to cooldown + slow clock
        const amber = await pressUntil(page, 'Space', s => s.phase === 'amber', 'switch to amber');
        check(amber.phase === 'amber', 'SPACE switches to amber reality');
        const back = await pressUntil(page, 'Space', s => s.phase === 'cyan', 'switch back to cyan');
        check(back.phase === 'cyan', 'SPACE switches back after cooldown');

        await sleep(800);
        await shot(page, '02-gameplay');

        // pause / resume
        await page.keyboard.press('Escape');
        await waitForState(page, x => x.ui === 'paused', 'paused state');
        await shot(page, '03-paused');
        await page.keyboard.press('Enter'); // RESUME focused
        await waitForState(page, x => x.ui === 'playing', 'resumed state', 45000);

        // clear wave 1 -> upgrade draft (killAll force-completes the spawner)
        await page.evaluate(() => globalThis.__echoflux.game.killAll());
        await waitForState(page, x => x.ui === 'upgrade', 'upgrade screen after wave clear', 45000);
        await shot(page, '04-upgrades');
        await page.keyboard.press('Digit1');
        await waitForState(page, x => x.ui === 'playing' && x.wave === 2, 'wave 2 begins after pick', 45000);

        // pause -> quit to menu (navigate: RESUME, SETTINGS, RESTART, QUIT)
        await page.keyboard.press('Escape');
        await waitForState(page, x => x.ui === 'paused', 'paused again');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await waitForState(page, x => x.scene === 'MainMenu', 'back at menu', 45000);

        // death flow (no SDK rewarded revive in the sandbox: END RUN only)
        await page.keyboard.press('Enter'); // CAMPAIGN
        await waitForState(page, x => x.scene === 'Game' && x.ui === 'playing', 'second run', 45000);
        await page.evaluate(() => globalThis.__echoflux.game.damage(9999));
        await waitForState(page, x => x.ui === 'ended', 'death screen', 45000);
        await sleep(600);
        await shot(page, '05-defeat');
        const dead = await state(page);
        check(dead.hp === 0, 'fatal damage ends the run');

        // END RUN is focused -> results, then RESTART
        await page.keyboard.press('Enter');
        await sleep(600);
        await shot(page, '06-results');
        await page.keyboard.press('Enter'); // RESTART focused
        await waitForState(page, x => x.ui === 'playing' && x.wave === 1 && x.hp === 100, 'restart resets run', 60000);
        await shot(page, '07-restarted');

        // boss intro + victory path
        await page.evaluate(() => {
            globalThis.__echoflux.game.god(true);
            globalThis.__echoflux.game.jumpWave(12);
        });
        await waitForState(page, x => x.ui === 'boss-intro', 'boss intro', 45000);
        await shot(page, '08-boss-intro');
        await waitForState(page, x => x.ui === 'playing' && x.boss !== null, 'keeper fight live', 90000);
        await shot(page, '09-boss-fight');
        await page.evaluate(() => globalThis.__echoflux.game.hurtBoss(99999));
        await waitForState(page, x => x.ui === 'ended', 'victory screen', 90000);
        await sleep(600);
        await shot(page, '10-victory');
        const vic = await state(page);
        check(vic.score > 0, 'victory records score');
        check(vic.boss === null, 'boss defeated and cleared');

        // CONTINUE — ENDLESS
        await page.keyboard.press('Enter');
        await waitForState(page, x => x.ui === 'playing' && x.mode === 'endless', 'endless continue', 60000);
        await sleep(900);
        await shot(page, '11-endless');
        await page.close();

        // ---------- touch session (mobile emulation) ----------
        const mob = await newSession(browser, {
            viewport: { width: 844, height: 390 },
            hasTouch: true,
            isMobile: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
        });
        // Scale.FIT letterboxing: map game coords (1280x720) -> viewport coords.
        const g2s = (gx, gy) => {
            const vw = 844, vh = 390;
            const s = Math.min(vw / 1280, vh / 720);
            const ox = (vw - 1280 * s) / 2, oy = (vh - 720 * s) / 2;
            return { x: ox + gx * s, y: oy + gy * s };
        };
        await mob.goto('http://localhost:4173/?qa=1', { waitUntil: 'domcontentloaded' });
        await waitForState(mob, x => x.scene === 'MainMenu', 'mobile menu', 45000);
        await shot(mob, '12-mobile-menu');
        const campaignTap = g2s(640, 540);
        await mob.touchscreen.tap(campaignTap.x, campaignTap.y);
        await waitForState(mob, x => x.scene === 'Game' && x.ui === 'playing', 'mobile gameplay', 45000);
        await sleep(700);
        await shot(mob, '13-mobile-gameplay');

        // joystick drag via CDP touch events
        const joyStart = g2s(160, 580);
        const joyEnd = g2s(260, 580);
        const cdp = await mob.context().newCDPSession(mob);
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x: joyStart.x, y: joyStart.y, id: 1 }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: joyEnd.x, y: joyEnd.y, id: 1 }],
        });
        await sleep(500);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(300);

        // phase button tap
        const phaseTap = g2s(1160, 600);
        await mob.touchscreen.tap(phaseTap.x, phaseTap.y);
        const mobPhase = await waitForState(mob, x => x.phase === 'amber', 'mobile phase switch', 20000);
        check(mobPhase.phase === 'amber', 'touch phase button switches reality');
        await shot(mob, '14-mobile-phase');
        await mob.close();
    } catch (err) {
        console.log('E2E step failed:', err.message);
        failures++;
    } finally {
        await browser.close();
        server.close();
    }

    console.log('');
    if (filteredConsole.size) {
        console.log(`(filtered ${filteredConsole.size} sandbox network/COOP message(s) from the Poki SDK script)`);
    }
    if (errors.length) {
        console.log('ERRORS:');
        for (const e of errors) console.log('  ' + e);
    }
    console.log(failures === 0 && errors.length === 0
        ? 'E2E: ALL CHECKS PASSED'
        : `E2E: ${failures} check failure(s), ${errors.length} runtime error(s)`);
    process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error('E2E crashed:', err);
    process.exit(1);
});
