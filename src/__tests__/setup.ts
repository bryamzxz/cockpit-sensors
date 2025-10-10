import React from 'react';
import { vi } from 'vitest';

import type { Cockpit } from '../types/cockpit';
import cockpitMock from '../__mocks__/cockpit';

vi.mock('@patternfly/react-core/dist/esm/components/EmptyState/EmptyStateHeader', () => ({
    EmptyStateHeader: ({
        icon,
        titleText,
        headingLevel = 'h2',
    }: {
        icon?: React.ComponentType | React.ReactNode;
        titleText?: React.ReactNode;
        headingLevel?: keyof JSX.IntrinsicElements;
    }) => {
        const Heading = headingLevel ?? 'h2';
        let renderedIcon: React.ReactNode = null;
        if (icon) {
            if (typeof icon === 'function') {
                const IconComponent = icon as React.ComponentType;
                renderedIcon = React.createElement(IconComponent, null);
            } else if (React.isValidElement(icon)) {
                renderedIcon = icon;
            }
        }
        return React.createElement(
            'div',
            null,
            renderedIcon,
            titleText ? React.createElement(Heading, null, titleText) : null,
        );
    },
}));

vi.mock('@patternfly/react-core/dist/esm/components/EmptyState/EmptyStateIcon', () => ({
    EmptyStateIcon: ({ icon: Icon }: { icon?: React.ElementType }) =>
        Icon ? React.createElement(Icon, null) : null,
}));

Object.defineProperty(globalThis, 'cockpit', {
    value: cockpitMock as Cockpit,
    configurable: true,
    writable: true,
});
