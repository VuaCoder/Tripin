import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authReducer from '@/features/auth/store/authSlice';
import { baseApi } from '@/store/api/baseApi';
import { toursApi } from '@/features/tours/api/toursApi';
import { reviewApi } from '@/features/review/api/reviewApi';
import { bookingApi } from '../api/bookingApi';

const stores: Array<{ dispatch: (action: any) => unknown }> = [];
afterEach(() => {
  for (const store of stores) store.dispatch(baseApi.util.resetApiState());
  stores.length = 0;
  vi.unstubAllGlobals();
});

function setup(initialRemaining = 24) {
  let remaining = initialRemaining;
  let rejectBooking = false;
  const booking = { id: 'booking-1', status: 'PENDING', tour: { id: 'tour-1', title: 'Tour QA' }, departureId: 'dep-1', participants: 10 };
  const fetchMock = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === 'GET' && /\/tours\/tour-[12]$/.test(url.pathname)) {
      const id = url.pathname.endsWith('tour-1') ? 'tour-1' : 'tour-2';
      return Response.json({ success: true, data: { id, title: 'Tour QA', departures: [
        { id: 'dep-1', date: '2027-01-18', capacity: 24, remaining: id === 'tour-1' ? remaining : 24, isOpen: true },
        { id: 'dep-2', date: '2027-02-18', capacity: 24, remaining: 24, isOpen: true },
      ] } });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/bookings')) {
      if (rejectBooking) return Response.json({ success: false, error: { code: 'NOT_ENOUGH_SEATS' } }, { status: 409 });
      remaining -= booking.participants;
      return Response.json({ success: true, data: booking }, { status: 201 });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/bookings/booking-1/cancel')) {
      remaining += booking.participants;
      return Response.json({ success: true, data: { ...booking, status: 'CANCELLED' } });
    }
    return Response.json({ success: false }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: defaults => defaults().concat(baseApi.middleware),
  });
  stores.push(store);
  return { store, fetchMock, rejectBookings: () => { rejectBooking = true; } };
}

const input = { tourId: 'tour-1', departureId: 'dep-1', participants: 10, contact: { fullName: 'QA Traveler', phone: '0901234567' } };

describe('Public seat counts after booking changes', () => {
  it('refreshes both tour detail caches when a PENDING booking reserves seats', async () => {
    const { store } = setup();
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-1')).unwrap();
    await store.dispatch(toursApi.endpoints.getTour.initiate('tour-1')).unwrap();
    await store.dispatch(bookingApi.endpoints.createBooking.initiate(input)).unwrap();
    await waitFor(() => {
      expect(reviewApi.endpoints.getTourDetail.select('tour-1')(store.getState()).data?.departures?.[0].remaining).toBe(14);
      expect(toursApi.endpoints.getTour.select('tour-1')(store.getState()).data?.departures[0].remaining).toBe(14);
    });
    expect(reviewApi.endpoints.getTourDetail.select('tour-1')(store.getState()).data?.departures?.[1].remaining).toBe(24);
  });

  it('evicts an inactive tour snapshot so returning from booking history fetches fresh seats', async () => {
    const { store, fetchMock } = setup();
    const detail = store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-1'));
    await detail.unwrap();
    detail.unsubscribe();
    await store.dispatch(bookingApi.endpoints.createBooking.initiate(input)).unwrap();
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-1')).unwrap();
    expect(reviewApi.endpoints.getTourDetail.select('tour-1')(store.getState()).data?.departures?.[0].remaining).toBe(14);
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'GET')).toHaveLength(2);
  });

  it('refreshes seats after cancellation and leaves an unrelated tour cached', async () => {
    const { store, fetchMock } = setup(14);
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-1')).unwrap();
    await store.dispatch(toursApi.endpoints.getTour.initiate('tour-1')).unwrap();
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-2')).unwrap();
    await store.dispatch(bookingApi.endpoints.cancelBooking.initiate({ id: 'booking-1' })).unwrap();
    await waitFor(() => {
      expect(reviewApi.endpoints.getTourDetail.select('tour-1')(store.getState()).data?.departures?.[0].remaining).toBe(24);
      expect(toursApi.endpoints.getTour.select('tour-1')(store.getState()).data?.departures[0].remaining).toBe(24);
    });
    expect(fetchMock.mock.calls.filter(([request]) => request.url.endsWith('/tours/tour-2'))).toHaveLength(1);
  });

  it('does not change displayed inventory when booking creation fails', async () => {
    const { store, fetchMock, rejectBookings } = setup();
    await store.dispatch(reviewApi.endpoints.getTourDetail.initiate('tour-1')).unwrap();
    rejectBookings();
    const result = await store.dispatch(bookingApi.endpoints.createBooking.initiate(input));
    expect(result.error).toBeDefined();
    expect(reviewApi.endpoints.getTourDetail.select('tour-1')(store.getState()).data?.departures?.[0].remaining).toBe(24);
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'GET')).toHaveLength(1);
  });
});
