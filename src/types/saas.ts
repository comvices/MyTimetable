import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'school_admin' | 'scheduler' | 'teacher';

export type SubscriptionStatus =
  | 'trialing'
  | 'pending_payment'
  | 'pending_verification'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'suspended'
  | 'cancelled';

export type PlanFeatureKey =
  | 'timetable'
  | 'basic_info'
  | 'branding'
  | 'pdf_excel'
  | 'activity_lock'
  | 'conflict_detection'
  | 'teacher_dashboard'
  | 'room_dashboard'
  | 'zip_export'
  | 'auto_scheduling'
  | 'advanced_reports'
  | 'backup_versions'
  | 'priority_support';

export interface Plan {
  id: string;
  name: string;
  nameTh: string;
  description?: string;
  priceAnnual: number;
  maxTeachers: number;
  features: PlanFeatureKey[];
  isActive: boolean;
  updatedAt?: Timestamp;
}

export interface PlatformSettings {
  trialDays: number;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  promptPayId?: string;
  supportEmail?: string;
  updatedAt?: Timestamp;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt?: Timestamp;
}

export interface School {
  id: string;
  slug: string;
  ownerUid: string;
  nameTh: string;
  nameEn?: string;
  schoolCode?: string;
  affiliation?: string;
  address?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  directorName?: string;
  academicYear?: string;
  semester?: string;
  logoUrl?: string;
  loginCoverUrl?: string;
  backgroundUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeMessage?: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Timestamp;
  currentPeriodEnd?: Timestamp;
  teacherCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SchoolSlugBranding {
  slug: string;
  schoolId: string;
  ownerUid: string;
  nameTh: string;
  nameEn?: string;
  logoUrl?: string;
  loginCoverUrl?: string;
  backgroundUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeMessage?: string;
  updatedAt?: Timestamp;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  schoolId?: string;
  schoolSlug?: string;
  role: UserRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AuthSessionUser {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  role: UserRole;
  schoolId?: string;
  schoolSlug?: string;
}

export interface SchoolMember {
  uid: string;
  email: string;
  displayName: string;
  role: 'school_admin' | 'scheduler' | 'teacher';
  status: 'active' | 'invited' | 'disabled';
  teacherId?: string;
  inviteId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SchoolInvite {
  id: string;
  schoolId: string;
  email: string;
  role: 'school_admin' | 'scheduler' | 'teacher';
  teacherId?: string;
  status: 'pending' | 'accepted' | 'revoked';
  acceptedBy?: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SubscriptionRecord {
  id: string;
  schoolId: string;
  ownerUid: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt?: Timestamp;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  autoRenew?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PaymentRecord {
  id: string;
  schoolId: string;
  schoolName?: string;
  subscriptionId?: string;
  planId: string;
  amount: number;
  discountAmount?: number;
  couponCode?: string;
  method: 'bank_transfer' | 'gateway';
  status: 'pending_payment' | 'pending_verification' | 'approved' | 'rejected' | 'failed';
  slipUrl?: string;
  transferDate?: string;
  transferReference?: string;
  gatewaySessionId?: string;
  gatewaySignature?: string;
  notes?: string;
  createdBy: string;
  verifiedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  schoolId: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  createdAt?: Timestamp;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    nameTh: 'แพ็กเกจ Basic',
    description: 'สำหรับโรงเรียนขนาดเล็กที่ต้องการจัดตารางสอนเป็นระบบ',
    priceAnnual: 2900,
    maxTeachers: 30,
    features: ['timetable', 'basic_info', 'branding', 'pdf_excel'],
    isActive: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    nameTh: 'แพ็กเกจ Professional',
    description: 'สำหรับโรงเรียนขนาดกลาง รองรับตรวจตารางชน ล็อกกิจกรรม และส่งออก ZIP',
    priceAnnual: 4900,
    maxTeachers: 100,
    features: [
      'timetable',
      'basic_info',
      'branding',
      'pdf_excel',
      'activity_lock',
      'conflict_detection',
      'teacher_dashboard',
      'room_dashboard',
      'zip_export',
    ],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    nameTh: 'แพ็กเกจ Premium',
    description: 'สำหรับโรงเรียนขนาดใหญ่หรือเครือข่าย จัดตารางอัตโนมัติและสำรองเวอร์ชัน',
    priceAnnual: 7900,
    maxTeachers: 500,
    features: [
      'timetable',
      'basic_info',
      'branding',
      'pdf_excel',
      'activity_lock',
      'conflict_detection',
      'teacher_dashboard',
      'room_dashboard',
      'zip_export',
      'auto_scheduling',
      'advanced_reports',
      'backup_versions',
      'priority_support',
    ],
    isActive: true,
  },
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  trialDays: 14,
  bankName: 'ธนาคารกสิกรไทย (KBANK)',
  bankAccountName: 'บจก. ครูสเคดดูล แพลตฟอร์ม จำกัด',
  bankAccountNumber: '012-3-45678-9',
  promptPayId: '0105567000123',
  supportEmail: 'support@kruschedule.app',
};

export const SUPER_ADMIN_EMAIL = 'phratchayawit.sri@gmail.com';
export const SUPER_ADMIN_USERNAME = 'phratchayawit.sri';
export const READ_ONLY_STATUSES: SubscriptionStatus[] = ['expired', 'suspended', 'cancelled'];
