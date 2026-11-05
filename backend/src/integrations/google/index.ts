import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl?: string;
}

/** Abstraction over "Authenticate via OAuth" (Google OAuth System actor in the use-case diagram). */
export interface GoogleIdentityVerifier {
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
}

class GoogleAuthLibraryVerifier implements GoogleIdentityVerifier {
  private client?: OAuth2Client;

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (!env.GOOGLE_CLIENT_ID) throw AppError.unavailable('Google login is not configured');
    const audiences = env.GOOGLE_CLIENT_ID.split(',').map((id) => id.trim()).filter(Boolean);
    this.client ??= new OAuth2Client();
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: audiences.length === 1 ? audiences[0] : audiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) throw new Error('Missing claims');
      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        fullName: payload.name ?? payload.email,
        avatarUrl: payload.picture,
      };
    } catch {
      throw AppError.unauthenticated('Invalid Google credential');
    }
  }
}

export const googleIdentityVerifier: GoogleIdentityVerifier = new GoogleAuthLibraryVerifier();
