import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CAMPAIGN_WAVES, CAMPAIGN_WAVE_COUNT, getWave, getEndlessWave,
    isCampaignVictoryWave, hasNextWave, validateWaveTable,
} from '../src/game/core/Waves.js';
import { BALANCE, ENEMY_KINDS, BOSS_IDS } from '../src/game/core/Balance.js';

test('waves: authored campaign table is structurally valid', () => {
    const errors = validateWaveTable();
    assert.deepEqual(errors, []);
    assert.equal(CAMPAIGN_WAVES.length, CAMPAIGN_WAVE_COUNT);
    assert.equal(CAMPAIGN_WAVE_COUNT, 12);
});

test('waves: three bosses at waves 4, 8, 12 in order', () => {
    assert.equal(CAMPAIGN_WAVES[3].boss, 'helix');
    assert.equal(CAMPAIGN_WAVES[7].boss, 'magma');
    assert.equal(CAMPAIGN_WAVES[11].boss, 'keeper');
    const bossWaves = CAMPAIGN_WAVES.filter(w => w.boss);
    assert.equal(bossWaves.length, 3);
    for (const w of bossWaves) {
        assert.ok(BOSS_IDS.includes(w.boss));
    }
});

test('waves: arenas progress 0 -> 1 -> 2 in blocks of four', () => {
    const arenas = CAMPAIGN_WAVES.map(w => w.arena);
    assert.deepEqual(arenas, [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
});

test('waves: campaign difficulty mults never decrease', () => {
    for (let i = 1; i < CAMPAIGN_WAVES.length; i++) {
        assert.ok(CAMPAIGN_WAVES[i].hpMult >= CAMPAIGN_WAVES[i - 1].hpMult,
            `wave ${i + 1} hpMult regressed`);
        assert.ok(CAMPAIGN_WAVES[i].speedMult >= CAMPAIGN_WAVES[i - 1].speedMult,
            `wave ${i + 1} speedMult regressed`);
    }
    assert.ok(CAMPAIGN_WAVES[11].hpMult > CAMPAIGN_WAVES[0].hpMult);
});

test('waves: every non-boss wave spawns valid enemy kinds', () => {
    for (const [idx, w] of CAMPAIGN_WAVES.entries()) {
        if (w.boss) continue;
        assert.ok(w.spawns.length > 0, `wave ${idx + 1} has no spawns`);
        for (const s of w.spawns) {
            assert.ok(ENEMY_KINDS.includes(s.kind), `wave ${idx + 1}: unknown kind ${s.kind}`);
            assert.ok(s.count >= 1);
            assert.ok(s.interval >= 0);
        }
    }
});

test('waves: getWave returns campaign defs and throws past the end', () => {
    assert.equal(getWave(0, 'campaign'), CAMPAIGN_WAVES[0]);
    assert.equal(getWave(11, 'campaign').boss, 'keeper');
    assert.throws(() => getWave(12, 'campaign'));
});

test('waves: endless generator scales monotonically and stays bounded', () => {
    let lastHp = 0;
    for (let n = 13; n <= 60; n++) {
        const w = getEndlessWave(n);
        assert.ok(w.hpMult >= lastHp, `endless wave ${n} hpMult regressed`);
        lastHp = w.hpMult;
        assert.ok(w.hpMult <= 4.5);
        assert.ok(w.speedMult <= 1.45);
        assert.ok(w.eliteChance >= 0 && w.eliteChance <= 0.25);
        assert.ok([0, 1, 2].includes(w.arena));
        if (n % 4 === 0) {
            assert.ok(BOSS_IDS.includes(w.boss), `endless boss wave ${n} missing boss`);
            assert.ok(w.bossHpMult >= 1);
        } else {
            assert.equal(w.boss, null);
            assert.ok(w.spawns.length > 0);
        }
    }
});

test('waves: endless composition is deterministic per wave number', () => {
    const a = getEndlessWave(17);
    const b = getEndlessWave(17);
    assert.deepEqual(a.spawns, b.spawns);
    assert.equal(a.hpMult, b.hpMult);
    assert.equal(a.arena, b.arena);
});

test('waves: victory condition is campaign wave 12 only', () => {
    assert.equal(isCampaignVictoryWave(11, 'campaign'), true);
    assert.equal(isCampaignVictoryWave(10, 'campaign'), false);
    assert.equal(isCampaignVictoryWave(11, 'endless'), false);
    assert.equal(isCampaignVictoryWave(50, 'endless'), false);
});

test('waves: hasNextWave — campaign ends at 12, endless never ends', () => {
    assert.equal(hasNextWave(10, 'campaign'), true);
    assert.equal(hasNextWave(11, 'campaign'), false);
    assert.equal(hasNextWave(11, 'endless'), true);
    assert.equal(hasNextWave(999, 'endless'), true);
});

test('waves: getWave dispatches by mode for the shared index space', () => {
    // endless wave "12" (0-based 11) is sector 12's successor — index maps to 1-based
    const w = getWave(12, 'endless');
    assert.equal(w.endless, true);
    assert.equal(w.arena, 0); // (13-1) % 3
    assert.throws(() => getEndlessWave(12));
});
