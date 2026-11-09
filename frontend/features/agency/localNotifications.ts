import type { AgencyNotification } from './notifications';

export const LOCAL_NOTIFICATIONS_STORAGE_KEY = 'tripri_local_notifications';

export function getLocalNotifications(): AgencyNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgencyNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotifications(notifications: AgencyNotification[]): void {
  if (typeof window === 'undefined') return [];
  try {
    window.localStorage.setItem(LOCAL_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore quota errors
  }
}

export function markLocalNotificationRead(id: string): void {
  const current = getLocalNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveLocalNotifications(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tripri:notification-read', { detail: { id } }));
  }
}

export function markAllLocalNotificationsRead(): void {
  const current = getLocalNotifications();
  const updated = current.map((n) => ({ ...n, isRead: true }));
  saveLocalNotifications(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tripri:notification-read', { detail: { all: true } }));
  }
}

export function deleteLocalNotification(id: string): void {
  const current = getLocalNotifications();
  const updated = current.filter((n) => n.id !== id);
  saveLocalNotifications(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tripri:notification', { detail: { deleted: id } }));
  }
}

