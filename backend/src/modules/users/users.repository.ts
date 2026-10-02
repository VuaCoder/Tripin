import type { QueryFilter, UpdateQuery } from 'mongoose';
import type { AgencyVerificationStatus, PersistedRole, UserStatus } from '@travel-platform/constants';
import { containsRegex } from '../../utils/regex';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { UserModel, type UserAttributes, type UserDocument } from './users.model';

export interface UserListFilter {
  role?: PersistedRole;
  status?: UserStatus;
  q?: string;
  agencyVerification?: AgencyVerificationStatus;
}

/** All database access of the users domain. Services never touch `UserModel` directly. */
export class UsersRepository {
  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /** Includes the `passwordHash` field that is hidden by default. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  }

  findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).select('+passwordHash').exec();
  }

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ googleId }).exec();
  }

  findManyByIds(ids: string[]): Promise<UserDocument[]> {
    return UserModel.find({ _id: { $in: ids } }).exec();
  }

  create(data: Partial<UserAttributes>): Promise<UserDocument> {
    return UserModel.create(data);
  }

  updateById(id: string, update: UpdateQuery<UserAttributes>): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).exec();
  }

  /** Atomic status change guarded by the expected current status (prevents lost updates / double ban). */
  updateStatusIf(id: string, expected: UserStatus, update: UpdateQuery<UserAttributes>): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate({ _id: id, status: expected }, update, { returnDocument: 'after' }).exec();
  }

  /** Compare-and-set on the agency verification status: null when another request already moved it (double decision). */
  updateAgencyVerificationIf(id: string, expected: string, update: UpdateQuery<UserAttributes>): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate({ _id: id, 'agencyProfile.verificationStatus': expected } as QueryFilter<UserAttributes>, update, { returnDocument: 'after' }).exec();
  }

  count(filter: QueryFilter<UserAttributes> = {}): Promise<number> {
    return UserModel.countDocuments(filter).exec();
  }

  /** Accounts grouped by one field (`role` or `status`) for dashboards. */
  async countGroupedBy(field: 'role' | 'status'): Promise<Record<string, number>> {
    const rows = await UserModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]).exec();
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  countCreatedSince(since: Date): Promise<number> {
    return UserModel.countDocuments({ createdAt: { $gte: since } }).exec();
  }

  countAgenciesByVerification(status: AgencyVerificationStatus): Promise<number> {
    return UserModel.countDocuments({ role: 'AGENCY', 'agencyProfile.verificationStatus': status }).exec();
  }

  async list(filter: UserListFilter, page: PageRequest): Promise<{ items: UserDocument[]; total: number }> {
    const query: QueryFilter<UserAttributes> = {};
    if (filter.role) query.role = filter.role;
    if (filter.status) query.status = filter.status;
    if (filter.agencyVerification) query['agencyProfile.verificationStatus'] = filter.agencyVerification;
    if (filter.q) {
      const regex = containsRegex(filter.q);
      query.$or = [{ email: regex }, { fullName: regex }];
    }
    const [items, total] = await Promise.all([
      UserModel.find(query).sort({ createdAt: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      UserModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }
}

export const usersRepository = new UsersRepository();
