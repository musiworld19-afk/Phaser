import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveSystem, validateSaveData, defaultSaveData } from '../src/game/systems/SaveSystem.js';

function mockStorage(initial = {}) {
    const m = new Map(Object.entries(initial));
    return {
        setItem: (k, v) => m.set(k, String(v)),
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        removeItem: (k) => m.delete(k),
    };
}

function throwingStorage() {
    // Quota-exceeded simulation: probe write succeeds, later writes fail.
    return {
        setItem: (k, v) => { if (k === '__echoflux_probe__') return; throw new Error('QuotaExceededError'); },
        getItem: () => null,
        removeItem: () => {},
    };
}

test('save: loads defaults when empty', () => {
    const save = createSaveSystem(mockStorage());
    assert.deepEqual(save.getRecords(), { bestScore: 0, bestCampaignWave: 0, bestEndlessWave: 0, runsPlayed: 0 });
    assert.equal(save.getSettings().musicVolume, 0.7);
});

test('save: corrupt JSON falls back to defaults without crashing', () => {
    const store = mockStorage({ 'echoflux.save.v1': '{ this is not json' });
    const save = createSaveSystem(store);
    assert.ok(save.lastLoadWasCorrupt);
    assert.equal(save.getRecords().bestScore, 0);
    assert.equal(save.storageAvailable, true);
});

test('save: out-of-range and wrong-typed values are clamped/coerced on load', () => {
    const raw = {
        version: 1,
        bestScore: 1e12, // clamped to 1e9
        bestCampaignWave: -4, // clamped to 0
        bestEndlessWave: 99999, // clamped to 999
        runsPlayed: 'not-a-number', // -> 0
        settings: { musicVolume: 5, sfxVolume: -3, reducedMotion: 'yes', seenTutorial: 1 },
    };
    const { data, corrupt } = validateSaveData(raw);
    assert.equal(corrupt, false);
    assert.equal(data.bestScore, 1e9);
    assert.equal(data.bestCampaignWave, 0);
    assert.equal(data.bestEndlessWave, 999);
    assert.equal(data.runsPlayed, 0);
    assert.equal(data.settings.musicVolume, 1);
    assert.equal(data.settings.sfxVolume, 0);
    // non-boolean junk falls back to safe defaults (never trusted)
    assert.equal(data.settings.reducedMotion, false);
    assert.equal(data.settings.seenTutorial, false);
});

test('save: unknown version resets to defaults (recovery path)', () => {
    const { data, corrupt } = validateSaveData({ version: 99, bestScore: 500 });
    assert.equal(corrupt, true);
    assert.deepEqual(data, defaultSaveData());
});

test('save: records round-trip through storage', () => {
    const store = mockStorage();
    const a = createSaveSystem(store);
    a.updateAfterRun({ score: 1234, waveReached: 7, mode: 'campaign' });
    a.updateAfterRun({ score: 900, waveReached: 3, mode: 'endless' });
    const b = createSaveSystem(store); // fresh system reads persisted data
    const r = b.getRecords();
    assert.equal(r.bestScore, 1234);
    assert.equal(r.bestCampaignWave, 7);
    assert.equal(r.bestEndlessWave, 3);
    assert.equal(r.runsPlayed, 2);
});

test('save: updateRecords raises maxima without counting a run', () => {
    const save = createSaveSystem(mockStorage());
    save.updateAfterRun({ score: 100, waveReached: 2, mode: 'campaign' });
    save.updateRecords({ score: 300, waveReached: 5, mode: 'campaign' }); // revive path
    const r = save.getRecords();
    assert.equal(r.runsPlayed, 1); // counted once
    assert.equal(r.bestScore, 300);
    assert.equal(r.bestCampaignWave, 5);
});

test('save: quota-exceeded storage keeps the game playable (in-memory copy)', () => {
    const save = createSaveSystem(throwingStorage());
    assert.equal(save.storageAvailable, true); // probe passed
    save.updateAfterRun({ score: 777, waveReached: 4, mode: 'campaign' });
    assert.equal(save.lastWriteFailed, true); // quota hit on real write
    assert.equal(save.getRecords().bestScore, 777); // still readable this session
    save.setSetting('musicVolume', 0.4);
    assert.equal(save.getSettings().musicVolume, 0.4);
});

test('save: settings validate through setSetting', () => {
    const save = createSaveSystem(mockStorage());
    save.setSetting('musicVolume', 2.5); // clamped
    save.setSetting('seenTutorial', true);
    save.setSetting('unknown-key', 42); // ignored
    const s = save.getSettings();
    assert.equal(s.musicVolume, 1);
    assert.equal(s.seenTutorial, true);
});

test('save: reset clears records and settings', () => {
    const save = createSaveSystem(mockStorage());
    save.updateAfterRun({ score: 500, waveReached: 9, mode: 'endless' });
    save.reset();
    assert.deepEqual(save.getRecords(), { bestScore: 0, bestCampaignWave: 0, bestEndlessWave: 0, runsPlayed: 0 });
    assert.equal(save.getSettings().seenTutorial, false);
});
