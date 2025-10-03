import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import gettextParser from 'gettext-parser';
import Jed from 'jed';

const DEFAULT_WRAPPER = 'cockpit.locale(PO_DATA);';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);
const PLURAL_EXPRESSION = /nplurals=[1-9]; plural=([^;]*);?$/;

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
    const languageCode = path.basename(poPath).slice(0, -3);

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
}

async function generateTranslations({ poDirectory, subdirs, outdir, srcDirectory, wrapper }) {
    const poFiles = await listPoFiles(poDirectory);
    await Promise.all(poFiles.flatMap(poPath =>
        subdirs.map(subdir => buildTranslationFiles({ poPath, subdir, outdir, srcDirectory, wrapper }))
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
