import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { powercapProvider } from '../powercap';
import type { SensorSample } from '../types';

const DOMAIN_PATH = '/sys/class/powercap/intel-rapl:0';

type OnChangeMock = Mock<(samples: SensorSample[]) => void>;

const lastSamples = (onChange: OnChangeMock): SensorSample[] => {
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0];
};

describe('powercapProvider polling', () => {
    let files: Map<string, string>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        files = new Map([
            [`${DOMAIN_PATH}/name`, 'package-0\n'],
            [`${DOMAIN_PATH}/energy_uj`, '10000000\n'],
            [`${DOMAIN_PATH}/max_energy_range_uj`, '262143328850\n'],
        ]);
        Object.defineProperty(globalThis, 'cockpit', {
            value: {
                gettext: (message: string) => message,
                spawn: (command: string[] | string) => {
                    const args = Array.isArray(command) ? command : [command];
                    return Promise.resolve(args[0] === 'find' ? `${DOMAIN_PATH}\n` : '');
                },
                file: (path: string) => ({
                    read: () => Promise.resolve(files.get(path) ?? null),
                    close: () => undefined,
                }),
            },
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('derives watts from energy counter deltas between polls', async () => {
        const onChange: OnChangeMock = vi.fn();
        const stop = powercapProvider.start(onChange, { refreshIntervalMs: 1000 });

        await vi.advanceTimersByTimeAsync(0);

        // 5 J consumed over 1 s → 5 W
        files.set(`${DOMAIN_PATH}/energy_uj`, String(10_000_000 + 5_000_000));
        await vi.advanceTimersByTimeAsync(1000);

        const samples = lastSamples(onChange);
        expect(samples).toHaveLength(1);
        expect(samples[0].kind).toBe('power');
        expect(samples[0].unit).toBe('W');
        expect(samples[0].label).toBe('package-0');
        expect(samples[0].value).toBeCloseTo(5, 1);

        stop();
    });

    it('survives energy counter wrap-around using max_energy_range_uj', async () => {
        const onChange: OnChangeMock = vi.fn();
        const stop = powercapProvider.start(onChange, { refreshIntervalMs: 1000 });

        await vi.advanceTimersByTimeAsync(0);

        // Counter wrapped: the new reading is below the previous one, so the
        // real consumption is (new - last) + max_energy_range. The provider
        // must apply the wrap correction instead of emitting a negative value.
        files.set(`${DOMAIN_PATH}/energy_uj`, '1000000');
        await vi.advanceTimersByTimeAsync(1000);

        const samples = lastSamples(onChange);
        expect(samples).toHaveLength(1);
        expect(samples[0].value).toBeGreaterThan(0);

        stop();
    });
});
