import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderError, type Provider, type SensorSample } from '../lib/providers/types';

const hwmonProviderMock = {
    name: 'hwmon',
    isAvailable: vi.fn<Provider['isAvailable']>(),
    start: vi.fn<Provider['start']>(),
} satisfies Provider;

const lmSensorsProviderMock = {
    name: 'lm-sensors',
    isAvailable: vi.fn<Provider['isAvailable']>(),
    start: vi.fn<Provider['start']>(),
} satisfies Provider;

const nvmeProviderMock = {
    name: 'nvme',
    isAvailable: vi.fn<Provider['isAvailable']>(),
    start: vi.fn<Provider['start']>(),
} satisfies Provider;

vi.mock('../lib/providers/hwmon', () => ({
    hwmonProvider: hwmonProviderMock,
}));

vi.mock('../lib/providers/lm-sensors', () => ({
    lmSensorsProvider: lmSensorsProviderMock,
}));

vi.mock('../lib/providers/nvme', () => ({
    nvmeProvider: nvmeProviderMock,
}));

const SAMPLE: SensorSample[] = [
    {
        kind: 'temp',
        id: 'chip0:temp1',
        label: 'Core 0',
        value: 42,
    },
];

const UPDATED_SAMPLE: SensorSample[] = [
    {
        kind: 'temp',
        id: 'chip0:temp1',
        label: 'Core 0',
        value: 45,
    },
];

describe('useSensors permission handling', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.resetModules();

        hwmonProviderMock.isAvailable.mockReset();
        hwmonProviderMock.start.mockReset();
        
        hwmonProviderMock.isAvailable.mockResolvedValue(true);
        hwmonProviderMock.start.mockImplementation(onChange => {
            onChange(SAMPLE);
            return () => {};
        });

        lmSensorsProviderMock.isAvailable.mockReset();
        lmSensorsProviderMock.start.mockReset();
        lmSensorsProviderMock.isAvailable.mockResolvedValue(false);
        lmSensorsProviderMock.start.mockImplementation(() => () => {});

        nvmeProviderMock.isAvailable.mockReset();
        nvmeProviderMock.start.mockReset();
        nvmeProviderMock.isAvailable.mockResolvedValue(true);
        nvmeProviderMock.start.mockImplementation((_onChange, context) => {
            context?.onError?.(new ProviderError('nvme requires privileges', 'permission-denied'));
            return () => {};
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('surfaces privilege requirement even when auxiliary providers fail', async () => {
        const { useSensors } = await import('../hooks/useSensors');
        const { result } = renderHook(() => useSensors());

        await waitFor(() => {
            expect(result.current.status).toBe('needs-privileges');
        });

        expect(result.current.data.groups).not.toHaveLength(0);
        expect(result.current.status).toBe('needs-privileges');
        expect(result.current.availableProviders).toContain('hwmon');
        expect(result.current.lastError).toContain('nvme requires privileges');
    });

    it('continues updating sensor data after an auxiliary permission error', async () => {
        hwmonProviderMock.start.mockImplementation(onChange => {
            onChange(SAMPLE);
            setTimeout(() => onChange(UPDATED_SAMPLE), 100);
            return () => {};
        });

        const { useSensors } = await import('../hooks/useSensors');

        const { result } = renderHook(() => useSensors());

        await waitFor(() => {
            expect(result.current.status).toBe('needs-privileges');
            expect(result.current.data.groups[0]?.readings[0]?.input).toBe(42);
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        await waitFor(() => {
            expect(result.current.data.groups[0]?.readings[0]?.input).toBe(45);
            expect(result.current.status).toBe('needs-privileges');
        });
    });
});
