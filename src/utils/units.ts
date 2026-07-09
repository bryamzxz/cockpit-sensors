import type { TemperatureUnit } from '../hooks/useSensorPreferences';

export const CELSIUS_UNIT = '°C';
export const FAHRENHEIT_UNIT = '°F';

export const convertTemperature = (value: number, unit: TemperatureUnit): number => {
    if (unit === 'C') {
        return value;
    }

    return value * (9 / 5) + 32;
};

export const normaliseTemperature = (value: number, unit: TemperatureUnit): number => {
    if (unit === 'C') {
        return value;
    }

    return (value - 32) * (5 / 9);
};

// Intl.NumberFormat construction is expensive; with hundreds of readings
// formatted on every refresh the instances are worth caching per options.
const formatterCache = new Map<string, Intl.NumberFormat>();

export const formatMeasurement = (value: number, options?: Intl.NumberFormatOptions): string => {
    const resolved: Intl.NumberFormatOptions = {
        maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
        minimumFractionDigits: 0,
        ...options,
    };

    const key = JSON.stringify(resolved);
    let formatter = formatterCache.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(undefined, resolved);
        formatterCache.set(key, formatter);
    }

    return formatter.format(value);
};

export const displayUnitFor = (unit: string | undefined, preference: TemperatureUnit): string | undefined => {
    if (unit === CELSIUS_UNIT) {
        return preference === 'F' ? FAHRENHEIT_UNIT : CELSIUS_UNIT;
    }

    return unit;
};

export const convertForDisplay = (
    value: number,
    unit: string | undefined,
    preference: TemperatureUnit,
): number => {
    if (unit === CELSIUS_UNIT) {
        return convertTemperature(value, preference);
    }

    return value;
};
