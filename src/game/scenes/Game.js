// Game: the arena. One authoritative run state, an explicit UI state machine
// (creating -> playing / boss-intro / paused / ad-break / upgrade / ended),
// manual object pools (no Phaser groups, no physics), and every gameplay
// timer driven by a single delta accumulator that freezes with the game.

import * as Phaser from 'phaser';
import { BALANCE } from '../core/Balance.js';
import { PALETTE, HEX } from '../core/Palette.js';
import { createRunState } from '../core/RunState.js';
import { isCampaignVictoryWave, hasNextWave } from '../core/Waves.js';
import { rollUpgrades, applyUpgrade } from '../systems/Upgrades.js';
import { addScore, waveClearBonus, moteGain } from '../systems/ScoreSystem.js';
import { WaveDirector } from '../systems/WaveDirector.js';
import { InputSystem } from '../systems/InputSystem.js';
import { ArenaBackground } from '../gfx/ArenaBackground.js';
import { Fx } from '../gfx/Fx.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { Mote } from '../entities/Pickup.js';
import { Hazard } from '../entities/Hazard.js';
import { HUD } from '../ui/HUD.js';
import { UpgradeUI } from '../ui/UpgradeUI.js';
import { PauseUI } from '../ui/PauseUI.js';
import { SettingsUI } from '../ui/SettingsUI.js';
import { TutorialUI } from '../ui/TutorialUI.js';
import { EndRunUI } from '../ui/EndRunUI.js';

const W = BALANCE.world.width;
const H = BALANCE.world.height;

class Pool {
    constructor(factory) {
        this.factory = factory;
        this.free = [];
    }
    get() {
        return this.free.pop() ?? this.factory();
    }
    release(obj) {
        this.free.push(obj);
    }
}

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    init(data) {
        this.mode = data?.mode === 'endless' ? 'endless' : 'campaign';
    }

    create() {
        this.ctx = this.registry.get('ctx');
        this.uiState = 'creating';
        this.reducedMotion = this.ctx.save.getSettings().reducedMotion;
        this.hasHadGameplay = false;
        this.runRecorded = false;
        this.pendingBoss = null;
        this.boss = null;
        this.bossInstance = null;

        this.run = createRunState(this.mode);
        this.enemies = [];
        this.bolts = [];
        this.enemyBolts = [];
        this.motes = [];
        this.hazards = [];

        this.enemyPool = new Pool(() => {
            const e = new Enemy(this);
            this.add.existing(e);
            return e;
        });
        this.boltPool = new Pool(() => {
            const b = this.add.image(0, 0, 'bolt-player').setActive(false).setVisible(false).setDepth(18);
            return b;
        });
        this.enemyBoltPool = new Pool(() => {
            const b = this.add.image(0, 0, 'bolt-cyan').setActive(false).setVisible(false).setDepth(17);
            return b;
        });
        this.motePool = new Pool(() => {
            const m = new Mote(this);
            this.add.existing(m);
            return m;
        });
        this.hazardPool = new Pool(() => new Hazard(this));

        this.arenaIndex = -1;
        this.background = null;

        this.fx = new Fx(this, this.reducedMotion);

        this.player = new Player(this, 640, 430, this);
        this.add.existing(this.player);

        this.inputSystem = new InputSystem(this, {
            onSwitch: () => { if (this.uiState === 'playing') this.player.trySwitch(); },
            onPause: () => this.onPressPause(),
            onFirstInput: () => this.ensureGameplayStarted(),
        });

        this.hud = new HUD(this, this.ctx, { touchMode: this.inputSystem.touchMode, mode: this.mode });
        this.upgradeUI = new UpgradeUI(this, this.ctx, (def) => this.onUpgradePicked(def));
        this.pauseUI = new PauseUI(this, this.ctx, {
            onResume: () => this.resumeFromPause(),
            onSettings: () => this.settingsUI.show(),
            onRestart: () => this.restartRun(),
            onQuit: () => this.quitToMenu(),
        });
        this.settingsUI = new SettingsUI(this, this.ctx, { fromMenu: false });
        this.endRunUI = new EndRunUI(this, this.ctx, {
            onRevive: () => this.requestRevive(),
            onRestart: () => this.restartRun(),
            onMenu: () => this.quitToMenu(),
            onContinueEndless: () => this.continueEndless(),
        });
        this.tutorial = new TutorialUI(this, this.ctx, () => { /* completion persisted inside */ });

        const bus = this.ctx.bus;
        this._unsubs = [
            bus.on('player-died', () => this.onPlayerDied()),
            bus.on('enemy-killed', () => this.tutorial?.notifyKill()),
            bus.on('phase-changed', () => this.tutorial?.notifySwitch()),
            bus.on('boss-defeated', () => this.onBossDefeated()),
        ];

        this._onVisibility = () => {
            const hidden = document.hidden;
            this.ctx.audio.setHidden(hidden);
            if (hidden && this.uiState === 'playing') {
                this.openPause();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibility);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

        this.waveDirector = new WaveDirector(this);
        this.uiState = 'playing';
        this.inputSystem.setGameplayEnabled(true);
        this.waveDirector.startWave(0);

        if (this.mode === 'campaign' && !this.ctx.save.getSettings().seenTutorial) {
            this.tutorial.begin();
        }

        this.ctx.audio.startMusic(0);

        if (this.ctx.qa) {
            this.installQaHooks();
        }
        this.lastMoteSfx = 0;
        this.qaTick = 0;
    }

    // ------------------------------------------------------------ pools

    spawnEnemy(kind, phase, x, y, elite = false) {
        if (this.enemies.length >= BALANCE.limits.maxEnemies) return null;
        const e = this.enemyPool.get();
        e.spawn(kind, phase, x, y, {
            elite,
            hpMult: this.waveDirector?.def?.hpMult ?? 1,
            speedMult: this.waveDirector?.def?.speedMult ?? 1,
        });
        this.enemies.push(e);
        this.fx.burst(x, y, phase === 'cyan' ? PALETTE.cyan : PALETTE.amber, 5);
        return e;
    }

    spawnEnemyAtEdge(kind, elite, def) {
        const phase = Math.random() < 0.5 ? 'cyan' : 'amber';
        const side = Math.floor(Math.random() * 4);
        const m = 46;
        let x, y;
        if (side === 0) { x = m + Math.random() * (W - 2 * m); y = m; }
        else if (side === 1) { x = W - m; y = m + Math.random() * (H - 2 * m); }
        else if (side === 2) { x = m + Math.random() * (W - 2 * m); y = H - m; }
        else { x = m; y = m + Math.random() * (H - 2 * m); }
        return this.spawnEnemy(kind, phase, x, y, elite);
    }

    spawnPlayerBolt(x, y, angle, opts) {
        if (this.bolts.length >= BALANCE.limits.maxBolts) return;
        const b = this.boltPool.get();
        b.setTexture(opts.heavy ? 'bolt-heavy' : 'bolt-player');
        b.setPosition(x, y).setActive(true).setVisible(true).setRotation(angle);
        if (opts.heavy) b.setScale(1.2); else b.setScale(1);
        const sp = BALANCE.player.boltSpeed * (opts.heavy ? 0.85 : 1);
        b.vx = Math.cos(angle) * sp;
        b.vy = Math.sin(angle) * sp;
        b.damage = opts.damage;
        b.crit = opts.crit;
        b.pierce = opts.pierce ?? 0;
        b.ricochetLeft = opts.ricochet ? 1 : 0;
        b.homing = opts.homing ?? 0;
        b.slow = !!opts.slow;
        b.life = BALANCE.player.boltLife;
        b.hitList = [];
        this.bolts.push(b);
    }

    spawnEnemyBolt(x, y, angle, { phase, speed, damage, homing = false, piercePhase = false }) {
        if (this.enemyBolts.length >= BALANCE.limits.maxBolts) return;
        const b = this.enemyBoltPool.get();
        b.setTexture(phase === 'white' ? 'bolt-pierce' : phase === 'cyan' ? 'bolt-cyan' : 'bolt-amber');
        b.setPosition(x, y).setActive(true).setVisible(true).setRotation(angle).setScale(1.1);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.phase = phase;
        b.damage = damage;
        b.homing = homing;
        b.piercePhase = piercePhase;
        b.life = 4.0;
        this.enemyBolts.push(b);
    }

    spawnMote(x, y, phase) {
        if (this.motes.length >= BALANCE.limits.maxMotes) return;
        const m = this.motePool.get();
        m.spawn(phase,
            x + (Math.random() * 24 - 12),
            y + (Math.random() * 24 - 12));
        this.motes.push(m);
    }

    spawnHazard(x, y, phase, radius, _source) {
        let h = this.hazards.find(z => !z.active);
        if (!h) {
            if (this.hazards.length >= BALANCE.limits.maxHazards) return;
            h = this.hazardPool.get();
            this.hazards.push(h);
        }
        h.spawn(phase, x, y, radius || BALANCE.hazards.radius);
    }

    // ------------------------------------------------------------ world facade

    addScore(amount) {
        const before = this.ctx.save.getRecords().bestScore;
        addScore(this.run, amount);
        this.ctx.bus.emit('score-changed', this.run.score,
            this.run.score > before && this.run.score > 0);
    }

    collectMote(mote) {
        const run = this.run;
        run.motes += 1;
        run.rift += 1;
        this.addScore(moteGain(run.stats));
        this.ctx.bus.emit('rift-changed');
        if (run.runTime - this.lastMoteSfx > 0.05) {
            this.lastMoteSfx = run.runTime;
            this.ctx.audio.play('mote');
        }
        if (run.rift >= BALANCE.player.motesToOverdrive) {
            run.rift = 0;
            run.overdriveUntil = run.runTime + BALANCE.player.overdriveDuration;
            this.ctx.audio.play('overdrive');
            this.ctx.bus.emit('overdrive-started');
            this.fx.ring(this.player.x, this.player.y, PALETTE.gold, 160, 500);
        }
    }

    contactHit(source, damage) {
        this.player.applyDamage(damage);
    }

    shockwave(x, y, radius, damage) {
        this.fx.ring(x, y, PALETTE.violet, radius * 2.2, 420);
        const run = this.run;
        for (const e of this.enemies) {
            if (!e.active || e.dead || e.phase !== run.phase) continue;
            if (Math.hypot(e.x - x, e.y - y) <= radius + e.hitRadius) {
                e.takeDamage(damage, false, this);
            }
        }
        for (const b of this.enemyBolts) {
            if (!b.active) continue;
            if (Math.hypot(b.x - x, b.y - y) <= radius) {
                b.life = 0;
            }
        }
    }

    cameraShake(intensity, duration) {
        if (this.reducedMotion) return;
        this.cameras.main.shake(duration, intensity);
    }

    // ------------------------------------------------------------ main loop

    update(time, delta) {
        const dt = Math.min(delta / 1000, BALANCE.limits.dtCap);

        if (this.uiState === 'playing') {
            this.run.runTime += dt;
            this.background?.update(dt);
            this.player.update(dt);
            this.stepEnemies(dt);
            this.stepBolts(dt);
            this.stepEnemyBolts(dt);
            this.stepMotes(dt);
            this.stepHazards(dt);
            if (this.boss && !this.boss.dead) this.boss.update(dt, this);
            this.waveDirector.update(dt);
            this.tutorial?.update();
            this.hud.update(dt);
            if (this.inputSystem.touchMode) {
                const cd = Phaser.Math.Clamp(
                    (this.run.switchReadyAt - this.run.runTime) / this.run.stats.switchCooldown, 0, 1);
                this.inputSystem.setPhaseVisual(this.run.phase, 1 - cd);
            }
        } else if (this.uiState === 'boss-intro') {
            this.background?.update(dt);
            this.stepBossIntro(dt);
            this.hud.update(dt);
        } else if (this.uiState === 'ended') {
            this.background?.update(dt);
            this.hud.update(dt);
        }
        // QA state must stay live across every UI state (E2E asserts on it).
        this.updateQaState(delta);
        this.fx.update(delta);
    }

    stepEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active || e.dead) {
                this.enemies.splice(i, 1);
                this.enemyPool.release(e);
                continue;
            }
            e.update(dt, this);
            if (e.x < -160 || e.x > W + 160 || e.y < -160 || e.y > H + 160) {
                e.despawn();
                this.enemies.splice(i, 1);
                this.enemyPool.release(e);
            }
        }
    }

    nearestEnemyFrom(x, y, range, exclude) {
        let best = null, bestD = range * range;
        for (const e of this.enemies) {
            if (e.dead || !e.active || e.phase !== this.run.phase) continue;
            if (exclude && exclude.includes(e)) continue;
            const d = (e.x - x) ** 2 + (e.y - y) ** 2;
            if (d < bestD) { bestD = d; best = e; }
        }
        const boss = this.boss;
        if (boss && !boss.dead && boss.vulnPhase === this.run.phase &&
            (!exclude || !exclude.includes(boss))) {
            const d = (boss.x - x) ** 2 + (boss.y - y) ** 2;
            if (d < bestD) best = boss;
        }
        return best;
    }

    stepBolts(dt) {
        const run = this.run;
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            b.life -= dt;
            if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) {
                this.retireBolt(b, i);
                continue;
            }
            if (b.homing > 0) {
                const target = this.nearestEnemyFrom(b.x, b.y, 420, b.hitList);
                if (target) {
                    const desired = Math.atan2(target.y - b.y, target.x - b.x);
                    const current = Math.atan2(b.vy, b.vx);
                    const turn = 3.4 * b.homing * dt;
                    const next = Phaser.Math.Angle.RotateTo(current, desired, turn);
                    const sp = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(next) * sp;
                    b.vy = Math.sin(next) * sp;
                    b.setRotation(next);
                }
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            let consumed = false;
            for (const e of this.enemies) {
                if (e.dead || !e.active || e.phase !== run.phase) continue;
                if (b.hitList.includes(e)) continue;
                if (Math.hypot(e.x - b.x, e.y - b.y) < e.hitRadius + 5) {
                    b.hitList.push(e);
                    e.takeDamage(b.damage, b.crit, this);
                    if (b.slow) e.applySlow(this);
                    if (b.pierce > 0) { b.pierce -= 1; continue; }
                    if (b.ricochetLeft > 0) {
                        b.ricochetLeft -= 1;
                        const nt = this.nearestEnemyFrom(b.x, b.y, 340, b.hitList);
                        if (nt) {
                            const a = Math.atan2(nt.y - b.y, nt.x - b.x);
                            const sp = Math.hypot(b.vx, b.vy);
                            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.setRotation(a);
                            break;
                        }
                    }
                    consumed = true;
                    break;
                }
            }
            if (!consumed && this.boss && !this.boss.dead &&
                this.boss.vulnPhase === run.phase && !b.hitList.includes(this.boss)) {
                if (Math.hypot(this.boss.x - b.x, this.boss.y - b.y) < this.boss.displayRadius + 6) {
                    b.hitList.push(this.boss);
                    this.boss.takeDamage(b.damage, b.crit, this);
                    if (b.pierce > 0) b.pierce -= 1;
                    else consumed = true;
                }
            }
            if (consumed) this.retireBolt(b, i);
        }
    }

    retireBolt(b, idx) {
        b.setActive(false).setVisible(false);
        this.bolts.splice(idx, 1);
        this.boltPool.release(b);
    }

    stepEnemyBolts(dt) {
        const run = this.run;
        const player = this.player;
        for (let i = this.enemyBolts.length - 1; i >= 0; i--) {
            const b = this.enemyBolts[i];
            b.life -= dt;
            if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) {
                b.setActive(false).setVisible(false);
                this.enemyBolts.splice(i, 1);
                this.enemyBoltPool.release(b);
                continue;
            }
            if (b.homing) {
                const desired = Math.atan2(player.y - b.y, player.x - b.x);
                const current = Math.atan2(b.vy, b.vx);
                const next = Phaser.Math.Angle.RotateTo(current, desired, 2.4 * dt);
                const sp = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(next) * sp;
                b.vy = Math.sin(next) * sp;
                b.setRotation(next);
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            b.setAlpha(b.piercePhase ? 1 : (b.phase === run.phase ? 1 : 0.35));

            const dist = Math.hypot(player.x - b.x, player.y - b.y);
            if (dist < 16) {
                const harmful = b.piercePhase || b.phase === run.phase;
                if (harmful) {
                    player.applyDamage(b.damage);
                    b.life = 0;
                }
            }
        }
    }

    stepMotes(dt) {
        for (let i = this.motes.length - 1; i >= 0; i--) {
            const m = this.motes[i];
            if (!m.active) {
                this.motes.splice(i, 1);
                this.motePool.release(m);
                continue;
            }
            m.update(dt, this);
        }
    }

    stepHazards(dt) {
        for (const h of this.hazards) {
            if (!h.active) continue;
            h.update(dt, this);
        }
    }

    clearEnemyBolts() {
        for (const b of this.enemyBolts) {
            b.setActive(false).setVisible(false);
            this.enemyBoltPool.release(b);
        }
        this.enemyBolts.length = 0;
        for (const h of this.hazards) h.despawn();
        this.fx.clearTelegraphs();
    }

    ensureArena(arenaIndex) {
        if (this.arenaIndex === arenaIndex) return;
        this.arenaIndex = arenaIndex;
        this.background?.destroy();
        this.background = new ArenaBackground(this, arenaIndex, this.reducedMotion);
        this.background.setPhase(this.run.phase);
        this.ctx.audio.startMusic(arenaIndex);
    }

    // ------------------------------------------------------------ flow

    ensureGameplayStarted() {
        if (this.hasHadGameplay) return;
        if (this.uiState !== 'playing' && this.uiState !== 'boss-intro') return;
        this.hasHadGameplay = true;
        this.ctx.poki.gameplayStart();
    }

    onPressPause() {
        if (this.uiState === 'playing') {
            this.ensureGameplayStarted();
            this.openPause();
        } else if (this.uiState === 'paused') {
            if (this.settingsUI.visible) { this.settingsUI.hide(); return; }
            this.resumeFromPause();
        }
    }

    openPause() {
        if (this.uiState !== 'playing') return;
        this.uiState = 'paused';
        this.inputSystem.setGameplayEnabled(false);
        this.inputSystem.setVisible(false);
        this.ctx.poki.gameplayStop();
        this.ctx.audio.setDucked(true);
        this.pauseUI.show();
    }

    resumeFromPause() {
        if (this.uiState !== 'paused') return;
        this.pauseUI.hide();
        this.ctx.audio.setDucked(false);
        if (this.ctx.poki.isAdActive()) return; // the pending break completion resumes us
        this.uiState = 'ad-break';
        this.ctx.poki.commercialBreak(
            () => {
                this.ctx.audio.setAdMuted(false);
                this.finishResume();
            },
            () => this.ctx.audio.setAdMuted(true)
        );
    }

    finishResume() {
        this.uiState = 'playing';
        this.inputSystem.setGameplayEnabled(true);
        this.inputSystem.setVisible(true);
        this.ctx.poki.gameplayStart();
    }

    onWaveCleared() {
        this.ctx.poki.gameplayStop();
        const bonus = waveClearBonus(this.run.waveIndex, this.run.stats.scoreMult);
        this.addScore(bonus);
        this.banner(`WAVE CLEAR  +${bonus}`);
        this.ctx.audio.play('uiSelect');
        this.offerUpgrades(false);
    }

    onBossDefeated() {
        this.ctx.poki.gameplayStop();
        const bonus = waveClearBonus(this.run.waveIndex, this.run.stats.scoreMult);
        this.addScore(bonus);
        if (this.mode === 'campaign' && isCampaignVictoryWave(this.run.waveIndex, this.mode)) {
            this.onVictory();
            return;
        }
        this.banner('BOSS DOWN');
        this.offerUpgrades(true);
    }

    offerUpgrades(rareBoost) {
        this.uiState = 'upgrade';
        this.inputSystem.setGameplayEnabled(false);
        this.inputSystem.setVisible(false);
        const picks = rollUpgrades(this.run.upgradeCounts, {
            count: BALANCE.run.upgradeChoices,
            rareBoost,
            rng: Math.random,
        });
        this.upgradeUI.show(picks, {
            bonusText: rareBoost ? 'Rare augment unlocked — choose one' : 'Choose one augment to continue',
            takenCounts: this.run.upgradeCounts,
        });
    }

    onUpgradePicked(def) {
        if (def) {
            applyUpgrade(this.run, def.id);
            this.ctx.bus.emit('hp-changed', this.run.hp, this.run.stats.maxHp);
            this.ctx.bus.emit('shield-changed', this.run.shield);
        }
        if (hasNextWave(this.run.waveIndex, this.run.mode)) {
            this.startNextWave();
        } else {
            this.onVictory(); // defensive: endless always continues
        }
    }

    startNextWave() {
        this.uiState = 'ad-break';
        this.clearEnemyBolts();
        this.ctx.poki.commercialBreak(
            () => {
                this.ctx.audio.setAdMuted(false);
                this.beginWave(this.run.waveIndex + 1);
            },
            () => this.ctx.audio.setAdMuted(true)
        );
    }

    beginWave(index) {
        this.uiState = 'playing';
        this.inputSystem.setGameplayEnabled(true);
        this.inputSystem.setVisible(true);
        this.waveDirector.startWave(index);
        this.ctx.poki.gameplayStart();
    }

    // ------------------------------------------------------------ boss intro

    startBossIntro(bossId, bossHpMult = 1) {
        this.pendingBoss = { bossId, bossHpMult };
        this.uiState = 'boss-intro';
        this.bossIntroT = 2.6;
        this.ctx.poki.gameplayStop();
        this.ctx.audio.play('bossWarn');

        this.introTop = this.add.rectangle(640, 50, 1280, 100, 0x05070f, 0.9).setDepth(700);
        this.introBottom = this.add.rectangle(640, 670, 1280, 100, 0x05070f, 0.9).setDepth(700);
        const bossName = BALANCE.bosses[bossId].name;
        this.introTitle = this.add.text(640, 330, bossName, {
            fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '52px', color: HEX.danger,
            stroke: '#05070f', strokeThickness: 8,
        }).setOrigin(0.5).setDepth(701);
        this.introSub = this.add.text(640, 386, 'RIFT SIGNATURE DETECTED', {
            fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: '16px', color: '#aab4d8',
        }).setOrigin(0.5).setDepth(701);

        this._introSkipper = () => this.skipBossIntro();
        this.input.once('pointerdown', this._introSkipper);
        this.input.keyboard?.once('keydown', this._introSkipper);
    }

    stepBossIntro(dt) {
        this.bossIntroT -= dt;
        const pulse = 0.75 + 0.25 * Math.abs(Math.sin(this.bossIntroT * 6));
        this.introTitle?.setAlpha(pulse);
        if (this.bossIntroT <= 0) this.skipBossIntro();
    }

    skipBossIntro() {
        if (this.uiState !== 'boss-intro') return;
        this.input.off('pointerdown', this._introSkipper);
        this.input.keyboard?.off('keydown', this._introSkipper);
        this.introTop?.destroy(); this.introBottom?.destroy();
        this.introTitle?.destroy(); this.introSub?.destroy();
        this.introTop = this.introBottom = this.introTitle = this.introSub = null;
        this.spawnBossNow();
    }

    spawnBossNow() {
        if (!this.bossInstance) {
            this.bossInstance = new Boss(this, this);
            this.add.existing(this.bossInstance);
        }
        this.boss = this.bossInstance;
        this.boss.spawn(this.pendingBoss.bossId, this.pendingBoss.bossHpMult);
        this.run.bossActive = true;
        this.uiState = 'playing';
        this.ctx.poki.gameplayStart();
        this.pendingBoss = null;
    }

    // ------------------------------------------------------------ endings

    recordRun() {
        const before = this.ctx.save.getRecords();
        const isNewBest = this.run.score > before.bestScore && this.run.score > 0;
        if (!this.runRecorded) {
            this.ctx.save.updateAfterRun({
                score: this.run.score,
                waveReached: this.run.waveIndex + 1,
                mode: this.run.mode,
            });
            this.runRecorded = true;
        } else {
            this.ctx.save.updateRecords({
                score: this.run.score,
                waveReached: this.run.waveIndex + 1,
                mode: this.run.mode,
            });
        }
        return { records: this.ctx.save.getRecords(), isNewBest };
    }

    onPlayerDied() {
        if (this.uiState === 'ended') return; // idempotent
        this.uiState = 'ended';
        this.inputSystem.setGameplayEnabled(false);
        this.inputSystem.setVisible(false);
        this.ctx.poki.gameplayStop();
        this.clearEnemyBolts();

        this.player.setVisible(false);
        this.player.aura.setVisible(false);
        this.player.engine.setVisible(false);
        this.fx.burst(this.player.x, this.player.y, PALETTE.danger, 26, true);
        this.fx.ring(this.player.x, this.player.y, PALETTE.danger, 260, 700);
        this.cameraShake(0.014, 400);
        this.cameras.main.flash(300, 120, 10, 30);

        const { records, isNewBest } = this.recordRun();
        this.endRunUI.showDefeat({
            run: this.run,
            records,
            isNewBest,
            canRevive: !this.run.reviveUsed && !this.ctx.poki.usingFallback(),
        });
    }

    requestRevive() {
        this.endRunUI.showRevivePending();
        this.ctx.audio.setAdMuted(true);
        this.ctx.poki.rewardedBreak(
            (success) => {
                this.ctx.audio.setAdMuted(false);
                if (success) {
                    this.run.reviveUsed = true;
                    this.endRunUI.hide();
                    this.player.revive();
                    this.player.setVisible(true);
                    this.player.aura.setVisible(true);
                    this.player.engine.setVisible(true);
                    this.clearEnemyBolts();
                    for (const e of this.enemies) {
                        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 240) e.despawn();
                    }
                    this.fx.ring(this.player.x, this.player.y, PALETTE.good, 300, 800);
                    this.ctx.audio.play('revive');
                    this.uiState = 'playing';
                    this.inputSystem.setGameplayEnabled(true);
                    this.inputSystem.setVisible(true);
                    this.ctx.poki.gameplayStart();
                } else {
                    const { records, isNewBest } = this.recordRun();
                    this.endRunUI.showDefeat({
                        run: this.run, records, isNewBest, canRevive: false,
                    });
                }
            },
            () => this.ctx.audio.setAdMuted(true)
        );
    }

    onVictory() {
        this.uiState = 'ended';
        this.inputSystem.setGameplayEnabled(false);
        this.inputSystem.setVisible(false);
        this.ctx.poki.gameplayStop();
        this.clearEnemyBolts();
        this.cameras.main.flash(400, 255, 240, 120);
        this.fx.ring(640, 360, PALETTE.gold, 700, 1200);
        const { records, isNewBest } = this.recordRun();
        this.endRunUI.showVictory({ run: this.run, records, isNewBest });
    }

    continueEndless() {
        this.endRunUI.hide();
        this.run.mode = 'endless';
        this.mode = 'endless'; // keep restart flows consistent with the run
        this.startNextWave(); // waveIndex 11 -> endless wave 12 (display SECTOR 13)
    }

    restartRun() {
        this.endRunUI.hide();
        this.pauseUI.hide();
        this.uiState = 'ad-break';
        this.ctx.poki.commercialBreak(
            () => {
                this.ctx.audio.setAdMuted(false);
                this.scene.restart({ mode: this.mode });
            },
            () => this.ctx.audio.setAdMuted(true)
        );
    }

    quitToMenu() {
        this.endRunUI.hide();
        this.pauseUI.hide();
        this.settingsUI.hide();
        if (this.ctx.poki.isPlaying()) this.ctx.poki.gameplayStop();
        this.scene.start('MainMenu');
    }

    banner(text) {
        const t = this.add.text(640, 240, text, {
            fontFamily: '"Arial Black", Arial, sans-serif', fontSize: '34px', color: HEX.gold,
            stroke: '#05070f', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(650).setAlpha(0);
        this.tweens.add({
            targets: t,
            alpha: 1, y: 210,
            duration: 260,
            yoyo: true,
            hold: 900,
            onComplete: () => t.destroy(),
        });
    }

    // ------------------------------------------------------------ QA harness (?qa=1)

    installQaHooks() {
        const qa = globalThis.__echoflux;
        if (!qa) return;
        qa.scene = 'Game';
        qa.game = {
            damage: (n) => this.player.applyDamage(n),
            god: (v) => { this.player.god = !!v; },
            killAll: () => {
                for (const e of [...this.enemies]) e.die(this);
                this.waveDirector.forceClear();
            },
            hurtBoss: (n) => {
                if (this.boss && !this.boss.dead) {
                    this.boss.hp -= n;
                    if (this.boss.hp <= 0) this.boss.die(this);
                }
            },
            jumpWave: (n) => {
                for (const e of [...this.enemies]) e.despawn();
                this.enemies.length = 0;
                this.clearEnemyBolts();
                this.uiState = 'playing';
                this.inputSystem.setGameplayEnabled(true);
                this.waveDirector.startWave(n - 1);
            },
            switch: () => this.player.trySwitch(),
        };
    }

    updateQaState(delta) {
        this.qaTick += delta;
        if (this.qaTick < 120) return;
        this.qaTick = 0;
        const qa = globalThis.__echoflux;
        if (!qa) return;
        qa._state = {
            scene: 'Game',
            ui: this.uiState,
            mode: this.run.mode,
            wave: this.run.waveIndex + 1,
            hp: Math.round(this.run.hp),
            score: this.run.score,
            phase: this.run.phase,
            enemies: this.enemies.length,
            boss: this.boss && !this.boss.dead ? Math.round(this.boss.hp) : null,
            started: this.hasHadGameplay,
        };
    }

    cleanup() {
        for (const off of this._unsubs) off();
        document.removeEventListener('visibilitychange', this._onVisibility);
        if (this.ctx.poki.isPlaying()) this.ctx.poki.gameplayStop();
        if (this.ctx.qa && globalThis.__echoflux) {
            globalThis.__echoflux.game = null;
            globalThis.__echoflux._state = null;
        }
    }
}
