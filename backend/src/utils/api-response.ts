import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Single response envelope for the whole API. Controllers must use these helpers. */
export function sendOk<T>(res: Response, data: T, status = 200, meta?: PaginationMeta): Response {
  const body: SuccessBody<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendOk(res, data, 201);
}

export function sendPaginated<T>(res: Response, items: T[], meta: PaginationMeta): Response {
  return sendOk(res, items, 200, meta);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
