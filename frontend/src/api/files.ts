import { api, ApiError, getToken, API_BASE } from './client';
import { toPersianDigits } from '../utils/persian';

/**
 * File manager (فایل منیجر) client — uploads go as multipart to /v1/files
 * and previews stream through the access-checked endpoint with the bearer
 * token (blob URL), since storage is private.
 */

export const MAX_FILE_MB = 10;

export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,application/pdf';

export interface FileAttachment {
  ulid: string;
  original_name: string;
  mime: string;
  size: number;
}

/** Client-side pre-check mirroring the server's content rules; returns a Persian error or null. */
export function validateUpload(file: File): string | null {
  const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!okTypes.includes(file.type)) {
    return 'فقط تصویر (JPG، PNG، WebP) یا PDF پذیرفته می‌شود.';
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `حجم فایل نباید از ${MAX_FILE_MB} مگابایت بیشتر باشد.`;
  }
  return null;
}

export async function uploadFile(file: File): Promise<FileAttachment> {
  const precheck = validateUpload(file);
  if (precheck) {
    throw new ApiError(422, precheck, { file: [precheck] });
  }

  const form = new FormData();
  form.append('file', file);

  const token = getToken();
  const response = await fetch(`${API_BASE}/v1/files`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON body
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? `خطای ${response.status} در آپلود فایل`,
      payload?.errors ?? {},
    );
  }

  return payload as FileAttachment;
}

/** Authenticated inline preview: resolves to a blob URL for <img>/<iframe>. */
export async function fileObjectUrl(ulid: string): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_BASE}/v1/files/${ulid}`, {
    headers: {
      Accept: 'application/pdf, image/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `خطای ${response.status} در دریافت فایل`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export function isPdf(mime: string): boolean {
  return mime === 'application/pdf';
}

/** Human-readable size (B/KB/MB), in Persian digits like the rest of the UI. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
  }
  if (bytes >= 1024) {
    return `${toPersianDigits(Math.round(bytes / 1024))} کیلوبایت`;
  }
  return `${toPersianDigits(bytes)} بایت`;
}

export { api };
