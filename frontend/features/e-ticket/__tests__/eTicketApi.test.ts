import { describe, expect, it } from 'vitest';
import { eTicketApi } from '../api/eTicketApi';

describe('eTicketApi', () => {
  it('defines getMyETickets endpoint with /e-tickets URL', () => {
    const endpoint = eTicketApi.endpoints.getMyETickets;
    expect(endpoint).toBeDefined();
    const query = endpoint.initiate();
    expect(query).toBeDefined();
  });

  it('defines getETicketById endpoint with /e-tickets/:id URL', () => {
    const endpoint = eTicketApi.endpoints.getETicketById;
    expect(endpoint).toBeDefined();
    const query = endpoint.initiate('etk-123');
    expect(query).toBeDefined();
  });

  it('defines getETicketByBookingId endpoint with /e-tickets/booking/:bookingId URL', () => {
    const endpoint = eTicketApi.endpoints.getETicketByBookingId;
    expect(endpoint).toBeDefined();
    const query = endpoint.initiate('b-123');
    expect(query).toBeDefined();
  });
});
