import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, LogIn, School as SchoolIcon } from 'lucide-react';
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

  const { currentUser, signInWithGoogle, refreshProfile } = useAuth();
  const { plans, platformSettings, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();

  // Tenant form fields (Step 2)
  const [nameTh, setNameTh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [province, setProvince] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState(initialPlan);
  const [submitting, setSubmitting] = useState(false);

  const cleanSlug = sanitizeSlug(slug);

  const handleGoogleSignup = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      showToast('ยืนยันตัวตนสำเร็จ กรุณากรอกข้อมูลโรงเรียนเพื่อเริ่มทดลองใช้', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('กรุณาเข้าสู่ระบบด้วย Google ก่อนสร้างโรงเรียน', 'warning');
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
          displayName: currentUser.displayName || currentUser.email,
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
                ยืนยันตัวตนด้วย Google และสร้าง Subdomain โรงเรียนบน Cloud Firestore ได้ทันที
              </p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-100 text-xs font-semibold">
            <div
              className={currentUser ? 'text-emerald-700' : ''}
              style={!currentUser ? { color: theme.primary } : undefined}
            >
              1. ยืนยันตัวตนผู้ดูแลโรงเรียน (Google Sign-In)
            </div>
            <div
              className={currentUser ? '' : 'text-slate-400'}
              style={currentUser ? { color: theme.primary } : undefined}
            >
              2. สร้างพื้นที่โรงเรียน & เริ่มทดลองใช้
            </div>
          </div>

          {!currentUser && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                เข้าสู่ระบบด้วยบัญชี Google ของผู้ดูแลโรงเรียนเพื่อสร้างพื้นที่ทำงานและทดลองใช้งานฟรี {platformSettings.trialDays} วัน
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogleSignup()}
                className="w-full py-3 px-4 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                <LogIn className="w-4 h-4" />
                <span>{submitting ? 'กำลังเข้าสู่ระบบ...' : 'ดำเนินการต่อด้วย Google'}</span>
              </button>
            </div>
          )}

          {currentUser && (
            <form onSubmit={handleCreateTenant} className="mt-6 space-y-5">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  ยืนยันตัวตนแล้ว: <span className="font-mono font-bold">{currentUser.email}</span> ({currentUser.displayName})
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
