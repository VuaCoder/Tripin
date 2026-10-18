import type { PolicyInput, PolicyKey } from './types';

export function commissionValue(raw: string): number | null {
  if (!raw.trim() || !/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
export function categoryError(name: string, description: string, order: string): string | null {
  if (name.trim().length < 2 || name.trim().length > 80) return 'Tên danh mục phải dài 2–80 ký tự.';
  if (!/[a-z0-9]/i.test(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd'))) return 'Tên danh mục phải có chữ hoặc số.';
  if (description.trim().length > 1000) return 'Mô tả tối đa 1000 ký tự.';
  if (!order.trim() || !Number.isInteger(Number(order)) || Number(order) < 0 || Number(order) > 100000) return 'Thứ tự phải là số nguyên từ 0 đến 100000.';
  return null;
}
export function policyError(key: PolicyKey, input: PolicyInput): string | null {
  if (input.title.trim().length < 2 || input.title.trim().length > 200) return 'Tiêu đề phải dài 2–200 ký tự.';
  if (input.content.length > 50000) return 'Nội dung tối đa 50000 ký tự.';
  const entries = Object.entries(input.params);
  if (entries.length > 30) return 'Tối đa 30 tham số.';
  for (const [name, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,59}$/.test(name)) return 'Tên tham số phải bắt đầu bằng chữ, chỉ gồm chữ/số, tối đa 60 ký tự.';
    if (typeof value === 'number' && !Number.isFinite(value)) return 'Tham số số phải hữu hạn.';
    if (typeof value === 'string' && value.length > 500) return 'Giá trị tham số tối đa 500 ký tự.';
  }
  const hours = input.params.cancellationWindowHours;
  if (key === 'cancellation' && hours !== undefined && (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0)) return 'Thời hạn hủy phải là số giờ không âm.';
  return null;
}
