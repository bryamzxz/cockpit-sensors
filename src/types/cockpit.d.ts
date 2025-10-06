interface Cockpit {
    gettext(message: string): string;
}

declare global {
    const cockpit: Cockpit;
}

export {};
