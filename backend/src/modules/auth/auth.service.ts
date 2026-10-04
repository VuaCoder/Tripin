import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  AGENCY_VERIFICATION_STATUS,
  OTP_PURPOSE,
  ROLES,
  USER_STATUS,
  type OtpPurpose,
  type PersistedRole,
} from '@travel-platform/constants';
import { isUniqueViolation } from '../../config/database';
import { googleIdentityVerifier, type GoogleIdentityVerifier } from '../../integrations/google';
import { mailProvider, type MailProvider } from '../../integrations/mail';
import { AppError, ERROR_CODES } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { assertTransition } from '../../utils/state-machine';
import { USER_STATUS_TRANSITIONS, toPrivateUserDto, usersRepository, type PrivateUserDto, type UsersRepository } from '../users';
import type { UserRecord } from '../users/users.repository';
import { buildOtpMail } from './auth.mail';
import { AUTH_POLICY } from './auth.policy';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './auth.tokens';
import type { LoginInput, LoginResult, RegisterInput, RequestContext, Session } from './auth.types';
import { OtpService, otpService } from './otp.service';
import { refreshTokenRepository, type RefreshTokenRepository } from './refresh-token.repository';

export interface AuthDeps {
  users: Pick<
    UsersRepository,
    'findByEmail' | 'findByEmailWithPassword' | 'findByIdWithPassword' | 'findByGoogleId' | 'findById' | 'create' | 'updateById' | 'updateStatusIf'
  >;
  refreshTokens: RefreshTokenRepository;
  otp: Pick<OtpService, 'issue' | 'verify' | 'purgeExpired'>;
  mail: MailProvider;
  google: GoogleIdentityVerifier;
}

const GENERIC_FORGOT_MESSAGE = 'If the email is registered, a reset code has been sent';

// Compared against when the account does not exist so response time does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', 4);

export class AuthService {
  constructor(
    private readonly deps: AuthDeps = {
      users: usersRepository,
      refreshTokens: refreshTokenRepository,
      otp: otpService,
      mail: mailProvider,
      google: googleIdentityVerifier,
    },
  ) {}

  // ---------------------------------------------------------------- Register

  /** Use case "Register" (Guest -> Traveler / Agency / Tour guide). Account stays PENDING until the email OTP is verified. */
  async register(input: RegisterInput): Promise<{ email: string; otpExpiresInSeconds: number }> {
    const { users } = this.deps;
    const passwordHash = await bcrypt.hash(input.password, AUTH_POLICY.BCRYPT_ROUNDS);
    const existing = await users.findByEmail(input.email);

    let user: UserRecord;
    if (existing) {
      // Only an unverified, password-based account may be re-registered (lets users fix a typo / get a new code).
      if (existing.status !== USER_STATUS.PENDING_VERIFICATION) {
        throw AppError.conflict('This email is already registered', 'EMAIL_ALREADY_REGISTERED');
      }
      const updated = await users.updateById(existing.id, {
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        role: input.role,
      });
      user = updated ?? existing;
    } else {
      user = await users.create({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        role: input.role,
        status: USER_STATUS.PENDING_VERIFICATION,
        ...(input.role === ROLES.AGENCY
          ? { agencyProfile: { verificationStatus: AGENCY_VERIFICATION_STATUS.UNVERIFIED } }
          : {}),
        ...(input.role === ROLES.TOUR_GUIDE ? { guideProfile: { languages: [], specialties: [] } } : {}),
      });
    }

    const { expiresInSeconds } = await this.sendOtp(user, OTP_PURPOSE.REGISTER);
    return { email: user.email, otpExpiresInSeconds: expiresInSeconds };
  }

  // ------------------------------------------------------------------- Login

  /** Use case "Login" including "Validate credentials" and, when enabled, the Verify OTP extension (2FA). */
  async login(input: LoginInput, context: RequestContext = {}): Promise<LoginResult> {
    const user = await this.validateCredentials(input);

    if (user.status === USER_STATUS.BANNED) {
      throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
    }
    if (user.status === USER_STATUS.PENDING_VERIFICATION) {
      await this.trySendOtp(user, OTP_PURPOSE.REGISTER);
      throw AppError.forbidden('Please verify your email to continue', ERROR_CODES.ACCOUNT_NOT_VERIFIED);
    }

    if (user.twoFactorEnabled) {
      await this.sendOtp(user, OTP_PURPOSE.LOGIN_2FA);
      return { twoFactorRequired: true, email: user.email };
    }
    return { twoFactorRequired: false, session: await this.createSession(user, context) };
  }

  /** Use case "Verify OTP": completes REGISTER (activates the account) or LOGIN_2FA and opens a session. */
  async verifyOtp(
    input: { email: string; code: string; purpose: typeof OTP_PURPOSE.REGISTER | typeof OTP_PURPOSE.LOGIN_2FA },
    context: RequestContext = {},
  ): Promise<Session> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user) throw AppError.badRequest('Invalid or expired code', undefined, ERROR_CODES.OTP_INVALID);
    if (user.status === USER_STATUS.BANNED) {
      throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
    }

    await this.deps.otp.verify(user.id, input.purpose, input.code);

    const active =
      input.purpose === OTP_PURPOSE.REGISTER && user.status === USER_STATUS.PENDING_VERIFICATION
        ? await this.activatePending(user)
        : user;
    return this.createSession(active, context);
  }

  /** Use case "Resend OTP": issues and mails a new verification code. */
  async resendOtp(input: { email: string; purpose: OtpPurpose }): Promise<{ expiresInSeconds: number }> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user) throw AppError.badRequest('Invalid or expired request');
    if (user.status === USER_STATUS.BANNED) {
      throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
    }
    return this.sendOtp(user, input.purpose);
  }

  /** Use cases "Login with Google" + "Authenticate via OAuth" (Google OAuth System actor). */
  async loginWithGoogle(
    input: { idToken: string; role?: RegisterInput['role'] },
    context: RequestContext = {},
  ): Promise<Session> {
    const identity = await this.deps.google.verifyIdToken(input.idToken);
    if (!identity.emailVerified) throw AppError.unauthenticated('Google email is not verified');

    let user = await this.deps.users.findByGoogleId(identity.googleId);
    if (!user) {
      const sameEmail = await this.deps.users.findByEmail(identity.email);
      if (sameEmail) {
        // Link Google to the existing account (the email is verified by Google).
        const wasUnverified = sameEmail.status === USER_STATUS.PENDING_VERIFICATION;
        const linked =
          (await this.deps.users.updateById(sameEmail.id, {
            googleId: identity.googleId,
            emailVerifiedAt: sameEmail.emailVerifiedAt ?? new Date(),
            // An unverified registration may have been made by SOMEONE ELSE with this address (pre-hijacking): the
            // password they chose must not survive the real owner proving the address through Google.
            ...(wasUnverified ? { passwordHash: null } : {}),
          })) ?? sameEmail;
        user = wasUnverified ? await this.activatePending(linked) : linked;
      } else {
        const role = input.role ?? ROLES.TRAVELER;
        try {
          user = await this.deps.users.create({
            email: identity.email,
            fullName: identity.fullName,
            avatarUrl: identity.avatarUrl,
            googleId: identity.googleId,
            role,
            status: USER_STATUS.ACTIVE,
            emailVerifiedAt: new Date(),
            ...(role === ROLES.AGENCY
              ? { agencyProfile: { verificationStatus: AGENCY_VERIFICATION_STATUS.UNVERIFIED } }
              : {}),
            ...(role === ROLES.TOUR_GUIDE ? { guideProfile: { languages: [], specialties: [] } } : {}),
          });
        } catch (error) {
          // Two first logins at the same moment: the other request created the account, use it.
          if (!isUniqueViolation(error)) throw error;
          const existing = (await this.deps.users.findByGoogleId(identity.googleId)) ?? (await this.deps.users.findByEmail(identity.email));
          if (!existing) throw error;
          user = existing;
        }
      }
    }

    if (user.status === USER_STATUS.BANNED) {
      throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
    }
    return this.createSession(user, context);
  }

  // --------------------------------------------------------- Forgot password

  /** Use case "Forgot password" step 1. Always answers the same message to avoid revealing which emails exist. */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.deps.users.findByEmail(email);
    if (user && user.status === USER_STATUS.ACTIVE) {
      await this.trySendOtp(user, OTP_PURPOSE.FORGOT_PASSWORD);
    }
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  /** Use case "Forgot password" step 2 (includes Verify OTP). Revokes every session of the account. */
  async resetPassword(input: { email: string; code: string; newPassword: string }): Promise<void> {
    const user = await this.deps.users.findByEmail(input.email);
    if (!user || user.status === USER_STATUS.BANNED) {
      throw AppError.badRequest('Invalid or expired code', undefined, ERROR_CODES.OTP_INVALID);
    }
    await this.deps.otp.verify(user.id, OTP_PURPOSE.FORGOT_PASSWORD, input.code);

    const passwordHash = await bcrypt.hash(input.newPassword, AUTH_POLICY.BCRYPT_ROUNDS);
    // Only the password changes here. Activation happens exclusively through the REGISTER OTP / verified Google email.
    await this.deps.users.updateById(user.id, { passwordHash });
    await this.deps.refreshTokens.revokeAllForUser(user.id);
  }

  // ----------------------------------------------------------------- Session

  /** Rotates the refresh token. Presenting an already-rotated token revokes the whole token family (theft signal). */
  async refresh(rawRefreshToken: string | undefined, context: RequestContext = {}): Promise<Session> {
    if (!rawRefreshToken) throw AppError.unauthenticated('Missing refresh token', ERROR_CODES.TOKEN_INVALID);

    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(rawRefreshToken));
    if (!stored) throw AppError.unauthenticated('Invalid refresh token', ERROR_CODES.TOKEN_INVALID);

    if (stored.revokedAt) {
      await this.deps.refreshTokens.revokeFamily(stored.family);
      logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      throw AppError.unauthenticated('Invalid refresh token', ERROR_CODES.TOKEN_INVALID);
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthenticated('Refresh token expired', ERROR_CODES.TOKEN_INVALID);
    }

    const revoked = await this.deps.refreshTokens.revokeIfActive(stored.id);
    if (!revoked) {
      await this.deps.refreshTokens.revokeFamily(stored.family);
      throw AppError.unauthenticated('Invalid refresh token', ERROR_CODES.TOKEN_INVALID);
    }

    const user = await this.deps.users.findById(stored.userId);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      await this.deps.refreshTokens.revokeFamily(stored.family);
      throw AppError.unauthenticated('Account is not active', ERROR_CODES.TOKEN_INVALID);
    }
    return this.createSession(user, context, stored.family);
  }

  /** Use case "Log out". Idempotent: an unknown/absent token is not an error. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(rawRefreshToken));
    if (stored) await this.deps.refreshTokens.revokeFamily(stored.family);
  }

  // --------------------------------------------------------------------- 2FA

  /** Enables/disables email-OTP two-factor login. Password-based accounts must confirm their password. */
  async setTwoFactor(userId: string, input: { enabled: boolean; password?: string }): Promise<PrivateUserDto> {
    const user = await this.deps.users.findByIdWithPassword(userId);
    if (!user) throw AppError.notFound('User not found');

    if (user.passwordHash) {
      const ok = input.password ? await bcrypt.compare(input.password, user.passwordHash) : false;
      if (!ok) throw AppError.unauthenticated('Password confirmation failed', ERROR_CODES.INVALID_CREDENTIALS);
    }
    const updated = await this.deps.users.updateById(userId, { twoFactorEnabled: input.enabled });
    return toPrivateUserDto(updated ?? user);
  }

  /** Housekeeping (periodic job): drops expired one-time codes and refresh tokens. Returns the number removed. */
  async purgeExpiredCredentials(now = new Date()): Promise<number> {
    const [codes, tokens] = await Promise.all([this.deps.otp.purgeExpired(now), this.deps.refreshTokens.deleteExpired(now)]);
    return codes + tokens;
  }

  // ----------------------------------------------------------------- Helpers

  /**
   * PENDING_VERIFICATION -> ACTIVE as a compare-and-set on the status we read. If a moderator banned the account in the
   * meantime the update does not apply and the ban wins (it must never be overwritten by a late activation).
   */
  private async activatePending(user: UserRecord): Promise<UserRecord> {
    assertTransition(USER_STATUS_TRANSITIONS, user.status as typeof USER_STATUS.PENDING_VERIFICATION, USER_STATUS.ACTIVE, 'Account');
    const updated = await this.deps.users.updateStatusIf(user.id, USER_STATUS.PENDING_VERIFICATION, {
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: new Date(),
    });
    if (updated) return updated;
    const current = await this.deps.users.findById(user.id);
    if (!current || current.status === USER_STATUS.BANNED) {
      throw AppError.forbidden('This account has been banned', ERROR_CODES.ACCOUNT_BANNED);
    }
    return current;
  }

  /** "Validate credentials" use case. Same error for unknown email and wrong password. */
  private async validateCredentials(input: LoginInput): Promise<UserRecord> {
    const user = await this.deps.users.findByEmailWithPassword(input.email);
    const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !matches) {
      throw AppError.unauthenticated('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
    }
    return user;
  }

  private async createSession(user: UserRecord, context: RequestContext, family?: string): Promise<Session> {
    const refresh = generateRefreshToken();
    await this.deps.refreshTokens.create({
      userId: user.id,
      tokenHash: refresh.hash,
      family: family ?? randomUUID(),
      expiresAt: refresh.expiresAt,
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 300),
    });
    await this.deps.users.updateById(user.id, { lastLoginAt: new Date() });

    return {
      accessToken: signAccessToken(user.id, user.role as PersistedRole),
      refreshToken: refresh.raw,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: toPrivateUserDto(user),
    };
  }

  private async sendOtp(user: UserRecord, purpose: OtpPurpose): Promise<{ expiresInSeconds: number }> {
    const { code, expiresInSeconds } = await this.deps.otp.issue(user.id, purpose);
    await this.deps.mail.send(buildOtpMail(user.email, purpose, code));
    return { expiresInSeconds };
  }

  /** Like sendOtp but swallows the "resend too soon" case (used where the HTTP answer must stay generic). */
  private async trySendOtp(user: UserRecord, purpose: OtpPurpose): Promise<void> {
    try {
      await this.sendOtp(user, purpose);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.OTP_RESEND_TOO_SOON) return;
      throw error;
    }
  }
}

export const authService = new AuthService();
