import { getCockpit } from '../../utils/cockpit';
import type { Cockpit, CockpitSpawnError } from '../../types/cockpit';
import {
    Provider,
    ProviderContext,
    ProviderError,
    SensorKind,
    SensorSample,
    SENSOR_KIND_TO_CATEGORY,
    SENSOR_KIND_TO_UNIT,
} from './types';

const POLL_INTERVAL_MS = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

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

const isPermissionDenied = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const spawnError = error as CockpitSpawnError & { message?: string };
    if (spawnError.problem === 'access-denied') {
        return true;
    }

    if (typeof spawnError.message === 'string' && /permission denied/i.test(spawnError.message)) {
        return true;
    }

    return false;
};

const isCommandMissing = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const spawnError = error as CockpitSpawnError & { message?: string };
    if (spawnError.problem === 'not-found') {
        return true;
    }

    if (spawnError.exit_status === 127) {
        return true;
    }

    if (typeof spawnError.message === 'string') {
        return /command not found|no such file or directory/i.test(spawnError.message);
    }

    return false;
};

const INPUT_SUFFIX = '_input';

const sensorKindForKey = (key: string): SensorKind => {
    const match = key.match(/^([a-zA-Z]+)/);
    if (!match) {
        return 'other';
    }

    const prefix = match[1].toLowerCase();
    switch (prefix) {
        case 'temp':
            return 'temp';
        case 'fan':
            return 'fan';
        case 'in':
        case 'vin':
        case 'vcc':
            return 'volt';
        default:
            return 'other';
    }
};

const prettifyLabel = (label: string): string => {
    const trimmed = label.trim();
    if (/^package id\s*\d+$/i.test(trimmed)) {
        return 'CPU Package';
    }

    const coreMatch = trimmed.match(/^core\s*(\d+)$/i);
    if (coreMatch) {
        return `CPU Core ${coreMatch[1]}`;
    }

    return trimmed;
};

const readSensorsJson = async (cockpitInstance: Cockpit): Promise<unknown> => {
    try {
        const output = await cockpitInstance.spawn(['sensors', '-jA'], { superuser: 'try', err: 'out' });
        const trimmed = output.trim();
        if (!trimmed) {
            return {};
        }

        return JSON.parse(trimmed);
    } catch (error) {
        if (isPermissionDenied(error)) {
            throw new ProviderError('Permission denied while executing sensors -j', 'permission-denied', {
                cause: error instanceof Error ? error : undefined,
            });
        }

        if (isCommandMissing(error)) {
            throw new ProviderError('lm-sensors utility is not available on this system', 'unavailable', {
                cause: error instanceof Error ? error : undefined,
            });
        }

        const cause = error instanceof Error ? error : undefined;
        throw new ProviderError('Failed to collect data from sensors -j', 'unexpected', { cause });
    }
};

const buildSample = (
    chipId: string,
    chipLabel: string,
    groupKey: string,
    featureKey: string,
    featureValue: unknown,
    featureRecord: Record<string, unknown>,
): SensorSample | null => {
    const input = coerceNumber(featureValue);
    if (typeof input !== 'number') {
        return null;
    }

    const kind = sensorKindForKey(featureKey);
    const baseKey = featureKey.replace(new RegExp(`${INPUT_SUFFIX}$`), '');

    const labelCandidate = featureRecord[`${baseKey}_label`];
    const fallbackLabel =
        typeof groupKey === 'string' && groupKey.trim().length > 0 && groupKey !== chipId ? groupKey : undefined;
    const label =
        (typeof labelCandidate === 'string' && labelCandidate.trim().length > 0
            ? labelCandidate.trim()
            : fallbackLabel) ?? baseKey;

    const min = coerceNumber(featureRecord[`${baseKey}_min`] ?? featureRecord[`${baseKey}_low`]);
    const max = coerceNumber(
        featureRecord[`${baseKey}_max`] ?? featureRecord[`${baseKey}_high`] ?? featureRecord[`${baseKey}_crit`],
    );
    const critical = coerceNumber(featureRecord[`${baseKey}_crit`]);

    return {
        kind,
        id: `${chipId}:${baseKey}`,
        label: prettifyLabel(label),
        value: input,
        min,
        max,
        critical,
        unit: SENSOR_KIND_TO_UNIT[kind],
        chipId,
        chipLabel,
        chipName: chipId,
        category: SENSOR_KIND_TO_CATEGORY[kind],
    };
};

const collectGroupSamples = (
    chipId: string,
    chipLabel: string,
    groupKey: string,
    groupValue: Record<string, unknown>,
): SensorSample[] => {
    const samples: SensorSample[] = [];

    for (const [featureKey, featureValue] of Object.entries(groupValue)) {
        if (!featureKey.endsWith(INPUT_SUFFIX)) {
            continue;
        }

        const sample = buildSample(chipId, chipLabel, groupKey, featureKey, featureValue, groupValue);
        if (sample) {
            samples.push(sample);
        }
    }

    return samples;
};

export const normalizeLmSensors = (payload: unknown): SensorSample[] => {
    if (!isRecord(payload)) {
        return [];
    }

    const samples: SensorSample[] = [];

    for (const [chipId, chipValue] of Object.entries(payload)) {
        if (!isRecord(chipValue)) {
            continue;
        }

        const adapter = chipValue.Adapter;
        const adapterLabel = typeof adapter === 'string' && adapter.trim().length > 0 ? adapter.trim() : undefined;
        const chipLabel = adapterLabel ? `${chipId} (${adapterLabel})` : chipId;

        for (const [sensorKey, sensorValue] of Object.entries(chipValue)) {
            if (sensorKey === 'Adapter') {
                continue;
            }

            if (sensorKey.endsWith(INPUT_SUFFIX)) {
                const featureRecord = chipValue;
                const sample = buildSample(chipId, chipLabel, chipId, sensorKey, sensorValue, featureRecord);
                if (sample) {
                    samples.push(sample);
                }
                continue;
            }

            if (!isRecord(sensorValue)) {
                continue;
            }

            const groupSamples = collectGroupSamples(chipId, chipLabel, sensorKey, sensorValue);
            for (const sample of groupSamples) {
                samples.push(sample);
            }
        }
    }

    return samples;
};

export class LmSensorsProvider implements Provider {
    readonly name = 'lm-sensors';
    private intervalHandle: number | undefined;

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const payload = await readSensorsJson(cockpitInstance).catch(error => {
            if (error instanceof ProviderError) {
                if (error.code === 'permission-denied') {
                    throw error;
                }

                if (error.code === 'unavailable') {
                    return {};
                }
            }

            return {};
        });

        const samples = normalizeLmSensors(payload);
        return samples.length > 0;
    }

    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext) {
        const cockpitInstance = getCockpit();
        let disposed = false;

        const poll = async () => {
            try {
                const payload = await readSensorsJson(cockpitInstance);
                if (disposed) {
                    return;
                }

                const samples = normalizeLmSensors(payload);
                onChange(samples);
            } catch (error) {
                if (disposed) {
                    return;
                }

                if (error instanceof ProviderError) {
                    context?.onError?.(error);
                    if (error.code === 'permission-denied') {
                        return;
                    }
                }
            }
        };

        void poll();

        if (typeof window !== 'undefined') {
            const interval = context?.refreshIntervalMs ?? POLL_INTERVAL_MS;
            this.intervalHandle = window.setInterval(() => {
                void poll();
            }, interval);
        }

        return () => {
            disposed = true;
            if (typeof window !== 'undefined' && this.intervalHandle) {
                window.clearInterval(this.intervalHandle);
                this.intervalHandle = undefined;
            }
        };
    }
}

export const lmSensorsProvider = new LmSensorsProvider();
