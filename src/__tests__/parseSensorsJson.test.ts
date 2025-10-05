import { describe, expect, it } from 'vitest';
import { parseSensorsJson } from '../utils/parseSensorsJson';

const buildReading = (input: number) => ({
    input,
    label: 'Reading',
});

describe('parseSensorsJson timestamp handling', () => {
    it('preserves a timestamp of 0 when no sensor groups are available', () => {
        const result = parseSensorsJson({
            timestamp: 0,
            chips: [],
        });

        expect(result).toEqual({
            groups: [],
            timestamp: 0,
        });
    });

    it('preserves a timestamp of 0 when sensor groups are present', () => {
        const result = parseSensorsJson({
            timestamp: 0,
            chips: [
                {
                    id: 'chip-1',
                    name: 'Chip 1',
                    label: 'Chip 1',
                    category: 'temperature',
                    readings: [buildReading(42)],
                },
            ],
        });

        expect(result.timestamp).toBe(0);
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0]).toMatchObject({
            id: 'chip-1',
            readings: [
                expect.objectContaining({
                    input: 42,
                }),
            ],
        });
    });
});
