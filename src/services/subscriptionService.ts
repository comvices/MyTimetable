import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { extractUsername } from '../lib/authIdentifier';
import { auth, db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { generateId } from '../lib/tenant';
import {
  AuditLog,
  Coupon,
  DEFAULT_PLANS,
  DEFAULT_PLATFORM_SETTINGS,
  PaymentRecord,
  Plan,
  PlatformSettings,
  School,
  SubscriptionStatus,
  UserAccount,
} from '../types/saas';
import { ActorInfo, writeAuditLog } from './schoolService';

export async function uploadPaymentSlip(_schoolId: string, blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านรูปสลิปได้'));
    reader.readAsDataURL(blob);
  });
  if (dataUrl.length > 790000) {
    throw new Error('ไฟล์รูปสลิปมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง');
  }
  return dataUrl;
}

export async function validateCouponCode(code: string): Promise<Coupon | null> {
  const clean = code.trim().toUpperCase();
  if (!clean || !/^[a-zA-Z0-9_-]+$/.test(clean)) return null;
  try {
    const snap = await getDoc(doc(db, 'coupons', clean));
    if (!snap.exists()) return null;
    const coupon = snap.data() as Coupon;
    if (!coupon.isActive || coupon.usedCount >= coupon.maxUses) return null;
    if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return null;
    return coupon;
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
  actor: ActorInfo
): Promise<string> {
  const paymentId = generateId('pay');
  const path = `payments/${paymentId}`;
  try {
    await setDoc(doc(db, 'payments', paymentId), {
      id: paymentId,
      schoolId: input.school.id,
      schoolName: input.school.nameTh.slice(0, 200),
      planId: input.plan.id,
      amount: Math.max(0, input.amount),
      discountAmount: Math.max(0, input.discountAmount),
      couponCode: (input.couponCode || '').slice(0, 40),
      method: 'bank_transfer',
      status: 'pending_verification',
      slipUrl: input.slipUrl.slice(0, 800000),
      transferDate: input.transferDate.slice(0, 60),
      transferReference: input.transferReference.slice(0, 120),
      notes: (input.notes || '').slice(0, 400),
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      input.school.id,
      actor,
      'PAYMENT_SLIP_SUBMITTED',
      'payment',
      paymentId,
      `Submitted bank transfer slip ฿${input.amount} (${input.plan.id})`
    );
    return paymentId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchSchoolPayments(
  schoolId: string,
  isSuperAdmin = false
): Promise<PaymentRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const q = isSuperAdmin
      ? query(collection(db, 'payments'), where('schoolId', '==', schoolId))
      : query(
          collection(db, 'payments'),
          where('schoolId', '==', schoolId),
          where('createdBy', '==', uid)
        );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as PaymentRecord)
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'payments');
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
  try {
    const [schoolsSnap, paymentsSnap, couponsSnap, logsSnap, usersSnap, adminsSnap] =
      await Promise.all([
        getDocs(collection(db, 'schools')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'coupons')),
        getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);

    return {
      schools: schoolsSnap.docs.map((d) => d.data() as School),
      payments: paymentsSnap.docs
        .map((d) => d.data() as PaymentRecord)
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)),
      coupons: couponsSnap.docs.map((d) => d.data() as Coupon),
      auditLogs: logsSnap.docs.map((d) => d.data() as AuditLog),
      users: usersSnap.docs.map((d) => {
        const u = d.data() as UserAccount;
        return {
          uid: u.uid,
          username: u.username || extractUsername(u.email) || u.uid,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          schoolId: u.schoolId,
          schoolSlug: u.schoolSlug,
        };
      }),
      admins: adminsSnap.docs.map((d) => {
        const a = d.data() as { uid: string; email: string };
        return {
          uid: a.uid,
          username: extractUsername(a.email) || a.uid,
          email: a.email,
        };
      }),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin-overview');
  }
}

export async function seedDefaultPlansAndSettings(actor: ActorInfo): Promise<void> {
  try {
    const batch = writeBatch(db);
    DEFAULT_PLANS.forEach((plan) => {
      batch.set(doc(db, 'plans', plan.id), {
        id: plan.id,
        name: plan.name,
        nameTh: plan.nameTh,
        description: plan.description || '',
        priceAnnual: plan.priceAnnual,
        maxTeachers: plan.maxTeachers,
        features: plan.features,
        isActive: plan.isActive,
        updatedAt: serverTimestamp(),
      });
    });

    batch.set(doc(db, 'platformSettings', 'global'), {
      trialDays: DEFAULT_PLATFORM_SETTINGS.trialDays,
      bankName: DEFAULT_PLATFORM_SETTINGS.bankName,
      bankAccountName: DEFAULT_PLATFORM_SETTINGS.bankAccountName,
      bankAccountNumber: DEFAULT_PLATFORM_SETTINGS.bankAccountNumber,
      promptPayId: DEFAULT_PLATFORM_SETTINGS.promptPayId || '',
      supportEmail: DEFAULT_PLATFORM_SETTINGS.supportEmail || '',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await writeAuditLog('platform', actor, 'PLANS_SETTINGS_SEEDED', 'platform', 'global');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'plans');
  }
}

export async function savePlanAdmin(plan: Plan, actor: ActorInfo): Promise<void> {
  const path = `plans/${plan.id}`;
  try {
    await setDoc(doc(db, 'plans', plan.id), {
      id: plan.id,
      name: plan.name.slice(0, 80),
      nameTh: plan.nameTh.slice(0, 100),
      description: (plan.description || '').slice(0, 400),
      priceAnnual: Math.max(0, Number(plan.priceAnnual)),
      maxTeachers: Math.max(1, Number(plan.maxTeachers)),
      features: plan.features.slice(0, 25),
      isActive: Boolean(plan.isActive),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('platform', actor, 'PLAN_SAVED', 'plan', plan.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function savePlatformSettingsAdmin(
  settings: PlatformSettings,
  actor: ActorInfo
): Promise<void> {
  const path = 'platformSettings/global';
  try {
    await setDoc(doc(db, 'platformSettings', 'global'), {
      trialDays: Math.min(90, Math.max(1, Number(settings.trialDays))),
      bankName: settings.bankName.slice(0, 120),
      bankAccountName: settings.bankAccountName.slice(0, 150),
      bankAccountNumber: settings.bankAccountNumber.slice(0, 50),
      promptPayId: (settings.promptPayId || '').slice(0, 50),
      supportEmail: (settings.supportEmail || '').slice(0, 200),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('platform', actor, 'SETTINGS_UPDATED', 'platformSettings', 'global');
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
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
  actor: ActorInfo
): Promise<void> {
  const cleanCode = coupon.code.trim().toUpperCase();
  const path = `coupons/${cleanCode}`;
  try {
    await setDoc(doc(db, 'coupons', cleanCode), {
      code: cleanCode,
      discountPercent: Math.min(100, Math.max(1, Number(coupon.discountPercent))),
      maxUses: Math.max(1, Number(coupon.maxUses)),
      usedCount: 0,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 60) : '',
      isActive: Boolean(coupon.isActive),
      createdAt: serverTimestamp(),
    });
    await writeAuditLog('platform', actor, 'COUPON_CREATED', 'coupon', cleanCode);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function toggleCouponActiveAdmin(code: string, isActive: boolean): Promise<void> {
  const cleanCode = code.trim().toUpperCase();
  const path = `coupons/${cleanCode}`;
  try {
    await updateDoc(doc(db, 'coupons', cleanCode), {
      isActive,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function approvePaymentAndActivateSchool(
  payment: PaymentRecord,
  actor: ActorInfo
): Promise<void> {
  const path = `payments/${payment.id}`;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', payment.schoolId));
    const existingSchool = schoolSnap.exists() ? (schoolSnap.data() as School) : null;
    const baseMs = Math.max(
      Date.now(),
      existingSchool?.currentPeriodEnd?.toMillis() || 0
    );
    const newPeriodEnd = Timestamp.fromDate(new Date(baseMs + 365 * 86400000));
    const batch = writeBatch(db);

    batch.update(doc(db, 'payments', payment.id), {
      status: 'approved',
      verifiedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'schools', payment.schoolId), {
      planId: payment.planId,
      subscriptionStatus: 'active',
      currentPeriodEnd: newPeriodEnd,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await writeAuditLog(
      payment.schoolId,
      actor,
      'PAYMENT_APPROVED',
      'payment',
      payment.id,
      `Admin approved renewal ฿${payment.amount} and activated plan ${payment.planId}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function rejectPaymentAdmin(
  payment: PaymentRecord,
  reason: string,
  actor: ActorInfo
): Promise<void> {
  const path = `payments/${payment.id}`;
  try {
    await updateDoc(doc(db, 'payments', payment.id), {
      status: 'rejected',
      verifiedBy: actor.uid,
      notes: reason.slice(0, 400),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(
      payment.schoolId,
      actor,
      'PAYMENT_REJECTED',
      'payment',
      payment.id,
      reason
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateSchoolLifecycleAdmin(
  school: School,
  status: SubscriptionStatus,
  planId: string,
  extendDays: number,
  actor: ActorInfo
): Promise<void> {
  const path = `schools/${school.id}`;
  try {
    const updates: Record<string, unknown> = {
      subscriptionStatus: status,
      planId,
      updatedAt: serverTimestamp(),
    };
    if (extendDays > 0) {
      const baseMs = Math.max(
        Date.now(),
        school.currentPeriodEnd?.toMillis() || school.trialEndsAt?.toMillis() || Date.now()
      );
      const nextTs = Timestamp.fromDate(new Date(baseMs + extendDays * 86400000));
      if (status === 'trialing') {
        updates.trialEndsAt = nextTs;
      } else {
        updates.currentPeriodEnd = nextTs;
      }
    }
    await updateDoc(doc(db, 'schools', school.id), updates);
    await writeAuditLog(
      school.id,
      actor,
      'SCHOOL_LIFECYCLE_UPDATED',
      'school',
      school.id,
      `Status=${status}, Plan=${planId}, ExtendDays=${extendDays}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchAuditLogsAdmin(schoolId?: string): Promise<AuditLog[]> {
  const data = await fetchAdminOverview();
  if (schoolId) {
    return data.auditLogs.filter((l) => l.schoolId === schoolId);
  }
  return data.auditLogs;
}

export async function grantSuperAdminAccess(
  targetUser: { uid: string; email: string },
  actor: ActorInfo
): Promise<void> {
  const path = `admins/${targetUser.uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'admins', targetUser.uid), {
      uid: targetUser.uid,
      email: targetUser.email,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', targetUser.uid), {
      role: 'super_admin',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await writeAuditLog('platform', actor, 'SUPER_ADMIN_GRANTED', 'user', targetUser.uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revokeSuperAdminAccess(
  targetUser: { uid: string; email: string },
  actor: ActorInfo
): Promise<void> {
  const path = `admins/${targetUser.uid}`;
  try {
    await deleteDoc(doc(db, 'admins', targetUser.uid));
    await updateDoc(doc(db, 'users', targetUser.uid), {
      role: 'school_admin',
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('platform', actor, 'SUPER_ADMIN_REVOKED', 'user', targetUser.uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
