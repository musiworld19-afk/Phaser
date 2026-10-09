// ArenaBackground: layered, slowly-drifting procedural backdrop for each of the
// three arenas. Phase changes subtly re-weight the two pattern layers (grid =
// Cyan leaning, rings = Amber leaning) in addition to HUD glyph indicators.

import { PALETTE } from '../core/Palette.js';

const ARENA_TINTS = [0x3550aa, 0xaa6a35, 0x6a4aaa];

export class ArenaBackground {
    constructor(scene, arenaIndex, reducedMotion = false) {
        this.scene = scene;
        this.arena = Math.max(0, Math.min(2, arenaIndex | 0));
        this.reducedMotion = reducedMotion;
        this.drift = reducedMotion ? 0.35 : 1;
        this.container = scene.add.container(0, 0).setDepth(-100);

        this.base = scene.add.image(640, 360, `bg-arena${this.arena}`).setDisplaySize(1282, 722); // 1px bleed
        this.stars = scene.add.tileSprite(640, 360, 1280, 720, 'stars-dense').setAlpha(0.55).setTint(ARENA_TINTS[this.arena]);
        this.stars2 = scene.add.tileSprite(640, 360, 1280, 720, 'stars-sparse').setAlpha(0.8);

        // Pattern layers per arena
        if (this.arena === 0) {
            this.grid = scene.add.tileSprite(640, 360, 1280, 720, 'tile-grid').setAlpha(0.10);
            this.rings = scene.add.tileSprite(640, 360, 1280, 720, 'tile-rings').setAlpha(0.05);
        } else if (this.arena === 1) {
            this.grid = scene.add.tileSprite(640, 360, 1280, 720, 'tile-grid').setAlpha(0.04);
            this.rings = scene.add.tileSprite(640, 360, 1280, 720, 'tile-rings').setAlpha(0.13);
            this.rings2 = scene.add.tileSprite(640, 360, 1280, 720, 'tile-rings').setAlpha(0.07).setScale(0.62);
        } else {
            this.grid = scene.add.tileSprite(640, 360, 1280, 720, 'tile-grid').setAlpha(0.08);
            this.rings = scene.add.tileSprite(640, 360, 1280, 720, 'tile-rings').setAlpha(0.07);
            this.streaks = scene.add.tileSprite(640, 360, 1280, 720, 'tile-streaks').setAlpha(0.8);
        }

        // Phase ambience overlay: hue emphasis, never load-bearing information.
        this.phaseOverlay = scene.add.rectangle(640, 360, 1280, 720, PALETTE.cyan, 0.045).setDepth(-99);

        this.container.add([
            this.base, this.stars, this.stars2,
            this.grid, this.rings,
            this.rings2, this.streaks,
            this.phaseOverlay,
        ].filter(Boolean));
        this.time = 0;
    }

    setPhase(phase) {
        const color = phase === 'amber' ? PALETTE.amber : PALETTE.cyan;
        this.phaseOverlay.setFillStyle(color, 0.05);
        if (this.grid && this.rings) {
            const cyanLean = phase === 'cyan';
            const baseGrid = this.arena === 0 ? 0.10 : this.arena === 1 ? 0.04 : 0.08;
            const baseRings = this.arena === 0 ? 0.05 : this.arena === 1 ? 0.13 : 0.07;
            this.scene.tweens.add({
                targets: this.grid,
                alpha: cyanLean ? baseGrid * 1.6 : baseGrid * 0.5,
                duration: 350,
                ease: 'Sine.easeInOut',
            });
            this.scene.tweens.add({
                targets: this.rings,
                alpha: cyanLean ? baseRings * 0.5 : baseRings * 1.6,
                duration: 350,
                ease: 'Sine.easeInOut',
            });
        }
    }

    update(dt) {
        this.time += dt;
        const d = this.drift;
        this.stars.tilePositionY -= 4 * d * dt;
        this.stars2.tilePositionY -= 9 * d * dt;
        this.stars2.tilePositionX += 2 * d * dt;
        if (this.grid) {
            this.grid.tilePositionY -= 6 * d * dt;
            this.grid.tilePositionX += 3 * d * dt;
        }
        if (this.rings) {
            this.rings.tilePositionX += 2.4 * d * dt;
            this.rings.tilePositionY -= 1.2 * d * dt;
        }
        if (this.rings2) {
            this.rings2.tilePositionX -= 4 * d * dt;
        }
        if (this.streaks) {
            this.streaks.tilePositionY += 8 * d * dt;
        }
    }

    destroy() {
        this.container.destroy();
    }
}
