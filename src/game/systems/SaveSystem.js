// SaveSystem: local persistence with defensive validation.
// Pure module: storage is injected; localStorage may be unavailable (incognito,
// blocked, quota exceeded) and the game must remain fully playable without it.

const STORAGE_KEY = 'echoflux.save.v1';
const SAVE_VERSION = 1;
const MAX_NUM = 1e9;

export function defaultSaveData() {
    return {
        version: SAVE_VERSION,
        bestScore: 0,
        bestCampaignWave: 0,
        bestEndlessWave: 0,
        runsPlayed: 0,
        settings: {
            musicVolume: 0.7,
            sfxVolume: 0.8,
            reducedMotion: false,
            seenTutorial: false,
        },
    };
}

function clampNum(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function clampInt(v, min, max, fallback) {
    return Math.round(clampNum(v, min, max, fallback));
}

function asBool(v, fallback) {
    return typeof v === 'boolean' ? v : fallback;
}

// Validate and clamp an arbitrary parsed object into a safe save structure.
export function validateSaveData(raw) {
    const d = defaultSaveData();
    if (raw == null || typeof raw !== 'object') return { data: d, corrupt: true };

    // Version gate: only v1 (or missing) understood; anything else resets.
    if (raw.version !== undefined && raw.version !== SAVE_VERSION) {
        return { data: d, corrupt: true };
    }

    d.bestScore = clampInt(raw.bestScore, 0, MAX_NUM, 0);
    d.bestCampaignWave = clampInt(raw.bestCampaignWave, 0, 999, 0);
    d.bestEndlessWave = clampInt(raw.bestEndlessWave, 0, 999, 0);
    d.runsPlayed = clampInt(raw.runsPlayed, 0, 1e6, 0);

    if (raw.settings && typeof raw.settings === 'object') {
        d.settings.musicVolume = clampNum(raw.settings.musicVolume, 0, 1, 0.7);
        d.settings.sfxVolume = clampNum(raw.settings.sfxVolume, 0, 1, 0.8);
        d.settings.reducedMotion = asBool(raw.settings.reducedMotion, false);
        d.settings.seenTutorial = asBool(raw.settings.seenTutorial, false);
    }
    return { data: d, corrupt: false };
}

function resolveStorage(provider) {
    // provider: undefined (use global localStorage), or an injected storage-like.
    try {
        const store = provider !== undefined ? provider : globalThis.localStorage;
        if (!store) return { storage: null, available: false };
        // Probe: some browsers throw on any localStorage touch in private mode.
        const probeKey = '__echoflux_probe__';
        store.setItem(probeKey, '1');
        store.removeItem(probeKey);
        return { storage: store, available: true };
    } catch {
        return { storage: null, available: false };
    }
}

export function createSaveSystem(storageProvider) {
    const { storage, available } = resolveStorage(storageProvider);
    let data = defaultSaveData();
    let lastLoadWasCorrupt = false;
    let writeFailed = false;

    function load() {
        if (!storage) return;
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (raw === null) return;
            const parsed = JSON.parse(raw); // throws on corrupt data
            const result = validateSaveData(parsed);
            data = result.data;
            lastLoadWasCorrupt = result.corrupt;
        } catch {
            const result = validateSaveData(null);
            data = result.data;
            lastLoadWasCorrupt = true;
        }
    }

    function persist() {
        if (!storage) return;
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(data));
            writeFailed = false;
        } catch {
            // Quota exceeded or storage blocked: keep playing on the in-memory copy.
            writeFailed = true;
        }
    }

    load();

    return {
        get data() { return data; },
        get storageAvailable() { return available; },
        get lastLoadWasCorrupt() { return lastLoadWasCorrupt; },
        get lastWriteFailed() { return writeFailed; },

        updateRecords({ score, waveReached, mode }) {
            data.bestScore = Math.max(data.bestScore, clampInt(score, 0, MAX_NUM, 0));
            if (mode === 'endless') {
                data.bestEndlessWave = Math.max(data.bestEndlessWave, clampInt(waveReached, 0, 999, 0));
            } else {
                data.bestCampaignWave = Math.max(data.bestCampaignWave, clampInt(waveReached, 0, 999, 0));
            }
            persist();
        },

        updateAfterRun({ score, waveReached, mode }) {
            data.runsPlayed = clampInt(data.runsPlayed + 1, 0, 1e6, 0);
            this.updateRecords({ score, waveReached, mode });
        },

        setSetting(key, value) {
            if (!(key in data.settings)) return;
            if (key === 'musicVolume' || key === 'sfxVolume') {
                data.settings[key] = clampNum(value, 0, 1, data.settings[key]);
            } else {
                data.settings[key] = asBool(value, data.settings[key]);
            }
            persist();
        },

        getSettings() {
            return { ...data.settings };
        },

        getRecords() {
            return {
                bestScore: data.bestScore,
                bestCampaignWave: data.bestCampaignWave,
                bestEndlessWave: data.bestEndlessWave,
                runsPlayed: data.runsPlayed,
            };
        },

        // Test/debug hook: wipe persisted data (with confirmation in UI).
        reset() {
            data = defaultSaveData();
            lastLoadWasCorrupt = false;
            if (storage) {
                try { storage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
            }
            persist();
        },
    };
}
