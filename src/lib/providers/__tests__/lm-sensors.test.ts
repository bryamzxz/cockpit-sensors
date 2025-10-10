import { describe, expect, it } from 'vitest';

import { normalizeLmSensors } from '../lm-sensors';

describe('normalizeLmSensors', () => {
    it('flattens features from multiple chips', () => {
        const payload = {
            'mt7921_phy0-virtual-0': {
                Adapter: 'Virtual device',
                temp1: {
                    temp1_input: 30.0,
                },
            },
            'coretemp-isa-0000': {
                Adapter: 'ISA adapter',
                'Package id 0': {
                    temp1_input: 55.5,
                    temp1_label: 'Package id 0',
                    temp1_max: 100,
                },
                'Core 0': {
                    temp2_input: 44.25,
                    temp2_label: 'Core 0',
                },
                'Core 1': {
                    temp3_input: 47.75,
                    temp3_label: 'Core 1',
                },
            },
        };

        const samples = normalizeLmSensors(payload);
        const temperatureSamples = samples.filter(sample => sample.kind === 'temp');

        expect(temperatureSamples).toHaveLength(4);
        expect(temperatureSamples.map(sample => sample.label)).toEqual(
            expect.arrayContaining(['CPU Package', 'CPU Core 0', 'CPU Core 1'])
        );
        const mt7921Sample = temperatureSamples.find(sample => sample.chipId === 'mt7921_phy0-virtual-0');
        expect(mt7921Sample?.label.toLowerCase()).toContain('temp1');
        expect(mt7921Sample?.value).toBeCloseTo(30);
    });
});
