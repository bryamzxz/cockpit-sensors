import React from 'react';

import { EMPTY_SENSOR_DATA, SensorChipGroup, SensorData } from '../types/sensors';
import { DEFAULT_SENSOR_REFRESH_MS } from './useSensorPreferences';
import { hwmonProvider } from '../lib/providers/hwmon';
import { lmSensorsProvider } from '../lib/providers/lm-sensors';
import { nvmeProvider } from '../lib/providers/nvme';
import { powercapProvider } from '../lib/providers/powercap';
import {
    Provider,
    ProviderError,
    SensorSample,
    SENSOR_KIND_TO_CATEGORY,
    SENSOR_KIND_TO_UNIT,
} from '../lib/providers/types';

export type SensorsStatus = 'loading' | 'ready' | 'no-data' | 'no-sources' | 'needs-privileges' | 'error';

interface SampleWithProvider extends SensorSample {
    provider: string;
}

export type { SampleWithProvider };

interface UseSensorsState {
    data: SensorData;
    isLoading: boolean;
    status: SensorsStatus;
    activeProvider?: string;
    lastError?: string;
}

export interface UseSensorsResult extends UseSensorsState {
    availableProviders: string[];
    retry: () => void;
}

const PRIMARY_PROVIDERS: Provider[] = [hwmonProvider, lmSensorsProvider];
const AUXILIARY_PROVIDERS: Provider[] = [powercapProvider, nvmeProvider];
const AGGREGATION_ORDER = PRIMARY_PROVIDERS.concat(AUXILIARY_PROVIDERS).map(provider => provider.name);

const aggregateSamples = (samplesByProvider: Map<string, SensorSample[]>): SampleWithProvider[] => {
    const aggregated: SampleWithProvider[] = [];
    const seen = new Set<string>();

    for (const providerName of AGGREGATION_ORDER) {
        const samples = samplesByProvider.get(providerName) ?? [];
        for (const sample of samples) {
            const dedupeKey = `${sample.kind}:${sample.id}`;
            if (seen.has(dedupeKey)) {
                continue;
            }

            aggregated.push({ ...sample, provider: providerName });
            seen.add(dedupeKey);
        }
    }

    return aggregated;
};

const sortGroups = (groups: SensorChipGroup[]): SensorChipGroup[] => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    return [...groups]
            .sort((a, b) => collator.compare(a.label, b.label))
            .map(group => ({
                ...group,
                readings: [...group.readings].sort((a, b) => collator.compare(a.label, b.label)),
            }));
};

const samplesToSensorData = (samples: SampleWithProvider[]): SensorData => {
    if (samples.length === 0) {
        return { ...EMPTY_SENSOR_DATA };
    }

    const groups = new Map<string, SensorChipGroup>();

    for (const sample of samples) {
        const category = sample.category ?? SENSOR_KIND_TO_CATEGORY[sample.kind];
        const chipId = sample.chipId ?? sample.id;
        const groupKey = `${chipId}:${category}`;
        const unit = sample.unit ?? SENSOR_KIND_TO_UNIT[sample.kind];

        const reading = {
            label: sample.label,
            input: sample.value,
            min: sample.min,
            max: sample.max,
            critical: sample.critical,
            unit,
        };

        const existing = groups.get(groupKey);
        if (existing) {
            existing.readings.push(reading);
            continue;
        }

        const name = sample.chipName ?? chipId;
        const label = sample.chipLabel ?? name;

        groups.set(groupKey, {
            id: groupKey,
            name,
            label,
            category,
            readings: [reading],
            source: sample.provider,
        });
    }

    return { groups: sortGroups(Array.from(groups.values())) };
};

export const __testing = {
    aggregateSamples,
    samplesToSensorData,
};

export const useSensors = (refreshIntervalMs = DEFAULT_SENSOR_REFRESH_MS): UseSensorsResult => {
    const [state, setState] = React.useState<UseSensorsState>({
        data: { ...EMPTY_SENSOR_DATA },
        isLoading: true,
        status: 'loading',
    });
    const [availableProviders, setAvailableProviders] = React.useState<string[]>([]);
    const [retryToken, setRetryToken] = React.useState(0);

    React.useEffect(() => {
        let cancelled = false;
        let activeProvider: Provider | undefined;
        let primaryUnsubscribe: (() => void) | undefined;
        const auxiliaryUnsubscribes: Array<() => void> = [];
        const samplesByProvider = new Map<string, SensorSample[]>();
        const permissionDeniedRef = { current: false } as React.MutableRefObject<boolean>;

        const updateState = () => {
            if (cancelled) {
                return;
            }

            const aggregated = aggregateSamples(samplesByProvider);
            setState(prev => {
                if (prev.status === 'needs-privileges' || prev.status === 'error') {
                    return prev;
                }

                if (aggregated.length === 0) {
                    return {
                        data: { ...EMPTY_SENSOR_DATA },
                        isLoading: false,
                        status: activeProvider ? 'no-data' : 'no-sources',
                        activeProvider: activeProvider?.name ?? prev.activeProvider,
                        lastError: prev.lastError,
                    };
                }

                const providerName = activeProvider?.name ?? aggregated[0]?.provider;

                const hasPermissionError = permissionDeniedRef.current || prev.status === 'needs-privileges';

                return {
                    data: samplesToSensorData(aggregated),
                    isLoading: false,
                    status: hasPermissionError ? 'needs-privileges' : 'ready',
                    activeProvider: providerName,
                    lastError: hasPermissionError ? prev.lastError : undefined,
                };
            });
        };

        const handleProviderError = (provider: Provider, error: ProviderError) => {
            if (cancelled) {
                return;
            }

            if (error.code === 'permission-denied') {
                permissionDeniedRef.current = true;

                const aggregated = aggregateSamples(samplesByProvider);
                const providerName = activeProvider?.name ?? aggregated[0]?.provider ?? provider.name;

                setState(prev => ({
                    data: aggregated.length > 0 ? samplesToSensorData(aggregated) : prev.data,
                    isLoading: false,
                    status: 'needs-privileges',
                    activeProvider: prev.activeProvider ?? providerName,
                    lastError: error.message,
                }));
                return;
            }

            setState(prev => {
                if (prev.status === 'ready' || prev.status === 'needs-privileges') {
                    return prev;
                }

                return {
                    data: prev.data,
                    isLoading: false,
                    status: 'error',
                    activeProvider: provider.name,
                    lastError: error.message,
                };
            });
        };

        const startAuxiliaryProviders = async () => {
            for (const provider of AUXILIARY_PROVIDERS) {
                try {
                    const available = await provider.isAvailable();
                    if (!available) {
                        continue;
                    }

                    try {
                        const unsubscribe = provider.start(
                            samples => {
                                samplesByProvider.set(provider.name, samples);
                                updateState();
                            },
                            {
                                onError: error => handleProviderError(provider, error),
                                refreshIntervalMs,
                            },
                        );

                        auxiliaryUnsubscribes.push(unsubscribe);
                        samplesByProvider.set(provider.name, []);
                        setAvailableProviders(prev => Array.from(new Set([...prev, provider.name])));
                    } catch (error) {
                        if (error instanceof ProviderError) {
                            handleProviderError(provider, error);
                        }
                    }
                } catch (error) {
                    if (error instanceof ProviderError && error.code === 'permission-denied') {
                        handleProviderError(provider, error);
                        continue;
                    }
                }
            }
        };

        const startPrimaryProvider = async (index: number): Promise<void> => {
            if (index >= PRIMARY_PROVIDERS.length) {
                updateState();
                return;
            }

            const provider = PRIMARY_PROVIDERS[index];
            try {
                const available = await provider.isAvailable();
                if (!available) {
                    await startPrimaryProvider(index + 1);
                    return;
                }
            } catch (error) {
                if (error instanceof ProviderError && error.code === 'permission-denied') {
                    handleProviderError(provider, error);
                    return;
                }

                await startPrimaryProvider(index + 1);
                return;
            }

            if (cancelled) {
                return;
            }

            activeProvider = provider;
            samplesByProvider.set(provider.name, []);
            setAvailableProviders(prev => Array.from(new Set([...prev, provider.name])));

            try {
                primaryUnsubscribe = provider.start(
                    samples => {
                        samplesByProvider.set(provider.name, samples);
                        updateState();
                    },
                    {
                        onError: error => handleProviderError(provider, error),
                        refreshIntervalMs,
                    },
                );
            } catch (error) {
                if (error instanceof ProviderError) {
                    handleProviderError(provider, error);
                    return;
                }
            }
        };

        void startAuxiliaryProviders();
        void startPrimaryProvider(0);

        return () => {
            cancelled = true;
            primaryUnsubscribe?.();
            auxiliaryUnsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [refreshIntervalMs, retryToken]);

    const retry = React.useCallback(() => {
        setState({
            data: { ...EMPTY_SENSOR_DATA },
            isLoading: true,
            status: 'loading',
            lastError: undefined,
        });
        setAvailableProviders([]);
        setRetryToken(token => token + 1);
    }, []);

    return { ...state, availableProviders, retry };
};
