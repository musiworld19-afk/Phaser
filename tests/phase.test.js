import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PHASES, otherPhase, isValidPhase, canPlayerHurtEnemy, canEnemyHurtPlayer,
    canCollectMote, destabilizeState, destabilizeDelayFor,
    canSwitchPhase, nextSwitchReadyAt,
} from '../src/game/core/PhaseRules.js';
import { BALANCE } from '../src/game/core/Balance.js';

test('phase: exactly two realities', () => {
    assert.deepEqual([...PHASES], ['cyan', 'amber']);
    assert.equal(otherPhase('cyan'), 'amber');
    assert.equal(otherPhase('amber'), 'cyan');
    assert.ok(isValidPhase('cyan') && isValidPhase('amber'));
    assert.ok(!isValidPhase('white') && !isValidPhase('') && !isValidPhase(null));
});

test('phase: damage matrix is symmetric and consistent', () => {
    // same phase: full interaction both ways
    assert.equal(canPlayerHurtEnemy('cyan', 'cyan'), true);
    assert.equal(canPlayerHurtEnemy('amber', 'amber'), true);
    assert.equal(canEnemyHurtPlayer('cyan', 'cyan'), true);
    assert.equal(canEnemyHurtPlayer('amber', 'amber'), true);
    // cross phase: nothing passes either way
    assert.equal(canPlayerHurtEnemy('cyan', 'amber'), false);
    assert.equal(canPlayerHurtEnemy('amber', 'cyan'), false);
    assert.equal(canEnemyHurtPlayer('cyan', 'amber'), false);
    assert.equal(canEnemyHurtPlayer('amber', 'cyan'), false);
});

test('phase: motes are phase-locked unless PHASE ANCHOR is owned', () => {
    assert.equal(canCollectMote('cyan', 'cyan', false), true);
    assert.equal(canCollectMote('amber', 'amber', false), true);
    assert.equal(canCollectMote('cyan', 'amber', false), false);
    assert.equal(canCollectMote('amber', 'cyan', false), false);
    assert.equal(canCollectMote('cyan', 'amber', true), true);
    assert.equal(canCollectMote('amber', 'cyan', true), true);
});

test('phase: destabilization timeline enforces the anti-camp rule', () => {
    const D = BALANCE.destabilize;
    assert.equal(destabilizeState(0, D.delay, D.telegraph), 'stable');
    assert.equal(destabilizeState(D.delay - 0.01, D.delay, D.telegraph), 'stable');
    assert.equal(destabilizeState(D.delay, D.delay, D.telegraph), 'telegraphing');
    assert.equal(destabilizeState(D.delay + D.telegraph - 0.01, D.delay, D.telegraph), 'telegraphing');
    assert.equal(destabilizeState(D.delay + D.telegraph, D.delay, D.telegraph), 'destabilized');
    assert.equal(destabilizeState(999, D.delay, D.telegraph), 'destabilized');
});

test('phase: destabilizer upgrade extends delay with a floor', () => {
    assert.equal(destabilizeDelayFor(3.0, 2), 5.0);
    assert.equal(destabilizeDelayFor(3.0, 4), 7.0);
    // cannot be reduced below 1s
    assert.equal(destabilizeDelayFor(1.0, -4), 1.0);
});

test('phase: switching is cooldown-gated and atomic', () => {
    // before ready
    assert.equal(canSwitchPhase(5.0, 4.9), false);
    // exactly ready
    assert.equal(canSwitchPhase(5.0, 5.0), true);
    assert.equal(canSwitchPhase(5.0, 6.0), true);
});

test('phase: cooldown has a hard floor (no zero-cooldown exploit)', () => {
    assert.equal(nextSwitchReadyAt(10, 0.3), 10.8);
    assert.equal(nextSwitchReadyAt(10, 1.5), 11.5);
    assert.equal(nextSwitchReadyAt(10, -2), 10.8);
});
