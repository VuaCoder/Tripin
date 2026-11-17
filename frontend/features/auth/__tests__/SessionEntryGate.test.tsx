import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import reducer, { clearCredentials, setCredentials, sessionRestoreUnavailable } from '../store/authSlice';
import type { UserProfile } from '../types';
import { SessionEntryGate } from '../components/SessionEntryGate';
import { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { AuthBackground } from '../components/AuthBackground';
const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));
afterEach(() => { cleanup(); nav.replace.mockReset(); localStorage.clear(); sessionStorage.clear(); });
function mount(target?: string) {
  const store = configureStore({ reducer: { auth: reducer } });
  render(<Provider store={store}><SessionEntryGate target={target}><p>Login form</p></SessionEntryGate></Provider>);
  return store;
}
describe('returning visitor entry', () => {
  it.each(['guest', 'authenticated', 'offline'] as const)('hydrates safely when bootstrap resolves to %s before the entry Suspense boundary hydrates', async result => {
    const store = configureStore({ reducer: { auth: reducer } });
    const tree = <Provider store={store}><Suspense fallback={<p>Loading page</p>}><SessionEntryGate>
      <div><AuthBackground /><p>Login form</p></div>
    </SessionEntryGate></Suspense></Provider>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    if (result === 'guest') store.dispatch(clearCredentials());
    else if (result === 'offline') store.dispatch(sessionRestoreUnavailable());
    else store.dispatch(setCredentials({ user: { id: 'u', role: 'TRAVELER' } as UserProfile, accessToken: 'token' }));
    const errors: unknown[] = [];
    let root: Root | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: error => errors.push(error) }); });
      expect(errors).toEqual([]);
      if (result === 'guest') expect(container.textContent).toContain('Login form');
      else {
        expect(container.textContent).not.toContain('Login form');
        if (result === 'authenticated') expect(nav.replace).toHaveBeenCalledWith('/home');
        else expect(container.querySelector('[role="alert"]')).toBeTruthy();
      }
    } finally {
      await act(async () => { root?.unmount(); });
      container.remove();
    }
  });
  it('waits for bootstrap then shows login only after a definitive guest result', () => {
    const store = mount();
    expect(screen.queryByText('Login form')).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => { store.dispatch(clearCredentials()); });
    expect(screen.getByText('Login form')).toBeTruthy();
  });
  it.each([['TRAVELER', '/home'], ['AGENCY', '/workplaces'], ['MODERATOR', '/moderator'], ['SUPER_ADMIN', '/super-admin'], ['TOUR_GUIDE', '/guide']] as const)('restores %s to %s without showing login', async (role, path) => {
    const store = mount();
    act(() => { store.dispatch(setCredentials({ user: { id: 'u', role } as UserProfile, accessToken: 'token' })); });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(path));
    expect(screen.queryByText('Login form')).toBeNull();
  });
  it.each([['/settings/history/booking', '/settings/history/booking'], ['//evil.test', '/home'], ['/login?next=/login', '/home']])('handles continuation %s', async (target, path) => {
    const store = mount(target);
    act(() => { store.dispatch(setCredentials({ user: { id: 'u', role: 'TRAVELER' } as UserProfile, accessToken: 'token' })); });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(path));
  });
  it('offers retry during an outage and does not route to login or home', () => {
    const store = mount();
    act(() => { store.dispatch(sessionRestoreUnavailable()); });
    expect(screen.getByRole('alert')).toBeTruthy();
    const retry = vi.fn(); window.addEventListener('tripri:retry-session', retry);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    window.removeEventListener('tripri:retry-session', retry);
  });
});
