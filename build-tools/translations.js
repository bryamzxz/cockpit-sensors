import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import gettextParser from 'gettext-parser';
import Jed from 'jed';

const DEFAULT_WRAPPER = 'cockpit.locale(PO_DATA);';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);
const PLURAL_EXPRESSION = /nplurals=[1-9]; plural=([^;]*);?$/;

function canonicalizeLanguageCode(code) {
    if (!code)
        return null;

    const normalized = code.replace(/-/g, '_');
    const segments = normalized.split('_').filter(Boolean);
    if (segments.length === 0)
        return null;

    const [base, ...rest] = segments;
    const canonicalRest = rest.map(segment => {
        if (segment.length === 2)
            return segment.toUpperCase();
        if (segment.length === 4)
            return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        return segment.toLowerCase();
    });

    return [base.toLowerCase(), ...canonicalRest].join('_');
}

function validatePluralForms(statement) {
    try {
        Jed.PF.parse(statement);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid plural forms expression: ${message}`);
    }
}

function createPluralFunction(statement) {
    validatePluralForms(statement);
    const match = PLURAL_EXPRESSION.exec(statement);
    if (!match)
        throw new Error(`Invalid plural forms expression: ${statement}`);

    return `(n) => ${match[1]}`;
}

async function listPoFiles(poDirectory) {
    try {
        const entries = await fs.readdir(poDirectory, { withFileTypes: true });
        return entries
                .filter(entry => entry.isFile() && entry.name.endsWith('.po'))
                .map(entry => path.join(poDirectory, entry.name));
    } catch (error) {
        if ((error instanceof Error) && 'code' in error && error.code === 'ENOENT')
            return [];

        throw error;
    }
}

async function readPoFile(filePath) {
    const rawContents = await fs.readFile(filePath, 'utf8');
    const sanitized = rawContents
            .split('\n')
            .filter(line => !line.startsWith('#~'))
            .join('\n');

    const parsed = gettextParser.po.parse(sanitized, { defaultCharset: 'utf8', validation: true });
    delete parsed.translations[''][''];
    return parsed;
}

function shouldIncludeTranslation({ references, subdir, srcDirectory }) {
    const subdirPrefix = subdir ? `pkg/${subdir}` : 'pkg/';
    return references.some(ref =>
        ref.startsWith(subdirPrefix) ||
        ref.startsWith(srcDirectory) ||
        ref.startsWith('pkg/lib')
    );
}

function createTranslationChunks({ parsed, subdir, srcDirectory, filter }) {
    const pluralForms = parsed.headers['Plural-Forms'];
    if (!pluralForms)
        throw new Error(`Missing Plural-Forms header in ${parsed.headers.Language}`);

    const languageDirection = RTL_LANGUAGES.has(parsed.headers.Language) ? 'rtl' : 'ltr';
    const chunks = [
        '{\n',
        ' "": {\n',
        `  "plural-forms": ${createPluralFunction(pluralForms)},\n`,
        `  "language": "${parsed.headers.Language}",\n`,
        `  "language-direction": "${languageDirection}"\n`,
        ' }'
    ];

    for (const [contextKey, contextTranslations] of Object.entries(parsed.translations)) {
        const contextPrefix = contextKey ? `${contextKey}\u0004` : '';

        for (const [messageId, translation] of Object.entries(contextTranslations)) {
            if (messageId === '')
                continue;

            const references = translation.comments?.reference?.split(/\s/)?.filter(Boolean) ?? [];
            if (references.length === 0)
                continue;

            if (!shouldIncludeTranslation({ references, subdir, srcDirectory }))
                continue;

            if (translation.comments?.flag?.match(/\bfuzzy\b/))
                continue;

            if (!references.some(filter))
                continue;

            const key = JSON.stringify(`${contextPrefix}${messageId}`);
            chunks.push(`,\n ${key}: [\n  null`);
            for (const value of translation.msgstr)
                chunks.push(`,\n  ${JSON.stringify(value)}`);
            chunks.push('\n ]');
        }
    }

    chunks.push('\n}');
    return chunks.join('');
}

async function buildTranslationFiles({ poPath, subdir, outdir, srcDirectory, wrapper }) {
    const parsed = await readPoFile(poPath);
    const languageCode = canonicalizeLanguageCode(path.basename(poPath).slice(0, -3));
    if (!languageCode)
        throw new Error(`Unable to determine language code for ${poPath}`);

    const tasks = [
        { filename: `po.${languageCode}.js`, filter: ref => !ref.includes('manifest.json') },
        { filename: `po.manifest.${languageCode}.js`, filter: ref => ref.includes('manifest.json') },
    ];

    await Promise.all(tasks.map(async ({ filename, filter }) => {
        const contents = createTranslationChunks({ parsed, subdir, srcDirectory, filter });
        const targetDir = subdir ? path.join(outdir, subdir) : outdir;
        await fs.mkdir(targetDir, { recursive: true });
        const targetPath = path.join(targetDir, filename);
        const wrapperTemplate = typeof wrapper === 'function' ? wrapper(subdir) : DEFAULT_WRAPPER;
        await fs.writeFile(targetPath, wrapperTemplate.replace('PO_DATA', contents) + '\n');
    }));

    return languageCode;
}

function createLoaderSource(languages) {
    const sortedLanguages = Array.from(languages).sort((a, b) => a.localeCompare(b));
    const languageLiteral = `[${sortedLanguages.map(code => JSON.stringify(code)).join(', ')}]`;

    const lines = [
        "'use strict';",
        "(() => {",
        `    const supportedLanguages = new Set(${languageLiteral});`,
        "    if (supportedLanguages.size === 0)",
        "        return;",
        "",
        "    function canonicalize(tag) {",
        "        if (!tag)",
        "            return null;",
        "",
        "        const normalized = tag.replace(/-/g, '_');",
        "        const parts = normalized.split('_').filter(Boolean);",
        "        if (parts.length === 0)",
        "            return null;",
        "",
        "        const [base, ...rest] = parts;",
        "        const formatted = rest.map(part => {",
        "            if (part.length === 2)",
        "                return part.toUpperCase();",
        "            if (part.length === 4)",
        "                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();",
        "            return part.toLowerCase();",
        "        });",
        "",
        "        return [base.toLowerCase(), ...formatted].join('_');",
        "    }",
        "",
        "    function pick(preferences) {",
        "        for (const preference of preferences) {",
        "            let candidate = canonicalize(preference);",
        "            while (candidate) {",
        "                if (supportedLanguages.has(candidate))",
        "                    return candidate;",
        "                const index = candidate.lastIndexOf('_');",
        "                if (index === -1)",
        "                    break;",
        "                candidate = candidate.slice(0, index);",
        "            }",
        "        }",
        "",
        "        return null;",
        "    }",
        "",
        "    const preferences = [];",
        "    const seen = new Set();",
        "",
        "    function addPreference(value) {",
        "        if (!value)",
        "            return;",
        "",
        "        const trimmed = String(value).trim();",
        "        if (!trimmed)",
        "            return;",
        "",
        "        const key = trimmed.toLowerCase();",
        "        if (seen.has(key))",
        "            return;",
        "",
        "        seen.add(key);",
        "        preferences.push(trimmed);",
        "    }",
        "",
        "    if (window.cockpit && window.cockpit.language)",
        "        addPreference(window.cockpit.language);",
        "",
        "    const nav = window.navigator;",
        "    if (nav) {",
        "        if (Array.isArray(nav.languages))",
        "            for (const language of nav.languages)",
        "                addPreference(language);",
        "        addPreference(nav.language);",
        "        addPreference(nav.userLanguage);",
        "    }",
        "",
        "    if (document.documentElement && document.documentElement.lang)",
        "        addPreference(document.documentElement.lang);",
        "",
        "    addPreference('en');",
        "",
        "    const selected = pick(preferences);",
        "    if (!selected)",
        "        return;",
        "",
        "    const current = document.currentScript;",
        "    const script = document.createElement('script');",
        "    script.type = 'text/javascript';",
        "    script.async = false;",
        "",
        "    if (current) {",
        "        const source = new URL('po.' + selected + '.js', current.src);",
        "        script.src = source.toString();",
        "        if (current.crossOrigin)",
        "            script.crossOrigin = current.crossOrigin;",
        "        if (current.parentNode)",
        "            current.parentNode.insertBefore(script, current.nextSibling);",
        "        else",
        "            (document.head || document.documentElement).appendChild(script);",
        "    } else {",
        "        script.src = 'po.' + selected + '.js';",
        "        (document.head || document.documentElement).appendChild(script);",
        "    }",
        "})();",
        "",
    ];

    return lines.join('\n');
}

async function writeLoader({ outdir, subdir, languages }) {
    const targetDir = subdir ? path.join(outdir, subdir) : outdir;
    await fs.mkdir(targetDir, { recursive: true });
    const loaderSource = createLoaderSource(languages);
    await fs.writeFile(path.join(targetDir, 'po.js'), loaderSource);
}

async function generateTranslations({ poDirectory, subdirs, outdir, srcDirectory, wrapper }) {
    const poFiles = await listPoFiles(poDirectory);
    const languagesBySubdir = new Map(subdirs.map(subdir => [subdir, new Set()]));

    await Promise.all(poFiles.flatMap(poPath =>
        subdirs.map(async subdir => {
            const languageCode = await buildTranslationFiles({ poPath, subdir, outdir, srcDirectory, wrapper });
            languagesBySubdir.get(subdir)?.add(languageCode);
        })
    ));

    await Promise.all(subdirs.map(subdir =>
        writeLoader({ outdir, subdir, languages: languagesBySubdir.get(subdir) ?? new Set() })
    ));
}

export function translationsPlugin({
    poDirectory = path.resolve(process.env.SRCDIR ?? '.', 'po'),
    srcDirectory = 'src',
    subdirs = [''],
    wrapper,
} = {}) {
    return {
        name: 'translations',
        setup(build) {
            build.onEnd(async result => {
                if (result.errors.length > 0)
                    return;

                const outdir = build.initialOptions.outdir ?? 'dist';
                await generateTranslations({ poDirectory, subdirs, outdir, srcDirectory, wrapper });
            });
        },
    };
}
