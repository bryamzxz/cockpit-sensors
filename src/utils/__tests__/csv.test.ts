import { describe, expect, it } from 'vitest';

import { buildHistoryCsv } from '../csv';

const mockDate = new Date('2024-01-01T00:00:00.000Z').valueOf();

describe('CSV exporter', () => {
    it('builds a CSV table with aligned samples', () => {
        const csv = buildHistoryCsv([
            {
                key: 'sensor-a',
                label: 'Sensor A',
                history: [
                    { t: mockDate, v: 1 },
                    { t: mockDate + 1000, v: 2 },
                ],
            },
            {
                key: 'sensor-b',
                label: 'Sensor B',
                history: [{ t: mockDate, v: 10 }],
            },
        ]);

        const lines = csv.split('\n');
        expect(lines[0]).toBe('ts,Sensor A,Sensor B');
        expect(lines[1]).toBe('2024-01-01T00:00:00.000Z,1,10');
        expect(lines[2]).toBe('2024-01-01T00:00:01.000Z,2,');
    });

    it('returns only the header when there is no data', () => {
        expect(buildHistoryCsv([])).toBe('ts');
    });
});
