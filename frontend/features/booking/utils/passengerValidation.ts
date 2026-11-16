import type { AgePricing, GuestCounts } from '@travel-platform/constants';

export function getPassengerAgeGroup(index: number, guests: GuestCounts): 'ADULT' | 'CHILD' | 'INFANT' {
  if (index < guests.adults) return 'ADULT';
  if (index < guests.adults + guests.children) return 'CHILD';
  return 'INFANT';
}

export function getPassengerAgeRangeLabel(
  ageGroup: 'ADULT' | 'CHILD' | 'INFANT',
  tourYear: number,
  agePricing?: AgePricing | null,
): { label: string; placeholder: string; rangeText: string } {
  const childMinAge = agePricing?.childMinAge ?? 2;
  const adultMinAge = agePricing?.adultMinAge ?? 13;
  const maxChildAge = adultMinAge <= childMinAge ? adultMinAge : adultMinAge - 1;

  if (ageGroup === 'CHILD') {
    return {
      label: 'Trẻ em',
      placeholder: `VD: ${tourYear - Math.max(childMinAge, Math.min(maxChildAge, 8))}`,
      rangeText: `Độ tuổi ${childMinAge} – ${maxChildAge}`,
    };
  }

  if (ageGroup === 'INFANT') {
    return {
      label: 'Em bé',
      placeholder: `VD: ${tourYear - 1}`,
      rangeText: `Dưới ${childMinAge} tuổi`,
    };
  }

  return {
    label: 'Người lớn',
    placeholder: `VD: ${tourYear - 25}`,
    rangeText: `Từ ${adultMinAge} tuổi trở lên`,
  };
}

export function validatePassengerAge(
  birthYearStr: string,
  ageGroup: 'ADULT' | 'CHILD' | 'INFANT',
  tourYear: number,
  agePricing?: AgePricing | null,
): string | null {
  const trimmed = birthYearStr?.trim();
  if (!trimmed) return null;

  if (!/^\d{4}$/.test(trimmed)) {
    return 'Năm sinh phải gồm 4 chữ số (VD: 2015).';
  }

  const birthYear = parseInt(trimmed, 10);
  if (birthYear < 1900 || birthYear > tourYear) {
    return `Năm sinh không hợp lệ (từ 1900 đến ${tourYear}).`;
  }

  const age = tourYear - birthYear;
  const childMinAge = agePricing?.childMinAge ?? 2;
  const adultMinAge = agePricing?.adultMinAge ?? 13;
  const maxChildAge = adultMinAge <= childMinAge ? adultMinAge : adultMinAge - 1;

  if (ageGroup === 'CHILD') {
    if (age > maxChildAge) {
      return `Vé Trẻ em áp dụng từ ${childMinAge} – ${maxChildAge} tuổi (năm sinh ${birthYear} tính đến ${tourYear} là ${age} tuổi). Vui lòng kiểm tra lại năm sinh hoặc đổi sang vé Người lớn.`;
    }
    if (age < childMinAge) {
      return `Hành khách ${age} tuổi thuộc nhóm vé Em bé (dưới ${childMinAge} tuổi). Vui lòng kiểm tra lại năm sinh hoặc chọn vé Em bé.`;
    }
  } else if (ageGroup === 'INFANT') {
    if (age >= childMinAge) {
      return `Vé Em bé áp dụng cho trẻ dưới ${childMinAge} tuổi (năm sinh ${birthYear} tính đến ${tourYear} là ${age} tuổi). Vui lòng kiểm tra lại năm sinh hoặc đổi sang vé Trẻ em / Người lớn.`;
    }
    if (age < 0) {
      return 'Năm sinh không hợp lệ.';
    }
  } else if (ageGroup === 'ADULT') {
    if (age < adultMinAge) {
      return `Vé Người lớn áp dụng từ ${adultMinAge} tuổi trở lên (năm sinh ${birthYear} tính đến ${tourYear} là ${age} tuổi). Vui lòng kiểm tra lại năm sinh hoặc đổi sang vé Trẻ em.`;
    }
  }

  return null;
}
