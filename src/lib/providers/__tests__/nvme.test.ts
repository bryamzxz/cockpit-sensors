import { describe, expect, it } from 'vitest';

import { convertTemperature, buildSample, NvmeDeviceInfo } from '../nvme';

describe('convertTemperature', () => {
    it('returns undefined for non-number values', () => {
        expect(convertTemperature(undefined)).toBeUndefined();
        expect(convertTemperature(NaN)).toBeUndefined();
        expect(convertTemperature(Infinity)).toBeUndefined();
    });

    it('converts Kelvin temperatures (> 200) to Celsius', () => {
        // 300K = 27°C
        expect(convertTemperature(300)).toBe(27);
        // 273K = 0°C
        expect(convertTemperature(273)).toBe(0);
        // 373K = 100°C
        expect(convertTemperature(373)).toBe(100);
    });

    it('returns Celsius values as-is when <= 200', () => {
        expect(convertTemperature(45)).toBe(45);
        expect(convertTemperature(70)).toBe(70);
        expect(convertTemperature(200)).toBe(200);
    });

    it('handles edge case at boundary (201)', () => {
        // 201K would be -72°C, which is below absolute zero being unrealistic
        // but the function treats > 200 as Kelvin
        expect(convertTemperature(201)).toBe(201 - 273);
    });
});

describe('buildSample', () => {
    it('builds sample with model and serial', () => {
        const device: NvmeDeviceInfo = {
            name: '/dev/nvme0',
            model: 'Samsung 970 EVO Plus',
            serial: 'S4EWNX0R123456',
        };

        const sample = buildSample(device, 42);

        expect(sample.kind).toBe('temp');
        expect(sample.id).toBe('/dev/nvme0:temperature');
        expect(sample.label).toBe('Samsung 970 EVO Plus #S4EWNX0R123456');
        expect(sample.value).toBe(42);
        expect(sample.unit).toBe('°C');
        expect(sample.chipId).toBe('/dev/nvme0');
        expect(sample.chipLabel).toBe('Samsung 970 EVO Plus (/dev/nvme0)');
        expect(sample.chipName).toBe('Samsung 970 EVO Plus');
    });

    it('builds sample without serial', () => {
        const device: NvmeDeviceInfo = {
            name: '/dev/nvme1',
            model: 'WD Black SN850',
        };

        const sample = buildSample(device, 55);

        expect(sample.label).toBe('WD Black SN850');
        expect(sample.chipLabel).toBe('WD Black SN850 (/dev/nvme1)');
    });

    it('builds sample without model', () => {
        const device: NvmeDeviceInfo = {
            name: '/dev/nvme2',
        };

        const sample = buildSample(device, 38);

        expect(sample.label).toBe('NVMe device');
        expect(sample.chipLabel).toBe('/dev/nvme2');
        expect(sample.chipName).toBe('/dev/nvme2');
    });

    it('builds sample without model but with serial', () => {
        const device: NvmeDeviceInfo = {
            name: '/dev/nvme3',
            serial: 'ABC123',
        };

        const sample = buildSample(device, 40);

        expect(sample.label).toBe('NVMe device #ABC123');
    });
});
