export class BoundedPool<T> {
    readonly #capacity: number;
    readonly #factory: () => T;
    readonly #slots: Array<{ value: T; active: boolean }> = [];
    #activeCount = 0;

    constructor(capacity: number, factory: () => T) {
        this.#capacity = Math.max(0, Math.floor(capacity));
        this.#factory = factory;
    }

    acquire(): T | null {
        for (const slot of this.#slots) {
            if (!slot.active) {
                slot.active = true;
                this.#activeCount += 1;
                return slot.value;
            }
        }
        if (this.#slots.length >= this.#capacity) {
            return null;
        }
        const value = this.#factory();
        this.#slots.push({ value, active: true });
        this.#activeCount += 1;
        return value;
    }

    release(value: T): void {
        for (const slot of this.#slots) {
            if (slot.value === value && slot.active) {
                slot.active = false;
                this.#activeCount -= 1;
                return;
            }
        }
    }

    clear(): void {
        for (const slot of this.#slots) {
            slot.active = false;
        }
        this.#activeCount = 0;
    }

    forEachActive(callback: (value: T) => void): void {
        for (const slot of this.#slots) {
            if (slot.active) {
                callback(slot.value);
            }
        }
    }

    get activeCount(): number {
        return this.#activeCount;
    }
}
