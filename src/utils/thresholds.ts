import type { Reading } from '../types/sensors';
import { CELSIUS_UNIT } from './units';

export type ThresholdState = 'normal' | 'warning' | 'danger';

const WARNING_MARGIN_CELSIUS = 5;

export const getThresholdState = (reading: Reading): ThresholdState => {
    const { input, max: high, critical } = reading;

    if (typeof input !== 'number') {
        return 'normal';
    }

    if (typeof critical === 'number' && input >= critical) {
        return 'danger';
    }

    if (typeof high === 'number' && input >= high) {
        return 'danger';
    }

    if (typeof high === 'number' && reading.unit === CELSIUS_UNIT && input >= high - WARNING_MARGIN_CELSIUS) {
        return 'warning';
    }

    return 'normal';
};
