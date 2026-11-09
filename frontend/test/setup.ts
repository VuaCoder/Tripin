import { beforeEach, vi } from 'vitest';

// jsdom has no layout observer; Ant Design uses it when opening select popups.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
