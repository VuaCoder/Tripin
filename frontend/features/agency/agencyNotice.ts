'use client';

import { notification } from 'antd';

/** Agency action feedback always appears above the current page, at the top right. */
export const agencyNotice = {
  success(message: string) {
    notification.success({ message, placement: 'topRight', duration: 4 });
  },
  error(message: string) {
    notification.error({ message, placement: 'topRight', duration: 5 });
  },
};
