import { describe, expect, it } from 'vitest';

import { format } from '../cockpit';

describe('format', () => {
    it('substitutes positional arguments into translated templates', () => {
        expect(format('Updated $0 ago', '5s')).toBe('Updated 5s ago');
    });

    it('substitutes multiple arguments', () => {
        expect(format('$0 of $1', 3, 10)).toBe('3 of 10');
    });
});
