export type Sample = { t: number; v: number };
export type Stats = { min: number; max: number; avg: number; n: number };

export const MAX_HISTORY_SAMPLES = 300;

export function pushSample(buffer: Sample[], value: number, limit = MAX_HISTORY_SAMPLES): void {
    buffer.push({ t: Date.now(), v: value });
    if (buffer.length > limit) {
        buffer.splice(0, buffer.length - limit);
    }
}

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
