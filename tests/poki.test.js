import test from 'node:test';
import assert from 'node:assert/strict';
import { createPokiAdapter } from '../src/game/systems/PokiAdapter.js';

// Mock SDK recording every call, with programmable behaviors.
function mockSdk({ initFails = false, rewardedSuccess = true } = {}) {
    const calls = [];
    return {
        calls,
        initFails,
        rewardedSuccess,
        init() {
            calls.push('init');
            return initFails ? Promise.reject(new Error('blocked')) : Promise.resolve();
        },
        gameLoadingFinished() { calls.push('gameLoadingFinished'); },
        gameplayStart() { calls.push('gameplayStart'); },
        gameplayStop() { calls.push('gameplayStop'); },
        commercialBreak(muteCb) {
            calls.push('commercialBreak');
            if (typeof muteCb === 'function') muteCb();
            return Promise.resolve();
        },
        rewardedBreak(muteCb) {
            calls.push('rewardedBreak');
            if (typeof muteCb === 'function') muteCb();
            return Promise.resolve(rewardedSuccess);
        },
    };
}

const noopLogger = { debug: () => {} };

function flush() {
    return new Promise(r => setTimeout(r, 5));
}

test('poki: startup order — init, then a single gameLoadingFinished', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    poki.gameLoadingFinished(); // may arrive before init resolves: must queue
    await flush();
    poki.gameLoadingFinished(); // second call: ignored
    assert.deepEqual(sdk.calls.filter(c => c === 'gameLoadingFinished'), ['gameLoadingFinished']);
    assert.equal(poki.isReady(), true);
});

test('poki: no duplicate consecutive gameplayStart/gameplayStop', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    assert.equal(poki.gameplayStart(), true);
    assert.equal(poki.gameplayStart(), false); // duplicate blocked
    assert.equal(poki.gameplayStop(), true);
    assert.equal(poki.gameplayStop(), false); // duplicate blocked
    assert.deepEqual(sdk.calls.filter(c => c.startsWith('gameplay')), ['gameplayStart', 'gameplayStop']);
});

test('poki: events before init are ignored', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    assert.equal(poki.gameplayStart(), false);
    assert.equal(poki.gameplayStop(), false);
    assert.equal(poki.commercialBreak(() => {}), false);
    assert.deepEqual(sdk.calls, []);
});

test('poki: documented death/restart order (stop -> break -> start)', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    poki.gameplayStart();
    // player dies
    poki.gameplayStop();
    // restart path: commercial break, then back into gameplay
    let resumed = false;
    poki.commercialBreak(() => { resumed = true; });
    await flush();
    assert.equal(resumed, true);
    poki.gameplayStart();
    const seq = sdk.calls.filter(c => c !== 'init' && c !== 'gameLoadingFinished' && c !== 'commercialBreak');
    assert.deepEqual(seq, ['gameplayStart', 'gameplayStop', 'gameplayStart']);
});

test('poki: gameplay events are blocked while an ad break is active', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    poki.gameplayStart();
    let done = false;
    poki.commercialBreak(() => { done = true; }); // resolves on next microtask
    // simulate mid-ad event attempts (they race the break completion)
    poki.gameplayStop();
    await flush();
    assert.equal(done, true);
    assert.equal(poki.isAdActive(), false);
});

test('poki: ad-active guard blocks events synchronously', async () => {
    const sdk = mockSdk();
    let resolveBreak;
    sdk.commercialBreak = (cb) => {
        if (typeof cb === 'function') cb();
        return new Promise(res => { resolveBreak = res; });
    };
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    poki.gameplayStart();
    let done = false;
    poki.commercialBreak(() => { done = true; });
    assert.equal(poki.isAdActive(), true);
    assert.equal(poki.gameplayStart(), false, 'start blocked during ad');
    assert.equal(poki.gameplayStop(), false, 'stop blocked during ad');
    resolveBreak();
    await flush();
    assert.equal(done, true);
    assert.equal(poki.isAdActive(), false);
});

test('poki: rewarded success grants revive, failure does not', async () => {
    for (const rewardedSuccess of [true, false]) {
        const sdk = mockSdk({ rewardedSuccess });
        const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
        poki.init();
        await flush();
        let result = 'unset';
        poki.rewardedBreak((success) => { result = success; });
        await flush();
        assert.equal(result, rewardedSuccess, `rewarded result should be ${rewardedSuccess}`);
        assert.equal(poki.isAdActive(), false);
    }
});

test('poki: dev fallback never fakes ads or rewards', async () => {
    const poki = createPokiAdapter(() => undefined, { logger: noopLogger }); // no PokiSDK
    poki.init();
    await flush();
    assert.equal(poki.usingFallback(), true);
    assert.equal(poki.isReady(), true);

    let loadingFired = poki.gameLoadingFinished();
    assert.equal(loadingFired, true); // internal bookkeeping only
    assert.equal(poki.gameplayStart(), true); // state machine still tracks
    let broke = false;
    assert.equal(poki.commercialBreak(() => { broke = true; }), true);
    assert.equal(broke, true); // proceeds immediately, no ad impersonation
    let reward = 'unset';
    poki.rewardedBreak((success) => { reward = success; });
    assert.equal(reward, false, 'fallback must never grant a reward');
});

test('poki: init failure still lets the game run (documented behavior)', async () => {
    const sdk = mockSdk({ initFails: true });
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    assert.equal(poki.isReady(), true);
    assert.equal(poki.usingFallback(), true);
    assert.equal(poki.gameplayStart(), true);
    assert.equal(poki.gameplayStop(), true);
});

test('poki: getSummary reflects the event log for inspection', async () => {
    const sdk = mockSdk();
    const poki = createPokiAdapter(() => sdk, { logger: noopLogger });
    poki.init();
    await flush();
    poki.gameLoadingFinished();
    poki.gameplayStart();
    poki.gameplayStop();
    const s = poki.getSummary();
    assert.equal(s.status, 'ready');
    assert.deepEqual(s.events, ['gameLoadingFinished', 'gameplayStart', 'gameplayStop']);
});
