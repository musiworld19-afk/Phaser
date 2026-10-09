// Enemy: seven archetypes x two realities, plus elite variants and the
// destabilization anti-camp system. Death rewards are idempotent (guarded by
// this.dead). All timing is delta-time based.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE } from '../core/Palette.js';
import { destabilizeState, destabilizeDelayFor } from '../core/PhaseRules.js';
import { bulwarkReduction, normalizeAngleDiff } from '../core/CombatRules.js';

const D = BALANCE.destabilize;

export class Enemy extends Phaser.GameObjects.Image {
    constructor(scene) {
        super(scene, 0, 0, '__DEFAULT');
        this.setActive(false).setVisible(false);
        this.setDepth(15);
        this.kind = null;
        this.phase = 'cyan';
        this.dead = true;
    }

    spawn(kind, phase, x, y, { elite = false, hpMult = 1, speedMult = 1 } = {}) {
        this.kind = kind;
        this.phase = phase;
        this.def = BALANCE.enemies[kind];
        this.elite = elite;
        const e = BALANCE.elite;

        const baseHp = this.def.hp * (elite ? e.hpMult : 1) * hpMult;
        this.hp = baseHp;
        this.maxHp = baseHp;
        this.speed = this.def.speed * (elite ? e.speedMult : 1) * speedMult;
        this.hitRadius = this.def.size * 0.8 * (elite ? e.scale : 1);

        this.dead = false;
        this.splitted = false;
        this.outOfPhaseTime = 0;
        this.destabVolleyAt = 0;
        this.destabAnnounced = false;
        this.slowUntil = 0;
        this.slowFactor = 1;

        // per-kind behavior state
        this.t = Math.random() * 10;
        this.state = 'approach';
        this.stateT = 0;
        this.dashTarget = null;
        this.fireAt = 1 + Math.random() * 0.8;
        this.orbitDir = Math.random() < 0.5 ? 1 : -1;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.facing = 0;

        const texKey = kind === 'mini' ? `drone-${phase}` : `${kind}-${phase}`;
        this.setTexture(texKey);
        const frame = this.scene.textures.getFrame(texKey);
        const display = this.def.size * 2 * (elite ? e.scale : 1) * (kind === 'mini' ? 0.62 : 1);
        this.setDisplaySize(display, display);

        this.setPosition(x, y);
        this.setActive(true).setVisible(true);
        this.setAlpha(1).clearTint();

        if (elite) {
            if (!this.crest) {
                this.crest = this.scene.add.image(x, y, 'elite-crest').setDepth(16);
            }
            this.crest.setVisible(true).setPosition(x, y - display * 0.62);
        } else if (this.crest) {
            this.crest.setVisible(false);
        }

        if (!this.marker) {
            this.marker = this.scene.add.image(x, y, 'glyph-diamond').setDepth(16);
        }
        this.markerKey = '';
        return this;
    }

    despawn() {
        this.dead = true;
        this.setActive(false).setVisible(false);
        this.crest?.setVisible(false);
        this.marker?.setVisible(false);
    }

    get isOutOfPhase() {
        return this._worldPhase !== undefined && this._worldPhase !== this.phase;
    }

    update(dt, world) {
        if (this.dead) return;
        const run = world.run;
        const player = world.player;
        this._worldPhase = run.phase;
        this.t += dt;
        this.stateT += dt;

        // slow-on-hit
        const slowed = run.runTime < this.slowUntil ? this.slowFactor : 1;
        const speed = this.speed * slowed;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        switch (this.kind) {
            case 'drone': case 'mini':
                this.moveToward(player.x, player.y, speed, dt, dist);
                break;
            case 'splitter':
                this.moveToward(player.x, player.y, speed, dt, dist, Math.sin(this.t * 3) * 40);
                break;
            case 'lancer':
                this.updateLancer(dt, world, speed, dist);
                break;
            case 'spitter':
                this.updateKeeper(dt, world, speed, dist);
                break;
            case 'weaver':
                this.updateWeaver(dt, world, speed);
                break;
            case 'bulwark':
                this.moveToward(player.x, player.y, speed, dt, dist);
                this.facing = Math.atan2(dy, dx);
                break;
            case 'mender':
                this.updateMender(dt, world, speed, dist);
                break;
        }

        // Elite homing volley
        if (this.elite) {
            this.fireAt -= dt;
            if (this.fireAt <= 0) {
                this.fireAt = BALANCE.elite.volleyEvery * (0.85 + Math.random() * 0.3);
                this.fireHomingVolley(world);
            }
        }

        this.updateDestabilize(dt, world);

        // Ghost visuals when out of phase + phase marker glyph
        const oop = this.isOutOfPhase;
        const destab = this.destab;
        if (destab === 'telegraphing') {
            const pulse = Math.sin(this.t * 26) > 0;
            this.setTintMode(Phaser.TintModes.FILL);
            this.setTint(pulse ? 0xffffff : 0x777777);
            this.setAlpha(0.75);
        } else if (destab === 'destabilized') {
            this.setTintMode(Phaser.TintModes.FILL);
            this.setTint(Math.sin(this.t * 34) > 0 ? 0xffffff : this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber);
            this.setAlpha(0.85);
        } else if (oop) {
            this.clearTint();
            this.setAlpha(0.38 + 0.08 * Math.sin(this.t * 5));
        } else {
            this.clearTint();
            this.setAlpha(1);
        }

        if (this.marker) {
            const showMarker = oop || destab !== 'stable';
            const key = this.phase === 'cyan' ? 'glyph-diamond' : 'glyph-circle';
            if (key !== this.markerKey) {
                this.markerKey = key;
                this.marker.setTexture(key);
            }
            this.marker.setVisible(showMarker)
                .setPosition(this.x, this.y - this.displayHeight * 0.55 - 14)
                .setAlpha(showMarker ? 0.95 : 0)
                .setTint(destab === 'stable' ? (this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber) : 0xffffff)
                .setScale(destab === 'stable' ? 1 : 1.35);
        }
        if (this.crest) {
            this.crest.setPosition(this.x, this.y - this.displayHeight * 0.62);
        }

        // Contact damage (same-phase only) — checked here to stay idempotent
        if (!oop && dist < this.hitRadius + 16) {
            world.contactHit(this, this.def.contact * (this.elite ? 1.4 : 1), dt);
        }
    }

    moveToward(tx, ty, speed, dt, dist, lateral = 0) {
        if (dist < 1) return;
        const nx = (tx - this.x) / dist;
        const ny = (ty - this.y) / dist;
        const px = -ny, py = nx;
        const vx = nx * speed + px * lateral;
        const vy = ny * speed + py * lateral;
        this.x += vx * dt;
        this.y += vy * dt;
    }

    updateLancer(dt, world, speed, dist) {
        const player = world.player;
        switch (this.state) {
            case 'approach':
                this.moveToward(player.x, player.y, speed, dt, dist);
                if (dist < this.def.dashRange * 0.85) {
                    this.state = 'telegraph';
                    this.stateT = 0;
                    this.dashTarget = { x: player.x, y: player.y };
                    world.fx.telegraph(
                        this.x, this.y, this.dashTarget.x, this.dashTarget.y,
                        this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber,
                        this.def.telegraph * 1000
                    );
                }
                break;
            case 'telegraph':
                this.facing = Math.atan2(this.dashTarget.y - this.y, this.dashTarget.x - this.x);
                this.x += Math.sin(this.t * 60) * 0.8;
                if (this.stateT >= this.def.telegraph) {
                    this.state = 'dash';
                    this.stateT = 0;
                }
                break;
            case 'dash': {
                const d = Math.hypot(this.dashTarget.x - this.x, this.dashTarget.y - this.y);
                if (d < 14 || this.stateT > 1.2) {
                    this.state = 'rest';
                    this.stateT = 0;
                } else {
                    const step = this.def.dashSpeed * dt;
                    this.x += (this.dashTarget.x - this.x) / d * step;
                    this.y += (this.dashTarget.y - this.y) / d * step;
                }
                break;
            }
            case 'rest':
                if (this.stateT >= this.def.dashCooldown) {
                    this.state = 'approach';
                    this.stateT = 0;
                }
                break;
        }
    }

    updateKeeper(dt, world, speed, dist) {
        const player = world.player;
        const keep = this.def.keepRange;
        if (Math.abs(dist - keep) > 26) {
            const dir = dist > keep ? 1 : -0.6;
            this.moveToward(player.x, player.y, speed * dir, dt, dist);
        } else {
            // strafe
            const nx = (player.x - this.x) / (dist || 1);
            const ny = (player.y - this.y) / (dist || 1);
            this.x += -ny * speed * 0.5 * this.orbitDir * dt;
            this.y += nx * speed * 0.5 * this.orbitDir * dt;
        }
        this.fireAt -= dt;
        if (this.fireAt <= 0 && dist < 640) {
            this.fireAt = this.def.fireEvery * (0.85 + Math.random() * 0.3);
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            world.spawnEnemyBolt(this.x, this.y, a, {
                phase: this.phase, speed: this.def.boltSpeed, damage: this.def.boltDamage,
            });
            world.ctx.audio.play('enemyShoot');
        }
    }

    updateWeaver(dt, world, speed) {
        const player = world.player;
        this.orbitAngle += (speed / this.def.orbitRange) * this.orbitDir * dt;
        const tx = player.x + Math.cos(this.orbitAngle) * this.def.orbitRange;
        const ty = player.y + Math.sin(this.orbitAngle) * this.def.orbitRange;
        const d = Math.hypot(tx - this.x, ty - this.y);
        if (d > 1) {
            const step = Math.min(speed * 1.6 * dt, d);
            this.x += (tx - this.x) / d * step;
            this.y += (ty - this.y) / d * step;
        }
        this.fireAt -= dt;
        if (this.fireAt <= 0) {
            this.fireAt = this.def.fireEvery * (0.85 + Math.random() * 0.3);
            const base = this.orbitAngle + Math.PI;
            for (const off of [0, Math.PI]) {
                world.spawnEnemyBolt(this.x, this.y, base + off, {
                    phase: this.phase, speed: this.def.boltSpeed, damage: this.def.boltDamage,
                });
            }
            world.ctx.audio.play('enemyShoot');
        }
    }

    updateMender(dt, world, speed, dist) {
        const player = world.player;
        const keep = this.def.keepRange;
        if (dist < keep - 40) {
            this.moveToward(this.x * 2 - player.x, this.y * 2 - player.y, speed, dt, dist);
        }
        // heal the most wounded ally in range
        let wounded = null, bestMissing = 10;
        for (const e of world.enemies) {
            if (e === this || e.dead || !e.active) continue;
            const missing = 1 - e.hp / e.maxHp;
            if (missing <= 0.02) continue;
            const d2 = Math.hypot(e.x - this.x, e.y - this.y);
            if (d2 <= this.def.healRange && missing * 100 > bestMissing) {
                wounded = e; bestMissing = missing * 100;
            }
        }
        this.healing = wounded;
        if (wounded) {
            wounded.hp = Math.min(wounded.maxHp, wounded.hp + this.def.healRate * dt);
            if (Math.random() < dt * 6) {
                world.fx.burst(wounded.x, wounded.y - 10, PALETTE.good, 2);
            }
        }
    }

    fireHomingVolley(world) {
        const player = world.player;
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        for (const off of [-0.22, 0, 0.22]) {
            world.spawnEnemyBolt(this.x, this.y, a + off, {
                phase: this.phase, speed: BALANCE.elite.boltSpeed,
                damage: BALANCE.elite.boltDamage, homing: true,
            });
        }
    }

    updateDestabilize(dt, world) {
        const run = world.run;
        if (this.isOutOfPhase) {
            this.outOfPhaseTime += dt;
        } else {
            this.outOfPhaseTime = 0;
            this.destabAnnounced = false;
        }
        const delay = destabilizeDelayFor(D.delay, run.stats.destabilizeExtra);
        this.destab = destabilizeState(this.outOfPhaseTime, delay, D.telegraph);

        if (this.destab === 'telegraphing' && !this.destabAnnounced) {
            this.destabAnnounced = true;
            world.ctx.audio.play('destabilize');
        }
        if (this.destab === 'destabilized') {
            if (run.runTime >= this.destabVolleyAt) {
                this.destabVolleyAt = run.runTime + D.volleyEvery;
                const a = Math.atan2(world.player.y - this.y, world.player.x - this.x);
                for (const off of [-0.28, 0, 0.28]) {
                    world.spawnEnemyBolt(this.x, this.y, a + off, {
                        phase: 'white', speed: D.boltSpeed, damage: D.boltDamage, piercePhase: true,
                    });
                }
            }
        } else {
            this.destabVolleyAt = run.runTime + D.volleyEvery * 0.6;
        }
    }

    takeDamage(amount, crit, world) {
        if (this.dead) return { dead: true, rewarded: false };
        let dmg = amount;

        // Bulwark frontal shield
        if (this.kind === 'bulwark') {
            const a = world.player ? Math.atan2(world.player.y - this.y, world.player.x - this.x) * 180 / Math.PI : 0;
            const local = normalizeAngleDiff(a - this.facing * 180 / Math.PI);
            const reduction = bulwarkReduction(local, this.def.shieldArc, this.def.shieldReduction);
            dmg = amount * (1 - reduction);
        }

        this.hp -= dmg;
        if (crit) {
            world.fx.burst(this.x, this.y, PALETTE.gold, 6);
        } else {
            world.fx.burst(this.x, this.y, this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber, 3);
        }
        // brief white flash
        this.setTintMode(Phaser.TintModes.FILL);
        this.setTint(0xffffff);
        this.scene.time.delayedCall(60, () => {
            if (this.active && !this.dead && this.destab === 'stable') this.clearTint();
        });

        if (this.hp <= 0) {
            this.die(world);
            return { dead: true, rewarded: true };
        }
        return { dead: false, rewarded: false };
    }

    applySlow(world) {
        this.slowUntil = world.run.runTime + 1;
        this.slowFactor = 0.7;
    }

    die(world) {
        if (this.dead) return; // idempotent: rewards granted exactly once
        this.dead = true;
        const run = world.run;

        world.ctx.bus.emit('enemy-killed', this);
        world.fx.burst(this.x, this.y, this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber,
            this.elite ? 22 : 12, this.elite || this.kind === 'bulwark');
        if (!world.reducedMotion) {
            world.fx.ring(this.x, this.y, this.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber,
                this.hitRadius * 3, 300);
        }
        world.ctx.audio.play(this.elite || this.kind === 'bulwark' ? 'explode' : 'hit');

        // Splitter: splits once into two minis of the same reality
        if (this.kind === 'splitter' && !this.splitted) {
            this.splitted = true;
            for (const off of [-18, 18]) {
                world.spawnEnemy('mini', this.phase, this.x + off, this.y + (Math.random() * 20 - 10));
            }
        }

        // Rewards: score + motes, exactly once
        const score = Math.round(this.def.score *
            (this.elite ? BALANCE.elite.scoreMult : 1) * run.stats.scoreMult);
        world.addScore(score);
        const moteCount = this.def.motes * (this.elite ? BALANCE.elite.moteMult : 1);
        for (let i = 0; i < moteCount; i++) {
            world.spawnMote(this.x, this.y, this.phase);
        }
        if (Math.random() < run.stats.moteBonusChance) {
            world.spawnMote(this.x, this.y, this.phase);
        }
        run.kills += 1;

        this.despawn();
    }

    destroy(fromScene) {
        this.crest?.destroy();
        this.marker?.destroy();
        super.destroy(fromScene);
    }
}
