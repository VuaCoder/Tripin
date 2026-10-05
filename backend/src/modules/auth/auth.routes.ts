import { Router } from 'express';
import { requireAuth } from '../../middlewares/authorize';
import { authRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import {
  agencyRegisterBody,
  agencyResendOtpBody,
  agencyVerifyOtpBody,
  forgotPasswordBody,
  googleLoginBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  twoFactorBody,
  verifyOtpBody,
  resendOtpBody,
} from './auth.validation';

/** Mounted at /api/v1/auth */
export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate({ body: registerBody }), authController.register);
authRouter.post('/login', authRateLimiter, validate({ body: loginBody }), authController.login);
authRouter.post('/agency/register', authRateLimiter, validate({ body: agencyRegisterBody }), authController.registerAgency);
authRouter.post('/agency/login', authRateLimiter, validate({ body: loginBody }), authController.loginAgency);
authRouter.post('/agency/verify-otp', authRateLimiter, validate({ body: agencyVerifyOtpBody }), authController.verifyAgencyOtp);
authRouter.post('/agency/resend-otp', authRateLimiter, validate({ body: agencyResendOtpBody }), authController.resendAgencyOtp);
authRouter.post('/verify-otp', authRateLimiter, validate({ body: verifyOtpBody }), authController.verifyOtp);
authRouter.post('/resend-otp', authRateLimiter, validate({ body: resendOtpBody }), authController.resendOtp);
authRouter.post('/google', authRateLimiter, validate({ body: googleLoginBody }), authController.loginWithGoogle);
authRouter.post('/forgot-password', authRateLimiter, validate({ body: forgotPasswordBody }), authController.forgotPassword);
authRouter.post('/reset-password', authRateLimiter, validate({ body: resetPasswordBody }), authController.resetPassword);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.patch('/two-factor', requireAuth, validate({ body: twoFactorBody }), authController.setTwoFactor);
