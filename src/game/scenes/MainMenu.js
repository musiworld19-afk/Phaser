// MainMenu: title composition, mode select, how-to-play, settings, records.
// Keyboard navigable (arrows + enter), pointer friendly, touch ready.

import { Scene } from 'phaser';
import { HEX } from '../core/Palette.js';
import { formatScore } from '../systems/ScoreSystem.js';
import { makeButton, makePanel, ButtonGroup } from '../ui/UI.js';
import { SettingsUI } from '../ui/SettingsUI.js';

const FONT = '"Arial Black", Arial, sans-serif';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        this.ctx = this.registry.get('ctx');
        this.group = new ButtonGroup(this);

        this.add.image(640, 360, 'bg-arena2').setDisplaySize(1282, 722);
        const stars = this.add.tileSprite(640, 360, 1280, 720, 'stars-dense').setAlpha(0.6);
        const rings = this.add.tileSprite(640, 360, 1280, 720, 'tile-rings').setAlpha(0.07);
        this.drift = { stars, rings };

        const emblem = this.add.image(640, 208, 'title-emblem').setScale(1.15);
        this.tweens.add({ targets: emblem, angle: 360, duration: 48000, repeat: -1 });

        this.add.text(640, 384, 'ECHOFLUX', {
            fontFamily: FONT, fontSize: '68px', color: HEX.white,
            stroke: '#05070f', strokeThickness: 8, letterSpacing: 20,
        }).setOrigin(0.5);
        this.add.text(640, 436, 'R I F T B R E A K   A R E N A', {
            fontFamily: FONT, fontSize: '17px', color: HEX.cyan,
            stroke: '#05070f', strokeThickness: 4,
        }).setOrigin(0.5);

        const records = this.ctx.save.getRecords();
        this.add.text(640, 472, `BEST SCORE  ${formatScore(records.bestScore)}`, {
            fontFamily: FONT, fontSize: '14px', color: HEX.gold,
        }).setOrigin(0.5);

        const endlessSub = records.bestEndlessWave > 0 ? `best sector ${records.bestEndlessWave}` : 'survive the open rift';
        const mk = (label, style, y, onClick, sublabel, small) => {
            const b = makeButton(this, { x: 640, y, w: 320, h: 54, label, style, sublabel, small, onClick });
            this.group.add(b);
            return b;
        };
        mk('CAMPAIGN', 'primary', 540, () => this.start('campaign'), '12 waves · 3 bosses', true);
        mk('ENDLESS', 'secondary', 602, () => this.start('endless'), endlessSub, true);
        mk('HOW TO PLAY', 'secondary', 664, () => this.showHowTo(), null, true);

        this.settings = new SettingsUI(this, this.ctx, { fromMenu: true });

        this.add.text(96, 690, 'WASD move · SPACE shift reality · ESC pause', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '12px', color: '#5a6690',
        }).setOrigin(0, 0.5);
        this.add.text(1184, 34, 'v1.0.0', {
            fontFamily: FONT, fontSize: '11px', color: '#3a4468',
        }).setOrigin(1, 0.5);

        this.events.once('shutdown', () => this.group.destroy());
        this.group.activate(true); // keyboard: arrows + enter

        // Loading is genuinely complete once the menu is interactive.
        this.ctx.poki.gameLoadingFinished();

        if (this.ctx.qa && globalThis.__echoflux) {
            globalThis.__echoflux.scene = 'MainMenu';
            globalThis.__echoflux._state = { scene: 'MainMenu' };
        }
    }

    update(time, delta) {
        const dt = delta / 1000;
        this.drift.stars.tilePositionY -= 3 * dt;
        this.drift.rings.tilePositionX += 2 * dt;
    }

    start(mode) {
        this.ctx.audio.play('uiSelect');
        this.cameras.main.fadeOut(220, 5, 7, 15);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Game', { mode });
        });
    }

    showHowTo() {
        if (this.howTo) { this.howTo.setVisible(true); return; }
        const dim = this.add.rectangle(640, 360, 1280, 720, 0x05070f, 0.7).setDepth(659);
        const panel = makePanel(this, 640, 360, 780, 530, { title: 'HOW TO PLAY' });
        panel.setDepth(660);

        const text = this.add.text(0, -14,
            'You pilot a rift-craft through two overlapping realities.\n' +
            '• Enemies and projectiles belong to CYAN ◇ or AMBER ○.\n' +
            '• You can only damage — and be damaged by — what shares YOUR reality.\n' +
            '• Shift reality (SPACE / right-click / ◇ button) to dodge or to strike.\n' +
            '• Ignored enemies destabilize: they pulse white, then fire\n   phase-piercing volleys. Never camp in the safe reality.\n' +
            '• Collect flux motes to charge OVERDRIVE (double fire rate).\n' +
            '• Clear waves, draft augments, break the three bosses.\n\n' +
            'Desktop: WASD/Arrows move · SPACE or right-click shifts · ESC pauses\n' +
            'Touch: left-side joystick moves · ◇ button shifts · top-right pauses',
            {
                fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '16px', color: '#cdd6f4',
                align: 'left', lineSpacing: 8, wordWrap: { width: 640 },
            }).setOrigin(0.5);
        panel.add(text);

        const close = makeButton(this, {
            x: 0, y: 218, w: 200, h: 50, label: 'CLOSE', style: 'primary',
            onClick: () => this.howTo.setVisible(false),
        });
        panel.add(close.container);

        this.howTo = {
            panel, dim,
            setVisible(v) { panel.setVisible(v); dim.setVisible(v); },
        };
        this.howTo.setVisible(true);
    }
}
