// HUD: health, shield, rift meter, score, wave, phase indicator with cooldown,
// boss bar, and the pause button. Subscribes to the EventBus and throttles
// redraws (dirty flags checked in update()).

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE, HEX } from '../core/Palette.js';
import { formatScore } from '../systems/ScoreSystem.js';

const FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';

export class HUD {
    constructor(scene, ctx, { touchMode, mode }) {
        this.scene = scene;
        this.ctx = ctx;
        this.records = ctx.save.getRecords();
        this.mode = mode;

        this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

        // --- HP bar (top-left) ---
        this.hpG = scene.add.graphics();
        this.hpText = scene.add.text(30, 40, '100', {
            fontFamily: FONT, fontSize: '14px', color: HEX.white,
        }).setOrigin(0, 0.5);
        this.shieldIcon = scene.add.image(262, 40, 'shield-pip').setVisible(false).setTint(PALETTE.shield);
        this.root.add([this.hpG, this.hpText, this.shieldIcon]);
        this.hpDirty = true;

        // --- Score (top-center) ---
        this.scoreText = scene.add.text(640, 24, '0', {
            fontFamily: FONT, fontSize: '28px', color: HEX.white,
            stroke: '#05070f', strokeThickness: 5,
        }).setOrigin(0.5, 0);
        this.bestText = scene.add.text(640, 56, `BEST ${formatScore(this.records.bestScore)}`, {
            fontFamily: FONT, fontSize: '12px', color: '#7a86b8',
        }).setOrigin(0.5, 0);
        this.waveText = scene.add.text(640, 76, '', {
            fontFamily: FONT, fontSize: '16px', color: HEX.gold,
            stroke: '#05070f', strokeThickness: 4,
        }).setOrigin(0.5, 0);
        this.root.add([this.scoreText, this.bestText, this.waveText]);

        // --- Boss bar (top-center, under wave text) ---
        this.bossGroup = scene.add.container(0, 0).setVisible(false);
        this.bossBg = scene.add.rectangle(640, 112, 520, 18, 0x0a0f24, 0.85).setStrokeStyle(2, 0x4a5a8f);
        this.bossBar = scene.add.rectangle(384, 112, 512, 10, PALETTE.danger).setOrigin(0, 0.5);
        this.bossName = scene.add.text(640, 92, '', {
            fontFamily: FONT, fontSize: '14px', color: HEX.white,
        }).setOrigin(0.5);
        this.bossVuln = scene.add.text(640, 134, '', {
            fontFamily: FONT, fontSize: '11px', color: HEX.cyan,
        }).setOrigin(0.5);
        this.bossGlyph = scene.add.image(912, 112, 'glyph-diamond').setScale(1.2);
        this.bossGroup.add([this.bossBg, this.bossBar, this.bossName, this.bossVuln, this.bossGlyph]);
        this.root.add(this.bossGroup);

        // --- Rift meter (bottom-center) ---
        this.riftG = scene.add.graphics();
        this.riftLabel = scene.add.text(640, 668, 'RIFT', {
            fontFamily: FONT, fontSize: '11px', color: '#7a86b8',
        }).setOrigin(0.5);
        this.overdriveText = scene.add.text(640, 650, 'OVERDRIVE', {
            fontFamily: FONT, fontSize: '18px', color: HEX.gold,
            stroke: '#05070f', strokeThickness: 4,
        }).setOrigin(0.5).setVisible(false);
        this.root.add([this.riftG, this.riftLabel, this.overdriveText]);
        this.riftDirty = true;

        // --- Phase indicator (bottom-left) ---
        this.phaseAura = scene.add.image(64, 656, 'aura-cyan').setScale(0.55).setAlpha(0.9);
        this.phaseGlyph = scene.add.image(64, 656, 'glyph-diamond').setScale(1.1).setTint(PALETTE.cyan);
        this.phaseLabel = scene.add.text(64, 636, 'CYAN', {
            fontFamily: FONT, fontSize: '13px', color: HEX.cyan,
        }).setOrigin(0.5);
        this.cdG = scene.add.graphics();
        this.phaseHint = scene.add.text(64, 700, 'SPACE to shift', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '11px', color: '#7a86b8',
        }).setOrigin(0.5).setVisible(!touchMode);
        this.root.add([this.phaseAura, this.phaseGlyph, this.phaseLabel, this.cdG, this.phaseHint]);

        // --- Pause button (top-right) ---
        this.pauseBtn = scene.add.image(1236, 36, 'pause-icon').setDepth(501)
            .setInteractive({ useHandCursor: true }).setAlpha(0.7).setScale(0.9);
        this.pauseBtn.on('pointerover', () => this.pauseBtn.setAlpha(1));
        this.pauseBtn.on('pointerout', () => this.pauseBtn.setAlpha(0.7));
        this.pauseBtn.on('pointerup', () => scene.onPressPause());
        this.root.add(this.pauseBtn);

        // --- bus wiring ---
        const bus = ctx.bus;
        this._unsubs = [
            bus.on('hp-changed', () => { this.hpDirty = true; }),
            bus.on('shield-changed', (v) => { this.shieldIcon.setVisible(v > 0); }),
            bus.on('score-changed', (score, isNewBest) => {
                this.scoreText.setText(formatScore(score));
                if (isNewBest) this.bestText.setText(`BEST ${formatScore(score)}`);
            }),
            bus.on('rift-changed', () => { this.riftDirty = true; }),
            bus.on('overdrive-started', () => {
                this.overdriveText.setVisible(true);
                this.scene.tweens.add({ targets: this.overdriveText, alpha: 0.15, yoyo: true, repeat: 5, duration: 200 });
                this.scene.time.delayedCall(2200, () => this.overdriveText.setVisible(false));
            }),
            bus.on('phase-changed', (phase) => this.setPhase(phase)),
            bus.on('wave-started', (index, def, mode) => this.setWave(index, mode)),
            bus.on('boss-spawned', (boss) => this.showBoss(boss)),
            bus.on('boss-hp', (hp, max) => { this.bossHp = [hp, max]; }),
            bus.on('boss-vuln', (phase) => this.setBossVuln(phase)),
            bus.on('boss-defeated', () => this.bossGroup.setVisible(false)),
        ];

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._unsubs.forEach(off => off());
        });
    }

    setPhase(phase) {
        this.phaseAura.setTexture(phase === 'cyan' ? 'aura-cyan' : 'aura-amber');
        this.phaseGlyph.setTexture(phase === 'cyan' ? 'glyph-diamond' : 'glyph-circle');
        const color = phase === 'cyan' ? PALETTE.cyan : PALETTE.amber;
        this.phaseGlyph.setTint(color);
        this.phaseLabel.setText(phase === 'cyan' ? 'CYAN ◇' : 'AMBER ○')
            .setColor(phase === 'cyan' ? HEX.cyan : HEX.amber);
    }

    setWave(index, mode) {
        if (mode === 'endless') {
            this.waveText.setText(`SECTOR ${index + 1}`);
        } else {
            this.waveText.setText(`WAVE ${index + 1} / 12`);
        }
    }

    showBoss(boss) {
        this.bossGroup.setVisible(true);
        this.bossName.setText(boss.def.name);
        this.bossHp = [boss.hp, boss.maxHp];
        this.setBossVuln(boss.vulnPhase);
    }

    setBossVuln(phase) {
        const glyph = phase === 'cyan' ? '◇' : '○';
        this.bossVuln.setText(`VULNERABLE IN ${phase.toUpperCase()} ${glyph}`).setColor(phase === 'cyan' ? HEX.cyan : HEX.amber);
        this.bossGlyph.setTexture(phase === 'cyan' ? 'glyph-diamond' : 'glyph-circle')
            .setTint(phase === 'cyan' ? PALETTE.cyan : PALETTE.amber);
    }

    update(dt) {
        const run = this.scene.run;

        if (this.hpDirty) {
            this.hpDirty = false;
            const w = 220, h = 16;
            this.hpG.clear();
            this.hpG.fillStyle(0x0a0f24, 0.9);
            this.hpG.fillRoundedRect(30, 32, w, h, 8);
            const frac = Phaser.Math.Clamp(run.hp / run.stats.maxHp, 0, 1);
            const color = frac > 0.5 ? PALETTE.good : frac > 0.25 ? PALETTE.gold : PALETTE.danger;
            this.hpG.fillStyle(color, 1);
            this.hpG.fillRoundedRect(30, 32, Math.max(2, w * frac), h, 8);
            this.hpG.lineStyle(1.5, 0x4a5a8f, 1);
            this.hpG.strokeRoundedRect(30, 32, w, h, 8);
            this.hpText.setText(`${Math.ceil(run.hp)} / ${run.stats.maxHp}`).setPosition(40, 41);
            this.shieldIcon.setX(30 + w + 20);
        }

        if (this.riftDirty) {
            this.riftDirty = false;
            const w = 300, h = 8;
            this.riftG.clear();
            this.riftG.fillStyle(0x0a0f24, 0.9);
            this.riftG.fillRoundedRect(640 - w / 2, 680, w, h, 4);
            const frac = Phaser.Math.Clamp(run.rift / BALANCE.player.motesToOverdrive, 0, 1);
            this.riftG.fillStyle(run.overdriveUntil > run.runTime ? PALETTE.gold : PALETTE.violet, 1);
            this.riftG.fillRoundedRect(640 - w / 2, 680, Math.max(2, w * frac), h, 4);
        }

        // switch cooldown arc around the phase indicator
        const cdFrac = Phaser.Math.Clamp((run.switchReadyAt - run.runTime) / run.stats.switchCooldown, 0, 1);
        this.cdG.clear();
        if (cdFrac > 0) {
            this.cdG.lineStyle(3, 0x7a86b8, 0.8);
            this.cdG.beginPath();
            this.cdG.arc(64, 656, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdFrac), false);
            this.cdG.strokePath();
        }
        this.phaseAura.setAlpha(cdFrac > 0 ? 0.45 : 0.9);

        // boss bar (throttled by event-driven cache)
        if (this.bossGroup.visible && this.bossHp) {
            const [hp, max] = this.bossHp;
            this.bossBar.width = Math.max(0, 512 * Phaser.Math.Clamp(hp / max, 0, 1));
        }
    }

    setVisible(v) {
        this.root.setVisible(v);
        this.pauseBtn.setVisible(v);
    }

    destroy() {
        this._unsubs.forEach(off => off());
        this.root.destroy();
        this.pauseBtn.destroy();
    }
}
