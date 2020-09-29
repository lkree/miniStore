import { clone } from './Utils';

interface IStoreListener<T, K extends Function = Function> {
    key: T;
    cb: K;
}

type TStoreMassCallback<T, K extends keyof T> = ((arg: TMarkedRecord<T, K>) => TMarkedRecord<T, K>);
type TStoreCallback<T, K extends keyof T> = (prop: T[K]) => T[K];
type TMarkedRecord<T, K extends keyof T> = { [U in K]: T[U] };

export class Store<T> {
    private _store: T = {} as T;
    private _listeners: Array<IStoreListener<keyof T>> = [];
    private _default: T = {} as T;

    constructor(defaultValues?: T) {
        if (defaultValues) {
            this
                .configureDefault(defaultValues)
                .restoreDefault();
        }
    }

    configureDefault(defaultData: T): this {
        this._default = clone(defaultData);

        return this;
    }

    restoreDefault(defaultData?: T): this {
        this.clearStore();

        if (defaultData) {
            this.set(defaultData);
        } else {
            this.set(this._default || {});
        }

        return this;
    }

    getAll(): T {
        return this._store;
    }

    setAll(data: T): this {
        this._store = clone(data);

        return this;
    }

    get<K extends keyof T>(keys: K[]): TMarkedRecord<T, K>;
    get<K extends keyof T>(keys: K): T[K];
    get<K extends keyof T>(keys: K | K[]): T[K] | TMarkedRecord<T, K> {
        if (Array.isArray(keys)) {
            const result = {} as TMarkedRecord<T, K>;

            keys.forEach((k) => result[k] = this._get(k));

            return result;
        } else {
            return this._get(keys);
        }
    }

    set<K extends keyof T, U extends T>(data: K[], setState: TStoreMassCallback<U, K>): this;
    set<K extends keyof T, U extends T>(data: Record<K, U[K]>): this;
    set<K extends keyof T>(data: K, setState: TStoreCallback<T, K> | T[K]): this;
    set<K extends keyof T, U extends T>(
        data: Record<K, U[K]> | K,
        setState?: TStoreCallback<T, K> | T[K] | TStoreMassCallback<U, K>
    ): this {
        if (Array.isArray(data)) {
            this._set(data, setState as TStoreMassCallback<U, K>);
        } else if (isRecord<T, K, U>(data)) {
            const keys = Object.keys(data) as K[];

            keys.forEach((k) => {
                this._set(k, data[k]);
            });
        } else if (isRecordKey(data)) {
            this._set(data, setState as TStoreCallback<T, K> | T[K]);
        }

        return this;
    }

    subscribe<K extends keyof T, Z extends Function>(key: K, cb: Z): Function {
        const newListener = { key, cb };

        this._removeListener(key, cb);
        this._addNewListener(newListener);

        return this._removeListener.bind(this, key, cb);
    }

    unsubscribe<K extends keyof T, Z extends Function>(key: K, cb: Z): this {
        this._removeListener(key, cb);

        return this;
    }

    clearStore(): this {
        this._store = {} as T;

        return this;
    }

    clearListeners(): this {
        this._listeners = [];

        return this;
    }

    destroy<K extends keyof T>(type: 'record', key: K): boolean;
    destroy(type: 'store'): boolean;
    destroy<K extends keyof T>(type: 'record' | 'store', key?: K): boolean {
        switch (type) {
            case 'record':
                return delete this._store[key];
            case 'store':
                this._store = null;
                this._listeners = null;
                this._default = null;

                return true;
        }

    }

    private _set<K extends keyof T>(key: K[], setState: TStoreMassCallback<T, K>): void;
    private _set<K extends keyof T>(key: K, setState: TStoreCallback<T, K> | T[K]): void;
    private _set<K extends keyof T>(
        key: K | K[],
        setState: TStoreCallback<T, K> | T[K] | TStoreMassCallback<T, K>
    ): void {
        let haveToNotify: boolean = false;
        let state: T[K] = null;

        if (Array.isArray(key)) {
            const data = this.get(key);

            this._store = clone({
                ...this._store,
                ...(setState as TStoreMassCallback<T, K>)(data)
            });

            haveToNotify = true;
        } else if (isRecordKey(key)) {
            state = this._store[key];

            if (isCallBack(setState)) {
                const newState: T[K] = (setState as TStoreCallback<T, K>)(state);
                haveToNotify = newState !== state;

                this._store[key] = clone(newState);
            } else {
                haveToNotify = state !== setState;

                this._store[key] = clone(setState);
            }
        }

        if (haveToNotify) {
            this._notifyListeners(Array.isArray(key) ? key : [key]);
        }
    }

    private _get<K extends keyof T>(key: K): T[K] {
        return this._store[key];
    }

    private _addNewListener(newListener: IStoreListener<keyof T>): void {
        this._listeners.push(newListener);
    }

    private _removeListener<K extends keyof T, Z extends Function>(key: K, cb: Z): void {
        this._listeners = this._listeners.filter((i) => i.key !== key && i.cb !== cb);
    }

    private _notifyListeners(keys: Array<keyof T>): void {
        this._listeners.forEach((v) => {
            if (keys.includes(v.key)) {
                v.cb(this._store[v.key]);
            }
        });
    }
}

function isCallBack(value: unknown): value is Function {
    return value instanceof Function;
}

function isRecord<T, K extends keyof T, U extends T>(data: unknown): data is Record<K, U[K]> {
    return data instanceof Object && !Array.isArray(data);
}

function isRecordKey(key: unknown): key is string | number | symbol {
    return typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol';
}
