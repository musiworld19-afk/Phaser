import test from 'node:test';
import assert from 'node:assert/strict';
import { addScore, killScore, bossScore, moteGain, waveClearBonus, formatScore } from '../src/game/systems/ScoreSystem.js';
import { createRunState } from '../src/game/core/RunState.js';
import { BALANCE } from '../src/game/core/Balance.js';

test('score: addScore accumulates, rounds, and ignores junk', () => {
    const run = createRunState('campaign');
    addScore(run, 10.6);
    addScore(run, 5);
    assert.equal(run.score, 16);
    addScore(run, -50); // ignored
    addScore(run, NaN); // ignored
    addScore(run, Infinity); // ignored
    assert.equal(run.score, 16);
});

test('score: score is hard-capped at 1e9', () => {
    const run = createRunState('campaign');
    addScore(run, 2e9);
    assert.equal(run.score, 1e9);
});

test('score: kill scores scale with elite and score multiplier', () => {
    const drone = BALANCE.enemies.drone;
    assert.equal(killScore(drone, false, 1), 20);
    assert.equal(killScore(drone, true, 1), 60); // elite x3
    assert.equal(killScore(drone, false, 1.5), 30); // score matrix x1.5
    assert.equal(killScore(drone, true, 2), 120);
});

test('score: boss scores are defined for all three bosses', () => {
    for (const id of Object.keys(BALANCE.bosses)) {
        const def = BALANCE.bosses[id];
        assert.ok(def.score > 0);
        assert.equal(bossScore(def, 1), def.score);
        assert.ok(bossScore(def, 2) > def.score);
    }
});

test('score: mote value follows upgrades', () => {
    let run = createRunState('campaign');
    assert.equal(moteGain(run.stats), 5);
    run.stats.moteValue *= 1.5; // one mote-lattice stack
    run.stats.scoreMult = 1.25;
    assert.equal(moteGain(run.stats), Math.round(7.5 * 1.25));
});

test('score: wave-clear bonus grows with wave index', () => {
    assert.equal(waveClearBonus(0, 1), BALANCE.run.waveClearBonus);
    assert.ok(waveClearBonus(5, 1) > waveClearBonus(0, 1));
    assert.equal(waveClearBonus(2, 2), Math.round((150 + 50) * 2));
});

test('score: formatScore renders en-US grouping', () => {
    assert.equal(formatScore(1234567), '1,234,567');
    assert.equal(formatScore(0), '0');
});
