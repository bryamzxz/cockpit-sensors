import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
            cockpit: resolve(__dirname, 'src/__mocks__/cockpit.ts'),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: [resolve(__dirname, 'src/__tests__/setup.ts')],
        coverage: {
            // Gate slightly below current coverage (~64% stmts / 46% branch)
            // so regressions fail CI while leaving headroom for refactors.
            thresholds: {
                statements: 60,
                branches: 42,
                functions: 58,
                lines: 60,
            },
        },
    },
});
