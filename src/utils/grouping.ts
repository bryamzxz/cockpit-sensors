import type { SensorCategory, SensorChipGroup } from '../types/sensors';

/**
 * Return the chip groups that should be displayed for the provided sensor category.
 *
 * Unknown sensor groups are only returned when the dedicated "Other sensors" tab is queried,
 * which prevents them from being duplicated across the individual category tabs.
 *
 * Power related sensors currently have no dedicated tab, so they are surfaced in the same
 * catch-all list to ensure they remain visible to the user.
 */
export const groupsForCategory = (
    groups: SensorChipGroup[],
    category: SensorCategory,
): SensorChipGroup[] => {
    if (category === 'unknown') {
        return groups.filter(group => group.category === 'unknown' || group.category === 'power');
    }

    return groups.filter(group => group.category === category);
};
