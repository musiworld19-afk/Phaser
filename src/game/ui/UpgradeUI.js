// UpgradeUI: the between-wave augment draft. Gameplay is frozen while a
// choice is unresolved; every option is a real, validated upgrade.

import * as Phaser from 'phaser';
import { PALETTE, HEX } from '../core/Palette.js';
import { makePanel, makeButton, ButtonGroup } from './UI.js';
import { BALANCE } from '../core/Balance.js';

const FONT = '"Arial Black", "Segoe UI", Arial, sans-serif';

const CAT_LABEL = {
    offense: 'OFFENSE', mobility: 'MOBILITY', defense: 'DEFENSE',
    economy: 'ECONOMY', phase: 'PHASE', utility: 'UTILITY',
};

export class UpgradeUI {
    constructor(scene, ctx, onSelect) {
        this.scene = scene;
        this.ctx = ctx;
        this.onSelect = onSelect;
        this.group = new ButtonGroup(scene, { hotkeys: true });
        this.buttons = [];

        this.root = makePanel(scene, 640, 360, 980, 520, { title: 'AUGMENT ACQUIRED' });
        this.root.setDepth(600).setScrollFactor(0).setVisible(false);

        this.sub = scene.add.text(0, -218, '', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '14px', color: '#aab4d8',
        }).setOrigin(0.5);
        this.root.add(this.sub);

        this.dim = scene.add.rectangle(640, 360, 1280, 720, 0x05070f, 0.6)
            .setDepth(599).setVisible(false).setScrollFactor(0);
    }

    show(picks, { bonusText, takenCounts }) {
        this.picks = picks;
        this.takenCounts = takenCounts;
        this.sub.setText(bonusText || 'Choose one augment to continue');
        this.root.removeAll(true);

        // destroy stale buttons
        for (const b of this.buttons) b.destroy();
        this.buttons = [];
        this.group.buttons = [];

        if (!picks || picks.length === 0) {
            const cont = makeButton(this.scene, {
                x: 0, y: 60, w: 320, h: 64, label: 'CONTINUE', style: 'primary',
                onClick: () => this.select(null),
            });
            this.root.add(cont.container);
            this.buttons.push(cont);
            this.group.add(cont);
        } else {
            const cardW = 290, gap = 26;
            picks.forEach((def, i) => {
                const x = (i - (picks.length - 1) / 2) * (cardW + gap);
                const card = this.makeCard(def, x, i);
                this.root.add(card.container);
                this.buttons.push(card.button);
                this.group.add(card.button);
            });
        }

        this.root.setVisible(true);
        this.dim.setVisible(true);
        this.group.activate(true);
        this.scene.ctx?.audio.play('upgrade');
    }

    makeCard(def, x, index) {
        const scene = this.scene;
        const container = scene.add.container(x, 20);

        const g = scene.add.graphics();
        const stroke = def.rarity === 'rare' ? PALETTE.gold : PALETTE.cyan;
        g.fillStyle(0x0e142e, 1);
        g.fillRoundedRect(-135, -160, 270, 330, 12);
        g.lineStyle(2, stroke, 1);
        g.strokeRoundedRect(-135, -160, 270, 330, 12);
        container.add(g);

        const tag = scene.add.text(0, -128, `${CAT_LABEL[def.cat]} · ${def.rarity === 'rare' ? 'RARE' : 'COMMON'}`, {
            fontFamily: FONT, fontSize: '11px', color: def.rarity === 'rare' ? HEX.gold : HEX.cyan,
        }).setOrigin(0.5);
        const name = scene.add.text(0, -96, def.name, {
            fontFamily: FONT, fontSize: '20px', color: HEX.white,
            wordWrap: { width: 240 }, align: 'center',
        }).setOrigin(0.5);
        const desc = scene.add.text(0, -10, def.desc, {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '15px', color: '#cdd6f4',
            wordWrap: { width: 232 }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        container.add([tag, name, desc]);

        const taken = this.takenCounts?.[def.id] || 0;
        if (taken > 0 || def.maxStacks > 1) {
            const stacks = scene.add.text(0, 92,
                taken > 0 ? `OWNED ${taken} / ${def.maxStacks}` : `MAX ${def.maxStacks}`,
                { fontFamily: FONT, fontSize: '12px', color: '#7a86b8' }).setOrigin(0.5);
            container.add(stacks);
        }

        const btn = makeButton(scene, {
            x: 0, y: 118, w: 210, h: 52, label: 'SELECT', style: def.rarity === 'rare' ? 'gold' : 'primary',
            hotkey: `${index + 1}`, small: true,
            onClick: () => this.select(def),
        });
        container.add(btn.container);
        btn.container.on('pointerover', () => {
            g.clear();
            g.fillStyle(0x182248, 1);
            g.fillRoundedRect(-135, -160, 270, 330, 12);
            g.lineStyle(3, stroke, 1);
            g.strokeRoundedRect(-135, -160, 270, 330, 12);
        });
        btn.container.on('pointerout', () => {
            g.clear();
            g.fillStyle(0x0e142e, 1);
            g.fillRoundedRect(-135, -160, 270, 330, 12);
            g.lineStyle(2, stroke, 1);
            g.strokeRoundedRect(-135, -160, 270, 330, 12);
        });

        return { container, button: btn };
    }

    select(def) {
        this.group.deactivate();
        this.root.setVisible(false);
        this.dim.setVisible(false);
        this.onSelect?.(def);
    }

    get visible() {
        return this.root.visible;
    }
}
