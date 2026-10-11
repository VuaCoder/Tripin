import type { AvatarUploadSignature } from '../types';

export const AVATAR_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function validateAvatarFile(file: File): string | undefined {
  if (!AVATAR_FILE_TYPES.has(file.type)) return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.';
  if (file.size > MAX_AVATAR_BYTES) return 'Ảnh đại diện không được vượt quá 5 MB.';
  return undefined;
}

/** Uploads only to the signed Cloudinary URL. The API secret never enters this function or the browser. */
export async function uploadAvatarFile(file: File, upload: AvatarUploadSignature): Promise<{ publicId: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', upload.apiKey);
  form.append('timestamp', String(upload.timestamp));
  form.append('signature', upload.signature);
  form.append('public_id', upload.params.public_id);
  form.append('overwrite', upload.params.overwrite);
  form.append('tags', upload.params.tags);

  let response: Response;
  try {
    response = await fetch(upload.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new Error('Không thể tải ảnh lên. Vui lòng kiểm tra kết nối và thử lại.');
  }

  const payload = (await response.json().catch(() => null)) as { public_id?: unknown; error?: { message?: unknown } } | null;
  if (!response.ok || payload?.public_id !== upload.publicId) {
    const providerMessage = typeof payload?.error?.message === 'string' ? payload.error.message : undefined;
    throw new Error(providerMessage || 'Không thể tải ảnh lên. Vui lòng thử lại.');
  }
  return { publicId: upload.publicId };
}
