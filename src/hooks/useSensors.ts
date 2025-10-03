import React from 'react';
import { EMPTY_SENSOR_DATA, SensorCategory, SensorData } from '../types/sensors';
import { parseSensorsJson } from '../utils/parseSensorsJson';

declare global {
    interface ImportMeta {
        readonly env?: {
            readonly VITE_MOCK?: unknown;
        };
    }
}

const MOCK_REFRESH_INTERVAL_MS = 5000;

interface UseSensorsResult {
    data: SensorData;
    isLoading: boolean;
    isMocked: boolean;
}

type MockReading = {
    label: string;
    input: number;
    min?: number;
    max?: number;
    critical?: number;
    unit?: string;
};

type MockGroup = {
    id: string;
    name: string;
    label: string;
    category: SensorCategory;
    readings: MockReading[];
};

const BASE_MOCK_GROUPS: MockGroup[] = [
    {
        id: 'chip-cpu-0',
        name: 'k10temp-pci-00c3',
        label: 'CPU package sensors',
        category: 'temperature',
        readings: [
            { label: 'Tctl', input: 48.5, max: 90, critical: 95, unit: '°C' },
            { label: 'Tdie', input: 47.2, max: 90, critical: 95, unit: '°C' },
        ],
    },
    {
        id: 'chip-fan-0',
        name: 'nct6796d-isa-0290',
        label: 'Chassis fans',
        category: 'fan',
        readings: [
            { label: 'Chassis fan 1', input: 1180, min: 600, max: 2100, unit: 'RPM' },
            { label: 'Chassis fan 2', input: 1320, min: 600, max: 2200, unit: 'RPM' },
        ],
    },
    {
        id: 'chip-voltage-0',
        name: 'nct6796d-isa-0290-voltage',
        label: 'Voltage rails',
        category: 'voltage',
        readings: [
            { label: '+12V', input: 12.2, min: 11.6, max: 12.6, unit: 'V' },
            { label: '+5V', input: 5.02, min: 4.8, max: 5.2, unit: 'V' },
        ],
    },
];

const buildMockPayload = (step: number) => ({
    timestamp: Date.now(),
    chips: BASE_MOCK_GROUPS.map(group => ({
        ...group,
        readings: group.readings.map((reading, index) => {
            const oscillation = Math.sin(step / 2 + index) * 1.5;
            const input = reading.input + oscillation;
            return {
                ...reading,
                input: input.toFixed(2),
            };
        }),
    })),
});

const readMockFlag = (): string | undefined => {
    const globalValue = (globalThis as Record<string, unknown>).VITE_MOCK;
    if (typeof globalValue === 'string' || typeof globalValue === 'number') {
        return String(globalValue);
    }

    const importMetaEnv = import.meta.env;
    if (importMetaEnv && typeof importMetaEnv === 'object') {
        const fromImportMeta = (importMetaEnv as { VITE_MOCK?: unknown }).VITE_MOCK;
        if (typeof fromImportMeta === 'string' || typeof fromImportMeta === 'number') {
            return String(fromImportMeta);
        }
    }

    return undefined;
};

const useMockFlag = (): boolean => {
    const [flag] = React.useState(() => {
        const value = (readMockFlag() ?? '').toString().toLowerCase();
        return value === '1' || value === 'true';
    });

    return flag;
};

export const useSensors = (): UseSensorsResult => {
    const isMocked = useMockFlag();
    const [data, setData] = React.useState<SensorData>(EMPTY_SENSOR_DATA);
    const [isLoading, setIsLoading] = React.useState<boolean>(isMocked);

    React.useEffect(() => {
        if (!isMocked) {
            setData({ ...EMPTY_SENSOR_DATA });
            setIsLoading(false);
            return undefined;
        }

        let cancelled = false;
        let step = 0;

        const pushUpdate = () => {
            if (cancelled) {
                return;
            }

            const payload = buildMockPayload(step);
            step += 1;
            const parsed = parseSensorsJson(payload);
            setData(parsed);
            setIsLoading(false);
        };

        pushUpdate();
        const interval = window.setInterval(pushUpdate, MOCK_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [isMocked]);

    return { data, isLoading, isMocked };
};
