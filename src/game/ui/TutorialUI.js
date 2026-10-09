// TutorialUI: short, interactive, skippable onboarding for the first campaign
// run. Completion persists; "How to Play" from the menu shows the same rules.

import * as Phaser from 'phaser';
import { makeButton } from './UI.js';

const FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';

export class TutorialUI {
    constructor(scene, ctx, onComplete) {
        this.scene = scene;
        this.ctx = ctx;
        this.onComplete = onComplete;
        this.step = 0;
        this.startPos = null;
        this.movedFarEnough = false;
        this.gotKill = false;
        this.switched = false;

        this.root = scene.add.container(640, 596).setDepth(590).setScrollFactor(0).setVisible(false);
        const g = scene.add.graphics();
        g.fillStyle(0x0a0f24, 0.92);
        g.fillRoundedRect(-300, -54, 600, 108, 12);
        g.lineStyle(2, 0x35507d, 1);
        g.strokeRoundedRect(-300, -54, 600, 108, 12);
        this.title = scene.add.text(0, -30, '', {
            fontFamily: FONT, fontSize: '17px', color: '#35e0ff',
        }).setOrigin(0.5);
        this.body = scene.add.text(0, 2, '', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '13px', color: '#cdd6f4',
            align: 'center', wordWrap: { width: 540 }, lineSpacing: 3,
        }).setOrigin(0.5);
        this.root.add([g, this.title, this.body]);

        this.skip = makeButton(scene, {
            x: 1180, y: 640, w: 150, h: 42, label: 'SKIP', small: true,
            onClick: () => this.finish(),
        });
        this.skip.container.setScrollFactor(0);
        this.root.add; // (skip button lives at scene level)
        this.skip.setVisible = (v) => this.skip.container.setVisible(v);

        this.updateText();
    }

    begin() {
        this.active = true;
        this.root.setVisible(true);
        this.skip.container.setVisible(true);
        this.startPos = { x: this.scene.player.x, y: this.scene.player.y };
        this.updateText();
    }

    notifyKill() { this.gotKill = true; }
    notifySwitch() { this.switched = true; }

    updateText() {
        const touch = this.scene.inputSystem?.touchMode;
        const steps = [
            {
                title: '1 — MOVE',
                body: touch ? 'Drag anywhere on the left side of the screen to fly.' : 'Move with WASD or the arrow keys.',
            },
            {
                title: '2 — AUTO-FIRE',
                body: 'Your craft fires at enemies that share YOUR reality. Out-of-phase foes are ghosted and harmless — to you and to them.',
            },
            {
                title: '3 — SHIFT REALITY',
                body: touch
                    ? 'Tap the ◇ button to swap between CYAN and AMBER. Dodge in the safe reality, strike in theirs — but ignored enemies destabilize and pierce back.'
                    : 'Press SPACE (or right-click) to swap between CYAN ◇ and AMBER ○. Dodge in the safe reality, strike in theirs — but ignored enemies destabilize and pierce back.',
            },
        ];
        const s = steps[Math.min(this.step, steps.length - 1)];
        this.title.setText(s.title);
        this.body.setText(s.body);
    }

    update() {
        if (!this.active) return;
        const scene = this.scene;
        switch (this.step) {
            case 0: {
                if (!this.movedFarEnough && this.startPos) {
                    const d = Math.hypot(scene.player.x - this.startPos.x, scene.player.y - this.startPos.y);
                    if (d > 60) this.movedFarEnough = true;
                }
                if (this.movedFarEnough) this.advance();
                break;
            }
            case 1:
                if (this.gotKill) this.advance();
                break;
            case 2:
                if (this.switched) this.advance();
                break;
        }
    }

    advance() {
        this.step += 1;
        this.ctx.audio.play('uiMove');
        if (this.step > 2) {
            this.finish();
        } else {
            this.updateText();
        }
    }

    finish() {
        if (!this.active) return;
        this.active = false;
        this.root.setVisible(false);
        this.skip.container.setVisible(false);
        this.ctx.save.setSetting('seenTutorial', true);
        this.onComplete?.();
    }
}
