import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/authorize';
import { authRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import { agencyApprovalController } from './agency-approval.controller';
import {
  agencyRegisterBody,
  agencyResendOtpBody,
  agencyVerifyOtpBody,
  devAcceptBody,
  devRejectBody,
  forgotPasswordBody,
  googleLoginBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  twoFactorBody,
  updateAgencyApplicationBody,
  verifyOtpBody,
  resendOtpBody,
  changePasswordBody,
} from './auth.validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Mounted at /api/v1/auth */
export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate({ body: registerBody }), authController.register);
authRouter.post('/login', authRateLimiter, validate({ body: loginBody }), authController.login);
authRouter.post('/agency/register', authRateLimiter, validate({ body: agencyRegisterBody }), authController.registerAgency);
authRouter.post('/agency/login', authRateLimiter, validate({ body: loginBody }), authController.loginAgency);
authRouter.post('/agency/verify-otp', authRateLimiter, validate({ body: agencyVerifyOtpBody }), authController.verifyAgencyOtp);
authRouter.post('/agency/resend-otp', authRateLimiter, validate({ body: agencyResendOtpBody }), authController.resendAgencyOtp);
authRouter.get('/agency/application-status', agencyApprovalController.getStatus);
authRouter.get('/agency/application', agencyApprovalController.getApplication);
authRouter.put('/agency/application', validate({ body: updateAgencyApplicationBody }), agencyApprovalController.updateApplication);
authRouter.post('/agency/upload-license', upload.single('file'), agencyApprovalController.uploadLicense);
authRouter.post('/agency/dev-accept', validate({ body: devAcceptBody }), agencyApprovalController.devAccept);
authRouter.post('/agency/dev-reject', validate({ body: devRejectBody }), agencyApprovalController.devReject);
authRouter.post('/verify-otp', authRateLimiter, validate({ body: verifyOtpBody }), authController.verifyOtp);
authRouter.post('/resend-otp', authRateLimiter, validate({ body: resendOtpBody }), authController.resendOtp);
authRouter.post('/google', authRateLimiter, validate({ body: googleLoginBody }), authController.loginWithGoogle);
authRouter.post('/forgot-password', authRateLimiter, validate({ body: forgotPasswordBody }), authController.forgotPassword);
authRouter.post('/reset-password', authRateLimiter, validate({ body: resetPasswordBody }), authController.resetPassword);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/security', requireAuth, authController.getSecuritySettings);
authRouter.patch('/two-factor', requireAuth, authRateLimiter, validate({ body: twoFactorBody }), authController.setTwoFactor);
authRouter.post('/change-password', requireAuth, authRateLimiter, validate({ body: changePasswordBody }), authController.changePassword);
