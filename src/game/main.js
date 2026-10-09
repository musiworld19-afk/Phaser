import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game as ArenaGame } from './scenes/Game';
import { AUTO, Game, Scale } from 'phaser';

// 16:9 presentation baseline (Poki requirement: proportional 16:9 scaling).
// Scale.FIT letterboxes to the page background; HUD keeps inside safe margins.
const config = {
    type: AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#05070f',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        ArenaGame,
    ],
};

export function createGame(parent, ctx) {
    const game = new Game({ ...config, parent });
    game.registry.set('ctx', ctx);
    return game;
}
