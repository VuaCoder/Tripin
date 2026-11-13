import { beforeEach, vi } from 'vitest';

// jsdom ships HTMLDialogElement without the modal methods; the app's dialogs call them on mount.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

// jsdom has no layout observer; Ant Design uses it when opening select popups.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
