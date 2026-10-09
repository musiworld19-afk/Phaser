// EventBus: minimal typed-ish pub/sub used to decouple gameplay, HUD, and platform layers.
export class EventBus {
    constructor() {
        this._listeners = new Map();
        this._onceWrappers = new Map();
    }

    on(event, fn) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }

    once(event, fn) {
        const off = this.on(event, (...args) => {
            off();
            fn(...args);
        });
        return off;
    }

    off(event, fn) {
        const set = this._listeners.get(event);
        if (set) {
            set.delete(fn);
            if (set.size === 0) this._listeners.delete(event);
        }
    }

    emit(event, ...args) {
        const set = this._listeners.get(event);
        if (!set) return false;
        for (const fn of [...set]) {
            try {
                fn(...args);
            } catch (err) {
                // A broken listener must never take down the game loop.
                console.error(`[EventBus] listener error on "${event}"`, err);
            }
        }
        return set.size > 0;
    }

    removeAll() {
        this._listeners.clear();
    }

    listenerCount(event) {
        return this._listeners.get(event)?.size ?? 0;
    }
}
