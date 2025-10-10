import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseSensorsResult } from '../hooks/useSensors';

const useSensorsMock = vi.fn<(refreshMs?: number) => UseSensorsResult>();

vi.mock('@patternfly/react-core', async () => await import('../__mocks__/@patternfly/react-core'));
vi.mock('@patternfly/react-icons', async () => await import('../__mocks__/@patternfly/react-icons'));
vi.mock('../utils/cockpit', () => ({
    _: (message: string) => message,
}));
vi.mock('../components/SensorTable', () => ({
    SensorTable: () => <div data-testid="sensor-table" />,
}));
vi.mock('../hooks/useSensorPreferences', () => ({
    useSensorPreferences: () => ({
        unit: 'C',
        setUnit: vi.fn(),
        refreshMs: 5000,
        setRefreshMs: vi.fn(),
        pinned: [],
        togglePinned: vi.fn(),
        setPinned: vi.fn(),
    }),
}));
vi.mock('../hooks/useSensors', () => ({
    useSensors: (refreshMs?: number) => useSensorsMock(refreshMs),
}));
vi.mock(
    'cockpit',
    () => ({
        default: {
            gettext: (message: string) => message,
        },
    }),
    { virtual: true }
);

let Application: typeof import('../app/Application').Application;

describe('Application', () => {
    beforeAll(async () => {
        ({ Application } = await import('../app/Application'));
    });

    beforeEach(() => {
        useSensorsMock.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders the onboarding banner when no backends are available', () => {
        useSensorsMock.mockReturnValue({
            data: { groups: [] },
            isLoading: false,
            status: 'no-sources',
            activeProvider: undefined,
            lastError: undefined,
            availableProviders: [],
            retry: vi.fn(),
        });

        render(<Application />);

        expect(useSensorsMock).toHaveBeenCalledWith(5000);
        expect(screen.getByText('No sensor backends are available on this system')).toBeInTheDocument();
    });

    it('shows available providers when sensor groups are present', () => {
        useSensorsMock.mockReturnValue({
            data: {
                groups: [
                    {
                        id: 'chip-1',
                        name: 'test-chip',
                        label: 'Test chip',
                        category: 'temperature',
                        readings: [],
                        source: 'hwmon',
                    },
                ],
            },
            isLoading: false,
            status: 'ready',
            activeProvider: 'hwmon',
            lastError: undefined,
            availableProviders: ['hwmon'],
            retry: vi.fn(),
        });

        render(<Application />);

        expect(screen.getAllByText('hwmon').length).toBeGreaterThan(0);
        expect(screen.getAllByText('(active)').length).toBeGreaterThan(0);
    });
});
