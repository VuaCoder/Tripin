import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import { earningsService, type EarningsService } from './earnings.service';
import type { ListEarningsQueryInput, SummaryQueryInput } from './earnings.validation';

/** HTTP only. A guide can only ever read their own earnings. */
export class EarningsController {
  constructor(private readonly service: EarningsService = earningsService) {}

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListEarningsQueryInput>(req);
    const page = await this.service.listMine(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  summary: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, SummaryQueryInput>(req);
    sendOk(res, await this.service.summaryMine(userActor(req).userId, query));
  };
}

export const earningsController = new EarningsController();
