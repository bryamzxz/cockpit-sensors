import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { Application } from '../app/Application';
import { useSensors } from '../hooks/useSensors';

vi.mock('@patternfly/react-core', async () => {
    const React = await import('react');

    const createComponent = (tag: keyof JSX.IntrinsicElements = 'div') => {
        const Component = function MockComponent({
            children,
            ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
            return React.createElement(tag, props, children);
        };

        const normalizedTag = typeof tag === 'string' ? tag : 'Component';
        Component.displayName = `Mock${normalizedTag.charAt(0).toUpperCase()}${normalizedTag.slice(1)}`;

        return Component;
    };

    const createFragmentComponent = (displayName: string) => {
        const Component = function MockFragment({ children }: React.PropsWithChildren<unknown>) {
            return React.createElement(React.Fragment, null, children);
        };

        Component.displayName = displayName;

        return Component;
    };

    const Alert = function MockAlert({
        title,
        children,
        ...props
    }: React.PropsWithChildren<{ title?: React.ReactNode } & { isInline?: boolean; variant?: unknown }>) {
        const filtered: Record<string, unknown> = { ...props };
        delete filtered.isInline;
        delete filtered.variant;
        return React.createElement('section', filtered, React.createElement(React.Fragment, null, title, children));
    };

    const PageSection = function MockPageSection({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
        const filtered: Record<string, unknown> = { ...props };
        delete filtered.variant;
        delete filtered.isFilled;
        return React.createElement('section', filtered, children);
    };

    const ClipboardCopy = function MockClipboardCopy({
        children,
    }: React.PropsWithChildren<Record<string, unknown>>) {
        return React.createElement('pre', null, children);
    };

    const LabelGroup = function MockLabelGroup({
        children,
    }: React.PropsWithChildren<Record<string, unknown>>) {
        return React.createElement('div', null, children);
    };

    return {
        Alert,
        AlertActionLink: createComponent('button'),
        AlertVariant: { info: 'info', warning: 'warning', danger: 'danger' },
        Button: createComponent('button'),
        ClipboardCopy,
        Content: createComponent('section'),
        Label: createComponent('span'),
        LabelGroup,
        Page: createComponent('main'),
        PageSection,
        Spinner: createComponent('div'),
        Tab: createFragmentComponent('MockTab'),
        TabTitleText: createFragmentComponent('MockTabTitleText'),
        Tabs: createFragmentComponent('MockTabs'),
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

describe('Application', () => {
    beforeEach(() => {
        mockedUseSensors.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders the onboarding banner when no backends are available', () => {
        mockedUseSensors.mockReturnValue({
            data: { groups: [] },
            isLoading: false,
            status: 'no-sources',
            activeProvider: undefined,
            lastError: undefined,
            availableProviders: [],
            retry: vi.fn(),
        });

        render(<Application />);

        expect(screen.getByText('No sensor backends are available on this system')).toBeInTheDocument();
    });

    it('shows available providers when sensor groups are present', () => {
        mockedUseSensors.mockReturnValue({
            data: {
                groups: [
                    {
                        id: 'chip-1',
                        name: 'test-chip',
                        label: 'Test chip',
                        category: 'temperature',
                        readings: [],
                        source: 'hwmon',
                    },
                ],
            },
            isLoading: false,
            status: 'ready',
            activeProvider: 'hwmon',
            lastError: undefined,
            availableProviders: ['hwmon'],
            retry: vi.fn(),
        });

        render(<Application />);

        expect(screen.getAllByText('hwmon').length).toBeGreaterThan(0);
        expect(screen.getAllByText('(active)').length).toBeGreaterThan(0);
    });
});
