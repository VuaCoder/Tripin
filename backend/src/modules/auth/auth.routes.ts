import { Router } from 'express';
import { requireAuth } from '../../middlewares/authorize';
import { authRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import {
  forgotPasswordBody,
  googleLoginBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  twoFactorBody,
  verifyOtpBody,
} from './auth.validation';

/** Mounted at /api/v1/auth */
export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate({ body: registerBody }), authController.register);
authRouter.post('/login', authRateLimiter, validate({ body: loginBody }), authController.login);
authRouter.post('/verify-otp', authRateLimiter, validate({ body: verifyOtpBody }), authController.verifyOtp);
authRouter.post('/google', authRateLimiter, validate({ body: googleLoginBody }), authController.loginWithGoogle);
authRouter.post('/forgot-password', authRateLimiter, validate({ body: forgotPasswordBody }), authController.forgotPassword);
authRouter.post('/reset-password', authRateLimiter, validate({ body: resetPasswordBody }), authController.resetPassword);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.patch('/two-factor', requireAuth, validate({ body: twoFactorBody }), authController.setTwoFactor);
