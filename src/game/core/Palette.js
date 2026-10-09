// Centralized art-direction palette. Hex strings for CSS/text, numbers for Phaser.
export const PALETTE = {
    cyan: 0x35e0ff,
    amber: 0xffb43a,
    cyanSoft: 0x9be9ff,
    amberSoft: 0xffd9a0,
    white: 0xf4f7ff,
    ink: 0x05070f,
    deep: 0x0b1230,
    hull: 0xdfe7ff,
    hullDark: 0x8b98c9,
    danger: 0xff4d6d,
    gold: 0xffd76a,
    violet: 0x8b5cf6,
    shield: 0x7ef2c8,
    good: 0x7ef2c8,
};

export const HEX = {
    cyan: '#35e0ff',
    amber: '#ffb43a',
    cyanSoft: '#9be9ff',
    amberSoft: '#ffd9a0',
    white: '#f4f7ff',
    dim: '#8b98c9',
    danger: '#ff4d6d',
    gold: '#ffd76a',
    shield: '#7ef2c8',
};

// Phase visual identity. Color is reinforcement only: silhouettes, glyphs and
// background patterns carry the phase signal as well (accessibility).
export const PHASE_STYLE = {
    cyan: { color: PALETTE.cyan, hex: HEX.cyan, glyph: 'diamond', label: 'CYAN' },
    amber: { color: PALETTE.amber, hex: HEX.amber, glyph: 'circle', label: 'AMBER' },
};
