// Upgrades: 24 authored choices with validated stacking + application.
// Pure module. apply(stats, run) mutates the run's stats object.

import { recordUpgrade, upgradeCount } from '../core/RunState.js';

// rarity: 'common' | 'rare'. maxStacks: how many times it can be taken per run.
export const UPGRADE_DEFS = [
    // ---- Offense ----
    { id: 'pulse-amp',       name: 'Pulse Amplifier', cat: 'offense', rarity: 'common', maxStacks: 4,
      desc: '+25% bolt damage',
      apply: s => { s.damage *= 1.25; } },
    { id: 'rapid-cycler',     name: 'Rapid Cycler', cat: 'offense', rarity: 'common', maxStacks: 4,
      desc: '+20% fire rate (max 12/s)',
      apply: s => { s.fireRate = Math.min(s.fireRate * 1.2, 12); } },
    { id: 'twin-vector',      name: 'Twin Vector', cat: 'offense', rarity: 'common', maxStacks: 2,
      desc: '+1 bolt per volley',
      apply: s => { s.projectiles += 1; } },
    { id: 'lance-rounds',     name: 'Lance Rounds', cat: 'offense', rarity: 'common', maxStacks: 2,
      desc: 'Bolts pierce 1 extra enemy',
      apply: s => { s.pierce += 1; } },
    { id: 'ricochet-field',   name: 'Ricochet Field', cat: 'offense', rarity: 'rare', maxStacks: 1,
      desc: 'Bolts ricochet once toward the nearest enemy',
      apply: s => { s.ricochet = true; } },
    { id: 'seeker-core',      name: 'Seeker Core', cat: 'offense', rarity: 'common', maxStacks: 2,
      desc: 'Bolts home in on enemies (stronger when stacked)',
      apply: s => { s.homing = Math.min(s.homing + 1, 2); } },
    { id: 'crit-lens',        name: 'Critical Lens', cat: 'offense', rarity: 'common', maxStacks: 3,
      desc: '+10% critical chance',
      apply: s => { s.critChance = Math.min(s.critChance + 0.10, 0.45); } },
    { id: 'crit-overload',    name: 'Crit Overload', cat: 'offense', rarity: 'common', maxStacks: 2,
      desc: '+75% critical damage',
      apply: s => { s.critDamage += 0.75; } },
    { id: 'overload-cascade', name: 'Overload Cascade', cat: 'offense', rarity: 'rare', maxStacks: 1,
      desc: 'Every 8th volley fires a heavy bolt',
      apply: s => { s.overloadEvery = 8; } },
    { id: 'harmonic-slow',    name: 'Harmonic Slow', cat: 'offense', rarity: 'rare', maxStacks: 1,
      desc: 'Hits slow enemies by 30% for 1s',
      apply: s => { s.slowOnHit = true; } },

    // ---- Mobility ----
    { id: 'ion-thrusters',   name: 'Ion Thrusters', cat: 'mobility', rarity: 'common', maxStacks: 3,
      desc: '+12% movement speed',
      apply: s => { s.moveSpeed *= 1.12; } },
    { id: 'phase-rush',       name: 'Phase Rush', cat: 'mobility', rarity: 'rare', maxStacks: 1,
      desc: 'Switching reality grants +60% speed for 1.5s',
      apply: s => { s.phaseRush = true; } },
    { id: 'flux-capacitor',   name: 'Flux Capacitor', cat: 'mobility', rarity: 'common', maxStacks: 2,
      desc: '-25% reality-switch cooldown (min 0.8s)',
      apply: s => { s.switchCooldown = Math.max(0.8, s.switchCooldown * 0.75); } },

    // ---- Defense ----
    { id: 'barrier-core',     name: 'Barrier Core', cat: 'defense', rarity: 'common', maxStacks: 3,
      desc: '+30 max HP and restore 30 HP',
      apply: (s, run) => { s.maxHp += 30; run.hp = Math.min(run.hp + 30, s.maxHp); } },
    { id: 'nano-repair',      name: 'Nano Repair', cat: 'defense', rarity: 'rare', maxStacks: 1,
      desc: 'Regenerate 2 HP/s after 4s without damage',
      apply: s => { s.nanoRegen = true; } },
    { id: 'aegis-shell',      name: 'Aegis Shell', cat: 'defense', rarity: 'rare', maxStacks: 1,
      desc: 'A shield absorbs one hit, recharges in 12s',
      apply: (s, run) => { s.aegis = true; run.shield = 1; } },
    { id: 'second-wind',       name: 'Second Wind', cat: 'defense', rarity: 'rare', maxStacks: 1,
      desc: 'Survive one fatal hit per run (1 HP, brief invulnerability)',
      apply: s => { s.secondWind = true; } },

    // ---- Economy ----
    { id: 'mote-lattice',     name: 'Mote Lattice', cat: 'economy', rarity: 'common', maxStacks: 2,
      desc: '+50% energy mote value',
      apply: s => { s.moteValue *= 1.5; } },
    { id: 'tractor-field',    name: 'Tractor Field', cat: 'economy', rarity: 'common', maxStacks: 2,
      desc: '+80% mote magnet radius',
      apply: s => { s.magnetRadius *= 1.8; } },
    { id: 'surplus-core',     name: 'Surplus Core', cat: 'economy', rarity: 'common', maxStacks: 2,
      desc: '25% chance defeated enemies drop a bonus mote',
      apply: s => { s.moteBonusChance = Math.min(s.moteBonusChance + 0.25, 0.5); } },

    // ---- Phase ----
    { id: 'phase-anchor',     name: 'Phase Anchor', cat: 'phase', rarity: 'rare', maxStacks: 1,
      desc: 'Collect motes from the opposite reality',
      apply: s => { s.phaseAnchor = true; } },
    { id: 'phase-blade',      name: 'Phase Blade', cat: 'phase', rarity: 'rare', maxStacks: 1,
      desc: 'Switching reality releases a damaging shockwave',
      apply: s => { s.phaseBlade = true; } },
    { id: 'destabilizer',     name: 'Destabilizer', cat: 'phase', rarity: 'common', maxStacks: 2,
      desc: 'Enemies take 2s longer to destabilize',
      apply: s => { s.destabilizeExtra += 2; } },

    // ---- Utility ----
    { id: 'score-matrix',    name: 'Score Matrix', cat: 'utility', rarity: 'common', maxStacks: 3,
      desc: '+25% score from all sources',
      apply: s => { s.scoreMult *= 1.25; } },
];

export const UPGRADE_CATEGORIES = ['offense', 'mobility', 'defense', 'economy', 'phase', 'utility'];

const byId = new Map(UPGRADE_DEFS.map(d => [d.id, d]));

export function getUpgradeDef(id) {
    return byId.get(id);
}

export function isAvailable(def, takenCounts) {
    return (takenCounts[def.id] || 0) < def.maxStacks;
}

// Offer `count` distinct choices. rareBoost (post-boss waves) raises rare odds
// and guarantees at least one rare when one is available.
export function rollUpgrades(takenCounts, { count = 3, rareBoost = false, rng = Math.random } = {}) {
    const pool = UPGRADE_DEFS.filter(d => isAvailable(d, takenCounts));
    const pickWeight = def => (def.rarity === 'rare' ? (rareBoost ? 0.9 : 0.45) : 1);
    const picks = [];
    const candidates = [...pool];
    while (picks.length < count && candidates.length > 0) {
        const total = candidates.reduce((sum, d) => sum + pickWeight(d), 0);
        let roll = rng() * total;
        let chosenIdx = candidates.length - 1;
        for (let i = 0; i < candidates.length; i++) {
            roll -= pickWeight(candidates[i]);
            if (roll <= 0) { chosenIdx = i; break; }
        }
        picks.push(candidates[chosenIdx]);
        candidates.splice(chosenIdx, 1);
    }
    if (rareBoost && picks.length > 0 && !picks.some(d => d.rarity === 'rare')) {
        const rare = pool.find(d => d.rarity === 'rare' && !picks.includes(d));
        if (rare) picks[0] = rare;
    }
    return picks;
}

// Validated application: refuses unknown ids and over-stacked picks.
export function applyUpgrade(run, id) {
    const def = byId.get(id);
    if (!def) throw new Error(`applyUpgrade: unknown upgrade "${id}"`);
    const taken = upgradeCount(run, id);
    if (taken >= def.maxStacks) {
        return false; // caller must not have offered this
    }
    def.apply(run.stats, run);
    recordUpgrade(run, id);
    return true;
}

// Structural validation (unit tests).
export function validateUpgradeDefs() {
    const errors = [];
    const ids = new Set();
    if (UPGRADE_DEFS.length < 20) errors.push(`expected at least 20 upgrades, found ${UPGRADE_DEFS.length}`);
    for (const def of UPGRADE_DEFS) {
        if (!def.id) errors.push('upgrade missing id');
        if (ids.has(def.id)) errors.push(`duplicate upgrade id ${def.id}`);
        ids.add(def.id);
        if (!def.name) errors.push(`${def.id}: missing name`);
        if (!def.desc) errors.push(`${def.id}: missing description`);
        if (!UPGRADE_CATEGORIES.includes(def.cat)) errors.push(`${def.id}: bad category ${def.cat}`);
        if (!['common', 'rare'].includes(def.rarity)) errors.push(`${def.id}: bad rarity ${def.rarity}`);
        if (!Number.isInteger(def.maxStacks) || def.maxStacks < 1) errors.push(`${def.id}: bad maxStacks`);
        if (typeof def.apply !== 'function') errors.push(`${def.id}: apply not a function`);
    }
    return errors;
}
