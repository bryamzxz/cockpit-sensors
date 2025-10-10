import { getCockpit } from '../../utils/cockpit';
import type { Cockpit, CockpitSpawnError } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorKind, SensorSample, SENSOR_KIND_TO_UNIT } from './types';

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

const sensorKindForKey = (key: string): SensorKind | null => {
    const match = key.match(/^([a-zA-Z]+)\d+/);
    if (!match) {
        return null;
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
            return null;
    }
};

const readSensorsJson = async (cockpitInstance: Cockpit): Promise<unknown> => {
    try {
        const output = await cockpitInstance.spawn(['sensors', '-j'], { superuser: 'try', err: 'out' });
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

const parseSensorObject = (
    chipId: string,
    chipLabel: string,
    sensorKey: string,
    sensorValue: unknown,
): SensorSample | null => {
    if (!isRecord(sensorValue)) {
        return null;
    }

    const inputKey = `${sensorKey}_input`;
    const input = coerceNumber(sensorValue[inputKey]);
    if (typeof input !== 'number') {
        return null;
    }

    const kind = sensorKindForKey(sensorKey);
    if (!kind) {
        return null;
    }

    const labelCandidate = sensorValue[`${sensorKey}_label`];
    const label = typeof labelCandidate === 'string' && labelCandidate.trim().length > 0
        ? labelCandidate.trim()
        : sensorKey;

    const min = coerceNumber(sensorValue[`${sensorKey}_min`]);
    const max = coerceNumber(sensorValue[`${sensorKey}_max`]);
    const critical = coerceNumber(
        sensorValue[`${sensorKey}_crit`] ?? sensorValue[`${sensorKey}_crit_hyst`] ?? sensorValue[`${sensorKey}_crit_alarm`],
    );

    return {
        kind,
        id: `${chipId}:${sensorKey}`,
        label,
        value: input,
        min,
        max,
        critical,
        unit: SENSOR_KIND_TO_UNIT[kind],
        chipId,
        chipLabel,
        chipName: chipId,
    };
};

const parseSensorsPayload = (payload: unknown): SensorSample[] => {
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

            const sample = parseSensorObject(chipId, chipLabel, sensorKey, sensorValue);
            if (sample) {
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

        const samples = parseSensorsPayload(payload);
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

                const samples = parseSensorsPayload(payload);
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
            this.intervalHandle = window.setInterval(() => {
                void poll();
            }, POLL_INTERVAL_MS);
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
