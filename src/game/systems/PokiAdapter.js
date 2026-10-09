// PokiAdapter: official Poki SDK lifecycle wrapper.
// Pure module (injectable SDK) so the event state machine is unit testable.
//
// Contract (developers.poki.com, SDK overview + HTML5 guide):
//   init()                   -> resolve when ready; load the game either way
//   gameLoadingFinished()    -> once, when loading genuinely completed
//   gameplayStart()          -> on first actual gameplay input / unpause
//   gameplayStop()           -> on any gameplay interruption (pause, death,
//                               wave end, quit to menu)
//   commercialBreak()        -> at natural stops, before heading back into
//                               gameplay. Not every call shows an ad.
//   rewardedBreak()          -> player-opt-in reward; only grant on success.
//
// Rules enforced here:
//   - no duplicate/consecutive gameplayStart or gameplayStop
//   - no gameplay events while an ad break is active
//   - gameLoadingFinished fires exactly once, after init settles
//   - dev fallback (SDK unavailable) NEVER fakes ad success

export function createPokiAdapter(getSdk, { logger = console } = {}) {
    let initStatus = 'idle'; // idle | pending | ready
    let usingFallback = false;
    let sdk = null;
    let playing = false;
    let adActive = false;
    let loadingFinishedSent = false;
    let pendingLoadingFinished = false;
    const eventLog = [];
    let seq = 0;

    function logEvent(name) {
        seq += 1;
        eventLog.push({ seq, name, playing, adActive });
        if (eventLog.length > 200) eventLog.shift();
    }

    function guarded(name, fn) {
        // No gameplay events may fire while an ad break is running.
        if (adActive) {
            logger.debug?.(`[PokiAdapter] blocked ${name} during ad break`);
            return false;
        }
        fn();
        return true;
    }

    function init() {
        if (initStatus !== 'idle') return;
        initStatus = 'pending';
        try {
            sdk = getSdk ? getSdk() : undefined;
        } catch {
            sdk = undefined;
        }

        const settle = () => {
            initStatus = 'ready';
            if (pendingLoadingFinished) {
                pendingLoadingFinished = false;
                gameLoadingFinished();
            }
        };

        if (!sdk || typeof sdk.init !== 'function') {
            usingFallback = true;
            logger.debug?.('[PokiAdapter] SDK unavailable - development fallback active (no ads, no fake rewards)');
            settle();
            return;
        }

        try {
            sdk.init().then(settle, () => {
                // Documented behavior: "load your game anyway" on init failure.
                usingFallback = true;
                settle();
            });
        } catch {
            usingFallback = true;
            settle();
        }
    }

    function gameLoadingFinished() {
        if (loadingFinishedSent) return false;
        if (initStatus !== 'ready') {
            pendingLoadingFinished = true;
            return false;
        }
        loadingFinishedSent = true;
        logEvent('gameLoadingFinished');
        if (!usingFallback && typeof sdk?.gameLoadingFinished === 'function') {
            try { sdk.gameLoadingFinished(); } catch (err) { logger.debug?.('[PokiAdapter] gameLoadingFinished failed', err); }
        }
        return true;
    }

    function gameplayStart() {
        if (initStatus !== 'ready' || adActive || playing) return false;
        playing = true;
        logEvent('gameplayStart');
        if (!usingFallback && typeof sdk?.gameplayStart === 'function') {
            try { sdk.gameplayStart(); } catch { /* platform error must not break gameplay */ }
        }
        return true;
    }

    function gameplayStop() {
        if (initStatus !== 'ready' || adActive || !playing) return false;
        playing = false;
        logEvent('gameplayStop');
        if (!usingFallback && typeof sdk?.gameplayStop === 'function') {
            try { sdk.gameplayStop(); } catch { /* ignore */ }
        }
        return true;
    }

    // muteCallback: Poki may call it when the ad actually starts.
    // onDone: always called once the break is over (or immediately in fallback).
    function commercialBreak(onDone, muteCallback) {
        if (initStatus !== 'ready' || adActive) return false;
        if (!usingFallback && typeof sdk?.commercialBreak === 'function') {
            adActive = true;
            try {
                sdk.commercialBreak(muteCallback).then(() => {
                    adActive = false;
                    onDone?.();
                }, () => {
                    adActive = false;
                    onDone?.();
                });
                return true;
            } catch {
                adActive = false;
            }
        }
        // Fallback / SDK blocked: proceed with no ad. Never a fake ad.
        logger.debug?.('[PokiAdapter] commercialBreak fallback (no ad shown)');
        onDone?.();
        return true;
    }

    // onResult(success: boolean). Fallback ALWAYS reports failure.
    function rewardedBreak(onResult, muteCallback) {
        if (initStatus !== 'ready' || adActive) {
            onResult?.(false);
            return false;
        }
        if (!usingFallback && typeof sdk?.rewardedBreak === 'function') {
            adActive = true;
            try {
                sdk.rewardedBreak(muteCallback).then((success) => {
                    adActive = false;
                    onResult?.(!!success);
                }, () => {
                    adActive = false;
                    onResult?.(false);
                });
                return true;
            } catch {
                adActive = false;
            }
        }
        logger.debug?.('[PokiAdapter] rewardedBreak fallback (no reward granted)');
        onResult?.(false);
        return false;
    }

    return {
        init,
        gameLoadingFinished,
        gameplayStart,
        gameplayStop,
        commercialBreak,
        rewardedBreak,
        isPlaying: () => playing,
        isAdActive: () => adActive,
        isReady: () => initStatus === 'ready',
        usingFallback: () => usingFallback,
        getEventLog: () => [...eventLog],
        // Test/inspection support: the documented order is enforced by guards.
        getSummary: () => ({
            status: initStatus,
            playing,
            adActive,
            usingFallback,
            events: eventLog.map(e => e.name),
        }),
    };
}
