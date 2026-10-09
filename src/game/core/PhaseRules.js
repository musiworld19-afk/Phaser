// PhaseRules: the reality-switching rule set. Pure functions, unit tested.
//
// Core contract:
// - Entities (enemies, bolts, motes, hazards) belong to exactly one reality.
// - Interaction happens ONLY when the player shares that reality:
//     * player bolts damage same-reality enemies only
//     * enemy bolts / contact damage same-reality players only
//     * motes are collectable in their own reality (unless PHASE ANCHOR)
// - Destabilization: ignored (out-of-phase) enemies eventually telegraph and
//   fire phase-piercing volleys that ignore the reality rule. This is the
//   anti-camp pressure that makes switching tactically required.

export const PHASES = Object.freeze(['cyan', 'amber']);

export function otherPhase(phase) {
    return phase === 'cyan' ? 'amber' : 'cyan';
}

export function isValidPhase(p) {
    return p === 'cyan' || p === 'amber';
}

export function canPlayerHurtEnemy(enemyPhase, playerPhase) {
    return enemyPhase === playerPhase;
}

export function canEnemyHurtPlayer(enemyPhase, playerPhase) {
    return enemyPhase === playerPhase;
}

export function canCollectMote(motePhase, playerPhase, hasPhaseAnchor = false) {
    return hasPhaseAnchor || motePhase === playerPhase;
}

// Destabilization timeline for an enemy.
// outOfPhaseTime: seconds continuously spent in the opposite reality of the player.
// Returns: 'stable' | 'telegraphing' | 'destabilized'
export function destabilizeState(outOfPhaseTime, delay, telegraph) {
    if (outOfPhaseTime >= delay + telegraph) return 'destabilized';
    if (outOfPhaseTime >= delay) return 'telegraphing';
    return 'stable';
}

export function destabilizeDelayFor(baseDelay, extraSeconds) {
    return Math.max(1, baseDelay + extraSeconds);
}

// Switch cooldown resolution: switching is atomic at the moment of the press.
// There is never a "between phases" state that grants invulnerability.
export function canSwitchPhase(switchReadyAt, now) {
    return now >= switchReadyAt;
}

export function nextSwitchReadyAt(now, cooldownSeconds) {
    const cd = Math.max(0.8, cooldownSeconds);
    return now + cd;
}
