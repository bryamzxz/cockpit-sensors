/*
 * This file attempts to synchronize with Cockpit's shell theme when the
 * Cockpit AMD loader is available. The loader is absent during standalone
 * builds, so the guarded require ensures the bundle can execute without
 * errors in that environment.
 */

type CockpitRequire = {
    (moduleId: string): unknown;
    (deps: string[], onSuccess?: (...args: unknown[]) => void, onError?: (err: unknown) => void): void;
    amd?: unknown;
};

declare global {
    interface Window {
        require?: CockpitRequire;
    }
}

if (typeof window !== 'undefined') {
    const cockpitRequire = window.require;

    if (typeof cockpitRequire === 'function') {
        if (typeof cockpitRequire.amd === 'object') {
            // Request the theme module via AMD so the loader fetches it when
            // it has not been preloaded by the host shell.
            cockpitRequire(['cockpit-dark-theme'], undefined, () => undefined);
        } else {
            try {
                cockpitRequire('cockpit-dark-theme');
            } catch {
                // Swallow errors when Cockpit's loader is not present.
            }
        }
    }
}

export {};
