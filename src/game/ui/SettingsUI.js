// SettingsUI: audio volumes, reduced motion, progress reset. Shared by the
// pause overlay and the main menu. Writes through SaveSystem + AudioSystem.

import * as Phaser from 'phaser';
import { makePanel, makeButton, makeSlider, ButtonGroup } from './UI.js';

export class SettingsUI {
    constructor(scene, ctx, { fromMenu = false, onClose } = {}) {
        this.scene = scene;
        this.ctx = ctx;
        this.group = new ButtonGroup(scene);

        this.dim = scene.add.rectangle(640, 360, 1280, 720, 0x05070f, 0.72)
            .setDepth(620).setScrollFactor(0).setVisible(false);
        this.root = makePanel(scene, 640, 360, 520, 440, { title: 'SETTINGS' });
        this.root.setDepth(621).setScrollFactor(0).setVisible(false);

        const settings = ctx.save.getSettings();

        this.musicSlider = makeSlider(scene, {
            x: 0, y: -80, value: settings.musicVolume,
            label: 'MUSIC', onChange: (v) => this.apply('musicVolume', v),
        });
        this.sfxSlider = makeSlider(scene, {
            x: 0, y: -10, value: settings.sfxVolume,
            label: 'SOUND FX', onChange: (v) => this.apply('sfxVolume', v),
        });
        this.root.add(this.musicSlider.container);
        this.root.add(this.sfxSlider.container);

        const motionBtn = makeButton(scene, {
            x: 0, y: 70, w: 300, h: 50, small: true,
            label: `REDUCED MOTION: ${settings.reducedMotion ? 'ON' : 'OFF'}`,
            onClick: () => {
                const next = !ctx.save.getSettings().reducedMotion;
                this.apply('reducedMotion', next);
                motionBtn.container.list.forEach(c => c.setText?.(`REDUCED MOTION: ${next ? 'ON' : 'OFF'}`));
            },
        });
        this.root.add(motionBtn.container);
        this.group.add(motionBtn);

        if (fromMenu) {
            let armed = false;
            this.resetBtn = makeButton(scene, {
                x: 0, y: 140, w: 300, h: 50, style: 'danger', small: true,
                label: 'RESET PROGRESS',
                onClick: () => {
                    if (!armed) {
                        armed = true;
                        this.resetBtn.container.list.forEach(c => c.setText?.('TAP AGAIN TO CONFIRM'));
                        scene.time.delayedCall(2500, () => {
                            armed = false;
                            this.resetBtn?.container.list.forEach(c => c.setText?.('RESET PROGRESS'));
                        });
                    } else {
                        ctx.save.reset();
                        armed = false;
                        this.resetBtn.container.list.forEach(c => c.setText?.('PROGRESS CLEARED'));
                        ctx.audio.play('uiSelect');
                    }
                },
            });
            this.root.add(this.resetBtn.container);
            this.group.add(this.resetBtn);
        }

        const close = makeButton(scene, {
            x: 0, y: fromMenu ? 190 : 140, w: 300, h: 54, style: 'primary',
            label: 'CLOSE', onClick: () => this.hide(),
        });
        this.root.add(close.container);
        this.group.add(close);
        this.onClose = onClose;
    }

    apply(key, value) {
        this.ctx.save.setSetting(key, value);
        if (key === 'musicVolume') this.ctx.audio.setMusicVolume(value);
        if (key === 'sfxVolume') this.ctx.audio.setSfxVolume(value);
        if (key === 'sfxVolume' || key === 'musicVolume') this.ctx.audio.play('uiSelect');
    }

    show() {
        const s = this.ctx.save.getSettings();
        this.musicSlider.set(s.musicVolume);
        this.sfxSlider.set(s.sfxVolume);
        this.dim.setVisible(true);
        this.root.setVisible(true);
        this.group.activate(true);
    }

    hide() {
        this.dim.setVisible(false);
        this.root.setVisible(false);
        this.group.deactivate();
        this.onClose?.();
    }

    get visible() { return this.root.visible; }
}
