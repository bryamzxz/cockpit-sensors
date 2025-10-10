import { describe, expect, it } from 'vitest';

import { convertForDisplay, convertTemperature, displayUnitFor } from '../units';

describe('unit helpers', () => {
    it('converts Celsius to Fahrenheit', () => {
        expect(convertTemperature(0, 'F')).toBeCloseTo(32);
        expect(convertTemperature(100, 'F')).toBeCloseTo(212);
    });

    it('keeps Celsius when preference is Celsius', () => {
        expect(convertForDisplay(25, '°C', 'C')).toBeCloseTo(25);
    });

    it('converts display units according to preference', () => {
        expect(convertForDisplay(25, '°C', 'F')).toBeCloseTo(77);
        expect(displayUnitFor('°C', 'F')).toBe('°F');
        expect(displayUnitFor('RPM', 'F')).toBe('RPM');
    });
});
