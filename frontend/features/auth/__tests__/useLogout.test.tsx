import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import authReducer, { setCredentials } from '../store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { useLogout } from '../hooks/useLogout';

const nav=vi.hoisted(()=>({replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>nav}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();nav.replace.mockReset();localStorage.clear();sessionStorage.clear();});

describe('explicit logout',()=>{
  it.each([true,false])('clears the session and redirects before the logout request finishes (success=%s)',async success=>{
    let finish!: (response:Response)=>void;
    const fetchMock=vi.fn((_request:Request)=>new Promise<Response>(resolve=>{finish=resolve;}));
    vi.stubGlobal('fetch',fetchMock);
    const store=configureStore({reducer:{auth:authReducer,[baseApi.reducerPath]:baseApi.reducer},middleware:d=>d().concat(identityIsolation,baseApi.middleware)});
    store.dispatch(setCredentials({user:{id:'signed-in',role:'AGENCY'} as any,accessToken:'old-token',rememberMe:true}));
    const {result}=renderHook(()=>useLogout('/agency/login'),{wrapper:({children}:{children:ReactNode})=><Provider store={store}>{children}</Provider>});
    let pending!:Promise<void>;
    act(()=>{pending=result.current();});
    expect(store.getState().auth.status).toBe('unauthenticated');
    expect(store.getState().auth.accessToken).toBeNull();
    expect(localStorage.getItem('tripri_auth_session')).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/agency/login');
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1));
    const req=fetchMock.mock.calls[0]?.[0] as Request|undefined;
    expect(req?.url).toMatch(/\/auth\/logout$/);
    await act(async()=>{finish(Response.json(success?{success:true}:{error:{message:'offline'}},{status:success?200:503}));await pending;});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.status).toBe('unauthenticated');
    store.dispatch(baseApi.util.resetApiState());
  });
});
