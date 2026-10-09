// Boss: three authored encounters. Each has a rotating attack set, readable
// telegraphs, a vulnerability phase that flips on a timer (the player's
// reality-switch matters), bounded state, and an enrage at low HP.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE } from '../core/Palette.js';
import { otherPhase } from '../core/PhaseRules.js';
import { bossScore } from '../systems/ScoreSystem.js';

const BOSS_CONTACT_PAD = 26;

export class Boss extends Phaser.GameObjects.Image {
    constructor(scene, world) {
        super(scene, 0, 0, 'boss-helix');
        this.world = world;
        this.setDepth(22);
        this.setActive(false).setVisible(false);
        this.dead = true;

        this.aura = scene.add.image(0, 0, 'aura-cyan').setDepth(21).setAlpha(0.7);
        this.marker = scene.add.image(0, 0, 'glyph-diamond').setDepth(23).setScale(2.6);
    }

    spawn(bossId, hpMult = 1) {
        this.def = BALANCE.bosses[bossId];
        this.bossId = bossId;
        this.setTexture(`boss-${bossId}`);
        const frame = this.scene.textures.getFrame(`boss-${bossId}`);
        this.displayRadius = this.def.size * 0.42;

        this.hp = this.def.hp * hpMult;
        this.maxHp = this.hp;
        this.dead = false;
        this.vulnPhase = 'cyan';
        this.vulnTimer = this.def.vulnEvery;
        this.vulnTelegraphAt = -1;

        this.t = 0;
        this.attackCd = 2.2;
        this.attackIndex = 0;
        this.activeAttack = null;
        this.attackT = 0;
        this.spiralA = 0;
        this.spiralTick = 0;
        this.waveTick = 0;
        this.waves = 0;
        this.beam = null;
        this.dashState = null;
        this.addsAt = 12;
        this.enraged = false;
        this.contact = this.def.contact;

        this.setPosition(640, 190);
        this.setActive(true).setVisible(true);
        this.setAlpha(1).clearTint();
        this.aura.setTexture('aura-cyan').setVisible(true);
        this.marker.setTexture('glyph-diamond');

        this.world.ctx.bus.emit('boss-spawned', this);
        return this;
    }

    get vulnColor() {
        return this.vulnPhase === 'cyan' ? PALETTE.cyan : PALETTE.amber;
    }

    update(dt, world) {
        if (this.dead) return;
        this.t += dt;
        const run = world.run;
        const player = world.player;

        // --- enrage threshold ---
        if (!this.enraged && this.hp < this.maxHp * 0.3) {
            this.enraged = true;
            this.attackCd = Math.min(this.attackCd, 1.3);
            world.ctx.audio.play('bossWarn');
            world.ctx.bus.emit('boss-enrage');
            world.fx.ring(this.x, this.y, PALETTE.danger, 320, 700);
        }

        // --- vulnerability flip with telegraph ---
        this.vulnTimer -= dt;
        if (this.vulnTimer <= 1.0 && this.vulnTelegraphAt < 0) {
            this.vulnTelegraphAt = this.t;
            world.ctx.audio.play('phase');
        }
        if (this.vulnTimer <= 0) {
            this.vulnPhase = otherPhase(this.vulnPhase);
            this.vulnTimer = this.def.vulnEvery * (this.enraged ? 0.7 : 1);
            this.vulnTelegraphAt = -1;
            this.refreshVulnVisual(world);
            world.ctx.bus.emit('boss-vuln', this.vulnPhase);
        }
        const telegraphing = this.vulnTimer <= 1.0;
        this.aura.setAlpha(telegraphing
            ? 0.4 + 0.4 * Math.abs(Math.sin(this.t * 18))
            : 0.55 + 0.15 * Math.sin(this.t * 3));
        this.aura.setPosition(this.x, this.y).setScale(this.def.size / 96 * (telegraphing ? 1.12 : 1));

        // --- movement per boss ---
        this.move(dt, world);

        // --- adds ---
        this.addsAt -= dt;
        if (this.addsAt <= 0) {
            this.addsAt = this.bossId === 'keeper' ? 10 : 14;
            this.spawnAdds(world);
        }

        // --- attack scheduler ---
        this.attackCd -= dt;
        if (this.activeAttack) {
            this.updateAttack(dt, world);
        } else if (this.attackCd <= 0) {
            this.startNextAttack(world);
        }

        // --- visuals ---
        this.marker
            .setTexture(this.vulnPhase === 'cyan' ? 'glyph-diamond' : 'glyph-circle')
            .setTint(telegraphing ? 0xffffff : this.vulnColor)
            .setPosition(this.x, this.y - this.displayRadius - 34);

        // --- contact damage when sharing the boss's reality ---
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (this.vulnPhase === run.phase && dist < this.displayRadius + BOSS_CONTACT_PAD) {
            world.contactHit(this, this.contact, dt);
        }

        world.ctx.bus.emit('boss-hp', this.hp, this.maxHp);
    }

    refreshVulnVisual(world) {
        this.aura.setTexture(this.vulnPhase === 'cyan' ? 'aura-cyan' : 'aura-amber');
        world.fx.ring(this.x, this.y, this.vulnColor, this.displayRadius * 2.4, 480);
    }

    move(dt, world) {
        if (this.dashState) {
            const d = Math.hypot(this.dashTarget.x - this.x, this.dashTarget.y - this.y);
            if (d < 16 || this.dashState > 1.1) {
                this.dashState = null;
            } else {
                const step = 560 * dt;
                this.x += (this.dashTarget.x - this.x) / d * step;
                this.y += (this.dashTarget.y - this.y) / d * step;
            }
            return;
        }
        if (this.bossId === 'helix') {
            this.x = 640 + Math.sin(this.t * 0.5) * 300;
            this.y = 190 + Math.sin(this.t * 0.83) * 70;
        } else if (this.bossId === 'magma') {
            const p = world.player;
            const dx = p.x - this.x, dy = p.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 220) {
                this.x += dx / d * 52 * dt;
                this.y += dy / d * 52 * dt;
            }
        } else {
            // keeper: rift blinks toward the player
            this.x = 640 + Math.sin(this.t * 0.4) * 240;
            this.y = 200 + Math.cos(this.t * 0.6) * 90;
        }
    }

    startNextAttack(world) {
        const pools = {
            helix: ['spiral', 'sweep', 'slam'],
            magma: ['radial', 'zones', 'flame'],
            keeper: this.hp > this.maxHp * 0.66
                ? ['spiral', 'radial']
                : this.hp > this.maxHp * 0.33
                    ? ['addsBurst', 'sweep', 'radial']
                    : ['spiral', 'piercing', 'zones', 'radial'],
        };
        const pool = pools[this.bossId];
        const name = pool[this.attackIndex % pool.length];
        this.attackIndex += 1;
        this.activeAttack = name;
        this.attackT = 0;
        this.spiralTick = 0;
        this.waves = 0;
        this.waveTick = 0;
        this.attackCd = this.enraged ? 1.4 : 2.2;
        world.ctx.audio.play('bossWarn');
    }

    updateAttack(dt, world) {
        const player = world.player;
        this.attackT += dt;
        const done = () => { this.activeAttack = null; };

        switch (this.activeAttack) {
            case 'spiral': {
                this.spiralTick -= dt;
                if (this.spiralTick <= 0) {
                    this.spiralTick = 0.12;
                    this.spiralA += 0.5;
                    const phase = (Math.floor(this.spiralA / 0.5) % 2 === 0) ? 'cyan' : 'amber';
                    world.spawnEnemyBolt(this.x, this.y, this.spiralA, { phase, speed: 190, damage: 9 });
                }
                if (this.attackT > 2.6) done();
                break;
            }
            case 'radial': {
                this.waveTick -= dt;
                if (this.waveTick <= 0) {
                    this.waveTick = 0.55;
                    const phase = this.waves % 2 === 0 ? 'amber' : 'cyan';
                    const n = this.enraged ? 22 : 18;
                    const off = this.waves * 0.17;
                    for (let i = 0; i < n; i++) {
                        world.spawnEnemyBolt(this.x, this.y, (i / n) * Math.PI * 2 + off,
                            { phase, speed: 185, damage: 9 });
                    }
                    this.waves += 1;
                    world.ctx.audio.play('enemyShoot');
                }
                if (this.waves >= 3) done();
                break;
            }
            case 'sweep': {
                if (!this.beam) {
                    this.beam = {
                        angle: Math.atan2(player.y - this.y, player.x - this.x),
                        dir: Math.random() < 0.5 ? 1 : -1,
                        warm: this.enraged ? 0.7 : 1.0,
                        active: this.enraged ? 1.8 : 1.4,
                    };
                }
                const b = this.beam;
                const len = 1100;
                if (b.warm > 0) {
                    b.warm -= dt;
                    const ex = this.x + Math.cos(b.angle) * len;
                    const ey = this.y + Math.sin(b.angle) * len;
                    world.fx.telegraph(this.x, this.y, ex, ey, 0xffffff, 80, false);
                } else if (b.active > 0) {
                    b.active -= dt;
                    b.angle += b.dir * 0.55 * dt;
                    const ex = this.x + Math.cos(b.angle) * len;
                    const ey = this.y + Math.sin(b.angle) * len;
                    world.fx.telegraph(this.x, this.y, ex, ey, 0xffffff, 60, true);
                    // damage while inside the beam (phase-piercing)
                    if (distToSegment(player.x, player.y, this.x, this.y, ex, ey) < 30) {
                        this.beamHitAt = this.beamHitAt ?? -1;
                        if (world.run.runTime - this.beamHitAt > 0.45) {
                            this.beamHitAt = world.run.runTime;
                            world.player.applyDamage(14);
                        }
                    }
                } else {
                    this.beam = null;
                    this.beamHitAt = -1;
                    done();
                }
                break;
            }
            case 'slam': case 'flame': {
                if (!this.dashState) {
                    this.dashState = 0.001;
                    this.dashTarget = { x: player.x, y: player.y };
                    world.fx.telegraph(this.x, this.y, this.dashTarget.x, this.dashTarget.y,
                        this.vulnColor, (this.enraged ? 450 : 650), false);
                    this.dashDelay = this.enraged ? 0.45 : 0.65;
                    this.flameDrops = 0;
                    this.dashPending = true;
                }
                if (this.dashPending) {
                    this.dashDelay -= dt;
                    if (this.dashDelay <= 0) this.dashPending = false;
                } else {
                    this.dashState += dt;
                    // flame trail hazards (magma)
                    if (this.activeAttack === 'flame' && this.dashState > this.flameDrops * 0.16) {
                        this.flameDrops += 1;
                        world.spawnHazard(this.x, this.y, this.vulnPhase, 55, this);
                    }
                    const d = Math.hypot(this.dashTarget.x - this.x, this.dashTarget.y - this.y);
                    if (d >= 16) {
                        const step = 560 * dt;
                        this.x += (this.dashTarget.x - this.x) / d * step;
                        this.y += (this.dashTarget.y - this.y) / d * step;
                    }
                    if (this.dashState > 1.15) {
                        this.dashState = null;
                        done();
                    }
                }
                break;
            }
            case 'zones': {
                const count = this.enraged ? 4 : 3;
                if (this.attackT < 0.05 && this.waves === 0) {
                    this.waves = 1;
                    for (let i = 0; i < count; i++) {
                        const px = player.x + (Math.random() * 260 - 130);
                        const py = player.y + (Math.random() * 260 - 130);
                        world.spawnHazard(
                            Phaser.Math.Clamp(px, 80, 1200), Phaser.Math.Clamp(py, 80, 640),
                            Math.random() < 0.5 ? 'cyan' : 'amber',
                            BALANCE.hazards.radius, this
                        );
                    }
                }
                if (this.attackT > 0.5) done();
                break;
            }
            case 'piercing': {
                if (this.attackT > 0.15 && this.waves === 0) {
                    this.waves = 1;
                    const a = Math.atan2(player.y - this.y, player.x - this.x);
                    for (const off of [-0.5, -0.25, 0, 0.25, 0.5]) {
                        world.spawnEnemyBolt(this.x, this.y, a + off,
                            { phase: 'white', speed: 260, damage: 12, piercePhase: true });
                    }
                    world.ctx.audio.play('enemyShoot');
                }
                if (this.attackT > 0.6) done();
                break;
            }
            case 'addsBurst': {
                if (this.attackT > 0.1 && this.waves === 0) {
                    this.waves = 1;
                    this.spawnAdds(world, true);
                }
                if (this.attackT > 0.6) done();
                break;
            }
            default:
                done();
        }
    }

    spawnAdds(world, burst = false) {
        const maxAlive = this.bossId === 'keeper' ? 5 : this.bossId === 'magma' ? 3 : 4;
        const alive = world.enemies.filter(e => e.active && !e.dead).length;
        if (alive >= maxAlive) return;
        const kind = this.bossId === 'magma' ? 'spitter' : this.bossId === 'keeper' ? 'weaver' : 'drone';
        const count = burst ? 2 : this.bossId === 'helix' ? 2 : 2;
        for (let i = 0; i < count && alive + i < maxAlive; i++) {
            const side = Math.random() < 0.5 ? 0 : 1;
            world.spawnEnemy(kind, side ? 'cyan' : 'amber',
                this.x + (Math.random() * 300 - 150),
                this.y + 120 + Math.random() * 80);
        }
    }

    takeDamage(amount, crit, world) {
        if (this.dead) return { dead: true };
        const run = world.run;
        if (this.vulnPhase !== run.phase) {
            // shielded by reality: shots spark off harmlessly
            if (Math.random() < 0.35) {
                world.fx.burst(this.x + (Math.random() * 40 - 20), this.y + (Math.random() * 40 - 20), 0x8b98c9, 3);
                if (Math.random() < 0.2) world.ctx.audio.play('phaseFail');
            }
            return { absorbed: true };
        }
        this.hp -= amount;
        this.setTintMode(Phaser.TintModes.FILL);
        this.setTint(crit ? 0xffd76a : 0xffffff);
        this.scene.time.delayedCall(70, () => {
            if (!this.dead) this.clearTint();
        });
        world.fx.burst(this.x, this.y, this.vulnColor, crit ? 8 : 4);
        world.ctx.bus.emit('boss-hp', this.hp, this.maxHp);
        if (this.hp <= 0) {
            this.die(world);
            return { dead: true };
        }
        return { dead: false };
    }

    die(world) {
        if (this.dead) return;
        this.dead = true;
        const run = world.run;

        // Staged death sequence
        world.ctx.audio.play('bossDie');
        for (let i = 0; i < 6; i++) {
            this.scene.time.delayedCall(i * 90, () => {
                const a = Math.random() * Math.PI * 2, r = Math.random() * this.displayRadius;
                world.fx.burst(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r,
                    this.vulnColor, 18, true);
            });
        }
        if (!world.reducedMotion) {
            world.cameraShake(0.012, 420);
            this.scene.cameras.main.flash(240, 255, 255, 255);
        }

        // Rewards exactly once
        world.addScore(bossScore(this.def, run.stats.scoreMult));
        for (let i = 0; i < BALANCE.run.bossMoteBurst; i++) {
            const a = Math.random() * Math.PI * 2;
            world.spawnMote(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40,
                Math.random() < 0.5 ? 'cyan' : 'amber');
        }
        run.bossActive = false;

        this.setActive(false).setVisible(false);
        this.aura.setVisible(false);
        this.marker.setVisible(false);
        world.fx.clearTelegraphs();

        world.ctx.bus.emit('boss-defeated', this.bossId, this);
    }

    destroy(fromScene) {
        this.aura?.destroy();
        this.marker?.destroy();
        super.destroy(fromScene);
    }
}

function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
