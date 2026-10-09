// Mote: energy fragment pickup. Phase-locked (collectable only in its own
// reality unless the player has PHASE ANCHOR), magnetized, and expiring.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE } from '../core/Palette.js';
import { canCollectMote } from '../core/PhaseRules.js';

const MOTE_LIFE = 8;

export class Mote extends Phaser.GameObjects.Image {
    constructor(scene) {
        super(scene, 0, 0, 'mote-cyan');
        this.setActive(false).setVisible(false).setDepth(12);
    }

    spawn(phase, x, y) {
        this.phase = phase;
        this.setTexture(phase === 'cyan' ? 'mote-cyan' : 'mote-amber');
        this.setPosition(x, y);
        this.vx = (Math.random() * 90 - 45);
        this.vy = (Math.random() * 90 - 45);
        this.life = MOTE_LIFE;
        this.setActive(true).setVisible(true).setAlpha(1).setScale(1).clearTint();
        return this;
    }

    despawn() {
        this.setActive(false).setVisible(false);
    }

    update(dt, world) {
        const run = world.run;
        const player = world.player;
        this.life -= dt;

        // scatter briefly, then stop
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy *= 0.9;

        if (this.life <= 0) {
            this.despawn();
            return;
        }
        if (this.life < 1.2) {
            this.setAlpha(Math.max(0, this.life / 1.2));
            this.setScale(Math.max(0.2, this.life / 1.2));
        }

        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const collectable = canCollectMote(this.phase, run.phase, run.stats.phaseAnchor);

        if (collectable && dist < run.stats.magnetRadius) {
            const pull = 420 * dt / Math.max(dist, 1);
            this.x += dx * pull;
            this.y += dy * pull;
        }

        if (collectable && dist < BALANCE.player.pickupRadius + 8) {
            this.despawn();
            world.collectMote(this);
        }

        // Out-of-phase motes render ghosted so the rule is visible
        this.setAlpha(this.life < 1.2 ? Math.max(0, this.life / 1.2) : (collectable ? 0.95 : 0.35));
        this.setScale(this.life < 1.2 ? Math.max(0.2, this.life / 1.2) : (collectable ? 1 : 0.8));
    }
}
