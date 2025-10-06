import nodeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, '..');

function directoryExists(candidate) {
    if (!candidate)
        return false;

    try {
        return nodeFs.statSync(candidate).isDirectory();
    } catch {
        return false;
    }
}

function uniqueExistingPaths(candidates) {
    const seen = new Set();

    return candidates.reduce((paths, candidate) => {
        if (!candidate)
            return paths;

        const resolved = path.resolve(candidate);
        if (seen.has(resolved))
            return paths;

        if (!directoryExists(resolved))
            return paths;

        seen.add(resolved);
        paths.push(resolved);
        return paths;
    }, []);
}

export function resolveCockpitLibraryPaths({ baseDir = projectRoot } = {}) {
    const envDir = process.env.COCKPIT_DIR ? path.resolve(process.env.COCKPIT_DIR) : undefined;

    const candidates = [
        envDir,
        envDir ? path.join(envDir, 'pkg/lib') : undefined,
        path.resolve(baseDir, '../cockpit/pkg/lib'),
        path.resolve(baseDir, 'pkg/lib'),
    ];

    return uniqueExistingPaths(candidates);
}

export function getDefaultSassPathEntries({ baseDir = projectRoot } = {}) {
    const cockpitLibs = resolveCockpitLibraryPaths({ baseDir });
    const fallbackPkgLib = path.resolve(baseDir, 'pkg/lib');
    const nodeModulesDir = path.resolve(baseDir, 'node_modules');

    const entries = uniqueExistingPaths([
        nodeModulesDir,
        fallbackPkgLib,
        ...cockpitLibs,
    ]);

    return entries;
}

export function ensureSassPath({ baseDir = projectRoot } = {}) {
    if (!process.env.SASS_PATH || process.env.SASS_PATH.trim() === '') {
        const includePaths = getDefaultSassPathEntries({ baseDir });
        if (includePaths.length > 0)
            process.env.SASS_PATH = includePaths.join(path.delimiter);
    }

    return process.env.SASS_PATH;
}

ensureSassPath({ baseDir: projectRoot });
