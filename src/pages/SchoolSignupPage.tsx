import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, KeyRound, School as SchoolIcon, UserPlus } from 'lucide-react';
import { ThemeSwitcher } from '../components/theme/ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../lib/firestoreError';
import { sanitizeSlug } from '../lib/tenant';
import { createSchoolTenantAndTrial } from '../services/schoolService';

export function SchoolSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'professional';

  const { currentUser, signUpWithUsername, refreshProfile } = useAuth();
  const { plans, platformSettings, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();

  // Auth form fields (Step 1)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Tenant form fields (Step 2)
  const [nameTh, setNameTh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [province, setProvince] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState(initialPlan);
  const [submitting, setSubmitting] = useState(false);

  const cleanSlug = sanitizeSlug(slug);

  const handleUsernameSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || password.length < 6 || !displayName.trim()) {
      showToast('กรุณากรอก Username ชื่อผู้ดูแล และรหัสผ่านอย่างน้อย 6 ตัวอักษร', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithUsername(username, password, displayName);
      showToast('สร้างบัญชีผู้ใช้งานสำเร็จ กรุณากรอกข้อมูลโรงเรียนเพื่อเริ่มทดลองใช้', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('กรุณาสมัครบัญชีผู้ใช้งานก่อนสร้างโรงเรียน', 'warning');
      return;
    }
    if (!nameTh.trim() || cleanSlug.length < 2) {
      showToast('กรุณากรอกชื่อโรงเรียนและ Subdomain ให้ถูกต้อง', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await createSchoolTenantAndTrial(
        {
          nameTh,
          nameEn,
          slug: cleanSlug,
          province,
          phone,
          planId,
          trialDays: platformSettings.trialDays,
        },
        {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || displayName || currentUser.username,
          username: currentUser.username,
        }
      );
      await refreshProfile();
      await refreshTenant();
      showToast(`เปิดใช้งานโรงเรียนสำเร็จ! ทดลองใช้ฟรี ${platformSettings.trialDays} วัน`, 'success');
      navigate('/app/dashboard');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pastel-ambient-bg py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับหน้าแพ็กเกจ
          </Link>
          <ThemeSwitcher />
        </div>

        <motion.div
          initial={theme.effectsEnabled ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="pastel-glass rounded-3xl border p-6 sm:p-10 shadow-lg"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
            <div
              className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <SchoolIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                สมัครใช้งานโรงเรียน (ทดลองฟรี {platformSettings.trialDays} วัน)
              </h1>
              <p className="text-sm text-slate-500">
                สร้างบัญชี Username / Password และ Subdomain โรงเรียนได้ทันที
              </p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-100 text-xs font-semibold">
            <div
              className={currentUser ? 'text-emerald-700' : ''}
              style={!currentUser ? { color: theme.primary } : undefined}
            >
              1. สมัครบัญชีผู้ดูแลโรงเรียน (Username / Password)
            </div>
            <div
              className={currentUser ? '' : 'text-slate-400'}
              style={currentUser ? { color: theme.primary } : undefined}
            >
              2. สร้างพื้นที่โรงเรียน & เริ่มทดลองใช้
            </div>
          </div>

          {!currentUser && (
            <form onSubmit={handleUsernameSignup} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อ-นามสกุล ผู้ดูแลโรงเรียน
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น อ.สมชาย ใจดี"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username (ภาษาอังกฤษ/ตัวเลข 3+ ตัวอักษร)
                </label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="schooladmin01"
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รหัสผ่าน (6+ ตัวอักษร)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                    required
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                  }}
                >
                  {submitting ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีผู้ใช้งานและไปขั้นตอนสร้างโรงเรียน'}
                </button>
              </div>
            </form>
          )}

          {currentUser && (
            <form onSubmit={handleCreateTenant} className="mt-6 space-y-5">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  เข้าสู่ระบบแล้ว: <span className="font-mono font-bold">@{currentUser.username}</span> ({currentUser.displayName})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อโรงเรียน (ภาษาไทย) *
                  </label>
                  <input
                    type="text"
                    value={nameTh}
                    onChange={(e) => setNameTh(e.target.value)}
                    placeholder="เช่น โรงเรียนสาธิตวิทยาคาร"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อโรงเรียน (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Satit Wittayakarn School"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Subdomain ของโรงเรียน (a-z, 0-9, -) *
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="satit-school"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono"
                    required
                  />
                  <div className="mt-1 text-xs text-slate-500 font-mono">
                    URL: {cleanSlug || 'your-school'}.kruschedule.app (/s/{cleanSlug || 'your-school'})
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">จังหวัด</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="กรุงเทพมหานคร"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="02-123-4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    แพ็กเกจเริ่มต้นหลังหมดช่วงทดลองใช้
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {plans.map((p) => {
                      const active = planId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlanId(p.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            active ? 'ring-1 shadow-xs' : 'bg-white hover:bg-slate-50'
                          }`}
                          style={{
                            borderColor: active ? theme.primary : '#e2e8f0',
                            backgroundColor: active ? theme.pastelAlt : undefined,
                          }}
                        >
                          <div className="font-bold text-sm text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-600 tabular-nums mt-0.5">
                            ฿{p.priceAnnual.toLocaleString()}/ปี · {p.maxTeachers} ครู
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 text-white font-semibold rounded-xl text-sm shadow-xs hover:opacity-95 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                {submitting
                  ? 'กำลังสร้างพื้นที่โรงเรียน...'
                  : `เริ่มทดลองใช้งานฟรี ${platformSettings.trialDays} วันทันที`}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
