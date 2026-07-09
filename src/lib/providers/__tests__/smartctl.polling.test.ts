import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { smartctlProvider } from '../smartctl';

const SCAN_PAYLOAD = JSON.stringify({
    devices: [
        { name: '/dev/sda', protocol: 'ATA' },
        { name: '/dev/sdb', protocol: 'ATA' },
    ],
});

const DEVICE_PAYLOAD = JSON.stringify({
    model_name: 'Test HDD',
    serial_number: 'ABC',
    temperature: { current: 35 },
});

describe('smartctlProvider polling', () => {
    let deviceCommands: string[][];

    beforeEach(() => {
        vi.useFakeTimers();
        deviceCommands = [];

        Object.defineProperty(globalThis, 'cockpit', {
            value: {
                gettext: (message: string) => message,
                spawn: (command: string[] | string) => {
                    const args = Array.isArray(command) ? command : [command];
                    if (args.includes('--scan')) {
                        return Promise.resolve(SCAN_PAYLOAD);
                    }
                    deviceCommands.push(args);
                    return Promise.resolve(DEVICE_PAYLOAD);
                },
            },
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('samples every scanned device', async () => {
        const onChange = vi.fn();
        const stop = smartctlProvider.start(onChange, { refreshIntervalMs: 10000 });

        await vi.advanceTimersByTimeAsync(0);

        expect(onChange).toHaveBeenCalled();
        const samples = onChange.mock.calls.at(-1)?.[0] as Array<{ chipId?: string; value: number }>;
        expect(samples).toHaveLength(2);
        expect(samples.map(sample => sample.chipId)).toEqual(['/dev/sda', '/dev/sdb']);
        expect(samples[0].value).toBe(35);

        stop();
    });

    it('queries devices without waking standby disks', async () => {
        const onChange = vi.fn();
        const stop = smartctlProvider.start(onChange, { refreshIntervalMs: 10000 });

        await vi.advanceTimersByTimeAsync(0);

        expect(deviceCommands.length).toBeGreaterThan(0);
        for (const args of deviceCommands) {
            const flagIndex = args.indexOf('-n');
            expect(flagIndex).toBeGreaterThan(-1);
            expect(args[flagIndex + 1]).toBe('standby');
        }

        stop();
    });
});
