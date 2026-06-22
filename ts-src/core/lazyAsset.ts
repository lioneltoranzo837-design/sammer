export type LazyAssetStatus = 'idle' | 'loading' | 'ready' | 'failed';

export class LazyAsset<T> {
    readonly #loader: () => Promise<T>;
    #promise: Promise<T | undefined> | null = null;
    #status: LazyAssetStatus = 'idle';

    constructor(loader: () => Promise<T>) {
        this.#loader = loader;
    }

    get status(): LazyAssetStatus {
        return this.#status;
    }

    ensure(): Promise<T | undefined> {
        if (this.#promise === null) {
            this.#status = 'loading';
            this.#promise = this.#loader().then(
                value => {
                    this.#status = 'ready';
                    return value;
                },
                () => {
                    this.#status = 'failed';
                    return undefined;
                },
            );
        }
        return this.#promise;
    }
}
