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
    },
});
