'use client';

import { notification } from 'antd';
import { getLocalNotifications, saveLocalNotifications } from './localNotifications';
import type { AgencyNotification } from './notifications';

interface NoticeOptions {
  description?: string;
  /**
   * If true (or if title/message is an important lifecycle event),
   * also record an unread notification into the notification bell inbox.
   */
  inbox?: boolean;
  type?: string;
}

function recordInbox(title: string, body?: string, type = 'AGENCY_UPDATE') {
  if (typeof window === 'undefined') return;
  const item: AgencyNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    body: body || title,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  const current = getLocalNotifications();
  saveLocalNotifications([item, ...current]);
  window.dispatchEvent(new CustomEvent('tripri:notification', { detail: item }));
}

/** Agency action feedback always appears above the current page, at the top right. */
export const agencyNotice = {
  success(message: string, options?: NoticeOptions) {
    notification.success({
      message,
      description: options?.description,
      placement: 'topRight',
      duration: 4,
    });
    if (options?.inbox) {
      recordInbox(message, options.description, options.type);
    }
  },
  error(message: string, options?: NoticeOptions) {
    notification.error({
      message,
      description: options?.description,
      placement: 'topRight',
      duration: 5,
    });
    if (options?.inbox) {
      recordInbox(`Lỗi: ${message}`, options.description, options.type || 'AGENCY_ERROR');
    }
  },
  info(message: string, options?: NoticeOptions) {
    notification.info({
      message,
      description: options?.description,
      placement: 'topRight',
      duration: 4,
    });
    if (options?.inbox) {
      recordInbox(message, options.description, options.type);
    }
  },
  warning(message: string, options?: NoticeOptions) {
    notification.warning({
      message,
      description: options?.description,
      placement: 'topRight',
      duration: 5,
    });
    if (options?.inbox) {
      recordInbox(message, options.description, options.type);
    }
  },
};
