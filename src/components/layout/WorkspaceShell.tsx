import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  Clock,
  CreditCard,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Palette,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DEFAULT_BRANDING, getSubscriptionStatusLabel } from '../../lib/tenant';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTileClass: string;
  roles: Array<'super_admin' | 'school_admin' | 'scheduler' | 'teacher'>;
}

export function WorkspaceShell({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isSuperAdmin, signOut } = useAuth();
  const {
    school,
    currentPlan,
    isReadOnly,
    daysRemaining,
    previewRole,
    effectiveSchoolRole,
    setPreviewPersona,
  } = useTenant();
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const effectiveRole = effectiveSchoolRole;

  const navItems: NavItem[] = [
    {
      to: '/app/dashboard',
      label: 'ภาพรวมโรงเรียน',
      icon: LayoutDashboard,
      iconTileClass: 'bg-sky-100 text-sky-700',
      roles: ['super_admin', 'school_admin', 'scheduler', 'teacher'],
    },
    {
      to: '/app/teacher-dashboard',
      label: 'ตารางสอนรายบุคคล',
      icon: Users,
      iconTileClass: 'bg-violet-100 text-violet-700',
      roles: ['super_admin', 'school_admin', 'scheduler', 'teacher'],
    },
    {
      to: '/app/room-dashboard',
      label: 'การใช้ห้องเรียน',
      icon: Building2,
      iconTileClass: 'bg-emerald-100 text-emerald-700',
      roles: ['super_admin', 'school_admin', 'scheduler', 'teacher'],
    },
    {
      to: '/app/timetable',
      label: 'จัดตารางสอน',
      icon: CalendarRange,
      iconTileClass: 'bg-indigo-100 text-indigo-700',
      roles: ['super_admin', 'school_admin', 'scheduler', 'teacher'],
    },
    {
      to: '/app/activities',
      label: 'ล็อกคาบกิจกรรม',
      icon: Lock,
      iconTileClass: 'bg-amber-100 text-amber-700',
      roles: ['super_admin', 'school_admin', 'scheduler'],
    },
    {
      to: '/app/master-data',
      label: 'ข้อมูลพื้นฐานโรงเรียน',
      icon: Database,
      iconTileClass: 'bg-teal-100 text-teal-700',
      roles: ['super_admin', 'school_admin', 'scheduler'],
    },
    {
      to: '/app/reports',
      label: 'รายงานและส่งออก',
      icon: FileSpreadsheet,
      iconTileClass: 'bg-rose-100 text-rose-700',
      roles: ['super_admin', 'school_admin', 'scheduler', 'teacher'],
    },
    {
      to: '/app/branding',
      label: 'ตั้งค่าโรงเรียน & อัตลักษณ์',
      icon: Palette,
      iconTileClass: 'bg-pink-100 text-pink-700',
      roles: ['super_admin', 'school_admin'],
    },
    {
      to: '/app/billing',
      label: 'แพ็กเกจและการชำระเงิน',
      icon: CreditCard,
      iconTileClass: 'bg-cyan-100 text-cyan-700',
      roles: ['super_admin', 'school_admin'],
    },
  ];

  const visibleNav = navItems.filter((item) => item.roles.includes(effectiveRole));

  const schoolName = school?.nameTh || DEFAULT_BRANDING.nameTh;
  const subStatus = school ? getSubscriptionStatusLabel(school.subscriptionStatus) : null;

  const showTrialWarning =
    school?.subscriptionStatus === 'trialing' &&
    daysRemaining !== null &&
    daysRemaining >= 0 &&
    daysRemaining <= 7;

  const handleSignOut = async () => {
    await signOut();
    navigate(school?.slug ? `/s/${school.slug}/login` : '/login');
  };

  return (
    <div className="min-h-screen pastel-ambient-bg flex">
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-68 pastel-glass border-r flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ borderColor: theme.border }}
      >
        {/* School Brand Header */}
        <div
          className="p-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: theme.border }}
        >
          <Link to="/app/dashboard" className="flex items-center gap-3 min-w-0">
            {school?.logoUrl ? (
              <img
                src={school.logoUrl}
                alt={schoolName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border bg-white shrink-0 shadow-xs"
                style={{ borderColor: theme.border }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                {schoolName.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{schoolName}</div>
              <div className="text-xs text-slate-500 truncate">
                {school ? `${school.slug} · ${currentPlan.name}` : 'Platform Console'}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {school &&
            visibleNav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
                  }`}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      theme.effectsEnabled ? 'group-hover:scale-105' : ''
                    } ${active ? 'bg-white/20 text-white' : item.iconTileClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

          {isSuperAdmin && (
            <div className="pt-4 mt-4 border-t" style={{ borderColor: theme.border }}>
              <div className="px-3 mb-2 text-xs font-semibold text-slate-400">
                เจ้าของแพลตฟอร์ม
              </div>
              <Link
                to="/super-admin"
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  location.pathname === '/super-admin'
                    ? 'text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/80 hover:text-slate-900'
                }`}
                style={
                  location.pathname === '/super-admin'
                    ? {
                        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                      }
                    : undefined
                }
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    theme.effectsEnabled ? 'group-hover:scale-105' : ''
                  } ${
                    location.pathname === '/super-admin'
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span>Super Admin Console</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Account Footer */}
        <div
          className="p-4 border-t"
          style={{ borderColor: theme.border, backgroundColor: `${theme.pastelAlt}aa` }}
        >
          {subStatus && (
            <div className="mb-3 text-xs text-slate-600 flex items-center justify-between">
              <span>สถานะ</span>
              <span
                className={`font-semibold ${
                  subStatus.tone === 'emerald'
                    ? 'text-emerald-700'
                    : subStatus.tone === 'amber'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {subStatus.label}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {previewRole === 'scheduler'
                  ? 'อ.สมชาย ใจดี (ตัวอย่าง)'
                  : previewRole === 'teacher'
                  ? 'อ.นภาพร วิทยา (ตัวอย่าง)'
                  : previewRole === 'school_admin'
                  ? 'ผู้ดูแลโรงเรียน (ตัวอย่าง)'
                  : userProfile?.displayName || currentUser?.username || 'ผู้ใช้งาน'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {effectiveRole === 'super_admin'
                  ? 'เจ้าของและผู้ดูแลระบบหลัก'
                  : effectiveRole === 'school_admin'
                  ? 'ผู้ดูแลโรงเรียน (School Admin)'
                  : effectiveRole === 'scheduler'
                  ? 'ผู้จัดตารางสอน (Scheduler)'
                  : 'ครูผู้สอน (Teacher)'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header
          className="no-print pastel-glass border-b px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sticky top-0 z-30"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white/80"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              {breadcrumb && (
                <div className="text-xs text-slate-500 truncate">{breadcrumb}</div>
              )}
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isSuperAdmin && school && location.pathname !== '/super-admin' && (
              <>
                <label className="hidden xl:inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-medium">บทบาททดลอง:</span>
                  <select
                    value={previewRole || 'super_admin'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'super_admin') {
                        setPreviewPersona(null, null);
                      } else if (val === 'scheduler') {
                        setPreviewPersona('scheduler', 'tch_demo_1');
                      } else if (val === 'teacher') {
                        setPreviewPersona('teacher', 'tch_demo_2');
                      } else if (val === 'school_admin') {
                        setPreviewPersona('school_admin', null);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl border bg-white/95 text-xs font-semibold text-slate-800 focus:outline-none"
                    style={{ borderColor: theme.border }}
                    title="สลับบทบาท User ตัวอย่างเพื่อทดลองสิทธิ์และหน้าจอ"
                  >
                    <option value="super_admin">เจ้าของระบบ (เต็มสิทธิ์)</option>
                    <option value="scheduler">ตัวอย่าง: ผู้จัดตารางสอน (Scheduler)</option>
                    <option value="school_admin">ตัวอย่าง: ผู้ดูแลโรงเรียน (Admin)</option>
                    <option value="teacher">ตัวอย่าง: ครูผู้สอน (อ่านอย่างเดียว)</option>
                  </select>
                </label>
                <Link
                  to="/super-admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-white/90 hover:bg-white transition-colors whitespace-nowrap"
                  style={{ borderColor: theme.border, color: theme.primary }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Super Admin Console</span>
                </Link>
              </>
            )}
            <ThemeSwitcher compact />
            {actions}
          </div>
        </header>

        {/* Sample Persona Preview Banner */}
        {isSuperAdmin && school && previewRole && location.pathname !== '/super-admin' && (
          <div
            className="no-print border-b px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
            style={{
              backgroundColor: theme.pastelSoft,
              borderColor: theme.border,
            }}
          >
            <div className="flex items-center gap-2 text-slate-800">
              <Users className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
              <span>
                กำลังทดลองใช้งานในบทบาท User ตัวอย่าง:{' '}
                <strong>
                  {previewRole === 'scheduler'
                    ? 'อ.สมชาย ใจดี (ผู้จัดตารางสอน · Scheduler)'
                    : previewRole === 'teacher'
                    ? 'อ.นภาพร วิทยา (ครูผู้สอน · ดูอย่างเดียว)'
                    : 'ผู้ดูแลโรงเรียน (School Admin)'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={previewRole}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'scheduler') setPreviewPersona('scheduler', 'tch_demo_1');
                  else if (val === 'teacher') setPreviewPersona('teacher', 'tch_demo_2');
                  else if (val === 'school_admin') setPreviewPersona('school_admin', null);
                }}
                className="xl:hidden px-2 py-1 rounded-lg border bg-white text-xs font-semibold"
                style={{ borderColor: theme.border }}
              >
                <option value="scheduler">ผู้จัดตารางสอน (Scheduler)</option>
                <option value="school_admin">ผู้ดูแลโรงเรียน (Admin)</option>
                <option value="teacher">ครูผู้สอน (Teacher)</option>
              </select>
              <button
                type="button"
                onClick={() => setPreviewPersona(null, null)}
                className="px-2.5 py-1 rounded-lg bg-white border text-xs font-semibold text-slate-700 hover:bg-slate-50"
                style={{ borderColor: theme.border }}
              >
                กลับสู่สิทธิ์เจ้าของระบบ
              </button>
            </div>
          </div>
        )}

        {/* Lifecycle Banners */}
        {isReadOnly && school && (
          <div className="no-print bg-rose-50/90 border-b border-rose-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>โหมดอ่านอย่างเดียว (Read-only):</strong> สมาชิกภาพของโรงเรียนหมดอายุหรือถูกระงับ
                คุณยังดูข้อมูลและดาวน์โหลดรายงานได้ แต่ไม่สามารถแก้ไขหรือลบข้อมูลได้
              </span>
            </div>
            <Link
              to="/app/billing"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              ต่ออายุสมาชิกทันที
            </Link>
          </div>
        )}

        {!isReadOnly && showTrialWarning && (
          <div className="no-print bg-amber-50/90 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                ช่วงทดลองใช้งานฟรี 14 วันจะสิ้นสุดในอีก{' '}
                <strong className="tabular-nums">{daysRemaining}</strong> วัน กรุณาเลือกแพ็กเกจเพื่อใช้งานต่อเนื่อง
              </span>
            </div>
            <Link
              to="/app/billing"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              อัปเกรดแพ็กเกจ
            </Link>
          </div>
        )}

        <motion.main
          key={location.pathname}
          initial={theme.effectsEnabled ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto print:p-0 print:max-w-none"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
