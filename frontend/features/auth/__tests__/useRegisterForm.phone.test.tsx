import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { validatePhone } from '../utils/validation';

const api = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('../api/authApi', () => ({ useRegisterMutation: () => [api.register] }));
beforeEach(() => api.register.mockReset());

describe('registration phone input', () => {
  it('filters letters and punctuation from typed or pasted text and preserves the leading zero', () => {
    const { result } = renderHook(() => useRegisterForm());
    const change = (value: string) => act(() => result.current.handleInputChange({ target: { name: 'phone', value } } as ChangeEvent<HTMLInputElement>));
    change('abc');
    expect(result.current.formData.phone).toBe('');
    change('09abc12 345-678');
    expect(result.current.formData.phone).toBe('0912345678');
    change('+84 912 345 678');
    expect(result.current.formData.phone).toBe('84912345678');
  });

  it('rejects letters around an otherwise valid phone when validating', () => {
    expect(validatePhone('abc0912345678').isValid).toBe(false);
    expect(validatePhone('0912345678abc').isValid).toBe(false);
    expect(validatePhone('09123456789').isValid).toBe(false);
    expect(validatePhone('0912345678').isValid).toBe(true);
    expect(validatePhone('84912345678').isValid).toBe(true);
  });

  it('places a duplicate-phone error on the phone field', async () => {
    api.register.mockReturnValue({ unwrap: () => Promise.reject({ status: 409, data: { error: { code: 'PHONE_ALREADY_REGISTERED' } } }) });
    const { result } = renderHook(() => useRegisterForm());
    for (const [name, value] of Object.entries({ fullName: 'Phone Tester', email: 'phone@example.com', phone: '0912345678', password: 'PhoneTest123', confirmPassword: 'PhoneTest123' })) {
      act(() => result.current.handleInputChange({ target: { name, value } } as ChangeEvent<HTMLInputElement>));
    }
    await act(() => result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent));
    expect(api.register).toHaveBeenCalledTimes(1);
    expect(result.current.errors.phone).toContain('đã được đăng ký');
    expect(result.current.errors.general).toBeUndefined();
  });
});
