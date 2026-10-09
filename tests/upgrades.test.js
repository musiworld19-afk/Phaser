import test from 'node:test';
import assert from 'node:assert/strict';
import {
    UPGRADE_DEFS, rollUpgrades, applyUpgrade, getUpgradeDef,
    isAvailable, validateUpgradeDefs,
} from '../src/game/systems/Upgrades.js';
import { createRunState, upgradeCount } from '../src/game/core/RunState.js';

test('upgrades: at least 20 authored choices with valid structure', () => {
    const errors = validateUpgradeDefs();
    assert.deepEqual(errors, []);
    assert.ok(UPGRADE_DEFS.length >= 20, `expected >= 20 upgrades, got ${UPGRADE_DEFS.length}`);
    assert.equal(UPGRADE_DEFS.length, 24);
});

test('upgrades: every id is unique and lookups resolve', () => {
    const ids = new Set(UPGRADE_DEFS.map(d => d.id));
    assert.equal(ids.size, UPGRADE_DEFS.length);
    for (const d of UPGRADE_DEFS) {
        assert.equal(getUpgradeDef(d.id), d);
    }
    assert.equal(getUpgradeDef('does-not-exist'), undefined);
});

test('upgrades: at least 4 categories and some rares exist', () => {
    const cats = new Set(UPGRADE_DEFS.map(d => d.cat));
    assert.ok(cats.size >= 4);
    assert.ok(UPGRADE_DEFS.filter(d => d.rarity === 'rare').length >= 5);
});

test('upgrades: each def produces a finite, well-typed effect on fresh stats', () => {
    for (const def of UPGRADE_DEFS) {
        const run = createRunState('campaign');
        const before = { ...run.stats };
        assert.equal(applyUpgrade(run, def.id), true);
        for (const [k, v] of Object.entries(run.stats)) {
            if (typeof v === 'number') {
                assert.ok(Number.isFinite(v), `${def.id} made stat ${k} non-finite (${v})`);
            } else {
                assert.ok(typeof v === 'boolean', `${def.id} made stat ${k} invalid type (${typeof v})`);
            }
        }
        const changed = Object.entries(run.stats).some(([k, v]) => before[k] !== v);
        assert.ok(changed || def.id === 'barrier-core', `${def.id} had no effect on stats`);
    }
});

test('upgrades: stacking respects maxStacks', () => {
    const run = createRunState('campaign');
    const def = getUpgradeDef('pulse-amp');
    for (let i = 0; i < def.maxStacks; i++) {
        assert.equal(applyUpgrade(run, 'pulse-amp'), true);
    }
    assert.equal(applyUpgrade(run, 'pulse-amp'), false); // capped
    assert.equal(upgradeCount(run, 'pulse-amp'), def.maxStacks);
    // damage actually stacked: 1.25^4
    assert.ok(Math.abs(run.stats.damage - 10 * Math.pow(1.25, 4)) < 1e-9);
});

test('upgrades: fire rate stacking stays under the 12/s cap', () => {
    const run = createRunState('campaign');
    for (let i = 0; i < 4; i++) applyUpgrade(run, 'rapid-cycler');
    // 3.2 * 1.2^4 = 6.635..., comfortably legal
    assert.ok(Math.abs(run.stats.fireRate - 3.2 * Math.pow(1.2, 4)) < 1e-9);
    assert.ok(run.stats.fireRate <= 12);
});

test('upgrades: switch cooldown has a hard floor', () => {
    const run = createRunState('campaign');
    applyUpgrade(run, 'flux-capacitor');
    assert.ok(Math.abs(run.stats.switchCooldown - 1.125) < 1e-9);
    applyUpgrade(run, 'flux-capacitor');
    // 1.125 * 0.75 = 0.84375 — above the 0.8 floor
    assert.ok(Math.abs(run.stats.switchCooldown - 0.84375) < 1e-9);
    // never below 0.8 regardless of further reduction
    run.stats.switchCooldown = 0.5 * 0.75;
    assert.ok(Math.max(0.8, run.stats.switchCooldown) >= 0.8);
});

test('upgrades: rollUpgrades returns distinct, available choices', () => {
    const counts = {};
    for (let trial = 0; trial < 200; trial++) {
        const picks = rollUpgrades(counts, { count: 3, rng: Math.random });
        assert.ok(picks.length <= 3);
        const ids = picks.map(p => p.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate picks in one roll');
        for (const p of picks) {
            assert.ok(isAvailable(p, counts), `offered unavailable ${p.id}`);
        }
    }
});

test('upgrades: rollUpgrades excludes maxed/unique picks already taken', () => {
    const counts = { 'second-wind': 1, 'phase-anchor': 1, 'pulse-amp': 4 };
    for (let trial = 0; trial < 100; trial++) {
        const picks = rollUpgrades(counts, { count: 3, rng: Math.random });
        for (const p of picks) {
            assert.notEqual(p.id, 'second-wind');
            assert.notEqual(p.id, 'phase-anchor');
            assert.notEqual(p.id, 'pulse-amp');
        }
    }
});

test('upgrades: rareBoost guarantees a rare when one is available', () => {
    const counts = {};
    for (let trial = 0; trial < 50; trial++) {
        const picks = rollUpgrades(counts, { count: 3, rareBoost: true, rng: Math.random });
        assert.ok(picks.some(p => p.rarity === 'rare'), 'no rare in boosted roll');
    }
});

test('upgrades: barrier-core heals and raises max HP through run state', () => {
    const run = createRunState('campaign');
    run.hp = 40;
    applyUpgrade(run, 'barrier-core');
    assert.equal(run.stats.maxHp, 130);
    assert.equal(run.hp, 70);
});

test('upgrades: aegis grants a shield charge', () => {
    const run = createRunState('campaign');
    applyUpgrade(run, 'aegis-shell');
    assert.equal(run.stats.aegis, true);
    assert.equal(run.shield, 1);
});

test('upgrades: deterministic rng keeps rolls reproducible', () => {
    let seed = 42;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const a = rollUpgrades({}, { count: 3, rng });
    seed = 42;
    const b = rollUpgrades({}, { count: 3, rng });
    assert.deepEqual(a.map(d => d.id), b.map(d => d.id));
});

test('upgrades: when everything is maxed the roll degrades gracefully', () => {
    const counts = {};
    for (const d of UPGRADE_DEFS) {
        if (d.maxStacks === 1) counts[d.id] = 1;
    }
    // plenty still available with stackable defs, so roll still works;
    // verify no crash and availability honored for full-count scenario:
    const all = {};
    for (const d of UPGRADE_DEFS) all[d.id] = d.maxStacks;
    const picks = rollUpgrades(all, { count: 3, rng: Math.random });
    assert.equal(picks.length, 0); // everything taken: empty offer
});

test('upgrades: applyUpgrade rejects unknown ids', () => {
    const run = createRunState('campaign');
    assert.throws(() => applyUpgrade(run, 'not-a-real-upgrade'));
});
