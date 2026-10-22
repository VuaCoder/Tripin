import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';

const ALLOWED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * One folder per image kind. The public id is derived from the owner's id, so a signature can only ever
 * target the caller's own slot and verification can prove the asset belongs to them.
 */
const PURPOSES = {
  avatar: { prefix: 'tripin/travelers/avatars', tag: 'tripin_avatar', label: 'Avatar' },
  licenseImage: { prefix: 'tripin/guides/licenses', tag: 'tripin_guide_license', label: 'License image' },
  agencyLicenseImage: { prefix: 'tripin/agencies/licenses', tag: 'tripin_agency_license', label: 'Agency license image' },
  reviewImage: { prefix: 'tripin/reviews', tag: 'tripin_review', label: 'Review image' },
  tourImage: { prefix: 'tripin/tours', tag: 'tripin_tour', label: 'Tour image' },
} as const;

export type ImagePurpose = keyof typeof PURPOSES;

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

export interface ImageUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  uploadUrl: string;
  params: {
    public_id: string;
    overwrite: 'true' | 'false';
    tags: string;
  };
}

export interface VerifiedImageAsset {
  publicId: string;
  secureUrl: string;
}

function config(purpose: ImagePurpose): CloudinaryConfig {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw AppError.unavailable(`${PURPOSES[purpose].label} upload is not configured`);
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

/** The deterministic slot a user's image of this kind occupies. */
export function imagePublicId(purpose: ImagePurpose, userId: string) {
  return `${PURPOSES[purpose].prefix}/${userId}`;
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

export function createImageUploadSignature(purpose: ImagePurpose, userId: string): ImageUploadSignature {
  const { cloudName, apiKey, apiSecret } = config(purpose);
  const timestamp = unixTimestamp();
  const publicId = imagePublicId(purpose, userId);
  const tag = PURPOSES[purpose].tag;
  const overwrite = purpose !== 'reviewImage';
  const signingParams = { public_id: publicId, overwrite, tags: tag, timestamp };

  return {
    cloudName,
    apiKey,
    timestamp,
    signature: sign(signingParams, apiSecret),
    publicId,
    uploadUrl: uploadApiUrl(cloudName),
    params: { public_id: publicId, overwrite: overwrite ? 'true' : 'false', tags: tag },
  };
}

export async function verifyImageUpload(purpose: ImagePurpose, userId: string, publicId: string): Promise<VerifiedImageAsset> {
  const { cloudName, apiKey, apiSecret } = config(purpose);
  const noun = PURPOSES[purpose].label.toLowerCase();
  if (publicId !== imagePublicId(purpose, userId)) {
    throw AppError.forbidden(`This ${noun} does not belong to your account`);
  }

  let response: Response;
  try {
    response = await fetch(adminResourceUrl(cloudName, publicId), {
      headers: { authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
    });
  } catch (error) {
    logger.error(`Cloudinary ${noun} verification request failed`, error);
    throw AppError.unavailable(`Unable to verify the uploaded ${noun}`);
  }

  if (response.status === 404) throw AppError.badRequest(`Uploaded ${noun} was not found. Please upload it again.`);
  if (!response.ok) {
    logger.error(`Cloudinary ${noun} verification failed`, { status: response.status });
    throw AppError.unavailable(`Unable to verify the uploaded ${noun}`);
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
    bytes > MAX_IMAGE_BYTES
  ) {
    await destroyImage(purpose, publicId).catch(() => undefined);
    throw AppError.badRequest(`${PURPOSES[purpose].label} must be a JPG, PNG, or WebP image no larger than 5 MB`);
  }

  return { publicId, secureUrl };
}

/** Best-effort removal of one Tripri-owned image. The caller already checked ownership. */
export async function destroyImage(purpose: ImagePurpose, publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = config(purpose);
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
    logger.error('Cloudinary image deletion request failed', error);
    throw AppError.unavailable('Unable to remove the uploaded image');
  }
  if (!response.ok) {
    logger.error('Cloudinary image deletion failed', { status: response.status });
    throw AppError.unavailable('Unable to remove the uploaded image');
  }
}

/** Direct upload of an image buffer to Cloudinary with secure signature. */
export async function uploadImageBuffer(
  purpose: ImagePurpose,
  identifier: string,
  buffer: Buffer,
  mimetype: string,
): Promise<{ publicId: string; secureUrl: string }> {
  const { cloudName, apiKey, apiSecret } = config(purpose);
  const timestamp = unixTimestamp();
  const publicId = imagePublicId(purpose, identifier);
  const tag = PURPOSES[purpose].tag;
  const signingParams = { public_id: publicId, overwrite: true, tags: tag, timestamp };
  const signature = sign(signingParams, apiSecret);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimetype }));
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('tags', tag);

  let response: Response;
  try {
    response = await fetch(uploadApiUrl(cloudName), { method: 'POST', body: form });
  } catch (error) {
    logger.error('Cloudinary image upload request failed', error);
    throw AppError.unavailable('Không thể kết nối dịch vụ lưu trữ ảnh Cloudinary');
  }

  const data = (await response.json().catch(() => null)) as { secure_url?: string; public_id?: string; error?: { message?: string } } | null;
  if (!response.ok || !data?.secure_url) {
    throw AppError.badRequest(data?.error?.message || 'Không thể tải ảnh lên Cloudinary.');
  }
  return { publicId: data.public_id || publicId, secureUrl: data.secure_url };
}
