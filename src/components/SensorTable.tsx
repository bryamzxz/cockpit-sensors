import React from 'react';
import cockpit from 'cockpit';

import { Reading, SensorChipGroup } from '../types/sensors';

const _ = cockpit.gettext;

export interface SensorTableProps {
    groups: SensorChipGroup[];
}

interface TableRow {
    key: string;
    chip: string;
    reading: Reading;
}

const MISSING_VALUE = '—';

const formatValue = (value: number | undefined, unit?: string) => {
    if (typeof value !== 'number') {
        return MISSING_VALUE;
    }

    const formatter = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
        minimumFractionDigits: 0,
    });

    const formatted = formatter.format(value);
    return unit ? `${formatted} ${unit}` : formatted;
};

export const SensorTable: React.FC<SensorTableProps> = ({ groups }) => {
    const rows = React.useMemo<TableRow[]>(
        () =>
            groups.flatMap(group =>
                group.readings.map((reading, index) => ({
                    key: `${group.id}-${index}`,
                    chip: group.label,
                    reading,
                })),
            ),
        [groups],
    );

    return (
        <div className="pf-c-table-wrapper" data-component="sensor-table">
            <table className="pf-c-table pf-m-compact pf-m-grid-md" role="grid" aria-label={_('Sensor readings')}>
                <thead>
                    <tr>
                        <th scope="col">{_('Chip')}</th>
                        <th scope="col">{_('Sensor')}</th>
                        <th scope="col">{_('Input')}</th>
                        <th scope="col">{_('Minimum')}</th>
                        <th scope="col">{_('Maximum')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={5}>{_('No sensor data available yet.')}</td>
                        </tr>
                    ) : (
                        rows.map(row => {
                            const { reading } = row;
                            const exceedsMax = typeof reading.max === 'number' && reading.input > reading.max;
                            const rowClassName = exceedsMax ? 'pf-m-danger' : undefined;

                            return (
                                <tr key={row.key} className={rowClassName}>
                                    <td data-label={_('Chip')}>{row.chip}</td>
                                    <td data-label={_('Sensor')}>{reading.label}</td>
                                    <td data-label={_('Input')}>{formatValue(reading.input, reading.unit)}</td>
                                    <td data-label={_('Minimum')}>{formatValue(reading.min, reading.unit)}</td>
                                    <td data-label={_('Maximum')}>{formatValue(reading.max, reading.unit)}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};
