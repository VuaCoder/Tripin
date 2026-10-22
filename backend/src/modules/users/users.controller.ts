import type { RequestHandler } from 'express';
import type { Permission, UserStatus } from '@travel-platform/constants';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { usersService, type UsersService } from './users.service';
import type { AssignAccessBody, CompleteImageUploadBody, ListUsersQueryInput, UpdatePreferencesBody, UpdateProfileBody } from './users.validation';

/** HTTP only; rules live in UsersService. */
export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  listAgencyGuides: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, { q?: string; page: number; limit: number }>(req);
    const result = await this.service.listAgencyGuides(query);
    sendPaginated(res, result.items, result.meta);
  };

  getMe: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.getMe(userActor(req).userId));
  };

  getPreferences: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.getPreferences(userActor(req).userId));
  };

  updatePreferences: RequestHandler = async (req, res) => {
    const { body } = validated<UpdatePreferencesBody>(req);
    sendOk(res, await this.service.updatePreferences(userActor(req).userId, body ?? {}));
  };

  updateMe: RequestHandler = async (req, res) => {
    const { body } = validated<UpdateProfileBody>(req);
    sendOk(res, await this.service.updateMe(userActor(req).userId, body));
  };

  createAvatarUploadSignature: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.createTravelerAvatarUploadSignature(userActor(req).userId));
  };

  completeAvatarUpload: RequestHandler = async (req, res) => {
    const { body } = validated<CompleteImageUploadBody>(req);
    sendOk(res, await this.service.completeTravelerAvatarUpload(userActor(req).userId, body.publicId));
  };

  removeAvatar: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.removeTravelerAvatar(userActor(req).userId));
  };

  createGuideLicenseUploadSignature: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.createGuideLicenseUploadSignature(userActor(req).userId));
  };

  completeGuideLicenseUpload: RequestHandler = async (req, res) => {
    const { body } = validated<CompleteImageUploadBody>(req);
    sendOk(res, await this.service.completeGuideLicenseUpload(userActor(req).userId, body.publicId));
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
