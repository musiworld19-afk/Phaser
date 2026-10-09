// Preloader: textures are already generated in Boot, so this is a short,
// honest "generating realities" beat before the menu. PokiSDK's
// gameLoadingFinished() fires once the menu is actually shown.

import { Scene } from 'phaser';
import { HEX } from '../core/Palette.js';

const FONT = '"Arial Black", Arial, sans-serif';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    create() {
        this.add.image(640, 360, 'bg-arena2').setDisplaySize(1282, 722);
        this.add.tileSprite(640, 360, 1280, 720, 'stars-dense').setAlpha(0.5);

        const emblem = this.add.image(640, 300, 'title-emblem').setScale(1.1);
        this.tweens.add({ targets: emblem, angle: 360, duration: 60000, repeat: -1 });

        this.add.text(640, 470, 'ECHOFLUX', {
            fontFamily: FONT, fontSize: '64px', color: HEX.white,
            stroke: '#05070f', strokeThickness: 8, letterSpacing: 18,
        }).setOrigin(0.5);
        this.add.text(640, 524, 'R I F T B R E A K   A R E N A', {
            fontFamily: FONT, fontSize: '18px', color: HEX.cyan,
            stroke: '#05070f', strokeThickness: 4,
        }).setOrigin(0.5);

        const label = this.add.text(640, 596, 'CALIBRATING REALITIES', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '13px', color: '#7a86b8',
        }).setOrigin(0.5);

        const g = this.add.graphics();
        g.lineStyle(2, 0x35507d, 1);
        g.strokeRoundedRect(440, 620, 400, 14, 7);
        const fill = this.add.rectangle(442, 627, 0, 8, 0x35e0ff).setOrigin(0, 0.5);

        this.tweens.add({
            targets: fill,
            width: 396,
            duration: 600,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                const k = Math.round(fill.width / 396 * 100);
                label.setText(`CALIBRATING REALITIES  ${k}%`);
            },
            onComplete: () => {
                this.time.delayedCall(120, () => this.scene.start('MainMenu'));
            },
        });
    }
}
