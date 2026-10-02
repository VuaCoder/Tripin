import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMaintenanceJobs, type MaintenanceTask } from '../maintenance';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const task = (run: MaintenanceTask['run'], intervalMs = 1000): MaintenanceTask => ({ name: 't', intervalMs, run });

describe('startMaintenanceJobs', () => {
  it('runs each task on its own interval and stops cleanly', async () => {
    const fast = vi.fn(async () => 0);
    const slow = vi.fn(async () => 0);
    const stop = startMaintenanceJobs([task(fast, 1000), task(slow, 5000)]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fast).toHaveBeenCalledTimes(5);
    expect(slow).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fast).toHaveBeenCalledTimes(5);
  });

  it('never overlaps a task with itself while a run is still in progress', async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const stop = startMaintenanceJobs([task(run, 1000)]);
    await vi.advanceTimersByTimeAsync(3500);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it('survives a failing run and tries again on the next tick', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(3);
    const stop = startMaintenanceJobs([task(run, 1000)]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });
});
