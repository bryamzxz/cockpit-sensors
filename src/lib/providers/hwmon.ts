import { getCockpit } from '../../utils/cockpit';
import type { Cockpit } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorSample, SensorKind } from './types';
import {
    readFile as readFileUtil,
    readNumberFile as readNumberFileUtil,
    spawnText as spawnTextUtil,
    trim,
    POLLING_INTERVALS,
} from './utils';

interface HwmonSensorDescriptor {
    id: string;
    chipId: string;
    chipLabel: string;
    chipName: string;
    kind: SensorKind;
    label: string;
    unit: string;
    inputPath: string;
    minPath?: string;
    maxPath?: string;
    critPath?: string;
    scale: number;
    min?: number;
    max?: number;
    critical?: number;
}

interface HwmonChipDescriptor {
    id: string;
    name: string;
    label: string;
    sensors: HwmonSensorDescriptor[];
}

const PROVIDER_NAME = 'hwmon';
const HWMON_ROOT = '/sys/class/hwmon';

/** Wrapper for readFile with hwmon provider name */
const readFile = (cockpitInstance: Cockpit, path: string): Promise<string | null> =>
    readFileUtil(cockpitInstance, path, PROVIDER_NAME);

/** Wrapper for readNumberFile with hwmon provider name */
const readNumberFile = (
    cockpitInstance: Cockpit,
    path: string | undefined,
    scale = 1,
): Promise<number | undefined> =>
    readNumberFileUtil(cockpitInstance, path, PROVIDER_NAME, scale);

/** Wrapper for spawnText with hwmon provider name */
const spawnText = (cockpitInstance: Cockpit, command: string[] | string): Promise<string> =>
    spawnTextUtil(cockpitInstance, command, PROVIDER_NAME);

const resolveSensorLabel = async (
    cockpitInstance: Cockpit,
    chipPath: string,
    prefix: string,
    index: string,
    fallback: string,
): Promise<string> => {
    const labelPath = `${chipPath}/${prefix}${index}_label`;
    const namePath = `${chipPath}/${prefix}${index}_name`;

    const label = await readFile(cockpitInstance, labelPath);
    if (label) {
        return trim(label);
    }

    const name = await readFile(cockpitInstance, namePath);
    if (name) {
        return trim(name);
    }

    return fallback;
};

const sensorKindForPrefix = (prefix: string): SensorKind | null => {
    switch (prefix) {
        case 'temp':
            return 'temp';
        case 'fan':
            return 'fan';
        case 'in':
        case 'vin':
        case 'vcc':
            return 'volt';
        case 'power':
            return 'power';
        default:
            return null;
    }
};

const unitForKind = (kind: SensorKind): string => {
    switch (kind) {
        case 'temp':
            return '°C';
        case 'fan':
            return 'RPM';
        case 'volt':
            return 'V';
        case 'power':
            return 'W';
        case 'other':
        default:
            return '';
    }
};

const scaleForKind = (kind: SensorKind): number => {
    switch (kind) {
        case 'temp':
        case 'volt':
            return 0.001;
        case 'power':
            return 0.000001;
        case 'fan':
        default:
            return 1;
    }
};

const extractSensorsFromListing = async (
    cockpitInstance: Cockpit,
    chipId: string,
    chipLabel: string,
    chipName: string,
    chipPath: string,
    listing: string,
): Promise<HwmonSensorDescriptor[]> => {
    const entries = listing
            .split('\n')
            .map(trim)
            .filter(entry => entry.endsWith('_input'));

    const descriptors: HwmonSensorDescriptor[] = [];

    for (const entry of entries) {
        const match = entry.match(/^(?<prefix>[a-z]+)(?<index>\d+)_input$/);
        if (!match || !match.groups) {
            continue;
        }

        const prefix = match.groups.prefix;
        const index = match.groups.index;
        const kind = sensorKindForPrefix(prefix);
        if (!kind) {
            continue;
        }

        const label = await resolveSensorLabel(cockpitInstance, chipPath, prefix, index, `${chipLabel} ${prefix}${index}`);
        const unit = unitForKind(kind);
        const scale = scaleForKind(kind);

        descriptors.push({
            id: `${chipId}:${prefix}${index}`,
            chipId,
            chipLabel,
            chipName,
            kind,
            label,
            unit,
            scale,
            inputPath: `${chipPath}/${entry}`,
            minPath: `${chipPath}/${prefix}${index}_min`,
            maxPath: `${chipPath}/${prefix}${index}_max`,
            critPath: `${chipPath}/${prefix}${index}_crit`,
        });
    }

    return descriptors;
};

const buildChipDescriptors = async (cockpitInstance: Cockpit): Promise<HwmonChipDescriptor[]> => {
    const rawList = await spawnText(cockpitInstance, [
        'find', HWMON_ROOT, '-mindepth', '1', '-maxdepth', '1', '-name', 'hwmon*',
    ]).catch(error => {
        if (error instanceof ProviderError && error.code === 'unexpected') {
            return '';
        }

        throw error;
    });
    const chipPaths = rawList
            .split('\n')
            .map(trim)
            .filter(path => path.length > 0);

    const chips: HwmonChipDescriptor[] = [];

    for (const chipPath of chipPaths) {
        const name = (await readFile(cockpitInstance, `${chipPath}/name`)) ?? '';
        const label = name ? trim(name) : chipPath.split('/').pop() ?? chipPath;
        const id = chipPath.split('/').pop() ?? chipPath;

        const listing = await spawnText(cockpitInstance, [
            'find', chipPath, '-maxdepth', '1', '-name', '*_input', '-type', 'f', '-printf', '%f\n',
        ]).catch(error => {
            if (error instanceof ProviderError && error.code === 'unexpected') {
                return '';
            }

            throw error;
        });
        const sensors = await extractSensorsFromListing(cockpitInstance, id, label, label, chipPath, listing);

        if (sensors.length === 0) {
            continue;
        }

        chips.push({
            id,
            name: label,
            label,
            sensors,
        });
    }

    return chips;
};

const buildSample = (descriptor: HwmonSensorDescriptor, value: number): SensorSample => ({
    kind: descriptor.kind,
    id: descriptor.id,
    label: descriptor.label,
    value,
    min: descriptor.min,
    max: descriptor.max,
    critical: descriptor.critical,
    unit: descriptor.unit,
    chipId: descriptor.chipId,
    chipLabel: descriptor.chipLabel,
    chipName: descriptor.chipName,
});

export class HwmonProvider implements Provider {
    readonly name = 'hwmon';

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const output = await spawnText(
            cockpitInstance,
            ['find', HWMON_ROOT, '-maxdepth', '2', '-type', 'f', '-name', '*_input', '-print', '-quit'],
        ).catch(error => {
            if (error instanceof ProviderError && error.code === 'permission-denied') {
                throw error;
            }

            return '';
        });
        return output.trim().length > 0;
    }

    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext) {
        const cockpitInstance = getCockpit();
        let disposed = false;
        let polling = false;
        let intervalHandle: number | undefined;
        let sensors: HwmonSensorDescriptor[] = [];

        const reportError = (error: unknown, fallbackMessage: string) => {
            if (disposed) {
                return;
            }

            const providerError =
                error instanceof ProviderError
                    ? error
                    : new ProviderError((error as Error).message || fallbackMessage, 'unexpected', {
                        cause: error instanceof Error ? error : undefined,
                    });
            context?.onError?.(providerError);
        };

        const poll = async () => {
            // sysfs attributes never emit inotify events, so values must be
            // re-read on every cycle instead of relying on file watches.
            if (disposed || polling) {
                return;
            }

            polling = true;
            try {
                const values = await Promise.all(sensors.map(sensor =>
                    readNumberFile(cockpitInstance, sensor.inputPath, sensor.scale)));

                if (disposed) {
                    return;
                }

                const samples: SensorSample[] = [];
                sensors.forEach((sensor, index) => {
                    const value = values[index];
                    if (typeof value === 'number') {
                        samples.push(buildSample(sensor, value));
                    }
                });
                onChange(samples);
            } catch (error) {
                reportError(error, 'hwmon read failure');
            } finally {
                polling = false;
            }
        };

        const bootstrap = async () => {
            try {
                const chips = await buildChipDescriptors(cockpitInstance);
                if (disposed) {
                    return;
                }

                sensors = chips.flatMap(chip => chip.sensors);
                if (sensors.length === 0) {
                    onChange([]);
                    return;
                }

                await Promise.all(sensors.map(async sensor => {
                    [sensor.min, sensor.max, sensor.critical] = await Promise.all([
                        readNumberFile(cockpitInstance, sensor.minPath, sensor.scale),
                        readNumberFile(cockpitInstance, sensor.maxPath, sensor.scale),
                        readNumberFile(cockpitInstance, sensor.critPath, sensor.scale),
                    ]);
                }));

                await poll();
                if (disposed) {
                    return;
                }

                if (typeof window !== 'undefined') {
                    const interval = Math.max(
                        context?.refreshIntervalMs ?? POLLING_INTERVALS.DEFAULT,
                        POLLING_INTERVALS.MINIMUM,
                    );
                    intervalHandle = window.setInterval(() => {
                        void poll();
                    }, interval);
                }
            } catch (error) {
                reportError(error, 'hwmon failure');
            }
        };

        void bootstrap();

        return () => {
            disposed = true;
            if (typeof window !== 'undefined' && intervalHandle) {
                window.clearInterval(intervalHandle);
                intervalHandle = undefined;
            }
        };
    }
}

export const hwmonProvider = new HwmonProvider();
