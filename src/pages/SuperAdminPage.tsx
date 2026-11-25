import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarRange,
  Check,
  Copy,
  CreditCard,
  Crown,
  Database,
  DollarSign,
  ExternalLink,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../lib/firestoreError';
import { getDaysRemaining, getSubscriptionStatusLabel } from '../lib/tenant';
import {
  createDemoSchoolAndSampleUsers,
  DemoSandboxResult,
} from '../services/demoSeedService';
import { createSchoolInvite } from '../services/schoolService';
import {
  approvePaymentAndActivateSchool,
  createCouponAdmin,
  createPlatformUserAdmin,
  fetchAdminOverview,
  grantSuperAdminAccess,
  rejectPaymentAdmin,
  revokeSuperAdminAccess,
  savePlanAdmin,
  savePlatformSettingsAdmin,
  seedDefaultPlansAndSettings,
  toggleCouponActiveAdmin,
  updateSchoolLifecycleAdmin,
} from '../services/subscriptionService';
import {
  AuditLog,
  Coupon,
  PaymentRecord,
  Plan,
  PlatformSettings,
  SUPER_ADMIN_USERNAME,
  School,
  SubscriptionStatus,
  UserRole,
} from '../types/saas';

type AdminTab = 'overview' | 'payments' | 'schools' | 'plans' | 'coupons' | 'admins' | 'audit';

export function SuperAdminPage() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();
  const { plans, platformSettings, refreshTenant, setActiveSchoolById, setPreviewPersona } = useTenant();
  const { theme } = useTheme();
  const { showToast, confirmAction } = useToast();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [schools, setSchools] = useState<School[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [platformUsers, setPlatformUsers] = useState<
    Array<{
      uid: string;
      username: string;
      email: string;
      displayName: string;
      role: string;
      schoolId?: string;
      schoolSlug?: string;
    }>
  >([]);
  const [adminRegistry, setAdminRegistry] = useState<
    Array<{ uid: string; username: string; email: string }>
  >([]);
  const [userSearch, setUserSearch] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoSandboxResult | null>(null);

  const [testInviteSchoolId, setTestInviteSchoolId] = useState('');
  const [testInviteEmail, setTestInviteEmail] = useState('');
  const [testInviteRole, setTestInviteRole] = useState<'scheduler' | 'teacher' | 'school_admin'>('scheduler');
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Create direct Username & Password user form
  const [newUserForm, setNewUserForm] = useState<{
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    schoolId: string;
  }>({
    username: '',
    password: '',
    displayName: '',
    role: 'scheduler',
    schoolId: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [slipModal, setSlipModal] = useState<PaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(platformSettings);
  const [editablePlans, setEditablePlans] = useState<Plan[]>(plans);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountPercent: 10,
    maxUses: 50,
    expiresAt: '',
  });

  useEffect(() => {
    setSettingsForm(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    setEditablePlans(plans);
  }, [plans]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const overview = await fetchAdminOverview();
      setSchools(overview.schools);
      setPayments(overview.payments);
      setCoupons(overview.coupons);
      setAuditLogs(overview.auditLogs);
      setPlatformUsers(overview.users);
      setAdminRegistry(overview.admins);
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      void loadAllAdminData();
    }
  }, [isSuperAdmin]);

  const stats = useMemo(() => {
    const trialing = schools.filter((s) => s.subscriptionStatus === 'trialing');
    const active = schools.filter((s) => s.subscriptionStatus === 'active');
    const expired = schools.filter((s) => s.subscriptionStatus === 'expired');
    const expiringSoon = schools.filter((s) => {
      const d = getDaysRemaining(s);
      return d !== null && d >= 0 && d <= 7 && ['trialing', 'active'].includes(s.subscriptionStatus);
    });

    const approvedPayments = payments.filter((p) => p.status === 'approved');
    const now = new Date();
    const monthlyRevenue = approvedPayments
      .filter((p) => {
        const dt = p.updatedAt?.toDate() || p.createdAt?.toDate();
        return dt && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + p.amount, 0);
    const annualRevenue = approvedPayments
      .filter((p) => {
        const dt = p.updatedAt?.toDate() || p.createdAt?.toDate();
        return dt && dt.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      total: schools.length,
      trialing: trialing.length,
      active: active.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length,
      pendingPayments: payments.filter((p) => p.status === 'pending_verification').length,
      monthlyRevenue,
      annualRevenue,
    };
  }, [schools, payments]);

  const revenueChartData = useMemo(() => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const buckets = months.map((m) => ({ month: m, amount: 0 }));
    payments
      .filter((p) => p.status === 'approved')
      .forEach((p) => {
        const dt = p.updatedAt?.toDate() || p.createdAt?.toDate();
        if (dt) buckets[dt.getMonth()].amount += p.amount;
      });
    return buckets;
  }, [payments]);

  if (!isSuperAdmin || !currentUser) {
    return (
      <WorkspaceShell title="Super Admin Console">
        <div
          className="pastel-glass border border-rose-200 rounded-2xl p-10 text-center max-w-lg mx-auto"
        >
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">จำกัดสิทธิ์เฉพาะเจ้าของแพลตฟอร์ม</h2>
          <p className="text-sm text-slate-600 mt-1">
            หน้านี้สงวนสิทธิ์สำหรับผู้ดูแลระบบส่วนกลาง (Super Admin) เท่านั้น
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  const actor = {
    uid: currentUser.uid,
    email: currentUser.email || '',
    displayName: currentUser.displayName || currentUser.username,
    username: currentUser.username,
  };

  const isPrimaryOwner =
    currentUser.uid === 'usr_super_admin' ||
    currentUser.username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase();

  const adminUidSet = new Set(adminRegistry.map((a) => a.uid));

  const demoSchoolCandidate =
    schools.find((s) => s.slug.startsWith('demo-school')) || schools[0];

  const handleCreateDemoSandbox = async () => {
    setCreatingDemo(true);
    try {
      const result = await createDemoSchoolAndSampleUsers(actor);
      setDemoResult(result);
      setTestInviteSchoolId(result.schoolId);
      await loadAllAdminData();
      await refreshTenant();
      showToast(
        `สร้าง "${result.schoolName}" และ User ตัวอย่างสำหรับทดลองจัดตารางเรียบร้อยแล้ว!`,
        'success'
      );
      setTab('admins');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleLaunchAsPersona = async (
    schoolId: string,
    role: 'school_admin' | 'scheduler' | 'teacher',
    teacherId: string | null,
    targetPath: string
  ) => {
    await setActiveSchoolById(schoolId);
    setPreviewPersona(role, teacherId);
    showToast(
      role === 'scheduler'
        ? 'เข้าสู่โหมด User ตัวอย่าง: อ.สมชาย ใจดี (ผู้จัดตารางสอน)'
        : role === 'teacher'
        ? 'เข้าสู่โหมด User ตัวอย่าง: อ.นภาพร วิทยา (ครูผู้สอน)'
        : 'เข้าสู่โหมดผู้ดูแลโรงเรียนตัวอย่าง',
      'info'
    );
    navigate(targetPath);
  };

  const handleCreateTestInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSchoolId = testInviteSchoolId || demoSchoolCandidate?.id;
    if (!targetSchoolId) {
      showToast('กรุณาสร้างโรงเรียนตัวอย่างก่อนสร้างลิงก์เชิญผู้ใช้ทดลอง', 'warning');
      return;
    }
    if (!testInviteEmail.trim()) {
      showToast('กรุณากรอกอีเมลสำหรับรับคำเชิญ', 'warning');
      return;
    }
    const targetSchool = schools.find((s) => s.id === targetSchoolId);
    if (!targetSchool) return;

    setCreatingInvite(true);
    try {
      const teacherRef =
        testInviteRole === 'scheduler'
          ? 'tch_demo_1'
          : testInviteRole === 'teacher'
          ? 'tch_demo_2'
          : '';
      const invite = await createSchoolInvite(
        targetSchool.id,
        testInviteEmail.trim(),
        testInviteRole,
        teacherRef,
        actor
      );
      const link = `${window.location.origin}/s/${targetSchool.slug}/login?invite=${invite.id}`;
      setGeneratedInviteLink(link);
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      showToast('สร้างลิงก์เชิญผู้ใช้ทดลองและคัดลอกเรียบร้อยแล้ว!', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCreateDirectUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username.trim() || newUserForm.password.length < 6) {
      showToast('กรุณากรอก Username และรหัสผ่านอย่างน้อย 6 ตัวอักษร', 'warning');
      return;
    }
    setCreatingUser(true);
    try {
      const targetSchoolId = newUserForm.schoolId || demoSchoolCandidate?.id || '';
      const created = await createPlatformUserAdmin({
        username: newUserForm.username.trim(),
        password: newUserForm.password,
        displayName: newUserForm.displayName.trim() || newUserForm.username.trim(),
        role: newUserForm.role,
        schoolId: newUserForm.role === 'super_admin' ? undefined : targetSchoolId || undefined,
      });
      await loadAllAdminData();
      setNewUserForm({
        username: '',
        password: '',
        displayName: '',
        role: 'scheduler',
        schoolId: targetSchoolId,
      });
      showToast(
        `สร้างบัญชีผู้ใช้ @${created.username} (${created.role}) เรียบร้อยแล้ว สามารถใช้ล็อกอินได้ทันที`,
        'success'
      );
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <WorkspaceShell
      title="Super Admin Console — เจ้าของและผู้ดูแลระบบหลัก"
      breadcrumb={`Platform Control Center · @${currentUser.username}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={creatingDemo}
            onClick={() => void handleCreateDemoSandbox()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {creatingDemo ? 'กำลังสร้างชุดตัวอย่าง...' : 'สร้าง User & โรงเรียนตัวอย่าง'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white border text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
            style={{ borderColor: theme.border, color: theme.primary }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>สร้างโรงเรียนใหม่</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await seedDefaultPlansAndSettings(actor);
              await refreshTenant();
              await loadAllAdminData();
              showToast('ซิงค์แพ็กเกจมาตรฐานและการตั้งค่าเริ่มต้นเรียบร้อยแล้ว', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 whitespace-nowrap shrink-0"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Database className="w-4 h-4" />
            <span>ซิงค์แพ็กเกจเริ่มต้น</span>
          </button>
        </div>
      }
    >
      {/* Owner Status Card */}
      <div
        className="pastel-glass border rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Crown className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span>{isPrimaryOwner ? 'เจ้าของและผู้ดูแลระบบหลัก' : 'ผู้ดูแลระบบส่วนกลาง (Super Admin)'}</span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                ยืนยันสิทธิ์แล้ว
              </span>
            </div>
            <div className="text-xs text-slate-600 truncate">
              บัญชีควบคุมหลัก: <span className="font-mono font-semibold">@{currentUser.username}</span> ·
              เข้าถึงได้ทุกโรงเรียน ตรวจสอบสลิป ควบคุมสถานะแพ็กเกจ และสร้างบัญชีผู้ใช้ด้วย Username/Password
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {stats.pendingPayments > 0 && (
            <button
              type="button"
              onClick={() => setTab('payments')}
              className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold border border-amber-300 whitespace-nowrap"
            >
              มีสลิปรอตรวจ {stats.pendingPayments} รายการ
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadAllAdminData()}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 whitespace-nowrap"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl border w-fit mb-6"
        style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
      >
        {[
          { id: 'overview', label: 'ภาพรวมรายได้' },
          { id: 'payments', label: `ตรวจการชำระเงิน (${stats.pendingPayments})` },
          { id: 'schools', label: `โรงเรียนทั้งหมด (${stats.total})` },
          { id: 'plans', label: 'แพ็กเกจ & ตั้งค่าระบบ' },
          { id: 'coupons', label: 'โปรโมชั่น & คูปอง' },
          { id: 'admins', label: `ผู้ดูแล & ผู้ใช้ (${platformUsers.length})` },
          { id: 'audit', label: 'Audit Logs' },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as AdminTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              style={active ? { color: theme.primary } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>โรงเรียนทั้งหมด</span>
                <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
              <div className="text-xs text-slate-500 mt-1 tabular-nums">
                ทดลองใช้ {stats.trialing} · ชำระเงิน {stats.active}
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>ใกล้หมดอายุ / หมดอายุ</span>
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {stats.expiringSoon} / {stats.expired}
              </div>
              <div className="text-xs text-slate-500 mt-1">ใกล้หมดอายุ (≤7 วัน) / หมดอายุ</div>
            </div>

            <button
              type="button"
              onClick={() => setTab('payments')}
              className="text-left pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>รายได้เดือนนี้</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
                ฿{stats.monthlyRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1 tabular-nums">
                รอตรวจสลิป {stats.pendingPayments} รายการ →
              </div>
            </button>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>รายได้สะสมรายปี</span>
                <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                ฿{stats.annualRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">ปี {new Date().getFullYear() + 543}</div>
            </div>
          </div>

          <div
            className="pastel-glass border rounded-2xl p-6"
            style={{ borderColor: theme.border }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">รายได้แพลตฟอร์มรายเดือน (บาท)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val: unknown) => [`฿${Number(val).toLocaleString()}`, 'รายได้']} />
                  <Bar dataKey="amount" fill={theme.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'payments' && (
        <div
          className="pastel-glass border rounded-2xl overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead
                className="border-b text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">โรงเรียน</th>
                  <th className="p-3.5 text-left">แพ็กเกจ / ช่องทาง</th>
                  <th className="p-3.5 text-right">ยอดเงิน</th>
                  <th className="p-3.5 text-left">อ้างอิง / สลิป</th>
                  <th className="p-3.5 text-left">สถานะ</th>
                  <th className="p-3.5 text-right">อนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      ยังไม่มีรายการชำระเงิน
                    </td>
                  </tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                      <td className="p-3.5 font-semibold text-slate-900">{pay.schoolName || pay.schoolId}</td>
                      <td className="p-3.5">
                        {pay.planId} · {pay.method === 'bank_transfer' ? 'โอนเงิน' : 'Gateway'}
                      </td>
                      <td className="p-3.5 text-right tabular-nums font-bold">฿{pay.amount.toLocaleString()}</td>
                      <td className="p-3.5">
                        {pay.slipUrl ? (
                          <button
                            type="button"
                            onClick={() => setSlipModal(pay)}
                            className="inline-flex items-center gap-1 font-semibold hover:underline"
                            style={{ color: theme.primary }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            ดูหลักฐาน ({pay.transferReference})
                          </button>
                        ) : (
                          <span className="font-mono text-slate-500">
                            {pay.gatewaySessionId || pay.transferReference || '-'}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-semibold">
                        {pay.status === 'approved'
                          ? 'อนุมัติแล้ว'
                          : pay.status === 'rejected'
                          ? 'ปฏิเสธแล้ว'
                          : 'รอตรวจสอบ'}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {pay.status === 'pending_verification' && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await approvePaymentAndActivateSchool(pay, actor);
                                await loadAllAdminData();
                                showToast('อนุมัติการชำระเงินและเปิดใช้งานสมาชิก 1 ปีแล้ว', 'success');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                            >
                              อนุมัติ
                            </button>
                            <button
                              type="button"
                              onClick={() => setSlipModal(pay)}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-semibold"
                            >
                              ปฏิเสธ
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'schools' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="ค้นหาชื่อโรงเรียนหรือ Subdomain..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border bg-white/95 text-xs focus:outline-none"
                style={{ borderColor: theme.border }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่ม / สมัครโรงเรียนใหม่</span>
            </button>
          </div>

          <div
            className="pastel-glass border rounded-2xl overflow-hidden"
            style={{ borderColor: theme.border }}
          >
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">กำลังโหลดข้อมูลโรงเรียน...</div>
            ) : schools.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                ยังไม่มีโรงเรียนในระบบ กด "เพิ่ม / สมัครโรงเรียนใหม่" เพื่อสร้างโรงเรียนแรกหรือรอโรงเรียนสมัครเข้ามา
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead
                    className="border-b text-slate-700"
                    style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
                  >
                    <tr>
                      <th className="p-3.5 text-left">โรงเรียน / Subdomain</th>
                      <th className="p-3.5 text-left">แพ็กเกจ</th>
                      <th className="p-3.5 text-left">สถานะสมาชิก</th>
                      <th className="p-3.5 text-right">คงเหลือ</th>
                      <th className="p-3.5 text-right">ควบคุมสถานะ & เข้าดูระบบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools
                      .filter((sch) =>
                        `${sch.nameTh} ${sch.slug} ${sch.email || ''}`
                          .toLowerCase()
                          .includes(schoolSearch.trim().toLowerCase())
                      )
                      .map((sch) => {
                        const days = getDaysRemaining(sch);
                        const meta = getSubscriptionStatusLabel(sch.subscriptionStatus);
                        return (
                          <tr key={sch.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{sch.nameTh}</div>
                              <div className="font-mono text-slate-500">{sch.slug}</div>
                            </td>
                            <td className="p-3.5 font-semibold">{sch.planId}</td>
                            <td className="p-3.5">{meta.label}</td>
                            <td className="p-3.5 text-right tabular-nums">
                              {days !== null ? `${days} วัน` : '-'}
                            </td>
                            <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={async () => {
                                  await setActiveSchoolById(sch.id);
                                  showToast(`เข้าสู่มุมมองโรงเรียน ${sch.nameTh}`, 'info');
                                  navigate('/app/dashboard');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border rounded-lg bg-white hover:bg-slate-50 font-semibold"
                                style={{ borderColor: theme.border, color: theme.primary }}
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>เข้าดูโรงเรียน</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateSchoolLifecycleAdmin(sch, 'active', sch.planId, 365, actor);
                                  await loadAllAdminData();
                                  showToast(`ต่ออายุ ${sch.nameTh} +365 วันแล้ว`, 'success');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              >
                                ต่ออายุ +1 ปี
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextStatus: SubscriptionStatus =
                                    sch.subscriptionStatus === 'suspended' ? 'active' : 'suspended';
                                  await updateSchoolLifecycleAdmin(sch, nextStatus, sch.planId, 0, actor);
                                  await loadAllAdminData();
                                  showToast(`อัปเดตสถานะ ${sch.nameTh} เป็น ${nextStatus}`, 'info');
                                }}
                                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                              >
                                {sch.subscriptionStatus === 'suspended' ? 'ปลดระงับ' : 'ระงับ'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {editablePlans.map((plan, idx) => (
              <div
                key={plan.id}
                className="pastel-glass border rounded-2xl p-5 space-y-3"
                style={{ borderColor: theme.border }}
              >
                <div className="font-bold text-base text-slate-900">{plan.name}</div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">คำอธิบายแพ็กเกจ</label>
                  <input
                    value={plan.description || ''}
                    onChange={(e) => {
                      const next = [...editablePlans];
                      next[idx] = { ...plan, description: e.target.value };
                      setEditablePlans(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ราคาต่อปี (บาท)</label>
                  <input
                    type="number"
                    value={plan.priceAnnual}
                    onChange={(e) => {
                      const next = [...editablePlans];
                      next[idx] = { ...plan, priceAnnual: Number(e.target.value) };
                      setEditablePlans(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">จำกัดจำนวนครูสูงสุด</label>
                  <input
                    type="number"
                    value={plan.maxTeachers}
                    onChange={(e) => {
                      const next = [...editablePlans];
                      next[idx] = { ...plan, maxTeachers: Number(e.target.value) };
                      setEditablePlans(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await savePlanAdmin(plan, actor);
                    await refreshTenant();
                    showToast(`บันทึกแพ็กเกจ ${plan.name} แล้ว`, 'success');
                  }}
                  className="w-full py-2 text-white text-xs font-semibold rounded-xl hover:opacity-95"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                  }}
                >
                  บันทึกแพ็กเกจ
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await savePlatformSettingsAdmin(settingsForm, actor);
              await refreshTenant();
              showToast('บันทึกการตั้งค่าแพลตฟอร์มแล้ว', 'success');
            }}
            className="pastel-glass border rounded-2xl p-6 space-y-4"
            style={{ borderColor: theme.border }}
          >
            <h3 className="text-base font-bold text-slate-900">ตั้งค่า Free Trial และบัญชีรับโอนเงิน</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนวันทดลองใช้ฟรี</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={settingsForm.trialDays}
                  onChange={(e) => setSettingsForm({ ...settingsForm, trialDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ธนาคาร</label>
                <input
                  value={settingsForm.bankName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อบัญชี</label>
                <input
                  value={settingsForm.bankAccountName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เลขที่บัญชี</label>
                <input
                  value={settingsForm.bankAccountNumber}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-white text-xs font-semibold rounded-xl hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                บันทึกการตั้งค่าแพลตฟอร์ม
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCoupon.code.trim()) return;
              await createCouponAdmin({ ...newCoupon, isActive: true }, actor);
              setNewCoupon({ code: '', discountPercent: 10, maxUses: 50, expiresAt: '' });
              await loadAllAdminData();
              showToast('สร้างโค้ดส่วนลดใหม่แล้ว', 'success');
            }}
            className="pastel-glass border rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            style={{ borderColor: theme.border }}
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">โค้ดส่วนลด *</label>
              <input
                required
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                placeholder="SCHOOL20"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ส่วนลด (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newCoupon.discountPercent}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนสิทธิ์สูงสุด</label>
              <input
                type="number"
                min={1}
                value={newCoupon.maxUses}
                onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl h-10 hover:opacity-95"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <Tag className="w-3.5 h-3.5" />
              สร้างโค้ดส่วนลด
            </button>
          </form>

          <div
            className="pastel-glass border rounded-2xl overflow-hidden"
            style={{ borderColor: theme.border }}
          >
            <table className="w-full text-xs">
              <thead
                className="border-b text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">โค้ด</th>
                  <th className="p-3.5 text-right">ส่วนลด</th>
                  <th className="p-3.5 text-right">ใช้งานแล้ว</th>
                  <th className="p-3.5 text-left">สถานะ</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                    <td className="p-3.5 font-mono font-bold">{c.code}</td>
                    <td className="p-3.5 text-right tabular-nums">{c.discountPercent}%</td>
                    <td className="p-3.5 text-right tabular-nums">
                      {c.usedCount} / {c.maxUses}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border font-semibold ${
                          c.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                      >
                        {c.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await toggleCouponActiveAdmin(c.code, !c.isActive);
                            await loadAllAdminData();
                            showToast(`ปรับสถานะคูปอง ${c.code} แล้ว`, 'info');
                          } catch (err) {
                            showToast(formatErrorMessage(err), 'error');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
                      >
                        {c.isActive ? 'ปิดคูปอง' : 'เปิดคูปอง'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'admins' && (
        <div className="space-y-6">
          {/* Demo Scheduling Sandbox & Sample Users Panel */}
          <div
            className="pastel-glass border rounded-2xl p-6 space-y-5"
            style={{ borderColor: theme.border }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ชุด User ตัวอย่าง & โรงเรียนสาธิตสำหรับทดลองจัดตารางสอน
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                    สร้างโรงเรียนตัวอย่างพร้อมครู 8 ท่าน, วิชา 10 วิชา, ชั้นเรียน ม.1/1–ม.2/2, ห้องเรียน 6 ห้อง, กิจกรรมล็อกคาบ,
                    ตารางสอนตั้งต้น 14 คาบ และบทบาท User ตัวอย่าง (ผู้จัดตารางสอน / ครูผู้สอน / แอดมินโรงเรียน) เพื่อเข้าลองจัดตารางได้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={creatingDemo}
                onClick={() => void handleCreateDemoSandbox()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {creatingDemo
                    ? 'กำลังสร้างชุดข้อมูลตัวอย่าง...'
                    : demoSchoolCandidate?.slug.startsWith('demo-school')
                    ? 'สร้างโรงเรียน & User ตัวอย่างชุดใหม่'
                    : 'สร้างโรงเรียน & User ตัวอย่าง (1 คลิก)'}
                </span>
              </button>
            </div>

            {(demoResult || demoSchoolCandidate) && (
              <div
                className="rounded-2xl border bg-white/85 p-4 space-y-4"
                style={{ borderColor: theme.border }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-xs text-slate-500">พื้นที่โรงเรียนพร้อมทดลองจัดตาราง</div>
                    <div className="text-sm font-bold text-slate-900">
                      {demoResult?.schoolName || demoSchoolCandidate?.nameTh} (
                      <span className="font-mono text-xs">{demoResult?.slug || demoSchoolCandidate?.slug}</span>)
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    คลิกเลือกบทบาท User ตัวอย่างเพื่อเปิดหน้าจัดตารางสอนทันที:
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        1. อ.สมชาย ใจดี (ฝ่ายจัดตารางสอน)
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        scheduler.demo@kruschedule.app · Role: scheduler
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">
                        ทดลองลากวางตารางสอน กด Auto-Schedule ล็อกคาบกิจกรรม ตรวจตารางชน และบันทึกเวอร์ชัน
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleLaunchAsPersona(
                          demoResult?.schoolId || demoSchoolCandidate!.id,
                          'scheduler',
                          'tch_demo_1',
                          '/app/timetable'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:opacity-95"
                      style={{
                        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                      }}
                    >
                      <CalendarRange className="w-3.5 h-3.5" />
                      <span>ทดลองจัดตารางในบทบาทนี้</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        2. อ.นภาพร วิทยา (ครูผู้สอน)
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        napaporn.demo@kruschedule.app · Role: teacher
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">
                        ทดลองมุมมองครู: ดูตารางสอนส่วนตัว ภาระงาน และส่งออก PDF/Excel (แก้ไขตารางไม่ได้)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleLaunchAsPersona(
                          demoResult?.schoolId || demoSchoolCandidate!.id,
                          'teacher',
                          'tch_demo_2',
                          '/app/teacher-dashboard'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                      style={{ borderColor: theme.border }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>ทดลองดูมุมมองครูผู้สอน</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        3. ผู้ดูแลโรงเรียน (School Admin)
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        @{currentUser.username} · Role: school_admin
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">
                        จัดการข้อมูลครู วิชา ห้องเรียน ปรับแต่งอัตลักษณ์โรงเรียน เชิญสมาชิก และจัดตารางสอนได้ทั้งหมด
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleLaunchAsPersona(
                          demoResult?.schoolId || demoSchoolCandidate!.id,
                          'school_admin',
                          null,
                          '/app/dashboard'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800"
                      style={{ borderColor: theme.border }}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>เข้าจัดการโรงเรียนตัวอย่าง</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Username & Password Account Creator */}
            <form
              onSubmit={handleCreateDirectUser}
              className="rounded-2xl border bg-white/85 p-4 space-y-3"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <KeyRound className="w-4 h-4" style={{ color: theme.primary }} />
                <span>สร้างบัญชีผู้ใช้ใหม่ด้วย Username & Password (พร้อมใช้งานทันที)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Username *</label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="scheduler01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password (6+)*</label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder="••••••"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={newUserForm.displayName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, displayName: e.target.value })}
                    placeholder="เช่น อ.สมชาย ผู้จัดตาราง"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">บทบาท</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="scheduler">ผู้จัดตารางสอน</option>
                    <option value="teacher">ครูผู้สอน</option>
                    <option value="school_admin">ผู้ดูแลโรงเรียน</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <select
                    value={newUserForm.schoolId || demoSchoolCandidate?.id || ''}
                    onChange={(e) => setNewUserForm({ ...newUserForm, schoolId: e.target.value })}
                    disabled={newUserForm.role === 'super_admin'}
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 text-xs bg-white disabled:opacity-50"
                  >
                    <option value="">ไม่สังกัดโรงเรียน</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameTh}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-3.5 py-2 text-white text-xs font-semibold rounded-xl shrink-0 hover:opacity-95 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                    }}
                  >
                    {creatingUser ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
                  </button>
                </div>
              </div>
            </form>

            {/* Invite user by Username */}
            <form
              onSubmit={handleCreateTestInvite}
              className="rounded-2xl border bg-white/80 p-4 space-y-3"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <UserPlus className="w-4 h-4" style={{ color: theme.primary }} />
                <span>สร้างลิงก์เชิญเข้าร่วมโรงเรียนด้วย Username</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">โรงเรียน</label>
                  <select
                    value={testInviteSchoolId || demoSchoolCandidate?.id || ''}
                    onChange={(e) => setTestInviteSchoolId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    {schools.length === 0 && <option value="">ยังไม่มีโรงเรียน</option>}
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameTh} ({s.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Username ผู้รับเชิญ
                  </label>
                  <input
                    type="text"
                    value={testInviteEmail}
                    onChange={(e) => setTestInviteEmail(e.target.value)}
                    placeholder="scheduler01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">บทบาท</label>
                  <select
                    value={testInviteRole}
                    onChange={(e) =>
                      setTestInviteRole(e.target.value as 'scheduler' | 'teacher' | 'school_admin')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="scheduler">ผู้จัดตารางสอน (Scheduler)</option>
                    <option value="teacher">ครูผู้สอน (Teacher)</option>
                    <option value="school_admin">ผู้ดูแลโรงเรียน</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={creatingInvite || schools.length === 0}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {creatingInvite ? 'กำลังสร้าง...' : 'สร้างลิงก์เชิญ'}
                  </button>
                </div>
              </div>
              {generatedInviteLink && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                  <span className="font-mono text-emerald-900 truncate flex-1">
                    {generatedInviteLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(generatedInviteLink);
                      showToast('คัดลอกลิงก์เชิญแล้ว', 'success');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอกลิงก์
                  </button>
                </div>
              )}
            </form>
          </div>

          <div
            className="pastel-glass border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">สิทธิ์เจ้าของและผู้ดูแลระบบหลัก</h2>
                <p className="text-xs text-slate-600">
                  เจ้าของแพลตฟอร์ม (@{SUPER_ADMIN_USERNAME}) มีสิทธิ์ถาวรและไม่สามารถถูกถอนสิทธิ์ได้ คุณสามารถมอบหรือถอนสิทธิ์ผู้ดูแลระบบให้บัญชีอื่นด้านล่าง
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือ Username..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border bg-white text-xs focus:outline-none"
                style={{ borderColor: theme.border }}
              />
            </div>
          </div>

          <div
            className="pastel-glass border rounded-2xl overflow-hidden"
            style={{ borderColor: theme.border }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead
                  className="border-b text-slate-700"
                  style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
                >
                  <tr>
                    <th className="p-3.5 text-left">ชื่อผู้ใช้งาน</th>
                    <th className="p-3.5 text-left">Username</th>
                    <th className="p-3.5 text-left">โรงเรียน</th>
                    <th className="p-3.5 text-left">บทบาท</th>
                    <th className="p-3.5 text-right">จัดการสิทธิ์ Super Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {platformUsers
                    .filter((u) =>
                      `${u.displayName} ${u.username} ${u.email} ${u.schoolSlug || ''}`
                        .toLowerCase()
                        .includes(userSearch.trim().toLowerCase())
                    )
                    .map((u) => {
                      const isOwnerAccount =
                        u.uid === 'usr_super_admin' ||
                        u.username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase();
                      const isAdmin = isOwnerAccount || adminUidSet.has(u.uid) || u.role === 'super_admin';
                      return (
                        <tr key={u.uid} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                          <td className="p-3.5 font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {isOwnerAccount && <Crown className="w-3.5 h-3.5 text-amber-600" />}
                              {u.displayName || '-'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-700">@{u.username}</td>
                          <td className="p-3.5 font-mono text-slate-500">{u.schoolSlug || '-'}</td>
                          <td className="p-3.5">
                            {isOwnerAccount ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                                เจ้าของระบบหลัก
                              </span>
                            ) : isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-700 font-semibold">
                                <ShieldCheck className="w-3 h-3" />
                                Super Admin
                              </span>
                            ) : (
                              <span className="text-slate-600">{u.role}</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {isOwnerAccount ? (
                              <span className="text-slate-400">บัญชีหลัก (คุ้มครองถาวร)</span>
                            ) : isAdmin ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirmAction({
                                    title: 'ถอนสิทธิ์ผู้ดูแลระบบ?',
                                    description: `ต้องการถอนสิทธิ์ Super Admin ของ @${u.username} หรือไม่`,
                                    danger: true,
                                  });
                                  if (!ok) return;
                                  try {
                                    await revokeSuperAdminAccess({ uid: u.uid, email: u.username }, actor);
                                    await loadAllAdminData();
                                    showToast(`ถอนสิทธิ์ Super Admin ของ @${u.username} แล้ว`, 'info');
                                  } catch (err) {
                                    showToast(formatErrorMessage(err), 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold"
                              >
                                <UserMinus className="w-3 h-3" />
                                ถอนสิทธิ์ Admin
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirmAction({
                                    title: 'มอบสิทธิ์ผู้ดูแลระบบหลัก?',
                                    description: `บัญชี @${u.username} จะสามารถจัดการทุกโรงเรียน อนุมัติสลิป และตั้งค่าแพลตฟอร์มได้`,
                                  });
                                  if (!ok) return;
                                  try {
                                    await grantSuperAdminAccess({ uid: u.uid, email: u.username }, actor);
                                    await loadAllAdminData();
                                    showToast(`มอบสิทธิ์ Super Admin แก่ @${u.username} แล้ว`, 'success');
                                  } catch (err) {
                                    showToast(formatErrorMessage(err), 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border font-semibold"
                                style={{ borderColor: theme.border, color: theme.primary }}
                              >
                                <UserCheck className="w-3 h-3" />
                                ตั้งเป็น Super Admin
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div
          className="pastel-glass border rounded-2xl overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead
                className="border-b text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">Action</th>
                  <th className="p-3.5 text-left">ผู้ดำเนินการ</th>
                  <th className="p-3.5 text-left">รายละเอียด</th>
                  <th className="p-3.5 text-left">School ID</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                    <td className="p-3.5 font-mono font-semibold text-slate-900">{log.action}</td>
                    <td className="p-3.5 text-slate-600">{log.actorEmail || log.actorUid}</td>
                    <td className="p-3.5 text-slate-700">{log.details}</td>
                    <td className="p-3.5 font-mono text-slate-500">{log.schoolId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slip Inspection & Reject/Approve Modal */}
      {slipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div
            className="bg-white rounded-2xl border max-w-lg w-full p-6 space-y-4 shadow-xl"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                ตรวจสอบหลักฐานชำระเงิน — {slipModal.schoolName}
              </h3>
              <button type="button" onClick={() => setSlipModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            {slipModal.slipUrl && (
              <img
                src={slipModal.slipUrl}
                alt="Payment slip"
                className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50"
              />
            )}
            <div className="text-xs text-slate-600 space-y-1">
              <div>ยอดชำระ: ฿{slipModal.amount.toLocaleString()} · แพ็กเกจ {slipModal.planId}</div>
              <div>อ้างอิง: {slipModal.transferReference || slipModal.gatewaySessionId || '-'}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เหตุผลกรณีปฏิเสธ (ถ้ามี)
              </label>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น ยอดโอนไม่ตรงกับแพ็กเกจ"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmAction({
                    title: 'ปฏิเสธหลักฐานการชำระเงิน?',
                    description: 'รายการนี้จะถูกเปลี่ยนสถานะเป็นปฏิเสธ',
                    danger: true,
                  });
                  if (ok) {
                    await rejectPaymentAdmin(
                      slipModal,
                      rejectReason || 'หลักฐานไม่ถูกต้อง',
                      actor
                    );
                    setSlipModal(null);
                    setRejectReason('');
                    await loadAllAdminData();
                    showToast('ปฏิเสธรายการแล้ว', 'info');
                  }
                }}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl"
              >
                ปฏิเสธรายการ
              </button>
              <button
                type="button"
                onClick={async () => {
                  await approvePaymentAndActivateSchool(slipModal, actor);
                  setSlipModal(null);
                  await loadAllAdminData();
                  showToast('อนุมัติการชำระเงินและเปิดใช้งานสมาชิกแล้ว', 'success');
                }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl"
              >
                <Check className="w-3.5 h-3.5" />
                อนุมัติ & เปิดใช้งาน 1 ปี
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
