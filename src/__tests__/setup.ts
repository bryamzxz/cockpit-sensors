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
        icon?: React.ReactNode;
        titleText?: React.ReactNode;
        headingLevel?: keyof JSX.IntrinsicElements;
    }) => {
        const Heading = headingLevel ?? 'h2';
        return React.createElement(
            'div',
            null,
            icon,
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
