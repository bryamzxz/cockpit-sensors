import React from 'react';

type AnyProps = Record<string, unknown>;

type ComponentProps = React.PropsWithChildren<AnyProps>;

const createElement = (tag: keyof JSX.IntrinsicElements) =>
    function MockComponent({ children, ...props }: ComponentProps) {
        return React.createElement(tag, props, children);
    };

export const Alert = ({ title, children, ...props }: React.PropsWithChildren<{ title?: React.ReactNode } & AnyProps>) => {
    const { variant, isInline, ...rest } = props;
    void variant;
    void isInline;
    return React.createElement('section', rest, title, children);
};

export const AlertActionLink = createElement('button');
export const AlertVariant = { info: 'info', warning: 'warning', danger: 'danger' } as const;
export const Button = ({ children, isDisabled, ...props }: ComponentProps & { isDisabled?: boolean }) =>
    React.createElement('button', { ...props, disabled: isDisabled }, children);
export const ClipboardCopy = ({ children }: ComponentProps) => React.createElement('pre', null, children);
export const ClipboardCopyVariant = { expansion: 'expansion' } as const;
export const Content = createElement('section');
export const Label = ({ children, ...props }: ComponentProps & { isCompact?: boolean }) => {
    const { isCompact, ...rest } = props;
    void isCompact;
    return React.createElement('span', rest, children);
};
export const LabelGroup = ({ children, ...props }: ComponentProps & { categoryName?: React.ReactNode }) => {
    const { categoryName, ...rest } = props;
    void categoryName;
    return React.createElement('div', rest, children);
};
export const Page = createElement('main');
export const PageSection = ({ children, ...props }: ComponentProps) => {
    const { variant, isFilled, isWidthLimited, ...rest } = props;
    void variant;
    void isFilled;
    void isWidthLimited;
    return React.createElement('section', rest, children);
};
export const Spinner = createElement('div');
export const Tab = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);
export const TabTitleText = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);
export const Tabs = ({ children }: ComponentProps) => React.createElement(React.Fragment, null, children);

export const EmptyState = ({ children }: ComponentProps) => React.createElement('div', null, children);
export const EmptyStateBody = ({ children }: ComponentProps) => React.createElement('p', null, children);
type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export const EmptyStateHeader = ({
    icon,
    titleText,
    headingLevel = 'h2',
}: {
    icon?: React.ComponentType | React.ReactNode;
    titleText?: React.ReactNode;
    headingLevel?: HeadingLevel;
}) => {
    const children: React.ReactNode[] = [];
    if (icon) {
        if (typeof icon === 'function') {
            const IconComponent = icon as React.ComponentType;
            children.push(React.createElement(IconComponent));
        } else if (React.isValidElement(icon)) {
            children.push(icon);
        }
    }
    if (titleText) {
        children.push(titleText);
    }
    return React.createElement(headingLevel, null, ...children);
};
export const EmptyStateIcon = ({ icon }: { icon?: React.ElementType }) => {
    const IconComponent: React.ElementType = icon ?? 'span';
    return React.createElement(IconComponent, null);
};

export const Toolbar = createElement('div');
export const ToolbarContent = createElement('div');
export const ToolbarGroup = createElement('div');
export const ToolbarItem = createElement('div');

export const ModalVariant = { medium: 'medium', small: 'small', large: 'large' } as const;
export const Modal = ({
    children,
    isOpen = true,
    actions,
    ...props
}: React.PropsWithChildren<{ isOpen?: boolean; actions?: React.ReactNode[] } & AnyProps>) => {
    const { onClose, variant, title, description, ...rest } = props;
    void onClose;
    void variant;
    void title;
    void description;
    if (!isOpen) {
        return null;
    }
    return React.createElement('div', rest, children, actions);
};

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
