import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const IS_VERCEL = Boolean(process.env.VERCEL);

const STORE_DIR = IS_VERCEL
  ? path.resolve(os.tmpdir(), 'kruschedule-data')
  : path.resolve(process.cwd(), '.data');
const STORE_FILE = path.resolve(STORE_DIR, 'saas-store.json');
const RUNTIME_SECRETS_FILE = path.resolve(STORE_DIR, '.runtime-secrets.json');

function resolveRuntimeSecrets(): { tokenSecret: string; gatewaySecret: string } {
  const envToken = process.env.AUTH_TOKEN_SECRET?.trim();
  const envGateway = process.env.PAYMENT_GATEWAY_SECRET?.trim();
  if (envToken && envGateway) {
    return { tokenSecret: envToken, gatewaySecret: envGateway };
  }

  let stored: { tokenSecret?: string; gatewaySecret?: string } = {};
  try {
    if (fs.existsSync(RUNTIME_SECRETS_FILE)) {
      stored = JSON.parse(fs.readFileSync(RUNTIME_SECRETS_FILE, 'utf-8')) as {
        tokenSecret?: string;
        gatewaySecret?: string;
      };
    }
  } catch {
    stored = {};
  }

  const tokenSecret = envToken || stored.tokenSecret || crypto.randomBytes(32).toString('hex');
  const gatewaySecret = envGateway || stored.gatewaySecret || crypto.randomBytes(32).toString('hex');

  if ((!envToken && !stored.tokenSecret) || (!envGateway && !stored.gatewaySecret)) {
    try {
      if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
      }
      fs.writeFileSync(
        RUNTIME_SECRETS_FILE,
        JSON.stringify({ tokenSecret, gatewaySecret }),
        'utf-8'
      );
    } catch {
      // Ephemeral fallback if filesystem is read-only
    }
  }

  return { tokenSecret, gatewaySecret };
}

const runtimeSecrets = resolveRuntimeSecrets();
const TOKEN_SECRET = runtimeSecrets.tokenSecret;
const GATEWAY_SECRET = runtimeSecrets.gatewaySecret;

const ENV_ADMIN_USERNAME = (process.env.SUPER_ADMIN_USERNAME || 'admin').trim() || 'admin';
const ENV_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '';

type UserRole = 'super_admin' | 'school_admin' | 'scheduler' | 'teacher';
type SubscriptionStatus =
  | 'trialing'
  | 'pending_payment'
  | 'pending_verification'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'suspended'
  | 'cancelled';

interface StoredUser {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  schoolId?: string;
  schoolSlug?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSchool {
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
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  teacherCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredSlugBranding {
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
  updatedAt: string;
}

interface SchoolSubcollections {
  academicYears: Record<string, Record<string, unknown>>;
  departments: Record<string, Record<string, unknown>>;
  teachers: Record<string, Record<string, unknown>>;
  subjects: Record<string, Record<string, unknown>>;
  classrooms: Record<string, Record<string, unknown>>;
  rooms: Record<string, Record<string, unknown>>;
  timeSlots: Record<string, Record<string, unknown>>;
  activities: Record<string, Record<string, unknown>>;
  timetables: Record<string, Record<string, unknown>>;
  scheduleVersions: Record<string, Record<string, unknown>>;
  scheduleHistory: Record<string, Record<string, unknown>>;
  members: Record<string, Record<string, unknown>>;
  invites: Record<string, Record<string, unknown>>;
}

interface SaasStore {
  users: Record<string, StoredUser>;
  plans: Record<string, Record<string, unknown>>;
  platformSettings: Record<string, unknown>;
  coupons: Record<string, Record<string, unknown>>;
  schools: Record<string, StoredSchool>;
  schoolSlugs: Record<string, StoredSlugBranding>;
  schoolData: Record<string, SchoolSubcollections>;
  subscriptions: Record<string, Record<string, unknown>>;
  payments: Record<string, Record<string, unknown>>;
  auditLogs: Record<string, Record<string, unknown>>;
}

const DEFAULT_PLANS = [
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

const DEFAULT_PLATFORM_SETTINGS = {
  trialDays: 14,
  bankName: 'ธนาคารกสิกรไทย (KBANK)',
  bankAccountName: 'บจก. ครูสเคดดูล แพลตฟอร์ม จำกัด',
  bankAccountNumber: '012-3-45678-9',
  promptPayId: '0105567000123',
  supportEmail: 'support@kruschedule.app',
};

const ALLOWED_COLLECTIONS = new Set<keyof SchoolSubcollections>([
  'academicYears',
  'departments',
  'teachers',
  'subjects',
  'classrooms',
  'rooms',
  'timeSlots',
  'activities',
  'timetables',
  'scheduleVersions',
  'scheduleHistory',
  'members',
  'invites',
]);

const SCHEDULER_WRITABLE_COLLECTIONS = new Set<keyof SchoolSubcollections>([
  'activities',
  'timetables',
  'scheduleVersions',
  'scheduleHistory',
]);

function createEmptySubcollections(): SchoolSubcollections {
  return {
    academicYears: {},
    departments: {},
    teachers: {},
    subjects: {},
    classrooms: {},
    rooms: {},
    timeSlots: {},
    activities: {},
    timetables: {},
    scheduleVersions: {},
    scheduleHistory: {},
    members: {},
    invites: {},
  };
}

function createInitialStore(): SaasStore {
  const now = new Date().toISOString();
  const plans: Record<string, Record<string, unknown>> = {};
  for (const p of DEFAULT_PLANS) {
    plans[p.id] = { ...p, updatedAt: now };
  }
  return {
    users: {},
    plans,
    platformSettings: { ...DEFAULT_PLATFORM_SETTINGS, updatedAt: now },
    coupons: {},
    schools: {},
    schoolSlugs: {},
    schoolData: {},
    subscriptions: {},
    payments: {},
    auditLogs: {},
  };
}

function loadStore(): SaasStore {
  if (!STORE_FILE.startsWith(STORE_DIR + path.sep)) {
    throw new Error('Invalid store path');
  }
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial = createInitialStore();
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SaasStore>;
    const base = createInitialStore();
    return {
      users: parsed.users || {},
      plans: parsed.plans && Object.keys(parsed.plans).length > 0 ? parsed.plans : base.plans,
      platformSettings: parsed.platformSettings || base.platformSettings,
      coupons: parsed.coupons || {},
      schools: parsed.schools || {},
      schoolSlugs: parsed.schoolSlugs || {},
      schoolData: parsed.schoolData || {},
      subscriptions: parsed.subscriptions || {},
      payments: parsed.payments || {},
      auditLogs: parsed.auditLogs || {},
    };
  } catch (err) {
    console.error('Failed to load store, re-initializing:', err);
    return createInitialStore();
  }
}

const store: SaasStore = loadStore();
let writePending = false;

function persistStore(): void {
  if (!STORE_FILE.startsWith(STORE_DIR + path.sep)) {
    throw new Error('Invalid store path');
  }
  if (writePending) return;
  writePending = true;
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    const tmpFile = path.resolve(STORE_DIR, `saas-store.${process.pid}.tmp`);
    if (!tmpFile.startsWith(STORE_DIR + path.sep)) {
      throw new Error('Invalid temp store path');
    }
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    console.warn('Store persistence warning (continuing with in-memory state):', err);
  } finally {
    writePending = false;
  }
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length >= 2 && slug.length <= 64 && /^[a-z0-9\-]+$/.test(slug);
}

function isValidUsername(username: string): boolean {
  return typeof username === 'string' && /^[a-zA-Z0-9_.\-@]{3,64}$/.test(username.trim());
}

function generateId(prefix = 'doc'): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function isSafeMediaUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return true;
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/')) {
    return url.length <= 2000;
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/.test(url)) {
    return url.length <= 900000;
  }
  return false;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

function constantTimeCompareSecret(input: string, secret: string): boolean {
  const h1 = crypto.createHmac('sha256', TOKEN_SECRET).update(input).digest();
  const h2 = crypto.createHmac('sha256', TOKEN_SECRET).update(secret).digest();
  return crypto.timingSafeEqual(h1, h2);
}

function signAuthToken(user: { uid: string; username: string; role: UserRole }): string {
  const payload = {
    uid: user.uid,
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function verifyAuthToken(authHeader?: string): { uid: string; username: string; role: UserRole } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('hex');
    const bufSig = Buffer.from(sig, 'hex');
    const bufExp = Buffer.from(expectedSig, 'hex');
    if (bufSig.length !== bufExp.length || bufSig.length === 0) return null;
    if (!crypto.timingSafeEqual(bufSig, bufExp)) return null;

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      uid?: string;
      username?: string;
      role?: UserRole;
      exp?: number;
    };
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;

    const existingUser = store.users[payload.uid];
    if (!existingUser) return null;
    return {
      uid: existingUser.uid,
      username: existingUser.username,
      role: existingUser.role,
    };
  } catch {
    return null;
  }
}

function toPublicUser(user: StoredUser) {
  return {
    uid: user.uid,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    schoolId: user.schoolId,
    schoolSlug: user.schoolSlug,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getClaimedSuperAdmin(): StoredUser | undefined {
  return Object.values(store.users).find((u) => u.role === 'super_admin');
}

function ensureEnvSuperAdminUser(): StoredUser {
  const existing = store.users['usr_super_admin'] || getClaimedSuperAdmin();
  const now = new Date().toISOString();
  if (existing) {
    existing.username = ENV_ADMIN_USERNAME;
    existing.role = 'super_admin';
    existing.updatedAt = now;
    persistStore();
    return existing;
  }
  const adminUser: StoredUser = {
    uid: 'usr_super_admin',
    username: ENV_ADMIN_USERNAME,
    email: `${ENV_ADMIN_USERNAME}@system.local`,
    displayName: 'เจ้าของและผู้ดูแลระบบหลัก (Super Admin)',
    role: 'super_admin',
    passwordHash: '',
    createdAt: now,
    updatedAt: now,
  };
  store.users[adminUser.uid] = adminUser;
  persistStore();
  return adminUser;
}

function isSchoolWritable(school: StoredSchool | undefined): boolean {
  if (!school) return false;
  if (['expired', 'suspended', 'cancelled'].includes(school.subscriptionStatus)) {
    return false;
  }
  if (school.subscriptionStatus === 'trialing' && school.trialEndsAt) {
    const ends = Date.parse(school.trialEndsAt);
    if (!Number.isNaN(ends) && ends < Date.now()) {
      return false;
    }
  }
  return true;
}

function getSchoolSubcollections(schoolId: string): SchoolSubcollections {
  if (!store.schoolData[schoolId]) {
    store.schoolData[schoolId] = createEmptySubcollections();
  }
  return store.schoolData[schoolId];
}

function recordAudit(
  schoolId: string,
  actor: { uid: string; username: string; email?: string },
  action: string,
  targetType: string,
  targetId = '',
  details = ''
): void {
  const id = generateId('log');
  store.auditLogs[id] = {
    id,
    schoolId: schoolId.slice(0, 128),
    actorUid: actor.uid,
    actorEmail: (actor.email || actor.username).slice(0, 200),
    action: action.slice(0, 100),
    targetType: targetType.slice(0, 80),
    targetId: targetId.slice(0, 128),
    details: details.slice(0, 600),
    createdAt: new Date().toISOString(),
  };
}

function getUserSchoolRole(
  schoolId: string,
  user: StoredUser
): 'super_admin' | 'school_admin' | 'scheduler' | 'teacher' | null {
  if (user.role === 'super_admin') return 'super_admin';
  const sub = store.schoolData[schoolId];
  const member = sub?.members?.[user.uid] as { role?: string; status?: string } | undefined;
  if (member && member.status === 'active') {
    if (member.role === 'school_admin' || member.role === 'scheduler' || member.role === 'teacher') {
      return member.role;
    }
  }
  if (store.schools[schoolId]?.ownerUid === user.uid) return 'school_admin';
  return null;
}

function seedDefaultSchoolCore(schoolId: string): void {
  const sub = getSchoolSubcollections(schoolId);
  const now = new Date().toISOString();
  const nowYear = String(new Date().getFullYear() + 543);
  const yearId = `ay_${nowYear}_1`;

  sub.academicYears[yearId] = {
    id: yearId,
    year: nowYear,
    semester: '1',
    isActive: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    createdAt: now,
    updatedAt: now,
  };

  const defaultSlots = [
    { periodNumber: 1, label: 'คาบที่ 1', startTime: '08:30', endTime: '09:20', isBreak: false },
    { periodNumber: 2, label: 'คาบที่ 2', startTime: '09:20', endTime: '10:10', isBreak: false },
    { periodNumber: 3, label: 'คาบที่ 3', startTime: '10:20', endTime: '11:10', isBreak: false },
    { periodNumber: 4, label: 'คาบที่ 4', startTime: '11:10', endTime: '12:00', isBreak: false },
    { periodNumber: 5, label: 'พักกลางวัน', startTime: '12:00', endTime: '13:00', isBreak: true },
    { periodNumber: 6, label: 'คาบที่ 5', startTime: '13:00', endTime: '13:50', isBreak: false },
    { periodNumber: 7, label: 'คาบที่ 6', startTime: '13:50', endTime: '14:40', isBreak: false },
    { periodNumber: 8, label: 'คาบที่ 7', startTime: '14:40', endTime: '15:30', isBreak: false },
  ];
  for (const slot of defaultSlots) {
    const slotId = `slot_${slot.periodNumber}`;
    sub.timeSlots[slotId] = { id: slotId, ...slot, createdAt: now, updatedAt: now };
  }

  const defaultDepts = [
    { id: 'dept_math', code: 'ค', name: 'กลุ่มสาระฯ คณิตศาสตร์', color: '#4A7BD0' },
    { id: 'dept_sci', code: 'ว', name: 'กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี', color: '#2E8B71' },
    { id: 'dept_thai', code: 'ท', name: 'กลุ่มสาระฯ ภาษาไทย', color: '#D98245' },
    { id: 'dept_eng', code: 'อ', name: 'กลุ่มสาระฯ ภาษาต่างประเทศ', color: '#7858C4' },
  ];
  for (const dept of defaultDepts) {
    sub.departments[dept.id] = { ...dept, createdAt: now, updatedAt: now };
  }
}

function seedDemoSchedulingSampleData(
  schoolId: string,
  actor: StoredUser,
  existingYearId?: string
) {
  const sub = getSchoolSubcollections(schoolId);
  const now = new Date().toISOString();
  const nowYear = String(new Date().getFullYear() + 543);

  let targetYearId = existingYearId || '';
  if (!targetYearId) {
    const existingYears = Object.values(sub.academicYears);
    const active = existingYears.find((y) => Boolean(y.isActive));
    targetYearId = String((active?.id || existingYears[0]?.id || ''));
  }
  if (!targetYearId) {
    targetYearId = `ay_${nowYear}_1`;
    sub.academicYears[targetYearId] = {
      id: targetYearId,
      year: nowYear,
      semester: '1',
      isActive: true,
      daysOfWeek: [1, 2, 3, 4, 5],
      createdAt: now,
      updatedAt: now,
    };
  }

  if (Object.keys(sub.timeSlots).length === 0) {
    const slots = [
      { id: 'slot_1', periodNumber: 1, label: 'คาบที่ 1', startTime: '08:30', endTime: '09:20', isBreak: false },
      { id: 'slot_2', periodNumber: 2, label: 'คาบที่ 2', startTime: '09:20', endTime: '10:10', isBreak: false },
      { id: 'slot_3', periodNumber: 3, label: 'คาบที่ 3', startTime: '10:20', endTime: '11:10', isBreak: false },
      { id: 'slot_4', periodNumber: 4, label: 'คาบที่ 4', startTime: '11:10', endTime: '12:00', isBreak: false },
      { id: 'slot_5', periodNumber: 5, label: 'พักกลางวัน', startTime: '12:00', endTime: '13:00', isBreak: true },
      { id: 'slot_6', periodNumber: 6, label: 'คาบที่ 5', startTime: '13:00', endTime: '13:50', isBreak: false },
      { id: 'slot_7', periodNumber: 7, label: 'คาบที่ 6', startTime: '13:50', endTime: '14:40', isBreak: false },
      { id: 'slot_8', periodNumber: 8, label: 'คาบที่ 7', startTime: '14:40', endTime: '15:30', isBreak: false },
    ];
    for (const s of slots) {
      sub.timeSlots[s.id] = { ...s, createdAt: now, updatedAt: now };
    }
  }

  const depts = [
    { id: 'dept_demo_math', code: 'ค', name: 'กลุ่มสาระฯ คณิตศาสตร์', color: '#4A7BD0' },
    { id: 'dept_demo_sci', code: 'ว', name: 'กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี', color: '#2E8B71' },
    { id: 'dept_demo_thai', code: 'ท', name: 'กลุ่มสาระฯ ภาษาไทย', color: '#D98245' },
    { id: 'dept_demo_eng', code: 'อ', name: 'กลุ่มสาระฯ ภาษาต่างประเทศ', color: '#7858C4' },
    { id: 'dept_demo_soc', code: 'ส', name: 'กลุ่มสาระฯ สังคมศึกษา ศาสนา และวัฒนธรรม', color: '#B57428' },
    { id: 'dept_demo_act', code: 'ก', name: 'สุขศึกษา พลศึกษา และกิจกรรมพัฒนาผู้เรียน', color: '#C95D75' },
  ];
  for (const d of depts) sub.departments[d.id] = { ...d, createdAt: now, updatedAt: now };

  const teachers = [
    { id: 'tch_demo_1', code: 'T001', firstName: 'สมชาย', lastName: 'ใจดี', departmentId: 'dept_demo_math', position: 'ครูชำนาญการ (ฝ่ายจัดตารางสอน)', maxHoursPerWeek: 20, email: 'scheduler.demo@kruschedule.app' },
    { id: 'tch_demo_2', code: 'T002', firstName: 'นภาพร', lastName: 'วิทยา', departmentId: 'dept_demo_sci', position: 'ครูชำนาญการ', maxHoursPerWeek: 20, email: 'napaporn.demo@kruschedule.app' },
    { id: 'tch_demo_3', code: 'T003', firstName: 'กิตติศักดิ์', lastName: 'อักษร', departmentId: 'dept_demo_thai', position: 'ครู คศ.1', maxHoursPerWeek: 18, email: 'kittisak.demo@kruschedule.app' },
    { id: 'tch_demo_4', code: 'T004', firstName: 'ศิริพร', lastName: 'ภาษาทอง', departmentId: 'dept_demo_eng', position: 'ครูชำนาญการ', maxHoursPerWeek: 20, email: 'siriporn.demo@kruschedule.app' },
    { id: 'tch_demo_5', code: 'T005', firstName: 'ธนากร', lastName: 'โค้ดดิ้ง', departmentId: 'dept_demo_sci', position: 'ครูผู้ช่วย', maxHoursPerWeek: 18, email: 'thanakorn.demo@kruschedule.app' },
    { id: 'tch_demo_6', code: 'T006', firstName: 'อรทัย', lastName: 'วัฒนธรรม', departmentId: 'dept_demo_soc', position: 'ครูชำนาญการ', maxHoursPerWeek: 18, email: 'orathai.demo@kruschedule.app' },
    { id: 'tch_demo_7', code: 'T007', firstName: 'ปิยะ', lastName: 'พลศึกษา', departmentId: 'dept_demo_act', position: 'ครู คศ.1', maxHoursPerWeek: 20, email: 'piya.demo@kruschedule.app' },
    { id: 'tch_demo_8', code: 'T008', firstName: 'วิชัย', lastName: 'แนะแนว', departmentId: 'dept_demo_act', position: 'ครูแนะแนว', maxHoursPerWeek: 16, email: 'wichai.demo@kruschedule.app' },
  ];
  for (const t of teachers) sub.teachers[t.id] = { ...t, createdAt: now, updatedAt: now };

  const subjects = [
    { id: 'subj_demo_1', code: 'ค21101', name: 'คณิตศาสตร์พื้นฐาน 1', departmentId: 'dept_demo_math', gradeLevel: 'ม.1', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_1', color: '#4A7BD0' },
    { id: 'subj_demo_2', code: 'ว21101', name: 'วิทยาศาสตร์พื้นฐาน 1', departmentId: 'dept_demo_sci', gradeLevel: 'ม.1', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_2', color: '#2E8B71' },
    { id: 'subj_demo_3', code: 'ท21101', name: 'ภาษาไทยพื้นฐาน 1', departmentId: 'dept_demo_thai', gradeLevel: 'ม.1', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_3', color: '#D98245' },
    { id: 'subj_demo_4', code: 'อ21101', name: 'ภาษาอังกฤษพื้นฐาน 1', departmentId: 'dept_demo_eng', gradeLevel: 'ม.1', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_4', color: '#7858C4' },
    { id: 'subj_demo_5', code: 'ว21103', name: 'วิทยาการคำนวณ 1', departmentId: 'dept_demo_sci', gradeLevel: 'ม.1', credits: 0.5, hoursPerWeek: 2, defaultTeacherId: 'tch_demo_5', color: '#3A8A9C' },
    { id: 'subj_demo_6', code: 'ส21101', name: 'สังคมศึกษา 1', departmentId: 'dept_demo_soc', gradeLevel: 'ม.1', credits: 1.0, hoursPerWeek: 2, defaultTeacherId: 'tch_demo_6', color: '#B57428' },
    { id: 'subj_demo_7', code: 'พ21101', name: 'สุขศึกษาและพลศึกษา 1', departmentId: 'dept_demo_act', gradeLevel: 'ม.1', credits: 0.5, hoursPerWeek: 2, defaultTeacherId: 'tch_demo_7', color: '#C95D75' },
    { id: 'subj_demo_8', code: 'ค22101', name: 'คณิตศาสตร์พื้นฐาน 3', departmentId: 'dept_demo_math', gradeLevel: 'ม.2', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_1', color: '#4A7BD0' },
    { id: 'subj_demo_9', code: 'ว22101', name: 'วิทยาศาสตร์พื้นฐาน 3', departmentId: 'dept_demo_sci', gradeLevel: 'ม.2', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_2', color: '#2E8B71' },
    { id: 'subj_demo_10', code: 'อ22101', name: 'ภาษาอังกฤษพื้นฐาน 3', departmentId: 'dept_demo_eng', gradeLevel: 'ม.2', credits: 1.5, hoursPerWeek: 3, defaultTeacherId: 'tch_demo_4', color: '#7858C4' },
  ];
  for (const s of subjects) sub.subjects[s.id] = { ...s, createdAt: now, updatedAt: now };

  const classrooms = [
    { id: 'cls_demo_1', name: 'ม.1/1', gradeLevel: 'ม.1', homeroomTeacherId: 'tch_demo_1', studentCount: 36 },
    { id: 'cls_demo_2', name: 'ม.1/2', gradeLevel: 'ม.1', homeroomTeacherId: 'tch_demo_3', studentCount: 35 },
    { id: 'cls_demo_3', name: 'ม.2/1', gradeLevel: 'ม.2', homeroomTeacherId: 'tch_demo_2', studentCount: 34 },
    { id: 'cls_demo_4', name: 'ม.2/2', gradeLevel: 'ม.2', homeroomTeacherId: 'tch_demo_4', studentCount: 36 },
  ];
  for (const c of classrooms) sub.classrooms[c.id] = { ...c, createdAt: now, updatedAt: now };

  const rooms = [
    { id: 'room_demo_1', code: 'R101', name: 'ห้องเรียน 101', building: 'อาคาร 1', floor: '1', roomType: 'ห้องเรียนปกติ', capacity: 40 },
    { id: 'room_demo_2', code: 'R102', name: 'ห้องเรียน 102', building: 'อาคาร 1', floor: '1', roomType: 'ห้องเรียนปกติ', capacity: 40 },
    { id: 'room_demo_3', code: 'R201', name: 'ห้องเรียน 201', building: 'อาคาร 1', floor: '2', roomType: 'ห้องเรียนปกติ', capacity: 40 },
    { id: 'room_demo_4', code: 'R202', name: 'ห้องเรียน 202', building: 'อาคาร 1', floor: '2', roomType: 'ห้องเรียนปกติ', capacity: 40 },
    { id: 'room_demo_5', code: 'SCI01', name: 'ห้องปฏิบัติการวิทยาศาสตร์', building: 'อาคาร 2', floor: '2', roomType: 'ห้องปฏิบัติการวิทย์', capacity: 42 },
    { id: 'room_demo_6', code: 'COM01', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 1', building: 'อาคาร 2', floor: '3', roomType: 'ห้องคอมพิวเตอร์', capacity: 40 },
  ];
  for (const r of rooms) sub.rooms[r.id] = { ...r, createdAt: now, updatedAt: now };

  sub.activities['act_demo_1'] = {
    id: 'act_demo_1',
    academicYearId: targetYearId,
    name: 'ลูกเสือ-เนตรนารี',
    category: 'ลูกเสือและเนตรนารี',
    scope: 'grade_level',
    targetGradeLevel: 'ม.1',
    targetClassroomId: '',
    dayOfWeek: 3,
    periodNumber: 8,
    venue: 'สนามโรงเรียน',
    roomId: '',
    createdAt: now,
    updatedAt: now,
  };
  sub.activities['act_demo_2'] = {
    id: 'act_demo_2',
    academicYearId: targetYearId,
    name: 'กิจกรรมชุมนุมและแนะแนว',
    category: 'ชุมนุม',
    scope: 'whole_school',
    targetGradeLevel: '',
    targetClassroomId: '',
    dayOfWeek: 5,
    periodNumber: 8,
    venue: 'ห้องประชุมใหญ่',
    roomId: '',
    createdAt: now,
    updatedAt: now,
  };

  const ttSeed = [
    { id: 'tt_demo_1', dayOfWeek: 1, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'subj_demo_1', teacherId: 'tch_demo_1', roomId: 'room_demo_1' },
    { id: 'tt_demo_2', dayOfWeek: 1, periodNumber: 2, classroomId: 'cls_demo_1', subjectId: 'subj_demo_3', teacherId: 'tch_demo_3', roomId: 'room_demo_1' },
    { id: 'tt_demo_3', dayOfWeek: 1, periodNumber: 3, classroomId: 'cls_demo_1', subjectId: 'subj_demo_4', teacherId: 'tch_demo_4', roomId: 'room_demo_1' },
    { id: 'tt_demo_4', dayOfWeek: 2, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'subj_demo_2', teacherId: 'tch_demo_2', roomId: 'room_demo_5' },
    { id: 'tt_demo_5', dayOfWeek: 2, periodNumber: 2, classroomId: 'cls_demo_1', subjectId: 'subj_demo_5', teacherId: 'tch_demo_5', roomId: 'room_demo_6' },
    { id: 'tt_demo_6', dayOfWeek: 3, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'subj_demo_1', teacherId: 'tch_demo_1', roomId: 'room_demo_1' },
    { id: 'tt_demo_7', dayOfWeek: 4, periodNumber: 2, classroomId: 'cls_demo_1', subjectId: 'subj_demo_6', teacherId: 'tch_demo_6', roomId: 'room_demo_1' },
    { id: 'tt_demo_8', dayOfWeek: 5, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'subj_demo_7', teacherId: 'tch_demo_7', roomId: 'room_demo_1' },
    { id: 'tt_demo_9', dayOfWeek: 1, periodNumber: 1, classroomId: 'cls_demo_2', subjectId: 'subj_demo_4', teacherId: 'tch_demo_4', roomId: 'room_demo_2' },
    { id: 'tt_demo_10', dayOfWeek: 1, periodNumber: 2, classroomId: 'cls_demo_2', subjectId: 'subj_demo_1', teacherId: 'tch_demo_1', roomId: 'room_demo_2' },
    { id: 'tt_demo_11', dayOfWeek: 2, periodNumber: 3, classroomId: 'cls_demo_2', subjectId: 'subj_demo_2', teacherId: 'tch_demo_2', roomId: 'room_demo_5' },
    { id: 'tt_demo_12', dayOfWeek: 3, periodNumber: 2, classroomId: 'cls_demo_2', subjectId: 'subj_demo_3', teacherId: 'tch_demo_3', roomId: 'room_demo_2' },
    { id: 'tt_demo_13', dayOfWeek: 2, periodNumber: 1, classroomId: 'cls_demo_3', subjectId: 'subj_demo_8', teacherId: 'tch_demo_1', roomId: 'room_demo_3' },
    { id: 'tt_demo_14', dayOfWeek: 4, periodNumber: 1, classroomId: 'cls_demo_3', subjectId: 'subj_demo_9', teacherId: 'tch_demo_2', roomId: 'room_demo_5' },
  ];
  for (const item of ttSeed) {
    sub.timetables[item.id] = {
      ...item,
      academicYearId: targetYearId,
      revision: 1,
      updatedBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    };
  }

  sub.members['sample_scheduler_01'] = {
    uid: 'sample_scheduler_01',
    email: 'scheduler.demo@kruschedule.app',
    displayName: 'อ.สมชาย ใจดี (ผู้จัดตารางสอนตัวอย่าง)',
    role: 'scheduler',
    status: 'active',
    teacherId: 'tch_demo_1',
    createdAt: now,
    updatedAt: now,
  };
  sub.members['sample_teacher_01'] = {
    uid: 'sample_teacher_01',
    email: 'napaporn.demo@kruschedule.app',
    displayName: 'อ.นภาพร วิทยา (ครูผู้สอนตัวอย่าง)',
    role: 'teacher',
    status: 'active',
    teacherId: 'tch_demo_2',
    createdAt: now,
    updatedAt: now,
  };

  if (store.schools[schoolId]) {
    store.schools[schoolId].teacherCount = teachers.length;
    store.schools[schoolId].updatedAt = now;
  }

  return {
    teacherCount: teachers.length,
    subjectCount: subjects.length,
    classroomCount: classrooms.length,
    roomCount: rooms.length,
    timetableCount: ttSeed.length,
  };
}

interface PaymentSessionRecord {
  sessionId: string;
  paymentId: string;
  schoolId: string;
  planId: string;
  amount: number;
  uid: string;
  status: 'created' | 'verified';
  createdAt: number;
  verifiedAt?: number;
  signature?: string;
}

const paymentSessions = new Map<string, PaymentSessionRecord>();
const processedWebhooks = new Set<string>();

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', GATEWAY_SECRET).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const requireUser = (req: express.Request, res: express.Response): StoredUser | null => {
    const verified = verifyAuthToken(req.headers.authorization);
    if (!verified) {
      res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Username และ Password ก่อนใช้งาน' });
      return null;
    }
    const user = store.users[verified.uid];
    if (!user) {
      res.status(401).json({ error: 'ไม่พบข้อมูลบัญชีผู้ใช้งาน' });
      return null;
    }
    return user;
  };

  const requireSuperAdmin = (req: express.Request, res: express.Response): StoredUser | null => {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role !== 'super_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะเจ้าของและผู้ดูแลระบบหลัก (Super Admin)' });
      return null;
    }
    return user;
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ระบบจัดตารางสอน API', timestamp: new Date().toISOString() });
  });

  // ---------------------------------------------------------
  // Username / Password Authentication Endpoints
  // ---------------------------------------------------------
  app.get('/api/auth/bootstrap-status', (_req, res) => {
    const hasClaimed = Boolean(getClaimedSuperAdmin()?.passwordHash);
    const needsAdminSetup = !ENV_ADMIN_PASSWORD && !hasClaimed;
    res.json({
      needsAdminSetup,
      adminUsername: ENV_ADMIN_USERNAME,
    });
  });

  app.post('/api/auth/setup-admin', (req, res) => {
    const hasClaimed = Boolean(getClaimedSuperAdmin()?.passwordHash);
    if (ENV_ADMIN_PASSWORD || hasClaimed) {
      res.status(409).json({ error: 'บัญชี Super Admin ถูกตั้งค่าไว้แล้ว กรุณาเข้าสู่ระบบตามปกติ' });
      return;
    }

    const { username, password, displayName } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
    };

    const cleanUsername = (username || ENV_ADMIN_USERNAME).trim();
    if (!isValidUsername(cleanUsername)) {
      res.status(400).json({ error: 'Username ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - ความยาว 3–64 ตัวอักษร' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีความยาว 6–128 ตัวอักษร' });
      return;
    }

    const now = new Date().toISOString();
    const adminUser: StoredUser = {
      uid: 'usr_super_admin',
      username: cleanUsername,
      email: `${cleanUsername}@system.local`,
      displayName: (displayName || 'เจ้าของและผู้ดูแลระบบหลัก (Super Admin)').trim().slice(0, 150),
      role: 'super_admin',
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
    store.users[adminUser.uid] = adminUser;
    persistStore();

    const token = signAuthToken(adminUser);
    res.json({ token, user: toPublicUser(adminUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanInput = (username || '').trim();
    if (!cleanInput || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'กรุณากรอก Username และ Password' });
      return;
    }

    // 1. Env-configured Super Admin always takes precedence if set
    if (
      ENV_ADMIN_PASSWORD &&
      cleanInput.toLowerCase() === ENV_ADMIN_USERNAME.toLowerCase() &&
      constantTimeCompareSecret(password, ENV_ADMIN_PASSWORD)
    ) {
      const adminUser = ensureEnvSuperAdminUser();
      const token = signAuthToken(adminUser);
      res.json({ token, user: toPublicUser(adminUser) });
      return;
    }

    // 2. Standard scrypt verification against stored users
    const found = Object.values(store.users).find(
      (u) =>
        u.username.toLowerCase() === cleanInput.toLowerCase() ||
        u.email.toLowerCase() === cleanInput.toLowerCase()
    );
    if (!found || !found.passwordHash || !verifyPassword(password, found.passwordHash)) {
      res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' });
      return;
    }

    const token = signAuthToken(found);
    res.json({ token, user: toPublicUser(found) });
  });

  app.post('/api/auth/signup', (req, res) => {
    const { username, password, displayName, email } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      email?: string;
    };

    const cleanUsername = (username || '').trim();
    if (!isValidUsername(cleanUsername)) {
      res.status(400).json({ error: 'Username ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ . - ความยาว 3–64 ตัวอักษร' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
      return;
    }
    if (cleanUsername.toLowerCase() === ENV_ADMIN_USERNAME.toLowerCase()) {
      res.status(409).json({ error: 'Username นี้สงวนสิทธิ์สำหรับผู้ดูแลระบบหลัก' });
      return;
    }

    const duplicate = Object.values(store.users).find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: `Username "${cleanUsername}" ถูกใช้งานแล้ว` });
      return;
    }

    const now = new Date().toISOString();
    const uid = generateId('usr');
    const cleanEmail = (email || `${cleanUsername}@kruschedule.local`).trim().slice(0, 200);
    const newUser: StoredUser = {
      uid,
      username: cleanUsername,
      email: cleanEmail,
      displayName: (displayName || cleanUsername).trim().slice(0, 150),
      role: 'school_admin',
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
    store.users[uid] = newUser;
    persistStore();

    const token = signAuthToken(newUser);
    res.json({ token, user: toPublicUser(newUser) });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ user: toPublicUser(user) });
  });

  // ---------------------------------------------------------
  // Public Catalog & Branding Endpoints (Non-PII)
  // ---------------------------------------------------------
  app.get('/api/public/bootstrap', (_req, res) => {
    const plans = Object.values(store.plans)
      .filter((p) => p.isActive !== false)
      .sort((a, b) => Number(a.priceAnnual || 0) - Number(b.priceAnnual || 0));
    const hasClaimed = Boolean(getClaimedSuperAdmin()?.passwordHash);
    res.json({
      plans,
      platformSettings: store.platformSettings,
      needsAdminSetup: !ENV_ADMIN_PASSWORD && !hasClaimed,
      adminUsername: ENV_ADMIN_USERNAME,
    });
  });

  app.get('/api/public/slug/:slug', (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidSlug(slug)) {
      res.status(400).json({ error: 'Invalid school slug' });
      return;
    }
    const branding = store.schoolSlugs[slug];
    if (!branding) {
      res.status(404).json({ error: 'School not found' });
      return;
    }
    res.json({ branding });
  });

  // ---------------------------------------------------------
  // Tenant & School Management Endpoints
  // ---------------------------------------------------------
  app.get('/api/schools/mine', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { schoolId } = req.query as { schoolId?: string };

    let targetSchool: StoredSchool | undefined;
    if (schoolId && isValidId(schoolId)) {
      if (user.role === 'super_admin' || getUserSchoolRole(schoolId, user)) {
        targetSchool = store.schools[schoolId];
      }
    } else if (user.schoolId && store.schools[user.schoolId]) {
      targetSchool = store.schools[user.schoolId];
    } else {
      targetSchool = Object.values(store.schools).find((s) => s.ownerUid === user.uid);
    }

    if (!targetSchool) {
      res.json({ school: null, member: null });
      return;
    }

    const sub = getSchoolSubcollections(targetSchool.id);
    const member = sub.members[user.uid] || null;
    res.json({ school: targetSchool, member });
  });

  app.post('/api/schools', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const { nameTh, nameEn, slug, province, phone, planId } = req.body as {
      nameTh?: string;
      nameEn?: string;
      slug?: string;
      province?: string;
      phone?: string;
      planId?: string;
    };

    const cleanSlug = String(slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);

    if (!nameTh || nameTh.trim().length < 2) {
      res.status(400).json({ error: 'กรุณากรอกชื่อโรงเรียนอย่างน้อย 2 ตัวอักษร' });
      return;
    }
    if (!isValidSlug(cleanSlug)) {
      res.status(400).json({ error: 'Subdomain ต้องเป็นภาษาอังกฤษพิมพ์เล็กหรือตัวเลขอย่างน้อย 2 ตัวอักษร' });
      return;
    }
    if (store.schoolSlugs[cleanSlug]) {
      res.status(409).json({ error: `Subdomain "${cleanSlug}" ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น` });
      return;
    }

    const schoolId = generateId('sch');
    const subId = generateId('sub');
    const trialDays = Number(store.platformSettings.trialDays || 14);
    const now = new Date().toISOString();
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const nowYear = String(new Date().getFullYear() + 543);
    const chosenPlan = typeof planId === 'string' && store.plans[planId] ? planId : 'professional';

    const school: StoredSchool = {
      id: schoolId,
      slug: cleanSlug,
      ownerUid: user.uid,
      nameTh: nameTh.trim().slice(0, 200),
      nameEn: (nameEn || '').trim().slice(0, 200),
      province: (province || '').trim().slice(0, 100),
      phone: (phone || '').trim().slice(0, 40),
      email: user.email,
      academicYear: nowYear,
      semester: '1',
      primaryColor: '#4A7BD0',
      secondaryColor: '#7DB2F0',
      welcomeMessage: `ยินดีต้อนรับสู่ระบบตารางสอนออนไลน์ ${nameTh.trim().slice(0, 100)}`,
      planId: chosenPlan,
      subscriptionStatus: 'trialing',
      trialEndsAt,
      teacherCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.schools[schoolId] = school;
    store.schoolSlugs[cleanSlug] = {
      slug: cleanSlug,
      schoolId,
      ownerUid: user.uid,
      nameTh: school.nameTh,
      nameEn: school.nameEn,
      primaryColor: school.primaryColor,
      secondaryColor: school.secondaryColor,
      welcomeMessage: school.welcomeMessage,
      updatedAt: now,
    };

    const sub = getSchoolSubcollections(schoolId);
    sub.members[user.uid] = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: 'school_admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    store.subscriptions[subId] = {
      id: subId,
      schoolId,
      ownerUid: user.uid,
      planId: chosenPlan,
      status: 'trialing',
      trialEndsAt,
      autoRenew: false,
      createdAt: now,
      updatedAt: now,
    };

    if (user.role !== 'super_admin') {
      user.schoolId = schoolId;
      user.schoolSlug = cleanSlug;
      user.updatedAt = now;
    }

    seedDefaultSchoolCore(schoolId);
    recordAudit(
      schoolId,
      user,
      'TENANT_CREATED',
      'school',
      schoolId,
      `สมัครเปิดใช้งานโรงเรียน ${school.nameTh} (${cleanSlug}) ทดลองใช้ ${trialDays} วัน`
    );
    persistStore();

    res.json({ schoolId, slug: cleanSlug, school });
  });

  app.post('/api/schools/demo', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;

    const { slug: requestedSlug, nameTh } = (req.body || {}) as {
      slug?: string;
      nameTh?: string;
    };

    const base = (requestedSlug || 'demo-school').toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
    const candidates = [base, `${base}-2`, `${base}-3`, `${base}-${crypto.randomBytes(2).toString('hex')}`];
    const cleanSlug = candidates.find((c) => isValidSlug(c) && !store.schoolSlugs[c]) || `${base}-${Date.now().toString(36).slice(-4)}`;

    const schoolId = generateId('sch_demo');
    const subId = generateId('sub_demo');
    const now = new Date().toISOString();
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowYear = String(new Date().getFullYear() + 543);
    const schoolName = (nameTh || '').trim() || 'โรงเรียนสาธิตทดลองจัดตาราง (Demo School)';

    const school: StoredSchool = {
      id: schoolId,
      slug: cleanSlug,
      ownerUid: user.uid,
      nameTh: schoolName,
      nameEn: 'KruSchedule Demo Sandbox School',
      province: 'กรุงเทพมหานคร',
      phone: '02-000-2569',
      email: user.email,
      academicYear: nowYear,
      semester: '1',
      primaryColor: '#4A7BD0',
      secondaryColor: '#7DB2F0',
      welcomeMessage: `ยินดีต้อนรับสู่พื้นที่ทดลองจัดตารางสอน — ${schoolName}`,
      planId: 'premium',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      teacherCount: 8,
      createdAt: now,
      updatedAt: now,
    };

    store.schools[schoolId] = school;
    store.schoolSlugs[cleanSlug] = {
      slug: cleanSlug,
      schoolId,
      ownerUid: user.uid,
      nameTh: schoolName,
      nameEn: school.nameEn,
      primaryColor: school.primaryColor,
      secondaryColor: school.secondaryColor,
      welcomeMessage: school.welcomeMessage,
      updatedAt: now,
    };

    const sub = getSchoolSubcollections(schoolId);
    sub.members[user.uid] = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: 'school_admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    store.subscriptions[subId] = {
      id: subId,
      schoolId,
      ownerUid: user.uid,
      planId: 'premium',
      status: 'trialing',
      trialEndsAt,
      autoRenew: false,
      createdAt: now,
      updatedAt: now,
    };

    const counts = seedDemoSchedulingSampleData(schoolId, user);
    recordAudit(
      schoolId,
      user,
      'DEMO_SANDBOX_CREATED',
      'school',
      schoolId,
      `สร้างโรงเรียนตัวอย่าง ${schoolName} (${cleanSlug}) พร้อม User ตัวอย่างสำหรับทดลองจัดตารางสอน`
    );
    persistStore();

    res.json({
      schoolId,
      slug: cleanSlug,
      schoolName,
      ...counts,
      sampleUsers: [
        {
          uid: 'sample_scheduler_01',
          displayName: 'อ.สมชาย ใจดี (ผู้จัดตารางสอนตัวอย่าง)',
          email: 'scheduler.demo@kruschedule.app',
          role: 'scheduler',
          teacherId: 'tch_demo_1',
          description: 'จัดตารางสอน Drag & Drop, Auto-Schedule, ล็อกคาบกิจกรรม, ดูรายงาน',
        },
        {
          uid: 'sample_teacher_01',
          displayName: 'อ.นภาพร วิทยา (ครูผู้สอนตัวอย่าง)',
          email: 'napaporn.demo@kruschedule.app',
          role: 'teacher',
          teacherId: 'tch_demo_2',
          description: 'ดูตารางสอนรายบุคคลและตารางโรงเรียนแบบอ่านอย่างเดียว',
        },
      ],
    });
  });

  app.post('/api/schools/:schoolId/seed-demo', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    if (!isValidId(schoolId) || !store.schools[schoolId]) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียนหรือเจ้าของระบบ' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(store.schools[schoolId])) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const { academicYearId } = (req.body || {}) as { academicYearId?: string };
    const counts = seedDemoSchedulingSampleData(schoolId, user, academicYearId);
    recordAudit(schoolId, user, 'SEED_DEMO_SCHEDULING_DATA', 'school', schoolId, 'เติมข้อมูลและ User ตัวอย่างสำหรับทดลองจัดตาราง');
    persistStore();

    res.json({
      schoolId,
      slug: store.schools[schoolId].slug,
      schoolName: store.schools[schoolId].nameTh,
      ...counts,
      sampleUsers: [
        {
          uid: 'sample_scheduler_01',
          displayName: 'อ.สมชาย ใจดี (ผู้จัดตารางสอนตัวอย่าง)',
          email: 'scheduler.demo@kruschedule.app',
          role: 'scheduler',
          teacherId: 'tch_demo_1',
          description: 'จัดตารางสอน Drag & Drop, Auto-Schedule, ล็อกคาบกิจกรรม, ดูรายงาน',
        },
        {
          uid: 'sample_teacher_01',
          displayName: 'อ.นภาพร วิทยา (ครูผู้สอนตัวอย่าง)',
          email: 'napaporn.demo@kruschedule.app',
          role: 'teacher',
          teacherId: 'tch_demo_2',
          description: 'ดูตารางสอนรายบุคคลและตารางโรงเรียนแบบอ่านอย่างเดียว',
        },
      ],
    });
  });

  app.get('/api/schools/:schoolId/workspace', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    if (!isValidId(schoolId) || !store.schools[schoolId]) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (!role) {
      res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลโรงเรียนนี้' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    const sortByField = <T extends Record<string, unknown>>(list: T[], field: string) =>
      [...list].sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')));

    const auditLogs =
      role === 'super_admin' || role === 'school_admin'
        ? Object.values(store.auditLogs)
            .filter((l) => l.schoolId === schoolId)
            .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')))
        : [];

    res.json({
      academicYears: sortByField(Object.values(sub.academicYears), 'year'),
      departments: sortByField(Object.values(sub.departments), 'name'),
      teachers: sortByField(Object.values(sub.teachers), 'code'),
      subjects: sortByField(Object.values(sub.subjects), 'code'),
      classrooms: sortByField(Object.values(sub.classrooms), 'name'),
      rooms: sortByField(Object.values(sub.rooms), 'code'),
      timeSlots: Object.values(sub.timeSlots).sort(
        (a, b) => Number(a.periodNumber || 0) - Number(b.periodNumber || 0)
      ),
      activities: Object.values(sub.activities),
      timetables: Object.values(sub.timetables),
      scheduleVersions: Object.values(sub.scheduleVersions).sort(
        (a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || ''))
      ),
      scheduleHistory: Object.values(sub.scheduleHistory).sort(
        (a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || ''))
      ),
      members: Object.values(sub.members),
      invites: Object.values(sub.invites),
      auditLogs,
    });
  });

  app.patch('/api/schools/:schoolId/branding', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const allowedKeys = [
      'nameTh', 'nameEn', 'schoolCode', 'affiliation', 'address', 'province',
      'district', 'subdistrict', 'postalCode', 'phone', 'email', 'website',
      'directorName', 'academicYear', 'semester', 'logoUrl', 'loginCoverUrl',
      'backgroundUrl', 'primaryColor', 'secondaryColor', 'welcomeMessage',
    ] as const;

    const body = (req.body || {}) as Record<string, unknown>;
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        if ((key === 'logoUrl' || key === 'loginCoverUrl' || key === 'backgroundUrl') && !isSafeMediaUrl(body[key])) {
          res.status(400).json({ error: 'รูปแบบ URL รูปภาพไม่ถูกต้อง' });
          return;
        }
        (school as unknown as Record<string, unknown>)[key] = String(body[key]).slice(
          0,
          key.endsWith('Url') ? 900000 : 400
        );
      }
    }
    school.updatedAt = new Date().toISOString();

    const slugDoc = store.schoolSlugs[school.slug];
    if (slugDoc) {
      slugDoc.nameTh = school.nameTh;
      slugDoc.nameEn = school.nameEn;
      slugDoc.logoUrl = school.logoUrl;
      slugDoc.loginCoverUrl = school.loginCoverUrl;
      slugDoc.backgroundUrl = school.backgroundUrl;
      slugDoc.primaryColor = school.primaryColor;
      slugDoc.secondaryColor = school.secondaryColor;
      slugDoc.welcomeMessage = school.welcomeMessage;
      slugDoc.updatedAt = school.updatedAt;
    }

    recordAudit(schoolId, user, 'UPDATE_BRANDING_PROFILE', 'school', schoolId, 'อัปเดตข้อมูลโรงเรียนและอัตลักษณ์ (FR-09)');
    persistStore();
    res.json({ school });
  });

  app.put('/api/schools/:schoolId/collections/:col/:docId', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const col = String(req.params.col || '') as keyof SchoolSubcollections;
    const docId = String(req.params.docId || '');

    if (!isValidId(schoolId) || !isValidId(docId) || !ALLOWED_COLLECTIONS.has(col)) {
      res.status(400).json({ error: 'พารามิเตอร์ไม่ถูกต้อง' });
      return;
    }
    const school = store.schools[schoolId];
    if (!school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    const allowedRole =
      role === 'super_admin' ||
      role === 'school_admin' ||
      (role === 'scheduler' && SCHEDULER_WRITABLE_COLLECTIONS.has(col));
    if (!allowedRole) {
      res.status(403).json({ error: 'บทบาทของคุณไม่มีสิทธิ์แก้ไขข้อมูลส่วนนี้' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว ไม่สามารถบันทึกข้อมูลได้' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    const existingDoc = sub[col][docId] || {};
    const now = new Date().toISOString();
    const payload = { ...(req.body as Record<string, unknown>) };
    delete payload.createdAt;
    delete payload.updatedAt;

    sub[col][docId] = {
      ...existingDoc,
      ...payload,
      id: docId,
      createdAt: (existingDoc as { createdAt?: string }).createdAt || now,
      updatedAt: now,
    };

    if (col === 'teachers') {
      school.teacherCount = Object.keys(sub.teachers).length;
      school.updatedAt = now;
    }

    persistStore();
    res.json({ item: sub[col][docId] });
  });

  app.delete('/api/schools/:schoolId/collections/:col/:docId', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const col = String(req.params.col || '') as keyof SchoolSubcollections;
    const docId = String(req.params.docId || '');

    if (!isValidId(schoolId) || !isValidId(docId) || !ALLOWED_COLLECTIONS.has(col)) {
      res.status(400).json({ error: 'พารามิเตอร์ไม่ถูกต้อง' });
      return;
    }
    const school = store.schools[schoolId];
    if (!school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    const allowedRole =
      role === 'super_admin' ||
      role === 'school_admin' ||
      (role === 'scheduler' && SCHEDULER_WRITABLE_COLLECTIONS.has(col));
    if (!allowedRole) {
      res.status(403).json({ error: 'บทบาทของคุณไม่มีสิทธิ์ลบข้อมูลส่วนนี้' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    delete sub[col][docId];
    if (col === 'teachers') {
      school.teacherCount = Object.keys(sub.teachers).length;
      school.updatedAt = new Date().toISOString();
    }
    persistStore();
    res.json({ ok: true });
  });

  app.post('/api/schools/:schoolId/academic-years/:yearId/activate', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const yearId = String(req.params.yearId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !isValidId(yearId) || !school) {
      res.status(404).json({ error: 'ไม่พบข้อมูล' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    const now = new Date().toISOString();
    for (const [id, ay] of Object.entries(sub.academicYears)) {
      ay.isActive = id === yearId;
      ay.updatedAt = now;
    }
    const activeAy = sub.academicYears[yearId];
    if (activeAy) {
      school.academicYear = String(activeAy.year || school.academicYear);
      school.semester = String(activeAy.semester || school.semester);
      school.updatedAt = now;
    }
    persistStore();
    res.json({ ok: true });
  });

  app.post('/api/schools/:schoolId/timetables/save', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้จัดตารางสอนหรือผู้ดูแลโรงเรียน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const { entry, expectedRevision } = req.body as {
      entry?: Record<string, unknown>;
      expectedRevision?: number | null;
    };
    const entryId = String(entry?.id || '');
    if (!isValidId(entryId)) {
      res.status(400).json({ error: 'รหัสคาบเรียนไม่ถูกต้อง' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    const existing = sub.timetables[entryId];
    const now = new Date().toISOString();

    if (existing) {
      const currentRev = Number(existing.revision || 1);
      if (expectedRevision !== null && expectedRevision !== undefined && currentRev !== expectedRevision) {
        res.status(409).json({ error: 'ข้อมูลคาบเรียนนี้ถูกแก้ไขโดยผู้ใช้อื่นแล้ว กรุณารีเฟรชและลองใหม่อีกครั้ง' });
        return;
      }
      sub.timetables[entryId] = {
        ...existing,
        academicYearId: entry?.academicYearId,
        dayOfWeek: Number(entry?.dayOfWeek),
        periodNumber: Number(entry?.periodNumber),
        classroomId: entry?.classroomId,
        subjectId: entry?.subjectId,
        teacherId: entry?.teacherId,
        roomId: String(entry?.roomId || ''),
        revision: currentRev + 1,
        updatedBy: user.uid,
        updatedAt: now,
      };
    } else {
      sub.timetables[entryId] = {
        id: entryId,
        academicYearId: entry?.academicYearId,
        dayOfWeek: Number(entry?.dayOfWeek),
        periodNumber: Number(entry?.periodNumber),
        classroomId: entry?.classroomId,
        subjectId: entry?.subjectId,
        teacherId: entry?.teacherId,
        roomId: String(entry?.roomId || ''),
        revision: 1,
        updatedBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };
    }

    persistStore();
    res.json({ entry: sub.timetables[entryId] });
  });

  app.post('/api/schools/:schoolId/history', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    if (!isValidId(schoolId) || !store.schools[schoolId]) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler') {
      res.status(403).json({ error: 'ไม่มีสิทธิ์บันทึกประวัติตาราง' });
      return;
    }
    const { academicYearId, action, summary } = req.body as {
      academicYearId?: string;
      action?: string;
      summary?: string;
    };
    const sub = getSchoolSubcollections(schoolId);
    const id = generateId('hist');
    sub.scheduleHistory[id] = {
      id,
      academicYearId: String(academicYearId || ''),
      action: String(action || '').slice(0, 80),
      summary: String(summary || '').slice(0, 300),
      actorUid: user.uid,
      actorEmail: user.username,
      createdAt: new Date().toISOString(),
    };
    persistStore();
    res.json({ ok: true });
  });

  app.post('/api/schools/:schoolId/versions', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler') {
      res.status(403).json({ error: 'ไม่มีสิทธิ์สำรองเวอร์ชัน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const { academicYearId, name, entries } = req.body as {
      academicYearId?: string;
      name?: string;
      entries?: Array<Record<string, unknown>>;
    };
    const sub = getSchoolSubcollections(schoolId);
    const id = generateId('ver');
    const now = new Date().toISOString();
    const snapshots = (Array.isArray(entries) ? entries : []).slice(0, 800).map((e) => ({
      dayOfWeek: Number(e.dayOfWeek),
      periodNumber: Number(e.periodNumber),
      classroomId: String(e.classroomId || ''),
      subjectId: String(e.subjectId || ''),
      teacherId: String(e.teacherId || ''),
      roomId: String(e.roomId || ''),
    }));

    sub.scheduleVersions[id] = {
      id,
      academicYearId: String(academicYearId || ''),
      name: String(name || 'Snapshot').slice(0, 150),
      entryCount: snapshots.length,
      entries: snapshots,
      createdBy: user.uid,
      createdAt: now,
    };

    const histId = generateId('hist');
    sub.scheduleHistory[histId] = {
      id: histId,
      academicYearId: String(academicYearId || ''),
      action: 'SAVE_VERSION',
      summary: `บันทึกเวอร์ชันสำรอง "${name}" (${snapshots.length} คาบ)`,
      actorUid: user.uid,
      actorEmail: user.username,
      createdAt: now,
    };

    persistStore();
    res.json({ version: sub.scheduleVersions[id] });
  });

  app.post('/api/schools/:schoolId/versions/:versionId/restore', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const versionId = String(req.params.versionId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !isValidId(versionId) || !school) {
      res.status(404).json({ error: 'ไม่พบข้อมูล' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler') {
      res.status(403).json({ error: 'ไม่มีสิทธิ์กู้คืนเวอร์ชัน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const sub = getSchoolSubcollections(schoolId);
    const version = sub.scheduleVersions[versionId] as {
      academicYearId: string;
      name: string;
      entries: Array<Record<string, unknown>>;
    } | undefined;
    if (!version) {
      res.status(404).json({ error: 'ไม่พบเวอร์ชันสำรองที่ระบุ' });
      return;
    }

    // Remove entries of that academicYearId and restore snapshot
    for (const [eid, entry] of Object.entries(sub.timetables)) {
      if (entry.academicYearId === version.academicYearId) {
        delete sub.timetables[eid];
      }
    }
    const now = new Date().toISOString();
    for (const item of version.entries || []) {
      const id = generateId('tt');
      sub.timetables[id] = {
        id,
        academicYearId: version.academicYearId,
        dayOfWeek: Number(item.dayOfWeek),
        periodNumber: Number(item.periodNumber),
        classroomId: String(item.classroomId || ''),
        subjectId: String(item.subjectId || ''),
        teacherId: String(item.teacherId || ''),
        roomId: String(item.roomId || ''),
        revision: 1,
        updatedBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };
    }

    const histId = generateId('hist');
    sub.scheduleHistory[histId] = {
      id: histId,
      academicYearId: version.academicYearId,
      action: 'RESTORE_VERSION',
      summary: `กู้คืนตารางสอนจากเวอร์ชัน "${version.name}"`,
      actorUid: user.uid,
      actorEmail: user.username,
      createdAt: now,
    };

    persistStore();
    res.json({ ok: true });
  });

  app.post('/api/schools/:schoolId/timetables/copy-year', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler') {
      res.status(403).json({ error: 'ไม่มีสิทธิ์คัดลอกตารางสอน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const { sourceAcademicYearId, targetAcademicYearId } = req.body as {
      sourceAcademicYearId?: string;
      targetAcademicYearId?: string;
    };
    const sub = getSchoolSubcollections(schoolId);
    const sourceEntries = Object.values(sub.timetables).filter(
      (e) => e.academicYearId === sourceAcademicYearId
    );
    const now = new Date().toISOString();
    for (const source of sourceEntries) {
      const newId = generateId('tt');
      sub.timetables[newId] = {
        id: newId,
        academicYearId: targetAcademicYearId,
        dayOfWeek: source.dayOfWeek,
        periodNumber: source.periodNumber,
        classroomId: source.classroomId,
        subjectId: source.subjectId,
        teacherId: source.teacherId,
        roomId: String(source.roomId || ''),
        revision: 1,
        updatedBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };
    }

    const histId = generateId('hist');
    sub.scheduleHistory[histId] = {
      id: histId,
      academicYearId: String(targetAcademicYearId || ''),
      action: 'COPY_TIMETABLE',
      summary: `คัดลอกตารางสอน ${sourceEntries.length} คาบจากภาคเรียนเดิม`,
      actorUid: user.uid,
      actorEmail: user.username,
      createdAt: now,
    };

    persistStore();
    res.json({ copiedCount: sourceEntries.length });
  });

  app.post('/api/schools/:schoolId/invites', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน' });
      return;
    }
    if (role !== 'super_admin' && !isSchoolWritable(school)) {
      res.status(403).json({ error: 'โรงเรียนอยู่ในโหมดอ่านอย่างเดียว' });
      return;
    }

    const { email, role: inviteRole, teacherId } = req.body as {
      email?: string;
      role?: 'school_admin' | 'scheduler' | 'teacher';
      teacherId?: string;
    };
    const cleanTarget = (email || '').trim().toLowerCase();
    if (!cleanTarget || cleanTarget.length < 3) {
      res.status(400).json({ error: 'กรุณาระบุ Username หรืออีเมลของผู้รับเชิญ' });
      return;
    }

    const id = generateId('inv');
    const now = new Date().toISOString();
    const sub = getSchoolSubcollections(schoolId);
    const invite = {
      id,
      schoolId,
      email: cleanTarget,
      role: inviteRole || 'scheduler',
      teacherId: teacherId || '',
      status: 'pending',
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    sub.invites[id] = invite;
    recordAudit(schoolId, user, 'INVITE_MEMBER', 'invite', id, `เชิญ ${cleanTarget} เข้าสู่ระบบในบทบาท ${invite.role}`);
    persistStore();
    res.json({ invite });
  });

  app.post('/api/schools/:schoolId/invites/:inviteId/accept', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const inviteId = String(req.params.inviteId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !isValidId(inviteId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียนหรือคำเชิญ' });
      return;
    }
    const sub = getSchoolSubcollections(schoolId);
    const invite = sub.invites[inviteId] as {
      id: string;
      email: string;
      role: 'school_admin' | 'scheduler' | 'teacher';
      teacherId?: string;
      status: string;
    } | undefined;
    if (!invite) {
      res.status(404).json({ error: 'ไม่พบคำเชิญนี้หรือถูกยกเลิกแล้ว' });
      return;
    }
    if (invite.status !== 'pending') {
      res.status(400).json({ error: 'คำเชิญนี้ถูกใช้งานไปแล้ว' });
      return;
    }
    const matchesTarget =
      invite.email.toLowerCase() === user.username.toLowerCase() ||
      invite.email.toLowerCase() === user.email.toLowerCase();
    if (!matchesTarget) {
      res.status(403).json({ error: `คำเชิญนี้ระบุผู้ใช้ ${invite.email} กรุณาเข้าสู่ระบบด้วยบัญชีดังกล่าว` });
      return;
    }

    const now = new Date().toISOString();
    (invite as Record<string, unknown>).status = 'accepted';
    (invite as Record<string, unknown>).acceptedBy = user.uid;
    (invite as Record<string, unknown>).updatedAt = now;

    sub.members[user.uid] = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: invite.role,
      status: 'active',
      teacherId: invite.teacherId || '',
      inviteId,
      createdAt: now,
      updatedAt: now,
    };
    if (user.role !== 'super_admin') {
      user.schoolId = schoolId;
      user.schoolSlug = school.slug;
      user.role = invite.role;
      user.updatedAt = now;
    }
    persistStore();
    res.json({ ok: true, school });
  });

  // ---------------------------------------------------------
  // Coupons, Payments & Gateway Endpoints
  // ---------------------------------------------------------
  app.post('/api/coupons/validate', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { code } = req.body as { code?: string };
    const clean = String(code || '').trim().toUpperCase();
    const coupon = store.coupons[clean];
    if (!coupon || coupon.isActive !== true) {
      res.json({ coupon: null });
      return;
    }
    if (Number(coupon.usedCount || 0) >= Number(coupon.maxUses || 0)) {
      res.json({ coupon: null });
      return;
    }
    if (coupon.expiresAt && new Date(String(coupon.expiresAt)).getTime() < Date.now()) {
      res.json({ coupon: null });
      return;
    }
    res.json({ coupon });
  });

  app.get('/api/schools/:schoolId/payments', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    if (!isValidId(schoolId)) {
      res.status(400).json({ error: 'Invalid schoolId' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (!role) {
      res.status(403).json({ error: 'ไม่มีสิทธิ์ดูประวัติการชำระเงิน' });
      return;
    }
    const items = Object.values(store.payments)
      .filter((p) => p.schoolId === schoolId)
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
    res.json({ payments: items });
  });

  app.post('/api/schools/:schoolId/payments/bank-transfer', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!isValidId(schoolId) || !school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const role = getUserSchoolRole(schoolId, user);
    if (role !== 'super_admin' && role !== 'school_admin') {
      res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน' });
      return;
    }

    const { planId, amount, discountAmount, couponCode, slipUrl, transferDate, transferReference, notes } =
      req.body as Record<string, unknown>;
    if (!isSafeMediaUrl(slipUrl)) {
      res.status(400).json({ error: 'ไฟล์สลิปไม่ถูกต้อง' });
      return;
    }
    const paymentId = generateId('pay');
    const now = new Date().toISOString();
    store.payments[paymentId] = {
      id: paymentId,
      schoolId,
      schoolName: school.nameTh,
      planId: String(planId || school.planId),
      amount: Number(amount || 0),
      discountAmount: Number(discountAmount || 0),
      couponCode: String(couponCode || '').slice(0, 40),
      method: 'bank_transfer',
      status: 'pending_verification',
      slipUrl: String(slipUrl || ''),
      transferDate: String(transferDate || '').slice(0, 60),
      transferReference: String(transferReference || '').slice(0, 120),
      notes: String(notes || '').slice(0, 400),
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    recordAudit(schoolId, user, 'PAYMENT_SLIP_SUBMITTED', 'payment', paymentId, `แนบสลิปโอนเงิน ${Number(amount || 0).toLocaleString()} บาท`);
    persistStore();
    res.json({ paymentId });
  });

  app.post('/api/payments/create-session', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const { paymentId, schoolId, planId, amount } = req.body as {
      paymentId?: string;
      schoolId?: string;
      planId?: string;
      amount?: number;
    };

    if (
      typeof paymentId !== 'string' ||
      typeof schoolId !== 'string' ||
      typeof planId !== 'string' ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      res.status(400).json({ error: 'Invalid payment session parameters' });
      return;
    }

    const sessionId = `gw_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const record: PaymentSessionRecord = {
      sessionId,
      paymentId,
      schoolId,
      planId,
      amount,
      uid: user.uid,
      status: 'created',
      createdAt: Date.now(),
    };
    paymentSessions.set(sessionId, record);

    res.json({
      sessionId,
      paymentId,
      amount,
      currency: 'THB',
      mode: process.env.STRIPE_SECRET_KEY ? 'live' : 'sandbox',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  });

  app.post('/api/payments/webhook', (req, res) => {
    const signature = String(req.headers['x-gateway-signature'] || '');
    const idempotencyKey = String(req.headers['x-idempotency-key'] || '');
    const rawBody = JSON.stringify(req.body || {});
    const expectedSig = signPayload(rawBody);

    if (!safeEqualHex(signature, expectedSig)) {
      res.status(403).json({ error: 'Invalid webhook signature' });
      return;
    }
    if (!idempotencyKey || processedWebhooks.has(idempotencyKey)) {
      res.status(200).json({ deduplicated: true, status: 'already_processed' });
      return;
    }

    const { sessionId, status } = req.body as { sessionId?: string; status?: string };
    const session = sessionId ? paymentSessions.get(sessionId) : undefined;
    if (!session || status !== 'paid') {
      res.status(400).json({ error: 'Unknown session or unpaid status' });
      return;
    }

    processedWebhooks.add(idempotencyKey);
    session.status = 'verified';
    session.verifiedAt = Date.now();
    session.signature = expectedSig;

    res.json({
      verified: true,
      sessionId: session.sessionId,
      paymentId: session.paymentId,
      gatewaySignature: expectedSig,
    });
  });

  app.post('/api/payments/complete-sandbox', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const { sessionId, couponCode, discountAmount } = req.body as {
      sessionId?: string;
      couponCode?: string;
      discountAmount?: number;
    };
    const session = sessionId ? paymentSessions.get(sessionId) : undefined;
    if (!session || session.uid !== user.uid) {
      res.status(404).json({ error: 'Payment session not found' });
      return;
    }

    if (session.status === 'verified' && session.signature) {
      res.json({
        verified: true,
        deduplicated: true,
        sessionId: session.sessionId,
        gatewaySignature: session.signature,
      });
      return;
    }

    const webhookPayload = {
      sessionId: session.sessionId,
      paymentId: session.paymentId,
      schoolId: session.schoolId,
      amount: session.amount,
      status: 'paid',
      timestamp: Date.now(),
    };
    const signature = signPayload(JSON.stringify(webhookPayload));
    const idempotencyKey = `evt_${session.sessionId}`;
    processedWebhooks.add(idempotencyKey);
    session.status = 'verified';
    session.verifiedAt = Date.now();
    session.signature = signature;

    const school = store.schools[session.schoolId];
    const now = new Date().toISOString();
    store.payments[session.paymentId] = {
      id: session.paymentId,
      schoolId: session.schoolId,
      schoolName: school?.nameTh || session.schoolId,
      planId: session.planId,
      amount: session.amount,
      discountAmount: Number(discountAmount || 0),
      couponCode: String(couponCode || '').slice(0, 40),
      method: 'gateway',
      status: 'pending_verification',
      gatewaySessionId: session.sessionId,
      gatewaySignature: signature,
      notes: 'ชำระผ่าน Payment Gateway (Server HMAC Verified — รอเปิดรอบบัญชี/อนุมัติ)',
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    recordAudit(session.schoolId, user, 'GATEWAY_PAYMENT_VERIFIED', 'payment', session.paymentId, `ตรวจสอบลายเซ็น Payment Gateway สำเร็จ Session ${session.sessionId}`);
    persistStore();

    res.json({
      verified: true,
      sessionId: session.sessionId,
      paymentId: session.paymentId,
      gatewaySignature: signature,
    });
  });

  // ---------------------------------------------------------
  // Super Admin Control Center Endpoints
  // ---------------------------------------------------------
  app.get('/api/admin/overview', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;

    const schools = Object.values(store.schools);
    const payments = Object.values(store.payments).sort(
      (a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || ''))
    );
    const coupons = Object.values(store.coupons);
    const auditLogs = Object.values(store.auditLogs)
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')))
      .slice(0, 150);
    const users = Object.values(store.users).map(toPublicUser);
    const admins = users.filter((u) => u.role === 'super_admin').map((u) => ({ uid: u.uid, email: u.email, username: u.username }));

    res.json({ schools, payments, coupons, auditLogs, users, admins });
  });

  app.post('/api/admin/seed-defaults', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const now = new Date().toISOString();
    for (const p of DEFAULT_PLANS) {
      store.plans[p.id] = { ...p, updatedAt: now };
    }
    store.platformSettings = { ...DEFAULT_PLATFORM_SETTINGS, updatedAt: now };
    recordAudit('platform', user, 'SEED_PLATFORM_DEFAULTS', 'platform', 'default', 'ซิงค์แพ็กเกจมาตรฐาน 3 ระดับและการตั้งค่าเริ่มต้น');
    persistStore();
    res.json({ ok: true });
  });

  app.put('/api/admin/plans/:planId', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const planId = String(req.params.planId || '');
    if (!isValidId(planId)) {
      res.status(400).json({ error: 'Invalid planId' });
      return;
    }
    const payload = req.body as Record<string, unknown>;
    store.plans[planId] = {
      ...payload,
      id: planId,
      priceAnnual: Number(payload.priceAnnual || 0),
      maxTeachers: Number(payload.maxTeachers || 30),
      updatedAt: new Date().toISOString(),
    };
    recordAudit('platform', user, 'UPDATE_PLAN', 'plan', planId, `อัปเดตแพ็กเกจ ${String(payload.name || planId)}`);
    persistStore();
    res.json({ plan: store.plans[planId] });
  });

  app.put('/api/admin/settings', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const body = req.body as Record<string, unknown>;
    store.platformSettings = {
      trialDays: Math.min(90, Math.max(1, Number(body.trialDays || 14))),
      bankName: String(body.bankName || '').slice(0, 120),
      bankAccountName: String(body.bankAccountName || '').slice(0, 150),
      bankAccountNumber: String(body.bankAccountNumber || '').slice(0, 50),
      promptPayId: String(body.promptPayId || '').slice(0, 50),
      supportEmail: String(body.supportEmail || '').slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    recordAudit('platform', user, 'UPDATE_PLATFORM_SETTINGS', 'platformSettings', 'default', 'อัปเดตข้อมูลบัญชีรับโอนและวันทดลองใช้');
    persistStore();
    res.json({ settings: store.platformSettings });
  });

  app.post('/api/admin/coupons', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const { code, discountPercent, maxUses, expiresAt, isActive } = req.body as Record<string, unknown>;
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      res.status(400).json({ error: 'กรุณาระบุโค้ดส่วนลด' });
      return;
    }
    store.coupons[cleanCode] = {
      code: cleanCode,
      discountPercent: Math.min(100, Math.max(1, Number(discountPercent || 10))),
      maxUses: Math.max(1, Number(maxUses || 50)),
      usedCount: 0,
      expiresAt: String(expiresAt || ''),
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
    };
    recordAudit('platform', user, 'CREATE_COUPON', 'coupon', cleanCode, `สร้างโค้ดส่วนลด ${cleanCode}`);
    persistStore();
    res.json({ coupon: store.coupons[cleanCode] });
  });

  app.patch('/api/admin/coupons/:code', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const code = String(req.params.code || '').trim().toUpperCase();
    const existing = store.coupons[code];
    if (!existing) {
      res.status(404).json({ error: 'ไม่พบคูปอง' });
      return;
    }
    existing.isActive = Boolean((req.body as { isActive?: boolean }).isActive);
    persistStore();
    res.json({ coupon: existing });
  });

  app.post('/api/admin/payments/:paymentId/approve', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const paymentId = String(req.params.paymentId || '');
    const pay = store.payments[paymentId];
    if (!pay) {
      res.status(404).json({ error: 'ไม่พบรายการชำระเงิน' });
      return;
    }
    const school = store.schools[String(pay.schoolId)];
    const now = new Date().toISOString();
    const baseMs =
      school?.currentPeriodEnd && Date.parse(school.currentPeriodEnd) > Date.now()
        ? Date.parse(school.currentPeriodEnd)
        : Date.now();
    const nextPeriodEnd = new Date(baseMs + 365 * 24 * 60 * 60 * 1000).toISOString();

    pay.status = 'approved';
    pay.verifiedBy = user.uid;
    pay.updatedAt = now;

    if (school) {
      school.planId = String(pay.planId);
      school.subscriptionStatus = 'active';
      school.currentPeriodEnd = nextPeriodEnd;
      school.updatedAt = now;
    }
    for (const sub of Object.values(store.subscriptions)) {
      if (sub.schoolId === pay.schoolId) {
        sub.planId = pay.planId;
        sub.status = 'active';
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = nextPeriodEnd;
        sub.updatedAt = now;
      }
    }
    recordAudit(String(pay.schoolId), user, 'PAYMENT_APPROVED', 'payment', paymentId, `อนุมัติการชำระเงิน ${Number(pay.amount).toLocaleString()} บาท`);
    persistStore();
    res.json({ ok: true });
  });

  app.post('/api/admin/payments/:paymentId/reject', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const paymentId = String(req.params.paymentId || '');
    const pay = store.payments[paymentId];
    if (!pay) {
      res.status(404).json({ error: 'ไม่พบรายการชำระเงิน' });
      return;
    }
    const { reason } = req.body as { reason?: string };
    pay.status = 'rejected';
    pay.notes = String(reason || 'หลักฐานไม่ถูกต้อง').slice(0, 400);
    pay.verifiedBy = user.uid;
    pay.updatedAt = new Date().toISOString();
    recordAudit(String(pay.schoolId), user, 'PAYMENT_REJECTED', 'payment', paymentId, `ปฏิเสธรายการชำระเงิน: ${pay.notes}`);
    persistStore();
    res.json({ ok: true });
  });

  app.patch('/api/admin/schools/:schoolId/lifecycle', (req, res) => {
    const user = requireSuperAdmin(req, res);
    if (!user) return;
    const schoolId = String(req.params.schoolId || '');
    const school = store.schools[schoolId];
    if (!school) {
      res.status(404).json({ error: 'ไม่พบโรงเรียน' });
      return;
    }
    const { status, planId, extendDays } = req.body as {
      status?: SubscriptionStatus;
      planId?: string;
      extendDays?: number;
    };
    const now = new Date().toISOString();
    if (status) school.subscriptionStatus = status;
    if (planId) school.planId = planId;
    const days = Number(extendDays || 0);
    if (days > 0) {
      const baseMs =
        school.currentPeriodEnd && Date.parse(school.currentPeriodEnd) > Date.now()
          ? Date.parse(school.currentPeriodEnd)
          : Date.now();
      const newEnd = new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();
      if (school.subscriptionStatus === 'trialing') {
        school.trialEndsAt = newEnd;
      } else {
        school.currentPeriodEnd = newEnd;
      }
    }
    school.updatedAt = now;
    recordAudit(schoolId, user, 'SUBSCRIPTION_LIFECYCLE_UPDATED', 'school', schoolId, `ปรับสถานะโรงเรียนเป็น ${school.subscriptionStatus} (${school.planId})`);
    persistStore();
    res.json({ school });
  });

  app.post('/api/admin/users', (req, res) => {
    const admin = requireSuperAdmin(req, res);
    if (!admin) return;
    const { username, password, displayName, role, schoolId, teacherId } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: UserRole;
      schoolId?: string;
      teacherId?: string;
    };

    const cleanUsername = (username || '').trim();
    if (!isValidUsername(cleanUsername)) {
      res.status(400).json({ error: 'Username ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - ความยาว 3–64 ตัวอักษร' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
      return;
    }
    const duplicate = Object.values(store.users).find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: `Username "${cleanUsername}" ถูกใช้งานแล้ว` });
      return;
    }

    const chosenRole: UserRole =
      role === 'super_admin' || role === 'school_admin' || role === 'scheduler' || role === 'teacher'
        ? role
        : 'scheduler';

    const now = new Date().toISOString();
    const uid = generateId('usr');
    const targetSchool = schoolId && store.schools[schoolId] ? store.schools[schoolId] : undefined;

    const newUser: StoredUser = {
      uid,
      username: cleanUsername,
      email: `${cleanUsername}@kruschedule.local`,
      displayName: (displayName || cleanUsername).trim().slice(0, 150),
      role: chosenRole,
      schoolId: targetSchool?.id,
      schoolSlug: targetSchool?.slug,
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
    store.users[uid] = newUser;

    if (targetSchool && chosenRole !== 'super_admin') {
      const sub = getSchoolSubcollections(targetSchool.id);
      sub.members[uid] = {
        uid,
        email: newUser.email,
        displayName: newUser.displayName,
        role: chosenRole,
        status: 'active',
        teacherId: teacherId || '',
        createdAt: now,
        updatedAt: now,
      };
    }

    recordAudit(
      targetSchool?.id || 'platform',
      admin,
      'ADMIN_CREATE_USER',
      'user',
      uid,
      `สร้างบัญชีผู้ใช้ ${cleanUsername} (${chosenRole})${targetSchool ? ` สำหรับโรงเรียน ${targetSchool.nameTh}` : ''}`
    );
    persistStore();
    res.json({ user: toPublicUser(newUser) });
  });

  app.patch('/api/admin/users/:uid/role', (req, res) => {
    const admin = requireSuperAdmin(req, res);
    if (!admin) return;
    const uid = String(req.params.uid || '');
    const target = store.users[uid];
    if (!target) {
      res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }
    if (uid === 'usr_super_admin' || target.username.toLowerCase() === ENV_ADMIN_USERNAME.toLowerCase()) {
      res.status(400).json({ error: 'ไม่สามารถเปลี่ยนสิทธิ์บัญชีผู้ดูแลระบบหลักได้' });
      return;
    }
    const { role } = req.body as { role?: UserRole };
    if (role !== 'super_admin' && role !== 'school_admin' && role !== 'scheduler' && role !== 'teacher') {
      res.status(400).json({ error: 'บทบาทไม่ถูกต้อง' });
      return;
    }
    target.role = role;
    target.updatedAt = new Date().toISOString();
    recordAudit('platform', admin, role === 'super_admin' ? 'GRANT_SUPER_ADMIN' : 'REVOKE_SUPER_ADMIN', 'user', uid, `ปรับสิทธิ์ ${target.username} เป็น ${role}`);
    persistStore();
    res.json({ user: toPublicUser(target) });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'ไม่พบ API endpoint ที่ต้องการ' });
  });

  return app;
}

export const app = createApiApp();

async function startStandaloneServer() {
  if (process.env.NODE_ENV !== 'production') {
    const viteModule = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ระบบจัดตารางสอน server listening on http://0.0.0.0:${PORT}`);
  });
}

let isMainEntry = false;
try {
  if (!IS_VERCEL && process.argv[1]) {
    isMainEntry =
      fs.realpathSync(path.resolve(process.argv[1])) ===
      fs.realpathSync(fileURLToPath(import.meta.url));
  }
} catch {
  isMainEntry = false;
}

if (isMainEntry) {
  startStandaloneServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
