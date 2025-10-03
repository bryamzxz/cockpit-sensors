declare module 'cockpit' {
    interface Cockpit {
        gettext(message: string): string;
    }

    const cockpit: Cockpit;
    export default cockpit;
}
