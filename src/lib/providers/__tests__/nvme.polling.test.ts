import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nvmeProvider } from '../nvme';

const LIST_PAYLOAD = JSON.stringify({
    Devices: [{ DevicePath: '/dev/nvme0', ModelNumber: 'Test SSD', SerialNumber: 'S1' }],
});

const SMART_LOG_PAYLOAD = JSON.stringify({ composite_temperature: 315 });

describe('nvmeProvider polling', () => {
    let scanCalls: number;
    let smartLogCalls: number;

    beforeEach(() => {
        vi.useFakeTimers();
        scanCalls = 0;
        smartLogCalls = 0;

        Object.defineProperty(globalThis, 'cockpit', {
            value: {
                gettext: (message: string) => message,
                spawn: (command: string[] | string) => {
                    const args = Array.isArray(command) ? command : [command];
                    if (args.includes('list')) {
                        scanCalls += 1;
                        return Promise.resolve(LIST_PAYLOAD);
                    }
                    if (args.includes('smart-log')) {
                        smartLogCalls += 1;
                        return Promise.resolve(SMART_LOG_PAYLOAD);
                    }
                    return Promise.resolve('{}');
                },
            },
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('never polls SMART data faster than the slow disk interval', async () => {
        const onChange = vi.fn();
        const stop = nvmeProvider.start(onChange, { refreshIntervalMs: 2000 });

        await vi.advanceTimersByTimeAsync(0);
        expect(smartLogCalls).toBe(1);
        expect(onChange).toHaveBeenCalled();

        // A 2s user preference must not drive disk wake-ups every 2s.
        await vi.advanceTimersByTimeAsync(2000);
        expect(smartLogCalls).toBe(1);

        await vi.advanceTimersByTimeAsync(8000);
        expect(smartLogCalls).toBe(2);

        stop();
    });

    it('reuses the device list between polls instead of rescanning', async () => {
        const onChange = vi.fn();
        const stop = nvmeProvider.start(onChange, { refreshIntervalMs: 10000 });

        await vi.advanceTimersByTimeAsync(0);
        expect(scanCalls).toBe(1);

        // Several poll cycles inside the rescan window: no new scans.
        await vi.advanceTimersByTimeAsync(30000);
        expect(scanCalls).toBe(1);

        // Past the rescan window the device list refreshes.
        await vi.advanceTimersByTimeAsync(40000);
        expect(scanCalls).toBe(2);

        stop();
    });
});
