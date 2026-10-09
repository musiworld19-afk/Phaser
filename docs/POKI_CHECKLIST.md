# Poki Submission Checklist

Prepared for submitting ECHOFLUX: RIFTBREAK ARENA to
[developers.poki.com](https://developers.poki.com), following the current
official requirements (fetched and reviewed during development).

## 1. Hard requirements — self-audit

| Requirement | Status | Evidence |
|---|---|---|
| Desktop, mobile, tablet support | done | keyboard + touch flows verified in `e2e/smoke.mjs`; touch controls are capability-detected (`pointer: coarse` / `maxTouchPoints`), not UA-based, so tablets get touch controls |
| 16:9, scale to cover the canvas | done | 1280×720 game, `Scale.FIT` + `CENTER_BOTH`; parent container is explicitly viewport-sized so non-16:9 screens letterbox correctly (verified at 844×390 in E2E) |
| Incognito support | done | all `localStorage` access wrapped; storage-blocked environments fall back to in-memory defaults (unit-tested: `tests/save.test.js`) |
| No external requests | done | the only external request is the official Poki SDK script tag (permitted). The upstream template's `log.js` telemetry was removed for exactly this reason |
| No branding / external ads / splash | done | no splash screens, no outgoing links, no third-party ad systems |
| No ad-block prevention | done | game is fully playable with the SDK blocked; the adapter's fallback grants no rewards and fakes nothing |
| Clean build | done | no debug overlays, dev tools, or test interfaces in the release experience. The only test surface is a URL-parameter-gated state probe (see §4) with no player-facing impact |
| Save system | done | versioned, validated, corruption-recovering local saves; game informs players implicitly by always working |
| Small file size | reviewed | ~1.5 MB total (1.35 MB is the Phaser engine chunk, ~110 KB game code, ~2 KB CSS/HTML). No image or audio assets to download |
| Keyboard pause | done | ESC and P pause/resume; correct SDK events fire in that flow |
| Skippable cutscenes | done | boss intros (~2.6s) are skippable by tap/keypress, and self-dismiss |
| Visual, intuitive tutorial | done | 3-step interactive tutorial (move / auto-fire / shift reality), skippable, plus a permanent How to Play screen |

## 2. SDK event contract — implementation map

| SDK call | Where | Guarded by |
|---|---|---|
| `init()` | `PokiAdapter.init()` (called at bootstrap) | once-only; either resolve path continues the game |
| `gameLoadingFinished()` | `MainMenu.create()` | fired exactly once; auto-deferred until init settles |
| `gameplayStart()` | first gameplay input; resume; wave begin; revive; boss intro end | no duplicate/consecutive starts; blocked during ad breaks |
| `gameplayStop()` | pause open; wave clear; boss defeat; death; victory; quit; boss intro start; tab hidden (auto-pause) | no duplicate/consecutive stops; blocked during ad breaks |
| `commercialBreak()` | resume-from-pause, next-wave transition, restart | only when heading back into gameplay; audio muted via the SDK mute callback and restored after; no internal ad timers |
| `rewardedBreak()` | optional Second Chance revive on the death screen | reward granted **only** on SDK success; failure returns to the defeat panel; standard END RUN button is equal-sized and adjacent (never green reward button, prominent ► icon + explicit "watch an ad" sublabel) |

The full ordering contract (startup, death→restart, death→revive, pause cycle)
is unit-tested in `tests/poki.test.js` — including "no duplicate events",
"events blocked mid-ad", and "fallback never fakes a reward".

## 3. Inspector test plan (run before requesting review)

1. Build: `npm run build`
2. Drag the `dist/` folder into https://inspector.poki.dev
3. Verify in the event log:
   - `gameLoadingFinished` fires once, shortly after load
   - `gameplayStart` fires on the first movement key/joystick touch — not on page load
   - Pause/resume produces exactly `stop → commercialBreak → start`
   - Death + restart produces `stop → commercialBreak → start`
   - Death + Second Chance produces `stop → rewardedBreak → start` and only
     grants the revive when the SDK reports success
   - Wave-clear → upgrade → confirm produces `stop → commercialBreak → start`
   - No consecutive duplicate events anywhere; no events during midrolls
4. Check the mobile preview: Poki Pill does not overlap the pause button
   (top-right corner is 48px, pill is top-center). If a specific device
   overlaps, call `PokiSDK.movePill(0, 24)` from the game or adjust before
   resubmitting.
5. Let a commercial break fire and confirm: gameplay frozen, audio muted,
   input ignored, state restored cleanly afterward.

## 4. Test-harness disclosure

Appending `?qa=1` to the URL exposes a minimal, inert state probe
(`window.__echoflux`) used by this repository's automated E2E suite to drive
and observe flows. It adds no UI, cannot affect gameplay unless explicitly
invoked from the console, and is not linked anywhere in the game. Remove the
`qa` blocks in `src/game/core/Context.js` and `src/game/scenes/Game.js`
(`installQaHooks` / `updateQaState`) before submission if you want a zero-
probe build; the game is otherwise identical.

## 5. Submission media

- **Static thumbnail (1920×1080 PNG)**: `submission/thumbnail.png`
  (source: `submission/thumbnail.html`; re-render at any time with
  `google-chrome --headless --screenshot=submission/thumbnail.png \
   --window-size=1920,1080 submission/thumbnail.html`)
- **Animated thumbnail**: Poki also requests an animated/MP4/GIF variant for
  global release. Recommended capture: record ~15s of gameplay at the second
  arena with phase-switching visible (e.g., OBS at 1920×1080), trim to the
  6–15s spec in the official game thumbnail guide.
- **Extra previews**: `submission/menu-preview.png`,
  `submission/gameplay-preview.png`, and the full state gallery in
  `e2e/screenshots/`.

## 6. Pre-submission smoke

```bash
npm test          # 70/70 unit tests must pass
npm run build     # production build
npm run test:e2e  # full headless flow suite — must print ALL CHECKS PASSED
```

Then upload `dist/` via the Poki for Developers dashboard or
`poki-cli push dist`.
