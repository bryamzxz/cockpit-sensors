const cockpit = {
    gettext: (message: string) => message,
    format: (template: string, ...args: unknown[]) =>
        template.replace(/\$(\d+)/g, (match, index: string) => {
            const value = args[Number(index)];
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
            }
            return match;
        }),
};

export default cockpit;
