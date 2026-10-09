// PauseUI: freeze overlay with resume/settings/restart/quit + control recap.

import * as Phaser from 'phaser';
import { makePanel, makeButton, ButtonGroup } from './UI.js';

export class PauseUI {
    constructor(scene, ctx, handlers) {
        this.scene = scene;
        this.handlers = handlers;
        this.group = new ButtonGroup(scene);

        this.dim = scene.add.rectangle(640, 360, 1280, 720, 0x05070f, 0.72)
            .setDepth(610).setScrollFactor(0).setVisible(false);
        this.root = makePanel(scene, 640, 360, 460, 470, { title: 'PAUSED' });
        this.root.setDepth(611).setScrollFactor(0).setVisible(false);

        const touch = scene.inputSystem?.touchMode;
        const controls = touch
            ? 'DRAG LEFT SIDE — move\n◇ BUTTON — shift reality\nTOP RIGHT — pause'
            : 'WASD / ARROWS — move\nSPACE / RIGHT-CLICK — shift reality\nESC / P — pause';
        const recap = scene.add.text(0, 130, controls, {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '14px', color: '#aab4d8',
            align: 'center', lineSpacing: 6,
        }).setOrigin(0.5);
        this.root.add(recap);

        const mk = (label, style, cb, y) => {
            const b = makeButton(scene, { x: 0, y, w: 300, h: 54, label, style, onClick: cb });
            this.root.add(b.container);
            this.group.add(b);
            return b;
        };
        mk('RESUME', 'primary', () => handlers.onResume(), -60);
        mk('SETTINGS', 'secondary', () => handlers.onSettings(), 10);
        mk('RESTART RUN', 'danger', () => handlers.onRestart(), 80);
        mk('QUIT TO MENU', 'secondary', () => handlers.onQuit(), 150);
    }

    show() {
        this.dim.setVisible(true);
        this.root.setVisible(true);
        this.group.activate(true);
    }

    hide() {
        this.dim.setVisible(false);
        this.root.setVisible(false);
        this.group.deactivate();
    }

    get visible() { return this.root.visible; }
}
