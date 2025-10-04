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
import cockpit from 'cockpit';
import {
    Content,
    Page,
    PageSection,
    PageSectionProps,
    Tab,
    TabTitleText,
    Tabs,
} from '@patternfly/react-core';

import { SensorTable } from '../components/SensorTable';
import { useSensors } from '../hooks/useSensors';
import { SensorCategory } from '../types/sensors';
import { groupsForCategory } from '../utils/grouping';

import '../app.scss';

const _: typeof cockpit.gettext = cockpit.gettext.bind(cockpit);
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
    const { data, isLoading, isMocked } = useSensors();

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

    return (
        <Page>
            <PageSection variant={PAGE_SECTION_VARIANT} isFilled>
                <Tabs
                    activeKey={activeKey}
                    onSelect={handleTabSelect}
                    aria-label={_('Sensor category list')}
                    role="region"
                >
                    {TABS.map(tab => (
                        <Tab key={tab.eventKey} eventKey={tab.eventKey} title={<TabTitleText>{tab.title}</TabTitleText>}>
                            <Content>
                                <h2>{tab.title}</h2>
                                <p>{tab.description}</p>
                                {!isMocked && !isLoading && (
                                    <small>
                                        {_('Live sensor data will appear once the service integration is enabled.')}
                                    </small>
                                )}
                            </Content>
                            <div style={{ marginTop: 'var(--pf-global--spacer--lg)' }}>
                                {isLoading ? (
                                    <p>{_('Loading sensor data...')}</p>
                                ) : (
                                    <SensorTable groups={getGroupsForCategory(tab.category)} />
                                )}
                            </div>
                        </Tab>
                    ))}
                </Tabs>
            </PageSection>
        </Page>
    );
};
