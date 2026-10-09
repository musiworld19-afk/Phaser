// Fx: pooled, low-allocation visual effects. Particle emitters are created once
// and triggered with explode(); transient telegraph lines share one Graphics.

import { PALETTE } from '../core/Palette.js';

export class Fx {
    constructor(scene, reducedMotion = false) {
        this.scene = scene;
        this.reduced = reducedMotion;
        this.scale = reducedMotion ? 0.5 : 1;

        this.sparks = scene.add.particles(0, 0, 'spark', {
            lifespan: { min: 220, max: 520 },
            speed: { min: 70, max: 320 },
            scale: { start: 1.1, end: 0 },
            alpha: { start: 0.95, end: 0 },
            quantity: 0,
            emitting: false,
        }).setDepth(40);

        this.glows = scene.add.particles(0, 0, 'glow', {
            lifespan: { min: 300, max: 600 },
            speed: { min: 20, max: 130 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.9, end: 0 },
            quantity: 0,
            emitting: false,
        }).setDepth(39);

        this.telegraphG = scene.add.graphics().setDepth(35);
        this.telegraphs = []; // { x1, y1, x2, y2, color, t, dur, beam }
        this.ringPool = [];
        this.ringsInUse = [];
    }

    burst(x, y, color, count = 10, big = false) {
        const n = Math.max(1, Math.round(count * this.scale));
        this.sparks.setParticleTint(color);
        this.sparks.explode(n, x, y);
        if (big) {
            this.glows.setParticleTint(color);
            this.glows.explode(Math.max(1, Math.round(n * 0.4)), x, y);
        }
    }

    ring(x, y, color, size = 90, dur = 380) {
        const scene = this.scene;
        let ring = this.ringPool.pop();
        if (!ring) {
            ring = scene.add.image(0, 0, 'ring').setDepth(41);
        }
        ring.setPosition(x, y).setTint(color).setAlpha(0.9).setScale(0.2).setVisible(true);
        this.ringsInUse.push(ring);
        scene.tweens.add({
            targets: ring,
            scale: size / 128,
            alpha: 0,
            duration: this.reduced ? Math.round(dur * 0.7) : dur,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                ring.setVisible(false);
                this.ringPool.push(ring);
            },
        });
    }

    telegraph(x1, y1, x2, y2, color, dur, beam = false) {
        this.telegraphs.push({ x1, y1, x2, y2, color, t: 0, dur, beam });
    }

    update(dtMs) {
        const g = this.telegraphG;
        g.clear();
        for (let i = this.telegraphs.length - 1; i >= 0; i--) {
            const t = this.telegraphs[i];
            t.t += dtMs;
            const k = Math.min(1, t.t / t.dur);
            if (t.t >= t.dur) {
                this.telegraphs.splice(i, 1);
                continue;
            }
            const pulse = 0.35 + 0.4 * Math.abs(Math.sin(t.t / 90));
            if (t.beam) {
                g.lineStyle(14, PALETTE.white, 0.22 * (1 - k * 0.4));
                g.lineBetween(t.x1, t.y1, t.x2, t.y2);
                g.lineStyle(5, t.color, pulse + 0.3);
                g.lineBetween(t.x1, t.y1, t.x2, t.y2);
            } else {
                g.lineStyle(2, t.color, pulse);
                g.lineBetween(t.x1, t.y1, t.x2, t.y2);
                if (this.reduced) continue;
                const mx = (t.x1 + t.x2) / 2, my = (t.y1 + t.y2) / 2;
                g.fillStyle(t.color, pulse * 0.5);
                g.fillCircle(mx, my, 3);
            }
        }
    }

    clearTelegraphs() {
        this.telegraphs.length = 0;
        this.telegraphG.clear();
    }
}
