// RunState: per-run mutable state. Created fresh each run; never persisted
// directly (records flow through SaveSystem instead).

import { BALANCE } from './Balance.js';

export const RUN_MODES = Object.freeze(['campaign', 'endless']);

export function defaultPlayerStats() {
    const P = BALANCE.player;
    return {
        damage: P.damage,
        fireRate: P.fireRate,
        projectiles: 1,
        pierce: 0,
        ricochet: false,
        homing: 0,             // 0 = none; 1..2 homing strength tiers
        critChance: P.critChance,
        critDamage: P.critDamage,
        overloadEvery: 0,       // 0 = disabled
        slowOnHit: false,
        moveSpeed: P.speed,
        maxHp: P.maxHp,
        switchCooldown: P.switchCooldown,
        phaseRush: false,
        phaseBlade: false,
        phaseAnchor: false,
        destabilizeExtra: 0,
        moteValue: P.moteValue,
        magnetRadius: P.magnetRadius,
        moteBonusChance: 0,
        scoreMult: 1,
        secondWind: false,
        aegis: false,
        nanoRegen: false,
    };
}

export function createRunState(mode, opts = {}) {
    if (!RUN_MODES.includes(mode)) {
        throw new Error(`createRunState: invalid mode "${mode}"`);
    }
    const stats = defaultPlayerStats();
    return {
        mode,
        waveIndex: 0,                    // 0-based
        phase: opts.startPhase || 'cyan',
        score: 0,
        motes: 0,                        // motes collected this run
        kills: 0,
        rift: 0,                         // 0..motesToOverdrive
        overdriveUntil: -Infinity,       // seconds (run clock)
        hp: stats.maxHp,
        shield: 0,                       // aegis charge: 0 or 1
        lastHitAt: -Infinity,
        lastRegenCheck: 0,
        switchReadyAt: 0,
        runTime: 0,                      // seconds of active gameplay (excludes pauses)
        stats,
        upgradesTaken: [],
        upgradeCounts: {},
        secondWindUsed: false,
        reviveUsed: false,               // rewarded Second Chance used
        bossActive: false,
    };
}

export function waveNumber(run) {
    return run.waveIndex + 1;
}

export function isEndless(run) {
    return run.mode === 'endless';
}

// Track an upgrade pick (idempotence handled by UpgradeSystem before calling this).
export function recordUpgrade(run, id) {
    run.upgradesTaken.push(id);
    run.upgradeCounts[id] = (run.upgradeCounts[id] || 0) + 1;
}

export function upgradeCount(run, id) {
    return run.upgradeCounts[id] || 0;
}
