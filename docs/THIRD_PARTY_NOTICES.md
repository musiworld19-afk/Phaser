# Third-Party Notices & Asset Inventory

ECHOFLUX: RIFTBREAK ARENA — license and attribution inventory.

## 1. This repository's code

- The game implementation (everything under `src/`, `tests/`, `e2e/`) is
  **original work written for this project**.
- Distributed under the MIT license — see the repository `LICENSE` file.
  The LICENSE file's notice text originates from the upstream starter
  repository (see §2) and is preserved as required by its MIT terms.

## 2. Upstream starter: Phaser + Vite template

- Source: `github.com/phaserjs/template-vite` (MIT, © 2025 Phaser Studio Inc.)
- What was retained: the Vite build configuration pattern (`vite/config.*.mjs`
  scripts), the `package.json` tooling structure, and the general bootstrap
  shape (`src/main.js` → `src/game/main.js` → scenes).
- What was replaced: all template demo scenes, placeholder assets
  (`public/assets/bg.png`, `logo.png`), the template's `log.js` telemetry
  (removed because its runtime request to `gryzor.co` violates Poki's
  "no external requests" hard requirement — removal is documented in the
  upstream README itself), the favicon, the CSS, and the page title/branding.
- The original MIT LICENSE notice is preserved in this repository.

## 3. Runtime dependencies

| Dependency | Version | License | Role | Bundled in dist/ |
|---|---|---|---|---|
| phaser | 4.0.0 | MIT (© Phaser Studio Inc) | game engine | yes (`assets/phaser-*.js`) |
| Poki SDK | v2 script tag | Poki for Developers terms | platform ads/events | loaded from `game-cdn.poki.com` (the single permitted external request) |

No other runtime requests are made. All game assets are generated at runtime
by this project's own code (`src/game/gfx/TextureFactory.js`,
`src/game/systems/AudioSystem.js`).

## 4. Development dependencies (never shipped)

| Dependency | Version | License | Role |
|---|---|---|---|
| vite | ^6.3.1 | MIT | bundler/dev server |
| terser | ^5.39.0 | MIT | minifier (used by the vite build) |
| playwright-core | ^1.64.0 | Apache-2.0 | headless E2E testing (drives the system Chrome binary) |

## 5. Asset inventory (shipped)

| Asset | Origin | License status |
|---|---|---|
| All in-game textures | Generated procedurally at boot by `TextureFactory.js` | original — no third-party rights implicated |
| All sound effects & music | Synthesized at runtime via WebAudio by `AudioSystem.js` | original |
| `public/favicon.svg` | created for this project | original |
| `submission/thumbnail.*` | created for this project (HTML/CSS art, PNG rendered via headless Chrome) | original |
| `submission/*-preview.png` | captured from the running game by this project's E2E suite | original |
| Fonts | system font stacks only (`Arial Black`, `Segoe UI`, sans-serif fallbacks); **no font files are bundled** | n/a |

## 6. Statement of originality

The game design, title, mechanics (reality switching with destabilization
anti-camp, the phase damage matrix, Overdrive, the three boss encounters, the
24-augment draft, endless sectors), all code implementing them, and all visual
and audio output are original to this project. No characters, levels, art,
audio, branding, or proprietary assets from any other game are referenced or
included.
