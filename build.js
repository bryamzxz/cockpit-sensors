#!/usr/bin/env node

import fs from 'node:fs/promises';
import nodeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';
import * as sass from 'sass';
import { ArgumentParser } from 'argparse';

import { cleanup } from './build-tools/cleanup.js';
import { translationsPlugin } from './build-tools/translations.js';

const production = process.env.NODE_ENV === 'production';
const outdir = 'dist';
const mockFlagValue = process.env.VITE_MOCK ?? '';

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
    return {
        name: 'sass-loader',
        setup(build) {
            build.onLoad({ filter: /\.scss$/ }, async args => {
                const resolvedLoadPaths = [
                    path.dirname(args.path),
                    ...loadPaths.map(loadPath => path.isAbsolute(loadPath) ? loadPath : path.resolve(loadPath)),
                ];

                const result = await sass.compileAsync(args.path, {
                    loadPaths: resolvedLoadPaths,
                    importers: [new sass.NodePackageImporter()],
                    quietDeps: true,
                    sourceMap,
                    style,
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

const mockFlagLiteral = JSON.stringify(mockFlagValue);
const importMetaEnvGlobalRef = '__COCKPIT_SENSORS_IMPORT_META_ENV__';
const banner = `(() => {\n    const value = ${mockFlagLiteral};\n    const env = { VITE_MOCK: value };\n    try {\n        if (typeof globalThis !== 'undefined') {\n            globalThis.VITE_MOCK = value;\n            globalThis.${importMetaEnvGlobalRef} = env;\n        }\n    } catch (error) {\n        /* noop: non-browser environments may block global access */\n    }\n})();`;

const context = await esbuild.context({
    ...(!production ? { sourcemap: 'linked' } : {}),
    bundle: true,
    entryPoints: ['./src/index.tsx'],
    external: ['cockpit', 'cockpit-dark-theme', '*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'],
    define: {
        'import.meta.env': `globalThis.${importMetaEnvGlobalRef}`,
    },
    legalComments: 'external',
    loader: { '.js': 'jsx', '.scss': 'css', '.ts': 'ts', '.tsx': 'tsx' },
    banner: {
        js: banner,
    },
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
        translationsPlugin(),
        notifyEndPlugin(),
    ],
});

try {
    await context.rebuild();
} catch (error) {
    console.error('Initial build failed:', error);
    if (!args.watch)
        process.exit(1);
}

if (args.watch) {
    const on_change = async changedPath => {
        console.log('change detected:', changedPath);
        await context.cancel();

        try {
            await context.rebuild();
        } catch (error) {
            console.error('Rebuild failed:', error);
        }
    };

    watch_dirs('src', on_change);
    watch_dirs('vendor', on_change);
    watch_dirs('po', on_change);

    await new Promise(() => {});
}

context.dispose();
