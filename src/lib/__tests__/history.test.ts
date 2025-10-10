import { describe, expect, it } from 'vitest';

import { calcStats, pushSample } from '../history';

describe('history helpers', () => {
    it('appends samples and respects the limit', () => {
        const buffer: Array<{ t: number; v: number }> = [];
        for (let index = 0; index < 5; index += 1) {
            pushSample(buffer, index, 3);
        }

        expect(buffer).toHaveLength(3);
        expect(buffer.map(sample => sample.v)).toEqual([2, 3, 4]);
    });

    it('calculates statistics for samples', () => {
        const now = Date.now();
        const buffer = [
            { t: now, v: 10 },
            { t: now + 1, v: 20 },
            { t: now + 2, v: 30 },
        ];

        const stats = calcStats(buffer);
        expect(stats).toEqual({ min: 10, max: 30, avg: 20, n: 3 });
    });

    it('returns NaN stats for empty buffers', () => {
        const stats = calcStats([]);
        expect(stats.n).toBe(0);
        expect(Number.isNaN(stats.min)).toBe(true);
        expect(Number.isNaN(stats.max)).toBe(true);
        expect(Number.isNaN(stats.avg)).toBe(true);
    });
});
