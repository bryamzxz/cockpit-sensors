import { describe, expect, it } from 'vitest';

import type { Reading } from '../../types/sensors';
import { getThresholdState } from '../thresholds';

describe('threshold evaluation', () => {
    const baseReading: Reading = {
        label: 'CPU Temp',
        input: 60,
        unit: '°C',
        max: 80,
        critical: 90,
    };

    it('returns normal when no thresholds are crossed', () => {
        expect(getThresholdState({ ...baseReading, input: 40 })).toBe('normal');
    });

    it('returns warning when approaching the high threshold', () => {
        expect(getThresholdState({ ...baseReading, input: 76 })).toBe('warning');
    });

    it('returns danger when high threshold is crossed', () => {
        expect(getThresholdState({ ...baseReading, input: 82 })).toBe('danger');
    });

    it('returns danger when critical threshold is crossed', () => {
        expect(getThresholdState({ ...baseReading, input: 95 })).toBe('danger');
    });
});
