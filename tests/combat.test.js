import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayerHit, rollDamage, bulwarkReduction, normalizeAngleDiff, iFrameProtected, shouldRewardDeath } from '../src/game/core/CombatRules.js';
import { createRunState } from '../src/game/core/RunState.js';
import { BALANCE } from '../src/game/core/Balance.js';

test('combat: plain hit reduces HP', () => {
    const res = resolvePlayerHit({ hp: 100, shield: 0, hasSecondWind: false, secondWindUsed: false }, 30);
    assert.deepEqual(res, { hp: 70, shield: 0, usedShield: false, usedSecondWind: false, survived: true });
});

test('combat: aegis shield absorbs the full hit and breaks', () => {
    const res = resolvePlayerHit({ hp: 100, shield: 1, hasSecondWind: true, secondWindUsed: false }, 60);
    assert.equal(res.hp, 100);
    assert.equal(res.shield, 0);
    assert.equal(res.usedShield, true);
    assert.equal(res.survived, true);
});

test('combat: second wind survives exactly one fatal hit per run', () => {
    const first = resolvePlayerHit({ hp: 5, shield: 0, hasSecondWind: true, secondWindUsed: false }, 40);
    assert.equal(first.hp, 1);
    assert.equal(first.usedSecondWind, true);
    assert.equal(first.survived, true);
    const second = resolvePlayerHit({ hp: 1, shield: 0, hasSecondWind: true, secondWindUsed: true }, 10);
    assert.equal(second.survived, false);
    assert.equal(second.hp, 0);
});

test('combat: fatal hit without second wind dies', () => {
    const res = resolvePlayerHit({ hp: 10, shield: 0, hasSecondWind: false, secondWindUsed: false }, 999);
    assert.equal(res.survived, false);
    assert.equal(res.hp, 0);
});

test('combat: negative and zero damage never heals or kills', () => {
    const res = resolvePlayerHit({ hp: 50, shield: 0, hasSecondWind: false, secondWindUsed: false }, -20);
    assert.equal(res.hp, 50);
    assert.equal(res.survived, true);
});

test('combat: damage rolls respect crit chance and multiplier', () => {
    const stats = { damage: 10, critChance: 1.0, critDamage: 2 }; // always crit
    const res = rollDamage(stats, Math.random, 1);
    assert.equal(res.crit, true);
    assert.equal(res.value, 20);
    const never = rollDamage({ damage: 10, critChance: 0, critDamage: 9 }, Math.random, 2);
    assert.equal(never.crit, false);
    assert.equal(never.value, 20); // overdrive multiplier applies
});

test('combat: bulwark shield reduces frontal damage only within its arc', () => {
    const arc = 70, red = 0.75;
    assert.equal(bulwarkReduction(0, arc, red), 0.75);
    assert.equal(bulwarkReduction(30, arc, red), 0.75);
    assert.equal(bulwarkReduction(-30, arc, red), 0.75);
    assert.equal(bulwarkReduction(40, arc, red), 0);
    assert.equal(bulwarkReduction(180, arc, red), 0);
});

test('combat: normalizeAngleDiff wraps to [-180, 180]', () => {
    assert.equal(normalizeAngleDiff(190), -170);
    assert.equal(normalizeAngleDiff(-190), 170);
    assert.equal(normalizeAngleDiff(360), 0);
    assert.equal(normalizeAngleDiff(720 + 45), 45);
});

test('combat: i-frames protect only inside the window', () => {
    const i = BALANCE.player.iFrames;
    assert.equal(iFrameProtected(10, 10 + i - 0.01, i), true);
    assert.equal(iFrameProtected(10, 10 + i, i), false);
    assert.equal(iFrameProtected(10, 10 + i + 5, i), false);
});

test('combat: death rewards fire exactly once (idempotence contract)', () => {
    // shouldRewardDeath is the guard used by Enemy.die()
    assert.equal(shouldRewardDeath(false), true);
    assert.equal(shouldRewardDeath(true), false);
});

test('combat: run state has sane defaults and bounded stats', () => {
    const run = createRunState('campaign');
    assert.equal(run.hp, run.stats.maxHp);
    assert.equal(run.stats.maxHp, BALANCE.player.maxHp);
    assert.ok(run.stats.fireRate > 0 && run.stats.fireRate <= 12);
    assert.ok(run.stats.moveSpeed > 0);
    assert.equal(run.upgradesTaken.length, 0);
    assert.equal(run.secondWindUsed, false);
    assert.equal(run.reviveUsed, false);
    assert.throws(() => createRunState('bogus-mode'));
});
