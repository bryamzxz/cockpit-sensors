import React from 'react';

type AnyProps = Record<string, unknown>;

type ComponentProps = React.PropsWithChildren<AnyProps>;

const createElement = (tag: keyof JSX.IntrinsicElements) =>
    function MockComponent({ children, ...props }: ComponentProps) {
        return React.createElement(tag, props, children);
    };

export const Alert = ({
    title,
    children,
    actionLinks,
    ...props
}: React.PropsWithChildren<{ title?: React.ReactNode; actionLinks?: React.ReactNode } & AnyProps>) => {
    const { variant, isInline, ...rest } = props;
    void variant;
    void isInline;
    return React.createElement('section', rest, title, children, actionLinks);
};

export const AlertActionLink = createElement('button');
export const AlertVariant = { info: 'info', warning: 'warning', danger: 'danger' } as const;

export const Button = ({
    children,
    isDisabled,
    isAriaDisabled,
    icon,
    ...props
}: ComponentProps & { isDisabled?: boolean; isAriaDisabled?: boolean; icon?: React.ReactNode }) =>
    React.createElement(
        'button',
        {
            ...props,
            disabled: isDisabled,
            'aria-disabled': isAriaDisabled || undefined,
            type: 'button',
        },
        icon,
        children,
    );

export const ClipboardCopy = ({ children }: ComponentProps) => React.createElement('pre', null, children);
export const ClipboardCopyVariant = { expansion: 'expansion' } as const;
export const CodeBlock = createElement('pre');
export const CodeBlockCode = ({ children, ...props }: ComponentProps) =>
    React.createElement('code', props, children);
export const Content = createElement('section');

export const Label = ({
    children,
    ...props
}: ComponentProps & { isCompact?: boolean; color?: string; status?: string }) => {
    const { isCompact, color, status, ...rest } = props;
    void isCompact;
    void color;
    return React.createElement('span', { ...rest, 'data-status': status }, children);
};

export const Badge = ({ children, ...props }: ComponentProps & { isRead?: boolean }) => {
    const { isRead, ...rest } = props;
    void isRead;
    return React.createElement('span', rest, children);
};

export const Card = ({ children, ...props }: ComponentProps & { isCompact?: boolean }) => {
    const { isCompact, ...rest } = props;
    void isCompact;
    return React.createElement('article', rest, children);
};

export const CardBody = createElement('div');

export const Gallery = ({
    children,
    ...props
}: ComponentProps & { hasGutter?: boolean; minWidths?: Record<string, string> }) => {
    const { hasGutter, minWidths, ...rest } = props;
    void hasGutter;
    void minWidths;
    return React.createElement('section', rest, children);
};

export const Skeleton = ({ ...props }: ComponentProps & { height?: string; screenreaderText?: string }) => {
    const { height, screenreaderText, ...rest } = props;
    void height;
    void screenreaderText;
    return React.createElement('div', { ...rest, 'data-skeleton': true });
};

export const LabelGroup = ({
    children,
    ...props
}: ComponentProps & { categoryName?: React.ReactNode }) => {
    const { categoryName, ...rest } = props;
    return React.createElement('div', rest, categoryName, children);
};

export const Page = ({ children, ...props }: ComponentProps) => {
    const { isContentFilled, ...rest } = props;
    void isContentFilled;
    return React.createElement('main', rest, children);
};
export const PageGroup = ({ children, ...props }: ComponentProps) => {
    const { stickyOnBreakpoint, ...rest } = props;
    void stickyOnBreakpoint;
    return React.createElement('div', rest, children);
};
export const PageSection = ({ children, ...props }: ComponentProps) => {
    const { variant, isFilled, isWidthLimited, hasBodyWrapper, padding, ...rest } = props;
    void variant;
    void isFilled;
    void isWidthLimited;
    void hasBodyWrapper;
    void padding;
    return React.createElement('section', rest, children);
};

export const Spinner = createElement('div');

export const Tab = ({ children, title }: ComponentProps & { title?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, title, children);
export const TabTitleText = ({ children }: ComponentProps) =>
    React.createElement(React.Fragment, null, children);
export const Tabs = ({ children, ...rest }: ComponentProps) => {
    const { activeKey, onSelect, ...passthrough } = rest;
    void activeKey;
    void onSelect;
    return React.createElement('div', passthrough, children);
};

interface EmptyStateProps extends ComponentProps {
    titleText?: React.ReactNode;
    icon?: React.ComponentType | React.ReactNode;
    headingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    variant?: string;
}

export const EmptyState = ({
    children,
    titleText,
    icon,
    headingLevel = 'h2',
    ...rest
}: EmptyStateProps) => {
    void rest.variant;
    let iconElement: React.ReactNode = null;
    if (icon) {
        if (typeof icon === 'function') {
            const IconComponent = icon as React.ComponentType;
            iconElement = React.createElement(IconComponent);
        } else if (React.isValidElement(icon)) {
            iconElement = icon;
        }
    }
    return React.createElement(
        'div',
        rest,
        iconElement,
        titleText ? React.createElement(headingLevel, null, titleText) : null,
        children,
    );
};

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
export const ToolbarToggleGroup = ({
    children,
    ...props
}: ComponentProps & { toggleIcon?: React.ReactNode; breakpoint?: string }) => {
    const { toggleIcon, breakpoint, ...rest } = props;
    void toggleIcon;
    void breakpoint;
    return React.createElement('div', rest, children);
};
export const ToolbarGroup = ({ children, ...props }: ComponentProps) => {
    const { align, alignItems, variant, ...rest } = props;
    void align;
    void alignItems;
    void variant;
    return React.createElement('div', rest, children);
};
export const ToolbarItem = ({ children, ...props }: ComponentProps) => {
    const { align, alignItems, visibility, variant, ...rest } = props;
    void align;
    void alignItems;
    void visibility;
    void variant;
    return React.createElement('div', rest, children);
};

export const ModalVariant = { medium: 'medium', small: 'small', large: 'large', default: 'default' } as const;

export const Modal = ({
    children,
    isOpen = true,
    actions,
    ...props
}: React.PropsWithChildren<{ isOpen?: boolean; actions?: React.ReactNode[] } & AnyProps>) => {
    const { onClose, variant, ...rest } = props;
    void onClose;
    void variant;
    if (!isOpen) {
        return null;
    }
    return React.createElement('div', rest, children, actions);
};

export const ModalHeader = ({
    title,
    description,
    ...props
}: ComponentProps & { title?: React.ReactNode; description?: React.ReactNode }) => {
    const { labelId, descriptorId, ...rest } = props;
    void labelId;
    void descriptorId;
    return React.createElement('header', rest, title, description);
};

export const ModalBody = createElement('div');
export const ModalFooter = createElement('footer');

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
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                onChange?.(event.target.value, event),
        },
        children,
    );

export const FormSelectOption = ({
    value,
    label,
}: {
    value: string | number;
    label?: React.ReactNode;
}) => React.createElement('option', { value }, label ?? value);

export const Tooltip = ({ children }: ComponentProps) =>
    React.createElement(React.Fragment, null, children);

interface SearchInputProps extends ComponentProps {
    value?: string;
    onChange?: (event: React.FormEvent<HTMLInputElement>, value: string) => void;
    onClear?: () => void;
    placeholder?: string;
}

export const SearchInput = ({ value, onChange, onClear, placeholder, ...props }: SearchInputProps) => {
    void onClear;
    return React.createElement(
        'div',
        props,
        React.createElement('input', {
            type: 'search',
            value,
            placeholder,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                onChange?.(event, event.target.value),
            'aria-label': props['aria-label'] as string | undefined,
        }),
    );
};

export const ToggleGroup = ({ children, ...props }: ComponentProps) => {
    const { 'aria-label': ariaLabel, ...rest } = props;
    return React.createElement(
        'div',
        { role: 'group', 'aria-label': ariaLabel as string | undefined, ...rest },
        children,
    );
};

interface ToggleGroupItemProps extends ComponentProps {
    text?: React.ReactNode;
    icon?: React.ReactNode;
    isSelected?: boolean;
    onChange?: (event: React.MouseEvent, selected: boolean) => void;
    buttonId?: string;
}

export const ToggleGroupItem = ({
    text,
    icon,
    isSelected,
    onChange,
    buttonId,
    ...props
}: ToggleGroupItemProps) => {
    const { iconPosition, isDisabled, ...rest } = props;
    void iconPosition;
    return React.createElement(
        'button',
        {
            ...rest,
            type: 'button',
            id: buttonId,
            disabled: isDisabled,
            'aria-pressed': Boolean(isSelected),
            'data-selected': Boolean(isSelected),
            onClick: (event: React.MouseEvent) => onChange?.(event, !isSelected),
        },
        icon,
        text,
    );
};
