/**
 * Follows the Cockpit shell theme, mirroring pkg/lib/cockpit-dark-theme:
 * the shell persists its choice in localStorage under "shell:style"
 * ("auto" | "light" | "dark") and notifies same-window changes with a
 * "cockpit-style" CustomEvent. This replaces the previous approach of
 * observing the parent frame's class list, which broke silently when the
 * frame could not access its parent and missed OS-level theme changes.
 *
 * Imported for its side effects from index.tsx.
 */

const prefersDark = (): boolean =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (style?: string): void => {
    const resolved = style || localStorage.getItem('shell:style') || 'auto';
    const darkMode = resolved === 'dark' || (resolved === 'auto' && prefersDark());

    document.documentElement.classList.toggle('pf-v6-theme-dark', darkMode);
};

window.addEventListener('storage', event => {
    if (event.key === 'shell:style') {
        applyTheme();
    }
});

// The storage event does not fire in the window that changed the value,
// so the shell also broadcasts a custom event.
window.addEventListener('cockpit-style', event => {
    if (event instanceof CustomEvent) {
        const detail = event.detail as { style?: string } | undefined;
        applyTheme(detail?.style);
    }
});

if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
}

applyTheme();
