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
    Content,
    Label,
    LabelGroup,
    Page,
    PageSection,
    PageSectionProps,
    Spinner,
    Tab,
    TabTitleText,
    Tabs,
} from '@patternfly/react-core';

import { SensorTable } from '../components/SensorTable';
import { useSensors } from '../hooks/useSensors';
import { useSensorPreferences } from '../hooks/useSensorPreferences';
import { SensorCategory } from '../types/sensors';
import { groupsForCategory } from '../utils/grouping';
import { _ } from '../utils/cockpit';

import '../app.scss';

const PAGE_SECTION_VARIANT: PageSectionProps['variant'] = 'light';

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
        description: _('View and compare the temperature sensors reported by the system.'),
        category: 'temperature',
    },
    {
        eventKey: 1,
        title: _('Fans'),
        description: _('Monitor the status of installed fans without reloading the page.'),
        category: 'fan',
    },
    {
        eventKey: 2,
        title: _('Voltages'),
        description: _('Review available voltage readings for power supplies and system buses.'),
        category: 'voltage',
    },
    {
        eventKey: 3,
        title: _('Other sensors'),
        description: _(
            'Access readings for sensors that are not recognised as temperature, fan, or voltage devices.'
        ),
        category: 'unknown',
    },
];

export const Application: React.FC = () => {
    const [activeKey, setActiveKey] = React.useState<number>(TABS[0].eventKey);
    const { unit, setUnit, refreshMs, setRefreshMs, pinned, togglePinned } = useSensorPreferences();
    const { data, isLoading, status, activeProvider, lastError, availableProviders, retry } = useSensors(refreshMs);

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
        [setActiveKey]
    );

    const getGroupsForCategory = React.useCallback(
        (category: SensorCategory) => groupsForCategory(data.groups, category),
        [data.groups],
    );

    const renderBanner = () => {
        switch (status) {
            case 'needs-privileges':
                return (
                    <Alert
                        isInline
                        variant={AlertVariant.warning}
                        title={_('Sensor data requires administrative privileges')}
                        actionLinks={
                            <AlertActionLink onClick={retry}>{_('Retry with privileges')}</AlertActionLink>
                        }
                    >
                        <p>
                            {_('Cockpit could not read sensor data without elevated permissions. Retry the operation to trigger a privilege prompt.')}
                        </p>
                        {lastError && <p className="sensor-banner__hint">{lastError}</p>}
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
                        <div className="sensor-banner__copy">
                            <ClipboardCopy isCode isReadOnly hoverTip={_('Copy command')} clickTip={_('Copied')}>
                                sudo apt install lm-sensors nvme-cli smartmontools &amp;&amp; sudo sensors-detect --auto
                            </ClipboardCopy>
                        </div>
                        <Button variant="secondary" onClick={retry} className="sensor-banner__action">
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
                        {lastError && <p className="sensor-banner__hint">{lastError}</p>}
                        <Button variant="secondary" onClick={retry} className="sensor-banner__action">
                            {_('Try again')}
                        </Button>
                    </Alert>
                );
            default:
                return null;
        }
    };

    return (
        <Page>
            <PageSection variant={PAGE_SECTION_VARIANT} isFilled isWidthLimited={false}>
                <div className="sensor-banner">{renderBanner()}</div>
                <Tabs
                    activeKey={activeKey}
                    onSelect={handleTabSelect}
                    aria-label={_('Sensor category list')}
                    role="region"
                >
                    {TABS.map(tab => (
                        <Tab key={tab.eventKey} eventKey={tab.eventKey} title={<TabTitleText>{tab.title}</TabTitleText>}>
                            <Content className="sensor-description">
                                <h2>{tab.title}</h2>
                                <p>{tab.description}</p>
                                {availableProviders.length > 0 && (
                                    <LabelGroup className="sensor-sources" categoryName={_('Data sources')}>
                                        {availableProviders.map(provider => (
                                            <Label key={provider} color="blue">
                                                {provider}
                                                {activeProvider === provider && (
                                                    <span className="pf-v5-u-ml-sm">{_('(active)')}</span>
                                                )}
                                            </Label>
                                        ))}
                                    </LabelGroup>
                                )}
                            </Content>
                            <div className="sensor-table-container">
                                {isLoading && (
                                    <div className="sensor-loading">
                                        <Spinner size="lg" />
                                        <span>{_('Loading sensor data...')}</span>
                                    </div>
                                )}
                                {!isLoading && (
                                    <SensorTable
                                        category={tab.category}
                                        groups={getGroupsForCategory(tab.category)}
                                        unit={unit}
                                        onUnitChange={setUnit}
                                        refreshMs={refreshMs}
                                        onRefreshChange={setRefreshMs}
                                        pinnedKeys={pinned}
                                        onTogglePinned={togglePinned}
                                    />
                                )}
                            </div>
                        </Tab>
                    ))}
                </Tabs>
            </PageSection>
        </Page>
    );
};
