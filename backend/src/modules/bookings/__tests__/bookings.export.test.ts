import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { resolvePermissions, type Role } from '@travel-platform/constants';
import { errorHandler } from '../../../middlewares/error-handler';
import { GUEST_ACTOR } from '../../../types/actor';
import { renderCustomersPdf } from '../bookings.export';
import { BookingsService } from '../bookings.service';
import { CUSTOMER_EXPORT_LIMIT } from '../bookings.types';

// Keep the real BookingsService class, replace only the singleton the controller uses.
vi.mock('../bookings.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../bookings.service')>();
  return {
    ...original,
    bookingsService: {
      listCustomers: vi.fn(async (agencyId: string) => ({ tourTitle: `Tour of ${agencyId}`, rows: [], truncated: false })),
    },
  };
});

const collect = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

const row = (i: number) => ({
  bookingCode: `TRP-ROW${i}`,
  departureDate: new Date('2026-12-01'),
  travelerName: 'Nguyễn Văn Ánh',
  phone: '+84 912 345 678',
  participants: 2,
  notes: i % 2 ? 'Ăn chay, cần xe đón tại khách sạn' : undefined,
});

describe('renderCustomersPdf', () => {
  it('produces a valid PDF with Vietnamese names and notes', async () => {
    const buffer = await collect(renderCustomersPdf({ tourTitle: 'Hạ Long 3N2Đ', generatedAt: new Date(), rows: [row(1), row(2)], truncated: false }));
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1500);
    expect(buffer.subarray(buffer.length - 10).toString()).toContain('%%EOF');
  });

  it('paginates long lists and handles an empty one', async () => {
    const many = await collect(renderCustomersPdf({ tourTitle: 'Big tour', generatedAt: new Date(), rows: Array.from({ length: 120 }, (_, i) => row(i)), truncated: true }));
    const pages = (many.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(2);
    const empty = await collect(renderCustomersPdf({ tourTitle: 'Empty', generatedAt: new Date(), rows: [], truncated: false }));
    expect(empty.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

function makeService(opts: { tour?: { id: string; agencyId: string; title: string } | null; bookings?: unknown[] } = {}) {
  const repo = { listPaidForTour: vi.fn(async () => (opts.bookings ?? []) as never[]) };
  const tours = { getTourFacts: vi.fn(async () => (opts.tour === undefined ? { id: 't1', agencyId: 'a1', title: 'Ha Long' } : opts.tour)) };
  return { service: new BookingsService(repo as never, tours as never), repo, tours };
}

describe('BookingsService.listCustomers', () => {
  const booking = (i: number) => ({
    bookingCode: `TRP-${i}`,
    departureDate: new Date('2026-12-01'),
    contact: { fullName: 'Ann', phone: '0123' },
    participants: 2,
    notes: 'vegan',
  });

  it('returns the printable fields of the agency\'s own paid bookings', async () => {
    const { service, repo } = makeService({ bookings: [booking(1)] });
    const result = await service.listCustomers('a1', 't1', 'd1');
    expect(repo.listPaidForTour).toHaveBeenCalledWith('a1', 't1', 'd1', CUSTOMER_EXPORT_LIMIT + 1);
    expect(result).toEqual({
      tourTitle: 'Ha Long',
      truncated: false,
      rows: [{ bookingCode: 'TRP-1', departureDate: new Date('2026-12-01'), travelerName: 'Ann', phone: '0123', participants: 2, notes: 'vegan' }],
    });
  });

  it('refuses another agency\'s tour and unknown tours with 404', async () => {
    await expect(makeService({ tour: { id: 't1', agencyId: 'other', title: 'x' } }).service.listCustomers('a1', 't1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(makeService({ tour: null }).service.listCustomers('a1', 'ghost')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('caps the list and flags the truncation', async () => {
    const { service } = makeService({ bookings: Array.from({ length: CUSTOMER_EXPORT_LIMIT + 1 }, (_, i) => booking(i)) });
    const result = await service.listCustomers('a1', 't1');
    expect(result.rows).toHaveLength(CUSTOMER_EXPORT_LIMIT);
    expect(result.truncated).toBe(true);
  });
});

describe('GET /agency/tours/:id/customers.pdf', () => {
  async function app() {
    const { agencyCustomersExportRouter } = await import('../bookings.routes');
    const server = express();
    server.use((req, _res, next) => {
      const role = req.header('x-role') as Role | undefined;
      req.actor = role
        ? { kind: 'user', userId: 'agency-9', email: 'x@y.z', role: role as never, permissions: resolvePermissions(role) }
        : GUEST_ACTOR;
      next();
    });
    server.use('/agency/tours', agencyCustomersExportRouter);
    server.use(errorHandler);
    return server;
  }
  const ID = '507f1f77bcf86cd799439011';

  it('streams a PDF attachment to agencies only', async () => {
    const server = await app();
    const ok = await request(server)
      .get(`/agency/tours/${ID}/customers.pdf`)
      .set('x-role', 'AGENCY')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/pdf');
    expect(ok.headers['content-disposition']).toContain(`customers-${ID}.pdf`);
    expect((ok.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    expect((await request(server).get(`/agency/tours/${ID}/customers.pdf`)).status).toBe(401);
    expect((await request(server).get(`/agency/tours/${ID}/customers.pdf`).set('x-role', 'TRAVELER')).status).toBe(403);
    expect((await request(server).get('/agency/tours/not-an-id/customers.pdf').set('x-role', 'AGENCY')).status).toBe(400);
  });
});
