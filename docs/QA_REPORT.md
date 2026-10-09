# QA Report — ECHOFLUX: RIFTBREAK ARENA

Date: 2026-10-09 · Environment: Linux container, Node v22.23.2, npm,
Google Chrome 152 (headless), playwright-core 1.64.0.

This report lists **only checks that were actually executed**, with commands
and observed results. Anything not verifiable in this environment is listed
under "Not verified here".

## 1. Commands run and results

### Production build

```
$ npm run build          # vite build --config vite/config.prod.mjs
✨ Done ✨
```

- Result: **success**. Output: `dist/` (1.5 MB total —
  `assets/phaser-*.js` 1,352,520 B engine chunk, `assets/index-*.js`
  113,669 B game code, `index.html` + `style.css` + `favicon.svg`).
- Bundle composition verified manually: `dist/index.html` contains the Poki
  SDK v2 script tag, the correct title, and hashed local assets only.
- Chunk-size warning is Phaser's engine chunk (>500 kB) — already split
  into its own manual chunk; no runtime cost beyond the single download.

### Unit tests

```
$ npm test               # node --test
# tests 70
# pass 70
# fail 0
```

Coverage: phase damage matrix + destabilization timeline + switch cooldown
floor · combat resolution (i-frames, aegis shield, second wind, idempotent
death rewards, crit math, bulwark frontal arc) · 24 upgrade definitions
(uniqueness, categories, stacking caps, fire-rate cap, cooldown floor,
roll availability, rare-guarantee, reproducible RNG) · wave table (12 waves,
bosses at 4/8/8/12 order, arena progression, non-decreasing difficulty,
valid kinds) · endless generator (monotonic scaling, bounds, deterministic
composition, cycling bosses) · save system (defaults, corrupt JSON, wrong
version, clamped values, round-trip, quota-exceeded, settings validation,
reset) · scoring (accumulation, junk rejection, 1e9 cap, multipliers) ·
Poki adapter state machine (startup order, single loading-finished, no
duplicate start/stop, ad-blocked events, commercial/rewarded ordering,
fallback never grants rewards, init-failure recovery).

### End-to-end (production build, headless Chrome)

```
$ npm run test:e2e      # boots dist/ on a local static server
E2E: ALL CHECKS PASSED  (8/8 assertions, 0 console errors, 0 page errors)
```

Flows actually driven, desktop session (1280×720):

1. Boot → main menu rendered (screenshot `01-menu.png`)
2. ENTER starts campaign — wave 1, cyan reality
3. WASD movement input processed; SPACE switches to amber and back
   (poll-based, cooldown-aware)
4. ESC pauses (state machine shows `paused`), ENTER resumes through the
   commercial-break path (real Poki SDK active in this sandbox — the break
   resolved and gameplay resumed)
5. QA-driven wave clear → upgrade draft UI appears (screenshot `04`),
   hotkey 1 picks an augment, wave 2 starts
6. Pause → keyboard navigation to QUIT → returns to menu
7. New run: fatal damage → defeat panel (screenshot `05`), END RUN → run
   report (screenshot `06`), RESTART → fresh run state (wave 1, HP 100)
8. Jump to wave 12 → boss intro (skippable, screenshot `08`) → THE
   RIFTKEEPER fight live (screenshot `09`) → boss killed → victory panel
   (screenshot `10`) → CONTINUE — ENDLESS → endless mode at wave 13
   (screenshot `11`)

Mobile emulation session (844×390, touch):

9. Menu rendered with correct Scale.FIT letterboxing (canvas 693×390 —
   verified geometrically after fixing the parent-sizing CSS)
10. Touch tap starts campaign; CDP touch-drag exercises the joystick;
    tapping the phase button switches reality (screenshot `13`, `14`)

Screenshots for every state are in `e2e/screenshots/` (14 files).

## 2. Bugs found and fixed during verification

Each of these was discovered by the checks above (not by inspection):

1. **Phaser 4 ignores `defaultPrevented` keydowns** — the Poki page-jump
   snippet's `preventDefault` on Space/arrow made Phaser's KeyboardManager
   drop those events entirely, breaking SPACE and arrow-key movement.
   Fix: removed the keydown clause from the snippet; Phaser's own
   `keyboard.addCapture(...)` already suppresses browser defaults for all
   gameplay keys.
2. **Container hit-areas were in centered space** — `pointWithinHitArea`
   adds `displayOrigin` (w/2, h/2) before testing, so every UI button in a
   container was un-clickable by pointer (keyboard still worked, which is
   why desktop flows passed). Fix: top-left-space hit rectangles in the UI
   kit. Caught by the mobile tap test.
3. **`#game-container` had no explicit size** — on non-16:9 viewports
   Phaser's Scale.FIT received a content-sized parent and the canvas
   overflowed the viewport (828×465 in an 844×390 viewport). Fix:
   absolute-fill CSS for `#app`/`#game-container` (no flex). Caught by the
   mobile session after adding correct MIME types to the test server
   (Chromium silently discards stylesheets served as `text/html`).
4. **Upgrade card crash** — `card is not defined` inside `makeCard` (a
   rename miss); crashed the wave-clear flow. Caught by E2E page-error
   monitoring.
5. **Poki adapter returned misleading booleans** — `gameplayStart/Stop`
   reported success even when a duplicate was suppressed; the unit tests
   caught it and the guards were rewritten.
6. **QA state froze outside `playing`** — the state probe only refreshed
   during gameplay, making pause/upgrade states invisible to the harness;
   also endless mode continued correctly but was reported as campaign
   (scene property vs run property). Both fixed (probe refreshes in every
   state; reports `run.mode`).

## 3. Not verified here (honest gaps)

- **Real-device mobile testing.** The mobile session is Chrome with touch
  emulation, not a physical phone/tablet. Multitouch, safe-area insets on
  notched devices, and orientation-change behavior should be sanity-checked
  on real hardware before publishing.
- **Poki Inspector validation.** The SDK is integrated against the current
  official docs and its state machine is unit-tested; the sandbox even runs
  the real SDK script (dev mode). But the final event-log verification
  happens in the Poki Inspector, which requires uploading the build —
  follow `docs/POKI_CHECKLIST.md` §3.
- **Rewarded revive success path.** The real SDK's rewardedBreak in this
  dev environment never serves a completed rewarded video, so the
  successful-revive branch was verified only at the adapter unit level
  (mock success/failure) plus the failure branch live. Re-check in the
  Inspector.
- **Sustained-performance measurement.** No FPS was measured on real
  hardware; claims of "60 FPS" are therefore **not** made anywhere. Under
  headless SwiftShader (CPU raster) the game visibly runs at a low frame
  rate in this container — that is an environment artifact of software
  GL, but real-GPU performance profiling remains future work.
- **Frame-rate independence** is enforced structurally (all movement uses
  per-frame delta seconds, timers are accumulator-driven, dt is clamped at
  50 ms) and the logic is unit-tested, but no 30-vs-60 fps A/B capture was
  performed on-device.

## 4. Known limitations

- The optional `?qa=1` state probe (documented in the Poki checklist §4)
  ships in the build; it is inert without the parameter and has no UI.
- Boss "flame" and "slam" share one dash implementation (different
  telegraph colors and trail hazards); visually they are distinct attacks
  but not separate code paths.
- Localization: English only (the game is light on text, which keeps this
  a small review surface).

## 5. Reproduction

```bash
npm install
npm test          # expect: # pass 70 / # fail 0
npm run build     # expect: Done, dist/ ~1.5 MB
npm run test:e2e  # expect: E2E: ALL CHECKS PASSED (+ 14 screenshots)
```
