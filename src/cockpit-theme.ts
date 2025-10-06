/*
 * This file attempts to synchronize with Cockpit's shell theme when the
 * Cockpit AMD loader is available. The loader is absent during standalone
 * builds, so the guarded require ensures the bundle can execute without
 * errors in that environment.
 */

declare global {
    interface Window {
        require?: (moduleId: string) => unknown;
    }
}

if (typeof window !== 'undefined') {
    try {
        const cockpitRequire = window.require;
        if (typeof cockpitRequire === 'function')
            cockpitRequire('cockpit-dark-theme');
    } catch (error) {
        // Swallow errors when Cockpit's loader is not present.
    }
}

export {};
