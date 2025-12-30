import { getCockpit } from '../../utils/cockpit';
import type { Cockpit } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorSample, SENSOR_KIND_TO_UNIT } from './types';
import { isRecord, spawnJson, POLLING_INTERVALS } from './utils';

const PROVIDER_NAME = 'smartctl';
const UNAVAILABLE_MESSAGE = 'smartmontools is not available on this system';

export interface SmartctlDeviceInfo {
    name: string;
    model?: string;
    serial?: string;
    protocol?: string;
}

interface SmartctlScanResult {
    devices?: Array<{
        name?: string;
        info_name?: string;
        type?: string;
        protocol?: string;
    }>;
}

interface SmartctlDeviceData {
    device?: {
        name?: string;
        info_name?: string;
        type?: string;
        protocol?: string;
    };
    model_name?: string;
    serial_number?: string;
    temperature?: {
        current?: number;
    };
    ata_smart_attributes?: {
        table?: Array<{
            id: number;
            name: string;
            value: number;
            raw?: {
                value: number;
                string: string;
            };
        }>;
    };
}

/** Wrapper for spawnJson with smartctl provider configuration */
const runJsonCommand = (cockpitInstance: Cockpit, command: string[]): Promise<unknown> =>
    spawnJson(cockpitInstance, command, PROVIDER_NAME, UNAVAILABLE_MESSAGE);

const listSmartctlDevices = async (cockpitInstance: Cockpit): Promise<SmartctlDeviceInfo[]> => {
    const payload = await runJsonCommand(cockpitInstance, ['smartctl', '--scan', '-j']);
    if (!isRecord(payload)) {
        return [];
    }

    const result = payload as SmartctlScanResult;
    if (!Array.isArray(result.devices)) {
        return [];
    }

    const devices: SmartctlDeviceInfo[] = [];
    for (const entry of result.devices) {
        if (!isRecord(entry) || typeof entry.name !== 'string') {
            continue;
        }

        devices.push({
            name: entry.name,
            protocol: typeof entry.protocol === 'string' ? entry.protocol : undefined,
        });
    }

    return devices;
};

const readDeviceData = async (cockpitInstance: Cockpit, devicePath: string): Promise<SmartctlDeviceData> => {
    // Use -i for device info and -A for attributes, combined in one call
    const payload = await runJsonCommand(cockpitInstance, ['smartctl', '-i', '-A', '-j', devicePath]);
    if (!isRecord(payload)) {
        return {};
    }

    return payload as SmartctlDeviceData;
};

/**
 * Extract temperature from smartctl data.
 * Priority: temperature.current > ata_smart_attributes id 194 > id 190
 */
export const extractTemperature = (data: SmartctlDeviceData): number | undefined => {
    // First try the direct temperature field
    if (data.temperature?.current !== undefined && Number.isFinite(data.temperature.current)) {
        return data.temperature.current;
    }

    // Fall back to SMART attributes
    const table = data.ata_smart_attributes?.table;
    if (!Array.isArray(table)) {
        return undefined;
    }

    // Try attribute 194 (Temperature_Celsius) first, then 190 (Airflow_Temperature_Cel)
    for (const attrId of [194, 190]) {
        const attr = table.find(a => a.id === attrId);
        if (attr?.value !== undefined && Number.isFinite(attr.value)) {
            return attr.value;
        }
    }

    return undefined;
};

export const buildSample = (device: SmartctlDeviceInfo, temperature: number): SensorSample => {
    const labelParts = [device.model ?? 'SATA device'];
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

export class SmartctlProvider implements Provider {
    readonly name = 'smartctl';
    private intervalHandle: number | undefined;

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const devices = await listSmartctlDevices(cockpitInstance).catch(error => {
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

        const poll = async () => {
            try {
                const devices = await listSmartctlDevices(cockpitInstance);
                if (disposed) {
                    return;
                }

                if (devices.length === 0) {
                    onChange([]);
                    return;
                }

                const samples: SensorSample[] = [];
                for (const device of devices) {
                    try {
                        const data = await readDeviceData(cockpitInstance, device.name);

                        // Enrich device info with model and serial from response
                        if (data.model_name) {
                            device.model = data.model_name.trim();
                        }
                        if (data.serial_number) {
                            device.serial = data.serial_number.trim();
                        }

                        const temperature = extractTemperature(data);
                        if (typeof temperature === 'number') {
                            samples.push(buildSample(device, temperature));
                        }
                    } catch (error) {
                        if (error instanceof ProviderError) {
                            if (error.code === 'permission-denied') {
                                context?.onError?.(error);
                                return;
                            }

                            if (error.code === 'unavailable') {
                                continue;
                            }
                        }
                    }
                }

                onChange(samples);
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

        if (typeof window !== 'undefined') {
            const interval = context?.refreshIntervalMs ?? POLLING_INTERVALS.NVME;
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

export const smartctlProvider = new SmartctlProvider();
