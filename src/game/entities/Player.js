// Player: the rift-craft. Auto-fires at the nearest enemy sharing its reality.
// Pure rules (i-frames, hit resolution, switch gating) come from CombatRules /
// PhaseRules; this class wires them to Phaser presentation.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE } from '../core/Palette.js';
import { canSwitchPhase, nextSwitchReadyAt, otherPhase } from '../core/PhaseRules.js';
import { resolvePlayerHit, rollDamage } from '../core/CombatRules.js';

export class Player extends Phaser.GameObjects.Image {
    constructor(scene, x, y, world) {
        super(scene, x, y, 'hull');
        this.world = world;
        this.setDepth(20);
        this.god = false; // QA harness only

        this.aura = scene.add.image(x, y, 'aura-cyan').setDepth(19).setAlpha(0.85);
        this.engine = scene.add.image(x, y + 20, 'glow').setDepth(18)
            .setTint(PALETTE.cyan).setScale(0.45).setAlpha(0.85);

        this.fireTimer = 0;
        this.volleyCount = 0;
        this.lastShotSfx = 0;
        this.auraPhase = 0;
    }

    get run() { return this.world.run; }

    get isOverdrive() {
        return this.run.runTime < this.run.overdriveUntil;
    }

    forward() {
        return { x: Math.sin(this.rotation), y: -Math.cos(this.rotation) };
    }

    update(dt) {
        const run = this.run;
        const st = run.stats;
        const world = this.world;

        // --- movement ---
        const mv = world.inputSystem.getMoveVector();
        let speed = st.moveSpeed;
        if (st.phaseRush && run.runTime < (run.phaseRushUntil ?? -Infinity)) {
            speed *= BALANCE.player.phaseRushSpeedMult;
        }
        this.x += mv.x * speed * dt;
        this.y += mv.y * speed * dt;
        const m = BALANCE.world.margin;
        this.x = Phaser.Math.Clamp(this.x, m, BALANCE.world.width - m);
        this.y = Phaser.Math.Clamp(this.y, m, BALANCE.world.height - m);

        // --- facing: prefer target, else movement ---
        const target = this.acquireTarget();
        let desired = this.rotation;
        if (target) {
            desired = Math.atan2(target.y - this.y, target.x - this.x) + Math.PI / 2;
        } else if (mv.x !== 0 || mv.y !== 0) {
            desired = Math.atan2(mv.y, mv.x) + Math.PI / 2;
        }
        this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, desired, 0.28);

        // --- aura + engine ---
        this.auraPhase += dt * 6;
        this.aura.setPosition(this.x, this.y)
            .setAlpha(0.7 + 0.18 * Math.sin(this.auraPhase))
            .setScale(this.isOverdrive ? 1.22 : 1);
        const f = this.forward();
        this.engine.setPosition(this.x - f.x * 20, this.y - f.y * 20)
            .setTint(run.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber)
            .setAlpha(0.55 + (Math.hypot(mv.x, mv.y) > 0.05 ? 0.35 : 0));

        // --- auto-fire ---
        this.fireTimer -= dt;
        if (target && this.fireTimer <= 0) {
            this.fireVolley(target);
            const rate = st.fireRate * (this.isOverdrive ? BALANCE.player.overdriveFireMult : 1);
            this.fireTimer = 1 / rate;
        } else if (!target) {
            this.fireTimer = Math.min(this.fireTimer, 0.1);
        }

        // --- i-frame blink ---
        const invuln = run.runTime - run.lastHitAt < BALANCE.player.iFrames;
        this.setAlpha(invuln ? (Math.sin(run.runTime * 42) > 0 ? 1 : 0.35) : 1);

        // --- nano repair ---
        if (st.nanoRegen && run.hp < st.maxHp &&
            run.runTime - run.lastHitAt > BALANCE.player.nanoRegenDelay) {
            run.hp = Math.min(st.maxHp, run.hp + BALANCE.player.nanoRegenRate * dt);
            this.world.ctx.bus.emit('hp-changed', run.hp, st.maxHp);
        }

        // --- aegis recharge ---
        if (st.aegis && run.shield < 1 &&
            run.runTime - (run.shieldUsedAt ?? -Infinity) > BALANCE.player.aegisRecharge) {
            run.shield = 1;
            this.world.ctx.bus.emit('shield-changed', 1);
        }
    }

    acquireTarget() {
        const run = this.run;
        const range = run.stats.range * (this.isOverdrive ? 1.15 : 1);
        let best = null, bestD = range * range;
        for (const e of this.world.enemies) {
            if (!e.active || e.dead) continue;
            if (!canHurtCheck(e.phase, run.phase)) continue;
            const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
            if (d < bestD) { bestD = d; best = e; }
        }
        const boss = this.world.boss;
        if (boss && !boss.dead && canHurtCheck(boss.vulnPhase, run.phase)) {
            const d = (boss.x - this.x) ** 2 + (boss.y - this.y) ** 2;
            if (d < bestD) { best = boss; }
        }
        return best;
    }

    fireVolley(target) {
        const run = this.run;
        const st = run.stats;
        const world = this.world;
        const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
        const f = this.forward();
        const sx = this.x + f.x * 20;
        const sy = this.y + f.y * 20;

        this.volleyCount += 1;
        const heavy = st.overloadEvery > 0 && this.volleyCount % st.overloadEvery === 0;
        const dmgMult = this.isOverdrive ? BALANCE.player.overdriveDamageMult : 1;
        const n = st.projectiles;

        for (let i = 0; i < n; i++) {
            const a = baseAngle + (i - (n - 1) / 2) * BALANCE.player.spreadPerShot * Math.PI;
            const { value, crit } = rollDamage(st, Math.random, dmgMult);
            world.spawnPlayerBolt(sx, sy, a, {
                damage: heavy ? value * BALANCE.player.overloadDamageMult : value,
                crit,
                pierce: st.pierce + (heavy ? 2 : 0),
                ricochet: st.ricochet,
                homing: st.homing,
                heavy,
                slow: st.slowOnHit,
            });
        }

        if (run.runTime - this.lastShotSfx > 0.05) {
            this.lastShotSfx = run.runTime;
            world.ctx.audio.play(heavy ? 'overdrive' : 'shoot');
        }
    }

    trySwitch() {
        const run = this.run;
        const world = this.world;
        if (!canSwitchPhase(run.switchReadyAt, run.runTime)) {
            world.ctx.audio.play('phaseFail');
            return false;
        }
        run.phase = otherPhase(run.phase);
        run.switchReadyAt = nextSwitchReadyAt(run.runTime, run.stats.switchCooldown);
        if (run.stats.phaseRush) run.phaseRushUntil = run.runTime + BALANCE.player.phaseRushDuration;

        this.aura.setTexture(run.phase === 'cyan' ? 'aura-cyan' : 'aura-amber');
        world.ctx.audio.play('phase');
        world.ctx.audio.setPhaseFlavor(run.phase);
        world.fx.ring(this.x, this.y, run.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber, 120, 420);
        world.fx.burst(this.x, this.y, run.phase === 'cyan' ? PALETTE.cyan : PALETTE.amber, 8);
        if (!world.reducedMotion) world.cameraShake(0.002, 90);
        world.background.setPhase(run.phase);

        if (run.stats.phaseBlade) {
            world.shockwave(this.x, this.y, BALANCE.player.phaseBladeRadius, BALANCE.player.phaseBladeDamage);
        }

        world.ctx.bus.emit('phase-changed', run.phase);
        return true;
    }

    applyDamage(rawDamage) {
        const run = this.run;
        const world = this.world;
        if (this.god) return { survived: true, ignored: true };

        const res = resolvePlayerHit(
            { hp: run.hp, shield: run.shield, hasSecondWind: run.stats.secondWind, secondWindUsed: run.secondWindUsed },
            rawDamage
        );
        run.lastHitAt = run.runTime;

        if (res.usedShield) {
            run.shield = 0;
            run.shieldUsedAt = run.runTime;
            world.ctx.audio.play('shieldBreak');
            world.fx.ring(this.x, this.y, PALETTE.shield, 100, 360);
            world.ctx.bus.emit('shield-changed', 0);
        }
        if (res.usedSecondWind) {
            run.secondWindUsed = true;
            // extend invulnerability beyond the standard i-frame window
            run.lastHitAt = run.runTime + (BALANCE.player.secondWindInvuln - BALANCE.player.iFrames);
            world.ctx.audio.play('revive');
            world.fx.ring(this.x, this.y, PALETTE.good, 180, 600);
        }

        run.hp = res.hp;
        world.ctx.bus.emit('hp-changed', run.hp, run.stats.maxHp);
        world.fx.burst(this.x, this.y, PALETTE.danger, 12);
        world.ctx.audio.play('playerHit');
        if (!world.reducedMotion) world.cameraShake(0.008, 160);

        if (!res.survived) {
            world.ctx.bus.emit('player-died');
        }
        return res;
    }

    revive() {
        const run = this.run;
        run.hp = Math.max(1, Math.round(run.stats.maxHp * BALANCE.player.reviveHpFrac));
        run.lastHitAt = run.runTime + BALANCE.player.secondWindInvuln;
        run.shield = run.stats.aegis ? 1 : run.shield;
        this.world.ctx.bus.emit('hp-changed', run.hp, run.stats.maxHp);
        this.world.ctx.bus.emit('shield-changed', run.shield);
    }

    destroy(fromScene) {
        this.aura?.destroy();
        this.engine?.destroy();
        super.destroy(fromScene);
    }
}

// local shorthand to avoid circular import with PhaseRules usage
function canHurtCheck(enemyPhase, playerPhase) {
    return enemyPhase === playerPhase;
}
