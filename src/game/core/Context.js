// Context: composition root. Created once at bootstrap and stored on the Phaser
// game registry, so every scene shares one authoritative set of services.

import { EventBus } from './EventBus.js';
import { createSaveSystem } from '../systems/SaveSystem.js';
import { createPokiAdapter } from '../systems/PokiAdapter.js';
import { createAudioSystem } from '../systems/AudioSystem.js';

export function isQaMode() {
    try {
        return new URLSearchParams(globalThis.location?.search || '').has('qa');
    } catch {
        return false;
    }
}

export function createGameContext() {
    const bus = new EventBus();
    const save = createSaveSystem();
    const audio = createAudioSystem();
    const poki = createPokiAdapter(() => {
        try { return globalThis.PokiSDK; } catch { return undefined; }
    });
    const qa = isQaMode();

    const ctx = { bus, save, audio, poki, qa, phase: 'cyan' };

    // Autoplay policy: unlock WebAudio on the first user gesture, anywhere.
    try {
        const unlock = () => audio.unlock();
        globalThis.document?.addEventListener('pointerdown', unlock);
        globalThis.document?.addEventListener('keydown', unlock);
    } catch { /* non-browser environment */ }

    if (qa && typeof globalThis !== 'undefined') {
        // Minimal, URL-gated test harness. No player-facing surface. See
        // docs/QA_REPORT.md. Only exposes state reads plus wave/health probes.
        globalThis.__echoflux = {
            ctx,
            scene: 'boot',
            state: () => globalThis.__echoflux._state ?? { scene: globalThis.__echoflux.scene },
            _state: null,
            _game: null,
        };
    }

    // SDK init is async and must never block the game from loading.
    poki.init();

    return ctx;
}
