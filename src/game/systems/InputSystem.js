// InputSystem: unified keyboard + touch input.
// - Keyboard: WASD/arrows move, SPACE or right-click shifts reality,
//   ESC/P pauses, ENTER confirms focused UI.
// - Touch: dynamic virtual joystick (left half), phase button (bottom-right),
//   pause button lives in the HUD. Multi-touch safe via pointer-id tracking.
// - Touch detection is capability based (pointer:coarse / maxTouchPoints),
//   never user-agent sniffing, so tablets get touch controls (Poki rule).
// - First meaningful gameplay input is reported once for Poki gameplayStart().

export class InputSystem {
    constructor(scene, { onSwitch, onPause, onFirstInput }) {
        this.scene = scene;
        this.onSwitch = onSwitch;
        this.onPause = onPause;
        this.onFirstInput = onFirstInput;
        this.move = { x: 0, y: 0 };
        this.gameplayEnabled = false;
        this.firstInputFired = false;
        this.touchMode = InputSystem.detectTouch();

        const kb = scene.input.keyboard;
        if (kb) {
            this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC,P');
            kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,W,A,S,D,ESC,P');
            kb.on('keydown-SPACE', () => this.handleSwitch());
            kb.on('keydown-ESC', () => this.handlePause());
            kb.on('keydown-P', () => this.handlePause());
            for (const code of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT']) {
                kb.on(`keydown-${code}`, () => this.notifyFirstInput());
            }
        }

        // Right-click also shifts reality on desktop.
        scene.input.mouse?.disableContextMenu();
        scene.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                this.handleSwitch();
                return;
            }
            if (this.touchMode && pointer.wasTouch) {
                this.handleTouchDown(pointer);
            }
        });
        scene.input.on('pointermove', (pointer) => {
            if (this.touchMode && this.joyPointerId === pointer.id) {
                this.updateJoystick(pointer);
            }
        });
        const release = (pointer) => {
            if (this.joyPointerId === pointer.id) {
                this.joyPointerId = null;
                this.move = { x: 0, y: 0 };
                if (this.joyKnob) {
                    this.joyKnob.setPosition(this.joyOrigin.x, this.joyOrigin.y);
                    this.joyKnob.setAlpha(0.5);
                }
            }
        };
        scene.input.on('pointerup', release);
        scene.input.on('pointerupoutside', release);
        scene.input.on('gameout', release);

        this.buildTouchControls();
    }

    static detectTouch() {
        try {
            const coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches;
            return Boolean(coarse) || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
        } catch {
            return false;
        }
    }

    handleSwitch() {
        if (!this.gameplayEnabled) return;
        this.notifyFirstInput();
        this.onSwitch?.();
    }

    handlePause() {
        this.onPause?.(); // scene decides whether a pause is legal in this state
    }

    notifyFirstInput() {
        if (this.gameplayEnabled && !this.firstInputFired) {
            this.firstInputFired = true;
            this.onFirstInput?.();
        }
    }

    buildTouchControls() {
        if (!this.touchMode) return;
        const s = this.scene;

        this.joyOrigin = { x: 150, y: 580 };
        this.joyBase = s.add.image(this.joyOrigin.x, this.joyOrigin.y, 'joy-base')
            .setDepth(900).setAlpha(0.45).setScrollFactor(0);
        this.joyKnob = s.add.image(this.joyOrigin.x, this.joyOrigin.y, 'joy-knob')
            .setDepth(901).setAlpha(0.5).setScrollFactor(0);

        // Phase button: large thumb target, bottom-right, clear of HUD.
        this.phaseBtn = s.add.image(1160, 600, 'phase-btn-base')
            .setDepth(900).setAlpha(0.55).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        this.phaseGlyph = s.add.image(1160, 600, 'glyph-diamond')
            .setDepth(901).setScrollFactor(0).setScale(2.2);
        this.phaseLabel = s.add.text(1160, 668, 'SHIFT', {
            fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '13px', color: '#f4f7ff',
        }).setOrigin(0.5, 0).setDepth(901).setScrollFactor(0);

        this.phaseBtn.on('pointerdown', (p) => {
            this.phaseBtn.setAlpha(0.85);
            this.handleSwitch();
            p.event?.stopPropagation?.();
        });
        this.phaseBtn.on('pointerup', () => this.phaseBtn.setAlpha(0.55));
        this.phaseBtn.on('pointerout', () => this.phaseBtn.setAlpha(0.55));

        this.setVisible(true);
    }

    handleTouchDown(pointer) {
        // Joystick claims any touch on the left half, away from the top HUD.
        if (pointer.x < this.scene.scale.width * 0.52 && pointer.y > 200) {
            this.joyPointerId = pointer.id;
            this.joyOrigin = { x: pointer.x, y: pointer.y };
            this.joyBase.setPosition(pointer.x, pointer.y);
            this.joyKnob.setPosition(pointer.x, pointer.y).setAlpha(0.85);
            this.notifyFirstInput();
        }
    }

    updateJoystick(pointer) {
        const dx = pointer.x - this.joyOrigin.x;
        const dy = pointer.y - this.joyOrigin.y;
        const max = 58;
        const len = Math.hypot(dx, dy);
        const cl = len > max ? max / len : 1;
        this.joyKnob.setPosition(this.joyOrigin.x + dx * cl, this.joyOrigin.y + dy * cl);
        const mag = Math.min(1, len / max);
        if (len > 0) {
            this.move = { x: (dx / len) * mag, y: (dy / len) * mag };
        }
    }

    setPhaseVisual(phase, readyRatio) {
        if (!this.phaseGlyph) return;
        const key = phase === 'cyan' ? 'glyph-diamond' : 'glyph-circle';
        if (this.phaseGlyph.texture.key !== key) this.phaseGlyph.setTexture(key);
        this.phaseGlyph.setTint(phase === 'cyan' ? 0x35e0ff : 0xffb43a);
        this.phaseBtn.setAlpha(readyRatio >= 1 ? 0.75 : 0.3);
    }

    getMoveVector() {
        if (this.touchMode && this.joyPointerId !== null && this.joyPointerId !== undefined) {
            return this.move;
        }
        const k = this.keys;
        if (!k) return { x: 0, y: 0 };
        let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
        let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        return { x, y };
    }

    setGameplayEnabled(enabled) {
        this.gameplayEnabled = enabled;
    }

    setVisible(v) {
        for (const obj of [this.joyBase, this.joyKnob, this.phaseBtn, this.phaseGlyph, this.phaseLabel]) {
            obj?.setVisible(v);
        }
    }

    destroy() {
        for (const obj of [this.joyBase, this.joyKnob, this.phaseBtn, this.phaseGlyph, this.phaseLabel]) {
            obj?.destroy();
        }
    }
}
