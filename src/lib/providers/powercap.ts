import { getCockpit } from '../../utils/cockpit';
import type { Cockpit } from '../../types/cockpit';
import { Provider, ProviderContext, ProviderError, SensorSample, SENSOR_KIND_TO_UNIT } from './types';
import {
    readFile as readFileUtil,
    readNumberFile as readNumberFileUtil,
    spawnText as spawnTextUtil,
    POLLING_INTERVALS,
} from './utils';

const PROVIDER_NAME = 'powercap';
const POWERCAP_ROOT = '/sys/class/powercap';
const MICRO_UNITS_PER_WATT = 1_000_000;
const RAPL_FIND_EXPRESSION = '\\( -name "*-rapl:*" -o -name "rapl:*" \\)';

interface RaplDomainState {
    id: string;
    path: string;
    label: string;
    powerPath?: string;
    energyPath?: string;
    maxEnergy?: number;
    lastEnergy?: number;
    lastTimestamp?: number;
    cachedPower?: number;
}

/** Wrapper for readFile with powercap provider name */
const readFile = (cockpitInstance: Cockpit, path: string): Promise<string | null> =>
    readFileUtil(cockpitInstance, path, PROVIDER_NAME);

/** Wrapper for readNumberFile with powercap provider name */
const readNumberFile = (cockpitInstance: Cockpit, path: string | undefined): Promise<number | undefined> =>
    readNumberFileUtil(cockpitInstance, path, PROVIDER_NAME);

/** Wrapper for spawnText with powercap provider name */
const spawnText = (cockpitInstance: Cockpit, command: string[] | string): Promise<string> =>
    spawnTextUtil(cockpitInstance, command, PROVIDER_NAME);

const buildSample = (domain: RaplDomainState, watts: number): SensorSample => ({
    kind: 'power',
    id: `${domain.id}:power`,
    label: domain.label,
    value: watts,
    unit: SENSOR_KIND_TO_UNIT.power,
    chipId: domain.id,
    chipLabel: domain.label,
    chipName: domain.label,
    category: 'power',
});

const readWatts = async (cockpitInstance: Cockpit, domain: RaplDomainState, now: number): Promise<number | undefined> => {
    if (domain.powerPath) {
        const microwatts = await readNumberFile(cockpitInstance, domain.powerPath);
        if (typeof microwatts === 'number') {
            domain.cachedPower = microwatts / MICRO_UNITS_PER_WATT;
            return domain.cachedPower;
        }

        if (typeof domain.cachedPower === 'number') {
            return domain.cachedPower;
        }
    }

    if (!domain.energyPath) {
        return undefined;
    }

    const energy = await readNumberFile(cockpitInstance, domain.energyPath);
    if (typeof energy !== 'number') {
        domain.lastEnergy = undefined;
        domain.lastTimestamp = undefined;
        return undefined;
    }

    if (typeof domain.lastEnergy !== 'number' || typeof domain.lastTimestamp !== 'number') {
        domain.lastEnergy = energy;
        domain.lastTimestamp = now;
        return undefined;
    }

    const elapsedMs = now - domain.lastTimestamp;
    if (elapsedMs <= 0) {
        domain.lastEnergy = energy;
        domain.lastTimestamp = now;
        return undefined;
    }

    let deltaEnergy = energy - domain.lastEnergy;
    if (deltaEnergy < 0 && typeof domain.maxEnergy === 'number') {
        deltaEnergy += domain.maxEnergy;
    }

    if (deltaEnergy < 0) {
        domain.lastEnergy = energy;
        domain.lastTimestamp = now;
        return undefined;
    }

    domain.lastEnergy = energy;
    domain.lastTimestamp = now;

    return deltaEnergy / MICRO_UNITS_PER_WATT / (elapsedMs / 1000);
};

const listRaplDomains = async (cockpitInstance: Cockpit): Promise<RaplDomainState[]> => {
    const now = Date.now();
    const rawList = await spawnText(cockpitInstance, [
        'sh',
        '-c',
      
        `find ${POWERCAP_ROOT} -maxdepth 1 \\( -type d -o -type l \\) ${RAPL_FIND_EXPRESSION} 2>/dev/null`,

    ]).catch(error => {
        if (error instanceof ProviderError && error.code === 'unexpected') {
            return '';
        }

        throw error;
    });

    const paths = rawList
            .split('\n')
            .map(entry => entry.trim())
            .filter(Boolean);

    const domains: RaplDomainState[] = [];

    for (const path of paths) {
        const id = path.split('/').pop() ?? path;
        const label = (await readFile(cockpitInstance, `${path}/name`))?.trim() || id;
        const energy = await readNumberFile(cockpitInstance, `${path}/energy_uj`);
        const powerValue = await readNumberFile(cockpitInstance, `${path}/power_uw`);
        const maxEnergy = await readNumberFile(cockpitInstance, `${path}/max_energy_range_uj`);

        if (typeof energy !== 'number' && typeof powerValue !== 'number') {
            continue;
        }

        domains.push({
            id,
            path,
            label,
            energyPath: typeof energy === 'number' ? `${path}/energy_uj` : undefined,
            powerPath: typeof powerValue === 'number' ? `${path}/power_uw` : undefined,
            maxEnergy,
            lastEnergy: typeof energy === 'number' ? energy : undefined,
            lastTimestamp: typeof energy === 'number' ? now : undefined,
            cachedPower: typeof powerValue === 'number' ? powerValue / MICRO_UNITS_PER_WATT : undefined,
        });
    }

    return domains;
};

export class PowercapProvider implements Provider {
    readonly name = 'powercap';
    private intervalHandle: number | undefined;

    async isAvailable(): Promise<boolean> {
        const cockpitInstance = getCockpit();
        const output = await spawnText(cockpitInstance, [
            'sh',
            '-c',

            `find ${POWERCAP_ROOT} -maxdepth 1 \\( -type d -o -type l \\) ${RAPL_FIND_EXPRESSION} -print -quit 2>/dev/null`,

        ]).catch(error => {
            if (error instanceof ProviderError && error.code === 'unexpected') {
                return '';
            }

            throw error;
        });

        return output.trim().length > 0;
    }

    start(onChange: (samples: SensorSample[]) => void, context?: ProviderContext) {
        const cockpitInstance = getCockpit();
        let disposed = false;
        let domains: RaplDomainState[] = [];

        const pollMs = Math.max(context?.refreshIntervalMs ?? POLLING_INTERVALS.POWERCAP, POLLING_INTERVALS.MINIMUM);

        const collect = async () => {
            try {
                const now = Date.now();
                const samples: SensorSample[] = [];

                for (const domain of domains) {
                    const watts = await readWatts(cockpitInstance, domain, now);
                    if (typeof watts === 'number') {
                        samples.push(buildSample(domain, watts));
                    }
                }

                onChange(samples);
            } catch (error) {
                const providerError =
                    error instanceof ProviderError
                        ? error
                        : new ProviderError((error as Error).message || 'powercap failure', 'unexpected', {
                            cause: error instanceof Error ? error : undefined,
                        });
                context?.onError?.(providerError);
            }
        };

        const bootstrap = async () => {
            try {
                domains = await listRaplDomains(cockpitInstance);
                if (disposed) {
                    return;
                }

                if (domains.length === 0) {
                    onChange([]);
                    return;
                }

                await collect();
                if (disposed) {
                    return;
                }

                this.intervalHandle = window.setInterval(() => void collect(), pollMs);
            } catch (error) {
                const providerError =
                    error instanceof ProviderError
                        ? error
                        : new ProviderError((error as Error).message || 'powercap failure', 'unexpected', {
                            cause: error instanceof Error ? error : undefined,
                        });
                context?.onError?.(providerError);
            }
        };

        void bootstrap();

        return () => {
            disposed = true;
            if (this.intervalHandle) {
                window.clearInterval(this.intervalHandle);
            }
        };
    }
}

export const powercapProvider = new PowercapProvider();
