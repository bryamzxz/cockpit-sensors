#!/usr/bin/env node

import fs from 'node:fs/promises';
import nodeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import esbuild from 'esbuild';
import * as sass from 'sass';
import { ArgumentParser } from 'argparse';

import { cleanup } from './build-tools/cleanup.js';

const production = process.env.NODE_ENV === 'production';
const outdir = 'dist';

const parser = new ArgumentParser();
parser.add_argument('-w', '--watch', { action: 'store_true', help: 'Enable watch mode', default: process.env.ESBUILD_WATCH === 'true' });
const args = parser.parse_args();

function notifyEndPlugin() {
    return {
        name: 'notify-end',
        setup(build) {
            let startTime;

            build.onStart(() => {
                startTime = new Date();
            });

            build.onEnd(() => {
                const endTime = new Date();
                const timeStamp = endTime.toTimeString().split(' ')[0];
                console.log(`${timeStamp}: Build finished in ${endTime - startTime} ms`);
            });
        }
    };
}

function staticAssetsPlugin({ outdir: assetsOutdir, assets }) {
    return {
        name: 'static-assets',
        setup(build) {
            build.onEnd(async result => {
                if (result.errors.length > 0)
                    return;

                await fs.mkdir(assetsOutdir, { recursive: true });
                await Promise.all(assets.map(async asset => {
                    const destination = path.join(assetsOutdir, asset.to);
                    await fs.mkdir(path.dirname(destination), { recursive: true });
                    await fs.copyFile(asset.from, destination);
                }));
            });
        }
    };
}

function sassLoaderPlugin({ loadPaths = [], sourceMap = false, style = 'expanded' } = {}) {
    const resolutionCache = new Map();

    async function fileExists(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    async function directoryExists(directoryPath) {
        try {
            const stats = await fs.stat(directoryPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async function resolveImport(candidate) {
        if (resolutionCache.has(candidate))
            return resolutionCache.get(candidate);

        let resolved = null;
        const extension = path.extname(candidate);

        if (extension) {
            if (await fileExists(candidate)) {
                resolved = candidate;
            } else {
                const underscored = path.join(path.dirname(candidate), `_${path.basename(candidate)}`);
                if (await fileExists(underscored))
                    resolved = underscored;
            }
        } else {
            if (await fileExists(candidate)) {
                resolved = candidate;
            } else {
                const extensions = ['.scss', '.sass', '.css'];

                for (const ext of extensions) {
                    resolved = await resolveImport(candidate + ext);
                    if (resolved)
                        break;
                }

                if (!resolved && await directoryExists(candidate))
                    resolved = await resolveImport(path.join(candidate, 'index'));
            }
        }

        resolutionCache.set(candidate, resolved);
        return resolved;
    }

    function createImporter(resolvedLoadPaths) {
        return {
            async canonicalize(url, { containingUrl }) {
                if (url.startsWith('sass:'))
                    return null;

                const cleanUrl = url.startsWith('~') ? url.slice(1) : url;
                const baseDir = containingUrl && containingUrl.protocol === 'file:'
                    ? path.dirname(fileURLToPath(containingUrl))
                    : process.cwd();
                const candidates = new Set();

                if (cleanUrl.startsWith('file://')) {
                    candidates.add(fileURLToPath(cleanUrl));
                } else if (path.isAbsolute(cleanUrl)) {
                    candidates.add(cleanUrl);
                } else {
                    candidates.add(path.resolve(baseDir, cleanUrl));

                    for (const loadPath of resolvedLoadPaths)
                        candidates.add(path.join(loadPath, cleanUrl));
                }

                for (const candidate of candidates) {
                    const resolved = await resolveImport(candidate);
                    if (resolved)
                        return pathToFileURL(resolved);
                }

                return null;
            },
            async load(canonicalUrl) {
                if (canonicalUrl.protocol !== 'file:')
                    return null;

                const filePath = fileURLToPath(canonicalUrl);
                const contents = await fs.readFile(filePath, 'utf8');

                return {
                    contents,
                    syntax: 'scss',
                };
            },
        };
    }

    return {
        name: 'sass-loader',
        setup(build) {
            build.onStart(() => resolutionCache.clear());

            build.onLoad({ filter: /\.scss$/ }, async args => {
                const resolvedLoadPaths = [
                    path.dirname(args.path),
                    ...loadPaths.map(loadPath => path.isAbsolute(loadPath) ? loadPath : path.resolve(loadPath)),
                ];

                const result = await sass.compileAsync(args.path, {
                    loadPaths: resolvedLoadPaths,
                    quietDeps: true,
                    sourceMap,
                    style,
                    importers: [createImporter(resolvedLoadPaths)],
                });

                const watchFiles = result.loadedUrls?.map(url => fileURLToPath(url)) ?? [];

                return {
                    contents: result.css,
                    loader: 'css',
                    resolveDir: path.dirname(args.path),
                    watchFiles,
                };
            });
        }
    };
}

// similar to fs.watch(), but recursively watches all subdirectories
function watch_dirs(dir, on_change) {
    const callback = (ev, dir, fname) => {
        // only listen for "change" events, as renames are noisy
        // ignore hidden files
        const isHidden = /^\./.test(fname);
        if (ev !== 'change' || isHidden) {
            return;
        }
        on_change(path.join(dir, fname));
    };

    nodeFs.watch(dir, {}, (ev, filePath) => callback(ev, dir, filePath));

    const d = nodeFs.opendirSync(dir);
    let dirent;

    while ((dirent = d.readSync()) !== null) {
        if (dirent.isDirectory())
            watch_dirs(path.join(dir, dirent.name), on_change);
    }
    d.closeSync();
}

const context = await esbuild.context({
    ...(!production ? { sourcemap: 'linked' } : {}),
    bundle: true,
    entryPoints: ['./src/index.js'],
    external: ['cockpit', 'cockpit-dark-theme', '*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'],
    legalComments: 'external',
    loader: { '.js': 'jsx', '.scss': 'css' },
    minify: production,
    outdir,
    target: ['es2020'],
    plugins: [
        cleanup({ path: outdir }),
        sassLoaderPlugin({
            loadPaths: ['pkg/lib', 'pkg/lib/node_modules', 'node_modules'],
            sourceMap: !production,
            style: production ? 'compressed' : 'expanded',
        }),
        staticAssetsPlugin({
            outdir,
            assets: [
                { from: 'src/manifest.json', to: 'manifest.json' },
                { from: 'src/index.html', to: 'index.html' },
            ],
        }),
        notifyEndPlugin(),
    ],
});

try {
    await context.rebuild();
} catch (e) {
    if (!args.watch)
        process.exit(1);
}

if (args.watch) {
    const on_change = async changedPath => {
        console.log('change detected:', changedPath);
        await context.cancel();

        try {
            await context.rebuild();
        } catch (e) {}
    };

    watch_dirs('src', on_change);

    await new Promise(() => {});
}

context.dispose();
