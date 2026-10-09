// Boot: all art is generated procedurally here (no files to download), then
// the Preloader takes over for the title/loading beat.

import { Scene } from 'phaser';
import { buildAllTextures } from '../gfx/TextureFactory.js';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        buildAllTextures(this);
        this.scene.start('Preloader');
    }
}
