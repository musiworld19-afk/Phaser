// BALANCE: single authoritative source for gameplay tuning.
// Pure data module: no Phaser, no DOM. Unit tests assert structural sanity.

export const BALANCE = {
    world: { width: 1280, height: 720, margin: 30 },

    player: {
        maxHp: 100,
        speed: 340,
        fireRate: 3.2,          // shots per second
        damage: 10,
        range: 560,             // auto-target acquisition radius
        boltSpeed: 640,
        boltLife: 1.15,         // seconds
        spreadPerShot: 0.055,   // radians between multishot bolts
        iFrames: 0.8,           // invulnerability after taking a hit
        switchCooldown: 1.5,    // seconds between phase switches (min clamp 0.8)
        reviveHpFrac: 0.5,      // HP fraction restored by a rewarded revive
        pickupRadius: 24,       // direct contact collect
        magnetRadius: 130,      // motes inside this radius drift to the player
        moteValue: 5,           // score granted per mote
        motesToOverdrive: 36,   // rift meter capacity
        overdriveDuration: 5,
        overdriveFireMult: 2,
        overdriveDamageMult: 1.25,
        critChance: 0.05,
        critDamage: 1.5,
        overloadEvery: 8,       // volleys (0 disables the upgrade)
        overloadDamageMult: 4,
        phaseBladeDamage: 25,
        phaseBladeRadius: 150,
        phaseRushDuration: 1.5,
        phaseRushSpeedMult: 1.6,
        secondWindInvuln: 2,
        secondWindHp: 1,
        aegisRecharge: 12,
        nanoRegenDelay: 4,      // seconds without damage before regen kicks in
        nanoRegenRate: 2,       // HP per second
        knockback: 90,
    },

    // Anti-camp rule: enemies ignored too long in the opposite reality destabilize.
    destabilize: {
        delay: 3.0,             // seconds out-of-phase before telegraph
        telegraph: 0.8,         // white pulse warning duration
        volleyEvery: 2.5,       // seconds between phase-piercing volleys
        boltSpeed: 300,
        boltDamage: 12,
    },

    enemies: {
        drone:    { hp: 20,  speed: 120, contact: 10, score: 20, motes: 1, size: 18 },
        mini:     { hp: 8,   speed: 175, contact: 6,  score: 10, motes: 0, size: 13 },
        lancer:   { hp: 38,  speed: 90,  contact: 14, score: 45, motes: 1, size: 20,
                    dashSpeed: 540, dashRange: 470, telegraph: 0.8, dashCooldown: 2.4 },
        spitter:  { hp: 30,  speed: 70,  contact: 8,  score: 40, motes: 1, size: 18,
                    fireEvery: 1.9, boltSpeed: 260, boltDamage: 10, keepRange: 330 },
        weaver:   { hp: 45,  speed: 115, contact: 10, score: 55, motes: 1, size: 18,
                    fireEvery: 1.7, boltSpeed: 220, boltDamage: 8, orbitRange: 250 },
        bulwark:  { hp: 120, speed: 55,  contact: 16, score: 70, motes: 2, size: 24,
                    shieldArc: 70, shieldReduction: 0.75 },
        splitter: { hp: 50,  speed: 100, contact: 12, score: 50, motes: 1, size: 20 },
        mender:   { hp: 40,  speed: 60,  contact: 8,  score: 65, motes: 1, size: 18,
                    healRange: 320, healRate: 8, keepRange: 380 },
    },

    elite: {
        hpMult: 2.5, speedMult: 1.25, scoreMult: 3, moteMult: 2,
        volleyEvery: 3.2, boltSpeed: 240, boltDamage: 9, scale: 1.3,
    },

    bosses: {
        helix:  { id: 'helix',  name: 'HELIX PRISM',   hp: 1400, score: 1500, contact: 18, size: 150, vulnEvery: 7, arena: 0 },
        magma:  { id: 'magma',  name: 'MAGMA CHOIR',   hp: 2100, score: 2200, contact: 20, size: 160, vulnEvery: 8, arena: 1 },
        keeper: { id: 'keeper', name: 'THE RIFTKEEPER', hp: 3200, score: 3000, contact: 22, size: 170, vulnEvery: 5, arena: 2 },
    },

    run: {
        upgradeChoices: 3,
        waveClearBonus: 150,
        bossMoteBurst: 14,
    },

    hazards: {
        warnTime: 1.0,
        activeTime: 3.6,
        radius: 92,
        damageEvery: 0.5,
        damage: 12,
    },

    limits: {
        maxEnemies: 40,
        maxBolts: 320,
        maxMotes: 120,
        maxHazards: 12,
        dtCap: 0.05, // clamp for big frame spikes
    },
};

export const ENEMY_KINDS = Object.keys(BALANCE.enemies);
export const BOSS_IDS = Object.keys(BALANCE.bosses);
