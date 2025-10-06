import type { Cockpit, CockpitGettext } from '../types/cockpit';

const resolveCockpit = (): Cockpit => {
    if (typeof cockpit === 'undefined') {
        throw new ReferenceError('cockpit is not defined');
    }

    return cockpit;
};

export const gettext: CockpitGettext = message => resolveCockpit().gettext(message);

export const _: CockpitGettext = gettext;

export const getCockpit = resolveCockpit;
