import { createGame } from './game/main';
import { createGameContext } from './game/core/Context';

document.addEventListener('DOMContentLoaded', () => {
    const ctx = createGameContext();
    const game = createGame('game-container', ctx);

    if (ctx.qa && typeof window !== 'undefined') {
        window.__echoflux._game = game;
    }

    const dismissSplash = () => {
        const splash = document.getElementById('boot-splash');
        if (splash) splash.classList.add('hidden');
    };

    game.events.once('ready', dismissSplash);
    // Safety net: never leave the splash stuck if the ready event is missed.
    setTimeout(dismissSplash, 4000);
});
