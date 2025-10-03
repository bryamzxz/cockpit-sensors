/**
 * Shared type definitions for sensor data displayed in the Cockpit Sensors UI.
 *
 * These interfaces intentionally focus on the subset of fields required by the
 * frontend so that the UI code can remain implementation agnostic while the
 * backend integration matures.
 */

/**
 * High level categories that the UI presents via dedicated tabs.
 */
export type SensorCategory = 'temperature' | 'fan' | 'voltage' | 'power' | 'unknown';

/**
 * Normalised representation of a single sensor reading.
 */
export interface Reading {
    /** Human readable sensor label shown in the table. */
    label: string;
    /** The current reading reported by the sensor. */
    input: number;
    /** Optional minimum value advertised by the sensor. */
    min?: number;
    /** Optional maximum value advertised by the sensor. */
    max?: number;
    /** Optional critical threshold reported by the sensor. */
    critical?: number;
    /** Optional engineering unit (°C, RPM, V, …). */
    unit?: string;
}

/**
 * Grouping of readings that belong to the same physical chip or virtual sensor.
 */
export interface SensorChipGroup {
    /** Stable identifier that allows React to keep track of rendered rows. */
    id: string;
    /** Name reported by the backend (typically matches the lm-sensors chip name). */
    name: string;
    /** Localised label used in the UI. */
    label: string;
    /** Category used for tab based filtering in the UI. */
    category: SensorCategory;
    /** Individual sensor readings belonging to the chip. */
    readings: Reading[];
}

/**
 * Aggregated dataset returned by the sensors hook and parser.
 */
export interface SensorData {
    /** Sensor readings grouped by chip. */
    groups: SensorChipGroup[];
    /** Optional timestamp reported by the backend (UNIX epoch milliseconds). */
    timestamp?: number;
}

/**
 * Convenience constant that represents the absence of sensor data.
 */
export const EMPTY_SENSOR_DATA: SensorData = { groups: [] };
