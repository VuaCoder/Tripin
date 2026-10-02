// Public surface of the auth module. Other modules import ONLY from here (never from internal files).
export { authRouter } from './auth.routes';
export { authService, AuthService } from './auth.service';
export { verifyAccessToken } from './auth.tokens';
export { AUTH_POLICY } from './auth.policy';
export { passwordSchema } from './auth.validation';
