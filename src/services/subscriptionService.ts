import { apiFetch } from '../lib/api';
import { generateId } from '../lib/tenant';
import {
  AuditLog,
  Coupon,
  PaymentRecord,
  Plan,
  PlatformSettings,
  School,
  SubscriptionStatus,
  UserRole,
} from '../types/saas';
import { ActorInfo } from './schoolService';

export async function uploadPaymentSlip(_schoolId: string, blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านรูปสลิปได้'));
    reader.readAsDataURL(blob);
  });
}

export async function validateCouponCode(code: string): Promise<Coupon | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  try {
    const res = await apiFetch<{ coupon: Coupon | null }>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: clean }),
    });
    return res.coupon || null;
  } catch {
    return null;
  }
}

export async function submitBankTransferPayment(
  input: {
    school: School;
    plan: Plan;
    amount: number;
    discountAmount: number;
    couponCode?: string;
    slipUrl: string;
    transferDate: string;
    transferReference: string;
    notes?: string;
  },
  _actor: ActorInfo
): Promise<string> {
  const res = await apiFetch<{ paymentId: string }>(
    `/api/schools/${encodeURIComponent(input.school.id)}/payments/bank-transfer`,
    {
      method: 'POST',
      body: JSON.stringify({
        planId: input.plan.id,
        amount: input.amount,
        discountAmount: input.discountAmount,
        couponCode: input.couponCode || '',
        slipUrl: input.slipUrl,
        transferDate: input.transferDate,
        transferReference: input.transferReference,
        notes: input.notes || '',
      }),
    }
  );
  return res.paymentId;
}

export async function initiateAndVerifyGatewayPayment(
  input: {
    school: School;
    plan: Plan;
    amount: number;
    discountAmount: number;
    couponCode?: string;
  },
  _actor: ActorInfo
): Promise<{ paymentId: string; sessionId: string; gatewaySignature: string }> {
  const paymentId = generateId('paygw');
  const sessionData = await apiFetch<{ sessionId: string }>('/api/payments/create-session', {
    method: 'POST',
    body: JSON.stringify({
      paymentId,
      schoolId: input.school.id,
      planId: input.plan.id,
      amount: input.amount,
    }),
  });

  const verifiedData = await apiFetch<{
    paymentId?: string;
    sessionId: string;
    gatewaySignature: string;
  }>('/api/payments/complete-sandbox', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: sessionData.sessionId,
      couponCode: input.couponCode || '',
      discountAmount: input.discountAmount,
    }),
  });

  return {
    paymentId: verifiedData.paymentId || paymentId,
    sessionId: sessionData.sessionId,
    gatewaySignature: verifiedData.gatewaySignature,
  };
}

export async function fetchSchoolPayments(schoolId: string): Promise<PaymentRecord[]> {
  try {
    const res = await apiFetch<{ payments: PaymentRecord[] }>(
      `/api/schools/${encodeURIComponent(schoolId)}/payments`
    );
    return res.payments || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------
// Super Admin Operations
// ---------------------------------------------------------
export interface AdminOverviewPayload {
  schools: School[];
  payments: PaymentRecord[];
  coupons: Coupon[];
  auditLogs: AuditLog[];
  users: Array<{
    uid: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    schoolId?: string;
    schoolSlug?: string;
  }>;
  admins: Array<{ uid: string; username: string; email: string }>;
}

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  return await apiFetch<AdminOverviewPayload>('/api/admin/overview');
}

export async function seedDefaultPlansAndSettings(_actor: ActorInfo): Promise<void> {
  await apiFetch('/api/admin/seed-defaults', { method: 'POST' });
}

export async function savePlanAdmin(plan: Plan, _actor: ActorInfo): Promise<void> {
  await apiFetch(`/api/admin/plans/${encodeURIComponent(plan.id)}`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  });
}

export async function savePlatformSettingsAdmin(
  settings: PlatformSettings,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function fetchAllSchoolsAdmin(): Promise<School[]> {
  const data = await fetchAdminOverview();
  return data.schools;
}

export async function fetchAllPaymentsAdmin(): Promise<PaymentRecord[]> {
  const data = await fetchAdminOverview();
  return data.payments;
}

export async function fetchAllCouponsAdmin(): Promise<Coupon[]> {
  const data = await fetchAdminOverview();
  return data.coupons;
}

export async function createCouponAdmin(
  coupon: Omit<Coupon, 'usedCount' | 'createdAt'>,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch('/api/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(coupon),
  });
}

export async function toggleCouponActiveAdmin(code: string, isActive: boolean): Promise<void> {
  await apiFetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function approvePaymentAndActivateSchool(
  payment: PaymentRecord,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/admin/payments/${encodeURIComponent(payment.id)}/approve`, {
    method: 'POST',
  });
}

export async function rejectPaymentAdmin(
  payment: PaymentRecord,
  reason: string,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/admin/payments/${encodeURIComponent(payment.id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function updateSchoolLifecycleAdmin(
  school: School,
  status: SubscriptionStatus,
  planId: string,
  extendDays: number,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/admin/schools/${encodeURIComponent(school.id)}/lifecycle`, {
    method: 'PATCH',
    body: JSON.stringify({ status, planId, extendDays }),
  });
}

export async function fetchAuditLogsAdmin(schoolId?: string): Promise<AuditLog[]> {
  const data = await fetchAdminOverview();
  if (schoolId) {
    return data.auditLogs.filter((l) => l.schoolId === schoolId);
  }
  return data.auditLogs;
}

export async function fetchAllPlatformUsersAdmin(): Promise<
  Array<{
    uid: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    schoolId?: string;
    schoolSlug?: string;
  }>
> {
  const data = await fetchAdminOverview();
  return data.users;
}

export async function fetchSuperAdminsRegistry(): Promise<
  Array<{ uid: string; username: string; email: string }>
> {
  const data = await fetchAdminOverview();
  return data.admins;
}

export async function createPlatformUserAdmin(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  schoolId?: string;
  teacherId?: string;
}): Promise<{
  uid: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
}> {
  const res = await apiFetch<{
    user: {
      uid: string;
      username: string;
      email: string;
      displayName: string;
      role: UserRole;
    };
  }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.user;
}

export async function grantSuperAdminAccess(
  targetUser: { uid: string; email: string },
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/admin/users/${encodeURIComponent(targetUser.uid)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'super_admin' }),
  });
}

export async function revokeSuperAdminAccess(
  targetUser: { uid: string; email: string },
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/admin/users/${encodeURIComponent(targetUser.uid)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'school_admin' }),
  });
}
