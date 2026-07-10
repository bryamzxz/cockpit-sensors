import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { cpufreqProvider } from '../cpufreq';
import type { SensorSample } from '../types';

const FREQ_PATH = (core: number) => `/sys/devices/system/cpu/cpu${core}/cpufreq/scaling_cur_freq`;

type OnChangeMock = Mock<(samples: SensorSample[]) => void>;

const lastSamples = (onChange: OnChangeMock): SensorSample[] => {
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0];
};

describe('cpufreqProvider polling', () => {
    let files: Map<string, string>;

    beforeEach(() => {
        vi.useFakeTimers();
        files = new Map([
            [FREQ_PATH(0), '3500000\n'],
            [FREQ_PATH(1), '2000000\n'],
        ]);
        Object.defineProperty(globalThis, 'cockpit', {
            value: {
                gettext: (message: string) => message,
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

    it('discovers consecutive cores and reports frequencies in MHz', async () => {
        const onChange: OnChangeMock = vi.fn();
        const stop = cpufreqProvider.start(onChange, { refreshIntervalMs: 1000 });

        await vi.advanceTimersByTimeAsync(0);
        const samples = lastSamples(onChange);
        expect(samples).toHaveLength(2);
        expect(samples[0].label).toBe('Core 0');
        expect(samples[0].value).toBeCloseTo(3500);
        expect(samples[1].value).toBeCloseTo(2000);
        expect(samples[0].unit).toBe('MHz');

        stop();
    });

    it('emits fresh frequencies on each interval and pauses on demand', async () => {
        let paused = false;
        const onChange: OnChangeMock = vi.fn();
        const stop = cpufreqProvider.start(onChange, {
            refreshIntervalMs: 1000,
            isPaused: () => paused,
        });

        await vi.advanceTimersByTimeAsync(0);
        files.set(FREQ_PATH(0), '4200000\n');
        await vi.advanceTimersByTimeAsync(1000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(4200);

        paused = true;
        files.set(FREQ_PATH(0), '1000000\n');
        await vi.advanceTimersByTimeAsync(3000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(4200);

        paused = false;
        await vi.advanceTimersByTimeAsync(1000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(1000);

        stop();
    });
});
