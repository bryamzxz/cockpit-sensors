import React from 'react';
import {
    Button,
    EmptyState,
    EmptyStateBody,
    EmptyStateHeader,
    EmptyStateIcon,
    FormSelect,
    FormSelectOption,
    Label,
    Toolbar,
    ToolbarContent,
    ToolbarGroup,
    ToolbarItem,
    Tooltip,
} from '@patternfly/react-core';
import { DownloadIcon, OutlinedStarIcon, SearchIcon, StarIcon } from '@patternfly/react-icons';

import { Sparkline } from './Sparkline';
import { calcStats, pushSample, Sample } from '../lib/history';
import type { TemperatureUnit } from '../hooks/useSensorPreferences';
import { SENSOR_REFRESH_OPTIONS } from '../hooks/useSensorPreferences';
import { convertForDisplay, displayUnitFor, formatMeasurement } from '../utils/units';
import { buildHistoryCsv, HistorySeries } from '../utils/csv';
import { getThresholdState } from '../utils/thresholds';
import { _ } from '../utils/cockpit';
import type { SensorCategory, SensorChipGroup } from '../types/sensors';

const MISSING_VALUE = '—';

type TableRow = {
    key: string;
    chip: string;
    chipId: string;
    readingLabel: string;
    readingUnit?: string;
    input: number;
    source?: string;
    reading: SensorChipGroup['readings'][number];
};

interface PreparedRow extends TableRow {
    history: Sample[];
    sessionStats: ReturnType<typeof calcStats>;
    threshold: ReturnType<typeof getThresholdState>;
    isPinned: boolean;
}

const ZERO_STATES: Record<SensorCategory, { title: string; description: string }> = {
    temperature: {
        title: _('No temperature sensors detected'),
        description: _('Cockpit did not receive any temperature readings for this system.'),
    },
    fan: {
        title: _('No fan telemetry available'),
        description: _('The hardware monitoring stack did not expose any fan speed sensors.'),
    },
    voltage: {
        title: _('No voltage sensors reported'),
        description: _('No voltage inputs were reported by the available sensor backends.'),
    },
    power: {
        title: _('No power sensors found'),
        description: _('Power metrics were not exposed for this host or backend.'),
    },
    unknown: {
        title: _('No miscellaneous sensors captured'),
        description: _('Sensors outside the dedicated categories are not reporting data.'),
    },
};

export interface SensorTableProps {
    groups: SensorChipGroup[];
    category: SensorCategory;
    unit: TemperatureUnit;
    onUnitChange: (unit: TemperatureUnit) => void;
    refreshMs: number;
    onRefreshChange: (value: number) => void;
    pinnedKeys: readonly string[];
    onTogglePinned: (key: string) => void;
}

const formatValue = (value: number | undefined, unit: string | undefined, preference: TemperatureUnit) => {
    if (!Number.isFinite(value)) {
        return MISSING_VALUE;
    }

    const converted = convertForDisplay(value, unit, preference);
    const formatted = formatMeasurement(converted);
    const displayUnit = displayUnitFor(unit, preference);
    return displayUnit ? `${formatted} ${displayUnit}` : formatted;
};

const formatStats = (
    stats: ReturnType<typeof calcStats>,
    unit: string | undefined,
    preference: TemperatureUnit,
): string => {
    if (stats.n === 0) {
        return MISSING_VALUE;
    }

    const min = formatMeasurement(convertForDisplay(stats.min, unit, preference));
    const avg = formatMeasurement(convertForDisplay(stats.avg, unit, preference));
    const max = formatMeasurement(convertForDisplay(stats.max, unit, preference));
    const displayUnit = displayUnitFor(unit, preference);
    const joined = `${min} / ${avg} / ${max}`;
    return displayUnit ? `${joined} ${displayUnit}` : joined;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const SensorTable: React.FC<SensorTableProps> = ({
    groups,
    category,
    unit,
    onUnitChange,
    refreshMs,
    onRefreshChange,
    pinnedKeys,
    onTogglePinned,
}) => {
    const historyRef = React.useRef(new Map<string, Sample[]>());
    const [historyVersion, setHistoryVersion] = React.useState(0);

    const pinnedIndex = React.useMemo(() => {
        const index = new Map<string, number>();
        pinnedKeys.forEach((key, position) => {
            index.set(key, position);
        });
        return index;
    }, [pinnedKeys]);

    const rows = React.useMemo<TableRow[]>(
        () =>
            groups.flatMap(group =>
                group.readings.map(reading => ({
                    key: `${group.id}:${reading.label}`,
                    chip: group.label,
                    chipId: group.id,
                    readingLabel: reading.label,
                    readingUnit: reading.unit,
                    input: reading.input,
                    source: group.source,
                    reading,
                })),
            ),
        [groups],
    );

    const sortedRows = React.useMemo<PreparedRow[]>(() => {
        const pinnedSet = new Set(pinnedKeys);
        const history = historyRef.current;
        return rows
                .map(row => ({
                    ...row,
                    history: history.get(row.key) ?? [],
                    sessionStats: calcStats(history.get(row.key) ?? []),
                    threshold: getThresholdState(row.reading),
                    isPinned: pinnedSet.has(row.key),
                }))
                .sort((a, b) => {
                    const aPinned = pinnedSet.has(a.key);
                    const bPinned = pinnedSet.has(b.key);
                    if (aPinned && bPinned) {
                        const orderA = pinnedIndex.get(a.key) ?? 0;
                        const orderB = pinnedIndex.get(b.key) ?? 0;
                        return orderA - orderB;
                    }
                    if (aPinned) {
                        return -1;
                    }
                    if (bPinned) {
                        return 1;
                    }

                    const chipCompare = collator.compare(a.chip, b.chip);
                    if (chipCompare !== 0) {
                        return chipCompare;
                    }
                    return collator.compare(a.readingLabel, b.readingLabel);
                });
    }, [rows, pinnedKeys, pinnedIndex]);

    React.useEffect(() => {
        const history = historyRef.current;
        const activeKeys = new Set<string>();
        let changed = false;

        for (const row of rows) {
            activeKeys.add(row.key);
            if (!Number.isFinite(row.input)) {
                continue;
            }

            const buffer = history.get(row.key) ?? [];
            const previousLength = buffer.length;
            pushSample(buffer, row.input);
            if (!history.has(row.key)) {
                history.set(row.key, buffer);
            }
            if (buffer.length !== previousLength) {
                changed = true;
            }
        }

        for (const key of Array.from(history.keys())) {
            if (!activeKeys.has(key)) {
                history.delete(key);
                changed = true;
            }
        }

        if (changed) {
            setHistoryVersion(version => version + 1);
        }
    }, [rows]);

    const handleRefreshChange = React.useCallback(
        (value: string) => {
            const parsed = Number.parseInt(value, 10);
            onRefreshChange(Number.isFinite(parsed) ? parsed : refreshMs);
        },
        [onRefreshChange, refreshMs],
    );

    const handleExport = React.useCallback(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const history = historyRef.current;
        const series: HistorySeries[] = [];

        for (const row of sortedRows) {
            const buffer = history.get(row.key);
            if (!buffer || buffer.length === 0) {
                continue;
            }

            const displayHistory = buffer.map(sample => ({
                t: sample.t,
                v: convertForDisplay(sample.v, row.readingUnit, unit),
            }));

            const labelUnit = displayUnitFor(row.readingUnit, unit);
            const label = labelUnit
                ? `${row.chip} — ${row.readingLabel} (${labelUnit})`
                : `${row.chip} — ${row.readingLabel}`;

            series.push({ key: row.key, label, history: displayHistory });
        }

        if (series.length === 0) {
            return;
        }

        const csv = buildHistoryCsv(series);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'sensors.csv';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [sortedRows, unit]);

    const handleUnitToggle = React.useCallback(
        (nextUnit: TemperatureUnit) => {
            onUnitChange(nextUnit);
        },
        [onUnitChange],
    );

    const exportDisabled = React.useMemo(() => {
        void historyVersion;
        const history = historyRef.current;
        for (const row of sortedRows) {
            if ((history.get(row.key) ?? []).length > 0) {
                return false;
            }
        }
        return true;
    }, [sortedRows, historyVersion]);

    const zeroState = ZERO_STATES[category] ?? ZERO_STATES.unknown;

    return (
        <div className="sensor-table" data-component="sensor-table">
            <Toolbar className="sensor-toolbar" role="region" aria-label={_('Sensor table controls')}>
                <ToolbarContent>
                    <ToolbarGroup>
                        <ToolbarItem>
                            <label className="sensor-toolbar__label" htmlFor="sensor-refresh-select">
                                {_('Refresh interval')}
                            </label>
                            <FormSelect
                                value={String(refreshMs)}
                                onChange={handleRefreshChange}
                                aria-label={_('Refresh interval selector')}
                                id="sensor-refresh-select"
                            >
                                {SENSOR_REFRESH_OPTIONS.map(option => (
                                    <FormSelectOption
                                        key={option}
                                        value={option}
                                        label={option === 10000 ? _('Every 10 seconds') : option === 5000 ? _('Every 5 seconds') : _('Every 2 seconds')}
                                    />
                                ))}
                            </FormSelect>
                        </ToolbarItem>
                    </ToolbarGroup>
                    <ToolbarGroup>
                        <ToolbarItem>
                            <label className="sensor-toolbar__label" htmlFor="sensor-unit-select">
                                {_('Temperature unit')}
                            </label>
                            <FormSelect
                                value={unit}
                                onChange={value => handleUnitToggle(value as TemperatureUnit)}
                                aria-label={_('Temperature unit selector')}
                                id="sensor-unit-select"
                            >
                                <FormSelectOption value="C" label={_('Degrees Celsius (°C)')} />
                                <FormSelectOption value="F" label={_('Degrees Fahrenheit (°F)')} />
                            </FormSelect>
                        </ToolbarItem>
                    </ToolbarGroup>
                    <ToolbarItem alignment={{ default: 'alignRight' }}>
                        <Tooltip content={_('Download session history as CSV')}>
                            <Button
                                onClick={handleExport}
                                variant="secondary"
                                icon={<DownloadIcon />}
                                isDisabled={exportDisabled}
                            >
                                {_('Export CSV')}
                            </Button>
                        </Tooltip>
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>

            {sortedRows.length === 0 ? (
                <div className="sensor-zero-state">
                    <EmptyState variant="sm">
                        <EmptyStateHeader
                            icon={<EmptyStateIcon icon={SearchIcon} />}
                            titleText={zeroState.title}
                            headingLevel="h3"
                        />
                        <EmptyStateBody>{zeroState.description}</EmptyStateBody>
                    </EmptyState>
                </div>
            ) : (
                <div className="pf-c-table-wrapper" role="presentation">
                    <table className="pf-c-table pf-m-compact pf-m-grid-md" role="grid" aria-label={_('Sensor readings')}>
                        <thead>
                            <tr>
                                <th scope="col" aria-label={_('Pinned status')} />
                                <th scope="col">{_('Chip')}</th>
                                <th scope="col">{_('Sensor')}</th>
                                <th scope="col">{_('Input')}</th>
                                <th scope="col">{_('Session min/avg/max')}</th>
                                <th scope="col">{_('Trend')}</th>
                                <th scope="col">{_('Source')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map(row => {
                                const history = historyRef.current.get(row.key) ?? [];
                                const sparklineData = history.map(sample => ({
                                    t: sample.t,
                                    v: convertForDisplay(sample.v, row.readingUnit, unit),
                                }));

                                return (
                                    <tr key={row.key}>
                                        <td data-label={_('Pinned status')}>
                                            <Tooltip
                                                content={row.isPinned ? _('Unpin sensor') : _('Pin sensor')}
                                                entryDelay={300}
                                            >
                                                <Button
                                                    variant="plain"
                                                    onClick={() => onTogglePinned(row.key)}
                                                    aria-label={row.isPinned ? _('Unpin sensor') : _('Pin sensor')}
                                                    data-testid="sensor-pin-toggle"
                                                >
                                                    {row.isPinned ? <StarIcon /> : <OutlinedStarIcon />}
                                                </Button>
                                            </Tooltip>
                                        </td>
                                        <td data-label={_('Chip')}>
                                            <span className="sensor-chip">
                                                <span>{row.chip}</span>
                                                {row.source && (
                                                    <Label color="grey" isCompact>
                                                        {row.source}
                                                    </Label>
                                                )}
                                            </span>
                                        </td>
                                        <td data-label={_('Sensor')}>{row.readingLabel}</td>
                                        <td data-label={_('Input')}>
                                            <span className={`sensor-reading sensor-reading--${row.threshold}`}>
                                                {formatValue(row.input, row.readingUnit, unit)}
                                            </span>
                                        </td>
                                        <td data-label={_('Session min/avg/max')}>
                                            <span className="sensor-reading">
                                                {formatStats(row.sessionStats, row.readingUnit, unit)}
                                            </span>
                                        </td>
                                        <td data-label={_('Trend')}>
                                            <Sparkline data={sparklineData} />
                                        </td>
                                        <td data-label={_('Source')}>{row.source ?? MISSING_VALUE}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
