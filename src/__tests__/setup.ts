import '@testing-library/jest-dom/vitest';

import cockpitMock from '../__mocks__/cockpit';

Object.defineProperty(globalThis, 'cockpit', {
    value: cockpitMock,
    configurable: true,
    writable: true,
});
