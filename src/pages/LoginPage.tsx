import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
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
    needsEmailVerificationForSuperAdmin,
    signInWithUsernamePassword,
    registerWithUsernamePassword,
    sendOwnerVerificationEmail,
    requestPasswordReset,
    refreshProfile,
    signOut,
  } = useAuth();
  const { publicBranding, school, tenantSlug, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register_invite'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetBox, setShowResetBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    userDisplayName: string,
    userUsername: string,
    role: string
  ) => {
    if (inviteId && publicBranding?.schoolId) {
      await acceptSchoolInvite(publicBranding.schoolId, publicBranding.slug, inviteId, {
        uid,
        email: userEmail,
        username: userUsername,
        displayName: userDisplayName,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('กรุณากรอก Username และ Password', 'warning');
      return;
    }

    if (mode === 'register_invite' && password !== confirmPassword) {
      showToast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const user =
        mode === 'register_invite' && inviteId
          ? await registerWithUsernamePassword({
              username,
              password,
              displayName: displayName.trim() || username.trim(),
            })
          : await signInWithUsernamePassword(username, password);

      showToast(`ยินดีต้อนรับ ${user.displayName}`, 'success');
      await completePostLogin(
        user.uid,
        user.email || '',
        user.displayName || user.username || user.email,
        user.username || username.trim().toLowerCase(),
        user.role
      );
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!username.trim()) {
      showToast('กรุณากรอก Username ของผู้ดูแลระบบหลักก่อน', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(username);
      showToast('ส่งลิงก์ตั้งรหัสผ่านไปยังอีเมลที่ผูกกับบัญชีหลักแล้ว', 'success');
      setShowResetBox(false);
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
        <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[560px] flex flex-col justify-between p-8 text-white bg-slate-900">
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
              เข้าสู่ระบบด้วย Username และ Password เพื่อจัดการตารางสอน ตารางเรียน และข้อมูลวิชาการของสถานศึกษาอย่างปลอดภัย
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
              ? `เข้าสู่พื้นที่ทำงานของ ${publicBranding.nameTh} ด้วย Username และ Password`
              : 'กรอก Username และ Password เพื่อเข้าใช้งานระบบ'}
          </p>

          {inviteId && publicBranding && (
            <div className="mt-4 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-2">
              <div>
                คุณได้รับคำเชิญเข้าร่วม <strong>{publicBranding.nameTh}</strong> กรุณาเข้าสู่ระบบหรือตั้งรหัสผ่านด้วย Username ที่ตรงกับคำเชิญเพื่อยืนยันสิทธิ์
              </div>
              {!currentUser && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border ${
                      mode === 'login'
                        ? 'bg-sky-700 text-white border-sky-700'
                        : 'bg-white text-sky-900 border-sky-300'
                    }`}
                  >
                    มีบัญชีอยู่แล้ว
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register_invite')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border ${
                      mode === 'register_invite'
                        ? 'bg-sky-700 text-white border-sky-700'
                        : 'bg-white text-sky-900 border-sky-300'
                    }`}
                  >
                    ตั้งรหัสผ่านบัญชีใหม่ตามคำเชิญ
                  </button>
                </div>
              )}
            </div>
          )}

          {needsEmailVerificationForSuperAdmin && currentUser && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold">บัญชียังไม่ได้ยืนยันอีเมลสำหรับสิทธิ์ Super Admin</div>
              <p>
                เพื่อความปลอดภัยของสิทธิ์เจ้าของแพลตฟอร์ม กรุณากดส่งลิงก์ยืนยันไปยังอีเมลหลัก แล้วคลิกรีเฟรชสถานะสิทธิ์
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void sendOwnerVerificationEmail()
                      .then(() => showToast('ส่งอีเมลยืนยันสิทธิ์แล้ว กรุณาตรวจสอบกล่องจดหมาย', 'success'))
                      .catch((err) => showToast(formatErrorMessage(err), 'error'))
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
                >
                  ส่งลิงก์ยืนยันอีเมล
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void refreshProfile()
                      .then(() => showToast('ตรวจสอบสถานะสิทธิ์แล้ว', 'info'))
                      .catch((err) => showToast(formatErrorMessage(err), 'error'))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-amber-900"
                >
                  รีเฟรชสถานะ
                </button>
              </div>
            </div>
          )}

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
                    @{currentUser.username || currentUser.email} ·{' '}
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
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {currentUser && inviteId && publicBranding && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    void completePostLogin(
                      currentUser.uid,
                      currentUser.email,
                      currentUser.displayName,
                      currentUser.username || '',
                      currentUser.role
                    ).catch((err) => showToast(formatErrorMessage(err), 'error'))
                  }
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting
                    ? 'กำลังยืนยันคำเชิญ...'
                    : `ยืนยันเข้าร่วม ${publicBranding.nameTh} ด้วยบัญชี @${currentUser.username || currentUser.displayName}`}
                </button>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="เช่น somchai01"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      required
                    />
                  </div>
                </div>

                {mode === 'register_invite' && inviteId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ชื่อ-นามสกุลที่แสดงในระบบ
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="เช่น อ.สมชาย ใจดี"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'register_invite' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'register_invite' && inviteId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ยืนยันรหัสผ่าน (Confirm Password)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-95 disabled:opacity-50 shadow-xs"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  }}
                >
                  {mode === 'register_invite' && inviteId ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>
                    {submitting
                      ? 'กำลังตรวจสอบข้อมูล...'
                      : mode === 'register_invite' && inviteId
                      ? 'สร้างบัญชีและเข้าร่วมโรงเรียน'
                      : 'เข้าสู่ระบบด้วย Username & Password'}
                  </span>
                </button>
              </form>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetBox((v) => !v)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>ตั้งรหัสผ่าน / ลืมรหัสผ่านผู้ดูแลระบบหลัก</span>
                </button>
              </div>

              {showResetBox && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                  <div>
                    สำหรับบัญชีผู้ดูแลระบบหลักที่ผูกอีเมลไว้ สามารถส่งลิงก์ตั้งรหัสผ่านได้โดยกรอก Username ด้านบนแล้วกดปุ่มด้านล่าง
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSendPasswordReset()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    ส่งลิงก์ตั้งรหัสผ่าน
                  </button>
                </div>
              )}
            </div>
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
