import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { Application } from '../app/Application';
import { useSensors } from '../hooks/useSensors';

vi.mock('@patternfly/react-core', async () => {
    const React = await import('react');

    const createComponent = (tag: keyof JSX.IntrinsicElements = 'div') =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
            React.createElement(tag, props, children);

    return {
        Content: createComponent('section'),
        Page: createComponent('main'),
        PageSection: createComponent('section'),
        Tab: ({ children }: React.PropsWithChildren<unknown>) => React.createElement(React.Fragment, null, children),
        TabTitleText: ({ children }: React.PropsWithChildren<unknown>) =>
            React.createElement(React.Fragment, null, children),
        Tabs: ({ children }: React.PropsWithChildren<unknown>) =>
            React.createElement(React.Fragment, null, children),
    };
});

vi.mock(
    'cockpit',
    () => ({
        default: {
            gettext: (message: string) => message,
        },
    }),
    { virtual: true }
);

vi.mock('../hooks/useSensors');

const mockedUseSensors = vi.mocked(useSensors);

const FALLBACK_TEXT = 'Live sensor data will appear once the service integration is enabled.';

describe('Application', () => {
    beforeEach(() => {
        mockedUseSensors.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    it('displays the live data hint when no real sensor data is available', () => {
        mockedUseSensors.mockReturnValue({
            data: { groups: [] },
            isLoading: false,
            isMocked: false,
        });

        render(<Application />);

        const hints = screen.getAllByText(FALLBACK_TEXT);
        expect(hints.length).toBeGreaterThan(0);
    });

    it('hides the live data hint when sensor groups are present', () => {
        mockedUseSensors.mockReturnValue({
            data: {
                groups: [
                    {
                        id: 'chip-1',
                        name: 'test-chip',
                        label: 'Test chip',
                        category: 'temperature',
                        readings: [],
                    },
                ],
            },
            isLoading: false,
            isMocked: false,
        });

        render(<Application />);

        expect(screen.queryByText(FALLBACK_TEXT)).not.toBeInTheDocument();
    });
});
