/**
 * Thin loader/typing layer for Google Identity Services (GIS).
 * The ID token returned here is exchanged with the backend at POST /auth/google.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

let scriptPromise: Promise<GoogleIdApi> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google SDK requires a browser'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GoogleIdApi>((resolve, reject) => {
    const fail = () => {
      scriptPromise = null; // allow a retry on the next mount
      reject(new Error('Failed to load Google SDK'));
    };
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}
