// Hazard: telegraphed rift zone. Belongs to one reality (damages same-phase
// players); white/phase-piercing variants come from enraging bosses.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE } from '../core/Palette.js';

export class Hazard {
    constructor(scene) {
        this.scene = scene;
        this.ring = scene.add.image(0, 0, 'ring').setDepth(14).setVisible(false);
        this.fill = scene.add.image(0, 0, 'glow').setDepth(13).setVisible(false);
        this.marker = scene.add.image(0, 0, 'glyph-diamond').setDepth(15).setVisible(false);
        this.active = false;
    }

    spawn(phase, x, y, radius) {
        this.phase = phase;
        this.x = x; this.y = y;
        this.radius = radius;
        this.warnT = BALANCE.hazards.warnTime;
        this.activeT = BALANCE.hazards.activeTime;
        this.damageT = 0;
        this.active = true;

        const color = phase === 'white' ? 0xffffff : (phase === 'cyan' ? PALETTE.cyan : PALETTE.amber);
        this.color = color;
        this.ring.setPosition(x, y).setVisible(true).setTint(color).setAlpha(0.85).setScale(0.15);
        this.fill.setPosition(x, y).setVisible(true).setTint(color).setAlpha(0.10).setScale(radius / 32);
        if (phase !== 'white') {
            this.marker.setTexture(phase === 'cyan' ? 'glyph-diamond' : 'glyph-circle')
                .setPosition(x, y - radius - 16).setVisible(true).setAlpha(0.9).setTint(color).setScale(1.2);
        } else {
            this.marker.setVisible(false);
        }
    }

    update(dt, world) {
        if (!this.active) return;
        const run = world.run;
        const player = world.player;

        if (this.warnT > 0) {
            this.warnT -= dt;
            // contract the warning ring toward the blast radius
            const k = 1 - this.warnT / BALANCE.hazards.warnTime;
            this.ring.setScale(Phaser.Math.Linear(2.2, this.radius / 64, k));
            this.fill.setAlpha(0.06 + 0.2 * Math.abs(Math.sin(this.warnT * 12)));
        } else {
            this.activeT -= dt;
            this.ring.setScale(this.radius / 64 * (1 + 0.06 * Math.sin(this.activeT * 9)));
            this.fill.setAlpha(0.22 + 0.1 * Math.sin(this.activeT * 6));

            const inPhase = this.phase === 'white' || this.phase === run.phase;
            if (inPhase) {
                this.damageT -= dt;
                const dist = Math.hypot(player.x - this.x, player.y - this.y);
                if (dist < this.radius && this.damageT <= 0) {
                    this.damageT = BALANCE.hazards.damageEvery;
                    player.applyDamage(BALANCE.hazards.damage);
                }
            }
            if (this.activeT <= 0) this.despawn();
        }
    }

    despawn() {
        this.active = false;
        this.ring.setVisible(false);
        this.fill.setVisible(false);
        this.marker.setVisible(false);
    }

    destroy() {
        this.ring.destroy();
        this.fill.destroy();
        this.marker.destroy();
    }
}
