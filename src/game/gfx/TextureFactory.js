// TextureFactory: all game art is generated procedurally at boot via Graphics
// -> generateTexture. No image files, no external requests, zero license surface.
// Silhouettes encode phase (angular = Cyan, rounded = Amber) so reality is
// readable without color (accessibility requirement).

import { PALETTE } from '../core/Palette.js';

const CYAN = PALETTE.cyan, AMBER = PALETTE.amber;
const C_EDGE = 0x1b9fc4, A_EDGE = 0xc77a15;
const WHITE = PALETTE.white, INK = 0x0b1230;

function g(scene) {
    return scene.make.graphics({ x: 0, y: 0, add: false });
}

function bake(gfx, key, w, h, scene) {
    gfx.generateTexture(key, Math.ceil(w), Math.ceil(h));
    gfx.destroy();
    void scene;
}

// points: [[x,y], ...] in local space; recenters via cx/cy
function pts(cx, cy, arr) {
    return arr.map(([x, y]) => ({ x: cx + x, y: cy + y }));
}

function poly(gfx, cx, cy, arr, { fill, edge, strokeW = 2, alpha = 1 }) {
    const p = pts(cx, cy, arr);
    if (fill != null) {
        gfx.fillStyle(fill, alpha);
        gfx.fillPoints(p, true);
    }
    if (edge != null && strokeW > 0) {
        gfx.lineStyle(strokeW, edge, Math.min(1, alpha + 0.15));
        gfx.beginPath();
        gfx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) gfx.lineTo(p[i].x, p[i].y);
        gfx.closePath();
        gfx.strokePath();
    }
}

function dot(gfx, x, y, r, color, alpha = 1) {
    gfx.fillStyle(color, alpha);
    gfx.fillCircle(x, y, r);
}

function ring(gfx, x, y, r, w, color, alpha = 1) {
    gfx.lineStyle(w, color, alpha);
    gfx.strokeCircle(x, y, r);
}

// ---------------------------------------------------------------- player

function buildHull(scene) {
    const gfx = g(scene);
    const cx = 24, cy = 26;
    // Wings
    poly(gfx, cx, cy, [[-19, 14], [-8, -2], [-4, 16], [-13, 20]], { fill: 0x9aa8d8, edge: 0x5a669a, strokeW: 1.5 });
    poly(gfx, cx, cy, [[19, 14], [8, -2], [4, 16], [13, 20]], { fill: 0x9aa8d8, edge: 0x5a669a, strokeW: 1.5 });
    // Main hull wedge
    poly(gfx, cx, cy, [[0, -22], [9, 8], [0, 16], [-9, 8]], { fill: PALETTE.hull, edge: 0x66719e, strokeW: 2 });
    // Spine
    poly(gfx, cx, cy, [[0, -18], [2.5, 8], [0, 13], [-2.5, 8]], { fill: PALETTE.hullDark, edge: null, alpha: 0.9 });
    // Cockpit
    poly(gfx, cx, cy, [[0, -12], [3.5, -2], [0, 3], [-3.5, -2]], { fill: 0x7ceaff, edge: WHITE, strokeW: 1 });
    // Engine nozzles
    dot(gfx, cx - 5, cy + 15, 2.2, 0x7ceaff);
    dot(gfx, cx + 5, cy + 15, 2.2, 0x7ceaff);
    bake(gfx, 'hull', 48, 52, scene);
}

function buildAura(scene) {
    for (const [key, color, marker] of [['aura-cyan', CYAN, 'diamond'], ['aura-amber', AMBER, 'circle']]) {
        const gfx = g(scene);
        const c = 48;
        ring(gfx, c, c, 26, 2, color, 0.85);
        ring(gfx, c, c, 30, 1, color, 0.3);
        if (marker === 'diamond') {
            poly(gfx, c, c - 38, [[0, -5], [5, 0], [0, 5], [-5, 0]], { fill: color, edge: null, alpha: 0.9 });
            poly(gfx, c, c + 38, [[0, -5], [5, 0], [0, 5], [-5, 0]], { fill: color, edge: null, alpha: 0.9 });
            poly(gfx, c - 38, c, [[0, -5], [5, 0], [0, 5], [-5, 0]], { fill: color, edge: null, alpha: 0.9 });
            poly(gfx, c + 38, c, [[0, -5], [5, 0], [0, 5], [-5, 0]], { fill: color, edge: null, alpha: 0.9 });
        } else {
            for (const [dx, dy] of [[0, -38], [0, 38], [-38, 0], [38, 0]]) {
                dot(gfx, c + dx, c + dy, 4, color, 0.9);
            }
        }
        bake(gfx, key, 96, 96, scene);
    }
}

// ---------------------------------------------------------------- enemies
// Each archetype gets two phase variants with different silhouettes.

function buildEnemies(scene) {
    const variants = {
        drone: {
            cyan: (gfx, c) => {
                poly(gfx, c, c, [[0, -16], [13, 10], [0, 5], [-13, 10]], { fill: CYAN, edge: C_EDGE });
                dot(gfx, c, c - 2, 2.5, WHITE, 0.9);
            },
            amber: (gfx, c) => {
                dot(gfx, c, c, 13, AMBER);
                ring(gfx, c, c, 13, 2, A_EDGE);
                for (let i = 0; i < 3; i++) {
                    const a = (i / 3) * Math.PI * 2 + 0.5;
                    dot(gfx, c + Math.cos(a) * 6.5, c + Math.sin(a) * 6.5, 2, WHITE, 0.85);
                }
            },
            size: 40,
        },
        lancer: {
            cyan: (gfx, c) => {
                poly(gfx, c, c, [[0, -21], [7, -2], [3, 21], [-3, 21], [-7, -2]], { fill: CYAN, edge: C_EDGE });
                poly(gfx, c, c, [[0, -14], [2.5, 0], [0, 14], [-2.5, 0]], { fill: WHITE, edge: null, alpha: 0.7 });
            },
            amber: (gfx, c) => {
                gfx.fillStyle(AMBER, 1);
                gfx.fillRoundedRect(c - 20, c - 8, 40, 16, 8);
                gfx.lineStyle(2, A_EDGE, 1);
                gfx.strokeRoundedRect(c - 20, c - 8, 40, 16, 8);
                ring(gfx, c - 16, c, 4.5, 2, WHITE, 0.8);
                ring(gfx, c + 16, c, 4.5, 2, WHITE, 0.8);
            },
            size: 52,
        },
        spitter: {
            cyan: (gfx, c) => {
                poly(gfx, c, c, [[0, -18], [15, -5], [9, 13], [-9, 13], [-15, -5]], { fill: CYAN, edge: C_EDGE });
                poly(gfx, c, c + 4, [[0, -6], [5, 2], [0, 8], [-5, 2]], { fill: INK, edge: null, alpha: 0.55 });
                dot(gfx, c, c - 8, 2.5, WHITE, 0.9);
            },
            amber: (gfx, c) => {
                dot(gfx, c - 11, c + 4, 9, AMBER);
                dot(gfx, c + 11, c + 4, 9, AMBER);
                dot(gfx, c, c - 8, 11, AMBER);
                ring(gfx, c, c - 8, 11, 2, A_EDGE);
                dot(gfx, c, c - 8, 3.5, WHITE, 0.85);
            },
            size: 44,
        },
        weaver: {
            cyan: (gfx, c) => {
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2;
                    poly(gfx, c, c, [
                        [Math.cos(a) * 4 - Math.sin(a) * 3, Math.sin(a) * 4 + Math.cos(a) * 3],
                        [Math.cos(a) * 19 - Math.sin(a) * 2, Math.sin(a) * 19 + Math.cos(a) * 2],
                        [Math.cos(a) * 19 + Math.sin(a) * 2, Math.sin(a) * 19 - Math.cos(a) * 2],
                        [Math.cos(a) * 4 + Math.sin(a) * 3, Math.sin(a) * 4 - Math.cos(a) * 3],
                    ], { fill: CYAN, edge: C_EDGE, strokeW: 1.5 });
                }
                dot(gfx, c, c, 4.5, WHITE, 0.9);
            },
            amber: (gfx, c) => {
                ring(gfx, c, c, 15, 5, AMBER, 0.95);
                ring(gfx, c, c, 15, 5, AMBER, 0.95);
                gfx.lineStyle(4, AMBER, 1);
                gfx.beginPath();
                gfx.arc(c, c, 15, 0.4, 3.2, false);
                gfx.strokePath();
                gfx.beginPath();
                gfx.arc(c, c, 8, 2.4, 5.4, false);
                gfx.strokePath();
                dot(gfx, c, c, 3, WHITE, 0.9);
            },
            size: 48,
        },
        bulwark: {
            cyan: (gfx, c) => {
                poly(gfx, c, c, [[-26, -13], [26, -13], [17, 15], [-17, 15]], { fill: CYAN, edge: C_EDGE });
                poly(gfx, c, c, [[-26, -13], [-19, -13], [-13, 15], [-17, 15]], { fill: WHITE, edge: null, alpha: 0.55 });
                poly(gfx, c, c, [[19, -13], [26, -13], [17, 15], [13, 15]], { fill: WHITE, edge: null, alpha: 0.55 });
                poly(gfx, c, c, [[-9, -6], [9, -6], [5, 9], [-5, 9]], { fill: INK, edge: C_EDGE, alpha: 0.7 });
            },
            amber: (gfx, c) => {
                gfx.fillStyle(AMBER, 1);
                gfx.slice(c, c + 6, 20, Math.PI, 0, false);
                gfx.fillPath();
                gfx.lineStyle(2, A_EDGE, 1);
                gfx.beginPath();
                gfx.arc(c, c + 6, 20, Math.PI, 0, false);
                gfx.strokePath();
                gfx.fillStyle(A_EDGE, 1);
                gfx.fillRect(c - 20, c + 4, 40, 6);
                dot(gfx, c, c - 2, 5, WHITE, 0.8);
            },
            size: 60,
        },
        splitter: {
            cyan: (gfx, c) => {
                poly(gfx, c - 9, c, [[0, -11], [8, 0], [0, 11], [-8, 0]], { fill: CYAN, edge: C_EDGE });
                poly(gfx, c + 9, c, [[0, -11], [8, 0], [0, 11], [-8, 0]], { fill: CYAN, edge: C_EDGE });
                dot(gfx, c - 9, c, 2, WHITE, 0.85);
                dot(gfx, c + 9, c, 2, WHITE, 0.85);
            },
            amber: (gfx, c) => {
                dot(gfx, c - 9, c, 9, AMBER);
                dot(gfx, c + 9, c, 9, AMBER);
                ring(gfx, c - 9, c, 9, 2, A_EDGE);
                ring(gfx, c + 9, c, 9, 2, A_EDGE);
                gfx.fillStyle(AMBER, 1);
                gfx.fillRect(c - 9, c - 2.5, 18, 5);
                dot(gfx, c - 9, c, 2.5, WHITE, 0.85);
                dot(gfx, c + 9, c, 2.5, WHITE, 0.85);
            },
            size: 44,
        },
        mender: {
            cyan: (gfx, c) => {
                poly(gfx, c, c, [[0, -19], [8, -9], [6, 14], [-6, 14], [-8, -9]], { fill: CYAN, edge: C_EDGE });
                poly(gfx, c, c, [[0, -11], [3, 0], [0, 9], [-3, 0]], { fill: 0x7ef2c8, edge: null, alpha: 0.95 });
                ring(gfx, c, c, 15, 1, WHITE, 0.35);
            },
            amber: (gfx, c) => {
                poly(gfx, c, c, [[0, -19], [12, 2], [5, 16], [-5, 16], [-12, 2]], { fill: AMBER, edge: A_EDGE });
                poly(gfx, c, c, [[0, -10], [5, 2], [0, 8], [-5, 2]], { fill: 0x7ef2c8, edge: null, alpha: 0.95 });
            },
            size: 46,
        },
    };

    for (const [kind, def] of Object.entries(variants)) {
        for (const phase of ['cyan', 'amber']) {
            const gfx = g(scene);
            def[phase](gfx, def.size / 2);
            bake(gfx, `${kind}-${phase}`, def.size, def.size, scene);
        }
    }

    // Splitter children + mini drones reuse 'drone' textures scaled down.

    const crest = g(scene);
    poly(crest, 13, 8, [[-11, 5], [0, -4], [11, 5], [0, 1]], { fill: PALETTE.gold, edge: 0xb8860b, strokeW: 1.5 });
    bake(crest, 'elite-crest', 26, 16, scene);
}

// ---------------------------------------------------------------- bosses

function buildBosses(scene) {
    // HELIX PRISM: faceted diamond core with petal shards.
    {
        const s = 160, gfx = g(scene), c = s / 2;
        for (let i = 0; i < 4; i++) {
            const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
            poly(gfx, c, c, [
                [Math.cos(a) * 42 - Math.sin(a) * 12, Math.sin(a) * 42 + Math.cos(a) * 12],
                [Math.cos(a) * 70 - Math.sin(a) * 5, Math.sin(a) * 70 + Math.cos(a) * 5],
                [Math.cos(a) * 74 + Math.sin(a) * 5, Math.sin(a) * 74 - Math.cos(a) * 5],
                [Math.cos(a) * 42 + Math.sin(a) * 12, Math.sin(a) * 42 - Math.cos(a) * 12],
            ], { fill: 0x9be9ff, edge: C_EDGE, strokeW: 2 });
        }
        poly(gfx, c, c, [[0, -48], [34, 0], [0, 48], [-34, 0]], { fill: CYAN, edge: WHITE, strokeW: 3 });
        poly(gfx, c, c, [[0, -28], [18, 0], [0, 28], [-18, 0]], { fill: INK, edge: CYAN, alpha: 0.85 });
        poly(gfx, c, c, [[0, -14], [7, 0], [0, 14], [-7, 0]], { fill: WHITE, edge: null, alpha: 0.95 });
        bake(gfx, 'boss-helix', s, s, scene);
    }
    // MAGMA CHOIR: molten sphere with cracks and an inner core.
    {
        const s = 170, gfx = g(scene), c = s / 2;
        dot(gfx, c, c, 70, 0x7a3d10);
        dot(gfx, c, c, 66, AMBER);
        ring(gfx, c, c, 70, 4, A_EDGE);
        gfx.lineStyle(3, 0x7a3d10, 0.9);
        for (const [x1, y1, x2, y2] of [[-40, -18, -12, -40], [10, -48, 34, -22], [42, 8, 22, 38], [-30, 44, -50, 16], [-8, 10, 16, 26]]) {
            gfx.beginPath();
            gfx.moveTo(c + x1, c + y1);
            gfx.lineTo(c + x2, c + y2);
            gfx.strokePath();
        }
        ring(gfx, c, c, 34, 3, WHITE, 0.5);
        dot(gfx, c, c, 22, 0xffd76a);
        dot(gfx, c, c, 12, WHITE, 0.95);
        bake(gfx, 'boss-magma', s, s, scene);
    }
    // THE RIFTKEEPER: octagonal monolith with a rift eye.
    {
        const s = 180, gfx = g(scene), c = s / 2;
        const oct = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            oct.push([Math.cos(a) * 74, Math.sin(a) * 74]);
        }
        poly(gfx, c, c, oct, { fill: 0x2a1f4d, edge: PALETTE.violet, strokeW: 3 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            poly(gfx, c, c, [[Math.cos(a) * 74 - Math.sin(a) * 8, Math.sin(a) * 74 + Math.cos(a) * 8], [Math.cos(a) * 88, Math.sin(a) * 88], [Math.cos(a) * 74 + Math.sin(a) * 8, Math.sin(a) * 74 - Math.cos(a) * 8]], { fill: PALETTE.violet, edge: WHITE, strokeW: 1, alpha: 0.9 });
        }
        poly(gfx, c, c, [[0, -40], [40, 0], [0, 40], [-40, 0]], { fill: INK, edge: WHITE, strokeW: 2, alpha: 0.9 });
        dot(gfx, c, c, 16, CYAN, 0.9);
        dot(gfx, c, c, 9, AMBER, 0.95);
        dot(gfx, c, c, 4, WHITE);
        bake(gfx, 'boss-keeper', s, s, scene);
    }
}

// ---------------------------------------------------------------- projectiles & pickups

function buildBolts(scene) {
    let gfx = g(scene);
    gfx.fillStyle(WHITE, 0.95);
    gfx.fillRoundedRect(10, 2, 5, 14, 2.5);
    gfx.fillStyle(CYAN, 0.85);
    gfx.fillRoundedRect(11, 1, 3, 16, 1.5);
    bake(gfx, 'bolt-player', 26, 20, scene);

    gfx = g(scene);
    poly(gfx, 7, 7, [[0, -6], [6, 0], [0, 6], [-6, 0]], { fill: CYAN, edge: WHITE, strokeW: 1 });
    bake(gfx, 'bolt-cyan', 14, 14, scene);

    gfx = g(scene);
    dot(gfx, 7, 7, 5.5, AMBER);
    ring(gfx, 7, 7, 5.5, 1.5, WHITE, 0.7);
    bake(gfx, 'bolt-amber', 14, 14, scene);

    gfx = g(scene);
    poly(gfx, 9, 9, [[0, -8], [2.5, -2.5], [8, 0], [2.5, 2.5], [0, 8], [-2.5, 2.5], [-8, 0], [-2.5, -2.5]], { fill: WHITE, edge: 0xcfd8ff, strokeW: 1 });
    bake(gfx, 'bolt-pierce', 18, 18, scene);

    gfx = g(scene);
    gfx.fillStyle(WHITE, 1);
    gfx.fillRoundedRect(7, 2, 7, 26, 3.5);
    gfx.fillStyle(0x9be9ff, 0.9);
    gfx.fillRoundedRect(8.5, 1, 4, 28, 2);
    bake(gfx, 'bolt-heavy', 22, 32, scene);

    gfx = g(scene);
    poly(gfx, 8, 8, [[0, -7], [6, 5], [-6, 5]], { fill: PALETTE.gold, edge: WHITE, strokeW: 1 });
    bake(gfx, 'bolt-homing', 16, 16, scene);

    // Motes
    gfx = g(scene);
    poly(gfx, 9, 9, [[0, -8], [8, 0], [0, 8], [-8, 0]], { fill: CYAN, edge: WHITE, strokeW: 1.5 });
    poly(gfx, 9, 9, [[0, -3.5], [3.5, 0], [0, 3.5], [-3.5, 0]], { fill: WHITE, edge: null });
    bake(gfx, 'mote-cyan', 18, 18, scene);

    gfx = g(scene);
    dot(gfx, 9, 9, 7, AMBER);
    ring(gfx, 9, 9, 7, 1.5, WHITE, 0.8);
    dot(gfx, 9, 9, 3, WHITE);
    bake(gfx, 'mote-amber', 18, 18, scene);
}

function buildParticles(scene) {
    let gfx = g(scene);
    dot(gfx, 5, 5, 3.5, WHITE, 0.9);
    dot(gfx, 5, 5, 2, WHITE, 0.9);
    bake(gfx, 'spark', 10, 10, scene);

    gfx = g(scene);
    dot(gfx, 32, 32, 26, WHITE, 0.10);
    dot(gfx, 32, 32, 18, WHITE, 0.16);
    dot(gfx, 32, 32, 10, WHITE, 0.22);
    bake(gfx, 'glow', 64, 64, scene);

    gfx = g(scene);
    ring(gfx, 64, 64, 60, 3, WHITE, 0.9);
    bake(gfx, 'ring', 128, 128, scene);

    gfx = g(scene);
    poly(gfx, 6, 8, [[0, -6], [5, 4], [-5, 4]], { fill: WHITE, edge: null });
    bake(gfx, 'shard', 12, 12, scene);

    // Phase glyph markers (white; tinted per phase at runtime)
    gfx = g(scene);
    poly(gfx, 8, 8, [[0, -6], [6, 0], [0, 6], [-6, 0]], { fill: null, edge: WHITE, strokeW: 2 });
    bake(gfx, 'glyph-diamond', 16, 16, scene);

    gfx = g(scene);
    ring(gfx, 8, 8, 5.5, 2, WHITE);
    bake(gfx, 'glyph-circle', 16, 16, scene);
}

// ---------------------------------------------------------------- UI bits

function buildUi(scene) {
    let gfx = g(scene);
    ring(gfx, 60, 60, 54, 3, WHITE, 0.35);
    ring(gfx, 60, 60, 46, 2, WHITE, 0.2);
    bake(gfx, 'phase-btn-base', 120, 120, scene);

    gfx = g(scene);
    ring(gfx, 70, 70, 64, 3, WHITE, 0.5);
    ring(gfx, 70, 70, 56, 2, WHITE, 0.25);
    bake(gfx, 'joy-base', 140, 140, scene);

    gfx = g(scene);
    dot(gfx, 32, 32, 26, WHITE, 0.28);
    dot(gfx, 32, 32, 20, WHITE, 0.3);
    bake(gfx, 'joy-knob', 64, 64, scene);

    gfx = g(scene);
    gfx.fillStyle(WHITE, 0.95);
    gfx.fillRect(7, 5, 5, 18);
    gfx.fillRect(16, 5, 5, 18);
    bake(gfx, 'pause-icon', 28, 28, scene);

    gfx = g(scene);
    poly(gfx, 10, 10, [[-7, 6], [-3, -2], [1, 2], [7, -6]], { fill: null, edge: WHITE, strokeW: 2.5 });
    bake(gfx, 'shield-pip', 20, 20, scene);

    // Title emblem: rift diamond + orbiting shards
    gfx = g(scene);
    const c = 110;
    ring(gfx, c, c, 96, 2, CYAN, 0.5);
    poly(gfx, c, c, [[0, -78], [52, 0], [0, 78], [-52, 0]], { fill: null, edge: CYAN, strokeW: 4 });
    poly(gfx, c, c, [[0, -44], [28, 0], [0, 44], [-28, 0]], { fill: INK, edge: WHITE, strokeW: 2, alpha: 0.9 });
    dot(gfx, c, c, 14, AMBER);
    dot(gfx, c, c, 7, WHITE);
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        poly(gfx, c + Math.cos(a) * 96, c + Math.sin(a) * 96, [[0, -7], [7, 0], [0, 7], [-7, 0]], { fill: i === 1 ? AMBER : CYAN, edge: null, alpha: 0.95 });
    }
    bake(gfx, 'title-emblem', 220, 220, scene);
}

// ---------------------------------------------------------------- arena tiles

function buildArenaTiles(scene) {
    // Star fields (two densities)
    for (const [key, count, dim] of [['stars-dense', 90, 0.5], ['stars-sparse', 40, 0.8]]) {
        const gfx = g(scene);
        let seed = 1337;
        const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < count; i++) {
            const x = rand() * 512, y = rand() * 512, r = rand() * 1.6 + 0.5;
            dot(gfx, x, y, r, WHITE, dim * (0.3 + rand() * 0.7));
        }
        bake(gfx, key, 512, 512, scene);
    }

    // Cyan grid tile
    {
        const gfx = g(scene);
        gfx.lineStyle(1, CYAN, 0.5);
        for (let i = 0; i <= 256; i += 32) {
            gfx.beginPath(); gfx.moveTo(i, 0); gfx.lineTo(i, 256); gfx.strokePath();
            gfx.beginPath(); gfx.moveTo(0, i); gfx.lineTo(256, i); gfx.strokePath();
        }
        bake(gfx, 'tile-grid', 256, 256, scene);
    }

    // Amber rings tile
    {
        const gfx = g(scene);
        gfx.lineStyle(1.5, AMBER, 0.5);
        for (let r = 21; r <= 512; r += 42) {
            gfx.strokeCircle(256, 256, r);
        }
        bake(gfx, 'tile-rings', 512, 512, scene);
    }

    // Violet rift streaks tile
    {
        const gfx = g(scene);
        let seed = 90210;
        const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < 7; i++) {
            const x = rand() * 512, y = rand() * 512, len = 40 + rand() * 90;
            gfx.lineStyle(2 + rand() * 2, PALETTE.violet, 0.16 + rand() * 0.12);
            gfx.beginPath();
            gfx.moveTo(x, y);
            gfx.lineTo(x + len * 0.6, y + len);
            gfx.strokePath();
        }
        bake(gfx, 'tile-streaks', 512, 512, scene);
    }

    // Arena base gradients (1280x720, strip-interpolated)
    const arenas = [
        { top: 0x0d1433, bottom: 0x070b1d, vignette: 0x05070f },
        { top: 0x2a1008, bottom: 0x160906, vignette: 0x0f0603 },
        { top: 0x1c0e33, bottom: 0x0e0a1c, vignette: 0x0a0614 },
    ];
    arenas.forEach((a, idx) => {
        const gfx = g(scene);
        const strips = 24;
        for (let i = 0; i < strips; i++) {
            const t = i / (strips - 1);
            const r = Math.round(((a.top >> 16) & 255) * (1 - t) + ((a.bottom >> 16) & 255) * t);
            const gr = Math.round(((a.top >> 8) & 255) * (1 - t) + ((a.bottom >> 8) & 255) * t);
            const b = Math.round((a.top & 255) * (1 - t) + (a.bottom & 255) * t);
            gfx.fillStyle((r << 16) | (gr << 8) | b, 1);
            gfx.fillRect(0, (i * 720) / strips, 1280, 720 / strips + 1);
        }
        // soft vignette edges
        gfx.fillStyle(a.vignette, 0.5);
        gfx.fillRect(0, 0, 1280, 8);
        gfx.fillRect(0, 712, 1280, 8);
        gfx.fillRect(0, 0, 8, 720);
        gfx.fillRect(1272, 0, 8, 720);
        bake(gfx, `bg-arena${idx}`, 1280, 720, scene);
    });
}

export function buildAllTextures(scene) {
    buildHull(scene);
    buildAura(scene);
    buildEnemies(scene);
    buildBosses(scene);
    buildBolts(scene);
    buildParticles(scene);
    buildUi(scene);
    buildArenaTiles(scene);
}
