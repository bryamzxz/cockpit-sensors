import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearHistory,
    getHistory,
    hasAnyHistory,
    historyKeyFor,
    recordSamples,
} from '../historyStore';
import type { SensorChipGroup } from '../../types/sensors';

const makeGroups = (input: number): SensorChipGroup[] => [
    {
        id: 'chip0:temperature',
        name: 'k10temp',
        label: 'CPU sensors',
        category: 'temperature',
        source: 'hwmon',
        readings: [{ label: 'Core 0', input, unit: '°C' }],
    },
];

const KEY = historyKeyFor('chip0:temperature', 'Core 0');

describe('historyStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        clearHistory();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('records one sample per reading and reports the change', () => {
        expect(recordSamples(makeGroups(42))).toBe(true);

        const buffer = getHistory(KEY);
        expect(buffer).toHaveLength(1);
        expect(buffer[0].v).toBe(42);
        expect(hasAnyHistory()).toBe(true);
    });

    it('deduplicates bursts within the minimum interval window', () => {
        recordSamples(makeGroups(42), 4000);

        vi.advanceTimersByTime(200);
        expect(recordSamples(makeGroups(42.5), 4000)).toBe(false);
        expect(getHistory(KEY)).toHaveLength(1);

        vi.advanceTimersByTime(4000);
        expect(recordSamples(makeGroups(43), 4000)).toBe(true);
        expect(getHistory(KEY)).toHaveLength(2);
        expect(getHistory(KEY)[1].v).toBe(43);
    });

    it('skips non-finite readings', () => {
        expect(recordSamples(makeGroups(Number.NaN))).toBe(false);
        expect(getHistory(KEY)).toHaveLength(0);
    });

    it('prunes buffers for readings that disappeared', () => {
        recordSamples(makeGroups(42));

        const otherGroups: SensorChipGroup[] = [
            {
                id: 'chip1:fan',
                name: 'nct6775',
                label: 'Board sensors',
                category: 'fan',
                source: 'hwmon',
                readings: [{ label: 'fan1', input: 900, unit: 'RPM' }],
            },
        ];

        vi.advanceTimersByTime(5000);
        expect(recordSamples(otherGroups)).toBe(true);
        expect(getHistory(KEY)).toHaveLength(0);
        expect(getHistory(historyKeyFor('chip1:fan', 'fan1'))).toHaveLength(1);
    });

    it('clears every buffer', () => {
        recordSamples(makeGroups(42));
        clearHistory();
        expect(hasAnyHistory()).toBe(false);
    });
});
