import { describe, expect, it } from 'vitest';

import { __testing, SampleWithProvider } from '../hooks/useSensors';
import { SENSOR_KIND_TO_UNIT, SensorSample } from '../lib/providers/types';

const { aggregateSamples, samplesToSensorData } = __testing;

describe('useSensors helpers', () => {
    it('prefers earlier providers when aggregating samples', () => {
        const samplesByProvider = new Map<string, SensorSample[]>();

        samplesByProvider.set('lm-sensors', [
            {
                kind: 'temp',
                id: 'chip0:temp1',
                label: 'Temp 1',
                value: 48,
            },
        ]);

        samplesByProvider.set('hwmon', [
            {
                kind: 'temp',
                id: 'chip0:temp1',
                label: 'Temp 1',
                value: 50,
            },
        ]);

        const result = aggregateSamples(samplesByProvider);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ provider: 'hwmon', value: 50 });
    });

    it('converts samples into sensor data grouped by chip and category', () => {
        const samples: SampleWithProvider[] = [
            {
                provider: 'hwmon',
                kind: 'temp',
                id: 'chip0:temp1',
                label: 'Core 0',
                value: 54.5,
                chipId: 'chip0',
                chipLabel: 'CPU sensors',
                chipName: 'k10temp',
                unit: SENSOR_KIND_TO_UNIT.temp,
            },
            {
                provider: 'hwmon',
                kind: 'volt',
                id: 'chip0:in1',
                label: '+12V',
                value: 12.04,
                chipId: 'chip0',
                chipLabel: 'CPU sensors',
                chipName: 'k10temp',
                unit: SENSOR_KIND_TO_UNIT.volt,
            },
            {
                provider: 'nvme',
                kind: 'temp',
                id: '/dev/nvme0:temperature',
                label: 'NVMe 0',
                value: 37,
                chipId: '/dev/nvme0',
                chipLabel: 'NVMe 0',
                chipName: 'NVMe',
            },
        ];

        const data = samplesToSensorData(samples);
        expect(data.groups).toHaveLength(3);

        const cpuTemperature = data.groups.find(group => group.id === 'chip0:temperature');
        expect(cpuTemperature).toMatchObject({
            label: 'CPU sensors',
            source: 'hwmon',
        });
        expect(cpuTemperature?.readings).toEqual([
            expect.objectContaining({ label: 'Core 0', unit: SENSOR_KIND_TO_UNIT.temp }),
        ]);

        const cpuVoltage = data.groups.find(group => group.id === 'chip0:voltage');
        expect(cpuVoltage?.readings[0]).toMatchObject({ label: '+12V', unit: SENSOR_KIND_TO_UNIT.volt });

        const nvmeGroup = data.groups.find(group => group.id?.startsWith('/dev/nvme0'));
        expect(nvmeGroup).toMatchObject({ source: 'nvme' });
    });
});
