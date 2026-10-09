// CombatRules: pure damage resolution shared by entities and tests.

export function rollDamage(stats, rng = Math.random, overdriveMult = 1) {
    const crit = rng() < stats.critChance;
    const critMult = crit ? stats.critDamage : 1;
    const value = stats.damage * critMult * overdriveMult;
    return { value, crit };
}

// Bulwark shield: frontal damage reduction within its shield arc.
// hitAngleDeg: angle from bulwark center to the incoming bolt, in bulwark-local degrees.
export function bulwarkReduction(hitAngleDeg, shieldArcDeg, reduction) {
    const diff = normalizeAngleDiff(hitAngleDeg);
    return Math.abs(diff) <= shieldArcDeg / 2 ? reduction : 0;
}

export function normalizeAngleDiff(deg) {
    let d = deg % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

export function iFrameProtected(lastHitAt, now, iFrames) {
    return now - lastHitAt < iFrames;
}

// Resolve one incoming hit against the player.
// Order: aegis shield absorbs the full hit; then HP; then Second Wind once.
// Idempotent per hit event: callers invoke this exactly once per impact.
export function resolvePlayerHit({ hp, shield, hasSecondWind, secondWindUsed }, rawDamage) {
    const result = { hp, shield, usedShield: false, usedSecondWind: false, survived: true };
    const dmg = Math.max(0, rawDamage);

    if (dmg <= 0) return result;

    if (shield > 0) {
        result.shield = 0;
        result.usedShield = true;
        return result; // shield absorbs everything
    }

    result.hp = hp - dmg;
    if (result.hp <= 0) {
        if (hasSecondWind && !secondWindUsed) {
            result.hp = 1;
            result.usedSecondWind = true;
        } else {
            result.hp = 0;
            result.survived = false;
        }
    }
    return result;
}

// Enemy death is rewarded exactly once; the dead flag guards double rewards.
export function shouldRewardDeath(alreadyRewarded) {
    return !alreadyRewarded;
}
