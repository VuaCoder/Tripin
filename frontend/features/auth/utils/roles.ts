import type { UserRole } from '../types';

export const homeForRole = (role?: UserRole | null): string => {
  switch (role) {
    case 'AGENCY':
      return '/agency';
    case 'TOUR_GUIDE':
      return '/guide';
    case 'MODERATOR':
      return '/moderator';
    case 'SUPER_ADMIN':
      return '/super-admin';
    case 'TRAVELER':
    default:
      return '/';
  }
};
