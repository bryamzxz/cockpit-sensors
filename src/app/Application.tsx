/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react';
import {
    Alert,
    AlertActionLink,
    AlertVariant,
    Button,
    ClipboardCopy,
    Label,
    Page,
    PageGroup,
    PageSection,
    Tab,
    TabTitleText,
    Tabs,
} from '@patternfly/react-core';

import { SensorTable, type Density, type ViewMode } from '../components/SensorTable';
import { useSensors } from '../hooks/useSensors';
import { useSensorPreferences } from '../hooks/useSensorPreferences';
import type { SensorCategory, SensorChipGroup } from '../types/sensors';
import { groupsForCategory } from '../utils/grouping';
import { getThresholdState, type ThresholdState } from '../utils/thresholds';
import { _ } from '../utils/cockpit';
import { syncWithParentPatternflyTheme } from '../lib/syncTheme';

import '../app.scss';

type TabDefinition = {
    eventKey: number;
    title: string;
    description: string;
    category: SensorCategory;
};

const TABS: readonly TabDefinition[] = [
    {
        eventKey: 0,
        title: _('Temperatures'),
        description: _('Compare temperature sensors reported by the host system.'),
        category: 'temperature',
    },
    {
        eventKey: 1,
        title: _('Fans'),
        description: _('Monitor cooling without reloading the page.'),
        category: 'fan',
    },
    {
        eventKey: 2,
        title: _('Voltages'),
        description: _('Voltage readings exposed by power supplies and on-board rails.'),
        category: 'voltage',
    },
    {
        eventKey: 3,
        title: _('Power'),
        description: _('System and package power draw reported by RAPL interfaces.'),
        category: 'power',
    },
    {
        eventKey: 4,
        title: _('Other'),
        description: _('Sensors that do not match temperature, fan, voltage or power categories.'),
        category: 'unknown',
    },
];

const SEVERITY_RANK: Record<ThresholdState, number> = { normal: 0, warning: 1, danger: 2 };

const summariseGroups = (groups: SensorChipGroup[]) => {
    let count = 0;
    let worst: ThresholdState = 'normal';
    for (const group of groups) {
        for (const reading of group.readings) {
            count += 1;
            const state = getThresholdState(reading);
            if (SEVERITY_RANK[state] > SEVERITY_RANK[worst]) {
                worst = state;
            }
        }
    }
    return { count, worst };
};

const formatLastUpdate = (timestamp: number | null): string => {
    if (!timestamp) {
        return _('Never');
    }

    const delta = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (delta < 5) return _('just now');
    if (delta < 60) return `${delta}s ${_('ago')}`;
    if (delta < 3600) return `${Math.round(delta / 60)}m ${_('ago')}`;
    return `${Math.round(delta / 3600)}h ${_('ago')}`;
};

export const Application: React.FC = () => {
    React.useEffect(() => {
        return syncWithParentPatternflyTheme();
    }, []);

    const [activeKey, setActiveKey] = React.useState<number>(TABS[0].eventKey);
    const [viewMode, setViewMode] = React.useState<ViewMode>('table');
    const [density, setDensity] = React.useState<Density>('comfortable');
    const [isPaused, setIsPaused] = React.useState<boolean>(false);
    const [searchTerm, setSearchTerm] = React.useState<string>('');
    const [lastUpdate, setLastUpdate] = React.useState<number | null>(null);
    const [, setNow] = React.useState<number>(() => Date.now());

    const { unit, setUnit, refreshMs, setRefreshMs, pinned, togglePinned } = useSensorPreferences();
    const effectiveRefresh = isPaused ? 24 * 3600 * 1000 : refreshMs;
    const { data, isLoading, status, activeProvider, lastError, availableProviders, retry } = useSensors(effectiveRefresh);

    React.useEffect(() => {
        if (data.groups.length > 0) {
            setLastUpdate(Date.now());
        }
    }, [data]);

    React.useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const handler = () => {
            if (document.hidden) {
                setIsPaused(true);
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, []);

    const handleTabSelect = React.useCallback<NonNullable<React.ComponentProps<typeof Tabs>['onSelect']>>(
        (_event, eventKey) => {
            if (typeof eventKey === 'number') {
                setActiveKey(eventKey);
                return;
            }

            const parsedKey = Number.parseInt(eventKey, 10);
            if (!Number.isNaN(parsedKey)) {
                setActiveKey(parsedKey);
            }
        },
        [setActiveKey],
    );

    const togglePause = React.useCallback(() => setIsPaused(prev => !prev), []);

    const tabSummaries = React.useMemo(() => {
        const map = new Map<SensorCategory, ReturnType<typeof summariseGroups>>();
        for (const tab of TABS) {
            map.set(tab.category, summariseGroups(groupsForCategory(data.groups, tab.category)));
        }
        return map;
    }, [data.groups]);

    const overall = React.useMemo<ThresholdState>(() => {
        let worst: ThresholdState = 'normal';
        for (const summary of tabSummaries.values()) {
            if (SEVERITY_RANK[summary.worst] > SEVERITY_RANK[worst]) {
                worst = summary.worst;
            }
        }
        return worst;
    }, [tabSummaries]);

    const totalReadings = React.useMemo(
        () => Array.from(tabSummaries.values()).reduce((acc, s) => acc + s.count, 0),
        [tabSummaries],
    );

    React.useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const handler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            if (event.key === '/') {
                event.preventDefault();
                const search = document.querySelector<HTMLInputElement>('.sensor-toolbar__search input');
                search?.focus();
                return;
            }

            if (event.key === 'p' || event.key === 'P') {
                togglePause();
                return;
            }

            if (event.key === 'u' || event.key === 'U') {
                setUnit(unit === 'C' ? 'F' : 'C');
                return;
            }

            if (event.key === 'v' || event.key === 'V') {
                setViewMode(mode => (mode === 'table' ? 'cards' : 'table'));
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [setUnit, togglePause, unit]);

    const renderBanner = () => {
        switch (status) {
            case 'needs-privileges':
                return (
                    <Alert
                        isInline
                        variant={AlertVariant.warning}
                        title={_('Sensor data requires administrative privileges')}
                        actionLinks={
                            <AlertActionLink onClick={retry}>
                                {_('Retry with privileges')}
                            </AlertActionLink>
                        }
                    >
                        <p>
                            {_('Cockpit could not read sensor data without elevated permissions. Retry the operation to trigger a privilege prompt.')}
                        </p>
                        {lastError && <p>{lastError}</p>}
                    </Alert>
                );
            case 'no-sources':
                return (
                    <Alert
                        isInline
                        variant={AlertVariant.info}
                        title={_('No sensor backends are available on this system')}
                    >
                        <p>
                            {_('Install the recommended packages below and rerun the detection to expose hardware monitoring sensors.')}
                        </p>
                        <ClipboardCopy isCode isReadOnly hoverTip={_('Copy command')} clickTip={_('Copied')}>
                            sudo apt install lm-sensors nvme-cli smartmontools &amp;&amp; sudo sensors-detect --auto
                        </ClipboardCopy>
                        <Button variant="secondary" onClick={retry}>
                            {_('Run detection again')}
                        </Button>
                    </Alert>
                );
            case 'no-data':
                return (
                    <Alert
                        isInline
                        variant={AlertVariant.info}
                        title={_('No live sensor readings were reported')}
                    >
                        <p>
                            {_('This environment may not expose physical sensors. Virtual machines commonly omit hardware monitoring interfaces.')}
                        </p>
                    </Alert>
                );
            case 'error':
                return (
                    <Alert isInline variant={AlertVariant.danger} title={_('Unable to collect sensor data')}>
                        <p>
                            {_('An unexpected error prevented the Sensors page from retrieving live metrics.')}
                        </p>
                        {lastError && <p>{lastError}</p>}
                        <Button variant="secondary" onClick={retry}>
                            {_('Try again')}
                        </Button>
                    </Alert>
                );
            default:
                return null;
        }
    };

    const statusPillLabel = (() => {
        if (status === 'needs-privileges') return _('Needs privileges');
        if (status === 'error') return _('Error');
        if (status === 'no-sources') return _('No backends');
        if (status === 'no-data') return _('No data');
        if (isPaused) return _('Paused');
        if (overall === 'danger') return _('Threshold exceeded');
        if (overall === 'warning') return _('Approaching threshold');
        return _('All sensors healthy');
    })();

    const pillVariant: ThresholdState = (() => {
        if (status === 'error' || status === 'needs-privileges' || overall === 'danger') return 'danger';
        if (overall === 'warning') return 'warning';
        return 'normal';
    })();

    const banner = renderBanner();

    return (
        <Page
            className="pf-m-no-sidebar"
            isContentFilled
            aria-label={_('Sensors dashboard')}
        >
            <PageGroup stickyOnBreakpoint={{ default: 'top' }}>
                <PageSection
                    hasBodyWrapper={false}
                    padding={{ default: 'noPadding' }}
                    className="sensor-app__hero"
                >
                    <div className="sensor-app__hero-row">
                        <div className="sensor-app__title-block">
                            <h1 className="sensor-app__title">
                                {_('Sensors')}
                                <Label isCompact color="blue">
                                    {totalReadings > 0
                                        ? `${totalReadings} ${_('readings')}`
                                        : _('Idle')}
                                </Label>
                            </h1>
                            <p className="sensor-app__subtitle">
                                {_('Live hardware telemetry: temperature, fans, voltages and power.')}
                            </p>
                        </div>
                        <div className="sensor-app__meta">
                            <span
                                className={`sensor-app__status-pill sensor-app__status-pill--${pillVariant}${isPaused ? ' sensor-app__status-pill--idle' : ''}`}
                                role="status"
                                aria-live="polite"
                            >
                                {statusPillLabel}
                            </span>
                            <span className="sensor-app__updated" aria-live="polite">
                                {_('Updated')}: {formatLastUpdate(lastUpdate)}
                            </span>
                        </div>
                    </div>
                    {availableProviders.length > 0 && (
                        <div className="sensor-sources">
                            <span className="sensor-sources__label">{_('Data sources')}</span>
                            {availableProviders.map(provider => (
                                <Label
                                    key={provider}
                                    color={activeProvider === provider ? 'blue' : 'grey'}
                                    isCompact
                                >
                                    {provider}
                                    {activeProvider === provider && <> · {_('active')}</>}
                                </Label>
                            ))}
                        </div>
                    )}
                    <div className="sensor-app__shortcuts" aria-hidden="true">
                        <span><kbd>/</kbd>{_('Search')}</span>
                        <span><kbd>P</kbd>{_('Pause / resume')}</span>
                        <span><kbd>U</kbd>{_('Switch °C / °F')}</span>
                        <span><kbd>V</kbd>{_('Toggle table / cards')}</span>
                    </div>
                </PageSection>

                {banner && (
                    <PageSection
                        hasBodyWrapper={false}
                        padding={{ default: 'noPadding' }}
                        className="sensor-app__banners"
                    >
                        {banner}
                    </PageSection>
                )}
            </PageGroup>

            <PageSection
                hasBodyWrapper={false}
                padding={{ default: 'noPadding' }}
                className="sensor-app__content"
            >
                <Tabs
                    className="sensor-tabs"
                    activeKey={activeKey}
                    onSelect={handleTabSelect}
                    aria-label={_('Sensor category list')}
                    role="region"
                >
                    {TABS.map(tab => {
                        const summary = tabSummaries.get(tab.category);
                        const count = summary?.count ?? 0;
                        const state = summary?.worst ?? 'normal';
                        return (
                            <Tab
                                key={tab.eventKey}
                                eventKey={tab.eventKey}
                                title={
                                    <TabTitleText>
                                        <span className="sensor-tab__title">
                                            {tab.title}
                                            <span
                                                className="sensor-tab__count"
                                                data-state={state}
                                            >
                                                {count}
                                            </span>
                                        </span>
                                    </TabTitleText>
                                }
                            >
                                <div className="sensor-description">
                                    <h2 className="sensor-description__heading">{tab.title}</h2>
                                    <p className="sensor-description__text">{tab.description}</p>
                                </div>
                                {isLoading && (
                                    <div
                                        className="sensor-skeleton"
                                        aria-label={_('Loading sensor data...')}
                                        role="status"
                                    >
                                        <div className="sensor-skeleton__card" />
                                        <div className="sensor-skeleton__card" />
                                        <div className="sensor-skeleton__card" />
                                    </div>
                                )}
                                {!isLoading && (
                                    <SensorTable
                                        category={tab.category}
                                        groups={groupsForCategory(data.groups, tab.category)}
                                        unit={unit}
                                        onUnitChange={setUnit}
                                        refreshMs={refreshMs}
                                        onRefreshChange={setRefreshMs}
                                        pinnedKeys={pinned}
                                        onTogglePinned={togglePinned}
                                        viewMode={viewMode}
                                        onViewModeChange={setViewMode}
                                        density={density}
                                        onDensityChange={setDensity}
                                        isPaused={isPaused}
                                        onPauseToggle={togglePause}
                                        searchTerm={searchTerm}
                                        onSearchChange={setSearchTerm}
                                    />
                                )}
                            </Tab>
                        );
                    })}
                </Tabs>
            </PageSection>
        </Page>
    );
};
