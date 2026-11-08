import type { Permission, PersistedRole, UserStatus } from '@travel-platform/constants';
export type { AgencyPromotion as Promotion, CreatePromotionInput, UpdatePromotionInput, ListPromotionsArgs } from '@/features/agency-promotions/types';

export interface Meta { page: number; limit: number; total: number; totalPages: number }
export interface Envelope<T> { success: true; data: T; meta?: Meta }
export interface Page<T> { items: T[]; meta: Meta }
export interface AdminUser {
  id: string; fullName: string; email: string; role: PersistedRole; status: UserStatus;
  revokedPermissions?: Permission[]; staffStatus?: string; permissions: Permission[]; extraPermissions: Permission[]; createdAt: string;
}
export interface UsersArgs { page: number; limit: number; q?: string; role?: PersistedRole; status?: UserStatus; from?: string; to?: string }
export interface DashboardArgs { from?: string; to?: string }
export interface AccessInput { revokedPermissions?: Permission[]; id: string; role: PersistedRole; extraPermissions: Permission[] }
export interface Category { id: string; name: string; slug: string; description?: string; sortOrder: number; isActive: boolean }
export interface CategoryInput { name: string; description?: string; sortOrder: number }
export interface Commission { version?: number; ratePercent: number; rateBps: number; updatedAt?: string }
export const POLICY_KEYS = ['cancellation', 'refund', 'terms', 'privacy', 'moderation'] as const;
export type PolicyKey = typeof POLICY_KEYS[number];
export interface Policy { version?: number; activeVersion?: number; policyVersionId?: string; key: PolicyKey; title: string; content: string; params: Record<string, number | string | boolean>; updatedAt?: string }
export type PolicyInput = Omit<Policy, 'key' | 'updatedAt' | 'version' | 'activeVersion' | 'policyVersionId'> & { expectedVersion?: number; reason?: string; effectiveFrom?: string };
export interface Dashboard {
  period?: { from: string; to: string; previousFrom: string; previousTo: string };
  comparison?: { bookings: number; gross: number; commission: number; net: number; subscriptions: { amount: number; count: number } };
  generatedAt: string;
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number>; newLast30Days: number };
  tours: { total: number; byStatus: Record<string, number> };
  bookings: { byStatus: Record<string, number> };
  revenue: { bookings: number; gross: number; commission: number; net: number; subscriptions: { amount: number; count: number } };
  monthly: { month: string; bookings: number; gross: number; commission: number }[];
  subscriptions: { active: number };
  moderation: { reportsOpen: number; supportTicketsOpen: number };
}
