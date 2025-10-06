export type CockpitGettext = (message: string) => string;

export interface Cockpit {
    gettext: CockpitGettext;
}

declare global {
    const cockpit: Cockpit;
}

export {};
