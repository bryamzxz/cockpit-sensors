import { describe, expect, it } from 'vitest';

import { groupsForCategory } from '../utils/grouping';
import type { SensorChipGroup, SensorCategory } from '../types/sensors';

const buildGroup = (id: string, category: SensorCategory): SensorChipGroup => ({
    id,
    name: id,
    label: id,
    category,
    readings: [],
});

describe('groupsForCategory', () => {
    it('returns only groups that belong to the requested category', () => {
        const groups: SensorChipGroup[] = [
            buildGroup('temp-1', 'temperature'),
            buildGroup('unknown-1', 'unknown'),
            buildGroup('fan-1', 'fan'),
        ];

        expect(groupsForCategory(groups, 'temperature')).toEqual([buildGroup('temp-1', 'temperature')]);
        expect(groupsForCategory(groups, 'fan')).toEqual([buildGroup('fan-1', 'fan')]);
        expect(groupsForCategory(groups, 'voltage')).toEqual([]);
    });

    it('only returns uncategorised groups for the dedicated tab', () => {
        const groups: SensorChipGroup[] = [
            buildGroup('unknown-1', 'unknown'),
            buildGroup('unknown-2', 'unknown'),
        ];

        expect(groupsForCategory(groups, 'temperature')).toEqual([]);
        expect(groupsForCategory(groups, 'unknown')).toEqual(groups);
    });
});
