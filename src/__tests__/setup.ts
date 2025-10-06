import cockpitMock from '../__mocks__/cockpit';

Object.defineProperty(globalThis, 'cockpit', {
    value: cockpitMock as Cockpit,
    configurable: true,
    writable: true,
});
