// Waves: authored campaign table (12 waves, 3 arenas, 3 bosses) + endless generator.
// Pure module. Spawn entries are declarative; the WaveDirector in the Game
// scene converts them into a pause-safe spawn timeline.

import { BALANCE, ENEMY_KINDS, BOSS_IDS } from './Balance.js';

export const CAMPAIGN_WAVE_COUNT = 12;

// kind/count/interval are required per entry.
// startAt: seconds into the wave before this stream may begin (default 0).
// eliteChance: probability each spawn of this stream is elite (0..1).
export const CAMPAIGN_WAVES = [
    { arena: 0, hpMult: 1.0,  speedMult: 1.0,  boss: null, spawns: [
        { kind: 'drone', count: 4, interval: 1.2 },
    ] },
    { arena: 0, hpMult: 1.05, speedMult: 1.0,  boss: null, spawns: [
        { kind: 'drone', count: 6, interval: 1.0 },
        { kind: 'spitter', count: 2, interval: 3.0, startAt: 4 },
    ] },
    { arena: 0, hpMult: 1.1,  speedMult: 1.05, boss: null, spawns: [
        { kind: 'drone', count: 4, interval: 1.2 },
        { kind: 'spitter', count: 3, interval: 2.8, startAt: 2 },
        { kind: 'lancer', count: 2, interval: 3.5, startAt: 3 },
        { kind: 'weaver', count: 1, interval: 0, startAt: 8 },
    ] },
    { arena: 0, hpMult: 1.1,  speedMult: 1.05, boss: 'helix', spawns: [] },
    { arena: 1, hpMult: 1.15, speedMult: 1.05, boss: null, spawns: [
        { kind: 'drone', count: 6, interval: 1.0 },
        { kind: 'lancer', count: 3, interval: 3.0, startAt: 2 },
        { kind: 'spitter', count: 3, interval: 2.6, startAt: 4 },
        { kind: 'splitter', count: 2, interval: 3.5, startAt: 5 },
    ] },
    { arena: 1, hpMult: 1.2,  speedMult: 1.1,  boss: null, spawns: [
        { kind: 'spitter', count: 4, interval: 2.4 },
        { kind: 'weaver', count: 3, interval: 2.8, startAt: 2 },
        { kind: 'splitter', count: 2, interval: 4.0, startAt: 3 },
    ] },
    { arena: 1, hpMult: 1.25, speedMult: 1.1,  boss: null, spawns: [
        { kind: 'lancer', count: 5, interval: 2.2 },
        { kind: 'bulwark', count: 3, interval: 4.0, startAt: 2 },
        { kind: 'mender', count: 2, interval: 6.0, startAt: 4 },
    ] },
    { arena: 1, hpMult: 1.25, speedMult: 1.1,  boss: 'magma', spawns: [] },
    { arena: 2, hpMult: 1.3,  speedMult: 1.12, boss: null, spawns: [
        { kind: 'weaver', count: 6, interval: 1.8 },
        { kind: 'splitter', count: 4, interval: 3.0, startAt: 3 },
        { kind: 'mender', count: 2, interval: 6.0, startAt: 5 },
    ] },
    { arena: 2, hpMult: 1.35, speedMult: 1.15, boss: null, spawns: [
        { kind: 'drone', count: 8, interval: 0.9, eliteChance: 1 },
        { kind: 'lancer', count: 4, interval: 2.6, startAt: 3 },
        { kind: 'bulwark', count: 3, interval: 4.0, startAt: 2 },
    ] },
    { arena: 2, hpMult: 1.4,  speedMult: 1.18, boss: null, spawns: [
        { kind: 'spitter', count: 4, interval: 2.4, eliteChance: 0.5 },
        { kind: 'weaver', count: 3, interval: 2.6, startAt: 2, eliteChance: 0.5 },
        { kind: 'mender', count: 2, interval: 6.0, startAt: 4 },
        { kind: 'bulwark', count: 2, interval: 4.0, startAt: 3 },
    ] },
    { arena: 2, hpMult: 1.45, speedMult: 1.2,  boss: 'keeper', spawns: [] },
];

// Deterministic RNG for endless composition (mulberry32).
function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ENDLESS_KIND_POOL = ['drone', 'lancer', 'spitter', 'weaver', 'splitter', 'bulwark', 'mender'];
const ENDLESS_BOSS_CYCLE = ['helix', 'magma', 'keeper'];

// waveNumber: 13, 14, ... (1-based). Endless difficulty is a controlled ramp.
export function getEndlessWave(waveNumber) {
    if (waveNumber <= CAMPAIGN_WAVE_COUNT) {
        throw new Error('getEndlessWave expects waveNumber > 12');
    }
    const i = waveNumber - 13; // 0-based endless index
    const rng = seededRng(waveNumber * 2654435761);
    const arena = (waveNumber - 1) % 3;
    const hpMult = Math.min(1.5 + i * 0.06, 4.5);
    const speedMult = Math.min(1.2 + i * 0.008, 1.45);
    const eliteChance = Math.min(0.08 + i * 0.01, 0.25);

    // Boss every 4th endless wave, cycling through the three bosses.
    if (waveNumber % 4 === 0) {
        const boss = ENDLESS_BOSS_CYCLE[(Math.floor(waveNumber / 4) - 1) % 3];
        const bossHpMult = 1 + (waveNumber - CAMPAIGN_WAVE_COUNT) * 0.05;
        return { arena, hpMult, speedMult, boss, bossHpMult, eliteChance, spawns: [], endless: true };
    }

    // Compose a spawn table from a growing budget.
    const budget = 8 + i * 1.2;
    const spawns = [];
    const cost = { drone: 1, spitter: 1.5, lancer: 2, weaver: 2.5, splitter: 2.5, mender: 3, bulwark: 3.5 };
    let remaining = budget;
    let guard = 0;
    while (remaining >= 1 && guard < 8) {
        guard += 1;
        const kind = ENDLESS_KIND_POOL[Math.floor(rng() * ENDLESS_KIND_POOL.length)];
        const c = cost[kind];
        if (c > remaining + 0.5) continue;
        const count = Math.max(1, Math.min(6, Math.floor(remaining / c)));
        spawns.push({ kind, count, interval: Math.max(0.9, 2.8 - i * 0.03), startAt: Math.floor(rng() * 4), eliteChance });
        remaining -= count * c;
    }
    if (spawns.length === 0) {
        spawns.push({ kind: 'drone', count: 4, interval: 1.0, eliteChance });
    }
    return { arena, hpMult, speedMult, boss: null, eliteChance, spawns, endless: true };
}

// waveIndexZero: 0-based wave index within the current mode.
export function getWave(waveIndexZero, mode) {
    if (mode === 'endless') {
        return getEndlessWave(waveIndexZero + 1);
    }
    const def = CAMPAIGN_WAVES[waveIndexZero];
    if (!def) throw new Error(`getWave: no campaign wave at index ${waveIndexZero}`);
    return def;
}

export function isCampaignVictoryWave(waveIndexZero, mode) {
    return mode === 'campaign' && waveIndexZero === CAMPAIGN_WAVE_COUNT - 1;
}

export function hasNextWave(waveIndexZero, mode) {
    return mode === 'endless' || waveIndexZero + 1 < CAMPAIGN_WAVE_COUNT;
}

// ---- Structural validation (used by unit tests) ----
export function validateWaveTable() {
    const errors = [];
    if (CAMPAIGN_WAVES.length !== CAMPAIGN_WAVE_COUNT) {
        errors.push(`expected ${CAMPAIGN_WAVE_COUNT} campaign waves, found ${CAMPAIGN_WAVES.length}`);
    }
    const expectedBosses = { 3: 'helix', 7: 'magma', 11: 'keeper' };
    for (const [idx, bossId] of Object.entries(expectedBosses)) {
        const w = CAMPAIGN_WAVES[idx];
        if (!w || w.boss !== bossId) errors.push(`wave ${+idx + 1} should have boss ${bossId}, found ${w?.boss}`);
        if (!BOSS_IDS.includes(bossId)) errors.push(`unknown boss id ${bossId}`);
    }
    CAMPAIGN_WAVES.forEach((w, idx) => {
        if (!w.boss && w.spawns.length === 0) errors.push(`wave ${idx + 1} has no boss and no spawns`);
        if (w.hpMult < 1 || w.speedMult < 1) errors.push(`wave ${idx + 1} mult below 1`);
        w.spawns.forEach((s, sIdx) => {
            if (!ENEMY_KINDS.includes(s.kind)) errors.push(`wave ${idx + 1} spawn ${sIdx}: unknown kind ${s.kind}`);
            if (s.count < 1) errors.push(`wave ${idx + 1} spawn ${sIdx}: count < 1`);
            if (s.interval < 0) errors.push(`wave ${idx + 1} spawn ${sIdx}: negative interval`);
            if (s.eliteChance != null && (s.eliteChance < 0 || s.eliteChance > 1)) {
                errors.push(`wave ${idx + 1} spawn ${sIdx}: eliteChance out of range`);
            }
        });
        if (idx >= 4 && idx < 8 && w.arena !== 1) errors.push(`wave ${idx + 1} should be arena 1`);
        if (idx >= 8 && w.arena !== 2) errors.push(`wave ${idx + 1} should be arena 2`);
        if (idx < 4 && w.arena !== 0) errors.push(`wave ${idx + 1} should be arena 0`);
    });
    return errors;
}
