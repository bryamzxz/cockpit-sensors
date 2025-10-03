import { rm } from 'node:fs/promises';

export function cleanup({ path = 'dist' } = {}) {
    let isCleaning = false;

    return {
        name: 'cleanup',
        setup(build) {
            build.onStart(async () => {
                if (isCleaning)
                    return;

                isCleaning = true;
                try {
                    await rm(path, { recursive: true, force: true });
                } finally {
                    isCleaning = false;
                }
            });
        }
    };
}
