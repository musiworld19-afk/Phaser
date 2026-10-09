// UI kit: panels, buttons, keyboard-navigable button groups, and sliders.
// All UI is drawn (no image assets), pointer + keyboard accessible.

import * as Phaser from 'phaser';
import { PALETTE, HEX } from '../core/Palette.js';

const FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';

export function makePanel(scene, x, y, w, h, { title, alpha = 0.92 } = {}) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f24, alpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(2, 0x35507d, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    container.add(g);
    let titleText = null;
    if (title) {
        titleText = scene.add.text(0, -h / 2 + 34, title, {
            fontFamily: FONT, fontSize: '26px', color: HEX.cyan,
            stroke: '#05070f', strokeThickness: 4,
        }).setOrigin(0.5);
        container.add(titleText);
    }
    container.panelSize = { w, h };
    return container;
}

export function makeButton(scene, {
    x, y, w = 260, h = 56, label, sublabel, style = 'secondary', hotkey, onClick, small = false,
}) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    const palette = {
        primary: { fill: 0x123055, stroke: PALETTE.cyan, text: HEX.white },
        secondary: { fill: 0x0e142e, stroke: 0x4a5a8f, text: HEX.white },
        danger: { fill: 0x2a0f1a, stroke: PALETTE.danger, text: '#ffd9df' },
        gold: { fill: 0x241a08, stroke: PALETTE.gold, text: '#ffe9c0' },
    }[style] || { fill: 0x0e142e, stroke: 0x4a5a8f, text: HEX.white };

    const draw = (focused, enabled, pressed) => {
        g.clear();
        g.fillStyle(palette.fill, enabled ? (pressed ? 1 : 0.95) : 0.4);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        g.lineStyle(focused ? 3 : 2, palette.stroke, enabled ? 1 : 0.35);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false, true, false);

    const fontSize = small ? '15px' : '19px';
    const text = scene.add.text(0, sublabel ? -8 : 0, label, {
        fontFamily: FONT, fontSize, color: palette.text,
        stroke: '#05070f', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5);
    container.add(text);
    if (sublabel) {
        const sub = scene.add.text(0, 12, sublabel, {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '12px', color: '#aab4d8',
        }).setOrigin(0.5);
        container.add(sub);
    }
    let hotkeyText = null;
    if (hotkey) {
        hotkeyText = scene.add.text(-w / 2 + 16, -h / 2 + 14, hotkey, {
            fontFamily: FONT, fontSize: '13px', color: '#7a86b8',
        }).setOrigin(0.5);
        container.add(hotkeyText);
    }

    container.setSize(w, h);
    // Hit areas are in TOP-LEFT space: Phaser's pointWithinHitArea adds
    // displayOrigin (w/2, h/2) to pointer coords before this test.
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

    const btn = {
        container, enabled: true, focused: false, onClick,
        setEnabled(v) {
            this.enabled = v;
            text.setAlpha(v ? 1 : 0.45);
            hotkeyText?.setAlpha(v ? 1 : 0.3);
            container.input.enabled = v;
            draw(this.focused, v, false);
        },
        setFocused(v) {
            this.focused = v;
            draw(v, this.enabled, false);
            container.setScale(v ? 1.03 : 1);
        },
        press() {
            if (!this.enabled) return;
            scene.ctx?.audio.play('uiSelect');
            onClick?.();
        },
        destroy() { container.destroy(); },
    };

    container.on('pointerover', () => { if (btn.enabled) { btn.setFocused(true); scene.ctx?.audio.play('uiMove'); } });
    container.on('pointerout', () => btn.setFocused(false));
    container.on('pointerdown', () => { if (btn.enabled) draw(btn.focused, true, true); });
    container.on('pointerup', () => {
        if (!btn.enabled) return;
        draw(btn.focused, true, false);
        btn.press();
    });
    return btn;
}

// Keyboard navigation over a list of buttons (arrow keys + enter/space).
export class ButtonGroup {
    constructor(scene, { hotkeys = false } = {}) {
        this.scene = scene;
        this.buttons = [];
        this.index = -1;
        this.active = false;
        this.hotkeys = hotkeys;
        this._onKey = (event) => {
            if (!this.active) return;
            const code = event.keyCode;
            const DOWN = Phaser.Input.Keyboard.KeyCodes;
            if (code === DOWN.DOWN || code === DOWN.RIGHT) {
                this.move(1);
            } else if (code === DOWN.UP || code === DOWN.LEFT) {
                this.move(-1);
            } else if (code === Phaser.Input.Keyboard.KeyCodes.ENTER || code === Phaser.Input.Keyboard.KeyCodes.SPACE) {
                const b = this.buttons[this.index];
                if (b?.enabled) { event.preventDefault(); b.press(); }
            } else if (this.hotkeys && code >= Phaser.Input.Keyboard.KeyCodes.ONE && code <= Phaser.Input.Keyboard.KeyCodes.NINE) {
                const n = code - Phaser.Input.Keyboard.KeyCodes.ONE;
                const b = this.buttons[n];
                if (b?.enabled) b.press();
            }
        };
    }

    add(btn) {
        this.buttons.push(btn);
        btn.container.on('pointerover', () => { this.index = this.buttons.indexOf(btn); this.refresh(); });
        return this;
    }

    activate(selectFirst = true) {
        if (this.active) return;
        this.active = true;
        this.scene.input.keyboard?.on('keydown', this._onKey);
        if (selectFirst && this.buttons.length > 0) this.index = 0;
        this.refresh();
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.scene.input.keyboard?.off('keydown', this._onKey);
        this.index = -1;
        this.refresh();
    }

    move(dir) {
        if (this.buttons.length === 0) return;
        this.index = (this.index + dir + this.buttons.length) % this.buttons.length;
        this.scene.ctx?.audio.play('uiMove');
        this.refresh();
    }

    refresh() {
        this.buttons.forEach((b, i) => b.setFocused(this.active && i === this.index));
    }

    destroy() {
        this.deactivate();
        this.buttons.length = 0;
    }
}

// Draggable value slider (0..1). Keyboard: left/right when focused.
export function makeSlider(scene, { x, y, w = 260, value = 0.7, onChange, label }) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    const knobX = () => -w / 2 + value * w;

    const draw = (focused) => {
        g.clear();
        g.fillStyle(0x0e142e, 1);
        g.fillRoundedRect(-w / 2, -6, w, 12, 6);
        g.fillStyle(PALETTE.cyan, 0.35);
        g.fillRoundedRect(-w / 2, -6, value * w, 12, 6);
        g.lineStyle(focused ? 3 : 1.5, focused ? PALETTE.cyan : 0x4a5a8f, 1);
        g.strokeRoundedRect(-w / 2, -6, w, 12, 6);
        g.fillStyle(0xdfe7ff, 1);
        g.fillCircle(knobX(), 0, focused ? 10 : 8);
    };
    draw(false);

    const labelT = scene.add.text(-w / 2, -26, label, {
        fontFamily: FONT, fontSize: '14px', color: '#aab4d8',
    }).setOrigin(0, 0.5);
    const pct = scene.add.text(w / 2, -26, `${Math.round(value * 100)}%`, {
        fontFamily: FONT, fontSize: '14px', color: HEX.cyan,
    }).setOrigin(1, 0.5);
    container.add([g, labelT, pct]);

    container.setSize(w, 40);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, 40), Phaser.Geom.Rectangle.Contains);

    const setFromPointer = (px) => {
        const local = px - (x - w / 2);
        value = Phaser.Math.Clamp(local / w, 0, 1);
        draw(true);
        pct.setText(`${Math.round(value * 100)}%`);
        onChange?.(value);
    };

    let dragging = false;
    container.on('pointerdown', (p) => { dragging = true; setFromPointer(p.x); });
    container.on('pointermove', (p) => { if (dragging) setFromPointer(p.x); });
    container.on('pointerup', () => { dragging = false; draw(false); });
    container.on('pointerout', () => { dragging = false; draw(false); });

    return {
        container,
        get value() { return value; },
        set(v) {
            value = Phaser.Math.Clamp(v, 0, 1);
            pct.setText(`${Math.round(value * 100)}%`);
            draw(false);
        },
        adjust(delta) {
            value = Phaser.Math.Clamp(value + delta, 0, 1);
            draw(true);
            pct.setText(`${Math.round(value * 100)}%`);
            onChange?.(value);
        },
    };
}
