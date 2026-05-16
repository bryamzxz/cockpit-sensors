import React from 'react';
import {
    Button,
    EmptyState,
    EmptyStateBody,
    Label,
    SearchInput,
    ToggleGroup,
    ToggleGroupItem,
    Toolbar,
    ToolbarContent,
    ToolbarGroup,
    ToolbarItem,
    Tooltip,
} from '@patternfly/react-core';
import {
    BarsIcon,
    DownloadIcon,
    OutlinedStarIcon,
    PauseIcon,
    PlayIcon,
    StarIcon,
    ThIcon,
} from '@patternfly/react-icons';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';

import { Sparkline } from './Sparkline';
import { CsvModalViewer } from './CsvModalViewer';
import { SensorCard } from './SensorCard';
import { SensorSummary, type SummaryStat } from './SensorSummary';
import { calcStats, pushSample, type Sample } from '../lib/history';
import type { TemperatureUnit } from '../hooks/useSensorPreferences';
import { SENSOR_REFRESH_OPTIONS } from '../hooks/useSensorPreferences';
import { convertForDisplay, displayUnitFor, formatMeasurement } from '../utils/units';
import { buildHistoryCsv, type HistorySeries } from '../utils/csv';
import { getThresholdState, type ThresholdState } from '../utils/thresholds';
import { _ } from '../utils/cockpit';
import type { SensorCategory, SensorChipGroup } from '../types/sensors';

const MISSING_VALUE = '—';

export type ViewMode = 'table' | 'cards';
export type Density = 'compact' | 'comfortable';

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

type CsvState = {
    open: boolean;
    text: string;
    filename: string;
};

interface PreparedRow extends TableRow {
    history: Sample[];
    sessionStats: ReturnType<typeof calcStats>;
    threshold: ThresholdState;
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

const REFRESH_LABELS: Record<number, string> = {
    2000: _('2s'),
    5000: _('5s'),
    10000: _('10s'),
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
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    density?: Density;
    onDensityChange?: (density: Density) => void;
    isPaused?: boolean;
    onPauseToggle?: () => void;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
}

const formatValueParts = (
    value: number | undefined,
    unit: string | undefined,
    preference: TemperatureUnit,
): { value: string; unit?: string } => {
    if (!Number.isFinite(value)) {
        return { value: MISSING_VALUE };
    }

    const converted = convertForDisplay(value as number, unit, preference);
    return {
        value: formatMeasurement(converted),
        unit: displayUnitFor(unit, preference),
    };
};

const formatStatsParts = (
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
    const display = displayUnitFor(unit, preference);
    const joined = `${min} / ${avg} / ${max}`;
    return display ? `${joined} ${display}` : joined;
};

const computeProgress = (
    row: PreparedRow,
): { percent: number; thresholdValue?: number } | null => {
    const { reading, input } = row;
    if (!Number.isFinite(input)) {
        return null;
    }

    const high = reading.critical ?? reading.max;
    if (!Number.isFinite(high) || (high as number) <= 0) {
        return null;
    }

    const low = Number.isFinite(reading.min) ? (reading.min as number) : 0;
    const span = (high as number) - low;
    if (span <= 0) {
        return null;
    }

    const percent = ((input - low) / span) * 100;
    return { percent, thresholdValue: high as number };
};

const SUMMARY_LABELS_BY_CATEGORY: Record<SensorCategory, { total: string; max: string; avg: string }> = {
    temperature: {
        total: _('Active temperature sensors'),
        max: _('Hottest reading'),
        avg: _('Average temperature'),
    },
    fan: {
        total: _('Active fans'),
        max: _('Fastest fan'),
        avg: _('Average fan speed'),
    },
    voltage: {
        total: _('Active voltage rails'),
        max: _('Highest voltage'),
        avg: _('Average voltage'),
    },
    power: {
        total: _('Active power sensors'),
        max: _('Peak power draw'),
        avg: _('Average power draw'),
    },
    unknown: {
        total: _('Active sensors'),
        max: _('Highest value'),
        avg: _('Average value'),
    },
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
    viewMode = 'table',
    onViewModeChange,
    density = 'comfortable',
    onDensityChange,
    isPaused = false,
    onPauseToggle,
    searchTerm = '',
    onSearchChange,
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

    const allPreparedRows = React.useMemo<PreparedRow[]>(() => {
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
                    if (a.isPinned && b.isPinned) {
                        return (pinnedIndex.get(a.key) ?? 0) - (pinnedIndex.get(b.key) ?? 0);
                    }
                    if (a.isPinned) return -1;
                    if (b.isPinned) return 1;

                    const severityOrder: Record<ThresholdState, number> = {
                        danger: 0,
                        warning: 1,
                        normal: 2,
                    };
                    const severityDiff = severityOrder[a.threshold] - severityOrder[b.threshold];
                    if (severityDiff !== 0) {
                        return severityDiff;
                    }

                    const chipCompare = collator.compare(a.chip, b.chip);
                    if (chipCompare !== 0) return chipCompare;
                    return collator.compare(a.readingLabel, b.readingLabel);
                });
    }, [rows, pinnedKeys, pinnedIndex]);

    const filteredRows = React.useMemo<PreparedRow[]>(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return allPreparedRows;
        }
        return allPreparedRows.filter(row =>
            row.chip.toLowerCase().includes(term)
            || row.readingLabel.toLowerCase().includes(term)
            || (row.source ?? '').toLowerCase().includes(term),
        );
    }, [allPreparedRows, searchTerm]);

    React.useEffect(() => {
        if (isPaused) {
            return;
        }

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
    }, [rows, isPaused]);

    const summaryStats = React.useMemo<SummaryStat[]>(() => {
        if (allPreparedRows.length === 0) {
            return [];
        }

        const labels = SUMMARY_LABELS_BY_CATEGORY[category] ?? SUMMARY_LABELS_BY_CATEGORY.unknown;
        const values = allPreparedRows
                .filter(row => Number.isFinite(row.input))
                .map(row => ({
                    converted: convertForDisplay(row.input, row.readingUnit, unit),
                    unit: displayUnitFor(row.readingUnit, unit),
                    threshold: row.threshold,
                    row,
                }));

        if (values.length === 0) {
            return [
                { label: labels.total, value: String(allPreparedRows.length) },
            ];
        }

        const sorted = [...values].sort((a, b) => b.converted - a.converted);
        const hottest = sorted[0];
        const avg = values.reduce((acc, v) => acc + v.converted, 0) / values.length;

        const warningCount = values.filter(v => v.threshold === 'warning').length;
        const dangerCount = values.filter(v => v.threshold === 'danger').length;
        const severity: ThresholdState = dangerCount > 0
            ? 'danger'
            : warningCount > 0 ? 'warning' : 'normal';

        return [
            {
                label: labels.total,
                value: String(allPreparedRows.length),
                hint: severity === 'normal'
                    ? _('All within range')
                    : severity === 'warning'
                        ? _('Approaching threshold')
                        : _('Threshold exceeded'),
                severity,
            },
            {
                label: labels.max,
                value: formatMeasurement(hottest.converted),
                unit: hottest.unit,
                hint: hottest.row.chip ? `${hottest.row.chip} · ${hottest.row.readingLabel}` : hottest.row.readingLabel,
                severity: hottest.threshold,
            },
            {
                label: labels.avg,
                value: formatMeasurement(avg),
                unit: hottest.unit,
                hint: `${values.length} ${_('samples')}`,
            },
        ];
    }, [allPreparedRows, category, unit]);

    const [csvView, setCsvView] = React.useState<CsvState>({ open: false, text: '', filename: '' });

    const closeCsvModal = React.useCallback(() => {
        setCsvView({ open: false, text: '', filename: '' });
    }, []);

    const attemptDownload = React.useCallback((csv: string, filename: string) => {
        try {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const legacyNavigator = window.navigator as Navigator & {
                msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => void;
            };

            if (typeof legacyNavigator.msSaveOrOpenBlob === 'function') {
                legacyNavigator.msSaveOrOpenBlob(blob, filename);
                return true;
            }

            const url = URL.createObjectURL(blob);
            try {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = filename;
                anchor.rel = 'noopener';
                anchor.style.display = 'none';
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
            } finally {
                setTimeout(() => URL.revokeObjectURL(url), 0);
            }

            return true;
        } catch {
            return false;
        }
    }, []);

    const retryDownload = React.useCallback(() => {
        if (!csvView.text) {
            return;
        }

        const fallbackName = csvView.filename || `cockpit-sensors-${Date.now()}.csv`;
        attemptDownload(csvView.text, fallbackName);
    }, [attemptDownload, csvView]);

    const handleExport = React.useCallback(() => {
        const history = historyRef.current;
        const series: HistorySeries[] = allPreparedRows.map(row => {
            const buffer = history.get(row.key) ?? [];

            const samples = buffer.map(sample => ({
                t: sample.t,
                v: convertForDisplay(sample.v, row.readingUnit, unit),
            }));

            const labelUnit = displayUnitFor(row.readingUnit, unit);
            const label = labelUnit
                ? `${row.chip} — ${row.readingLabel} (${labelUnit})`
                : `${row.chip} — ${row.readingLabel}`;

            return { key: row.key, label, samples };
        });

        if (series.length === 0) {
            return;
        }

        const csv = buildHistoryCsv(series);
        const isoString = new Date().toISOString();
        const timestamp = isoString.replace(/[:.]/g, '-');
        const filename = `cockpit-sensors-${timestamp}.csv`;

        attemptDownload(csv, filename);
        setCsvView({ open: true, text: csv, filename });
    }, [attemptDownload, allPreparedRows, unit]);

    const exportDisabled = React.useMemo(() => {
        void historyVersion;
        const history = historyRef.current;
        for (const row of allPreparedRows) {
            if ((history.get(row.key) ?? []).length > 0) {
                return false;
            }
        }
        return true;
    }, [allPreparedRows, historyVersion]);

    const handleSearchChange = React.useCallback(
        (_event: React.FormEvent<HTMLInputElement>, value: string) => {
            onSearchChange?.(value);
        },
        [onSearchChange],
    );

    const handleSearchClear = React.useCallback(() => {
        onSearchChange?.('');
    }, [onSearchChange]);

    const zeroState = ZERO_STATES[category] ?? ZERO_STATES.unknown;
    const hasResults = filteredRows.length > 0;
    const hasAnyData = allPreparedRows.length > 0;

    return (
        <div className="sensor-table-region" data-component="sensor-table">
            <SensorSummary stats={summaryStats} />

            <Toolbar
                className="sensor-toolbar"
                role="region"
                aria-label={_('Sensor table controls')}
            >
                <ToolbarContent>
                    <ToolbarItem>
                        <SearchInput
                            className="sensor-toolbar__search"
                            placeholder={_('Filter by chip or sensor')}
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onClear={handleSearchClear}
                            aria-label={_('Filter sensors')}
                        />
                    </ToolbarItem>

                    {onViewModeChange && (
                        <ToolbarItem>
                            <ToggleGroup aria-label={_('Select view mode')}>
                                <ToggleGroupItem
                                    icon={<BarsIcon />}
                                    aria-label={_('Show as table')}
                                    buttonId="sensor-view-table"
                                    isSelected={viewMode === 'table'}
                                    onChange={() => onViewModeChange('table')}
                                    text={_('Table')}
                                />
                                <ToggleGroupItem
                                    icon={<ThIcon />}
                                    aria-label={_('Show as cards')}
                                    buttonId="sensor-view-cards"
                                    isSelected={viewMode === 'cards'}
                                    onChange={() => onViewModeChange('cards')}
                                    text={_('Cards')}
                                />
                            </ToggleGroup>
                        </ToolbarItem>
                    )}

                    <ToolbarItem>
                        <span className="sensor-toolbar__group-label">{_('Refresh')}</span>
                        <ToggleGroup aria-label={_('Refresh interval')}>
                            {SENSOR_REFRESH_OPTIONS.map(option => (
                                <ToggleGroupItem
                                    key={option}
                                    text={REFRESH_LABELS[option] ?? `${option / 1000}s`}
                                    buttonId={`sensor-refresh-${option}`}
                                    isSelected={refreshMs === option}
                                    onChange={() => onRefreshChange(option)}
                                    aria-label={`${option / 1000} ${_('seconds')}`}
                                />
                            ))}
                        </ToggleGroup>
                    </ToolbarItem>

                    {category === 'temperature' && (
                        <ToolbarItem>
                            <span className="sensor-toolbar__group-label">{_('Unit')}</span>
                            <ToggleGroup aria-label={_('Temperature unit')}>
                                <ToggleGroupItem
                                    text="°C"
                                    buttonId="sensor-unit-c"
                                    isSelected={unit === 'C'}
                                    onChange={() => onUnitChange('C')}
                                    aria-label={_('Celsius')}
                                />
                                <ToggleGroupItem
                                    text="°F"
                                    buttonId="sensor-unit-f"
                                    isSelected={unit === 'F'}
                                    onChange={() => onUnitChange('F')}
                                    aria-label={_('Fahrenheit')}
                                />
                            </ToggleGroup>
                        </ToolbarItem>
                    )}

                    {onPauseToggle && (
                        <ToolbarItem>
                            <Tooltip content={isPaused ? _('Resume live updates') : _('Pause live updates')}>
                                <Button
                                    variant={isPaused ? 'primary' : 'secondary'}
                                    onClick={onPauseToggle}
                                    icon={isPaused ? <PlayIcon /> : <PauseIcon />}
                                    aria-label={isPaused ? _('Resume') : _('Pause')}
                                    aria-pressed={isPaused}
                                >
                                    {isPaused ? _('Resume') : _('Pause')}
                                </Button>
                            </Tooltip>
                        </ToolbarItem>
                    )}

                    {onDensityChange && (
                        <ToolbarItem visibility={{ default: 'hidden', md: 'visible' }}>
                            <span className="sensor-toolbar__group-label">{_('Density')}</span>
                            <ToggleGroup aria-label={_('Table density')}>
                                <ToggleGroupItem
                                    text={_('Compact')}
                                    buttonId="sensor-density-compact"
                                    isSelected={density === 'compact'}
                                    onChange={() => onDensityChange('compact')}
                                />
                                <ToggleGroupItem
                                    text={_('Roomy')}
                                    buttonId="sensor-density-comfortable"
                                    isSelected={density === 'comfortable'}
                                    onChange={() => onDensityChange('comfortable')}
                                />
                            </ToggleGroup>
                        </ToolbarItem>
                    )}

                    <ToolbarGroup align={{ default: 'alignEnd' }}>
                        <ToolbarItem>
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
                    </ToolbarGroup>
                </ToolbarContent>
            </Toolbar>

            <CsvModalViewer
                isOpen={csvView.open}
                text={csvView.text}
                filename={csvView.filename}
                onClose={closeCsvModal}
                onRetryDownload={csvView.text ? retryDownload : undefined}
            />

            {!hasAnyData && (
                <div className="sensor-zero-state">
                    <EmptyState
                        variant="sm"
                        titleText={zeroState.title}
                        icon={SearchIcon}
                        headingLevel="h3"
                    >
                        <EmptyStateBody>{zeroState.description}</EmptyStateBody>
                    </EmptyState>
                </div>
            )}

            {hasAnyData && !hasResults && (
                <div className="sensor-zero-state">
                    <EmptyState
                        variant="sm"
                        titleText={_('No matches found')}
                        icon={SearchIcon}
                        headingLevel="h3"
                    >
                        <EmptyStateBody>
                            {_('Try a different filter or clear the search to view all sensors.')}
                        </EmptyStateBody>
                    </EmptyState>
                </div>
            )}

            {hasResults && viewMode === 'cards' && (
                <section className="sensor-grid" aria-label={_('Sensor readings')}>
                    {filteredRows.map(row => {
                        const valueParts = formatValueParts(row.input, row.readingUnit, unit);
                        const statsLine = formatStatsParts(row.sessionStats, row.readingUnit, unit);
                        const sparkData = row.history.map(sample => ({
                            t: sample.t,
                            v: convertForDisplay(sample.v, row.readingUnit, unit),
                        }));
                        const progress = computeProgress(row);
                        const thresholdDisplay = progress?.thresholdValue !== undefined
                            ? convertForDisplay(progress.thresholdValue, row.readingUnit, unit)
                            : undefined;

                        return (
                            <SensorCard
                                key={row.key}
                                sensorKey={row.key}
                                chip={row.chip}
                                sensorLabel={row.readingLabel}
                                source={row.source}
                                valueDisplay={valueParts.value}
                                unitDisplay={valueParts.unit}
                                threshold={row.threshold}
                                history={sparkData}
                                historyUnit={valueParts.unit}
                                statsLine={statsLine}
                                isPinned={row.isPinned}
                                onTogglePin={onTogglePinned}
                                progressPercent={progress?.percent}
                                thresholdLine={thresholdDisplay}
                            />
                        );
                    })}
                </section>
            )}

            {hasResults && viewMode === 'table' && (
                <div className="sensor-table-wrapper">
                    <table
                        className={`sensor-table sensor-table--${density}`}
                        role="grid"
                        aria-label={_('Sensor readings')}
                    >
                        <colgroup>
                            <col style={{ inlineSize: '2.5rem' }} />
                            <col style={{ inlineSize: '24%' }} />
                            <col style={{ inlineSize: '16%' }} />
                            <col style={{ inlineSize: '14%' }} />
                            <col style={{ inlineSize: '20%' }} />
                            <col style={{ inlineSize: '16%' }} />
                            <col style={{ inlineSize: '10%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col" aria-label={_('Pinned status')} />
                                <th scope="col">{_('Chip')}</th>
                                <th scope="col">{_('Sensor')}</th>
                                <th scope="col">{_('Current')}</th>
                                <th scope="col">{_('Session min · avg · max')}</th>
                                <th scope="col">{_('Trend')}</th>
                                <th scope="col">{_('Source')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(row => {
                                const valueParts = formatValueParts(row.input, row.readingUnit, unit);
                                const statsLine = formatStatsParts(row.sessionStats, row.readingUnit, unit);
                                const sparkData = row.history.map(sample => ({
                                    t: sample.t,
                                    v: convertForDisplay(sample.v, row.readingUnit, unit),
                                }));
                                const progress = computeProgress(row);
                                const thresholdDisplay = progress?.thresholdValue !== undefined
                                    ? convertForDisplay(progress.thresholdValue, row.readingUnit, unit)
                                    : undefined;

                                return (
                                    <tr
                                        key={row.key}
                                        data-pinned={row.isPinned}
                                        data-threshold={row.threshold}
                                    >
                                        <td data-label={_('Pinned status')}>
                                            <Tooltip
                                                content={row.isPinned ? _('Unpin sensor') : _('Pin sensor')}
                                                entryDelay={300}
                                            >
                                                <Button
                                                    variant="plain"
                                                    onClick={() => onTogglePinned(row.key)}
                                                    aria-label={row.isPinned ? _('Unpin sensor') : _('Pin sensor')}
                                                    aria-pressed={row.isPinned}
                                                    className="sensor-row__pin-btn"
                                                    data-pinned={row.isPinned}
                                                    data-testid="sensor-pin-toggle"
                                                >
                                                    {row.isPinned ? <StarIcon /> : <OutlinedStarIcon />}
                                                </Button>
                                            </Tooltip>
                                        </td>
                                        <td data-label={_('Chip')}>
                                            <div className="sensor-row__chip-label">
                                                <span className="sensor-row__chip-name">{row.chip}</span>
                                                {row.source && (
                                                    <Label color="grey" isCompact>
                                                        {row.source}
                                                    </Label>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label={_('Sensor')}>
                                            <span className="sensor-row__sensor-name">{row.readingLabel}</span>
                                        </td>
                                        <td data-label={_('Current')}>
                                            <span className={`sensor-reading sensor-reading--${row.threshold}`}>
                                                <span>{valueParts.value}</span>
                                                {valueParts.unit && (
                                                    <span className="sensor-reading__unit">{valueParts.unit}</span>
                                                )}
                                            </span>
                                            {progress && (
                                                <div
                                                    className={`sensor-progress sensor-progress--${row.threshold}`}
                                                    role="progressbar"
                                                    aria-valuenow={Math.round(progress.percent)}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    aria-label={_('Range against threshold')}
                                                >
                                                    <span
                                                        className="sensor-progress__bar"
                                                        style={{
                                                            inlineSize: `${Math.max(2, Math.min(100, progress.percent))}%`,
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td data-label={_('Session min · avg · max')}>
                                            <span className="sensor-stats">{statsLine}</span>
                                        </td>
                                        <td data-label={_('Trend')}>
                                            <Sparkline
                                                data={sparkData}
                                                threshold={row.threshold}
                                                unit={valueParts.unit}
                                                thresholdLine={thresholdDisplay}
                                                width={140}
                                                height={32}
                                            />
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
