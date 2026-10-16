import type { TourContentInput } from '../types';

export const editorFields = ['title', 'destination', 'durationDays', 'summary', 'categoryIds', 'basePrice', 'maxGroupSize'] as const;
export type EditorField = typeof editorFields[number];
export type EditorErrors = Partial<Record<EditorField, string>>;
export const fieldStep = (field: EditorField) => field === 'basePrice' || field === 'maxGroupSize' ? 3 : 1;

export function validateTourEditor(value: TourContentInput): EditorErrors {
  const errors: EditorErrors = {};
  if (value.title.trim().length < 5 || value.title.trim().length > 200) errors.title = 'Nhập tên tour từ 5 đến 200 ký tự nhé.';
  if (value.destination.trim().length < 2 || value.destination.trim().length > 120) errors.destination = 'Nhập điểm đến từ 2 đến 120 ký tự nhé.';
  if (!Number.isInteger(value.durationDays) || value.durationDays < 1 || value.durationDays > 365) errors.durationDays = 'Chọn số ngày từ 1 đến 365, không dùng số lẻ.';
  if ((value.summary?.trim().length ?? 0) > 500) errors.summary = 'Rút gọn phần tóm tắt còn tối đa 500 ký tự nhé.';
  if (value.categoryIds.length < 1 || value.categoryIds.length > 10) errors.categoryIds = 'Chọn từ 1 đến 10 danh mục cho tour nhé.';
  if (!Number.isSafeInteger(value.basePrice) || value.basePrice <= 0 || value.basePrice > 100_000_000_000) errors.basePrice = 'Nhập giá nguyên đồng, lớn hơn 0 và không quá 100 tỷ đồng.';
  if (value.maxGroupSize !== undefined && (!Number.isInteger(value.maxGroupSize) || value.maxGroupSize < 1 || value.maxGroupSize > 10_000)) errors.maxGroupSize = 'Chọn từ 1 đến 10.000 khách, hoặc để trống.';
  return errors;
}

const serverHints: Record<EditorField, string> = {
  title: 'Tên tour chưa hợp lệ. Hãy nhập từ 5 đến 200 ký tự.',
  destination: 'Điểm đến chưa hợp lệ. Hãy nhập từ 2 đến 120 ký tự.',
  durationDays: 'Thời lượng chưa hợp lệ. Hãy chọn từ 1 đến 365 ngày.',
  summary: 'Tóm tắt chưa hợp lệ. Hãy dùng tối đa 500 ký tự.',
  categoryIds: 'Danh mục chưa hợp lệ. Hãy chọn lại từ 1 đến 10 mục.',
  basePrice: 'Giá tour chưa hợp lệ. Hãy kiểm tra lại số tiền.',
  maxGroupSize: 'Số khách chưa hợp lệ. Hãy chọn từ 1 đến 10.000 khách.',
};

export function tourEditorServerErrors(error: unknown): { fields: EditorErrors; hasOtherIssues: boolean } {
  const result = error as { data?: { error?: { details?: unknown } } } | undefined;
  const details = result?.data?.error?.details;
  const fields: EditorErrors = {};
  let hasOtherIssues = false;
  if (Array.isArray(details)) for (const issue of details) {
    const key = typeof issue?.path === 'string' ? issue.path.split('.')[0] : '';
    if (editorFields.includes(key as EditorField)) fields[key as EditorField] = serverHints[key as EditorField];
    else hasOtherIssues = true;
  }
  return { fields, hasOtherIssues };
}
