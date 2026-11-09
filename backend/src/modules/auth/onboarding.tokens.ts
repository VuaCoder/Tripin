import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

const issuer = 'tripri:agency-onboarding';
export function signOnboardingToken(email: string, tokenVersion: number): string {
  return jwt.sign({ email: email.toLowerCase().trim(), tokenVersion, purpose: 'agency:onboarding' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', issuer: issuer, expiresIn: '24h',
  });
}

export function readOnboardingToken(token: string): { email: string; tokenVersion: number } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: issuer });
    if (typeof payload === 'string' || payload.purpose !== 'agency:onboarding' ||
      typeof payload.email !== 'string' || !Number.isInteger(payload.tokenVersion)) throw new Error('Invalid scope');
    return { email: payload.email, tokenVersion: payload.tokenVersion };
  } catch {
    throw AppError.unauthenticated('Invalid or expired onboarding token');
  }
}
