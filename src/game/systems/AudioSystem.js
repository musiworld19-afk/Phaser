// AudioSystem: 100% procedural WebAudio synthesis. No audio files, no external
// requests, no licensing surface. AudioContext is created lazily and unlocked by
// a user gesture (autoplay policy). Every call is guarded: audio failures must
// never break gameplay. Pure browser module (no Phaser).

const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Per-arena generative music: pentatonic minor patterns with phase flavor.
const MUSIC = [
    { bpm: 100, root: 33, bass: [0, null, 0, 7, null, 5, 0, null], arp: [0, 3, 7, 10, 12, 10, 7, 3], pad: [0, 3, 7] },      // A minor - PRISM NEXUS
    { bpm: 112, root: 38, bass: [0, null, null, 0, 7, null, 3, null], arp: [0, 7, 10, 12, 10, 7, 5, 3], pad: [0, 3, 7, 10] }, // D minor - EMBER FORGE
    { bpm: 106, root: 42, bass: [0, 0, null, 7, null, null, 10, null], arp: [0, 3, 5, 10, 12, 10, 5, 3], pad: [0, 3, 7, 10] }, // F# minor - RIFT CORE
];

export function createAudioSystem({ rng = Math.random } = {}) {
    let ctx = null;
    let master = null, sfxBus = null, musicBus = null;
    let noiseBuffer = null;
    let sfxVolume = 0.8, musicVolume = 0.7;
    let adMuted = false, hidden = false, ducked = false;
    let musicTimer = null;
    let musicArena = 0;
    let musicPhase = 'cyan';
    let musicStep = 0;
    let nextNoteTime = 0;
    let musicRunning = false;

    function ensureContext() {
        if (ctx) return ctx;
        try {
            const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.9;
            master.connect(ctx.destination);
            sfxBus = ctx.createGain();
            musicBus = ctx.createGain();
            sfxBus.connect(master);
            musicBus.connect(master);
            applyVolumes();
        } catch {
            ctx = null;
        }
        return ctx;
    }

    function makeNoise() {
        if (noiseBuffer || !ctx) return noiseBuffer;
        try {
            const len = ctx.sampleRate | 0;
            noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
            const out = noiseBuffer.getChannelData(0);
            for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
        } catch {
            noiseBuffer = null;
        }
        return noiseBuffer;
    }

    function muted() {
        return adMuted || hidden;
    }

    function applyVolumes() {
        if (!ctx) return;
        try {
            sfxBus.gain.value = muted() ? 0 : sfxVolume;
            musicBus.gain.value = muted() ? 0 : musicVolume * (ducked ? 0.25 : 1);
        } catch { /* ignore */ }
    }

    function unlock() {
        if (!ensureContext()) return false;
        try {
            if (ctx.state === 'suspended') ctx.resume();
        } catch { /* ignore */ }
        return true;
    }

    // ---- primitive voices ----

    function tone({ dest, t, dur, type = 'sine', f0, f1, vol, attack = 0.004, detune = 0 }) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 !== undefined && f1 !== f0) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        }
        if (detune) osc.detune.setValueAtTime(detune, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(dest);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    function noise({ dest, t, dur, vol, f0 = 1200, f1 = 100, type = 'lowpass' }) {
        const buf = makeNoise();
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(gain).connect(dest);
        src.start(t, rng() * 0.5);
        src.stop(t + dur + 0.02);
    }

    function arp(dest, t, freqs, step, dur, vol, type = 'square') {
        freqs.forEach((f, i) => tone({ dest, t: t + i * step, dur, type, f0: f, vol }));
    }

    // ---- SFX recipe table ----

    const SFX = {
        shoot:      t => tone({ dest: sfxBus, t, dur: 0.07, type: 'square', f0: 760, f1: 320, vol: 0.055 }),
        enemyShoot: t => tone({ dest: sfxBus, t, dur: 0.09, type: 'sawtooth', f0: 300, f1: 170, vol: 0.04 }),
        hit:        t => { tone({ dest: sfxBus, t, dur: 0.05, type: 'triangle', f0: 230, f1: 160, vol: 0.09 }); noise({ dest: sfxBus, t, dur: 0.04, vol: 0.05 }); },
        explode:    t => noise({ dest: sfxBus, t, dur: 0.28, vol: 0.2, f0: 900, f1: 90 }),
        bigExplode: t => { noise({ dest: sfxBus, t, dur: 0.5, vol: 0.26, f0: 700, f1: 60 }); tone({ dest: sfxBus, t, dur: 0.4, type: 'sine', f0: 90, f1: 40, vol: 0.18 }); },
        mote:       t => { tone({ dest: sfxBus, t, dur: 0.07, type: 'sine', f0: 660, vol: 0.07 }); tone({ dest: sfxBus, t: t + 0.06, dur: 0.09, type: 'sine', f0: 990, vol: 0.07 }); },
        phase:      t => { tone({ dest: sfxBus, t, dur: 0.16, type: 'sawtooth', f0: 240, f1: 1200, vol: 0.09 }); noise({ dest: sfxBus, t, dur: 0.12, vol: 0.04, f0: 4000, f1: 6000, type: 'highpass' }); },
        phaseFail:  t => tone({ dest: sfxBus, t, dur: 0.08, type: 'square', f0: 140, f1: 90, vol: 0.07 }),
        playerHit:  t => { tone({ dest: sfxBus, t, dur: 0.2, type: 'square', f0: 130, f1: 60, vol: 0.17 }); noise({ dest: sfxBus, t, dur: 0.12, vol: 0.12, f0: 500, f1: 200 }); },
        shieldBreak: t => { tone({ dest: sfxBus, t, dur: 0.16, type: 'square', f0: 820, f1: 180, vol: 0.12 }); noise({ dest: sfxBus, t, dur: 0.1, vol: 0.08, f0: 3000, f1: 800 }); },
        upgrade:    t => arp(sfxBus, t, [523, 659, 784], 0.09, 0.22, 0.1),
        uiMove:     t => tone({ dest: sfxBus, t, dur: 0.035, type: 'square', f0: 500, vol: 0.045 }),
        uiSelect:   t => tone({ dest: sfxBus, t, dur: 0.09, type: 'square', f0: 620, f1: 880, vol: 0.08 }),
        bossWarn:   t => { for (let i = 0; i < 3; i++) tone({ dest: sfxBus, t: t + i * 0.24, dur: 0.18, type: 'square', f0: 82, f1: 78, vol: 0.16 }); },
        bossDie:    t => { noise({ dest: sfxBus, t, dur: 0.6, vol: 0.28, f0: 800, f1: 50 }); arp(sfxBus, t + 0.1, [660, 550, 440, 330], 0.09, 0.18, 0.09, 'triangle'); },
        destabilize: t => { tone({ dest: sfxBus, t, dur: 0.05, type: 'square', f0: 1250, vol: 0.05 }); tone({ dest: sfxBus, t: t + 0.09, dur: 0.05, type: 'square', f0: 1250, vol: 0.05 }); },
        overdrive:  t => tone({ dest: sfxBus, t, dur: 0.5, type: 'sine', f0: 220, f1: 920, vol: 0.12 }),
        victory:    t => arp(sfxBus, t, [523, 659, 784, 1046, 1318], 0.12, 0.3, 0.11, 'triangle'),
        defeat:     t => arp(sfxBus, t, [392, 330, 262, 196], 0.2, 0.4, 0.1, 'sawtooth'),
        revive:     t => { arp(sfxBus, t, [330, 440, 660, 880], 0.1, 0.35, 0.1, 'sine'); noise({ dest: sfxBus, t, dur: 0.3, vol: 0.06, f0: 300, f1: 3000, type: 'highpass' }); },
    };

    function play(name) {
        const recipe = SFX[name];
        if (!recipe) return;
        if (!ensureContext() || muted() || ctx.state !== 'running') return;
        try {
            recipe(ctx.currentTime + 0.01);
        } catch { /* ignore */ }
    }

    // ---- generative music ----

    function scheduleStep(step, t) {
        const m = MUSIC[musicArena] ?? MUSIC[0];
        const spb = 60 / m.bpm / 2; // eighth-note grid
        const bassNote = m.bass[step % 8];
        if (bassNote !== null) {
            tone({ dest: musicBus, t, dur: spb * 0.9, type: 'triangle', f0: NOTE(m.root + bassNote), vol: 0.11, attack: 0.01 });
        }
        const arpNote = m.arp[(step + musicArena) % m.arp.length];
        if (step % 2 === 0 || rng() < 0.4) {
            tone({ dest: musicBus, t, dur: spb * 0.7, type: 'square', f0: NOTE(m.root + 12 + arpNote), vol: 0.022 });
        }
        // Pad chord every 2 bars
        if (step % 16 === 0) {
            for (const p of m.pad) {
                tone({ dest: musicBus, t, dur: spb * 15, type: 'sine', f0: NOTE(m.root + 12 + p), vol: 0.02, attack: 0.4 });
                tone({ dest: musicBus, t, dur: spb * 15, type: 'sine', f0: NOTE(m.root + 19 + p), vol: 0.012, attack: 0.6, detune: 6 });
            }
        }
        // Phase flavor: cyan = airy shimmer on downbeats, amber = percussive offbeat tick.
        if (musicPhase === 'cyan' && step % 8 === 0) {
            tone({ dest: musicBus, t, dur: spb * 4, type: 'sine', f0: NOTE(m.root + 24 + 7), vol: 0.018, attack: 0.2 });
        } else if (musicPhase === 'amber' && step % 8 === 4) {
            noise({ dest: musicBus, t, dur: 0.03, vol: 0.03, f0: 5000, f1: 6000, type: 'highpass' });
        }
    }

    function musicTick() {
        if (!ctx || !musicRunning || muted()) return;
        try {
            const lookahead = 0.45;
            const spb = 60 / (MUSIC[musicArena] ?? MUSIC[0]).bpm / 2;
            while (nextNoteTime < ctx.currentTime + lookahead) {
                scheduleStep(musicStep, Math.max(nextNoteTime, ctx.currentTime + 0.02));
                musicStep += 1;
                nextNoteTime += spb;
            }
        } catch { /* ignore */ }
    }

    function startMusic(arenaIndex = 0) {
        const idx = Math.max(0, Math.min(2, arenaIndex | 0));
        if (musicRunning && musicArena === idx) return;
        stopMusic();
        musicArena = idx;
        if (!ensureContext()) return;
        musicRunning = true;
        musicStep = 0;
        nextNoteTime = ctx.currentTime + 0.1;
        try {
            musicTimer = setInterval(musicTick, 180);
            musicTick();
        } catch { musicRunning = false; }
    }

    function stopMusic() {
        musicRunning = false;
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    }

    return {
        unlock,
        play,
        startMusic,
        stopMusic,
        setPhaseFlavor(phase) { musicPhase = phase === 'amber' ? 'amber' : 'cyan'; },
        setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, Number(v) || 0)); applyVolumes(); },
        setMusicVolume(v) { musicVolume = Math.max(0, Math.min(1, Number(v) || 0)); applyVolumes(); },
        getSfxVolume: () => sfxVolume,
        getMusicVolume: () => musicVolume,
        // Poki ad break: audio must be silenced. Poki may also call the mute
        // callback passed to commercialBreak; both paths converge here.
        setAdMuted(b) { adMuted = !!b; applyVolumes(); },
        setHidden(b) {
            hidden = !!b;
            applyVolumes();
            if (ctx) {
                try { hidden ? ctx.suspend() : (adMuted ? ctx.suspend() : ctx.resume()); } catch { /* ignore */ }
            }
        },
        // Pause menu: duck instead of silence so the arena keeps breathing.
        setDucked(b) { ducked = !!b; applyVolumes(); },
        isUnlocked: () => !!ctx && ctx.state === 'running',
    };
}
