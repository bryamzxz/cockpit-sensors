import { describe, it, expect } from 'vitest';
import {
    isPermissionDenied,
    isCommandMissing,
    parseNumber,
    coerceNumber,
    isRecord,
    trim,
    POLLING_INTERVALS,
} from '../utils';

describe('isPermissionDenied', () => {
    it('returns false for null or undefined', () => {
        expect(isPermissionDenied(null)).toBe(false);
        expect(isPermissionDenied(undefined)).toBe(false);
    });

    it('returns false for non-object values', () => {
        expect(isPermissionDenied('error')).toBe(false);
        expect(isPermissionDenied(123)).toBe(false);
        expect(isPermissionDenied(true)).toBe(false);
    });

    it('returns true for access-denied problem', () => {
        expect(isPermissionDenied({ problem: 'access-denied' })).toBe(true);
    });

    it('returns true when message contains "permission denied"', () => {
        expect(isPermissionDenied({ message: 'Permission denied: /sys/class/hwmon' })).toBe(true);
        expect(isPermissionDenied({ message: 'PERMISSION DENIED' })).toBe(true);
    });

    it('returns false for other errors', () => {
        expect(isPermissionDenied({ problem: 'not-found' })).toBe(false);
        expect(isPermissionDenied({ message: 'Some other error' })).toBe(false);
    });
});

describe('isCommandMissing', () => {
    it('returns false for null or undefined', () => {
        expect(isCommandMissing(null)).toBe(false);
        expect(isCommandMissing(undefined)).toBe(false);
    });

    it('returns false for non-object values', () => {
        expect(isCommandMissing('error')).toBe(false);
        expect(isCommandMissing(123)).toBe(false);
    });

    it('returns true for not-found problem', () => {
        expect(isCommandMissing({ problem: 'not-found' })).toBe(true);
    });

    it('returns true for exit status 127', () => {
        expect(isCommandMissing({ exit_status: 127 })).toBe(true);
    });

    it('returns true when message indicates command not found', () => {
        expect(isCommandMissing({ message: 'command not found' })).toBe(true);
        expect(isCommandMissing({ message: 'COMMAND NOT FOUND' })).toBe(true);
        expect(isCommandMissing({ message: 'No such file or directory' })).toBe(true);
    });

    it('returns false for other errors', () => {
        expect(isCommandMissing({ problem: 'access-denied' })).toBe(false);
        expect(isCommandMissing({ message: 'Some other error' })).toBe(false);
        expect(isCommandMissing({ exit_status: 1 })).toBe(false);
    });
});

describe('parseNumber', () => {
    it('returns undefined for null or undefined', () => {
        expect(parseNumber(null)).toBeUndefined();
        expect(parseNumber(undefined)).toBeUndefined();
    });

    it('returns undefined for empty strings', () => {
        expect(parseNumber('')).toBeUndefined();
        expect(parseNumber('   ')).toBeUndefined();
    });

    it('parses valid numbers', () => {
        expect(parseNumber('42')).toBe(42);
        expect(parseNumber('42.5')).toBe(42.5);
        expect(parseNumber('-10')).toBe(-10);
        expect(parseNumber('0')).toBe(0);
    });

    it('handles whitespace', () => {
        expect(parseNumber('  42  ')).toBe(42);
        expect(parseNumber('\t100\n')).toBe(100);
    });

    it('returns undefined for invalid numbers', () => {
        expect(parseNumber('not a number')).toBeUndefined();
        expect(parseNumber('NaN')).toBeUndefined();
        expect(parseNumber('Infinity')).toBeUndefined();
    });
});

describe('coerceNumber', () => {
    it('returns number as-is if finite', () => {
        expect(coerceNumber(42)).toBe(42);
        expect(coerceNumber(0)).toBe(0);
        expect(coerceNumber(-10.5)).toBe(-10.5);
    });

    it('returns undefined for non-finite numbers', () => {
        expect(coerceNumber(Infinity)).toBeUndefined();
        expect(coerceNumber(-Infinity)).toBeUndefined();
        expect(coerceNumber(NaN)).toBeUndefined();
    });

    it('parses strings to numbers', () => {
        expect(coerceNumber('42')).toBe(42);
        expect(coerceNumber('  100.5  ')).toBe(100.5);
    });

    it('returns undefined for non-number/string values', () => {
        expect(coerceNumber(null)).toBeUndefined();
        expect(coerceNumber(undefined)).toBeUndefined();
        expect(coerceNumber({})).toBeUndefined();
        expect(coerceNumber([])).toBeUndefined();
        expect(coerceNumber(true)).toBeUndefined();
    });
});

describe('isRecord', () => {
    it('returns true for plain objects', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ key: 'value' })).toBe(true);
    });

    it('returns false for null', () => {
        expect(isRecord(null)).toBe(false);
    });

    it('returns false for arrays', () => {
        expect(isRecord([])).toBe(false);
        expect(isRecord([1, 2, 3])).toBe(false);
    });

    it('returns false for primitives', () => {
        expect(isRecord('string')).toBe(false);
        expect(isRecord(123)).toBe(false);
        expect(isRecord(true)).toBe(false);
        expect(isRecord(undefined)).toBe(false);
    });
});

describe('trim', () => {
    it('trims whitespace from strings', () => {
        expect(trim('  hello  ')).toBe('hello');
        expect(trim('\tworld\n')).toBe('world');
        expect(trim('no-spaces')).toBe('no-spaces');
    });
});

describe('POLLING_INTERVALS', () => {
    it('exports expected interval constants', () => {
        expect(POLLING_INTERVALS.DEFAULT).toBe(5000);
        expect(POLLING_INTERVALS.NVME).toBe(10000);
        expect(POLLING_INTERVALS.POWERCAP).toBe(3000);
        expect(POLLING_INTERVALS.MINIMUM).toBe(500);
        expect(POLLING_INTERVALS.THROTTLE).toBe(500);
    });
});
