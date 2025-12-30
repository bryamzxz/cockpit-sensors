/**
 * Rolling history buffer for sensor data with statistics calculation.
 *
 * This module provides utilities for maintaining a fixed-size buffer of
 * timestamped sensor readings and computing statistics over the buffer.
 */

/** A single timestamped sample in the history buffer */
export type Sample = {
    /** Unix timestamp in milliseconds when the sample was recorded */
    t: number;
    /** The sensor reading value */
    v: number;
};

/** Computed statistics over a collection of samples */
export type Stats = {
    /** Minimum value in the buffer */
    min: number;
    /** Maximum value in the buffer */
    max: number;
    /** Average (mean) value across all samples */
    avg: number;
    /** Number of samples in the buffer */
    n: number;
};

/**
 * Default maximum number of samples to keep in the rolling history buffer.
 * At a 5-second polling interval, 300 samples provides ~25 minutes of history.
 */
export const MAX_HISTORY_SAMPLES = 300;

/**
 * Adds a new sample to the history buffer, maintaining the maximum size limit.
 *
 * When the buffer exceeds the limit, oldest samples are removed to make room.
 * This implements a rolling/sliding window of the most recent readings.
 *
 * @param buffer - The sample buffer to push to (modified in place)
 * @param value - The sensor reading value to record
 * @param limit - Maximum number of samples to retain (defaults to MAX_HISTORY_SAMPLES)
 *
 * @example
 * ```ts
 * const history: Sample[] = [];
 * pushSample(history, 45.5);  // Add temperature reading
 * pushSample(history, 46.0);  // Add another reading
 * console.log(history.length); // 2
 * ```
 */
export function pushSample(buffer: Sample[], value: number, limit = MAX_HISTORY_SAMPLES): void {
    buffer.push({ t: Date.now(), v: value });
    if (buffer.length > limit) {
        buffer.splice(0, buffer.length - limit);
    }
}

/**
 * Computes statistics (min, max, average) over a buffer of samples.
 *
 * For an empty buffer, returns NaN for all numeric statistics and n=0.
 *
 * @param buffer - The sample buffer to compute statistics over
 * @returns Statistics object with min, max, avg, and sample count
 *
 * @example
 * ```ts
 * const samples: Sample[] = [
 *   { t: 1000, v: 45.0 },
 *   { t: 2000, v: 50.0 },
 *   { t: 3000, v: 47.5 },
 * ];
 * const stats = calcStats(samples);
 * // stats = { min: 45.0, max: 50.0, avg: 47.5, n: 3 }
 * ```
 */
export function calcStats(buffer: Sample[]): Stats {
    if (buffer.length === 0) {
        return { min: Number.NaN, max: Number.NaN, avg: Number.NaN, n: 0 };
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;

    for (const { v } of buffer) {
        if (v < min) {
            min = v;
        }
        if (v > max) {
            max = v;
        }
        sum += v;
    }

    return { min, max, avg: sum / buffer.length, n: buffer.length };
}
