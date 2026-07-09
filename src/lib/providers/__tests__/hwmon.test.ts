import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { hwmonProvider } from '../hwmon';
import type { SensorSample } from '../types';

const CHIP_PATH = '/sys/class/hwmon/hwmon0';

type OnChangeMock = Mock<(samples: SensorSample[]) => void>;

const lastSamples = (onChange: OnChangeMock): SensorSample[] => {
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0];
};

/**
 * Simulates the sysfs behaviour that matters for hwmon: attribute files
 * return a fresh value on every read but never emit inotify events, so a
 * file watch would fire once at most. Values are mutable via the map.
 */
const createFakeCockpit = (files: Map<string, string>) => ({
    gettext: (message: string) => message,
    spawn: (command: string[] | string) => {
        const args = Array.isArray(command) ? command : [command];
        let output = '';

        if (args[0] === 'find' && args.includes('hwmon*')) {
            output = `${CHIP_PATH}\n`;
        } else if (args[0] === 'find' && args.includes('*_input')) {
            output = Array.from(files.keys())
                    .filter(path => path.startsWith(`${CHIP_PATH}/`) && path.endsWith('_input'))
                    .map(path => path.split('/').pop())
                    .join('\n');
        }

        return Promise.resolve(output);
    },
    file: (path: string) => ({
        read: () => Promise.resolve(files.get(path) ?? null),
        watch: () => ({ remove: () => undefined }),
        close: () => undefined,
    }),
});

describe('hwmonProvider polling', () => {
    let files: Map<string, string>;

    beforeEach(() => {
        vi.useFakeTimers();
        files = new Map([
            [`${CHIP_PATH}/name`, 'coretemp\n'],
            [`${CHIP_PATH}/temp1_input`, '42000\n'],
        ]);
        Object.defineProperty(globalThis, 'cockpit', {
            value: createFakeCockpit(files),
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('emits fresh values on each refresh interval', async () => {
        const onChange: OnChangeMock = vi.fn();
        const stop = hwmonProvider.start(onChange, { refreshIntervalMs: 1000 });

        await vi.advanceTimersByTimeAsync(600);
        expect(onChange).toHaveBeenCalled();
        const initial = lastSamples(onChange);
        expect(initial).toHaveLength(1);
        expect(initial[0].value).toBeCloseTo(42);
        expect(initial[0].kind).toBe('temp');

        files.set(`${CHIP_PATH}/temp1_input`, '55000\n');
        await vi.advanceTimersByTimeAsync(2000);

        expect(lastSamples(onChange)[0].value).toBeCloseTo(55);

        stop();
    });

    it('respects the configured refresh interval', async () => {
        const onChange: OnChangeMock = vi.fn();
        const stop = hwmonProvider.start(onChange, { refreshIntervalMs: 5000 });

        await vi.advanceTimersByTimeAsync(600);
        files.set(`${CHIP_PATH}/temp1_input`, '55000\n');

        await vi.advanceTimersByTimeAsync(1000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(42);

        await vi.advanceTimersByTimeAsync(5000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(55);

        stop();
    });

    it('skips polling while paused and resumes afterwards', async () => {
        let paused = false;
        const onChange: OnChangeMock = vi.fn();
        const stop = hwmonProvider.start(onChange, {
            refreshIntervalMs: 1000,
            isPaused: () => paused,
        });

        await vi.advanceTimersByTimeAsync(600);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(42);

        paused = true;
        files.set(`${CHIP_PATH}/temp1_input`, '55000\n');
        await vi.advanceTimersByTimeAsync(3000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(42);

        paused = false;
        await vi.advanceTimersByTimeAsync(1000);
        expect(lastSamples(onChange)[0].value).toBeCloseTo(55);

        stop();
    });

    it('stops polling and releases resources on unsubscribe without errors', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onChange: OnChangeMock = vi.fn();
        const stop = hwmonProvider.start(onChange, { refreshIntervalMs: 1000 });

        await vi.advanceTimersByTimeAsync(600);
        stop();
        expect(errorSpy).not.toHaveBeenCalled();

        const callsAfterStop = onChange.mock.calls.length;
        files.set(`${CHIP_PATH}/temp1_input`, '60000\n');
        await vi.advanceTimersByTimeAsync(3000);
        expect(onChange.mock.calls.length).toBe(callsAfterStop);

        errorSpy.mockRestore();
    });
});
