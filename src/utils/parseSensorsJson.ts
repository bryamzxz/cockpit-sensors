import { EMPTY_SENSOR_DATA, Reading, SensorCategory, SensorChipGroup, SensorData } from '../types/sensors';

type RawObject = Record<string, unknown>;

const isRecord = (value: unknown): value is RawObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return undefined;
        }

        const parsed = Number.parseFloat(trimmed);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
};

const parseCategory = (value: unknown): SensorCategory => {
    if (typeof value !== 'string') {
        return 'unknown';
    }

    switch (value.toLowerCase()) {
        case 'temperature':
        case 'fan':
        case 'voltage':
        case 'power':
            return value.toLowerCase() as SensorCategory;
        default:
            return 'unknown';
    }
};

const parseReading = (raw: unknown, fallbackLabel: string): Reading | null => {
    if (!isRecord(raw)) {
        return null;
    }

    const input = coerceNumber(raw.input);
    if (typeof input !== 'number') {
        return null;
    }

    const labelSource = isNonEmptyString(raw.label)
        ? raw.label
        : isNonEmptyString(raw.name)
            ? raw.name
            : undefined;

    const reading: Reading = {
        label: (labelSource ?? fallbackLabel).trim(),
        input,
    };

    const min = coerceNumber(raw.min ?? raw.lower ?? raw.low);
    if (typeof min === 'number') {
        reading.min = min;
    }

    const max = coerceNumber(raw.max ?? raw.upper ?? raw.high);
    if (typeof max === 'number') {
        reading.max = max;
    }

    const critical = coerceNumber(raw.critical ?? raw.crit ?? raw['crit_max']);
    if (typeof critical === 'number') {
        reading.critical = critical;
    }

    if (isNonEmptyString(raw.unit)) {
        reading.unit = raw.unit.trim();
    }

    return reading;
};

const parseGroup = (raw: unknown, index: number): SensorChipGroup | null => {
    if (!isRecord(raw)) {
        return null;
    }

    const id = isNonEmptyString(raw.id) ? raw.id.trim() : `chip-${index}`;
    const name = isNonEmptyString(raw.name) ? raw.name.trim() : id;
    const label = isNonEmptyString(raw.label) ? raw.label.trim() : name;
    const category = parseCategory(raw.category);
    const source = isNonEmptyString(raw.source) ? raw.source.trim() : undefined;

    const rawReadings = Array.isArray(raw.readings) ? raw.readings : Array.isArray(raw.values) ? raw.values : [];

    const readings = rawReadings
            .map((reading, readingIndex) => parseReading(reading, `${label} ${readingIndex + 1}`))
            .filter((reading): reading is Reading => reading !== null);

    if (readings.length === 0) {
        return null;
    }

    const group: SensorChipGroup = {
        id,
        name,
        label,
        category,
        readings,
    };

    if (source) {
        group.source = source;
    }

    return group;
};

/**
 * Normalises the raw JSON payload returned by the backend or by the mock layer.
 *
 * The function is intentionally pure to keep the data processing predictable and
 * easy to test.
 */
export const parseSensorsJson = (raw: unknown): SensorData => {
    if (!raw) {
        return { ...EMPTY_SENSOR_DATA };
    }

    const container = isRecord(raw) ? raw : {};

    const rawGroups = Array.isArray(raw)
        ? raw
        : Array.isArray(container.chips)
            ? container.chips
            : Array.isArray(container.groups)
                ? container.groups
                : [];

    const groups = rawGroups
            .map((group, index) => parseGroup(group, index))
            .filter((group): group is SensorChipGroup => group !== null);

    const timestamp = coerceNumber(container.timestamp ?? container.updated ?? container.time);

    if (groups.length === 0) {
        return typeof timestamp === 'number'
            ? { groups: [], timestamp }
            : { ...EMPTY_SENSOR_DATA };
    }

    return typeof timestamp === 'number' ? { groups, timestamp } : { groups };
};

export type { Reading, SensorChipGroup, SensorData };
