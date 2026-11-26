import { READ_ONLY_STATUSES, School, SubscriptionStatus } from '../types/saas';

export const DEFAULT_BRANDING = {
  nameTh: 'ระบบจัดตารางสอน',
  nameEn: 'School Timetable System',
  primaryColor: '#4A7BD0',
  secondaryColor: '#7DB2F0',
  welcomeMessage: 'ยินดีต้อนรับสู่ระบบบริหารจัดการตารางสอนและตารางเรียนออนไลน์',
  loginCoverUrl: '/src/assets/images/pastel_campus_banner_1795261067858.jpg',
  heroImageUrl: '/src/assets/images/pastel_campus_banner_1795261067858.jpg',
  pastelIllustrationUrl: '/src/assets/images/pastel_timetable_illustration_1795261067072.jpg',
};

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'localhost', '127', 'ais-dev', 'ais-pre']);

export function resolveTenantSlugFromLocation(pathname: string, search: string): string | null {
  // 1. Path pattern: /s/:slug/...
  const pathMatch = pathname.match(/^\/s\/([a-z0-9\-]+)(?:\/|$)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1].toLowerCase();
  }

  // 2. Query fallback: ?school=slug
  const params = new URLSearchParams(search);
  const querySlug = params.get('school') || params.get('tenant');
  if (querySlug && /^[a-z0-9\-]{2,64}$/i.test(querySlug)) {
    return querySlug.toLowerCase();
  }

  // 3. Subdomain detection: school-a.yourdomain.com
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  const parts = host.split('.');
  // Ignore cloud run / preview hostnames like ais-dev-...run.app
  if (host.endsWith('.run.app') || host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
    return null;
  }
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      return sub;
    }
  }
  return null;
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function getDaysRemaining(school: School | null): number | null {
  if (!school) return null;
  const target =
    school.subscriptionStatus === 'trialing'
      ? school.trialEndsAt?.toDate()
      : school.currentPeriodEnd?.toDate();
  if (!target) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isSchoolReadOnly(school: School | null): boolean {
  if (!school) return false;
  if (READ_ONLY_STATUSES.includes(school.subscriptionStatus)) {
    return true;
  }
  const days = getDaysRemaining(school);
  if (days !== null && days < 0 && school.subscriptionStatus === 'trialing') {
    return true;
  }
  return false;
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus): {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
} {
  switch (status) {
    case 'active':
      return { label: 'ใช้งานปกติ (Active)', tone: 'emerald' };
    case 'trialing':
      return { label: 'ทดลองใช้งาน 14 วัน', tone: 'amber' };
    case 'pending_payment':
      return { label: 'รอชำระเงิน', tone: 'amber' };
    case 'pending_verification':
      return { label: 'รอตรวจสอบสลิป', tone: 'amber' };
    case 'past_due':
      return { label: 'เลยกำหนดชำระ', tone: 'rose' };
    case 'expired':
      return { label: 'หมดอายุ (อ่านอย่างเดียว)', tone: 'rose' };
    case 'suspended':
      return { label: 'ระงับการใช้งาน (อ่านอย่างเดียว)', tone: 'rose' };
    case 'cancelled':
      return { label: 'ยกเลิกสมาชิก (อ่านอย่างเดียว)', tone: 'slate' };
    default:
      return { label: status, tone: 'slate' };
  }
}

export function generateId(prefix = 'doc'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
