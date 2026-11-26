import { SUPER_ADMIN_EMAIL, SUPER_ADMIN_USERNAME } from '../types/saas';

export const USERNAME_AUTH_DOMAIN = 'user.kruschedule.local';
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsernameFormat(input: string): boolean {
  const clean = normalizeUsername(input);
  if (!clean) return false;
  if (clean.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  }
  return USERNAME_PATTERN.test(clean);
}

export function resolveAuthEmail(usernameOrEmail: string): string {
  const clean = normalizeUsername(usernameOrEmail);
  if (!clean) {
    throw new Error('กรุณากรอกชื่อผู้ใช้งาน (Username)');
  }
  if (clean === SUPER_ADMIN_USERNAME || clean === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return SUPER_ADMIN_EMAIL;
  }
  if (clean.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      throw new Error('รูปแบบชื่อผู้ใช้งาน (Username) ไม่ถูกต้อง');
    }
    return clean;
  }
  if (!USERNAME_PATTERN.test(clean)) {
    throw new Error(
      'Username ต้องเป็นตัวอักษรภาษาอังกฤษตัวเล็ก ตัวเลข จุด (.) ขีดล่าง (_) หรือขีดกลาง (-) ความยาว 3–40 ตัวอักษร'
    );
  }
  return `${clean}@${USERNAME_AUTH_DOMAIN}`;
}

export function extractUsername(emailOrUsername: string): string {
  const clean = normalizeUsername(emailOrUsername);
  if (!clean) return '';
  if (clean === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return SUPER_ADMIN_USERNAME;
  }
  if (clean.endsWith(`@${USERNAME_AUTH_DOMAIN}`)) {
    return clean.slice(0, -(USERNAME_AUTH_DOMAIN.length + 1));
  }
  return clean.split('@')[0] || clean;
}
