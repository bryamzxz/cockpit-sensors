/**
 * Shared utilities for sensor data providers.
 *
 * This module centralizes common functionality used across multiple providers
 * to reduce code duplication and ensure consistent behavior.
 */

import type { Cockpit, CockpitSpawnError } from '../../types/cockpit';
import { ProviderError } from './types';

/**
 * Default polling intervals for different provider types.
 * These can be overridden by user preferences via ProviderContext.refreshIntervalMs
 */
export const POLLING_INTERVALS = {
    /** Default interval for most providers (5 seconds) */
    DEFAULT: 5000,
    /** Interval for NVMe SMART data which changes slowly (10 seconds) */
    NVME: 10000,
    /** Interval for power consumption data which benefits from frequent updates (3 seconds) */
    POWERCAP: 3000,
    /** Minimum allowed polling interval to prevent excessive system load */
    MINIMUM: 500,
    /** Throttle delay for batching rapid file watch events */
    THROTTLE: 500,
} as const;

/**
 * Checks if an error indicates a permission denied condition.
 *
 * This function handles various error formats that Cockpit may return
 * when permission is denied, including:
 * - access-denied problem code
 * - "permission denied" in error message
 *
 * @param error - The error to check, can be any type
 * @returns true if the error indicates permission was denied
 *
 * @example
 * ```ts
 * try {
 *   await cockpit.spawn(['command'], { superuser: 'require' });
 * } catch (error) {
 *   if (isPermissionDenied(error)) {
 *     throw new ProviderError('Permission denied', 'permission-denied');
 *   }
 * }
 * ```
 */
export const isPermissionDenied = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const spawnError = error as CockpitSpawnError & { message?: string };

    if (spawnError.problem === 'access-denied') {
        return true;
    }

    if (typeof spawnError.message === 'string' && /permission denied/i.test(spawnError.message)) {
        return true;
    }

    return false;
};

/**
 * Checks if an error indicates a command was not found.
 *
 * This function handles various error formats that indicate a missing command:
 * - not-found problem code
 * - exit status 127 (shell convention for command not found)
 * - "command not found" or "no such file or directory" in error message
 *
 * @param error - The error to check, can be any type
 * @returns true if the error indicates the command was not found
 *
 * @example
 * ```ts
 * try {
 *   await cockpit.spawn(['sensors', '-j'], { superuser: 'require' });
 * } catch (error) {
 *   if (isCommandMissing(error)) {
 *     throw new ProviderError('lm-sensors not available', 'unavailable');
 *   }
 * }
 * ```
 */
export const isCommandMissing = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const spawnError = error as CockpitSpawnError & { message?: string };

    if (spawnError.problem === 'not-found') {
        return true;
    }

    if (spawnError.exit_status === 127) {
        return true;
    }

    if (typeof spawnError.message === 'string') {
        return /command not found|no such file or directory/i.test(spawnError.message);
    }

    return false;
};

/**
 * Parses a string value into a number, handling edge cases safely.
 *
 * @param value - The string value to parse, may be null or undefined
 * @returns The parsed number, or undefined if parsing fails
 *
 * @example
 * ```ts
 * parseNumber('42.5')      // 42.5
 * parseNumber('  100  ')   // 100
 * parseNumber('')          // undefined
 * parseNumber(null)        // undefined
 * parseNumber('invalid')   // undefined
 * ```
 */
export const parseNumber = (value: string | null | undefined): number | undefined => {
    if (value == null) {
        return undefined;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Coerces a value to a number, handling both string and number inputs.
 *
 * @param value - The value to coerce, can be number, string, or any other type
 * @returns The coerced number, or undefined if coercion fails
 *
 * @example
 * ```ts
 * coerceNumber(42)         // 42
 * coerceNumber('42.5')     // 42.5
 * coerceNumber(Infinity)   // undefined
 * coerceNumber({})         // undefined
 * ```
 */
export const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
        return parseNumber(value);
    }

    return undefined;
};

/**
 * Type guard to check if a value is a plain object (Record).
 *
 * @param value - The value to check
 * @returns true if the value is a non-null, non-array object
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Trims whitespace from a string value.
 * Exported for consistent string handling across providers.
 */
export const trim = (value: string): string => value.trim();

/**
 * Reads the contents of a file using the Cockpit file API.
 *
 * @param cockpitInstance - The Cockpit instance to use
 * @param path - The path to the file to read
 * @param providerName - Name of the provider (for error messages)
 * @returns The file contents, or null if the file doesn't exist or can't be read
 * @throws {ProviderError} If permission is denied
 *
 * @example
 * ```ts
 * const content = await readFile(cockpit, '/sys/class/hwmon/hwmon0/name', 'hwmon');
 * if (content) {
 *   console.log('Chip name:', content.trim());
 * }
 * ```
 */
export const readFile = async (
    cockpitInstance: Cockpit,
    path: string,
    providerName: string,
): Promise<string | null> => {
    try {
        const handle = cockpitInstance.file(path, { superuser: 'require' });
        const content = await handle.read();
        handle.close();
        return content;
    } catch (error) {
        if (isPermissionDenied(error)) {
            throw new ProviderError(
                `Permission denied while reading ${providerName} data`,
                'permission-denied',
                { cause: error instanceof Error ? error : undefined },
            );
        }

        return null;
    }
};

/**
 * Reads a file and parses its contents as a number.
 *
 * @param cockpitInstance - The Cockpit instance to use
 * @param path - The path to the file to read (if undefined, returns undefined)
 * @param providerName - Name of the provider (for error messages)
 * @param scale - Optional scale factor to apply to the parsed value
 * @returns The parsed and scaled number, or undefined if parsing fails
 */
export const readNumberFile = async (
    cockpitInstance: Cockpit,
    path: string | undefined,
    providerName: string,
    scale = 1,
): Promise<number | undefined> => {
    if (!path) {
        return undefined;
    }

    const content = await readFile(cockpitInstance, path, providerName);
    const parsed = parseNumber(content ?? undefined);
    return typeof parsed === 'number' ? parsed * scale : undefined;
};

/**
 * Spawns a command using Cockpit and returns the output as text.
 *
 * @param cockpitInstance - The Cockpit instance to use
 * @param command - The command to execute (array or string)
 * @param providerName - Name of the provider (for error messages)
 * @returns The command output as a string
 * @throws {ProviderError} If permission is denied or the command fails
 *
 * @example
 * ```ts
 * const output = await spawnText(cockpit, ['ls', '/sys/class/hwmon'], 'hwmon');
 * const chips = output.split('\n').filter(Boolean);
 * ```
 */
export const spawnText = async (
    cockpitInstance: Cockpit,
    command: string[] | string,
    providerName: string,
): Promise<string> => {
    try {
        return await cockpitInstance.spawn(command, { superuser: 'require', err: 'out' });
    } catch (error) {
        if (isPermissionDenied(error)) {
            throw new ProviderError(
                `Permission denied while reading ${providerName} data`,
                'permission-denied',
                { cause: error instanceof Error ? error : undefined },
            );
        }

        throw new ProviderError(
            `Failed to read ${providerName} data from the system`,
            'unexpected',
            { cause: error instanceof Error ? error : undefined },
        );
    }
};

/**
 * Spawns a command and parses the JSON output.
 *
 * @param cockpitInstance - The Cockpit instance to use
 * @param command - The command to execute
 * @param providerName - Name of the provider (for error messages)
 * @param unavailableMessage - Message to use if command is not found
 * @returns The parsed JSON output
 * @throws {ProviderError} For permission denied, unavailable command, or unexpected errors
 */
export const spawnJson = async (
    cockpitInstance: Cockpit,
    command: string[],
    providerName: string,
    unavailableMessage: string,
): Promise<unknown> => {
    try {
        const output = await cockpitInstance.spawn(command, { superuser: 'require', err: 'out' });
        const trimmed = output.trim();
        if (!trimmed) {
            return {};
        }

        return JSON.parse(trimmed);
    } catch (error) {
        if (isPermissionDenied(error)) {
            throw new ProviderError(
                `Permission denied while executing ${providerName} command`,
                'permission-denied',
                { cause: error instanceof Error ? error : undefined },
            );
        }

        if (isCommandMissing(error)) {
            throw new ProviderError(unavailableMessage, 'unavailable', {
                cause: error instanceof Error ? error : undefined,
            });
        }

        throw new ProviderError(
            `Failed to execute ${providerName} command`,
            'unexpected',
            { cause: error instanceof Error ? error : undefined },
        );
    }
};
