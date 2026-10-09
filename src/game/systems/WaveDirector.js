// WaveDirector: converts declarative wave definitions into a pause-safe
// spawn timeline (driven by the Game scene's own delta accumulator — no
// scene timers to leak or survive pauses incorrectly).

import { getWave } from '../core/Waves.js';
import { BALANCE } from '../core/Balance.js';

export class WaveDirector {
    constructor(scene) {
        this.scene = scene;
        this.reset();
    }

    reset() {
        this.timeline = [];
        this.elapsed = 0;
        this.spawnDone = false;
        this.cleared = false;
        this.def = null;
    }

    startWave(indexZero) {
        const scene = this.scene;
        const run = scene.run;
        this.reset();
        run.waveIndex = indexZero;
        const def = getWave(indexZero, run.mode);
        this.def = def;

        for (const s of def.spawns) {
            for (let i = 0; i < s.count; i++) {
                const elite = s.elite ? true : Math.random() < (s.eliteChance ?? 0);
                this.timeline.push({ at: (s.startAt || 0) + i * s.interval, kind: s.kind, elite });
            }
        }
        this.timeline.sort((a, b) => a.at - b.at);
        this.spawnDone = this.timeline.length === 0;

        scene.ensureArena(def.arena);
        scene.ctx.bus.emit('wave-started', indexZero, def, run.mode);

        if (def.boss) {
            scene.startBossIntro(def.boss, def.bossHpMult ?? 1);
        }
    }

    update(dt) {
        const scene = this.scene;
        if (scene.uiState !== 'playing') return;

        if (!this.spawnDone) {
            this.elapsed += dt;
            while (this.timeline.length > 0 && this.timeline[0].at <= this.elapsed) {
                const e = this.timeline.shift();
                scene.spawnEnemyAtEdge(e.kind, e.elite, this.def);
            }
            if (this.timeline.length === 0) this.spawnDone = true;
        }

        // Non-boss waves clear when the field is empty. Boss waves clear via
        // the 'boss-defeated' event.
        if (!this.cleared && this.spawnDone && !this.def.boss &&
            scene.enemies.length === 0) {
            this.cleared = true;
            scene.onWaveCleared();
        }
    }

    forceClear() {
        this.timeline = [];
        this.spawnDone = true;
    }
}
