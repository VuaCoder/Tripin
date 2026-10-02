import type { RequestHandler } from 'express';
import type { Permission, UserStatus } from '@travel-platform/constants';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { usersService, type UsersService } from './users.service';
import type { AssignAccessBody, ListUsersQueryInput, UpdateProfileBody } from './users.validation';

/** HTTP only; rules live in UsersService. */
export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  getMe: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.getMe(userActor(req).userId));
  };

  updateMe: RequestHandler = async (req, res) => {
    const { body } = validated<UpdateProfileBody>(req);
    sendOk(res, await this.service.updateMe(userActor(req).userId, body));
  };

  requestAgencyVerification: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.requestAgencyVerification(userActor(req).userId), 202);
  };

  getPublicGuide: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getPublicGuide(params.id));
  };

  getPublicAgency: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.getPublicAgency(params.id));
  };

  listUsers: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListUsersQueryInput>(req);
    const page = await this.service.listUsers({ ...query, status: query.status as UserStatus | undefined });
    sendPaginated(res, page.items, page.meta);
  };

  assignAccess: RequestHandler = async (req, res) => {
    const { params, body } = validated<AssignAccessBody, unknown, IdParams>(req);
    sendOk(
      res,
      await this.service.assignAccess({ userId: userActor(req).userId, role: userActor(req).role }, params.id, {
        role: body.role,
        extraPermissions: body.extraPermissions as Permission[] | undefined,
      }),
    );
  };
}

export const usersController = new UsersController();
