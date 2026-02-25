/**
 * Get the URL for a logo slot.
 * If a custom logo has been uploaded (stored in window.ThemeStyle.logos),
 * return the custom URL; otherwise return the built-in default path.
 */

// @ts-ignore
const BASE_URL: string = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__.BASE_URL : '';

const DEFAULT_LOGOS: Record<string, string> = {
    'login-logo-small': `${BASE_URL}/assets/mep/login-logo-small.png`,
    'logo-small-dark': `${BASE_URL}/assets/mep/logo-small-dark.png`,
    'login-logo-big': `${BASE_URL}/assets/mep/login-logo-big.png`,
    'login-logo-dark': `${BASE_URL}/assets/mep/login-logo-dark.png`,
    'favicon': `${BASE_URL}/assets/mep/favicon.ico`,
    'logo-report': `${BASE_URL}/assets/mep/logo.jpeg`,
    'user-avatar': `${BASE_URL}/assets/user.png`,
};

export function getLogoUrl(slotKey: string): string {
    const custom = (window as any).ThemeStyle?.logos?.[slotKey];
    if (custom) return custom;
    return DEFAULT_LOGOS[slotKey] || '';
}
