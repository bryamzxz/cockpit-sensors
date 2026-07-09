/**
 * Module-level history store shared by every sensor category.
 *
 * Keeping the buffers outside React components means history keeps
 * accumulating for all categories regardless of which tab is mounted,
 * and gives the app a single push site per data refresh instead of one
 * per rendered table.
 */

import { pushSample, type Sample } from './history';
import type { SensorChipGroup } from '../types/sensors';

const buffers = new Map<string, Sample[]>();

/** Builds the buffer key for a reading; must match the table row keys. */
export const historyKeyFor = (groupId: string, readingLabel: string): string =>
    `${groupId}:${readingLabel}`;

/**
 * Records the current reading of every group into the history buffers
 * and prunes buffers whose readings disappeared.
 *
 * @param groups - All sensor groups from the latest refresh
 * @param minIntervalMs - Skip a buffer if its last sample is newer than
 *   this window; collapses the bursts caused by several providers
 *   reporting within the same refresh cycle
 * @returns true when any buffer changed
 */
export const recordSamples = (groups: SensorChipGroup[], minIntervalMs = 0): boolean => {
    const now = Date.now();
    const activeKeys = new Set<string>();
    let changed = false;

    for (const group of groups) {
        for (const reading of group.readings) {
            const key = historyKeyFor(group.id, reading.label);
            activeKeys.add(key);

            if (!Number.isFinite(reading.input)) {
                continue;
            }

            let buffer = buffers.get(key);
            if (!buffer) {
                buffer = [];
                buffers.set(key, buffer);
            }

            const last = buffer[buffer.length - 1];
            if (last && minIntervalMs > 0 && now - last.t < minIntervalMs) {
                continue;
            }

            pushSample(buffer, reading.input);
            changed = true;
        }
    }

    for (const key of Array.from(buffers.keys())) {
        if (!activeKeys.has(key)) {
            buffers.delete(key);
            changed = true;
        }
    }

    return changed;
};

export const getHistory = (key: string): Sample[] => buffers.get(key) ?? [];

export const hasAnyHistory = (): boolean => {
    for (const buffer of buffers.values()) {
        if (buffer.length > 0) {
            return true;
        }
    }
    return false;
};

export const clearHistory = (): void => {
    buffers.clear();
};
