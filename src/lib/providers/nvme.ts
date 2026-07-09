import { getCockpit } from '../../utils/cockpit';
import type { Cockpit } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorSample, SENSOR_KIND_TO_UNIT } from './types';
import { isRecord, isValidDevicePath, spawnJson, startPollingInterval, POLLING_INTERVALS } from './utils';

const PROVIDER_NAME = 'nvme';
const UNAVAILABLE_MESSAGE = 'nvme-cli is not available on this system';

export interface NvmeDeviceInfo {
    name: string;
    model?: string;
    serial?: string;
}

interface NvmeSmartLog {
    composite_temperature?: number;
    temperature?: number;
}

/** Wrapper for spawnJson with nvme provider configuration */
const runJsonCommand = (cockpitInstance: Cockpit, command: string[]): Promise<unknown> =>
    spawnJson(cockpitInstance, command, PROVIDER_NAME, UNAVAILABLE_MESSAGE);

const listNvmeDevices = async (cockpitInstance: Cockpit): Promise<NvmeDeviceInfo[]> => {
    const payload = await runJsonCommand(cockpitInstance, ['nvme', 'list', '--output-format=json']);
    if (!isRecord(payload)) {
        return [];
    }

    const devicesValue = payload.Devices ?? payload.devices;
    if (!Array.isArray(devicesValue)) {
        return [];
    }

    const devices: NvmeDeviceInfo[] = [];
    for (const entry of devicesValue) {
        if (!isRecord(entry)) {
            continue;
        }

        const name = typeof entry.DevicePath === 'string'
            ? entry.DevicePath
            : typeof entry.Name === 'string'
                ? entry.Name
                : undefined;
        if (!name) {
            continue;
        }

        if (!isValidDevicePath(name)) {
            continue;
        }

        const model = typeof entry.ModelNumber === 'string' ? entry.ModelNumber.trim() : undefined;
        const serial = typeof entry.SerialNumber === 'string' ? entry.SerialNumber.trim() : undefined;

        devices.push({ name, model, serial });
    }

    return devices;
};

const readSmartLog = async (cockpitInstance: Cockpit, devicePath: string): Promise<NvmeSmartLog> => {
    const payload = await runJsonCommand(cockpitInstance, ['nvme', 'smart-log', devicePath, '--output-format=json']);
    if (!isRecord(payload)) {
        return {};
    }

    return payload;
};

export const convertTemperature = (raw?: number): number | undefined => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return undefined;
    }

    // The NVMe specification encodes composite temperatures in Kelvin.
    if (raw > 200) {
        return raw - 273;
    }

    return raw;
};

export const buildSample = (device: NvmeDeviceInfo, temperature: number): SensorSample => {
    const labelParts = [device.model ?? 'NVMe device'];
    if (device.serial) {
        labelParts.push(`#${device.serial}`);
    }

    const label = labelParts.join(' ');

    return {
        kind: 'temp',
        id: `${device.name}:temperature`,
        label,
        value: temperature,
        unit: SENSOR_KIND_TO_UNIT.temp,
        chipId: device.name,
        chipLabel: device.model ? `${device.model} (${device.name})` : device.name,
        chipName: device.model ?? device.name,
    };
};

export class NvmeProvider implements Provider {
    readonly name = 'nvme';

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const devices = await listNvmeDevices(cockpitInstance).catch(error => {
            if (error instanceof ProviderError) {
                if (error.code === 'permission-denied') {
                    throw error;
                }

                if (error.code === 'unavailable') {
                    return [];
                }
            }

            return [];
        });

        return devices.length > 0;
    }

    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext) {
        const cockpitInstance = getCockpit();
        let disposed = false;
        let devices: NvmeDeviceInfo[] = [];
        let lastScanAt = 0;

        const poll = async () => {
            try {
                // Device topology changes rarely; keep the list cached and
                // only re-scan on a slow schedule instead of every poll.
                const now = Date.now();
                if (devices.length === 0 || now - lastScanAt >= POLLING_INTERVALS.DEVICE_RESCAN) {
                    devices = await listNvmeDevices(cockpitInstance);
                    lastScanAt = now;
                }

                if (disposed) {
                    return;
                }

                if (devices.length === 0) {
                    onChange([]);
                    return;
                }

                const results = await Promise.all(devices.map(async device => {
                    try {
                        const log = await readSmartLog(cockpitInstance, device.name);
                        const temperature = convertTemperature(log.composite_temperature ?? log.temperature);
                        return typeof temperature === 'number' ? buildSample(device, temperature) : null;
                    } catch (error) {
                        if (error instanceof ProviderError && error.code === 'permission-denied') {
                            throw error;
                        }

                        return null;
                    }
                }));

                if (disposed) {
                    return;
                }

                onChange(results.filter((sample): sample is SensorSample => sample !== null));
            } catch (error) {
                if (disposed) {
                    return;
                }

                if (error instanceof ProviderError) {
                    context?.onError?.(error);
                }
            }
        };

        void poll();

        // SMART data changes slowly; never let a fast dashboard refresh
        // preference drive per-disk wake-ups below the disk interval.
        const interval = Math.max(context?.refreshIntervalMs ?? POLLING_INTERVALS.NVME, POLLING_INTERVALS.NVME);
        const stopInterval = startPollingInterval(poll, interval, context?.isPaused);

        return () => {
            disposed = true;
            stopInterval();
        };
    }
}

export const nvmeProvider = new NvmeProvider();
