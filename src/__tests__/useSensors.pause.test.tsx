import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Provider, type ProviderContext, type SensorSample } from '../lib/providers/types';

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

vi.mock('../lib/providers/hwmon', () => ({
    hwmonProvider: hwmonProviderMock,
}));

vi.mock('../lib/providers/lm-sensors', () => ({
    lmSensorsProvider: lmSensorsProviderMock,
}));

const SAMPLE: SensorSample[] = [
    {
        kind: 'temp',
        id: 'chip0:temp1',
        label: 'Core 0',
        value: 42,
    },
];

describe('useSensors pause behaviour', () => {
    beforeEach(() => {
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
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('exposes pause state to providers without restarting them', async () => {
        const { useSensors } = await import('../hooks/useSensors');

        const { result, rerender } = renderHook(
            ({ paused }: { paused: boolean }) => useSensors(5000, paused),
            { initialProps: { paused: false } },
        );

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(hwmonProviderMock.start).toHaveBeenCalledTimes(1);

        const context: ProviderContext | undefined = hwmonProviderMock.start.mock.calls[0][1];
        expect(context?.isPaused?.()).toBe(false);

        rerender({ paused: true });
        expect(context?.isPaused?.()).toBe(true);
        // Pausing must not tear down and restart the provider stack.
        expect(hwmonProviderMock.start).toHaveBeenCalledTimes(1);

        rerender({ paused: false });
        expect(context?.isPaused?.()).toBe(false);
        expect(hwmonProviderMock.start).toHaveBeenCalledTimes(1);
    });
});
