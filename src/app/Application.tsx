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
    Page,
    PageSection,
    PageSectionVariants,
    Tab,
    TabTitleText,
    Tabs,
    Text,
    TextContent,
} from '@patternfly/react-core';

import { SensorTable } from '../components/SensorTable';
import { useSensors } from '../hooks/useSensors';
import { SensorCategory } from '../types/sensors';

import '../app.scss';

const _ = cockpit.gettext;

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
];

export const Application: React.FC = () => {
    const [activeKey, setActiveKey] = React.useState<number>(TABS[0].eventKey);
    const { data, isLoading, isMocked } = useSensors();

    const handleTabSelect = (
        _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
        eventKey: number | string,
    ) => {
        setActiveKey(typeof eventKey === 'number' ? eventKey : Number(eventKey));
    };

    const getGroupsForCategory = React.useCallback(
        (category: SensorCategory) => {
            const inCategory = data.groups.filter(group => group.category === category);
            if (inCategory.length === 0) {
                return data.groups;
            }

            const uncategorised = data.groups.filter(group => group.category === 'unknown');
            return uncategorised.length > 0 ? [...inCategory, ...uncategorised] : inCategory;
        },
        [data.groups],
    );

    return (
        <Page>
            <PageSection variant={PageSectionVariants.light} isFilled>
                <Tabs
                    activeKey={activeKey}
                    onSelect={handleTabSelect}
                    aria-label={_('Sensor category list')}
                    role="region"
                >
                    {TABS.map(tab => (
                        <Tab key={tab.eventKey} eventKey={tab.eventKey} title={<TabTitleText>{tab.title}</TabTitleText>}>
                            <TextContent>
                                <Text component="h2">{tab.title}</Text>
                                <Text component="p">{tab.description}</Text>
                                {!isMocked && !isLoading && (
                                    <Text component="small">
                                        {_('Live sensor data will appear once the service integration is enabled.')}
                                    </Text>
                                )}
                            </TextContent>
                            <div style={{ marginTop: 'var(--pf-global--spacer--lg)' }}>
                                {isLoading ? (
                                    <Text component="p">{_('Loading sensor data...')}</Text>
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
