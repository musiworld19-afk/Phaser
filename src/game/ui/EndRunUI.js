// EndRunUI: defeat, optional Poki rewarded revive, victory, and results flows.
// Poki hierarchy rules honored: the standard END RUN button is equal/larger
// and sits above the 🎬-style SECOND CHANCE option, which is never green.

import * as Phaser from 'phaser';
import { PALETTE, HEX } from '../core/Palette.js';
import { formatScore } from '../systems/ScoreSystem.js';
import { makePanel, makeButton, ButtonGroup } from './UI.js';

const FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';

export class EndRunUI {
    constructor(scene, ctx, handlers) {
        this.scene = scene;
        this.ctx = ctx;
        this.handlers = handlers;
        this.group = new ButtonGroup(scene);

        this.dim = scene.add.rectangle(640, 360, 1280, 720, 0x05070f, 0.78)
            .setDepth(630).setScrollFactor(0).setVisible(false);
        this.root = makePanel(scene, 640, 360, 620, 560);
        this.root.setDepth(631).setScrollFactor(0).setVisible(false);
        this.buttons = [];
    }

    _clear() {
        this.root.removeAll(true);
        for (const b of this.buttons) b.destroy();
        this.buttons = [];
        this.group.buttons = [];
    }

    _title(text, color) {
        const t = this.scene.add.text(0, -216, text, {
            fontFamily: FONT, fontSize: '40px', color,
            stroke: '#05070f', strokeThickness: 6,
        }).setOrigin(0.5);
        this.root.add(t);
        return t;
    }

    _stats({ score, best, isNewBest, wave, kills, motes, mode }) {
        const rows = [
            ['SCORE', formatScore(score) + (isNewBest ? '  ★ NEW BEST' : '')],
            [mode === 'endless' ? 'SECTOR REACHED' : 'WAVE REACHED', String(wave)],
            ['KILLS', String(kills)],
            ['MOTES', String(motes)],
            ['BEST', formatScore(best)],
        ];
        const y0 = -140;
        rows.forEach(([k, v], i) => {
            const y = y0 + i * 34;
            const key = this.scene.add.text(-230, y, k, {
                fontFamily: FONT, fontSize: '14px', color: '#7a86b8',
            }).setOrigin(0, 0.5);
            const val = this.scene.add.text(230, y, v, {
                fontFamily: FONT, fontSize: '14px',
                color: k === 'SCORE' && isNewBest ? HEX.gold : HEX.white,
            }).setOrigin(1, 0.5);
            this.root.add([key, val]);
        });
    }

    _addButton(opts) {
        const b = makeButton(this.scene, opts);
        this.root.add(b.container);
        this.buttons.push(b);
        this.group.add(b);
        return b;
    }

    showDefeat({ run, records, isNewBest, canRevive }) {
        this._clear();
        this.dim.setVisible(true);
        this.root.setVisible(true);
        this._title('SIGNAL LOST', HEX.danger);

        const sub = this.scene.add.text(0, -172, 'The rift collapses around your craft.', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '13px', color: '#aab4d8',
        }).setOrigin(0.5);
        this.root.add(sub);

        this._stats({
            score: run.score, best: records.bestScore, isNewBest,
            wave: run.waveIndex + 1, kills: run.kills, motes: run.motes, mode: run.mode,
        });

        if (canRevive) {
            // Standard option: equal/larger, adjacent, primary. Rewarded option
            // below it, gold (never green), with an explicit ad notice.
            this._addButton({
                x: 0, y: 100, w: 340, h: 58, style: 'primary', label: 'END RUN',
                onClick: () => this.showResults({ run, records, isNewBest }),
            });
            this._addButton({
                x: 0, y: 168, w: 300, h: 52, style: 'gold', small: true,
                label: '► SECOND CHANCE',
                sublabel: 'watch an ad to continue this run',
                onClick: () => this.handlers.onRevive?.(),
            });
        } else {
            this._addButton({
                x: 0, y: 130, w: 340, h: 58, style: 'primary', label: 'END RUN',
                onClick: () => this.showResults({ run, records, isNewBest }),
            });
        }
        this.group.activate(true);
        this.scene.ctx?.audio.play('defeat');
    }

    showRevivePending() {
        this._clear();
        this.root.setVisible(true);
        this._title('SECOND CHANCE', HEX.gold);
        const sub = this.scene.add.text(0, -60, 'Resuming transmission after the break...', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '14px', color: '#aab4d8',
        }).setOrigin(0.5);
        this.root.add(sub);
        this.group.deactivate();
    }

    showResults({ run, records, isNewBest }) {
        this._clear();
        this.root.setVisible(true);
        this._title('RUN REPORT', HEX.white);
        this._stats({
            score: run.score, best: records.bestScore, isNewBest,
            wave: run.waveIndex + 1, kills: run.kills, motes: run.motes, mode: run.mode,
        });
        this._addButton({
            x: -110, y: 120, w: 200, h: 56, style: 'primary', label: 'RESTART',
            onClick: () => this.handlers.onRestart?.(),
        });
        this._addButton({
            x: 110, y: 120, w: 200, h: 56, label: 'MENU',
            onClick: () => this.handlers.onMenu?.(),
        });
        this.group.activate(true);
    }

    showVictory({ run, records, isNewBest }) {
        this._clear();
        this.dim.setVisible(true);
        this.root.setVisible(true);
        this._title('RIFT BROKEN', HEX.gold);

        const sub = this.scene.add.text(0, -172,
            'The Riftkeeper falls. The fractured dimensions settle... for now.', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '13px', color: '#aab4d8',
            align: 'center', wordWrap: { width: 480 },
        }).setOrigin(0.5);
        this.root.add(sub);

        this._stats({
            score: run.score, best: records.bestScore, isNewBest,
            wave: run.waveIndex + 1, kills: run.kills, motes: run.motes, mode: run.mode,
        });

        this._addButton({
            x: 0, y: 100, w: 360, h: 58, style: 'primary',
            label: 'CONTINUE — ENDLESS',
            sublabel: 'the rift reopens, stronger',
            onClick: () => this.handlers.onContinueEndless?.(),
        });
        this._addButton({
            x: 0, y: 166, w: 300, h: 52, label: 'MENU',
            onClick: () => this.handlers.onMenu?.(),
        });
        this.group.activate(true);
        this.scene.ctx?.audio.play('victory');
    }

    hide() {
        this.dim.setVisible(false);
        this.root.setVisible(false);
        this.group.deactivate();
    }

    get visible() { return this.root.visible; }
}
