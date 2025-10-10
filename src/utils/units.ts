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

export const formatMeasurement = (value: number, options?: Intl.NumberFormatOptions): string => {
    const formatter = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
        minimumFractionDigits: 0,
        ...options,
    });

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
