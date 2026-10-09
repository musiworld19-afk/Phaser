// ScoreSystem: pure scoring rules. All amounts validated/bounded.

import { BALANCE } from '../core/Balance.js';

const MAX_SCORE = 1e9;

export function addScore(run, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return run.score;
    run.score = Math.min(MAX_SCORE, Math.round(run.score + amount));
    return run.score;
}

export function killScore(enemyDef, isElite, scoreMult) {
    const base = enemyDef.score * (isElite ? BALANCE.elite.scoreMult : 1);
    return Math.max(0, Math.round(base * scoreMult));
}

export function bossScore(bossDef, scoreMult) {
    return Math.max(0, Math.round(bossDef.score * scoreMult));
}

export function moteGain(stats) {
    return Math.max(0, Math.round(stats.moteValue * stats.scoreMult));
}

export function waveClearBonus(waveIndexZero, scoreMult) {
    const base = BALANCE.run.waveClearBonus + waveIndexZero * 25;
    return Math.max(0, Math.round(base * scoreMult));
}

export function formatScore(n) {
    return Math.round(n).toLocaleString('en-US');
}
