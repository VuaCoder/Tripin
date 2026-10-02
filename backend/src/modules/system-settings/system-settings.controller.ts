import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';
import { systemSettingsService, type SystemSettingsService } from './system-settings.service';
import type { CommissionBody, PolicyBody, PolicyKeyParams } from './system-settings.validation';

const actorOf = (req: Parameters<RequestHandler>[0]) => {
  const actor = userActor(req);
  return { userId: actor.userId, role: actor.role };
};

export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService = systemSettingsService) {}

  getCommission: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.getCommission());
  };

  setCommission: RequestHandler = async (req, res) => {
    const { body } = validated<CommissionBody>(req);
    sendOk(res, await this.service.setCommission(actorOf(req), body.ratePercent));
  };

  listPolicies: RequestHandler = async (_req, res) => {
    sendOk(res, await this.service.listPolicies());
  };

  getPolicy: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, PolicyKeyParams>(req);
    sendOk(res, await this.service.getPolicy(params.key));
  };

  setPolicy: RequestHandler = async (req, res) => {
    const { params, body } = validated<PolicyBody, unknown, PolicyKeyParams>(req);
    sendOk(res, await this.service.setPolicy(actorOf(req), params.key, body));
  };
}

export const systemSettingsController = new SystemSettingsController();
