import React from 'react';

type AnyProps = Record<string, unknown>;

type ComponentProps = React.PropsWithChildren<AnyProps>;

const createElement = (tag: keyof JSX.IntrinsicElements) =>
    function MockComponent({ children, ...props }: ComponentProps) {
        return React.createElement(tag, props, children);
    };

export const Alert = ({ title, children, ...props }: React.PropsWithChildren<{ title?: React.ReactNode } & AnyProps>) => {
    const { variant: _variant, isInline: _isInline, ...rest } = props;
    return React.createElement('section', rest, title, children);
};

export const AlertActionLink = createElement('button');
export const AlertVariant = { info: 'info', warning: 'warning', danger: 'danger' } as const;
export const Button = ({ children, isDisabled, ...props }: ComponentProps & { isDisabled?: boolean }) =>
    React.createElement('button', { ...props, disabled: isDisabled }, children);
export const ClipboardCopy = ({ children }: ComponentProps) => React.createElement('pre', null, children);
export const Content = createElement('section');
export const Label = ({ children, isCompact: _isCompact, ...props }: ComponentProps & { isCompact?: boolean }) =>
    React.createElement('span', props, children);
export const LabelGroup = ({
    children,
    categoryName: _categoryName,
    ...props
}: ComponentProps & { categoryName?: React.ReactNode }) => React.createElement('div', props, children);
export const Page = createElement('main');
export const PageSection = ({ children, ...props }: ComponentProps) => {
    const { variant: _variant, isFilled: _isFilled, isWidthLimited: _isWidthLimited, ...rest } = props;
    return React.createElement('section', rest, children);
};
export const Spinner = createElement('div');
export const Tab = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);
export const TabTitleText = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);
export const Tabs = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);

export const EmptyState = ({ children }: ComponentProps) => React.createElement('div', null, children);
export const EmptyStateBody = ({ children }: ComponentProps) => React.createElement('p', null, children);
export const EmptyStateHeader = ({ icon, titleText, headingLevel = 'h2' }: { icon?: React.ReactNode; titleText?: React.ReactNode; headingLevel?: string }) =>
    React.createElement(headingLevel as keyof JSX.IntrinsicElements, null, icon, titleText);
export const EmptyStateIcon = ({ icon }: { icon?: React.ElementType }) => {
    const Icon = icon ?? 'span';
    return React.createElement(Icon as React.ElementType, null);
};

export const Toolbar = createElement('div');
export const ToolbarContent = createElement('div');
export const ToolbarGroup = createElement('div');
export const ToolbarItem = createElement('div');

interface FormSelectProps extends ComponentProps {
    value?: string;
    onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const FormSelect = ({ value, onChange, children, ...props }: FormSelectProps) =>
    React.createElement(
        'select',
        {
            ...props,
            value,
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value, event),
        },
        children,
    );

export const FormSelectOption = ({ value, label }: { value: string | number; label?: React.ReactNode }) =>
    React.createElement('option', { value }, label ?? value);

export const Tooltip = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);
