/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import { getCockpit } from '../../utils/cockpit';
import type { Cockpit } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorSample } from './types';
import {
    readFile as readFileUtil,
    readNumberFile as readNumberFileUtil,
    POLLING_INTERVALS,
} from './utils';

const PROVIDER_NAME = 'cpufreq';
const CPUFREQ_ROOT = '/sys/devices/system/cpu';
const AVAILABILITY_PROBE = `${CPUFREQ_ROOT}/cpu0/cpufreq/scaling_cur_freq`;

/**
 * sysfs reports frequency in kHz. Multiply by 0.001 to get MHz.
 */
const KHZ_TO_MHZ = 0.001;

/** Wrapper for readFile with cpufreq provider name */
const readCpufreqFile = (cockpitInstance: Cockpit, path: string): Promise<string | null> =>
    readFileUtil(cockpitInstance, path, PROVIDER_NAME);

/** Wrapper for readNumberFile with cpufreq provider name */
const readCpufreqNumber = (
    cockpitInstance: Cockpit,
    path: string | undefined,
    scale = 1,
): Promise<number | undefined> =>
    readNumberFileUtil(cockpitInstance, path, PROVIDER_NAME, scale);

/**
 * Discovers which CPU cores have cpufreq data available.
 *
 * Reads /sys/devices/system/cpu/cpu{N}/cpufreq/scaling_cur_freq sequentially
 * starting from cpu0 until a core is not found. On standard Linux configurations
 * cores are always numbered consecutively (cpu0, cpu1, ..., cpuN).
 *
 * @returns array of zero-indexed core numbers that have a readable scaling_cur_freq file
 */
export const discoverCoreIndices = async (cockpitInstance: Cockpit): Promise<number[]> => {
    const indices: number[] = [];
    let index = 0;

    while (true) {
        const path = `${CPUFREQ_ROOT}/cpu${index}/cpufreq/scaling_cur_freq`;
        const content = await readCpufreqFile(cockpitInstance, path);
        if (content === null) {
            break;
        }
        indices.push(index);
        index++;
    }

    return indices;
};

/**
 * Builds a SensorSample for a single CPU core frequency reading.
 *
 * @param coreIndex - Zero-based core index
 * @param freqMhz - Current frequency in MHz
 */
export const buildCoreSample = (coreIndex: number, freqMhz: number): SensorSample => ({
    kind: 'other',
    id: `cpu-cpufreq:core${coreIndex}`,
    label: `Core ${coreIndex}`,
    value: freqMhz,
    unit: 'MHz',
    chipId: 'cpu-cpufreq',
    chipLabel: 'CPU Frequency',
    chipName: 'CPU Frequency',
});

export class CpuFreqProvider implements Provider {
    readonly name = 'cpufreq';
    private intervalHandle: number | undefined;

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const content = await readCpufreqFile(cockpitInstance, AVAILABILITY_PROBE).catch(error => {
            if (error instanceof ProviderError && error.code === 'permission-denied') {
                throw error;
            }
            return null;
        });
        return content !== null;
    }

    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext) {
        const cockpitInstance = getCockpit();
        let disposed = false;
        let coreIndices: number[] = [];

        const poll = async () => {
            if (disposed) {
                return;
            }

            try {
                const samples: SensorSample[] = [];

                for (const index of coreIndices) {
                    const path = `${CPUFREQ_ROOT}/cpu${index}/cpufreq/scaling_cur_freq`;
                    const freqMhz = await readCpufreqNumber(cockpitInstance, path, KHZ_TO_MHZ);
                    if (typeof freqMhz === 'number') {
                        samples.push(buildCoreSample(index, freqMhz));
                    }
                }

                if (!disposed) {
                    onChange(samples);
                }
            } catch (error) {
                if (disposed) {
                    return;
                }

                const providerError =
                    error instanceof ProviderError
                        ? error
                        : new ProviderError(
                              (error as Error).message || 'cpufreq read failure',
                              'unexpected',
                              { cause: error instanceof Error ? error : undefined },
                          );
                context?.onError?.(providerError);
            }
        };

        const bootstrap = async () => {
            try {
                coreIndices = await discoverCoreIndices(cockpitInstance);
                if (disposed) {
                    return;
                }

                if (coreIndices.length === 0) {
                    onChange([]);
                    return;
                }

                await poll();
                if (disposed) {
                    return;
                }

                if (typeof window !== 'undefined') {
                    const interval = context?.refreshIntervalMs ?? POLLING_INTERVALS.CPUFREQ;
                    this.intervalHandle = window.setInterval(() => {
                        void poll();
                    }, interval);
                }
            } catch (error) {
                if (disposed) {
                    return;
                }

                const providerError =
                    error instanceof ProviderError
                        ? error
                        : new ProviderError(
                              (error as Error).message || 'cpufreq bootstrap failure',
                              'unexpected',
                              { cause: error instanceof Error ? error : undefined },
                          );
                context?.onError?.(providerError);
            }
        };

        void bootstrap();

        return () => {
            disposed = true;
            if (typeof window !== 'undefined' && this.intervalHandle) {
                window.clearInterval(this.intervalHandle);
                this.intervalHandle = undefined;
            }
        };
    }
}

export const cpufreqProvider = new CpuFreqProvider();
