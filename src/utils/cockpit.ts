export const getCockpit = (): Cockpit => {
    if (typeof cockpit === 'undefined') {
        throw new ReferenceError('cockpit is not defined');
    }

    return cockpit;
};

type CockpitGettext = Cockpit['gettext'];

export const gettext: CockpitGettext = ((message: Parameters<CockpitGettext>[0]) =>
    getCockpit().gettext(message)) as CockpitGettext;

export const _: CockpitGettext = gettext;
