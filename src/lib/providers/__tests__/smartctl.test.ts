import { describe, expect, it } from 'vitest';

import { extractTemperature, buildSample, SmartctlDeviceInfo } from '../smartctl';

describe('extractTemperature', () => {
    it('returns undefined for empty data', () => {
        expect(extractTemperature({})).toBeUndefined();
    });

    it('extracts temperature from temperature.current field', () => {
        const data = {
            temperature: {
                current: 36,
            },
        };

        expect(extractTemperature(data)).toBe(36);
    });

    it('falls back to SMART attribute 194 when temperature.current is missing', () => {
        const data = {
            ata_smart_attributes: {
                table: [
                    {
                        id: 194,
                        name: 'Temperature_Celsius',
                        value: 42,
                        raw: { value: 42, string: '42' },
                    },
                ],
            },
        };

        expect(extractTemperature(data)).toBe(42);
    });

    it('falls back to SMART attribute 190 when 194 is missing', () => {
        const data = {
            ata_smart_attributes: {
                table: [
                    {
                        id: 190,
                        name: 'Airflow_Temperature_Cel',
                        value: 38,
                        raw: { value: 38, string: '38' },
                    },
                ],
            },
        };

        expect(extractTemperature(data)).toBe(38);
    });

    it('prefers temperature.current over SMART attributes', () => {
        const data = {
            temperature: {
                current: 36,
            },
            ata_smart_attributes: {
                table: [
                    {
                        id: 194,
                        name: 'Temperature_Celsius',
                        value: 99,
                        raw: { value: 99, string: '99' },
                    },
                ],
            },
        };

        expect(extractTemperature(data)).toBe(36);
    });

    it('prefers attribute 194 over 190', () => {
        const data = {
            ata_smart_attributes: {
                table: [
                    {
                        id: 190,
                        name: 'Airflow_Temperature_Cel',
                        value: 30,
                        raw: { value: 30, string: '30' },
                    },
                    {
                        id: 194,
                        name: 'Temperature_Celsius',
                        value: 36,
                        raw: { value: 36, string: '36' },
                    },
                ],
            },
        };

        expect(extractTemperature(data)).toBe(36);
    });

    it('returns undefined for non-finite temperature values', () => {
        const data = {
            temperature: {
                current: NaN,
            },
        };

        expect(extractTemperature(data)).toBeUndefined();
    });
});

describe('buildSample', () => {
    it('builds sample with model and serial', () => {
        const device: SmartctlDeviceInfo = {
            name: '/dev/sda',
            model: 'KINGSTON SA400S37240G',
            serial: '50026B7282EA612A',
        };

        const sample = buildSample(device, 36);

        expect(sample.kind).toBe('temp');
        expect(sample.id).toBe('/dev/sda:temperature');
        expect(sample.label).toBe('KINGSTON SA400S37240G #50026B7282EA612A');
        expect(sample.value).toBe(36);
        expect(sample.unit).toBe('°C');
        expect(sample.chipId).toBe('/dev/sda');
        expect(sample.chipLabel).toBe('KINGSTON SA400S37240G (/dev/sda)');
        expect(sample.chipName).toBe('KINGSTON SA400S37240G');
    });

    it('builds sample without serial', () => {
        const device: SmartctlDeviceInfo = {
            name: '/dev/sdb',
            model: 'Samsung SSD 860',
        };

        const sample = buildSample(device, 40);

        expect(sample.label).toBe('Samsung SSD 860');
        expect(sample.chipLabel).toBe('Samsung SSD 860 (/dev/sdb)');
    });

    it('builds sample without model', () => {
        const device: SmartctlDeviceInfo = {
            name: '/dev/sdc',
        };

        const sample = buildSample(device, 45);

        expect(sample.label).toBe('SATA device');
        expect(sample.chipLabel).toBe('/dev/sdc');
        expect(sample.chipName).toBe('/dev/sdc');
    });

    it('builds sample without model but with serial', () => {
        const device: SmartctlDeviceInfo = {
            name: '/dev/sdd',
            serial: 'ABC123',
        };

        const sample = buildSample(device, 38);

        expect(sample.label).toBe('SATA device #ABC123');
    });
});
