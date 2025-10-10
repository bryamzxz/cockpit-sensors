import React from 'react';

export type TemperatureUnit = 'C' | 'F';

const DEFAULT_UNIT: TemperatureUnit = 'C';
const DEFAULT_REFRESH_MS = 5000;
const REFRESH_CHOICES = new Set([2000, 5000, 10000]);

const STORAGE_KEYS = {
    unit: 'sensors.unit',
    refresh: 'sensors.refreshMs',
    pinned: 'sensors.pinned',
} as const;

const safeLocalStorage = (): Storage | undefined => {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
};

const readNumber = (value: string | null, fallback: number): number => {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return REFRESH_CHOICES.has(parsed) ? parsed : fallback;
};

const readUnit = (value: string | null): TemperatureUnit => {
    return value === 'F' ? 'F' : DEFAULT_UNIT;
};

const readPinned = (value: string | null): string[] => {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter(entry => typeof entry === 'string');
        }
    } catch {
        // Ignore malformed entries and fall back to the default.
    }

    return [];
};

const writeStorage = (key: string, value: string): void => {
    const storage = safeLocalStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(key, value);
    } catch {
        // Ignore quota errors and continue without persistence.
    }
};

const removeStorage = (key: string): void => {
    const storage = safeLocalStorage();
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(key);
    } catch {
        // Ignore failures.
    }
};

export interface SensorPreferences {
    unit: TemperatureUnit;
    setUnit: (unit: TemperatureUnit) => void;
    refreshMs: number;
    setRefreshMs: (value: number) => void;
    pinned: readonly string[];
    togglePinned: (key: string) => void;
    setPinned: (keys: readonly string[]) => void;
}

export const useSensorPreferences = (): SensorPreferences => {
    const [unit, setUnitState] = React.useState<TemperatureUnit>(() => {
        const storage = safeLocalStorage();
        return readUnit(storage?.getItem(STORAGE_KEYS.unit) ?? null);
    });

    const [refreshMs, setRefreshState] = React.useState<number>(() => {
        const storage = safeLocalStorage();
        return readNumber(storage?.getItem(STORAGE_KEYS.refresh) ?? null, DEFAULT_REFRESH_MS);
    });

    const [pinned, setPinnedState] = React.useState<string[]>(() => {
        const storage = safeLocalStorage();
        return readPinned(storage?.getItem(STORAGE_KEYS.pinned) ?? null);
    });

    const setUnit = React.useCallback((next: TemperatureUnit) => {
        setUnitState(next);
        writeStorage(STORAGE_KEYS.unit, next);
    }, []);

    const setRefreshMs = React.useCallback((value: number) => {
        const normalised = REFRESH_CHOICES.has(value) ? value : DEFAULT_REFRESH_MS;
        setRefreshState(normalised);
        writeStorage(STORAGE_KEYS.refresh, String(normalised));
    }, []);

    const setPinned = React.useCallback((keys: readonly string[]) => {
        const unique = Array.from(new Set(keys));
        setPinnedState(unique);
        if (unique.length === 0) {
            removeStorage(STORAGE_KEYS.pinned);
            return;
        }

        writeStorage(STORAGE_KEYS.pinned, JSON.stringify(unique));
    }, []);

    const togglePinned = React.useCallback(
        (key: string) => {
            setPinnedState(prev => {
                const exists = prev.includes(key);
                const next = exists ? prev.filter(entry => entry !== key) : [...prev, key];
                if (next.length === 0) {
                    removeStorage(STORAGE_KEYS.pinned);
                } else {
                    writeStorage(STORAGE_KEYS.pinned, JSON.stringify(next));
                }
                return next;
            });
        },
        [],
    );

    return {
        unit,
        setUnit,
        refreshMs,
        setRefreshMs,
        pinned,
        togglePinned,
        setPinned,
    };
};

export const SENSOR_REFRESH_OPTIONS = Array.from(REFRESH_CHOICES.values()).sort((a, b) => a - b);
export const DEFAULT_SENSOR_REFRESH_MS = DEFAULT_REFRESH_MS;
