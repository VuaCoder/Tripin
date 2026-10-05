import type { Request, RequestHandler } from 'express';
import { validated } from '../../middlewares/validate';
import { userActor } from '../../middlewares/authorize';
import { sendCreated, sendNoContent, sendOk } from '../../utils/api-response';
import { clearRefreshCookie, setRefreshCookie, toSessionResponse } from './auth.mapper';
import { AUTH_POLICY } from './auth.policy';
import { authService, type AuthService } from './auth.service';
import type {
  ForgotPasswordBody,
  GoogleLoginBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  TwoFactorBody,
  VerifyOtpBody,
  ResendOtpBody,
} from './auth.validation';

const contextOf = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });

/** HTTP concerns only: parse validated input, call the service, shape the response. No business rules here. */
export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  register: RequestHandler = async (req, res) => {
    const { body } = validated<RegisterBody>(req);
    const result = await this.service.register(body);
    sendCreated(res, { ...result, message: 'Verification code sent to your email' });
  };

  login: RequestHandler = async (req, res) => {
    const { body } = validated<LoginBody>(req);
    const result = await this.service.login(body, contextOf(req));
    if (result.twoFactorRequired) {
      return void sendOk(res, { twoFactorRequired: true, email: result.email });
    }
    setRefreshCookie(res, result.session);
    sendOk(res, { twoFactorRequired: false, ...toSessionResponse(result.session) });
  };

  verifyOtp: RequestHandler = async (req, res) => {
    const { body } = validated<VerifyOtpBody>(req);
    const session = await this.service.verifyOtp(body, contextOf(req));
    setRefreshCookie(res, session);
    sendOk(res, toSessionResponse(session));
  };

  resendOtp: RequestHandler = async (req, res) => {
    const { body } = validated<ResendOtpBody>(req);
    const result = await this.service.resendOtp(body);
    sendOk(res, { ...result, message: 'Verification code resent successfully' });
  };

  loginWithGoogle: RequestHandler = async (req, res) => {
    const { body } = validated<GoogleLoginBody>(req);
    const session = await this.service.loginWithGoogle(body, contextOf(req));
    setRefreshCookie(res, session);
    sendOk(res, toSessionResponse(session));
  };

  forgotPassword: RequestHandler = async (req, res) => {
    const { body } = validated<ForgotPasswordBody>(req);
    sendOk(res, await this.service.forgotPassword(body.email), 202);
  };

  resetPassword: RequestHandler = async (req, res) => {
    const { body } = validated<ResetPasswordBody>(req);
    await this.service.resetPassword(body);
    sendNoContent(res);
  };

  refresh: RequestHandler = async (req, res) => {
    const session = await this.service.refresh(req.cookies?.[AUTH_POLICY.REFRESH_COOKIE_NAME], contextOf(req));
    setRefreshCookie(res, session);
    sendOk(res, toSessionResponse(session));
  };

  logout: RequestHandler = async (req, res) => {
    await this.service.logout(req.cookies?.[AUTH_POLICY.REFRESH_COOKIE_NAME]);
    clearRefreshCookie(res);
    sendNoContent(res);
  };

  getSecuritySettings: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.getSecuritySettings(userActor(req).userId));
  };

  setTwoFactor: RequestHandler = async (req, res) => {
    const { body } = validated<TwoFactorBody>(req);
    sendOk(res, await this.service.setTwoFactor(userActor(req).userId, body));
  };
}

export const authController = new AuthController();
