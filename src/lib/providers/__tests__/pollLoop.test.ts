import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startPollingInterval } from '../utils';

describe('startPollingInterval', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('invokes poll on every interval tick', async () => {
        const poll = vi.fn(() => Promise.resolve());
        const cancel = startPollingInterval(poll, 1000);

        await vi.advanceTimersByTimeAsync(3000);
        expect(poll).toHaveBeenCalledTimes(3);

        cancel();
    });

    it('skips ticks while paused and resumes afterwards', async () => {
        let paused = false;
        const poll = vi.fn(() => Promise.resolve());
        const cancel = startPollingInterval(poll, 1000, () => paused);

        await vi.advanceTimersByTimeAsync(1000);
        expect(poll).toHaveBeenCalledTimes(1);

        paused = true;
        await vi.advanceTimersByTimeAsync(3000);
        expect(poll).toHaveBeenCalledTimes(1);

        paused = false;
        await vi.advanceTimersByTimeAsync(1000);
        expect(poll).toHaveBeenCalledTimes(2);

        cancel();
    });

    it('does not start a new poll while the previous one is in flight', async () => {
        const poll = vi.fn(
            () => new Promise<void>(resolve => setTimeout(resolve, 2500)),
        );
        const cancel = startPollingInterval(poll, 1000);

        // Ticks at 1s (starts, finishes at 3.5s), 2s + 3s (skipped), 4s (starts).
        await vi.advanceTimersByTimeAsync(4000);
        expect(poll).toHaveBeenCalledTimes(2);

        cancel();
    });

    it('stops polling after cancel', async () => {
        const poll = vi.fn(() => Promise.resolve());
        const cancel = startPollingInterval(poll, 1000);

        await vi.advanceTimersByTimeAsync(1000);
        cancel();
        await vi.advanceTimersByTimeAsync(3000);

        expect(poll).toHaveBeenCalledTimes(1);
    });
});
