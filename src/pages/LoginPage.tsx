import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, KeyRound, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { ThemeSwitcher } from '../components/theme/ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../lib/firestoreError';
import { DEFAULT_BRANDING } from '../lib/tenant';
import { acceptSchoolInvite } from '../services/schoolService';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');

  const {
    currentUser,
    isSuperAdmin,
    needsAdminSetup,
    adminUsername,
    loginWithUsername,
    setupInitialAdmin,
    signOut,
  } = useAuth();
  const { publicBranding, school, tenantSlug, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupUsername, setSetupUsername] = useState(adminUsername || 'admin');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (adminUsername) {
      setSetupUsername(adminUsername);
    }
  }, [adminUsername]);

  const schoolName = publicBranding?.nameTh || DEFAULT_BRANDING.nameTh;
  const schoolNameEn = publicBranding?.nameEn || DEFAULT_BRANDING.nameEn;
  const primaryColor = publicBranding?.primaryColor || theme.primary;
  const secondaryColor = publicBranding?.secondaryColor || theme.secondary;
  const welcomeMsg = publicBranding?.welcomeMessage || DEFAULT_BRANDING.welcomeMessage;
  const coverUrl = publicBranding?.loginCoverUrl || DEFAULT_BRANDING.loginCoverUrl;
  const bgUrl = publicBranding?.backgroundUrl || '';
  const logoUrl = publicBranding?.logoUrl || '';

  const completePostLogin = async (
    uid: string,
    userEmail: string,
    displayName: string,
    role: string,
    loggedUsername: string
  ) => {
    if (inviteId && publicBranding?.schoolId) {
      await acceptSchoolInvite(publicBranding.schoolId, publicBranding.slug, inviteId, {
        uid,
        email: userEmail,
        displayName,
        username: loggedUsername,
      });
      await refreshTenant();
      showToast(`เข้าร่วมโรงเรียน ${publicBranding.nameTh} สำเร็จ`, 'success');
      navigate('/app/dashboard');
      return;
    }
    await refreshTenant();
    if (!publicBranding && role === 'super_admin') {
      navigate('/super-admin');
      return;
    }
    navigate('/app/dashboard');
  };

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('กรุณากรอก Username และรหัสผ่าน', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const user = await loginWithUsername(username, password);
      showToast(`ยินดีต้อนรับ ${user.displayName}`, 'success');
      await completePostLogin(
        user.uid,
        user.email || '',
        user.displayName || user.username,
        user.role,
        user.username
      );
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupInitialAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupUsername.trim() || setupPassword.length < 6) {
      showToast('กรุณากำหนด Username และรหัสผ่านอย่างน้อย 6 ตัวอักษร', 'warning');
      return;
    }
    if (setupPassword !== setupConfirm) {
      showToast('รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const admin = await setupInitialAdmin(setupUsername, setupPassword);
      showToast('ตั้งค่าบัญชี Super Admin สำเร็จ กำลังเข้าสู่ระบบควบคุมหลัก', 'success');
      await completePostLogin(
        admin.uid,
        admin.email,
        admin.displayName,
        admin.role,
        admin.username
      );
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 pastel-ambient-bg bg-cover bg-center relative"
      style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
    >
      {bgUrl && <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" />}

      <div className="fixed top-4 right-4 z-30">
        <ThemeSwitcher />
      </div>

      <motion.div
        initial={theme.effectsEnabled ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-5xl pastel-glass rounded-3xl border shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
        style={{ borderColor: theme.border }}
      >
        {/* Left School Cover & Branding */}
        <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[540px] flex flex-col justify-between p-8 text-white bg-slate-900">
          <img
            src={coverUrl}
            alt={schoolName}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${primaryColor}b8 0%, #1e293bd9 100%)`,
            }}
          />

          <div className="relative z-10 flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={schoolName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover bg-white p-1 shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg bg-white text-slate-900 shadow-sm">
                {schoolName.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="font-bold text-lg leading-tight">{schoolName}</div>
              <div className="text-xs text-white/85">{schoolNameEn}</div>
            </div>
          </div>

          <div className="relative z-10 mt-12">
            {tenantSlug && (
              <div className="text-xs font-mono text-white/85 mb-2">
                Tenant Subdomain: {tenantSlug}
              </div>
            )}
            <h2 className="text-2xl font-bold leading-snug">{welcomeMsg}</h2>
            <p className="mt-3 text-sm text-white/85">
              เข้าสู่ระบบด้วย Username และ Password เพื่อจัดการตารางสอน ตารางเรียน และข้อมูลวิชาการของสถานศึกษา
            </p>
          </div>
        </div>

        {/* Right Form */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center bg-white/95">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-6 w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับหน้าหลักแพลตฟอร์ม
          </Link>

          <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {publicBranding
              ? `เข้าสู่พื้นที่ทำงานของ ${publicBranding.nameTh}`
              : 'กรอก Username และ Password เพื่อเข้าใช้งานระบบ'}
          </p>

          {currentUser && !inviteId ? (
            <div
              className="mt-6 p-5 rounded-2xl border space-y-4"
              style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  }}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    เข้าสู่ระบบอยู่แล้วในชื่อ {currentUser.displayName}
                  </div>
                  <div className="text-xs text-slate-600 truncate font-mono">
                    @{currentUser.username} ·{' '}
                    {isSuperAdmin ? 'เจ้าของและผู้ดูแลระบบหลัก (Super Admin)' : currentUser.role}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate('/super-admin')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    }}
                  >
                    <span>เข้าสู่ Super Admin Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {school && (
                  <button
                    type="button"
                    onClick={() => navigate('/app/dashboard')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border text-xs font-semibold rounded-xl text-slate-800 hover:bg-slate-50"
                    style={{ borderColor: theme.border }}
                  >
                    <span>เข้าพื้นที่โรงเรียน ({school.nameTh})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>สลับบัญชี</span>
                </button>
              </div>
            </div>
          ) : needsAdminSetup && !publicBranding ? (
            <div className="mt-6 space-y-4">
              <div
                className="p-4 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <KeyRound className="w-4 h-4" style={{ color: primaryColor }} />
                  ตั้งค่าบัญชี Super Admin ครั้งแรก
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ยังไม่มีรหัสผ่านของเจ้าของระบบในฐานข้อมูล กรุณากำหนดรหัสผ่านสำหรับ Username{' '}
                  <span className="font-mono font-semibold text-slate-900">{setupUsername}</span>{' '}
                  เพื่อเปิดใช้งาน Super Admin Console ทันที
                </p>
              </div>

              <form onSubmit={handleSetupInitialAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username ผู้ดูแลระบบหลัก
                  </label>
                  <input
                    type="text"
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    กำหนดรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
                  </label>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ยืนยันรหัสผ่านอีกครั้ง
                  </label>
                  <input
                    type="password"
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-95 disabled:opacity-50 shadow-xs"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  }}
                >
                  {submitting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านและเข้าสู่ Super Admin'}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleUsernameLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin หรือชื่อผู้ใช้งาน"
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-95 disabled:opacity-50 shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                }}
              >
                {submitting ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>ยังไม่มีบัญชีโรงเรียน?</span>
            <Link to="/signup" className="font-semibold hover:underline" style={{ color: primaryColor }}>
              สมัครทดลองใช้ฟรี 14 วัน
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
