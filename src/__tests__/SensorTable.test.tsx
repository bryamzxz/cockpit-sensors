import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SensorTable } from '../components/SensorTable';
import type { SensorChipGroup } from '../types/sensors';

vi.mock('@patternfly/react-core', async () => await import('../__mocks__/@patternfly/react-core'));
vi.mock('@patternfly/react-icons', async () => await import('../__mocks__/@patternfly/react-icons'));

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    cleanup();
});

describe('SensorTable component', () => {
    const groups: SensorChipGroup[] = [
        {
            id: 'chip1',
            name: 'chip1',
            label: 'chip1',
            category: 'temperature',
            readings: [
                { label: 'CPU', input: 42, unit: '°C', max: 80, critical: 90 },
                { label: 'Board', input: 38, unit: '°C', max: 75, critical: 85 },
            ],
            source: 'hwmon',
        },
    ];

    it('renders a table with rows and sparkline placeholders', () => {
        const { container } = render(
            <SensorTable
                groups={groups}
                category="temperature"
                unit="C"
                onUnitChange={() => {}}
                refreshMs={5000}
                onRefreshChange={() => {}}
                pinnedKeys={[]}
                onTogglePinned={() => {}}
            />,
        );

        expect(screen.getByRole('grid', { name: /sensor readings/i })).toBeInTheDocument();
        expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });

    it('renders pinned sensors before others', () => {
        render(
            <SensorTable
                groups={groups}
                category="temperature"
                unit="C"
                onUnitChange={() => {}}
                refreshMs={5000}
                onRefreshChange={() => {}}
                pinnedKeys={['chip1:CPU']}
                onTogglePinned={() => {}}
            />,
        );

        const table = screen.getAllByRole('grid', { name: /sensor readings/i })[0];
        const rows = within(table).getAllByRole('row');
        expect(within(rows[1]).getByText('CPU')).toBeInTheDocument();
    });

    it('shows a zero state when there are no readings', () => {
        render(
            <SensorTable
                groups={[]}
                category="temperature"
                unit="C"
                onUnitChange={() => {}}
                refreshMs={5000}
                onRefreshChange={() => {}}
                pinnedKeys={[]}
                onTogglePinned={() => {}}
            />,
        );

        expect(document.querySelector('.sensor-zero-state')).not.toBeNull();
    });
});
