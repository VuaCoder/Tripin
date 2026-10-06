import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';

const AVATAR_PREFIX = 'tripin/travelers/avatars';
const AVATAR_TAG = 'tripin_avatar';
const ALLOWED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface CloudinaryAssetResponse {
  public_id?: unknown;
  secure_url?: unknown;
  resource_type?: unknown;
  format?: unknown;
  bytes?: unknown;
}

export interface AvatarUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  uploadUrl: string;
  params: {
    public_id: string;
    overwrite: 'true';
    tags: string;
  };
}

export interface VerifiedAvatarAsset {
  publicId: string;
  secureUrl: string;
}

function config(): CloudinaryConfig {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw AppError.unavailable('Avatar upload is not configured');
  }
  return { cloudName, apiKey, apiSecret };
}

function unixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/** Cloudinary signs alphabetically sorted fields, excluding `file`, `api_key`, `resource_type` and `cloud_name`. */
function sign(params: Record<string, string | number | boolean>, apiSecret: string): string {
  const input = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${input}${apiSecret}`).digest('hex');
}

function avatarPrefix(userId: string) {
  return `${AVATAR_PREFIX}/${userId}`;
}

function uploadApiUrl(cloudName: string) {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
}

function destroyApiUrl(cloudName: string) {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`;
}

function adminResourceUrl(cloudName: string, publicId: string) {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload/${encodeURIComponent(publicId)}`;
}

export function createTravelerAvatarSignature(userId: string): AvatarUploadSignature {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = unixTimestamp();
  const publicId = avatarPrefix(userId);
  const signingParams = { public_id: publicId, overwrite: true, tags: AVATAR_TAG, timestamp };

  return {
    cloudName,
    apiKey,
    timestamp,
    signature: sign(signingParams, apiSecret),
    publicId,
    uploadUrl: uploadApiUrl(cloudName),
    params: { public_id: publicId, overwrite: 'true', tags: AVATAR_TAG },
  };
}

export async function verifyTravelerAvatar(userId: string, publicId: string): Promise<VerifiedAvatarAsset> {
  const { cloudName, apiKey, apiSecret } = config();
  if (publicId !== avatarPrefix(userId)) {
    throw AppError.forbidden('This avatar does not belong to your account');
  }

  let response: Response;
  try {
    response = await fetch(adminResourceUrl(cloudName, publicId), {
      headers: { authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
    });
  } catch (error) {
    logger.error('Cloudinary avatar verification request failed', error);
    throw AppError.unavailable('Unable to verify the uploaded avatar');
  }

  if (response.status === 404) throw AppError.badRequest('Uploaded avatar was not found. Please upload it again.');
  if (!response.ok) {
    logger.error('Cloudinary avatar verification failed', { status: response.status });
    throw AppError.unavailable('Unable to verify the uploaded avatar');
  }

  const asset = (await response.json()) as CloudinaryAssetResponse;
  const actualId = typeof asset.public_id === 'string' ? asset.public_id : '';
  const secureUrl = typeof asset.secure_url === 'string' ? asset.secure_url : '';
  const format = typeof asset.format === 'string' ? asset.format.toLowerCase() : '';
  const bytes = typeof asset.bytes === 'number' ? asset.bytes : Number.NaN;
  if (
    actualId !== publicId ||
    asset.resource_type !== 'image' ||
    !secureUrl.startsWith(`https://res.cloudinary.com/${cloudName}/`) ||
    !ALLOWED_FORMATS.has(format) ||
    !Number.isFinite(bytes) ||
    bytes > MAX_AVATAR_BYTES
  ) {
    await destroyAvatar(publicId).catch(() => undefined);
    throw AppError.badRequest('Avatar must be a JPG, PNG, or WebP image no larger than 5 MB');
  }

  return { publicId, secureUrl };
}

/** Best-effort removal of one Tripri-owned image. The caller already checked ownership. */
export async function destroyAvatar(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = unixTimestamp();
  const signingParams = { public_id: publicId, invalidate: true, timestamp };
  const body = new URLSearchParams({
    public_id: publicId,
    invalidate: 'true',
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: sign(signingParams, apiSecret),
  });

  let response: Response;
  try {
    response = await fetch(destroyApiUrl(cloudName), { method: 'POST', body });
  } catch (error) {
    logger.error('Cloudinary avatar deletion request failed', error);
    throw AppError.unavailable('Unable to remove the avatar image');
  }
  if (!response.ok) {
    logger.error('Cloudinary avatar deletion failed', { status: response.status });
    throw AppError.unavailable('Unable to remove the avatar image');
  }
}
