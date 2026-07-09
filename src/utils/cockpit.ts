import type { Cockpit, CockpitGettext } from '../types/cockpit';

const resolveCockpit = (): Cockpit => {
    if (typeof cockpit === 'undefined') {
        throw new ReferenceError('cockpit is not defined');
    }

    return cockpit;
};

export const gettext: CockpitGettext = message => resolveCockpit().gettext(message);

export const _: CockpitGettext = gettext;

/**
 * cockpit.format positional substitution ("Updated $0 ago"), so translated
 * strings stay whole sentences instead of untranslatable concatenations.
 */
export const format = (template: string, ...args: unknown[]): string =>
    resolveCockpit().format(template, ...args);

export const getCockpit = resolveCockpit;
