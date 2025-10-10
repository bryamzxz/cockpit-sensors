import type { SensorCategory } from '../../types/sensors';

export type SensorKind = 'temp' | 'fan' | 'volt' | 'other';

export interface SensorSample {
    kind: SensorKind;
    id: string;
    label: string;
    value: number;
    min?: number;
    max?: number;
    critical?: number;
    unit?: string;
    chipId?: string;
    chipLabel?: string;
    chipName?: string;
    category?: SensorCategory;
}

export type Unsubscribe = () => void;

export type ProviderErrorCode = 'permission-denied' | 'unavailable' | 'unexpected';

export class ProviderError extends Error {
    readonly code: ProviderErrorCode;

    constructor(message: string, code: ProviderErrorCode = 'unexpected', options?: ErrorOptions) {
        super(message, options);
        this.code = code;
        this.name = 'ProviderError';
    }
}

export interface ProviderContext {
    onError?: (error: ProviderError) => void;
    refreshIntervalMs?: number;
}

export interface Provider {
    readonly name: string;
    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext): Unsubscribe;
    isAvailable(): Promise<boolean>;
}

export const SENSOR_KIND_TO_CATEGORY: Record<SensorKind, SensorCategory> = {
    temp: 'temperature',
    fan: 'fan',
    volt: 'voltage',
    other: 'unknown',
};

export const SENSOR_KIND_TO_UNIT: Record<SensorKind, string | undefined> = {
    temp: '°C',
    fan: 'RPM',
    volt: 'V',
    other: undefined,
};
